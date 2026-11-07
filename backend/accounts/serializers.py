from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import PH_MOBILE_RE, User, normalize_mobile


class UserSerializer(serializers.ModelSerializer):
    """Public representation of the signed-in user."""

    class Meta:
        model = User
        fields = [
            'user_id', 'mobile_number', 'email', 'first_name', 'last_name',
            'display_name', 'role', 'contact_for_followup', 'date_joined',
        ]
        read_only_fields = ['user_id', 'mobile_number', 'role', 'date_joined']


class RegisterSerializer(serializers.ModelSerializer):
    # Declared explicitly so the model's strict validator doesn't run before normalization.
    mobile_number = serializers.CharField(max_length=20)
    password = serializers.CharField(write_only=True, validators=[validate_password])

    class Meta:
        model = User
        fields = [
            'mobile_number', 'password', 'email', 'first_name', 'last_name',
            'display_name', 'contact_for_followup',
        ]
        extra_kwargs = {'email': {'required': False, 'allow_null': True}}

    def validate_mobile_number(self, value):
        value = normalize_mobile(value)
        if not PH_MOBILE_RE.match(value):
            raise serializers.ValidationError('Enter a valid PH mobile number, e.g. 09171234567.')
        if User.objects.filter(mobile_number=value).exists():
            raise serializers.ValidationError('A user with this mobile number already exists.')
        return value

    def validate_email(self, value):
        if not value:
            return None
        value = value.lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('A user with this email already exists.')
        return value

    def create(self, validated_data):
        # Self-registration always creates a resident; staff are created by an admin.
        return User.objects.create_user(role=User.Role.USER, **validated_data)


class LoginSerializer(TokenObtainPairSerializer):
    """Accepts 09XXXXXXXXX / +639XXXXXXXXX etc. and normalizes before authenticating."""

    def validate(self, attrs):
        attrs['mobile_number'] = normalize_mobile(attrs.get('mobile_number'))
        return super().validate(attrs)
