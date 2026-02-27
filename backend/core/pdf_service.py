import io
import secrets
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.pdfencrypt import StandardEncryption

def generate_secure_health_report(donor_data, password="", watermark_text=None):
    """
    Generates a secure PDF health report with optional watermark.
    donor_data: dict containing donor details
    password: optional string for user password (default is empty)
    watermark_text: optional blockchain metadata for watermark
    """
    buffer = io.BytesIO()
    
    # Define encryption with STRICT restrictions: 
    # canPrint=0, canModify=0, canCopy=0, canAnnotate=0
    # strength=128 for strong encryption
    encryption = StandardEncryption(
        userPassword=password,
        ownerPassword=secrets.token_urlsafe(32),
        canPrint=0,
        canModify=0,
        canCopy=0,
        canAnnotate=0,
        strength=128
    )
    
    # Create the canvas
    c = canvas.Canvas(buffer, pagesize=A4, encrypt=encryption)
    width, height = A4
    margin = 20 * mm

    # --- Watermark Function ---
    def draw_watermark(canv, text):
        if not text:
            return
        canv.saveState()
        canv.setFont("Helvetica-Bold", 45)
        canv.setStrokeColor(colors.lightgrey, alpha=0.3)
        canv.setFillColor(colors.lightgrey, alpha=0.3)
        
        # Center of the page
        cx, cy = width / 2, height / 2
        
        # Diagonal orientation
        canv.translate(cx, cy)
        canv.rotate(45)
        canv.drawCentredString(0, 0, text)
        
        # Add smaller ones at top/bottom corners
        canv.setFont("Helvetica", 12)
        canv.drawCentredString(0, 150, text)
        canv.drawCentredString(0, -150, text)
        
        canv.restoreState()

    # --- Background & Border ---
    c.setFillColor(colors.white)
    c.rect(0, 0, width, height, fill=1)

    # Draw initial watermark on first page (Visible after background)
    draw_watermark(c, watermark_text)
    
    c.setStrokeColor(colors.HexColor("#E91E63"))
    c.setLineWidth(1)
    c.rect(margin, margin, width - 2*margin, height - 2*margin, stroke=1)
    
    # --- Header ---
    c.setFillColor(colors.HexColor("#1A1A2E"))
    c.rect(margin, height - margin - 40*mm, width - 2*margin, 40*mm, fill=1)
    
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 24)
    c.drawString(margin + 10*mm, height - margin - 20*mm, "LIFESAVER CONNECT")
    
    c.setFont("Helvetica-Bold", 14)
    c.setFillColor(colors.HexColor("#E91E63"))
    c.drawString(margin + 10*mm, height - margin - 30*mm, "SECURED HEALTH STATUS REPORT")
    
    c.setFont("Helvetica", 10)
    c.setFillColor(colors.white)
    report_id = f"HR-{datetime.now().strftime('%Y%m%d%H%M')}"
    c.drawRightString(width - margin - 10*mm, height - margin - 20*mm, f"Report ID: #{report_id}")
    c.drawRightString(width - margin - 10*mm, height - margin - 30*mm, f"Date: {datetime.now().strftime('%d-%m-%Y')}")
    
    y_pos = height - margin - 55*mm
    
    # --- Donor Information ---
    c.setFillColor(colors.HexColor("#1A1A2E"))
    c.setFont("Helvetica-Bold", 16)
    c.drawString(margin + 10*mm, y_pos, "I. DONOR INFORMATION")
    
    c.setStrokeColor(colors.lightgrey)
    c.setLineWidth(0.5)
    c.line(margin + 10*mm, y_pos - 3*mm, width - margin - 10*mm, y_pos - 3*mm)
    
    y_pos -= 15*mm
    c.setFont("Helvetica", 11)
    c.setFillColor(colors.HexColor("#3C3C3C"))
    
    details = [
        ("Name", donor_data.get('name', 'N/A')),
        ("Email", donor_data.get('email', 'N/A')),
        ("Blood Group", donor_data.get('blood_group', 'N/A')),
        ("Age", f"{donor_data.get('age', 'N/A')} years"),
        ("Weight", f"{donor_data.get('weight', 'N/A')} kg"),
        ("Health Score", f"{donor_data.get('health_score', 'N/A')}/100"),
    ]
    
    for label, value in details:
        c.setFont("Helvetica-Bold", 11)
        c.drawString(margin + 15*mm, y_pos, f"{label}:")
        c.setFont("Helvetica", 11)
        c.drawString(margin + 60*mm, y_pos, str(value))
        y_pos -= 8*mm
        
    y_pos -= 10*mm
    
    # --- Health Status ---
    c.setFillColor(colors.HexColor("#1A1A2E"))
    c.setFont("Helvetica-Bold", 16)
    c.drawString(margin + 10*mm, y_pos, "II. HEALTH ASSESSMENT")
    c.line(margin + 10*mm, y_pos - 3*mm, width - margin - 10*mm, y_pos - 3*mm)
    
    y_pos -= 15*mm
    c.setFont("Helvetica-Bold", 12)
    status_text = "ELIGIBLE FOR DONATION" if donor_data.get('can_donate') else "NOT ELIGIBLE FOR DONATION"
    status_color = colors.green if donor_data.get('can_donate') else colors.red
    c.setFillColor(status_color)
    c.drawString(margin + 15*mm, y_pos, f"STATUS: {status_text}")
    
    y_pos -= 10*mm
    c.setFillColor(colors.black)
    c.setFont("Helvetica", 10)
    recommendation = donor_data.get('recommendation', '')
    text_obj = c.beginText(margin + 15*mm, y_pos)
    text_obj.setFont("Helvetica", 10)
    for line in recommendation.split('\n'):
        text_obj.textLine(line)
    c.drawText(text_obj)
    
    # --- Helpful Resources ---
    y_pos -= 40*mm
    c.setFillColor(colors.HexColor("#1A1A2E"))
    c.setFont("Helvetica-Bold", 16)
    c.drawString(margin + 10*mm, y_pos, "III. HELPFUL RESOURCES")
    c.line(margin + 10*mm, y_pos - 3*mm, width - margin - 10*mm, y_pos - 3*mm)
    
    y_pos -= 12*mm
    resources = [
        ("• Pre-Donation Tips:", "Eat iron-rich foods, stay hydrated, and get enough sleep (8-9 hours)."),
        ("• Post-Donation Care:", "Drink plenty of fluids, avoid strenuous activity for 24 hours."),
        ("• Emergency Contact:", "In case of post-donation discomfort, contact your local blood center immediately."),
        ("• Useful Links:", "Visit lifesaver.connect/resources for dietary guides and health tips.")
    ]
    
    for title, desc in resources:
        c.setFont("Helvetica-Bold", 10)
        c.drawString(margin + 15*mm, y_pos, title)
        y_pos -= 5*mm
        c.setFont("Helvetica", 9)
        c.drawString(margin + 15*mm, y_pos, desc)
        y_pos -= 7*mm
        
    # --- Footer ---
    c.setFont("Helvetica-Oblique", 8)
    c.setFillColor(colors.grey)
    c.drawCentredString(width/2, margin + 8*mm, "This document is SECURED. Copying, editing, and printing are prohibited.")
    c.drawCentredString(width/2, margin + 4*mm, "Generated by LifeSaver Connect - Trusted Donor Management")
    
    c.showPage()
    c.save()
    
    buffer.seek(0)
    return buffer

