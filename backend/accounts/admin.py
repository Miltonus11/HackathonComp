from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ['mobile_number']
    list_display = ['mobile_number', 'display_name', 'role', 'status', 'is_staff']
    list_filter = ['role', 'status', 'is_staff']
    search_fields = ['mobile_number', 'email', 'first_name', 'last_name', 'display_name']
    readonly_fields = ['user_id', 'last_login', 'date_joined']
    fieldsets = (
        (None, {'fields': ('mobile_number', 'password', 'user_id')}),
        ('Personal info', {'fields': ('first_name', 'last_name', 'display_name', 'email', 'contact_for_followup')}),
        ('Role', {'fields': ('role', 'license_no', 'mfa_enabled', 'status')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Dates', {'fields': ('mobile_verified_at', 'last_login', 'date_joined')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('mobile_number', 'first_name', 'last_name', 'role', 'password1', 'password2'),
        }),
    )
