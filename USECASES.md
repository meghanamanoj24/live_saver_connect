# LifeSaver Connect - Use Cases Documentation

## 1. USE CASES

### 1.1 User Registration (Donor)
**Use Case ID:** LSC_UC01  
**Use Case Name:** User Registration as Donor  
**Date Created:** 13-01-2026  
**Description:** Allows new users to register as blood/organ donors  
**Primary Actor:** Guest  
**Precondition:** User is not logged in  
**Postcondition:** New donor account is created  
**Main Flow:**
1. User navigates to Registration page
2. System displays registration form
3. User enters first name, last name, email, password, blood group, gender, phone, and selects donor module
4. System validates input
5. System checks if email already exists
6. System creates new donor account
7. System redirects to login page

**Alternative Flow:**
- If email already exists, show error "Email already registered"
- If password and confirm password do not match, show error
- If required fields are missing, highlight errors
- If blood group is invalid, show error

---

### 1.2 Post Emergency Request
**Use Case ID:** LSC_UC02  
**Use Case Name:** Post Emergency Medical Request  
**Date Created:** 13-01-2026  
**Description:** Allows users to post critical emergency needs (blood, platelets, hospitalization)  
**Primary Actor:** Guest/Authenticated User  
**Precondition:** User can access emergency request page  
**Postcondition:** Emergency request is created and nearby hospitals are notified  
**Main Flow:**
1. User navigates to Emergency Request page
2. User clicks "Post Emergency Request" button
3. System displays emergency request form
4. User enters emergency type, patient condition, blood group (if applicable), city, contact phone
5. User optionally uploads patient poster/image
6. System detects user location (if permitted)
7. User submits the form
8. System validates input
9. System creates emergency need
10. System finds nearby hospitals/blood banks
11. System alerts nearest hospitals automatically
12. System displays success message with nearby hospital details

**Alternative Flow:**
- If location access denied, user can enter city manually
- If required fields are missing, show error
- If image upload fails, continue without image
- If no nearby hospitals found, show message to contact emergency helpline (112)

---

### 1.3 Hospital Equipment Need Posting
**Use Case ID:** LSC_UC03  
**Use Case Name:** Post Equipment Need  
**Date Created:** 13-01-2026  
**Description:** Allows hospitals to post equipment needs that can be fulfilled by suppliers  
**Primary Actor:** Hospital Admin (Authenticated)  
**Precondition:** User is logged in as hospital  
**Postcondition:** Equipment need is posted and visible to suppliers  
**Main Flow:**
1. Hospital admin navigates to Needs page
2. Admin clicks "Add Equipment Need" button
3. System displays equipment need form
4. Admin enters equipment name, type, quantity needed, description, needed by date
5. Admin submits the form
6. System validates input
7. System creates equipment need with status "OPEN"
8. System shows success message indicating suppliers can view and fulfill

**Alternative Flow:**
- If required fields are missing, show error
- If quantity is invalid (negative/zero), show error
- If date is in the past, show warning

---

### 1.4 Create Equipment Order
**Use Case ID:** LSC_UC04  
**Use Case Name:** Create Equipment Order  
**Date Created:** 13-01-2026  
**Description:** Allows hospitals to create orders from equipment needs to suppliers  
**Primary Actor:** Hospital Admin (Authenticated)  
**Precondition:** Hospital has posted equipment need  
**Postcondition:** Order is created and sent to supplier for approval  
**Main Flow:**
1. Hospital admin views equipment needs list
2. Admin clicks "Create Order" button on a need
3. System displays order creation form with supplier list
4. Admin selects supplier from verified suppliers
5. Admin enters quantity, unit price, currency, notes
6. Admin submits the form
7. System calculates total amount (quantity × unit_price)
8. System creates equipment order with status "PENDING"
9. System notifies supplier
10. System shows success message

**Alternative Flow:**
- If no suppliers available, show message to wait for suppliers
- If quantity exceeds need quantity, show warning
- If price is invalid, show error

---

