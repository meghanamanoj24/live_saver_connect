import os
import django
import sys

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'lifesaver_backend.settings')
django.setup()

from django.test import override_settings
from core.models import User, DonationRequest, Hospital
from rest_framework.test import APIClient
from django.urls import reverse

@override_settings(ALLOWED_HOSTS=['testserver'])
def verify_deletion():
    client = APIClient()
    
    # 1. Create a donor user
    donor, _ = User.objects.get_or_create(
        email="test_donor_delete@example.com", 
        defaults={"role": "donor", "is_active": True, "password": "password123"}
    )
    
    # 2. Create a hospital
    hospital_user, _ = User.objects.get_or_create(
        email="test_hospital_delete@example.com",
        defaults={"role": "hospital", "is_active": True, "password": "password123"}
    )
    hospital, _ = Hospital.objects.get_or_create(
        name="Test Hospital Deletion",
        defaults={"user": hospital_user, "email": hospital_user.email}
    )
    
    # 3. Create a DonationRequest
    request_obj = DonationRequest.objects.create(
        donor=donor,
        hospital=hospital,
        status="PENDING",
        request_type="BLOOD"
    )
    request_id = request_obj.id
    print(f"Created pending donation request ID: {request_id}")
    
    # 4. Try to delete as different user (Unauthorized)
    client.force_authenticate(user=hospital_user)
    response = client.delete(f"/api/donation-requests/{request_id}/")
    if response.status_code == 403:
        print("PASS: Hospital user cannot delete donor's request (403 Forbidden)")
    else:
        print(f"FAIL: Expected 403 but got {response.status_code}")
        return False

    # 5. Delete as the donor (Authorized)
    client.force_authenticate(user=donor)
    response = client.delete(f"/api/donation-requests/{request_id}/")
    if response.status_code == 204:
        print("PASS: Donor successfully deleted their own pending request (204 No Content)")
    else:
        print(f"FAIL: Expected 204 but got {response.status_code}")
        # print(response.data)
        return False
        
    # 6. Verify record is gone from DB
    exists = DonationRequest.objects.filter(id=request_id).exists()
    if not exists:
        print("PASS: Record successfully removed from database")
    else:
        print("FAIL: Record still exists in database")
        return False
    
    # Cleanup
    donor.delete()
    hospital_user.delete()
    hospital.delete()
    
    return True

if __name__ == "__main__":
    if verify_deletion():
        print("\nVerification SUCCESSFUL")
        sys.exit(0)
    else:
        print("\nVerification FAILED")
        sys.exit(1)
