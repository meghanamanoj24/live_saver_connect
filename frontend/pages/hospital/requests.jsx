import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import { useState, useEffect } from "react"
import { apiFetch } from "../../lib/api"

export default function HospitalRequests() {
	const router = useRouter()
	const { id } = router.query
	const [hospital, setHospital] = useState(null)
	const [donationRequests, setDonationRequests] = useState([])
	const [loading, setLoading] = useState(true)
	const [selectedRequest, setSelectedRequest] = useState(null)
	const [rescheduleForm, setRescheduleForm] = useState({ date: "", time: "" })

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
			await loadDonationRequests(hospitalData.id || id)
		} catch (error) {
			console.error("Error loading data:", error)
		} finally {
			setLoading(false)
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
			alert("Request rejected. User can select another date/time.")
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

	if (loading) {
		return (
			<main className="min-h-screen bg-[#1A1A2E] text-white flex items-center justify-center">
				<div className="text-center">
					<div className="h-12 w-12 animate-spin rounded-full border-4 border-[#E91E63] border-t-transparent mx-auto" />
					<p className="mt-4 text-pink-100/70">Loading requests...</p>
				</div>
			</main>
		)
	}

	const pendingRequests = donationRequests.filter(r => r.status === "PENDING")
	const acceptedRequests = donationRequests.filter(r => r.status === "ACCEPTED")
	const rejectedRequests = donationRequests.filter(r => r.status === "REJECTED")

	return (
		<>
			<Head>
				<title>Requests — {hospital?.name || "Hospital"} Dashboard</title>
			</Head>
			<main className="min-h-screen bg-[#1A1A2E] text-white">
				<header className="border-b border-[#F6D6E3]/30 bg-[#131326]/80 backdrop-blur sticky top-0 z-10">
					<div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
						<div className="flex items-center justify-between">
							<div>
								<h1 className="text-2xl font-bold text-white">Donation Requests</h1>
								<p className="text-sm text-pink-100/70">{hospital?.name}</p>
							</div>
							<div className="flex gap-2">
								<Link href={`/hospital/dashboard?id=${id}`} legacyBehavior>
									<a className="rounded-lg border border-[#F6D6E3] px-4 py-2 text-sm text-pink-100 hover:bg-white/5">
										Back to Dashboard
									</a>
								</Link>
							</div>
						</div>
					</div>
				</header>

				<div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
					<div className="mb-6 flex gap-4">
						<span className="rounded-full bg-yellow-600/20 px-3 py-1 text-sm text-yellow-400">
							{pendingRequests.length} Pending
						</span>
						<span className="rounded-full bg-green-600/20 px-3 py-1 text-sm text-green-400">
							{acceptedRequests.length} Accepted
						</span>
						<span className="rounded-full bg-red-600/20 px-3 py-1 text-sm text-red-400">
							{rejectedRequests.length} Rejected
						</span>
					</div>

					<div className="space-y-4">
						{donationRequests.map((request) => {
							const donor = request.donor || {}
							const statusColors = {
								PENDING: "bg-yellow-600/20 text-yellow-400",
								ACCEPTED: "bg-green-600/20 text-green-400",
								REJECTED: "bg-red-600/20 text-red-400",
								COMPLETED: "bg-blue-600/20 text-blue-400",
							}
							const statusColor = statusColors[request.status] || "bg-gray-600/20 text-gray-400"

							return (
								<div key={request.id} className="rounded-xl border border-[#F6D6E3]/40 bg-[#131326] p-6">
									<div className="flex items-start justify-between">
										<div className="flex-1">
											<div className="flex items-center gap-3 mb-2">
												<h3 className="text-lg font-semibold text-white">
													{donor.first_name || donor.username || "Donor"} {donor.last_name || ""}
												</h3>
												<span className={`rounded-full px-2 py-1 text-xs font-medium ${statusColor}`}>
													{request.status || "PENDING"}
												</span>
											</div>
											<p className="mt-1 text-sm text-pink-100/70">Email: {donor.email || "Not provided"} | Phone: {donor.phone || "N/A"}</p>
											<p className="mt-1 text-xs text-pink-100/50">Location: {donor.city || "N/A"}, {donor.zip_code || ""}</p>
											{request.message && <div className="mt-3 p-3 rounded bg-white/5 border border-white/10 text-sm text-pink-100/80 italic">"{request.message}"</div>}
											{request.scheduled_date && (
												<p className="mt-2 text-sm text-pink-100/70">
													Scheduled: {new Date(request.scheduled_date).toLocaleString()}
												</p>
											)}
											<p className="mt-2 text-xs text-pink-100/60">
												Requested: {new Date(request.created_at || Date.now()).toLocaleString()}
											</p>
										</div>
										{request.status === "PENDING" && (
											<div className="flex gap-2 ml-4">
												<button
													onClick={() => handleAcceptRequest(request.id)}
													className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
												>
													Accept
												</button>
												<button
													onClick={() => handleRejectRequest(request.id)}
													className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
												>
													Reject
												</button>
											</div>
										)}
										{request.status === "REJECTED" && (
											<button
												onClick={() => setSelectedRequest(request.id)}
												className="rounded-lg border border-[#E91E63] px-4 py-2 text-sm text-[#E91E63] hover:bg-[#E91E63]/10"
											>
												Reschedule
											</button>
										)}
									</div>
								</div>
							)
						})}
					</div>

					{selectedRequest && (
						<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
							<div className="bg-[#131326] rounded-xl border border-[#F6D6E3]/40 p-6 max-w-md w-full mx-4">
								<h3 className="text-xl font-bold text-white mb-4">Reschedule Appointment</h3>
								<div className="space-y-4">
									<div>
										<label className="block text-sm font-medium text-pink-100 mb-1">Date</label>
										<input
											type="date"
											value={rescheduleForm.date}
											onChange={(e) => setRescheduleForm({ ...rescheduleForm, date: e.target.value })}
											className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
										/>
									</div>
									<div>
										<label className="block text-sm font-medium text-pink-100 mb-1">Time</label>
										<input
											type="time"
											value={rescheduleForm.time}
											onChange={(e) => setRescheduleForm({ ...rescheduleForm, time: e.target.value })}
											className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
										/>
									</div>
									<div className="flex gap-2">
										<button
											onClick={() => handleRescheduleRequest(selectedRequest)}
											className="flex-1 rounded-lg bg-[#E91E63] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
										>
											Reschedule
										</button>
										<button
											onClick={() => {
												setSelectedRequest(null)
												setRescheduleForm({ date: "", time: "" })
											}}
											className="rounded-lg border border-[#F6D6E3] px-4 py-2 text-sm text-pink-100 hover:bg-white/5"
										>
											Cancel
										</button>
									</div>
								</div>
							</div>
						</div>
					)}
				</div>
			</main>
		</>
	)
}
