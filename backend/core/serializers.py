from django.contrib.auth import get_user_model
from rest_framework import serializers
from django.contrib.auth import authenticate
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import (
	DonorProfile,
	EmergencyNeed,
	OrganDonor,
	MarketplaceItem,
	Hospital,
	Doctor,
	Review,
	DonationRequest,
	HospitalNeed,
	Appointment,
	DeceasedDonorRequest,
	AccidentAlert,
	BloodDonationEvent,
	MedicalEssential,
	MedicalStoreProduct,
	MedicalEquipment,
	MedicalOrder,
	MedicalOrderItem,
)


User = get_user_model()


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = 'email'

    donor_module = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs.get("email")
        password = attrs.get("password")
        donor_module = attrs.get("donor_module")

        if email and password:
            user = authenticate(self.context['request'], email=email, password=password)
            if not user:
                raise serializers.ValidationError("Invalid email or password")


            if donor_module and str(user.donor_module) != donor_module:
                raise serializers.ValidationError("Donor module does not match")

            data = super().validate({'email': email, 'password': password})
            data['donor_module'] = donor_module or user.donor_module
            return data
        else:
            raise serializers.ValidationError("Must include 'email' and 'password'.")
	

class UserPublicSerializer(serializers.ModelSerializer):
	class Meta:
		model = User
		fields = ["id", "first_name", "last_name", "email"]


class DonorProfileSerializer(serializers.ModelSerializer):
	# user = UserPublicSerializer(read_only=True)
	# user_id = serializers.PrimaryKeyRelatedField(source="user", write_only=True, queryset=User.objects.all(), required=True)

	class Meta:
		model = DonorProfile
		fields = [
			"id",
			"blood_group",
			"city",
			"zip_code",
			"is_platelet_donor",
			"last_donated_on",
			"phone",
			"is_available",
			"created_at",
			"updated_at",
		]
		read_only_fields = ["created_at", "updated_at"]


class EmergencyNeedSerializer(serializers.ModelSerializer):
	created_by = UserPublicSerializer(read_only=True)
	created_by_id = serializers.PrimaryKeyRelatedField(source="created_by", write_only=True, queryset=User.objects.all(), required=True)

	class Meta:
		model = EmergencyNeed
		fields = [
			"id",
			"title",
			"description",
			"need_type",
			"required_blood_group",
			"city",
			"zip_code",
			"contact_phone",
			"status",
			"needed_by",
			"poster_image",
			"created_by",
			"created_by_id",
			"created_at",
			"updated_at",
		]
		read_only_fields = ["created_at", "updated_at"]

class HospitalSerializer(serializers.ModelSerializer):
	user = UserPublicSerializer(read_only=True)
	user_id = serializers.PrimaryKeyRelatedField(source="user", write_only=True, queryset=User.objects.all(), allow_null=True, required=False)

	class Meta:
		model = Hospital
		fields = [
			"id",
			"name",
			"hospital_type",
			"city",
			"zip_code",
			"address",
			"phone",
			"website",
			"latitude",
			"longitude",
			"user",
			"user_id",
			"created_at",
			"updated_at",
		]
		read_only_fields = ["created_at", "updated_at"]

class OrganDonorSerializer(serializers.ModelSerializer):
	user = UserPublicSerializer(read_only=True)
	user_id = serializers.PrimaryKeyRelatedField(source="user", write_only=True, queryset=User.objects.all(), required=True)
	selected_hospitals = HospitalSerializer(many=True, read_only=True)
	selected_hospital_ids = serializers.PrimaryKeyRelatedField(
		source="selected_hospitals", 
		write_only=True, 
		queryset=Hospital.objects.all(), 
		many=True, 
		required=False
	)

	class Meta:
		model = OrganDonor
		fields = [
			"id",
			"user",
			"user_id",
			"organs",
			"city",
			"zip_code",
			"consent_provided",
			"medical_student_donation",
			"selected_hospitals",
			"selected_hospital_ids",
			"health_certificate",
			"post_mortem_consent",
			"family_responsibility",
			"living_kidney_donation",
			"date_of_birth",
			"blood_group",
			"phone",
			"address",
			"emergency_contact_name",
			"emergency_contact_phone",
			"emergency_contact_relation",
			"created_at",
			"updated_at",
		]
		read_only_fields = ["created_at", "updated_at"]






