from rest_framework import serializers

from .models import Barangay, Consent, UserProfile


class BarangaySerializer(serializers.ModelSerializer):
    class Meta:
        model = Barangay
        fields = ['id', 'name', 'district']


class ProfileSerializer(serializers.ModelSerializer):
    barangay_name = serializers.CharField(source='barangay.name', read_only=True)
    age_band = serializers.CharField(read_only=True)

    class Meta:
        model = UserProfile
        fields = ['birth_year', 'sex', 'sector', 'occupation_detail', 'barangay', 'barangay_name',
                  'language_code', 'age_band', 'onboarding_completed_at']
        read_only_fields = ['onboarding_completed_at']


class ConsentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Consent
        fields = ['consent_type', 'granted', 'notice_version', 'language_code', 'decided_at']
        read_only_fields = ['decided_at']
