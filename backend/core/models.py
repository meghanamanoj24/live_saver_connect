from django.conf import settings
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
import secrets
import hashlib



class CustomUserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)

        return self.create_user(email, password, **extra_fields)
	

class DonorModules(models.TextChoices):
    DONOR = "donor", "Donor"
    HOSPITAL = "hospital", "Hospital"
    MEDICAL_ESSENTIAL = "medical_essential", "Medical Essential"


class DonorProfile(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True, null=True, blank=True)
    password = models.CharField(max_length=128, null=True, blank=True)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # ---- Donor Fields (Merged) ----
    BLOOD_GROUP_CHOICES = [
        ("A+", "A+"), ("A-", "A-"),
        ("B+", "B+"), ("B-", "B-"),
        ("AB+", "AB+"), ("AB-", "AB-"),
        ("O+", "O+"), ("O-", "O-"),
    ]
    first_name = models.CharField(max_length=120, null=True, blank=True)
    last_name = models.CharField(max_length=120, null=True, blank=True)
    GENDER_CHOICES = [
		("M", "Male"),
		("F", "Female"),
		("O", "Other"),
	]

    gender = models.CharField(max_length=1, choices=GENDER_CHOICES, null=True, blank=True)


    blood_group = models.CharField(max_length=3, choices=BLOOD_GROUP_CHOICES, null=True, blank=True)
    city = models.CharField(max_length=120, null=True, blank=True)
    zip_code = models.CharField(max_length=20, blank=True, null=True)
    is_platelet_donor = models.BooleanField(default=False)
    last_donated_on = models.DateField(null=True, blank=True)
    phone = models.CharField(max_length=32, blank=True, null=True)
    is_available = models.BooleanField(default=True)

    # ---- Donor Module ----
    donor_module = models.CharField(
        max_length=20,
        choices=DonorModules.choices,
        null=True,
        blank=True
    )

    # ---- User Manager ----
    objects = CustomUserManager()

    # ---- Set email as the login field ----
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []   # No username needed

    def __str__(self):
        return self.email


class TimeStampedModel(models.Model):
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		abstract = True

class EmergencyNeed(TimeStampedModel):
	NEED_TYPE_CHOICES = [
		("BLOOD", "Blood"),
		("PLATELETS", "Platelets"),
		("ORGAN", "Organ"),
		("FUNDS", "Funds"),
		("OTHER", "Other"),
	]

	STATUS_CHOICES = [
		("OPEN", "Open"),
		("FULFILLED", "Fulfilled"),
		("CANCELLED", "Cancelled"),
	]

	created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="emergency_needs")
	title = models.CharField(max_length=200)
	description = models.TextField(blank=True)
	need_type = models.CharField(max_length=16, choices=NEED_TYPE_CHOICES, default="BLOOD")
	required_blood_group = models.CharField(max_length=3, blank=True)
	city = models.CharField(max_length=120)
	zip_code = models.CharField(max_length=20, blank=True)
	contact_phone = models.CharField(max_length=32, blank=True)
	status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="OPEN")
	needed_by = models.DateTimeField(null=True, blank=True)
	poster_image = models.ImageField(upload_to="emergency_posters/", blank=True, null=True, help_text="Patient poster/image for sharing")

	def __str__(self) -> str:
		return f"{self.title} [{self.need_type}]"


class OrganDonor(TimeStampedModel):
	ORGAN_CHOICES = [
		("HEART", "Heart"),
		("LIVER", "Liver"),
		("KIDNEY", "Kidney"),
		("LUNGS", "Lungs"),
		("PANCREAS", "Pancreas"),
		("INTESTINE", "Intestine"),
		("TISSUE", "Tissue"),
		("OTHER", "Other"),
	]

	user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="organ_donor")
	organs = models.CharField(max_length=255, help_text="Comma-separated organ codes, e.g. HEART,KIDNEY")
	city = models.CharField(max_length=120)
	zip_code = models.CharField(max_length=20, blank=True)
	consent_provided = models.BooleanField(default=False)
	# Enhanced fields
	medical_student_donation = models.BooleanField(default=False, help_text="Willing to donate body for medical students")
	selected_hospitals = models.ManyToManyField("Hospital", blank=True, related_name="organ_donors", help_text="Hospitals/centers to receive the donation report")
	health_certificate = models.FileField(upload_to="health_certificates/", blank=True, null=True)
	post_mortem_consent = models.BooleanField(default=False)
	family_responsibility = models.BooleanField(default=False, help_text="Family authorized for donation decisions")
	living_kidney_donation = models.BooleanField(default=False, help_text="Willing to donate kidney while alive")
	date_of_birth = models.DateField(null=True, blank=True)
	blood_group = models.CharField(max_length=3, blank=True)
	phone = models.CharField(max_length=32, blank=True)
	address = models.TextField(blank=True)
	emergency_contact_name = models.CharField(max_length=200, blank=True)
	emergency_contact_phone = models.CharField(max_length=32, blank=True)
	emergency_contact_relation = models.CharField(max_length=100, blank=True)

	def __str__(self) -> str:
		return f"OrganDonor<{self.user.username}>"


