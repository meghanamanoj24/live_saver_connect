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
	DoctorAvailability,
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
	PatientVisit,
	Staff,
	StaffAvailability,
	Attendance,
	SalaryPayment,
	PerformanceTracking,
	EquipmentNeed,
	EquipmentOrder,
	Invoice,
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


            if donor_module and str(user.role) != donor_module:
                raise serializers.ValidationError("Donor module does not match")

            data = super().validate({'email': email, 'password': password})
            data['donor_module'] = donor_module or user.role
            return data
        else:
            raise serializers.ValidationError("Must include 'email' and 'password'.")

	
class UserPublicSerializer(serializers.ModelSerializer):
	class Meta:
		model = User
		fields = ["id", "first_name", "last_name", "email", "phone", "blood_group"]


class DonorProfileSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)
    phone = serializers.CharField(source="user.phone", required=False)
    gender = serializers.CharField(source="user.gender", required=False)
    blood_group = serializers.CharField(source="user.blood_group", required=False)
    role = serializers.CharField(source="user.role", read_only=True)
    name = serializers.SerializerMethodField()

    class Meta:
        model = DonorProfile
        fields = [
            "id",

            # User fields
            "email",
            "phone",
            "gender",
            "blood_group",
            "role",
            "name",

            # DonorProfile fields
            "city",
            "zip_code",
            "is_platelet_donor",
            "last_donated_on",
            "is_available",
        ]

    def get_name(self, obj):
        first = obj.user.first_name or ""
        last = obj.user.last_name or ""
        return f"{first} {last}".strip()

    def update(self, instance, validated_data):
        user_data = validated_data.pop("user", {})
        user = instance.user
        for attr, value in user_data.items():
            setattr(user, attr, value)
        user.save()
        return super().update(instance, validated_data)


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
	user_id = serializers.PrimaryKeyRelatedField(source="created_by", write_only=True, queryset=User.objects.all(), required=True)
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
	availability_schedules = serializers.SerializerMethodField()

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
			"nmc_number",
			"consultation_charge",
			"currency",
			"is_available",
			"availability_schedules",
			"created_at",
			"updated_at",
		]
		read_only_fields = ["created_at", "updated_at"]
	
	def get_availability_schedules(self, obj):
		from .models import DoctorAvailability
		schedules = DoctorAvailability.objects.filter(doctor=obj, is_available=True)
		return [
			{
				"id": s.id,
				"day_of_week": s.day_of_week,
				"day_name": s.get_day_of_week_display(),
				"start_time": str(s.start_time),
				"end_time": str(s.end_time),
			}
			for s in schedules
		]


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
	doctor = DoctorSerializer(read_only=True)
	doctor_id = serializers.PrimaryKeyRelatedField(source="doctor", write_only=True, queryset=Doctor.objects.all(), allow_null=True, required=False)
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
			"doctor",
			"doctor_id",
			"donation_request",
			"donation_request_id",
			"appointment_date",
			"appointment_time",
			"status",
			"notes",
			"charges",
			"currency",
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
			"hospital_referred","hospital_referred_id",
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
	doctors_involved = DoctorSerializer(many=True, read_only=True)
	doctor_ids = serializers.PrimaryKeyRelatedField(source="doctors_involved", write_only=True, queryset=Doctor.objects.all(), many=True, required=False)

	class Meta:
		model = BloodDonationEvent
		fields = [
			"id",
			"hospital",
			"hospital_id",
			"event_type",
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
			"doctors_involved",
			"doctor_ids",
			"event_report",
			"images",
			"created_at",
			"updated_at",
		]
		read_only_fields = ["created_at", "updated_at", "registered_count"]


class MedicalEssentialSerializer(serializers.ModelSerializer):
	user = UserPublicSerializer(read_only=True)
	user_id = serializers.PrimaryKeyRelatedField(source="user", write_only=True, queryset=User.objects.all(), required=True)
	api_key = serializers.CharField(read_only=True)
	email = serializers.EmailField(source="user.email", read_only=True)
	phone = serializers.CharField(source="user.phone", required=False)
	contact_person = serializers.CharField(source="user.first_name")

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


