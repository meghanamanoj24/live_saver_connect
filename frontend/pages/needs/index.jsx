import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import { useCallback, useEffect, useState } from "react"
import { apiFetch } from "../../lib/api"

const DONOR_PROFILE_STORAGE_KEY = "lifesaver:donor_profile"

export default function NeedsList() {
	const router = useRouter()
	const [activeTab, setActiveTab] = useState("all") // 'all' or 'compatible'
	const [loading, setLoading] = useState(true)
	const [donorProfile, setDonorProfile] = useState(null)
	const [allNeeds, setAllNeeds] = useState([])
	const [compatibleNeeds, setCompatibleNeeds] = useState([])
	const [errorState, setErrorState] = useState(null)

	// Load donor profile to determine blood group compatibility
	const loadDonorProfile = useCallback(async () => {
		try {
			// Try API first
			const profile = await apiFetch("/donors/me/")
			setDonorProfile(profile)
			if (typeof window !== "undefined") {
				window.localStorage.setItem(DONOR_PROFILE_STORAGE_KEY, JSON.stringify(profile))
			}
			return profile
		} catch (err) {
			// Fallback to local storage
			if (typeof window !== "undefined") {
				const stored = window.localStorage.getItem(DONOR_PROFILE_STORAGE_KEY)
				if (stored) {
					try {
						const parsed = JSON.parse(stored)
						setDonorProfile(parsed)
						return parsed
					} catch {
						// ignore
					}
				}
			}
			return null
		}
	}, [])

	const fetchNeeds = useCallback(async () => {
		setLoading(true)
		setErrorState(null)
		try {
			const profile = await loadDonorProfile()

			// Fetch all active needs
			const allNeedsData = await apiFetch("/hospital-needs/?active_only=true&need_type=BLOOD")
			setAllNeeds(allNeedsData)

			// Fetch compatible needs if donor profile exists
			if (profile && profile.blood_group) {
				const compatibleData = await apiFetch(`/hospital-needs/?donor_blood_group=${profile.blood_group}&active_only=true&need_type=BLOOD`)
				setCompatibleNeeds(compatibleData)
				// Default to compatible tab if matches exist
				if (compatibleData.length > 0) {
					setActiveTab("compatible")
				}
			}
		} catch (err) {
			setErrorState({ message: err.message || "Failed to load donation requests." })
		} finally {
			setLoading(false)
		}
	}, [loadDonorProfile])

	useEffect(() => {
		fetchNeeds()
	}, [fetchNeeds])

	const displayNeeds = activeTab === "compatible" ? compatibleNeeds : allNeeds

	return (
		<>
			<Head>
				<title>Donation Requests — LifeSaver Connect</title>
			</Head>
			<main className="min-h-screen bg-[#1A1A2E] text-white">
				<header className="border-b border-[#F6D6E3]/30 bg-[#131326]/80 backdrop-blur sticky top-0 z-10">
					<div className="mx-auto flex items-center justify-between max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
						<div className="flex items-center gap-4">
							<Link href="/donor/blood" legacyBehavior>
								<a className="rounded-full p-2 hover:bg-white/5 transition text-pink-100/70 hover:text-white">
									<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
									</svg>
								</a>
							</Link>
							<h1 className="text-xl font-bold md:text-2xl" style={{ fontFamily: "'Poppins', sans-serif" }}>
								Donation Requests
							</h1>
						</div>
						<div className="flex gap-2">
							<Link href="/donor/donate" legacyBehavior>
								<a className="hidden sm:inline-flex rounded-lg bg-[#E91E63] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition">
									New Request
								</a>
							</Link>
						</div>
					</div>
				</header>

				<div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
					{/* Tabs */}
					<div className="flex space-x-1 rounded-xl bg-[#131326] p-1 mb-8 max-w-md">
						<button
							onClick={() => setActiveTab("all")}
							className={`w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition ${activeTab === "all"
									? "bg-[#E91E63] text-white shadow"
									: "text-pink-100/60 hover:bg-white/[0.12] hover:text-white"
								}`}
						>
							All Requests
						</button>
						<button
							onClick={() => setActiveTab("compatible")}
							className={`w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition relative ${activeTab === "compatible"
									? "bg-[#E91E63] text-white shadow"
									: "text-pink-100/60 hover:bg-white/[0.12] hover:text-white"
								}`}
						>
							Compatible Matches
							{compatibleNeeds.length > 0 && activeTab !== "compatible" && (
								<span className="absolute top-1 right-2 flex h-2.5 w-2.5">
									<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
									<span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
								</span>
							)}
						</button>
					</div>

					{/* Content */}
					{loading ? (
						<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
							{[1, 2, 3, 4, 5, 6].map((i) => (
								<div key={i} className="animate-pulse rounded-xl border border-[#F6D6E3]/20 bg-[#131326] p-6 h-64">
									<div className="h-4 bg-white/10 rounded w-3/4 mb-4"></div>
									<div className="h-4 bg-white/10 rounded w-1/2 mb-6"></div>
									<div className="space-y-2">
										<div className="h-3 bg-white/10 rounded"></div>
										<div className="h-3 bg-white/10 rounded"></div>
										<div className="h-3 bg-white/10 rounded w-5/6"></div>
									</div>
								</div>
							))}
						</div>
					) : errorState ? (
						<div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-center text-rose-200">
							<p className="font-medium">Something went wrong</p>
							<p className="text-sm mt-1 opacity-80">{errorState.message}</p>
							<button
								onClick={fetchNeeds}
								className="mt-4 px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 rounded-lg text-sm font-medium transition"
							>
								Try Again
							</button>
						</div>
					) : displayNeeds.length > 0 ? (
						<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
							{displayNeeds.map((need) => (
								<div key={need.id} className="group relative flex flex-col justify-between rounded-xl border border-[#F6D6E3]/20 bg-[#131326] p-6 transition hover:border-[#E91E63]/50 hover:shadow-lg hover:shadow-[#e91e6310]">
									<div>
										<div className="flex items-start justify-between mb-4">
											<div className="flex flex-wrap gap-2">
												<span className={`inline-flex items-center rounded px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${need.status === "URGENT"
														? "bg-red-500/20 text-red-300 border border-red-500/30"
														: "bg-blue-500/20 text-blue-300 border border-blue-500/30"
													}`}>
													{need.status || "NORMAL"}
												</span>
												{need.required_blood_group && (
													<span className="inline-flex items-center rounded bg-[#E91E63]/10 px-2.5 py-0.5 text-xs font-semibold text-[#E91E63] border border-[#E91E63]/20">
														{need.required_blood_group} Only
													</span>
												)}
											</div>
											{activeTab === "compatible" && (
												<span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500/20 text-green-400" title="Compatible Match">
													<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
													</svg>
												</span>
											)}
										</div>

										<h3 className="text-lg font-bold text-white mb-1 line-clamp-1">
											{need.title || need.need_type || "Blood Donation Need"}
										</h3>

										{need.hospital && (
											<div className="flex items-center gap-1.5 text-pink-100/70 mb-3 text-sm">
												<svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
												</svg>
												<span className="font-medium truncate">{need.hospital.name}</span>
											</div>
										)}

										{need.patient_details && (
											<p className="text-sm text-pink-100/60 line-clamp-3 mb-4">
												{need.patient_details}
											</p>
										)}

										<div className="space-y-2 mb-4">
											<div className="flex items-center justify-between text-sm">
												<span className="text-pink-100/50">Location</span>
												<span className="text-pink-100/80">{need.hospital?.city || "Unknown City"}</span>
											</div>
											{need.needed_by && (
												<div className="flex items-center justify-between text-sm">
													<span className="text-pink-100/50">Needed By</span>
													<span className="text-yellow-300">
														{new Date(need.needed_by).toLocaleDateString()}
													</span>
												</div>
											)}
										</div>
									</div>

									<div className="mt-4 pt-4 border-t border-white/5">
										<Link href={`/needs/${need.id}`} legacyBehavior>
											<a className="flex items-center justify-center w-full rounded-lg bg-white/5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#E91E63] hover:text-white group-hover:bg-[#E91E63]">
												View Details & Respond
											</a>
										</Link>
									</div>
								</div>
							))}
						</div>
					) : (
						<div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#F6D6E3]/20 bg-[#131326] p-12 text-center">
							<div className="rounded-full bg-white/5 p-4 mb-4">
								<svg className="w-8 h-8 text-pink-100/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
								</svg>
							</div>
							<h3 className="text-lg font-medium text-white">No requests found</h3>
							<p className="mt-1 text-sm text-pink-100/60 max-w-sm">
								{activeTab === "compatible"
									? "Great news! There are currently no urgent requests matching your blood group."
									: "There are no active donation requests at the moment."}
							</p>
							{activeTab === "compatible" && (
								<button
									onClick={() => setActiveTab("all")}
									className="mt-4 text-sm font-medium text-[#E91E63] hover:text-[#E91E63]/80 transition"
								>
									View all requests instead
								</button>
							)}
						</div>
					)}
				</div>
			</main>
		</>
	)
}