class Hospital(TimeStampedModel):
	HOSPITAL_TYPE_CHOICES = [
		("HOSPITAL", "Hospital"),
		("BLOOD_CENTER", "Blood Center"),
		("BOTH", "Both Hospital & Blood Center"),
	]

	name = models.CharField(max_length=200)
	hospital_type = models.CharField(max_length=20, choices=HOSPITAL_TYPE_CHOICES, default="HOSPITAL")
	city = models.CharField(max_length=120)
	zip_code = models.CharField(max_length=20, blank=True)
	address = models.TextField(blank=True)
	phone = models.CharField(max_length=32, blank=True)
	website = models.URLField(blank=True)
	latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True, help_text="For location-based search")
	longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True, help_text="For location-based search")
	user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name="hospital_profile", help_text="User account for hospital login")

	def __str__(self) -> str:
		return self.name


class Doctor(TimeStampedModel):
	name = models.CharField(max_length=200)
	specialization = models.CharField(max_length=200, blank=True)
	qualifications = models.TextField(blank=True, help_text="Medical degrees, certifications, etc.")
	hospital = models.ForeignKey(Hospital, on_delete=models.SET_NULL, null=True, related_name="doctors")
	phone = models.CharField(max_length=32, blank=True)
	email = models.EmailField(blank=True)

	def __str__(self) -> str:
		return self.name


class HospitalNeed(TimeStampedModel):
	NEED_TYPE_CHOICES = [
		("BLOOD", "Blood"),
		("PLATELETS", "Platelets"),
		("EMERGENCY", "Emergency Case"),
		("ORGAN", "Organ"),
	]

	STATUS_CHOICES = [
		("URGENT", "Urgent"),
		("NORMAL", "Normal"),
		("FULFILLED", "Fulfilled"),
		("CANCELLED", "Cancelled"),
	]

	hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE, related_name="hospital_needs")
	need_type = models.CharField(max_length=20, choices=NEED_TYPE_CHOICES, default="BLOOD")
	required_blood_group = models.CharField(max_length=3, blank=True)
	patient_name = models.CharField(max_length=200, blank=True)
	patient_details = models.TextField(blank=True, help_text="Patient information and medical condition")
	poster_image = models.URLField(blank=True, help_text="URL to patient poster/image")
	status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="NORMAL")
	quantity_needed = models.PositiveIntegerField(default=1, help_text="Number of units needed")
	needed_by = models.DateTimeField(null=True, blank=True)
	notes = models.TextField(blank=True)

	def __str__(self) -> str:
		return f"{self.hospital.name} - {self.need_type}"


class Appointment(TimeStampedModel):
	STATUS_CHOICES = [
		("SCHEDULED", "Scheduled"),
		("COMPLETED", "Completed"),
		("CANCELLED", "Cancelled"),
		("NO_SHOW", "No Show"),
	]

	donor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="appointments")
	hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE, related_name="appointments")
	donation_request = models.ForeignKey("DonationRequest", on_delete=models.SET_NULL, null=True, blank=True, related_name="appointments")
	appointment_date = models.DateTimeField()
	status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="SCHEDULED")
	notes = models.TextField(blank=True)

	def __str__(self) -> str:
		return f"Appointment: {self.donor.username} at {self.hospital.name} on {self.appointment_date}"


class Review(TimeStampedModel):
	RATING_CHOICES = [(i, str(i)) for i in range(1, 6)]

	user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reviews")
	hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE, null=True, blank=True, related_name="reviews")
	doctor = models.ForeignKey(Doctor, on_delete=models.CASCADE, null=True, blank=True, related_name="reviews")
	rating = models.IntegerField(choices=RATING_CHOICES)
	comment = models.TextField(blank=True)
	is_moderated = models.BooleanField(default=False)

	def __str__(self) -> str:
		target = self.doctor.name if self.doctor else (self.hospital.name if self.hospital else "Unknown")
		return f"Review {self.rating}★ for {target}"