class DoctorAvailabilitySerializer(serializers.ModelSerializer):
	doctor = DoctorSerializer(read_only=True)
	doctor_id = serializers.PrimaryKeyRelatedField(source="doctor", write_only=True, queryset=Doctor.objects.all(), required=True)

	class Meta:
		model = DoctorAvailability
		fields = [
			"id",
			"doctor",
			"doctor_id",
			"day_of_week",
			"start_time",
			"end_time",
			"is_available",
			"created_at",
			"updated_at",
		]
		read_only_fields = ["created_at", "updated_at"]


class PatientVisitSerializer(serializers.ModelSerializer):
	patient = UserPublicSerializer(read_only=True)
	patient_id = serializers.PrimaryKeyRelatedField(source="patient", write_only=True, queryset=User.objects.all(), required=True)
	hospital = HospitalSerializer(read_only=True)
	hospital_id = serializers.PrimaryKeyRelatedField(source="hospital", write_only=True, queryset=Hospital.objects.all(), required=True)
	doctor = DoctorSerializer(read_only=True)
	doctor_id = serializers.PrimaryKeyRelatedField(source="doctor", write_only=True, queryset=Doctor.objects.all(), allow_null=True, required=False)

	class Meta:
		model = PatientVisit
		fields = [
			"id",
			"patient",
			"patient_id",
			"hospital",
			"hospital_id",
			"doctor",
			"doctor_id",
			"visit_purpose",
			"visit_date",
			"charges",
			"currency",
			"payment_status",
			"payment_details",
			"notes",
			"performance_notes",
			"created_at",
			"updated_at",
		]
		read_only_fields = ["created_at", "updated_at"]


class StaffSerializer(serializers.ModelSerializer):
	hospital = HospitalSerializer(read_only=True)
	hospital_id = serializers.PrimaryKeyRelatedField(source="hospital", write_only=True, queryset=Hospital.objects.all(), required=True)
	availability_schedules = serializers.SerializerMethodField()

	class Meta:
		model = Staff
		fields = [
			"id",
			"hospital",
			"hospital_id",
			"name",
			"staff_type",
			"specialization",
			"phone",
			"email",
			"qualifications",
			"salary",
			"currency",
			"is_active",
			"availability_schedules",
			"created_at",
			"updated_at",
		]
		read_only_fields = ["created_at", "updated_at"]
	
	def get_availability_schedules(self, obj):
		schedules = StaffAvailability.objects.filter(staff=obj, is_available=True)
		return [
			{
				"id": s.id,
				"day_of_week": s.day_of_week,
				"day_name": s.get_day_of_week_display(),
				"start_time": str(s.start_time),
				"end_time": str(s.end_time),
			}
			for s in schedules
		]


class StaffAvailabilitySerializer(serializers.ModelSerializer):
	staff = StaffSerializer(read_only=True)
	staff_id = serializers.PrimaryKeyRelatedField(source="staff", write_only=True, queryset=Staff.objects.all(), required=True)

	class Meta:
		model = StaffAvailability
		fields = [
			"id",
			"staff",
			"staff_id",
			"day_of_week",
			"start_time",
			"end_time",
			"is_available",
			"created_at",
			"updated_at",
		]
		read_only_fields = ["created_at", "updated_at"]


class AttendanceSerializer(serializers.ModelSerializer):
	staff = StaffSerializer(read_only=True)
	staff_id = serializers.PrimaryKeyRelatedField(source="staff", write_only=True, queryset=Staff.objects.all(), required=True)

	class Meta:
		model = Attendance
		fields = [
			"id",
			"staff",
			"staff_id",
			"date",
			"check_in_time",
			"check_out_time",
			"is_present",
			"is_leave",
			"leave_type",
			"notes",
			"created_at",
			"updated_at",
		]
		read_only_fields = ["created_at", "updated_at"]