### 1.5 Approve Equipment Order (Supplier)
**Use Case ID:** LSC_UC05  
**Use Case Name:** Approve Equipment Order and Create Invoice  
**Date Created:** 13-01-2026  
**Description:** Allows medical essential suppliers to approve orders and generate invoices  
**Primary Actor:** Medical Essential Supplier (Authenticated)  
**Precondition:** Supplier is logged in and has pending orders  
**Postcondition:** Order is approved, invoice is created, order status changes to "INVOICED"  
**Main Flow:**
1. Supplier navigates to their orders page
2. System displays pending orders
3. Supplier selects an order to approve
4. Supplier clicks "Approve" button
5. System validates order status is "PENDING"
6. System creates invoice automatically
7. System sets invoice date to current date
8. System generates invoice number
9. System sets order status to "INVOICED"
10. System displays invoice details with month extracted from date
11. System shows success message

**Alternative Flow:**
- If order is not pending, show error "Only pending orders can be approved"
- If order belongs to different supplier, show authorization error
- If invoice creation fails, show error and keep order as "APPROVED"

---

### 1.6 Mark Equipment as Sent
**Use Case ID:** LSC_UC06  
**Use Case Name:** Mark Equipment as Sent/Shipped  
**Date Created:** 13-01-2026  
**Description:** Allows suppliers to mark equipment as shipped to hospital  
**Primary Actor:** Medical Essential Supplier (Authenticated)  
**Precondition:** Order is approved/invoiced  
**Postcondition:** Order status changes to "SENT", sent_date is recorded  
**Main Flow:**
1. Supplier views approved/invoiced orders
2. Supplier selects an order
3. Supplier clicks "Mark as Sent" button
4. System validates order status is "INVOICED" or "APPROVED"
5. System updates order status to "SENT"
6. System records sent_date as current timestamp
7. System notifies hospital
8. System shows confirmation

**Alternative Flow:**
- If order is not in correct status, show error
- If marking fails, show error message

---

### 1.7 Mark Equipment as Received
**Use Case ID:** LSC_UC07  
**Use Case Name:** Mark Equipment as Received  
**Date Created:** 13-01-2026  
**Description:** Allows hospitals to confirm receipt of equipment  
**Primary Actor:** Hospital Admin (Authenticated)  
**Precondition:** Order status is "SENT"  
**Postcondition:** Order status changes to "RECEIVED", equipment need is fulfilled  
**Main Flow:**
1. Hospital admin views sent orders
2. Admin selects an order that has been delivered
3. Admin clicks "Mark as Received" button
4. System validates order status is "SENT"
5. System updates order status to "RECEIVED"
6. System records received_date as current timestamp
7. System updates related equipment need status to "FULFILLED"
8. System shows confirmation

**Alternative Flow:**
- If order is not sent, show error
- If marking fails, show error message

---

### 1.8 View Invoice/Receipt
**Use Case ID:** LSC_UC08  
**Use Case Name:** View Invoice and Receipt  
**Date Created:** 13-01-2026  
**Description:** Allows hospitals and suppliers to view invoice details with month from stored date  
**Primary Actor:** Hospital Admin / Medical Essential Supplier (Authenticated)  
**Precondition:** Order has been approved and invoice created  
**Postcondition:** Invoice details are displayed  
**Main Flow:**
1. User navigates to order details or invoice section
2. System displays invoice information
3. System shows invoice number, date, month (extracted from date via serialized method), total amount, tax, subtotal
4. User can view invoice as receipt/bill
5. System shows payment status

**Alternative Flow:**
- If invoice not found, show error
- If user not authorized, show error

---