class MarketplaceItem(TimeStampedModel):
	CATEGORY_CHOICES = [
		("BLOOD_BAGS", "Blood Bags"),
		("PPE", "PPE"),
		("OXYGEN", "Oxygen Supplies"),
		("MED_EQUIP", "Medical Equipment"),
		("OTHER", "Other"),
	]

	seller = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="items_for_sale")
	title = models.CharField(max_length=200)
	description = models.TextField(blank=True)
	category = models.CharField(max_length=32, choices=CATEGORY_CHOICES, default="OTHER")
	price_cents = models.PositiveIntegerField()
	currency = models.CharField(max_length=8, default="USD")
	city = models.CharField(max_length=120)
	zip_code = models.CharField(max_length=20, blank=True)
	quantity_available = models.PositiveIntegerField(default=1)
	is_active = models.BooleanField(default=True)

	def __str__(self) -> str:
		return self.title


class DonationRequest(TimeStampedModel):
	STATUS_CHOICES = [
		("PENDING", "Pending"),
		("ACCEPTED", "Accepted"),
		("REJECTED", "Rejected"),
		("COMPLETED", "Completed"),
		("CANCELLED", "Cancelled"),
	]

	donor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="donation_requests")
	hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE, related_name="donation_requests")
	status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="PENDING")
	message = models.TextField(blank=True)
	scheduled_date = models.DateTimeField(null=True, blank=True)
	notes = models.TextField(blank=True, help_text="Hospital staff notes")

	def __str__(self) -> str:
		return f"Donation request from {self.donor.username} to {self.hospital.name} - {self.status}"


class DeceasedDonorRequest(TimeStampedModel):
	"""Request from relatives for deceased unregistered donors"""
	STATUS_CHOICES = [
		("PENDING", "Pending"),
		("APPROVED", "Approved"),
		("REJECTED", "Rejected"),
		("COMPLETED", "Completed"),
		("CANCELLED", "Cancelled"),
	]

	RELATION_CHOICES = [
		("SPOUSE", "Spouse"),
		("CHILD", "Child"),
		("PARENT", "Parent"),
		("SIBLING", "Sibling"),
		("OTHER", "Other Relative"),
		("FRIEND", "Friend"),
	]

	# Requester information
	requester_name = models.CharField(max_length=200)
	requester_phone = models.CharField(max_length=32)
	requester_email = models.EmailField(blank=True)
	requester_relation = models.CharField(max_length=20, choices=RELATION_CHOICES)
	requester_address = models.TextField(blank=True)
	
	# Deceased person information
	deceased_name = models.CharField(max_length=200)
	deceased_date_of_birth = models.DateField(null=True, blank=True)
	deceased_date_of_death = models.DateField()
	deceased_blood_group = models.CharField(max_length=3, blank=True)
	deceased_city = models.CharField(max_length=120)
	deceased_address = models.TextField(blank=True)
	organs_available = models.CharField(max_length=255, help_text="Comma-separated organ codes")
	medical_student_donation = models.BooleanField(default=False)
	
	# Additional details
	hospital_name = models.CharField(max_length=200, blank=True, help_text="Hospital where death occurred")
	doctor_name = models.CharField(max_length=200, blank=True)
	notes = models.TextField(blank=True, help_text="Additional information about the deceased")
	
	# Status and processing
	status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="PENDING")
	selected_hospitals = models.ManyToManyField("Hospital", blank=True, related_name="deceased_donor_requests")
	processed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="processed_deceased_requests")
	processed_at = models.DateTimeField(null=True, blank=True)
	processing_notes = models.TextField(blank=True)

	def __str__(self) -> str:
		return f"Deceased Donor Request: {self.deceased_name} by {self.requester_name}"


class AccidentAlert(TimeStampedModel):
	"""Nearby accident alerts for potential organ donation opportunities"""
	SEVERITY_CHOICES = [
		("LOW", "Low"),
		("MEDIUM", "Medium"),
		("HIGH", "High"),
		("CRITICAL", "Critical"),
	]

	STATUS_CHOICES = [
		("ACTIVE", "Active"),
		("RESOLVED", "Resolved"),
		("CANCELLED", "Cancelled"),
	]

	title = models.CharField(max_length=200)
	description = models.TextField(blank=True)
	location = models.CharField(max_length=200, help_text="Accident location")
	city = models.CharField(max_length=120)
	latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
	longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
	severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default="MEDIUM")
	status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="ACTIVE")
	reported_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="reported_accidents")
	accident_time = models.DateTimeField(null=True, blank=True)
	contact_phone = models.CharField(max_length=32, blank=True)
	hospital_referred = models.ForeignKey("Hospital", on_delete=models.SET_NULL, null=True, blank=True, related_name="accident_alerts")
	notes = models.TextField(blank=True)

	def __str__(self) -> str:
		return f"Accident Alert: {self.title} - {self.city}"


