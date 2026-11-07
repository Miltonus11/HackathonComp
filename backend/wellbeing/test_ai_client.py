from types import SimpleNamespace
from unittest import mock

from django.test import SimpleTestCase, override_settings

from wellbeing import ai_client


def fake_sdk(content='{"ok": true}', error=None):
    calls = []

    def create(**kwargs):
        calls.append(kwargs)
        if error:
            raise error
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])

    sdk = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    return sdk, calls


ON = dict(AI_FEATURES_ENABLED=True, OPENAI_API_KEY='sk-test', OPENAI_MODEL='gpt-4o-mini')


@override_settings(**ON)
class CompleteJsonTests(SimpleTestCase):
    def call(self, sdk, **kw):
        with mock.patch('wellbeing.ai_client._sdk', return_value=sdk):
            return ai_client.complete_json('SYSTEM', 'USER', timeout=kw.pop('timeout', 7), **kw)

    def test_returns_the_parsed_object(self):
        sdk, _ = fake_sdk('{"risk": false}')
        self.assertEqual(self.call(sdk), {'risk': False})

    def test_sends_the_configured_model_json_mode_timeout_and_no_storage(self):
        sdk, calls = fake_sdk()
        self.call(sdk, timeout=7, max_tokens=123)
        sent = calls[0]
        self.assertEqual(sent['model'], 'gpt-4o-mini')
        self.assertEqual(sent['response_format'], {'type': 'json_object'})
        self.assertEqual(sent['timeout'], 7)
        self.assertEqual(sent['max_completion_tokens'], 123)
        self.assertIs(sent['store'], False)
        self.assertEqual([m['role'] for m in sent['messages']], ['system', 'user'])
        self.assertEqual([m['content'] for m in sent['messages']], ['SYSTEM', 'USER'])

    def test_never_sends_a_user_identifier(self):
        sdk, calls = fake_sdk()
        self.call(sdk)
        self.assertNotIn('user', calls[0])
        self.assertNotIn('metadata', calls[0])

    def test_model_comes_from_settings(self):
        sdk, calls = fake_sdk()
        with override_settings(OPENAI_MODEL='some-other-model'):
            self.call(sdk)
        self.assertEqual(calls[0]['model'], 'some-other-model')

    def test_every_failure_becomes_ai_unavailable(self):
        cases = [
            fake_sdk(error=RuntimeError('boom')),
            fake_sdk(error=TimeoutError()),
            fake_sdk(content='not json'),
            fake_sdk(content='[1, 2]'),
            fake_sdk(content='"text"'),
            fake_sdk(content=None),
            fake_sdk(content=''),
        ]
        for sdk, _ in cases:
            with self.assertRaises(ai_client.AIUnavailable):
                self.call(sdk)

    def test_empty_choices_is_unavailable(self):
        sdk = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(
            create=lambda **kw: SimpleNamespace(choices=[]))))
        with self.assertRaises(ai_client.AIUnavailable):
            self.call(sdk)

    def test_failures_log_only_the_error_type_never_the_content(self):
        sdk, _ = fake_sdk(error=RuntimeError('my private journal text'))
        with self.assertLogs('wellbeing.ai_client', level='WARNING') as logs:
            with self.assertRaises(ai_client.AIUnavailable) as ctx:
                self.call(sdk)
        output = '\n'.join(logs.output) + str(ctx.exception)
        self.assertIn('RuntimeError', output)
        self.assertNotIn('private journal', output)
        self.assertIsNone(ctx.exception.__cause__)  # the original error carries the content, so it is not chained


class EnabledTests(SimpleTestCase):
    def test_off_by_default(self):
        self.assertFalse(ai_client.enabled())

    @override_settings(AI_FEATURES_ENABLED=True, OPENAI_API_KEY='')
    def test_on_but_no_key_is_off(self):
        self.assertFalse(ai_client.enabled())

    @override_settings(AI_FEATURES_ENABLED=False, OPENAI_API_KEY='sk-test')
    def test_key_but_switch_off_is_off(self):
        self.assertFalse(ai_client.enabled())

    @override_settings(**ON)
    def test_both_needed(self):
        self.assertTrue(ai_client.enabled())

    @override_settings(AI_FEATURES_ENABLED=False, OPENAI_API_KEY='sk-test')
    def test_disabled_never_touches_the_sdk(self):
        with mock.patch('wellbeing.ai_client._sdk') as sdk:
            with self.assertRaises(ai_client.AIUnavailable):
                ai_client.complete_json('s', 'u', timeout=1)
        sdk.assert_not_called()