def generate_secure_organ_pledge_report(donor_data, password="", watermark_text=None):
    """
    Generates a secure PDF organ pledge report with watermarking.
    """
    buffer = io.BytesIO()
    
    encryption = StandardEncryption(
        userPassword=password,
        ownerPassword=secrets.token_urlsafe(32),
        canPrint=0,
        canModify=0,
        canCopy=0,
        canAnnotate=0,
        strength=128
    )
    
    c = canvas.Canvas(buffer, pagesize=A4, encrypt=encryption)
    width, height = A4
    margin = 20 * mm

    # Watermark Helper
    def draw_watermark(canv, text):
        if not text:
            return
        canv.saveState()
        canv.setFont("Helvetica-Bold", 40)
        canv.setStrokeColor(colors.lightpink, alpha=0.2)
        canv.setFillColor(colors.lightpink, alpha=0.2)
        
        # Center of the page
        cx, cy = width / 2, height / 2
        
        # Diagonal orientation
        canv.translate(cx, cy)
        canv.rotate(45)
        canv.drawCentredString(0, 0, text)
        canv.restoreState()

    c.setFillColor(colors.white)
    c.rect(0, 0, width, height, fill=1)
    
    draw_watermark(c, watermark_text)

    # Border
    c.setStrokeColor(colors.HexColor("#E91E63"))
    c.setLineWidth(1)
    c.rect(margin, margin, width - 2*margin, height - 2*margin, stroke=1)
    
    # Header
    c.setFillColor(colors.HexColor("#1A1A2E"))
    c.rect(margin, height - margin - 40*mm, width - 2*margin, 40*mm, fill=1)
    
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 22)
    c.drawString(margin + 10*mm, height - margin - 20*mm, "SECURE ORGAN PLEDGE REGISTRY")
    
    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(colors.HexColor("#E91E63"))
    c.drawString(margin + 10*mm, height - margin - 30*mm, "LIFESAVER CONNECT BLOCKCHAIN RECORD")
    
    c.setFont("Helvetica", 10)
    c.setFillColor(colors.white)
    c.drawRightString(width - margin - 10*mm, height - margin - 20*mm, f"Pledge ID: #{donor_data.get('id', 'N/A')}")
    c.drawRightString(width - margin - 10*mm, height - margin - 30*mm, f"Date: {datetime.now().strftime('%d-%m-%Y')}")
    
    y_pos = height - margin - 60*mm
    
    # Donor Info
    c.setFillColor(colors.HexColor("#1A1A2E"))
    c.setFont("Helvetica-Bold", 16)
    c.drawString(margin + 10*mm, y_pos, "I. PLEDGOR INFORMATION")
    c.line(margin + 10*mm, y_pos - 3*mm, width - margin - 10*mm, y_pos - 3*mm)
    y_pos -= 15*mm
    
    details = [
        ("Full Name", donor_data.get('name', 'N/A')),
        ("Blood Group", donor_data.get('blood_group', 'N/A')),
        ("Date of Birth", str(donor_data.get('date_of_birth', 'N/A'))),
        ("Phone", donor_data.get('phone', 'N/A')),
        ("Emergency Contact", f"{donor_data.get('emergency_contact_name', 'N/A')} ({donor_data.get('emergency_contact_phone', 'N/A')})"),
    ]
    
    for label, value in details:
        c.setFont("Helvetica-Bold", 11)
        c.setFillColor(colors.black)
        c.drawString(margin + 15*mm, y_pos, f"{label}:")
        c.setFont("Helvetica", 11)
        c.setFillColor(colors.HexColor("#3C3C3C"))
        c.drawString(margin + 60*mm, y_pos, str(value))
        y_pos -= 8*mm
        
    y_pos -= 10*mm
    
    # Pledge Details
    c.setFillColor(colors.HexColor("#1A1A2E"))
    c.setFont("Helvetica-Bold", 16)
    c.drawString(margin + 10*mm, y_pos, "II. PLEDGE COMMITMENT")
    c.line(margin + 10*mm, y_pos - 3*mm, width - margin - 10*mm, y_pos - 3*mm)
    y_pos -= 15*mm
    
    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(colors.HexColor("#E91E63"))
    c.drawString(margin + 15*mm, y_pos, f"Organs Pledged: {donor_data.get('organs', 'All Viable Organs')}")
    y_pos -= 10*mm
    
    c.setFont("Helvetica", 10)
    c.setFillColor(colors.black)
    c.drawString(margin + 15*mm, y_pos, "I hereby pledge to donate the above-mentioned organs/tissues for therapeutic purposes")
    y_pos -= 5*mm
    c.drawString(margin + 15*mm, y_pos, "after my death. I request my family to respect and honor this wish.")
    
    # Footer
    c.setFont("Helvetica-Oblique", 8)
    c.setFillColor(colors.grey)
    c.drawCentredString(width/2, margin + 8*mm, "This document is verified and secured by Blockchain Integrity Ledger.")
    c.drawCentredString(width/2, margin + 4*mm, "Modification, Copying, or Printing is strictly prohibited.")

    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer
