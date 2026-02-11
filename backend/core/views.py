from django.db.models import Q
from rest_framework import viewsets, permissions, status, parsers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView
from django.db import transaction
from rest_framework_simplejwt.views import TokenObtainPairView
from django.utils import timezone
from datetime import timedelta, datetime
import hashlib
import io
from django.core.files.base import ContentFile
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import hashlib
import io
from django.core.files.base import ContentFile
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont


from .serializers import (
    DonorProfileSerializer,
    DonorCouponSerializer,
    EmergencyNeedSerializer,
    OrganDonorSerializer,
    MarketplaceItemSerializer,
    HospitalSerializer,
    DoctorSerializer,
    DoctorAvailabilitySerializer,
    ReviewSerializer,
    DonationRequestSerializer,
    HospitalNeedSerializer,
    AppointmentSerializer,
    DeceasedDonorRequestSerializer,
    AccidentAlertSerializer,
    BloodDonationEventSerializer,
    CustomTokenObtainPairSerializer,
    MedicalEssentialSerializer,
    MedicalStoreProductSerializer,
    MedicalEquipmentSerializer,
    MedicalOrderSerializer,
    MedicalOrderItemSerializer,
    PatientVisitSerializer,
    StaffSerializer,
    StaffAvailabilitySerializer,
    AttendanceSerializer,
    SalaryPaymentSerializer,
    PerformanceTrackingSerializer,
    EquipmentNeedSerializer,
    EquipmentOrderSerializer,
    InvoiceSerializer,
    EventRegistrationSerializer,
    AmbulanceRequestSerializer,
)

from .models import (
    User, UserRoles, DonorProfile, DonorCoupon, EmergencyNeed, OrganDonor, 
    MarketplaceItem, Hospital, Doctor, DoctorAvailability, Review, 
    DonationRequest, HospitalNeed, Appointment, DeceasedDonorRequest, 
    AccidentAlert, BloodDonationEvent, EventRegistration, MedicalEssential, 
    MedicalStoreProduct, MedicalEquipment, MedicalOrder, MedicalOrderItem, 
    PatientVisit, Staff, StaffAvailability, Attendance, SalaryPayment, 
    PerformanceTracking, EquipmentNeed, EquipmentOrder, Invoice, PDFIntegrityLedger,
    AmbulanceRequest
)


ALL_BLOOD_GROUPS = {"O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"}

BLOOD_COMPATIBILITY = {
	"O-": list(ALL_BLOOD_GROUPS),
	"O+": ["O+", "A+", "B+", "AB+"],
	"A-": ["A-", "A+", "AB-", "AB+"],
	"A+": ["A+", "AB+"],
	"B-": ["B-", "B+", "AB-", "AB+"],
	"B+": ["B+", "AB+"],
	"AB-": ["AB-", "AB+"],
	"AB+": ["AB+"],
}


