import Head from "next/head"
import Link from "next/link"
import { useState, useEffect } from "react"
import { apiFetch } from "../../lib/api"

const DONATION_REQUESTS_STORAGE_KEY = "lifesaver:donation_requests"

export default function OrganDonation() {
	const [donationRequests, setDonationRequests] = useState([])
	const [deceasedRequests, setDeceasedRequests] = useState([])
	const [loadingRequests, setLoadingRequests] = useState(true)
	const [emergencyOrganNeeds, setEmergencyOrganNeeds] = useState([])

	async function loadDonationRequests() {
		try {
			const [requests, deceased, organNeeds, emergencyNeeds, publicOrganNeeds] = await Promise.all([
				apiFetch("/donation-requests/?donor=me&request_type=ORGAN"),
				apiFetch("/deceased-donor-requests/?user=me&status=COMPLETED"),
				apiFetch("/hospital-needs/?need_type=ORGAN"),
				apiFetch("/hospital-needs/?need_type=EMERGENCY"),
				apiFetch("/needs/?need_type=ORGAN&status=OPEN").catch(() => [])
			])
			setDonationRequests(requests)
			setDeceasedRequests(deceased)

			const combined = [
				...(Array.isArray(organNeeds) ? organNeeds.map(n => ({ ...n, isHospitalNeed: true })) : []),
				...(Array.isArray(emergencyNeeds) ? emergencyNeeds.map(n => ({ ...n, isHospitalNeed: true })) : []),
				...(Array.isArray(publicOrganNeeds) ? publicOrganNeeds : [])
			]
			setEmergencyOrganNeeds(combined)

			if (typeof window !== "undefined") {
				localStorage.setItem(DONATION_REQUESTS_STORAGE_KEY, JSON.stringify(requests))
			}
		} catch (error) {
			console.error("Failed to load requests:", error)
			if (typeof window !== "undefined") {
				const stored = localStorage.getItem(DONATION_REQUESTS_STORAGE_KEY)
				if (stored) {
					try {
						const requests = JSON.parse(stored)
						const filtered = requests.filter(r => r.request_type === "ORGAN")
						setDonationRequests(filtered)
					} catch (e) {
						setDonationRequests([])
					}
				}
			}
		} finally {
			setLoadingRequests(false)
		}
	}

	useEffect(() => {
		loadDonationRequests()

		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible") {
				loadDonationRequests()
			}
		}
		document.addEventListener("visibilitychange", handleVisibilityChange)

		const handleFocus = () => loadDonationRequests()
		window.addEventListener("focus", handleFocus)

		return () => {
			document.removeEventListener("visibilitychange", handleVisibilityChange)
			window.removeEventListener("focus", handleFocus)
		}
	}, [])

	const statusColors = {
		PENDING: "bg-yellow-500/10 text-yellow-300 border-yellow-500/40",
		ACCEPTED: "bg-green-500/10 text-green-300 border-green-500/40",
		REJECTED: "bg-red-500/10 text-red-300 border-red-500/40",
		COMPLETED: "bg-blue-500/10 text-blue-300 border-blue-500/40",
	}

	const statusLabels = {
		PENDING: "Pending",
		ACCEPTED: "Accepted",
		REJECTED: "Rejected",
		COMPLETED: "Completed",
		CANCELLED: "Cancelled",
	}

	return (
		<>
			<Head>
				<title>Organ Donation — LifeSaver Connect</title>
				<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@700;800&display=swap" rel="stylesheet" />
			</Head>
			<main className="min-h-screen bg-[#1A1A2E] text-white">
				<div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8 space-y-8">
					<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
						<div>
							<h1 className="text-3xl font-extrabold" style={{ fontFamily: "'Poppins', sans-serif" }}>Organ Donation</h1>
							<p className="mt-2 text-sm text-pink-100/80">Register your post-mortem organ pledge, update consents, and connect with verified centers.</p>
						</div>
						<div className="flex flex-wrap gap-3">
							<Link href="/register/organ" legacyBehavior>
								<a className="inline-flex items-center rounded-lg border border-[#F6D6E3]/40 px-5 py-3 text-sm font-semibold text-pink-100 transition hover:bg-white/10">Open Organ Pledge Flow</a>
							</Link>
						</div>
					</div>

					<div className="grid gap-6 md:grid-cols-2">
						{/* Left: Info Cards */}
						<div className="space-y-6">
							<div className="rounded-2xl border border-[#F6D6E3]/30 bg-[#131326] p-6 space-y-4">
								<h2 className="text-xl font-semibold text-white">What you can do</h2>
								<ul className="text-sm text-pink-100/80 space-y-3">
									<li className="flex items-start gap-2">
										<span className="text-[#E91E63] font-bold mt-0.5">•</span>
										<span>Select organs to pledge or choose all organs</span>
									</li>
									<li className="flex items-start gap-2">
										<span className="text-[#E91E63] font-bold mt-0.5">•</span>
										<span>Add family consent, emergency contact, and medical student donation</span>
									</li>
								</ul>
							</div>

							<div className="rounded-2xl border border-[#F6D6E3]/30 bg-[#131326] p-6 space-y-4">
								<h2 className="text-xl font-semibold text-white font-bold">Need a deceased donor form?</h2>
								<p className="text-sm text-pink-100/70">For relatives looking to notify hospitals about organ availability in emergency cases.</p>
								<Link href="/register/organ?tab=deceased" legacyBehavior>
									<a className="inline-flex text-sm text-[#4e7fff] font-bold hover:underline italic">Go to Deceased Donor Request Form →</a>
								</Link>
							</div>
						</div>

						{/* Right: Donation Requests Section */}
						<div className="rounded-2xl border border-[#F6D6E3] bg-[#131326] p-6 flex flex-col h-full shadow-xl">
							<div className="flex items-center justify-between mb-6">
								<h2 className="text-lg font-bold text-white uppercase tracking-tight">My Organ Pledges / Requests</h2>
								<div className="h-2 w-2 rounded-full bg-[#E91E63] animate-pulse"></div>
							</div>

							{loadingRequests ? (
								<div className="flex-1 flex items-center justify-center p-12">
									<div className="h-6 w-6 animate-spin rounded-full border-2 border-[#E91E63] border-t-transparent"></div>
								</div>
							) : donationRequests.length > 0 ? (
								<ul className="space-y-4 overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
									{donationRequests.map((request) => {
										const hospital = request.hospital || {}
										return (
											<li key={request.id} className="rounded-xl border border-[#F6D6E3]/20 bg-[#1A1A2E] p-4 group hover:border-[#F6D6E3]/40 transition">
												<div className="flex items-start justify-between">
													<div className="flex-1">
														<p className="font-bold text-white text-base group-hover:text-[#E91E63] transition">{hospital.name || "Hospital"}</p>
														<p className="mt-1 text-xs text-pink-100/60 font-medium">
															{hospital.city} {hospital.phone ? `• ${hospital.phone}` : ""}
														</p>
													</div>
													<div className="flex flex-col items-end gap-1.5 pt-0.5">
														<div className="text-[9px] uppercase tracking-tighter text-pink-100/40 font-black">Status</div>
														<span className={`rounded-md border px-3 py-1 text-[10px] font-black uppercase shadow-sm ${statusColors[request.status] || statusColors.PENDING}`}>
															{statusLabels[request.status] || "Pending"}
														</span>
													</div>
												</div>

												{/* Narrative/Note Section */}
												<div className="mt-4 pt-3 border-t border-[#F6D6E3]/5">
													{request.status === "PENDING" && (
														<p className="text-xs text-yellow-200/80 italic">⌛ Under clinical review by hospital staff.</p>
													)}
													{request.status === "ACCEPTED" && (
														<div className="space-y-1">
															<p className="text-xs text-green-300 font-bold flex items-center gap-1.5">
																<span className="text-[10px]">✓</span> Verified Organ Receiver
															</p>
															{request.notes && <p className="text-[11px] text-green-100/60 pl-4">{request.notes}</p>}
														</div>
													)}
													{request.status === "REJECTED" && (
														<div className="space-y-1">
															<p className="text-xs text-red-300 font-bold flex items-center gap-1.5">
																<span className="text-[10px]">✗</span> Hospital Rejection
															</p>
															{request.notes && <p className="text-[11px] text-red-100/60 pl-4">{request.notes}</p>}
														</div>
													)}
												</div>

												<p className="mt-3 text-[10px] text-pink-100/40 font-mono">
													REQUESTED:{' '}
													<span className="text-pink-100/60 font-sans">
														{new Date(request.created_at).toLocaleDateString()}
													</span>
												</p>
											</li>
										)
									})}
								</ul>
							) : (
								<div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-3">
									<div className="h-12 w-12 rounded-full bg-[#1A1A2E] flex items-center justify-center border border-dashed border-[#F6D6E3]/30">
										<p className="text-xl">📄</p>
									</div>
									<div>
										<p className="text-sm font-semibold text-pink-100/60">No active pledges found</p>
										<p className="text-xs text-pink-100/40 mt-1">Select a center to register your commitment.</p>
									</div>
								</div>
							)}
						</div>

						{/* New: Refer a Deceased Donor Card */}
						<div className="md:col-span-2 rounded-2xl border border-blue-500/30 bg-[#131326] p-8 shadow-2xl relative overflow-hidden group">
							<div className="absolute top-0 right-0 p-8 opacity-10 group-hover:rotate-12 transition-transform">
								<svg className="w-24 h-24 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
									<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm4.59-12.42L10 14.17l-2.59-2.58L6 13l4 4 8-8z" />
								</svg>
							</div>
							<div className="max-w-2xl relative">
								<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-widest mb-4">
									🕊️ Noble Act of Donation
								</div>
								<h2 className="text-2xl font-bold text-white mb-2">Refer a Deceased Donor</h2>
								<p className="text-pink-100/70 text-sm mb-6 leading-relaxed">
									If you know of someone who has passed away and expressed a wish to donate their organs, or if the family is willing to donate, please refer their details here. This helps hospitals respond instantly to save lives.
								</p>
								<div className="flex flex-wrap gap-4">
									<Link href="/register/organ?tab=deceased" legacyBehavior>
										<a className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2 uppercase tracking-tight">
											Refer Body Details 🏥
										</a>
									</Link>
									<div className="flex items-center gap-3 text-pink-100/40 text-xs italic bg-white/5 px-4 py-2 rounded-lg border border-white/5">
										<span>Required: Name, Phone & Location</span>
									</div>
								</div>
							</div>
						</div>

						{/* Deceased Donation History */}
						{deceasedRequests.length > 0 && (
							<div className="md:col-span-2 rounded-2xl border border-green-500/30 bg-[#131326] p-6 shadow-xl space-y-4">
								<div className="flex items-center gap-3">
									<h2 className="text-xl font-bold text-white uppercase tracking-tight">Deceased Donation History</h2>
									<span className="rounded-full bg-green-500/20 px-3 py-1 text-xs font-bold text-green-400">VERIFIED RECORDS</span>
								</div>

								<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
									{deceasedRequests.map((req) => (
										<div key={req.id} className="rounded-xl border border-green-500/20 bg-[#1A1A2E] p-5 hover:border-green-500/40 transition">
											<div className="flex justify-between items-start mb-2">
												<div>
													<p className="font-bold text-white text-lg">{req.deceased_name}</p>
													<p className="text-xs text-pink-100/60 font-mono mt-1">DOD: {req.deceased_date_of_death}</p>
												</div>
												<div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center text-green-400">
													<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
														<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
													</svg>
												</div>
											</div>

											<div className="space-y-2 mt-4">
												<div className="flex items-center justify-between text-xs">
													<span className="text-pink-100/50">Details Verified By:</span>
													<span className="text-white font-medium">{req.hospital_name || "Hospital"}</span>
												</div>
												<div className="flex items-center justify-between text-xs">
													<span className="text-pink-100/50">Organs Donated:</span>
													<span className="text-green-300 font-bold">{req.organs_available}</span>
												</div>
												<div className="flex items-center justify-between text-xs">
													<span className="text-pink-100/50">Completion Date:</span>
													<span className="text-white font-medium">{new Date(req.updated_at).toLocaleDateString()}</span>
												</div>
											</div>

											<div className="mt-4 pt-3 border-t border-white/5 text-center">
												<p className="text-[10px] text-green-400/80 italic">"Thank you for this noble gift of life."</p>
											</div>
										</div>
									))}
								</div>
							</div>
						)}
					</div>

					{/* Emergency Cases Section */}
					<div className="rounded-2xl border border-red-500/30 bg-[#131326] p-6 shadow-xl shadow-red-500/5">
						<div className="flex items-center justify-between mb-6">
							<h2 className="text-xl font-bold text-white flex items-center gap-2">
								<span className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
								Emergency Cases / Organ Needs
							</h2>
							<span className="text-[10px] font-black text-red-500 uppercase tracking-widest bg-red-500/10 px-2 py-0.5 rounded">Critical Only</span>
						</div>

						{emergencyOrganNeeds.length > 0 ? (
							<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
								{emergencyOrganNeeds.map((need) => (
									<div key={need.id} className="rounded-xl border border-white/5 bg-[#1A1A2E] p-4 hover:border-red-500/30 transition group">
										<div className="flex items-center justify-between mb-3">
											<span className="text-[10px] font-black text-red-400 bg-red-500/10 px-2 py-0.5 rounded uppercase">{need.need_type}</span>
											{need.isHospitalNeed ? (
												<span className="ml-2 text-[9px] font-bold text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded uppercase border border-purple-500/20">Hospital Request</span>
											) : (
												<span className="ml-2 text-[9px] font-bold text-red-300 bg-red-500/10 px-2 py-0.5 rounded uppercase border border-red-500/20">Public Appeal</span>
											)}
											<span className="text-[10px] text-pink-100/40">{new Date(need.created_at).toLocaleDateString()}</span>
										</div>
										<h3 className="font-bold text-white text-sm mb-1 group-hover:text-red-400 transition truncate">{need.hospital_name || need.hospital?.name}</h3>
										<p className="text-xs text-pink-100/60 mb-3 flex items-center gap-1">📍 {need.city}</p>
										<div className="p-2.5 rounded-lg bg-black/20 border border-white/5 mb-4">
											<p className="text-xs text-pink-100/70 line-clamp-2 italic">"{need.notes || need.patient_details || 'Critical requirement for urgent case.'}"</p>
										</div>
										<Link href={`/needs/${need.id}`} legacyBehavior>
											<a className="w-full py-2 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black rounded-lg flex items-center justify-center gap-2 transition-all uppercase shadow-lg shadow-red-600/20">
												Respond Now ↗
											</a>
										</Link>
									</div>
								))}
							</div>
						) : (
							<div className="rounded-xl border border-dashed border-white/5 p-8 text-center">
								<p className="text-sm text-pink-100/40">No critical organ or emergency needs found at this moment.</p>
							</div>
						)}
					</div>

					<div className="flex justify-center mt-8">
						<Link href="/donor/dashboard" legacyBehavior>
							<a className="inline-flex items-center rounded-lg border border-[#F6D6E3]/40 px-8 py-3 text-sm font-semibold text-pink-100 transition hover:bg-white/10">Back to Donor Hub</a>
						</Link>
					</div>
				</div>
			</main>

			<style jsx global>{`
				.custom-scrollbar::-webkit-scrollbar { width: 4px; }
				.custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); }
				.custom-scrollbar::-webkit-scrollbar-thumb { background: #E91E63; border-radius: 10px; }
			`}</style>
		</>
	)
}