class DoctorSerializer(serializers.ModelSerializer):
	hospital = HospitalSerializer(read_only=True)
	hospital_id = serializers.PrimaryKeyRelatedField(source="hospital", write_only=True, queryset=Hospital.objects.all(), allow_null=True, required=False)

	class Meta:
		model = Doctor
		fields = [
			"id",
			"name",
			"specialization",
			"qualifications",
			"hospital",
			"hospital_id",
			"phone",
			"email",
			"created_at",
			"updated_at",
		]
		read_only_fields = ["created_at", "updated_at"]


class ReviewSerializer(serializers.ModelSerializer):
	user = UserPublicSerializer(read_only=True)
	user_id = serializers.PrimaryKeyRelatedField(source="user", write_only=True, queryset=User.objects.all(), required=True)
	hospital = HospitalSerializer(read_only=True)
	hospital_id = serializers.PrimaryKeyRelatedField(source="hospital", write_only=True, queryset=Hospital.objects.all(), allow_null=True, required=False)
	doctor = DoctorSerializer(read_only=True)
	doctor_id = serializers.PrimaryKeyRelatedField(source="doctor", write_only=True, queryset=Doctor.objects.all(), allow_null=True, required=False)

	class Meta:
		model = Review
		fields = [
			"id",
			"user",
			"user_id",
			"hospital",
			"hospital_id",
			"doctor",
			"doctor_id",
			"rating",
			"comment",
			"is_moderated",
			"created_at",
			"updated_at",
		]
		read_only_fields = ["created_at", "updated_at", "is_moderated"]


class MarketplaceItemSerializer(serializers.ModelSerializer):
	seller = UserPublicSerializer(read_only=True)
	seller_id = serializers.PrimaryKeyRelatedField(source="seller", write_only=True, queryset=User.objects.all(), required=True)

	class Meta:
		model = MarketplaceItem
		fields = [
			"id",
			"seller",
			"seller_id",
			"title",
			"description",
			"category",
			"price_cents",
			"currency",
			"city",
			"zip_code",
			"quantity_available",
			"is_active",
			"created_at",
			"updated_at",
		]
		read_only_fields = ["created_at", "updated_at"]


class DonationRequestSerializer(serializers.ModelSerializer):
	donor = UserPublicSerializer(read_only=True)
	donor_id = serializers.PrimaryKeyRelatedField(source="donor", write_only=True, queryset=User.objects.all(), required=True)
	hospital = HospitalSerializer(read_only=True)
	hospital_id = serializers.PrimaryKeyRelatedField(source="hospital", write_only=True, queryset=Hospital.objects.all(), required=True)

	class Meta:
		model = DonationRequest
		fields = [
			"id",
			"donor",
			"donor_id",
			"hospital",
			"hospital_id",
			"status",
			"message",
			"scheduled_date",
			"notes",
			"created_at",
			"updated_at",
		]
		read_only_fields = ["created_at", "updated_at"]


class HospitalNeedSerializer(serializers.ModelSerializer):
	hospital = HospitalSerializer(read_only=True)
	hospital_id = serializers.PrimaryKeyRelatedField(source="hospital", write_only=True, queryset=Hospital.objects.all(), required=True)

	class Meta:
		model = HospitalNeed
		fields = [
			"id",
			"hospital",
			"hospital_id",
			"need_type",
			"required_blood_group",
			"patient_name",
			"patient_details",
			"poster_image",
			"status",
			"quantity_needed",
			"needed_by",
			"notes",
			"created_at",
			"updated_at",
		]
		read_only_fields = ["created_at", "updated_at"]


