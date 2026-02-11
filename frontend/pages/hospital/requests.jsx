import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import { useState, useEffect } from "react"
import { apiFetch } from "../../lib/api"
import { generatePledgeReport } from "../../lib/pdf-generator"

export default function HospitalRequests() {
	const router = useRouter()
	const { id } = router.query
	const [hospital, setHospital] = useState(null)
	const [donationRequests, setDonationRequests] = useState([])
	const [organPledges, setOrganPledges] = useState([])
	const [deceasedRequests, setDeceasedRequests] = useState([])
	const [ambulanceRequests, setAmbulanceRequests] = useState([])
	const [loading, setLoading] = useState(true)
	const [activeTab, setActiveTab] = useState("BLOOD")
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
			await Promise.all([
				loadDonationRequests(hospitalData.id || id),
				loadOrganPledges(),
				loadDeceasedRequests(hospitalData.id || id),
				loadAmbulanceRequests()
			])
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

	async function loadOrganPledges() {
		try {
			const data = await apiFetch("/organ-donors/")
			setOrganPledges(data)
		} catch (error) {
			console.error("Error loading organ pledges:", error)
			setOrganPledges([])
		}
	}

	async function loadDeceasedRequests(hospitalId) {
		try {
			const data = await apiFetch(`/deceased-donor-requests/?hospital=${hospitalId}`)
			setDeceasedRequests(data)
		} catch (error) {
			console.error("Error loading deceased donor requests:", error)
			setDeceasedRequests([])
		}
	}

	async function loadAmbulanceRequests() {
		try {
			const data = await apiFetch("/ambulance-requests/")
			setAmbulanceRequests(data)
		} catch (error) {
			console.error("Error loading ambulance requests:", error)
			setAmbulanceRequests([])
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

	async function handleAcceptOrganPledge(pledgeId) {
		const message = prompt("Enter commitment message for the donor:", "Your emergency contact will come and give the report after your death then only this will be accepted");
		if (message === null) return;

		try {
			await apiFetch(`/organ-donors/${pledgeId}/accept_pledge/`, {
				method: "POST",
				body: JSON.stringify({ message }),
			})
			await loadOrganPledges()
			alert("Pledge accepted and message sent to donor!")
			router.push("/register/organ")
		} catch (error) {
			alert("Error accepting pledge: " + error.message)
		}
	}

	async function handleVerifyOrganPledge(donorId, reportFileUrl) {
		if (!reportFileUrl) {
			alert("No report file available for verification.")
			return
		}

		try {
			// Trigger hospital-side verification on the backend
			const response = await apiFetch(`/organ-donors/${donorId}/hospital_verify/`, {
				method: "POST",
				body: JSON.stringify({ decision: 'verify' })
			})

			if (response.blockchain_record) {
				alert(`Verification Success!\n\nBlockchain ID: ${response.blockchain_record.download_id}\nTimestamp: ${new Date(response.blockchain_record.timestamp).toLocaleString()}\nHash: ${response.blockchain_record.pdf_hash}\n\nThis report is authentic. Waiting for donor's final confirmation.`);
			} else {
				alert("Report verified. Waiting for donor's final confirmation.");
			}
			loadOrganPledges()
		} catch (error) {
			console.error("Verification error:", error)
			alert("Blockchain verification FAILED. The report content does not match our integrity ledger.")
		}
	}

	async function handleRejectOrganPledge(donorId) {
		if (!confirm("Are you sure you want to REJECT this report? This will delete the pledge and the donor will have to start over.")) return

		try {
			await apiFetch(`/organ-donors/${donorId}/hospital_verify/`, {
				method: "POST",
				body: JSON.stringify({ decision: 'reject' })
			})
			alert("Pledge report rejected.")
			loadOrganPledges()
		} catch (error) {
			alert("Error rejecting pledge: " + error.message)
		}
	}

	async function handleProcessDeceasedRequest(requestId, decision) {
		const notes = decision === "REJECTED" ? prompt("Enter reason for rejection:") : "";
		if (decision === "REJECTED" && !notes) return;

		try {
			await apiFetch(`/deceased-donor-requests/${requestId}/process_request/`, {
				method: "POST",
				body: JSON.stringify({ decision, notes })
			})
			alert(`Request ${decision.toLowerCase()} successfully!`)
			loadDeceasedRequests(hospital?.id || id)
		} catch (error) {
			alert("Error processing request: " + error.message)
		}
	}

	async function handleAcceptAmbulance(requestId) {
		try {
			await apiFetch(`/ambulance-requests/${requestId}/accept/`, { method: "POST" })
			alert("Ambulance dispatched!")
			loadAmbulanceRequests()
		} catch (error) {
			alert("Error: " + error.message)
		}
	}

	async function handleCompleteAmbulance(requestId) {
		try {
			await apiFetch(`/ambulance-requests/${requestId}/complete/`, { method: "POST" })
			alert("Life Saved! Reward issued to reporter.")
			loadAmbulanceRequests()
		} catch (error) {
			alert("Error: " + error.message)
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

	const filteredRequests = donationRequests.filter(r => (r.request_type || "BLOOD") === activeTab)

	const pendingRequests = filteredRequests.filter(r => r.status === "PENDING")
	const acceptedRequests = filteredRequests.filter(r => r.status === "ACCEPTED")
	const rejectedRequests = filteredRequests.filter(r => r.status === "REJECTED")

	const activeOrganPledges = activeTab === "ORGAN" ? organPledges.filter(p => p.status === "PENDING" || p.status === "ACCEPTED" || p.status === "COMMITTED" || p.status === "CANCELLED" || p.status === "REJECTED" || p.status === "REPORT_VERIFIED") : []

	return (
		<>
			<Head>
				<title>Donation Requests — {hospital?.name || "Hospital"} Dashboard</title>
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
					{/* Tabs */}
					<div className="mb-8 flex border-b border-[#F6D6E3]/20 overflow-x-auto">
						{["BLOOD", "PLATELETS", "ORGAN", "AMBULANCE"].map((tab) => (
							<button
								key={tab}
								onClick={() => setActiveTab(tab)}
								className={`px-6 py-4 text-sm font-semibold transition-all relative whitespace-nowrap ${activeTab === tab ? "text-[#E91E63]" : "text-pink-100/60 hover:text-pink-100"
									}`}
							>
								{tab === "BLOOD" ? "Blood Request" : tab === "AMBULANCE" ? "🚨 Ambulance" : tab === "COMPLETED" ? "Completed Donors" : `${tab.charAt(0) + tab.slice(1).toLowerCase()} Requests`}
								{activeTab === tab && (
									<div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#E91E63]" />
								)}
							</button>
						))}
					</div>
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
						{filteredRequests.length === 0 ? (
							<div className="text-center py-12 rounded-xl bg-[#131326] border border-[#F6D6E3]/20 border-dashed">
								<p className="text-pink-100/50">No requests found in this category.</p>
							</div>
						) : (
							filteredRequests.map((request) => {
								const donor = request.donor || {}
								const statusColors = {
									PENDING: "bg-yellow-600/20 text-yellow-400",
									ACCEPTED: "bg-green-600/20 text-green-400",
									REPORT_VERIFIED: "bg-blue-600/20 text-blue-400",
									REJECTED: "bg-red-600/20 text-red-400",
									COMPLETED: "bg-indigo-600/20 text-indigo-400",
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
												{request.health_report && (
													<div className="mt-2">
														<a
															href={request.health_report}
															target="_blank"
															rel="noopener noreferrer"
															className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/5 px-2 py-1 text-[10px] font-bold text-blue-300 hover:bg-blue-500/10 transition"
														>
															<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
															</svg>
															View Health Report
														</a>
													</div>
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
														Arrived
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
							})
						)}

						{activeTab === "ORGAN" && (
							<>
								<div className="space-y-4">
									{activeOrganPledges.length === 0 ? (
										<div className="text-center py-12 rounded-xl bg-[#131326] border border-[#F6D6E3]/20 border-dashed">
											<p className="text-pink-100/50">No organ requests found.</p>
										</div>
									) : (
										activeOrganPledges.map((pledge) => (
											<div key={pledge.id} className="rounded-xl border border-[#F6D6E3]/40 bg-[#131326] p-6 shadow-lg shadow-blue-500/5">
												<div className="flex items-start justify-between">
													<div className="flex-1">
														<div className="flex items-center gap-3 mb-2">
															<h3 className="text-lg font-semibold text-white">
																{pledge.user?.first_name || pledge.user?.username} {pledge.user?.last_name || ""}
															</h3>
															<span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${pledge.status === 'ACCEPTED' || pledge.status === 'REPORT_VERIFIED' || pledge.status === 'COMMITTED' ? 'bg-green-600/20 text-green-400' :
																pledge.status === 'CANCELLED' || pledge.status === 'REJECTED' ? 'bg-red-600/20 text-red-400' :
																	'bg-yellow-600/20 text-yellow-400'
																}`}>
																{pledge.status}
															</span>
														</div>
														<p className="text-sm text-pink-100/70">
															Pledged Organs: <span className="text-blue-400 font-bold uppercase">{pledge.organs || "Internal Organs"}</span>
														</p>
														<div className="mt-4 grid gap-4 text-xs text-pink-100/60 sm:grid-cols-2">
															<div>
																<p className="font-semibold text-pink-100/80 mb-1">Donor Profile</p>
																<p>Blood Group: <span className="text-white">{pledge.blood_group || "N/A"}</span></p>
																<p>Contact: {pledge.phone || "N/A"}</p>
															</div>
															<div>
																<p className="font-semibold text-pink-100/80 mb-1">Emergency Beneficiary</p>
																<p>{pledge.emergency_contact_name} ({pledge.emergency_contact_phone})</p>
																<p>Relation: {pledge.emergency_contact_relation}</p>
															</div>
														</div>
														{pledge.pledge_report && (
															<div className="mt-4 flex items-center gap-3">
																<span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20 text-blue-400">
																	<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
																		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
																	</svg>
																</span>
																<div>
																	<p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Verified Report Attached</p>
																	<a
																		href={pledge.pledge_report}
																		target="_blank"
																		rel="noopener noreferrer"
																		className="text-xs font-semibold text-white underline hover:text-blue-300 transition"
																	>
																		View Secure Pledge Report (PDF)
																	</a>
																</div>
															</div>
														)}
													</div>
													<div className="flex flex-col gap-2 ml-4 min-w-[160px]">
														{pledge.status === "PENDING" && (
															<button
																onClick={() => handleAcceptOrganPledge(pledge.id)}
																className="w-full rounded-lg bg-[#E91E63] py-2 text-xs font-bold text-white hover:opacity-90 transition shadow-lg uppercase tracking-wider"
															>
																Accept Pledge
															</button>
														)}
														{pledge.pledge_report && (
															<div className="space-y-2 mt-2">
																<a
																	href={pledge.pledge_report}
																	target="_blank"
																	rel="noopener noreferrer"
																	className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/5 px-2 py-2 text-[10px] font-bold text-blue-300 hover:bg-blue-500/10 transition uppercase"
																>
																	<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
																		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
																	</svg>
																	View Details
																</a>
																<button
																	onClick={() => handleVerifyOrganPledge(pledge.id, pledge.pledge_report)}
																	className="w-full rounded-lg bg-green-600/20 border border-green-500/40 py-2 text-xs font-bold text-green-400 hover:bg-green-600 hover:text-white transition uppercase tracking-wider"
																>
																	Verified ✅
																</button>
																<button
																	onClick={() => handleRejectOrganPledge(pledge.id)}
																	className="w-full rounded-lg bg-red-600/20 border border-red-500/40 py-2 text-xs font-bold text-red-400 hover:bg-red-600 hover:text-white transition uppercase tracking-wider"
																>
																	Rejected ❌
																</button>
															</div>
														)}
													</div>
												</div>
											</div>
										))
									)}

								</div>

								<div className="mt-12">
									<h3 className="text-xl font-bold text-white mb-6 border-b border-[#F6D6E3]/20 pb-2">Deceased Donor Requests</h3>
									{deceasedRequests.length === 0 ? (
										<div className="text-center py-8 rounded-xl bg-[#131326] border border-[#F6D6E3]/20 border-dashed">
											<p className="text-pink-100/50">No deceased donor requests found.</p>
										</div>
									) : (
										<div className="space-y-4">
											{deceasedRequests.map((req) => (
												<div key={req.id} className="rounded-xl border border-[#F6D6E3]/40 bg-[#131326] p-6 shadow-lg">
													<div className="flex justify-between items-start">
														<div>
															<div className="flex items-center gap-3 mb-2">
																<h4 className="text-lg font-bold text-white">{req.deceased_name}</h4>
																<span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${req.status === 'APPROVED' ? 'bg-green-600/20 text-green-400' :
																	req.status === 'REJECTED' || req.status === 'CANCELLED' ? 'bg-red-600/20 text-red-400' :
																		'bg-yellow-600/20 text-yellow-400'
																	}`}>
																	{req.status}
																</span>
															</div>
															<p className="text-sm text-pink-100/80">
																<span className="font-semibold">Requester:</span> {req.requester_name} ({req.requester_relation})
															</p>
															<p className="text-sm text-pink-100/80">
																<span className="font-semibold">Contact:</span> {req.requester_phone}
															</p>
															<p className="mt-2 text-sm text-pink-100/70">
																<span className="font-semibold text-blue-400">Organs Available:</span> {req.organs_available}
															</p>
															<div className="mt-2 text-xs text-pink-100/60">
																<p>Date of Death: {req.deceased_date_of_death}</p>
																<p>Hospital: {req.hospital_name || "N/A"}</p>
															</div>
															{req.notes && (
																<div className="mt-3 p-2 rounded bg-white/5 text-xs text-pink-100/80 italic">
																	"{req.notes}"
																</div>
															)}
														</div>

														{req.status === "PENDING" && (
															<div className="flex flex-col gap-2">
																<button
																	onClick={() => handleProcessDeceasedRequest(req.id, "APPROVED")}
																	className="rounded-lg bg-green-600 px-4 py-2 text-xs font-bold text-white hover:bg-green-700 transition uppercase"
																>
																	Accept
																</button>
																<button
																	onClick={() => handleProcessDeceasedRequest(req.id, "REJECTED")}
																	className="rounded-lg bg-red-600/20 border border-red-500/40 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-600 hover:text-white transition uppercase"
																>
																	Reject
																</button>
															</div>
														)}
													</div>
												</div>
											))}
										</div>
									)}
								</div>
							</>
						)}
						{activeTab === "AMBULANCE" && (
							<div className="space-y-4">
								{ambulanceRequests.length === 0 ? (
									<div className="text-center py-12 rounded-xl bg-[#131326] border border-[#F6D6E3]/20 border-dashed">
										<p className="text-pink-100/50">No ambulance requests found.</p>
									</div>
								) : (
									ambulanceRequests.map((req) => (
										<div key={req.id} className="rounded-xl border border-red-500/30 bg-[#131326] p-6 shadow-lg shadow-red-500/5">
											<div className="flex justify-between items-start">
												<div>
													<div className="flex items-center gap-3 mb-2">
														<h3 className="text-lg font-bold text-white">
															{req.patient_name || "Emergency Patient"}
														</h3>
														<span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${req.status === 'COMPLETED' ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-100'}`}>
															{req.status}
														</span>
													</div>
													<p className="text-sm text-pink-100/80">
														<span className="text-red-400 font-bold">Location:</span> {req.location}
													</p>
													<p className="text-sm text-pink-100/80">
														<span className="text-red-400 font-bold">Phone:</span> {req.contact_phone}
													</p>
													<p className="mt-2 text-xs text-pink-100/50">
														Reporter: {req.reporter?.username || "Anonymous"} • {new Date(req.created_at).toLocaleString()}
													</p>
												</div>
												<div className="flex flex-col gap-2">
													{req.status === "PENDING" && (
														<button
															onClick={() => handleAcceptAmbulance(req.id)}
															className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 transition uppercase"
														>
															Dispatch Ambulance 🚑
														</button>
													)}
													{req.status === "ACCEPTED" && (
														<button
															onClick={() => handleCompleteAmbulance(req.id)}
															className="rounded-lg bg-green-600 px-4 py-2 text-xs font-bold text-white hover:bg-green-700 transition uppercase"
														>
															Mark Completed (Patient Admitted)
														</button>
													)}
													{req.status === "COMPLETED" && (
														<div className="text-[10px] text-green-400 font-bold uppercase border border-green-400/30 bg-green-400/10 px-2 py-1 rounded">
															Life Saved ✨
														</div>
													)}
												</div>
											</div>
										</div>
									))
								)}
							</div>
						)}
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
											min={new Date().toISOString().split("T")[0]}
											value={rescheduleForm.date}
											onChange={(e) => setRescheduleForm({ ...rescheduleForm, date: e.target.value })}
											className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
										/>
									</div>
									<div>
										<label className="block text-sm font-medium text-pink-100 mb-1">Time</label>
										<input
											type="time"
											min={rescheduleForm.date === new Date().toISOString().split("T")[0] ? new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : undefined}
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
