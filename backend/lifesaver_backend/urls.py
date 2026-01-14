from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from core.views import (
	DonorProfileViewSet,
	EmergencyNeedViewSet,
	OrganDonorViewSet,
	MarketplaceItemViewSet,
	HospitalViewSet,
	DoctorViewSet,
	ReviewViewSet,
	DonationRequestViewSet,
	HospitalNeedViewSet,
	AppointmentViewSet,
	DeceasedDonorRequestViewSet,
	AccidentAlertViewSet,
	BloodDonationEventViewSet,
	MedicalEssentialViewSet,
	MedicalStoreProductViewSet,
	MedicalEquipmentViewSet,
	MedicalOrderViewSet,
	RegisterUserView,
	CustomTokenObtainPairView,  # <-- Use custom login view
	MetricsOverviewView,
)

router = DefaultRouter()
router.register(r"donors", DonorProfileViewSet)
router.register(r"needs", EmergencyNeedViewSet)
router.register(r"organ-donors", OrganDonorViewSet)
router.register(r"marketplace", MarketplaceItemViewSet)
router.register(r"hospitals", HospitalViewSet)
router.register(r"doctors", DoctorViewSet)
router.register(r"reviews", ReviewViewSet)
router.register(r"donation-requests", DonationRequestViewSet)
router.register(r"hospital-needs", HospitalNeedViewSet)
router.register(r"appointments", AppointmentViewSet)
router.register(r"deceased-donor-requests", DeceasedDonorRequestViewSet)
router.register(r"accident-alerts", AccidentAlertViewSet)
router.register(r"blood-donation-events", BloodDonationEventViewSet)
router.register(r"medical-essential", MedicalEssentialViewSet)
router.register(r"medical-store-products", MedicalStoreProductViewSet)
router.register(r"medical-equipment", MedicalEquipmentViewSet)
router.register(r"medical-orders", MedicalOrderViewSet)

urlpatterns = [
	path("admin/", admin.site.urls),
	path("api/", include(router.urls)),
	path("api/metrics/overview/", MetricsOverviewView.as_view(), name="metrics_overview"),
	path("api/auth/register/", RegisterUserView.as_view(), name="register"),
	path("api/auth/token/", CustomTokenObtainPairView.as_view(), name="token_obtain_pair"),  # <-- Use custom login view
	path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
]

# Serve media files in development
if settings.DEBUG:
	urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)