### 1.9 Add Doctor Profile
**Use Case ID:** LSC_UC09  
**Use Case Name:** Add Doctor to Hospital  
**Date Created:** 13-01-2026  
**Description:** Allows hospitals to add doctors with NMC number, specialization, and charges  
**Primary Actor:** Hospital Admin (Authenticated)  
**Precondition:** User is logged in as hospital  
**Postcondition:** Doctor profile is created and visible to patients  
**Main Flow:**
1. Hospital admin navigates to Doctors page
2. Admin clicks "Add Doctor" button
3. System displays doctor registration form
4. Admin enters name, NMC number (required), specialization, qualifications, phone, email, consultation charge
5. Admin submits the form
6. System validates input (NMC number is required)
7. System creates doctor profile
8. System shows success message

**Alternative Flow:**
- If NMC number is missing, show error "NMC number is required"
- If email format is invalid, show error
- If consultation charge is negative, show error

---

### 1.10 Add Doctor Availability Schedule
**Use Case ID:** LSC_UC10  
**Use Case Name:** Add Doctor Availability Schedule  
**Date Created:** 13-01-2026  
**Description:** Allows hospitals to set doctor availability times for booking  
**Primary Actor:** Hospital Admin (Authenticated)  
**Precondition:** Doctor profile exists  
**Postcondition:** Availability schedule is added and visible to patients  
**Main Flow:**
1. Hospital admin views doctors list
2. Admin clicks "Add Availability" on a doctor
3. System displays availability form
4. Admin selects day of week (Monday-Sunday)
5. Admin enters start time and end time
6. Admin submits the form
7. System validates time slots do not overlap
8. System creates availability schedule
9. System shows success message

**Alternative Flow:**
- If time slot overlaps with existing schedule, show error
- If end time is before start time, show error
- If day is already scheduled, show warning

---

### 1.11 View Available Doctors (Patient)
**Use Case ID:** LSC_UC11  
**Use Case Name:** View Available Doctors at Hospital  
**Date Created:** 13-01-2026  
**Description:** Allows patients/donors to view available doctors with schedules and charges  
**Primary Actor:** Donor/Patient (Authenticated)  
**Precondition:** User is logged in, hospital is selected  
**Postcondition:** Doctor list with availability is displayed  
**Main Flow:**
1. User navigates to hospital selection page
2. User selects a registered hospital
3. System displays hospital details
4. System shows list of available doctors with:
   - Name, specialization, NMC number
   - Consultation charges
   - Availability schedule (days and times)
5. User can view doctor details

**Alternative Flow:**
- If no doctors available, show message
- If hospital not found, show error

---

### 1.12 Schedule Appointment
**Use Case ID:** LSC_UC12  
**Use Case Name:** Schedule Appointment with Doctor  
**Date Created:** 13-01-2026  
**Description:** Allows patients to book appointments with doctors  
**Primary Actor:** Donor/Patient (Authenticated)  
**Precondition:** User is logged in, doctor is available  
**Postcondition:** Appointment is created and visible to hospital  
**Main Flow:**
1. User views available doctors
2. User selects a doctor
3. System displays doctor availability schedule
4. User selects date and time slot
5. User submits appointment request
6. System validates date/time is in doctor's availability
7. System creates appointment with status "SCHEDULED"
8. System records appointment_date and appointment_time
9. System calculates charges based on doctor's consultation charge
10. System shows confirmation

**Alternative Flow:**
- If time slot is not available, show error
- If date is in the past, show error
- If appointment conflicts with existing appointment, show error

---

### 1.13 View Appointments (Hospital)
**Use Case ID:** LSC_UC13  
**Use Case Name:** View Appointments Dashboard  
**Date Created:** 13-01-2026  
**Description:** Allows hospitals to view all appointments with patient and doctor details  
**Primary Actor:** Hospital Admin (Authenticated)  
**Precondition:** User is logged in as hospital  
**Postcondition:** Appointment list is displayed  
**Main Flow:**
1. Hospital admin navigates to Appointments page
2. System loads all appointments for the hospital
3. System displays appointments showing:
   - Patient name and details
   - Doctor name and specialization
   - Appointment date and time
   - Status (Scheduled/Completed/Cancelled)
   - Charges
4. Admin can filter by status or date

**Alternative Flow:**
- If no appointments found, show empty state
- If loading fails, show error message