class SalaryPaymentSerializer(serializers.ModelSerializer):
	staff = StaffSerializer(read_only=True)
	staff_id = serializers.PrimaryKeyRelatedField(source="staff", write_only=True, queryset=Staff.objects.all(), required=True)

	class Meta:
		model = SalaryPayment
		fields = [
			"id",
			"staff",
			"staff_id",
			"month",
			"year",
			"amount",
			"currency",
			"payment_date",
			"is_paid",
			"payment_method",
			"notes",
			"created_at",
			"updated_at",
		]
		read_only_fields = ["created_at", "updated_at"]


class PerformanceTrackingSerializer(serializers.ModelSerializer):
	staff = StaffSerializer(read_only=True)
	staff_id = serializers.PrimaryKeyRelatedField(source="staff", write_only=True, queryset=Staff.objects.all(), required=True)

	class Meta:
		model = PerformanceTracking
		fields = [
			"id",
			"staff",
			"staff_id",
			"date",
			"performance_score",
			"metrics",
			"ai_analysis",
			"notes",
			"created_at",
			"updated_at",
		]
		read_only_fields = ["created_at", "updated_at"]


class EquipmentNeedSerializer(serializers.ModelSerializer):
	hospital = HospitalSerializer(read_only=True)
	hospital_id = serializers.PrimaryKeyRelatedField(source="hospital", write_only=True, queryset=Hospital.objects.all(), required=True)
	orders = serializers.SerializerMethodField()

	class Meta:
		model = EquipmentNeed
		fields = [
			"id",
			"hospital",
			"hospital_id",
			"equipment_name",
			"equipment_type",
			"quantity_needed",
			"description",
			"status",
			"needed_by",
			"notes",
			"orders",
			"created_at",
			"updated_at",
		]
		read_only_fields = ["created_at", "updated_at"]
	
	def get_orders(self, obj):
		from .models import EquipmentOrder
		orders = EquipmentOrder.objects.filter(equipment_need=obj)
		return EquipmentOrderSerializer(orders, many=True).data


class EquipmentOrderSerializer(serializers.ModelSerializer):
	equipment_need = EquipmentNeedSerializer(read_only=True)
	equipment_need_id = serializers.PrimaryKeyRelatedField(source="equipment_need", write_only=True, queryset=EquipmentNeed.objects.all(), required=True)
	supplier = MedicalEssentialSerializer(read_only=True)
	supplier_id = serializers.PrimaryKeyRelatedField(source="supplier", write_only=True, queryset=MedicalEssential.objects.all(), required=True)
	invoice = serializers.SerializerMethodField()

	class Meta:
		model = EquipmentOrder
		fields = [
			"id",
			"equipment_need",
			"equipment_need_id",
			"supplier",
			"supplier_id",
			"quantity",
			"unit_price",
			"total_amount",
			"currency",
			"status",
			"notes",
			"sent_date",
			"received_date",
			"invoice",
			"created_at",
			"updated_at",
		]
		read_only_fields = ["total_amount", "created_at", "updated_at"]
	
	def get_invoice(self, obj):
		if hasattr(obj, 'invoice'):
			return InvoiceSerializer(obj.invoice).data
		return None


class InvoiceSerializer(serializers.ModelSerializer):
	equipment_order = EquipmentOrderSerializer(read_only=True)
	equipment_order_id = serializers.PrimaryKeyRelatedField(source="equipment_order", write_only=True, queryset=EquipmentOrder.objects.all(), required=True)
	month = serializers.SerializerMethodField()
	month_name = serializers.SerializerMethodField()
	invoice_number = serializers.CharField(read_only=True)

	class Meta:
		model = Invoice
		fields = [
			"id",
			"equipment_order",
			"equipment_order_id",
			"invoice_number",
			"invoice_date",
			"month",
			"month_name",
			"total_amount",
			"currency",
			"tax_amount",
			"subtotal",
			"notes",
			"is_paid",
			"payment_date",
			"created_at",
			"updated_at",
		]
		read_only_fields = ["invoice_number", "subtotal", "created_at", "updated_at"]
	
	def get_month(self, obj):
		"""Serialized method to get month from stored date"""
		return obj.get_month()
	
	def get_month_name(self, obj):
		"""Get month name from stored date"""
		return obj.get_month_name()