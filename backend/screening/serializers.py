from rest_framework import serializers

INSTRUMENT_CODES = ['WHO5', 'GAD7', 'PHQ9', 'PHQ9_ITEM9']


class ResponseItemSerializer(serializers.Serializer):
    item_no = serializers.IntegerField()
    value = serializers.IntegerField()


class ChoiceSerializer(serializers.Serializer):
    accept = serializers.BooleanField()


class AnswerSerializer(serializers.Serializer):
    instrument = serializers.ChoiceField(choices=INSTRUMENT_CODES)
    responses = ResponseItemSerializer(many=True, allow_empty=False)

    def validate_responses(self, items):
        numbers = [i['item_no'] for i in items]
        if len(numbers) != len(set(numbers)):
            raise serializers.ValidationError('Each item may be answered only once.')
        return items

    def responses_dict(self):
        return {i['item_no']: i['value'] for i in self.validated_data['responses']}
