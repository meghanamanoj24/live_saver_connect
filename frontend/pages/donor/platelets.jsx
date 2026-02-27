import Head from "next/head"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { apiFetch } from "../../lib/api"

const DONATION_HISTORY_PLACEHOLDER = []
const DONOR_PROFILE_STORAGE_KEY = "lifesaver:donor_profile"
const HEALTH_REPORT_STORAGE_KEY_PLATELETS = "lifesaver:health_report_uploaded_platelets"
const HEALTH_REPORT_FILENAME_KEY_PLATELETS = "lifesaver:health_report_filename_platelets"
const LAST_RESET_REQUEST_ID_KEY = "lifesaver:last_reset_request_id_platelets"

// Platelet Compatibility Logic (Patient Group -> Donor Groups that patient can receive from)
// Consistent with backend utils_email.py
const PLATELET_RECEIVE_COMPATIBILITY = {
	"O-": ["O-", "O+"],
	"O+": ["O-", "O+"],
	"A-": ["A-", "A+", "O-", "O+", "AB-", "AB+"],
	"A+": ["A-", "A+", "O-", "O+", "AB-", "AB+"],
	"B-": ["B-", "B+", "O-", "O+", "AB-", "AB+"],
	"B+": ["B-", "B+", "O-", "O+", "AB-", "AB+"],
	"AB-": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
	"AB+": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
}

