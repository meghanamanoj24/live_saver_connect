"""
Blood/Platelet compatibility maps and donor email utilities.
"""
from django.contrib.auth import get_user_model
from django.conf import settings
User = get_user_model()

# Blood compatibility: which donor groups can a patient with group X receive from?
BLOOD_RECEIVE_COMPATIBILITY = {
    "O-": ["O-"],
    "O+": ["O-", "O+"],
    "A-": ["O-", "A-"],
    "A+": ["O-", "O+", "A-", "A+"],
    "B-": ["O-", "B-"],
    "B+": ["O-", "O+", "B-", "B+"],
    "AB-": ["O-", "A-", "B-", "AB-"],
    "AB+": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
}

# Platelet compatibility: Who can a patient with group X receive platelets/plasma from?
# Based on Image 2 Column 3
PLATELET_RECEIVE_COMPATIBILITY = {
    "O-": ["O-", "O+"],
    "O+": ["O-", "O+"],
    "A-": ["A-", "A+", "O-", "O+", "AB-", "AB+"],
    "A+": ["A-", "A+", "O-", "O+", "AB-", "AB+"],
    "B-": ["B-", "B+", "O-", "O+", "AB-", "AB+"],
    "B+": ["B-", "B+", "O-", "O+", "AB-", "AB+"],
    "AB-": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
    "AB+": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
}


def get_compatible_donor_emails(blood_group, need_type="BLOOD", city=None, organ_type=None):
    """
    Get emails of compatible donors for a given blood group and need type.
    """
    if not blood_group:
        return []

    if need_type == "ORGAN":
        # For organ donations, return committed organ donors in the city
        from .models import OrganDonor
        qs = OrganDonor.objects.filter(status="COMMITTED")
        if city:
            qs = qs.filter(city__icontains=city)
        if organ_type:
            qs = qs.filter(organs__icontains=organ_type)
        if blood_group:
            # Match compatible blood groups for organs if specified
            compat_map = BLOOD_RECEIVE_COMPATIBILITY
            compatible_groups = compat_map.get(blood_group, [])
            if compatible_groups:
                qs = qs.filter(blood_group__in=compatible_groups)
        return list(qs.values_list("created_by__email", flat=True))

    # Blood or platelet compatibility
    compat_map = BLOOD_RECEIVE_COMPATIBILITY if need_type == "BLOOD" else PLATELET_RECEIVE_COMPATIBILITY
    compatible_groups = compat_map.get(blood_group, [])

    if not compatible_groups:
        return []

    qs = User.objects.filter(blood_group__in=compatible_groups, is_active=True)
    if city:
        qs = qs.filter(donor_profile__city__icontains=city)
    return list(qs.values_list("email", flat=True))

def send_emergency_alert_email(emergency_need):
    """
    Sends emergency email alerts to all compatible donors individually.
    """
    blood_group = emergency_need.required_blood_group
    need_type = emergency_need.need_type
    city = emergency_need.city
    organ_type = emergency_need.organ_type
    
    subject = f"🔴 EMERGENCY: {emergency_need.title} in {city}"
    
    # Message template for generic emergency requests
    message_template = f"""
    URGENT EMERGENCY ALERT
    
    A critical need has been posted on LifeSaver Connect that matches your profile.
    
    Need Type: {need_type}
    Required blood_group: {blood_group if blood_group else 'Any / Organ'}
    Location: {city}
    Contact Phone: {emergency_need.contact_phone}
    
    Description:
    {emergency_need.description}
    
    Please respond immediately if you can help. You can view the request and accept it here:
    http://localhost:3000/needs/post
    
    Thank you for being a LifeSaver!
    
    ---
    Sent from: hospitalemergency1234@gmail.com
    """
    
    return _send_matching_emails(
        blood_group=blood_group,
        need_type=need_type,
        city=city,
        organ_type=organ_type,
        subject=subject,
        message_body=message_template,
        from_email=settings.EMAIL_HOST_USER # This is hospitalemergency1234@gmail.com
    )

def send_hospital_need_alert_email(hospital_need, from_email):
    print(f"======send_hospital_need_alert_email")
    """
    Sends email alerts for needs posted by a specific hospital.
    The 'from_email' is the hospital's registered email.
    """
    blood_group = hospital_need.required_blood_group
    need_type = hospital_need.need_type
    city = hospital_need.hospital.city
    hospital_name = hospital_need.hospital.name
    urgency = hospital_need.status
    needed_by = hospital_need.needed_by.strftime("%Y-%m-%d %H:%M") if hospital_need.needed_by else "As soon as possible"
    
    subject = f"{'🚨 URGENT ' if urgency == 'URGENT' else ''}🏥 HOSPITAL NEED: {need_type} request from {hospital_name}"
    
    message_template = f"""
    HOSPITAL ASSISTANCE REQUEST
    
    {hospital_name} has posted a new {need_type} requirement that matches your profile.
    
    --------------------------------------------------
    📌 CAUSE: {need_type} - {hospital_need.patient_details if hospital_need.patient_details else 'Medical Requirement'}
    🚑 URGENCY: {urgency}
    📅 REQUIRED BY: {needed_by}
    📍 LOCATION: {city} ({hospital_need.hospital.address if hospital_need.hospital.address else hospital_name})
    📞 CONTACT: {hospital_need.hospital.phone if hospital_need.hospital.phone else 'Directly at hospital'}
    --------------------------------------------------
    
    You can view and respond to this hospital need here:
    http://localhost:3000/donor/{"platelets" if need_type == "PLATELETS" else "organ" if need_type == "ORGAN" else "blood"}
    
    Thank you for your life-saving support!
    
    ---
    Sent from: {from_email} (LifeSaver Connect Hospital Portal)
    """
    
    return _send_matching_emails(
        blood_group=blood_group,
        need_type=need_type,
        city=city,
        subject=subject,
        message_body=message_template,
        from_email=from_email
    )

def _send_matching_emails(blood_group, need_type, city, subject, message_body, from_email, organ_type=None):
    """
    Helper function to find matching donors and send individual emails.
    """
    from django.core.mail import send_mail
    
    donor_emails = get_compatible_donor_emails(blood_group, need_type, city, organ_type)

    from_email = from_email or settings.DEFAULT_FROM_EMAIL
    
    if not donor_emails:
        return 0
        
    sent_count = 0
    try:
        send_mail(
            subject,
            message_body,
            from_email,
            donor_emails,
            fail_silently=False,
        )
        sent_count += 1
    except Exception as e:
        print(f"Failed to send email to donor list: {str(e)}")
            
    return sent_count
