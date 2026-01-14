import Head from "next/head"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { apiFetch } from "../../lib/api"

const DONATION_HISTORY_PLACEHOLDER = []
const DONOR_PROFILE_STORAGE_KEY = "lifesaver:donor_profile"

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
			const needs = await apiFetch("/needs/?need_type=PLATELETS&status=OPEN")
			setMatchedNeeds(needs || [])
		} catch {
			setMatchedNeeds([])
		}
	}, [])

	useEffect(() => {
		async function run() {
			setLoading(true)
			try {
				await loadProfile()
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
	const donorName = formatName(donor?.user)
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
							<Link href="/donor/donate" legacyBehavior>
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

							<div className="grid gap-6 md:grid-cols-3">
								<div className="rounded-2xl border border-[#F6D6E3] bg-[#131326] p-6 shadow-lg shadow-[#e91e6315]">
									<p className="text-sm text-pink-100/80">Platelet Donations Recorded</p>
									<h2 className="mt-3 text-2xl font-bold text-white">{totalPlateletDonations}</h2>
									<p className="mt-2 text-sm text-pink-100/70">
										Track apheresis donations; hospitals confirm each donation after review.
									</p>
								</div>
								<div className="rounded-2xl border border-[#F6D6E3] bg-[#131326] p-6 shadow-lg shadow-[#e91e6315] md:col-span-2">
									<p className="text-sm text-pink-100/80">Apheresis Readiness</p>
									<ul className="mt-2 text-sm text-pink-100/70 space-y-1">
										<li>• No aspirin/NSAIDs in the past 48 hours</li>
										<li>• Adequate platelet count and good hydration</li>
										<li>• Allow ~90 minutes for the session</li>
									</ul>
								</div>
							</div>

							<div className="grid gap-6 md:grid-cols-2">
								<div className="rounded-2xl border border-[#F6D6E3] bg-[#131326] p-6">
									<div className="flex items-center justify-between">
										<h2 className="text-lg font-semibold text-white">My Platelet Status</h2>
										<Link href="/register/donor" legacyBehavior>
											<a className="inline-flex rounded-lg border border-[#E91E63] px-4 py-2 text-sm font-medium text-[#E91E63] hover:bg-[#E91E63]/10 transition">
												Edit Profile
											</a>
										</Link>
									</div>

									{donor ? (
										<>
											<div className="mt-6 grid gap-4 sm:grid-cols-2">
												<div className="rounded-xl border border-[#F6D6E3]/30 bg-[#1A1A2E] p-4">
													<p className="text-xs uppercase tracking-wide text-pink-100/60">Name</p>
													<p className="mt-2 text-base font-medium text-white">{donorName || "Not provided"}</p>
												</div>
												<div className="rounded-xl border border-[#F6D6E3]/30 bg-[#1A1A2E] p-4">
													<p className="text-xs uppercase tracking-wide text-pink-100/60">Blood Group</p>
													<p className="mt-2 text-base font-medium text-white">{donor?.blood_group || "Not provided"}</p>
												</div>
												<div className="rounded-xl border border-[#F6D6E3]/30 bg-[#1A1A2E] p-4">
													<p className="text-xs uppercase tracking-wide text-pink-100/60">Platelet Donor</p>
													<p className="mt-2 text-base font-medium text-white">
														{donor && "is_platelet_donor" in donor ? (donor.is_platelet_donor ? "Yes" : "No") : "Not provided"}
													</p>
												</div>
												<div className="rounded-xl border border-[#F6D6E3]/30 bg-[#1A1A2E] p-4">
													<p className="text-xs uppercase tracking-wide text-pink-100/60">Last Donation</p>
													<p className="mt-2 text-base font-medium text-white">
														{donor?.last_donated_on ? new Date(donor.last_donated_on).toLocaleDateString() : "Not recorded"}
													</p>
												</div>
											</div>

											<div className="mt-6 rounded-xl border border-[#F6D6E3]/30 bg-[#1A1A2E] p-4">
												<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
													<div>
														<p className="text-xs uppercase tracking-wide text-pink-100/60">Availability</p>
														<p className="mt-1 text-base font-semibold text-white">
															{donor.is_available ? "Available for Platelet Alerts" : "Unavailable Right Now"}
														</p>
														<p className="mt-1 text-sm text-pink-100/70">
															{donor.is_available
																? "We'll notify you when platelet needs match."
																: "Switch availability back on to receive alerts."}
														</p>
													</div>
													<div className="flex flex-col items-start gap-3 sm:items-end">
														<button
															type="button"
															onClick={handleAvailabilityToggle}
															disabled={availabilitySaving}
															className="inline-flex items-center gap-2 rounded-lg border border-[#E91E63] px-4 py-2 text-sm font-medium text-[#E91E63] transition hover:bg-[#E91E63]/10 disabled:cursor-not-allowed disabled:opacity-60"
														>
															{availabilitySaving && (
																<span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
															)}
															{donor.is_available ? "Set as Unavailable" : "Set as Available"}
														</button>
														{availabilityError && <p className="max-w-xs text-sm text-rose-300">{availabilityError}</p>}
													</div>
												</div>
											</div>
										</>
									) : (
										<div className="mt-6 rounded-xl border border-dashed border-[#F6D6E3]/40 bg-[#1A1A2E] p-6 text-sm text-pink-100/70">
											Complete your donor profile to view and manage platelet status details.
										</div>
									)}
								</div>

								<div className="rounded-2xl border border-[#F6D6E3] bg-[#131326] p-6">
									<div className="flex items-center justify-between">
										<h2 className="text-lg font-semibold text-white">Matched Platelet Needs</h2>
										<Link href="/needs" legacyBehavior>
											<a className="text-sm text-[#E91E63]">View All</a>
										</Link>
									</div>
									{matchedNeeds.length ? (
										<ul className="mt-4 space-y-3">
											{matchedNeeds.map((need) => (
												<li key={need.id} className="rounded-xl border border-[#F6D6E3]/40 bg-[#1A1A2E] p-4">
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
													{need.description && (
														<p className="mt-2 line-clamp-3 text-sm text-pink-100/70">{need.description}</p>
													)}
												</li>
											))}
										</ul>
									) : (
										<div className="mt-4 rounded-xl border border-dashed border-[#F6D6E3]/40 bg-[#1A1A2E] p-6 text-sm text-pink-100/70">
											No matched platelet needs at the moment.
										</div>
									)}
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
		</>
	)
}