class AppointmentSerializer(serializers.ModelSerializer):
	donor = UserPublicSerializer(read_only=True)
	donor_id = serializers.PrimaryKeyRelatedField(source="donor", write_only=True, queryset=User.objects.all(), required=True)
	hospital = HospitalSerializer(read_only=True)
	hospital_id = serializers.PrimaryKeyRelatedField(source="hospital", write_only=True, queryset=Hospital.objects.all(), required=True)
	donation_request = DonationRequestSerializer(read_only=True)
	donation_request_id = serializers.PrimaryKeyRelatedField(source="donation_request", write_only=True, queryset=DonationRequest.objects.all(), allow_null=True, required=False)

	class Meta:
		model = Appointment
		fields = [
			"id",
			"donor",
			"donor_id",
			"hospital",
			"hospital_id",
			"donation_request",
			"donation_request_id",
			"appointment_date",
			"status",
			"notes",
			"created_at",
			"updated_at",
		]
		read_only_fields = ["created_at", "updated_at"]


class DeceasedDonorRequestSerializer(serializers.ModelSerializer):
	selected_hospitals = HospitalSerializer(many=True, read_only=True)
	selected_hospital_ids = serializers.PrimaryKeyRelatedField(
		source="selected_hospitals", 
		write_only=True, 
		queryset=Hospital.objects.all(), 
		many=True, 
		required=False
	)
	processed_by = UserPublicSerializer(read_only=True)
	processed_by_id = serializers.PrimaryKeyRelatedField(
		source="processed_by", 
		write_only=True, 
		queryset=User.objects.all(), 
		allow_null=True, 
		required=False
	)
	hospital_referred = HospitalSerializer(read_only=True)
	hospital_referred_id = serializers.PrimaryKeyRelatedField(
		source="hospital_referred", 
		write_only=True, 
		queryset=Hospital.objects.all(), 
		allow_null=True, 
		required=False
	)

	class Meta:
		model = DeceasedDonorRequest
		fields = [
			"id",
			"requester_name",
			"requester_phone",
			"requester_email",
			"requester_relation",
			"requester_address",
			"deceased_name",
			"deceased_date_of_birth",
			"deceased_date_of_death",
			"deceased_blood_group",
			"deceased_city",
			"deceased_address",
			"organs_available",
			"medical_student_donation",
			"hospital_name",
			"doctor_name",
			"notes",
			"status",
			"selected_hospitals",
			"selected_hospital_ids",
			"processed_by",
			"processed_by_id",
			"processed_at",
			"processing_notes",
			"created_at",
			"updated_at",
		]
		read_only_fields = ["created_at", "updated_at", "processed_at"]


class AccidentAlertSerializer(serializers.ModelSerializer):
	reported_by = UserPublicSerializer(read_only=True)
	reported_by_id = serializers.PrimaryKeyRelatedField(
		source="reported_by", 
		write_only=True, 
		queryset=User.objects.all(), 
		allow_null=True, 
		required=False
	)
	hospital_referred = HospitalSerializer(read_only=True)
	hospital_referred_id = serializers.PrimaryKeyRelatedField(
		source="hospital_referred", 
		write_only=True, 
		queryset=Hospital.objects.all(), 
		allow_null=True, 
		required=False
	)

	class Meta:
		model = AccidentAlert
		fields = [
			"id",
			"title",
			"description",
			"location",
			"city",
			"latitude",
			"longitude",
			"severity",
			"status",
			"reported_by",
			"reported_by_id",
			"accident_time",
			"contact_phone",
			"hospital_referred",
			"hospital_referred_id",
			"notes",
			"created_at",
			"updated_at",
		]
		read_only_fields = ["created_at", "updated_at"]


class BloodDonationEventSerializer(serializers.ModelSerializer):
	hospital = HospitalSerializer(read_only=True)
	hospital_id = serializers.PrimaryKeyRelatedField(source="hospital", write_only=True, queryset=Hospital.objects.all(), required=True)

	class Meta:
		model = BloodDonationEvent
		fields = [
			"id",
			"hospital",
			"hospital_id",
			"title",
			"description",
			"event_date",
			"start_time",
			"end_time",
			"location",
			"address",
			"contact_phone",
			"contact_email",
			"blood_groups_needed",
			"estimated_donors",
			"registered_count",
			"status",
			"latitude",
			"longitude",
			"organizer",
			"created_at",
			"updated_at",
		]
		read_only_fields = ["created_at", "updated_at", "registered_count"]