class BloodDonationEvent(TimeStampedModel):
	"""Blood donation events organized by hospitals/centers"""
	STATUS_CHOICES = [
		("UPCOMING", "Upcoming"),
		("ONGOING", "Ongoing"),
		("COMPLETED", "Completed"),
		("CANCELLED", "Cancelled"),
	]

	hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE, related_name="blood_donation_events")
	title = models.CharField(max_length=200)
	description = models.TextField(blank=True)
	event_date = models.DateTimeField()
	start_time = models.TimeField()
	end_time = models.TimeField()
	location = models.CharField(max_length=200, help_text="Event location/venue name")
	address = models.TextField(blank=True, help_text="Full address")
	contact_phone = models.CharField(max_length=32, blank=True)
	contact_email = models.EmailField(blank=True)
	blood_groups_needed = models.CharField(max_length=100, blank=True, help_text="Comma-separated blood groups, e.g., O+,O-,A+")
	estimated_donors = models.PositiveIntegerField(default=0, help_text="Expected number of donors")
	registered_count = models.PositiveIntegerField(default=0, help_text="Number of registered donors")
	status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="UPCOMING")
	latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
	longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
	organizer = models.CharField(max_length=200, blank=True, help_text="Event organizer name")

	def __str__(self) -> str:
		return f"{self.title} - {self.hospital.name} ({self.event_date})"


class MedicalEssential(TimeStampedModel):
	"""Medical Essential user profile with API key"""
	user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="medical_essential_profile")
	company_name = models.CharField(max_length=200)
	business_type = models.CharField(
		max_length=50,
		choices=[
			("SUPPLIER", "Medical Supplier"),
			("DISTRIBUTOR", "Distributor"),
			("RETAILER", "Retailer"),
			("MANUFACTURER", "Manufacturer"),
			("OTHER", "Other"),
		],
		default="SUPPLIER"
	)
	contact_person = models.CharField(max_length=200)
	phone = models.CharField(max_length=32)
	email = models.EmailField()
	address = models.TextField()
	city = models.CharField(max_length=120)
	zip_code = models.CharField(max_length=20, blank=True)
	license_number = models.CharField(max_length=100, blank=True, help_text="Business license/registration number")
	tax_id = models.CharField(max_length=100, blank=True, help_text="Tax identification number")
	api_key = models.CharField(max_length=64, unique=True, db_index=True, help_text="API key for authentication")
	api_key_created_at = models.DateTimeField(auto_now_add=True)
	is_active = models.BooleanField(default=True)
	is_verified = models.BooleanField(default=False, help_text="Verified supplier status")

	def generate_api_key(self):
		"""Generate a secure API key"""
		random_token = secrets.token_urlsafe(32)
		api_key = f"me_{hashlib.sha256(random_token.encode()).hexdigest()[:32]}"
		self.api_key = api_key
		return api_key

	def save(self, *args, **kwargs):
		if not self.api_key:
			self.generate_api_key()
		super().save(*args, **kwargs)

	def __str__(self):
		return f"{self.company_name}-{self.contact_person}"


class MedicalStoreProduct(TimeStampedModel):
	"""Medical store products (medicines, supplies, etc.)"""
	CATEGORY_CHOICES = [
		("MEDICINE", "Medicines"),
		("SUPPLIES", "Medical Supplies"),
		("CONSUMABLES", "Consumables"),
		("INSTRUMENTS", "Instruments"),
		("OTHER", "Other"),
	]

	supplier = models.ForeignKey(MedicalEssential, on_delete=models.CASCADE, related_name="store_products")
	name = models.CharField(max_length=200)
	description = models.TextField(blank=True)
	category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, default="OTHER")
	brand = models.CharField(max_length=100, blank=True)
	sku = models.CharField(max_length=100, unique=True, help_text="Stock Keeping Unit")
	price = models.DecimalField(max_digits=10, decimal_places=2)
	currency = models.CharField(max_length=8, default="USD")
	quantity_available = models.PositiveIntegerField(default=0)
	minimum_order_quantity = models.PositiveIntegerField(default=1)
	unit = models.CharField(max_length=50, default="unit", help_text="e.g., box, pack, bottle")
	expiry_date = models.DateField(null=True, blank=True, help_text="For medicines with expiry")
	image = models.ImageField(upload_to="medical_store/", blank=True, null=True)
	is_active = models.BooleanField(default=True)
	is_prescription_required = models.BooleanField(default=False)

	def __str__(self):
		return f"{self.name} - {self.supplier.company_name}"


