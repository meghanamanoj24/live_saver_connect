import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import { useState, useEffect } from "react"
import { apiFetch } from "../../../lib/api"

export default function EventDetails() {
	const router = useRouter()
	const { id } = router.query
	const [event, setEvent] = useState(null)
	const [loading, setLoading] = useState(true)
	const [registered, setRegistered] = useState(false)
	const [registering, setRegistering] = useState(false)
	const [registration, setRegistration] = useState(null)
	const [donor, setDonor] = useState(null)
	const [showInvoicePreview, setShowInvoicePreview] = useState(false)
	const [uploadedDoc, setUploadedDoc] = useState(null)

	// Fetch event data and registration status
	useEffect(() => {
		if (!id) return
		loadData()
	}, [id])

	async function loadData() {
		setLoading(true)
		try {
			// Fetch event details
			const eventData = await apiFetch(`/blood-donation-events/${id}/`)
			setEvent(eventData)

			// Fetch donor details for invoice preview
			try {
				const donorData = await apiFetch("/donors/me/")
				setDonor(donorData)
			} catch (e) {
				console.log("Could not fetch donor profile")
			}

			// Fetch registration status
			const registrations = await apiFetch(`/event-registrations/?event=${id}&donor=me`)
			if (registrations && registrations.length > 0) {
				setRegistration(registrations[0])
				setRegistered(true)
			}
		} catch (error) {
			console.error("Error loading event data:", error)
		} finally {
			setLoading(false)
		}
	}

	function handleRegister() {
		if (!donor) {
			alert("Please complete your donor profile first!")
			router.push("/register/donor")
			return
		}
		setShowInvoicePreview(true)
	}

	async function confirmRegistration() {
		if (!uploadedDoc) {
			alert("Please upload a verification document to proceed.")
			return
		}

		setRegistering(true)
		try {
			const data = await apiFetch(`/event-registrations/`, {
				method: "POST",
				body: JSON.stringify({
					event_id: id,
					verification_document: `https://cloud.lifesaver.com/docs/${uploadedDoc.name}`
				}),
			})
			setRegistration(data)
			setRegistered(true)
			setShowInvoicePreview(false)
			alert("Registration request sent to hospital!")
			router.push("/donor/events")
		} catch (error) {
			console.error("Registration failed:", error)
			alert("Error sending request. Please try again.")
		} finally {
			setRegistering(false)
		}
	}

	function getGoogleMapsUrl(address, lat, lng) {
		if (lat && lng) {
			return `https://www.google.com/maps?q=${lat},${lng}`
		}
		return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
	}

	if (loading) {
		return (
			<>
				<Head>
					<title>Loading Event — LifeSaver Connect</title>
				</Head>
				<main className="min-h-screen bg-[#1A1A2E] text-white">
					<div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
						<div className="rounded-2xl border border-dashed border-[#F6D6E3]/40 bg-[#131326] p-6 text-sm text-pink-100/70">
							Loading event details…
						</div>
					</div>
				</main>
			</>
		)
	}

	if (!event) {
		return (
			<>
				<Head>
					<title>Event Not Found — LifeSaver Connect</title>
				</Head>
				<main className="min-h-screen bg-[#1A1A2E] text-white">
					<div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
						<div className="rounded-2xl border border-rose-400 bg-rose-500/10 p-6 text-sm text-rose-100">
							<p>Event not found.</p>
							<Link href="/donor/blood" legacyBehavior>
								<a className="mt-4 inline-block text-[#E91E63] underline">Back to Blood Donation</a>
							</Link>
						</div>
					</div>
				</main>
			</>
		)
	}

	return (
		<>
			<Head>
				<title>{event.title} — LifeSaver Connect</title>
			</Head>
			<main className="min-h-screen bg-[#1A1A2E] text-white">
				{showInvoicePreview && (
					<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 overflow-y-auto">
						<div className="w-full max-w-lg overflow-hidden rounded-[2rem] border border-[#F6D6E3]/20 bg-[#131326] shadow-[0_0_50px_rgba(233,30,99,0.15)] animate-in zoom-in slide-in-from-bottom-10 duration-500 my-auto">
							<div className="bg-gradient-to-br from-[#E91E63]/20 via-[#131326] to-transparent p-8 border-b border-[#F6D6E3]/10 relative">
								<button onClick={() => setShowInvoicePreview(false)} className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/5 text-pink-100/40 hover:text-white transition-all">
									<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
									</svg>
								</button>
								<div className="space-y-1">
									<h2 className="text-2xl font-black text-white tracking-tight">Registration Invoice</h2>
									<p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#E91E63]">Invoice Preview • Draft</p>
								</div>
							</div>

							<div className="p-8 space-y-8">
								<div className="grid grid-cols-2 gap-8 border-b border-[#F6D6E3]/10 pb-8">
									<div>
										<p className="text-[10px] font-black uppercase tracking-widest text-pink-100/30 mb-1">Registration Date</p>
										<p className="text-sm font-bold text-white">{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
									</div>
									<div className="text-right">
										<p className="text-[10px] font-black uppercase tracking-widest text-pink-100/30 mb-1">Status</p>
										<div className="inline-flex items-center gap-2 text-yellow-500 text-xs font-black uppercase">
											<div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
											Ready to Send
										</div>
									</div>
								</div>

								<div className="space-y-6">
									<div className="relative group">
										<p className="text-[10px] font-black uppercase tracking-widest text-pink-100/30 mb-2 px-1">Donor Particulars</p>
										<div className="rounded-2xl bg-white/[0.03] p-5 border border-white/5 group-hover:border-[#E91E63]/20 transition-all">
											<div className="flex justify-between items-start">
												<div>
													<p className="text-lg font-bold text-white tracking-tight">{donor?.first_name} {donor?.last_name}</p>
													<p className="text-xs text-pink-100/50 mt-1 font-medium">{donor?.phone}</p>
												</div>
												<span className="bg-[#E91E63] text-white text-[10px] font-black px-3 py-1 rounded-lg shadow-lg shadow-[#E91E63]/30">
													{donor?.blood_group}
												</span>
											</div>
										</div>
									</div>

									<div className="relative group">
										<p className="text-[10px] font-black uppercase tracking-widest text-pink-100/30 mb-2 px-1">Event Destination</p>
										<div className="rounded-2xl bg-white/[0.03] p-5 border border-white/5 group-hover:border-[#E91E63]/20 transition-all">
											<p className="text-sm font-bold text-white">{event?.title}</p>
											<div className="flex items-center gap-2 mt-2 text-pink-100/60 transition-colors group-hover:text-pink-100">
												<svg className="w-3 h-3 text-[#E91E63]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
												</svg>
												<p className="text-xs font-medium">{event?.location}</p>
											</div>
										</div>
									</div>

									{/* Document Upload Section */}
									<div className="relative group">
										<p className="text-[10px] font-black uppercase tracking-widest text-pink-100/30 mb-2 px-1">Verification Document</p>
										<label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-[#F6D6E3]/10 rounded-2xl bg-white/[0.02] hover:bg-white/[0.04] transition-all cursor-pointer group-hover:border-[#E91E63]/30 overflow-hidden relative">
											{uploadedDoc ? (
												<div className="flex flex-col items-center animate-in zoom-in duration-300">
													<svg className="w-8 h-8 mb-2 text-green-500" fill="currentColor" viewBox="0 0 24 24">
														<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
													</svg>
													<p className="text-xs font-bold text-white tracking-tight">{uploadedDoc.name}</p>
													<p className="text-[10px] text-pink-100/40 mt-1 uppercase">Ready to upload</p>
												</div>
											) : (
												<div className="flex flex-col items-center pt-5 pb-6">
													<svg className="w-8 h-8 mb-3 text-pink-100/20 group-hover:text-[#E91E63]/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
													</svg>
													<p className="text-[10px] text-pink-100/40 font-black uppercase tracking-widest">Select ID / Consent Form</p>
												</div>
											)}
											<input type="file" className="hidden" onChange={(e) => setUploadedDoc(e.target.files[0])} />
										</label>
									</div>
								</div>

								<div className="space-y-4 pt-4">
									<button
										onClick={confirmRegistration}
										disabled={registering}
										className="w-full relative group"
									>
										<div className="absolute -inset-1 bg-gradient-to-r from-[#E91E63] to-pink-600 rounded-2xl blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
										<div className="relative flex items-center justify-center gap-3 rounded-2xl bg-[#E91E63] py-5 text-sm font-black uppercase tracking-[0.2em] text-white transition hover:bg-[#D81B60] active:scale-95 shadow-xl shadow-[#E91E63]/20 disabled:opacity-50">
											{registering ? (
												<>
													<div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
													Processing...
												</>
											) : "Send Request & Invoice"}
										</div>
									</button>
									<p className="text-[9px] text-center text-pink-100/30 uppercase tracking-[0.1em] font-bold leading-relaxed">
										Securely transmitting to hospital People Request sheet
									</p>
								</div>
							</div>
						</div>
					</div>
				)}

				<header className="border-b border-[#F6D6E3]/30 bg-[#131326]/80 backdrop-blur sticky top-0 z-10">
					<div className="mx-auto flex flex-col gap-3 md:flex-row md:items-center md:justify-between max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
						<div>
							<Link href="/donor/blood" legacyBehavior>
								<a className="text-sm text-pink-100/80 hover:text-[#E91E63] transition mb-2 inline-block">
									← Back to Blood Donation
								</a>
							</Link>
							<h1 className="text-3xl md:text-4xl font-extrabold" style={{ fontFamily: "'Poppins', sans-serif" }}>
								{event.title}
							</h1>
							<p className="mt-1 text-sm text-pink-100/80">{event.location}</p>
						</div>
					</div>
				</header>

				<section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 space-y-6">
					{/* Event Header Card */}
					<div className="rounded-2xl border border-[#F6D6E3] bg-[#131326] p-6">
						<div className="grid gap-6 md:grid-cols-2">
							<div>
								<div className="flex items-center gap-3 mb-4">
									<div className="rounded-lg bg-[#E91E63]/20 p-3">
										<svg className="w-6 h-6 text-[#E91E63]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
										</svg>
									</div>
									<div>
										<p className="text-sm text-pink-100/80">Date & Time</p>
										<p className="text-base font-semibold text-white">{event.fullDate}</p>
										<p className="text-sm text-pink-100/70">{event.time}</p>
									</div>
								</div>
								<div className="flex items-center gap-3 mb-4">
									<div className="rounded-lg bg-[#E91E63]/20 p-3">
										<svg className="w-6 h-6 text-[#E91E63]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
										</svg>
									</div>
									<div>
										<p className="text-sm text-pink-100/80">Location</p>
										<p className="text-base font-semibold text-white">{event.location}</p>
										<p className="text-sm text-pink-100/70">{event.address}</p>
									</div>
								</div>
								<div className="flex items-center gap-3">
									<div className="rounded-lg bg-[#E91E63]/20 p-3">
										<svg className="w-6 h-6 text-[#E91E63]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
										</svg>
									</div>
									<div>
										<p className="text-sm text-pink-100/80">Organizer</p>
										<p className="text-base font-semibold text-white">{event.organizer}</p>
									</div>
								</div>
							</div>
							<div className="flex flex-col gap-4">
								{registered ? (
									<div className={`rounded-xl border ${registration?.status === 'ARRIVED' ? 'border-blue-500/40 bg-blue-500/10' : registration?.status === 'APPROVED' ? 'border-green-500/40 bg-green-500/10' : 'border-yellow-500/40 bg-yellow-500/10'} p-4`}>
										<div className="flex items-center gap-2 mb-2">
											{registration?.status === 'ARRIVED' ? (
												<svg className="w-5 h-5 text-blue-300" fill="currentColor" viewBox="0 0 20 20">
													<path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
												</svg>
											) : (
												<svg className="w-5 h-5 text-green-300" fill="currentColor" viewBox="0 0 20 20">
													<path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
												</svg>
											)}
											<p className={`text-base font-semibold ${registration?.status === 'ARRIVED' ? 'text-blue-300' : 'text-green-300'}`}>
												{registration?.status === 'ARRIVED' ? "Donation Completed" : registration?.status === 'APPROVED' ? "Registration Approved!" : "Registration Pending"}
											</p>
										</div>
										<p className="text-sm text-pink-100/80">
											{registration?.status === 'ARRIVED'
												? "Thank you for reaching the hospital and completing your donation!"
												: registration?.status === 'APPROVED'
													? "Your registration is confirmed. Please show the invoice below when you reach the event."
													: "Your registration is being reviewed by the hospital staff."}
										</p>
									</div>
								) : (

									<button
										onClick={handleRegister}
										disabled={registering}
										className="w-full rounded-lg bg-[#E91E63] px-6 py-3 text-base font-semibold text-white hover:opacity-90 transition disabled:cursor-not-allowed disabled:opacity-60"
									>
										{registering ? (
											<span className="flex items-center justify-center gap-2">
												<span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
												Registering...
											</span>
										) : (
											"Register for This Event"
										)}
									</button>
								)}
								<a
									href={getGoogleMapsUrl(event.address, event.latitude, event.longitude)}
									target="_blank"
									rel="noopener noreferrer"
									className="w-full rounded-lg border border-[#F6D6E3] px-6 py-3 text-base font-medium text-pink-100 hover:bg-white/5 transition text-center"
								>
									Get Directions
								</a>
								<div className="rounded-xl border border-[#F6D6E3]/40 bg-[#1A1A2E] p-4">
									<p className="text-xs uppercase tracking-wide text-pink-100/60 mb-2">Event Stats</p>
									<div className="grid grid-cols-2 gap-3">
										<div>
											<p className="text-2xl font-bold text-white">{event.registeredCount}</p>
											<p className="text-xs text-pink-100/70">Registered</p>
										</div>
										<div>
											<p className="text-2xl font-bold text-white">{event.estimatedDonors}</p>
											<p className="text-xs text-pink-100/70">Expected</p>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>

					{/* Description */}
					<div className="rounded-2xl border border-[#F6D6E3] bg-[#131326] p-6">
						<h2 className="text-lg font-semibold text-white mb-3">About This Event</h2>
						<p className="text-sm text-pink-100/80 leading-relaxed">{event.description}</p>
					</div>

					{/* Invoice Section - Only show when Approved */}
					{registered && registration?.status === "APPROVED" && (
						<div className="rounded-2xl border-2 border-dashed border-[#E91E63]/60 bg-[#131326] p-8 shadow-2xl relative overflow-hidden">
							<div className="absolute top-0 right-0 p-4 opacity-10">
								<svg className="w-32 h-32 text-white" fill="currentColor" viewBox="0 0 20 20">
									<path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
								</svg>
							</div>

							<div className="relative z-10">
								<div className="flex items-baseline justify-between border-b border-[#F6D6E3]/20 pb-4 mb-6">
									<h2 className="text-2xl font-bold text-white uppercase tracking-widest">Donation Invoice</h2>
									<div className="text-right">
										<p className="text-xs text-pink-100/60 uppercase">Invoice #</p>
										<p className="text-sm font-mono font-bold text-[#E91E63]">{registration.invoice_number}</p>
									</div>
								</div>

								<div className="grid gap-8 md:grid-cols-2">
									<div>
										<p className="text-xs text-pink-100/60 uppercase mb-2">Donor Details</p>
										<div className="space-y-1">
											<p className="text-lg font-semibold text-white">{registration.donor?.first_name} {registration.donor?.last_name}</p>
											<p className="text-sm text-pink-100/80">{registration.donor?.email}</p>
											<p className="text-sm text-pink-100/80">{registration.donor?.phone}</p>
											<p className="text-sm font-bold text-[#E91E63]">Blood Group: {registration.donor?.blood_group || "N/A"}</p>
										</div>
									</div>
									<div>
										<p className="text-xs text-pink-100/60 uppercase mb-2">Event Information</p>
										<div className="space-y-1">
											<p className="text-lg font-semibold text-white">{event.title}</p>
											<p className="text-sm text-pink-100/80">{event.location}</p>
											<p className="text-sm text-pink-100/80">{event.event_date ? new Date(event.event_date).toLocaleDateString() : event.fullDate}</p>
											<p className="text-sm text-pink-100/80">{event.time}</p>
										</div>
									</div>
								</div>

								<div className="mt-8 pt-6 border-t border-[#F6D6E3]/20 flex flex-col items-center justify-center text-center">
									<div className="bg-white p-4 rounded-xl mb-4">
										{/* Placeholder for QR Code - typically would use a library */}
										<div className="w-32 h-32 bg-gray-200 border-4 border-white flex items-center justify-center">
											<svg className="w-24 h-24 text-gray-800" fill="currentColor" viewBox="0 0 24 24">
												<path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm13-2h3v2h-3v-2zm-3 0h2v2h-2v-2zm3 3h3v2h-3v-2zm-3 0h2v2h-2v-2zm3 3h3v2h-3v-2zm-3 0h2v2h-2v-2z" />
											</svg>
										</div>
									</div>
									<p className="text-xs text-pink-100/60 max-w-xs">
										Please present this digital invoice at the registration desk upon arrival.
									</p>
								</div>
							</div>
						</div>
					)}


					<div className="grid gap-6 md:grid-cols-2">
						{/* Blood Groups Needed */}
						<div className="rounded-2xl border border-[#F6D6E3] bg-[#131326] p-6">
							<h2 className="text-lg font-semibold text-white mb-4">Blood Groups Needed</h2>
							<div className="flex flex-wrap gap-2">
								{(event.bloodGroupsNeeded || []).map((group) => (
									<span
										key={group}
										className="rounded-lg bg-[#E91E63]/20 border border-[#E91E63]/40 px-3 py-1.5 text-sm font-medium text-[#E91E63]"
									>
										{group}
									</span>
								))}
							</div>
							<p className="mt-4 text-xs text-pink-100/70">
								All blood types are welcome, but these groups are in highest demand.
							</p>
						</div>

						{/* Contact Information */}
						<div className="rounded-2xl border border-[#F6D6E3] bg-[#131326] p-6">
							<h2 className="text-lg font-semibold text-white mb-4">Contact Information</h2>
							<div className="space-y-3">
								<div className="flex items-center gap-3">
									<svg className="w-5 h-5 text-[#E91E63]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
									</svg>
									<a href={`tel:${event.contactPhone}`} className="text-sm text-pink-100/80 hover:text-[#E91E63] transition">
										{event.contactPhone}
									</a>
								</div>
								<div className="flex items-center gap-3">
									<svg className="w-5 h-5 text-[#E91E63]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
									</svg>
									<a href={`mailto:${event.contactEmail}`} className="text-sm text-pink-100/80 hover:text-[#E91E63] transition">
										{event.contactEmail}
									</a>
								</div>
							</div>
						</div>
					</div>

					<div className="grid gap-6 md:grid-cols-2">
						{/* Eligibility Requirements */}
						<div className="rounded-2xl border border-[#F6D6E3] bg-[#131326] p-6">
							<h2 className="text-lg font-semibold text-white mb-4">Eligibility Requirements</h2>
							<ul className="space-y-2">
								{(event.requirements || []).map((req, index) => (
									<li key={index} className="flex items-start gap-2 text-sm text-pink-100/80">
										<svg className="w-5 h-5 text-[#E91E63] flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
											<path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
										</svg>
										<span>{req}</span>
									</li>
								))}
							</ul>
						</div>

						{/* What to Bring */}
						<div className="rounded-2xl border border-[#F6D6E3] bg-[#131326] p-6">
							<h2 className="text-lg font-semibold text-white mb-4">What to Bring</h2>
							<ul className="space-y-2">
								{(event.whatToBring || []).map((item, index) => (
									<li key={index} className="flex items-start gap-2 text-sm text-pink-100/80">
										<svg className="w-5 h-5 text-[#E91E63] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
										</svg>
										<span>{item}</span>
									</li>
								))}
							</ul>
						</div>
					</div>

					{/* Preparation Tips */}
					<div className="rounded-2xl border border-[#F6D6E3] bg-[#131326] p-6">
						<h2 className="text-lg font-semibold text-white mb-4">Preparation Tips</h2>
						<div className="grid gap-4 md:grid-cols-2">
							{(event.preparationTips || []).map((tip, index) => (
								<div key={index} className="flex items-start gap-3 rounded-xl border border-[#F6D6E3]/40 bg-[#1A1A2E] p-4">
									<div className="rounded-full bg-[#E91E63]/20 p-1.5 flex-shrink-0">
										<svg className="w-4 h-4 text-[#E91E63]" fill="currentColor" viewBox="0 0 20 20">
											<path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
										</svg>
									</div>
									<p className="text-sm text-pink-100/80">{tip}</p>
								</div>
							))}
						</div>
					</div>

					{/* Quick Actions */}
					<div className="rounded-2xl border border-[#F6D6E3] bg-[#131326] p-6">
						<h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
						<div className="grid gap-4 md:grid-cols-3">
							<Link href="/donor/donate" legacyBehavior>
								<a className="rounded-xl border border-[#F6D6E3]/40 bg-[#1A1A2E] p-4 hover:bg-[#1A1A2E]/80 transition text-center">
									<svg className="w-6 h-6 text-[#E91E63] mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
									</svg>
									<p className="text-sm font-medium text-white">Book Appointment</p>
									<p className="text-xs text-pink-100/70 mt-1">Schedule your donation</p>
								</a>
							</Link>
							<Link href="/donor/blood" legacyBehavior>
								<a className="rounded-xl border border-[#F6D6E3]/40 bg-[#1A1A2E] p-4 hover:bg-[#1A1A2E]/80 transition text-center">
									<svg className="w-6 h-6 text-[#E91E63] mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
									</svg>
									<p className="text-sm font-medium text-white">Check Eligibility</p>
									<p className="text-xs text-pink-100/70 mt-1">View your profile</p>
								</a>
							</Link>
							<Link href="/needs" legacyBehavior>
								<a className="rounded-xl border border-[#F6D6E3]/40 bg-[#1A1A2E] p-4 hover:bg-[#1A1A2E]/80 transition text-center">
									<svg className="w-6 h-6 text-[#E91E63] mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
									</svg>
									<p className="text-sm font-medium text-white">Emergency Needs</p>
									<p className="text-xs text-pink-100/70 mt-1">View urgent requests</p>
								</a>
							</Link>
						</div>
					</div>
				</section>
			</main>
		</>
	)
}