class MedicalEssentialSerializer(serializers.ModelSerializer):
	user = UserPublicSerializer(read_only=True)
	user_id = serializers.PrimaryKeyRelatedField(source="user", write_only=True, queryset=User.objects.all(), required=True)
	api_key = serializers.CharField(read_only=True)

	class Meta:
		model = MedicalEssential
		fields = [
			"id",
			"user",
			"user_id",
			"company_name",
			"business_type",
			"contact_person",
			"phone",
			"email",
			"address",
			"city",
			"zip_code",
			"license_number",
			"tax_id",
			"api_key",
			"api_key_created_at",
			"is_active",
			"is_verified",
			"created_at",
			"updated_at",
		]
		read_only_fields = ["api_key", "api_key_created_at", "created_at", "updated_at"]


class MedicalStoreProductSerializer(serializers.ModelSerializer):
	supplier = MedicalEssentialSerializer(read_only=True)
	supplier_id = serializers.PrimaryKeyRelatedField(source="supplier", write_only=True, queryset=MedicalEssential.objects.all(), required=True)

	class Meta:
		model = MedicalStoreProduct
		fields = [
			"id",
			"supplier",
			"supplier_id",
			"name",
			"description",
			"category",
			"brand",
			"sku",
			"price",
			"currency",
			"quantity_available",
			"minimum_order_quantity",
			"unit",
			"expiry_date",
			"image",
			"is_active",
			"is_prescription_required",
			"created_at",
			"updated_at",
		]
		read_only_fields = ["created_at", "updated_at"]


class MedicalEquipmentSerializer(serializers.ModelSerializer):
	supplier = MedicalEssentialSerializer(read_only=True)
	supplier_id = serializers.PrimaryKeyRelatedField(source="supplier", write_only=True, queryset=MedicalEssential.objects.all(), required=True)

	class Meta:
		model = MedicalEquipment
		fields = [
			"id",
			"supplier",
			"supplier_id",
			"name",
			"description",
			"equipment_type",
			"brand",
			"model_number",
			"sku",
			"price",
			"currency",
			"quantity_available",
			"warranty_period_months",
			"specifications",
			"image",
			"is_active",
			"is_new",
			"created_at",
			"updated_at",
		]
		read_only_fields = ["created_at", "updated_at"]


class MedicalOrderItemSerializer(serializers.ModelSerializer):
	store_product = MedicalStoreProductSerializer(read_only=True)
	equipment = MedicalEquipmentSerializer(read_only=True)

	class Meta:
		model = MedicalOrderItem
		fields = [
			"id",
			"product_type",
			"store_product",
			"equipment",
			"quantity",
			"unit_price",
			"subtotal",
			"created_at",
			"updated_at",
		]
		read_only_fields = ["subtotal", "created_at", "updated_at"]


class MedicalOrderSerializer(serializers.ModelSerializer):
	customer = UserPublicSerializer(read_only=True)
	customer_id = serializers.PrimaryKeyRelatedField(source="customer", write_only=True, queryset=User.objects.all(), required=True)
	supplier = MedicalEssentialSerializer(read_only=True)
	supplier_id = serializers.PrimaryKeyRelatedField(source="supplier", write_only=True, queryset=MedicalEssential.objects.all(), required=True)
	items = MedicalOrderItemSerializer(many=True, read_only=True)
	order_number = serializers.CharField(read_only=True)

	class Meta:
		model = MedicalOrder
		fields = [
			"id",
			"customer",
			"customer_id",
			"supplier",
			"supplier_id",
			"order_type",
			"order_number",
			"total_amount",
			"currency",
			"status",
			"shipping_address",
			"shipping_city",
			"shipping_zip_code",
			"contact_phone",
			"notes",
			"estimated_delivery",
			"items",
			"created_at",
			"updated_at",
		]
		read_only_fields = ["order_number", "created_at", "updated_at"]