---

### 1.14 Approve/Reject Donation Request
**Use Case ID:** LSC_UC14  
**Use Case Name:** Approve or Reject Donation Request  
**Date Created:** 13-01-2026  
**Description:** Allows hospitals to approve or reject donor requests  
**Primary Actor:** Hospital Admin (Authenticated)  
**Precondition:** Hospital has pending donation requests  
**Postcondition:** Request status is updated, donor is notified  
**Main Flow:**
1. Hospital admin navigates to Requests page
2. System displays pending donation requests
3. Admin reviews request details (donor info, message, scheduled date)
4. Admin clicks "Accept" or "Reject" button
5. System validates request status is "PENDING"
6. System updates request status
7. If approved, system may create appointment automatically
8. If rejected, donor can reschedule
9. System shows confirmation

**Alternative Flow:**
- If request is not pending, show error
- If accepting fails, show error
- If rejecting, allow donor to select another date/time

---

### 1.15 Reschedule Appointment
**Use Case ID:** LSC_UC15  
**Use Case Name:** Reschedule Rejected Appointment  
**Date Created:** 13-01-2026  
**Description:** Allows donors to reschedule appointments after rejection  
**Primary Actor:** Donor/Patient (Authenticated)  
**Precondition:** Donation request was rejected  
**Postcondition:** New appointment date/time is selected  
**Main Flow:**
1. Donor views rejected requests
2. Donor clicks "Reschedule" button
3. System displays reschedule form
4. Donor selects new date and time
5. Donor submits reschedule request
6. System validates new date/time
7. System updates appointment with status "RESCHEDULED"
8. System shows confirmation

**Alternative Flow:**
- If date is invalid, show error
- If new time conflicts, show available alternatives

---

### 1.16 Add Patient Visit Record
**Use Case ID:** LSC_UC16  
**Use Case Name:** Record Patient/Donor Visit  
**Date Created:** 13-01-2026  
**Description:** Allows hospitals to track all patient visits with purpose, charges, and performance notes  
**Primary Actor:** Hospital Admin (Authenticated)  
**Precondition:** User is logged in as hospital  
**Postcondition:** Patient visit record is created  
**Main Flow:**
1. Hospital admin navigates to Donors & Patients page
2. Admin clicks "Add Visit" or similar action
3. System displays visit recording form
4. Admin selects patient (from donors or enters new)
5. Admin selects visit purpose (Blood Donation/Consultation/Operation/Checkup/Emergency/Follow-up)
6. Admin selects doctor (if applicable)
7. Admin enters visit date, charges, notes, performance notes
8. Admin submits the form
9. System creates patient visit record
10. System shows success message

**Alternative Flow:**
- If required fields are missing, show error
- If patient not found, allow creation of new record
- If doctor is not associated with hospital, show error

---

### 1.17 View Donors and Patients
**Use Case ID:** LSC_UC17  
**Use Case Name:** View Donors and Patients Dashboard  
**Date Created:** 13-01-2026  
**Description:** Displays all donors and patients with visit history and performance tracking  
**Primary Actor:** Hospital Admin (Authenticated)  
**Precondition:** User is logged in as hospital  
**Postcondition:** Donors and patients list with details is displayed  
**Main Flow:**
1. Hospital admin navigates to "Donors & Patients" page
2. System loads all patient visits and donor records
3. System displays:
   - Patient/Donor name and contact info
   - Visit purpose and date
   - Doctor consulted
   - Charges for each visit
   - Performance notes
   - Visit history summary
4. Admin can filter by purpose, date range, or doctor

**Alternative Flow:**
- If no records found, show empty state
- If URL is taken from donor page details, pre-filter by that donor

---