class MetricsOverviewView(APIView):
    """
    Lightweight metrics endpoint used by the public landing page.
    Returns aggregate counts so the homepage can display real numbers
    instead of hard-coded placeholders.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        donors_count = DonorProfile.objects.count()

        needs_served = EmergencyNeed.objects.filter(status="FULFILLED").count() + \
            HospitalNeed.objects.filter(status__in=["FULFILLED", "COMPLETED"]).count()

        hospitals_count = Hospital.objects.count()

        items_listed = (
            MarketplaceItem.objects.count()
            + MedicalStoreProduct.objects.count()
            + MedicalEquipment.objects.count()
        )

        module_breakdown = {
            "donor": donors_count + DonationRequest.objects.count(),
            "hospital": hospitals_count + HospitalNeed.objects.count() + Appointment.objects.count(),
            "organ": OrganDonor.objects.count() + DeceasedDonorRequest.objects.count() + AccidentAlert.objects.count(),
            "marketplace": items_listed + MedicalOrder.objects.count(),
        }

        return Response(
            {
                "donors": donors_count,
                "needs_served": needs_served,
                "hospitals": hospitals_count,
                "items_listed": items_listed,
                "module_breakdown": module_breakdown,
            }
        )


class RegisterUserView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        data = request.data.copy()

        required_fields = [
            "first_name", "last_name", "email",
            "password", "confirm_password"
        ]
        print("data", data)
        for field in required_fields:
            if not data.get(field):
                return Response(
                    {"detail": f"Missing field: {field}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

        if data["password"] != data["confirm_password"]:
            return Response(
                {"detail": "Password & Confirm Password do not match"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if User.objects.filter(email=data["email"]).exists():
            return Response(
                {"detail": "Email already registered"},
                status=status.HTTP_400_BAD_REQUEST
            )

        role = data.get("donor_module", "donor")
        phone = data.get("phone", "")

        if role not in UserRoles.values:
            return Response(
                {"detail": "Invalid registration type"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            with transaction.atomic():

                # ---- Create User ----
                user = User.objects.create_user(
                    email=data["email"],
                    password=data["password"],
                    role=role,
                    is_active=True
                )

                user.first_name = data["first_name"]
                user.last_name = data["last_name"]
                user.phone = data["phone"]
                user.gender = data.get("gender")
                user.blood_group = data.get("blood_group")
                user.save()

                # ---- Role-based profile creation ----
                if role == UserRoles.DONOR:
                    DonorProfile.objects.create(
                        user=user,
                        date_of_birth=data.get("date_of_birth")
                    )

                elif role == UserRoles.HOSPITAL:
                    Hospital.objects.create(
                        name=f"{user.first_name} {user.last_name}",
                        phone=data["phone"],
                        user=user,
                        city=""  # can be updated later
                    )

                elif role == UserRoles.MEDICAL_ESSENTIAL:
                    MedicalEssential.objects.create(
                        company_name=f"{user.first_name} {user.last_name}",
                        user=user,
                        address="",
                        city=""
                    )

                return Response(
                    {
                        "message": "Registration successful",
                        "role": role,
                        "email": user.email
                    },
                    status=status.HTTP_201_CREATED
                )

        except Exception as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )



class CustomTokenObtainPairView(TokenObtainPairView):
    permission_classes = [AllowAny]  # No authentication required for login
    serializer_class = CustomTokenObtainPairSerializer


class DonorProfileViewSet(viewsets.ModelViewSet):
	queryset = DonorProfile.objects.all()
	serializer_class = DonorProfileSerializer
	permission_classes = [permissions.IsAuthenticatedOrReadOnly]

	def _get_compatible_groups(self, blood_group: str):
		groups = BLOOD_COMPATIBILITY.get(blood_group, [])
		is_universal = len(groups) == len(ALL_BLOOD_GROUPS)
		return groups, is_universal

	def _get_or_none(self, user):
		print('user',user)
		try:
			profile = DonorProfile.objects.get(user=user)
			self._sync_stars(profile)
			return profile
		except DonorProfile.DoesNotExist:
			return None

	def _sync_stars(self, profile):
		if not profile:
			return
		from .models import PatientVisit
		donation_count = PatientVisit.objects.filter(
			patient=profile.user,
			visit_purpose="BLOOD_DONATION"
		).count()
		
		# If stars are missing or behind, update them
		# We don't want to reset if somehow stars are ahead (though unlikely in this flow)
		if profile.current_stars < donation_count:
			profile.current_stars = donation_count
			profile.save()

	@action(detail=False, methods=["get", "put", "patch"], permission_classes=[permissions.IsAuthenticated])
	def me(self, request):
		profile = self._get_or_none(request.user)

		if request.method.lower() == "get":
			if not profile:
				return Response({"detail": "Donor profile not found."}, status=status.HTTP_404_NOT_FOUND)
			serializer = self.get_serializer(profile)
			return Response(serializer.data)

		data = request.data.copy()
		data["user_id"] = request.user.pk

		if profile:
			serializer = self.get_serializer(profile, data=data, partial=request.method.lower() == "patch")
		else:
			serializer = self.get_serializer(data=data)

		serializer.is_valid(raise_exception=True)
		instance = serializer.save()
		response_status = status.HTTP_200_OK if profile else status.HTTP_201_CREATED
		return Response(self.get_serializer(instance).data, status=response_status)

	@action(detail=False, methods=["get"], url_path="dashboard", permission_classes=[permissions.IsAuthenticated])
	def dashboard(self, request):
		profile = self._get_or_none(request.user)
		if not profile:
			return Response({"detail": "Donor profile not found."}, status=status.HTTP_404_NOT_FOUND)

		compatible_groups, is_universal = self._get_compatible_groups(profile.user.blood_group)

		needs_queryset = EmergencyNeed.objects.select_related("created_by").filter(status="OPEN")
		if profile.city:
			needs_queryset = needs_queryset.filter(city__icontains=profile.city)

		if not is_universal and compatible_groups:
			needs_queryset = needs_queryset.filter(
				Q(required_blood_group__in=compatible_groups)
				| Q(required_blood_group__isnull=True)
				| Q(required_blood_group__exact="")
			)

		needs_data = EmergencyNeedSerializer(needs_queryset, many=True).data
		donor_data = self.get_serializer(profile).data

		# Get upcoming blood donation events
		upcoming_events = BloodDonationEvent.objects.filter(
			event_date__gte=timezone.now(),
			status="UPCOMING"
		).select_related("hospital").order_by("event_date")[:10]
		
		# Format events for frontend
		events_data = []
		for event in upcoming_events:
			event_date = event.event_date
			events_data.append({
				"id": event.id,
				"date": event_date.strftime("%a • %d %b"),
				"title": event.title,
				"location": event.location,
				"hospital": event.hospital.name if event.hospital else "",
				"event_date": event_date.isoformat(),
				"start_time": str(event.start_time),
				"end_time": str(event.end_time),
			})

		return Response(
			{
				"donor": donor_data,
				"compatibility": {
					"blood_group": profile.user.blood_group,
					"can_donate_to": compatible_groups,
					"is_universal": is_universal,
				},
				"recommended_needs": needs_data,
				"upcoming_events": events_data,
			}
		)

	@action(detail=False, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def generate_health_report(self, request):
		"""
		Generates a secure, password-protected PDF health report.
		Expects assessment data in request body.
		"""
		from django.http import HttpResponse
		from .pdf_service import generate_secure_health_report
		
		profile = self._get_or_none(request.user)
		if not profile:
			return Response({"detail": "Donor profile not found."}, status=status.HTTP_404_NOT_FOUND)
		
		# --- Blockchain IDs for Watermark ---
		import secrets
		import time
		download_id = f"DL-{secrets.token_hex(8).upper()}"
		timestamp_unix = time.time()
		timestamp_str = datetime.fromtimestamp(timestamp_unix).strftime('%d/%m/%Y, %H:%M:%S')
		watermark_text = f"{download_id} | {timestamp_str}"
		
		assessment_data = request.data
		donor_data = {
			"name": f"{request.user.first_name} {request.user.last_name}",
			"email": request.user.email,
			"blood_group": request.user.blood_group,
			"age": assessment_data.get("age"),
			"weight": assessment_data.get("weight"),
			"health_score": assessment_data.get("healthScore"),
			"can_donate": assessment_data.get("canDonate"),
			"recommendation": assessment_data.get("recommendation") or assessment_data.get("message"),
		}
		
		try:
			pdf_buffer = generate_secure_health_report(donor_data, watermark_text=watermark_text)
			pdf_bytes = pdf_buffer.getvalue()

			# --- Blockchain Integrity Recording ---
			from .blockchain_service import BlockchainService
			block = BlockchainService.record_download(
				request.user, 
				pdf_bytes, 
				download_id=download_id, 
				timestamp=str(timestamp_unix),
				report_type="BLOOD"
			)
			
			# Link report ID to donor profile for verification
			profile.latest_report_id = download_id
			profile.save()
			
			response = HttpResponse(pdf_bytes, content_type='application/pdf')
			last_name = request.user.last_name or "Donor"
			today = datetime.now().strftime('%Y%m%d')
			filename = f"Health_Report_{last_name}_{today}.pdf"
			response['Content-Disposition'] = f'attachment; filename="{filename}"'
			
			# Add blockchain metadata to headers
			response['X-Download-ID'] = block.download_id
			response['X-Blockchain-Hash'] = block.block_hash
			
			return response
		except Exception as e:
			print(f"PDF Generation Error: {str(e)}")
			return Response({
				"detail": f"Error generating PDF: {str(e)}"
			}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

	@action(detail=False, methods=["get"], permission_classes=[permissions.IsAuthenticated])
	def download_history(self, request):
		"""Lists all PDF downloads recorded on the blockchain for this user."""
		from .models import PDFIntegrityLedger
		records = PDFIntegrityLedger.objects.filter(user=request.user)
		
		# Optional Filtering
		report_type = request.query_params.get("report_type")
		if report_type:
			records = records.filter(report_type=report_type)
			
		records = records.order_by('-created_at')
		
		data = [
			{
				"id": r.id,
				"download_id": r.download_id,
				"report_type": r.report_type,
				"pdf_hash": r.pdf_hash,
				"block_hash": r.block_hash,
				"timestamp": r.created_at,
				"nonce": r.nonce,
				"pdf_file": r.pdf_file.url if r.pdf_file else None
			}
			for r in records
		]
		return Response(data)

	@action(detail=False, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def verify_health_report(self, request):
		"""
		Verifies that an uploaded PDF matches the latest blockchain-secured report for this donor.
		"""
		uploaded_file = request.FILES.get('file')
		if not uploaded_file:
			return Response({"valid": False, "detail": "No file uploaded."}, status=status.HTTP_400_BAD_REQUEST)
		
		# Verify file type
		if not uploaded_file.name.endswith('.pdf'):
			return Response({"valid": False, "detail": "Only PDF files are allowed."}, status=status.HTTP_400_BAD_REQUEST)

		# Hash the uploaded content
		import hashlib
		hasher = hashlib.sha256()
		for chunk in uploaded_file.chunks():
			hasher.update(chunk)
		uploaded_hash = hasher.hexdigest()

		# Get donor profile and latest report ID
		profile = request.user.donor_profile
		if not profile or not profile.latest_report_id:
			return Response({
				"valid": False, 
				"detail": "No previous health report found in your profile. Please generate one first."
			}, status=status.HTTP_400_BAD_REQUEST)

		# Get the ledger entry for the expected report
		from .models import PDFIntegrityLedger
		ledger_entry = PDFIntegrityLedger.objects.filter(
			user=request.user, 
			download_id=profile.latest_report_id
		).first()

		if not ledger_entry:
			return Response({
				"valid": False, 
				"detail": "Integrity record not found for your latest report."
			}, status=status.HTTP_404_NOT_FOUND)

		# Comparison
		if uploaded_hash == ledger_entry.pdf_hash:
			return Response({
				"valid": True,
				"detail": "Integrity verified! This is the authentic report.",
				"download_id": ledger_entry.download_id
			})
		else:
			return Response({
				"valid": False, 
				"detail": "Integrity mismatch! This PDF does not match the latest report generated for you. Please upload the original, unmodified file."
			}, status=status.HTTP_400_BAD_REQUEST)


class DonorCouponViewSet(viewsets.ReadOnlyModelViewSet):
	queryset = DonorCoupon.objects.all()
	serializer_class = DonorCouponSerializer
	permission_classes = [permissions.IsAuthenticated]

	def get_queryset(self):
		return self.queryset.filter(donor=self.request.user)


class EmergencyNeedViewSet(viewsets.ModelViewSet):
	queryset = EmergencyNeed.objects.select_related("created_by").all().order_by("-created_at")
	serializer_class = EmergencyNeedSerializer
	permission_classes = [permissions.IsAuthenticatedOrReadOnly]

	@action(detail=False, methods=["get"], permission_classes=[permissions.AllowAny])
	def donor_count(self, request):
		blood_group = request.query_params.get("blood_group")
		need_type = request.query_params.get("need_type", "BLOOD")
		city = request.query_params.get("city")
		organ_type = request.query_params.get("organ_type")
		
		from .utils_email import get_compatible_donor_emails
		emails = get_compatible_donor_emails(blood_group, need_type, city, organ_type)
		return Response({"count": len(emails)})

	@action(detail=False, methods=["get"], permission_classes=[permissions.IsAuthenticated])
	def matched_needs(self, request):
		user = request.user
		blood_group = user.blood_group
		city = getattr(user.donor_profile, "city", None) if hasattr(user, "donor_profile") else None
		
		if not blood_group:
			return Response([])
			
		from .utils_email import BLOOD_RECEIVE_COMPATIBILITY, PLATELET_RECEIVE_COMPATIBILITY
		
		# Who can GIVE to this patient blood group? 
		# Wait, the donor IS the one giving. 
		# So we need to find needs where the donor can help.
		
		# A donor with group 'D' can help a patient with group 'P' 
		# if 'D' is in P's compatibility list.
		
		# This is slow if we iterate all needs. 
		# Let's find all patient groups that can receive from this donor.
		
		def get_receivable_groups(donor_group, compatibility_map):
			return [p_group for p_group, donors in compatibility_map.items() if donor_group in donors]

		receivable_blood = get_receivable_groups(blood_group, BLOOD_RECEIVE_COMPATIBILITY)
		receivable_platelets = get_receivable_groups(blood_group, PLATELET_RECEIVE_COMPATIBILITY)
		
		q_filter = Q(need_type="BLOOD", required_blood_group__in=receivable_blood) | \
				   Q(need_type="PLATELETS", required_blood_group__in=receivable_platelets) | \
				   Q(need_type="ORGAN")
		
		matches = EmergencyNeed.objects.filter(q_filter, status="OPEN")
		
		if city:
			matches = matches.filter(city__icontains=city)
			
		serializer = self.get_serializer(matches.order_by("-created_at"), many=True)
		return Response(serializer.data)

	@action(detail=False, methods=["post"], permission_classes=[permissions.AllowAny])
	def critical_emergency(self, request):
		print("form submitted-------------------------------------------------")
		"""Create a critical emergency need (blood, platelets, hospitalization) - allows anonymous"""
		from django.contrib.auth import get_user_model
		User = get_user_model()
		
		# If user is authenticated, use them. Otherwise, use anonymous user.
		if request.user.is_authenticated:
			creator = request.user
		else:
			# Get or create an anonymous user for emergency needs
			creator, _ = User.objects.get_or_create(
				email="emergency@lifesaver.local",
				defaults={"first_name": "Emergency", "last_name": "Anonymous", "is_active": False}
			)
		
		data = request.data.copy()
		data["created_by_id"] = creator.id
		data["status"] = "OPEN"
		
		# Set needed_by to immediate if not provided
		if not data.get("needed_by"):
			from datetime import datetime, timedelta
			data["needed_by"] = (datetime.now() + timedelta(hours=1)).isoformat()
		
		serializer = self.get_serializer(data=data)
		serializer.is_valid(raise_exception=True)
		emergency_need = serializer.save()
		
		# Find nearby hospitals/blood banks
		nearby_hospitals = []
		city = data.get("city", "")
		lat = data.get("latitude")
		lng = data.get("longitude")
		
		if lat and lng:
			try:
				lat = float(lat)
				lng = float(lng)
				hospitals = Hospital.objects.filter(
					latitude__isnull=False,
					longitude__isnull=False
				).extra(
					select={
						'distance': 'SQRT(POW(69.1 * (latitude - %s), 2) + POW(69.1 * (longitude - %s) * COS(latitude / 57.3), 2))'
					},
					select_params=[lat, lng],
					order_by=['distance']
				)[:5]
				
				nearby_hospitals = [
					{
						"id": h.id,
						"name": h.name,
						"phone": h.phone,
						"address": h.address,
						"city": h.city,
						"hospital_type": h.hospital_type,
					}
					for h in hospitals
				]
			except (ValueError, TypeError):
				pass
		
		# If no location-based hospitals, try by city
		if not nearby_hospitals and city:
			hospitals = Hospital.objects.filter(city__icontains=city)[:5]
			nearby_hospitals = [
				{
					"id": h.id,
					"name": h.name,
					"phone": h.phone,
					"address": h.address,
					"city": h.city,
					"hospital_type": h.hospital_type,
				}
				for h in hospitals
			]
		
		# Trigger emergency email alerts to compatible donors
		from .utils_email import send_emergency_alert_email
		sent_emails_count = send_emergency_alert_email(emergency_need)
		
		return Response({
			"message": f"Critical emergency need created! {sent_emails_count} matching donors have been notified via email. Nearby hospitals have also been alerted.",
			"emergency_need": serializer.data,
			"nearby_hospitals": nearby_hospitals,
			"emails_sent": sent_emails_count
		}, status=status.HTTP_201_CREATED)

	@action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def accept_need(self, request, pk=None):
		"""Mark the need as accepted by the current donor"""
		need = self.get_object()
		if need.status == "FULFILLED":
			return Response({"error": "This request has already been fulfilled."}, status=status.HTTP_400_BAD_REQUEST)
		
		need.accepted_by = request.user
		need.status = "FULFILLED" # Or maybe keep OPEN until confirmed? 
		# User said "it should show in this page an user has been got"
		# Let's set it to FULFILLED so it disappears from 'open' lists but shows as found here.
		need.save()
		
		return Response({
			"message": "You have successfully accepted this emergency request. Please contact the patient immediately.",
			"need": self.get_serializer(need).data
		})


class OrganDonorViewSet(viewsets.ModelViewSet):
	queryset = OrganDonor.objects.select_related("created_by").prefetch_related("selected_hospitals").all()
	serializer_class = OrganDonorSerializer
	permission_classes = [permissions.IsAuthenticatedOrReadOnly]

	def get_queryset(self):
		user = self.request.user
		if not user.is_authenticated:
			return OrganDonor.objects.none()
			
		from django.db.models import Q
		
		# Base logic: User should always see their own records
		base_query = Q(created_by=user)
		
		# If user is a hospital, additional records they can see:
		hospital = getattr(user, 'hospital_profile', None)
		if hospital:
			base_query |= Q(selected_hospitals=hospital) | Q(accepted_by_hospital=hospital)
			
		return OrganDonor.objects.filter(base_query).distinct()

	@action(detail=False, methods=["get", "put", "patch"], permission_classes=[permissions.IsAuthenticated])
	def me(self, request):
		"""Get or update organ donor profile for logged-in user"""
		try:
			organ_donor = OrganDonor.objects.select_related("created_by").prefetch_related("selected_hospitals").get(created_by=request.user)
		except OrganDonor.DoesNotExist:
			if request.method.lower() == "get":
				return Response({"detail": "Organ donor profile not found."}, status=status.HTTP_404_NOT_FOUND)
			organ_donor = None

		if request.method.lower() == "get":
			serializer = self.get_serializer(organ_donor)
			return Response(serializer.data)

		data = request.data.copy()
		data["user_id"] = request.user.pk

		if organ_donor:
			serializer = self.get_serializer(organ_donor, data=data, partial=request.method.lower() == "patch")
		else:
			serializer = self.get_serializer(data=data)

		serializer.is_valid(raise_exception=True)
		instance = serializer.save()
		response_status = status.HTTP_200_OK if organ_donor else status.HTTP_201_CREATED
		return Response(self.get_serializer(instance).data, status=response_status)

	@action(detail=False, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def notify_contact(self, request):
		"""Simulate sending notification to emergency contact"""
		try:
			organ_donor = OrganDonor.objects.get(created_by=request.user)
			if not organ_donor.emergency_contact_phone:
				return Response({"detail": "No emergency contact phone recorded."}, status=status.HTTP_400_BAD_REQUEST)
			
			# In a real app, integrate with SMS/Email service here
			return Response({
				"message": f"Pledge report successfully sent to {organ_donor.emergency_contact_name} ({organ_donor.emergency_contact_phone}).",
				"target": organ_donor.emergency_contact_phone
			})
		except OrganDonor.DoesNotExist:
			return Response({"detail": "Organ donor profile not found."}, status=status.HTTP_404_NOT_FOUND)

	@action(detail=False, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def notify_hospitals(self, request):
		"""Simulate secure transmission of pledge report to selected hospitals"""
		try:
			organ_donor = OrganDonor.objects.prefetch_related("selected_hospitals").get(created_by=request.user)
			hospitals = organ_donor.selected_hospitals.all()
			
			if not hospitals:
				return Response({"detail": "No hospitals selected for notification."}, status=status.HTTP_400_BAD_REQUEST)
			
			hospital_names = [h.name for h in hospitals]
			
			# In a real app, this would trigger a system notification or secure portal update for the hospitals
			return Response({
				"message": f"Pledge report securely transmitted to {len(hospitals)} hospital(s): {', '.join(hospital_names)}.",
				"notified_count": len(hospitals)
			})
		except OrganDonor.DoesNotExist:
			return Response({"detail": "Organ donor profile not found."}, status=status.HTTP_404_NOT_FOUND)

	@action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def accept_pledge(self, request, pk=None):
		"""Hospital accepts the organ pledge and sends a commitment message"""
		organ_donor = self.get_object()
		hospital = getattr(request.user, 'hospital_profile', None)
		if not hospital:
			return Response({"detail": "Only hospitals can accept pledges."}, status=status.HTTP_403_FORBIDDEN)
		
		# Default message if none provided
		message = request.data.get("message", "Your emergency contact will come and give the report after your death then only this will be accepted")
		
		organ_donor.status = "ACCEPTED"
		organ_donor.hospital_message = message
		organ_donor.accepted_by_hospital = hospital
		organ_donor.save()
		
		return Response(self.get_serializer(organ_donor).data)

	@action(detail=False, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def generate_draft_pledge(self, request):
		"""
		Generates a SECURE draft PDF and tracks it in the Blockchain Ledger.
		"""
		import secrets
		import time
		from .pdf_service import generate_secure_organ_pledge_report
		from .blockchain_service import BlockchainService
		from django.http import HttpResponse

		data = request.data
		
		# Metadata for Watermark & Ledger
		download_id = f"DRAFT-{request.user.id}-{secrets.token_hex(4).upper()}"
		timestamp_unix = time.time()
		timestamp_str = datetime.fromtimestamp(timestamp_unix).strftime('%d/%m/%Y, %H:%M:%S')
		watermark_text = f"{download_id} | {timestamp_str} (DRAFT)"
		
		donor_data = {
			"id": "DRAFT",
			"name": request.user.first_name + " " + request.user.last_name,
			"blood_group": data.get("blood_group") or request.user.blood_group,
			"date_of_birth": data.get("date_of_birth") or getattr(request.user.donor_profile, 'date_of_birth', 'N/A'),
			"phone": data.get("phone") or request.user.phone,
			"emergency_contact_name": data.get("emergency_contact_name"),
			"emergency_contact_phone": data.get("emergency_contact_phone"),
			"organs": data.get("organs"),
		}

		if data.get("organs_list") and isinstance(data.get("organs_list"), list):
			if "ALL" in data.get("organs_list"):
				donor_data["organs"] = "All Viable Organs"
			else:
				donor_data["organs"] = ", ".join(data.get("organs_list"))
		elif not donor_data["organs"]:
			donor_data["organs"] = "Not Selected"

		try:
			# Generate Secure PDF
			pdf_buffer = generate_secure_organ_pledge_report(donor_data, watermark_text=watermark_text)
			pdf_bytes = pdf_buffer.getvalue()
			
			# TRACK IN BLOCKCHAIN LEDGER
			BlockchainService.record_download(
				request.user, 
				pdf_bytes, 
				download_id=download_id, 
				timestamp=str(timestamp_unix),
				report_type="ORGAN_PLEDGE"
			)
			
			response = HttpResponse(pdf_bytes, content_type='application/pdf')
			filename = f"Draft_Pledge_{request.user.last_name}.pdf"
			response['Content-Disposition'] = f'attachment; filename="{filename}"'
			return response
		except Exception as e:
			print(f"Draft Ledger Error: {e}")
			return Response({"detail": "Failed to generate tracked draft report."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

	@action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def commit_pledge(self, request, pk=None):
		"""Donor acknowledges the hospital condition and finalizing the pledge"""
		organ_donor = self.get_object()
		if organ_donor.created_by != request.user:
			return Response({"detail": "You can only commit to your own pledge."}, status=status.HTTP_403_FORBIDDEN)
		
		organ_donor.status = "COMMITTED"
		
		# --- SECURE PDF & BLOCKCHAIN INTEGRATION ---
		import secrets
		import time
		from .pdf_service import generate_secure_organ_pledge_report
		from .blockchain_service import BlockchainService
		from django.core.files.base import ContentFile

		# Generate Blockchain Metadata
		download_id = f"PLEDGE-{organ_donor.id}-{secrets.token_hex(4).upper()}"
		timestamp_unix = time.time()
		timestamp_str = datetime.fromtimestamp(timestamp_unix).strftime('%d/%m/%Y, %H:%M:%S')
		watermark_text = f"{download_id} | {timestamp_str}"
		
		# Prepare Data
		organs_str = "All Viable Organs"
		if organ_donor.organs and "ALL" not in organ_donor.organs:
			organs_str = organ_donor.organs

		donor_data = {
			"id": organ_donor.id,
			"name": request.user.first_name + " " + request.user.last_name,
			"blood_group": organ_donor.blood_group,
			"date_of_birth": organ_donor.date_of_birth,
			"phone": organ_donor.phone,
			"emergency_contact_name": organ_donor.emergency_contact_name,
			"emergency_contact_phone": organ_donor.emergency_contact_phone,
			"organs": organs_str,
		}
		
		try:
			# Generate Secure PDF
			pdf_buffer = generate_secure_organ_pledge_report(donor_data, watermark_text=watermark_text)
			pdf_bytes = pdf_buffer.getvalue()
			
			# Record in Blockchain Ledger
			block = BlockchainService.record_download(
				request.user, 
				pdf_bytes, 
				download_id=download_id, 
				timestamp=str(timestamp_unix),
				report_type="ORGAN_PLEDGE"
			)
			
			# Save to Model
			file_name = f"Secure_Pledge_{organ_donor.id}_{int(timestamp_unix)}.pdf"
			organ_donor.pledge_report.save(file_name, ContentFile(pdf_bytes), save=False)
			organ_donor.blockchain_record = block
			
			# If already accepted, move to COMMITTED on finalize
			if organ_donor.status == "ACCEPTED":
				organ_donor.status = "COMMITTED"
				
			organ_donor.save()
			
			return Response(self.get_serializer(organ_donor).data)
			
		except Exception as e:
			print(f"Secure Pledge Ledger Error: {e}")
			return Response({"detail": "Failed to generate tracked pledge."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


	@action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def intake_body(self, request, pk=None):
		"""Hospital verifies blockchain record, intakes body, and records payment"""
		organ_donor = self.get_object()
		
		# Verify Hospital Permission
		hospital = getattr(request.user, 'hospital_profile', None)
		if not hospital:
			return Response({"detail": "Only hospitals can intake bodies."}, status=status.HTTP_403_FORBIDDEN)
			
		# Verify Blockchain Hash (Simulated verification step)
		provided_hash = request.data.get("pdf_hash")
		if provided_hash and organ_donor.blockchain_record:
			clean_provided = str(provided_hash).strip().lower()
			clean_stored = str(organ_donor.blockchain_record.pdf_hash).strip().lower()
			
			if clean_provided != clean_stored:
				return Response({
					"detail": f"Blockchain verification FAILED. The provided hash doesn't match the record for this donor.",
					"provided": clean_provided,
					"expected_on_record": clean_stored
				}, status=status.HTTP_400_BAD_REQUEST)
		
		# Update Status
		organ_donor.status = "COMPLETED"
		
		received_at = request.data.get("received_at")
		if received_at:
			organ_donor.body_received_at = received_at
		else:
			organ_donor.body_received_at = timezone.now()
			
		organ_donor.accepted_by_hospital = hospital
		
		# Record Payment
		payment = request.data.get("payment_amount")
		if payment:
			organ_donor.payment_amount = payment
			organ_donor.payment_date = organ_donor.body_received_at
				
		organ_donor.save()
		
		return Response(self.get_serializer(organ_donor).data)

	@action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def hospital_verify(self, request, pk=None):
		"""Hospital verifies or rejects the organ pledge report"""
		organ_donor = self.get_object()
		hospital = getattr(request.user, 'hospital_profile', None)
		if not hospital:
			return Response({"detail": "Only hospitals can verify pledges."}, status=status.HTTP_403_FORBIDDEN)
			
		decision = request.data.get("decision") # 'verify' or 'reject'
		if decision == 'reject':
			organ_donor.status = "REJECTED"
			organ_donor.save()
			return Response({"status": "REJECTED", "detail": "Pledge report rejected."})
			
		# Else verify
		organ_donor.status = "REPORT_VERIFIED"
		organ_donor.accepted_by_hospital = hospital
		organ_donor.save()
		
		data = self.get_serializer(organ_donor).data
		if organ_donor.blockchain_record:
			data["blockchain_record"] = {
				"download_id": organ_donor.blockchain_record.download_id,
				"pdf_hash": organ_donor.blockchain_record.pdf_hash,
				"timestamp": organ_donor.blockchain_record.created_at,
			}
		return Response(data)

	@action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def donor_finalize(self, request, pk=None):
		"""Donor confirms or rejects the pledge after report verification"""
		organ_donor = self.get_object()
		if organ_donor.created_by != request.user:
			return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
			
		action_type = request.data.get("action") # 'accept' or 'reject'
		if action_type == 'accept':
			organ_donor.status = "COMMITTED"
			organ_donor.save()
			return Response(self.get_serializer(organ_donor).data)
		elif action_type == 'reject':
			organ_donor.delete()
			return Response({"status": "DELETED", "detail": "Pledge cancelled and removed."})
		
		return Response({"detail": "Invalid action."}, status=status.HTTP_400_BAD_REQUEST)

	@action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def receive_body(self, request, pk=None):
		"""Hospital confirms the arrival of the donor's body and records payment"""
		organ_donor = self.get_object()
		hospital = getattr(request.user, 'hospital_profile', None)
		if not hospital or organ_donor.accepted_by_hospital != hospital:
			return Response({"detail": "Only the accepting hospital can record body reception."}, status=status.HTTP_403_FORBIDDEN)
		
		# Update details
		organ_donor.status = "COMPLETED"
		organ_donor.body_received_at = timezone.now()
		
		# Record Payment
		organ_donor.payment_amount = request.data.get("payment_amount")
		organ_donor.payment_date = timezone.now()
		organ_donor.save()
		
		# Record a PatientVisit for the intake
		from .models import PatientVisit
		PatientVisit.objects.create(
			patient=organ_donor.created_by,
			hospital=hospital,
			visit_purpose="ORGAN_DONATION",
			visit_date=timezone.now(),
			notes=f"Organ intake completed for pledge ID {organ_donor.id}. Payment recorded."
		)

		return Response(self.get_serializer(organ_donor).data)

	@action(detail=False, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def submit_verified_report(self, request):
		"""Attaches an uploaded verified report and notifies selected hospitals"""
		file_obj = request.FILES.get('file')
		hospital_ids = request.data.getlist('selected_hospitals')
		
		if not file_obj:
			return Response({"detail": "No file uploaded."}, status=status.HTTP_400_BAD_REQUEST)
			
		import hashlib
		pdf_content = file_obj.read()
		file_hash = hashlib.sha256(pdf_content).hexdigest()
		file_obj.seek(0) # IMPORTANT: Rewind for saving
		
		from .models import PDFIntegrityLedger, Hospital
		try:
			record = PDFIntegrityLedger.objects.get(pdf_hash=file_hash, report_type="ORGAN_PLEDGE")
			if not record.is_active:
				return Response({"detail": "This report has been replaced by a newer draft. Please use the most recently downloaded report."}, status=status.HTTP_400_BAD_REQUEST)
		except PDFIntegrityLedger.DoesNotExist:
			return Response({"detail": "This report is not registered on our blockchain. Cannot submit."}, status=status.HTTP_400_BAD_REQUEST)
			
		# Find or create organ donor profile
		organ_donor, created = OrganDonor.objects.get_or_create(created_by=request.user)
		
		# Save report and record
		organ_donor.pledge_report.save(file_obj.name, file_obj)
		organ_donor.blockchain_record = record
		organ_donor.status = "PENDING" # Reset to pending for hospital review
		
		# Update hospitals
		if hospital_ids:
			hospitals = Hospital.objects.filter(id__in=hospital_ids)
			organ_donor.selected_hospitals.set(hospitals)
			
		organ_donor.save()
		return Response(self.get_serializer(organ_donor).data)

	@action(detail=False, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def verify_pledge_report(self, request):
		"""Verifies uploaded PDF against blockchain ledger"""
		file_obj = request.FILES.get('file')
		if not file_obj:
			return Response({"detail": "No file uploaded."}, status=status.HTTP_400_BAD_REQUEST)
			
		import hashlib
		pdf_content = file_obj.read()
		file_hash = hashlib.sha256(pdf_content).hexdigest()
		
		from .models import PDFIntegrityLedger
		try:
			record = PDFIntegrityLedger.objects.get(pdf_hash=file_hash, report_type="ORGAN_PLEDGE")
			if not record.is_active:
				return Response({
					"valid": False,
					"detail": "This report has been replaced by a newer draft. Please use the most recently downloaded report."
				}, status=status.HTTP_400_BAD_REQUEST)
			
			return Response({
				"valid": True, 
				"detail": "Blockchain match found! Report is authentic.",
				"download_id": record.download_id,
				"timestamp": record.created_at
			})
		except PDFIntegrityLedger.DoesNotExist:
			return Response({
				"valid": False, 
				"detail": "No matching blockchain record found for this file."
			}, status=status.HTTP_404_NOT_FOUND)
		return Response(self.get_serializer(organ_donor).data)

	@action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def hospital_delete(self, request, pk=None):
		"""Hospital removes the record from their view (for cancelled or processed pledges)"""
		organ_donor = self.get_object()
		hospital = getattr(request.user, 'hospital_profile', None)
		if not hospital:
			return Response({"detail": "Only hospitals can perform this action."}, status=status.HTTP_403_FORBIDDEN)
		
		# If it was cancelled by donor, hospital can just remove themselves from selected_hospitals
		if organ_donor.status == "CANCELLED" or organ_donor.status == "BODY_RECEIVED":
			if organ_donor.accepted_by_hospital == hospital:
				organ_donor.accepted_by_hospital = None
			organ_donor.selected_hospitals.remove(hospital)
			organ_donor.save()
			return Response({"detail": "Record removed from dashboard."}, status=status.HTTP_200_OK)
		
		return Response({"detail": "Can only delete processed or cancelled pledges."}, status=status.HTTP_400_BAD_REQUEST)


class MarketplaceItemViewSet(viewsets.ModelViewSet):
	queryset = MarketplaceItem.objects.select_related("seller").all().order_by("-created_at")
	serializer_class = MarketplaceItemSerializer
	permission_classes = [permissions.IsAuthenticatedOrReadOnly]


class HospitalViewSet(viewsets.ModelViewSet):
	queryset = Hospital.objects.all().order_by("name")
	serializer_class = HospitalSerializer
	permission_classes = [permissions.AllowAny]

	def get_queryset(self):
		queryset = super().get_queryset()
		# Filter by hospital type
		hospital_type = self.request.query_params.get("type")
		if hospital_type:
			queryset = queryset.filter(hospital_type__in=[hospital_type, "BOTH"])
		# Filter only registered hospitals (with user account)
		registered_only = self.request.query_params.get("registered_only")
		if registered_only == "true":
			queryset = queryset.filter(user__isnull=False)
		# Location-based search (simple distance calculation)
		lat = self.request.query_params.get("latitude")
		lng = self.request.query_params.get("longitude")
		if lat and lng:
			try:
				lat = float(lat)
				lng = float(lng)
				# Filter hospitals with coordinates and order by approximate distance
				queryset = queryset.filter(latitude__isnull=False, longitude__isnull=False)
				# Simple distance ordering (can be improved with proper geodistance calculation)
				queryset = queryset.extra(
					select={
						'distance': 'SQRT(POW(69.1 * (latitude - %s), 2) + POW(69.1 * (longitude - %s) * COS(latitude / 57.3), 2))'
					},
					select_params=[lat, lng],
					order_by=['distance']
				)
			except (ValueError, TypeError):
				pass
		return queryset

	@action(detail=False, methods=["get"], permission_classes=[permissions.IsAuthenticated])
	def me(self, request):
		"""Get hospital profile for logged-in hospital user"""
		user = request.user
		hospital = getattr(user, "hospital_profile", None)
		
		# Fallback: if no direct profile link, but user is a hospital role,
		# try to find a hospital where this user's email might be listed or if it's the only one
		if not hospital and user.role == "hospital":
			# Try to find by direct email match in hospital records
			hospital = Hospital.objects.filter(email=user.email).first()
			if not hospital:
				# Heuristic: find by phone if available
				hospital = Hospital.objects.filter(phone=user.phone).first() if user.phone else None
		
		if hospital:
			serializer = self.get_serializer(hospital)
			return Response(serializer.data)
		return Response({"detail": "Hospital profile not found."}, status=status.HTTP_404_NOT_FOUND)


class DoctorViewSet(viewsets.ModelViewSet):
	queryset = Doctor.objects.select_related("hospital").all().order_by("name")
	serializer_class = DoctorSerializer
	permission_classes = [permissions.AllowAny]

	def get_queryset(self):
		queryset = super().get_queryset()
		hospital_id = self.request.query_params.get("hospital")
		if hospital_id:
			queryset = queryset.filter(hospital_id=hospital_id)
		return queryset

	def create(self, request, *args, **kwargs):
		try:
			return super().create(request, *args, **kwargs)
		except Exception as e:
			return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ReviewViewSet(viewsets.ModelViewSet):
	queryset = Review.objects.select_related("user", "doctor", "hospital").all().order_by("-created_at")
	serializer_class = ReviewSerializer
	permission_classes = [permissions.IsAuthenticatedOrReadOnly]


class DonationRequestViewSet(viewsets.ModelViewSet):
	queryset = DonationRequest.objects.select_related("hospital", "donor").all().order_by("-created_at")
	serializer_class = DonationRequestSerializer
	permission_classes = [permissions.IsAuthenticatedOrReadOnly]

	def perform_create(self, serializer):
		# Auto-attach the latest verified health report from the integrity ledger
		user = self.request.user
		health_report = None
		health_status = "Verified via Blockchain Ledger"
		
		if user.is_authenticated:
			profile = getattr(user, 'donor_profile', None)
			if profile and profile.latest_report_id:
				from .models import PDFIntegrityLedger
				ledger_entry = PDFIntegrityLedger.objects.filter(
					user=user, 
					download_id=profile.latest_report_id
				).first()
				if ledger_entry and ledger_entry.pdf_file:
					health_report = ledger_entry.pdf_file
					
					# IMMEDIATELY invalidate the report so it cannot be reused for another request
					profile.latest_report_id = None
					profile.save()
		
		serializer.save(
			donor=user if user.is_authenticated else None,
			health_report=health_report,
			health_status=health_status
		)

	def get_queryset(self):
		queryset = super().get_queryset()
		user = self.request.user
		
		if not user.is_authenticated:
			return DonationRequest.objects.none()
		
		# If it's a donor, they should only see their own requests
		if user.role == "donor":
			queryset = queryset.filter(donor=user)
		# If it's a hospital, they should only see requests for their hospital
		elif user.role == "hospital":
			hospital = getattr(user, 'hospital_profile', None)
			if hospital:
				queryset = queryset.filter(hospital=hospital)
			else:
				# If user is hospital role but has no profile, return none
				return DonationRequest.objects.none()

		# Optional additional filters via query params
		hospital_id = self.request.query_params.get("hospital")
		if hospital_id:
			queryset = queryset.filter(hospital_id=hospital_id)
		
		request_type = self.request.query_params.get("request_type")
		if request_type:
			queryset = queryset.filter(request_type=request_type)
			
		return queryset

	@action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def accept(self, request, pk=None):
		request_obj = self.get_object()
		if request_obj.status != "PENDING":
			return Response({"detail": "Only pending requests can be accepted."}, status=status.HTTP_400_BAD_REQUEST)
		request_obj.status = "ACCEPTED"
		request_obj.notes = request.data.get("notes", "")
		
		# Set scheduled date if provided
		scheduled_date = request.data.get("scheduled_date")
		if scheduled_date:
			request_obj.scheduled_date = scheduled_date
			
		# Set patient name if provided
		patient_name = request.data.get("patient_name")
		if patient_name:
			request_obj.patient_name = patient_name
			
		request_obj.save()
		
		# AUTOMATED CLEANUP: When a donor is accepted, find and delete the matching HospitalNeed 
		# (as it is now being fulfilled by this donor)
		from .models import HospitalNeed
		matching_needs = HospitalNeed.objects.filter(
			hospital=request_obj.hospital,
			need_type=request_obj.request_type,
			status__in=["NORMAL", "URGENT"]
		)
		
		# If we have patient name, use it to narrow down
		if request_obj.patient_name:
			exact_need = matching_needs.filter(patient_name__icontains=request_obj.patient_name).first()
			if exact_need:
				exact_need.delete()
			else:
				# If no exact name match, delete the most relevant one of that type
				top_need = matching_needs.first()
				if top_need:
					top_need.delete()
		else:
			# Just delete the most recent urgent need of this type for this hospital
			top_need = matching_needs.first()
			if top_need:
				top_need.delete()

		# Correctly invalidate the report ID on the donor PROFILE
		if request_obj.donor and hasattr(request_obj.donor, 'donor_profile'):
			profile = request_obj.donor.donor_profile
			profile.latest_report_id = None
			profile.save()
			
		return Response(self.get_serializer(request_obj).data)

	@action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def reject(self, request, pk=None):
		request_obj = self.get_object()
		if request_obj.status != "PENDING":
			return Response({"detail": "Only pending requests can be rejected."}, status=status.HTTP_400_BAD_REQUEST)
		
		# AUTOMATED CLEANUP: Delete the matching HospitalNeed if rejecting a response
		from .models import HospitalNeed
		matching_needs = HospitalNeed.objects.filter(
			hospital=request_obj.hospital,
			need_type=request_obj.request_type
		)
		if request_obj.patient_name:
			matching_needs = matching_needs.filter(patient_name__icontains=request_obj.patient_name)
		
		# Delete the need associated with this request rejection (as requested: "delete urgent blood request")
		matching_needs.delete()
		
		# Correctly invalidate the report ID on the donor PROFILE before deleting the request
		if request_obj.donor and hasattr(request_obj.donor, 'donor_profile'):
			profile = request_obj.donor.donor_profile
			profile.latest_report_id = None
			profile.save()
		
		# AUTOMATED CLEANUP: Delete the DonationRequest immediately as requested
		donor_id = request_obj.donor_id
		request_obj.delete()
			
		return Response({"detail": "Request rejected and cleaned up successfully."}, status=status.HTTP_204_NO_CONTENT)
	
	@action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def confirm_arrival(self, request, pk=None):
		request_obj = self.get_object()
		if request_obj.status != "ACCEPTED":
			return Response({"detail": "Only accepted requests can be confirmed for arrival."}, status=status.HTTP_400_BAD_REQUEST)
		request_obj.status = "ARRIVED"
		request_obj.confirmed_arrival_at = timezone.now()
		request_obj.save()
		return Response(self.get_serializer(request_obj).data)

	@action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def reject_arrival(self, request, pk=None):
		request_obj = self.get_object()
		if request_obj.status != "ARRIVED":
			return Response({"detail": "Only arrived donors can have their arrival status revoked."}, status=status.HTTP_400_BAD_REQUEST)
		request_obj.status = "ACCEPTED"
		request_obj.confirmed_arrival_at = None
		request_obj.save()
		return Response(self.get_serializer(request_obj).data)

	@action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def hospital_verify(self, request, pk=None):
		request_obj = self.get_object()
		if request_obj.status != "ARRIVED":
			return Response({"detail": "Only donors who have confirmed arrival can be verified."}, status=status.HTTP_400_BAD_REQUEST)
		
		with transaction.atomic():
			request_obj.status = "COMPLETED"
			request_obj.notes = request.data.get("notes", request_obj.notes)
			request_obj.save()

			# Create PatientVisit record
			from .models import PatientVisit
			visit_date = request.data.get("visit_date") or timezone.now()
			
			purpose = "BLOOD_DONATION"
			if request_obj.request_type == "PLATELETS":
				purpose = "PLATELET_DONATION"
			elif request_obj.request_type == "ORGAN":
				purpose = "ORGAN_DONATION"

			PatientVisit.objects.create(
				patient=request_obj.donor,
				hospital=request_obj.hospital,
				visit_purpose=purpose,
				visit_date=visit_date,
				notes=request.data.get("notes", ""),
				rewards=request.data.get("rewards", ""),
				fruity_given=request.data.get("fruity_given", False),
				star_reward=request.data.get("star_reward", True)  # User mentioned a star reward for each donation
			)

			# Update DonorProfile last_donated_on
			dt = datetime.fromisoformat(visit_date.replace("Z", ""))
			formatted_date = dt.strftime("%Y-%m-%d")

			# Update DonorProfile last_donated_on and rewards
			from .models import DonorProfile, DonorCoupon
			import secrets
			
			profile, _ = DonorProfile.objects.get_or_create(user=request_obj.donor)
			profile.last_donated_on = formatted_date
			
			# Increment stars (cumulative)
			profile.current_stars += 1
			
			# Check for 50 star milestone (recurring Every 50 stars)
			if profile.current_stars > 0 and profile.current_stars % 50 == 0:
				# Award Rs 50
				from decimal import Decimal
				profile.total_money_earned += Decimal("50.00")
				
				# Generate 20% Discount Coupon
				coupon_code = f"LS-{secrets.token_hex(4).upper()}"
				DonorCoupon.objects.create(
					donor=request_obj.donor,
					code=coupon_code,
					discount_percentage=20
				)
				
			profile.save()

			# AUTOMATED CLEANUP: Delete the DonationRequest after it is COMPLETED and recorded
			# We already saved everything to PatientVisit and DonorProfile
			request_obj.delete()

		return Response({"detail": "Donation verified and record cleaned up."}, status=status.HTTP_200_OK)

	@action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def reject_arrival(self, request, pk=None):
		request_obj = self.get_object()
		if request_obj.status != "ARRIVED":
			return Response({"detail": "Only arrived donors can have their arrival rejected."}, status=status.HTTP_400_BAD_REQUEST)
		
		# Set back to ACCEPTED so they can try to 'arrive' again if it was a mistake
		request_obj.status = "ACCEPTED"
		request_obj.notes = request.data.get("notes", "Arrival registration rejected by hospital staff.")
		request_obj.save()
		return Response(self.get_serializer(request_obj).data)


class HospitalNeedViewSet(viewsets.ModelViewSet):
	queryset = HospitalNeed.objects.select_related("hospital").all().order_by("-created_at")
	serializer_class = HospitalNeedSerializer
	permission_classes = [permissions.IsAuthenticatedOrReadOnly]

	def get_queryset(self):
		queryset = super().get_queryset()
		# Filter by hospital
		hospital_id = self.request.query_params.get("hospital")
		if hospital_id:
			queryset = queryset.filter(hospital_id=hospital_id)
		# Filter by city
		city = self.request.query_params.get("city")
		if city:
			queryset = queryset.filter(hospital__city__icontains=city)
		# Filter by need type
		need_type = self.request.query_params.get("need_type")
		if need_type:
			queryset = queryset.filter(need_type=need_type)
		# Filter by status
		status_filter = self.request.query_params.get("status")
		if status_filter:
			queryset = queryset.filter(status=status_filter)
		# Filter by blood group compatibility for donors
		donor_blood_group = self.request.query_params.get("donor_blood_group")
		if donor_blood_group and donor_blood_group in ALL_BLOOD_GROUPS:
			compatible_groups = BLOOD_COMPATIBILITY.get(donor_blood_group, [])
			if compatible_groups:
				queryset = queryset.filter(
					Q(required_blood_group__in=compatible_groups) |
					Q(required_blood_group__isnull=True) |
					Q(required_blood_group__exact="")
				)
		# Filter active needs (not fulfilled or cancelled)
		active_only = self.request.query_params.get("active_only")
		if active_only and active_only.lower() == "true":
			queryset = queryset.exclude(status__in=["FULFILLED", "CANCELLED"])
		return queryset


class AppointmentViewSet(viewsets.ModelViewSet):
	queryset = Appointment.objects.select_related("hospital", "donation_request").all().order_by("-appointment_date")
	serializer_class = AppointmentSerializer
	permission_classes = [permissions.IsAuthenticatedOrReadOnly]

	def get_queryset(self):
		queryset = super().get_queryset()
		# Filter by hospital
		hospital_id = self.request.query_params.get("hospital")
		if hospital_id:
			queryset = queryset.filter(hospital_id=hospital_id)
		
		# Filter by donor
		if self.request.query_params.get("donor") == "me":
			if self.request.user.is_authenticated:
				# Show appointments where the user is either the direct donor 
				# OR linked via a donation request
				queryset = queryset.filter(
					Q(donor=self.request.user) | 
					Q(donation_request__donor=self.request.user)
				).distinct()
			else:
				return Appointment.objects.none()

		# Filter by status
		status_filter = self.request.query_params.get("status")
		if status_filter:
			queryset = queryset.filter(status=status_filter)
		return queryset

	def perform_create(self, serializer):
		serializer.save(donor=self.request.user)

	@action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def accept(self, request, pk=None):
		appointment = self.get_object()
		if appointment.status != "PENDING":
			return Response({"detail": f"This appointment is currently {appointment.status}. Only pending appointments can be accepted."}, status=status.HTTP_400_BAD_REQUEST)
		
		try:
			with transaction.atomic():
				appointment.status = "APPROVED"
				
				# Update date and time if provided
				if request.data.get("appointment_date"):
					appointment.appointment_date = request.data.get("appointment_date")
				if request.data.get("appointment_time"):
					appointment.appointment_time = request.data.get("appointment_time")
					
				# Auto-populate charges from doctor if not set
				if appointment.doctor and not appointment.charges:
					appointment.charges = appointment.doctor.consultation_charge
					appointment.currency = appointment.doctor.currency
					
				appointment.notes = request.data.get("notes", appointment.notes)
				appointment.save()
				return Response(self.get_serializer(appointment).data)
		except Exception as e:
			return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

	@action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def reject(self, request, pk=None):
		appointment = self.get_object()
		if appointment.status != "PENDING":
			return Response({"detail": "Only pending appointments can be rejected."}, status=status.HTTP_400_BAD_REQUEST)
		
		try:
			appointment.status = "CANCELLED"
			appointment.rejection_reason = request.data.get("rejection_reason", "Rejected by hospital staff.")
			appointment.notes = request.data.get("notes", appointment.notes)
			appointment.save()
			return Response(self.get_serializer(appointment).data)
		except Exception as e:
			return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

	@action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def pay_fee(self, request, pk=None):
		"""Donor pays the consultation fee for an approved appointment"""
		appointment = self.get_object()
		if appointment.status != "APPROVED":
			return Response({"detail": "Fees can only be paid for approved appointments."}, status=status.HTTP_400_BAD_REQUEST)
		
		appointment.is_paid = True
		appointment.payment_date = timezone.now()
		appointment.payment_method = request.data.get("payment_method", "DEMO_PAYMENT")
		
		# Generate a simulated receipt number
		import secrets
		receipt_no = f"RCPT-{appointment.id}-{secrets.token_hex(4).upper()}"
		appointment.payment_receipt = receipt_no
		appointment.save()
		
		return Response(self.get_serializer(appointment).data)

	@action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def mark_reaching(self, request, pk=None):
		"""Donor signals they are on the way to the appointment"""
		appointment = self.get_object()
		if appointment.status != "SCHEDULED" and not appointment.is_paid:
			return Response({"detail": "Only confirmed and paid appointments can be signaled as 'reaching'."}, status=status.HTTP_400_BAD_REQUEST)
		
		appointment.is_reaching = True
		appointment.reaching_at = timezone.now()
		appointment.save()
		return Response(self.get_serializer(appointment).data)

	@action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def confirm_arrival(self, request, pk=None):
		appointment = self.get_object()
		# Only allow arriving if the donor signaled they are reaching or if forced by staff
		if not appointment.is_reaching and not request.user.role == "hospital":
			return Response({"detail": "Donor has not signaled that they are reaching yet."}, status=status.HTTP_400_BAD_REQUEST)
			
		appointment.status = "ARRIVED"
		appointment.confirmed_arrival_at = timezone.now()
		appointment.save()
		return Response(self.get_serializer(appointment).data)

	@action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def submit_prescription(self, request, pk=None):
		"""Doctor submits a structured prescription for an arrived patient"""
		appointment = self.get_object()
		if appointment.status != "ARRIVED":
			return Response({"detail": "Prescriptions can only be submitted for arrived patients."}, status=status.HTTP_400_BAD_REQUEST)
			
		prescription_data = request.data.get("prescription_data")
		next_date = request.data.get("next_consultation_date")
		
		if not prescription_data:
			return Response({"detail": "Prescription data is required."}, status=status.HTTP_400_BAD_REQUEST)
			
		appointment.prescription_data = prescription_data
		appointment.next_consultation_date = next_date
		appointment.status = "COMPLETED"
		appointment.is_prescription_ready = True
		
		# Build a text summary for the legacy prescription field
		summary = []
		medicines = prescription_data.get("medicines", [])
		for med in medicines:
			line = f"- {med.get('name')}: {med.get('dosage')} ({med.get('timing')})"
			summary.append(line)
		
		custom_meds = prescription_data.get("custom_medicines", [])
		for med in custom_meds:
			line = f"- {med.get('name')} (Custom): {med.get('dosage')} ({med.get('timing')})"
			summary.append(line)
			
		if next_date:
			summary.append(f"\nNext Consultation: {next_date}")
			
		appointment.prescription = "\n".join(summary)
		appointment.save()

		# Create PatientVisit record for history tracking
		from .models import PatientVisit
		PatientVisit.objects.get_or_create(
			appointment=appointment,
			defaults={
				"patient": appointment.donor or (appointment.donation_request.donor if appointment.donation_request else None),
				"hospital": appointment.hospital,
				"doctor": appointment.doctor,
				"visit_purpose": "CONSULTATION",
				"visit_date": timezone.now(),
				"notes": appointment.notes,
				"charges": appointment.charges,
				"currency": appointment.currency,
				"payment_status": "PAID" if appointment.is_paid else "PENDING"
			}
		)
		
		return Response(self.get_serializer(appointment).data)

	@action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def reject_arrival(self, request, pk=None):
		appointment = self.get_object()
		if appointment.status != "ARRIVED":
			return Response({"detail": "Only arrived donors can have their arrival status revoked."}, status=status.HTTP_400_BAD_REQUEST)
		# Revert to SCHEDULED if possible, otherwise APPROVED
		appointment.status = "SCHEDULED"
		appointment.confirmed_arrival_at = None
		appointment.save()
		return Response(self.get_serializer(appointment).data)

	@action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def confirm_slot(self, request, pk=None):
		"""Donor confirms the hospital-approved appointment slot after payment"""
		appointment = self.get_object()
		
		if not appointment.is_paid:
			return Response({"detail": "Please pay the consultation fee first to confirm your slot."}, status=status.HTTP_400_BAD_REQUEST)

		if appointment.status != "APPROVED":
			return Response({"detail": f"Only approved appointments can be confirmed. Current status: {appointment.status}"}, status=status.HTTP_400_BAD_REQUEST)
		
		# Ensure only the owner (donor) can confirm
		donor = appointment.donor or (appointment.donation_request.donor if appointment.donation_request else None)
		if donor != request.user:
			return Response({"detail": "You are not authorized to confirm this appointment."}, status=status.HTTP_403_FORBIDDEN)

		appointment.status = "SCHEDULED"
		appointment.save()
		return Response(self.get_serializer(appointment).data)

	@action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def decline(self, request, pk=None):
		"""Donor declines the hospital-approved appointment slot"""
		appointment = self.get_object()
		if appointment.status != "APPROVED":
			return Response({"detail": "Only approved appointments can be declined."}, status=status.HTTP_400_BAD_REQUEST)
		
		# Ensure only the owner (donor) can decline
		if appointment.donor != request.user and appointment.donation_request.donor != request.user:
			return Response({"detail": "You are not authorized to decline this appointment."}, status=status.HTTP_403_FORBIDDEN)

		appointment.status = "CANCELLED"
		appointment.notes = request.data.get("notes", "Declined by donor.")
		appointment.save()
		return Response(self.get_serializer(appointment).data)

	@action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def hospital_verify(self, request, pk=None):
		"""Hospital verifies the appointment (Saw Doctor)"""
		appointment = self.get_object()
		# Allowed for SCHEDULED or APPROVED status
		if appointment.status not in ["SCHEDULED", "APPROVED", "ARRIVED"]:
			return Response({"detail": f"Only scheduled or arrived appointments can be verified. Current status: {appointment.status}"}, status=status.HTTP_400_BAD_REQUEST)
		
		donor = appointment.donor or (appointment.donation_request.donor if appointment.donation_request else None)
		if not donor:
			return Response({"detail": "No donor found for this appointment."}, status=status.HTTP_400_BAD_REQUEST)

		with transaction.atomic():
			appointment.status = "COMPLETED"
			appointment.notes = request.data.get("notes", appointment.notes)
			appointment.prescription = request.data.get("prescription", "")
			appointment.is_prescription_ready = True if appointment.prescription else False
			appointment.save()

			# Also update linked donation request if exists
			if appointment.donation_request:
				appointment.donation_request.status = "COMPLETED"
				appointment.donation_request.save()

			# Create PatientVisit record
			from .models import PatientVisit
			visit_date = request.data.get("visit_date") or timezone.now()
			
			PatientVisit.objects.create(
				patient=donor,
				hospital=appointment.hospital,
				doctor=appointment.doctor,
				visit_purpose="CONSULTATION",
				visit_date=visit_date,
				notes=request.data.get("notes", ""),
				rewards=request.data.get("rewards", ""),
				fruity_given=request.data.get("fruity_given", False),
				star_reward=request.data.get("star_reward", True)
			)

			# Update DonorProfile
			try:
				dt = datetime.fromisoformat(str(visit_date).replace("Z", ""))
				formatted_date = dt.strftime("%Y-%m-%d")
			except ValueError:
				formatted_date = timezone.now().strftime("%Y-%m-%d")

			from .models import DonorProfile, DonorCoupon
			import secrets
			
			profile, _ = DonorProfile.objects.get_or_create(user=donor)
			profile.last_donated_on = formatted_date
			profile.current_stars += 1
			
			if profile.current_stars > 0 and profile.current_stars % 50 == 0:
				from decimal import Decimal
				profile.total_money_earned += Decimal("50.00")
				coupon_code = f"LS-{secrets.token_hex(4).upper()}"
				DonorCoupon.objects.create(
					donor=donor,
					code=coupon_code,
					discount_percentage=20
				)
			profile.save()

		return Response(self.get_serializer(appointment).data)

	@action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def not_reached(self, request, pk=None):
		"""Hospital marks donor as not reached/no-show"""
		appointment = self.get_object()
		if appointment.status not in ["SCHEDULED", "APPROVED", "PENDING"]:
			return Response({"detail": "Only active appointments can be marked as not reached."}, status=status.HTTP_400_BAD_REQUEST)
		
		appointment.status = "NO_SHOW"
		appointment.notes = "Ok we understand ur issues and please contact us when you are available"
		appointment.save()
		return Response(self.get_serializer(appointment).data)

	@action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def acknowledge(self, request, pk=None):
		"""Donor acknowledges the missed appointment message"""
		appointment = self.get_object()
		if appointment.status != "NO_SHOW":
			return Response({"detail": "Only missed appointments can be acknowledged."}, status=status.HTTP_400_BAD_REQUEST)
		
		# Ensure only the donor can acknowledge
		if appointment.donor != request.user and (not appointment.donation_request or appointment.donation_request.donor != request.user):
			return Response({"detail": "You are not authorized to acknowledge this."}, status=status.HTTP_403_FORBIDDEN)

		appointment.delete()
		return Response({"detail": "Appointment cleared."}, status=status.HTTP_200_OK)


class DeceasedDonorRequestViewSet(viewsets.ModelViewSet):
	queryset = DeceasedDonorRequest.objects.select_related("processed_by", "hospital_referred").prefetch_related("selected_hospitals").all().order_by("-created_at")
	serializer_class = DeceasedDonorRequestSerializer
	permission_classes = [permissions.IsAuthenticatedOrReadOnly]

	def get_queryset(self):
		queryset = super().get_queryset()
		# Filter by status
		status_filter = self.request.query_params.get("status")
		if status_filter:
			queryset = queryset.filter(status=status_filter)
		# Filter by city
		city = self.request.query_params.get("city")
		if city:
			queryset = queryset.filter(deceased_city__icontains=city)
		return queryset


class AccidentAlertViewSet(viewsets.ModelViewSet):
	queryset = AccidentAlert.objects.select_related("hospital_referred").all().order_by("-created_at")
	serializer_class = AccidentAlertSerializer
	permission_classes = [permissions.IsAuthenticatedOrReadOnly]

	def get_queryset(self):
		queryset = super().get_queryset()
		# Filter by status (default to active)
		status_filter = self.request.query_params.get("status", "ACTIVE")
		queryset = queryset.filter(status=status_filter)
		# Filter by city
		city = self.request.query_params.get("city")
		if city:
			queryset = queryset.filter(city__icontains=city)
		# Location-based search
		lat = self.request.query_params.get("latitude")
		lng = self.request.query_params.get("longitude")
		if lat and lng:
			try:
				lat = float(lat)
				lng = float(lng)
				queryset = queryset.filter(latitude__isnull=False, longitude__isnull=False)
				queryset = queryset.extra(
					select={
						'distance': 'SQRT(POW(69.1 * (latitude - %s), 2) + POW(69.1 * (longitude - %s) * COS(latitude / 57.3), 2))'
					},
					select_params=[lat, lng],
					order_by=['distance']
				)
			except (ValueError, TypeError):
				pass
		return queryset

	@action(detail=True, methods=["post"], permission_classes=[permissions.AllowAny])
	def speed_up(self, request, pk=None):
		"""Speed up emergency response: find nearest hospital, send alerts, and trigger ambulance call"""
		accident = self.get_object()
		
		# Find nearest hospital if location is available
		nearest_hospital = None
		if accident.latitude and accident.longitude:
			try:
				hospitals = Hospital.objects.filter(
					latitude__isnull=False,
					longitude__isnull=False
				).extra(
					select={
						'distance': 'SQRT(POW(69.1 * (latitude - %s), 2) + POW(69.1 * (longitude - %s) * COS(latitude / 57.3), 2))'
					},
					select_params=[float(accident.latitude), float(accident.longitude)],
					order_by=['distance']
				)[:1]
				
				if hospitals:
					nearest_hospital = hospitals[0]
					accident.hospital_referred = nearest_hospital
					accident.save()
			except (ValueError, TypeError):
				pass
		
		# If no hospital found by location, try by city
		if not nearest_hospital and accident.city:
			try:
				nearest_hospital = Hospital.objects.filter(city__icontains=accident.city).first()
				if nearest_hospital:
					accident.hospital_referred = nearest_hospital
					accident.save()
			except Exception:
				pass
		
		# Prepare response with ambulance and hospital info
		response_data = {
			"message": "Emergency alert sent! Ambulance and hospital have been notified.",
			"ambulance_contact": "108",
			"accident": self.get_serializer(accident).data,
		}
		
		if nearest_hospital:
			response_data["nearest_hospital"] = {
				"id": nearest_hospital.id,
				"name": nearest_hospital.name,
				"phone": nearest_hospital.phone,
				"address": nearest_hospital.address,
				"city": nearest_hospital.city,
			}
			response_data["message"] += f" Nearest hospital ({nearest_hospital.name}) has been alerted."
		else:
			response_data["nearest_hospital"] = None
			response_data["message"] += " Please contact local hospitals directly."
		
		return Response(response_data, status=status.HTTP_200_OK)

	@action(detail=False, methods=["get"], permission_classes=[permissions.AllowAny])
	def accident_prone_areas(self, request):
		"""Get accident-prone areas based on historical accident data"""
		# Get all active accidents with coordinates
		accidents = AccidentAlert.objects.filter(
			status="ACTIVE",
			latitude__isnull=False,
			longitude__isnull=False
		).values("id", "title", "location", "city", "latitude", "longitude", "severity", "created_at")
		
		# Group by area (simple clustering by proximity)
		accident_areas = []
		for accident in accidents:
			accident_areas.append({
				"id": accident["id"],
				"title": accident["title"],
				"location": accident["location"],
				"city": accident["city"],
				"latitude": float(accident["latitude"]),
				"longitude": float(accident["longitude"]),
				"severity": accident["severity"],
				"reported_at": accident["created_at"].isoformat() if accident["created_at"] else None,
			})
		
		return Response({
			"accident_prone_areas": accident_areas,
			"count": len(accident_areas),
		})


class BloodDonationEventViewSet(viewsets.ModelViewSet):
	queryset = BloodDonationEvent.objects.select_related("hospital").all().order_by("event_date")
	serializer_class = BloodDonationEventSerializer
	permission_classes = [permissions.IsAuthenticatedOrReadOnly]

	def get_queryset(self):
		queryset = super().get_queryset()
		# Filter by hospital
		hospital_id = self.request.query_params.get("hospital")
		if hospital_id:
			queryset = queryset.filter(hospital_id=hospital_id)
		# Filter by status
		status_filter = self.request.query_params.get("status")
		if status_filter:
			queryset = queryset.filter(status=status_filter)
		# Filter upcoming events (default)
		upcoming = self.request.query_params.get("upcoming", "true")
		if upcoming.lower() == "true":
			from django.utils import timezone
			queryset = queryset.filter(event_date__gte=timezone.now(), status="UPCOMING")
		return queryset


class EventRegistrationViewSet(viewsets.ModelViewSet):
	queryset = EventRegistration.objects.select_related("event", "donor").all().order_by("-registered_at")
	serializer_class = EventRegistrationSerializer
	permission_classes = [permissions.IsAuthenticatedOrReadOnly]

	def get_queryset(self):
		queryset = super().get_queryset()
		# Filter by event
		event_id = self.request.query_params.get("event")
		if event_id:
			queryset = queryset.filter(event_id=event_id)
		
		# Filter by donor
		if self.request.query_params.get("donor") == "me":
			if self.request.user.is_authenticated:
				queryset = queryset.filter(donor=self.request.user)
			else:
				return EventRegistration.objects.none()
		
		# Filter by hospital (all registrations for events organized by this hospital)
		hospital_id = self.request.query_params.get("hospital")
		if hospital_id:
			queryset = queryset.filter(event__hospital_id=hospital_id)

		return queryset

	def perform_create(self, serializer):
		serializer.save(donor=self.request.user)

	@action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def confirm(self, request, pk=None):
		registration = self.get_object()
		
		# Check authorization
		is_authorized = False
		# 1. Direct ownership check
		if registration.event.hospital.user == request.user:
			is_authorized = True
		# 2. Hospital profile check (fallback)
		if not is_authorized:
			try:
				hospital = Hospital.objects.get(user=request.user)
				if registration.event.hospital == hospital:
					is_authorized = True
			except Hospital.DoesNotExist:
				pass
		
		if not is_authorized:
			return Response({"detail": "You are not authorized to confirm this registration."}, status=status.HTTP_403_FORBIDDEN)

		registration.status = "APPROVED"
		registration.save()
		return Response(self.get_serializer(registration).data)

	@action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def mark_arrived(self, request, pk=None):
		registration = self.get_object()
		
		# Check authorization
		is_authorized = False
		if registration.event.hospital.user == request.user:
			is_authorized = True
		if not is_authorized:
			try:
				hospital = Hospital.objects.get(user=request.user)
				if registration.event.hospital == hospital:
					is_authorized = True
			except Hospital.DoesNotExist:
				pass

		if not is_authorized:
			return Response({"detail": "You are not authorized to mark this arrival."}, status=status.HTTP_403_FORBIDDEN)

		registration.status = "ARRIVED"
		registration.arrived_at = timezone.now()
		registration.save()
		return Response(self.get_serializer(registration).data)

	@action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def reject(self, request, pk=None):
		"""Hospital rejects a pending registration"""
		registration = self.get_object()
		
		# Check authorization
		is_authorized = False
		if registration.event.hospital.user == request.user:
			is_authorized = True
		if not is_authorized:
			try:
				hospital = Hospital.objects.get(user=request.user)
				if registration.event.hospital == hospital:
					is_authorized = True
			except Hospital.DoesNotExist:
				pass

		if not is_authorized:
			return Response({"detail": "You are not authorized to reject this registration."}, status=status.HTTP_403_FORBIDDEN)

		if registration.status != "PENDING":
			return Response({"detail": "Can only reject pending registrations."}, status=status.HTTP_400_BAD_REQUEST)

		registration = self.get_object()
		# Only the registered donor can cancel
		if registration.donor != request.user:
			return Response({"detail": "You are not authorized to cancel this registration."}, status=status.HTTP_403_FORBIDDEN)

		if registration.status not in ["PENDING", "APPROVED", "COMING"]:
			return Response({"detail": "Cannot cancel a registration in its current state."}, status=status.HTTP_400_BAD_REQUEST)

		registration.status = "NOT_COMING"
		registration.save()
		return Response(self.get_serializer(registration).data)

	def destroy(self, request, *args, **kwargs):
		instance = self.get_object()
		
		# Check authorization
		is_hospital_authorized = False
		# 1. Direct ownership check
		if instance.event.hospital.user == request.user:
			is_hospital_authorized = True
		# 2. Hospital profile check (fallback)
		if not is_hospital_authorized:
			try:
				hospital = Hospital.objects.get(user=request.user)
				if instance.event.hospital == hospital:
					is_hospital_authorized = True
			except Hospital.DoesNotExist:
				pass
		
		# Allow donor to delete their own pending/cancelled registration
		is_donor_authorized = instance.donor == request.user
		
		if not (is_hospital_authorized or is_donor_authorized):
			return Response({"detail": "You are not authorized to delete this registration."}, status=status.HTTP_403_FORBIDDEN)

		self.perform_destroy(instance)
		return Response(status=status.HTTP_204_NO_CONTENT)



class MedicalEssentialViewSet(viewsets.ModelViewSet):
	queryset = MedicalEssential.objects.select_related("user").all()
	serializer_class = MedicalEssentialSerializer
	permission_classes = [permissions.IsAuthenticatedOrReadOnly]

	@action(detail=False, methods=["get", "put", "patch"], permission_classes=[permissions.IsAuthenticated])
	def me(self, request):
		"""Get or update Medical Essential profile for logged-in user"""
		try:
			profile = MedicalEssential.objects.select_related("user").get(user=request.user)
		except MedicalEssential.DoesNotExist:
			if request.method.lower() == "get":
				return Response({"detail": "Medical Essential profile not found."}, status=status.HTTP_404_NOT_FOUND)
			profile = None

		if request.method.lower() == "get":
			serializer = self.get_serializer(profile)
			return Response(serializer.data)

		data = request.data.copy()
		data["user_id"] = request.user.pk

		if profile:
			serializer = self.get_serializer(profile, data=data, partial=request.method.lower() == "patch")
		else:
			serializer = self.get_serializer(data=data)

		serializer.is_valid(raise_exception=True)
		instance = serializer.save()
		response_status = status.HTTP_200_OK if profile else status.HTTP_201_CREATED
		return Response(self.get_serializer(instance).data, status=response_status)

	@action(detail=False, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def regenerate_api_key(self, request):
		"""Regenerate API key for the authenticated Medical Essential user"""
		try:
			profile = MedicalEssential.objects.get(user=request.user)
			profile.generate_api_key()
			profile.save()
			return Response({
				"message": "API key regenerated successfully.",
				"api_key": profile.api_key
			})
		except MedicalEssential.DoesNotExist:
			return Response({"detail": "Medical Essential profile not found."}, status=status.HTTP_404_NOT_FOUND)


class MedicalStoreProductViewSet(viewsets.ModelViewSet):
	queryset = MedicalStoreProduct.objects.select_related("supplier").all().order_by("-created_at")
	serializer_class = MedicalStoreProductSerializer
	permission_classes = [permissions.IsAuthenticatedOrReadOnly]
	parser_classes = (parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser)

	def get_queryset(self):
		queryset = super().get_queryset()
		# Filter by supplier
		supplier_id = self.request.query_params.get("supplier")
		if supplier_id:
			queryset = queryset.filter(supplier_id=supplier_id)
		# Filter by category
		category = self.request.query_params.get("category")
		if category:
			queryset = queryset.filter(category=category)
		# Filter active products only
		active_only = self.request.query_params.get("active", "true")
		if active_only.lower() == "true":
			queryset = queryset.filter(is_active=True)
		# Search by name
		search = self.request.query_params.get("search")
		if search:
			queryset = queryset.filter(Q(name__icontains=search) | Q(description__icontains=search) | Q(brand__icontains=search))
		return queryset


class MedicalEquipmentViewSet(viewsets.ModelViewSet):
	queryset = MedicalEquipment.objects.select_related("supplier").all().order_by("-created_at")
	serializer_class = MedicalEquipmentSerializer
	permission_classes = [permissions.IsAuthenticatedOrReadOnly]
	parser_classes = (parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser)

	def get_queryset(self):
		queryset = super().get_queryset()
		# Filter by supplier
		supplier_id = self.request.query_params.get("supplier")
		if supplier_id:
			queryset = queryset.filter(supplier_id=supplier_id)
		# Filter by equipment type
		equipment_type = self.request.query_params.get("equipment_type")
		if equipment_type:
			queryset = queryset.filter(equipment_type=equipment_type)
		# Filter active products only
		active_only = self.request.query_params.get("active", "true")
		if active_only.lower() == "true":
			queryset = queryset.filter(is_active=True)
		# Search by name
		search = self.request.query_params.get("search")
		if search:
			queryset = queryset.filter(Q(name__icontains=search) | Q(description__icontains=search) | Q(brand__icontains=search))
		return queryset


class MedicalOrderViewSet(viewsets.ModelViewSet):
	queryset = MedicalOrder.objects.select_related("user", "supplier").prefetch_related("items").all().order_by("-created_at")
	serializer_class = MedicalOrderSerializer
	permission_classes = [permissions.IsAuthenticated]

	def get_queryset(self):
		queryset = super().get_queryset()
		# Filter by customer (for buyers)
		if self.request.query_params.get("my_orders") == "true":
			queryset = queryset.filter(user=self.request.user)
		# Filter by supplier (for suppliers)
		if self.request.query_params.get("supplier_orders") == "true":
			try:
				supplier = MedicalEssential.objects.get(user=self.request.user)
				queryset = queryset.filter(supplier=supplier)
			except MedicalEssential.DoesNotExist:
				queryset = queryset.none()
		# Filter by status
		status_filter = self.request.query_params.get("status")
		if status_filter:
			queryset = queryset.filter(status=status_filter)
		# Filter by order type
		order_type = self.request.query_params.get("order_type")
		if order_type:
			queryset = queryset.filter(order_type=order_type)
		return queryset

	@action(detail=False, methods=["post"], permission_classes=[permissions.IsAuthenticated], url_path="create-order")
	def create_order(self, request):
		"""Create an order with items"""
		data = request.data.copy()
		data["user_id"] = request.user.pk

		# Validate items
		items_data = data.get("items", [])
		if not items_data:
			return Response({"detail": "Order must contain at least one item."}, status=status.HTTP_400_BAD_REQUEST)

		# Calculate total
		total_amount = 0
		order_items = []

		for item_data in items_data:
			product_type = item_data.get("product_type")
			quantity = int(item_data.get("quantity", 1))

			if product_type == "STORE":
				try:
					product = MedicalStoreProduct.objects.get(id=item_data.get("store_product_id"))
					if product.quantity_available < quantity:
						return Response({"detail": f"Insufficient stock for {product.name}"}, status=status.HTTP_400_BAD_REQUEST)
					unit_price = float(product.price)
					subtotal = quantity * unit_price
					total_amount += subtotal
					order_items.append({
						"product_type": "STORE",
						"store_product": product,
						"quantity": quantity,
						"unit_price": unit_price,
						"subtotal": subtotal
					})
				except MedicalStoreProduct.DoesNotExist:
					return Response({"detail": "Store product not found."}, status=status.HTTP_404_NOT_FOUND)

			elif product_type == "EQUIPMENT":
				try:
					equipment = MedicalEquipment.objects.get(id=item_data.get("equipment_id"))
					if equipment.quantity_available < quantity:
						return Response({"detail": f"Insufficient stock for {equipment.name}"}, status=status.HTTP_400_BAD_REQUEST)
					unit_price = float(equipment.price)
					subtotal = quantity * unit_price
					total_amount += subtotal
					order_items.append({
						"product_type": "EQUIPMENT",
						"equipment": equipment,
						"quantity": quantity,
						"unit_price": unit_price,
						"subtotal": subtotal
					})
				except MedicalEquipment.DoesNotExist:
					return Response({"detail": "Equipment not found."}, status=status.HTTP_404_NOT_FOUND)

		# Handle coupon discount
		coupon_code = data.get("coupon_code")
		applied_coupon = None
		discount_amount = 0
		
		if coupon_code:
			try:
				coupon = DonorCoupon.objects.get(code=coupon_code, donor=request.user)
				
				# Validate coupon
				if coupon.is_used:
					return Response({"detail": "This coupon has already been used."}, status=status.HTTP_400_BAD_REQUEST)
				
				# Apply discount
				discount_amount = total_amount * (coupon.discount_percentage / 100)
				total_amount = total_amount - discount_amount
				applied_coupon = coupon
				data["discount_percentage"] = coupon.discount_percentage
				
			except DonorCoupon.DoesNotExist:
				return Response({"detail": "Invalid coupon code or coupon does not belong to you."}, status=status.HTTP_400_BAD_REQUEST)
		else:
			data["discount_percentage"] = 0

		# Get supplier from first item
		if order_items:
			first_item = order_items[0]
			if first_item["product_type"] == "STORE":
				supplier = first_item["store_product"].supplier
			else:
				supplier = first_item["equipment"].supplier
			data["supplier_id"] = supplier.id

		data["total_amount"] = total_amount
		data["order_type"] = order_items[0]["product_type"] if order_items else "STORE"

		# Create order
		serializer = self.get_serializer(data=data)
		serializer.is_valid(raise_exception=True)
		order = serializer.save()

		# Create order items
		for item_data in order_items:
			MedicalOrderItem.objects.create(
				order=order,
				product_type=item_data["product_type"],
				store_product=item_data.get("store_product"),
				equipment=item_data.get("equipment"),
				quantity=item_data["quantity"],
				unit_price=item_data["unit_price"],
				subtotal=item_data["subtotal"]
			)

			# Update stock
			if item_data["product_type"] == "STORE":
				product = item_data["store_product"]
				product.quantity_available -= item_data["quantity"]
				product.save()
			else:
				equipment = item_data["equipment"]
				equipment.quantity_available -= item_data["quantity"]
				equipment.save()

		# Mark coupon as used if it was applied
		if applied_coupon:
			applied_coupon.is_used = True
			applied_coupon.save()

		response_data = self.get_serializer(order).data
		if applied_coupon:
			response_data["coupon_applied"] = {
				"code": applied_coupon.code,
				"discount_percentage": applied_coupon.discount_percentage,
				"discount_amount": float(discount_amount)
			}

		return Response(response_data, status=status.HTTP_201_CREATED)

	@action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def update_status(self, request, pk=None):
		"""Update order status (for suppliers)"""
		order = self.get_object()
		new_status = request.data.get("status")

		if new_status not in dict(MedicalOrder.STATUS_CHOICES):
			return Response({"detail": "Invalid status."}, status=status.HTTP_400_BAD_REQUEST)

		# Verify user is the supplier
		try:
			supplier = MedicalEssential.objects.get(user=request.user)
			if order.supplier != supplier:
				return Response({"detail": "You can only update orders for your own products."}, status=status.HTTP_403_FORBIDDEN)
		except MedicalEssential.DoesNotExist:
			return Response({"detail": "Medical Essential profile not found."}, status=status.HTTP_404_NOT_FOUND)

		# Enforce transition to DELIVERED only from RECEIVED
		if new_status == "DELIVERED" and order.status != "RECEIVED":
			return Response({
				"detail": "Order can only be marked as Delivered after it has been marked as Received by the hospital."
			}, status=status.HTTP_400_BAD_REQUEST)

		# Advanced Verification: If order is PAID (APPROVED), supplier MUST view invoice before shipping/delivering
		if order.status == "APPROVED" and new_status in ["SHIPPED", "DELIVERED", "CONFIRMED"]:
			if not hasattr(order, 'invoice') or not order.invoice.is_viewed_by_supplier:
				return Response({
					"detail": "You must view the invoice/receipt before accepting or shipping this paid order."
				}, status=status.HTTP_400_BAD_REQUEST)

		order.status = new_status
		order.save()

		return Response(self.get_serializer(order).data)

	@action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def mark_shipped(self, request, pk=None):
		"""Mark order as shipped with date and time"""
		order = self.get_object()
		
		# Verify supplier
		try:
			supplier = MedicalEssential.objects.get(user=request.user)
			if order.supplier != supplier:
				return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
		except MedicalEssential.DoesNotExist:
			return Response({"detail": "Not a supplier"}, status=status.HTTP_403_FORBIDDEN)

		if order.status != "APPROVED":
			return Response({"detail": "Only paid orders can be shipped."}, status=status.HTTP_400_BAD_REQUEST)
		
		if not order.invoice.is_viewed_by_supplier:
			return Response({"detail": "View invoice first."}, status=status.HTTP_400_BAD_REQUEST)

		order.status = "SHIPPED"
		order.actual_shipping_at = request.data.get("actual_shipping_at")
		order.estimated_arrival_at = request.data.get("estimated_arrival_at")
		order.save()

		return Response(self.get_serializer(order).data)

	@action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def mark_received(self, request, pk=None):
		"""Hospital marks order as received and provides a rating"""
		order = self.get_object()
		
		if order.user != request.user:
			return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

		if order.status != "SHIPPED":
			return Response({"detail": "Only shipped orders can be marked as received."}, status=status.HTTP_400_BAD_REQUEST)

		rating = request.data.get("rating")
		if rating:
			order.rating = int(rating)
		
		order.status = "RECEIVED"
		order.save()

		return Response({
			"status": "Order successfull",
			"message": "Shipping successfull",
			"order": self.get_serializer(order).data
		})

	@action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def mark_dispensed(self, request, pk=None):
		"""Medical store marks order as dispensed (given to donor)"""
		order = self.get_object()
		
		# Verify user is the supplier
		try:
			supplier = MedicalEssential.objects.get(user=request.user)
			if order.supplier != supplier:
				return Response({"detail": "You can only dispense your own orders."}, status=status.HTTP_403_FORBIDDEN)
		except MedicalEssential.DoesNotExist:
			return Response({"detail": "Medical Essential profile not found."}, status=status.HTTP_404_NOT_FOUND)

		# Allow dispensing from PENDING, APPROVED, CONFIRMED, or SHIPPED status
		allowed_statuses = ["PENDING", "APPROVED", "CONFIRMED", "SHIPPED"]
		if order.status not in allowed_statuses:
			return Response({"detail": f"Cannot dispense order with status '{order.status}'. Must be one of: {', '.join(allowed_statuses)}."}, status=status.HTTP_400_BAD_REQUEST)

		order.status = "DISPENSED"
		order.save()

		return Response(self.get_serializer(order).data)

	@action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def confirm_receipt(self, request, pk=None):
		"""Donor confirms they have received the dispensed medicine"""
		order = self.get_object()
		
		if order.user != request.user:
			return Response({"detail": "You can only confirm your own orders."}, status=status.HTTP_403_FORBIDDEN)

		if order.status != "DISPENSED":
			return Response({"detail": "Order must be dispensed before you can confirm receipt."}, status=status.HTTP_400_BAD_REQUEST)

		order.status = "RECEIVED"
		order.save()

		return Response(self.get_serializer(order).data)

	@action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def mark_invoice_viewed(self, request, pk=None):
		"""Mark the invoice as viewed by the supplier"""
		order = self.get_object()
		
		# Verify user is the supplier
		try:
			supplier = MedicalEssential.objects.get(user=request.user)
			if order.supplier != supplier:
				return Response({"detail": "You can only view invoices for your own orders."}, status=status.HTTP_403_FORBIDDEN)
		except MedicalEssential.DoesNotExist:
			return Response({"detail": "Medical Essential profile not found."}, status=status.HTTP_404_NOT_FOUND)

		if not hasattr(order, 'invoice'):
			return Response({"detail": "Invoice not found."}, status=status.HTTP_404_NOT_FOUND)

		invoice = order.invoice
		invoice.is_viewed_by_supplier = True
		invoice.save()

		return Response({"status": "Invoice marked as viewed", "invoice": InvoiceSerializer(invoice).data})

	@action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def pay(self, request, pk=None):
		"""Simulate payment for the order and generate invoice"""
		order = self.get_object()

		if order.user != request.user:
			return Response({"detail": "You can only pay for your own orders."}, status=status.HTTP_403_FORBIDDEN)

		if order.status != "PENDING":
			return Response({"detail": "Only pending orders can be paid."}, status=status.HTTP_400_BAD_REQUEST)

		# Simulate payment success
		order.status = "APPROVED"
		order.save()

		# Create Invoice
		if hasattr(order, 'invoice'):
			invoice = order.invoice
		else:
			from django.utils import timezone
			invoice = Invoice.objects.create(
				medical_order=order,
				total_amount=order.total_amount,
				currency=order.currency,
				subtotal=order.total_amount, # Simplified
				is_paid=True,
				payment_date=timezone.now().date()
			)

		return Response({
			"message": "Payment successful!",
			"invoice": InvoiceSerializer(invoice).data,
			"order": self.get_serializer(order).data
		})

	@action(detail=True, methods=["get"], permission_classes=[permissions.IsAuthenticated])
	def download_invoice(self, request, pk=None):
		"""Generate and download protected PDF invoice"""
		from django.http import HttpResponse
		from reportlab.lib.pagesizes import letter
		from reportlab.lib import colors
		from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
		from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
		from reportlab.lib.units import inch
		from io import BytesIO
		
		order = self.get_object()
		
		# Check if invoice exists
		if not hasattr(order, 'invoice'):
			return Response({"detail": "Invoice not found for this order."}, status=status.HTTP_404_NOT_FOUND)
		
		invoice = order.invoice
		
		# Create PDF in memory
		buffer = BytesIO()
		doc = SimpleDocTemplate(buffer, pagesize=letter)
		elements = []
		styles = getSampleStyleSheet()
		
		# Title
		title_style = ParagraphStyle(
			'CustomTitle',
			parent=styles['Heading1'],
			fontSize=24,
			textColor=colors.HexColor('#E91E63'),
			spaceAfter=30,
		)
		elements.append(Paragraph("INVOICE", title_style))
		elements.append(Spacer(1, 0.2*inch))
		
		# Invoice Details
		invoice_data = [
			['Invoice Number:', invoice.invoice_number],
			['Invoice Date:', invoice.created_at.strftime('%Y-%m-%d %H:%M')],
			['Payment Status:', 'PAID' if invoice.is_paid else 'UNPAID'],
			['Payment Date:', invoice.payment_date.strftime('%Y-%m-%d') if invoice.payment_date else 'N/A'],
		]
		
		invoice_table = Table(invoice_data, colWidths=[2*inch, 3*inch])
		invoice_table.setStyle(TableStyle([
			('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F6D6E3')),
			('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
			('ALIGN', (0, 0), (-1, -1), 'LEFT'),
			('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
			('FONTSIZE', (0, 0), (-1, -1), 10),
			('BOTTOMPADDING', (0, 0), (-1, -1), 8),
			('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#E91E63')),
		]))
		elements.append(invoice_table)
		elements.append(Spacer(1, 0.3*inch))
		
		# Hospital Details
		elements.append(Paragraph(f"<b>Hospital Details:</b>", styles['Heading2']))
		hospital_user = order.user
		hospital_profile = hospital_user.hospital_accounts.first() if hospital_user else None
		hospital_data = [
			['Name:', hospital_profile.name if hospital_profile else hospital_user.email],
			['Address:', order.shipping_address],
			['City:', order.shipping_city],
			['Contact:', order.contact_phone],
		]
		hospital_table = Table(hospital_data, colWidths=[1.5*inch, 4*inch])
		hospital_table.setStyle(TableStyle([
			('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
			('FONTSIZE', (0, 0), (-1, -1), 10),
			('BOTTOMPADDING', (0, 0), (-1, -1), 6),
		]))
		elements.append(hospital_table)
		elements.append(Spacer(1, 0.2*inch))
		
		# Supplier Details
		elements.append(Paragraph(f"<b>Supplier Details:</b>", styles['Heading2']))
		supplier_data = [
			['Company:', order.supplier.company_name],
			['Business Type:', order.supplier.business_type],
			['Contact:', order.supplier.contact_phone or 'N/A'],
			['Email:', order.supplier.contact_email or 'N/A'],
		]
		supplier_table = Table(supplier_data, colWidths=[1.5*inch, 4*inch])
		supplier_table.setStyle(TableStyle([
			('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
			('FONTSIZE', (0, 0), (-1, -1), 10),
			('BOTTOMPADDING', (0, 0), (-1, -1), 6),
		]))
		elements.append(supplier_table)
		elements.append(Spacer(1, 0.3*inch))
		
		# Items Table
		elements.append(Paragraph(f"<b>Order Items:</b>", styles['Heading2']))
		items_data = [['Item', 'Quantity', 'Unit Price', 'Amount']]
		
		for item in order.items.all():
			item_name = item.store_product.name if item.store_product else item.equipment.name
			items_data.append([
				item_name,
				str(item.quantity),
				f"${item.unit_price}",
				f"${item.subtotal}"
			])
		
		# Add total row
		items_data.append(['', '', 'TOTAL:', f"${order.total_amount}"])
		
		items_table = Table(items_data, colWidths=[3*inch, 1*inch, 1*inch, 1*inch])
		items_table.setStyle(TableStyle([
			('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#E91E63')),
			('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
			('ALIGN', (0, 0), (-1, -1), 'CENTER'),
			('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
			('FONTSIZE', (0, 0), (-1, 0), 12),
			('BOTTOMPADDING', (0, 0), (-1, 0), 12),
			('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
			('FONTSIZE', (0, -1), (-1, -1), 12),
			('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#F6D6E3')),
			('GRID', (0, 0), (-1, -1), 1, colors.black),
		]))
		elements.append(items_table)
		
		# Build PDF with security
		doc.build(elements)
		
		# Get PDF content
		pdf_content = buffer.getvalue()
		buffer.close()
		
		# Apply PDF protection (prevent editing and copying)
		try:
			from PyPDF2 import PdfReader, PdfWriter
			from io import BytesIO as BytesIO2
			
			reader = PdfReader(BytesIO2(pdf_content))
			writer = PdfWriter()
			
			for page in reader.pages:
				writer.add_page(page)
			
			# Apply protection: no editing, no copying
			writer.encrypt(
				user_password="",  # Empty password for viewing
				owner_password=None,  # No owner password needed
				permissions_flag=0b0000000000000000  # No permissions (can't edit, copy, print)
			)
			
			protected_buffer = BytesIO2()
			writer.write(protected_buffer)
			pdf_content = protected_buffer.getvalue()
			protected_buffer.close()
		except ImportError:
			# PyPDF2 not installed, return unprotected PDF
			pass
		
		# Return PDF response
		response = HttpResponse(pdf_content, content_type='application/pdf')
		response['Content-Disposition'] = f'attachment; filename="invoice_{invoice.invoice_number}.pdf"'
		return response



class DoctorAvailabilityViewSet(viewsets.ModelViewSet):
	queryset = DoctorAvailability.objects.select_related("doctor").all().order_by("doctor", "day_of_week")
	serializer_class = DoctorAvailabilitySerializer
	permission_classes = [permissions.IsAuthenticatedOrReadOnly]

	def get_queryset(self):
		queryset = super().get_queryset()
		doctor_id = self.request.query_params.get("doctor")
		if doctor_id:
			queryset = queryset.filter(doctor_id=doctor_id)
		return queryset


class PatientVisitViewSet(viewsets.ModelViewSet):
	queryset = PatientVisit.objects.select_related("patient", "hospital", "doctor").all().order_by("-visit_date")
	serializer_class = PatientVisitSerializer
	permission_classes = [permissions.IsAuthenticatedOrReadOnly]

	def get_queryset(self):
		queryset = super().get_queryset()
		hospital_id = self.request.query_params.get("hospital")
		if hospital_id:
			queryset = queryset.filter(hospital_id=hospital_id)
		if self.request.query_params.get("patient") == "me":
			queryset = queryset.filter(patient=self.request.user)
		return queryset


class StaffViewSet(viewsets.ModelViewSet):
	queryset = Staff.objects.select_related("hospital").all().order_by("name")
	serializer_class = StaffSerializer
	permission_classes = [permissions.IsAuthenticatedOrReadOnly]

	def get_queryset(self):
		queryset = super().get_queryset()
		hospital_id = self.request.query_params.get("hospital")
		if hospital_id:
			queryset = queryset.filter(hospital_id=hospital_id)
		staff_type = self.request.query_params.get("staff_type")
		if staff_type:
			queryset = queryset.filter(staff_type=staff_type)
		return queryset


class StaffAvailabilityViewSet(viewsets.ModelViewSet):
	queryset = StaffAvailability.objects.select_related("staff").all().order_by("staff", "day_of_week")
	serializer_class = StaffAvailabilitySerializer
	permission_classes = [permissions.IsAuthenticatedOrReadOnly]

	def get_queryset(self):
		queryset = super().get_queryset()
		staff_id = self.request.query_params.get("staff")
		if staff_id:
			queryset = queryset.filter(staff_id=staff_id)
		return queryset


class AttendanceViewSet(viewsets.ModelViewSet):
	queryset = Attendance.objects.select_related("staff").all().order_by("-date")
	serializer_class = AttendanceSerializer
	permission_classes = [permissions.IsAuthenticatedOrReadOnly]

	def get_queryset(self):
		queryset = super().get_queryset()
		staff_id = self.request.query_params.get("staff")
		if staff_id:
			queryset = queryset.filter(staff_id=staff_id)
		date = self.request.query_params.get("date")
		if date:
			queryset = queryset.filter(date=date)
		return queryset


class SalaryPaymentViewSet(viewsets.ModelViewSet):
	queryset = SalaryPayment.objects.select_related("staff").all().order_by("-year", "-month")
	serializer_class = SalaryPaymentSerializer
	permission_classes = [permissions.IsAuthenticatedOrReadOnly]

	def get_queryset(self):
		queryset = super().get_queryset()
		staff_id = self.request.query_params.get("staff")
		if staff_id:
			queryset = queryset.filter(staff_id=staff_id)
		is_paid = self.request.query_params.get("is_paid")
		if is_paid is not None:
			queryset = queryset.filter(is_paid=is_paid.lower() == "true")
		return queryset


class PerformanceTrackingViewSet(viewsets.ModelViewSet):
	queryset = PerformanceTracking.objects.select_related("staff").all().order_by("-date")
	serializer_class = PerformanceTrackingSerializer
	permission_classes = [permissions.IsAuthenticatedOrReadOnly]

	def get_queryset(self):
		queryset = super().get_queryset()
		staff_id = self.request.query_params.get("staff")
		if staff_id:
			queryset = queryset.filter(staff_id=staff_id)
		return queryset


class EquipmentNeedViewSet(viewsets.ModelViewSet):
	queryset = EquipmentNeed.objects.select_related("hospital").all().order_by("-created_at")
	serializer_class = EquipmentNeedSerializer
	permission_classes = [permissions.IsAuthenticatedOrReadOnly]

	def get_queryset(self):
		queryset = super().get_queryset()
		hospital_id = self.request.query_params.get("hospital")
		if hospital_id:
			queryset = queryset.filter(hospital_id=hospital_id)
		status = self.request.query_params.get("status")
		if status:
			queryset = queryset.filter(status=status)
		return queryset


class EquipmentOrderViewSet(viewsets.ModelViewSet):
	queryset = EquipmentOrder.objects.select_related("equipment_need", "supplier").all().order_by("-created_at")
	serializer_class = EquipmentOrderSerializer
	permission_classes = [permissions.IsAuthenticatedOrReadOnly]

	def get_queryset(self):
		queryset = super().get_queryset()
		equipment_need_id = self.request.query_params.get("equipment_need")
		if equipment_need_id:
			queryset = queryset.filter(equipment_need_id=equipment_need_id)
		supplier_id = self.request.query_params.get("supplier")
		if supplier_id:
			queryset = queryset.filter(supplier_id=supplier_id)
		# Filter by supplier for medical essential users
		if self.request.query_params.get("my_orders") == "true":
			try:
				supplier = MedicalEssential.objects.get(user=self.request.user)
				queryset = queryset.filter(supplier=supplier)
			except MedicalEssential.DoesNotExist:
				queryset = queryset.none()
		status = self.request.query_params.get("status")
		if status:
			queryset = queryset.filter(status=status)
		return queryset

	@action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def approve(self, request, pk=None):
		"""Approve equipment order and create invoice"""
		order = self.get_object()
		if order.status != "PENDING":
			return Response({"detail": "Only pending orders can be approved."}, status=status.HTTP_400_BAD_REQUEST)
		
		# Verify user is the supplier
		try:
			supplier = MedicalEssential.objects.get(user=request.user)
			if order.supplier != supplier:
				return Response({"detail": "You can only approve your own orders."}, status=status.HTTP_403_FORBIDDEN)
		except MedicalEssential.DoesNotExist:
			return Response({"detail": "Medical Essential profile not found."}, status=status.HTTP_404_NOT_FOUND)
		
		order.status = "APPROVED"
		order.save()
		
		# Create invoice
		from datetime import date
		invoice_data = {
			"equipment_order_id": order.id,
			"invoice_date": date.today(),
			"total_amount": order.total_amount,
			"currency": order.currency,
			"subtotal": order.total_amount,
			"tax_amount": request.data.get("tax_amount", 0),
			"notes": request.data.get("notes", ""),
		}
		
		invoice_serializer = InvoiceSerializer(data=invoice_data)
		invoice_serializer.is_valid(raise_exception=True)
		invoice = invoice_serializer.save()
		
		order.status = "INVOICED"
		order.save()
		
		return Response({
			"message": "Order approved and invoice created.",
			"order": self.get_serializer(order).data,
			"invoice": InvoiceSerializer(invoice).data,
		}, status=status.HTTP_200_OK)

	@action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def mark_sent(self, request, pk=None):
		"""Mark equipment as sent/shipped"""
		order = self.get_object()
		if order.status not in ["INVOICED", "APPROVED"]:
			return Response({"detail": "Order must be approved/invoiced before marking as sent."}, status=status.HTTP_400_BAD_REQUEST)
		
		order.status = "SENT"
		from django.utils import timezone
		order.sent_date = timezone.now()
		order.save()
		
		return Response(self.get_serializer(order).data)

	@action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def mark_received(self, request, pk=None):
		"""Mark equipment as received at hospital"""
		order = self.get_object()
		if order.status != "SENT":
			return Response({"detail": "Order must be sent before marking as received."}, status=status.HTTP_400_BAD_REQUEST)
		
		order.status = "RECEIVED"
		from django.utils import timezone
		order.received_date = timezone.now()
		order.save()
		
		# Update equipment need status
		order.equipment_need.status = "FULFILLED"
		order.equipment_need.save()
		
		return Response(self.get_serializer(order).data)


class InvoiceViewSet(viewsets.ModelViewSet):
	queryset = Invoice.objects.select_related("equipment_order").all().order_by("-invoice_date")
	serializer_class = InvoiceSerializer
	permission_classes = [permissions.IsAuthenticatedOrReadOnly]

	def get_queryset(self):
		queryset = super().get_queryset()
		equipment_order_id = self.request.query_params.get("equipment_order")
		if equipment_order_id:
			queryset = queryset.filter(equipment_order_id=equipment_order_id)
		equipment_need_id = self.request.query_params.get("equipment_need")
		if equipment_need_id:
			queryset = queryset.filter(equipment_order__equipment_need_id=equipment_need_id)
		# Filter by supplier
		supplier_id = self.request.query_params.get("supplier")
		if supplier_id:
			queryset = queryset.filter(equipment_order__supplier_id=supplier_id)
		return queryset


class DeceasedDonorRequestViewSet(viewsets.ModelViewSet):
	queryset = DeceasedDonorRequest.objects.select_related("user", "processed_by", "hospital_referred").prefetch_related("selected_hospitals").all().order_by("-created_at")
	serializer_class = DeceasedDonorRequestSerializer
	permission_classes = [permissions.IsAuthenticatedOrReadOnly]

	def get_queryset(self):
		queryset = super().get_queryset()
		# Filter by user (requester)
		if self.request.query_params.get("user") == "me":
			if self.request.user.is_authenticated:
				queryset = queryset.filter(user=self.request.user)
			else:
				return DeceasedDonorRequest.objects.none()
		
		# Filter by hospital
		hospital_id = self.request.query_params.get("hospital")
		if hospital_id:
			# Show if hospital is in selected_hospitals or is the referred one
			queryset = queryset.filter(Q(selected_hospitals__id=hospital_id) | Q(hospital_referred_id=hospital_id) | Q(hospital_name__icontains=Hospital.objects.get(id=hospital_id).name if Hospital.objects.filter(id=hospital_id).exists() else "ZZXZXZ")).distinct()
			
		return queryset

	def perform_create(self, serializer):
		if self.request.user.is_authenticated:
			serializer.save(user=self.request.user)
		else:
			serializer.save()

	@action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def cancel(self, request, pk=None):
		instance = self.get_object()
		if instance.user != request.user:
			return Response({"detail": "Not authorized to cancel this request."}, status=status.HTTP_403_FORBIDDEN)
		
		if instance.status not in ["PENDING", "APPROVED"]:
			return Response({"detail": "Cannot cancel a processed request."}, status=status.HTTP_400_BAD_REQUEST)

		instance.status = "CANCELLED"
		instance.save()
		return Response(self.get_serializer(instance).data)

	@action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def process_request(self, request, pk=None):
		"""Hospital accepts/rejects"""
		instance = self.get_object()
		decision = request.data.get("decision") # APPROVED / REJECTED / COMPLETED
		notes = request.data.get("notes", "")

		# Check hospital auth
		hospital = getattr(request.user, 'hospital_profile', None)
		if not hospital:
			return Response({"detail": "Only hospitals can process requests."}, status=status.HTTP_403_FORBIDDEN)
		
		if decision not in ["APPROVED", "REJECTED", "COMPLETED"]:
			return Response({"detail": "Invalid decision."}, status=status.HTTP_400_BAD_REQUEST)

		instance.status = decision
		instance.processed_by = request.user
		instance.processed_at = timezone.now()
		if notes:
			instance.processing_notes = notes
		if decision == "APPROVED":
			instance.hospital_referred = hospital # The hospital taking ownership
		instance.save()
		return Response(self.get_serializer(instance).data)

	@action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def confirm_ambulance(self, request, pk=None):
		"""User confirms ambulance arrival"""
		instance = self.get_object()
		if instance.user != request.user:
			return Response({"detail": "Not authorized."}, status=status.HTTP_403_FORBIDDEN)
		
		if instance.status != "APPROVED":
			return Response({"detail": "Ambulance not yet dispatched (Request not approved)."}, status=status.HTTP_400_BAD_REQUEST)

		instance.status = "COMPLETED"
		instance.save()
		return Response(self.get_serializer(instance).data)


class AmbulanceRequestViewSet(viewsets.ModelViewSet):
    queryset = AmbulanceRequest.objects.all()
    serializer_class = AmbulanceRequestSerializer
    
    def get_permissions(self):
        if self.action in ['create', 'public_life_savers']:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        if user.is_authenticated and user.role == UserRoles.HOSPITAL:
             # Hospitals see requests directed to them
             return AmbulanceRequest.objects.filter(hospital__user=user).order_by('-created_at')
        elif user.is_authenticated:
             # Users see their own requests
             return AmbulanceRequest.objects.filter(reporter=user).order_by('-created_at')
        return AmbulanceRequest.objects.none()

    def perform_create(self, serializer):
        reporter = self.request.user if self.request.user.is_authenticated else None
        serializer.save(reporter=reporter)

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        ambulance_req = self.get_object()
        if ambulance_req.status != 'PENDING':
            return Response({'detail': 'Request is not pending'}, status=status.HTTP_400_BAD_REQUEST)
        
        ambulance_req.status = 'ACCEPTED'
        ambulance_req.save()
        return Response({'status': 'assigned', 'message': 'Ambulance dispatched!'})

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        ambulance_req = self.get_object()
        if ambulance_req.status == 'COMPLETED':
             return Response({'detail': 'Already completed'}, status=status.HTTP_400_BAD_REQUEST)

        ambulance_req.status = 'COMPLETED'
        
        # Reward Logic
        if not ambulance_req.is_rewarded and ambulance_req.reporter:
            try:
                profile = ambulance_req.reporter.donor_profile
                profile.current_stars += 1
                profile.save()
                ambulance_req.is_rewarded = True
            except Exception:
                pass
        
        ambulance_req.save()
        return Response({'status': 'completed', 'message': 'Life saved! Reward star to reporter.'})

    @action(detail=False, methods=['get'], permission_classes=[permissions.AllowAny])
    def public_life_savers(self, request):
        """Public list of completed saves with reporter names and hospitals"""
        saves = AmbulanceRequest.objects.filter(status='COMPLETED').order_by('-updated_at')[:10]
        data = []
        for save in saves:
            data.append({
                'id': save.id,
                'reporter_name': save.reporter.get_full_name() if save.reporter else "Anonymous Hero",
                'hospital_name': save.hospital.name,
                'location': save.location,
                'time': save.updated_at
            })
        return Response(data)
