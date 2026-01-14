import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { apiFetch } from "../../lib/api"

const UPCOMING_EVENTS = [
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
]

const DONATION_HISTORY_PLACEHOLDER = []
const PLATELET_HISTORY_PLACEHOLDER = []
const DONOR_PROFILE_STORAGE_KEY = "lifesaver:donor_profile"
const DONATION_REQUESTS_STORAGE_KEY = "lifesaver:donation_requests"

const ORGAN_OPTIONS = [
	{ id: "HEART", label: "Heart" },
	{ id: "LUNGS", label: "Lungs" },
	{ id: "KIDNEYS", label: "Kidneys" },
	{ id: "LIVER", label: "Liver" },
	{ id: "PANCREAS", label: "Pancreas" },
	{ id: "INTESTINE", label: "Intestine" },
	{ id: "TISSUE", label: "Tissue" },
	{ id: "ALL", label: "All Organs" },
]

const RELATION_OPTIONS = [
	{ id: "SPOUSE", label: "Spouse" },
	{ id: "CHILD", label: "Child" },
	{ id: "PARENT", label: "Parent" },
	{ id: "SIBLING", label: "Sibling" },
	{ id: "OTHER", label: "Other Relative" },
	{ id: "FRIEND", label: "Friend" },
]

function formatName(user) {
	if (!user) return ""
	const parts = [user.first_name, user.last_name].filter(Boolean)
	if (parts.length) return parts.join(" ")
	return user.username || ""
}

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

