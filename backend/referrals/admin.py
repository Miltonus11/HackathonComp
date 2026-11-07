from django.contrib import admin

from .models import Service, ServiceLanguage, ServiceSector

# Only the directory (content) is exposed. Referral is clinical-store data and is intentionally
# NOT registered: admins must never browse individual-level records.


class ServiceLanguageInline(admin.TabularInline):
    model = ServiceLanguage
    extra = 0


class ServiceSectorInline(admin.TabularInline):
    model = ServiceSector
    extra = 0


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ['name', 'service_type', 'barangay', 'cost_type', 'min_severity', 'is_crisis_service',
                    'last_verified_at', 'is_active']
    list_filter = ['service_type', 'cost_type', 'min_severity', 'is_crisis_service', 'is_active']
    search_fields = ['name', 'phone', 'address']
    inlines = [ServiceLanguageInline, ServiceSectorInline]
