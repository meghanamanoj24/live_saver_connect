import os
import django
import sys

# Add the project directory to sys.path
sys.path.append(r'c:\live_saver_connect\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'lifesaver_backend.settings')

from django.conf import settings
if not settings.configured:
    django.setup()

# Add testserver to ALLOWED_HOSTS if not present
if 'testserver' not in settings.ALLOWED_HOSTS:
    settings.ALLOWED_HOSTS.append('testserver')

from core.models import User, DonorProfile, PatientVisit, Hospital
from rest_framework.test import APIClient
from rest_framework import status

def verify_star_sync():
    # 1. Setup Donor with 0 stars
    email = "sync_donor@example.com"
    user, created = User.objects.get_or_create(
        email=email,
        defaults={"first_name": "Sync", "last_name": "Donor", "role": "donor"}
    )
    
    profile, _ = DonorProfile.objects.get_or_create(user=user)
    profile.current_stars = 0
    profile.save()
    
    # 2. Add historical donations
    hospital, _ = Hospital.objects.get_or_create(name="Sync Hospital", user=user)
    
    PatientVisit.objects.create(
        patient=user,
        hospital=hospital,
        visit_purpose="BLOOD_DONATION",
        visit_date="2024-01-01"
    )
    PatientVisit.objects.create(
        patient=user,
        hospital=hospital,
        visit_purpose="BLOOD_DONATION",
        visit_date="2024-02-01"
    )

    # Initialize API client
    client = APIClient()
    client.force_authenticate(user=user)

    print("Testing Star Sync via /api/donors/me/...")
    response = client.get("/api/donors/me/")
    if response.status_code == status.HTTP_200_OK:
        data = response.json()
        print(f"Stars in response: {data.get('current_stars')}")
        if data.get('current_stars') == 2:
            print("SUCCESS: Stars synchronized with historical donations!")
        else:
            print(f"FAILURE: Stars not synchronized. Expected 2, got {data.get('current_stars')}")
    else:
        print(f"Error: {response.status_code}")

if __name__ == "__main__":
    verify_star_sync()