### 1.18 Create Hospital Event
**Use Case ID:** LSC_UC18  
**Use Case Name:** Create Hospital/Doctor/Nurse Event  
**Date Created:** 13-01-2026  
**Description:** Allows hospitals to create events (blood donation, doctor contribution, nurse events, celebrity events)  
**Primary Actor:** Hospital Admin (Authenticated)  
**Precondition:** User is logged in as hospital  
**Postcondition:** Event is created and visible to donors  
**Main Flow:**
1. Hospital admin navigates to Events page
2. Admin clicks "Create Event" button
3. System displays event creation form
4. Admin selects event type (Blood Donation/Hospital Event/Doctor Contribution/Nurse Event/Celebrity Event)
5. Admin enters title, description, event date, start/end time, location, address
6. Admin optionally selects doctors involved
7. Admin submits the form
8. System validates input
9. System creates event with status "UPCOMING"
10. System shows success message

**Alternative Flow:**
- If required fields are missing, show error
- If event date is in the past, show warning
- If location is invalid, show error

---

### 1.19 Add Event Report
**Use Case ID:** LSC_UC19  
**Use Case Name:** Add Event Report  
**Date Created:** 13-01-2026  
**Description:** Allows hospitals to add post-event reports and contributions summary  
**Primary Actor:** Hospital Admin (Authenticated)  
**Precondition:** Event has been completed  
**Postcondition:** Event report is added and displayed  
**Main Flow:**
1. Hospital admin views events list
2. Admin selects a completed event
3. Admin clicks "Add Report" or "Edit Event"
4. System displays event details form
5. Admin enters event report (summary, contributions, outcomes)
6. Admin optionally uploads event images
7. Admin submits the form
8. System updates event with report and images
9. System changes event status to "COMPLETED"
10. System shows success message

**Alternative Flow:**
- If event is not completed, show warning
- If image upload fails, continue without images

---

### 1.20 Add Staff Member
**Use Case ID:** LSC_UC20  
**Use Case Name:** Add Staff/Nurse/Working People  
**Date Created:** 13-01-2026  
**Description:** Allows hospitals to add staff members (nurses, technicians, admin, etc.) with specialization and details  
**Primary Actor:** Hospital Admin (Authenticated)  
**Precondition:** User is logged in as hospital  
**Postcondition:** Staff member is added to system  
**Main Flow:**
1. Hospital admin navigates to Staff page
2. Admin clicks "Add Staff" button
3. System displays staff registration form
4. Admin enters name, staff type (Nurse/Admin/Technician/Pharmacist/Lab Tech/Other)
5. Admin enters specialization, qualifications, phone, email, salary
6. Admin submits the form
7. System validates input
8. System creates staff profile with is_active=true
9. System shows success message

**Alternative Flow:**
- If required fields are missing, show error
- If email format is invalid, show error
- If salary is negative, show error

---

### 1.21 Set Staff Availability
**Use Case ID:** LSC_UC21  
**Use Case Name:** Set Staff Availability Schedule  
**Date Created:** 13-01-2026  
**Description:** Allows hospitals to set availability schedules for staff members  
**Primary Actor:** Hospital Admin (Authenticated)  
**Precondition:** Staff member exists  
**Postcondition:** Availability schedule is added  
**Main Flow:**
1. Hospital admin views staff list
2. Admin selects a staff member
3. Admin clicks "Add Availability"
4. System displays availability form
5. Admin selects day of week, start time, end time
6. Admin submits the form
7. System validates time slots
8. System creates availability schedule
9. System shows success message

**Alternative Flow:**
- If time slot conflicts, show error
- If day already scheduled, show warning

---

### 1.22 Record Attendance
**Use Case ID:** LSC_UC22  
**Use Case Name:** Record Staff Attendance  
**Date Created:** 13-01-2026  
**Description:** Allows hospitals to track staff attendance (check-in, check-out, leave)  
**Primary Actor:** Hospital Admin (Authenticated)  
**Precondition:** Staff member exists  
**Postcondition:** Attendance record is created  
**Main Flow:**
1. Hospital admin navigates to Staff/Attendance section
2. Admin clicks "Record Attendance"
3. System displays attendance form
4. Admin selects staff member and date
5. Admin records check-in time or marks as leave
6. If present, admin records check-out time
7. If on leave, admin selects leave type (Sick Leave/Casual Leave/etc.)
8. Admin adds notes if needed
9. Admin submits the form
10. System creates attendance record
11. System shows confirmation

