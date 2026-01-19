import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import { useCallback, useEffect, useMemo, useState } from "react"
import { apiFetch } from "../../lib/api"

const DONATION_HISTORY_PLACEHOLDER = []
const PLATELET_HISTORY_PLACEHOLDER = []
const DONOR_PROFILE_STORAGE_KEY = "lifesaver:donor_profile"
const DONATION_REQUESTS_STORAGE_KEY = "lifesaver:donation_requests"

// Mock upcoming events data - will be replaced by API data if available
const UPCOMING_EVENTS_FALLBACK = [
	{
		id: 1,
		date: "Sat • 7 Dec",
		title: "Community Mega Blood Drive",
		location: "City Care Hospital, Downtown",
	},
	{
		id: 2,
		date: "Sun • 22 Dec",
		title: "LifeSaver Outreach Camp",
		location: "Unity Convention Centre",
	},
	{
		id: 3,
		date: "Sat • 14 Dec",
		title: "Holiday Season Blood Donation Drive",
		location: "Regional Medical Center",
	},
]


function calculateNextEligibleDate(lastDonationDate) {
	if (!lastDonationDate) {
		return "No donations recorded"
	}
	const parsed = new Date(lastDonationDate)
	if (Number.isNaN(parsed.getTime())) {
		return "Check with medical team"
	}
	const next = new Date(parsed)
	next.setDate(next.getDate() + 56)
	return next.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
}

