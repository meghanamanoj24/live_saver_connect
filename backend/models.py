# from django.conf import settings
# from django.db import models


# class TimeStampedModel(models.Model):
# 	created_at = models.DateTimeField(auto_now_add=True)
# import calendar
# 	updated_at = models.DateTimeField(auto_now=True)

# 	class Meta:
# 		abstract = True


# class DonorProfile(TimeStampedModel):
# 	BLOOD_GROUP_CHOICES = [
# 		("A+", "A+"),
# 		("A-", "A-"),
# 		("B+", "B+"),
# 		("B-", "B-"),
# 		("AB+", "AB+"),
# 		("AB-", "AB-"),
# 		("O+", "O+"),
# 		("O-", "O-"),
# 	]

# 	user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="donor_profile")
# 	blood_group = models.CharField(max_length=3, choices=BLOOD_GROUP_CHOICES)
# 	city = models.CharField(max_length=120)
# 	zip_code = models.CharField(max_length=20, blank=True)
# 	is_platelet_donor = models.BooleanField(default=False)
# 	last_donated_on = models.DateField(null=True, blank=True)
# 	phone = models.CharField(max_length=32, blank=True)
# 	is_available = models.BooleanField(default=True)

# 	def __str__(self) -> str:
# 		return f"{self.user.username} — {self.blood_group}"


# class EmergencyNeed(TimeStampedModel):
# 	NEED_TYPE_CHOICES = [
# 		("BLOOD", "Blood"),
# 		("PLATELETS", "Platelets"),
# 		("ORGAN", "Organ"),
# 		("FUNDS", "Funds"),
# 		("OTHER", "Other"),
# 	]

# 	STATUS_CHOICES = [
# 		("OPEN", "Open"),
# 		("FULFILLED", "Fulfilled"),
# 		("CANCELLED", "Cancelled"),
# 	]

# 	created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="emergency_needs")
# 	title = models.CharField(max_length=200)
# 	description = models.TextField(blank=True)
# 	need_type = models.CharField(max_length=16, choices=NEED_TYPE_CHOICES, default="BLOOD")
# 	required_blood_group = models.CharField(max_length=3, blank=True)
# 	city = models.CharField(max_length=120)
# 	zip_code = models.CharField(max_length=20, blank=True)
# 	contact_phone = models.CharField(max_length=32, blank=True)
# 	status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="OPEN")
# 	needed_by = models.DateTimeField(null=True, blank=True)

# 	def __str__(self) -> str:
# 		return f"{self.title} [{self.need_type}]"


# class OrganDonor(TimeStampedModel):
# 	ORGAN_CHOICES = [
# 		("HEART", "Heart"),
# 		("LIVER", "Liver"),
# 		("KIDNEY", "Kidney"),
# 		("LUNGS", "Lungs"),
# 		("PANCREAS", "Pancreas"),
# 		("INTESTINE", "Intestine"),
# 		("TISSUE", "Tissue"),
# 		("OTHER", "Other"),
# 	]

# 	user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="organ_donor")
# 	organs = models.CharField(max_length=255, help_text="Comma-separated organ codes, e.g. HEART,KIDNEY")
# 	city = models.CharField(max_length=120)
# 	zip_code = models.CharField(max_length=20, blank=True)
# 	consent_provided = models.BooleanField(default=False)

# 	def __str__(self) -> str:
# 		return f"OrganDonor<{self.user.username}>"


# class Hospital(TimeStampedModel):
# 	name = models.CharField(max_length=200)
# 	city = models.CharField(max_length=120)
# 	zip_code = models.CharField(max_length=20, blank=True)
# 	address = models.TextField(blank=True)
# 	phone = models.CharField(max_length=32, blank=True)
# 	website = models.URLField(blank=True)

# 	def __str__(self) -> str:
# 		return self.name


# class Doctor(TimeStampedModel):
# 	name = models.CharField(max_length=200)
# 	specialization = models.CharField(max_length=200, blank=True)
# 	hospital = models.ForeignKey(Hospital, on_delete=models.SET_NULL, null=True, related_name="doctors")
# 	phone = models.CharField(max_length=32, blank=True)

# 	def __str__(self) -> str:
# 		return self.name


# class Review(TimeStampedModel):
# 	RATING_CHOICES = [(i, str(i)) for i in range(1, 6)]

# 	user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reviews")
# 	hospital = models.ForeignKey(Hospital, on_delete=models.CASCADE, null=True, blank=True, related_name="reviews")
# 	doctor = models.ForeignKey(Doctor, on_delete=models.CASCADE, null=True, blank=True, related_name="reviews")
# 	rating = models.IntegerField(choices=RATING_CHOICES)
# 	comment = models.TextField(blank=True)
# 	is_moderated = models.BooleanField(default=False)

# 	def __str__(self) -> str:
# 		target = self.doctor.name if self.doctor else (self.hospital.name if self.hospital else "Unknown")
# 		return f"Review {self.rating}★ for {target}"


# class MarketplaceItem(TimeStampedModel):
# 	CATEGORY_CHOICES = [
# 		("BLOOD_BAGS", "Blood Bags"),
# 		("PPE", "PPE"),
# 		("OXYGEN", "Oxygen Supplies"),
# 		("MED_EQUIP", "Medical Equipment"),
# 		("OTHER", "Other"),
# 	]

# 	seller = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="items_for_sale")
# 	title = models.CharField(max_length=200)
# 	description = models.TextField(blank=True)
# 	category = models.CharField(max_length=32, choices=CATEGORY_CHOICES, default="OTHER")
# 	price_cents = models.PositiveIntegerField()
# 	currency = models.CharField(max_length=8, default="USD")
# 	city = models.CharField(max_length=120)
# 	zip_code = models.CharField(max_length=20, blank=True)
# 	quantity_available = models.PositiveIntegerField(default=1)
# 	is_active = models.BooleanField(default=True)

# 	def __str__(self) -> str:
# 		return self.title


