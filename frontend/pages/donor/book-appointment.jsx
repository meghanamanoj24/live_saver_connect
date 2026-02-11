import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import { useState, useEffect } from "react"
import { apiFetch } from "../../lib/api"

export default function BookAppointment() {
    const router = useRouter()
    const { hospitalId } = router.query
    const [hospitals, setHospitals] = useState([])
    const [doctors, setDoctors] = useState([])
    const [loading, setLoading] = useState(true)
    const [showInvoice, setShowInvoice] = useState(null)
    const [showPrescription, setShowPrescription] = useState(null)
    const [submitting, setSubmitting] = useState(false)
    const [appointments, setAppointments] = useState([])
    const [actionLoading, setActionLoading] = useState(null)
    const [formData, setFormData] = useState({
        hospital_id: hospitalId || "",
        doctor_id: "",
        appointment_date: "",
        appointment_time: "",
        notes: "",
    })

    useEffect(() => {
        loadHospitals()
        loadAppointments()
    }, [])

    useEffect(() => {
        if (formData.hospital_id) {
            loadDoctors(formData.hospital_id)
        } else {
            setDoctors([])
        }
    }, [formData.hospital_id])

    async function loadHospitals() {
        try {
            const data = await apiFetch("/hospitals/?registered_only=true")
            setHospitals(data)
            if (hospitalId) {
                setFormData(prev => ({ ...prev, hospital_id: hospitalId }))
            }
        } catch (error) {
            console.error("Error loading hospitals:", error)
        } finally {
            setLoading(false)
        }
    }

    async function loadDoctors(hospitalPk) {
        try {
            const data = await apiFetch(`/doctors/?hospital=${hospitalPk}`)
            setDoctors(data)
        } catch (error) {
            console.error("Error loading doctors:", error)
        }
    }

    async function loadAppointments() {
        try {
            const data = await apiFetch("/appointments/?donor=me")
            setAppointments(data)
        } catch (error) {
            console.error("Error loading appointments:", error)
        }
    }

    async function handleConfirmSlot(id) {
        setActionLoading(id)
        try {
            await apiFetch(`/appointments/${id}/confirm_slot/`, { method: "POST" })
            await loadAppointments()
            alert("Slot confirmed! Your appointment is now scheduled.")
        } catch (error) {
            alert(error.message || "Failed to confirm slot.")
        } finally {
            setActionLoading(null)
        }
    }

    async function handlePayFee(id) {
        const method = prompt("Enter payment method (e.g., Credit Card, UPI, Demo):", "Demo Payment")
        if (!method) return

        setActionLoading(id)
        try {
            const data = await apiFetch(`/appointments/${id}/pay_fee/`, {
                method: "POST",
                body: JSON.stringify({ payment_method: method })
            })
            await loadAppointments()
            alert(`Payment Successful! Your invoice has been generated.`)
            setShowInvoice(data)
        } catch (error) {
            alert(error.message || "Failed to process payment.")
        } finally {
            setActionLoading(null)
        }
    }

    async function handleDeclineAppointment(id) {
        setActionLoading(id)
        try {
            await apiFetch(`/appointments/${id}/decline/`, { method: "POST" })
            await loadAppointments()
            alert("Appointment declined.")
        } catch (error) {
            alert(error.message || "Failed to decline appointment.")
        } finally {
            setActionLoading(null)
        }
    }

    async function handleMarkReaching(id) {
        setActionLoading(id)
        try {
            await apiFetch(`/appointments/${id}/mark_reaching/`, { method: "POST" })
            await loadAppointments()
            alert("Status updated: You signaled that you are reaching the hospital.")
        } catch (error) {
            alert(error.message || "Failed to update status.")
        } finally {
            setActionLoading(null)
        }
    }

    async function handleAcknowledgeAppointment(id) {
        setActionLoading(id)
        try {
            await apiFetch(`/appointments/${id}/acknowledge/`, { method: "POST" })
            await loadAppointments()
            alert("Record cleared. You can now book a new appointment when ready.")
        } catch (error) {
            alert(error.message || "Failed to complete procedure.")
        } finally {
            setActionLoading(null)
        }
    }

    const [medicinePaymentModal, setMedicinePaymentModal] = useState(null)

    const [userCoupons, setUserCoupons] = useState([]);

    useEffect(() => {
        loadUserCoupons();
    }, []);

    async function loadUserCoupons() {
        try {
            const data = await apiFetch("/donor-coupons/");
            setUserCoupons(data);
        } catch (error) {
            console.error("Error loading coupons:", error);
        }
    }

    async function handleBuyMedicines(appt) {
        console.log("Processing Appointment for Medicines:", appt);
        if (!appt.prescription_data || !appt.prescription_data.medicines) return;

        // Group medicines by supplier (medical store)
        const itemsBySupplier = {};
        const supplierDetails = {};
        let totalAmount = 0;

        appt.prescription_data.medicines.forEach(med => {
            const sId = med.supplier_id || med.supplier?.id;
            const pId = med.product_id || med.id;

            // Strict check: we need at least a Product ID.
            if (!pId) {
                console.warn("Skipping medicine due to missing Product ID:", med);
                return;
            }

            // If supplier ID is missing, we group under "auto_assign" and let backend resolve it.
            const groupKey = sId || "auto_assign";

            if (!itemsBySupplier[groupKey]) {
                itemsBySupplier[groupKey] = [];
                supplierDetails[groupKey] = med.supplier || { id: groupKey, company_name: "Medical Store" };
            }
            const quantity = med.quantity || 1;
            const price = med.price || 0;
            itemsBySupplier[groupKey].push({
                store_product_id: pId,
                quantity: quantity,
                product_type: "STORE",
                price: price,
                name: med.name,
                currency: med.currency || "INR"
            });
            totalAmount += (price * quantity);
        });

        const supplierIds = Object.keys(itemsBySupplier);
        if (supplierIds.length === 0) {
            alert("Cannot purchase medicines: No valid products found in prescription.");
            return;
        }

        // Check for selected coupon from localStorage
        let selectedCoupon = null;
        try {
            const savedCoupon = localStorage.getItem("selected_medical_coupon");
            if (savedCoupon) {
                selectedCoupon = JSON.parse(savedCoupon);
            }
        } catch (e) {
            console.error("Failed to parse selected coupon:", e);
        }

        setMedicinePaymentModal({
            appointment: appt,
            itemsBySupplier,
            supplierDetails,
            totalAmount,
            selectedCoupon, // From localStorage
            manualCouponCode: "", // For manual entry
            useCoupon: false, // User hasn't decided yet
            discountedAmount: totalAmount
        });
    }

    async function processMedicinePayment(paymentMethod) {
        if (!medicinePaymentModal) return;

        const { appointment, itemsBySupplier, useCoupon, selectedCoupon } = medicinePaymentModal;
        setActionLoading("medicine_payment");

        try {
            for (const supplierId in itemsBySupplier) {
                const orderData = {
                    // If we used "auto_assign", send null so backend derives it from product
                    supplier_id: supplierId === "auto_assign" ? null : supplierId,
                    appointment_id: appointment.id,
                    shipping_address: "Pick up at Hospital / Pharmacy",
                    shipping_city: appointment.hospital?.city || "Unknown",
                    contact_phone: appointment.donor?.phone || "0000000000",
                    items: itemsBySupplier[supplierId].map(item => ({
                        store_product_id: item.store_product_id,
                        quantity: item.quantity,
                        product_type: "STORE"
                    }))
                };

                // Add coupon code if user chose to use it
                if (useCoupon && selectedCoupon) {
                    orderData.coupon_code = selectedCoupon.code;
                }

                const order = await apiFetch("/medical-orders/create-order/", {
                    method: "POST",
                    body: JSON.stringify(orderData)
                });

                // Pay using the selected method
                await apiFetch(`/medical-orders/${order.id}/pay/`, {
                    method: "POST",
                    body: JSON.stringify({ payment_method: paymentMethod })
                });
            }

            // If coupon was used, clear it from localStorage
            if (useCoupon && selectedCoupon) {
                localStorage.removeItem("selected_medical_coupon");
            }

            const data = await apiFetch("/appointments/?donor=me")
            setAppointments(data)

            alert("Payment Successful! Medicine orders placed and invoices generated.");

            // Allow user to view the updated appointment details immediately
            const updatedAppt = data.find(a => a.id === appointment.id);
            if (updatedAppt) setShowPrescription(updatedAppt);

            setMedicinePaymentModal(null);
        } catch (error) {
            alert(error.message || "Failed to process medicine payment.");
        } finally {
            setActionLoading(null);
        }
    }

    async function handleConfirmMedReceipt(orderId, apptId) {
        setActionLoading(apptId);
        try {
            await apiFetch(`/medical-orders/${orderId}/mark_received/`, {
                method: "POST",
                body: JSON.stringify({ rating: 5 }) // Default rating for quick confirm
            });
            const data = await apiFetch("/appointments/?donor=me")
            setAppointments(data)

            alert("Medicine receipt confirmed! Thank you.");

            // Update the showPrescription state to reflect changes
            const updatedAppt = data.find(a => a.id === apptId);
            if (updatedAppt) setShowPrescription(updatedAppt);
        } catch (error) {
            alert(error.message || "Failed to confirm receipt.");
        } finally {
            setActionLoading(null);
        }
    }

    async function handleSubmit(e) {
        e.preventDefault()
        if (!formData.hospital_id || !formData.appointment_date || !formData.appointment_time) {
            alert("Please fill in all required fields.")
            return
        }

        setSubmitting(true)
        try {
            const appointmentDateTime = `${formData.appointment_date}T${formData.appointment_time}`
            await apiFetch("/appointments/", {
                method: "POST",
                body: JSON.stringify({
                    hospital_id: formData.hospital_id,
                    doctor_id: formData.doctor_id || null,
                    appointment_date: appointmentDateTime,
                    notes: formData.notes,
                    status: "PENDING",
                }),
            })
            alert("Appointment request sent successfully! The hospital will review and approve it.")
            router.push("/donor/dashboard")
        } catch (error) {
            console.error("Error booking appointment:", error)
            alert("Failed to book appointment. Please try again.")
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) {
        return (
            <main className="min-h-screen bg-[#1A1A2E] text-white flex items-center justify-center">
                <div className="text-center">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#E91E63] border-t-transparent mx-auto" />
                    <p className="mt-4 text-pink-100/70">Loading hospitals and doctors...</p>
                </div>
            </main>
        )
    }

    return (
        <>
            <Head>
                <title>Book Appointment — LifeSaver Connect</title>
            </Head>
            <main className="min-h-screen bg-[#1A1A2E] text-white">
                <header className="border-b border-[#F6D6E3]/30 bg-[#131326]/80 backdrop-blur sticky top-0 z-10">
                    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
                        <div className="flex items-center justify-between">
                            <h1 className="text-2xl font-bold">Book an Appointment</h1>
                            <Link href="/donor/dashboard" legacyBehavior>
                                <a className="text-sm text-pink-100/70 hover:text-white">Back to Dashboard</a>
                            </Link>
                        </div>
                    </div>
                </header>

                <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
                    <div className="rounded-2xl border border-[#F6D6E3]/30 bg-[#131326] p-8 shadow-2xl">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-pink-100 mb-2">Select Hospital *</label>
                                <select
                                    required
                                    value={formData.hospital_id}
                                    onChange={(e) => setFormData({ ...formData, hospital_id: e.target.value, doctor_id: "" })}
                                    className="w-full rounded-lg border border-[#F6D6E3]/30 bg-[#1A1A2E] px-4 py-3 text-white outline-none focus:border-[#E91E63] transition"
                                >
                                    <option value="">Choose a Hospital</option>
                                    {hospitals.map(h => (
                                        <option key={h.id} value={h.id}>{h.name} - {h.city}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-pink-100 mb-2">Select Doctor *</label>
                                <select
                                    required
                                    value={formData.doctor_id}
                                    onChange={(e) => setFormData({ ...formData, doctor_id: e.target.value })}
                                    disabled={!formData.hospital_id}
                                    className="w-full rounded-lg border border-[#F6D6E3]/30 bg-[#131326] px-4 py-3 text-white outline-none focus:border-[#E91E63] transition-all"
                                >
                                    <option value="">Choose a Doctor</option>
                                    {doctors.map(d => (
                                        <option key={d.id} value={d.id}>
                                            {d.name} | {d.specialization || "General"} | {d.currency} {d.consultation_charge || "0"} | {d.time_schedule || "Check Availability"}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid gap-6 md:grid-cols-2">
                                <div>
                                    <label className="block text-sm font-medium text-pink-100 mb-2">Preferred Date *</label>
                                    <input
                                        type="date"
                                        required
                                        min={new Date().toISOString().split("T")[0]}
                                        value={formData.appointment_date}
                                        onChange={(e) => setFormData({ ...formData, appointment_date: e.target.value })}
                                        className="w-full rounded-lg border border-[#F6D6E3]/30 bg-[#1A1A2E] px-4 py-3 text-white outline-none focus:border-[#E91E63] transition"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-pink-100 mb-2">Preferred Time *</label>
                                    <input
                                        type="time"
                                        required
                                        min={formData.appointment_date === new Date().toISOString().split("T")[0] ? new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : undefined}
                                        value={formData.appointment_time}
                                        onChange={(e) => setFormData({ ...formData, appointment_time: e.target.value })}
                                        className="w-full rounded-lg border border-[#F6D6E3]/30 bg-[#1A1A2E] px-4 py-3 text-white outline-none focus:border-[#E91E63] transition"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-pink-100 mb-2">Notes for Doctor / Hospital</label>
                                <textarea
                                    rows={4}
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="Describe your concern or reason for visit..."
                                    className="w-full rounded-lg border border-[#F6D6E3]/30 bg-[#1A1A2E] px-4 py-3 text-white outline-none focus:border-[#E91E63] transition"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full rounded-xl bg-[#E91E63] py-4 font-bold text-white shadow-lg transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                            >
                                {submitting ? "Processing..." : "Send Appointment Request"}
                            </button>
                        </form>
                    </div>

                    <div className="mt-12 space-y-8">
                        <div className="border-b border-[#F6D6E3]/20 pb-4">
                            <h2 className="text-xl font-bold uppercase tracking-tight">Your Recent Appointments</h2>
                            <p className="text-xs text-pink-100/60 mt-1">Check and pay fees for hospital approved slots.</p>
                        </div>

                        <div className="space-y-4">
                            {appointments.map((appt) => {
                                const statusColors = {
                                    PENDING: "text-yellow-400 bg-yellow-400/10",
                                    APPROVED: "text-green-400 bg-green-400/10 border-green-500",
                                    SCHEDULED: "text-blue-400 bg-blue-400/10",
                                    CANCELLED: "text-red-400 bg-red-400/10",
                                    NO_SHOW: "text-orange-400 bg-orange-400/10 border-orange-500",
                                }
                                const statusColor = statusColors[appt.status] || "text-gray-400 bg-gray-400/10"

                                return (
                                    <div key={appt.id} className={`rounded-xl border border-[#F6D6E3]/20 bg-[#131326] p-6 transition ${appt.status === 'APPROVED' ? 'ring-2 ring-green-500/30' : appt.status === 'NO_SHOW' ? 'ring-2 ring-orange-500/30 bg-orange-500/5' : ''}`}>
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <div>
                                                <div className="flex items-center gap-3 mb-2">
                                                    <h3 className="font-bold text-lg">{appt.hospital?.name}</h3>
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${statusColor}`}>
                                                        {appt.status}
                                                    </span>
                                                    {appt.is_paid && (
                                                        <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded text-[10px] font-bold border border-green-500/30 flex items-center gap-1">
                                                            ✅ PAID
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="space-y-1 text-sm text-pink-100/70">
                                                    <p>📅 {new Date(appt.appointment_date).toLocaleDateString()} {appt.appointment_time && `at ${appt.appointment_time}`}</p>
                                                    {appt.doctor?.name && <p>👨‍⚕️ Dr. {appt.doctor.name}</p>}

                                                    {appt.status === "APPROVED" && !appt.is_paid && (
                                                        <div className="mt-2 p-3 rounded-lg bg-pink-500/10 border border-pink-500/20 animate-pulse">
                                                            <p className="text-pink-300 font-bold flex items-center gap-2 text-xs">
                                                                💳 PAY CONSULTATION FEES: {appt.currency} {appt.charges || appt.doctor?.consultation_charge || "0"}
                                                            </p>
                                                        </div>
                                                    )}

                                                    {appt.is_paid && appt.payment_receipt && (
                                                        <p className="text-[10px] font-mono opacity-50 bg-black/20 p-1 rounded inline-block">
                                                            Receipt: {appt.payment_receipt}
                                                        </p>
                                                    )}

                                                    {appt.is_prescription_ready && (
                                                        <div className="mt-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 shadow-inner">
                                                            <h4 className="text-blue-400 text-xs font-black uppercase tracking-tight mb-2 flex items-center gap-2">
                                                                💊 Medical Prescription
                                                            </h4>
                                                            <p className="text-white text-sm bg-[#1A1A2E] p-3 rounded-lg border border-blue-500/10 whitespace-pre-wrap leading-relaxed">
                                                                {appt.prescription}
                                                            </p>
                                                        </div>
                                                    )}

                                                    {appt.notes && <p className={`italic text-xs mt-2 ${appt.status === 'NO_SHOW' ? 'text-orange-300 font-bold opacity-100' : 'opacity-60'}`}>
                                                        {appt.notes}
                                                    </p>}
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-2 min-w-[140px]">
                                                {appt.status === "APPROVED" && (
                                                    <>
                                                        {!appt.is_paid ? (
                                                            <button
                                                                disabled={actionLoading === appt.id}
                                                                onClick={() => handlePayFee(appt.id)}
                                                                className="w-full rounded-lg bg-pink-600 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-pink-500 transition shadow-lg shadow-pink-900/40 disabled:opacity-50"
                                                            >
                                                                {actionLoading === appt.id ? "..." : "Pay Fee"}
                                                            </button>
                                                        ) : (
                                                            <>
                                                                <button
                                                                    disabled={actionLoading === appt.id}
                                                                    onClick={() => handleConfirmSlot(appt.id)}
                                                                    className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-blue-500 transition shadow-lg shadow-blue-900/40 disabled:opacity-50"
                                                                >
                                                                    {actionLoading === appt.id ? "..." : "Confirm Slot"}
                                                                </button>
                                                                <button
                                                                    onClick={() => setShowInvoice(appt)}
                                                                    className="w-full rounded-lg bg-white/10 border border-white/20 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/20 transition disabled:opacity-50"
                                                                >
                                                                    View Invoice
                                                                </button>
                                                            </>
                                                        )}
                                                        <button
                                                            disabled={actionLoading === appt.id}
                                                            onClick={() => handleDeclineAppointment(appt.id)}
                                                            className="w-full rounded-lg border border-red-500/40 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-red-400 hover:bg-red-500/20 transition disabled:opacity-50"
                                                        >
                                                            Decline
                                                        </button>
                                                    </>
                                                )}
                                                {appt.status === "SCHEDULED" && appt.is_paid && (
                                                    <div className="space-y-3">
                                                        <div className="rounded-lg bg-green-600/20 border border-green-500/40 p-3 text-center">
                                                            <p className="text-green-400 text-[10px] font-black uppercase tracking-widest">Booking Confirmed</p>
                                                        </div>
                                                        {!appt.is_reaching ? (
                                                            <button
                                                                disabled={actionLoading === appt.id}
                                                                onClick={() => handleMarkReaching(appt.id)}
                                                                className="w-full rounded-lg bg-pink-600 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-pink-500 transition shadow-lg shadow-pink-900/40 disabled:opacity-50"
                                                            >
                                                                {actionLoading === appt.id ? "..." : "Will be reaching at time"}
                                                            </button>
                                                        ) : (
                                                            <div className="rounded-lg bg-blue-600/20 border border-blue-500/40 p-3 text-center">
                                                                <p className="text-blue-400 text-[10px] font-black uppercase tracking-widest">On the Way</p>
                                                            </div>
                                                        )}
                                                        <button
                                                            onClick={() => setShowInvoice(appt)}
                                                            className="w-full rounded-lg bg-white/10 border border-white/20 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/20 transition disabled:opacity-50"
                                                        >
                                                            View Invoice
                                                        </button>
                                                    </div>
                                                )}
                                                {appt.status === "COMPLETED" && (
                                                    <div className="space-y-3">
                                                        <div className="rounded-lg bg-purple-600/20 border border-purple-500/40 p-3 text-center">
                                                            <p className="text-purple-400 text-[10px] font-black uppercase tracking-widest">Appointment Finished</p>
                                                            {appt.next_consultation_date && (
                                                                <p className="text-white text-[9px] mt-1">Next: {new Date(appt.next_consultation_date).toLocaleDateString()}</p>
                                                            )}
                                                        </div>
                                                        <button
                                                            onClick={() => setShowPrescription(appt)}
                                                            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-blue-500 transition shadow-lg shadow-blue-900/40"
                                                        >
                                                            View Prescription
                                                        </button>
                                                        <button
                                                            onClick={() => setShowInvoice(appt)}
                                                            className="w-full rounded-lg bg-white/10 border border-white/20 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/20 transition"
                                                        >
                                                            View Payment Receipt
                                                        </button>
                                                        <button
                                                            disabled={actionLoading === appt.id}
                                                            onClick={() => handleAcknowledgeAppointment(appt.id)}
                                                            className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white/50 hover:bg-white/10 transition"
                                                        >
                                                            {actionLoading === appt.id ? "..." : "Clear Record"}
                                                        </button>
                                                    </div>
                                                )}
                                                {appt.status === "NO_SHOW" && (
                                                    <button
                                                        disabled={actionLoading === appt.id}
                                                        onClick={() => handleAcknowledgeAppointment(appt.id)}
                                                        className="w-full rounded-lg bg-orange-600 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-orange-500 transition shadow-lg shadow-orange-900/40 disabled:opacity-50"
                                                    >
                                                        {actionLoading === appt.id ? "..." : "Ok, Understood"}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}

                            {appointments.length === 0 && (
                                <div className="rounded-xl border border-dashed border-[#F6D6E3]/20 p-12 text-center bg-white/5">
                                    <p className="text-pink-100/50">You haven't booked any appointments yet.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Invoice Modal */}
                {showInvoice && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A0A1A]/90 backdrop-blur-md">
                        <div className="w-full max-w-lg rounded-3xl overflow-hidden border border-white/10 bg-[#131326] shadow-2xl animate-in zoom-in-95 duration-200">
                            <div className="bg-gradient-to-r from-[#E91E63] to-[#9C27B0] p-8 text-center relative">
                                <button
                                    onClick={() => setShowInvoice(null)}
                                    className="absolute top-4 right-4 text-white/70 hover:text-white"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                                <div className="mx-auto w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-4">
                                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Payment Receipt</h2>
                                <p className="text-pink-100/80 font-mono text-sm mt-1">{showInvoice.payment_receipt}</p>
                            </div>

                            <div className="p-8 space-y-6">
                                <div className="flex justify-between items-start border-b border-white/5 pb-6">
                                    <div>
                                        <p className="text-[10px] font-black text-pink-500 uppercase tracking-widest mb-1">Clinic / Hospital</p>
                                        <p className="text-white font-bold text-lg leading-tight">{showInvoice.hospital?.name}</p>
                                        <p className="text-pink-100/50 text-xs mt-1">{showInvoice.hospital?.city}, {showInvoice.hospital?.address}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-pink-500 uppercase tracking-widest mb-1">Date</p>
                                        <p className="text-white font-bold">{new Date(showInvoice.appointment_date).toLocaleDateString()}</p>
                                        {showInvoice.appointment_time && <p className="text-pink-100/50 text-xs">{showInvoice.appointment_time}</p>}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-8">
                                    <div>
                                        <p className="text-[10px] font-black text-pink-500 uppercase tracking-widest mb-1">Doctor</p>
                                        <p className="text-white font-bold">Dr. {showInvoice.doctor?.name || "N/A"}</p>
                                        <p className="text-pink-100/50 text-xs">{showInvoice.doctor?.specialization}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-pink-500 uppercase tracking-widest mb-1">Payment Method</p>
                                        <p className="text-white font-bold">{showInvoice.payment_method}</p>
                                        <p className="text-pink-100/50 text-xs">Transaction ID: {showInvoice.id}00X</p>
                                    </div>
                                </div>

                                <div className="bg-[#1A1A2E] rounded-2xl p-6 border border-white/5 space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-pink-100/60 text-sm">Consultation Fee</span>
                                        <span className="text-white font-mono">{showInvoice.currency} {showInvoice.charges || showInvoice.doctor?.consultation_charge}</span>
                                    </div>

                                    {showInvoice.prescription_data && (
                                        <div className="pt-4 border-t border-white/5 space-y-2">
                                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Prescribed Medicines</p>
                                            {showInvoice.prescription_data.medicines?.map((med, idx) => (
                                                <div key={`m-${idx}`} className="flex justify-between items-center text-xs">
                                                    <span className="text-white font-medium">{med.name} {med.price > 0 && `(${med.currency} ${med.price})`}</span>
                                                    <span className="text-pink-100/50">{med.dosage} ({med.timing.replace('_', ' ')})</span>
                                                </div>
                                            ))}
                                            {showInvoice.prescription_data.custom_medicines?.map((med, idx) => (
                                                <div key={`c-${idx}`} className="flex justify-between items-center text-xs">
                                                    <span className="text-white font-medium">{med.name} (Custom)</span>
                                                    <span className="text-pink-100/50">{med.dosage} ({med.timing.replace('_', ' ')})</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex justify-between items-center pt-4 border-t border-white/5">
                                        <span className="text-white font-bold uppercase text-xs tracking-widest">Total Bill</span>
                                        <span className="text-[#E91E63] text-xl font-black">
                                            {showInvoice.currency} {parseFloat(showInvoice.charges || showInvoice.doctor?.consultation_charge || 0).toFixed(2)}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <button
                                        onClick={() => window.print()}
                                        className="flex-1 rounded-xl bg-white/10 hover:bg-white/20 py-3 font-bold text-white transition border border-white/10 flex items-center justify-center gap-2"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                        </svg>
                                        Print PDF
                                    </button>
                                    <button
                                        onClick={() => setShowInvoice(null)}
                                        className="flex-1 rounded-xl bg-[#E91E63] py-3 font-bold text-white shadow-lg transition hover:opacity-90 active:scale-[0.98]"
                                    >
                                        Close
                                    </button>
                                </div>
                                <p className="text-center text-[10px] text-pink-100/30 uppercase tracking-[0.2em] font-bold">LifeSaver Connect Secure Receipt</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Prescription Modal (RX) */}
                {showPrescription && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A0A1A]/95 backdrop-blur-xl">
                        <div className="w-full max-w-lg rounded-[1.5rem] overflow-hidden border border-white/10 bg-[#131326] shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
                            <div className="bg-white p-5 relative">
                                <button
                                    onClick={() => setShowPrescription(null)}
                                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-900 transition-colors"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>

                                <div className="border-b-2 border-gray-900 pb-3 mb-4 flex justify-between items-end">
                                    <div>
                                        <h2 className="text-xl font-serif font-black text-gray-900 tracking-tighter italic leading-none">PRESCRIPTION</h2>
                                        <p className="text-[9px] text-gray-500 font-mono mt-1">LifeSaver Connect Medical Network</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-bold text-gray-900 leading-none">RX</p>
                                    </div>
                                </div>

                                <div className="overflow-y-auto pr-2 space-y-4 text-gray-900 max-h-[60vh]">
                                    <div className="grid grid-cols-2 gap-3 text-[10px]">
                                        <div>
                                            <p className="font-black uppercase tracking-widest text-[8px] text-blue-600 mb-0.5">Patient Name</p>
                                            <p className="font-bold border-b border-gray-100 pb-0.5">{showPrescription.donor?.first_name} {showPrescription.donor?.last_name}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-black uppercase tracking-widest text-[8px] text-blue-600 mb-0.5">Date</p>
                                            <p className="font-bold border-b border-gray-100 pb-0.5">{new Date(showPrescription.appointment_date).toLocaleDateString()}</p>
                                        </div>
                                    </div>

                                    <div>
                                        <p className="font-black uppercase tracking-widest text-[8px] text-blue-600 mb-1">Doctor Details</p>
                                        <p className="text-xs font-bold">Dr. {showPrescription.doctor?.name}</p>
                                        <p className="text-[9px] text-gray-500 italic leading-tight">{showPrescription.doctor?.specialization}</p>
                                    </div>

                                    <div className="py-2 space-y-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xl font-serif italic text-blue-600">℞</span>
                                            <div className="h-px flex-1 bg-gray-100"></div>
                                        </div>

                                        {showPrescription.prescription_data?.medicines?.length > 0 || showPrescription.prescription_data?.custom_medicines?.length > 0 ? (
                                            <div className="space-y-3">
                                                {[...(showPrescription.prescription_data.medicines || []), ...(showPrescription.prescription_data.custom_medicines || [])].map((med, idx) => (
                                                    <div key={idx} className="flex flex-col gap-0.5 border-l-2 border-blue-600 pl-3 py-0.5">
                                                        <div className="flex items-center justify-between">
                                                            <p className="text-xs font-black uppercase tracking-tight">{med.name}</p>
                                                            {med.product_id && (
                                                                <span className="bg-green-100 text-green-700 text-[7px] font-bold px-1 py-0.5 rounded uppercase">Verified</span>
                                                            )}
                                                        </div>
                                                        <div className="flex gap-3 text-[9px] font-bold text-gray-600">
                                                            <span>Dosage: {med.dosage}</span>
                                                            <span className="text-blue-600">•</span>
                                                            <span>{med.timing?.replace('_', ' ')}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-[10px] text-gray-400 italic">No medication prescribed.</p>
                                        )}
                                    </div>

                                    {/* Medicine Order Actions */}
                                    {showPrescription.prescription_data?.medicines?.length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-gray-100">
                                            {!showPrescription.medicine_orders?.length ? (
                                                <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100/50 flex flex-col gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                                        </div>
                                                        <div>
                                                            <p className="text-[8px] font-black text-blue-900 uppercase tracking-widest leading-none mb-0.5">Stock Available</p>
                                                            <p className="text-[7px] text-blue-600/70 font-medium font-mono">Autonomous Fulfilment Active</p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleBuyMedicines(showPrescription)}
                                                        disabled={actionLoading === showPrescription.id}
                                                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition shadow-sm"
                                                    >
                                                        {actionLoading === showPrescription.id ? "..." : "Buy Prescribed Medicines (₹)"}
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    {showPrescription.medicine_orders.map(order => (
                                                        <div key={order.id} className="bg-gray-50 p-2 rounded-lg border border-gray-200 flex items-center justify-between">
                                                            <div className="flex flex-col">
                                                                <p className="text-[8px] font-black text-gray-900 uppercase tracking-widest">Order Info</p>
                                                                <p className="text-[7px] text-gray-500 font-mono italic">#{order.order_number} • {order.status}</p>
                                                            </div>
                                                            {order.status === "DISPENSED" && (
                                                                <span className="text-[8px] font-black text-green-600 uppercase tracking-widest bg-green-50 px-1.5 py-0.5 rounded border border-green-100">Picked Up ✓</span>
                                                            )}
                                                            {order.status === "SHIPPED" && (
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[8px] font-black text-purple-600 uppercase tracking-widest bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100 animate-pulse">Arriving</span>
                                                                    <button
                                                                        onClick={() => handleConfirmMedReceipt(order.id, showPrescription.id)}
                                                                        disabled={actionLoading === showPrescription.id}
                                                                        className="px-3 py-0.5 bg-green-600 hover:bg-green-700 text-white rounded text-[8px] font-black uppercase tracking-widest transition"
                                                                    >
                                                                        Confirm Receipt
                                                                    </button>
                                                                </div>
                                                            )}
                                                            {order.status === "RECEIVED" && (
                                                                <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">Received</span>
                                                            )}
                                                            {order.status === "APPROVED" && (
                                                                <span className="text-[8px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 animate-pulse">Processing</span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {showPrescription.next_consultation_date && (
                                        <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 mt-4">
                                            <p className="font-black uppercase tracking-widest text-[8px] text-blue-600 mb-0.5">Follow-up Schedule</p>
                                            <p className="text-[10px] font-bold text-blue-900">Next Visit: {new Date(showPrescription.next_consultation_date).toDateString()}</p>
                                        </div>
                                    )}

                                    <div className="pt-4 flex justify-between items-center opacity-50">
                                        <div className="h-8 w-8 flex items-center justify-center border border-gray-300 rounded-lg text-[8px] font-bold rotate-12">SEAL</div>
                                        <p className="text-[8px] font-mono">ID: {showPrescription.id} - REF: {showPrescription.payment_receipt}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-[#131326] flex gap-2">
                                <button
                                    onClick={() => window.print()}
                                    className="flex-1 rounded-xl bg-white/5 border border-white/10 py-2.5 font-bold text-white hover:bg-white/10 transition text-[10px] uppercase tracking-wider"
                                >
                                    Print
                                </button>
                                <button
                                    onClick={() => setShowPrescription(null)}
                                    className="flex-1 rounded-xl bg-blue-600 py-2.5 font-bold text-white hover:bg-blue-500 transition text-[10px] uppercase tracking-wider shadow-lg"
                                >
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Medicine Payment Modal */}
                {medicinePaymentModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
                        <div className="bg-[#1A1A2E] rounded-3xl border border-[#F6D6E3]/20 w-full max-w-md overflow-hidden shadow-2xl">
                            <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-white text-center relative">
                                <button
                                    onClick={() => setMedicinePaymentModal(null)}
                                    className="absolute top-4 right-4 p-1 hover:bg-white/20 rounded-full transition"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                                <h3 className="text-xl font-black uppercase tracking-tighter">Confirm Purchase</h3>
                                <p className="text-sm opacity-90 mt-1">Pharmacy Checkout</p>
                            </div>

                            <div className="p-6 space-y-6">
                                <div className="space-y-4">
                                    {Object.entries(medicinePaymentModal.itemsBySupplier).map(([supplierId, items]) => (
                                        <div key={supplierId} className="bg-white/5 rounded-xl p-4 border border-white/5">
                                            <p className="text-xs font-black text-pink-100/50 uppercase tracking-widest mb-3">
                                                {medicinePaymentModal.supplierDetails[supplierId]?.company_name}
                                            </p>
                                            <div className="space-y-2">
                                                {items.map((item, idx) => (
                                                    <div key={idx} className="flex justify-between text-xs text-white">
                                                        <span>{item.name} <span className="text-pink-100/50">x{item.quantity}</span></span>
                                                        <span className="font-mono">{item.currency} {parseFloat(item.price * item.quantity).toFixed(2)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>


                                {/* Coupon Prompt */}
                                <div className="space-y-4">
                                    {/* Selected Coupon Display */}
                                    {medicinePaymentModal.selectedCoupon && (
                                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                                            <div className="flex items-start gap-3 mb-3">
                                                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                                                    🎟️
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-sm font-bold text-white mb-1">Coupon Available!</p>
                                                    <p className="text-xs text-blue-200">
                                                        You have a <span className="font-black">{medicinePaymentModal.selectedCoupon.discount_percentage}% discount</span> coupon selected.
                                                    </p>
                                                    <p className="text-xs text-blue-300/70 mt-1 font-mono">Code: {medicinePaymentModal.selectedCoupon.code}</p>
                                                </div>
                                            </div>

                                            {medicinePaymentModal.useCoupon === false ? (
                                                <div className="grid grid-cols-2 gap-2">
                                                    <button
                                                        onClick={() => {
                                                            const discount = medicinePaymentModal.totalAmount * (medicinePaymentModal.selectedCoupon.discount_percentage / 100);
                                                            setMedicinePaymentModal({
                                                                ...medicinePaymentModal,
                                                                useCoupon: true,
                                                                discountedAmount: medicinePaymentModal.totalAmount - discount
                                                            });
                                                        }}
                                                        className="py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs font-black uppercase tracking-wider transition"
                                                    >
                                                        Yes, Apply Discount
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setMedicinePaymentModal({
                                                                ...medicinePaymentModal,
                                                                selectedCoupon: null, // Clear selection to allow manual entry or just skip
                                                                useCoupon: null // User chose not to use it
                                                            });
                                                            alert("Coupon saved for later use!");
                                                        }}
                                                        className="py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-black uppercase tracking-wider transition"
                                                    >
                                                        No, Save for Later
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 flex items-center gap-2">
                                                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                                    <p className="text-xs text-green-300 font-bold">
                                                        {medicinePaymentModal.selectedCoupon.discount_percentage}% discount applied! You save {Object.values(medicinePaymentModal.itemsBySupplier)[0][0]?.currency || "INR"} {(medicinePaymentModal.totalAmount - medicinePaymentModal.discountedAmount).toFixed(2)}
                                                    </p>
                                                    <button
                                                        onClick={() => {
                                                            setMedicinePaymentModal({
                                                                ...medicinePaymentModal,
                                                                useCoupon: false,
                                                                discountedAmount: medicinePaymentModal.totalAmount
                                                            })
                                                        }}
                                                        className="ml-auto text-xs text-red-300 hover:text-red-200 underline"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Manual Coupon Entry */}
                                    {!medicinePaymentModal.selectedCoupon && !medicinePaymentModal.useCoupon && (
                                        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                            <p className="text-xs font-bold text-pink-100 mb-2">Have a coupon code?</p>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="Enter code (e.g. SAVE20)"
                                                    className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-pink-500 outline-none uppercase font-mono"
                                                    value={medicinePaymentModal.manualCouponCode || ""}
                                                    onChange={(e) => setMedicinePaymentModal({ ...medicinePaymentModal, manualCouponCode: e.target.value.toUpperCase() })}
                                                />
                                                <button
                                                    onClick={() => {
                                                        const code = medicinePaymentModal.manualCouponCode;
                                                        if (!code) return;

                                                        // Check against user coupons
                                                        const found = userCoupons.find(c => c.code === code && !c.is_used);
                                                        if (found) {
                                                            const discount = medicinePaymentModal.totalAmount * (found.discount_percentage / 100);
                                                            setMedicinePaymentModal({
                                                                ...medicinePaymentModal,
                                                                selectedCoupon: found,
                                                                useCoupon: true,
                                                                discountedAmount: medicinePaymentModal.totalAmount - discount,
                                                                manualCouponCode: ""
                                                            });
                                                            alert(`Coupon applied! ${found.discount_percentage}% discount.`);
                                                        } else {
                                                            alert("Invalid coupon code or coupon already used.");
                                                        }
                                                    }}
                                                    className="px-4 py-2 bg-pink-600 hover:bg-pink-500 rounded-lg text-xs font-bold uppercase tracking-wider text-white transition disabled:opacity-50"
                                                    disabled={!medicinePaymentModal.manualCouponCode}
                                                >
                                                    Apply
                                                </button>
                                            </div>
                                            {userCoupons.length === 0 && (
                                                <p className="text-[10px] text-gray-500 mt-2 italic">
                                                    No coupons available in your account.
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>


                                <div className="flex justify-between items-center py-4 border-t border-white/10 mt-4">
                                    <span className="text-pink-100/60 uppercase text-xs font-bold tracking-widest">Total Payable</span>
                                    <div className="text-right">
                                        {medicinePaymentModal.useCoupon && (
                                            <p className="text-xs text-pink-100/40 line-through">
                                                {Object.values(medicinePaymentModal.itemsBySupplier)[0][0]?.currency || "INR"} {medicinePaymentModal.totalAmount.toFixed(2)}
                                            </p>
                                        )}
                                        <span className="text-2xl font-black text-white">
                                            {Object.values(medicinePaymentModal.itemsBySupplier)[0][0]?.currency || "INR"} {medicinePaymentModal.discountedAmount.toFixed(2)}
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    {["Credit Card", "UPI", "Net Banking", "Wallet"].map((method) => (
                                        <button
                                            key={method}
                                            onClick={() => processMedicinePayment(method)}
                                            disabled={actionLoading === "medicine_payment" || (medicinePaymentModal.selectedCoupon && medicinePaymentModal.useCoupon === false)}
                                            className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-[#E91E63] hover:text-white hover:border-[#E91E63] transition text-xs font-bold text-pink-100/70 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {method}
                                        </button>
                                    ))}
                                </div>
                                {actionLoading === "medicine_payment" && (
                                    <p className="text-center text-xs text-pink-100/50 animate-pulse">Processing secure payment...</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </>
    )

}