export default function BloodDonation() {
	const router = useRouter()

	const [dashboard, setDashboard] = useState(null)
	const [donorProfile, setDonorProfile] = useState(null)
	const [localProfile, setLocalProfile] = useState(null)
	const [errorState, setErrorState] = useState(null)
	const [loading, setLoading] = useState(true)
	const [availabilitySaving, setAvailabilitySaving] = useState(false)
	const [availabilityError, setAvailabilityError] = useState(null)
	const [donationRequests, setDonationRequests] = useState([])


	// Availability Schedule
	const [showAvailabilityForm, setShowAvailabilityForm] = useState(false)
	const [availabilitySchedule, setAvailabilitySchedule] = useState({
		startDate: "",
		endDate: "",
		startTime: "",
		endTime: "",
		daysOfWeek: [],
		notes: "",
	})

	// Health Status
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
	})
	const [healthAssessment, setHealthAssessment] = useState(null)
	const [medicineSuggestions, setMedicineSuggestions] = useState([])
	const [healthHistory, setHealthHistory] = useState([])

	// Load profile from localStorage immediately on mount
	useEffect(() => {
		if (typeof window === "undefined") return
		const stored = window.localStorage.getItem(DONOR_PROFILE_STORAGE_KEY)
		if (stored) {
			try {
				const parsed = JSON.parse(stored)
				setLocalProfile(parsed)
				// Also set as donorProfile if not already set
				if (!donorProfile) {
					setDonorProfile(parsed)
				}
			} catch {
				window.localStorage.removeItem(DONOR_PROFILE_STORAGE_KEY)
			}
		}
	}, [])

	// Ensure we fetch the donor profile once on mount, so logged-in users see their details
	const loadDonorProfile = useCallback(async () => {
		try {
			const profile = await apiFetch("/donors/me/")
			setDonorProfile(profile)
			setLocalProfile(profile)
			if (typeof window !== "undefined") {
				window.localStorage.setItem(DONOR_PROFILE_STORAGE_KEY, JSON.stringify(profile))
			}
			return { status: "ok" }
		} catch (err) {
			if (err.status === 404) {
				setDonorProfile(null)
				setLocalProfile(null)
				if (typeof window !== "undefined") {
					window.localStorage.removeItem(DONOR_PROFILE_STORAGE_KEY)
				}
				return { status: "not_found" }
			}
			throw err
		}
	}, [])

	useEffect(() => {
		loadDonorProfile()
	}, [loadDonorProfile])

	const fetchDashboard = useCallback(
		async (showLoader = true) => {
			if (showLoader) setLoading(true)
			try {
				const data = await apiFetch("/donors/dashboard/")
				setDashboard(data)
				setDonorProfile(data?.donor ?? null)
				setLocalProfile(data?.donor ?? null)
				if (data?.donor && typeof window !== "undefined") {
					window.localStorage.setItem(DONOR_PROFILE_STORAGE_KEY, JSON.stringify(data.donor))
				}

				// Also load hospital needs for matching blood group
				if (data?.donor?.blood_group) {
					try {
						const hospitalNeeds = await apiFetch(`/hospital-needs/?donor_blood_group=${data.donor.blood_group}&active_only=true&need_type=BLOOD`)
						if (hospitalNeeds && hospitalNeeds.length > 0) {
							// Merge hospital needs with emergency needs
							data.recommended_needs = [...(data.recommended_needs || []), ...hospitalNeeds]
						}
					} catch (err) {
						console.error("Error loading hospital needs:", err)
					}
				}

				setErrorState(null)
			} catch (err) {
				if (err.status === 404) {
					const profileResult = await loadDonorProfile()
					if (profileResult.status === "not_found") {
						setErrorState({ type: "profile-missing" })
					} else {
						setErrorState(null)
					}
					setDashboard(null)
				} else if (err.status === 401) {
					setErrorState({ type: "unauthorised" })
					setDashboard(null)
				} else {
					setErrorState({ type: "general", message: err.message || "Unable to load dashboard data." })
					setDashboard(null)
				}
			} finally {
				if (showLoader) setLoading(false)
			}
		},
		[loadDonorProfile],
	)

	useEffect(() => {
		// Try to load profile first if we have localStorage data
		if (localProfile && !donorProfile) {
			setDonorProfile(localProfile)
		}
		console.log('RUNNING THIS');

		fetchDashboard()
		loadDonationRequests()
	}, [])

	async function loadDonationRequests() {
		try {
			const requests = await apiFetch("/donation-requests/?donor=me")
			const filtered = requests.filter((request) => {
				const hospital = request.hospital || {}
				const hospitalName = hospital.name || ""
				if (hospitalName.toLowerCase().includes("city general hospital") && request.status === "ACCEPTED") return false
				return true
			})
			setDonationRequests(filtered)
			if (typeof window !== "undefined") {
				localStorage.setItem(DONATION_REQUESTS_STORAGE_KEY, JSON.stringify(filtered))
			}
		} catch {
			if (typeof window !== "undefined") {
				const stored = localStorage.getItem(DONATION_REQUESTS_STORAGE_KEY)
				if (stored) {
					try {
						const requests = JSON.parse(stored)
						const filtered = requests.filter((request) => {
							const hospital = request.hospital || {}
							const hospitalName = hospital.name || ""
							if (hospitalName.toLowerCase().includes("city general hospital") && request.status === "ACCEPTED") return false
							return true
						})
						setDonationRequests(filtered)
					} catch {
						setDonationRequests([])
					}
				}
			}
		}
	}

	// Prioritize: API donor profile > Dashboard donor > LocalStorage profile
	// This ensures we always show profile if it exists anywhere
	const donor = donorProfile || dashboard?.donor || localProfile || null
	console.log("donor profile----------------------", donor?.name)
	// Also create a fallback donor object from localProfile if donor is null but localProfile exists
	const displayDonor = donor || localProfile || null
	const compatibility = dashboard?.compatibility ?? null
	const recommendedNeeds = dashboard?.recommended_needs ?? []


	// Get upcoming events from API or use fallback
	const upcomingEvents = dashboard?.upcoming_events?.length
		? dashboard.upcoming_events
		: UPCOMING_EVENTS_FALLBACK

	// Blood compatibility mapping (frontend fallback if API doesn't provide)
	const BLOOD_COMPATIBILITY = {
		"O-": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
		"O+": ["O+", "A+", "B+", "AB+"],
		"A-": ["A-", "A+", "AB-", "AB+"],
		"A+": ["A+", "AB+"],
		"B-": ["B-", "B+", "AB-", "AB+"],
		"B+": ["B+", "AB+"],
		"AB-": ["AB-", "AB+"],
		"AB+": ["AB+"],
	}

	// Get compatibility info - use API data or calculate from blood group
	// Always calculate if we have a blood group, even if API doesn't return compatibility
	const compatibilityInfo = useMemo(() => {
		if (compatibility) {
			return {
				can_donate_to: compatibility.can_donate_to || [],
				is_universal: compatibility.is_universal || false,
			}
		}
		// Calculate from donor's blood group if available
		// Check both donor and localProfile for blood group
		const bloodGroup = donor?.blood_group || localProfile?.blood_group
		if (bloodGroup) {
			const canDonateTo = BLOOD_COMPATIBILITY[bloodGroup] || []
			return {
				can_donate_to: canDonateTo,
				is_universal: bloodGroup === "O-",
			}
		}
		return null
	}, [compatibility, donor?.blood_group, localProfile?.blood_group])

	// Check if user has any profile data (to determine if they should see registration prompt)
	// Use donor from any source: API, dashboard, or localStorage
	const hasProfile = !!(donor || localProfile)

	const nextEligibleDate = calculateNextEligibleDate(displayDonor?.last_donated_on)
	const availabilityLabel = displayDonor?.is_available ? "Available for Alerts" : "Unavailable Right Now"
	const availabilitySubtext = displayDonor?.is_available
		? "We'll notify you the moment there's a compatible match."
		: "Switch availability back on to receive urgent notifications."
	const lastDonationDisplay = displayDonor?.last_donated_on
		? (() => {
			const parsed = new Date(displayDonor.last_donated_on)
			if (Number.isNaN(parsed.getTime())) {
				return displayDonor.last_donated_on
			}
			return parsed.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
		})()
		: "Not recorded"

	const totalBloodDonations = useMemo(
		() => DONATION_HISTORY_PLACEHOLDER.filter((entry) => entry.type === "Whole Blood" || entry.type === "Double Red Cells").length,
		[],
	)
	const totalPlateletDonations = useMemo(
		() => PLATELET_HISTORY_PLACEHOLDER.filter((entry) => entry.type === "Platelets").length,
		[],
	)

	async function handleAvailabilityToggle() {
		if (!displayDonor) return
		setAvailabilityError(null)
		setAvailabilitySaving(true)
		try {
			await apiFetch("/donors/me/", {
				method: "PATCH",
				body: JSON.stringify({ is_available: !displayDonor.is_available }),
			})
			await fetchDashboard(false)
			await loadDonorProfile()
		} catch (err) {
			setAvailabilityError(err.message || "Unable to update availability. Please try again.")
			if (err.status === 401) {
				setErrorState({ type: "unauthorised" })
			}
		} finally {
			setAvailabilitySaving(false)
		}
	}

	// Load saved availability schedule
	useEffect(() => {
		if (typeof window === "undefined") return
		const saved = localStorage.getItem("lifesaver:availability_schedule")
		if (saved) {
			try {
				setAvailabilitySchedule(JSON.parse(saved))
			} catch {
				// Ignore parse errors
			}
		}
	}, [])

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

		// Calculate health score (0-100)
		let healthScore = 100
		let canDonate = true
		let recommendation = ""
		const medicines = []

		// Deduct points for symptoms
		if (healthStatus.fever) {
			healthScore -= 30
			canDonate = false
			medicines.push({
				name: "Paracetamol (Acetaminophen)",
				dosage: "500-1000mg every 4-6 hours",
				reason: "For fever reduction. Do not exceed 4000mg per day.",
			})
		}
		if (healthStatus.cough) {
			healthScore -= 20
			canDonate = false
			medicines.push({
				name: "Dextromethorphan (Cough Suppressant)",
				dosage: "15-30mg every 4-6 hours",
				reason: "For dry cough relief. Avoid if you have productive cough.",
			})
		}
		if (healthStatus.cold) {
			healthScore -= 15
			canDonate = false
			medicines.push({
				name: "Pseudoephedrine (Decongestant)",
				dosage: "60mg every 4-6 hours",
				reason: "For nasal congestion. May cause drowsiness.",
			})
		}
		if (healthStatus.fatigue) {
			healthScore -= 10
			medicines.push({
				name: "Rest and Hydration",
				dosage: "8-10 glasses of water daily, 7-9 hours sleep",
				reason: "Essential for recovery. Avoid strenuous activities.",
			})
		}
		if (healthStatus.headache) {
			healthScore -= 10
			medicines.push({
				name: "Ibuprofen or Paracetamol",
				dosage: "200-400mg Ibuprofen or 500-1000mg Paracetamol",
				reason: "For headache relief. Take with food if using Ibuprofen.",
			})
		}
		if (healthStatus.nausea) {
			healthScore -= 15
			medicines.push({
				name: "Dimenhydrinate or Ginger",
				dosage: "50-100mg Dimenhydrinate or 1-2g Ginger",
				reason: "For nausea relief. Ginger tea can also help.",
			})
		}

		// Check temperature
		const temp = parseFloat(healthStatus.temperature)
		if (temp && temp > 100.4) {
			healthScore -= 25
			canDonate = false
			recommendation = "Your temperature is elevated. Please wait until your fever subsides before considering donation."
		} else if (temp && temp < 97.0) {
			healthScore -= 10
			recommendation = "Your temperature is slightly low. Ensure you're well-hydrated and rested."
		}

		// Check medication
		if (healthStatus.lastMedication) {
			const medLower = healthStatus.lastMedication.toLowerCase()
			if (medLower.includes("antibiotic") || medLower.includes("antiviral")) {
				healthScore -= 20
				canDonate = false
				recommendation = "You're currently on medication. Please complete your course and wait 48 hours after the last dose before donating."
			}
		}

		// Final assessment
		if (healthScore < 60) {
			canDonate = false
			if (!recommendation) {
				recommendation = "Your health score indicates you may not be in optimal condition for donation. Please consult with a healthcare professional and wait until you're fully recovered."
			}
		} else if (healthScore >= 60 && healthScore < 80) {
			canDonate = false
			if (!recommendation) {
				recommendation = "You have mild symptoms. It's recommended to wait until you're feeling better before donating. Rest and follow the suggested treatments."
			}
		} else {
			if (!recommendation) {
				recommendation = "You appear to be in good health. However, if you have any concerns, please consult with a healthcare professional before donating."
			}
		}

		const assessment = {
			canDonate,
			healthScore: Math.max(0, Math.min(100, healthScore)),
			message: canDonate
				? "Based on your symptoms, you appear to be eligible for blood donation. However, always consult with medical professionals at the donation center."
				: "Based on your symptoms, it's recommended that you consult with a healthcare professional before donating blood.",
			recommendation,
			symptoms,
		}

		setHealthAssessment(assessment)
		setMedicineSuggestions(medicines)

		// Add to health history
		const historyEntry = {
			date: new Date().toISOString(),
			score: assessment.healthScore,
			symptoms: symptoms.length,
		}
		const updatedHistory = [...healthHistory, historyEntry].slice(-30) // Keep last 30 entries
		setHealthHistory(updatedHistory)

		// Save to localStorage
		if (typeof window !== "undefined") {
			localStorage.setItem("lifesaver:health_history", JSON.stringify(updatedHistory))
			localStorage.setItem("lifesaver:health_status", JSON.stringify(healthStatus))
		}
	}

	// Load health history from localStorage
	useEffect(() => {
		if (typeof window === "undefined") return
		const savedHistory = localStorage.getItem("lifesaver:health_history")
		const savedStatus = localStorage.getItem("lifesaver:health_status")
		if (savedHistory) {
			try {
				setHealthHistory(JSON.parse(savedHistory))
			} catch {
				// Ignore parse errors
			}
		}
		if (savedStatus) {
			try {
				const status = JSON.parse(savedStatus)
				setHealthStatus(status)
				if (status.hasSymptoms) {
					// Re-run assessment if symptoms were previously reported
					setTimeout(() => {
						// Trigger assessment after state is set
						const event = new Event("healthStatusLoaded")
						window.dispatchEvent(event)
					}, 100)
				}
			} catch {
				// Ignore parse errors
			}
		}
	}, [])

	return (
		<>
			<Head>
				<title>Blood Donation — LifeSaver Connect</title>
			</Head>
			<main className="min-h-screen bg-[#1A1A2E] text-white">
				{errorState?.type === "unauthorised" && (
					<div className="bg-rose-500/10 border border-rose-400 text-rose-100 text-sm px-4 py-3 text-center">
						<p className="font-semibold">Session expired</p>
						<p className="mt-1">
							Please sign in again to view your donor status.
							{" "}
							<Link href="/auth/login?module=donor" legacyBehavior>
								<a className="text-[#E91E63] underline font-semibold">Login</a>
							</Link>
						</p>
					</div>
				)}

				<header className="border-b border-[#F6D6E3]/30 bg-[#131326]/80 backdrop-blur">
					<div className="mx-auto flex flex-col gap-3 md:flex-row md:items-center md:justify-between max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
						<div>
							<h1 className="text-3xl md:text-4xl font-extrabold" style={{ fontFamily: "'Poppins', sans-serif" }}>
								Blood Donation
							</h1>
							<p className="mt-1 text-sm text-pink-100/80">
								Check eligibility, manage availability, and book a slot at a hospital or center.
							</p>
						</div>
						<div className="flex flex-wrap gap-2">
							<Link href="/needs/post" legacyBehavior>
								<a className="rounded-lg border border-[#F6D6E3] px-4 py-2 text-sm font-medium text-pink-100 hover:bg-white/5 transition">
									View Emergency Requests
								</a>
							</Link>
							<Link href="/donor/donate" legacyBehavior>
								<a className="rounded-lg bg-[#E91E63] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition">
									Find Hospital / Book Slot
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
							Loading your blood donation details…
						</div>
					) : (
						<>
							{errorState?.type === "profile-missing" && (
								<div className="rounded-2xl border border-[#4e7fff]/40 bg-[#102040] p-8 text-sm text-[#d7dcff]">
									<h2 className="text-xl font-semibold text-white">Complete your donor profile</h2>
									<p className="mt-2">
										We couldn’t find your donor details yet. Finish the quick registration so we can match you with patients who need your blood group.
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

							<div className="grid gap-6 md:grid-cols-3">
								<div className="rounded-2xl border border-[#F6D6E3] bg-[#131326] p-6 shadow-lg shadow-[#e91e6315]">
									<p className="text-sm text-pink-100/80">Next Eligible Donation</p>
									<h2 className="mt-3 text-2xl font-bold text-white">{nextEligibleDate}</h2>
									<p className="mt-2 text-sm text-pink-100/70">
										Whole blood donations typically require a 56-day interval. Check with your centre for personalised guidance.
									</p>
								</div>
								<div className="rounded-2xl border border-[#F6D6E3] bg-[#131326] p-6 shadow-lg shadow-[#e91e6315]">
									<p className="text-sm text-pink-100/80">Blood Donations Recorded</p>
									<h2 className="mt-3 text-2xl font-bold text-white">{totalBloodDonations}</h2>
									<p className="mt-2 text-sm text-pink-100/70">
										These numbers update after each verified donation from partner centres.
									</p>
								</div>
								<div className="rounded-2xl border border-[#F6D6E3] bg-[#131326] p-6 shadow-lg shadow-[#e91e6315]">
									<p className="text-sm text-pink-100/80">Platelet Donations Recorded</p>
									<h2 className="mt-3 text-2xl font-bold text-white">{totalPlateletDonations}</h2>
									<p className="mt-2 text-sm text-pink-100/70">
										Track apheresis donations separately. Hospitals confirm each platelet donation after review.
									</p>
								</div>
							</div>

							<div className="grid gap-6 md:grid-cols-3">
								<div className="rounded-2xl border border-[#F6D6E3] bg-[#131326] p-6 md:col-span-2">
									<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
										<div>
											<h2 className="text-lg font-semibold text-white">Donor Status</h2>
											<p className="text-sm text-pink-100/70">Keep this information updated so hospitals can reach you quickly.</p>
										</div>
										<Link href="/register/donor" legacyBehavior>
											<a className="inline-flex rounded-lg border border-[#E91E63] px-4 py-2 text-sm font-medium text-[#E91E63] hover:bg-[#E91E63]/10 transition">
												Edit Profile
											</a>
										</Link>
									</div>

									{loading ? (
										<div className="mt-6 rounded-xl border border-dashed border-[#F6D6E3]/40 bg-[#131326] p-6 text-sm text-pink-100/70">
											Loading your donor profile…
										</div>
									) : displayDonor ? (
										<>
											<div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
												<div className="rounded-xl border border-[#F6D6E3]/30 bg-[#1A1A2E] p-4">
													<p className="text-xs uppercase tracking-wide text-pink-100/60">Name</p>
													<p className="mt-2 text-base font-medium text-white">{donor.name || "Not provided"}</p>
												</div>
												<div className="rounded-xl border border-[#F6D6E3]/30 bg-[#1A1A2E] p-4">
													<p className="text-xs uppercase tracking-wide text-pink-100/60">Blood Group</p>
													<p className="mt-2 text-base font-medium text-white">{displayDonor?.blood_group || "Not provided"}</p>
												</div>
												<div className="rounded-xl border border-[#F6D6E3]/30 bg-[#1A1A2E] p-4">
													<p className="text-xs uppercase tracking-wide text-pink-100/60">City</p>
													<p className="mt-2 text-base font-medium text-white">{displayDonor?.city || "Not provided"}</p>
												</div>
												<div className="rounded-xl border border-[#F6D6E3]/30 bg-[#1A1A2E] p-4">
													<p className="text-xs uppercase tracking-wide text-pink-100/60">Postal Code</p>
													<p className="mt-2 text-base font-medium text-white">{displayDonor?.zip_code || "Not provided"}</p>
												</div>
												<div className="rounded-xl border border-[#F6D6E3]/30 bg-[#1A1A2E] p-4">
													<p className="text-xs uppercase tracking-wide text-pink-100/60">Contact Number</p>
													<p className="mt-2 text-base font-medium text-white">{displayDonor?.phone || "Not provided"}</p>
												</div>
												<div className="rounded-xl border border-[#F6D6E3]/30 bg-[#1A1A2E] p-4">
													<p className="text-xs uppercase tracking-wide text-pink-100/60">Email</p>
													<p className="mt-2 text-base font-medium text-white">{displayDonor?.email || "Not provided"}</p>
												</div>
												<div className="rounded-xl border border-[#F6D6E3]/30 bg-[#1A1A2E] p-4">
													<p className="text-xs uppercase tracking-wide text-pink-100/60">Platelet Donor</p>
													<p className="mt-2 text-base font-medium text-white">
														{displayDonor && "is_platelet_donor" in displayDonor ? (displayDonor.is_platelet_donor ? "Yes" : "No") : "Not provided"}
													</p>
												</div>
												<div className="rounded-xl border border-[#F6D6E3]/30 bg-[#1A1A2E] p-4">
													<p className="text-xs uppercase tracking-wide text-pink-100/60">Last Donation</p>
													<p className="mt-2 text-base font-medium text-white">{lastDonationDisplay}</p>
												</div>
											</div>

											{/* Blood Compatibility Section - Always show if blood group exists */}
											{compatibilityInfo && displayDonor?.blood_group && (
												<div className="mt-6 rounded-xl border border-[#F6D6E3]/30 bg-[#1A1A2E] p-6">
													<div className="flex items-center gap-2 mb-4">
														<svg className="w-5 h-5 text-[#E91E63]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
														</svg>
														<h3 className="text-base font-semibold text-white">Blood Compatibility</h3>
													</div>
													{compatibilityInfo.is_universal ? (
														<div className="rounded-lg border border-green-500/40 bg-green-500/10 p-4">
															<div className="flex items-center gap-2 mb-2">
																<svg className="w-5 h-5 text-green-300" fill="currentColor" viewBox="0 0 20 20">
																	<path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
																</svg>
																<p className="text-base font-semibold text-green-300">Universal Donor</p>
															</div>
															<p className="text-sm text-green-200/80">
																Your blood group <span className="font-bold text-white">{displayDonor?.blood_group}</span> can donate to all blood types! You are a universal donor and can help save lives across all blood groups.
															</p>
															<div className="mt-3 flex flex-wrap gap-2">
																{["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"].map((bg) => (
																	<span key={bg} className="rounded-md bg-green-500/20 border border-green-500/40 px-3 py-1 text-sm font-medium text-green-300">
																		{bg}
																	</span>
																))}
															</div>
														</div>
													) : (
														<>
															<p className="text-sm text-pink-100/80 mb-3">
																As a <span className="font-semibold text-white">{displayDonor?.blood_group}</span> donor, you can donate to the following blood groups:
															</p>
															<div className="flex flex-wrap gap-2">
																{compatibilityInfo.can_donate_to.map((bg) => (
																	<span key={bg} className="rounded-md bg-[#E91E63]/20 border border-[#E91E63]/40 px-3 py-1.5 text-sm font-medium text-[#E91E63]">
																		{bg}
																	</span>
																))}
															</div>
															<p className="mt-3 text-xs text-pink-100/60">
																Your blood can help save lives for patients with these blood types. Always consult with medical professionals before donating.
															</p>
														</>
													)}
												</div>
											)}

											{/* Availability Section */}
											<div className="mt-6 rounded-xl border border-[#F6D6E3]/30 bg-[#1A1A2E] p-4">
												<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
													<div>
														<p className="text-xs uppercase tracking-wide text-pink-100/60">Availability</p>
														<p className="mt-1 text-base font-semibold text-white">{availabilityLabel}</p>
														<p className="mt-1 text-sm text-pink-100/70">{availabilitySubtext}</p>
													</div>
													<div className="flex flex-col items-start gap-3 sm:items-end">
														<div className="flex gap-2">
															<button
																type="button"
																onClick={() => setShowAvailabilityForm(!showAvailabilityForm)}
																className="inline-flex items-center gap-2 rounded-lg border border-[#F6D6E3] px-4 py-2 text-sm font-medium text-pink-100 transition hover:bg-white/5"
															>
																<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																	<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
																</svg>
																Set Schedule
															</button>
															<button
																type="button"
																onClick={handleAvailabilityToggle}
																disabled={availabilitySaving}
																className="inline-flex items-center gap-2 rounded-lg border border-[#E91E63] px-4 py-2 text-sm font-medium text-[#E91E63] transition hover:bg-[#E91E63]/10 disabled:cursor-not-allowed disabled:opacity-60"
															>
																{availabilitySaving && (
																	<span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
																)}
																{displayDonor?.is_available ? "Set as Unavailable" : "Set as Available"}
															</button>
														</div>
														{availabilityError && <p className="max-w-xs text-sm text-rose-300">{availabilityError}</p>}
													</div>
												</div>

												{/* Availability Schedule Form */}
												{showAvailabilityForm && (
													<div className="mt-4 rounded-lg border border-[#F6D6E3]/20 bg-[#131326] p-4 space-y-4">
														<h4 className="text-sm font-semibold text-white">Set Your Availability Schedule</h4>
														<div className="grid gap-4 md:grid-cols-2">
															<div>
																<label className="block text-xs font-medium text-pink-100/80 mb-1">Start Date</label>
																<input
																	type="date"
																	value={availabilitySchedule.startDate}
																	onChange={(e) => setAvailabilitySchedule({ ...availabilitySchedule, startDate: e.target.value })}
																	className="w-full rounded-lg border border-[#F6D6E3]/30 bg-[#1A1A2E] px-3 py-2 text-sm text-white outline-none focus:border-[#E91E63]"
																/>
															</div>
															<div>
																<label className="block text-xs font-medium text-pink-100/80 mb-1">End Date</label>
																<input
																	type="date"
																	value={availabilitySchedule.endDate}
																	onChange={(e) => setAvailabilitySchedule({ ...availabilitySchedule, endDate: e.target.value })}
																	className="w-full rounded-lg border border-[#F6D6E3]/30 bg-[#1A1A2E] px-3 py-2 text-sm text-white outline-none focus:border-[#E91E63]"
																/>
															</div>
															<div>
																<label className="block text-xs font-medium text-pink-100/80 mb-1">Start Time</label>
																<input
																	type="time"
																	value={availabilitySchedule.startTime}
																	onChange={(e) => setAvailabilitySchedule({ ...availabilitySchedule, startTime: e.target.value })}
																	className="w-full rounded-lg border border-[#F6D6E3]/30 bg-[#1A1A2E] px-3 py-2 text-sm text-white outline-none focus:border-[#E91E63]"
																/>
															</div>
															<div>
																<label className="block text-xs font-medium text-pink-100/80 mb-1">End Time</label>
																<input
																	type="time"
																	value={availabilitySchedule.endTime}
																	onChange={(e) => setAvailabilitySchedule({ ...availabilitySchedule, endTime: e.target.value })}
																	className="w-full rounded-lg border border-[#F6D6E3]/30 bg-[#1A1A2E] px-3 py-2 text-sm text-white outline-none focus:border-[#E91E63]"
																/>
															</div>
														</div>
														<div>
															<label className="block text-xs font-medium text-pink-100/80 mb-2">Available Days</label>
															<div className="flex flex-wrap gap-2">
																{["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => (
																	<button
																		key={day}
																		type="button"
																		onClick={() => {
																			const days = availabilitySchedule.daysOfWeek
																			if (days.includes(day)) {
																				setAvailabilitySchedule({ ...availabilitySchedule, daysOfWeek: days.filter(d => d !== day) })
																			} else {
																				setAvailabilitySchedule({ ...availabilitySchedule, daysOfWeek: [...days, day] })
																			}
																		}}
																		className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${availabilitySchedule.daysOfWeek.includes(day)
																			? "bg-[#E91E63] text-white"
																			: "bg-[#1A1A2E] border border-[#F6D6E3]/30 text-pink-100/70 hover:border-[#E91E63]"
																			}`}
																	>
																		{day.slice(0, 3)}
																	</button>
																))}
															</div>
														</div>
														<div>
															<label className="block text-xs font-medium text-pink-100/80 mb-1">Notes</label>
															<textarea
																value={availabilitySchedule.notes}
																onChange={(e) => setAvailabilitySchedule({ ...availabilitySchedule, notes: e.target.value })}
																rows={2}
																className="w-full rounded-lg border border-[#F6D6E3]/30 bg-[#1A1A2E] px-3 py-2 text-sm text-white outline-none focus:border-[#E91E63]"
																placeholder="Any additional notes about your availability..."
															/>
														</div>
														<div className="flex gap-2">
															<button
																type="button"
																onClick={() => {
																	// Save schedule (can be stored in localStorage or sent to API)
																	if (typeof window !== "undefined") {
																		localStorage.setItem("lifesaver:availability_schedule", JSON.stringify(availabilitySchedule))
																	}
																	setShowAvailabilityForm(false)
																	alert("Availability schedule saved!")
																}}
																className="rounded-lg bg-[#E91E63] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition"
															>
																Save Schedule
															</button>
															<button
																type="button"
																onClick={() => setShowAvailabilityForm(false)}
																className="rounded-lg border border-[#F6D6E3] px-4 py-2 text-sm font-medium text-pink-100 hover:bg-white/5 transition"
															>
																Cancel
															</button>
														</div>
													</div>
												)}
											</div>

											{/* Health Status Section */}
											<div className="mt-6 rounded-xl border border-[#F6D6E3]/30 bg-[#1A1A2E] p-6">
												<div className="flex items-center justify-between mb-4">
													<div>
														<h3 className="text-base font-semibold text-white flex items-center gap-2">
															<svg className="w-5 h-5 text-[#E91E63]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
															</svg>
															Health Status
														</h3>
														<p className="text-xs text-pink-100/60 mt-1">Update your health status to determine donation eligibility</p>
													</div>
													<button
														type="button"
														onClick={() => setShowHealthForm(!showHealthForm)}
														className="rounded-lg border border-[#E91E63] px-4 py-2 text-sm font-medium text-[#E91E63] hover:bg-[#E91E63]/10 transition"
													>
														{showHealthForm ? "Cancel" : "Update Health"}
													</button>
												</div>

												{/* Health Status Form */}
												{showHealthForm && (
													<div className="mt-4 rounded-lg border border-[#F6D6E3]/20 bg-[#131326] p-4 space-y-4">
														<div>
															<label className="flex items-center gap-2 text-sm font-medium text-white mb-3">
																<input
																	type="checkbox"
																	checked={healthStatus.hasSymptoms}
																	onChange={(e) => {
																		setHealthStatus({ ...healthStatus, hasSymptoms: e.target.checked })
																		if (!e.target.checked) {
																			// Reset symptoms if unchecked
																			setHealthStatus({
																				...healthStatus,
																				hasSymptoms: false,
																				cough: false,
																				fever: false,
																				cold: false,
																				fatigue: false,
																				headache: false,
																				nausea: false,
																				otherSymptoms: "",
																			})
																			setHealthAssessment(null)
																			setMedicineSuggestions([])
																		}
																	}}
																	className="w-4 h-4 rounded border-[#F6D6E3] text-[#E91E63] focus:ring-[#E91E63]"
																/>
																Do you have any symptoms? (Cough, Fever, Cold, etc.)
															</label>
														</div>

														{healthStatus.hasSymptoms && (
															<>
																<div>
																	<p className="text-xs font-medium text-pink-100/80 mb-2">Select your symptoms:</p>
																	<div className="grid gap-2 sm:grid-cols-2">
																		{[
																			{ key: "cough", label: "Cough" },
																			{ key: "fever", label: "Fever" },
																			{ key: "cold", label: "Cold" },
																			{ key: "fatigue", label: "Fatigue" },
																			{ key: "headache", label: "Headache" },
																			{ key: "nausea", label: "Nausea" },
																		].map((symptom) => (
																			<label key={symptom.key} className="flex items-center gap-2 text-sm text-pink-100/80">
																				<input
																					type="checkbox"
																					checked={healthStatus[symptom.key]}
																					onChange={(e) => setHealthStatus({ ...healthStatus, [symptom.key]: e.target.checked })}
																					className="w-4 h-4 rounded border-[#F6D6E3] text-[#E91E63] focus:ring-[#E91E63]"
																				/>
																				{symptom.label}
																			</label>
																		))}
																	</div>
																</div>
																<div>
																	<label className="block text-xs font-medium text-pink-100/80 mb-1">Other Symptoms</label>
																	<input
																		type="text"
																		value={healthStatus.otherSymptoms}
																		onChange={(e) => setHealthStatus({ ...healthStatus, otherSymptoms: e.target.value })}
																		className="w-full rounded-lg border border-[#F6D6E3]/30 bg-[#1A1A2E] px-3 py-2 text-sm text-white outline-none focus:border-[#E91E63]"
																		placeholder="Describe other symptoms..."
																	/>
																</div>
																<div>
																	<label className="block text-xs font-medium text-pink-100/80 mb-1">Body Temperature (°F)</label>
																	<input
																		type="number"
																		value={healthStatus.temperature}
																		onChange={(e) => setHealthStatus({ ...healthStatus, temperature: e.target.value })}
																		className="w-full rounded-lg border border-[#F6D6E3]/30 bg-[#1A1A2E] px-3 py-2 text-sm text-white outline-none focus:border-[#E91E63]"
																		placeholder="98.6"
																	/>
																</div>
																<div>
																	<label className="block text-xs font-medium text-pink-100/80 mb-1">Last Medication Taken</label>
																	<input
																		type="text"
																		value={healthStatus.lastMedication}
																		onChange={(e) => setHealthStatus({ ...healthStatus, lastMedication: e.target.value })}
																		className="w-full rounded-lg border border-[#F6D6E3]/30 bg-[#1A1A2E] px-3 py-2 text-sm text-white outline-none focus:border-[#E91E63]"
																		placeholder="e.g., Paracetamol, Antibiotics..."
																	/>
																</div>
																<div>
																	<label className="block text-xs font-medium text-pink-100/80 mb-1">Additional Health Notes</label>
																	<textarea
																		value={healthStatus.healthNotes}
																		onChange={(e) => setHealthStatus({ ...healthStatus, healthNotes: e.target.value })}
																		rows={3}
																		className="w-full rounded-lg border border-[#F6D6E3]/30 bg-[#1A1A2E] px-3 py-2 text-sm text-white outline-none focus:border-[#E91E63]"
																		placeholder="Any additional health information..."
																	/>
																</div>
																<button
																	type="button"
																	onClick={handleHealthAssessment}
																	className="w-full rounded-lg bg-[#E91E63] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition"
																>
																	Assess Health & Get Recommendations
																</button>
															</>
														)}

														{!healthStatus.hasSymptoms && (
															<div className="rounded-lg border border-green-500/40 bg-green-500/10 p-4">
																<div className="flex items-center gap-2 mb-2">
																	<svg className="w-5 h-5 text-green-300" fill="currentColor" viewBox="0 0 20 20">
																		<path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
																	</svg>
																	<p className="text-sm font-semibold text-green-300">No Symptoms Reported</p>
																</div>
																<p className="text-xs text-green-200/80">You appear to be in good health. You may be eligible to donate blood.</p>
															</div>
														)}
													</div>
												)}

												{/* Health Assessment Results */}
												{healthAssessment && (
													<div className={`mt-4 rounded-lg border p-4 ${healthAssessment.canDonate
														? "border-green-500/40 bg-green-500/10"
														: "border-yellow-500/40 bg-yellow-500/10"
														}`}>
														<div className="flex items-center gap-2 mb-3">
															<svg className={`w-5 h-5 ${healthAssessment.canDonate ? "text-green-300" : "text-yellow-300"}`} fill="currentColor" viewBox="0 0 20 20">
																<path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
															</svg>
															<h4 className={`text-sm font-semibold ${healthAssessment.canDonate ? "text-green-300" : "text-yellow-300"}`}>
																{healthAssessment.canDonate ? "Eligible to Donate" : "Consultation Recommended"}
															</h4>
														</div>
														<p className={`text-xs mb-3 ${healthAssessment.canDonate ? "text-green-200/80" : "text-yellow-200/80"}`}>
															{healthAssessment.message}
														</p>
														<div className="mb-3">
															<p className="text-xs font-medium text-pink-100/80 mb-2">Health Score: {healthAssessment.healthScore}/100</p>
															<div className="w-full bg-[#1A1A2E] rounded-full h-2">
																<div
																	className={`h-2 rounded-full transition-all ${healthAssessment.healthScore >= 80 ? "bg-green-500" :
																		healthAssessment.healthScore >= 60 ? "bg-yellow-500" : "bg-red-500"
																		}`}
																	style={{ width: `${healthAssessment.healthScore}%` }}
																/>
															</div>
														</div>
														{!healthAssessment.canDonate && (
															<div className="mt-3 p-3 rounded-lg bg-[#1A1A2E] border border-yellow-500/20">
																<p className="text-xs font-medium text-yellow-300 mb-2">Recommendation:</p>
																<p className="text-xs text-yellow-200/80">{healthAssessment.recommendation}</p>
															</div>
														)}
													</div>
												)}

												{/* Medicine Suggestions */}
												{medicineSuggestions.length > 0 && (
													<div className="mt-4 rounded-lg border border-blue-500/40 bg-blue-500/10 p-4">
														<div className="flex items-center gap-2 mb-3">
															<svg className="w-5 h-5 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
															</svg>
															<h4 className="text-sm font-semibold text-blue-300">AI-Generated Medicine Suggestions</h4>
														</div>
														<div className="space-y-2">
															{medicineSuggestions.map((medicine, index) => (
																<div key={index} className="flex items-start gap-2 p-2 rounded bg-[#1A1A2E] border border-blue-500/20">
																	<svg className="w-4 h-4 text-blue-300 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
																		<path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
																	</svg>
																	<div className="flex-1">
																		<p className="text-xs font-medium text-blue-300">{medicine.name}</p>
																		<p className="text-xs text-blue-200/70 mt-0.5">{medicine.dosage}</p>
																		<p className="text-xs text-blue-200/60 mt-1">{medicine.reason}</p>
																	</div>
																</div>
															))}
														</div>
														<p className="text-xs text-blue-200/60 mt-3 italic">
															⚠️ These are AI-generated suggestions. Please consult with a healthcare professional before taking any medication.
														</p>
													</div>
												)}

												{/* Health Chart */}
												{healthHistory.length > 0 && (
													<div className="mt-4 rounded-lg border border-[#F6D6E3]/20 bg-[#131326] p-4">
														<h4 className="text-sm font-semibold text-white mb-3">Health Condition Chart</h4>
														<div className="h-32 flex items-end gap-2">
															{healthHistory.slice(-7).map((entry, index) => (
																<div key={index} className="flex-1 flex flex-col items-center">
																	<div className="w-full flex flex-col items-center justify-end h-24">
																		<div
																			className={`w-full rounded-t transition-all ${entry.score >= 80 ? "bg-green-500" :
																				entry.score >= 60 ? "bg-yellow-500" : "bg-red-500"
																				}`}
																			style={{ height: `${entry.score}%` }}
																		/>
																	</div>
																	<p className="text-xs text-pink-100/60 mt-2">{new Date(entry.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
																	<p className="text-xs font-medium text-white mt-1">{entry.score}</p>
																</div>
															))}
														</div>
														<div className="mt-4 flex items-center justify-center gap-4 text-xs">
															<div className="flex items-center gap-1.5">
																<div className="w-3 h-3 rounded bg-green-500" />
																<span className="text-pink-100/70">Good (80-100)</span>
															</div>
															<div className="flex items-center gap-1.5">
																<div className="w-3 h-3 rounded bg-yellow-500" />
																<span className="text-pink-100/70">Fair (60-79)</span>
															</div>
															<div className="flex items-center gap-1.5">
																<div className="w-3 h-3 rounded bg-red-500" />
																<span className="text-pink-100/70">Poor (0-59)</span>
															</div>
														</div>
													</div>
												)}
											</div>
										</>
									) : errorState?.type === "profile-missing" ? (
										<div className="mt-6 rounded-xl border border-dashed border-[#F6D6E3]/40 bg-[#1A1A2E] p-8 text-center">
											<svg className="w-16 h-16 text-pink-100/40 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
											</svg>
											<p className="text-base font-medium text-pink-100/80 mb-2">Complete Your Donor Profile</p>
											<p className="text-sm text-pink-100/70 mb-4">
												Register your donor profile to view and manage your status details, blood compatibility, and donation history.
											</p>
											<Link href="/register/donor" legacyBehavior>
												<a className="inline-flex rounded-lg bg-[#E91E63] px-6 py-2 text-sm font-semibold text-white hover:opacity-90 transition">
													Register as Donor
												</a>
											</Link>
										</div>
									) : (
										<div className="mt-6 rounded-xl border border-dashed border-[#F6D6E3]/40 bg-[#1A1A2E] p-8 text-center text-sm text-pink-100/70">
											Unable to load your profile. Please refresh or sign in again.
										</div>
									)}
								</div>

								<div className="rounded-2xl border border-[#F6D6E3] bg-[#131326] p-6">
									<div className="flex items-center justify-between">
										<h2 className="text-lg font-semibold text-white">Upcoming Events</h2>
										<Link href="/donor/events" legacyBehavior>
											<a className="text-sm text-[#E91E63] hover:underline transition">See all</a>
										</Link>
									</div>
									{upcomingEvents && upcomingEvents.length > 0 ? (
										<ul className="mt-4 space-y-3">
											{upcomingEvents.slice(0, 3).map((event) => (
												<Link key={event.id} href={`/donor/events/${event.id}`} legacyBehavior>
													<a className="block rounded-xl border border-[#F6D6E3]/40 bg-[#1A1A2E] p-4 hover:border-[#E91E63]/60 hover:bg-[#1A1A2E]/80 transition-all cursor-pointer group">
														<div className="flex items-start justify-between">
															<div className="flex-1">
																<div className="flex items-center gap-2 mb-1">
																	<svg className="w-4 h-4 text-[#E91E63]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
																	</svg>
																	<p className="text-sm text-pink-100/80 font-medium">{event.date}</p>
																</div>
																<p className="mt-1 text-base font-medium text-white group-hover:text-[#E91E63] transition-colors">{event.title}</p>
																<div className="flex items-center gap-1.5 mt-1">
																	<svg className="w-3.5 h-3.5 text-pink-100/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
																		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
																	</svg>
																	<p className="text-sm text-pink-100/70">{event.location}</p>
																</div>
															</div>
															<svg className="w-5 h-5 text-pink-100/40 group-hover:text-[#E91E63] transition-colors flex-shrink-0 ml-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
															</svg>
														</div>
													</a>
												</Link>
											))}
										</ul>
									) : (
										<div className="mt-4 rounded-xl border border-dashed border-[#F6D6E3]/40 bg-[#1A1A2E] p-6 text-center">
											<svg className="w-12 h-12 text-pink-100/40 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
											</svg>
											<p className="text-sm text-pink-100/70 mb-2">No upcoming events yet.</p>
											<p className="text-xs text-pink-100/60">Stay tuned for community blood drives and hospital-specific requests.</p>
										</div>
									)}
								</div>
							</div>

							<div className="grid gap-6 md:grid-cols-2">
								<div className="rounded-2xl border border-[#F6D6E3] bg-[#131326] p-6">
									<div className="flex items-center justify-between">
										<h2 className="text-lg font-semibold text-white">My Donation Requests</h2>
										<Link href="/donor/donate" legacyBehavior>
											<a className="text-sm text-[#E91E63]">New Request</a>
										</Link>
									</div>
									{donationRequests.length > 0 ? (
										<ul className="mt-4 space-y-3">
											{donationRequests.map((request) => {
												const hospital = request.hospital || {}
												const statusColors = {
													PENDING: "bg-yellow-500/10 text-yellow-300 border-yellow-500/40",
													ACCEPTED: "bg-green-500/10 text-green-300 border-green-500/40",
													REJECTED: "bg-red-500/10 text-red-300 border-red-500/40",
													COMPLETED: "bg-blue-500/10 text-blue-300 border-blue-500/40",
													CANCELLED: "bg-gray-500/10 text-gray-300 border-gray-500/40",
												}
												const statusLabels = {
													PENDING: "Pending",
													ACCEPTED: "Accepted",
													REJECTED: "Rejected",
													COMPLETED: "Completed",
													CANCELLED: "Cancelled",
												}
												return (
													<li key={request.id} className="rounded-xl border border-[#F6D6E3]/40 bg-[#1A1A2E] p-4">
														<div className="flex items-center justify-between">
															<div className="flex-1">
																<p className="font-medium text-white">{hospital.name || "Hospital"}</p>
																<p className="mt-1 text-xs text-pink-100/70">
																	{hospital.city || ""} {hospital.phone ? `• ${hospital.phone}` : ""}
																</p>
															</div>
															<span className={`rounded border px-2 py-1 text-xs font-semibold ${statusColors[request.status] || statusColors.PENDING}`}>
																{statusLabels[request.status] || "Pending"}
															</span>
														</div>
														{request.created_at && (
															<p className="mt-2 text-xs text-pink-100/60">
																Requested: {new Date(request.created_at).toLocaleDateString()}
															</p>
														)}
														{request.status === "ACCEPTED" && (
															<p className="mt-2 text-sm text-green-300">
																✓ Your request has been accepted! The hospital will contact you soon.
															</p>
														)}
														{request.status === "REJECTED" && (
															<p className="mt-2 text-sm text-red-300">
																✗ Your request was not accepted at this time.
															</p>
														)}
													</li>
												)
											})}
										</ul>
									) : (
										<div className="mt-4 rounded-xl border border-dashed border-[#F6D6E3]/40 bg-[#1A1A2E] p-6 text-sm text-pink-100/70">
											No donation requests yet.{" "}
											<Link href="/donor/donate" legacyBehavior>
												<a className="text-[#E91E63] underline">Request to donate at a center</a>
											</Link>
										</div>
									)}
								</div>

								<div className="rounded-2xl border border-[#F6D6E3] bg-[#131326] p-6">
									<div className="flex items-center justify-between">
										<h2 className="text-lg font-semibold text-white">Critical Matches Near You</h2>
										<Link href="/needs" legacyBehavior>
											<a className="text-sm text-[#E91E63]">View All</a>
										</Link>
									</div>
									{recommendedNeeds.length ? (
										<ul className="mt-4 space-y-3">
											{recommendedNeeds.map((need) => {
												const isUrgent = need.status === "URGENT"
												const neededByDate = need.needed_by ? new Date(need.needed_by) : null
												const daysUntilNeeded = neededByDate ? Math.ceil((neededByDate - new Date()) / (1000 * 60 * 60 * 24)) : null

												return (
													<li key={need.id} className="rounded-xl border border-[#F6D6E3]/40 bg-[#1A1A2E] p-4 hover:border-[#E91E63]/60 transition">
														<div className="flex items-start justify-between gap-3">
															<div className="flex-1">
																<div className="flex items-center gap-2 mb-2">
																	<span className="font-medium text-white">{need.title || need.need_type || "Blood Need"}</span>
																	<span className={`rounded px-2 py-1 text-xs font-semibold ${isUrgent ? "bg-red-500/20 text-red-300" : "bg-yellow-500/20 text-yellow-300"
																		}`}>
																		{need.status || "NORMAL"}
																	</span>
																	<span className="rounded bg-[#E91E63]/10 px-2 py-1 text-xs text-[#E91E63]">
																		{need.required_blood_group || "Any"}
																	</span>
																</div>
																{need.patient_name && (
																	<p className="text-sm text-pink-100/80 mb-1">
																		Patient: <span className="font-medium text-white">{need.patient_name}</span>
																	</p>
																)}
																{need.patient_details && (
																	<p className="mt-1 text-sm text-pink-100/70 line-clamp-2">{need.patient_details}</p>
																)}
																{need.hospital && (
																	<p className="mt-2 text-sm text-pink-100/70">
																		Hospital: <span className="font-medium text-white">{need.hospital.name}</span>
																		{need.hospital.city && ` • ${need.hospital.city}`}
																	</p>
																)}
																{need.quantity_needed && (
																	<p className="mt-1 text-sm text-pink-100/70">
																		Quantity Needed: <span className="font-medium text-white">{need.quantity_needed} units</span>
																	</p>
																)}
																{neededByDate && (
																	<p className={`mt-1 text-sm font-medium ${daysUntilNeeded !== null && daysUntilNeeded <= 1 ? "text-red-300" :
																		daysUntilNeeded !== null && daysUntilNeeded <= 3 ? "text-yellow-300" : "text-pink-100/70"
																		}`}>
																		Needed by: {neededByDate.toLocaleDateString()} {neededByDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
																		{daysUntilNeeded !== null && daysUntilNeeded >= 0 && (
																			<span className="ml-2">
																				({daysUntilNeeded === 0 ? "Today" : daysUntilNeeded === 1 ? "Tomorrow" : `${daysUntilNeeded} days`})
																			</span>
																		)}
																	</p>
																)}
																{need.poster_image && (
																	<div className="mt-3">
																		<img
																			src={need.poster_image}
																			alt="Patient poster"
																			className="max-w-xs rounded-lg border border-[#F6D6E3]/20"
																			onError={(e) => { e.target.style.display = 'none' }}
																		/>
																	</div>
																)}
															</div>
														</div>
													</li>
												)
											})}
										</ul>
									) : (
										<div className="mt-4 rounded-xl border border-dashed border-[#F6D6E3]/40 bg-[#1A1A2E] p-6 text-sm text-pink-100/70">
											No matched requests at the moment. We will notify you when a compatible patient is added.
										</div>
									)}
								</div>

								<div className="rounded-2xl border border-[#F6D6E3] bg-[#131326] p-6">
									<div className="flex items-center justify-between">
										<h2 className="text-lg font-semibold text-white">Donation History</h2>
										<Link href="#" legacyBehavior>
											<a className="text-sm text-[#E91E63]">Export</a>
										</Link>
									</div>
									{DONATION_HISTORY_PLACEHOLDER.length ? (
										<ul className="mt-4 space-y-3">
											{DONATION_HISTORY_PLACEHOLDER.map((entry) => (
												<li key={entry.id} className="rounded-xl border border-[#F6D6E3]/40 bg-[#1A1A2E] p-4">
													<div className="flex items-center justify-between text-sm text-pink-100/80">
														<span>{entry.date}</span>
														<span>{entry.type}</span>
													</div>
													<p className="mt-1 text-sm text-pink-100/70">Recipient: {entry.recipient}</p>
												</li>
											))}
										</ul>
									) : (
										<div className="mt-4 rounded-xl border border-dashed border-[#F6D6E3]/40 bg-[#1A1A2E] p-6 text-sm text-pink-100/70">
											You have not recorded any donations yet. Confirmed donations will appear here once verified.
										</div>
									)}
								</div>
							</div>

							<div className="rounded-2xl border border-[#F6D6E3] bg-[#131326] p-6">
								<h2 className="text-lg font-semibold text-white">Blood Compatibility Guide</h2>
								<p className="mt-3 text-sm text-pink-100/80">
									Donations must match medically verified compatibility rules. Always follow the guidance of medical professionals before donating.
								</p>
								<div className="mt-4 grid gap-4 md:grid-cols-2">
									<div className="rounded-xl border border-[#F6D6E3]/40 bg-[#1A1A2E] p-4 text-sm text-pink-100/80">
										<h3 className="text-base font-medium text-white">Whole Blood</h3>
										<ul className="mt-2 space-y-1">
											<li>O- donors can give to anyone (universal donor).</li>
											<li>O+ donors can donate to all positive blood types.</li>
											<li>A and B donors must match their letter; AB receives from everyone.</li>
										</ul>
									</div>
									<div className="rounded-xl border border-[#F6D6E3]/40 bg-[#1A1A2E] p-4 text-sm text-pink-100/80">
										<h3 className="text-base font-medium text-white">Platelets & Plasma</h3>
										<ul className="mt-2 space-y-1">
											<li>AB donors are universal plasma donors.</li>
											<li>Platelet compatibility is broader but still requires clinical approval.</li>
											<li>Hospitals confirm every match prior to transfusion.</li>
										</ul>
									</div>
								</div>
							</div>

							<div className="rounded-2xl border border-[#F6D6E3] bg-[#131326] p-6">
								<h2 className="text-lg font-semibold text-white">Helpful Resources</h2>
								<div className="mt-4 grid gap-4 md:grid-cols-2">
									<div className="rounded-xl border border-[#F6D6E3]/40 bg-[#1A1A2E] p-4">
										<h3 className="text-base font-medium text-white">Donation Health Report</h3>
										<p className="mt-2 text-sm text-pink-100/80">
											Download your health assessment report to show at the donation center.
										</p>
										<button
											onClick={async () => {
												if (!healthAssessment) {
													alert("Please complete the health assessment first.");
													return;
												}
												try {
													const { jsPDF } = await import("jspdf");
													const doc = new jsPDF({
														orientation: "portrait",
														unit: "mm",
														format: "a4"
													});

													const pageWidth = doc.internal.pageSize.getWidth();
													const pageHeight = doc.internal.pageSize.getHeight();
													const margin = 20;

													// --- Background & Border ---
													doc.setFillColor(255, 255, 255);
													doc.rect(0, 0, pageWidth, pageHeight, "F");

													doc.setDrawColor(26, 26, 46);
													doc.setLineWidth(1);
													doc.rect(margin, margin, pageWidth - (margin * 2), pageHeight - (margin * 2), "S");

													// --- Header Section ---
													doc.setFillColor(26, 26, 46); // Dark Blue Header
													doc.rect(margin, margin, pageWidth - (margin * 2), 35, "F");

													doc.setFontSize(24);
													doc.setTextColor(233, 30, 99); // Pink Brand Color
													doc.setFont("helvetica", "bold");
													doc.text("LifeSaver Connect", margin + 10, margin + 18);

													doc.setFontSize(10);
													doc.setTextColor(255, 255, 255);
													doc.setFont("helvetica", "normal");
													doc.text("Official Donor Health Assessment", margin + 10, margin + 26);

													doc.setFontSize(12);
													doc.text("CONFIDENTIAL", pageWidth - margin - 10, margin + 18, { align: "right" });
													doc.text(`Report ID: #${Math.floor(Math.random() * 100000)}`, pageWidth - margin - 10, margin + 26, { align: "right" });

													// --- Donor Details Table ---
													const startY = margin + 50;
													doc.setTextColor(26, 26, 46);
													doc.setFontSize(14);
													doc.setFont("helvetica", "bold");
													doc.text("Donor Profile Information", margin + 5, startY);

													doc.setDrawColor(200, 200, 200);
													doc.setLineWidth(0.5);
													doc.line(margin + 5, startY + 3, pageWidth - margin - 5, startY + 3);

													doc.setFontSize(11);
													doc.setFont("helvetica", "normal");
													doc.setTextColor(60, 60, 60);

													const details = [
														{ label: "Full Name", value: donor?.name || "Not Provided" },
														{ label: "Blood Group", value: displayDonor?.blood_group || "N/A" },
														{ label: "Contact", value: displayDonor?.phone || "Not Provided" },
														{ label: "Email", value: displayDonor?.email || "Not Provided" },
														{ label: "Assessment Date", value: new Date().toLocaleString() }
													];

													let currentY = startY + 15;
													details.forEach(item => {
														doc.setFont("helvetica", "bold");
														doc.text(`${item.label}:`, margin + 10, currentY);
														doc.setFont("helvetica", "normal");
														doc.text(item.value, margin + 60, currentY);
														currentY += 8;
													});

													// --- Health Score Section ---
													const scoreY = currentY + 10;
													doc.setFillColor(245, 245, 250);
													doc.setDrawColor(230, 230, 230);
													doc.roundedRect(margin + 5, scoreY, pageWidth - (margin * 2) - 10, 35, 3, 3, "FD");

													doc.setFontSize(14);
													doc.setTextColor(26, 26, 46);
													doc.setFont("helvetica", "bold");
													doc.text("Health Score", margin + 15, scoreY + 12);

													// Color coded score
													const scoreColor = healthAssessment.healthScore >= 80 ? [76, 175, 80] : healthAssessment.healthScore >= 60 ? [255, 193, 7] : [244, 67, 54];
													doc.setTextColor(...scoreColor);
													doc.setFontSize(28);
													doc.text(`${healthAssessment.healthScore}/100`, margin + 15, scoreY + 26);

													// Status Badge
													const statusText = healthAssessment.canDonate ? "ELIGIBLE TO DONATE" : "NOT RECOMMENDED";
													doc.setFillColor(...scoreColor);
													doc.roundedRect(pageWidth - margin - 70, scoreY + 10, 55, 15, 2, 2, "F");
													doc.setTextColor(255, 255, 255);
													doc.setFontSize(10);
													doc.setFont("helvetica", "bold");
													doc.text(statusText, pageWidth - margin - 42.5, scoreY + 21, { align: "center" });

													// --- Recommendations ---
													const recY = scoreY + 45;
													doc.setTextColor(26, 26, 46);
													doc.setFontSize(14);
													doc.setFont("helvetica", "bold");
													doc.text("Medical Assessment & Recommendations", margin + 5, recY);
													doc.setDrawColor(200, 200, 200);
													doc.line(margin + 5, recY + 3, pageWidth - margin - 5, recY + 3);

													doc.setFontSize(11);
													doc.setTextColor(80, 80, 80);
													doc.setFont("helvetica", "normal");

													const messageLines = doc.splitTextToSize(healthAssessment.message, pageWidth - (margin * 2) - 20);
													doc.text(messageLines, margin + 10, recY + 15);

													if (healthAssessment.recommendation) {
														const recHeaderY = recY + 15 + (messageLines.length * 5) + 5;
														doc.setFont("helvetica", "bold");
														doc.text("Steps Forward:", margin + 10, recHeaderY);

														doc.setFont("helvetica", "normal");
														const recLines = doc.splitTextToSize(healthAssessment.recommendation, pageWidth - (margin * 2) - 20);
														doc.text(recLines, margin + 10, recHeaderY + 7);
													}

													// --- Official Seal ---
													const sealY = pageHeight - margin - 50;
													const sealX = pageWidth - margin - 40;

													doc.setDrawColor(233, 30, 99); // Pink seal
													doc.setLineWidth(1.5);
													doc.circle(sealX, sealY, 20, "S");
													doc.circle(sealX, sealY, 18, "S");

													doc.setFontSize(8);
													doc.setTextColor(233, 30, 99);
													doc.setFont("helvetica", "bold");
													doc.text("LIFESAVER", sealX, sealY - 10, { align: "center" });
													doc.text("CONNECT", sealX, sealY + 12, { align: "center" });

													doc.setFontSize(6);
													doc.text("SYSTEM VERIFIED", sealX, sealY, { align: "center" });
													// Rotate text for "APPROVED" is complex in pure jsPDF basic methods without plugins, 
													// so we keep it simple but official looking.

													// Use text for signature line since we don't have an image
													doc.setDrawColor(0, 0, 0);
													doc.setLineWidth(0.5);
													doc.line(margin + 10, sealY + 10, margin + 70, sealY + 10);
													doc.setFontSize(10);
													doc.setTextColor(0, 0, 0);
													doc.text("Authorized Signature", margin + 40, sealY + 16, { align: "center" });


													// --- Footer ---
													doc.setFontSize(8);
													doc.setTextColor(150, 150, 150);
													doc.text("This report is generated by LifeSaver Connect AI Health System.", margin, pageHeight - margin - 5);
													doc.text("Not a replacement for professional medical diagnosis.", margin, pageHeight - margin);
													doc.text(`Page 1 of 1`, pageWidth - margin, pageHeight - margin, { align: "right" });

													doc.save(`LifeSaver_Report_${displayDonor?.name || "Donor"}.pdf`);
												} catch (err) {
													console.error(err);
													alert("Error generating PDF. Please ensure you have an active health assessment.");
												}
											}}
											className="mt-3 inline-flex text-sm text-[#E91E63] hover:underline"
										>
											Download PDF
										</button>
									</div>
									<div className="rounded-xl border border-[#F6D6E3]/40 bg-[#1A1A2E] p-4">
										<h3 className="text-base font-medium text-white">How it Works</h3>
										<p className="mt-2 text-sm text-pink-100/80">
											Learn more about eligibility, finding hospitals, and the donation process.
										</p>
										<Link href="/guide/app-guide" legacyBehavior>
											<a className="mt-3 inline-flex text-sm text-[#E91E63]">Read Article</a>
										</Link>
									</div>
								</div>
							</div>
						</>
					)}
				</section>
			</main>
		</>
	)
}