**Alternative Flow:**
- If attendance already recorded for date, allow edit
- If check-out before check-in, show error
- If date is in future, show warning

---

### 1.23 Record Salary Payment
**Use Case ID:** LSC_UC23  
**Use Case Name:** Record Salary Payment Status  
**Date Created:** 13-01-2026  
**Description:** Allows hospitals to track salary payments to staff with month from stored date  
**Primary Actor:** Hospital Admin (Authenticated)  
**Precondition:** Staff member exists  
**Postcondition:** Salary payment record is created/updated  
**Main Flow:**
1. Hospital admin navigates to Staff/Salary section
2. Admin selects a staff member
3. Admin clicks "Record Salary Payment"
4. System displays salary payment form
5. Admin selects month and year (month extracted from payment date via serialized method)
6. Admin enters amount, payment date
7. Admin marks payment status (Paid/Pending)
8. Admin selects payment method (Bank Transfer/Cash/etc.)
9. Admin submits the form
10. System creates/updates salary payment record
11. System shows confirmation

**Alternative Flow:**
- If payment already recorded for month/year, allow update
- If amount is invalid, show error
- If payment date month doesn't match selected month, show warning

---

### 1.24 Performance Tracking with AI
**Use Case ID:** LSC_UC24  
**Use Case Name:** Track Staff Performance with AI Analysis  
**Date Created:** 13-01-2026  
**Description:** Allows AI-integrated performance tracking for staff with metrics and analysis  
**Primary Actor:** Hospital Admin (Authenticated)  
**Precondition:** Staff member exists with attendance data  
**Postcondition:** Performance record is created with AI analysis  
**Main Flow:**
1. Hospital admin navigates to Staff/Performance section
2. Admin selects a staff member
3. Admin clicks "Add Performance Record" or system auto-generates
4. System analyzes staff data (attendance, patient visits handled, etc.)
5. System calculates performance score (AI-generated)
6. System generates performance metrics (JSON format)
7. System generates AI analysis and recommendations
8. Admin can add notes
9. Admin submits the form
10. System creates performance tracking record
11. System displays performance score and AI recommendations

**Alternative Flow:**
- If insufficient data, show message "Need more data for accurate analysis"
- If AI analysis fails, show manual entry option
- If metrics calculation fails, show error

---

### 1.25 View Hospital Location
**Use Case ID:** LSC_UC25  
**Use Case Name:** View Hospital Location and Nearby Hospitals  
**Date Created:** 13-01-2026  
**Description:** Allows users to search and view hospitals by location  
**Primary Actor:** Guest/Authenticated User  
**Precondition:** None  
**Postcondition:** Hospital locations are displayed  
**Main Flow:**
1. User navigates to Location page
2. User enters city or coordinates (latitude/longitude)
3. User clicks "Search Nearby"
4. System searches hospitals by location
5. System displays nearby hospitals with:
   - Name, type, city, address
   - Phone number
   - Distance (if coordinates provided)
6. User can view hospital details or needs

**Alternative Flow:**
- If no hospitals found, show message
- If coordinates invalid, show error
- If city not found, show nearby cities

---

### 1.26 Login to Dashboard
**Use Case ID:** LSC_UC26  
**Use Case Name:** User Login  
**Date Created:** 13-01-2026  
**Description:** Allows registered users to login to their dashboard  
**Primary Actor:** Registered User  
**Precondition:** User has registered account  
**Postcondition:** User is logged in and redirected to dashboard  
**Main Flow:**
1. User navigates to Login page
2. System displays login form
3. User enters email, password, and selects donor module
4. User submits the form
5. System validates credentials
6. System checks donor module matches
7. System generates JWT tokens
8. System stores tokens in browser
9. System redirects to appropriate dashboard (Donor/Hospital/Medical Essential)

