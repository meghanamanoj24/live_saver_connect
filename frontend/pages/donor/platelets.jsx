import Head from "next/head"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { apiFetch } from "../../lib/api"

const DONATION_HISTORY_PLACEHOLDER = []
const DONOR_PROFILE_STORAGE_KEY = "lifesaver:donor_profile"

// Platelet Compatibility Logic (Donors -> Recipients)
const PLATELET_COMPATIBILITY = {
	"A+": ["A+", "A-", "AB+", "AB-"],
	"A-": ["A+", "A-", "AB+", "AB-"],
	"B+": ["B+", "B-", "AB+", "AB-"],
	"B-": ["B+", "B-", "AB+", "AB-"],
	"AB+": ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"], // Universal Donor
	"AB-": ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"], // Universal Donor
	"O+": ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"], // Universal Donor (per specific requirement)
	"O-": ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"], // Universal Donor
}

function formatName(user) {
	if (!user) return ""
	const parts = [user.first_name, user.last_name].filter(Boolean)
	if (parts.length) return parts.join(" ")
	return user.username || ""
}

export default function PlateletsDonation() {
	const [profile, setProfile] = useState(null)
	const [localProfile, setLocalProfile] = useState(null)
	const [loading, setLoading] = useState(true)
	const [errorState, setErrorState] = useState(null)
	const [availabilitySaving, setAvailabilitySaving] = useState(false)
	const [availabilityError, setAvailabilityError] = useState(null)
	const [matchedNeeds, setMatchedNeeds] = useState([])
	const [emergencyNeeds, setEmergencyNeeds] = useState([])
	const [activeTab, setActiveTab] = useState("matches")
	const [donationRequests, setDonationRequests] = useState([])
	const [loadingRequests, setLoadingRequests] = useState(true)
	const [coupons, setCoupons] = useState([])
	const [loadingCoupons, setLoadingCoupons] = useState(true)

	// Health Verification State
	const [healthReportUploaded, setHealthReportUploaded] = useState(false)
	const [healthReportFile, setHealthReportFile] = useState(null)
	const [uploadError, setUploadError] = useState(null)
	const [healthEligible, setHealthEligible] = useState(false)
	const [showEligibilityPopup, setShowEligibilityPopup] = useState(false)
	const [eligibilityMessage, setEligibilityMessage] = useState("")
	const [confirmingAttendance, setConfirmingAttendance] = useState(null)

	const DONATION_REQUESTS_STORAGE_KEY = "lifesaver:donation_requests"

	const loadDonationRequests = useCallback(async () => {
		try {
			const requests = await apiFetch("/donation-requests/?donor=me&request_type=PLATELETS")
			setDonationRequests(requests)
			if (typeof window !== "undefined") {
				localStorage.setItem(DONATION_REQUESTS_STORAGE_KEY, JSON.stringify(requests))
			}
		} catch (error) {
			if (typeof window !== "undefined") {
				const stored = localStorage.getItem(DONATION_REQUESTS_STORAGE_KEY)
				if (stored) {
					try {
						const requests = JSON.parse(stored)
						const filtered = requests.filter(r => r.request_type === "PLATELETS")
						setDonationRequests(filtered)
					} catch (e) {
						setDonationRequests([])
					}
				}
			}
		} finally {
			setLoadingRequests(false)
		}
	}, [])

	const loadCoupons = useCallback(async () => {
		try {
			const data = await apiFetch("/donor-coupons/")
			setCoupons(data || [])
		} catch (error) {
			console.error("Failed to load coupons:", error)
		} finally {
			setLoadingCoupons(false)
		}
	}, [])

	useEffect(() => {
		loadDonationRequests()
		loadCoupons()

		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible") {
				loadDonationRequests()
				loadCoupons()
			}
		}
		document.addEventListener("visibilitychange", handleVisibilityChange)

		const handleFocus = () => loadDonationRequests()
		window.addEventListener("focus", handleFocus)

		return () => {
			document.removeEventListener("visibilitychange", handleVisibilityChange)
			window.removeEventListener("focus", handleFocus)
		}
	}, [loadDonationRequests])

	// Health Status State
	const [showHealthForm, setShowHealthForm] = useState(false)
	const [healthStatus, setHealthStatus] = useState({
		hasSymptoms: false,
		symptoms: [],
		cough: false,
		fever: false,
		cold: false,
		fatigue: false,
		headache: false,
		nausea: false,
		otherSymptoms: "",
		temperature: "",
		lastMedication: "",
		healthNotes: "",
		age: "",
		weight: "",
	})
	const [healthAssessment, setHealthAssessment] = useState(null)
	const [medicineSuggestions, setMedicineSuggestions] = useState([])

	// Health Assessment Function
	function handleHealthAssessment() {
		const symptoms = []
		if (healthStatus.cough) symptoms.push("Cough")
		if (healthStatus.fever) symptoms.push("Fever")
		if (healthStatus.cold) symptoms.push("Cold")
		if (healthStatus.fatigue) symptoms.push("Fatigue")
		if (healthStatus.headache) symptoms.push("Headache")
		if (healthStatus.nausea) symptoms.push("Nausea")
		if (healthStatus.otherSymptoms) symptoms.push(healthStatus.otherSymptoms)

		let healthScore = 100
		let canDonate = true
		let recommendation = ""
		const medicines = []

		const age = parseInt(healthStatus.age)
		if (!age || age < 18) {
			healthScore -= 50
			canDonate = false
			recommendation = !age ? "Please enter your age." : "Must be at least 18 years old."
		}

		const weight = parseFloat(healthStatus.weight)
		if (!weight || weight <= 50) {
			healthScore -= 50
			canDonate = false
			recommendation += !weight ? " Please enter your weight." : " Must weigh more than 50 kg."
		}

		if (healthStatus.fever) { healthScore -= 30; canDonate = false; }
		if (healthStatus.cough) { healthScore -= 20; canDonate = false; }
		if (healthStatus.cold) { healthScore -= 15; canDonate = false; }

		const assessment = {
			canDonate,
			healthScore: Math.max(0, Math.min(100, healthScore)),
			message: canDonate ? "You appear eligible for platelet donation." : "You may not be eligible at this time.",
			recommendation,
			symptoms,
		}

		setHealthAssessment(assessment)
		setHealthEligible(canDonate)

		if (typeof window !== "undefined") {
			localStorage.setItem("lifesaver:health_eligible_platelets", canDonate.toString())
		}
	}

	// Generate Health Report PDF for Platelets
	async function generateHealthReportPDF() {
		if (!healthAssessment || !healthAssessment.canDonate) {
			alert("Please complete assessment and be eligible first.")
			return
		}

		const { jsPDF } = await import("jspdf")
		const doc = new jsPDF()
		const pageWidth = doc.internal.pageSize.getWidth()

		doc.setFillColor(233, 30, 99)
		doc.rect(0, 0, pageWidth, 40, 'F')
		doc.setTextColor(255, 255, 255)
		doc.setFontSize(24)
		doc.text("PLATELET DONOR HEALTH REPORT", pageWidth / 2, 20, { align: 'center' })

		doc.setTextColor(0, 0, 0)
		let y = 60
		doc.text(`Donor: ${donorName || 'N/A'}`, 20, y)
		y += 10
		doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, y)
		y += 10
		doc.text(`Health Score: ${healthAssessment.healthScore}/100`, 20, y)
		y += 10
		doc.text(`Status: ${healthAssessment.canDonate ? 'ELIGIBLE' : 'INELIGIBLE'}`, 20, y)

		doc.save("Platelet_Health_Report.pdf")
	}

	useEffect(() => {
		if (typeof window === "undefined") return
		const stored = window.localStorage.getItem(DONOR_PROFILE_STORAGE_KEY)
		if (!stored) return
		try {
			setLocalProfile(JSON.parse(stored))
		} catch {
			window.localStorage.removeItem(DONOR_PROFILE_STORAGE_KEY)
		}
	}, [])

	const loadProfile = useCallback(async () => {
		try {
			const p = await apiFetch("/donors/me/")
			setProfile(p)
			setLocalProfile(p)
			if (typeof window !== "undefined") {
				window.localStorage.setItem(DONOR_PROFILE_STORAGE_KEY, JSON.stringify(p))
			}
			return { status: "ok" }
		} catch (err) {
			if (err.status === 404) {
				setProfile(null)
				setLocalProfile(null)
				if (typeof window !== "undefined") {
					window.localStorage.removeItem(DONOR_PROFILE_STORAGE_KEY)
				}
				return { status: "not_found" }
			}
			throw err
		}
	}, [])

	const loadNeeds = useCallback(async () => {
		try {
			const [allNeeds, matches] = await Promise.all([
				apiFetch("/needs/?need_type=PLATELETS&status=OPEN"),
				apiFetch("/needs/matched_needs/")
			])
			setEmergencyNeeds(allNeeds || [])
			setMatchedNeeds((matches || []).filter(m => m.need_type === "PLATELETS"))
		} catch {
			setEmergencyNeeds([])
			setMatchedNeeds([])
		}
	}, [])

	useEffect(() => {
		async function run() {
			setLoading(true)
			try {
				await loadProfile()
				// Needs are loaded but not filtered yet - we wait for profile to filter
				await loadNeeds()
				setErrorState(null)
			} catch (err) {
				setErrorState({ type: "general", message: err.message || "Unable to load platelet data." })
			} finally {
				setLoading(false)
			}
		}
		run()
	}, [loadProfile, loadNeeds])

	const donor = profile || localProfile || null
	const donorName = donor?.name

	// Calculate compatible groups
	const compatibleGroups = useMemo(() => {
		if (!donor || !donor.blood_group) return []
		return PLATELET_COMPATIBILITY[donor.blood_group] || []
	}, [donor])

	// Filter matched needs based on compatibility
	const filteredMatchedNeeds = useMemo(() => {
		if (!matchedNeeds.length || !compatibleGroups.length) return []
		return matchedNeeds.filter(need => {
			// If need has no specific blood group requirement, show it?? 
			// Usually needs are specific. Assuming need.required_blood_group exists.
			if (!need.required_blood_group) return true
			return compatibleGroups.includes(need.required_blood_group)
		})
	}, [matchedNeeds, compatibleGroups])
	const totalPlateletDonations = useMemo(
		() => DONATION_HISTORY_PLACEHOLDER.filter((entry) => entry.type === "Platelets").length,
		[],
	)

	async function handleAvailabilityToggle() {
		if (!donor) return
		setAvailabilityError(null)
		setAvailabilitySaving(true)
		try {
			await apiFetch("/donors/me/", {
				method: "PATCH",
				body: JSON.stringify({ is_available: !donor.is_available }),
			})
			await loadProfile()
		} catch (err) {
			setAvailabilityError(err.message || "Unable to update availability. Please try again.")
			if (err.status === 401) {
				setErrorState({ type: "unauthorised" })
			}
		} finally {
			setAvailabilitySaving(false)
		}
	}

	// Computed values for request cycle management
	const hasActiveRequest = useMemo(() => {
		return donationRequests.some(r => ["PENDING", "ACCEPTED", "ARRIVED"].includes(r.status))
	}, [donationRequests])

	const mostRecentRequest = useMemo(() => {
		if (donationRequests.length === 0) return null
		return donationRequests[0] // Already sorted by -created_at from API
	}, [donationRequests])

	// Check if the most recent request is COMPLETED or REJECTED (requires new health report)
	const needsNewHealthReport = useMemo(() => {
		if (!mostRecentRequest) return false
		return ["COMPLETED", "REJECTED"].includes(mostRecentRequest.status)
	}, [mostRecentRequest])

	// Determine if the donor can request a new donation
	const canRequestNewDonation = useMemo(() => {
		// Cannot request if there's an active request in progress
		if (hasActiveRequest) return false
		// Must have health report uploaded for this cycle
		if (!healthReportUploaded) return false
		// Must be health eligible
		if (!healthEligible) return false
		return true
	}, [hasActiveRequest, healthReportUploaded, healthEligible])

	// Load health report upload status and eligibility from localStorage
	useEffect(() => {
		if (typeof window === "undefined") return
		const uploadStatus = localStorage.getItem("lifesaver:health_report_uploaded")
		if (uploadStatus === "true") {
			setHealthReportUploaded(true)
		}

		// Check health eligibility from health history
		const savedHistory = localStorage.getItem("lifesaver:health_history")
		if (savedHistory) {
			try {
				const history = JSON.parse(savedHistory)
				if (history.length > 0) {
					const lastEntry = history[history.length - 1]
					// Score >= 80 means eligible
					if (lastEntry.score >= 80) {
						setHealthEligible(true)
					}
				}
			} catch {
				// Ignore parse errors
			}
		}
	}, [])

	// Reset health report status when donation is COMPLETED or REJECTED (for the cycle loop)
	useEffect(() => {
		if (typeof window === "undefined" || !mostRecentRequest) return

		if (["COMPLETED", "REJECTED"].includes(mostRecentRequest.status)) {
			// Clear the health report for this cycle - donor must upload a new one
			localStorage.removeItem("lifesaver:health_report_uploaded")
			localStorage.removeItem("lifesaver:health_report_filename")
			setHealthReportUploaded(false)
			setHealthReportFile(null)
		}
	}, [mostRecentRequest])

	// Handle New Request button click
	function handleNewRequestClick() {
		// Check if there's already an active request
		if (hasActiveRequest) {
			setEligibilityMessage("You already have an active donation request. Please wait for it to be completed or resolved before requesting a new one.")
			setShowEligibilityPopup(true)
			return
		}
		if (!healthReportUploaded) {
			setEligibilityMessage("Please upload your health report PDF first. Go to the Blood Donation page to complete your health assessment and download your report.")
			setShowEligibilityPopup(true)
			return
		}
		if (!healthEligible) {
			setEligibilityMessage("Your health status does not meet the eligibility criteria for platelet donation. Please complete a health check on the Blood Donation page and ensure you are eligible before requesting.")
			setShowEligibilityPopup(true)
			return
		}
		// Navigate to request page
		window.location.href = "/donor/donate?type=PLATELETS"
	}

	// Handle confirm attendance (donor confirms they will come)
	async function handleConfirmAttendance(requestId) {
		setConfirmingAttendance(requestId)
		try {
			await apiFetch(`/donation-requests/${requestId}/confirm_arrival/`, {
				method: "POST"
			})
			await loadDonationRequests()
			alert("Attendance confirmed! The hospital has been notified. Please arrive at the scheduled time.")
		} catch (error) {
			console.error("Error confirming attendance:", error)
			alert("Failed to confirm attendance. Please try again.")
		} finally {
			setConfirmingAttendance(null)
		}
	}

	// Handle health report file upload
	function handleHealthReportUpload(event) {
		const file = event.target.files?.[0]
		setUploadError(null)

		if (!file) return

		// Validate file type
		if (file.type !== "application/pdf") {
			setUploadError("Only PDF files are allowed")
			event.target.value = ""
			return
		}

		// Validate file size (max 5MB)
		if (file.size > 5 * 1024 * 1024) {
			setUploadError("File size must be less than 5MB")
			event.target.value = ""
			return
		}

		// Store file and update status
		setHealthReportFile(file)
		setHealthReportUploaded(true)
		setUploadError(null)

		// Persist to localStorage
		if (typeof window !== "undefined") {
			localStorage.setItem("lifesaver:health_report_uploaded", "true")
			localStorage.setItem("lifesaver:health_report_filename", file.name)
		}

		alert(`Health report "${file.name}" uploaded successfully! You can now request platelet donations.`)
	}

	// Calculate stats
	const plateletStats = useMemo(() => {
		const completed = donationRequests.filter(r => r.status === "COMPLETED").length
		const progress = completed % 3
		const percentage = (progress / 3) * 100
		return { completed, progress, percentage }
	}, [donationRequests])

	// Chart constants
	const CIRCLE_RADIUS = 36
	const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS

	return (
		<>
			<Head>
				<title>Platelet Donation — LifeSaver Connect</title>
			</Head>
			<main className="min-h-screen bg-[#1A1A2E] text-white">
				<header className="border-b border-[#F6D6E3]/30 bg-[#131326]/80 backdrop-blur">
					<div className="mx-auto flex flex-col gap-3 md:flex-row md:items-center md:justify-between max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
						<div>
							<h1 className="text-3xl md:text-4xl font-extrabold" style={{ fontFamily: "'Poppins', sans-serif" }}>
								Platelet Donation
							</h1>
							<p className="mt-1 text-sm text-pink-100/80">
								Review apheresis readiness, manage availability, and choose a center.
							</p>
						</div>
						<div className="flex flex-wrap gap-2">
							<Link href="/needs" legacyBehavior>
								<a className="rounded-lg border border-[#F6D6E3] px-4 py-2 text-sm font-medium text-pink-100 hover:bg-white/5 transition">
									View Platelet Needs
								</a>
							</Link>
							<Link href="/donor/donate?type=PLATELETS" legacyBehavior>
								<a className="rounded-lg bg-[#E91E63] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition">
									Find Apheresis Center
								</a>
							</Link>
							<Link href="/register/donor" legacyBehavior>
								<a className="rounded-lg bg-[#E91E63] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition">
									Update Donor Profile
								</a>
							</Link>
							<Link href="/donor/dashboard" legacyBehavior>
								<a className="rounded-lg border border-slate-500 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/5">
									Back to Donor Hub
								</a>
							</Link>
						</div>
					</div>
				</header>

				<section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 space-y-10">
					{loading ? (
						<div className="rounded-2xl border border-dashed border-[#F6D6E3]/40 bg-[#131326] p-6 text-sm text-pink-100/70">
							Loading platelet donation details…
						</div>
					) : (
						<>
							{errorState?.type === "profile-missing" && (
								<div className="rounded-2xl border border-[#4e7fff]/40 bg-[#102040] p-8 text-sm text-[#d7dcff]">
									<h2 className="text-xl font-semibold text-white">Complete your donor profile</h2>
									<p className="mt-2">
										We couldn’t find your donor details yet. Finish registration so we can match you with platelet requests.
									</p>
									<Link href="/register/donor" legacyBehavior>
										<a className="mt-4 inline-flex rounded-lg bg-[#4e7fff] px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90">
											Start Donor Registration
										</a>
									</Link>
								</div>
							)}
							{errorState?.type === "general" && (
								<div className="rounded-2xl border border-rose-400 bg-rose-500/10 p-6 text-sm text-rose-100">
									<p>{errorState.message}</p>
								</div>
							)}

							{/* Health Verification Banner */}
							{!healthReportUploaded && (
								<div className="rounded-2xl border-2 border-yellow-500/50 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 p-6 shadow-lg">
									<div className="flex items-start gap-4">
										<div className="flex-shrink-0">
											<div className="h-12 w-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
												<svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
												</svg>
											</div>
										</div>
										<div className="flex-1">
											<h3 className="text-lg font-bold text-yellow-300 mb-2">Health Verification Required</h3>
											<p className="text-sm text-yellow-100/90 mb-4">
												Before requesting platelet donations, you must complete a health assessment and upload your health report.
											</p>
											<div className="flex flex-col sm:flex-row gap-3">
												<Link href="/donor/blood#health-status" legacyBehavior>
													<a className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#E91E63] px-5 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-[#D81B60] transition-all">
														<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
														</svg>
														Check Health Status
													</a>
												</Link>
												<div className="flex-1">
													<label className="block">
														<input
															type="file"
															accept="application/pdf"
															onChange={handleHealthReportUpload}
															className="hidden"
															id="health-report-upload"
														/>
														<span className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-yellow-400 px-5 py-2.5 text-sm font-bold text-yellow-300 hover:bg-yellow-400/10 transition-all cursor-pointer">
															<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
															</svg>
															Upload Health Report PDF
														</span>
													</label>
													{uploadError && (
														<p className="mt-2 text-xs text-red-300">{uploadError}</p>
													)}
												</div>
											</div>
										</div>
									</div>
								</div>
							)}

							{/* Upload Success Banner */}
							{healthReportUploaded && !hasActiveRequest && (
								<div className="rounded-2xl border-2 border-green-500/50 bg-gradient-to-r from-green-500/10 to-emerald-500/10 p-4">
									<div className="flex items-center gap-3">
										<div className="flex-shrink-0">
											<div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
												<svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
													<path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
												</svg>
											</div>
										</div>
										<div className="flex-1">
											<p className="text-sm font-semibold text-green-300">✓ Health Report Verified</p>
											<p className="text-xs text-green-200/80 mt-0.5">You can now request platelet donations</p>
										</div>
									</div>
								</div>
							)}

							{/* Active Request Banner */}
							{hasActiveRequest && (
								<div className="rounded-2xl border-2 border-blue-500/50 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 p-4">
									<div className="flex items-center gap-3">
										<div className="flex-shrink-0">
											<div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center">
												<svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
												</svg>
											</div>
										</div>
										<div className="flex-1">
											<p className="text-sm font-semibold text-blue-300">⏳ Active Request in Progress</p>
											<p className="text-xs text-blue-200/80 mt-0.5">You have an ongoing donation request. Complete or cancel it before requesting again.</p>
										</div>
									</div>
								</div>
							)}


							{/* My Platelet Requests Section */}
							<div className="rounded-2xl border border-[#F6D6E3] bg-[#131326] p-8 shadow-xl">
								<div className="flex items-center justify-between mb-8">
									<div>
										<h2 className="text-xl font-bold text-white uppercase tracking-wider">My Platelet Requests</h2>
										<p className="text-sm text-pink-100/50 mt-1">Track the status of your apheresis donation bookings.</p>
									</div>
									<button
										type="button"
										onClick={handleNewRequestClick}
										disabled={!canRequestNewDonation}
										className={`rounded-lg px-6 py-2.5 text-sm font-bold transition ${canRequestNewDonation ? 'bg-[#E91E63] text-white shadow-[0_4px_15px_rgba(233,30,99,0.3)] hover:opacity-90' : 'bg-gray-500/50 text-gray-300 cursor-not-allowed'}`}
									>
										New Request
									</button>
								</div>

								{loadingRequests ? (
									<div className="flex items-center justify-center p-20">
										<div className="h-10 w-10 animate-spin rounded-full border-4 border-[#E91E63] border-t-transparent"></div>
									</div>
								) : donationRequests.length > 0 ? (
									<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
										{donationRequests.map((request) => {
											const hospital = request.hospital || {}
											const statusColors = {
												PENDING: "bg-yellow-500/10 text-yellow-300 border-yellow-500/40",
												ACCEPTED: "bg-green-500/10 text-green-300 border-green-500/40",
												ARRIVED: "bg-blue-500/10 text-blue-300 border-blue-500/40",
												REJECTED: "bg-red-500/10 text-red-300 border-red-500/40",
												COMPLETED: "bg-purple-500/10 text-purple-300 border-purple-500/40",
											}
											return (
												<div key={request.id} className="rounded-2xl border border-[#F6D6E3]/20 bg-[#1A1A2E] p-5 flex flex-col justify-between hover:border-[#F6D6E3]/40 transition shadow-lg">
													<div>
														<div className="flex items-start justify-between mb-4">
															<div className="max-w-[140px]">
																<p className="font-black text-white text-lg truncate leading-tight">{hospital.name || "Hospital"}</p>
																<p className="text-[10px] text-pink-100/50 uppercase font-bold tracking-widest">{hospital.city || "Center"}</p>
															</div>
															<span className={`rounded px-3 py-1 text-[10px] font-black uppercase border shadow-sm ${statusColors[request.status] || statusColors.PENDING}`}>
																{request.status || "PENDING"}
															</span>
														</div>

														<div className="space-y-3 mb-6">
															{request.status === "PENDING" && (
																<div className="rounded-lg bg-yellow-500/5 p-3 border border-yellow-500/10">
																	<p className="text-xs text-yellow-200/90 font-medium leading-relaxed">⌛ Your booking is awaiting confirmation from the medical staff.</p>
																</div>
															)}
															{request.status === "ACCEPTED" && (
																<div className="rounded-lg bg-green-500/5 p-3 border border-green-500/10">
																	<p className="text-xs text-green-300 font-bold mb-1 flex items-center gap-1.5">
																		<span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-500/20 text-[8px]">✓</span>
																		Hospital Accepted
																	</p>
																	{request.scheduled_date && (
																		<div className="mt-2 p-2 bg-green-500/10 rounded-lg">
																			<p className="text-[10px] text-green-200/70 uppercase font-bold tracking-wider">Scheduled Time</p>
																			<p className="text-sm text-white font-bold mt-0.5">
																				{new Date(request.scheduled_date).toLocaleString(undefined, {
																					weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
																				})}
																			</p>
																		</div>
																	)}
																	{request.notes && <p className="text-[10px] text-green-100/60 mt-2 italic">{request.notes}</p>}
																	<button
																		type="button"
																		onClick={() => handleConfirmAttendance(request.id)}
																		disabled={confirmingAttendance === request.id}
																		className="mt-3 w-full rounded-lg bg-green-600 py-2.5 text-sm font-bold text-white shadow-lg shadow-green-500/20 hover:bg-green-500 disabled:opacity-50 transition uppercase tracking-wider flex items-center justify-center gap-2"
																	>
																		{confirmingAttendance === request.id ? (
																			<>
																				<span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
																				Confirming...
																			</>
																		) : (
																			<>
																				<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
																				</svg>
																				Confirm I Will Attend
																			</>
																		)}
																	</button>
																</div>
															)}
															{request.status === "ARRIVED" && (
																<div className="rounded-lg bg-blue-500/5 p-3 border border-blue-500/10">
																	<p className="text-xs text-blue-300 font-bold mb-1 flex items-center gap-1.5">
																		<span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500/20 text-[8px]">🏥</span>
																		Attendance Confirmed
																	</p>
																	<p className="text-[10px] text-blue-200/80 mt-1">Waiting for hospital to verify your donation. Please proceed to the donation center.</p>
																	{request.scheduled_date && (
																		<p className="text-[11px] text-white font-semibold mt-2">
																			📅 {new Date(request.scheduled_date).toLocaleString(undefined, {
																				weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
																			})}
																		</p>
																	)}
																</div>
															)}
															{request.status === "COMPLETED" && (
																<div className="rounded-lg bg-purple-500/5 p-3 border border-purple-500/10">
																	<p className="text-xs text-purple-300 font-bold mb-1 flex items-center gap-1.5">
																		<span className="flex h-4 w-4 items-center justify-center rounded-full bg-purple-500/20 text-[8px]">⭐</span>
																		Donation Completed!
																	</p>
																	<p className="text-[10px] text-purple-200/80 mt-1">Thank you for your life-saving donation! Rewards have been credited to your account.</p>
																	<div className="mt-2 flex items-center gap-2">
																		<span className="text-yellow-400 text-lg">⭐</span>
																		<span className="text-xs text-yellow-300 font-bold">+1 Star</span>
																		<span className="text-orange-400 text-lg">🍊</span>
																		<span className="text-xs text-orange-300 font-bold">Fruity Given</span>
																	</div>
																</div>
															)}
															{request.status === "REJECTED" && (
																<div className="rounded-lg bg-red-500/5 p-3 border border-red-500/10">
																	<p className="text-xs text-red-300 font-bold flex items-center gap-1.5">
																		<span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500/20 text-[8px]">✗</span>
																		Declined
																	</p>
																	{request.notes && <p className="text-[10px] text-red-100/60 mt-1">{request.notes}</p>}
																</div>
															)}
														</div>
													</div>

													<div className="flex items-center justify-between pt-4 border-t border-[#F6D6E3]/10">
														<p className="text-[9px] font-black text-pink-100/30 uppercase tracking-[0.2em]">
															Ref: #{request.id.toString().slice(-4)}
														</p>
														<p className="text-[10px] font-medium text-pink-100/50">
															{new Date(request.created_at).toLocaleDateString()}
														</p>
													</div>
												</div>
											)
										})}
									</div>
								) : (
									<div className="rounded-2xl border border-dashed border-[#F6D6E3]/20 p-12 text-center">
										<div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#1A1A2E] mb-4">
											<p className="text-xl">📋</p>
										</div>
										<p className="text-sm font-semibold text-pink-100/60">No platelet requests found</p>
										<p className="text-xs text-pink-100/40 mt-1">Book an appointment with an apheresis center to get started.</p>
									</div>
								)}
							</div>

							{/* Open Platelet Needs Section */}
							<div className="rounded-2xl border border-[#F6D6E3] bg-[#131326] p-6 mb-6">
								<div className="flex flex-col gap-4 mb-6">
									<div className="flex items-center justify-between">
										<h2 className="text-lg font-semibold text-white">Open Platelet Needs</h2>
									</div>
									<div className="flex gap-2 p-1 bg-white/5 rounded-xl">
										<button
											onClick={() => setActiveTab("matches")}
											className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${activeTab === "matches"
												? "bg-red-600 text-white shadow-lg shadow-red-600/20"
												: "text-pink-100/40 hover:text-pink-100/60"
												}`}
										>
											Matches ({matchedNeeds.length})
										</button>
										<button
											onClick={() => setActiveTab("all")}
											className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${activeTab === "all"
												? "bg-[#1B3C73] text-white shadow-lg shadow-[#1B3C73]/20"
												: "text-pink-100/40 hover:text-pink-100/60"
												}`}
										>
											All ({emergencyNeeds.length})
										</button>
									</div>
								</div>

								{(activeTab === "matches" ? matchedNeeds : emergencyNeeds).length ? (
									<ul className="space-y-3">
										{(activeTab === "matches" ? matchedNeeds : emergencyNeeds).slice(0, 5).map((need) => {
											const isUrgent = need.status === "URGENT"
											return (
												<li key={need.id} className="rounded-xl border border-[#F6D6E3]/40 bg-[#1A1A2E] p-4 hover:border-[#E91E63]/60 transition group">
													<div className="flex items-start justify-between gap-3">
														<div className="flex-1 min-w-0">
															<div className="flex items-center gap-2 mb-2">
																<span className="font-bold text-white text-sm truncate">{need.title || need.need_type}</span>
																<span className={`rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-tighter ${isUrgent ? "bg-red-500/20 text-red-300" : "bg-yellow-500/20 text-yellow-300"}`}>
																	{need.status || "NORMAL"}
																</span>
															</div>
															<div className="space-y-1">
																<p className="text-[10px] text-pink-100/60 flex items-center gap-1">
																	📍 {need.city}
																</p>
																<p className="text-[10px] text-pink-100/70 border-t border-white/5 pt-1 mt-1 font-mono">
																	{need.contact_phone}
																</p>
															</div>
														</div>
														<Link href={`/needs/${need.id}`} legacyBehavior>
															<a className="rounded-lg h-10 w-10 flex items-center justify-center bg-[#E91E63]/10 text-[#E91E63] hover:bg-[#E91E63] hover:text-white transition-all shadow-sm">
																<span className="font-black text-xs">{need.required_blood_group || 'Any'}</span>
															</a>
														</Link>
													</div>
												</li>
											)
										})}
									</ul>
								) : (
									<div className="rounded-xl border border-dashed border-[#F6D6E3]/40 bg-[#1A1A2E] p-6 text-sm text-pink-100/70 text-center">
										<p>No {activeTab === "matches" ? "compatible" : "active"} platelet requests found.</p>
									</div>
								)}
							</div>

							{/* Platelet Compatibility + Matched Needs */}
							<div className="grid gap-6 md:grid-cols-2">
								<div className="rounded-2xl border border-[#F6D6E3] bg-[#131326] p-6">
									<h2 className="text-lg font-semibold text-white">Platelet Compatibility</h2>
									<p className="mt-2 text-sm text-pink-100/70">
										Based on your blood group <strong>{donor?.blood_group || "Unknown"}</strong>, you can donate platelets to:
									</p>
									{compatibleGroups.length > 0 ? (
										<div className="mt-4 rounded-xl bg-[#E91E63]/10 border border-[#E91E63]/30 p-4">
											<div className="flex flex-wrap gap-2">
												{compatibleGroups.map(group => (
													<span key={group} className="px-3 py-1 rounded-full bg-[#E91E63] text-white text-sm font-bold shadow-md">
														{group}
													</span>
												))}
											</div>
											<p className="mt-3 text-xs text-pink-200/60">
												* Only people with these blood types can receive your platelets safely.
											</p>
										</div>
									) : (
										<div className="mt-4 text-sm text-gray-400 italic">
											Update your blood group profile to see compatibility.
										</div>
									)}
									<div className="mt-6">
										<p className="text-sm font-medium text-pink-100/80 mb-2">Compatibility Chart Reference</p>
										<div className="rounded-xl overflow-hidden border border-[#F6D6E3]/20">
											<img src="/platelet_compatibility.png" alt="Platelet Compatibility Chart" className="w-full h-auto object-contain" />
										</div>
									</div>
								</div>

								<div className="rounded-2xl border border-[#F6D6E3] bg-[#131326] p-6">
									<div className="flex items-center justify-between">
										<h2 className="text-lg font-semibold text-white">Matched Platelet Needs</h2>
										<Link href="/needs" legacyBehavior>
											<a className="text-sm text-[#E91E63]">View All</a>
										</Link>
									</div>
									<p className="text-xs text-pink-100/50 mt-1 mb-4">
										Showing only requests compatible with your blood group ({donor?.blood_group || "Unknown"}).
									</p>
									{filteredMatchedNeeds.length ? (
										<ul className="space-y-3">
											{filteredMatchedNeeds.map((need) => (
												<li key={need.id} className="rounded-xl border border-[#F6D6E3]/40 bg-[#1A1A2E] p-4 hover:border-[#E91E63]/50 transition">
													<div className="flex items-center justify-between text-sm text-pink-100/80">
														<span className="font-medium text-white">{need.title || "Platelet Need"}</span>
														<span className="rounded bg-[#E91E63]/10 px-2 py-1 text-xs text-[#E91E63]">
															{need.required_blood_group || "Any"}
														</span>
													</div>
													<p className="mt-2 text-sm text-pink-100/70">
														{need.city} {need.zip_code ? `• ${need.zip_code}` : ""}
													</p>
													{need.contact_phone && (
														<p className="mt-1 text-sm text-pink-100/70">
															Contact: <span className="font-medium text-white">{need.contact_phone}</span>
														</p>
													)}
												</li>
											))}
										</ul>
									) : (
										<div className="mt-4 rounded-xl border border-dashed border-[#F6D6E3]/40 bg-[#1A1A2E] p-6 text-center text-pink-100/70">
											<p>No compatible platelet needs found matching your blood group.</p>
										</div>
									)}
								</div>
							</div>

							{/* Compact Stats, Rewards & Readiness Row */}
							<div className="rounded-2xl border border-[#F6D6E3]/30 bg-[#131326] p-4 shadow-sm">
								<div className="flex flex-col md:flex-row items-center gap-4">
									{/* Mini Progress Circle + Stats */}
									<div className="flex items-center gap-4 shrink-0">
										<div className="relative h-16 w-16">
											<svg className="h-full w-full -rotate-90 transform" viewBox="0 0 100 100">
												<circle className="text-pink-900/20" strokeWidth="10" stroke="currentColor" fill="transparent" r={CIRCLE_RADIUS} cx="50" cy="50" />
												<circle className="text-[#E91E63] transition-all duration-1000 ease-out" strokeWidth="10" strokeDasharray={CIRCLE_CIRCUMFERENCE} strokeDashoffset={CIRCLE_CIRCUMFERENCE - (plateletStats.percentage / 100) * CIRCLE_CIRCUMFERENCE} strokeLinecap="round" stroke="currentColor" fill="transparent" r={CIRCLE_RADIUS} cx="50" cy="50" />
											</svg>
											<div className="absolute inset-0 flex flex-col items-center justify-center text-center">
												<span className="text-xs font-bold text-white leading-none">{plateletStats.progress}/3</span>
											</div>
										</div>
										<div>
											<p className="text-xs text-pink-100/60 uppercase tracking-wider font-semibold">Total Donations</p>
											<p className="text-lg font-bold text-white">{plateletStats.completed}</p>
										</div>
									</div>
									<div className="hidden md:block w-px h-12 bg-[#F6D6E3]/20"></div>
									{/* Rewards */}
									<div className="flex-1 min-w-0">
										<p className="text-xs text-pink-100/60 uppercase tracking-wider font-semibold mb-2">Your Rewards</p>
										{coupons.filter(c => !c.is_used).length > 0 ? (
											<div className="max-h-24 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#E91E63 transparent' }}>
												<div className="flex flex-wrap gap-2">
													{coupons.filter(c => !c.is_used).map((coupon) => (
														<div key={coupon.id} className="flex items-center gap-2 rounded-lg border border-dashed border-[#E91E63]/40 bg-[#1A1A2E] px-3 py-1.5">
															<span className="text-sm font-black text-white font-mono">{coupon.code}</span>
															<span className="text-[10px] text-pink-100/60">{coupon.discount_percentage}% OFF</span>
															<span className="text-[8px] text-green-400 font-bold">Active</span>
														</div>
													))}
												</div>
											</div>
										) : (
											<p className="text-xs text-pink-100/40">Earn coupons by completing donations.</p>
										)}
									</div>
									<div className="hidden md:block w-px h-12 bg-[#F6D6E3]/20"></div>
									{/* Readiness */}
									<div className="shrink-0">
										<p className="text-xs text-pink-100/60 uppercase tracking-wider font-semibold mb-1">Readiness</p>
										<ul className="text-[11px] text-pink-100/50 space-y-0.5">
											<li>• No aspirin/NSAIDs 48h</li>
											<li>• Hydrate well</li>
											<li>• Allow ~90 mins</li>
										</ul>
									</div>
								</div>
							</div>

							<div className="rounded-2xl border border-[#F6D6E3] bg-[#131326] p-6">
								<h2 className="text-lg font-semibold text-white">Platelet Donation Guide</h2>
								<p className="mt-3 text-sm text-pink-100/80">
									Platelet donations use apheresis; sessions take longer and require specific readiness. Always follow medical guidance.
								</p>
								<div className="mt-4 grid gap-4 md:grid-cols-2">
									<div className="rounded-xl border border-[#F6D6E3]/40 bg-[#1A1A2E] p-4 text-sm text-pink-100/80">
										<h3 className="text-base font-medium text-white">Before you donate</h3>
										<ul className="mt-2 space-y-1">
											<li>No aspirin/NSAIDs in past 48 hours.</li>
											<li>Hydrate well; eat a light meal.</li>
											<li>Bring ID and allow ~90 minutes.</li>
										</ul>
									</div>
									<div className="rounded-xl border border-[#F6D6E3]/40 bg-[#1A1A2E] p-4 text-sm text-pink-100/80">
										<h3 className="text-base font-medium text-white">After donation</h3>
										<ul className="mt-2 space-y-1">
											<li>Rest, hydrate, and avoid heavy lifting.</li>
											<li>Report any discomfort to the center.</li>
											<li>Follow post-donation guidance provided.</li>
										</ul>
									</div>
								</div>
							</div>
						</>
					)}
				</section>
			</main>

			{/* Eligibility Popup Modal */}
			{showEligibilityPopup && (
				<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
					<div className="bg-[#1A1A2E] rounded-2xl border border-yellow-500/50 max-w-md w-full p-6 shadow-2xl">
						<div className="flex items-start gap-4">
							<div className="flex-shrink-0">
								<div className="h-12 w-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
									<svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
									</svg>
								</div>
							</div>
							<div className="flex-1">
								<h3 className="text-lg font-bold text-yellow-300 mb-2">Action Required</h3>
								<p className="text-sm text-yellow-100/90 mb-4">{eligibilityMessage}</p>
								<div className="flex flex-col sm:flex-row gap-3">
									<Link href="/donor/blood#health-status" legacyBehavior>
										<a className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#E91E63] px-5 py-2 text-sm font-bold text-white hover:bg-[#D81B60] transition-all">
											<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
											</svg>
											Go to Health Check
										</a>
									</Link>
									<button
										type="button"
										onClick={() => setShowEligibilityPopup(false)}
										className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-500 px-5 py-2 text-sm font-medium text-gray-300 hover:bg-gray-500/20 transition-all"
									>
										Close
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			)}
		</>
	)
}

