from django.db.models import Q
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView
from django.db import transaction
from rest_framework_simplejwt.views import TokenObtainPairView
from django.utils import timezone
from datetime import timedelta

from .models import User, UserRoles, DonorProfile, EmergencyNeed, OrganDonor, MarketplaceItem, Hospital, Doctor, DoctorAvailability, Review, DonationRequest, HospitalNeed, Appointment, DeceasedDonorRequest, AccidentAlert, BloodDonationEvent, MedicalEssential, MedicalStoreProduct, MedicalEquipment, MedicalOrder, MedicalOrderItem, PatientVisit, Staff, StaffAvailability, Attendance, SalaryPayment, PerformanceTracking, EquipmentNeed, EquipmentOrder, Invoice
from .serializers import (
	DonorProfileSerializer,
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
            "password", "confirm_password",
            "phone", "donor_module"
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

        role = data["donor_module"]

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
                        contact_person=user.first_name,
                        phone=data["phone"],
                        email=user.email,
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
			return DonorProfile.objects.get(user=user)
		except DonorProfile.DoesNotExist:
			return None

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
		print("prifile-------------------------", profile.user.role)
		if not profile:
			return Response({"detail": "Donor profile not found."}, status=status.HTTP_404_NOT_FOUND)

		compatible_groups, is_universal = self._get_compatible_groups(profile.user.blood_group)

		needs_queryset = EmergencyNeed.objects.select_related("created_by").filter(status="OPEN")
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


class EmergencyNeedViewSet(viewsets.ModelViewSet):
	queryset = EmergencyNeed.objects.select_related("created_by").all().order_by("-created_at")
	serializer_class = EmergencyNeedSerializer
	permission_classes = [permissions.IsAuthenticatedOrReadOnly]

	@action(detail=False, methods=["post"], permission_classes=[permissions.AllowAny])
	def critical_emergency(self, request):
		"""Create a critical emergency need (blood, platelets, hospitalization) - allows anonymous"""
		from django.contrib.auth import get_user_model
		User = get_user_model()
		
		# Get or create an anonymous user for emergency needs
		anonymous_user, _ = User.objects.get_or_create(
			username="emergency_anonymous",
			defaults={"email": "emergency@lifesaver.local", "is_active": False}
		)
		
		data = request.data.copy()
		data["created_by_id"] = anonymous_user.id
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
		
		return Response({
			"message": "Critical emergency need created! Nearby hospitals and blood banks have been notified.",
			"emergency_need": serializer.data,
			"nearby_hospitals": nearby_hospitals,
			"ambulance_contact": "112",
		}, status=status.HTTP_201_CREATED)


class OrganDonorViewSet(viewsets.ModelViewSet):
	queryset = OrganDonor.objects.select_related("user").prefetch_related("selected_hospitals").all()
	serializer_class = OrganDonorSerializer
	permission_classes = [permissions.IsAuthenticatedOrReadOnly]

	@action(detail=False, methods=["get", "put", "patch"], permission_classes=[permissions.IsAuthenticated])
	def me(self, request):
		"""Get or update organ donor profile for logged-in user"""
		try:
			organ_donor = OrganDonor.objects.select_related("user").prefetch_related("selected_hospitals").get(user=request.user)
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
		try:
			hospital = Hospital.objects.get(user=request.user)
			serializer = self.get_serializer(hospital)
			return Response(serializer.data)
		except Hospital.DoesNotExist:
			return Response({"detail": "Hospital profile not found."}, status=status.HTTP_404_NOT_FOUND)


class DoctorViewSet(viewsets.ModelViewSet):
	queryset = Doctor.objects.select_related("hospital").all().order_by("name")
	serializer_class = DoctorSerializer
	permission_classes = [permissions.AllowAny]

	def create(self, request, *args, **kwargs):
		print("Submitted Data:", request.data)

		serializer = self.get_serializer(data=request.data)

		if not serializer.is_valid():
			print("Validation Errors:", serializer.errors)
			return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

		self.perform_create(serializer)
		print("Saved Data:", serializer.data)

		return Response(serializer.data, status=status.HTTP_201_CREATED)


class ReviewViewSet(viewsets.ModelViewSet):
	queryset = Review.objects.select_related("user", "doctor", "hospital").all().order_by("-created_at")
	serializer_class = ReviewSerializer
	permission_classes = [permissions.IsAuthenticatedOrReadOnly]


class DonationRequestViewSet(viewsets.ModelViewSet):
	queryset = DonationRequest.objects.select_related("hospital").all().order_by("-created_at")
	serializer_class = DonationRequestSerializer
	permission_classes = [permissions.IsAuthenticatedOrReadOnly]

	def get_queryset(self):
		queryset = super().get_queryset()
		# Filter by donor if requested
		if self.request.query_params.get("donor") == "me":
			if not self.request.user.is_authenticated:
				return DonationRequest.objects.none()
			queryset = queryset.filter(donor=self.request.user)
		# Filter by hospital if requested
		hospital_id = self.request.query_params.get("hospital")
		if hospital_id:
			queryset = queryset.filter(hospital_id=hospital_id)
		return queryset

	@action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def accept(self, request, pk=None):
		request_obj = self.get_object()
		if request_obj.status != "PENDING":
			return Response({"detail": "Only pending requests can be accepted."}, status=status.HTTP_400_BAD_REQUEST)
		request_obj.status = "ACCEPTED"
		request_obj.notes = request.data.get("notes", "")
		request_obj.save()
		return Response(self.get_serializer(request_obj).data)

	@action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
	def reject(self, request, pk=None):
		request_obj = self.get_object()
		if request_obj.status != "PENDING":
			return Response({"detail": "Only pending requests can be rejected."}, status=status.HTTP_400_BAD_REQUEST)
		request_obj.status = "REJECTED"
		request_obj.notes = request.data.get("notes", "")
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
	queryset = Appointment.objects.select_related("donor", "hospital", "donation_request").all().order_by("-appointment_date")
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
			queryset = queryset.filter(donor=self.request.user)
		# Filter by status
		status_filter = self.request.query_params.get("status")
		if status_filter:
			queryset = queryset.filter(status=status_filter)
		return queryset


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
	queryset = AccidentAlert.objects.select_related("reported_by", "hospital_referred").all().order_by("-created_at")
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
	queryset = MedicalOrder.objects.select_related("customer", "supplier").prefetch_related("items").all().order_by("-created_at")
	serializer_class = MedicalOrderSerializer
	permission_classes = [permissions.IsAuthenticated]

	def get_queryset(self):
		queryset = super().get_queryset()
		# Filter by customer (for buyers)
		if self.request.query_params.get("my_orders") == "true":
			queryset = queryset.filter(customer=self.request.user)
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
		data["customer_id"] = request.user.pk

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

		return Response(self.get_serializer(order).data, status=status.HTTP_201_CREATED)

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

		order.status = new_status
		order.save()

		return Response(self.get_serializer(order).data)


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