**Alternative Flow:**
- If email not found, show generic error "Invalid email or password"
- If password incorrect, show generic error
- If donor module doesn't match, show error "Donor module does not match"
- If token refresh fails, redirect to login

---

### 1.27 View Patient Visit History
**Use Case ID:** LSC_UC27  
**Use Case Name:** View Personal Visit History  
**Date Created:** 13-01-2026  
**Description:** Allows patients to view their own visit history at hospitals  
**Primary Actor:** Patient/Donor (Authenticated)  
**Precondition:** User is logged in  
**Postcondition:** Visit history is displayed  
**Main Flow:**
1. Patient navigates to their profile or visit history page
2. System loads patient visits filtered by current user
3. System displays visit history showing:
   - Hospital name
   - Visit purpose
   - Doctor consulted (if any)
   - Visit date
   - Charges paid
   - Performance notes (if shared)
4. Patient can filter by hospital or date range

**Alternative Flow:**
- If no visits found, show empty state
- If loading fails, show error

---

### 1.28 Filter Doctors by Availability
**Use Case ID:** LSC_UC28  
**Use Case Name:** Filter Available Doctors by Day and Time  
**Date Created:** 13-01-2026  
**Description:** Allows patients to find doctors available on specific days/times  
**Primary Actor:** Patient/Donor (Authenticated)  
**Precondition:** User is viewing hospital's doctors  
**Postcondition:** Available doctors are displayed  
**Main Flow:**
1. Patient selects a hospital
2. Patient views doctors list
3. Patient selects preferred day of week
4. System filters doctors with availability on that day
5. System displays available doctors with:
   - Time slots for selected day
   - Consultation charges
   - NMC number
6. Patient can select time slot to book

**Alternative Flow:**
- If no doctors available on selected day, show message
- If time slot is booked, show next available slot

---

### 1.29 Export Invoice as Receipt
**Use Case ID:** LSC_UC29  
**Use Case Name:** Export Invoice as Receipt/Bill  
**Date Created:** 13-01-2026  
**Description:** Allows users to view and download invoice as receipt for record keeping  
**Primary Actor:** Hospital Admin / Medical Essential Supplier (Authenticated)  
**Precondition:** Invoice exists for an order  
**Postcondition:** Invoice is displayed/downloaded as receipt  
**Main Flow:**
1. User views order with invoice
2. User clicks "View Invoice/Receipt" button
3. System displays invoice details:
   - Invoice number
   - Invoice date with month name (from serialized method)
   - Equipment details
   - Supplier and hospital information
   - Total amount, tax, subtotal
   - Payment status
4. User can download/print as PDF receipt
5. System generates receipt format

**Alternative Flow:**
- If invoice not found, show error
- If PDF generation fails, show invoice in HTML format

---

### 1.30 View Equipment Order Status
**Use Case ID:** LSC_UC30  
**Use Case Name:** Track Equipment Order Status  
**Date Created:** 13-01-2026  
**Description:** Allows hospitals to track order status from creation to delivery  
**Primary Actor:** Hospital Admin (Authenticated)  
**Precondition:** Equipment order exists  
**Postcondition:** Order status is displayed with timeline  
**Main Flow:**
1. Hospital admin views equipment needs
2. Admin views orders for a need
3. System displays order status timeline:
   - PENDING (Order created)
   - APPROVED (Supplier approved)
   - INVOICED (Invoice created)
   - SENT (Equipment shipped)
   - RECEIVED (Equipment delivered)
4. System shows dates for each status change
5. System shows invoice details if available
6. System shows sent_date and received_date when applicable

**Alternative Flow:**
- If order rejected, show rejection reason
- If status update fails, show error

---

