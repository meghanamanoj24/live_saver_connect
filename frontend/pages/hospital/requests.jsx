import Head from "next/head"
import Link from "next/link"
import { useState, useEffect } from "react"
import { apiFetch } from "../../lib/api"

const DONATION_REQUESTS_STORAGE_KEY = "lifesaver:donation_requests"

export default function HospitalRequests() {
	const [requests, setRequests] = useState([])
	const [loading, setLoading] = useState(true)
	const [selectedHospital, setSelectedHospital] = useState(null)
	const [hospitals, setHospitals] = useState([])
	const [message, setMessage] = useState("")

	useEffect(() => {
		loadHospitals()
	}, [])

	useEffect(() => {
		if (selectedHospital) {
			loadRequests()
		}
	}, [selectedHospital])

	async function loadHospitals() {
		try {
			const data = await apiFetch("/hospitals/")
			setHospitals(data)
			if (data.length > 0) {
				setSelectedHospital(data[0].id)
			}
		} catch (error) {
			// Fallback: Use localStorage or hardcoded hospitals
			const hardcodedHospitals = [
				{ id: 1, name: "City General Hospital", city: "Metro City" },
				{ id: 2, name: "Mercy Heart Institute", city: "Downtown" },
				{ id: 3, name: "Hope Blood Services", city: "Lakeside" },
			]
			setHospitals(hardcodedHospitals)
			if (hardcodedHospitals.length > 0) {
				setSelectedHospital(hardcodedHospitals[0].id)
			}
		}
	}

	async function loadRequests() {
		if (!selectedHospital) return
		setLoading(true)
		try {
			const data = await apiFetch(`/donation-requests/?hospital=${selectedHospital}`)
			setRequests(data)
			
			// Also sync to localStorage
			if (typeof window !== "undefined") {
				const hospitalStorageKey = `lifesaver:hospital_${selectedHospital}_requests`
				localStorage.setItem(hospitalStorageKey, JSON.stringify(data))
			}
		} catch (error) {
			// Fallback: Load from localStorage
			if (typeof window !== "undefined") {
				// First check hospital-specific storage
				const hospitalStorageKey = `lifesaver:hospital_${selectedHospital}_requests`
				const hospitalStored = localStorage.getItem(hospitalStorageKey)
				if (hospitalStored) {
					try {
						setRequests(JSON.parse(hospitalStored))
						return
					} catch (e) {
						// Continue to general storage
					}
				}
				
				// Check general donation requests storage
				const stored = localStorage.getItem(DONATION_REQUESTS_STORAGE_KEY)
				if (stored) {
					try {
						const allRequests = JSON.parse(stored)
						const filtered = allRequests.filter((r) => 
							r.hospital?.id === selectedHospital || 
							r.hospital_id === selectedHospital ||
							(r.hospital && r.hospital.id === selectedHospital)
						)
						setRequests(filtered)
					} catch (e) {
						setRequests([])
					}
				} else {
					setRequests([])
				}
			}
		} finally {
			setLoading(false)
		}
	}

	async function handleAccept(requestId) {
		setMessage("")
		try {
			await apiFetch(`/donation-requests/${requestId}/accept/`, {
				method: "POST",
				body: JSON.stringify({ notes: "" }),
			})
			
			// Update in all localStorage locations
			if (typeof window !== "undefined") {
				// Update general storage
				const stored = localStorage.getItem(DONATION_REQUESTS_STORAGE_KEY)
				if (stored) {
					const allRequests = JSON.parse(stored)
					const updated = allRequests.map((r) => 
						r.id === requestId ? { ...r, status: "ACCEPTED", updated_at: new Date().toISOString() } : r
					)
					localStorage.setItem(DONATION_REQUESTS_STORAGE_KEY, JSON.stringify(updated))
				}
				
				// Update hospital-specific storage
				const hospitalStorageKey = `lifesaver:hospital_${selectedHospital}_requests`
				const hospitalStored = localStorage.getItem(hospitalStorageKey)
				if (hospitalStored) {
					const hospitalRequests = JSON.parse(hospitalStored)
					const updated = hospitalRequests.map((r) => 
						r.id === requestId ? { ...r, status: "ACCEPTED", updated_at: new Date().toISOString() } : r
					)
					localStorage.setItem(hospitalStorageKey, JSON.stringify(updated))
				}
			}
			
			setMessage("Request accepted successfully!")
			loadRequests()
		} catch (error) {
			// Fallback: Update in localStorage
			if (typeof window !== "undefined") {
				// Update general storage
				const stored = localStorage.getItem(DONATION_REQUESTS_STORAGE_KEY)
				if (stored) {
					const allRequests = JSON.parse(stored)
					const updated = allRequests.map((r) => 
						r.id === requestId ? { ...r, status: "ACCEPTED", updated_at: new Date().toISOString() } : r
					)
					localStorage.setItem(DONATION_REQUESTS_STORAGE_KEY, JSON.stringify(updated))
				}
				
				// Update hospital-specific storage
				const hospitalStorageKey = `lifesaver:hospital_${selectedHospital}_requests`
				const hospitalStored = localStorage.getItem(hospitalStorageKey)
				if (hospitalStored) {
					const hospitalRequests = JSON.parse(hospitalStored)
					const updated = hospitalRequests.map((r) => 
						r.id === requestId ? { ...r, status: "ACCEPTED", updated_at: new Date().toISOString() } : r
					)
					localStorage.setItem(hospitalStorageKey, JSON.stringify(updated))
				}
				
				setMessage("Request accepted successfully!")
				loadRequests()
			} else {
				setMessage("Error accepting request. Please try again.")
			}
		}
	}

	async function handleReject(requestId) {
		setMessage("")
		try {
			await apiFetch(`/donation-requests/${requestId}/reject/`, {
				method: "POST",
				body: JSON.stringify({ notes: "" }),
			})
			
			// Update in all localStorage locations
			if (typeof window !== "undefined") {
				// Update general storage
				const stored = localStorage.getItem(DONATION_REQUESTS_STORAGE_KEY)
				if (stored) {
					const allRequests = JSON.parse(stored)
					const updated = allRequests.map((r) => 
						r.id === requestId ? { ...r, status: "REJECTED", updated_at: new Date().toISOString() } : r
					)
					localStorage.setItem(DONATION_REQUESTS_STORAGE_KEY, JSON.stringify(updated))
				}
				
				// Update hospital-specific storage
				const hospitalStorageKey = `lifesaver:hospital_${selectedHospital}_requests`
				const hospitalStored = localStorage.getItem(hospitalStorageKey)
				if (hospitalStored) {
					const hospitalRequests = JSON.parse(hospitalStored)
					const updated = hospitalRequests.map((r) => 
						r.id === requestId ? { ...r, status: "REJECTED", updated_at: new Date().toISOString() } : r
					)
					localStorage.setItem(hospitalStorageKey, JSON.stringify(updated))
				}
			}
			
			setMessage("Request rejected.")
			loadRequests()
		} catch (error) {
			// Fallback: Update in localStorage
			if (typeof window !== "undefined") {
				// Update general storage
				const stored = localStorage.getItem(DONATION_REQUESTS_STORAGE_KEY)
				if (stored) {
					const allRequests = JSON.parse(stored)
					const updated = allRequests.map((r) => 
						r.id === requestId ? { ...r, status: "REJECTED", updated_at: new Date().toISOString() } : r
					)
					localStorage.setItem(DONATION_REQUESTS_STORAGE_KEY, JSON.stringify(updated))
				}
				
				// Update hospital-specific storage
				const hospitalStorageKey = `lifesaver:hospital_${selectedHospital}_requests`
				const hospitalStored = localStorage.getItem(hospitalStorageKey)
				if (hospitalStored) {
					const hospitalRequests = JSON.parse(hospitalStored)
					const updated = hospitalRequests.map((r) => 
						r.id === requestId ? { ...r, status: "REJECTED", updated_at: new Date().toISOString() } : r
					)
					localStorage.setItem(hospitalStorageKey, JSON.stringify(updated))
				}
				
				setMessage("Request rejected.")
				loadRequests()
			} else {
				setMessage("Error rejecting request. Please try again.")
			}
		}
	}

	const pendingRequests = requests.filter((r) => r.status === "PENDING")
	const otherRequests = requests.filter((r) => r.status !== "PENDING")

	return (
		<>
			<Head>
				<title>Hospital Requests — LifeSaver Connect</title>
				<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@700;800&display=swap" rel="stylesheet" />
			</Head>
			<main className="min-h-screen bg-[#1A1A2E] text-white">
				<header className="border-b border-[#F6D6E3]/30 bg-[#131326]/80 backdrop-blur">
					<div className="mx-auto flex flex-col gap-3 md:flex-row md:items-center md:justify-between max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
						<div>
							<h1 className="text-3xl md:text-4xl font-extrabold" style={{ fontFamily: "'Poppins', sans-serif" }}>
								Hospital Donation Requests
							</h1>
							<p className="mt-1 text-sm text-pink-100/80">
								Review and manage donation requests from donors.
							</p>
						</div>
						<Link href="/" legacyBehavior>
							<a className="rounded-lg border border-[#F6D6E3] px-4 py-2 text-sm font-medium text-pink-100 hover:bg-white/5 transition">
								Back to Home
							</a>
						</Link>
					</div>
				</header>

				<section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 space-y-6">
					{/* Hospital Selection */}
					<div className="rounded-2xl border border-[#F6D6E3] bg-[#131326] p-6">
						<label className="block text-sm font-medium text-pink-100 mb-2">Select Hospital</label>
						<select
							value={selectedHospital || ""}
							onChange={(e) => setSelectedHospital(Number(e.target.value))}
							className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-4 py-2 text-white outline-none focus:border-[#E91E63]"
						>
							{hospitals.map((hospital) => (
								<option key={hospital.id} value={hospital.id}>
									{hospital.name} - {hospital.city}
								</option>
							))}
						</select>
					</div>

					{message && (
						<div className={`rounded-xl border px-4 py-3 text-sm ${
							message.includes("accepted") 
								? "border-green-500/40 bg-green-500/10 text-green-300"
								: message.includes("rejected")
								? "border-red-500/40 bg-red-500/10 text-red-300"
								: "border-[#E91E63]/40 bg-[#E91E63]/10 text-pink-300"
						}`}>
							{message}
						</div>
					)}

					{loading ? (
						<div className="rounded-2xl border border-[#F6D6E3] bg-[#131326] p-6 text-center text-pink-100/70">
							Loading requests...
						</div>
					) : (
						<>
							{/* Pending Requests */}
							<div className="rounded-2xl border border-[#F6D6E3] bg-[#131326] p-6">
								<h2 className="text-xl font-semibold text-white mb-4">
									Pending Requests ({pendingRequests.length})
								</h2>
								{pendingRequests.length > 0 ? (
									<div className="space-y-4">
										{pendingRequests.map((request) => {
											const donor = request.donor || {}
											return (
												<div key={request.id} className="rounded-xl border border-[#F6D6E3]/40 bg-[#1A1A2E] p-5">
													<div className="flex items-start justify-between">
														<div className="flex-1">
															<h3 className="text-lg font-semibold text-white">
																{donor.first_name || donor.username || "Donor"} {donor.last_name || ""}
															</h3>
															<p className="mt-1 text-sm text-pink-100/70">
																Email: {donor.email || "Not provided"}
															</p>
															{request.message && (
																<p className="mt-2 text-sm text-pink-100/80">{request.message}</p>
															)}
															{request.created_at && (
																<p className="mt-2 text-xs text-pink-100/60">
																	Requested: {new Date(request.created_at).toLocaleString()}
																</p>
															)}
														</div>
														<div className="flex gap-2 ml-4">
															<button
																onClick={() => handleAccept(request.id)}
																className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
															>
																Accept
															</button>
															<button
																onClick={() => handleReject(request.id)}
																className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
															>
																Reject
															</button>
														</div>
													</div>
												</div>
											)
										})}
									</div>
								) : (
									<div className="rounded-xl border border-dashed border-[#F6D6E3]/40 bg-[#1A1A2E] p-6 text-sm text-pink-100/70 text-center">
										No pending requests at this time.
									</div>
								)}
							</div>

							{/* Other Requests */}
							{otherRequests.length > 0 && (
								<div className="rounded-2xl border border-[#F6D6E3] bg-[#131326] p-6">
									<h2 className="text-xl font-semibold text-white mb-4">
										Other Requests ({otherRequests.length})
									</h2>
									<div className="space-y-4">
										{otherRequests.map((request) => {
											const donor = request.donor || {}
											const statusColors = {
												ACCEPTED: "bg-green-500/10 text-green-300 border-green-500/40",
												REJECTED: "bg-red-500/10 text-red-300 border-red-500/40",
												COMPLETED: "bg-blue-500/10 text-blue-300 border-blue-500/40",
												CANCELLED: "bg-gray-500/10 text-gray-300 border-gray-500/40",
											}
											const statusLabels = {
												ACCEPTED: "Accepted",
												REJECTED: "Rejected",
												COMPLETED: "Completed",
												CANCELLED: "Cancelled",
											}
											return (
												<div key={request.id} className="rounded-xl border border-[#F6D6E3]/40 bg-[#1A1A2E] p-5">
													<div className="flex items-center justify-between">
														<div className="flex-1">
															<h3 className="text-lg font-semibold text-white">
																{donor.first_name || donor.username || "Donor"} {donor.last_name || ""}
															</h3>
															<p className="mt-1 text-sm text-pink-100/70">
																Email: {donor.email || "Not provided"}
															</p>
															{request.created_at && (
																<p className="mt-2 text-xs text-pink-100/60">
																	Requested: {new Date(request.created_at).toLocaleString()}
																</p>
															)}
														</div>
														<span className={`rounded border px-3 py-1 text-xs font-semibold ${statusColors[request.status] || statusColors.ACCEPTED}`}>
															{statusLabels[request.status] || request.status}
														</span>
													</div>
												</div>
											)
										})}
									</div>
								</div>
							)}
						</>
					)}
				</section>
			</main>
		</>
	)
}

