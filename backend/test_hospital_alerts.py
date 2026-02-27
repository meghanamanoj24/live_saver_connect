import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'lifesaver_backend.settings')
django.setup()

from core.models import HospitalNeed, Hospital, User, DonorProfile
from core.utils_email import send_hospital_need_alert_email

def test_hospital_alerts():
    # 1. Setup matching donors
    donor_email = "matching_donor_hospital@example.com"
    donor, _ = User.objects.get_or_create(
        email=donor_email, 
        defaults={"role": "donor", "blood_group": "A+", "is_active": True}
    )
    DonorProfile.objects.update_or_create(user=donor, defaults={"city": "Kochi"})

    # 2. Setup hospital
    hospital_user, _ = User.objects.get_or_create(
        email="hospital_admin@example.com",
        defaults={"role": "hospital"}
    )
    hospital, _ = Hospital.objects.get_or_create(
        user=hospital_user,
        defaults={
            "name": "General Hospital Kochi",
            "city": "Kochi",
            "email": "hospital_admin@example.com"
        }
    )

    # 3. Create a hospital need
    need = HospitalNeed.objects.create(
        hospital=hospital,
        need_type="BLOOD",
        required_blood_group="A+",
        patient_details="Urgent A+ blood needed for surgery."
    )

    print(f"--- Testing Hospital matching ---")
    print(f"Need: {need.need_type} {need.required_blood_group} in {hospital.city}")
    
    # 4. Trigger email
    print("\n--- Testing Email Sending (Hospital) ---")
    sent_count = send_hospital_need_alert_email(need, hospital.email)
    print(f"Emails sent to {sent_count} donors.")

if __name__ == "__main__":
    test_hospital_alerts()
