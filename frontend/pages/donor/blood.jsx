import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import { useCallback, useEffect, useMemo, useState } from "react"
import { apiFetch } from "../../lib/api"
import { jsPDF } from "jspdf"

const DONATION_HISTORY_PLACEHOLDER = []
const PLATELET_HISTORY_PLACEHOLDER = []
const DONOR_PROFILE_STORAGE_KEY = "lifesaver:donor_profile"
const DONATION_REQUESTS_STORAGE_KEY = "lifesaver:donation_requests"
const HEALTH_REPORT_STORAGE_KEY_BLOOD = "lifesaver:health_report_uploaded_blood"
const HEALTH_REPORT_FILENAME_KEY_BLOOD = "lifesaver:health_report_filename_blood"

// Blood Compatibility Map (Patient Group -> Donor Groups that patient can receive from)
const BLOOD_RECEIVE_COMPATIBILITY = {
	"O-": ["O-"],
	"O+": ["O-", "O+"],
	"A-": ["O-", "A-"],
	"A+": ["O-", "O+", "A-", "A+"],
	"B-": ["O-", "B-"],
	"B+": ["O-", "O+", "B-", "B+"],
	"AB-": ["O-", "A-", "B-", "AB-"],
	"AB+": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
}

// Helper to check if a donor's blood group is compatible with a patient's required group
function isCompatible(donor_bg, patient_bg) {
	if (!donor_bg) return false
	// If patient BG is missing (e.g. emergency case), maybe show it? 
	// For now, let's assume if patient_bg is missing, it MIGHT be compatible if we want to show all.
	// But strictly, we need to know.
	if (!patient_bg) return false
	const compatibleDonors = BLOOD_RECEIVE_COMPATIBILITY[patient_bg] || []
	return compatibleDonors.includes(donor_bg)
}

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
	const [emergencyNeeds, setEmergencyNeeds] = useState([])
	const [matchedNeeds, setMatchedNeeds] = useState([])
	const [rawNeeds, setRawNeeds] = useState([])
	const [activeTab, setActiveTab] = useState("matches")
	const [donationHistory, setDonationHistory] = useState([])
	const [confirmingArrival, setConfirmingArrival] = useState(false)
	const [updatingWorkflow, setUpdatingWorkflow] = useState(null)
	const [coupons, setCoupons] = useState([])
	const [selectedCoupon, setSelectedCoupon] = useState(null)

	// Verification Loop State
	const [healthReportUploaded, setHealthReportUploaded] = useState(false)
	const [healthReportFile, setHealthReportFile] = useState(null)
	const [healthEligible, setHealthEligible] = useState(false)
	const [showEligibilityPopup, setShowEligibilityPopup] = useState(false)
	const [eligibilityMessage, setEligibilityMessage] = useState("")


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
		age: "",
		weight: "",
	})
	const [healthAssessment, setHealthAssessment] = useState(null)
	const [medicineSuggestions, setMedicineSuggestions] = useState([])
	const [healthHistory, setHealthHistory] = useState([])
	const [downloadHistory, setDownloadHistory] = useState([])

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

	const loadDownloadHistory = useCallback(async () => {
		try {
			const data = await apiFetch("/donors/download_history/?report_type=BLOOD")
			setDownloadHistory(data)
		} catch (err) {
			console.error("Failed to load download history:", err)
		}
	}, [])

	const verifiedPdfUrl = useMemo(() => {
		if (!downloadHistory || downloadHistory.length === 0) return null
		// The latest one is at the top (sorted by -created_at in backend)
		return downloadHistory[0].pdf_file
	}, [downloadHistory])

	// Load initial data
	useEffect(() => {
		loadDonorProfile().catch(err => console.log("Init profile load failed:", err))
		loadDownloadHistory()
	}, [loadDonorProfile, loadDownloadHistory])

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
						let hospitalNeedsUrl = `/hospital-needs/?donor_blood_group=${data.donor.blood_group}&active_only=true&need_type=BLOOD`
						if (data.donor.city) {
							hospitalNeedsUrl += `&city=${encodeURIComponent(data.donor.city)}`
						}
						const hospitalNeeds = await apiFetch(hospitalNeedsUrl)
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

		const init = async () => {
			try {
				await fetchDashboard()
				await Promise.all([
					loadDonationRequests(),
					loadEmergencyNeeds(),
					loadDonationHistory(),
					loadCoupons()
				])
			} catch (err) {
				console.log("Dashboard init failed:", err)
			}
		}
		init()
	}, [fetchDashboard])

	// Refresh requests when page becomes visible
	useEffect(() => {
		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible") {
				loadDonationRequests()
				loadEmergencyNeeds()
				fetchDashboard(false)
			}
		}
		document.addEventListener("visibilitychange", handleVisibilityChange)
		return () => {
			document.removeEventListener("visibilitychange", handleVisibilityChange)
		}
	}, [fetchDashboard])

	// Also refresh on focus
	useEffect(() => {
		const handleFocus = () => {
			loadDonationRequests()
			fetchDashboard(false)
		}
		window.addEventListener("focus", handleFocus)
		return () => {
			window.removeEventListener("focus", handleFocus)
		}
	}, [fetchDashboard])

	async function loadDonationRequests() {
		try {
			const requests = await apiFetch("/donation-requests/?donor=me&request_type=BLOOD")
			setDonationRequests(requests)

			// Also sync to localStorage
			if (typeof window !== "undefined") {
				localStorage.setItem(DONATION_REQUESTS_STORAGE_KEY, JSON.stringify(requests))
			}
		} catch (error) {
			// Fallback to localStorage
			if (typeof window !== "undefined") {
				const stored = localStorage.getItem(DONATION_REQUESTS_STORAGE_KEY)
				if (stored) {
					try {
						const requests = JSON.parse(stored)
						// Filter for BLOOD type in local storage fallback too
						const filtered = requests.filter(r => r.request_type === "BLOOD")
						setDonationRequests(filtered)
					} catch (e) {
						setDonationRequests([])
					}
				}
			}
		}
	}

	async function loadEmergencyNeeds() {
		try {
			const [allEmergency, allHospital] = await Promise.all([
				apiFetch("/needs/?status=OPEN&need_type=BLOOD"),
				apiFetch("/hospital-needs/?need_type=BLOOD&active_only=true")
			])

			const combinedAllRaw = [
				...(Array.isArray(allEmergency) ? allEmergency : []),
				...(Array.isArray(allHospital) ? allHospital.map(h => ({ ...h, isHospitalNeed: true })) : [])
			]

			setRawNeeds(combinedAllRaw)
		} catch (error) {
			console.error("Error loading emergency needs:", error)
			setRawNeeds([])
		}
	}

	// Reactive filtering for Need Hiding and Compatibility
	useEffect(() => {
		const donor = donorProfile || localProfile
		const donor_blood_group = donor?.blood_group || ""
		const city = donor?.city || ""

		// Filter out needs with existing requests
		const respondedNeedIds = new Set(donationRequests.map(r => {
			const needId = r.is_hospital_request ? r.hospital_need?.id || r.hospital_need : r.emergency_need?.id || r.emergency_need;
			return `${needId}-${r.is_hospital_request ? 'HOSPITAL' : 'EMERGENCY'}`;
		}));

		const filteredNeeds = rawNeeds.filter(need => {
			const key = `${need.id}-${need.isHospitalNeed ? 'HOSPITAL' : 'EMERGENCY'}`;
			return !respondedNeedIds.has(key);
		});

		const finalMatches = []
		const finalOthers = []

		filteredNeeds.forEach(need => {
			const patient_bg = need.required_blood_group
			const needCity = need.isHospitalNeed ? need.hospital?.city : need.city
			const isCityMatch = city && needCity && city.toLowerCase().trim() === needCity.toLowerCase().trim()
			const isBloodMatch = isCompatible(donor_blood_group, patient_bg)

			if (isBloodMatch) {
				finalMatches.push({ ...need, isCriticalMatch: isCityMatch })
			} else {
				finalOthers.push(need)
			}
		})

		const dedupe = (list) => {
			const seen = new Set()
			return list.filter(item => {
				const key = `${item.id}-${item.isHospitalNeed ? 'HOSPITAL' : 'EMERGENCY'}`
				if (seen.has(key)) return false
				seen.add(key)
				return true
			})
		}

		setMatchedNeeds(dedupe(finalMatches.length > 0 ? finalMatches : filteredNeeds))
		setEmergencyNeeds(dedupe(filteredNeeds))
	}, [rawNeeds, donationRequests, donorProfile, localProfile])

	async function handleDonate(need) {
		// Use persisted eligibility flags if healthAssessment session state is null
		const isCurrentlyEligible = healthEligible && healthReportUploaded;

		if (!isCurrentlyEligible && !healthAssessment?.canDonate) {
			alert("Please complete the health assessment and upload your verified report first.")
			const element = document.getElementById("health-assessment-section")
			if (element) element.scrollIntoView({ behavior: 'smooth' })
			return
		}

		if (!confirm(`Are you sure you want to donate for this request at ${need.hospital?.name || "the requested location"}?`)) {
			return
		}

		try {
			// Construct payload depending on need type
			const payload = {
				request_type: "BLOOD",
				status: "PENDING"
			}

			if (need.isHospitalNeed) {
				payload.hospital_id = need.hospital?.id || need.hospital_id
				payload.hospital_need_id = need.id
			} else {
				// For Emergency Post (Public)
				payload.emergency_need_id = need.id
				// Hospital ID is optional now
			}

			await apiFetch("/donation-requests/", {
				method: "POST",
				body: JSON.stringify(payload)
			})
			alert("Donation request sent successfully! You will be contacted for further steps.")
			loadDonationRequests()

			// Restore redirect for emergency needs
			if (!need.isHospitalNeed) {
				window.location.href = "/needs/post"
			}
		} catch (error) {
			console.error("Donation request failed:", error)
			alert(error.message || "Failed to send donation request")
		}
	}

	async function loadDonationHistory() {
		try {
			const history = await apiFetch("/patient-visits/?visit_purpose=BLOOD_DONATION")
			setDonationHistory(history)
		} catch (error) {
			console.error("Error loading donation history:", error)
		}
	}

	async function loadCoupons() {
		try {
			const data = await apiFetch("/donor-coupons/")
			setCoupons(data)
		} catch (error) {
			console.error("Error loading coupons:", error)
		}
	}

	// Load selected coupon from localStorage on mount
	useEffect(() => {
		const savedCoupon = localStorage.getItem("selected_medical_coupon")
		if (savedCoupon) {
			try {
				setSelectedCoupon(JSON.parse(savedCoupon))
			} catch (e) {
				console.error("Failed to parse saved coupon:", e)
			}
		}
	}, [])

	// Persist selected coupon to localStorage
	useEffect(() => {
		if (selectedCoupon) {
			localStorage.setItem("selected_medical_coupon", JSON.stringify(selectedCoupon))
		} else {
			localStorage.removeItem("selected_medical_coupon")
		}
	}, [selectedCoupon])

	function handleSelectCoupon(coupon) {
		if (selectedCoupon?.id === coupon.id) {
			// Deselect if clicking the same coupon
			setSelectedCoupon(null)
		} else {
			setSelectedCoupon(coupon)
		}
	}

	const handleDeleteRequest = async (requestId) => {
		if (!confirm("Are you sure you want to permanently delete this donation request?")) return

		try {
			await apiFetch(`/donation-requests/${requestId}/`, {
				method: "DELETE",
			})
			// Refresh requests list
			setDonationRequests((prev) => prev.filter((r) => r.id !== requestId))
		} catch (err) {
			console.error("Error deleting request:", err)
			alert("Failed to delete the request. Please try again.")
		}
	}

	// Handle workflow updates
	async function handleWorkflowAction(requestId, action) {
		setUpdatingWorkflow(requestId)
		try {
			await apiFetch(`/donation-requests/${requestId}/${action}/`, {
				method: "POST"
			})
			await loadDonationRequests()
			alert(`Action "${action.replace('_', ' ')}" successful!`)
		} catch (error) {
			console.error(`Error performing ${action}:`, error)
			alert(`Failed to perform ${action}. Please try again.`)
		} finally {
			setUpdatingWorkflow(null)
		}
	}

	async function handleConfirmArrival(requestId) {
		setConfirmingArrival(true)
		try {
			await apiFetch(`/donation-requests/${requestId}/confirm_arrival/`, {
				method: "POST"
			})
			await loadDonationRequests()
			alert("Arrival confirmed! Please wait for the hospital staff to verify your donation.")
		} catch (error) {
			console.error("Error confirming arrival:", error)
			alert("Failed to confirm arrival. Please try again.")
		} finally {
			setConfirmingArrival(false)
		}
	}

	async function handleResubmitRequest(requestId) {
		try {
			await apiFetch(`/donation-requests/${requestId}/`, {
				method: "PATCH",
				body: JSON.stringify({ status: "PENDING", notes: "" })
			})
			await loadDonationRequests()
			alert("Request resubmitted! Please wait for the hospital to review it.")
		} catch (error) {
			console.error("Error resubmitting request:", error)
			alert("Failed to resubmit request. Please try again.")
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

	const totalBloodDonations = donationHistory.length

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

	// Computed values for request cycle management
	const hasActiveRequest = useMemo(() => {
		return donationRequests.some(r => ["PENDING", "ACCEPTED", "SCHEDULED", "SCHEDULE_CONFIRMED", "REACHING", "ARRIVED"].includes(r.status))
	}, [donationRequests])

	const mostRecentRequest = useMemo(() => {
		if (donationRequests.length === 0) return null
		return donationRequests[0] // Already sorted by -created_at from API
	}, [donationRequests])

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
		const uploadStatus = localStorage.getItem(HEALTH_REPORT_STORAGE_KEY_BLOOD)
		if (uploadStatus === "true") {
			setHealthReportUploaded(true)
			setHealthEligible(true)
		}
	}, [])

	// Sync with backend download history
	useEffect(() => {
		if (downloadHistory.length > 0) {
			const latestReport = downloadHistory[0]
			const reportTime = new Date(latestReport.timestamp).getTime()

			// Check if this report was generated AFTER the most recent request
			let isReportFresh = true
			if (mostRecentRequest) {
				const requestTime = new Date(mostRecentRequest.created_at).getTime()
				if (reportTime <= requestTime) {
					isReportFresh = false
				}
			}

			if (isReportFresh) {
				setHealthReportUploaded(true)
				setHealthEligible(true)
			} else {
				// Clear status if the latest report is from a previous cycle
				setHealthReportUploaded(false)
				setHealthEligible(false)
			}
		} else {
			// No history means nothing is uploaded/verified
			setHealthReportUploaded(false)
			setHealthEligible(false)
		}
	}, [downloadHistory, mostRecentRequest])

	// Reset health report status when donation is COMPLETED or REJECTED (for the cycle loop)
	useEffect(() => {
		if (typeof window === "undefined" || !mostRecentRequest) return

		const lastResetId = localStorage.getItem("lifesaver:last_reset_request_id")

		if (["COMPLETED", "REJECTED", "ACCEPTED"].includes(mostRecentRequest.status) && lastResetId !== String(mostRecentRequest.id)) {
			// Clear the health report for this cycle - donor must upload a new one
			localStorage.removeItem(HEALTH_REPORT_STORAGE_KEY_BLOOD)
			localStorage.removeItem(HEALTH_REPORT_FILENAME_KEY_BLOOD)
			localStorage.removeItem("lifesaver:health_history") // Clear local history to force new assessment
			localStorage.setItem("lifesaver:last_reset_request_id", String(mostRecentRequest.id))

			setHealthReportUploaded(false)
			setHealthReportFile(null)
			setHealthEligible(false)
			setHealthAssessment(null)
		}
	}, [mostRecentRequest])

	async function handleHealthReportUpload(e) {
		const file = e.target.files[0]
		if (!file) return

		if (file.type !== "application/pdf") {
			alert("Please upload a PDF file.")
			return
		}

		if (file.size > 5 * 1024 * 1024) { // 5MB limit
			alert("File size exceeds 5MB limit.")
			return
		}

		try {
			// Verify integrity with blockchain ledger via backend
			const formData = new FormData()
			formData.append('file', file)

			const response = await apiFetch('/donors/verify_health_report/', {
				method: 'POST',
				body: formData,
				// apiFetch usually handles JSON, but for FormData we need to be careful
				// If apiFetch sets Content-Type automatically, browser will fail to set boundary.
				// Assuming apiFetch is robust.
			})

			if (response.valid) {
				setHealthReportFile(file)
				setHealthReportUploaded(true)
				localStorage.setItem(HEALTH_REPORT_STORAGE_KEY_BLOOD, "true")
				localStorage.setItem(HEALTH_REPORT_FILENAME_KEY_BLOOD, file.name)
				alert(response.detail || "Health report verified and uploaded successfully!")
				window.scrollTo({ top: 0, behavior: 'smooth' })
			} else {
				alert(`Verification Failed: ${response.detail}`)
				e.target.value = "" // Reset input
			}
		} catch (err) {
			console.error("Verification Error:", err)
			alert(err.message || "Error verifying report integrity. Please ensure you are uploading the latest report you downloaded.")
			e.target.value = "" // Reset input
		}
	}

	function handleNewRequestClick(e) {
		e.preventDefault() // Prevent default if it's a link click
		// Check if there's already an active request
		if (hasActiveRequest) {
			setEligibilityMessage("You already have an active donation request. Please wait for it to be completed or resolved before requesting a new one.")
			setShowEligibilityPopup(true)
			return
		}
		if (!healthReportUploaded) {
			setEligibilityMessage("Please upload your health report PDF first. Complete the health assessment below and upload the generated report.")
			setShowEligibilityPopup(true)
			return
		}
		if (!healthEligible) {
			setEligibilityMessage("Your health status does not meet the eligibility criteria for blood donation. Please confirm your eligibility in the health assessment.")
			setShowEligibilityPopup(true)
			return
		}
		// Navigate to request page
		window.location.href = "/donor/donate?type=BLOOD"
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

		// Check age requirement (must be >= 18)
		const age = parseInt(healthStatus.age)
		if (!age || age < 18) {
			healthScore -= 50
			canDonate = false
			if (!age) {
				recommendation = "Please enter your age to determine donation eligibility."
			} else {
				recommendation = "You must be at least 18 years old to donate blood. The minimum age requirement is for your safety and health."
			}
		}

		// Check weight requirement (must be > 50 kg)
		const weight = parseFloat(healthStatus.weight)
		if (!weight || weight <= 50) {
			healthScore -= 50
			canDonate = false
			if (!weight) {
				if (recommendation) recommendation += " "
				recommendation += "Please enter your weight to determine donation eligibility."
			} else {
				if (recommendation) recommendation += " "
				recommendation += "You must weigh more than 50 kg (110 lbs) to donate blood. This requirement ensures you have sufficient blood volume for safe donation."
			}
		}

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
		setHealthEligible(canDonate)
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

	// Generate Health Report PDF
	async function generateHealthReportPDF() {
		if (!healthAssessment || !healthAssessment.canDonate) {
			alert("You must complete a health assessment and be eligible before downloading the report.")
			return
		}

		try {
			// Call backend to generate secure PDF (No password required)
			const blob = await apiFetch('/donors/generate_health_report/', {
				method: 'POST',
				responseAs: 'blob',
				body: JSON.stringify({
					...healthAssessment,
					age: healthStatus.age,
					weight: healthStatus.weight
				})
			});
			const url = window.URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;

			const donorName = displayDonor?.name?.replace(/\s+/g, '_') || 'Donor';
			const dateStr = new Date().toISOString().split('T')[0];
			link.setAttribute('download', `Health_Report_${donorName}_${dateStr}.pdf`);

			document.body.appendChild(link);
			link.click();
			link.parentNode.removeChild(link);
			window.URL.revokeObjectURL(url);

			// Refresh download history
			loadDownloadHistory()
			alert("Health report downloaded successfully! This PDF is SECURED: Copying and editing are strictly prohibited.");
		} catch (err) {
			console.error("PDF Error:", err);
			alert(err.message || "Error generating secure report. Please try again.");
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
							<button
								onClick={handleNewRequestClick}
								className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition ${canRequestNewDonation
									? "bg-[#E91E63] hover:opacity-90"
									: "bg-slate-700 opacity-70 cursor-not-allowed"
									}`}
								disabled={!canRequestNewDonation}
							>
								Find Hospital / Book Slot
							</button>
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
							{/* Verification Status Banners */}
							<div className="grid gap-4 md:grid-cols-2">
								{/* Active Request Banner */}
								{hasActiveRequest && (
									<div className="rounded-xl border border-blue-500/40 bg-blue-500/10 p-4 flex items-center gap-3">
										<div className="h-10 w-10 flex items-center justify-center rounded-full bg-blue-500/20 text-blue-300">
											<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
											</svg>
										</div>
										<div>
											<p className="font-semibold text-blue-300">Active Request In Progress</p>
											<p className="text-xs text-blue-200/70">You cannot make a new request until your current one is completed.</p>
										</div>
									</div>
								)}

								{/* Health Verification Banner */}
								{!hasActiveRequest && (
									healthReportUploaded ? (
										<div className="rounded-xl border border-green-500/40 bg-green-500/10 p-4 flex items-center gap-3">
											<div className="h-10 w-10 flex items-center justify-center rounded-full bg-green-500/20 text-green-300">
												<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
												</svg>
											</div>
											<div>
												<p className="font-semibold text-green-300">Health Verified</p>
												<p className="text-xs text-green-200/70">You are eligible to request a donation.</p>
											</div>
										</div>
									) : (
										<div className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-4 flex items-center gap-3">
											<div className="h-10 w-10 flex items-center justify-center rounded-full bg-yellow-500/20 text-yellow-300">
												<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
												</svg>
											</div>
											<div>
												<p className="font-semibold text-yellow-300">Health Verification Required</p>
												<p className="text-xs text-yellow-200/70">Please complete the health assessment and upload your report below.</p>
											</div>
										</div>
									)
								)}
							</div>
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
									<h2 className="mt-3 text-2xl font-bold text-white">{displayDonor?.current_stars || 0}</h2>
									<p className="mt-2 text-sm text-pink-100/70">
										These numbers update after each verified donation from partner centres.
									</p>
								</div>
								<div className="rounded-2xl border border-yellow-500/30 bg-[#131326] p-6 shadow-lg shadow-yellow-500/5 flex items-center justify-between">
									<div>
										<p className="text-sm text-pink-100/80">Star Reward Progress</p>
										<h2 className="mt-3 text-2xl font-bold text-white">{(displayDonor?.current_stars > 0 && displayDonor?.current_stars % 3 === 0) ? 0 : (displayDonor?.current_stars % 3)} / 3 Stars</h2>
										<p className="mt-2 text-xs text-yellow-100/60 leading-relaxed">
											Earn 3 stars to receive <span className="text-yellow-400 font-bold">50 Rs</span> & <span className="text-yellow-400 font-bold">20% Discount Coupon</span>!
										</p>
									</div>
									<div className="relative h-20 w-20 flex-shrink-0">
										<svg className="h-full w-full" viewBox="0 0 100 100">
											<circle
												className="text-white/10"
												strokeWidth="10"
												stroke="currentColor"
												fill="transparent"
												r="40"
												cx="50"
												cy="50"
											/>
											<circle
												className="text-yellow-500 transition-all duration-1000 ease-out"
												strokeWidth="10"
												strokeDasharray={251.2}
												strokeDashoffset={251.2 - (251.2 * ((displayDonor?.current_stars > 0 && displayDonor?.current_stars % 3 === 0) ? 0 : (displayDonor?.current_stars % 3))) / 3}
												strokeLinecap="round"
												stroke="currentColor"
												fill="transparent"
												r="40"
												cx="50"
												cy="50"
											/>
										</svg>
										<div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-yellow-500">
											{Math.round((((displayDonor?.current_stars > 0 && displayDonor?.current_stars % 3 === 0) ? 0 : (displayDonor?.current_stars % 3)) / 3) * 100)}%
										</div>
									</div>
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
													<p className="text-xs uppercase tracking-wide text-pink-100/60">Date of Birth</p>
													<p className="mt-2 text-base font-medium text-white">{displayDonor?.date_of_birth || "Not provided"}</p>
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
																	min={new Date().toISOString().split("T")[0]}
																	value={availabilitySchedule.startDate}
																	onChange={(e) => setAvailabilitySchedule({ ...availabilitySchedule, startDate: e.target.value })}
																	className="w-full rounded-lg border border-[#F6D6E3]/30 bg-[#1A1A2E] px-3 py-2 text-sm text-white outline-none focus:border-[#E91E63]"
																/>
															</div>
															<div>
																<label className="block text-xs font-medium text-pink-100/80 mb-1">End Date</label>
																<input
																	type="date"
																	min={availabilitySchedule.startDate || new Date().toISOString().split("T")[0]}
																	value={availabilitySchedule.endDate}
																	onChange={(e) => setAvailabilitySchedule({ ...availabilitySchedule, endDate: e.target.value })}
																	className="w-full rounded-lg border border-[#F6D6E3]/30 bg-[#1A1A2E] px-3 py-2 text-sm text-white outline-none focus:border-[#E91E63]"
																/>
															</div>
															<div>
																<label className="block text-xs font-medium text-pink-100/80 mb-1">Start Time</label>
																<input
																	type="time"
																	min={availabilitySchedule.startDate === new Date().toISOString().split("T")[0] ? new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : undefined}
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
											<div id="health-assessment-section" className="mt-6 rounded-xl border border-[#F6D6E3]/30 bg-[#1A1A2E] p-6">
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
														{/* Age and Weight Fields */}
														<div className="grid gap-4 sm:grid-cols-2">
															<div>
																<label className="block text-xs font-medium text-pink-100/80 mb-1">
																	Age (years) <span className="text-red-400">*</span>
																</label>
																<input
																	type="number"
																	value={healthStatus.age}
																	onChange={(e) => setHealthStatus({ ...healthStatus, age: e.target.value })}
																	min="1"
																	max="120"
																	className="w-full rounded-lg border border-[#F6D6E3]/30 bg-[#1A1A2E] px-3 py-2 text-sm text-white outline-none focus:border-[#E91E63]"
																	placeholder="e.g., 25"
																	required
																/>
																<p className="text-xs text-pink-100/50 mt-1">Must be at least 18 years old</p>
															</div>
															<div>
																<label className="block text-xs font-medium text-pink-100/80 mb-1">
																	Weight (kg) <span className="text-red-400">*</span>
																</label>
																<input
																	type="number"
																	step="0.1"
																	value={healthStatus.weight}
																	onChange={(e) => setHealthStatus({ ...healthStatus, weight: e.target.value })}
																	min="1"
																	max="300"
																	className="w-full rounded-lg border border-[#F6D6E3]/30 bg-[#1A1A2E] px-3 py-2 text-sm text-white outline-none focus:border-[#E91E63]"
																	placeholder="e.g., 65.5"
																	required
																/>
																<p className="text-xs text-pink-100/50 mt-1">Must be more than 50 kg (110 lbs)</p>
															</div>
														</div>
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

												{/* Download Health Report Button */}
												{healthAssessment && healthAssessment.canDonate && (
													<div className="mt-4">
														<button
															type="button"
															onClick={generateHealthReportPDF}
															className="w-full rounded-lg bg-gradient-to-r from-[#E91E63] to-[#D81B60] px-6 py-3 text-sm font-bold text-white shadow-lg hover:shadow-xl hover:from-[#D81B60] hover:to-[#C2185B] transition-all flex items-center justify-center gap-2"
														>
															<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
															</svg>
															Download Health Report PDF
														</button>
														<p className="mt-2 text-xs text-pink-100/60 text-center">
															📋 Required for platelet donation requests
														</p>
													</div>
												)}

												{/* Upload Health Report Section */}
												{healthAssessment?.canDonate && (
													<div className="mt-6 rounded-xl border border-dashed border-[#F6D6E3]/40 bg-[#1A1A2E] p-6">
														<h4 className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
															<svg className="w-5 h-5 text-[#E91E63]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
															</svg>
															Upload Verified Health Report
														</h4>
														<p className="text-xs text-pink-100/70 mb-4">
															Please upload the PDF report you just downloaded. This verifies your eligibility for donation requests.
														</p>

														{healthReportUploaded ? (
															<div className="flex items-center justify-between gap-3 rounded-lg bg-green-500/10 border border-green-500/30 p-3">
																<div className="flex items-center gap-3">
																	<div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400">
																		<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
																		</svg>
																	</div>
																	<div className="flex-1">
																		<p className="text-sm font-semibold text-green-300">Verified Report</p>
																		<p className="text-xs text-green-200/60">
																			Check another report for next donation
																		</p>
																	</div>
																</div>
																{verifiedPdfUrl && (
																	<a
																		href={verifiedPdfUrl}
																		target="_blank"
																		rel="noopener noreferrer"
																		className="rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-600 transition shadow-sm uppercase"
																	>
																		View Verified Report
																	</a>
																)}
															</div>
														) : (
															<div className="relative">
																<input
																	type="file"
																	accept="application/pdf"
																	onChange={handleHealthReportUpload}
																	className="block w-full text-sm text-pink-100
																		file:mr-4 file:py-2 file:px-4
																		file:rounded-lg file:border-0
																		file:text-sm file:font-semibold
																		file:bg-[#E91E63] file:text-white
																		hover:file:bg-[#D81B60]
																		file:cursor-pointer cursor-pointer"
																/>
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

											{/* Blockchain Integrity Ledger Section */}
											<div className="mt-8">
												<div className="flex items-center justify-between mb-4">
													<div>
														<h3 className="text-xl font-bold text-white flex items-center gap-2">
															<svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
															</svg>
															Verified Blood Report Ledger
														</h3>
														<p className="text-sm text-pink-100/60 mt-1">
															Every health assessment report is hashed and recorded on our immutable integrity ledger.
														</p>
													</div>
												</div>

												{downloadHistory && downloadHistory.length > 0 ? (
													<div className="space-y-3">
														{downloadHistory.map((item) => (
															<div key={item.id} className="rounded-xl border border-blue-500/20 bg-[#131326] p-4 font-mono text-xs transition hover:border-blue-400/40">
																<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
																	<div className="space-y-1">
																		<div className="flex items-center gap-2 text-blue-300">
																			<span className="font-bold">DOWNLOAD ID:</span>
																			<span>{item.download_id}</span>
																		</div>
																		<div className="flex items-center gap-2 text-pink-100/60 truncate max-w-xs sm:max-w-md">
																			<span className="font-bold">PDF HASH:</span>
																			<span>{item.pdf_hash}</span>
																		</div>
																		<div className="flex items-center gap-2 text-green-400/80 truncate max-w-xs sm:max-w-md">
																			<span className="font-bold">BLOCK HASH:</span>
																			<span>{item.block_hash}</span>
																		</div>
																	</div>
																	<div className="flex flex-col items-start gap-1 sm:items-end sm:text-right">
																		<span className="text-pink-100/40">{new Date(item.timestamp).toLocaleString()}</span>
																		<span className="rounded bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-400 border border-blue-500/20">
																			NONCE: {item.nonce}
																		</span>
																	</div>
																</div>
															</div>
														))}
													</div>
												) : (
													<div className="rounded-xl border border-[#F6D6E3]/20 bg-[#131326] p-8 text-center">
														<p className="text-pink-100/40">No download records found on the ledger.</p>
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

							<div className="grid gap-6 lg:grid-cols-3">
								<div className="lg:col-span-2 space-y-6">
									<div className="grid gap-6 md:grid-cols-2">
										{/* My Donation Requests Column */}
										<div className="rounded-2xl border border-[#F6D6E3] bg-[#131326] p-6">
											<div className="flex items-center justify-between mb-4">
												<div className="flex items-center gap-2">
													<h2 className="text-lg font-semibold text-white">My Donation Requests</h2>
													<button
														onClick={() => loadDonationRequests()}
														className="text-pink-100/40 hover:text-[#E91E63] transition p-1 rounded-full hover:bg-white/5"
														title="Refresh Requests"
													>
														<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
														</svg>
													</button>
												</div>
												<button
													onClick={handleNewRequestClick}
													className={`text-sm ${canRequestNewDonation ? "text-[#E91E63] hover:underline" : "text-gray-500 cursor-not-allowed"}`}
												>
													New Request
												</button>
											</div>

											{!healthReportUploaded && (
												<div className="mb-4 rounded-xl bg-yellow-500/5 border border-yellow-500/20 p-4">
													<p className="text-[10px] font-bold text-yellow-300 mb-2 uppercase tracking-wider flex items-center gap-2">
														<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
														</svg>
														New Health Report Required
													</p>
													<input
														type="file"
														accept="application/pdf"
														onChange={handleHealthReportUpload}
														className="block w-full text-[10px] text-pink-100/40
															file:mr-3 file:py-1 file:px-3
															file:rounded-md file:border-0
															file:text-[10px] file:font-bold
															file:bg-[#E91E63] file:text-white
															hover:file:bg-[#E91E63]/90
															file:cursor-pointer cursor-pointer"
													/>
												</div>
											)}

											{donationRequests.length > 0 ? (
												<div className="space-y-4">
													{/* Action Required / Updates */}
													{donationRequests.filter(r => ["ACCEPTED", "SCHEDULED", "SCHEDULE_CONFIRMED", "REACHING", "ARRIVED", "REJECTED"].includes(r.status)).length > 0 && (
														<div className="space-y-3">
															<p className="text-[10px] font-bold text-[#E91E63] uppercase tracking-widest pl-1 mb-2">Hospital Responses & Workflow</p>
															{donationRequests.filter(r => ["ACCEPTED", "SCHEDULED", "SCHEDULE_CONFIRMED", "REACHING", "ARRIVED", "REJECTED"].includes(r.status)).map((request) => {
																const hospital = request.hospital
																const emergency = request.emergency_need
																const statusColors = {
																	ACCEPTED: "bg-green-500/10 text-green-300 border-green-500/20",
																	SCHEDULED: "bg-purple-500/10 text-purple-300 border-purple-500/20",
																	SCHEDULE_CONFIRMED: "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
																	REACHING: "bg-orange-500/10 text-orange-300 border-orange-500/20",
																	ARRIVED: "bg-blue-500/10 text-blue-300 border-blue-500/20",
																	REJECTED: "bg-red-500/10 text-red-300 border-red-500/20",
																}
																return (
																	<div key={request.id} className="rounded-xl border border-white/5 bg-white/5 p-4 space-y-3 transition hover:bg-white/[0.07]">
																		<div className="flex items-center justify-between gap-3">
																			<div className="flex-1 min-w-0">
																				<div className="flex items-center gap-2">
																					<p className="font-bold text-white text-xs truncate">
																						{hospital ? hospital.name : (emergency ? "Emergency Request" : "System Request")}
																					</p>
																					<span className={`px-1.5 py-0.5 rounded text-[8px] font-black border uppercase ${statusColors[request.status] || "bg-gray-500/10 text-gray-400"}`}>
																						{request.status.replace('_', ' ')}
																					</span>
																				</div>
																				{request.scheduled_date && (
																					<p className="text-[9px] text-pink-100/60 mt-0.5 flex items-center gap-1">
																						🕒 Scheduled: {new Date(request.scheduled_date).toLocaleString()}
																					</p>
																				)}
																			</div>
																		</div>

																		<div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/5">
																			{request.status === "SCHEDULED" && (
																				<button
																					onClick={() => handleWorkflowAction(request.id, 'confirm_schedule')}
																					disabled={updatingWorkflow === request.id}
																					className="rounded bg-cyan-600 px-3 py-1.5 text-[9px] font-black text-white hover:bg-cyan-500 transition shadow-md shadow-cyan-900/20 uppercase disabled:opacity-50"
																				>
																					{updatingWorkflow === request.id ? "Updating..." : "Confirm Schedule ✅"}
																				</button>
																			)}
																			{request.status === "SCHEDULE_CONFIRMED" && (
																				<button
																					onClick={() => handleWorkflowAction(request.id, 'confirm_reaching')}
																					disabled={updatingWorkflow === request.id}
																					className="rounded bg-orange-600 px-3 py-1.5 text-[9px] font-black text-white hover:bg-orange-500 transition shadow-md shadow-orange-900/20 uppercase disabled:opacity-50"
																				>
																					{updatingWorkflow === request.id ? "Updating..." : "I am Reaching 🚗"}
																				</button>
																			)}
																			{["REACHING", "ACCEPTED"].includes(request.status) && (
																				<button
																					onClick={() => handleConfirmArrival(request.id)}
																					disabled={confirmingArrival || updatingWorkflow === request.id}
																					className="rounded bg-[#E91E63] px-3 py-1.5 text-[9px] font-black text-white hover:opacity-90 transition shadow-md shadow-[#e91e6340] uppercase disabled:opacity-50"
																				>
																					{confirmingArrival ? "Confirming..." : "I HAVE ARRIVED 📍"}
																				</button>
																			)}
																			{request.status === "ACCEPTED" && !request.scheduled_date && (
																				<p className="text-[9px] text-yellow-300/60 italic">Waiting for hospital to set schedule...</p>
																			)}

																			{request.status === "REJECTED" && (
																				<div className="flex items-center gap-2 w-full justify-between">
																					<button
																						onClick={() => {
																							const element = document.getElementById("health-assessment-section")
																							if (element) {
																								element.scrollIntoView({ behavior: 'smooth' })
																							}
																							alert("Your previous request was rejected. Please complete a new health assessment to proceed with a fresh request.")
																						}}
																						className="rounded border border-[#E91E63] px-3 py-1 text-[9px] font-black text-[#E91E63] hover:bg-[#E91E63]/10 transition uppercase"
																					>
																						NEW ASSESSMENT
																					</button>
																					<button
																						onClick={() => handleDeleteRequest(request.id)}
																						className="p-1.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition group"
																						title="Delete rejected request"
																					>
																						<svg className="w-3.5 h-3.5 group-hover:scale-110 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
																						</svg>
																					</button>
																				</div>
																			)}
																		</div>
																	</div>
																)
															})}
														</div>
													)}

													{/* Pending Requests */}
													{donationRequests.filter(r => r.status === "PENDING").length > 0 && (
														<div className="space-y-2">
															<p className="text-[10px] font-bold text-pink-100/30 uppercase tracking-widest pl-1 mb-2">Pending Confirmation</p>
															{donationRequests.filter(r => r.status === "PENDING").map((request) => {
																const hospital = request.hospital
																const emergency = request.emergency_need
																return (
																	<div key={request.id} className="rounded-lg border border-white/5 bg-white/5 p-3 flex items-center justify-between gap-3">
																		<div className="flex-1 min-w-0">
																			<p className="font-semibold text-white/80 text-xs truncate">
																				{hospital ? hospital.name : (emergency ? "Emergency Request" : "System Request")}
																			</p>
																			{emergency && <p className="text-[10px] text-pink-100/50 block truncate">{emergency.city} • {emergency.contact_phone}</p>}
																			<p className="text-[10px] text-pink-100/30 italic">Awaiting response...</p>
																		</div>
																		<div className="flex items-center gap-2">
																			<span className="px-1.5 py-0.5 rounded text-[8px] font-bold border bg-yellow-500/5 text-yellow-500/50 border-yellow-500/10 uppercase">
																				PENDING
																			</span>
																			<button
																				onClick={() => handleDeleteRequest(request.id)}
																				className="p-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition group"
																				title="Delete pending request"
																			>
																				<svg className="w-3 h-3 group-hover:scale-110 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
																				</svg>
																			</button>
																		</div>
																	</div>
																)
															})}
														</div>
													)}
												</div>
											) : (
												<div className="rounded-xl border border-dashed border-white/10 p-8 text-center bg-white/[0.02]">
													<div className="text-2xl mb-2 opacity-20">📋</div>
													<p className="text-[10px] text-pink-100/40 uppercase font-black tracking-[0.2em]">No Active Requests</p>
													<p className="text-[9px] text-pink-100/20 mt-1">
														Submit a new request to see it here. If you just submitted one, try refreshing.
													</p>
													<button
														onClick={loadDonationRequests}
														className="mt-3 text-[9px] text-[#E91E63] hover:underline uppercase tracking-wider"
													>
														Check for Updates
													</button>
												</div>
											)}
										</div>

										{/* Critical Matches Section */}
										<div className="rounded-2xl border border-[#F6D6E3] bg-[#131326] p-6">
											<div className="flex flex-col gap-4 mb-6">
												<div className="flex items-center justify-between">
													<h2 className="text-lg font-semibold text-white">Blood Requests</h2>
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
													{(activeTab === "matches" ? matchedNeeds : emergencyNeeds).map((need) => {
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
																			{need.isCriticalMatch && (
																				<span className="ml-1 rounded bg-red-600 px-1.5 py-0.5 text-[7px] font-bold text-white border border-red-400 uppercase tracking-wider shadow-lg shadow-red-600/20 animate-pulse">
																					CRITICAL MATCH
																				</span>
																			)}
																			{need.isHospitalNeed ? (
																				<span className="ml-1 rounded bg-purple-500/20 px-1.5 py-0.5 text-[7px] font-bold text-purple-300 border border-purple-500/30 uppercase tracking-wider">
																					HOSPITAL REQUEST
																				</span>
																			) : (
																				<span className="ml-1 rounded bg-red-500/20 px-1.5 py-0.5 text-[7px] font-bold text-red-300 border border-red-500/30 uppercase tracking-wider">
																					EMERGENCY POST
																				</span>
																			)}
																		</div>
																		<div className="space-y-1">
																			<p className="text-[10px] text-pink-100/60 flex items-center gap-1">
																				📍 {need.isHospitalNeed ? `${need.hospital?.name || 'Hospital'}, ${need.city}` : need.city} • <span className="text-white/40">{need.isHospitalNeed ? "From Hospital Board" : "From Emergency Board"}</span>
																			</p>
																			{need.isHospitalNeed && (
																				<div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-[10px] text-pink-100/70 border-t border-white/5 pt-1">
																					{need.patient_name && (
																						<span className="flex items-center gap-1 font-bold text-white">👤 {need.patient_name}</span>
																					)}
																					{need.location_details && (
																						<span className="flex items-center gap-1">📍 {need.location_details}</span>
																					)}
																					{need.patient_contact && (
																						<span className="flex items-center gap-1">📞 {need.patient_contact}</span>
																					)}
																					{need.time_to_reach && (
																						<span className="flex items-center gap-1 text-red-400">🕒 {need.time_to_reach}</span>
																					)}
																				</div>
																			)}
																			{!need.isHospitalNeed && need.contact_phone && (
																				<p className="text-[10px] text-pink-100/70 border-t border-white/5 pt-1 mt-1 font-mono">
																					{need.contact_phone}
																				</p>
																			)}
																		</div>
																	</div>
																	<div className="rounded-lg h-10 w-10 flex items-center justify-center bg-[#E91E63]/10 text-[#E91E63] shadow-sm cursor-default">
																		<span className="font-black text-xs">{need.required_blood_group || 'O+'}</span>
																	</div>
																</div>
																{/* Donate Button for Hospital Needs */}
																<button
																	onClick={(e) => {
																		e.preventDefault()
																		handleDonate(need)
																	}}
																	className={`mt-3 w-full rounded-lg px-3 py-2 text-xs font-bold text-white hover:opacity-90 transition shadow-sm uppercase flex items-center justify-center gap-2 ${need.isHospitalNeed ? "bg-[#E91E63]" : "bg-red-600"}`}
																>
																	<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
																	</svg>
																	{need.isHospitalNeed ? "Donate at Hospital" : "Respond to Emergency"}
																</button>
															</li>
														)
													})}
												</ul>
											) : (
												<div className="rounded-xl border border-dashed border-[#F6D6E3]/40 bg-[#1A1A2E] p-6 text-sm text-pink-100/70 text-center">
													<p>No {activeTab === "matches" ? "compatible" : "active"} blood requests found at the moment.</p>
												</div>
											)}
										</div>
									</div>

									<div className="rounded-2xl border border-[#F6D6E3] bg-[#131326] p-6">
										<div className="flex items-center justify-between">
											<h2 className="text-lg font-semibold text-white">Donation History</h2>
											<Link href="#" legacyBehavior>
												<a className="text-sm text-[#E91E63]">Export</a>
											</Link>
										</div>
										{donationHistory.length ? (
											<ul className="mt-4 space-y-3">
												{donationHistory.map((entry) => (
													<li key={entry.id} className="rounded-xl border border-[#F6D6E3]/40 bg-[#1A1A2E] p-4 relative overflow-hidden group">
														{entry.star_reward && (
															<div className="absolute top-0 right-0 bg-yellow-500 text-black text-[10px] font-black px-3 py-1 rounded-bl-lg shadow-md transform translate-x-1 -translate-y-1 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform">
																★ STAR REWARD
															</div>
														)}
														<div className="flex items-center justify-between text-sm text-pink-100/80 mb-2">
															<span className="font-bold">{new Date(entry.visit_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
															<span className="bg-[#E91E63]/20 text-[#E91E63] px-2 py-0.5 rounded text-xs font-bold">BLOOD</span>
														</div>
														<p className="text-sm text-white font-medium">Hospital: {entry.hospital?.name || "Unknown Hospital"}</p>

														{entry.rewards && (
															<div className="mt-3 p-2.5 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
																<p className="text-[10px] font-black text-yellow-500 uppercase tracking-widest mb-1">Rewards Granted</p>
																<p className="text-sm text-yellow-100/90">{entry.rewards}</p>
															</div>
														)}

														{entry.fruity_given && (
															<div className="mt-2 flex items-center gap-2 text-xs text-green-300 font-bold bg-green-500/10 w-fit px-2 py-1 rounded border border-green-500/20">
																<span>🍊</span> Fruity Given
															</div>
														)}
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

								<div className="space-y-6">
									{/* Rewards & Earnings Box */}
									<div className="rounded-2xl border border-yellow-500/40 bg-gradient-to-br from-[#131326] to-[#1A1A2E] p-6 shadow-xl shadow-yellow-500/5">
										<div className="flex items-center gap-3 mb-6">
											<div className="h-10 w-10 rounded-full bg-yellow-500/20 flex items-center justify-center text-xl">💰</div>
											<h2 className="text-lg font-bold text-white">Your Wallet</h2>
										</div>
										<div className="space-y-4">
											<div className="p-4 rounded-xl bg-white/5 border border-white/10">
												<p className="text-xs text-pink-100/60 uppercase font-black tracking-widest">Total Earnings Received</p>
												<p className="mt-1 text-3xl font-black text-white">Rs {displayDonor?.total_money_earned || "0.00"}</p>
											</div>
											<p className="text-xs text-pink-100/50 leading-relaxed italic">
												* Earned by reaching 3-star milestones. This amount is automatically credited to your LifeSaver wallet.
											</p>
										</div>
									</div>

									{/* Coupons Box */}
									<div className="rounded-2xl border border-blue-500/40 bg-gradient-to-br from-[#131326] to-[#1A1A2E] p-6 shadow-xl shadow-blue-500/5">
										<div className="flex items-center gap-3 mb-6">
											<div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center text-xl">🎟️</div>
											<h2 className="text-lg font-bold text-white">Medical Coupons</h2>
										</div>
										{coupons.filter(c => !c.is_used).length > 0 ? (
											<div className="max-h-[300px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#3b82f6 transparent' }}>
												<div className="space-y-3">
													{coupons.filter(c => !c.is_used).map((coupon) => {
														const isSelected = selectedCoupon?.id === coupon.id
														return (
															<div key={coupon.id} className={`relative p-4 rounded-xl border-2 border-dashed overflow-hidden transition-all ${isSelected
																? 'border-green-500/60 bg-green-500/10 ring-2 ring-green-500/30'
																: 'border-blue-500/30 bg-blue-500/5'
																}`}>
																<div className="relative z-10">
																	<div className="flex justify-between items-start mb-2">
																		<span className="text-xl font-black text-white">{coupon.discount_percentage}% OFF</span>
																		<div className="flex items-center gap-2">
																			{isSelected ? (
																				<span className="text-[10px] font-bold text-green-300 bg-green-500/20 px-2 py-0.5 rounded flex items-center gap-1">
																					<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
																					SELECTED
																				</span>
																			) : (
																				<span className="text-[10px] font-bold text-blue-300 bg-blue-500/20 px-2 py-0.5 rounded">VALID</span>
																			)}
																		</div>
																	</div>
																	<p className="text-xs text-pink-100/70 mb-3">Redeemable at partner medical stores.</p>
																	<div className="flex items-center justify-between gap-2 p-2 rounded bg-black/40 border border-white/10 mb-3">
																		<span className="text-sm font-mono font-bold text-blue-300 tracking-wider uppercase">{coupon.code}</span>
																		<button
																			onClick={() => {
																				navigator.clipboard.writeText(coupon.code)
																				alert("Coupon code copied!")
																			}}
																			className="text-[10px] font-black text-white hover:text-blue-300 transition uppercase"
																		>
																			Copy
																		</button>
																	</div>
																	<button
																		onClick={() => handleSelectCoupon(coupon)}
																		className={`w-full py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition ${isSelected
																			? 'bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30'
																			: 'bg-green-500/20 text-green-300 border border-green-500/40 hover:bg-green-500/30'
																			}`}
																	>
																		{isSelected ? '✓ Selected - Click to Deselect' : 'Select for Medicine Purchase'}
																	</button>
																</div>
																<div className="absolute top-1/2 -right-3 h-6 w-6 rounded-full bg-[#131326] border-2 border-blue-500/30 -translate-y-1/2"></div>
																<div className="absolute top-1/2 -left-3 h-6 w-6 rounded-full bg-[#131326] border-2 border-blue-500/30 -translate-y-1/2"></div>
															</div>
														)
													})}
												</div>
											</div>
										) : (
											<div className="text-center py-8 px-4 rounded-xl border border-dashed border-white/10 bg-white/5">
												<p className="text-xs text-pink-100/50">No active coupons. Complete 3 stars to generate your first 20% discount coupon!</p>
											</div>
										)}
									</div>

									{/* Blood Compatibility Guide Reference - Moved to Sidebar */}
									<div className="rounded-2xl border border-[#F6D6E3] bg-[#131326] p-6">
										<p className="text-[10px] uppercase tracking-widest text-[#E91E63] font-black mb-4">Official Reference</p>
										<div className="rounded-xl overflow-hidden border-2 border-[#F6D6E3]/30 bg-[#1A1A2E]">
											<img
												src="/images/blood-compatibility-chart.png"
												alt="Compatibility Chart"
												className="w-full h-auto"
											/>
										</div>
										<p className="mt-4 text-xs text-pink-100/60 leading-relaxed">
											* Medically verified compatibility chart for simplified donor-recipient matching.
										</p>
									</div>
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
			</main >

			{showEligibilityPopup && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
					<div className="w-full max-w-md rounded-2xl border border-[#F6D6E3]/20 bg-[#131326] p-6 shadow-2xl">
						<div className="mb-4 flex items-center gap-3 text-rose-400">
							<svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
							</svg>
							<h3 className="text-lg font-bold text-white">Action Required</h3>
						</div>
						<p className="mb-6 text-sm leading-relaxed text-pink-100/80">
							{eligibilityMessage}
						</p>
						<button
							onClick={() => setShowEligibilityPopup(false)}
							className="w-full rounded-lg bg-[#E91E63] py-2.5 text-sm font-semibold text-white transition hover:bg-[#D81B60]"
						>
							Understood
						</button>
					</div>
				</div>
			)
			}

		</>
	)
}

