import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import { useEffect, useMemo, useState } from "react"
import { apiFetch } from "../../lib/api"
import { validatePhone, validateDateNotInFuture } from "../../lib/validation"

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
	health_certificate: null,
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

					if (!cancelled && profile) {
						setPledgeStatus(profile)
						setForm({
							organs_to_donate: profile.organs ? profile.organs.split(",") : [],
							acknowledgement: profile.consent_provided || false,
							post_mortem_consent: profile.post_mortem_consent || false,
							family_responsibility: profile.family_responsibility || false,
							living_kidney_donation: profile.living_kidney_donation || false,
							medical_student_donation: profile.medical_student_donation || false,
							selected_hospitals: profile.selected_hospitals?.map(h => h.id) || [],
							date_of_birth: profile.date_of_birth || "",
							// Fallback to user profile if organ profile fields are empty
							blood_group: profile.blood_group || userProfile?.blood_group || "",
							phone: profile.phone || userProfile?.phone || "",
							address: profile.address || "",
							emergency_contact_name: profile.emergency_contact_name || "",
							emergency_contact_phone: profile.emergency_contact_phone || "",
							emergency_contact_relation: profile.emergency_contact_relation || "",
						})
					} else if (!cancelled && userProfile) {
						// Profile doesn't exist, pre-fill from user profile
						setForm(prev => ({
							...prev,
							blood_group: userProfile.blood_group || "",
							phone: userProfile.phone || "",
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
		return () => { cancelled = true }
	}, [isAuthenticated, userLocation])

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

			setPledgeStatus(response)
			setIsEditing(false)
			setFeedback({
				type: "success",
				message: "Pledge Registered! Thank you for giving the Gift of Life.",
			})
		} catch (error) {
			setFeedback({
				type: "error",
				message: error.message || "Registration failed. Please try again.",
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
			const { jsPDF } = await import("jspdf");
			const doc = new jsPDF({
				orientation: "portrait",
				unit: "mm",
				format: "a4"
			});

			const margin = 20;
			const pageWidth = doc.internal.pageSize.getWidth();
			const pageHeight = doc.internal.pageSize.getHeight();

			// --- Official Background ---
			doc.setFillColor(255, 255, 255);
			doc.rect(0, 0, pageWidth, pageHeight, "F");

			// Border
			doc.setDrawColor(233, 30, 99);
			doc.setLineWidth(1);
			doc.rect(margin, margin, pageWidth - (margin * 2), pageHeight - (margin * 2), "S");

			// --- Header ---
			doc.setFillColor(26, 26, 46); // Dark primary
			doc.rect(margin, margin, pageWidth - (margin * 2), 40, "F");

			doc.setFontSize(24);
			doc.setTextColor(255, 255, 255);
			doc.setFont("helvetica", "bold");
			doc.text("LIFESAVER CONNECT", margin + 10, margin + 20);

			doc.setFontSize(14);
			doc.setTextColor(233, 30, 99); // Pink
			doc.text("OFFICIAL ORGAN DONATION PLEDGE", margin + 10, margin + 30);

			doc.setFontSize(10);
			doc.setTextColor(255, 255, 255);
			doc.text(`Pledge ID: #${pledgeStatus?.id || "PENDING"}`, pageWidth - margin - 10, margin + 20, { align: "right" });
			doc.text(`Date: ${new Date().toLocaleDateString()}`, pageWidth - margin - 10, margin + 30, { align: "right" });

			let yPos = margin + 55;

			// --- Donor Details ---
			doc.setFontSize(16);
			doc.setTextColor(26, 26, 46);
			doc.setFont("helvetica", "bold");
			doc.text("I. DONOR INFORMATION", margin + 10, yPos);

			doc.setDrawColor(200, 200, 200);
			doc.setLineWidth(0.5);
			doc.line(margin + 10, yPos + 3, pageWidth - margin - 10, yPos + 3);

			yPos += 15;
			doc.setFontSize(11);
			doc.setFont("helvetica", "normal");
			doc.setTextColor(60, 60, 60);

			const details = [
				{ label: "Blood Group", value: form.blood_group || "N/A" },
				{ label: "Date of Birth", value: form.date_of_birth || "N/A" },
				{ label: "Phone", value: form.phone || "N/A" },
				{ label: "Address", value: doc.splitTextToSize(form.address || "N/A", 100) },
			];

			details.forEach(item => {
				doc.setFont("helvetica", "bold");
				doc.text(`${item.label}:`, margin + 15, yPos);
				doc.setFont("helvetica", "normal");
				if (Array.isArray(item.value)) {
					doc.text(item.value, margin + 60, yPos);
					yPos += (item.value.length * 6) + 4;
				} else {
					doc.text(item.value, margin + 60, yPos);
					yPos += 8;
				}
			});

			yPos += 10;
			// --- Emergency Contact ---
			doc.setFontSize(16);
			doc.setTextColor(26, 26, 46);
			doc.setFont("helvetica", "bold");
			doc.text("II. EMERGENCY CONTACT", margin + 10, yPos);
			doc.line(margin + 10, yPos + 3, pageWidth - margin - 10, yPos + 3);

			yPos += 15;
			doc.setFontSize(11);
			doc.setFont("helvetica", "normal");

			doc.setFont("helvetica", "bold");
			doc.text("Name:", margin + 15, yPos);
			doc.setFont("helvetica", "normal");
			doc.text(form.emergency_contact_name || "N/A", margin + 60, yPos);

			yPos += 8;
			doc.setFont("helvetica", "bold");
			doc.text("Phone:", margin + 15, yPos);
			doc.setFont("helvetica", "normal");
			doc.text(form.emergency_contact_phone || "N/A", margin + 60, yPos);

			yPos += 8;
			doc.setFont("helvetica", "bold");
			doc.text("Relation:", margin + 15, yPos);
			doc.setFont("helvetica", "normal");
			doc.text(form.emergency_contact_relation || "N/A", margin + 60, yPos);


			yPos += 20;
			// --- Pledge Details ---
			doc.setFontSize(16);
			doc.setTextColor(26, 26, 46);
			doc.setFont("helvetica", "bold");
			doc.text("III. PLEDGE COMMITMENT", margin + 10, yPos);
			doc.line(margin + 10, yPos + 3, pageWidth - margin - 10, yPos + 3);

			yPos += 15;
			doc.setFillColor(233, 30, 99, 0.1); // Light pink
			doc.setDrawColor(233, 30, 99);
			doc.roundedRect(margin + 10, yPos - 5, pageWidth - (margin * 2) - 20, 30, 2, 2, "FD");

			doc.setFontSize(12);
			doc.setTextColor(233, 30, 99);
			doc.text("Organs Pledged:", margin + 20, yPos + 5);

			const organsList = form.organs_to_donate.includes("ALL") ? "ALL ORGANS" : form.organs_to_donate.join(", ");
			doc.setFontSize(14);
			doc.setTextColor(26, 26, 46);
			doc.text(organsList, margin + 20, yPos + 15);

			yPos += 40;
			// --- Declaration ---
			doc.setFontSize(10);
			doc.setTextColor(100, 100, 100);
			const declaration = "I hereby pledge to donate my organs after my death for therapeutic purposes. I understand that this pledge is voluntary and can be withdrawn at any time. I have informed my family about this decision.";
			const splitDec = doc.splitTextToSize(declaration, pageWidth - (margin * 2) - 20);
			doc.text(splitDec, margin + 10, yPos);

			// --- Signatures ---
			const sealY = pageHeight - margin - 50;

			// Seal
			const sealX = pageWidth - margin - 40;
			doc.setDrawColor(233, 30, 99);
			doc.setLineWidth(1.5);
			doc.circle(sealX, sealY, 18, "S");
			doc.circle(sealX, sealY, 16, "S");
			doc.setFontSize(8);
			doc.setTextColor(233, 30, 99);
			doc.setFont("helvetica", "bold");
			doc.text("LIFESAVER", sealX, sealY - 8, { align: "center" });
			doc.text("REGISTERED", sealX, sealY + 10, { align: "center" });
			doc.setFontSize(6);
			doc.text("VERIFIED PLEDGE", sealX, sealY, { align: "center" });

			// Donor Sig
			doc.setDrawColor(0, 0, 0);
			doc.setLineWidth(0.5);
			doc.line(margin + 10, sealY + 10, margin + 70, sealY + 10);
			doc.setFontSize(10);
			doc.setTextColor(0, 0, 0);
			doc.text("Donor Signature", margin + 40, sealY + 16, { align: "center" });

			doc.save("Organ_Donation_Pledge_Report.pdf");

		} catch (err) {
			console.error(err);
			alert("Error generating report. Please try again.");
		}
	}
	function startEditing() {
		if (!pledgeStatus) return
		setIsEditing(true)
		setFeedback(null)
		setShowCancelConfirm(false)
	}

	function resetForm() {
		setForm(DEFAULT_FORM)
		setFeedback(null)
		if (!pledgeStatus) {
			setIsEditing(true)
		}
	}

	async function confirmCancelPledge() {
		setIsCancelling(true)
		setFeedback(null)
		try {
			if (pledgeStatus) {
				// Delete via the me endpoint or direct ID
				await apiFetch(`/organ-donors/${pledgeStatus.id}/`, {
					method: "DELETE",
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
												<p className="text-sm text-sky-100/70">
													Update your commitment at any time. Verified transplant centres access this data securely with family approval.
												</p>
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
													<button
														type="button"
														onClick={generatePledgeReport}
														className="inline-flex items-center rounded-lg border border-[#E91E63] px-4 py-2 text-sm font-semibold text-[#E91E63] transition hover:bg-[#E91E63]/10"
													>
														Download Report
													</button>
													<button
														type="button"
														onClick={async () => {
															try {
																const res = await apiFetch("/organ-donors/me/notify_contact/", { method: "POST" });
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
														onClick={async () => {
															try {
																const res = await apiFetch("/organ-donors/me/notify_hospitals/", { method: "POST" });
																setFeedback({ type: "success", message: res.message });
															} catch (err) {
																setFeedback({ type: "error", message: err.message || "Failed to transmit report to hospitals." });
															}
														}}
														className="inline-flex items-center rounded-lg border border-green-500/50 px-4 py-2 text-sm font-semibold text-green-300 transition hover:bg-green-500/10"
													>
														Send to Hospital
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
																onChange={(e) => setForm((prev) => ({ ...prev, date_of_birth: e.target.value }))}
																className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
															/>
														</div>
														<div>
															<label className="block text-sm font-medium text-pink-100 mb-1">Blood Group</label>
															<input
																type="text"
																value={form.blood_group}
																readOnly
																className="w-full rounded-lg border border-[#F6D6E3]/30 bg-[#131326] px-3 py-2 text-white/70 outline-none cursor-not-allowed"
																title="Managed via your Profile"
															/>
														</div>
														<div>
															<label className="block text-sm font-medium text-pink-100 mb-1">Phone</label>
															<input
																type="tel"
																value={form.phone}
																readOnly
																className="w-full rounded-lg border border-[#F6D6E3]/30 bg-[#131326] px-3 py-2 text-white/70 outline-none cursor-not-allowed"
																title="Managed via your Profile"
															/>
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

												{/* Health Certificate */}
												<section className="rounded-2xl border border-[#F6D6E3]/20 bg-[#131326] p-6">
													<h3 className="text-lg font-semibold text-white mb-2">Health Certificate</h3>
													<p className="text-sm text-pink-100/70 mb-4">
														Upload your health certificate to verify your eligibility for organ donation.
													</p>
													<label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#F6D6E3]/40 bg-[#1A1A2E] p-6 transition hover:border-[#E91E63]">
														<input
															type="file"
															accept=".pdf,.jpg,.jpeg,.png"
															onChange={(e) => setForm((prev) => ({ ...prev, health_certificate: e.target.files[0] }))}
															className="hidden"
														/>
														<svg className="h-12 w-12 text-[#E91E63]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
														</svg>
														<p className="mt-2 text-sm text-pink-100/80">
															{form.health_certificate ? form.health_certificate.name : "Click to upload health certificate"}
														</p>
														<p className="mt-1 text-xs text-pink-100/60">PDF, JPG, or PNG (Max 5MB)</p>
													</label>
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
																{pledgeStatus ? "Updating..." : "Submitting..."}
															</>
														) : pledgeStatus ? (
															"Update Pledge"
														) : (
															"Commit to Donate"
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
													<h3 className="mt-3 text-3xl font-bold text-white">PLEDGED</h3>
													<p className="mt-2 text-sm text-pink-100/80">
														Thank you for the hope you've registered. Hospitals will reference this pledge with your family's consent.
													</p>
													<div className="mt-6 grid gap-4 sm:grid-cols-2">
														<div className="rounded-2xl border border-[#F6D6E3]/20 bg-[#131326] p-4">
															<p className="text-xs uppercase tracking-wide text-pink-100/50">Organs Registered</p>
															<p className="mt-2 text-base font-medium text-white">{pledgeOrgansDisplay}</p>
														</div>
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
														onChange={(e) => setDeceasedForm((prev) => ({ ...prev, requester_name: e.target.value }))}
														className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
													/>
												</div>
												<div>
													<label className="block text-sm font-medium text-pink-100 mb-1">Your Phone *</label>
													<input
														type="tel"
														required
														value={deceasedForm.requester_phone}
														onChange={(e) => setDeceasedForm((prev) => ({ ...prev, requester_phone: e.target.value }))}
														className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
													/>
												</div>
												<div>
													<label className="block text-sm font-medium text-pink-100 mb-1">Your Email</label>
													<input
														type="email"
														value={deceasedForm.requester_email}
														onChange={(e) => setDeceasedForm((prev) => ({ ...prev, requester_email: e.target.value }))}
														className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
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