class MedicalEquipment(TimeStampedModel):
	"""Hospital equipment for purchase"""
	EQUIPMENT_TYPE_CHOICES = [
		("DIAGNOSTIC", "Diagnostic Equipment"),
		("SURGICAL", "Surgical Equipment"),
		("MONITORING", "Monitoring Equipment"),
		("LIFE_SUPPORT", "Life Support Equipment"),
		("STERILIZATION", "Sterilization Equipment"),
		("FURNITURE", "Hospital Furniture"),
		("OTHER", "Other"),
	]

	supplier = models.ForeignKey(MedicalEssential, on_delete=models.CASCADE, related_name="equipment_products")
	name = models.CharField(max_length=200)
	description = models.TextField(blank=True)
	equipment_type = models.CharField(max_length=50, choices=EQUIPMENT_TYPE_CHOICES, default="OTHER")
	brand = models.CharField(max_length=100, blank=True)
	model_number = models.CharField(max_length=100, blank=True)
	sku = models.CharField(max_length=100, unique=True)
	price = models.DecimalField(max_digits=12, decimal_places=2)
	currency = models.CharField(max_length=8, default="USD")
	quantity_available = models.PositiveIntegerField(default=0)
	warranty_period_months = models.PositiveIntegerField(default=12, help_text="Warranty period in months")
	specifications = models.TextField(blank=True, help_text="Technical specifications")
	image = models.ImageField(upload_to="medical_equipment/", blank=True, null=True)
	is_active = models.BooleanField(default=True)
	is_new = models.BooleanField(default=True, help_text="New or used equipment")

	def __str__(self):
		return f"{self.name} ({self.equipment_type}) - {self.supplier.company_name}"


class MedicalOrder(TimeStampedModel):
	"""Orders for medical products/equipment"""
	STATUS_CHOICES = [
		("PENDING", "Pending"),
		("CONFIRMED", "Confirmed"),
		("PROCESSING", "Processing"),
		("SHIPPED", "Shipped"),
		("DELIVERED", "Delivered"),
		("CANCELLED", "Cancelled"),
	]

	ORDER_TYPE_CHOICES = [
		("STORE", "Medical Store"),
		("EQUIPMENT", "Equipment"),
	]

	customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="medical_orders")
	supplier = models.ForeignKey(MedicalEssential, on_delete=models.CASCADE, related_name="orders")
	order_type = models.CharField(max_length=20, choices=ORDER_TYPE_CHOICES)
	order_number = models.CharField(max_length=50, unique=True)
	total_amount = models.DecimalField(max_digits=12, decimal_places=2)
	currency = models.CharField(max_length=8, default="USD")
	status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="PENDING")
	shipping_address = models.TextField()
	shipping_city = models.CharField(max_length=120)
	shipping_zip_code = models.CharField(max_length=20, blank=True)
	contact_phone = models.CharField(max_length=32)
	notes = models.TextField(blank=True)
	estimated_delivery = models.DateField(null=True, blank=True)

	def generate_order_number(self):
		"""Generate unique order number"""
		if not self.order_number:
			import random
			import string
			prefix = "ME" if self.order_type == "STORE" else "EQ"
			random_part = ''.join(random.choices(string.digits, k=8))
			self.order_number = f"{prefix}-{random_part}"
		return self.order_number

	def save(self, *args, **kwargs):
		if not self.order_number:
			self.generate_order_number()
		super().save(*args, **kwargs)

	def __str__(self):
		return f"Order {self.order_number} - {self.customer.email}"


class MedicalOrderItem(TimeStampedModel):
	"""Individual items in an order"""
	order = models.ForeignKey(MedicalOrder, on_delete=models.CASCADE, related_name="items")
	product_type = models.CharField(max_length=20, choices=[("STORE", "Store Product"), ("EQUIPMENT", "Equipment")])
	store_product = models.ForeignKey(MedicalStoreProduct, on_delete=models.CASCADE, null=True, blank=True)
	equipment = models.ForeignKey(MedicalEquipment, on_delete=models.CASCADE, null=True, blank=True)
	quantity = models.PositiveIntegerField()
	unit_price = models.DecimalField(max_digits=10, decimal_places=2)
	subtotal = models.DecimalField(max_digits=10, decimal_places=2)

	def save(self, *args, **kwargs):
		self.subtotal = self.quantity * self.unit_price
		super().save(*args, **kwargs)

	def __str__(self):
		product_name = self.store_product.name if self.store_product else (self.equipment.name if self.equipment else "Unknown")
		return f"{product_name} x{self.quantity} - Order {self.order.order_number}"


