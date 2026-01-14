import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import { useEffect, useMemo, useState } from "react"

import { apiFetch } from "../../lib/api"

const DONOR_PROFILE_STORAGE_KEY = "lifesaver:donor_profile"

function persistDonorProfile(profile) {
	if (typeof window === "undefined") return
	if (profile) {
		try {
			window.localStorage.setItem(DONOR_PROFILE_STORAGE_KEY, JSON.stringify(profile))
		} catch (error) {
			console.warn("Unable to persist donor profile", error)
		}
	} else {
		window.localStorage.removeItem(DONOR_PROFILE_STORAGE_KEY)
	}
}

const BLOOD_GROUPS = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"]

const INITIAL_FORM = {
	contactNumber: "",
	city: "",
	zipCode: "",
	bloodGroup: "O+",
	canDonatePlatelets: false,
	lastDonationDate: "",
	isAvailable: true,
}

export default function DonorProfile() {
	const router = useRouter()
	const [form, setForm] = useState(INITIAL_FORM)
	const [initialFormSnapshot, setInitialFormSnapshot] = useState(INITIAL_FORM)
	const [accountInfo, setAccountInfo] = useState({ name: "", username: "", email: "" })
	const [profileExists, setProfileExists] = useState(false)
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const [statusMessage, setStatusMessage] = useState(null)

	useEffect(() => {
		let isMounted = true

		async function loadProfile() {
			setLoading(true)
			try {
				const data = await apiFetch("/donors/me/")
				if (!isMounted) return
				setProfileExists(true)
				const hydratedForm = {
					contactNumber: data.phone || "",
					city: data.city || "",
					zipCode: data.zip_code || "",
					bloodGroup: data.blood_group || "O+",
					canDonatePlatelets: Boolean(data.is_platelet_donor),
					lastDonationDate: data.last_donated_on || "",
					isAvailable: Boolean(data.is_available),
				}
				setForm(hydratedForm)
				setInitialFormSnapshot(hydratedForm)
				const fullName = [data.user?.first_name, data.user?.last_name].filter(Boolean).join(" ")
				setAccountInfo({
					name: fullName || data.user?.username || "",
					username: data.user?.username || "",
					email: data.user?.email || "",
				})
				persistDonorProfile(data)
			} catch (error) {
				if (!isMounted) return
				if (error.status === 404) {
					setProfileExists(false)
					setStatusMessage({
						type: "info",
						text: "No donor profile found. Complete the form below to create one and start receiving matches.",
					})
					persistDonorProfile(null)
				} else if (error.status === 401) {
					setStatusMessage({
						type: "error",
						text: "Please log in to view or update your donor profile.",
					})
				} else {
					setStatusMessage({
						type: "error",
						text: error.message || "Unable to load donor profile. Please try again later.",
					})
				}
			} finally {
				if (isMounted) {
					setLoading(false)
				}
			}
		}

		loadProfile()

		return () => {
			isMounted = false
		}
	}, [])

	const isFormValid = useMemo(() => {
		if (!form.contactNumber.trim() || !form.city.trim() || !form.zipCode.trim()) {
			return false
		}
		if (form.lastDonationDate) {
			const selected = new Date(form.lastDonationDate)
			const today = new Date()
			if (Number.isNaN(selected.getTime()) || selected > today) {
				return false
			}
		}
		return true
	}, [form])

	const isDirty = useMemo(() => {
		return JSON.stringify(form) !== JSON.stringify(initialFormSnapshot)
	}, [form, initialFormSnapshot])

	function updateForm(field, value) {
		setForm((prev) => ({ ...prev, [field]: value }))
	}

	async function onSubmit(event) {
		event.preventDefault()
		setStatusMessage(null)

		if (!isFormValid) {
			setStatusMessage({
				type: "error",
				text: "Please fill in the required fields and make sure the donation date is valid.",
			})
			return
		}

		try {
			setSaving(true)
			const payload = {
				blood_group: form.bloodGroup,
				city: form.city,
				zip_code: form.zipCode,
				phone: form.contactNumber,
				is_platelet_donor: form.canDonatePlatelets,
				is_available: form.isAvailable,
				last_donated_on: form.lastDonationDate || null,
			}

			const method = profileExists ? "PATCH" : "PUT"
			const response = await apiFetch("/donors/me/", {
				method,
				body: JSON.stringify(payload),
			})

			setStatusMessage({
				type: "success",
				text: profileExists ? "Donor profile updated successfully." : "Donor profile created successfully.",
			})

			setProfileExists(true)
			const snapshot = {
				contactNumber: response.phone || "",
				city: response.city || "",
				zipCode: response.zip_code || "",
				bloodGroup: response.blood_group || "O+",
				canDonatePlatelets: Boolean(response.is_platelet_donor),
				lastDonationDate: response.last_donated_on || "",
				isAvailable: Boolean(response.is_available),
			}
			setForm(snapshot)
			setInitialFormSnapshot(snapshot)

			const fullName = [response.user?.first_name, response.user?.last_name].filter(Boolean).join(" ")
			setAccountInfo({
				name: fullName || response.user?.username || "",
				username: response.user?.username || "",
				email: response.user?.email || "",
			})
			persistDonorProfile(response)
		} catch (error) {
			setStatusMessage({
				type: "error",
				text: error.message || "Unable to save your donor profile. Please try again.",
			})
			if (error.status === 401) {
				setTimeout(() => {
					router.push("/auth/login?module=donor&next=/register/donor")
				}, 300)
			}
		} finally {
			setSaving(false)
		}
	}

	function resetForm() {
		setForm(initialFormSnapshot)
		setStatusMessage(null)
	}

	return (
		<>
			<Head>
				<title>{profileExists ? "Update Donor Profile" : "Register as Donor"} — LifeSaver Connect</title>
				<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@700;800&display=swap" rel="stylesheet" />
			</Head>
			<main className="min-h-screen bg-[#071325] text-white">
				<section className="relative">
					<div className="absolute inset-0 -z-10 overflow-hidden">
						<div className="absolute -top-32 -right-24 h-96 w-96 rounded-full bg-[#1B3C73] opacity-50 blur-3xl" />
						<div className="absolute top-64 -left-20 h-96 w-96 rounded-full bg-[#E91E63]/70 blur-3xl" />
					</div>

					<div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
						<header className="text-center">
							<h1 className="text-3xl md:text-4xl font-extrabold" style={{ fontFamily: "'Poppins', sans-serif" }}>
								{profileExists ? "Update Your Donor Profile" : "Blood & Platelet Donor Registration"}
							</h1>
							<p className="mt-2 text-sm text-[#d7dcff]">
								Keep these details current so we can send you the right matches and alerts in your area.
							</p>
							<div className="mt-4 flex flex-wrap justify-center gap-3 text-sm">
								<Link href="/auth/login" legacyBehavior>
									<a className="rounded-lg border border-[#E91E63] px-4 py-2 font-medium text-[#E91E63] hover:bg-[#E91E63]/10 transition">
										Log In
									</a>
								</Link>
								<Link href="/auth/register" legacyBehavior>
									<a className="rounded-lg border border-[#4e7fff] px-4 py-2 font-medium text-[#4e7fff] hover:bg-[#4e7fff]/10 transition">
										Create Basic Account
									</a>
								</Link>
							</div>
						</header>

						{accountInfo.username && (
							<div className="mt-8 rounded-3xl border border-[#1f2f51] bg-[#0c1b35]/70 p-6 shadow-lg backdrop-blur">
								<h2 className="text-xl font-semibold text-white">Account Summary</h2>
								<ul className="mt-4 space-y-2 text-sm text-[#d7dcff]">
									<li>
										<span className="text-[#8096d4]">Name:</span>{" "}
										<span className="font-medium text-white">{accountInfo.name || "Not provided"}</span>
									</li>
									<li>
										<span className="text-[#8096d4]">Username:</span>{" "}
										<span className="font-medium text-white">{accountInfo.username}</span>
									</li>
									<li>
										<span className="text-[#8096d4]">Email:</span>{" "}
										<span className="font-medium text-white">{accountInfo.email || "—"}</span>
									</li>
								</ul>
							</div>
						)}

						<form onSubmit={onSubmit} className="mt-10 space-y-8">
							<section className="rounded-3xl border border-[#1f2f51] bg-[#0c1b35]/70 p-6 shadow-lg backdrop-blur">
								<h2 className="text-xl font-semibold text-white">Donor Contact</h2>
								<p className="mt-1 text-sm text-[#d7dcff]">
									We share this information only with verified hospitals when a compatible request is made.
								</p>
								<div className="mt-6 grid gap-5 md:grid-cols-2">
									<div className="space-y-2">
										<label className="block text-sm font-medium text-[#d7dcff]">Contact Number</label>
										<input
											type="tel"
											required
											value={form.contactNumber}
											onChange={(event) => updateForm("contactNumber", event.target.value)}
											className="h-12 w-full rounded-lg border border-[#3a4f7a] bg-[#0b1730] px-3 text-sm text-white outline-none focus:border-[#4e7fff]"
											placeholder="10-15 digit phone number"
										/>
									</div>
									<div className="space-y-2">
										<label className="block text-sm font-medium text-[#d7dcff]">City</label>
										<input
											type="text"
											required
											value={form.city}
											onChange={(event) => updateForm("city", event.target.value)}
											className="h-12 w-full rounded-lg border border-[#3a4f7a] bg-[#0b1730] px-3 text-sm text-white outline-none focus:border-[#4e7fff]"
											placeholder="City or district"
										/>
									</div>
									<div className="space-y-2">
										<label className="block text-sm font-medium text-[#d7dcff]">Zip / Postal Code</label>
										<input
											type="text"
											required
											value={form.zipCode}
											onChange={(event) => updateForm("zipCode", event.target.value)}
											className="h-12 w-full rounded-lg border border-[#3a4f7a] bg-[#0b1730] px-3 text-sm text-white outline-none focus:border-[#4e7fff]"
											placeholder="Postal code"
										/>
									</div>
									<div className="space-y-2">
										<label className="block text-sm font-medium text-[#d7dcff]">Last Donation Date (optional)</label>
										<input
											type="date"
											value={form.lastDonationDate}
											onChange={(event) => updateForm("lastDonationDate", event.target.value)}
											className="h-12 w-full rounded-lg border border-[#3a4f7a] bg-[#0b1730] px-3 text-sm text-white outline-none focus:border-[#E91E63]"
										/>
									</div>
								</div>
							</section>

							<section className="rounded-3xl border border-[#1f2f51] bg-[#0c1b35]/70 p-6 shadow-lg backdrop-blur">
								<h2 className="text-xl font-semibold text-white">Donation Preferences</h2>
								<p className="mt-1 text-sm text-[#d7dcff]">
									Let hospitals know how you can help so we only send you relevant matches.
								</p>
								<div className="mt-6 grid gap-5 md:grid-cols-2">
									<div className="space-y-2">
										<label className="block text-sm font-medium text-[#d7dcff]">Blood Group</label>
										<select
											value={form.bloodGroup}
											onChange={(event) => updateForm("bloodGroup", event.target.value)}
											className="h-12 w-full rounded-lg border border-[#3a4f7a] bg-[#0b1730] px-3 text-sm text-white outline-none focus:border-[#E91E63]"
										>
											{BLOOD_GROUPS.map((group) => (
												<option key={group} value={group}>
													{group}
												</option>
											))}
										</select>
									</div>
									<label className="flex items-center gap-3 rounded-xl border border-[#3a4f7a] bg-[#0b1730] p-4 text-sm text-[#d7dcff]">
										<input
											type="checkbox"
											checked={form.canDonatePlatelets}
											onChange={(event) => updateForm("canDonatePlatelets", event.target.checked)}
											className="h-5 w-5 rounded accent-[#E91E63]"
										/>
										<span>I am willing to donate platelets.</span>
									</label>
									<label className="flex items-center justify-between rounded-xl border border-[#3a4f7a] bg-[#0b1730] p-4 text-sm text-[#d7dcff] md:col-span-2">
										<span>Receive Emergency Alerts (Availability)</span>
										<button
											type="button"
											onClick={() => updateForm("isAvailable", !form.isAvailable)}
											className={`relative h-6 w-11 rounded-full transition ${form.isAvailable ? "bg-[#4e7fff]" : "bg-slate-600"}`}
										>
											<span
												className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${form.isAvailable ? "left-5" : "left-0.5"}`}
											/>
										</button>
									</label>
								</div>
							</section>

							{statusMessage && (
								<div
									className={`rounded-2xl border px-4 py-3 text-sm ${
										statusMessage.type === "success"
											? "border-emerald-400 bg-emerald-500/10 text-emerald-200"
											: statusMessage.type === "info"
												? "border-[#4e7fff] bg-[#4e7fff]/10 text-[#d7dcff]"
												: "border-rose-400 bg-rose-500/10 text-rose-200"
									}`}
								>
									{statusMessage.text}
								</div>
							)}

							<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
								<button
									type="submit"
									disabled={saving || loading || !isFormValid || (!isDirty && profileExists)}
									className="flex h-12 w-full items-center justify-center rounded-xl bg-[#E91E63] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-8"
								>
									{saving ? (
										<>
											<span className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
											Saving…
										</>
									) : profileExists ? (
										"Save Changes"
									) : (
										"Create Donor Profile"
									)}
								</button>

								<button
									type="button"
									onClick={resetForm}
									disabled={!isDirty || saving}
									className="h-12 w-full rounded-xl border border-slate-500 bg-transparent px-6 font-semibold text-slate-200 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
								>
									Reset Changes
								</button>
							</div>
						</form>
					</div>
				</section>
			</main>
		</>
	)
}
