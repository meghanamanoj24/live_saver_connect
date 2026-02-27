# import os
# from twilio.rest import Client
# import time

# account_sid = ""
# auth_token = ""
# from_number = ""

# print(f"--- Twilio Diagnostics for {account_sid} ---")

# try:
#     client = Client(account_sid, auth_token)
    
#     # 1. Check Account Status
#     account = client.api.accounts(account_sid).fetch()
#     print(f"Account Status: {account.status}")
#     print(f"Account Type: {account.type}")
    
#     # 2. List Verified Caller IDs
#     print("\n[Verified Caller IDs]")
#     caller_ids = client.outgoing_caller_ids.list()
#     verified_numbers = []
#     if not caller_ids:
#         print("NO VERIFIED NUMBERS FOUND!")
#     else:
#         for record in caller_ids:
#             print(f" - {record.phone_number} (Friendly: {record.friendly_name})")
#             verified_numbers.append(record.phone_number)
            
#     # 3. Try Calling Variants
#     print("\n[Testing Calls]")
    
#     # Variants to test
#     user_did = "108"
#     variants = [
#         f"+91{user_did}",      # Standard (108)
#         f"+910{user_did}",     # With zero (108)
#         f"{user_did}",         # Raw (108)
#     ]
    
#     # Also add exactly what was returned by the API
#     for vn in verified_numbers:
#         if vn not in variants:
#             variants.append(vn)
            
#     success = False
#     for num in variants:
#         print(f"Trying to call: {num} ... ", end="")
#         try:
#             call = client.calls.create(
#                 twiml='<Response><Say>Test call success.</Say></Response>',
#                 to=num,
#                 from_=from_number
#             )
#             print(f"SUCCESS! SID: {call.sid}")
#             print(f"!!! USE THIS NUMBER FORMAT: {num} !!!")
#             success = True
#             break
#         except Exception as e:
#             print(f"Failed.")
#             # print(f"  Error: {e}") # Keep output clean, we know it's likely verification error

#     if not success:
#         print("\nALL ATTEMPTS FAILED. Please ensure the number is verified in Twilio Console.")

# except Exception as e:
#     print(f"\nCRITICAL ERROR: {e}")
