import os
import django
import sys

sys.path.append(r'c:\live_saver_connect\backend')

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'lifesaver_backend.settings')
django.setup()

from core.models import DonationRequest, User, Hospital, Appointment

def debug_appointment(appt_id):
    try:
        appt = Appointment.objects.get(pk=appt_id)
        print(f"Appointment ID: {appt.id}")
        print(f"Status: {appt.status}")
        print(f"Hospital: {appt.hospital.name}")
    except Appointment.DoesNotExist:
        print(f"Appointment with ID {appt_id} does not exist.")

if __name__ == "__main__":
    debug_appointment(5)
    
    # Also list some appointments
    appts = Appointment.objects.all().order_by('id')[:10]
    print(f"\nExisting Appointment IDs: {[a.id for a in appts]}")
