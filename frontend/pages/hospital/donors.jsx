import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import { useState, useEffect } from "react"
import { apiFetch } from "../../lib/api"
import { generatePledgeReport } from "../../lib/pdf-generator"

export default function HospitalPatients() {
    const router = useRouter()
    const { id } = router.query
    const [hospital, setHospital] = useState(null)
    const [visits, setVisits] = useState([])
    const [donationRequests, setDonationRequests] = useState([])
    const [appointments, setAppointments] = useState([])
    const [organDonors, setOrganDonors] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState("BLOOD")
    const [showVerifyModal, setShowVerifyModal] = useState(false)
    const [selectedRequest, setSelectedRequest] = useState(null)
    const [rescheduleForm, setRescheduleForm] = useState({ date: "", time: "" }) // Added for Reschedule
    const [verifyData, setVerifyData] = useState({
        rewards: "",
        prescription: "",
        fruity_given: true,
        star_reward: true,
        notes: "",
        visit_date: new Date().toISOString().split('T')[0],
        visit_time: new Date().toTimeString().split(' ')[0].substring(0, 5)
    })
    const [verifying, setVerifying] = useState(false)
    const [rejecting, setRejecting] = useState(false)
    const [searchQuery, setSearchQuery] = useState("") // Added Search State
    const [bodyReceiveModal, setBodyReceiveModal] = useState({
        show: false,
        pledgeId: null,
        amount: "",
        pdf_hash: "",
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().split(' ')[0].substring(0, 5),
        reportUrl: ""
    }) // Added Body Receive Modal State
    const [showInvoice, setShowInvoice] = useState(null)
    const [invoiceConfirmed, setInvoiceConfirmed] = useState(false)

    useEffect(() => {
        loadData()
    }, [id])

    async function loadData() {
        setLoading(true)
        try {
            let hospitalData
            try {
                hospitalData = await apiFetch("/hospitals/me/")
            } catch {
                hospitalData = await apiFetch(`/hospitals/${id}/`)
            }
            setHospital(hospitalData)
            const hospitalId = hospitalData.id || id
            await Promise.all([
                loadVisits(hospitalId),
                loadDonationRequests(hospitalId),
                loadAppointments(hospitalId),
                loadOrganDonors()
            ])
        } catch (error) {
            console.error("Error loading data:", error)
        } finally {
            setLoading(false)
        }
    }

    async function loadVisits(hospitalId) {
        try {
            const data = await apiFetch(`/patient-visits/?hospital=${hospitalId}`)
            setVisits(data)
        } catch (error) {
            console.error("Error loading visits:", error)
            setVisits([])
        }
    }

    async function loadDonationRequests(hospitalId) {
        try {
            const data = await apiFetch(`/donation-requests/?hospital=${hospitalId}`)
            setDonationRequests(data)
        } catch (error) {
            console.error("Error loading requests:", error)
            setDonationRequests([])
        }
    }

    async function loadAppointments(hospitalId) {
        try {
            const data = await apiFetch(`/appointments/?hospital=${hospitalId}`)
            setAppointments(data)
        } catch (error) {
            console.error("Error loading appointments:", error)
            setAppointments([])
        }
    }

    async function loadOrganDonors() {
        try {
            const data = await apiFetch("/organ-donors/")
            setOrganDonors(data.filter(p => ["PENDING", "ACCEPTED", "REPORT_VERIFIED", "COMMITTED", "BODY_RECEIVED", "COMPLETED", "CANCELLED", "REJECTED"].includes(p.status)))
        } catch (error) {
            console.error("Error loading organ donors:", error)
            setOrganDonors([])
        }
    }

    async function handleAcceptRequest(requestId) {
        try {
            await apiFetch(`/donation-requests/${requestId}/accept/`, {
                method: "POST",
                body: JSON.stringify({ notes: "" }),
            })
            await loadDonationRequests(hospital?.id || id)
            alert("Request accepted successfully!")
        } catch (error) {
            alert("Error accepting request. Please try again.")
        }
    }

    async function handleRejectRequest(requestId) {
        try {
            await apiFetch(`/donation-requests/${requestId}/reject/`, {
                method: "POST",
                body: JSON.stringify({ notes: "" }),
            })
            await loadDonationRequests(hospital?.id || id)
            alert("Request rejected.")
        } catch (error) {
            alert("Error rejecting request. Please try again.")
        }
    }

    async function handleRescheduleRequest(requestId) {
        if (!rescheduleForm.date || !rescheduleForm.time) {
            alert("Please select both date and time")
            return
        }
        try {
            const appointmentDateTime = `${rescheduleForm.date}T${rescheduleForm.time}`
            await apiFetch(`/appointments/${requestId}/`, {
                method: "PATCH",
                body: JSON.stringify({
                    appointment_date: appointmentDateTime,
                    status: "RESCHEDULED",
                }),
            })
            setSelectedRequest(null)
            setRescheduleForm({ date: "", time: "" })
            await loadDonationRequests(hospital?.id || id)
            alert("Appointment rescheduled successfully!")
        } catch (error) {
            alert("Error rescheduling. Please try again.")
        }
    }

    async function handleVerify(requestId) {
        setVerifying(true)
        try {
            const isAppointment = !!(selectedRequest.appointment_date || selectedRequest.doctor)
            if (!confirm(isAppointment ? "Mark this appointment as completed and submit prescription?" : "The PDF should be brought as an hardcopy with you. Mark as verified?")) {
                setVerifying(false)
                return
            }

            const endpoint = isAppointment
                ? `/appointments/${requestId}/submit_prescription/`
                : `/donation-requests/${requestId}/hospital_verify/`

            const payload = isAppointment ? {
                prescription_data: {
                    notes: verifyData.notes,
                    medicines: [], // Can be expanded in UI later
                    custom_medicines: []
                },
                next_consultation_date: verifyData.visit_date
            } : {
                ...verifyData,
                visit_date: `${verifyData.visit_date}T${verifyData.visit_time}:00Z`
            }

            await apiFetch(endpoint, {
                method: "POST",
                body: JSON.stringify(payload)
            })
            alert("Visit verified successfully! history and rewards updated.")
            setShowVerifyModal(false)
            setSelectedRequest(null)
            if (hospital) {
                await Promise.all([
                    loadVisits(hospital.id),
                    loadDonationRequests(hospital.id),
                    loadAppointments(hospital.id),
                    loadOrganDonors()
                ])
            }
        } catch (error) {
            console.error("Error verifying:", error)
            alert(error.message || "Failed to verify. Please try again.")
        } finally {
            setVerifying(false)
        }
    }

    async function handleConfirmArrival(requestObj) {
        if (!confirm("Confirm that the donor has physically arrived at the hospital?")) {
            return
        }
        const requestId = requestObj.id
        const isAppointment = !!(requestObj.appointment_date || requestObj.doctor)

        if (isAppointment && !requestObj.is_paid) {
            alert("This appointment has NOT been paid for yet. Please ensure the donor has completed the payment and the receipt is verified before marking as arrived.")
            return
        }

        const endpoint = isAppointment
            ? `/appointments/${requestId}/confirm_arrival/`
            : `/donation-requests/${requestId}/confirm_arrival/`

        try {
            await apiFetch(endpoint, {
                method: "POST"
            })
            alert("Donor arrival confirmed!")
            if (hospital) {
                loadDonationRequests(hospital.id)
                loadAppointments(hospital.id)
            }
        } catch (error) {
            console.error("Error confirming arrival:", error)
            alert("Failed to confirm arrival. Please try again.")
        }
    }

    async function handleRejectArrival(requestObj) {
        if (!confirm("Are you sure you want to reject this arrival? The donor will be notified and moved back to 'Accepted' status.")) {
            return
        }
        const requestId = requestObj.id
        const isAppointment = !!(requestObj.appointment_date || requestObj.doctor)
        const endpoint = isAppointment
            ? `/appointments/${requestId}/reject_arrival/`
            : `/donation-requests/${requestId}/reject_arrival/`

        setRejecting(requestId)
        try {
            await apiFetch(endpoint, {
                method: "POST"
            })
            alert("Arrival rejected successfully.")
            if (hospital) {
                loadDonationRequests(hospital.id)
                loadAppointments(hospital.id)
            }
        } catch (error) {
            console.error("Error rejecting arrival:", error)
            alert("Failed to reject arrival. Please try again.")
        } finally {
            setRejecting(false)
        }
    }

    async function handleNotReached(requestId, isAppointment = false) {
        if (!confirm("Are you sure this donor didn't reach? This will notify the donor and hide the record from your dashboard.")) {
            return
        }
        try {
            if (isAppointment) {
                await apiFetch(`/appointments/${requestId}/not_reached/`, { method: "POST" })
            } else {
                await apiFetch(`/donation-requests/${requestId}/`, {
                    method: "PATCH",
                    body: JSON.stringify({ status: "REJECTED", notes: "Donor did not reach for scheduled donation." })
                })
            }
            alert("Record updated. Donor will see the feedback message.")
            if (hospital) {
                await loadDonationRequests(hospital.id)
                await loadAppointments(hospital.id)
            }
        } catch (error) {
            console.error("Error updating record:", error)
            alert("Failed to update record. Please try again.")
        }
    }

    async function handleOrganPledgeVerify(pledgeId, decision) {
        if (!decision) return;
        const confirmMsg = decision === 'verify'
            ? "Confirm that you have reviewed and verified this organ pledge report?"
            : "Are you sure you want to reject this organ pledge report?";

        if (!confirm(confirmMsg)) return;

        try {
            await apiFetch(`/organ-donors/${pledgeId}/hospital_verify/`, {
                method: "POST",
                body: JSON.stringify({ decision })
            });
            alert(decision === 'verify' ? "Pledge report verified successfully!" : "Pledge report rejected.");
            await loadOrganDonors();
        } catch (error) {
            console.error("Error verifying organ pledge:", error)
            alert("Failed to update status: " + error.message);
        }
    }

    async function handleDeleteVisit(visitId) {
        if (!confirm("Are you sure you want to delete this visit record? This action cannot be undone.")) {
            return
        }
        try {
            await apiFetch(`/patient-visits/${visitId}/`, {
                method: "DELETE"
            })
            alert("Visit record deleted successfully.")
            if (hospital) {
                loadVisits(hospital.id)
            }
        } catch (error) {
            console.error("Error deleting visit:", error)
            alert("Failed to delete visit record. Please try again.")
        }
    }

    async function handleReceiveBody() {
        if (!bodyReceiveModal.pledgeId) return;

        try {
            const receivedAt = `${bodyReceiveModal.date}T${bodyReceiveModal.time}:00Z`;
            await apiFetch(`/organ-donors/${bodyReceiveModal.pledgeId}/intake_body/`, {
                method: "POST",
                body: JSON.stringify({
                    payment_amount: bodyReceiveModal.amount,
                    pdf_hash: bodyReceiveModal.pdf_hash,
                    received_at: receivedAt
                })
            });
            await loadOrganDonors();
            alert("Blockchain verified! Body reception and payment recorded successfully.");
            setBodyReceiveModal({ show: false, pledgeId: null, amount: "", pdf_hash: "", date: new Date().toISOString().split('T')[0], time: new Date().toTimeString().split(' ')[0].substring(0, 5), reportUrl: "" });
        } catch (error) {
            if (error.expected_on_record) {
                alert(`Verification Failed:\nThe provided hash does not match the blockchain record for this report.\n\nExpected: ${error.expected_on_record.substring(0, 16)}...\nProvided: ${error.provided.substring(0, 16)}...\n\nPlease verify you are using the hash from the correct report.`);
            } else {
                alert("Error recording body reception: " + error.message);
            }
        }
    }

    async function handleHospitalDelete(pledgeId) {
        if (!confirm("Are you sure you want to remove this record from your view?")) return;
        try {
            await apiFetch(`/organ-donors/${pledgeId}/hospital_delete/`, { method: "POST" });
            await loadOrganDonors();
            alert("Record removed successfully.");
        } catch (error) {
            alert("Error removing record: " + error.message);
        }
    }

    // Inline generatePledgeReport removed in favor of shared utility

    if (loading) {
        return (
            <main className="min-h-screen bg-[#1A1A2E] text-white flex items-center justify-center">
                <div className="text-center">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#E91E63] border-t-transparent mx-auto" />
                    <p className="mt-4 text-pink-100/70">Loading patient records...</p>
                </div>
            </main>
        )
    }

    // Filter logic with Search
    const filteredRequests = activeTab === "COMPLETED" ?
        appointments.filter(a => a.status === "COMPLETED") : [
            ...donationRequests.filter(r => (r.request_type || "BLOOD") === activeTab && r.status !== "PENDING"),
            ...(activeTab === "APPOINTMENTS" ? appointments.filter(a => ["PENDING", "APPROVED", "SCHEDULED", "RESCHEDULED", "ARRIVED"].includes(a.status)) : [])
        ]
            .filter(item => {
                if (!searchQuery) return true;
                const searchLower = searchQuery.toLowerCase();
                const donor = item.donor || item.patient || item.user || {};
                const name = `${donor.first_name || ""} ${donor.last_name || ""} ${donor.username || ""}`.toLowerCase();
                return name.includes(searchLower) || (item.blood_group && item.blood_group.toLowerCase().includes(searchLower));
            }).sort((a, b) => new Date(a.created_at || a.appointment_date) - new Date(b.created_at || b.appointment_date)) // ASCENDING ORDER as requested

    const filteredOrganDonors = organDonors.filter(d => {
        if (!searchQuery) return true;
        const searchLower = searchQuery.toLowerCase();
        const name = `${d.user?.first_name || ""} ${d.user?.last_name || ""}`.toLowerCase();
        return name.includes(searchLower) || (d.blood_group && d.blood_group.toLowerCase().includes(searchLower));
    });

    return (
        <>
            <Head>
                <title>Donors & Patients — {hospital?.name || "Hospital"} Dashboard</title>
            </Head>
            <main className="min-h-screen bg-[#1A1A2E] text-white">
                <header className="border-b border-[#F6D6E3]/30 bg-[#131326]/80 backdrop-blur sticky top-0 z-10">
                    <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-white">Donors & Patients</h1>
                                <p className="text-sm text-pink-100/70">{hospital?.name}</p>
                            </div>
                            <Link href={`/hospital/dashboard?id=${id}`} legacyBehavior>
                                <a className="rounded-lg border border-[#F6D6E3] px-4 py-2 text-sm text-pink-100 hover:bg-white/5">
                                    Back to Dashboard
                                </a>
                            </Link>
                        </div>
                    </div>
                </header>

                <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
                    {/* Search Bar */}
                    <div className="flex justify-between items-center bg-[#131326] p-4 rounded-xl border border-[#F6D6E3]/20">
                        <div className="relative w-full max-w-md">
                            <input
                                type="text"
                                placeholder="Search donors by name or blood group..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full rounded-lg border border-[#F6D6E3]/20 bg-[#1A1A2E] pl-10 pr-4 py-2 text-sm text-white focus:border-[#E91E63] focus:outline-none"
                            />
                            <svg className="absolute left-3 top-2.5 h-4 w-4 text-pink-100/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <div className="flex border-b border-[#F6D6E3]/20 overflow-x-auto ml-4">
                            {/* Tabs moved here or kept below, keeping inline with structure */}
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-[#F6D6E3]/20 overflow-x-auto">
                        {["BLOOD", "PLATELETS", "ORGAN", "APPOINTMENTS", "COMPLETED"].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-6 py-4 text-sm font-semibold transition-all relative whitespace-nowrap ${activeTab === tab ? "text-[#E91E63]" : "text-pink-100/60 hover:text-pink-100"
                                    }`}
                            >
                                {tab === "BLOOD" ? "Blood Request" : tab === "COMPLETED" ? "Completed Donors" : tab === "APPOINTMENTS" ? "Doctor Appointments" : `${tab.charAt(0) + tab.slice(1).toLowerCase()} Requests`}
                                {activeTab === tab && (
                                    <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#E91E63]" />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    {activeTab === "COMPLETED" ? (
                        <div className="grid gap-8">
                            {/* Regular Visits Section */}
                            <div className="space-y-4">
                                <h2 className="text-xl font-bold text-white uppercase tracking-wider">Completed Donor Visits & History</h2>
                                {visits.length > 0 ? (
                                    <div className="overflow-hidden rounded-xl border border-[#F6D6E3]/30 bg-[#131326]">
                                        <table className="w-full text-left text-sm text-pink-100/80">
                                            <thead className="bg-[#1A1A2E] text-xs font-semibold uppercase text-pink-100/60">
                                                <tr>
                                                    <th className="px-6 py-4">User Details</th>
                                                    <th className="px-6 py-4">Purpose</th>
                                                    <th className="px-6 py-4">Date & Time</th>
                                                    <th className="px-6 py-4">Status & Payment</th>
                                                    <th className="px-6 py-4">Notes & Rewards</th>
                                                    <th className="px-6 py-4">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[#F6D6E3]/10">
                                                {visits.map((visit) => {
                                                    const patient = visit.patient || {}
                                                    return (
                                                        <tr key={visit.id} className="hover:bg-white/5 transition">
                                                            <td className="px-6 py-4">
                                                                <div className="font-semibold text-white">
                                                                    {patient.first_name || patient.username} {patient.last_name || ""}
                                                                </div>
                                                                <div className="text-xs">{patient.email}</div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex flex-col">
                                                                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider shadow-sm ${visit.visit_purpose === "BLOOD_DONATION" ? "bg-red-500/20 text-red-500 border border-red-500/30" :
                                                                        visit.visit_purpose === "PLATELET_DONATION" ? "bg-amber-500/20 text-amber-500 border border-amber-500/30" :
                                                                            visit.visit_purpose === "ORGAN_DONATION" ? "bg-purple-500/20 text-purple-500 border border-purple-500/30" :
                                                                                visit.visit_purpose === "CONSULTATION" ? "bg-blue-500/20 text-blue-500 border border-blue-500/30" :
                                                                                    "bg-pink-500/20 text-pink-500 border border-pink-500/30"
                                                                        }`}>
                                                                        {visit.visit_purpose === "BLOOD_DONATION" && "🩸"}
                                                                        {visit.visit_purpose === "PLATELET_DONATION" && "🧬"}
                                                                        {visit.visit_purpose === "ORGAN_DONATION" && "🫀"}
                                                                        {visit.visit_purpose === "CONSULTATION" && "🩺"}
                                                                        {visit.visit_purpose?.replace("_", " ")}
                                                                    </span>
                                                                    {visit.doctor?.name && (
                                                                        <span className="text-[10px] text-pink-100/60 mt-1.5 flex items-center gap-1">
                                                                            <span className="h-1 w-1 rounded-full bg-blue-400"></span>
                                                                            Dr. {visit.doctor.name}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-xs">
                                                                {new Date(visit.visit_date).toLocaleString()}
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex flex-col gap-1">
                                                                    <span className={`text-xs font-semibold ${visit.payment_status === "PAID" ? "text-green-400" : "text-yellow-400"}`}>
                                                                        {visit.payment_status}
                                                                    </span>
                                                                    <span className="text-xs opacity-75">{visit.currency} {visit.charges}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-xs">
                                                                <div className="space-y-1">
                                                                    <div className="italic opacity-60">{visit.notes || "No notes"}</div>
                                                                    {(visit.rewards || visit.fruity_given || visit.star_reward) && (
                                                                        <div className="mt-2 p-1.5 rounded bg-blue-500/5 border border-blue-500/10">
                                                                            {visit.rewards && <div className="text-blue-300 font-medium">🎁 {visit.rewards}</div>}
                                                                            <div className="flex gap-2 mt-1">
                                                                                {visit.fruity_given && <span title="Fruity Given">🍊</span>}
                                                                                {visit.star_reward && <span title="Star Reward" className="text-yellow-500 font-bold">★ Star Reward</span>}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-xs">
                                                                <button
                                                                    onClick={() => handleDeleteVisit(visit.id)}
                                                                    className="text-red-400 hover:text-red-300 font-bold uppercase tracking-wider"
                                                                >
                                                                    Delete
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="rounded-xl border border-dashed border-[#F6D6E3]/40 bg-[#131326] p-12 text-center">
                                        <p className="text-pink-100/70">No completed donor visits recorded yet.</p>
                                    </div>
                                )}
                            </div>

                            {/* Fulfilled Organ Pledges Section */}
                            <div className="space-y-4">
                                <h2 className="text-xl font-bold text-white uppercase tracking-wider">Fulfilled Organ Pledges</h2>
                                {filteredOrganDonors.filter(d => d.status === "COMPLETED" || d.status === "BODY_RECEIVED").length > 0 ? (
                                    <div className="overflow-hidden rounded-xl border border-blue-500/30 bg-[#131326]">
                                        <table className="w-full text-left text-sm text-pink-100/80">
                                            <thead className="bg-[#1A1A2E] text-xs font-semibold uppercase text-blue-400/60">
                                                <tr>
                                                    <th className="px-6 py-4">Donor Name</th>
                                                    <th className="px-6 py-4">Organs Provided</th>
                                                    <th className="px-6 py-4">Report</th>
                                                    <th className="px-6 py-4">Payment Details</th>
                                                    <th className="px-6 py-4">Status</th>
                                                    <th className="px-6 py-4">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-blue-500/10">
                                                {filteredOrganDonors.filter(d => d.status === "COMPLETED" || d.status === "BODY_RECEIVED").map((donor) => (
                                                    <tr key={donor.id} className="hover:bg-blue-500/5 transition">
                                                        <td className="px-6 py-4">
                                                            <div className="font-semibold text-white">
                                                                {donor.user?.first_name} {donor.user?.last_name || ""}
                                                            </div>
                                                            <div className="text-xs">{donor.user?.email}</div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className="text-blue-300 font-medium">{donor.organs}</span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            {donor.pledge_report ? (
                                                                <a
                                                                    href={donor.pledge_report}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-xs font-bold text-blue-400 underline decoration-blue-500/30"
                                                                >
                                                                    View
                                                                </a>
                                                            ) : "N/A"}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col">
                                                                <span className="text-green-400 font-bold">₹{donor.payment_amount || "0"}</span>
                                                                <span className="text-[10px] text-pink-100/50">
                                                                    {donor.body_received_at ? new Date(donor.body_received_at).toLocaleString() : ""}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className="rounded bg-blue-500/20 px-2 py-1 text-[10px] font-bold text-blue-400 border border-blue-500/30">
                                                                {donor.status.replace("_", " ")}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-xs">
                                                            <button
                                                                onClick={() => handleHospitalDelete(donor.id)}
                                                                className="text-red-400 hover:text-red-300 font-bold uppercase tracking-wider"
                                                            >
                                                                Delete
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="rounded-xl border border-dashed border-blue-500/40 bg-[#131326] p-12 text-center">
                                        <p className="text-pink-100/70">No fulfilled organ pledges recorded yet.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <h2 className="text-xl font-bold text-white uppercase tracking-wider">{activeTab === 'BLOOD' ? 'Blood Request' : activeTab === 'ORGAN' ? 'Organ Registry & Pledges' : `${activeTab} Requests`}</h2>

                            {activeTab === 'ORGAN' ? (
                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    {filteredOrganDonors.length > 0 ? (
                                        filteredOrganDonors.map((donor) => {
                                            const statusColors = {
                                                PENDING: "bg-yellow-600/20 text-yellow-400 border-yellow-500/20",
                                                ACCEPTED: "bg-blue-600/10 text-blue-300 border-blue-500/10",
                                                REPORT_VERIFIED: "bg-purple-600/20 text-purple-400 border-purple-500/20",
                                                COMMITTED: "bg-green-600/20 text-green-400 border-green-500/20",
                                                BODY_RECEIVED: "bg-blue-600/20 text-blue-400 border-blue-500/20",
                                                CANCELLED: "bg-red-600/20 text-red-400 border-red-500/20",
                                                REJECTED: "bg-orange-600/20 text-orange-400 border-orange-500/20",
                                            }
                                            const statusColor = statusColors[donor.status] || "bg-gray-600/20 text-gray-400 border-gray-500/20"

                                            return (
                                                <div key={donor.id} className={`rounded-xl border bg-[#131326] p-5 shadow-lg relative overflow-hidden ${statusColor}`}>
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <p className="text-base font-bold text-white">{donor.user?.first_name} {donor.user?.last_name || "Donor"}</p>
                                                            <p className="text-xs text-pink-100/60">{donor.user?.email}</p>
                                                        </div>
                                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase ${statusColor}`}>
                                                            {donor.status}
                                                        </span>
                                                    </div>

                                                    <div className="mt-4 space-y-2">
                                                        <div className="flex items-center gap-2 text-xs text-pink-100/80">
                                                            <span className="font-semibold opacity-70">Organs:</span> {donor.organs}
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs text-pink-100/80">
                                                            <span className="font-semibold opacity-70">Blood Group:</span> {donor.blood_group}
                                                        </div>
                                                        <div className="mt-3 p-2 rounded bg-white/5 border border-white/10">
                                                            <p className="text-[10px] font-bold text-blue-300 uppercase tracking-widest mb-1.5">Documentation</p>
                                                            {donor.pledge_report ? (
                                                                <a
                                                                    href={donor.pledge_report}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="flex items-center gap-1.5 text-[10px] font-bold text-white hover:text-blue-300 transition uppercase underline decoration-blue-500/50"
                                                                >
                                                                    <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                                    </svg>
                                                                    View Verified Pledge Report
                                                                </a>
                                                            ) : (
                                                                <p className="text-[10px] text-pink-100/40 italic">No report uploaded</p>
                                                            )}
                                                        </div>
                                                        <div className="mt-3 p-2 rounded bg-white/5 border border-white/10">
                                                            <p className="text-[10px] font-bold text-blue-300 uppercase tracking-widest mb-1">Emergency Contact</p>
                                                            <p className="text-xs text-white">{donor.emergency_contact_name}</p>
                                                            <p className="text-[10px] text-pink-100/60">{donor.emergency_contact_phone} ({donor.emergency_contact_relation})</p>
                                                        </div>
                                                    </div>

                                                    <div className="mt-5 flex flex-col gap-2">
                                                        {donor.status === "PENDING" && (
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={() => handleOrganPledgeVerify(donor.id, 'verify')}
                                                                    className="flex-1 rounded-lg bg-purple-600 py-2 text-xs font-bold text-white hover:bg-purple-500 transition shadow-sm uppercase"
                                                                >
                                                                    Verify Report
                                                                </button>
                                                                <button
                                                                    onClick={() => handleOrganPledgeVerify(donor.id, 'reject')}
                                                                    className="flex-1 rounded-lg bg-red-600/20 border border-red-500/30 py-2 text-xs font-bold text-red-400 hover:bg-red-500 hover:text-white transition shadow-sm uppercase"
                                                                >
                                                                    Reject
                                                                </button>
                                                            </div>
                                                        )}
                                                        {donor.status === "REPORT_VERIFIED" && (
                                                            <p className="text-[10px] text-purple-300 font-bold text-center border border-purple-500/30 rounded py-1 bg-purple-500/10">
                                                                ✓ REPORT VERIFIED - Awaiting Donor Finalization
                                                            </p>
                                                        )}
                                                        {donor.status === "COMMITTED" && (
                                                            <button
                                                                onClick={() => setBodyReceiveModal({
                                                                    show: true,
                                                                    pledgeId: donor.id,
                                                                    amount: "",
                                                                    pdf_hash: "",
                                                                    date: new Date().toISOString().split('T')[0],
                                                                    time: new Date().toTimeString().split(' ')[0].substring(0, 5),
                                                                    reportUrl: donor.pledge_report
                                                                })}
                                                                className="w-full rounded-lg bg-blue-600 py-2 text-xs font-bold text-white hover:bg-blue-500 transition shadow-lg uppercase tracking-wider"
                                                            >
                                                                Body Received & Pay
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => generatePledgeReport(donor)}
                                                            className="w-full rounded-lg bg-pink-600/10 border border-pink-500/40 py-2 text-xs font-bold text-pink-400 hover:bg-pink-600 hover:text-white transition uppercase shadow-sm"
                                                        >
                                                            Download Pledge Report
                                                        </button>
                                                        {(donor.status === "CANCELLED" || donor.status === "BODY_RECEIVED") && (
                                                            <button
                                                                onClick={() => handleHospitalDelete(donor.id)}
                                                                className="w-full rounded-lg bg-red-600/10 border border-red-500/40 py-2 text-xs font-bold text-red-400 hover:bg-red-600 hover:text-white transition uppercase"
                                                            >
                                                                Delete Record
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })
                                    ) : (
                                        <div className="col-span-full rounded-xl border border-dashed border-[#F6D6E3]/40 bg-[#131326] p-12 text-center">
                                            <p className="text-pink-100/70">No committed organ donors in your registry.</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    {filteredRequests.length > 0 ? (
                                        filteredRequests.map((request) => {
                                            const statusColors = {
                                                PENDING: "bg-yellow-600/20 text-yellow-400 border-yellow-500/20",
                                                ACCEPTED: "bg-green-600/20 text-green-400 border-green-500/20",
                                                REJECTED: "bg-red-600/20 text-red-400 border-red-500/20",
                                                ARRIVED: "bg-blue-600/20 text-blue-400 border-blue-500/20",
                                                COMPLETED: "bg-gray-600/20 text-gray-400 border-gray-500/20",
                                            }
                                            const statusColor = statusColors[request.status] || "bg-gray-600/20 text-gray-400 border-gray-500/20"

                                            return (
                                                <div key={request.id} className={`rounded-xl border bg-[#131326] p-5 shadow-lg relative overflow-hidden ${statusColor}`}>
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <p className="text-base font-bold text-white">{request.donor?.first_name} {request.donor?.last_name || "Donor"}</p>
                                                            <p className="text-xs text-pink-100/60">{request.donor?.email}</p>
                                                        </div>
                                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase ${statusColor}`}>
                                                            {request.status}
                                                        </span>
                                                    </div>
                                                    <div className="mt-4 space-y-2">
                                                        {request.donor?.blood_group && (
                                                            <div className="flex items-center gap-2 text-xs text-pink-100/80">
                                                                <span className="font-semibold opacity-70">Blood Group:</span> {request.donor.blood_group}
                                                            </div>
                                                        )}
                                                        <div className="flex items-center gap-2 text-xs text-pink-100/80">
                                                            <span className="font-semibold opacity-70">Date:</span> {new Date(request.created_at).toLocaleDateString()}
                                                        </div>
                                                        {request.scheduled_date && (
                                                            <div className="flex items-center gap-2 text-xs text-green-300">
                                                                <span className="font-semibold">Scheduled:</span> {new Date(request.scheduled_date).toLocaleString()}
                                                            </div>
                                                        )}
                                                        {request.appointment_date && (
                                                            <div className="space-y-2">
                                                                <div className="mt-2 p-3 rounded-xl bg-white/5 border border-white/10">
                                                                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-1.5">
                                                                        <span>Consulting Doctor</span>
                                                                    </div>
                                                                    <p className="text-sm font-bold text-white">Dr. {request.doctor?.name || "N/A"}</p>
                                                                    {request.doctor?.specialization && <p className="text-[10px] text-pink-100/50">{request.doctor.specialization}</p>}
                                                                </div>
                                                                <div className={`mt-2 p-2 rounded-lg border ${request.is_paid ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                                                                    <p className="text-[10px] font-black uppercase tracking-widest flex items-center justify-between">
                                                                        <span>{request.is_paid ? '✅ Payment Verified' : '❌ UNPAID'}</span>
                                                                        {request.is_paid && <span className="opacity-70">{request.payment_receipt}</span>}
                                                                    </p>
                                                                </div>
                                                                {request.is_paid && (
                                                                    <div className="flex flex-col gap-1.5 mt-2">
                                                                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest px-1">Prescription Ready</p>
                                                                        <button
                                                                            onClick={() => { setShowInvoice(request); setInvoiceConfirmed(false); }}
                                                                            className="w-full flex items-center justify-between rounded-lg bg-indigo-600/20 border border-indigo-500/30 px-3 py-2 text-[10px] font-bold text-indigo-300 hover:bg-indigo-600/30 transition"
                                                                        >
                                                                            <span>VIEW INVOICE & RX</span>
                                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                                                                        </button>
                                                                    </div>
                                                                )}
                                                                {request.appointment_time && (
                                                                    <div className="flex items-center gap-2 text-xs text-blue-300">
                                                                        <span className="font-semibold text-blue-100/70">Slot:</span> {request.appointment_time}
                                                                    </div>
                                                                )}
                                                                {request.is_reaching && (
                                                                    <div className="mt-2 p-2 rounded-lg bg-blue-600/20 border border-blue-500/40 text-center animate-pulse">
                                                                        <p className="text-blue-400 text-[10px] font-black uppercase tracking-widest">🚀 On the Way</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                        {request.health_report && (
                                                            <div className="mt-2">
                                                                <a
                                                                    href={request.health_report}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/5 px-2 py-1 text-[10px] font-bold text-blue-300 hover:bg-blue-500/10 transition"
                                                                >
                                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                                    </svg>
                                                                    View Health Report
                                                                </a>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="mt-5 flex flex-col gap-2">
                                                        {(request.status === "PENDING" && !request.appointment_date) && (
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={() => handleConfirmArrival(request)}
                                                                    className="flex-1 rounded-lg bg-blue-600 py-2 text-xs font-bold text-white hover:bg-blue-500 transition shadow-sm uppercase"
                                                                >
                                                                    Mark Arrived
                                                                </button>
                                                                <button
                                                                    onClick={() => handleRejectRequest(request.id)}
                                                                    className="flex-1 rounded-lg bg-red-600/20 border border-red-500/30 py-2 text-xs font-bold text-red-400 hover:bg-red-500 hover:text-white transition shadow-sm uppercase"
                                                                >
                                                                    Reject
                                                                </button>
                                                            </div>
                                                        )}
                                                        {request.status === "ARRIVED" && (
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedRequest(request)
                                                                        setShowVerifyModal(true)
                                                                    }}
                                                                    className="flex-1 rounded-lg bg-green-600 py-2 text-xs font-bold text-white hover:bg-green-500 transition shadow-sm uppercase"
                                                                >
                                                                    Verify Visit
                                                                </button>
                                                                <button
                                                                    onClick={() => handleRejectArrival(request)}
                                                                    disabled={rejecting === request.id}
                                                                    className="flex-1 rounded-lg bg-red-600/10 border border-red-500/30 py-2 text-xs font-bold text-red-400 hover:bg-red-500 hover:text-white transition shadow-sm uppercase"
                                                                >
                                                                    {rejecting === request.id ? "..." : "Revert"}
                                                                </button>
                                                            </div>
                                                        )}
                                                        {(request.status === "ACCEPTED" || request.status === "APPROVED" || request.status === "SCHEDULED") && (
                                                            <div className="flex flex-col gap-2 pt-2 border-t border-white/10 mt-2">
                                                                {request.appointment_date && !request.is_reaching ? (
                                                                    <div className="w-full rounded-lg bg-white/5 border border-white/10 py-2 text-center">
                                                                        <p className="text-[10px] text-pink-100/40 font-bold uppercase tracking-wider italic">Waiting for Donor Signal</p>
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => handleConfirmArrival(request)}
                                                                        className="w-full rounded-lg bg-blue-600 py-2 text-xs font-bold text-white hover:bg-blue-500 transition shadow-lg uppercase tracking-wider"
                                                                    >
                                                                        Mark as Arrived
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => handleNotReached(request.id, !!request.appointment_date)}
                                                                    className="w-full rounded-lg bg-red-600/10 border border-red-500/40 py-2 text-xs font-bold text-red-400 hover:bg-red-600 hover:text-white transition uppercase"
                                                                >
                                                                    Not Reached
                                                                </button>
                                                            </div>
                                                        )}
                                                        {request.status === "REJECTED" && (
                                                            <button
                                                                onClick={() => setSelectedRequest(request.id)}
                                                                className="w-full rounded-lg border border-[#E91E63] py-2 text-xs text-[#E91E63] font-bold uppercase hover:bg-[#E91E63]/10"
                                                            >
                                                                Reschedule
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })
                                    ) : (
                                        <div className="col-span-full rounded-xl border border-dashed border-[#F6D6E3]/40 bg-[#131326] p-12 text-center">
                                            <p className="text-pink-100/70">No requests found in this category.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Hospital Invoice Modal */}
                {showInvoice && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A0A1A]/90 backdrop-blur-md">
                        <div className="w-full max-w-lg rounded-3xl overflow-hidden border border-white/10 bg-[#131326] shadow-2xl animate-in zoom-in-95 duration-200">
                            <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-8 text-center relative">
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
                                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Hospital Bill Copy</h2>
                                <p className="text-blue-100/80 font-mono text-sm mt-1">{showInvoice.payment_receipt || "INTERNAL_COPY"}</p>
                            </div>

                            <div className="p-8 space-y-6">
                                <div className="flex justify-between items-start border-b border-white/5 pb-6">
                                    <div>
                                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Patient Name</p>
                                        <p className="text-white font-bold text-lg leading-tight">{showInvoice.donor?.first_name} {showInvoice.donor?.last_name || "Guest Patient"}</p>
                                        <p className="text-pink-100/50 text-xs mt-1">ID: {showInvoice.donor?.id || "N/A"}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Appointment Date</p>
                                        <p className="text-white font-bold">{new Date(showInvoice.appointment_date).toLocaleDateString()}</p>
                                        {showInvoice.appointment_time && <p className="text-pink-100/50 text-xs">{showInvoice.appointment_time}</p>}
                                    </div>
                                </div>

                                <div className="bg-[#1A1A2E] rounded-2xl p-6 border border-white/5 space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-pink-100/60 text-sm">Consultation Charges</span>
                                        <span className="text-white font-mono font-bold">{showInvoice.currency} {showInvoice.charges || showInvoice.doctor?.consultation_charge}</span>
                                    </div>

                                    {showInvoice.prescription_data && (
                                        <div className="pt-4 border-t border-white/5 space-y-2">
                                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Prescription Items (RX)</p>
                                            {[...(showInvoice.prescription_data.medicines || []), ...(showInvoice.prescription_data.custom_medicines || [])].map((med, idx) => (
                                                <div key={`rx-${idx}`} className="flex justify-between items-center text-xs">
                                                    <span className="text-white font-medium">{med.name}</span>
                                                    <span className="text-pink-100/50">{med.dosage} ({med.timing?.replace('_', ' ')})</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex justify-between items-center pt-4 border-t border-white/5">
                                        <span className="text-white font-bold uppercase text-xs tracking-widest">Total Collected</span>
                                        <span className="text-green-400 text-xl font-black">
                                            {showInvoice.currency} {parseFloat(showInvoice.charges || showInvoice.doctor?.consultation_charge || 0).toFixed(2)}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <button
                                        onClick={() => setShowInvoice(null)}
                                        className="flex-1 rounded-xl bg-white/10 hover:bg-white/20 py-3 font-bold text-white transition border border-white/10"
                                    >
                                        Dismiss
                                    </button>
                                    <button
                                        onClick={() => window.print()}
                                        className="flex-1 rounded-xl bg-indigo-600 py-3 font-bold text-white shadow-lg transition hover:bg-indigo-500"
                                    >
                                        Print Copy
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Verification Modal */}
                {showVerifyModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <div className="w-full max-w-md rounded-2xl border border-[#F6D6E3]/30 bg-[#131326] p-8 shadow-2xl">
                            <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">Accept Donation</h2>
                            <p className="text-sm text-pink-100/60 mb-6">Recording donation details for <span className="text-white font-bold">{selectedRequest?.donor?.first_name}</span></p>

                            <div className="space-y-5">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-blue-300 uppercase tracking-widest mb-1.5">Date</label>
                                        <input
                                            type="date"
                                            min={new Date().toISOString().split("T")[0]}
                                            value={verifyData.visit_date}
                                            onChange={(e) => setVerifyData({ ...verifyData, visit_date: e.target.value })}
                                            className="w-full rounded-lg border border-[#F6D6E3]/20 bg-[#1A1A2E] px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none transition"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-blue-300 uppercase tracking-widest mb-1.5">Time</label>
                                        <input
                                            type="time"
                                            min={verifyData.visit_date === new Date().toISOString().split("T")[0] ? new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : undefined}
                                            value={verifyData.visit_time}
                                            onChange={(e) => setVerifyData({ ...verifyData, visit_time: e.target.value })}
                                            className="w-full rounded-lg border border-[#F6D6E3]/20 bg-[#1A1A2E] px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none transition"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-blue-300 uppercase tracking-widest mb-1.5">Rewards Granted</label>
                                    <input
                                        type="text"
                                        value={verifyData.rewards}
                                        onChange={(e) => setVerifyData({ ...verifyData, rewards: e.target.value })}
                                        className="w-full rounded-lg border border-[#F6D6E3]/20 bg-[#1A1A2E] px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none transition"
                                        placeholder="e.g. Free Health Checkup, Certificate"
                                    />
                                </div>

                                <div className="flex gap-4">
                                    <label className="flex flex-1 items-center gap-3 rounded-lg border border-[#F6D6E3]/10 bg-[#1A1A2E] px-4 py-3 cursor-pointer hover:border-pink-500/30 transition">
                                        <input
                                            type="checkbox"
                                            checked={verifyData.fruity_given}
                                            onChange={(e) => setVerifyData({ ...verifyData, fruity_given: e.target.checked })}
                                            className="h-4 w-4 rounded border-[#F6D6E3]/30 text-[#E91E63] focus:ring-[#E91E63] bg-[#131326]"
                                        />
                                        <span className="text-sm font-bold text-white">Fruity Given 🍊</span>
                                    </label>

                                    <label className="flex flex-1 items-center gap-3 rounded-lg border border-[#F6D6E3]/10 bg-[#1A1A2E] px-4 py-3 cursor-pointer hover:border-yellow-500/30 transition">
                                        <input
                                            type="checkbox"
                                            checked={verifyData.star_reward}
                                            onChange={(e) => setVerifyData({ ...verifyData, star_reward: e.target.checked })}
                                            className="h-4 w-4 rounded border-[#F6D6E3]/30 text-yellow-500 focus:ring-yellow-500 bg-[#131326]"
                                        />
                                        <span className="text-sm font-bold text-white">Star Reward ⭐</span>
                                    </label>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-blue-300 uppercase tracking-widest mb-1.5">Medicines / Prescription</label>
                                    <textarea
                                        rows={4}
                                        value={verifyData.prescription || ""}
                                        onChange={(e) => setVerifyData({ ...verifyData, prescription: e.target.value })}
                                        placeholder="Enter medicine instructions for the patient..."
                                        className="w-full rounded-lg border border-[#F6D6E3]/20 bg-[#1A1A2E] px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none transition font-mono"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-red-400 uppercase tracking-widest mb-1.5">Notes (Internal)</label>
                                    <textarea
                                        rows={3}
                                        value={verifyData.notes}
                                        onChange={(e) => setVerifyData({ ...verifyData, notes: e.target.value })}
                                        className="w-full rounded-lg border border-[#F6D6E3]/20 bg-[#1A1A2E] px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none transition"
                                    />
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        onClick={() => setShowVerifyModal(false)}
                                        className="flex-1 rounded-lg border border-[#F6D6E3]/30 py-3 text-sm font-bold text-pink-100 hover:bg-white/5 transition"
                                    >
                                        CANCEL
                                    </button>
                                    <button
                                        onClick={() => handleVerify(selectedRequest.id)}
                                        disabled={verifying}
                                        className="flex-[2] rounded-lg bg-blue-600 py-3 text-sm font-black text-white hover:bg-blue-500 shadow-lg shadow-blue-500/20 transition disabled:opacity-50"
                                    >
                                        {verifying ? "VERIFYING..." : "CONFIRM & SAVE RECORD"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Body Receive Payment Modal */}
                {bodyReceiveModal.show && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <div className="w-full max-w-sm rounded-2xl border border-blue-500/30 bg-[#131326] p-6 shadow-2xl">
                            <h3 className="text-lg font-bold text-white mb-4">Complete Donation Intake</h3>
                            <p className="text-sm text-pink-100/70 mb-4">
                                Verify the pledge report and record body reception.
                            </p>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-blue-300 uppercase mb-1.5">Blockchain Verification (PDF Hash)</label>
                                    <input
                                        type="text"
                                        value={bodyReceiveModal.pdf_hash || ""}
                                        onChange={(e) => setBodyReceiveModal({ ...bodyReceiveModal, pdf_hash: e.target.value })}
                                        className="w-full rounded-lg border border-[#F6D6E3]/20 bg-[#1A1A2E] px-4 py-2 text-xs text-white focus:border-blue-500 focus:outline-none font-mono"
                                        placeholder="Paste SHA-256 Hash from Report..."
                                    />
                                    {bodyReceiveModal.reportUrl && (
                                        <a
                                            href={bodyReceiveModal.reportUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="mt-2 inline-block text-[10px] text-blue-400 hover:text-blue-300 font-bold uppercase underline"
                                        >
                                            Open Report to Find Hash
                                        </a>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-blue-300 uppercase mb-1.5">Intake Date</label>
                                        <input
                                            type="date"
                                            value={bodyReceiveModal.date}
                                            onChange={(e) => setBodyReceiveModal({ ...bodyReceiveModal, date: e.target.value })}
                                            className="w-full rounded-lg border border-[#F6D6E3]/20 bg-[#1A1A2E] px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-blue-300 uppercase mb-1.5">Intake Time</label>
                                        <input
                                            type="time"
                                            value={bodyReceiveModal.time}
                                            onChange={(e) => setBodyReceiveModal({ ...bodyReceiveModal, time: e.target.value })}
                                            className="w-full rounded-lg border border-[#F6D6E3]/20 bg-[#1A1A2E] px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-blue-300 uppercase mb-1.5">Payment Amount (₹)</label>
                                    <input
                                        type="number"
                                        value={bodyReceiveModal.amount}
                                        onChange={(e) => setBodyReceiveModal({ ...bodyReceiveModal, amount: e.target.value })}
                                        className="w-full rounded-lg border border-[#F6D6E3]/20 bg-[#1A1A2E] px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                                        placeholder="Enter amount..."
                                    />
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={handleReceiveBody}
                                        className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-bold text-white hover:bg-blue-500 transition shadow-lg"
                                    >
                                        Verify & Intake
                                    </button>
                                    <button
                                        onClick={() => setBodyReceiveModal({ show: false, pledgeId: null, amount: "", pdf_hash: "" })}
                                        className="flex-1 rounded-lg border border-[#F6D6E3]/20 py-2 text-sm text-white hover:bg-white/5"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main >
        </>
    )
}
