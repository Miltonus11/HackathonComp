from django.contrib import admin

from .models import AdviceContent, Instrument, InstrumentItem, SeverityBand

# Content tables only. Sessions, assessments and responses are clinical data and are
# intentionally NOT registered here.


@admin.register(Instrument)
class InstrumentAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'item_count', 'scoring_version', 'is_active']


@admin.register(InstrumentItem)
class InstrumentItemAdmin(admin.ModelAdmin):
    list_display = ['instrument', 'item_no', 'language_code', 'is_critical']
    list_filter = ['instrument', 'language_code']


@admin.register(SeverityBand)
class SeverityBandAdmin(admin.ModelAdmin):
    list_display = ['instrument', 'severity_code', 'min_value', 'max_value', 'triggers_crisis_flow']
    list_filter = ['instrument']


@admin.register(AdviceContent)
class AdviceContentAdmin(admin.ModelAdmin):
    list_display = ['instrument', 'severity_code', 'language_code', 'version', 'review_status', 'reviewed_by']
    list_filter = ['instrument', 'language_code', 'review_status']
