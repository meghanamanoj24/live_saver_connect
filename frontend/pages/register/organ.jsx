import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import { useEffect, useMemo, useState } from "react"
import { apiFetch } from "../../lib/api"
import { validatePhone, validateDateNotInFuture } from "../../lib/validation"
import { generatePledgeReport as generatePdfDetails } from "../../lib/pdf-generator"

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

const DEFAULT_FORM = {
	organs_to_donate: [],
	acknowledgement: false,
	post_mortem_consent: false,
	family_responsibility: false,
	living_kidney_donation: false,
	medical_student_donation: false,
	selected_hospitals: [],
	date_of_birth: "",
	blood_group: "",
	phone: "",
	address: "",
	emergency_contact_name: "",
	emergency_contact_phone: "",
	emergency_contact_relation: "",
}

const DEFAULT_DECEASED_FORM = {
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
}

export default function OrganRegistry() {
	const router = useRouter()
	const [isAuthenticated, setIsAuthenticated] = useState(false)
	const [isPageLoading, setIsPageLoading] = useState(false)
	const [pledgeStatus, setPledgeStatus] = useState(null)
	const [currentUser, setCurrentUser] = useState(null) // Added currentUser state
	const [isEditing, setIsEditing] = useState(false)
	const [form, setForm] = useState(DEFAULT_FORM)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [isCancelling, setIsCancelling] = useState(false)
	const [showCancelConfirm, setShowCancelConfirm] = useState(false)
	const [feedback, setFeedback] = useState(null)
	const [urgentNeeds, setUrgentNeeds] = useState([])
	const [activeNeed, setActiveNeed] = useState(null)
	const [checkingAuth, setCheckingAuth] = useState(true)
	const [hospitals, setHospitals] = useState([])
	const [loadingHospitals, setLoadingHospitals] = useState(false)
	const [activeTab, setActiveTab] = useState("pledge")
	const [deceasedForm, setDeceasedForm] = useState(DEFAULT_DECEASED_FORM)
	const [isSubmittingDeceased, setIsSubmittingDeceased] = useState(false)
	const [accidentAlerts, setAccidentAlerts] = useState([])
	const [userLocation, setUserLocation] = useState(null)
	const [pledgeHistory, setPledgeHistory] = useState([])
	const [reportUploaded, setReportUploaded] = useState(false)
	const [uploadedFile, setUploadedFile] = useState(null)
	const [selectedSendHospitals, setSelectedSendHospitals] = useState([])
	const [isSendingToHospital, setIsSendingToHospital] = useState(false)
	const [showHospitalSelection, setShowHospitalSelection] = useState(false)
	const [myDeceasedRequests, setMyDeceasedRequests] = useState([])

	// Check authentication
	useEffect(() => {
		function checkAuth() {
			if (typeof window === "undefined") return
			const token = localStorage.getItem("accessToken")
			setIsAuthenticated(!!token)
			setCheckingAuth(false)
		}
		checkAuth()

		const handleStorageChange = () => checkAuth()
		const handleFocus = () => checkAuth()
		window.addEventListener("storage", handleStorageChange)
		window.addEventListener("focus", handleFocus)

		return () => {
			window.removeEventListener("storage", handleStorageChange)
			window.removeEventListener("focus", handleFocus)
		}
	}, [])

	useEffect(() => {
		if (router.isReady) {
			const token = localStorage.getItem("accessToken")
			if (token && !isAuthenticated) {
				setIsAuthenticated(true)
				setCheckingAuth(false)
			}
		}
	}, [router.isReady, isAuthenticated])

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
				() => { }
			)
		}
	}, [])

	// Load data
	useEffect(() => {
		if (!isAuthenticated) return
		let cancelled = false
		async function loadData() {
			setIsPageLoading(true)
			try {
				// Load organ donor profile
				try {
					const [profile, userProfile] = await Promise.all([
						apiFetch("/organ-donors/me/").catch(() => null),
						apiFetch("/auth/users/me/").catch(() => null)
					]);

					if (!cancelled && userProfile) {
						console.log("DEBUG: Fetched User Profile:", userProfile)
						setCurrentUser(userProfile)
					}

					if (!cancelled && profile) {
						console.log("DEBUG: Fetched Organ Pledge Profile:", profile)
						setPledgeStatus(profile)
						setForm({
							organs_to_donate: profile.organs ? profile.organs.split(",") : [],
							acknowledgement: profile.consent_provided || false,
							post_mortem_consent: profile.post_mortem_consent || false,
							family_responsibility: profile.family_responsibility || false,
							living_kidney_donation: profile.living_kidney_donation || false,
							medical_student_donation: profile.medical_student_donation || false,
							selected_hospitals: profile.selected_hospitals?.map(h => h.id) || [],
							// Use registration data from either profile or userProfile
							date_of_birth: profile.registration_dob || userProfile?.date_of_birth || profile.date_of_birth || "",
							blood_group: profile.registration_blood_group || userProfile?.blood_group || profile.blood_group || "",
							phone: profile.registration_phone || userProfile?.phone || profile.phone || "",
							address: profile.address || "",
							emergency_contact_name: profile.emergency_contact_name || "",
							emergency_contact_phone: profile.emergency_contact_phone || "",
							emergency_contact_relation: profile.emergency_contact_relation || "",
						})
					} else if (!cancelled && userProfile) {
						// Profile doesn't exist, pre-fill from user profile
						console.log("DEBUG: Pre-filling form from User Profile (No existing pledge)")
						setForm(prev => ({
							...prev,
							blood_group: userProfile.blood_group || "",
							phone: userProfile.phone || "",
							date_of_birth: userProfile.date_of_birth || "",
						}));
					}
				} catch (e) {
					if (!cancelled) setPledgeStatus(null)
				}

				// Load emergency needs
				try {
					const needs = await apiFetch("/hospital-needs/?need_type=ORGAN&status=URGENT")
					if (!cancelled) setUrgentNeeds(needs.slice(0, 5))
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
					if (!cancelled) setAccidentAlerts(alerts.slice(0, 5))
				} catch (e) {
					console.error("Failed to load accident alerts:", e)
				}
			} catch (error) {
				if (!cancelled) {
					setFeedback({ type: "error", message: error.message || "Unable to load data." })
				}
			} finally {
				if (!cancelled) setIsPageLoading(false)
			}
		}
		loadData()
		loadPledgeHistory()
		return () => { cancelled = true }
	}, [isAuthenticated, userLocation])

	useEffect(() => {
		console.log("DEBUG: currentUser state changed:", currentUser)
	}, [currentUser])

	// Auto-fill Deceased Request form when tab becomes active
	useEffect(() => {
		if (activeTab === "deceased" && currentUser) {
			console.log("Auto-filling deceased form with user details:", currentUser)
			setDeceasedForm(prev => ({
				...prev,
				requester_name: currentUser.first_name ? `${currentUser.first_name} ${currentUser.last_name || ""}`.trim() : prev.requester_name,
				requester_phone: currentUser.phone || prev.requester_phone,
				requester_email: currentUser.email || prev.requester_email,
			}))
		}
	}, [activeTab, currentUser])

	async function loadPledgeHistory() {
		try {
			const data = await apiFetch("/donors/download_history/?report_type=ORGAN_PLEDGE")
			setPledgeHistory(data)
		} catch (err) {
			console.error("Failed to load pledge history:", err)
		}
	}

	async function loadDeceasedRequests() {
		if (!isAuthenticated) return
		try {
			const data = await apiFetch("/deceased-donor-requests/?user=me")
			setMyDeceasedRequests(data)
		} catch (err) {
			console.error("Failed to load deceased requests:", err)
		}
	}

	useEffect(() => {
		if (activeTab === "deceased") {
			loadDeceasedRequests()
		}
	}, [activeTab, isAuthenticated])

	async function handleDeceasedSubmit(e) {
		e.preventDefault()
		setIsSubmittingDeceased(true)
		try {
			await apiFetch("/deceased-donor-requests/", {
				method: "POST",
				body: JSON.stringify(deceasedForm)
			})
			alert("Request submitted successfully!")
			setDeceasedForm({ ...DEFAULT_DECEASED_FORM, requester_name: deceasedForm.requester_name, requester_phone: deceasedForm.requester_phone, requester_email: deceasedForm.requester_email })
			loadDeceasedRequests()
		} catch (error) {
			alert(error.message || "Failed to submit request")
		} finally {
			setIsSubmittingDeceased(false)
		}
	}

	async function handleDeceasedCancel(id) {
		if (!confirm("Are you sure you want to cancel this request?")) return
		try {
			await apiFetch(`/deceased-donor-requests/${id}/cancel/`, { method: "POST" })
			loadDeceasedRequests()
		} catch (error) {
			alert(error.message || "Failed to cancel request")
		}
	}

	async function handleConfirmAmbulance(id) {
		if (!confirm("Please confirm that the ambulance has arrived and you are handing over the body.")) return
		try {
			await apiFetch(`/deceased-donor-requests/${id}/confirm_ambulance/`, { method: "POST" })
			alert("Process Completed. Thank you for your donation.")
			loadDeceasedRequests()
		} catch (error) {
			alert(error.message || "Failed to confirm.")
		}
	}

	// Load hospitals
	useEffect(() => {
		if (!isAuthenticated) return
		async function loadHospitals() {
			setLoadingHospitals(true)
			try {
				const data = await apiFetch("/hospitals/?registered_only=true")
				setHospitals(data.filter(h => h.user !== null && h.user !== undefined))
			} catch (error) {
				console.error("Failed to load hospitals:", error)
				setHospitals([])
			} finally {
				setLoadingHospitals(false)
			}
		}
		loadHospitals()
	}, [isAuthenticated])

	const selectedOrgansSet = useMemo(() => new Set(form.organs_to_donate), [form.organs_to_donate])

	function toggleOrgan(organId) {
		setForm((prev) => {
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

	function dismissFeedback() {
		setFeedback(null)
	}

	async function handlePledgeSubmit(event) {
		event.preventDefault()
		setFeedback(null)

		if (!form.post_mortem_consent || !form.acknowledgement) {
			setFeedback({
				type: "error",
				message: "Please accept the post-mortem consent and general acknowledgement to proceed.",
			})
			return
		}

		if (form.organs_to_donate.length === 0) {
			setFeedback({
				type: "error",
				message: "Please select at least one organ to donate.",
			})
			return
		}

		if (form.phone && !validatePhone(form.phone)) {
			setFeedback({
				type: "error",
				message: "Please enter a valid 10-15 digit phone number.",
			})
			return
		}

		if (form.date_of_birth && !validateDateNotInFuture(form.date_of_birth)) {
			setFeedback({
				type: "error",
				message: "Date of birth cannot be in the future.",
			})
			return
		}

		if (form.emergency_contact_phone && !validatePhone(form.emergency_contact_phone)) {
			setFeedback({
				type: "error",
				message: "Please enter a valid 10-15 digit phone number for the emergency contact.",
			})
			return
		}

		if (form.phone && form.emergency_contact_phone && form.phone === form.emergency_contact_phone) {
			setFeedback({
				type: "error",
				message: "Emergency contact number cannot be the same as your phone number.",
			})
			return
		}

		setIsSubmitting(true)
		try {
			const formData = {
				organs: form.organs_to_donate.join(","),
				consent_provided: form.acknowledgement,
				post_mortem_consent: form.post_mortem_consent,
				family_responsibility: form.family_responsibility,
				living_kidney_donation: form.living_kidney_donation,
				medical_student_donation: form.medical_student_donation,
				selected_hospital_ids: form.selected_hospitals,
				date_of_birth: form.date_of_birth || null,
				blood_group: form.blood_group || "",
				phone: form.phone || "",
				address: form.address || "",
				emergency_contact_name: form.emergency_contact_name || "",
				emergency_contact_phone: form.emergency_contact_phone || "",
				emergency_contact_relation: form.emergency_contact_relation || "",
			}

			let response
			if (pledgeStatus) {
				response = await apiFetch("/organ-donors/me/", {
					method: "PATCH",
					body: JSON.stringify(formData),
				})
			} else {
				response = await apiFetch("/organ-donors/me/", {
					method: "PUT",
					body: JSON.stringify(formData),
				})
			}

			// Chain the commit action immediately for secure pledge generation
			try {
				const commitResponse = await apiFetch(`/organ-donors/${response.id}/commit_pledge/`, {
					method: "POST",
				})
				setPledgeStatus(commitResponse)
				setReportUploaded(false)
				setUploadedFile(null)

				// Auto-download the new secure report
				if (commitResponse.pledge_report) {
					const link = document.createElement("a");
					link.href = commitResponse.pledge_report;
					link.setAttribute("download", `Secure_Organ_Pledge_${currentUser?.last_name || "Entry"}.pdf`);
					document.body.appendChild(link);
					link.click();
					document.body.removeChild(link);
				}

				setFeedback({
					type: "success",
					message: "Pledge Registered & Securely Committed! New report downloaded. Please verify and send the NEW report to hospitals.",
				})
				loadPledgeHistory()
			} catch (commitError) {
				console.error("Commit failed:", commitError)
				setPledgeStatus(response) // Fallback to saved but not committed state
				setFeedback({
					type: "warning",
					message: "Pledge saved, but secure commitment failed. Please try 'Commit' button again.",
				})
			}

			setIsEditing(false)
		} catch (error) {
			setFeedback({
				type: "error",
				message: error.message || "Registration failed. Please try again.",
			})
		} finally {
			setIsSubmitting(false)
		}
	}

	async function handleCommitPledge() {
		if (!pledgeStatus) return
		setIsSubmitting(true)
		try {
			const response = await apiFetch(`/organ-donors/${pledgeStatus.id}/commit_pledge/`, {
				method: "POST",
			})
			setPledgeStatus(response)
			setReportUploaded(false)
			setUploadedFile(null)

			// Auto-download the new secure report
			if (response.pledge_report) {
				const link = document.createElement("a");
				link.href = response.pledge_report;
				link.setAttribute("download", `Secure_Organ_Pledge_${currentUser?.last_name || "Entry"}.pdf`);
				document.body.appendChild(link);
				link.click();
				document.body.removeChild(link);
			}

			setFeedback({
				type: "success",
				message: "Pledge Committed! New report downloaded. Please verify and send the NEW report to hospitals.",
			})
			loadPledgeHistory()
		} catch (error) {
			setFeedback({
				type: "error",
				message: error.message || "Commitment failed. Please try again.",
			})
		} finally {
			setIsSubmitting(false)
		}
	}

	async function handleCancelPledge() {
		if (!pledgeStatus) return
		setIsSubmitting(true)
		try {
			await apiFetch(`/organ-donors/${pledgeStatus.id}/donor_finalize/`, {
				method: "POST",
				body: JSON.stringify({ action: "reject" }),
			})
			setFeedback({
				type: "success",
				message: "Pledge cancelled and removed.",
			})
			setPledgeStatus(null)
			resetForm()
			loadPledgeHistory()
		} catch (error) {
			setFeedback({
				type: "error",
				message: error.message || "Cancellation failed. Please try again.",
			})
		} finally {
			setIsSubmitting(false)
		}
	}

	async function handleDeceasedSubmit(event) {
		event.preventDefault()
		setFeedback(null)

		if (!deceasedForm.requester_name || !deceasedForm.deceased_name || !deceasedForm.deceased_date_of_death) {
			setFeedback({
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

			setDeceasedForm(DEFAULT_DECEASED_FORM)
			setFeedback({
				type: "success",
				message: "Request submitted successfully! We will process it and contact you soon.",
			})
		} catch (error) {
			setFeedback({
				type: "error",
				message: error.message || "Failed to submit request. Please try again.",
			})
		} finally {
			setIsSubmittingDeceased(false)
		}
	}

	async function generatePledgeReport() {
		try {
			// Trigger Blockchain-Tracked Secure PDF Generation
			const blob = await apiFetch("/organ-donors/generate_draft_pledge/", {
				method: "POST",
				responseAs: "blob",
				body: JSON.stringify({
					...form,
					organs_list: form.organs_to_donate
				})
			});

			const url = window.URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = url;
			link.setAttribute("download", `Draft_Organ_Pledge_${currentUser?.last_name || "Entry"}.pdf`);
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			window.URL.revokeObjectURL(url);

			setFeedback({
				type: "success",
				message: "Blockchain Verified Draft Report generated and recorded in the ledger."
			});
			// Refresh history
			const data = await apiFetch("/donors/download_history/?report_type=ORGAN_PLEDGE")
			setPledgeHistory(data)
		} catch (err) {
			console.error("Draft generation failed:", err);
			setFeedback({
				type: "error",
				message: "Failed to generate blockchain-tracked report."
			});
		}
	}

	async function handleReportUpload(e) {
		const file = e.target.files[0]
		if (!file) return

		if (file.type !== "application/pdf") {
			alert("Please upload a PDF file.")
			return
		}

		try {
			const formData = new FormData()
			formData.append('file', file)
			setUploadedFile(file)

			const response = await apiFetch('/organ-donors/verify_pledge_report/', {
				method: 'POST',
				body: formData,
			})

			if (response.valid) {
				setReportUploaded(true)
				setFeedback({
					type: "success",
					message: `Verification Successful! Blockchain ID: ${response.download_id}. Timestamp: ${new Date(response.timestamp).toLocaleString()}. This report is authentic.`
				})
			} else {
				alert(`Verification Failed: ${response.detail}`)
			}
		} catch (err) {
			console.error("Verification Error:", err)
			if (err.message && err.message.includes("replaced by a newer draft")) {
				alert("🚫 Outdated Report: This report has been replaced by a newer version because you modified your pledge. Please download the latest version from the dashboard above and upload that one.")
			} else {
				alert(err.message || "Error verifying pledge integrity.")
			}
		}
	}

	function startEditing() {
		if (!pledgeStatus) return
		setIsEditing(true)
		setFeedback(null)
		setShowCancelConfirm(false)
	}

	function resetForm() {
		console.log("DEBUG: Starting resetForm. Current cached User:", currentUser, "Current Pledge Status:", pledgeStatus)

		const dobSource = pledgeStatus?.registration_dob || currentUser?.date_of_birth || "";
		const bgSource = pledgeStatus?.registration_blood_group || currentUser?.blood_group || "";
		const phoneSource = pledgeStatus?.registration_phone || currentUser?.phone || "";

		const newForm = {
			...DEFAULT_FORM,
			date_of_birth: dobSource,
			blood_group: bgSource,
			phone: phoneSource,
		}
		console.log("DEBUG: resetForm - new form state result:", newForm)
		setForm(newForm)
		setFeedback(null)
		if (!pledgeStatus) {
			setIsEditing(true)
		}
	}

	async function handleFinalizeCommitment() {
		setIsSubmitting(true)
		try {
			const response = await apiFetch(`/organ-donors/${pledgeStatus.id}/commit_pledge/`, {
				method: "POST"
			})
			setPledgeStatus(response)
			setFeedback({
				type: "success",
				message: "Commitment Finalized! Hospitals can now proceed with your pledge."
			})
			setReportUploaded(false)
		} catch (error) {
			alert(error.message || "Failed to finalize commitment.")
		} finally {
			setIsSubmitting(false)
		}
	}

	async function handleSendVerifiedReport() {
		if (selectedSendHospitals.length === 0) {
			alert("Please select at least one hospital to send the report to.")
			return
		}

		setIsSendingToHospital(true)
		try {
			const formData = new FormData()
			formData.append('file', uploadedFile)
			selectedSendHospitals.forEach(id => {
				formData.append('selected_hospitals', id)
			})

			const response = await apiFetch('/organ-donors/submit_verified_report/', {
				method: 'POST',
				body: formData,
			})

			setPledgeStatus(response)
			setReportUploaded(false)
			setUploadedFile(null)
			setSelectedSendHospitals([])
			setFeedback({
				type: "success",
				message: "Report sent successfully! Hospitals have been notified and can now verify your pledge."
			})
		} catch (err) {
			if (err.message && err.message.includes("replaced by a newer draft")) {
				alert("🚫 Outdated Report: This report has been replaced by a newer version since you clicked 'Modify Pledge'. Please download the latest version and use that instead.")
			} else {
				alert(err.message || "Failed to send report to hospitals.")
			}
		} finally {
			setIsSendingToHospital(false)
		}
	}

	async function handleDonorFinalize(action) {
		setIsSubmitting(true)
		try {
			const response = await apiFetch(`/organ-donors/${pledgeStatus.id}/donor_finalize/`, {
				method: "POST",
				body: JSON.stringify({ action })
			})
			if (response.status === "DELETED") {
				setPledgeStatus(null)
				setFeedback({
					type: "success",
					message: "Pledge deleted. You can now create a new one."
				})
			} else {
				setPledgeStatus(response)
				setFeedback({
					type: "success",
					message: "Commitment Finalized! Thank you for your selfless contribution."
				})
			}
		} catch (error) {
			alert(error.message || "Error processing your request.")
		} finally {
			setIsSubmitting(false)
		}
	}

	async function confirmCancelPledge() {
		setIsCancelling(true)
		setFeedback(null)
		try {
			if (pledgeStatus) {
				// mark as CANCELLED instead of hard delete to notify hospital
				await apiFetch(`/organ-donors/me/`, {
					method: "PATCH",
					body: JSON.stringify({ status: "CANCELLED" }),
				})
			}
			setPledgeStatus(null)
			setForm(DEFAULT_FORM)
			setIsEditing(true)
			setFeedback({
				type: "success",
				message: "Pledge cancelled. You can renew your commitment whenever you are ready.",
			})
		} catch (error) {
			setFeedback({
				type: "error",
				message: error.message || "Unable to cancel your pledge right now. Please try again.",
			})
		} finally {
			setIsCancelling(false)
			setShowCancelConfirm(false)
		}
	}

	const pledgeOrgansDisplay = useMemo(() => {
		if (!pledgeStatus?.organs) return "Not recorded"
		const organs = pledgeStatus.organs.split(",")
		if (organs.includes("ALL")) return "All Organs"
		return organs.map(org => ORGAN_OPTIONS.find(o => o.id === org)?.label || org).join(", ")
	}, [pledgeStatus])

	const showForm = !pledgeStatus || isEditing

	return (
		<>
			<Head>
				<title>Organ Pledge Registry — LifeSaver Connect</title>
			</Head>
			<main className="min-h-screen bg-[#1A1A2E] text-white">
				<div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
					<header className="max-w-3xl">
						<p className="text-sm uppercase tracking-wide text-[#E91E63]">Organ Donation Registry</p>
						<h1 className="mt-3 text-3xl font-extrabold sm:text-4xl" style={{ fontFamily: "'Poppins', sans-serif" }}>
							A pledge to continue giving life
						</h1>
						<p className="mt-4 text-base text-pink-100/90">
							Commit to post-mortem organ donation, manage your pledge, and connect with patients who are waiting for a transplant today. Your choice can save multiple lives.
						</p>
					</header>

					{checkingAuth ? (
						<section className="mt-12 flex items-center justify-center">
							<div className="w-full max-w-2xl rounded-3xl border border-[#F6D6E3]/40 bg-[#131326] p-10 text-center shadow-2xl">
								<div className="flex items-center justify-center">
									<div className="h-8 w-8 animate-spin rounded-full border-4 border-[#E91E63] border-t-transparent" />
								</div>
								<p className="mt-4 text-sm text-pink-100/80">Checking authentication...</p>
							</div>
						</section>
					) : !isAuthenticated ? (
						<section className="mt-12 flex items-center justify-center">
							<div className="w-full max-w-2xl rounded-3xl border border-[#F6D6E3]/40 bg-[#131326] p-10 text-center shadow-2xl">
								<h2 className="text-2xl font-semibold text-white">Organ Registry Access Requires Authentication</h2>
								<p className="mt-4 text-sm text-pink-100/80">
									Please log in or create a basic account to manage your organ donation pledge.
								</p>
								<div className="mt-8 flex flex-wrap justify-center gap-4">
									<Link href={`/auth/login?module=organ&next=${encodeURIComponent("/register/organ")}`} legacyBehavior>
										<a className="rounded-lg bg-[#E91E63] px-6 py-2 text-sm font-semibold text-white transition hover:opacity-90">
											Log In
										</a>
									</Link>
									<Link href="/auth/register" legacyBehavior>
										<a className="rounded-lg border border-[#F6D6E3] px-6 py-2 text-sm font-semibold text-pink-100 transition hover:bg-white/10">
											Create New Account
										</a>
									</Link>
								</div>
							</div>
						</section>
					) : (
						<section className="mt-12">
							{feedback && (
								<div
									className={`mb-8 flex items-start justify-between gap-4 rounded-2xl border px-4 py-4 text-sm sm:text-base ${feedback.type === "success"
										? "border-[#22C55E]/60 bg-[#22C55E]/10 text-[#A7F3D0]"
										: "border-[#DC2626]/60 bg-[#DC2626]/10 text-[#FCA5A5]"
										}`}
								>
									<span>{feedback.message}</span>
									<button
										type="button"
										onClick={dismissFeedback}
										className="rounded border border-white/10 px-2 py-1 text-xs uppercase tracking-wide text-white/70 transition hover:bg-white/10"
									>
										Dismiss
									</button>
								</div>
							)}

							{/* Tabs */}
							<div className="mb-8 flex flex-wrap gap-2 border-b border-[#F6D6E3]/20">
								<button
									onClick={() => setActiveTab("pledge")}
									className={`px-4 py-2 text-sm font-semibold transition ${activeTab === "pledge"
										? "border-b-2 border-[#E91E63] text-[#E91E63]"
										: "text-pink-100/70 hover:text-white"
										}`}
								>
									My Pledge
								</button>
								<button
									onClick={() => setActiveTab("deceased")}
									className={`px-4 py-2 text-sm font-semibold transition ${activeTab === "deceased"
										? "border-b-2 border-[#E91E63] text-[#E91E63]"
										: "text-pink-100/70 hover:text-white"
										}`}
								>
									Deceased Donor Request
								</button>
								<button
									onClick={() => setActiveTab("emergencies")}
									className={`px-4 py-2 text-sm font-semibold transition ${activeTab === "emergencies"
										? "border-b-2 border-[#E91E63] text-[#E91E63]"
										: "text-pink-100/70 hover:text-white"
										}`}
								>
									Emergency Cases
								</button>
								<button
									onClick={() => setActiveTab("accidents")}
									className={`px-4 py-2 text-sm font-semibold transition ${activeTab === "accidents"
										? "border-b-2 border-[#E91E63] text-[#E91E63]"
										: "text-pink-100/70 hover:text-white"
										}`}
								>
									Accident Alerts
								</button>
							</div>

							{/* Tab Content */}
							{activeTab === "pledge" && (
								<div className="grid gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
									<div className="rounded-3xl border border-[#F6D6E3]/30 bg-[#131326]/90 p-8 shadow-[0_20px_45px_rgba(233,30,99,0.2)]">
										<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
											<div>
												<h2 className="text-2xl font-semibold text-white">Your Organ Pledge</h2>
												<div className="flex items-center gap-2 mt-1">
													<p className="text-sm text-sky-100/70">
														Update your commitment at any time. Verified transplant centres access this data securely with family approval.
													</p>
													{pledgeStatus && (
														<span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${pledgeStatus.status === 'COMMITTED' || pledgeStatus.status === 'ACCEPTED' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
															pledgeStatus.status === 'REJECTED' || pledgeStatus.status === 'CANCELLED' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
																pledgeStatus.status === 'BODY_RECEIVED' || pledgeStatus.status === 'COMPLETED' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
																	'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
															}`}>
															{pledgeStatus.status === 'ACCEPTED' ? 'ACCEPTED BY HOSPITAL' : pledgeStatus.status === 'COMPLETED' ? 'PLEDGE FULFILLED' : pledgeStatus.status}
														</span>
													)}
												</div>
											</div>
											{pledgeStatus && !showForm && (
												<div className="flex flex-wrap gap-3">
													<button
														type="button"
														onClick={startEditing}
														className="inline-flex items-center rounded-lg bg-[#E91E63] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
													>
														Modify Pledge
													</button>
													{pledgeStatus.pledge_report ? (
														<a
															href={pledgeStatus.pledge_report}
															target="_blank"
															rel="noopener noreferrer"
															className="inline-flex items-center rounded-lg border border-[#E91E63] px-4 py-2 text-sm font-semibold text-[#E91E63] transition hover:bg-[#E91E63]/10"
														>
															Download Secure Report
														</a>
													) : (
														<button
															type="button"
															onClick={generatePledgeReport}
															className="inline-flex items-center rounded-lg border border-[#E91E63] px-4 py-2 text-sm font-semibold text-[#E91E63] transition hover:bg-[#E91E63]/10"
														>
															Download Draft Report
														</button>
													)}
													<button
														type="button"
														onClick={async () => {
															try {
																const res = await apiFetch("/organ-donors/notify_contact/", { method: "POST" });
																setFeedback({ type: "success", message: res.message });
															} catch (err) {
																setFeedback({ type: "error", message: err.message || "Failed to notify contact." });
															}
														}}
														className="inline-flex items-center rounded-lg border border-blue-500/50 px-4 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/10"
													>
														Notify Emergency Contact
													</button>
													<button
														type="button"
														onClick={() => {
															const el = document.getElementById("verify-section");
															if (el) el.scrollIntoView({ behavior: 'smooth' });
														}}
														className="inline-flex items-center rounded-lg border border-green-500/50 px-4 py-2 text-sm font-semibold text-green-300 transition hover:bg-green-500/10"
													>
														Verify & Notify Hospital
													</button>
													<button
														type="button"
														onClick={() => setShowCancelConfirm(true)}
														className="inline-flex items-center rounded-lg border border-[#DC2626]/80 px-4 py-2 text-sm font-semibold text-[#FCA5A5] transition hover:bg-[#DC2626]/10"
													>
														Cancel Pledge
													</button>
												</div>
											)}
										</div>

										{pledgeStatus && !showForm && (
											<div id="verify-section" className="mt-8 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-6 shadow-lg shadow-blue-500/5">
												<div className="flex items-start gap-4">
													<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-400">
														<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
														</svg>
													</div>
													<div className="flex-1">
														<h3 className="text-lg font-bold text-white">Upload & Verify Report</h3>
														<p className="mt-1 text-sm text-pink-100/70">
															Upload your generated pledge report to verify its blockchain integrity and notify hospitals.
														</p>
														<div className="mt-4">
															<input
																type="file"
																accept="application/pdf"
																onChange={handleReportUpload}
																className="block w-full text-sm text-pink-100/50
																	file:mr-4 file:py-2 file:px-4
																	file:rounded-lg file:border-0
																	file:text-sm file:font-semibold
																	file:bg-blue-600 file:text-white
																	hover:file:bg-blue-500
																	file:cursor-pointer cursor-pointer"
															/>
														</div>
														{pledgeStatus.status === "REPORT_VERIFIED" && (
															<div className="mt-6 p-6 rounded-2xl bg-blue-600/10 border border-blue-500/30 text-center space-y-4">
																<div className="h-12 w-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto text-xl">📋</div>
																<h4 className="text-lg font-black text-white uppercase tracking-tight">Report Verified</h4>
																<p className="text-sm text-pink-100/70">The hospital has verified your blockchain report. Would you like to continue with the final pledge commitment?</p>
																<div className="grid grid-cols-2 gap-4">
																	<button
																		onClick={() => handleDonorFinalize('accept')}
																		disabled={isSubmitting}
																		className="py-3 bg-green-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-green-600/30 hover:scale-[1.05] transition active:scale-95 disabled:opacity-50"
																	>
																		Accept & Commit ✅
																	</button>
																	<button
																		onClick={() => handleDonorFinalize('reject')}
																		disabled={isSubmitting}
																		className="py-3 bg-red-600/20 border border-red-500/40 text-red-400 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-600 hover:text-white transition active:scale-95 disabled:opacity-50"
																	>
																		Reject & Delete ❌
																	</button>
																</div>
															</div>
														)}

														{reportUploaded && pledgeStatus.status !== "REPORT_VERIFIED" && !showHospitalSelection && (
															<div className="mt-6 p-6 rounded-2xl bg-green-600/10 border border-green-500/30 text-center space-y-4">
																<div className="h-12 w-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto text-xl">✅</div>
																<h4 className="text-lg font-black text-white uppercase tracking-tight">Report Authenticated</h4>
																<p className="text-sm text-pink-100/70">Blockchain integrity verified successfully. You can now select hospitals to notify.</p>
																<button
																	onClick={() => setShowHospitalSelection(true)}
																	className="w-full py-4 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-600/30 hover:scale-[1.02] transition active:scale-[0.98]"
																>
																	Continue to Hospital Selection →
																</button>
															</div>
														)}

														{showHospitalSelection && (
															<div className="mt-6 space-y-6">
																<div className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-4">
																	<div className="flex items-center gap-2 text-xs font-bold text-blue-400">
																		<svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
																			<path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
																		</svg>
																		SELECT RECIPIENT HOSPITALS
																	</div>
																	<p className="mt-1 text-[10px] text-pink-100/60 uppercase tracking-tight">Your verified report will be sent directly to their request queue.</p>
																</div>

																<div className="space-y-3">
																	<div className="flex items-center justify-between">
																		<p className="text-[10px] font-black text-pink-100/40 uppercase tracking-widest">Select Medical Centers</p>
																		<button onClick={() => setShowHospitalSelection(false)} className="text-[10px] font-bold text-pink-100/40 hover:text-pink-100 uppercase">Back</button>
																	</div>
																	<div className="grid gap-2 max-h-48 overflow-y-auto pr-2">
																		{hospitals.map((hospital) => (
																			<label
																				key={hospital.id}
																				className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${selectedSendHospitals.includes(hospital.id)
																					? "border-[#E91E63] bg-[#E91E63]/10"
																					: "border-white/10 hover:bg-white/5"
																					}`}
																			>
																				<input
																					type="checkbox"
																					checked={selectedSendHospitals.includes(hospital.id)}
																					onChange={(e) => {
																						if (e.target.checked) {
																							setSelectedSendHospitals(prev => [...prev, hospital.id])
																						} else {
																							setSelectedSendHospitals(prev => prev.filter(id => id !== hospital.id))
																						}
																					}}
																					className="h-4 w-4 rounded accent-[#E91E63]"
																				/>
																				<div className="flex-1">
																					<p className="text-xs font-bold text-white">{hospital.name}</p>
																					<p className="text-[9px] text-pink-100/60 uppercase">{hospital.city} • {hospital.hospital_type}</p>
																				</div>
																			</label>
																		))}
																	</div>
																</div>

																<button
																	onClick={handleSendVerifiedReport}
																	disabled={isSendingToHospital || selectedSendHospitals.length === 0}
																	className="w-full py-4 bg-[#E91E63] text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-[#E91E63]/30 hover:scale-[1.02] transition active:scale-[0.98] disabled:opacity-50"
																>
																	{isSendingToHospital ? "Sending Securely..." : "Finalize & Send Report 🚀"}
																</button>
															</div>
														)}
													</div>
												</div>
											</div>
										)}

										{/* Blockchain Pledge History Section */}
										{pledgeStatus && activeTab === "pledge" && (
											<div className="mt-12 pt-8 border-t border-[#F6D6E3]/10">
												<div className="mb-6">
													<h3 className="text-xl font-bold text-white flex items-center gap-2">
														<svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
														</svg>
														Secure Pledge Ledger
													</h3>
													<p className="text-xs text-pink-100/50 mt-1">
														Blockchain-verified record of your organ donation reports (Drafts & Final).
													</p>
												</div>

												{pledgeHistory.length > 0 ? (
													<div className="grid gap-4">
														{pledgeHistory.map((item) => (
															<div key={item.id} className="rounded-2xl border border-white/5 bg-[#1A1A2E]/50 p-5 font-mono text-[10px] transition hover:border-[#E91E63]/30">
																<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
																	<div className="space-y-2 flex-1">
																		<div className="flex items-center gap-2">
																			<span className="font-bold text-[#E91E63]">TRACKING ID:</span>
																			<span className="text-white">{item.download_id}</span>
																			{item.download_id.includes("DRAFT") && (
																				<span className="px-1.5 py-0.5 rounded bg-gray-500/20 text-gray-400 text-[8px] border border-gray-500/20">DRAFT</span>
																			)}
																		</div>
																		<div className="flex items-center gap-2 opacity-60 truncate max-w-[200px] sm:max-w-md">
																			<span className="font-bold">PDF HASH:</span>
																			<span className="text-pink-100">{item.pdf_hash}</span>
																		</div>
																		<div className="flex items-center gap-2 text-green-400/70 truncate max-w-[200px] sm:max-w-md">
																			<span className="font-bold">LEDGER HASH:</span>
																			<span className="truncate">{item.block_hash}</span>
																		</div>
																	</div>
																	<div className="flex flex-col items-start gap-2 sm:items-end sm:text-right">
																		<span className="text-pink-100/30">{new Date(item.timestamp).toLocaleString()}</span>
																		{item.pdf_file && (
																			<a
																				href={item.pdf_file}
																				target="_blank"
																				rel="noopener noreferrer"
																				className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 transition"
																			>
																				View Document ↗
																			</a>
																		)}
																	</div>
																</div>
															</div>
														))}
													</div>
												) : (
													<div className="rounded-2xl border border-dashed border-[#F6D6E3]/10 bg-white/[0.02] p-8 text-center">
														<p className="text-pink-100/30">No recorded ledger entries found for your pledge.</p>
													</div>
												)}
											</div>
										)}

										{pledgeStatus && pledgeStatus.status === "ACCEPTED" && !showForm && (
											<div className="mt-8 rounded-2xl border border-yellow-500/40 bg-yellow-500/5 p-6 transition-all animate-in fade-in slide-in-from-top-4 duration-500">
												<div className="flex items-start gap-4">
													<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-500/20 text-yellow-500">
														<span className="text-xl">✉️</span>
													</div>
													<div className="flex-1">
														<h3 className="text-lg font-bold text-white">Message from {pledgeStatus.accepted_by_hospital_name}</h3>
														<p className="mt-2 text-pink-100/90 italic leading-relaxed">
															"{pledgeStatus.hospital_message}"
														</p>
														<button
															type="button"
															onClick={handleCommitPledge}
															disabled={isSubmitting}
															className="mt-4 rounded-lg bg-yellow-600 px-6 py-2 text-sm font-bold text-white transition hover:bg-yellow-500 active:scale-95 disabled:opacity-50"
														>
															{isSubmitting ? "Processing..." : "OK - I Commit"}
														</button>
													</div>
												</div>
											</div>
										)}

										{showCancelConfirm && (
											<div className="mt-6 rounded-2xl border border-[#DC2626]/40 bg-[#131326] p-6 text-sm text-[#FECACA]">
												<h3 className="text-base font-semibold text-white">Confirm cancellation</h3>
												<p className="mt-2">
													Cancelling removes your pledge record. Hospitals will no longer see your commitment. You can recommit at any time.
												</p>
												<div className="mt-4 flex flex-wrap gap-3">
													<button
														type="button"
														onClick={confirmCancelPledge}
														disabled={isCancelling}
														className="inline-flex h-10 items-center justify-center rounded-lg bg-[#DC2626] px-4 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-[#B91C1C] disabled:cursor-not-allowed disabled:opacity-70"
													>
														{isCancelling ? (
															<>
																<span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
																Removing...
															</>
														) : (
															"Confirm Cancel"
														)}
													</button>
													<button
														type="button"
														onClick={() => setShowCancelConfirm(false)}
														className="inline-flex h-10 items-center justify-center rounded-lg border border-[#F6D6E3]/20 px-4 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:bg-white/10"
													>
														Keep Pledge
													</button>
												</div>
											</div>
										)}

										{showForm ? (
											<form onSubmit={handlePledgeSubmit} className="mt-8 space-y-8">
												{/* Personal Details */}
												<section className="rounded-2xl border border-[#F6D6E3]/20 bg-[#131326] p-6">
													<h3 className="text-lg font-semibold text-white mb-4">Personal Details</h3>
													<div className="grid gap-4 sm:grid-cols-2">
														<div>
															<label className="block text-sm font-medium text-pink-100 mb-1">Date of Birth</label>
															<input
																type="date"
																value={form.date_of_birth}
																readOnly
																tabIndex="-1"
																className="w-full rounded-lg border border-[#F6D6E3]/30 bg-[#131326] px-3 py-2 text-white/50 outline-none cursor-not-allowed select-none"
																title="Fixed from your registration details"
															/>
															<p className="mt-1 text-[10px] text-pink-100/40 uppercase">Fixed from Registration Profile</p>
														</div>
														<div>
															<label className="block text-sm font-medium text-pink-100 mb-1">Blood Group</label>
															<input
																type="text"
																value={form.blood_group}
																readOnly
																tabIndex="-1"
																className="w-full rounded-lg border border-[#F6D6E3]/30 bg-[#131326] px-3 py-2 text-white/50 outline-none cursor-not-allowed select-none"
																title="Fixed from your registration details"
															/>
															<p className="mt-1 text-[10px] text-pink-100/40 uppercase">Fixed from Registration Profile</p>
														</div>
														<div>
															<label className="block text-sm font-medium text-pink-100 mb-1">Phone</label>
															<input
																type="tel"
																value={form.phone}
																readOnly
																tabIndex="-1"
																className="w-full rounded-lg border border-[#F6D6E3]/30 bg-[#131326] px-3 py-2 text-white/50 outline-none cursor-not-allowed select-none"
																title="Fixed from your registration details"
															/>
															<p className="mt-1 text-[10px] text-pink-100/40 uppercase">Fixed from Registration Profile</p>
														</div>
														<div className="sm:col-span-2">
															<label className="block text-sm font-medium text-pink-100 mb-1">Address</label>
															<textarea
																value={form.address}
																onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
																rows={3}
																className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
																placeholder="Your complete address"
															/>
														</div>
													</div>
												</section>

												{/* Emergency Contact */}
												<section className="rounded-2xl border border-[#F6D6E3]/20 bg-[#131326] p-6">
													<h3 className="text-lg font-semibold text-white mb-4">Emergency Contact</h3>
													<div className="grid gap-4 sm:grid-cols-2">
														<div>
															<label className="block text-sm font-medium text-pink-100 mb-1">Contact Name</label>
															<input
																type="text"
																value={form.emergency_contact_name}
																onChange={(e) => setForm((prev) => ({ ...prev, emergency_contact_name: e.target.value }))}
																className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
															/>
														</div>
														<div>
															<label className="block text-sm font-medium text-pink-100 mb-1">Contact Phone</label>
															<input
																type="tel"
																value={form.emergency_contact_phone}
																onChange={(e) => setForm((prev) => ({ ...prev, emergency_contact_phone: e.target.value }))}
																className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
															/>
														</div>
														<div className="sm:col-span-2">
															<label className="block text-sm font-medium text-pink-100 mb-1">Relation</label>
															<select
																value={form.emergency_contact_relation}
																onChange={(e) => setForm((prev) => ({ ...prev, emergency_contact_relation: e.target.value }))}
																className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
															>
																<option value="">Select Relation</option>
																{RELATION_OPTIONS.map(rel => (
																	<option key={rel.id} value={rel.id}>{rel.label}</option>
																))}
															</select>
														</div>
													</div>
												</section>


												{/* Organ Selection */}
												<section>
													<h3 className="text-lg font-semibold text-white mb-2">Select organs you wish to pledge</h3>
													<p className="text-sm text-pink-100/70 mb-4">
														Choose individual organs or pledge "All Organs" to register a full-body donation intent.
													</p>
													<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
														{ORGAN_OPTIONS.map((organ) => (
															<label
																key={organ.id}
																className={`flex cursor-pointer items-start gap-3 rounded-2xl border bg-[#1A1A2E] p-4 transition ${selectedOrgansSet.has(organ.id)
																	? "border-[#E91E63] shadow-[0_15px_35px_rgba(233,30,99,0.25)]"
																	: "border-[#F6D6E3]/20 hover:border-[#E91E63]"
																	}`}
															>
																<input
																	type="checkbox"
																	checked={selectedOrgansSet.has(organ.id)}
																	onChange={() => toggleOrgan(organ.id)}
																	className="mt-1 h-5 w-5 rounded border-white/30 bg-transparent accent-[#E91E63] focus:ring-[#E91E63]"
																/>
																<div>
																	<p className="font-medium text-white">{organ.label}</p>
																	<p className="text-xs text-pink-100/60">Recognised and regulated by the national transplant program.</p>
																</div>
															</label>
														))}
													</div>
												</section>

												{/* Hospital Selection */}
												<section className="rounded-2xl border border-[#F6D6E3]/20 bg-[#131326] p-6">
													<h3 className="text-lg font-semibold text-white mb-2">Select Hospitals/Centers</h3>
													<p className="text-sm text-pink-100/70 mb-4">
														Select registered hospitals or centers where you want to send your donation report.
													</p>
													{loadingHospitals ? (
														<div className="flex items-center justify-center py-8">
															<div className="h-6 w-6 animate-spin rounded-full border-2 border-[#E91E63] border-t-transparent" />
														</div>
													) : hospitals.length === 0 ? (
														<p className="text-sm text-pink-100/70 py-4">No registered hospitals available.</p>
													) : (
														<div className="space-y-2 max-h-64 overflow-y-auto">
															{hospitals.map((hospital) => (
																<label
																	key={hospital.id}
																	className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition ${form.selected_hospitals.includes(hospital.id)
																		? "border-[#E91E63] bg-[#E91E63]/10"
																		: "border-[#F6D6E3]/20 hover:border-[#E91E63]"
																		}`}
																>
																	<input
																		type="checkbox"
																		checked={form.selected_hospitals.includes(hospital.id)}
																		onChange={(e) => {
																			if (e.target.checked) {
																				setForm((prev) => ({
																					...prev,
																					selected_hospitals: [...prev.selected_hospitals, hospital.id],
																				}))
																			} else {
																				setForm((prev) => ({
																					...prev,
																					selected_hospitals: prev.selected_hospitals.filter(id => id !== hospital.id),
																				}))
																			}
																		}}
																		className="h-5 w-5 rounded accent-[#E91E63]"
																	/>
																	<div className="flex-1">
																		<p className="font-medium text-white">{hospital.name}</p>
																		<p className="text-xs text-pink-100/70">{hospital.city} • {hospital.hospital_type}</p>
																	</div>
																</label>
															))}
														</div>
													)}
												</section>

												{/* Medical Student Donation */}
												<section className="rounded-2xl border border-[#E91E63]/40 bg-gradient-to-br from-[#1A1A2E] to-[#131326] p-6">
													<label className="flex items-start gap-3">
														<input
															type="checkbox"
															checked={form.medical_student_donation}
															onChange={(e) => setForm((prev) => ({ ...prev, medical_student_donation: e.target.checked }))}
															className="mt-1 h-5 w-5 rounded accent-[#E91E63]"
														/>
														<div className="flex-1">
															<h3 className="text-lg font-semibold text-white">Body Donation for Medical Students</h3>
															<p className="mt-2 text-sm text-pink-100/80">
																I am willing to donate my body for medical students to study after my death. This helps advance medical education and research.
															</p>
														</div>
													</label>
												</section>

												{/* Living Kidney Donation */}
												{selectedOrgansSet.has("KIDNEYS") && (
													<section className="rounded-2xl border border-[#E91E63]/40 bg-gradient-to-br from-[#1A1A2E] to-[#131326] p-6">
														<label className="flex items-start gap-3">
															<input
																type="checkbox"
																checked={form.living_kidney_donation}
																onChange={(e) => setForm((prev) => ({ ...prev, living_kidney_donation: e.target.checked }))}
																className="mt-1 h-5 w-5 rounded accent-[#E91E63]"
															/>
															<div className="flex-1">
																<div className="flex items-center justify-between">
																	<h3 className="text-lg font-semibold text-white">Living Kidney Donation</h3>
																	<span className="rounded-full bg-[#E91E63]/20 px-3 py-1 text-xs font-semibold text-[#E91E63]">
																		Compensation Available
																	</span>
																</div>
																<p className="mt-2 text-sm text-pink-100/80">
																	I am willing to donate a kidney while alive (living donor program).
																</p>
															</div>
														</label>
													</section>
												)}

												{/* Consents */}
												<section className="space-y-4">
													<label className="flex items-start gap-3 rounded-2xl border border-[#F6D6E3]/20 bg-[#1A1A2E] p-5 text-sm text-pink-100/80">
														<input
															type="checkbox"
															checked={form.post_mortem_consent}
															onChange={(e) => setForm((prev) => ({ ...prev, post_mortem_consent: e.target.checked }))}
															className="mt-1 h-5 w-5 rounded accent-[#E91E63] focus:ring-[#E91E63]"
														/>
														<span>
															<strong className="text-white">Post-Mortem Organ Donation Consent:</strong> I consent to donate my organs after my death. I understand that this is a registration of intent, and final donation is governed by applicable laws and family consent.
														</span>
													</label>
													<label className="flex items-start gap-3 rounded-2xl border border-[#F6D6E3]/20 bg-[#1A1A2E] p-5 text-sm text-pink-100/80">
														<input
															type="checkbox"
															checked={form.family_responsibility}
															onChange={(e) => setForm((prev) => ({ ...prev, family_responsibility: e.target.checked }))}
															className="mt-1 h-5 w-5 rounded accent-[#E91E63] focus:ring-[#E91E63]"
														/>
														<span>
															<strong className="text-white">Family/Relative Responsibility:</strong> I authorize my family members or designated relatives to take responsibility for organ donation in case of my death.
														</span>
													</label>
													<label className="flex items-start gap-3 rounded-2xl border border-[#F6D6E3]/20 bg-[#1A1A2E] p-5 text-sm text-pink-100/80">
														<input
															type="checkbox"
															checked={form.acknowledgement}
															onChange={(e) => setForm((prev) => ({ ...prev, acknowledgement: e.target.checked }))}
															className="mt-1 h-5 w-5 rounded accent-[#E91E63] focus:ring-[#E91E63]"
														/>
														<span>
															I understand that this is a registration of intent, and final donation is governed by applicable laws and family consent.
														</span>
													</label>
												</section>

												<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
													<button
														type="submit"
														disabled={isSubmitting || !form.post_mortem_consent || !form.acknowledgement}
														className="inline-flex h-12 items-center justify-center rounded-xl bg-[#E91E63] px-6 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
													>
														{isSubmitting ? (
															<>
																<span className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
																Processing Secure Pledge...
															</>
														) : pledgeStatus ? (
															"Update Pledge"
														) : (
															"Commit to Donate (Secure)"
														)}
													</button>
													<button
														type="button"
														onClick={resetForm}
														className="h-12 rounded-xl border border-[#F6D6E3]/40 px-6 text-sm font-semibold text-pink-100 transition hover:bg-white/10"
													>
														Reset
													</button>
												</div>
											</form>
										) : (
											<div className="mt-8 space-y-6">
												<div className="rounded-3xl border border-[#E91E63]/50 bg-gradient-to-br from-[#1A1A2E] to-[#131326] p-6 shadow-[0_20px_45px_rgba(233,30,99,0.25)]">
													<p className="text-xs uppercase tracking-wide text-pink-100/60">Current Status</p>
													<h3 className="mt-3 text-3xl font-bold text-white uppercase tracking-tighter">
														{pledgeStatus.status === 'ACCEPTED' ? 'PLEDGE ACCEPTED' :
															pledgeStatus.status === 'REJECTED' ? 'PLEDGE REJECTED' :
																pledgeStatus.status === 'COMPLETED' ? 'PLEDGE FULFILLED' :
																	'PLEDGED'}
													</h3>
													<p className="mt-2 text-sm text-pink-100/80">
														{pledgeStatus.status === 'ACCEPTED'
															? "A medical center has reviewed and accepted your selfless pledge. Thank you for your commitment to saving lives."
															: pledgeStatus.status === 'REJECTED'
																? "The hospital has reviewed your report but could not accept it at this time. You can review your details and try again."
																: pledgeStatus.status === 'COMPLETED'
																	? "This pledge has been fulfilled. The donor has given the ultimate gift of life. Thank you."
																	: "Thank you for the hope you've registered. Hospitals will reference this pledge with your family's consent."
														}
													</p>
													{pledgeStatus.status === 'ACCEPTED' && pledgeStatus.hospital_message && (
														<div className="mt-4 p-4 rounded-2xl bg-white/5 border border-white/10 italic text-sm text-pink-100/90">
															<p className="text-[10px] uppercase font-bold text-pink-100/40 not-italic mb-2 tracking-widest">Message from Hospital</p>
															"{pledgeStatus.hospital_message}"
														</div>
													)}
													{pledgeStatus.status === 'REJECTED' && (
														<div className="mt-6 flex gap-4">
															<button
																onClick={resetForm}
																className="rounded-xl bg-[#E91E63] px-6 py-2 text-xs font-bold text-white uppercase tracking-widest"
															>
																Re-Pledge Now
															</button>
														</div>
													)}
													<div className="mt-6 grid gap-4 sm:grid-cols-2">
														<div className="rounded-2xl border border-[#F6D6E3]/20 bg-[#131326] p-4">
															<p className="text-xs uppercase tracking-wide text-pink-100/50">Organs Registered</p>
															<p className="mt-2 text-base font-medium text-white">{pledgeOrgansDisplay}</p>
														</div>
														{pledgeStatus?.pledge_report && (
															<div className="rounded-2xl border border-[#F6D6E3]/20 bg-[#131326] p-4 sm:col-span-2">
																<p className="text-xs uppercase tracking-wide text-pink-100/50">Secure Details</p>
																<div className="mt-2 flex items-center justify-between">
																	<span className="flex items-center gap-2 rounded-full bg-green-500/20 px-3 py-1 text-xs font-semibold text-green-400">
																		<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
																			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
																		</svg>
																		Blockchain Verified
																	</span>
																	<a
																		href={pledgeStatus.pledge_report}
																		target="_blank"
																		rel="noopener noreferrer"
																		className="flex items-center text-sm font-medium text-[#E91E63] hover:text-[#D81B60]"
																	>
																		<svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
																			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
																		</svg>
																		Download Secure Report
																	</a>
																</div>
															</div>
														)}
														<div className="rounded-2xl border border-[#F6D6E3]/20 bg-[#131326] p-4">
															<p className="text-xs uppercase tracking-wide text-pink-100/50">Pledge Date</p>
															<p className="mt-2 text-base font-medium text-white">
																{pledgeStatus?.created_at ? (() => {
																	const d = new Date(pledgeStatus.created_at);
																	return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
																})() : "Not recorded"}
															</p>
														</div>
														{pledgeStatus?.living_kidney_donation && (
															<div className="rounded-2xl border border-[#E91E63]/40 bg-[#131326] p-4 sm:col-span-2">
																<p className="text-xs uppercase tracking-wide text-pink-100/50">Living Kidney Donation</p>
																<p className="mt-2 text-base font-medium text-[#E91E63]">Registered</p>
															</div>
														)}
														{pledgeStatus?.medical_student_donation && (
															<div className="rounded-2xl border border-[#E91E63]/40 bg-[#131326] p-4 sm:col-span-2">
																<p className="text-xs uppercase tracking-wide text-pink-100/50">Medical Student Donation</p>
																<p className="mt-2 text-base font-medium text-[#E91E63]">Registered</p>
															</div>
														)}
													</div>

													<div className="mt-8 flex flex-col gap-4">
														<button
															onClick={() => setIsEditing(true)}
															className="w-full rounded-2xl bg-[#E91E63] py-4 text-sm font-bold text-white shadow-lg transition hover:bg-[#D81B60] uppercase tracking-widest"
														>
															Modify Pledge
														</button>

														<button
															onClick={() => {
																if (confirm("Are you sure you want to cancel your organ donor pledge? This will remove your record from our registry.")) {
																	handleCancelPledge();
																}
															}}
															className="w-full rounded-2xl border border-red-500/30 py-4 text-sm font-bold text-red-400 transition hover:bg-red-500/10 uppercase tracking-widest"
														>
															Cancel Pledge
														</button>
													</div>
												</div>
											</div>
										)}
									</div>

									<aside className="space-y-6">
										{/* Urgent Needs */}
										<div className="rounded-3xl border border-[#DC2626]/40 bg-[#131326] p-8 shadow-[0_15px_40px_rgba(220,38,38,0.25)]">
											<div className="flex items-center justify-between">
												<h2 className="text-lg font-semibold text-white">Urgent Organ Needs</h2>
												<span className="rounded-full bg-[#DC2626]/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#F87171]">
													Live Feed
												</span>
											</div>
											<p className="mt-2 text-sm text-[#FECACA]">
												These patients need life-saving organ transplants.
											</p>
											<div className="mt-6 space-y-5">
												{urgentNeeds.length === 0 ? (
													<p className="text-sm text-pink-100/70">No urgent needs at the moment.</p>
												) : (
													urgentNeeds.map((need) => (
														<div key={need.id} className="rounded-2xl border border-[#DC2626]/40 bg-[#1A1A2E] p-5">
															<h3 className="text-lg font-semibold text-white">{need.patient_name || need.need_type}</h3>
															<ul className="mt-3 space-y-1 text-sm text-[#FECACA]/90">
																{need.hospital?.name && (
																	<li><span className="text-[#FCA5A5]">Hospital:</span> {need.hospital.name}</li>
																)}
																{need.needed_by && (
																	<li>
																		<span className="text-[#FCA5A5]">Needed By:</span>{" "}
																		{new Date(need.needed_by).toLocaleDateString()}
																	</li>
																)}
															</ul>
														</div>
													))
												)}
											</div>
										</div>
									</aside>
								</div>
							)}

							{/* Deceased Donor Request Tab */}
							{activeTab === "deceased" && (
								<div className="rounded-3xl border border-[#F6D6E3]/30 bg-[#131326]/90 p-8">
									<h2 className="text-2xl font-semibold text-white mb-4">Deceased Donor Request</h2>
									<p className="text-sm text-pink-100/70 mb-6">
										If you have a relative or loved one who has passed away and was not registered as an organ donor, you can submit a request here to donate their organs.
									</p>
									<form onSubmit={handleDeceasedSubmit} className="space-y-6">
										{/* Requester Information */}
										<section className="rounded-2xl border border-[#F6D6E3]/20 bg-[#131326] p-6">
											<h3 className="text-lg font-semibold text-white mb-4">Your Information</h3>
											<div className="grid gap-4 sm:grid-cols-2">
												<div>
													<label className="block text-sm font-medium text-pink-100 mb-1">Your Name *</label>
													<input
														type="text"
														required
														value={deceasedForm.requester_name}
														readOnly
														tabIndex="-1"
														className="w-full rounded-lg border border-[#F6D6E3]/30 bg-[#131326] px-3 py-2 text-white/50 outline-none cursor-not-allowed select-none"
														title="Auto-filled from your profile"
													/>
												</div>
												<div>
													<label className="block text-sm font-medium text-pink-100 mb-1">Your Phone *</label>
													<input
														type="tel"
														required
														value={deceasedForm.requester_phone}
														readOnly
														tabIndex="-1"
														className="w-full rounded-lg border border-[#F6D6E3]/30 bg-[#131326] px-3 py-2 text-white/50 outline-none cursor-not-allowed select-none"
														title="Auto-filled from your profile"
													/>
												</div>
												<div>
													<label className="block text-sm font-medium text-pink-100 mb-1">Your Email</label>
													<input
														type="email"
														value={deceasedForm.requester_email}
														readOnly
														tabIndex="-1"
														className="w-full rounded-lg border border-[#F6D6E3]/30 bg-[#131326] px-3 py-2 text-white/50 outline-none cursor-not-allowed select-none"
														title="Auto-filled from your profile"
													/>
												</div>
												<div>
													<label className="block text-sm font-medium text-pink-100 mb-1">Relation to Deceased *</label>
													<select
														required
														value={deceasedForm.requester_relation}
														onChange={(e) => setDeceasedForm((prev) => ({ ...prev, requester_relation: e.target.value }))}
														className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
													>
														<option value="">Select</option>
														{RELATION_OPTIONS.map(rel => (
															<option key={rel.id} value={rel.id}>{rel.label}</option>
														))}
													</select>
												</div>
												<div className="sm:col-span-2">
													<label className="block text-sm font-medium text-pink-100 mb-1">Your Address</label>
													<textarea
														value={deceasedForm.requester_address}
														onChange={(e) => setDeceasedForm((prev) => ({ ...prev, requester_address: e.target.value }))}
														rows={2}
														className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
													/>
												</div>
											</div>
										</section>

										{/* Deceased Information */}
										<section className="rounded-2xl border border-[#F6D6E3]/20 bg-[#131326] p-6">
											<h3 className="text-lg font-semibold text-white mb-4">Deceased Person Information</h3>
											<div className="grid gap-4 sm:grid-cols-2">
												<div>
													<label className="block text-sm font-medium text-pink-100 mb-1">Deceased Name *</label>
													<input
														type="text"
														required
														value={deceasedForm.deceased_name}
														onChange={(e) => setDeceasedForm((prev) => ({ ...prev, deceased_name: e.target.value }))}
														className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
													/>
												</div>
												<div>
													<label className="block text-sm font-medium text-pink-100 mb-1">Date of Death *</label>
													<input
														type="date"
														required
														value={deceasedForm.deceased_date_of_death}
														onChange={(e) => setDeceasedForm((prev) => ({ ...prev, deceased_date_of_death: e.target.value }))}
														className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
													/>
												</div>
												<div>
													<label className="block text-sm font-medium text-pink-100 mb-1">Date of Birth</label>
													<input
														type="date"
														value={deceasedForm.deceased_date_of_birth}
														onChange={(e) => setDeceasedForm((prev) => ({ ...prev, deceased_date_of_birth: e.target.value }))}
														className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
													/>
												</div>
												<div>
													<label className="block text-sm font-medium text-pink-100 mb-1">Blood Group</label>
													<select
														value={deceasedForm.deceased_blood_group}
														onChange={(e) => setDeceasedForm((prev) => ({ ...prev, deceased_blood_group: e.target.value }))}
														className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
													>
														<option value="">Select</option>
														<option value="A+">A+</option>
														<option value="A-">A-</option>
														<option value="B+">B+</option>
														<option value="B-">B-</option>
														<option value="AB+">AB+</option>
														<option value="AB-">AB-</option>
														<option value="O+">O+</option>
														<option value="O-">O-</option>
													</select>
												</div>
												<div>
													<label className="block text-sm font-medium text-pink-100 mb-1">City *</label>
													<input
														type="text"
														required
														value={deceasedForm.deceased_city}
														onChange={(e) => setDeceasedForm((prev) => ({ ...prev, deceased_city: e.target.value }))}
														className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
													/>
												</div>
												<div className="sm:col-span-2">
													<label className="block text-sm font-medium text-pink-100 mb-1">Address</label>
													<textarea
														value={deceasedForm.deceased_address}
														onChange={(e) => setDeceasedForm((prev) => ({ ...prev, deceased_address: e.target.value }))}
														rows={2}
														className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
													/>
												</div>
											</div>
										</section>

										{/* Organs Available */}
										<section className="rounded-2xl border border-[#F6D6E3]/20 bg-[#131326] p-6">
											<h3 className="text-lg font-semibold text-white mb-4">Organs Available for Donation</h3>
											<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
												{ORGAN_OPTIONS.filter(o => o.id !== "ALL").map((organ) => (
													<label
														key={organ.id}
														className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition ${deceasedForm.organs_available.includes(organ.id)
															? "border-[#E91E63] bg-[#E91E63]/10"
															: "border-[#F6D6E3]/20 hover:border-[#E91E63]"
															}`}
													>
														<input
															type="checkbox"
															checked={deceasedForm.organs_available.includes(organ.id)}
															onChange={(e) => {
																if (e.target.checked) {
																	setDeceasedForm((prev) => ({
																		...prev,
																		organs_available: [...prev.organs_available, organ.id],
																	}))
																} else {
																	setDeceasedForm((prev) => ({
																		...prev,
																		organs_available: prev.organs_available.filter(id => id !== organ.id),
																	}))
																}
															}}
															className="h-5 w-5 rounded accent-[#E91E63]"
														/>
														<span className="text-sm text-white">{organ.label}</span>
													</label>
												))}
											</div>
										</section>

										{/* Hospital Selection */}
										<section className="rounded-2xl border border-[#F6D6E3]/20 bg-[#131326] p-6">
											<h3 className="text-lg font-semibold text-white mb-4">Select Hospitals/Centers</h3>
											<p className="text-sm text-pink-100/70 mb-4">
												Select registered hospitals or centers to receive this donation request.
											</p>
											{loadingHospitals ? (
												<div className="flex items-center justify-center py-8">
													<div className="h-6 w-6 animate-spin rounded-full border-2 border-[#E91E63] border-t-transparent" />
												</div>
											) : hospitals.length === 0 ? (
												<p className="text-sm text-pink-100/70 py-4">No registered hospitals available.</p>
											) : (
												<div className="space-y-2 max-h-64 overflow-y-auto">
													{hospitals.map((hospital) => (
														<label
															key={hospital.id}
															className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition ${deceasedForm.selected_hospitals.includes(hospital.id)
																? "border-[#E91E63] bg-[#E91E63]/10"
																: "border-[#F6D6E3]/20 hover:border-[#E91E63]"
																}`}
														>
															<input
																type="checkbox"
																checked={deceasedForm.selected_hospitals.includes(hospital.id)}
																onChange={(e) => {
																	if (e.target.checked) {
																		setDeceasedForm((prev) => ({
																			...prev,
																			selected_hospitals: [...prev.selected_hospitals, hospital.id],
																		}))
																	} else {
																		setDeceasedForm((prev) => ({
																			...prev,
																			selected_hospitals: prev.selected_hospitals.filter(id => id !== hospital.id),
																		}))
																	}
																}}
																className="h-5 w-5 rounded accent-[#E91E63]"
															/>
															<div className="flex-1">
																<p className="font-medium text-white">{hospital.name}</p>
																<p className="text-xs text-pink-100/70">{hospital.city} • {hospital.hospital_type}</p>
															</div>
														</label>
													))}
												</div>
											)}
										</section>

										{/* Medical Student Donation */}
										<section className="rounded-2xl border border-[#E91E63]/40 bg-gradient-to-br from-[#1A1A2E] to-[#131326] p-6">
											<label className="flex items-start gap-3">
												<input
													type="checkbox"
													checked={deceasedForm.medical_student_donation}
													onChange={(e) => setDeceasedForm((prev) => ({ ...prev, medical_student_donation: e.target.checked }))}
													className="mt-1 h-5 w-5 rounded accent-[#E91E63]"
												/>
												<div className="flex-1">
													<h3 className="text-lg font-semibold text-white">Body Donation for Medical Students</h3>
													<p className="mt-2 text-sm text-pink-100/80">
														Willing to donate the body for medical students to study.
													</p>
												</div>
											</label>
										</section>

										{/* Additional Information */}
										<section className="rounded-2xl border border-[#F6D6E3]/20 bg-[#131326] p-6">
											<h3 className="text-lg font-semibold text-white mb-4">Additional Information</h3>
											<div className="grid gap-4 sm:grid-cols-2">
												<div>
													<label className="block text-sm font-medium text-pink-100 mb-1">Hospital Name</label>
													<input
														type="text"
														value={deceasedForm.hospital_name}
														onChange={(e) => setDeceasedForm((prev) => ({ ...prev, hospital_name: e.target.value }))}
														className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
														placeholder="Hospital where death occurred"
													/>
												</div>
												<div>
													<label className="block text-sm font-medium text-pink-100 mb-1">Doctor Name</label>
													<input
														type="text"
														value={deceasedForm.doctor_name}
														onChange={(e) => setDeceasedForm((prev) => ({ ...prev, doctor_name: e.target.value }))}
														className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
													/>
												</div>
												<div className="sm:col-span-2">
													<label className="block text-sm font-medium text-pink-100 mb-1">Notes</label>
													<textarea
														value={deceasedForm.notes}
														onChange={(e) => setDeceasedForm((prev) => ({ ...prev, notes: e.target.value }))}
														rows={4}
														className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
														placeholder="Additional information about the deceased..."
													/>
												</div>
											</div>
										</section>

										<button
											type="submit"
											disabled={isSubmittingDeceased}
											className="w-full rounded-xl bg-[#E91E63] px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
										>
											{isSubmittingDeceased ? (
												<>
													<span className="mr-2 inline-block h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
													Submitting...
												</>
											) : (
												"Submit Request"
											)}
										</button>
									</form>

									{myDeceasedRequests.length > 0 && (
										<div className="mt-8">
											<h3 className="text-xl font-bold text-white mb-4">My Requests</h3>
											<div className="space-y-4">
												{myDeceasedRequests.map(req => (
													<div key={req.id} className="rounded-xl border border-[#F6D6E3]/20 bg-[#1A1A2E] p-4 flex justify-between items-center">
														<div>
															<p className="font-semibold text-white">{req.deceased_name}</p>
															<p className="text-sm text-pink-100/70">
																Status: <span className={`font-bold ${req.status === 'APPROVED' ? 'text-green-400' : req.status === 'CANCELLED' ? 'text-red-400' : 'text-yellow-400'}`}>{req.status}</span>
															</p>
															<p className="text-xs text-pink-100/50">Submitted: {new Date(req.created_at).toLocaleDateString()}</p>
														</div>
														{["PENDING"].includes(req.status) && (
															<button
																onClick={() => handleDeceasedCancel(req.id)}
																className="text-xs text-red-400 hover:text-red-300 underline"
															>
																Cancel Request
															</button>
														)}

														{req.status === "APPROVED" && (
															<div className="flex flex-col gap-2 items-end">
																<div className="text-right">
																	<p className="text-xs font-bold text-green-400 uppercase tracking-widest animate-pulse">
																		🚑 Ambulance Dispatched
																	</p>
																	<p className="text-[10px] text-pink-100/70">
																		From: {req.hospital_name || "Assigned Hospital"}
																	</p>
																</div>
																<div className="flex gap-2">
																	<button
																		onClick={() => handleConfirmAmbulance(req.id)}
																		className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-700 shadow-lg shadow-green-900/20"
																	>
																		Confirm Arrival
																	</button>
																	<button
																		onClick={() => handleDeceasedCancel(req.id)}
																		className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/10"
																	>
																		Decline
																	</button>
																</div>
															</div>
														)}
													</div>
												))}
											</div>
										</div>
									)}
								</div>
							)}

							{/* Emergency Cases Tab */}
							{activeTab === "emergencies" && (
								<div className="rounded-3xl border border-[#F6D6E3]/30 bg-[#131326]/90 p-8">
									<h2 className="text-2xl font-semibold text-white mb-4">Emergency Organ Needs</h2>
									<p className="text-sm text-pink-100/70 mb-6">
										These are urgent cases requiring immediate organ transplants.
									</p>
									<div className="space-y-4">
										{urgentNeeds.length === 0 ? (
											<div className="rounded-2xl border border-[#F6D6E3]/20 bg-[#131326] p-8 text-center">
												<p className="text-pink-100/70">No emergency cases at the moment.</p>
											</div>
										) : (
											urgentNeeds.map((need) => (
												<div key={need.id} className="rounded-2xl border border-[#DC2626]/40 bg-[#1A1A2E] p-6">
													<div className="flex items-start justify-between">
														<div className="flex-1">
															<h3 className="text-xl font-semibold text-white">{need.patient_name || "Urgent Organ Need"}</h3>
															{need.patient_details && (
																<p className="mt-2 text-sm text-pink-100/80">{need.patient_details}</p>
															)}
															<div className="mt-4 grid gap-2 sm:grid-cols-2">
																{need.hospital?.name && (
																	<div>
																		<span className="text-xs text-pink-100/60">Hospital:</span>
																		<p className="text-sm font-medium text-white">{need.hospital.name}</p>
																	</div>
																)}
																{need.needed_by && (
																	<div>
																		<span className="text-xs text-pink-100/60">Needed By:</span>
																		<p className="text-sm font-medium text-white">
																			{new Date(need.needed_by).toLocaleDateString()}
																		</p>
																	</div>
																)}
																{need.required_blood_group && (
																	<div>
																		<span className="text-xs text-pink-100/60">Blood Group:</span>
																		<p className="text-sm font-medium text-white">{need.required_blood_group}</p>
																	</div>
																)}
															</div>
														</div>
														<span className="ml-4 rounded-full bg-[#DC2626]/20 px-3 py-1 text-xs font-semibold uppercase text-[#F87171]">
															{need.status}
														</span>
													</div>
												</div>
											))
										)}
									</div>
								</div>
							)}

							{/* Accident Alerts Tab */}
							{activeTab === "accidents" && (
								<div className="rounded-3xl border border-[#F6D6E3]/30 bg-[#131326]/90 p-8">
									<h2 className="text-2xl font-semibold text-white mb-4">Nearby Accident Alerts</h2>
									<p className="text-sm text-pink-100/70 mb-6">
										Recent accidents in your area that may require organ donation assistance.
									</p>
									<div className="space-y-4">
										{accidentAlerts.length === 0 ? (
											<div className="rounded-2xl border border-[#F6D6E3]/20 bg-[#131326] p-8 text-center">
												<p className="text-pink-100/70">No accident alerts in your area at the moment.</p>
											</div>
										) : (
											accidentAlerts.map((alert) => (
												<div key={alert.id} className="rounded-2xl border border-[#F59E0B]/40 bg-[#1A1A2E] p-6">
													<div className="flex items-start justify-between">
														<div className="flex-1">
															<h3 className="text-xl font-semibold text-white">{alert.title}</h3>
															{alert.description && (
																<p className="mt-2 text-sm text-pink-100/80">{alert.description}</p>
															)}
															<div className="mt-4 grid gap-2 sm:grid-cols-2">
																<div>
																	<span className="text-xs text-pink-100/60">Location:</span>
																	<p className="text-sm font-medium text-white">{alert.location}, {alert.city}</p>
																</div>
																{alert.accident_time && (
																	<div>
																		<span className="text-xs text-pink-100/60">Time:</span>
																		<p className="text-sm font-medium text-white">
																			{new Date(alert.accident_time).toLocaleString()}
																		</p>
																	</div>
																)}
																{alert.hospital_referred?.name && (
																	<div>
																		<span className="text-xs text-pink-100/60">Hospital:</span>
																		<p className="text-sm font-medium text-white">{alert.hospital_referred.name}</p>
																	</div>
																)}
																{alert.contact_phone && (
																	<div>
																		<span className="text-xs text-pink-100/60">Contact:</span>
																		<p className="text-sm font-medium text-white">{alert.contact_phone}</p>
																	</div>
																)}
															</div>
														</div>
														<span className={`ml-4 rounded-full px-3 py-1 text-xs font-semibold uppercase ${alert.severity === "CRITICAL" ? "bg-[#DC2626]/20 text-[#F87171]" :
															alert.severity === "HIGH" ? "bg-[#F59E0B]/20 text-[#FBBF24]" :
																"bg-[#3B82F6]/20 text-[#93C5FD]"
															}`}>
															{alert.severity}
														</span>
													</div>
												</div>
											))
										)}
									</div>
								</div>
							)}
						</section>
					)}
				</div>
			</main>
		</>
	)
}