// Helper to check if a donor's blood group is compatible with a patient's required group for platelets
function isPlateletCompatible(donor_bg, patient_bg) {
	if (!patient_bg || patient_bg === "Any" || patient_bg === "Unknown") return true
	if (!donor_bg) return false
	const compatibleDonors = PLATELET_RECEIVE_COMPATIBILITY[patient_bg] || []
	return compatibleDonors.includes(donor_bg)
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
	const [rawNeeds, setRawNeeds] = useState([])
	const [activeTab, setActiveTab] = useState("matches")
	const [donationRequests, setDonationRequests] = useState([])
	const [loadingRequests, setLoadingRequests] = useState(true)
	const [coupons, setCoupons] = useState([])
	const [loadingCoupons, setLoadingCoupons] = useState(true)
	const [downloadHistory, setDownloadHistory] = useState([])

	// Health Verification State
	const [healthReportUploaded, setHealthReportUploaded] = useState(false)
	const [healthReportFile, setHealthReportFile] = useState(null)
	const [uploadError, setUploadError] = useState(null)
	const [healthEligible, setHealthEligible] = useState(false)
	const [showEligibilityPopup, setShowEligibilityPopup] = useState(false)
	const [eligibilityMessage, setEligibilityMessage] = useState("")
	const [confirmingAttendance, setConfirmingAttendance] = useState(null)
	const [updatingWorkflow, setUpdatingWorkflow] = useState(null)

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

	const loadDownloadHistory = useCallback(async () => {
		try {
			const data = await apiFetch("/donors/download_history/?report_type=PLATELETS")
			setDownloadHistory(data)
		} catch (err) {
			console.error("Failed to load download history:", err)
		}
	}, [])

	const verifiedPdfUrl = useMemo(() => {
		if (!downloadHistory || downloadHistory.length === 0) return null
		return downloadHistory[0].pdf_file
	}, [downloadHistory])

	useEffect(() => {
		loadDonationRequests()
		loadCoupons()
		loadDownloadHistory()

		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible") {
				loadDonationRequests()
				loadCoupons()
				loadDownloadHistory()
			}
		}
		document.addEventListener("visibilitychange", handleVisibilityChange)

		const handleFocus = () => {
			loadDonationRequests()
			loadDownloadHistory()
		}
		window.addEventListener("focus", handleFocus)

		return () => {
			document.removeEventListener("visibilitychange", handleVisibilityChange)
			window.removeEventListener("focus", handleFocus)
		}
	}, [loadDonationRequests, loadDownloadHistory])

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

		try {
			const blob = await apiFetch('/donors/generate_health_report/', {
				method: 'POST',
				responseAs: 'blob',
				body: JSON.stringify({
					...healthAssessment,
					age: healthStatus.age,
					weight: healthStatus.weight,
					report_type: "PLATELETS"
				})
			});
			const url = window.URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;

			const name = donorName?.replace(/\s+/g, '_') || 'Donor';
			const dateStr = new Date().toISOString().split('T')[0];
			link.setAttribute('download', `Platelet_Health_Report_${name}_${dateStr}.pdf`);

			document.body.appendChild(link);
			link.click();
			link.parentNode.removeChild(link);
			window.URL.revokeObjectURL(url);

			loadDownloadHistory()
			alert("Health report generated successfully! This report is SECURED and can now be verified.");
		} catch (err) {
			console.error("PDF Error:", err);
			alert(err.message || "Error generating secure report. Please try again.");
		}
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
			const donor_blood_group = profile?.blood_group || localProfile?.blood_group || ""
			const city = profile?.city || localProfile?.city || ""

			// Use Promise.allSettled so one failure doesn't kill the entire fetch
			const results = await Promise.allSettled([
				apiFetch("/needs/?need_type=PLATELETS&status=OPEN"),
				apiFetch("/hospital-needs/?need_type=PLATELETS&active_only=true"),
				apiFetch("/needs/matched_needs/"),
				apiFetch(`/hospital-needs/?need_type=PLATELETS&donor_blood_group=${donor_blood_group}&city=${city}&active_only=true`)
			])

			// Extract results safely — failed fetches become empty arrays
			const getValue = (result) => {
				if (result.status === "fulfilled") {
					const val = result.value
					// Handle both array responses and paginated { results: [...] } responses
					if (Array.isArray(val)) return val
					if (val && Array.isArray(val.results)) return val.results
					return []
				}
				console.warn("Fetch failed:", result.reason)
				return []
			}

			const allNeeds = getValue(results[0])
			const hospitalAll = getValue(results[1])

			console.log('DEBUG: Raw fetch results', {
				allNeedsRaw: results[0].status === 'fulfilled' ? (Array.isArray(results[0].value) ? results[0].value.length : 'not array') : results[0].reason,
				hospitalAllRaw: results[1].status === 'fulfilled' ? (Array.isArray(results[1].value) ? results[1].value.length : 'not array') : results[1].reason
			})

			const combinedAllRaw = [
				...allNeeds,
				...hospitalAll.map(h => ({ ...h, isHospitalNeed: true }))
			]

			setRawNeeds(combinedAllRaw)
		} catch (error) {
			console.error("Error loading platelet needs:", error)
			setRawNeeds([])
		}
	}, [profile, localProfile])

	// Reactive filtering for Need Hiding and Compatibility
	useEffect(() => {
		const donor_blood_group = profile?.blood_group || localProfile?.blood_group || ""

		const respondedNeedIds = new Set(donationRequests.map(r => {
			const needId = r.is_hospital_request ? r.hospital_need?.id || r.hospital_need : r.emergency_need?.id || r.emergency_need;
			return `${needId}-${r.is_hospital_request ? 'HOSPITAL' : 'EMERGENCY'}`;
		}));

		const filteredNeeds = rawNeeds.filter(need => {
			const key = `${need.id}-${need.isHospitalNeed ? 'HOSPITAL' : 'EMERGENCY'}`;
			return !respondedNeedIds.has(key);
		});

		// Sort by created_at descending (most recent first)
		const combinedAll = [...filteredNeeds].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

		const finalMatches = []
		const finalOthers = []

		combinedAll.forEach(need => {
			const patient_bg = need.required_blood_group
			if (isPlateletCompatible(donor_blood_group, patient_bg)) {
				finalMatches.push(need)
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

		setEmergencyNeeds(dedupe(combinedAll))
		setMatchedNeeds(dedupe(finalMatches))
	}, [rawNeeds, donationRequests, profile, localProfile])


	useEffect(() => {
		async function run() {
			// Only load profile on mount
			setLoading(true)
			try {
				await loadProfile()
			} catch (err) {
				setErrorState({ type: "general", message: err.message || "Unable to load donor profile." })
			}
		}
		run()
	}, [loadProfile])

	// separate effect to load needs when profile changes or is loaded
	useEffect(() => {
		async function fetchNeeds() {
			// If profile is still loading (and not found yet), we might wait, but loadNeeds handles null profile
			try {
				await loadNeeds()
				setErrorState(null)
			} catch (err) {
				console.error(err)
			} finally {
				// We can stop loading now
				setLoading(false)
			}
		}
		fetchNeeds()
	}, [loadNeeds])

	const donor = profile || localProfile || null
	const donorName = donor?.name

	// Calculate compatible groups (deprecated as we use isPlateletCompatible)
	const compatibleGroups = useMemo(() => [], [])

	// Filter matched needs based on compatibility
	const filteredMatchedNeeds = useMemo(() => matchedNeeds, [matchedNeeds])
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
		return donationRequests.some(r => ["PENDING", "ACCEPTED", "SCHEDULED", "SCHEDULE_CONFIRMED", "REACHING", "ARRIVED"].includes(r.status))
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
		// Must have health report uploaded for this cycle and be eligible
		// We allow the button to be enabled even if hasActiveRequest is true,
		// so that users can click it and see the explanation popup.
		return healthReportUploaded && healthEligible
	}, [healthReportUploaded, healthEligible])

	// Load health report upload status and eligibility from localStorage
	useEffect(() => {
		if (typeof window === "undefined") return
		const uploadStatus = localStorage.getItem(HEALTH_REPORT_STORAGE_KEY_PLATELETS)
		if (uploadStatus === "true") {
			setHealthReportUploaded(true)
			setHealthEligible(true)
		}
	}, [])

	// Sync with backend download history
	useEffect(() => {
		// If we already have a confirmed upload in local state/storage, don't potentially overwrite it with empty history
		// unless we explicitly want to re-validate freshness against a NEW request.
		const locallyVerified = localStorage.getItem(HEALTH_REPORT_STORAGE_KEY_PLATELETS) === "true"

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
				// Only overwrite if we aren't locally verified as well (or if we strictly want server history to rule)
				// But for now, if history says "old", but user just uploaded, we might want to keep "true".
				// However, usually "upload" implies verifying a report. 
				// The safeguard: if user JUST uploaded, locallyVerified is true.
				if (!locallyVerified) {
					setHealthReportUploaded(false)
					setHealthEligible(false)
				}
			}
		} else {
			// No history means nothing is uploaded/verified on server records
			// BUT if user just manually uploaded and verified, we trust that.
			if (!locallyVerified) {
				setHealthReportUploaded(false)
				setHealthEligible(false)
			}
		}
	}, [downloadHistory, mostRecentRequest])

	// Reset health report status when donation is COMPLETED or REJECTED (for the cycle loop)
	useEffect(() => {
		if (typeof window === "undefined" || !mostRecentRequest) return

		const lastResetId = localStorage.getItem(LAST_RESET_REQUEST_ID_KEY)

		if (["COMPLETED", "REJECTED", "ACCEPTED"].includes(mostRecentRequest.status) && lastResetId !== String(mostRecentRequest.id)) {
			// Clear the health report for this cycle
			localStorage.removeItem(HEALTH_REPORT_STORAGE_KEY_PLATELETS)
			localStorage.removeItem(HEALTH_REPORT_FILENAME_KEY_PLATELETS)
			localStorage.setItem(LAST_RESET_REQUEST_ID_KEY, String(mostRecentRequest.id))

			setHealthReportUploaded(false)
			setHealthReportFile(null)
			setHealthEligible(false)
			setHealthAssessment(null)
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

	const handleWillingToDonate = async (need) => {
		if (!donor) {
			setErrorState({ type: "general", message: "Please log in to donate." })
			return
		}

		setUpdatingWorkflow(need.id)
		try {
			const body = {
				request_type: "PLATELETS",
				donor: donor.id,
				status: "PENDING",
			}

			if (need.isHospitalNeed) {
				body.hospital_id = need.hospital.id
				body.hospital_need_id = need.id
				body.patient_name = need.patient_name
			} else {
				body.emergency_need_id = need.id
			}

			await apiFetch("/donation-requests/", {
				method: "POST",
				body: JSON.stringify(body),
			})

			await loadDonationRequests()
			alert("Request sent successfully! The poster has been notified.")

			// Redirect to needs/post for emergency needs to allow scheduling/confirmation (Self-Test Flow)
			if (!need.isHospitalNeed) {
				window.location.href = "/needs/post"
			}
		} catch (error) {
			console.error("Failed to send donation request:", error)
			alert(error.message || "Failed to send request.")
		} finally {
			setUpdatingWorkflow(null)
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

	// Handle delete request
	async function handleDeleteRequest(requestId) {
		if (!window.confirm("Are you sure you want to cancel this pending request?")) return

		setUpdatingWorkflow(requestId)
		try {
			await apiFetch(`/donation-requests/${requestId}/`, {
				method: "DELETE"
			})
			await loadDonationRequests()
			alert("Request cancelled successfully.")
		} catch (error) {
			console.error("Error deleting request:", error)
			alert("Failed to cancel request. Please try again.")
		} finally {
			setUpdatingWorkflow(null)
		}
	}

	// Handle health report file upload
	async function handleHealthReportUpload(event) {
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

		try {
			const formData = new FormData()
			formData.append('file', file)

			const response = await apiFetch('/donors/verify_health_report/', {
				method: 'POST',
				body: formData,
			})

			if (response.valid) {
				setHealthReportFile(file)
				setHealthReportUploaded(true)
				setHealthEligible(true)
				localStorage.setItem(HEALTH_REPORT_STORAGE_KEY_PLATELETS, "true")
				localStorage.setItem(HEALTH_REPORT_FILENAME_KEY_PLATELETS, file.name)
				alert(response.detail || "Health report verified successfully! You can now request platelet donations.")
				window.scrollTo({ top: 0, behavior: 'smooth' })
			} else {
				alert(`Verification Failed: ${response.detail}`)
				event.target.value = ""
			}
		} catch (err) {
			console.error("Verification Error:", err)
			alert(err.message || "Error verifying report integrity. Please upload the original PDF you downloaded.")
			event.target.value = ""
		}
	}

	// Calculate stats
	const plateletStats = useMemo(() => {
		const completed = donationRequests.filter(r => r.status === "COMPLETED").length
		const progress = (completed > 0 && completed % 3 === 0) ? 0 : (completed % 3)
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
										<div className="flex-1 flex items-center justify-between gap-4">
											<div>
												<p className="text-sm font-semibold text-green-300">Verified Report</p>
												<p className="text-xs text-green-200/80 mt-0.5">Check another report for next donation</p>
											</div>
											{verifiedPdfUrl && (
												<a
													href={verifiedPdfUrl}
													target="_blank"
													rel="noopener noreferrer"
													className="rounded-lg bg-blue-500 px-4 py-2 text-xs font-bold text-white hover:bg-blue-600 transition shadow-sm uppercase whitespace-nowrap"
												>
													View Verified Report
												</a>
											)}
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
												SCHEDULED: "bg-purple-500/10 text-purple-300 border-purple-500/40",
												SCHEDULE_CONFIRMED: "bg-cyan-500/10 text-cyan-300 border-cyan-500/40",
												REACHING: "bg-orange-500/10 text-orange-300 border-orange-500/40",
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
																	<p className="text-xs text-yellow-200/90 font-medium leading-relaxed mb-3">⌛ Your booking is awaiting confirmation from the medical staff.</p>
																	<button
																		onClick={() => handleDeleteRequest(request.id)}
																		disabled={updatingWorkflow === request.id}
																		className="w-full rounded-lg bg-red-600/10 py-2.5 text-sm font-bold text-red-400 border border-red-600/30 hover:bg-red-600/20 transition uppercase tracking-wider flex items-center justify-center gap-2"
																	>
																		{updatingWorkflow === request.id ? "Processing..." : "Cancel Request 🗑️"}
																	</button>
																</div>
															)}
															{(request.status === "ACCEPTED" || request.status === "SCHEDULED" || request.status === "SCHEDULE_CONFIRMED") && (
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

																	<div className="mt-3 flex flex-col gap-2">
																		{request.status === "SCHEDULED" && (
																			<button
																				onClick={() => handleWorkflowAction(request.id, 'confirm_schedule')}
																				disabled={updatingWorkflow === request.id}
																				className="w-full rounded-lg bg-cyan-600 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-cyan-500 transition uppercase tracking-wider flex items-center justify-center gap-2"
																			>
																				Confirm Schedule ✅
																			</button>
																		)}
																		{request.status === "SCHEDULE_CONFIRMED" && (
																			<button
																				onClick={() => handleWorkflowAction(request.id, 'confirm_reaching')}
																				disabled={updatingWorkflow === request.id}
																				className="w-full rounded-lg bg-orange-600 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-orange-500 transition uppercase tracking-wider flex items-center justify-center gap-2"
																			>
																				I am Reaching 🚗
																			</button>
																		)}
																		{["REACHING", "ACCEPTED", "SCHEDULE_CONFIRMED"].includes(request.status) && (
																			<button
																				type="button"
																				onClick={() => handleConfirmAttendance(request.id)}
																				disabled={confirmingAttendance === request.id || updatingWorkflow === request.id}
																				className="w-full rounded-lg bg-[#E91E63] py-2.5 text-sm font-bold text-white shadow-lg shadow-green-500/20 hover:opacity-90 disabled:opacity-50 transition uppercase tracking-wider flex items-center justify-center gap-2"
																			>
																				{confirmingAttendance === request.id ? "Confirming..." : "I Have Arrived 📍"}
																			</button>
																		)}
																	</div>
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
							{/* Render Needs List */}
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

							{/* Render Content */}
							{(activeTab === "matches" ? matchedNeeds : emergencyNeeds).length === 0 ? (
								<div className="rounded-xl border border-dashed border-[#F6D6E3]/40 bg-[#1A1A2E] p-6 text-sm text-pink-100/70 text-center">
									<p>No {activeTab === "matches" ? "compatible" : "active"} platelet requests found.</p>
								</div>
							) : (
								<div className="space-y-4">
									{(activeTab === "matches" ? matchedNeeds : emergencyNeeds).slice(0, 50).map((need) => {
										// Check if we already have an active request for this need
										const existingRequest = donationRequests.find(r => {
											if (need.isHospitalNeed) {
												// Direct match by hospital_need ID if available
												if (r.hospital_need?.id === need.id) return true;
												// Fallback to hospital ID match for older/generic requests
												return r.hospital?.id === need.hospital?.id && r.request_type === "PLATELETS" && r.status !== "COMPLETED" && r.status !== "REJECTED" && r.status !== "CANCELLED"
											} else {
												return (r.emergency_need?.id === need.id) || (r.emergency_need === need.id)
											}
										})

										const isHospital = !!need.isHospitalNeed
										const location = need.city || (isHospital ? need.hospital?.city : "")
										const isUrgent = need.status === "URGENT"

										return (
											<div key={need.id} className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700/50 hover:border-slate-600 transition flex flex-col md:flex-row gap-4 group relative overflow-hidden">
												{/* Status Bar */}
												<div className={`absolute top-0 left-0 w-1 h-full ${isHospital ? 'bg-purple-500' : 'bg-red-500'}`}></div>

												<div className="flex-1 pl-2">
													<div className="flex items-center gap-2 mb-2 flex-wrap">
														<span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border shadow-sm ${isHospital ? "bg-purple-500/10 text-purple-300 border-purple-500/30" : "bg-red-500/10 text-red-300 border-red-500/30"
															}`}>
															{isHospital ? "🏥 Hospital Request" : "🚨 Public Emergency"}
														</span>
														{isUrgent && (
															<span className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-red-600/20 text-red-400 border border-red-600/30 animate-pulse">
																Urgent
															</span>
														)}
														<span className="text-slate-400 text-xs flex items-center gap-1 ml-auto">
															📍 {location}
														</span>
													</div>

													<h3 className="font-bold text-white text-lg">{need.title || (isHospital ? `${need.need_type} Needed` : "Emergency Request")}</h3>
													<p className="text-slate-300 text-sm mb-3 line-clamp-2">{need.description || need.patient_details || "No additional details provided."}</p>

													<div className="flex flex-wrap gap-2 text-xs">
														<span className="bg-slate-700/50 px-2.5 py-1.5 rounded text-slate-300 border border-white/5">
															Blood Group: <span className="font-bold text-[#E91E63]">{need.required_blood_group || "Any"}</span>
														</span>
														<span className="bg-slate-700/50 px-2.5 py-1.5 rounded text-slate-300 border border-white/5">
															Patient: <span className="font-bold text-white">{need.patient_name || "N/A"}</span>
														</span>
														{need.isHospitalNeed && need.location_details && (
															<span className="bg-slate-700/50 px-2.5 py-1.5 rounded text-slate-300 border border-white/5">
																Place: <span className="font-bold text-white">{need.location_details}</span>
															</span>
														)}
														{need.isHospitalNeed && need.time_to_reach && (
															<span className="bg-slate-700/50 px-2.5 py-1.5 rounded text-slate-300 border border-white/5">
																Time: <span className="font-bold text-red-400">{need.time_to_reach}</span>
															</span>
														)}
														{(need.patient_contact || need.contact_phone) && (
															<span className="bg-slate-700/50 px-2.5 py-1.5 rounded text-slate-300 border border-white/5">
																Contact: <span className="font-bold text-emerald-400">{need.patient_contact || need.contact_phone}</span>
															</span>
														)}
														{need.needed_by && (
															<span className="bg-slate-700/50 px-2.5 py-1.5 rounded text-slate-300 border border-white/5">
																Needed By: <span className="font-bold text-white">
																	{(() => {
																		try {
																			return new Date(need.needed_by).toLocaleDateString()
																		} catch (e) {
																			return "TBD"
																		}
																	})()}
																</span>
															</span>
														)}
													</div>
												</div>

												<div className="flex flex-col justify-center items-end min-w-[150px] border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-4 mt-2 md:mt-0">
													{existingRequest ? (
														<div className="text-center w-full">
															<div className={`w-full px-3 py-1.5 rounded text-xs font-bold mb-3 inline-block text-center uppercase tracking-wide ${existingRequest.status === 'PENDING' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' :
																existingRequest.status === 'ACCEPTED' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
																	['SCHEDULED', 'SCHEDULE_CONFIRMED', 'REACHING', 'ARRIVED'].includes(existingRequest.status) ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
																		'bg-white/5 text-slate-400'
																}`}>
																{existingRequest.status.replace('_', ' ')}
															</div>

															{existingRequest.status === 'ACCEPTED' && (
																<p className="text-[10px] text-slate-400 mb-2 italic">Waiting for schedule...</p>
															)}

															{existingRequest.status === 'SCHEDULED' && (
																<div className="flex flex-col gap-2 w-full">
																	<p className="text-[10px] text-white bg-slate-700 px-2 py-1 rounded text-center">
																		📅 {new Date(existingRequest.scheduled_date).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
																	</p>
																	<div className="flex gap-2">
																		<button
																			onClick={() => handleWorkflowAction(existingRequest.id, 'confirm_schedule')}
																			disabled={updatingWorkflow === existingRequest.id}
																			className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-500 rounded text-xs font-bold text-white transition shadow-lg shadow-green-900/20"
																		>
																			Accept
																		</button>
																		<button
																			onClick={() => handleWorkflowAction(existingRequest.id, 'reject_schedule')}
																			disabled={updatingWorkflow === existingRequest.id}
																			className="flex-1 px-3 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-600/30 text-xs font-bold transition uppercase"
																		>
																			Reject Schedule
																		</button>
																	</div>
																</div>
															)}

															{['SCHEDULE_CONFIRMED', 'REACHING'].includes(existingRequest.status) && (
																<div className="space-y-2 w-full">
																	{existingRequest.status === 'SCHEDULE_CONFIRMED' && (
																		<button
																			onClick={() => handleWorkflowAction(existingRequest.id, 'confirm_reaching')}
																			disabled={updatingWorkflow === existingRequest.id}
																			className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded text-xs font-bold text-white transition shadow-lg shadow-blue-900/20"
																		>
																			I'm Coming 🚗
																		</button>
																	)}
																	<button
																		onClick={() => handleConfirmAttendance(existingRequest.id)}
																		disabled={confirmingAttendance === existingRequest.id || updatingWorkflow === existingRequest.id}
																		className="w-full px-3 py-2 bg-[#E91E63] hover:bg-[#D81B60] rounded text-xs font-bold text-white transition shadow-lg shadow-pink-900/20"
																	>
																		I've Reached 📍
																	</button>
																</div>
															)}
														</div>
													) : (
														<button
															onClick={() => {
																const isEligible = healthEligible && healthReportUploaded;
																if (!isEligible) {
																	alert("Please complete your health assessment and upload your verified report first to verify your eligibility for platelet donation.");
																	return;
																}
																handleWillingToDonate(need);
															}}
															disabled={updatingWorkflow === need.id}
															className="w-full px-4 py-3 bg-white text-[#131326] hover:bg-pink-50 rounded-xl font-bold text-sm shadow-xl shadow-white/5 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group-hover:scale-105"
														>
															{updatingWorkflow === need.id ? (
																<span className="h-4 w-4 border-2 border-slate-600 border-t-transparent rounded-full animate-spin"></span>
															) : (
																<>
																	<span>👋 Willing to Donate</span>
																</>
															)}
														</button>
													)}
												</div>
											</div>
										)
									})}
								</div>
							)}

							{/* Platelet Compatibility + Matched Needs */}
							<div className="grid gap-6 md:grid-cols-2">
								<div className="rounded-2xl border border-[#F6D6E3] bg-[#131326] p-6">
									<h2 className="text-lg font-semibold text-white">Platelet Compatibility</h2>
									<p className="mt-2 text-sm text-pink-100/70">
										Based on your blood group <strong>{donor?.blood_group || "Unknown"}</strong>, you can donate platelets into:
									</p>
									<div className="mt-4 rounded-xl bg-[#E91E63]/10 border border-[#E91E63]/30 p-4">
										<div className="flex flex-wrap gap-2">
											{(donor?.blood_group ? (Object.keys(PLATELET_RECEIVE_COMPATIBILITY).filter(p_bg => PLATELET_RECEIVE_COMPATIBILITY[p_bg].includes(donor.blood_group))) : []).map(group => (
												<span key={group} className="px-3 py-1 rounded-full bg-[#E91E63] text-white text-sm font-bold shadow-md">
													{group}
												</span>
											))}
										</div>
										<p className="mt-3 text-xs text-pink-200/60">
											* Patients with these blood types can receive your platelets safely.
										</p>
									</div>
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

