import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import { useState, useEffect } from "react"
import { apiFetch } from "../../lib/api"

export default function HospitalDashboard() {
	const router = useRouter()
	const { id } = router.query
	const [hospital, setHospital] = useState(null)
	const [activeTab, setActiveTab] = useState("requests")
	const [loading, setLoading] = useState(true)

	// Donation Requests
	const [donationRequests, setDonationRequests] = useState([])
	const [ambulanceRequests, setAmbulanceRequests] = useState([])

	// Hospital Needs
	const [hospitalNeeds, setHospitalNeeds] = useState([])
	const [showNeedForm, setShowNeedForm] = useState(false)
	const [needForm, setNeedForm] = useState({
		need_type: "BLOOD",
		required_blood_group: "",
		patient_name: "",
		patient_details: "",
		poster_image: "",
		status: "NORMAL",
		quantity_needed: 1,
		needed_by: "",
		notes: "",
	})

	// Doctors
	const [doctors, setDoctors] = useState([])
	const [showDoctorForm, setShowDoctorForm] = useState(false)
	const [doctorForm, setDoctorForm] = useState({
		name: "",
		specialization: "",
		qualifications: "",
		phone: "",
		email: "",
	})

	// Appointments
	const [appointments, setAppointments] = useState([])

	// Willing Donors
	const [willingDonors, setWillingDonors] = useState([])
	const [organDonors, setOrganDonors] = useState([])
	// Events
	const [events, setEvents] = useState([])

	// Location Search
	const [locationSearch, setLocationSearch] = useState({ city: "", latitude: "", longitude: "" })
	const [nearbyHospitals, setNearbyHospitals] = useState([])

	// Accept Request Modal State
	const [acceptModal, setAcceptModal] = useState({
		isOpen: false,
		requestId: null,
		scheduledDate: "",
		patientName: "", // Added patientName
		notes: ""
	})

	// Organ Intake Modal State
	const [intakeModal, setIntakeModal] = useState({
		isOpen: false,
		donorId: null,
		donorName: "",
		paymentAmount: "",
	})

	useEffect(() => {
		if (id) {
			loadHospitalData()
		}
	}, [id])

	async function loadHospitalData() {
		setLoading(true)
		try {
			// Load hospital profile
			let hospitalData
			try {
				hospitalData = await apiFetch("/hospitals/me/")
			} catch (error) {
				hospitalData = await apiFetch(`/hospitals/${id}/`)
			}
			setHospital(hospitalData)

			// Load all related data
			await Promise.all([
				loadDonationRequests(hospitalData.id),
				loadHospitalNeeds(hospitalData.id),
				loadDoctors(hospitalData.id),
				loadAppointments(hospitalData.id),
				loadWillingDonors(),
				loadOrganDonors(),
				loadEvents(hospitalData.id),
				loadAmbulanceRequests(),
			])
		} catch (error) {
			console.error("Error loading hospital data:", error)
			// Fallback to localStorage
			if (typeof window !== "undefined") {
				const stored = localStorage.getItem("hospitalData")
				if (stored) {
					const hospitalFromStorage = JSON.parse(stored)
					setHospital(hospitalFromStorage)

					// Use the stored hospital ID or the URL ID
					const hospitalId = hospitalFromStorage.id || id

					// Load all related data with the correct ID
					await Promise.all([
						loadDonationRequests(hospitalId),
						loadHospitalNeeds(hospitalId),
						loadDoctors(hospitalId),
						loadAppointments(hospitalId),
						loadWillingDonors(),
						loadOrganDonors(),
						loadEvents(hospitalId),
						loadAmbulanceRequests(),
					])
				} else {
					// If no stored hospital, try to load requests with URL ID
					if (id) {
						await loadDonationRequests(id)
					}
				}
			}
		} finally {
			setLoading(false)
		}
	}

	async function loadDonationRequests(hospitalId) {
		// Normalize hospitalId to string for comparison
		const normalizedHospitalId = hospitalId ? String(hospitalId) : null

		if (!normalizedHospitalId) {
			setDonationRequests([])
			return
		}

		try {
			const data = await apiFetch(`/donation-requests/?hospital=${normalizedHospitalId}`)
			setDonationRequests(data)

			// Also sync to localStorage
			if (typeof window !== "undefined") {
				const hospitalStorageKey = `lifesaver:hospital_${normalizedHospitalId}_requests`
				localStorage.setItem(hospitalStorageKey, JSON.stringify(data))
			}
		} catch (error) {
			console.log("API fetch failed, loading from localStorage for hospital:", normalizedHospitalId)
			// Fallback: Load from localStorage
			if (typeof window !== "undefined") {
				// First check hospital-specific storage
				const hospitalStorageKey = `lifesaver:hospital_${normalizedHospitalId}_requests`
				const hospitalStored = localStorage.getItem(hospitalStorageKey)
				if (hospitalStored) {
					try {
						const requests = JSON.parse(hospitalStored)
						console.log("Loaded from hospital-specific storage:", requests.length, "requests")
						setDonationRequests(requests)
						return
					} catch (e) {
						console.error("Error parsing hospital-specific storage:", e)
						// Continue to general storage
					}
				}

				// Check general donation requests storage
				const stored = localStorage.getItem("lifesaver:donation_requests")
				if (stored) {
					try {
						const allRequests = JSON.parse(stored)
						console.log("All requests in storage:", allRequests.length)

						// Filter by hospital ID (compare as strings)
						const filtered = allRequests.filter(r => {
							const requestHospitalId = r.hospital?.id ? String(r.hospital.id) : null
							const requestHospitalId2 = r.hospital_id ? String(r.hospital_id) : null

							const matches =
								requestHospitalId === normalizedHospitalId ||
								requestHospitalId2 === normalizedHospitalId ||
								(r.hospital && String(r.hospital.id) === normalizedHospitalId)

							if (matches) {
								console.log("Matched request:", r.id, "for hospital:", normalizedHospitalId)
							}

							return matches
						})

						console.log("Filtered requests for hospital:", filtered.length)
						setDonationRequests(filtered)

						// Also update hospital-specific storage
						if (filtered.length > 0) {
							localStorage.setItem(hospitalStorageKey, JSON.stringify(filtered))
						}
					} catch (e) {
						console.error("Error parsing general storage:", e)
						setDonationRequests([])
					}
				} else {
					console.log("No requests found in localStorage")
					setDonationRequests([])
				}
			}
		}
	}

	async function loadHospitalNeeds(hospitalId) {
		try {
			const data = await apiFetch(`/hospital-needs/?hospital=${hospitalId}`)
			setHospitalNeeds(data)
		} catch (error) {
			setHospitalNeeds([])
		}
	}

	async function loadAmbulanceRequests() {
		try {
			const data = await apiFetch("/ambulance-requests/")
			setAmbulanceRequests(data)
		} catch (error) {
			setAmbulanceRequests([])
		}
	}

	async function loadDoctors(hospitalId) {
		try {
			const data = await apiFetch(`/doctors/?hospital=${hospitalId}`)
			setDoctors(data.filter(d => d.hospital?.id === hospitalId || d.hospital_id === hospitalId))
		} catch (error) {
			setDoctors([])
		}
	}

	async function loadAppointments(hospitalId) {
		try {
			const data = await apiFetch(`/appointments/?hospital=${hospitalId}`)
			setAppointments(data)
		} catch (error) {
			setAppointments([])
		}
	}

	async function loadWillingDonors() {
		try {
			const data = await apiFetch("/donors/")
			setWillingDonors(data.filter(d => d.is_available))
		} catch (error) {
			setWillingDonors([])
		}
	}

	async function loadOrganDonors() {
		try {
			const data = await apiFetch("/organ-donors/")
			setOrganDonors(data)
		} catch (error) {
			setOrganDonors([])
		}
	}

	async function loadEvents(hospitalId) {
		try {
			const data = await apiFetch(`/blood-donation-events/?hospital=${hospitalId}`)
			setEvents(data)
		} catch (error) {
			setEvents([])
		}
	}

	function handleAcceptRequest(requestId) {
		setAcceptModal({
			isOpen: true,
			requestId: requestId,
			scheduledDate: "",
			patientName: "",
			notes: ""
		})
	}

	async function confirmAcceptRequest() {
		if (!acceptModal.scheduledDate) {
			alert("Please select a valid date/time for the donation.")
			return
		}

		try {
			const formattedDate = new Date(acceptModal.scheduledDate).toISOString()

			await apiFetch(`/donation-requests/${acceptModal.requestId}/accept/`, {
				method: "POST",
				body: JSON.stringify({
					notes: acceptModal.notes,
					scheduled_date: formattedDate,
					patient_name: acceptModal.patientName // Send patient name
				}),
			})

			// Update in all localStorage locations
			if (typeof window !== "undefined") {
				// Update general storage
				const stored = localStorage.getItem("lifesaver:donation_requests")
				if (stored) {
					const allRequests = JSON.parse(stored)
					const updated = allRequests.map(r =>
						r.id === acceptModal.requestId ? {
							...r,
							status: "ACCEPTED",
							updated_at: new Date().toISOString(),
							scheduled_date: formattedDate,
							patient_name: acceptModal.patientName
						} : r
					)
					localStorage.setItem("lifesaver:donation_requests", JSON.stringify(updated))
				}

				// Update hospital-specific storage
				const hospitalStorageKey = `lifesaver:hospital_${hospital.id}_requests`
				const hospitalStored = localStorage.getItem(hospitalStorageKey)
				if (hospitalStored) {
					const hospitalRequests = JSON.parse(hospitalStored)
					const updated = hospitalRequests.map(r =>
						r.id === acceptModal.requestId ? {
							...r,
							status: "ACCEPTED",
							updated_at: new Date().toISOString(),
							scheduled_date: formattedDate,
							patient_name: acceptModal.patientName
						} : r
					)
					localStorage.setItem(hospitalStorageKey, JSON.stringify(updated))
				}
			}

			loadDonationRequests(hospital.id)
			setAcceptModal({ isOpen: false, requestId: null, scheduledDate: "", patientName: "", notes: "" })
			alert("Request accepted and scheduled successfully!")
		} catch (error) {
			console.error("Error accepting request:", error)
			alert("Failed to accept request. Please try again.")
		}
	}

	async function handleRejectRequest(requestId) {
		try {
			await apiFetch(`/donation-requests/${requestId}/reject/`, {
				method: "POST",
				body: JSON.stringify({ notes: "" }),
			})

			// Update in all localStorage locations
			if (typeof window !== "undefined") {
				// Update general storage
				const stored = localStorage.getItem("lifesaver:donation_requests")
				if (stored) {
					const allRequests = JSON.parse(stored)
					const updated = allRequests.map(r =>
						r.id === requestId ? { ...r, status: "REJECTED", updated_at: new Date().toISOString() } : r
					)
					localStorage.setItem("lifesaver:donation_requests", JSON.stringify(updated))
				}

				// Update hospital-specific storage
				const hospitalStorageKey = `lifesaver:hospital_${hospital.id}_requests`
				const hospitalStored = localStorage.getItem(hospitalStorageKey)
				if (hospitalStored) {
					const hospitalRequests = JSON.parse(hospitalStored)
					const updated = hospitalRequests.map(r =>
						r.id === requestId ? { ...r, status: "REJECTED", updated_at: new Date().toISOString() } : r
					)
					localStorage.setItem(hospitalStorageKey, JSON.stringify(updated))
				}
			}

			loadDonationRequests(hospital.id)
			alert("Request rejected.")
		} catch (error) {
			console.error("Error rejecting request:", error)
			// Fallback: Update in localStorage
			if (typeof window !== "undefined") {
				// Update general storage
				const stored = localStorage.getItem("lifesaver:donation_requests")
				if (stored) {
					const allRequests = JSON.parse(stored)
					const updated = allRequests.map(r =>
						r.id === requestId ? { ...r, status: "REJECTED", updated_at: new Date().toISOString() } : r
					)
					localStorage.setItem("lifesaver:donation_requests", JSON.stringify(updated))
				}

				// Update hospital-specific storage
				const hospitalStorageKey = `lifesaver:hospital_${hospital.id}_requests`
				const hospitalStored = localStorage.getItem(hospitalStorageKey)
				if (hospitalStored) {
					const hospitalRequests = JSON.parse(hospitalStored)
					const updated = hospitalRequests.map(r =>
						r.id === requestId ? { ...r, status: "REJECTED", updated_at: new Date().toISOString() } : r
					)
					localStorage.setItem(hospitalStorageKey, JSON.stringify(updated))
				}
			}
			loadDonationRequests(hospital.id)
		}
	}

	async function handleDeleteRequest(requestId) {
		if (!confirm("Are you sure you want to delete this request? This action cannot be undone.")) return

		try {
			await apiFetch(`/donation-requests/${requestId}/`, {
				method: "DELETE",
			})

			// Update local storage to remove the item
			if (typeof window !== "undefined") {
				const updateStorage = (key) => {
					const stored = localStorage.getItem(key)
					if (stored) {
						const requests = JSON.parse(stored)
						const updated = requests.filter(r => r.id !== requestId)
						localStorage.setItem(key, JSON.stringify(updated))
					}
				}
				updateStorage("lifesaver:donation_requests")
				updateStorage(`lifesaver:hospital_${hospital.id}_requests`)
			}

			loadDonationRequests(hospital.id)
			alert("Request deleted successfully.")
		} catch (error) {
			console.error("Error deleting request:", error)
			alert("Failed to delete request.")
		}
	}

	async function handleSubmitNeed(e) {
		e.preventDefault()
		try {
			await apiFetch("/hospital-needs/", {
				method: "POST",
				body: JSON.stringify({
					...needForm,
					hospital_id: hospital.id,
					needed_by: needForm.needed_by || null,
				}),
			})
			setShowNeedForm(false)
			setNeedForm({
				need_type: "BLOOD",
				required_blood_group: "",
				patient_name: "",
				patient_details: "",
				poster_image: "",
				status: "NORMAL",
				quantity_needed: 1,
				needed_by: "",
				notes: "",
			})
			loadHospitalNeeds(hospital.id)
		} catch (error) {
			alert("Error creating need. Please try again.")
		}
	}

	async function handleSubmitDoctor(e) {
		e.preventDefault()
		try {
			await apiFetch("/doctors/", {
				method: "POST",
				body: JSON.stringify({
					...doctorForm,
					hospital_id: hospital.id,
				}),
			})
			setShowDoctorForm(false)
			setDoctorForm({ name: "", specialization: "", qualifications: "", phone: "", email: "" })
			loadDoctors(hospital.id)
		} catch (error) {
			alert("Error adding doctor. Please try again.")
		}
	}

	async function handleLocationSearch() {
		try {
			const params = new URLSearchParams()
			if (locationSearch.latitude && locationSearch.longitude) {
				params.append("latitude", locationSearch.latitude)
				params.append("longitude", locationSearch.longitude)
			}
			if (locationSearch.city) {
				params.append("city", locationSearch.city)
			}
			const data = await apiFetch(`/hospitals/?${params.toString()}`)
			setNearbyHospitals(data)
		} catch (error) {
			setNearbyHospitals([])
		}
	}

	async function handleSubmitEvent(e) {
		e.preventDefault()
		try {
			// Format datetime for API
			const eventDateTime = eventForm.event_date && eventForm.start_time
				? `${eventForm.event_date}T${eventForm.start_time}`
				: null

			const response = await apiFetch("/blood-donation-events/", {
				method: "POST",
				body: JSON.stringify({
					...eventForm,
					hospital_id: hospital?.id || id,
					event_date: eventDateTime,
					estimated_donors: parseInt(eventForm.estimated_donors) || 0,
					latitude: eventForm.latitude ? parseFloat(eventForm.latitude) : null,
					longitude: eventForm.longitude ? parseFloat(eventForm.longitude) : null,
				}),
			})
			setShowEventForm(false)
			setEventForm({
				title: "",
				description: "",
				event_date: "",
				start_time: "",
				end_time: "",
				location: "",
				address: "",
				contact_phone: "",
				contact_email: "",
				blood_groups_needed: "",
				estimated_donors: 0,
				organizer: "",
				latitude: "",
				longitude: "",
			})
			await loadEvents(hospital?.id || id)
			alert("Event created successfully!")
		} catch (error) {
			console.error("Error creating event:", error)
			const errorMessage = error.body?.detail || error.message || "Error creating event. Please try again."
			alert(errorMessage)
		}
	}

	async function handleVerifyOrganPledge(donorId, reportFileUrl) {
		if (!reportFileUrl) {
			alert("No report file available for verification.")
			return
		}

		try {
			// Trigger hospital-side verification and acceptance on the backend
			const response = await apiFetch(`/organ-donors/${donorId}/verify_and_accept/`, {
				method: "POST"
			})

			if (response.blockchain_record) {
				alert(`Verification Success!\n\nBlockchain Track ID: ${response.blockchain_record.download_id}\nHash: ${response.blockchain_record.pdf_hash}\n\nThis report is authentic.`);
			} else {
				alert("Verified locally, but blockchain sync is pending.");
			}
			loadOrganDonors();
		} catch (error) {
			console.error("Verification error:", error)
			alert("Blockchain verification FAILED. The report content does not match our integrity ledger.")
		}
	}

	async function handleReceiveBody(donorId, paymentAmount) {
		try {
			await apiFetch(`/organ-donors/${donorId}/receive_body/`, {
				method: "POST",
				body: JSON.stringify({ payment_amount: paymentAmount })
			})
			alert("Body receipt and payment recorded successfully. Record moved to Completed Donors.")
			setIntakeModal({ isOpen: false, donorId: null, donorName: "", paymentAmount: "" })
			loadOrganDonors()
		} catch (error) {
			console.error("Error recording body receipt:", error)
			alert("Failed to record body receipt. Please try again.")
		}
	}

	if (loading) {
		return (
			<main className="min-h-screen bg-[#1A1A2E] text-white flex items-center justify-center">
				<div className="text-center">
					<div className="h-12 w-12 animate-spin rounded-full border-4 border-[#E91E63] border-t-transparent mx-auto" />
					<p className="mt-4 text-pink-100/70">Loading hospital dashboard...</p>
				</div>
			</main>
		)
	}

	if (!hospital) {
		return (
			<main className="min-h-screen bg-[#1A1A2E] text-white flex items-center justify-center">
				<div className="text-center">
					<p className="text-pink-100/70 mb-4">Hospital not found</p>
					<Link href="/hospital/select" legacyBehavior>
						<a className="text-[#E91E63] underline">Go back to hospital selection</a>
					</Link>
				</div>
			</main>
		)
	}

	const pendingRequests = donationRequests.filter(r => r.status === "PENDING")
	const activeNeeds = hospitalNeeds.filter(n => n.status !== "FULFILLED" && n.status !== "CANCELLED")
	const upcomingAppointments = appointments.filter(a => a.status === "SCHEDULED")

	return (
		<>
			<Head>
				<title>{hospital.name} Dashboard — LifeSaver Connect</title>
				<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@700;800&display=swap" rel="stylesheet" />
			</Head>
			<main className="min-h-screen bg-[#1A1A2E] text-white">
				<header className="border-b border-[#F6D6E3]/30 bg-[#131326]/80 backdrop-blur sticky top-0 z-10">
					<div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
						<div className="flex items-center justify-between">
							<div>
								<h1 className="text-2xl font-bold text-white">{hospital.name}</h1>
								<p className="text-sm text-pink-100/70">{hospital.city} • {hospital.hospital_type || "Hospital"}</p>
							</div>
							<div className="flex gap-2">
								<Link href="/hospital/requests" legacyBehavior>
									<a className="rounded-lg border border-[#F6D6E3] px-4 py-2 text-sm text-pink-100 hover:bg-white/5">
										Requests
									</a>
								</Link>
								<button
									onClick={() => {
										localStorage.removeItem("accessToken")
										router.push("/")
									}}
									className="rounded-lg border border-slate-500 px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
								>
									Logout
								</button>
							</div>
						</div>
					</div>
				</header>

				{/* Navigation Links */}
				<div className="border-b border-[#F6D6E3]/30 bg-[#131326]">
					<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
						<nav className="flex space-x-8 overflow-x-auto">
							<Link href={`/hospital/requests?id=${id}`} legacyBehavior>
								<a className="py-4 px-1 border-b-2 border-transparent font-medium text-sm text-pink-100/70 hover:text-pink-100 hover:border-pink-100/30 transition">
									Requests
								</a>
							</Link>
							<Link href={`/hospital/needs?id=${id}`} legacyBehavior>
								<a className="py-4 px-1 border-b-2 border-transparent font-medium text-sm text-pink-100/70 hover:text-pink-100 hover:border-pink-100/30 transition">
									Needs
								</a>
							</Link>
							<Link href={`/hospital/doctors?id=${id}`} legacyBehavior>
								<a className="py-4 px-1 border-b-2 border-transparent font-medium text-sm text-pink-100/70 hover:text-pink-100 hover:border-pink-100/30 transition">
									Doctors
								</a>
							</Link>
							<Link href={`/hospital/appointments?id=${id}`} legacyBehavior>
								<a className="py-4 px-1 border-b-2 border-transparent font-medium text-sm text-pink-100/70 hover:text-pink-100 hover:border-pink-100/30 transition">
									Appointments
								</a>
							</Link>
							<Link href={`/hospital/donors?id=${id}`} legacyBehavior>
								<a className="py-4 px-1 border-b-2 border-transparent font-medium text-sm text-pink-100/70 hover:text-pink-100 hover:border-pink-100/30 transition">
									Donors & Patients
								</a>
							</Link>
							<Link href={`/hospital/events?id=${id}`} legacyBehavior>
								<a className="py-4 px-1 border-b-2 border-transparent font-medium text-sm text-pink-100/70 hover:text-pink-100 hover:border-pink-100/30 transition">
									Events
								</a>
							</Link>
							<Link href={`/hospital/staff?id=${id}`} legacyBehavior>
								<a className="py-4 px-1 border-b-2 border-transparent font-medium text-sm text-pink-100/70 hover:text-pink-100 hover:border-pink-100/30 transition">
									Staff
								</a>
							</Link>
							<Link href={`/hospital/location?id=${id}`} legacyBehavior>
								<a className="py-4 px-1 border-b-2 border-transparent font-medium text-sm text-pink-100/70 hover:text-pink-100 hover:border-pink-100/30 transition">
									Location
								</a>
							</Link>
						</nav>
					</div>
				</div>

				<div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
					{/* Donation Requests Tab */}
					{activeTab === "requests" && (
						<div className="space-y-6">
							<div className="flex items-center justify-between">
								<div>
									<h2 className="text-2xl font-bold text-white">Donation Requests</h2>
									<p className="text-sm text-pink-100/70 mt-1">Hospital ID: {hospital?.id || id}</p>
								</div>
								<div className="flex items-center gap-3">
									<span className="rounded-full bg-[#E91E63]/20 px-3 py-1 text-sm text-[#E91E63]">
										{pendingRequests.length} Donation Pending
									</span>
									{ambulanceRequests.filter(a => a.status === 'PENDING').length > 0 && (
										<Link href={`/hospital/requests?id=${id}`} legacyBehavior>
											<a className="rounded-full bg-red-600 px-3 py-1 text-sm text-white font-bold animate-pulse">
												🚨 {ambulanceRequests.filter(a => a.status === 'PENDING').length} Emergency
											</a>
										</Link>
									)}
									<button
										onClick={() => {
											const hospitalId = hospital?.id || id
											if (hospitalId) {
												loadDonationRequests(hospitalId)
											}
										}}
										className="rounded-lg border border-[#F6D6E3] px-4 py-2 text-sm text-pink-100 hover:bg-white/5"
									>
										Refresh
									</button>
								</div>
							</div>

							{/* Show all requests, not just pending */}
							{donationRequests.length > 0 ? (
								<div className="space-y-4">
									{donationRequests.map((request) => {
										const donor = request.donor || {}
										const statusColors = {
											PENDING: "bg-yellow-600/20 text-yellow-400",
											ACCEPTED: "bg-green-600/20 text-green-400",
											REJECTED: "bg-red-600/20 text-red-400",
											COMPLETED: "bg-blue-600/20 text-blue-400",
											CANCELLED: "bg-gray-600/20 text-gray-400",
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
															<span className="rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 px-2 py-0.5 text-[10px] font-bold uppercase">
																{request.request_type || "BLOOD"}
															</span>
														</div>
														<p className="mt-1 text-sm text-pink-100/70">Email: {donor.email || "Not provided"}</p>
														{request.message && <p className="mt-2 text-sm text-pink-100/80">{request.message}</p>}
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
														<p className="mt-2 text-xs text-pink-100/60">
															Requested: {new Date(request.created_at || Date.now()).toLocaleString()}
														</p>
														{request.scheduled_date && (
															<p className="mt-1 text-sm font-semibold text-green-400">
																Scheduled: {new Date(request.scheduled_date).toLocaleString(undefined, {
																	weekday: 'short',
																	year: 'numeric',
																	month: 'short',
																	day: 'numeric',
																	hour: '2-digit',
																	minute: '2-digit'
																})}
															</p>
														)}
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
													{request.status === "ACCEPTED" && (
														<div className="flex gap-2 ml-4">
															<button
																onClick={() => handleDeleteRequest(request.id)}
																className="rounded-lg border border-red-500/50 px-4 py-2 text-sm font-semibold text-red-400 transition hover:bg-red-500/10"
															>
																Delete
															</button>
														</div>
													)}
												</div>
											</div>
										)
									})}
								</div>
							) : (
								<div className="rounded-xl border border-dashed border-[#F6D6E3]/40 bg-[#131326] p-12 text-center">
									<p className="text-pink-100/70">No donation requests found</p>
									<p className="text-xs text-pink-100/50 mt-2">Make sure requests are being sent to this hospital (ID: {hospital?.id || id})</p>
								</div>
							)}

							{/* NEW: Organ Pledges Section for Hospital to Verify */}
							<div className="mt-12 space-y-6">
								<h2 className="text-2xl font-bold text-white flex items-center gap-3">
									<span className="p-2 bg-[#E91E63]/20 rounded-lg">🫀</span>
									New Organ Pledges for Verification
								</h2>
								{organDonors.filter(d => d.status === "PENDING" || d.status === "ACCEPTED").length > 0 ? (
									<div className="grid gap-4">
										{organDonors.filter(d => d.status === "PENDING" || d.status === "ACCEPTED").map((donor) => (
											<div key={donor.id} className="rounded-xl border border-blue-500/30 bg-[#131326] p-6 shadow-lg shadow-blue-500/5">
												<div className="flex items-start justify-between">
													<div>
														<h3 className="text-lg font-bold text-white">
															{donor.user?.first_name || donor.user?.username || "Donor"} {donor.user?.last_name || ""}
														</h3>
														<p className="text-sm text-pink-100/70 mt-1">Organs: <span className="text-blue-400 font-bold">{donor.organs}</span></p>
														<div className="mt-4 flex flex-wrap gap-4">
															{donor.pledge_report && (
																<a
																	href={donor.pledge_report}
																	target="_blank"
																	rel="noopener noreferrer"
																	className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600/10 border border-blue-500/30 rounded-lg text-blue-300 text-sm hover:bg-blue-600/20 transition"
																>
																	<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
																	</svg>
																	View Signed Report
																</a>
															)}
															<button
																onClick={() => handleVerifyOrganPledge(donor.id, donor.pledge_report)}
																className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 rounded-lg text-white text-sm font-bold shadow-lg shadow-green-600/20 hover:opacity-90 transition"
															>
																<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																	<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
																</svg>
																Verify Blockchain Integrity
															</button>
														</div>
													</div>
													<div className="text-right">
														<span className="inline-block px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-400 text-xs font-black uppercase tracking-widest border border-yellow-500/20">
															{donor.status}
														</span>
														<p className="text-[10px] text-pink-100/40 mt-2 uppercase tracking-tighter">Awaiting Hospital Approval</p>
													</div>
												</div>
											</div>
										))}
									</div>
								) : (
									<div className="rounded-xl border border-dashed border-[#F6D6E3]/20 bg-white/5 p-8 text-center">
										<p className="text-pink-100/40">No new organ pledges to verify.</p>
									</div>
								)}
							</div>
						</div>
					)}

					{/* Accept Request Modal - Rendered outside the list but conditionally */}
					{acceptModal.isOpen && (
						<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
							<div className="w-full max-w-md rounded-2xl border border-[#F6D6E3]/30 bg-[#131326] p-6 shadow-xl">
								<h3 className="text-xl font-bold text-white mb-4">Accept Request & Schedule</h3>
								<p className="text-sm text-pink-100/70 mb-4">
									Please set a schedule date and time for when the donor should come for the donation.
								</p>

								<div className="space-y-4">
									<div>
										<label className="block text-sm font-medium text-pink-100 mb-1">Scheduled Date & Time *</label>
										<input
											type="datetime-local"
											value={acceptModal.scheduledDate}
											onChange={(e) => setAcceptModal({ ...acceptModal, scheduledDate: e.target.value })}
											className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
											required
										/>
									</div>

									<div>
										<label className="block text-sm font-medium text-pink-100 mb-1">Patient Name (Optional)</label>
										<input
											type="text"
											value={acceptModal.patientName}
											onChange={(e) => setAcceptModal({ ...acceptModal, patientName: e.target.value })}
											className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
											placeholder="Name of the patient involved"
										/>
									</div>

									<div>
										<label className="block text-sm font-medium text-pink-100 mb-1">Notes (Optional)</label>
										<textarea
											value={acceptModal.notes}
											onChange={(e) => setAcceptModal({ ...acceptModal, notes: e.target.value })}
											className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
											rows={3}
											placeholder="Any instructions for the donor..."
										/>
									</div>

									<div className="flex gap-3 pt-2">
										<button
											onClick={() => setAcceptModal({ isOpen: false, requestId: null, scheduledDate: "", patientName: "", notes: "" })}
											className="flex-1 rounded-lg border border-[#F6D6E3]/30 bg-transparent py-2.5 text-sm font-semibold text-pink-100 transition hover:bg-white/5"
										>
											Cancel
										</button>
										<button
											onClick={confirmAcceptRequest}
											className="flex-1 rounded-lg bg-[#E91E63] py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-[#d81b60]"
										>
											Confirm Schedule
										</button>
									</div>
								</div>
							</div>
						</div>
					)}

					{/* Hospital Needs Tab */}
					{activeTab === "needs" && (
						<div className="space-y-6">
							<div className="flex items-center justify-between">
								<h2 className="text-2xl font-bold text-white">Hospital Needs</h2>
								<button
									onClick={() => setShowNeedForm(!showNeedForm)}
									className="rounded-lg bg-[#E91E63] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
								>
									{showNeedForm ? "Cancel" : "+ Post Need"}
								</button>
							</div>

							{showNeedForm && (
								<form onSubmit={handleSubmitNeed} className="rounded-xl border border-[#F6D6E3]/40 bg-[#131326] p-6 space-y-4">
									<div className="grid gap-4 md:grid-cols-2">
										<div>
											<label className="block text-sm font-medium text-pink-100 mb-1">Need Type *</label>
											<select
												required
												value={needForm.need_type}
												onChange={(e) => setNeedForm({ ...needForm, need_type: e.target.value })}
												className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
											>
												<option value="BLOOD">Blood</option>
												<option value="PLATELETS">Platelets</option>
												<option value="EMERGENCY">Emergency Case</option>
												<option value="ORGAN">Organ</option>
											</select>
										</div>
										<div>
											<label className="block text-sm font-medium text-pink-100 mb-1">Blood Group</label>
											<select
												value={needForm.required_blood_group}
												onChange={(e) => setNeedForm({ ...needForm, required_blood_group: e.target.value })}
												className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
											>
												<option value="">Any</option>
												<option value="O+">O+</option>
												<option value="O-">O-</option>
												<option value="A+">A+</option>
												<option value="A-">A-</option>
												<option value="B+">B+</option>
												<option value="B-">B-</option>
												<option value="AB+">AB+</option>
												<option value="AB-">AB-</option>
											</select>
										</div>
										<div>
											<label className="block text-sm font-medium text-pink-100 mb-1">Patient Name</label>
											<input
												type="text"
												value={needForm.patient_name}
												onChange={(e) => setNeedForm({ ...needForm, patient_name: e.target.value })}
												className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-pink-100 mb-1">Quantity Needed</label>
											<input
												type="number"
												min="1"
												value={needForm.quantity_needed}
												onChange={(e) => setNeedForm({ ...needForm, quantity_needed: parseInt(e.target.value) })}
												className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
											/>
										</div>
										<div className="md:col-span-2">
											<label className="block text-sm font-medium text-pink-100 mb-1">Patient Details</label>
											<textarea
												value={needForm.patient_details}
												onChange={(e) => setNeedForm({ ...needForm, patient_details: e.target.value })}
												rows={3}
												className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
												placeholder="Patient information and medical condition"
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-pink-100 mb-1">Poster Image URL</label>
											<input
												type="url"
												value={needForm.poster_image}
												onChange={(e) => setNeedForm({ ...needForm, poster_image: e.target.value })}
												className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
												placeholder="https://example.com/poster.jpg"
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-pink-100 mb-1">Needed By</label>
											<input
												type="datetime-local"
												value={needForm.needed_by}
												onChange={(e) => setNeedForm({ ...needForm, needed_by: e.target.value })}
												className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
											/>
										</div>
									</div>
									<button
										type="submit"
										className="rounded-lg bg-[#E91E63] px-6 py-2 font-semibold text-white transition hover:opacity-90"
									>
										Post Need
									</button>
								</form>
							)}

							<div className="space-y-4">
								{activeNeeds.map((need) => (
									<div key={need.id} className="rounded-xl border border-[#F6D6E3]/40 bg-[#131326] p-6">
										<div className="flex items-start justify-between">
											<div className="flex-1">
												<div className="flex items-center gap-3">
													<h3 className="text-lg font-semibold text-white">{need.need_type}</h3>
													{need.required_blood_group && (
														<span className="rounded bg-[#E91E63]/10 px-2 py-1 text-xs text-[#E91E63]">
															{need.required_blood_group}
														</span>
													)}
													<span className={`rounded px-2 py-1 text-xs font-semibold ${need.status === "URGENT" ? "bg-red-500/10 text-red-300" : "bg-yellow-500/10 text-yellow-300"
														}`}>
														{need.status}
													</span>
												</div>
												{need.patient_name && (
													<p className="mt-2 text-sm text-pink-100/80">Patient: {need.patient_name}</p>
												)}
												{need.patient_details && (
													<p className="mt-2 text-sm text-pink-100/70">{need.patient_details}</p>
												)}
												<p className="mt-2 text-sm text-pink-100/70">Quantity: {need.quantity_needed} units</p>
												{need.poster_image && (
													<div className="mt-4">
														<img src={need.poster_image} alt="Patient poster" className="max-w-xs rounded-lg" />
													</div>
												)}
											</div>
										</div>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Doctors Tab */}
					{activeTab === "doctors" && (
						<div className="space-y-6">
							<div className="flex items-center justify-between">
								<h2 className="text-2xl font-bold text-white">Doctors</h2>
								<button
									onClick={() => setShowDoctorForm(!showDoctorForm)}
									className="rounded-lg bg-[#E91E63] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
								>
									{showDoctorForm ? "Cancel" : "+ Add Doctor"}
								</button>
							</div>

							{showDoctorForm && (
								<form onSubmit={handleSubmitDoctor} className="rounded-xl border border-[#F6D6E3]/40 bg-[#131326] p-6 space-y-4">
									<div className="grid gap-4 md:grid-cols-2">
										<div>
											<label className="block text-sm font-medium text-pink-100 mb-1">Name *</label>
											<input
												type="text"
												required
												value={doctorForm.name}
												onChange={(e) => setDoctorForm({ ...doctorForm, name: e.target.value })}
												className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-pink-100 mb-1">Specialization</label>
											<input
												type="text"
												value={doctorForm.specialization}
												onChange={(e) => setDoctorForm({ ...doctorForm, specialization: e.target.value })}
												className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
											/>
										</div>
										<div className="md:col-span-2">
											<label className="block text-sm font-medium text-pink-100 mb-1">Qualifications</label>
											<textarea
												value={doctorForm.qualifications}
												onChange={(e) => setDoctorForm({ ...doctorForm, qualifications: e.target.value })}
												rows={3}
												className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
												placeholder="Medical degrees, certifications, etc."
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-pink-100 mb-1">Phone</label>
											<input
												type="tel"
												value={doctorForm.phone}
												onChange={(e) => setDoctorForm({ ...doctorForm, phone: e.target.value })}
												className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-pink-100 mb-1">Email</label>
											<input
												type="email"
												value={doctorForm.email}
												onChange={(e) => setDoctorForm({ ...doctorForm, email: e.target.value })}
												className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
											/>
										</div>
									</div>
									<button
										type="submit"
										className="rounded-lg bg-[#E91E63] px-6 py-2 font-semibold text-white transition hover:opacity-90"
									>
										Add Doctor
									</button>
								</form>
							)}

							<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
								{doctors.map((doctor) => (
									<div key={doctor.id} className="rounded-xl border border-[#F6D6E3]/40 bg-[#131326] p-6">
										<h3 className="text-lg font-semibold text-white">{doctor.name}</h3>
										{doctor.specialization && (
											<p className="mt-1 text-sm text-pink-100/70">{doctor.specialization}</p>
										)}
										{doctor.qualifications && (
											<p className="mt-2 text-xs text-pink-100/60">{doctor.qualifications}</p>
										)}
										{doctor.phone && (
											<p className="mt-2 text-xs text-pink-100/60">Phone: {doctor.phone}</p>
										)}
										{doctor.email && (
											<p className="mt-1 text-xs text-pink-100/60">Email: {doctor.email}</p>
										)}
									</div>
								))}
							</div>
						</div>
					)}

					{/* Appointments Tab */}
					{activeTab === "appointments" && (
						<div className="space-y-6">
							<h2 className="text-2xl font-bold text-white">Appointments</h2>
							<div className="space-y-4">
								{upcomingAppointments.map((appointment) => {
									const donor = appointment.donor || {}
									return (
										<div key={appointment.id} className="rounded-xl border border-[#F6D6E3]/40 bg-[#131326] p-6">
											<div className="flex items-start justify-between">
												<div className="flex-1">
													<h3 className="text-lg font-semibold text-white">
														{donor.first_name || donor.username || "Donor"} {donor.last_name || ""}
													</h3>
													<p className="mt-1 text-sm text-pink-100/70">
														Date: {new Date(appointment.appointment_date).toLocaleString()}
													</p>
													<p className="mt-1 text-sm text-pink-100/70">Status: {appointment.status}</p>
													{appointment.notes && (
														<p className="mt-2 text-sm text-pink-100/60">{appointment.notes}</p>
													)}
												</div>
											</div>
										</div>
									)
								})}
							</div>
						</div>
					)}

					{/* Willing Donors Tab */}
					{activeTab === "donors" && (
						<div className="space-y-6">
							<h2 className="text-2xl font-bold text-white">Willing Donors</h2>

							{/* Blood Donors */}
							<div>
								<h3 className="text-xl font-semibold text-white mb-4">Blood Donors</h3>
								<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
									{willingDonors.map((donor) => (
										<div key={donor.id} className="rounded-xl border border-[#F6D6E3]/40 bg-[#131326] p-6">
											<h4 className="font-semibold text-white">
												{donor.user?.first_name || donor.user?.username || "Donor"} {donor.user?.last_name || ""}
											</h4>
											<p className="mt-2 text-sm text-pink-100/70">Blood Group: {donor.blood_group}</p>
											<p className="mt-1 text-sm text-pink-100/70">City: {donor.city}</p>
											{donor.phone && (
												<p className="mt-1 text-sm text-pink-100/60">Phone: {donor.phone}</p>
											)}
											{donor.is_platelet_donor && (
												<span className="mt-2 inline-block rounded bg-[#E91E63]/10 px-2 py-1 text-xs text-[#E91E63]">
													Platelet Donor
												</span>
											)}
										</div>
									))}
								</div>
							</div>

							{/* Organ Requests / Pledges */}
							<div className="mt-12">
								<h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
									<span className="p-2 bg-blue-500/20 rounded-lg">🫁</span>
									Organ Fulfillment Requests
								</h3>
								<div className="grid gap-6">
									{organDonors.filter(d => d.status === "COMMITTED" || d.status === "COMPLETED").map((donor) => (
										<div key={donor.id} className={`rounded-2xl border ${donor.status === 'COMPLETED' ? 'border-green-500/30 bg-green-500/5' : 'border-blue-500/30 bg-[#131326]'} p-6 transition-all`}>
											<div className="flex flex-col md:flex-row justify-between gap-6">
												<div className="space-y-3">
													<div className="flex items-center gap-3">
														<h4 className="text-xl font-black text-white">
															{donor.user?.first_name || donor.user?.username || "Donor"} {donor.user?.last_name || ""}
														</h4>
														<span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border ${donor.status === 'COMPLETED' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'}`}>
															{donor.status}
														</span>
													</div>
													<div className="grid grid-cols-2 gap-4 text-sm">
														<div>
															<p className="text-pink-100/40 uppercase text-[10px] font-bold">Organs Committed</p>
															<p className="text-blue-300 font-bold">{donor.organs}</p>
														</div>
														<div>
															<p className="text-pink-100/40 uppercase text-[10px] font-bold">Contact Person</p>
															<p className="text-white font-medium">{donor.emergency_contact_name || "N/A"}</p>
															<p className="text-xs text-pink-100/60">{donor.emergency_contact_phone}</p>
														</div>
													</div>
													{donor.status === "COMPLETED" && (
														<div className="mt-4 p-4 rounded-xl bg-green-500/10 border border-green-500/20 grid grid-cols-2 gap-4">
															<div>
																<p className="text-green-400/60 uppercase text-[10px] font-bold">Body Received At</p>
																<p className="text-white text-sm">{new Date(donor.body_received_at).toLocaleString()}</p>
															</div>
															<div>
																<p className="text-green-400/60 uppercase text-[10px] font-bold">Payment Status</p>
																<p className="text-white text-sm font-bold">Rs. {donor.payment_amount} Paid ✅</p>
															</div>
														</div>
													)}
												</div>
												<div className="flex flex-col gap-3 justify-center">
													{donor.status === "COMMITTED" && (
														<button
															onClick={() => setIntakeModal({
																isOpen: true,
																donorId: donor.id,
																donorName: `${donor.user?.first_name || donor.user?.username} ${donor.user?.last_name || ""}`,
																paymentAmount: "50000" // Default organ benefit amount
															})}
															className="w-full md:w-auto px-6 py-3 bg-[#E91E63] text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-[#E91E63]/30 hover:scale-105 transition active:scale-95"
														>
															HAD RECEIVED THE BODY 📍
														</button>
													)}
													{donor.pledge_report && (
														<a
															href={donor.pledge_report}
															target="_blank"
															rel="noopener noreferrer"
															className="text-center text-xs text-blue-400 border-b border-blue-400/30 pb-1 hover:text-blue-300 transition"
														>
															Download Blockchain Certificate
														</a>
													)}
												</div>
											</div>
										</div>
									))}
								</div>
							</div>
						</div>
					)}

					{/* Location Search Tab */}
					{activeTab === "location" && (
						<div className="space-y-6">
							<h2 className="text-2xl font-bold text-white">Find Nearby Hospitals & Centers</h2>

							<div className="rounded-xl border border-[#F6D6E3]/40 bg-[#131326] p-6 space-y-4">
								<div className="grid gap-4 md:grid-cols-3">
									<div>
										<label className="block text-sm font-medium text-pink-100 mb-1">City</label>
										<input
											type="text"
											value={locationSearch.city}
											onChange={(e) => setLocationSearch({ ...locationSearch, city: e.target.value })}
											className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
											placeholder="Enter city"
										/>
									</div>
									<div>
										<label className="block text-sm font-medium text-pink-100 mb-1">Latitude</label>
										<input
											type="number"
											step="any"
											value={locationSearch.latitude}
											onChange={(e) => setLocationSearch({ ...locationSearch, latitude: e.target.value })}
											className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
											placeholder="e.g., 28.6139"
										/>
									</div>
									<div>
										<label className="block text-sm font-medium text-pink-100 mb-1">Longitude</label>
										<input
											type="number"
											step="any"
											value={locationSearch.longitude}
											onChange={(e) => setLocationSearch({ ...locationSearch, longitude: e.target.value })}
											className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
											placeholder="e.g., 77.2090"
										/>
									</div>
								</div>
								<button
									onClick={handleLocationSearch}
									className="rounded-lg bg-[#E91E63] px-6 py-2 font-semibold text-white transition hover:opacity-90"
								>
									Search Nearby
								</button>
							</div>

							{nearbyHospitals.length > 0 && (
								<div className="space-y-4">
									<h3 className="text-xl font-semibold text-white">Nearby Hospitals & Centers</h3>
									{nearbyHospitals.map((h) => (
										<div key={h.id} className="rounded-xl border border-[#F6D6E3]/40 bg-[#131326] p-6">
											<div className="flex items-start justify-between">
												<div className="flex-1">
													<h4 className="text-lg font-semibold text-white">{h.name}</h4>
													<p className="mt-1 text-sm text-pink-100/70">
														{h.hospital_type || "Hospital"} • {h.city}
													</p>
													{h.address && (
														<p className="mt-1 text-sm text-pink-100/60">{h.address}</p>
													)}
													{h.phone && (
														<p className="mt-1 text-sm text-pink-100/60">Phone: {h.phone}</p>
													)}
												</div>
												<Link href={`/hospital/needs?hospital=${h.id}`} legacyBehavior>
													<a className="text-sm text-[#E91E63] hover:underline">View Needs</a>
												</Link>
											</div>
										</div>
									))}
								</div>
							)}
						</div>
					)}
				</div>

				{/* Organ Intake / Fulfillment Modal */}
				{intakeModal.isOpen && (
					<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
						<div className="w-full max-w-lg rounded-3xl border border-[#F6D6E3]/30 bg-[#131326] p-8 shadow-2xl">
							<div className="mb-6 flex items-center gap-4">
								<div className="h-12 w-12 rounded-2xl bg-[#E91E63]/20 flex items-center justify-center text-2xl">📍</div>
								<div>
									<h3 className="text-xl font-black text-white uppercase tracking-tight">Receive Body & Finalize</h3>
									<p className="text-sm text-pink-100/60">Recording reception for <b>{intakeModal.donorName}</b></p>
								</div>
							</div>

							<div className="space-y-6">
								<div className="p-4 rounded-2xl bg-white/5 border border-white/10">
									<p className="text-[10px] font-black text-pink-100/40 uppercase tracking-widest mb-4">Verification Checklist</p>
									<div className="space-y-3">
										<div className="flex items-center gap-3 text-sm text-white">
											<div className="h-5 w-5 rounded bg-green-500 flex items-center justify-center text-[10px]">✓</div>
											Blockchain Identity Verified
										</div>
										<div className="flex items-center gap-3 text-sm text-white">
											<div className="h-5 w-5 rounded bg-green-500 flex items-center justify-center text-[10px]">✓</div>
											Signed Pledge Artifact Matched
										</div>
										<div className="flex items-center gap-3 text-sm text-white">
											<input type="checkbox" className="h-5 w-5 rounded bg-[#1A1A2E] border-white/20" defaultChecked />
											Family Consent Authenticated
										</div>
									</div>
								</div>

								<div>
									<label className="block text-[10px] font-black text-pink-100/40 uppercase tracking-widest mb-2">Compensation to Contact (Rs.)</label>
									<input
										type="number"
										value={intakeModal.paymentAmount}
										onChange={(e) => setIntakeModal({ ...intakeModal, paymentAmount: e.target.value })}
										className="w-full rounded-xl border border-[#F6D6E3]/30 bg-[#1A1A2E] px-4 py-3 text-white font-bold outline-none focus:border-[#E91E63] transition"
										placeholder="Enter amount"
									/>
									<p className="mt-2 text-[10px] text-pink-100/40 italic">* This payment will be recorded as 'Transferred to Emergency Contact' in the final ledger.</p>
								</div>

								<div className="flex gap-4 pt-4">
									<button
										onClick={() => setIntakeModal({ ...intakeModal, isOpen: false })}
										className="flex-1 rounded-xl border border-white/10 py-3 text-xs font-black uppercase text-pink-100/60 hover:bg-white/5 transition"
									>
										Cancel
									</button>
									<button
										onClick={() => handleReceiveBody(intakeModal.donorId, intakeModal.paymentAmount)}
										className="flex-[2] rounded-xl bg-green-600 py-3 text-xs font-black uppercase text-white shadow-lg shadow-green-600/30 hover:bg-green-500 transition active:scale-95"
									>
										CONFIRM RECEPTION & PAY 💳
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

