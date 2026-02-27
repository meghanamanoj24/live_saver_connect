# import os
# from twilio.rest import Client

# # Twilio Settings (Hardcoded for debugging to ensure we use exactly what's in settings)
# account_sid = ""
# auth_token = ""

# try:
#     client = Client(account_sid, auth_token)

#     print(f"Checking verified numbers for Account: {account_sid}")
    
#     incoming_phone_numbers = client.incoming_phone_numbers.list()
#     print("\n--- Your Purchased Twilio Numbers (Outgoing) ---")
#     for number in incoming_phone_numbers:
#         print(f" - {number.phone_number} ({number.friendly_name})")

#     outgoing_caller_ids = client.outgoing_caller_ids.list()
#     print("\n--- Verified Caller IDs (Allowed to receive calls in Trial) ---")
#     if not outgoing_caller_ids:
#         print(" [!] NO VERIFIED CALLER IDS FOUND!")
#     for record in outgoing_caller_ids:
#         print(f" - {record.phone_number} ({record.friendly_name})")

# except Exception as e:
#     print(f"\n[Error] Failed to connect to Twilio: {e}")
