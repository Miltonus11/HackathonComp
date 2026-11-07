"""The only place that talks to OpenAI. Server-side only; the key never leaves the backend.

Every failure (timeout, network, rate limit, bad JSON, switch off) becomes AIUnavailable so callers
have exactly one thing to handle. Errors are logged by type only: exception messages can contain the
request, and that is the user's private journal text.
"""
import json
import logging

from django.conf import settings

logger = logging.getLogger(__name__)


class AIUnavailable(Exception):
    pass


def enabled():
    return bool(settings.AI_FEATURES_ENABLED and settings.OPENAI_API_KEY)


def _sdk():
    from openai import OpenAI
    return OpenAI(api_key=settings.OPENAI_API_KEY, max_retries=0)  # the timeout below must be the whole wait


def complete_json(system, user, *, timeout, max_tokens=300):
    """Ask the model for a JSON object. No user identifier, metadata or storage is ever sent."""
    if not enabled():
        raise AIUnavailable('AI features are off')
    try:
        response = _sdk().chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[{'role': 'system', 'content': system}, {'role': 'user', 'content': user}],
            response_format={'type': 'json_object'},
            max_completion_tokens=max_tokens,
            timeout=timeout,
            store=False,
        )
        data = json.loads(response.choices[0].message.content)
    except Exception as exc:
        logger.warning('AI call failed: %s', type(exc).__name__)
        raise AIUnavailable(type(exc).__name__) from None
    if not isinstance(data, dict):
        logger.warning('AI call returned something other than a JSON object')
        raise AIUnavailable('not a JSON object')
    return data
