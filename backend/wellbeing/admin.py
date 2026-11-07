from django.contrib import admin

from .models import JournalPrompt

# Only the prompt bank (content) is exposed. MoodEntry and JournalEntry are clinical-store data and are
# intentionally NOT registered: admins must never browse individual-level records.


@admin.register(JournalPrompt)
class JournalPromptAdmin(admin.ModelAdmin):
    list_display = ['domain_code', 'language_code', 'prompt_text', 'rotation_weight', 'review_status', 'is_active']
    list_filter = ['domain_code', 'language_code', 'review_status', 'is_active']
    search_fields = ['prompt_text']
