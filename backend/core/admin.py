from django.contrib import admin
from .models import (
	DonorProfile, EmergencyNeed, OrganDonor, MarketplaceItem, Hospital, Doctor, Review,
	DonationRequest, HospitalNeed, Appointment, MedicalEssential, MedicalStoreProduct,
	MedicalEquipment, MedicalOrder, MedicalOrderItem
)


@admin.register(DonorProfile)
class DonorProfileAdmin(admin.ModelAdmin):
	list_display = ("email", "blood_group", "city", "is_platelet_donor", "is_available")
	search_fields = ("user__username", "city", "zip_code", "blood_group")
	list_filter = ("blood_group", "is_platelet_donor", "is_available")


@admin.register(EmergencyNeed)
class EmergencyNeedAdmin(admin.ModelAdmin):
	list_display = ("title", "need_type", "city", "status", "created_at")
	search_fields = ("title", "city", "zip_code", "required_blood_group")
	list_filter = ("need_type", "status")


@admin.register(OrganDonor)
class OrganDonorAdmin(admin.ModelAdmin):
	list_display = ("user", "consent_provided", "city")
	search_fields = ("user__username", "city", "zip_code", "organs")
	list_filter = ("consent_provided",)


@admin.register(Hospital)
class HospitalAdmin(admin.ModelAdmin):
	list_display = ("name", "city", "phone")
	search_fields = ("name", "city", "zip_code")


@admin.register(Doctor)
class DoctorAdmin(admin.ModelAdmin):
	list_display = ("name", "specialization", "hospital")
	search_fields = ("name", "specialization", "hospital__name")
	list_filter = ("hospital",)


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
	list_display = ("user", "rating", "doctor", "hospital", "is_moderated", "created_at")
	search_fields = ("user__username", "doctor__name", "hospital__name", "comment")
	list_filter = ("rating", "is_moderated")


@admin.register(MarketplaceItem)
class MarketplaceItemAdmin(admin.ModelAdmin):
	list_display = ("title", "seller", "category", "price_cents", "currency", "city", "is_active")
	search_fields = ("title", "seller__username", "city", "zip_code")
	list_filter = ("category", "is_active")


@admin.register(DonationRequest)
class DonationRequestAdmin(admin.ModelAdmin):
	list_display = ("donor", "hospital", "status", "created_at", "scheduled_date")
	search_fields = ("donor__username", "hospital__name", "message")
	list_filter = ("status", "hospital", "created_at")
	readonly_fields = ("created_at", "updated_at")


@admin.register(HospitalNeed)
class HospitalNeedAdmin(admin.ModelAdmin):
	list_display = ("hospital", "need_type", "required_blood_group", "status", "quantity_needed", "created_at")
	search_fields = ("hospital__name", "patient_name", "patient_details")
	list_filter = ("need_type", "status", "hospital", "created_at")
	readonly_fields = ("created_at", "updated_at")


@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
	list_display = ("donor", "hospital", "appointment_date", "status", "created_at")
	search_fields = ("donor__username", "hospital__name", "notes")
	list_filter = ("status", "hospital", "appointment_date", "created_at")
	readonly_fields = ("created_at", "updated_at")


@admin.register(MedicalEssential)
class MedicalEssentialAdmin(admin.ModelAdmin):
	list_display = ("company_name", "user", "business_type", "city", "is_active", "is_verified", "api_key_created_at")
	search_fields = ("company_name", "user__email", "contact_person", "city", "license_number")
	list_filter = ("business_type", "is_active", "is_verified")
	readonly_fields = ("api_key", "api_key_created_at", "created_at", "updated_at")


@admin.register(MedicalStoreProduct)
class MedicalStoreProductAdmin(admin.ModelAdmin):
	list_display = ("name", "supplier", "category", "price", "quantity_available", "is_active", "created_at")
	search_fields = ("name", "brand", "sku", "supplier__company_name")
	list_filter = ("category", "is_active", "is_prescription_required")
	readonly_fields = ("created_at", "updated_at")


@admin.register(MedicalEquipment)
class MedicalEquipmentAdmin(admin.ModelAdmin):
	list_display = ("name", "supplier", "equipment_type", "price", "quantity_available", "is_active", "is_new", "created_at")
	search_fields = ("name", "brand", "model_number", "sku", "supplier__company_name")
	list_filter = ("equipment_type", "is_active", "is_new")
	readonly_fields = ("created_at", "updated_at")


@admin.register(MedicalOrder)
class MedicalOrderAdmin(admin.ModelAdmin):
	list_display = ("order_number", "customer", "supplier", "order_type", "total_amount", "status", "created_at")
	search_fields = ("order_number", "customer__email", "supplier__company_name")
	list_filter = ("order_type", "status", "created_at")
	readonly_fields = ("order_number", "created_at", "updated_at")


@admin.register(MedicalOrderItem)
class MedicalOrderItemAdmin(admin.ModelAdmin):
	list_display = ("order", "product_type", "quantity", "unit_price", "subtotal")
	search_fields = ("order__order_number",)
	list_filter = ("product_type",)
	readonly_fields = ("subtotal", "created_at", "updated_at")