export default function DonorDashboard() {
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
	const [accidentAlerts, setAccidentAlerts] = useState([])
	const [loadingEmergencies, setLoadingEmergencies] = useState(true)
	
	// Organ Registry State
	const [organTab, setOrganTab] = useState("pledge")
	const [organPledgeStatus, setOrganPledgeStatus] = useState(null)
	const [isEditingOrgan, setIsEditingOrgan] = useState(false)
	const [organForm, setOrganForm] = useState({
		organs_to_donate: [],
		acknowledgement: false,
		post_mortem_consent: false,
		family_responsibility: false,
		living_kidney_donation: false,
		medical_student_donation: false,
		health_certificate: null,
		selected_hospitals: [],
		date_of_birth: "",
		blood_group: "",
		phone: "",
		address: "",
		emergency_contact_name: "",
		emergency_contact_phone: "",
		emergency_contact_relation: "",
	})
	const [isSubmittingOrgan, setIsSubmittingOrgan] = useState(false)
	const [organFeedback, setOrganFeedback] = useState(null)
	const [hospitals, setHospitals] = useState([])
	const [loadingHospitals, setLoadingHospitals] = useState(false)
	const [deceasedForm, setDeceasedForm] = useState({
		requester_name: "",
		requester_phone: "",
		requester_email: "",
		requester_relation: "",
		requester_address: "",
		deceased_name: "",
		deceased_date_of_birth: "",
		deceased_date_of_death: "",
		deceased_blood_group: "",
		deceased_city: "",
		deceased_address: "",
		organs_available: [],
		medical_student_donation: false,
		hospital_name: "",
		doctor_name: "",
		notes: "",
		selected_hospitals: [],
	})
	const [isSubmittingDeceased, setIsSubmittingDeceased] = useState(false)
	const [urgentOrganNeeds, setUrgentOrganNeeds] = useState([])
	const [userLocation, setUserLocation] = useState(null)
	const SHOW_ORGAN_SECTION = false

	// Simple "AI-style" image validation state for the three quick donation boxes
	const [cardImages, setCardImages] = useState({
		blood: { src: null, message: "" },
		organ: { src: null, message: "" },
		platelets: { src: null, message: "" },
	})
	const bloodImageInputRef = useRef(null)
	const organImageInputRef = useRef(null)
	const plateletsImageInputRef = useRef(null)

	useEffect(() => {
		if (typeof window === "undefined") return
		const stored = window.localStorage.getItem(DONOR_PROFILE_STORAGE_KEY)
		if (!stored) return
		try {
			setLocalProfile(JSON.parse(stored))
		} catch (error) {
			console.warn("Unable to read stored donor profile", error)
			window.localStorage.removeItem(DONOR_PROFILE_STORAGE_KEY)
		}
	}, [])

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

	const fetchDashboard = useCallback(
		async (showLoader = true) => {
			if (showLoader) {
				setLoading(true)
			}
			try {
				const data = await apiFetch("/donors/dashboard/")
				setDashboard(data)
				setDonorProfile(data?.donor ?? null)
				setLocalProfile(data?.donor ?? null)
				if (data?.donor && typeof window !== "undefined") {
					window.localStorage.setItem(DONOR_PROFILE_STORAGE_KEY, JSON.stringify(data.donor))
				}
				setErrorState(null)
			} catch (err) {
				if (err.status === 404) {
					try {
						const profileResult = await loadDonorProfile()
						if (profileResult.status === "not_found") {
							setErrorState({ type: "profile-missing" })
						} else {
							setErrorState(null)
						}
					} catch (profileErr) {
						setDonorProfile(null)
						if (typeof window !== "undefined") {
							window.localStorage.removeItem(DONOR_PROFILE_STORAGE_KEY)
						}
						setErrorState({ type: "general", message: profileErr.message || "Unable to load donor profile." })
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
				if (showLoader) {
					setLoading(false)
				}
			}
		},
		[loadDonorProfile],
	)

	useEffect(() => {
		fetchDashboard()
		loadDonationRequests()
		loadOrganRegistryData()
		loadEmergencies()
	}, [fetchDashboard])

	// Load user location
	useEffect(() => {
		if (navigator.geolocation) {
			navigator.geolocation.getCurrentPosition(
				(position) => {
					setUserLocation({
						latitude: position.coords.latitude,
						longitude: position.coords.longitude,
					})
				},
				() => {}
			)
		}
	}, [])

	async function loadDonationRequests() {
		try {
			// Try to fetch from API
			const requests = await apiFetch("/donation-requests/?donor=me")
			// Filter out City General Hospital accepted requests
			const filtered = requests.filter((request) => {
				const hospital = request.hospital || {}
				const hospitalName = hospital.name || ""
				// Remove if it's City General Hospital and status is ACCEPTED
				if (hospitalName.toLowerCase().includes("city general hospital") && request.status === "ACCEPTED") {
					return false
				}
				return true
			})
			setDonationRequests(filtered)
			
			// Also sync to localStorage
			if (typeof window !== "undefined") {
				localStorage.setItem(DONATION_REQUESTS_STORAGE_KEY, JSON.stringify(filtered))
			}
		} catch (error) {
			// Fallback to localStorage
			if (typeof window !== "undefined") {
				const stored = localStorage.getItem(DONATION_REQUESTS_STORAGE_KEY)
				if (stored) {
					try {
						const requests = JSON.parse(stored)
						// Filter out City General Hospital accepted requests
						const filtered = requests.filter((request) => {
							const hospital = request.hospital || {}
							const hospitalName = hospital.name || ""
							// Remove if it's City General Hospital and status is ACCEPTED
							if (hospitalName.toLowerCase().includes("city general hospital") && request.status === "ACCEPTED") {
								return false
							}
							return true
						})
						setDonationRequests(filtered)
					} catch (e) {
						setDonationRequests([])
					}
				}
			}
		}
	}
	
	async function loadEmergencies() {
		setLoadingEmergencies(true)
		try {
			const needs = await apiFetch("/needs/?status=OPEN")
			setEmergencyNeeds(Array.isArray(needs) ? needs.slice(0, 5) : [])
		} catch {
			setEmergencyNeeds([])
		}

		try {
			const alerts = await apiFetch("/accident-alerts/?status=ACTIVE")
			setAccidentAlerts(Array.isArray(alerts) ? alerts.slice(0, 5) : [])
		} catch {
			setAccidentAlerts([])
		} finally {
			setLoadingEmergencies(false)
		}
	}
	
	// Refresh requests when page becomes visible (when user comes back from hospital page)
	useEffect(() => {
		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible") {
				loadDonationRequests()
			}
		}
		document.addEventListener("visibilitychange", handleVisibilityChange)
		return () => {
			document.removeEventListener("visibilitychange", handleVisibilityChange)
		}
	}, [])
	
	// Also refresh on focus
	useEffect(() => {
		const handleFocus = () => {
			loadDonationRequests()
		}
		window.addEventListener("focus", handleFocus)
		return () => {
			window.removeEventListener("focus", handleFocus)
		}
	}, [])

	const donor = donorProfile || dashboard?.donor || localProfile || null
	const compatibility = dashboard?.compatibility ?? null
	const recommendedNeeds = dashboard?.recommended_needs ?? []
	const donorName = formatName(donor?.user)

	const donorLocation = useMemo(() => {
		if (!donor) return ""
		return [donor.city, donor.zip_code].filter(Boolean).join(", ")
	}, [donor])

	const nextEligibleDate = calculateNextEligibleDate(donor?.last_donated_on)
	const availabilityLabel = donor?.is_available ? "Available for Alerts" : "Unavailable Right Now"
	const availabilitySubtext = donor?.is_available
		? "We’ll notify you the moment there’s a compatible match."
		: "Switch availability back on to receive urgent notifications."
	const lastDonationDisplay = donor?.last_donated_on
		? (() => {
				const parsed = new Date(donor.last_donated_on)
				if (Number.isNaN(parsed.getTime())) {
					return donor.last_donated_on
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

	// Derive simple performance percentages from actual data
	const bloodDonationPercent = useMemo(() => {
		if (!donationRequests.length) return 0
		const successful = donationRequests.filter((r) => r.status === "ACCEPTED" || r.status === "COMPLETED").length
		return Math.round((successful / donationRequests.length) * 100)
	}, [donationRequests])

	const organDonationPercent = useMemo(() => {
		// If the donor has an organ pledge profile, consider this module at 100%
		return organPledgeStatus ? 100 : 0
	}, [organPledgeStatus])

	const plateletDonationPercent = useMemo(() => {
		// Use platelet donor flag as a simple indicator of platelet donation readiness
		if (!donor) return 0
		return donor.is_platelet_donor ? 100 : 0
	}, [donor])

	const quickStatusItems = useMemo(
		() => [
			{ title: "Blood Donation Status", filled: bloodDonationPercent, color: "#E91E63", href: "/donor/blood" },
			{ title: "Organ Donation Status", filled: organDonationPercent, color: "#8B5CF6", href: "/donor/organ" },
			{ title: "Platelet Donation Status", filled: plateletDonationPercent, color: "#22C55E", href: "/donor/platelets" },
		],
		[bloodDonationPercent, organDonationPercent, plateletDonationPercent],
	)

	function handleCardImageChange(event, cardKey) {
		const file = event.target.files?.[0]
		if (!file) return

		const name = file.name.toLowerCase()
		let expectedKeywords = []
		let topicLabel = ""

		if (cardKey === "blood") {
			expectedKeywords = ["blood", "donation", "donor"]
			topicLabel = "Blood Donation"
		} else if (cardKey === "organ") {
			expectedKeywords = ["organ", "heart", "kidney", "liver", "lungs"]
			topicLabel = "Organ Donation"
		} else if (cardKey === "platelets") {
			expectedKeywords = ["platelet", "apheresis"]
			topicLabel = "Platelet Donation"
		}

		const matches = expectedKeywords.some((kw) => name.includes(kw))

		const previewUrl = URL.createObjectURL(file)
		setCardImages((prev) => ({
			...prev,
			[cardKey]: {
				src: previewUrl,
				message: matches
					? `${topicLabel} image verified.`
					: `Image added, but its name does not clearly match ${topicLabel}. For report purposes, try to use an image clearly related to this topic.`,
			},
		}))
	}

	async function handleAvailabilityToggle() {
		if (!donor) return
		setAvailabilityError(null)
		setAvailabilitySaving(true)
		try {
			await apiFetch("/donors/me/", {
				method: "PATCH",
				body: JSON.stringify({ is_available: !donor.is_available }),
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

	// Organ Registry Functions
	async function loadOrganRegistryData() {
		try {
			// Load organ donor profile
			try {
				const profile = await apiFetch("/organ-donors/me/")
				if (profile) {
					setOrganPledgeStatus(profile)
					setOrganForm({
						organs_to_donate: profile.organs ? profile.organs.split(",") : [],
						acknowledgement: profile.consent_provided || false,
						post_mortem_consent: profile.post_mortem_consent || false,
						family_responsibility: profile.family_responsibility || false,
						living_kidney_donation: profile.living_kidney_donation || false,
						medical_student_donation: profile.medical_student_donation || false,
						selected_hospitals: profile.selected_hospitals?.map(h => h.id) || [],
						date_of_birth: profile.date_of_birth || "",
						blood_group: profile.blood_group || "",
						phone: profile.phone || "",
						address: profile.address || "",
						emergency_contact_name: profile.emergency_contact_name || "",
						emergency_contact_phone: profile.emergency_contact_phone || "",
						emergency_contact_relation: profile.emergency_contact_relation || "",
					})
				}
			} catch (e) {
				setOrganPledgeStatus(null)
			}

			// Load hospitals
			setLoadingHospitals(true)
			try {
				const data = await apiFetch("/hospitals/?registered_only=true")
				setHospitals(data.filter(h => h.user !== null && h.user !== undefined))
			} catch (e) {
				setHospitals([])
			} finally {
				setLoadingHospitals(false)
			}

			// Load emergency needs
			try {
				const needs = await apiFetch("/hospital-needs/?need_type=ORGAN&status=URGENT")
				setUrgentOrganNeeds(needs.slice(0, 5))
			} catch (e) {
				console.error("Failed to load emergency needs:", e)
			}

			// Load accident alerts
			try {
				const params = new URLSearchParams()
				if (userLocation) {
					params.append("latitude", userLocation.latitude)
					params.append("longitude", userLocation.longitude)
				}
				params.append("status", "ACTIVE")
				const alerts = await apiFetch(`/accident-alerts/?${params.toString()}`)
				setAccidentAlerts(alerts.slice(0, 5))
			} catch (e) {
				console.error("Failed to load accident alerts:", e)
			}
		} catch (error) {
			console.error("Failed to load organ registry data:", error)
		}
	}

	useEffect(() => {
		if (userLocation) {
			// Reload accident alerts with location
			async function reloadAlerts() {
				try {
					const params = new URLSearchParams()
					params.append("latitude", userLocation.latitude)
					params.append("longitude", userLocation.longitude)
					params.append("status", "ACTIVE")
					const alerts = await apiFetch(`/accident-alerts/?${params.toString()}`)
					setAccidentAlerts(alerts.slice(0, 5))
				} catch (e) {
					console.error("Failed to load accident alerts:", e)
				}
			}
			reloadAlerts()
		}
	}, [userLocation])

	const selectedOrgansSet = useMemo(() => new Set(organForm.organs_to_donate), [organForm.organs_to_donate])

	function toggleOrgan(organId) {
		setOrganForm((prev) => {
			const next = new Set(prev.organs_to_donate)
			if (next.has(organId)) {
				next.delete(organId)
			} else {
				if (organId === "ALL") {
					return { ...prev, organs_to_donate: ["ALL"] }
				}
				next.delete("ALL")
				next.add(organId)
			}
			return { ...prev, organs_to_donate: Array.from(next) }
		})
	}

	async function handleOrganPledgeSubmit(event) {
		event.preventDefault()
		setOrganFeedback(null)
		
		if (!organForm.post_mortem_consent || !organForm.acknowledgement) {
			setOrganFeedback({
				type: "error",
				message: "Please accept the post-mortem consent and general acknowledgement to proceed.",
			})
			return
		}

		if (organForm.organs_to_donate.length === 0) {
			setOrganFeedback({
				type: "error",
				message: "Please select at least one organ to donate.",
			})
			return
		}

		setIsSubmittingOrgan(true)
		try {
			const formData = {
				organs: organForm.organs_to_donate.join(","),
				consent_provided: organForm.acknowledgement,
				post_mortem_consent: organForm.post_mortem_consent,
				family_responsibility: organForm.family_responsibility,
				living_kidney_donation: organForm.living_kidney_donation,
				medical_student_donation: organForm.medical_student_donation,
				selected_hospital_ids: organForm.selected_hospitals,
				date_of_birth: organForm.date_of_birth || null,
				blood_group: organForm.blood_group || "",
				phone: organForm.phone || "",
				address: organForm.address || "",
				emergency_contact_name: organForm.emergency_contact_name || "",
				emergency_contact_phone: organForm.emergency_contact_phone || "",
				emergency_contact_relation: organForm.emergency_contact_relation || "",
			}

			const response = await apiFetch("/organ-donors/me/", {
				method: organPledgeStatus ? "PATCH" : "PUT",
				body: JSON.stringify(formData),
			})

			setOrganPledgeStatus(response)
			setIsEditingOrgan(false)
			setOrganFeedback({
				type: "success",
				message: "Pledge Registered! Thank you for giving the Gift of Life.",
			})
		} catch (error) {
			setOrganFeedback({
				type: "error",
				message: error.message || "Registration failed. Please try again.",
			})
		} finally {
			setIsSubmittingOrgan(false)
		}
	}

	async function handleDeceasedSubmit(event) {
		event.preventDefault()
		setOrganFeedback(null)

		if (!deceasedForm.requester_name || !deceasedForm.deceased_name || !deceasedForm.deceased_date_of_death) {
			setOrganFeedback({
				type: "error",
				message: "Please fill in all required fields.",
			})
			return
		}

		setIsSubmittingDeceased(true)
		try {
			const formData = {
				...deceasedForm,
				organs_available: deceasedForm.organs_available.join(","),
				selected_hospital_ids: deceasedForm.selected_hospitals,
			}

			await apiFetch("/deceased-donor-requests/", {
				method: "POST",
				body: JSON.stringify(formData),
			})

			setDeceasedForm({
				requester_name: "",
				requester_phone: "",
				requester_email: "",
				requester_relation: "",
				requester_address: "",
				deceased_name: "",
				deceased_date_of_birth: "",
				deceased_date_of_death: "",
				deceased_blood_group: "",
				deceased_city: "",
				deceased_address: "",
				organs_available: [],
				medical_student_donation: false,
				hospital_name: "",
				doctor_name: "",
				notes: "",
				selected_hospitals: [],
			})
			setOrganFeedback({
				type: "success",
				message: "Request submitted successfully! We will process it and contact you soon.",
			})
		} catch (error) {
			setOrganFeedback({
				type: "error",
				message: error.message || "Failed to submit request. Please try again.",
			})
		} finally {
			setIsSubmittingDeceased(false)
		}
	}

	const pledgeOrgansDisplay = useMemo(() => {
		if (!organPledgeStatus?.organs) return "Not recorded"
		const organs = organPledgeStatus.organs.split(",")
		if (organs.includes("ALL")) return "All Organs"
		return organs.map(org => ORGAN_OPTIONS.find(o => o.id === org)?.label || org).join(", ")
	}, [organPledgeStatus])

	const handleLogout = useCallback(() => {
		if (typeof window !== "undefined") {
			window.localStorage.removeItem(DONOR_PROFILE_STORAGE_KEY)
			window.localStorage.removeItem("accessToken")
			window.localStorage.removeItem("refreshToken")
		}
		setDashboard(null)
		setDonorProfile(null)
		setLocalProfile(null)
		setErrorState(null)
		router.push("/")
	}, [router])

	return (
		<>
			<Head>
				<title>Donor Hub — LifeSaver Connect</title>
				<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@700;800&display=swap" rel="stylesheet" />
			</Head>
			<main className="min-h-screen bg-[#1A1A2E] text-white">
				<header className="border-b border-[#F6D6E3]/30 bg-[#131326]/80 backdrop-blur">
					<div className="mx-auto flex flex-col gap-3 md:flex-row md:items-center md:justify-between max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
						<div>
							<h1 className="text-3xl md:text-4xl font-extrabold" style={{ fontFamily: "'Poppins', sans-serif" }}>
								Donor Hub
							</h1>
							{donorName ? (
								<p className="mt-1 text-sm text-pink-100/80">
									Welcome back, <span className="font-semibold text-white">{donorName}</span>. Continue being the lifeline your community
									relies on.
								</p>
							) : (
								<p className="mt-1 text-sm text-pink-100/80">
									Track your impact, manage availability, and respond to critical requests.
								</p>
							)}
						</div>
						<div className="flex flex-wrap gap-2">
							<button
								type="button"
								onClick={handleLogout}
								className="rounded-lg border border-slate-500 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/5"
							>
								Log Out
							</button>
							<Link href="/needs/post" legacyBehavior>
								<a className="rounded-lg border border-[#F6D6E3] px-4 py-2 text-sm font-medium text-pink-100 hover:bg-white/5 transition">
									View Emergency Requests
								</a>
							</Link>
							<Link href="/donor/donate" legacyBehavior>
								<a className="rounded-lg bg-[#E91E63] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition">
									Donate Now
								</a>
							</Link>
							<Link href="/register/donor" legacyBehavior>
								<a className="rounded-lg bg-[#E91E63] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition">
									Update Donor Profile
								</a>
							</Link>
						</div>
					</div>

				</header>

				<section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 space-y-10">
					{/* Quick selection boxes for donation types */}
					<div className="grid gap-6 md:grid-cols-3">
						{/* Blood Donation Box */}
						<div className="space-y-3">
							<Link href="/donor/blood" legacyBehavior>
								<a className="group block rounded-2xl border border-[#F6D6E3]/40 bg-[#131326] p-5 transition hover:border-[#E91E63] hover:shadow-[0_10px_25px_rgba(233,30,99,0.2)]">
									<div className="flex items-center justify-between">
										<h3 className="text-lg font-semibold text-white">Blood Donation</h3>
										<span className="rounded-full bg-[#E91E63]/15 px-3 py-1 text-xs font-semibold text-[#E91E63]">Start</span>
									</div>
									<p className="mt-2 text-sm text-pink-100/70">Check eligibility, manage availability, and book a slot.</p>
									<div className="mt-4 flex flex-wrap gap-2 text-xs text-pink-100/70">
										<span className="rounded border border-[#E91E63]/30 px-2 py-1">Eligibility & checklist</span>
										<span className="rounded border border-[#E91E63]/30 px-2 py-1">Profile & availability</span>
										<span className="rounded border border-[#E91E63]/30 px-2 py-1">Hospital selection</span>
									</div>
								</a>
							</Link>
							{/* File Input Below Box */}
							<div className="space-y-2">
								<input
									ref={bloodImageInputRef}
									type="file"
									accept="image/*"
									className="hidden"
									onChange={(e) => handleCardImageChange(e, "blood")}
								/>
								<button
									type="button"
									onClick={(e) => {
										e.preventDefault()
										bloodImageInputRef.current?.click()
									}}
									className="w-full rounded-lg border border-[#F6D6E3]/40 bg-[#131326] px-4 py-2 text-sm font-medium text-pink-100 hover:bg-white/5 transition hover:border-[#E91E63]"
								>
									📷 Choose Image for Blood Donation
								</button>
								{cardImages.blood.message && (
									<p className={`text-xs ${cardImages.blood.src ? "text-green-400" : "text-red-400"}`}>
										{cardImages.blood.message}
									</p>
								)}
								{cardImages.blood.src && (
									<div className="rounded-lg border border-[#F6D6E3]/30 overflow-hidden">
										<img
											src={cardImages.blood.src}
											alt="Blood donation"
											className="w-full h-32 object-cover"
										/>
									</div>
								)}
							</div>
						</div>

						{/* Organ Donation Box */}
						<div className="space-y-3">
							<Link href="/donor/organ" legacyBehavior>
								<a className="group block rounded-2xl border border-[#F6D6E3]/40 bg-[#131326] p-5 transition hover:border-[#E91E63] hover:shadow-[0_10px_25px_rgba(233,30,99,0.2)]">
									<div className="flex items-center justify-between">
										<h3 className="text-lg font-semibold text-white">Organ Donation</h3>
										<span className="rounded-full bg-[#E91E63]/15 px-3 py-1 text-xs font-semibold text-[#E91E63]">Start</span>
									</div>
									<p className="mt-2 text-sm text-pink-100/70">Pledge flow, family consent, and hospital/center selection.</p>
									<div className="mt-4 flex flex-wrap gap-2 text-xs text-pink-100/70">
										<span className="rounded border border-[#E91E63]/30 px-2 py-1">Pledge organs</span>
										<span className="rounded border border-[#E91E63]/30 px-2 py-1">Family & emergency contact</span>
										<span className="rounded border border-[#E91E63]/30 px-2 py-1">Registered centers</span>
									</div>
								</a>
							</Link>
							{/* File Input Below Box */}
							<div className="space-y-2">
								<input
									ref={organImageInputRef}
									type="file"
									accept="image/*"
									className="hidden"
									onChange={(e) => handleCardImageChange(e, "organ")}
								/>
								<button
									type="button"
									onClick={(e) => {
										e.preventDefault()
										organImageInputRef.current?.click()
									}}
									className="w-full rounded-lg border border-[#F6D6E3]/40 bg-[#131326] px-4 py-2 text-sm font-medium text-pink-100 hover:bg-white/5 transition hover:border-[#E91E63]"
								>
									📷 Choose Image for Organ Donation
								</button>
								{cardImages.organ.message && (
									<p className={`text-xs ${cardImages.organ.src ? "text-green-400" : "text-red-400"}`}>
										{cardImages.organ.message}
									</p>
								)}
								{cardImages.organ.src && (
									<div className="rounded-lg border border-[#F6D6E3]/30 overflow-hidden">
										<img
											src={cardImages.organ.src}
											alt="Organ donation"
											className="w-full h-32 object-cover"
										/>
									</div>
								)}
							</div>
						</div>

						{/* Platelet Donation Box */}
						<div className="space-y-3">
							<Link href="/donor/platelets" legacyBehavior>
								<a className="group block rounded-2xl border border-[#F6D6E3]/40 bg-[#131326] p-5 transition hover:border-[#E91E63] hover:shadow-[0_10px_25px_rgba(233,30,99,0.2)]">
									<div className="flex items-center justify-between">
										<h3 className="text-lg font-semibold text-white">Platelet Donation</h3>
										<span className="rounded-full bg-[#E91E63]/15 px-3 py-1 text-xs font-semibold text-[#E91E63]">Start</span>
									</div>
									<p className="mt-2 text-sm text-pink-100/70">Review apheresis eligibility and choose a center.</p>
									<div className="mt-4 flex flex-wrap gap-2 text-xs text-pink-100/70">
										<span className="rounded border border-[#E91E63]/30 px-2 py-1">Apheresis readiness</span>
										<span className="rounded border border-[#E91E63]/30 px-2 py-1">Matched platelet needs</span>
										<span className="rounded border border-[#E91E63]/30 px-2 py-1">Hospital/center selection</span>
									</div>
								</a>
							</Link>
							{/* File Input Below Box */}
							<div className="space-y-2">
								<input
									ref={plateletsImageInputRef}
									type="file"
									accept="image/*"
									className="hidden"
									onChange={(e) => handleCardImageChange(e, "platelets")}
								/>
								<button
									type="button"
									onClick={(e) => {
										e.preventDefault()
										plateletsImageInputRef.current?.click()
									}}
									className="w-full rounded-lg border border-[#F6D6E3]/40 bg-[#131326] px-4 py-2 text-sm font-medium text-pink-100 hover:bg-white/5 transition hover:border-[#E91E63]"
								>
									📷 Choose Image for Platelet Donation
								</button>
								{cardImages.platelets.message && (
									<p className={`text-xs ${cardImages.platelets.src ? "text-green-400" : "text-red-400"}`}>
										{cardImages.platelets.message}
									</p>
								)}
								{cardImages.platelets.src && (
									<div className="rounded-lg border border-[#F6D6E3]/30 overflow-hidden">
										<img
											src={cardImages.platelets.src}
											alt="Platelet donation"
											className="w-full h-32 object-cover"
										/>
									</div>
								)}
							</div>
						</div>
					</div>

					{/* Quick status pies */}
					<div className="grid gap-4 md:grid-cols-3">
						{quickStatusItems.map((item) => (
							<Link key={item.title} href={item.href} legacyBehavior>
								<a className="rounded-2xl border border-[#F6D6E3]/30 bg-[#131326] p-4 transition hover:border-[#E91E63]/60 hover:shadow-[0_10px_25px_rgba(233,30,99,0.15)]">
									<div className="flex items-center gap-4">
										<div
											className="h-16 w-16 rounded-full border border-[#F6D6E3]/30"
											style={{
												backgroundImage: `conic-gradient(${item.color} ${item.filled}%, rgba(255,255,255,0.08) ${item.filled}% 100%)`,
											}}
										>
											<div className="flex h-full w-full items-center justify-center text-sm font-semibold text-white">
												{item.filled}%
											</div>
										</div>
										<div className="flex-1">
											<p className="text-sm font-semibold text-white">{item.title}</p>
											<p className="text-xs text-pink-100/70">Click to view details and update.</p>
										</div>
									</div>
								</a>
							</Link>
						))}
					</div>

					{loading ? (
						<div className="rounded-2xl border border-dashed border-[#F6D6E3]/40 bg-[#131326] p-6 text-sm text-pink-100/70">
							Loading your donor dashboard…
						</div>
					) : (
						<>
							{errorState?.type === "profile-missing" && (
								<div className="rounded-2xl border border-[#4e7fff]/40 bg-[#102040] p-8 text-sm text-[#d7dcff]">
									<h2 className="text-xl font-semibold text-white">Complete your donor profile</h2>
									<p className="mt-2">
										We couldn’t find your donor details yet. Finish the quick registration so we can match you with patients who need your
										blood group.
									</p>
									<Link href="/register/donor" legacyBehavior>
										<a className="mt-4 inline-flex rounded-lg bg-[#4e7fff] px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90">
											Start Donor Registration
										</a>
									</Link>
								</div>
							)}
						</>
					)}
				</section>

				<footer className="border-t border-[#F6D6E3]/30 bg-[#131326]">
					<div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 text-sm text-pink-100/80">
						Need to change your availability?{" "}
						<Link href="/register/donor" legacyBehavior>
							<a className="text-[#E91E63] underline">Update your donor settings</a>
						</Link>
						{" "}or{" "}
						<Link href="/needs" legacyBehavior>
							<a className="text-[#4e7fff] underline">review current emergency requests</a>
						</Link>
					</div>
				</footer>
			</main>
		</>
	)
}

