# import os
# from twilio.rest import Client

# # Twilio Settings (Hardcoded to match settings.py)
# account_sid = ""
# auth_token = ""
# twilio_number = ""
# # The verified number found in previous step
# emergency_number = "" 

# print(f"Attempting to call {emergency_number} from {twilio_number}...")

# try:
#     client = Client(account_sid, auth_token)

#     call = client.calls.create(
#         twiml='<Response><Say>This is a test call from LifeSaver Connect.</Say></Response>',
#         to=emergency_number,
#         from_=twilio_number
#     )
    
#     print(f"Call initiated successfully! SID: {call.sid}")
#     print("Check your phone now!")

# except Exception as e:
#     print(f"\n[Error] Call failed: {e}")