### 1.31 View All Invoices (Supplier)
**Use Case ID:** LSC_UC31  
**Use Case Name:** View All Invoices (Shopkeeper Page)  
**Date Created:** 13-01-2026  
**Description:** Allows medical essential suppliers to view all invoices they've generated  
**Primary Actor:** Medical Essential Supplier (Authenticated)  
**Precondition:** Supplier is logged in and has created invoices  
**Postcondition:** All invoices are displayed  
**Main Flow:**
1. Supplier navigates to their invoices/orders page
2. System loads all invoices for supplier's orders
3. System displays invoices with:
   - Invoice number
   - Date and month (from serialized method)
   - Hospital name
   - Equipment details
   - Total amount
   - Payment status
4. Supplier can filter by date, payment status, or hospital
5. Supplier can view individual invoice details

**Alternative Flow:**
- If no invoices found, show empty state
- If loading fails, show error

---

### 1.32 View Equipment Needs (Supplier)
**Use Case ID:** LSC_UC32  
**Use Case Name:** View Equipment Needs from Hospitals  
**Date Created:** 13-01-2026  
**Description:** Allows suppliers to view all open equipment needs from hospitals  
**Primary Actor:** Medical Essential Supplier (Authenticated)  
**Precondition:** Supplier is logged in  
**Postcondition:** Equipment needs list is displayed  
**Main Flow:**
1. Supplier navigates to equipment needs/marketplace page
2. System loads all equipment needs with status "OPEN"
3. System displays needs showing:
   - Equipment name and type
   - Hospital name
   - Quantity needed
   - Description
   - Needed by date
4. Supplier can view details and create order to fulfill need

**Alternative Flow:**
- If no needs found, show message
- If need is already fulfilled, show status

---

### 1.33 Manage Hospital Profile
**Use Case ID:** LSC_UC33  
**Use Case Name:** Update Hospital Information  
**Date Created:** 13-01-2026  
**Description:** Allows hospitals to update their profile information  
**Primary Actor:** Hospital Admin (Authenticated)  
**Precondition:** Hospital account exists  
**Postcondition:** Hospital profile is updated  
**Main Flow:**
1. Hospital admin navigates to hospital settings/profile
2. System displays current hospital information
3. Admin updates fields (name, address, phone, coordinates, etc.)
4. Admin submits changes
5. System validates input
6. System updates hospital profile
7. System shows success message

**Alternative Flow:**
- If required fields are missing, show error
- If coordinates invalid, show error

---

### 1.34 View Donation Events
**Use Case ID:** LSC_UC34  
**Use Case Name:** View Upcoming Blood Donation Events  
**Date Created:** 13-01-2026  
**Description:** Allows donors to view upcoming blood donation events  
**Primary Actor:** Donor (Authenticated)  
**Precondition:** User is logged in as donor  
**Postcondition:** Events list is displayed  
**Main Flow:**
1. Donor navigates to events section or dashboard
2. System loads upcoming blood donation events
3. System displays events with:
   - Event title and type
   - Hospital name
   - Date, time, location
   - Blood groups needed
   - Registration count
4. Donor can register for events

**Alternative Flow:**
- If no events found, show message
- If event is past, show completed events

---

### 1.35 Admin Dashboard Overview
**Use Case ID:** LSC_UC35  
**Use Case Name:** View Hospital Dashboard Overview  
**Date Created:** 13-01-2026  
**Description:** Provides overview of all hospital activities in one dashboard  
**Primary Actor:** Hospital Admin (Authenticated)  
**Precondition:** User is logged in as hospital  
**Postcondition:** Dashboard with all sections is displayed  
**Main Flow:**
1. Hospital admin logs in
2. System redirects to hospital dashboard
3. System displays dashboard with navigation to:
   - Requests (pending approvals)
   - Needs (equipment and medical needs)
   - Doctors (doctor management)
   - Appointments (scheduled appointments)
   - Donors & Patients (visit tracking)
   - Events (hospital events)
   - Staff (workforce management)
   - Location (location search)
4. Admin can navigate to any section

**Alternative Flow:**
- If hospital data not found, show error and redirect to registration
- If sections fail to load, show error for that section only

---

**Document Version:** 1.0  
**Last Updated:** 13-01-2026  
**Total Use Cases:** 35
