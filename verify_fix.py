import os
import django
import sys

sys.path.append(r'c:\live_saver_connect\backend')

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'lifesaver_backend.settings')
django.setup()

from core.models import Appointment
from django.utils import timezone

def verify_appointment_arrival(appt_id):
    try:
        appt = Appointment.objects.get(pk=appt_id)
        print(f"Initial Status: {appt.status}")
        
        # Test arrival logic manually as if the API was called
        if appt.status in ["APPROVED", "SCHEDULED"]:
            appt.status = "ARRIVED"
            appt.confirmed_arrival_at = timezone.now()
            appt.save()
            print(f"Status Updated to: {appt.status}")
            print(f"Arrival Time: {appt.confirmed_arrival_at}")
        else:
            print("Appointment not in a state to be confirmed.")
            
    except Appointment.DoesNotExist:
        print(f"Appointment with ID {appt_id} does not exist.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    verify_appointment_arrival(5)
