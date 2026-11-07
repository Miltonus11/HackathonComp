from django.contrib import admin

from .models import Barangay

# Only the lookup table is exposed. UserProfile and Consent are clinical-store data and are
# intentionally NOT registered: admins must never browse individual-level records.


@admin.register(Barangay)
class BarangayAdmin(admin.ModelAdmin):
    list_display = ['name', 'city_municipality', 'province', 'psgc_code', 'district']
    search_fields = ['name', 'psgc_code']
