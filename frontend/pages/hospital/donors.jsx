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
        fruity_given: true,
        star_reward: true,
        notes: "",
        visit_date: new Date().toISOString().split('T')[0],
        visit_time: new Date().toTimeString().split(' ')[0].substring(0, 5)
    })
    const [verifying, setVerifying] = useState(false)
    const [rejecting, setRejecting] = useState(false)
    const [searchQuery, setSearchQuery] = useState("") // Added Search State
    const [bodyReceiveModal, setBodyReceiveModal] = useState({ show: false, pledgeId: null, amount: "" }) // Added Body Receive Modal State

    useEffect(() => {
        if (id) {
            loadData()
        }
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
            setOrganDonors(data.filter(p => ["COMMITTED", "BODY_RECEIVED", "COMPLETED", "CANCELLED"].includes(p.status)))
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
            const isAppointment = !!selectedRequest.appointment_date
            const endpoint = isAppointment
                ? `/appointments/${requestId}/hospital_verify/`
                : `/donation-requests/${requestId}/hospital_verify/`

            await apiFetch(endpoint, {
                method: "POST",
                body: JSON.stringify({
                    ...verifyData,
                    visit_date: `${verifyData.visit_date}T${verifyData.visit_time}:00Z`
                })
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

    async function handleConfirmArrival(requestId) {
        if (!confirm("Confirm that the donor has physically arrived at the hospital?")) {
            return
        }
        try {
            await apiFetch(`/donation-requests/${requestId}/confirm_arrival/`, {
                method: "POST"
            })
            alert("Donor arrival confirmed!")
            if (hospital) {
                loadDonationRequests(hospital.id)
            }
        } catch (error) {
            console.error("Error confirming arrival:", error)
            alert("Failed to confirm arrival. Please try again.")
        }
    }

    async function handleRejectArrival(requestId) {
        if (!confirm("Are you sure you want to reject this arrival? The donor will be notified and moved back to 'Accepted' status.")) {
            return
        }
        setRejecting(requestId)
        try {
            await apiFetch(`/donation-requests/${requestId}/reject_arrival/`, {
                method: "POST"
            })
            alert("Arrival rejected successfully.")
            if (hospital) {
                loadDonationRequests(hospital.id)
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
            await apiFetch(`/organ-donors/${bodyReceiveModal.pledgeId}/receive_body/`, {
                method: "POST",
                body: JSON.stringify({ payment_amount: bodyReceiveModal.amount })
            });
            await loadOrganDonors();
            alert("Body reception and payment recorded successfully.");
            setBodyReceiveModal({ show: false, pledgeId: null, amount: "" });
        } catch (error) {
            alert("Error recording body reception: " + error.message);
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
    const filteredRequests = activeTab === "COMPLETED" ? [] : [
        ...donationRequests.filter(r => (r.request_type || "BLOOD") === activeTab && r.status !== "PENDING"),
        ...(activeTab === "APPOINTMENTS" ? appointments.filter(a => ["PENDING", "APPROVED", "SCHEDULED", "RESCHEDULED"].includes(a.status)) : [])
    ].filter(item => {
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
                                                                    <span className="rounded bg-[#E91E63]/10 px-2 py-1 text-xs font-medium text-[#E91E63] w-fit">
                                                                        {visit.visit_purpose?.replace("_", " ")}
                                                                    </span>
                                                                    {visit.doctor?.name && (
                                                                        <span className="text-[10px] text-pink-100/60 mt-1">
                                                                            👨‍⚕️ {visit.doctor.name}
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
                                                    <th className="px-6 py-4">Blood Group</th>
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
                                                        <td className="px-6 py-4 text-xs">
                                                            {donor.blood_group}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col">
                                                                <span className="text-green-400 font-bold">₹{donor.payment_amount || "0"}</span>
                                                                <span className="text-[10px] text-pink-100/50">
                                                                    {donor.body_received_at ? new Date(donor.body_received_at).toLocaleDateString() : ""}
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
                                                COMMITTED: "bg-green-600/20 text-green-400 border-green-500/20",
                                                BODY_RECEIVED: "bg-blue-600/20 text-blue-400 border-blue-500/20",
                                                CANCELLED: "bg-red-600/20 text-red-400 border-red-500/20",
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
                                                            <p className="text-[10px] font-bold text-blue-300 uppercase tracking-widest mb-1">Emergency Contact</p>
                                                            <p className="text-xs text-white">{donor.emergency_contact_name}</p>
                                                            <p className="text-[10px] text-pink-100/60">{donor.emergency_contact_phone} ({donor.emergency_contact_relation})</p>
                                                        </div>
                                                    </div>

                                                    <div className="mt-5 flex flex-col gap-2">
                                                        {donor.status === "COMMITTED" && (
                                                            <button
                                                                onClick={() => setBodyReceiveModal({ show: true, pledgeId: donor.id, amount: "" })}
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
                                                                    onClick={() => handleAcceptRequest(request.id)}
                                                                    className="flex-1 rounded-lg bg-green-600 py-2 text-xs font-bold text-white hover:bg-green-500 transition shadow-sm uppercase"
                                                                >
                                                                    Arrived
                                                                </button>
                                                                <button
                                                                    onClick={() => handleRejectRequest(request.id)}
                                                                    className="flex-1 rounded-lg bg-red-600/20 border border-red-500/30 py-2 text-xs font-bold text-red-400 hover:bg-red-500 hover:text-white transition shadow-sm uppercase"
                                                                >
                                                                    Reject
                                                                </button>
                                                            </div>
                                                        )}
                                                        {(request.status === "ARRIVED" || request.status === "SCHEDULED" || request.status === "ACCEPTED" || request.status === "APPROVED") && (
                                                            <div className="flex flex-col gap-2 pt-2 border-t border-white/10 mt-2">
                                                                {request.status === "ACCEPTED" || request.status === "APPROVED" || request.status === "SCHEDULED" ? (
                                                                    <button
                                                                        onClick={() => handleConfirmArrival(request.id)}
                                                                        className="w-full rounded-lg bg-blue-600 py-2 text-xs font-bold text-white hover:bg-blue-500 transition shadow-lg uppercase tracking-wider"
                                                                    >
                                                                        Mark as Arrived
                                                                    </button>
                                                                ) : request.status === "ARRIVED" ? (
                                                                    <button
                                                                        onClick={() => {
                                                                            setSelectedRequest(request)
                                                                            setShowVerifyModal(true)
                                                                        }}
                                                                        className="w-full rounded-lg bg-green-600 py-2 text-xs font-bold text-white hover:bg-green-500 transition shadow-lg uppercase tracking-wider"
                                                                    >
                                                                        He has reached the hospital
                                                                    </button>
                                                                ) : null}
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
                                    <label className="block text-[10px] font-black text-blue-300 uppercase tracking-widest mb-1.5">Hospital Notes</label>
                                    <textarea
                                        rows={3}
                                        value={verifyData.notes}
                                        onChange={(e) => setVerifyData({ ...verifyData, notes: e.target.value })}
                                        className="w-full rounded-lg border border-[#F6D6E3]/20 bg-[#1A1A2E] px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none transition"
                                        placeholder="Add any internal medical notes..."
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
                            <h3 className="text-lg font-bold text-white mb-4">Complete Donation</h3>
                            <p className="text-sm text-pink-100/70 mb-4">
                                Confirm body receipt and enter payment amount for the donor's family/contact.
                            </p>
                            <label className="block text-xs font-bold text-blue-300 uppercase mb-2">Payment Amount (₹)</label>
                            <input
                                type="number"
                                value={bodyReceiveModal.amount}
                                onChange={(e) => setBodyReceiveModal({ ...bodyReceiveModal, amount: e.target.value })}
                                className="w-full rounded-lg border border-[#F6D6E3]/20 bg-[#1A1A2E] px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none mb-6"
                                placeholder="Enter amount..."
                            />
                            <div className="flex gap-3">
                                <button
                                    onClick={handleReceiveBody}
                                    className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-bold text-white hover:bg-blue-500"
                                >
                                    Confirm & Pay
                                </button>
                                <button
                                    onClick={() => setBodyReceiveModal({ show: false, pledgeId: null, amount: "" })}
                                    className="flex-1 rounded-lg border border-[#F6D6E3]/20 py-2 text-sm text-white hover:bg-white/5"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main >
        </>
    )
}
