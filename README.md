LifeSaver Connect — Advanced Full-Stack Platform

Overview
LifeSaver Connect is a full-stack platform for:
- Emergency blood/platelet/organ donation
- Real-time emergency needs posting
- A secure medical supplies marketplace
- Hospital/doctor reviews

This repository provides:
- A Django + DRF backend schema (models and serializers)
- A Next.js landing page
- A comprehensive setup guide to create fully runnable environments (backend and frontend)

Tech Stack
- Frontend: Next.js (React) + Tailwind CSS
- Backend/API: Django + Django REST Framework (DRF) + JWT (SimpleJWT)
- Database: SQLite for development (PostgreSQL + PostGIS recommended for production)

Repository Layout
- backend/models.py — Core data models
- backend/serializers.py — DRF serializers for API exposure
- frontend/pages/index.jsx — Next.js landing page with navigation
- README.md — This file with end-to-end setup instructions

Prerequisites
- Node.js 18+ and npm (or pnpm/yarn)
- Python 3.10+ and pip
- Git (optional)

Backend Setup (Django + DRF + JWT)
1) Create and activate a virtual environment
Windows (PowerShell):
python -m venv .venv
.venv\\Scripts\\Activate.ps1

macOS/Linux (bash):
python3 -m venv .venv
source .venv/bin/activate

2) Install dependencies
pip install "Django>=5.0,<6.0" "djangorestframework>=3.15,<4.0" "djangorestframework-simplejwt>=5.3,<6.0" "django-cors-headers>=4.3,<5.0"

3) Create Django project and app
django-admin startproject lifesaver_backend
cd lifesaver_backend
python manage.py startapp core

4) Enable apps and middleware
Edit lifesaver_backend/settings.py:
- Add to INSTALLED_APPS: 'rest_framework', 'corsheaders', 'core'
- Add to MIDDLEWARE (top): 'corsheaders.middleware.CorsMiddleware'
- CORS (dev only): CORS_ALLOW_ALL_ORIGINS = True

5) Configure DRF + JWT (in settings.py)
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticatedOrReadOnly",
    ),
}

6) Copy models and serializers
- Replace core/models.py with backend/models.py from this repo
- Create core/serializers.py and paste backend/serializers.py from this repo

7) Create basic views and routes (quick start)
Create core/views.py (example minimal endpoints):
from rest_framework import viewsets, permissions
from .models import DonorProfile, EmergencyNeed, OrganDonor, MarketplaceItem, Hospital, Doctor, Review
from .serializers import (
    DonorProfileSerializer, EmergencyNeedSerializer, OrganDonorSerializer,
    MarketplaceItemSerializer, HospitalSerializer, DoctorSerializer, ReviewSerializer
)

class DonorProfileViewSet(viewsets.ModelViewSet):
    queryset = DonorProfile.objects.select_related("user").all()
    serializer_class = DonorProfileSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

class EmergencyNeedViewSet(viewsets.ModelViewSet):
    queryset = EmergencyNeed.objects.select_related("created_by").all().order_by("-created_at")
    serializer_class = EmergencyNeedSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

class OrganDonorViewSet(viewsets.ModelViewSet):
    queryset = OrganDonor.objects.select_related("user").all()
    serializer_class = OrganDonorSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

class MarketplaceItemViewSet(viewsets.ModelViewSet):
    queryset = MarketplaceItem.objects.select_related("seller").all().order_by("-created_at")
    serializer_class = MarketplaceItemSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

class HospitalViewSet(viewsets.ModelViewSet):
    queryset = Hospital.objects.all().order_by("name")
    serializer_class = HospitalSerializer
    permission_classes = [permissions.AllowAny]

class DoctorViewSet(viewsets.ModelViewSet):
    queryset = Doctor.objects.select_related("hospital").all().order_by("name")
    serializer_class = DoctorSerializer
    permission_classes = [permissions.AllowAny]

class ReviewViewSet(viewsets.ModelViewSet):
    queryset = Review.objects.select_related("user", "doctor", "hospital").all().order_by("-created_at")
    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

Create lifesaver_backend/urls.py routes:
from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from core.views import (
    DonorProfileViewSet, EmergencyNeedViewSet, OrganDonorViewSet, MarketplaceItemViewSet,
    HospitalViewSet, DoctorViewSet, ReviewViewSet
)
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

router = DefaultRouter()
router.register(r"donors", DonorProfileViewSet)
router.register(r"needs", EmergencyNeedViewSet)
router.register(r"organ-donors", OrganDonorViewSet)
router.register(r"marketplace", MarketplaceItemViewSet)
router.register(r"hospitals", HospitalViewSet)
router.register(r"doctors", DoctorViewSet)
router.register(r"reviews", ReviewViewSet)

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include(router.urls)),
    path("api/auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
]

8) Migrate and run
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver

Frontend Setup (Next.js + Tailwind)
1) Create app
In the repo root:
npx create-next-app@latest frontend --ts --eslint --src-dir=false --app=false --import-alias "@/*" --yes

2) Install Tailwind
cd frontend
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

Update tailwind.config.js:
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./pages/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
}

Update styles/globals.css:
@tailwind base;
@tailwind components;
@tailwind utilities;

3) Replace pages/index.(js|tsx)
- Replace frontend/pages/index.(js|tsx) with frontend/pages/index.jsx from this repo (rename if needed).

4) Run frontend
npm run dev
# open http://localhost:3000

Auth Flow (JWT)
- Obtain token: POST /api/auth/token/ with {"username": "...", "password": "..."}
- Use Authorization: Bearer <access_token> for protected endpoints
- Refresh token: POST /api/auth/token/refresh/

API Endpoints (examples)
- GET/POST /api/donors/
- GET/POST /api/needs/
- GET/POST /api/organ-donors/
- GET/POST /api/marketplace/
- GET/POST /api/hospitals/
- GET/POST /api/doctors/
- GET/POST /api/reviews/

Notes and Limitations
- Proximity Search: With SQLite, use city/zip_code filters only. For geospatial queries and radius search, switch to PostgreSQL + PostGIS and GeoDjango.
- Realtime Alerts: Integrate SMS/WhatsApp providers (e.g., Twilio). This repo does not include those credentials or code.
- Payments: For the marketplace, integrate Stripe/PayPal in production; this repo excludes payment flows by design.

Suggested Next Steps
- Add DRF permissions per endpoint (e.g., donors can update only their profile)
- Add pagination/filters (django-filter) for listing endpoints
- Add image upload for marketplace items (e.g., django-storages + S3)
- Add rate limiting and moderation for reviews

License
MIT (or update as desired)


