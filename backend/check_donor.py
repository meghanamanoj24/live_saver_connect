import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'lifesaver_backend.settings')
django.setup()

from core.models import OrganDonor, User

def check_donor(donor_id):
    try:
        donor = OrganDonor.objects.get(id=donor_id)
        user = donor.created_by
        print(f"Donor ID: {donor.id}")
        print(f"Status: {donor.status}")
        print(f"Created By: {user.email} (ID: {user.id})")
        
        # Test property behavior
        print(f"DEBUG: hasattr(user, 'hospital_profile') = {hasattr(user, 'hospital_profile')}")
        print(f"DEBUG: user.hospital_profile = {user.hospital_profile}")
        
        if user.hospital_profile:
            print(f"Hospital Name: {user.hospital_profile.name}")
        print(f"Accepted By: {donor.accepted_by_hospital}")
    except OrganDonor.DoesNotExist:
        print(f"OrganDonor with ID {donor_id} does not exist.")

if __name__ == "__main__":
    check_donor(4)
