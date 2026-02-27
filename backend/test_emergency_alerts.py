import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'lifesaver_backend.settings')
django.setup()

from core.models import EmergencyNeed, User
from core.utils_email import send_emergency_alert_email, get_compatible_donor_emails
from django.contrib.auth import get_user_model

def test_matching():
    MyUser = get_user_model()
    # Create some test donors
    d1, _ = MyUser.objects.get_or_create(email="donor1@test.com", defaults={"role": "donor", "blood_group": "O-", "is_active": True})
    d2, _ = MyUser.objects.get_or_create(email="donor2@test.com", defaults={"role": "donor", "blood_group": "A+", "is_active": True})
    
    print("\n--- Testing Blood Matching ---")
    # Patient stay in TestCity
    # Patient needs A+
    emails = get_compatible_donor_emails("A+")
    print(f"Donors who can donate to A+: {emails}")
    # Should include donor1@test.com (O-) and donor2@test.com (A+)
    
    # Create a dummy emergency need
    emergency_user, _ = MyUser.objects.get_or_create(email="emergency_anonymous_test@test.local", defaults={"role": "donor", "is_active": False})
    
    need = EmergencyNeed(
        title="Urgent A+ Blood Needed",
        need_type="BLOOD",
        required_blood_group="A+",
        city="TestCity",
        contact_phone="1234567890",
        created_by=emergency_user
    )
    need.save()
    
    # Ensure TestCity matches
    # Create profile for d2 if not exists
    from core.models import DonorProfile
    p1, _ = DonorProfile.objects.get_or_create(user=d1, defaults={"city": "TestCity"})
    p2, _ = DonorProfile.objects.get_or_create(user=d2, defaults={"city": "TestCity"})
    
    print("\n--- Testing Email Sending (Console Output) ---")
    count = send_emergency_alert_email(need)
    print(f"\nEmails sent to {count} donors.")
    
    # Cleanup
    need.delete()

if __name__ == "__main__":
    test_matching()
