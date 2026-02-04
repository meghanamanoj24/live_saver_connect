import Head from "next/head"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { apiFetch } from "../../../lib/api"

// Mock events data - in production, fetch from API endpoint
const ALL_EVENTS = [
	{
		id: 1,
		date: "Sat • 7 Dec",
		fullDate: "Saturday, December 7, 2024",
		time: "9:00 AM - 5:00 PM",
		title: "Community Mega Blood Drive",
		location: "City Care Hospital, Downtown",
		address: "123 Main Street, Downtown District",
		organizer: "City Care Hospital",
		bloodGroupsNeeded: ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"],
		registeredCount: 342,
		estimatedDonors: 500,
	},
	{
		id: 2,
		date: "Sun • 22 Dec",
		fullDate: "Sunday, December 22, 2024",
		time: "10:00 AM - 4:00 PM",
		title: "LifeSaver Outreach Camp",
		location: "Unity Convention Centre",
		address: "456 Convention Boulevard, City Center",
		organizer: "LifeSaver Connect",
		bloodGroupsNeeded: ["O+", "O-", "A+", "B+"],
		registeredCount: 189,
		estimatedDonors: 300,
	},
	{
		id: 3,
		date: "Sat • 14 Dec",
		fullDate: "Saturday, December 14, 2024",
		time: "8:00 AM - 6:00 PM",
		title: "Holiday Season Blood Donation Drive",
		location: "Regional Medical Center",
		address: "789 Health Avenue, Medical District",
		organizer: "Regional Medical Center",
		bloodGroupsNeeded: ["O+", "O-", "A+", "A-"],
		registeredCount: 256,
		estimatedDonors: 400,
	},
	{
		id: 4,
		date: "Sun • 29 Dec",
		fullDate: "Sunday, December 29, 2024",
		time: "11:00 AM - 3:00 PM",
		title: "New Year Blood Drive",
		location: "Community Health Center",
		address: "321 Wellness Way, Community Plaza",
		organizer: "Community Health Center",
		bloodGroupsNeeded: ["O+", "O-", "B+", "B-", "AB+"],
		registeredCount: 178,
		estimatedDonors: 250,
	},
	{
		id: 5,
		date: "Sat • 4 Jan",
		fullDate: "Saturday, January 4, 2025",
		time: "9:00 AM - 5:00 PM",
		title: "New Year Community Blood Drive",
		location: "Metro Hospital",
		address: "555 Hospital Road, Metro Area",
		organizer: "Metro Hospital",
		bloodGroupsNeeded: ["O+", "O-", "A+", "B+"],
		registeredCount: 201,
		estimatedDonors: 350,
	},
]

export default function EventsList() {
	const [events, setEvents] = useState([])
	const [loading, setLoading] = useState(true)
	const [myRegistrations, setMyRegistrations] = useState([])
	const [donor, setDonor] = useState(null)

	// Registration Modal State
	const [activeRegistrationEvent, setActiveRegistrationEvent] = useState(null)
	const [registering, setRegistering] = useState(false)
	const [uploadedDoc, setUploadedDoc] = useState(null)

	const fetchEvents = useCallback(async () => {
		setLoading(true)
		try {
			// Fetch upcoming events from API
			const eventsData = await apiFetch("/blood-donation-events/?upcoming=true")

			// Try to fetch donor profile
			try {
				const donorData = await apiFetch("/donors/me/")
				setDonor(donorData)
			} catch (e) {
				console.log("Could not fetch donor profile")
			}

			// Try to fetch registrations if logged in
			let registrations = []
			try {
				registrations = await apiFetch("/event-registrations/?donor=me")
				setMyRegistrations(registrations)
			} catch (e) {
				console.log("Could not fetch registrations (likely not logged in as donor)")
			}

			if (eventsData && eventsData.length > 0) {
				setEvents(eventsData)
			} else {
				// Fallback to mock data if no real events are found
				setEvents(ALL_EVENTS)
			}
		} catch (error) {
			console.error("Error fetching events:", error)
			// Fallback to mock data on error
			setEvents(ALL_EVENTS)
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		fetchEvents()
	}, [fetchEvents])

	async function handleRegisterClick(e, event) {
		e.preventDefault()
		e.stopPropagation()
		if (!donor) {
			alert("Please complete your donor profile before registering!")
			return
		}
		setActiveRegistrationEvent(event)
	}

	async function confirmRegistration() {
		if (!uploadedDoc) {
			alert("Please upload an ID proof or consent form to proceed.")
			return
		}

		setRegistering(true)
		try {
			await apiFetch(`/event-registrations/`, {
				method: "POST",
				body: JSON.stringify({
					event_id: activeRegistrationEvent.id,
					verification_document: `https://cloud.lifesaver.com/docs/${uploadedDoc.name}`
				}),
			})
			alert("Registration request sent successfully!")
			setActiveRegistrationEvent(null)
			setUploadedDoc(null)
			await fetchEvents()
		} catch (error) {
			console.error("Registration failed:", error)
			alert("Error sending registration. Please try again.")
		} finally {
			setRegistering(false)
		}
	}

	async function handleConfirmComing(regId) {
		try {
			await apiFetch(`/event-registrations/${regId}/confirm_coming/`, { method: "POST" })
			alert("Thank you! You've confirmed your attendance.")
			await fetchEvents()
		} catch (error) {
			console.error("Error confirming:", error)
			alert("Error confirming attendance.")
		}
	}

	async function handleCancelRegistration(regId) {
		if (!confirm("Are you sure you want to cancel your registration?")) return
		try {
			await apiFetch(`/event-registrations/${regId}/donor_cancel/`, { method: "POST" })
			alert("Your registration has been cancelled.")
			await fetchEvents()
		} catch (error) {
			console.error("Error cancelling:", error)
			alert("Error cancelling registration.")
		}
	}


	function formatDate(dateString) {
		if (!dateString) return ""
		try {
			const date = new Date(dateString)
			return date.toLocaleDateString("en-US", {
				weekday: "short",
				day: "numeric",
				month: "short",
			})
		} catch {
			return dateString
		}
	}

	return (
		<>
			<Head>
				<title>Upcoming Events — LifeSaver Connect</title>
			</Head>
			<main className="min-h-screen bg-[#1A1A2E] text-white">
				{/* Registration Modal (Unified Invoice & Upload Flow) */}
				{activeRegistrationEvent && (
					<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 overflow-y-auto">
						<div className="w-full max-w-lg overflow-hidden rounded-[2.5rem] border border-[#F6D6E3]/20 bg-[#131326] shadow-[0_0_100px_rgba(233,30,99,0.2)] animate-in zoom-in slide-in-from-bottom-20 duration-500 my-auto">
							<div className="bg-gradient-to-br from-[#E91E63]/30 via-[#131326] to-transparent p-10 border-b border-[#F6D6E3]/10 relative">
								<button onClick={() => setActiveRegistrationEvent(null)} className="absolute top-8 right-8 p-3 rounded-full hover:bg-white/5 text-pink-100/30 hover:text-white transition-all active:scale-90">
									<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
									</svg>
								</button>
								<div className="space-y-2">
									<p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#E91E63]">Event Registration</p>
									<h2 className="text-3xl font-black text-white tracking-tight">Digital Invoice</h2>
									<p className="text-xs text-pink-100/40 font-medium">Verify your details and upload documentation</p>
								</div>
							</div>

							<div className="p-10 space-y-8">
								<div className="grid grid-cols-2 gap-10 border-b border-[#F6D6E3]/10 pb-10">
									<div>
										<p className="text-[10px] font-black uppercase tracking-widest text-[#E91E63] mb-1.5 px-0.5">Registration Date</p>
										<p className="text-base font-bold text-white leading-none">{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
									</div>
									<div className="text-right">
										<p className="text-[10px] font-black uppercase tracking-widest text-pink-100/30 mb-1.5 px-0.5">Application ID</p>
										<p className="text-sm font-black text-[#E91E63]/60 tracking-tighter">REQ-{Math.floor(100000 + Math.random() * 900000)}</p>
									</div>
								</div>

								<div className="space-y-6">
									<div className="relative group">
										<p className="text-[10px] font-black uppercase tracking-widest text-pink-100/30 mb-2.5 px-1">Donor Particulars</p>
										<div className="rounded-2xl bg-white/[0.02] p-6 border border-white/5 group-hover:border-[#E91E63]/20 transition-all duration-300">
											<div className="flex justify-between items-start">
												<div className="space-y-0.5">
													<p className="text-xl font-bold text-white tracking-tight">{donor?.first_name} {donor?.last_name}</p>
													<p className="text-xs text-pink-100/40 font-medium tracking-wide">{donor?.phone}</p>
												</div>
												<div className="h-10 w-10 rounded-xl bg-[#E91E63] flex items-center justify-center shadow-lg shadow-[#E91E63]/30">
													<span className="text-sm font-black text-white">{donor?.blood_group}</span>
												</div>
											</div>
										</div>
									</div>

									<div className="relative group">
										<p className="text-[10px] font-black uppercase tracking-widest text-pink-100/30 mb-2.5 px-1">Event Destination</p>
										<div className="rounded-2xl bg-white/[0.02] p-6 border border-white/5 group-hover:border-[#E91E63]/20 transition-all duration-300">
											<p className="text-base font-bold text-white leading-snug">{activeRegistrationEvent?.title}</p>
											<div className="flex items-center gap-2 mt-2.5 text-pink-100/50">
												<svg className="w-3.5 h-3.5 text-[#E91E63]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
												</svg>
												<p className="text-xs font-medium tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">{activeRegistrationEvent?.location}</p>
											</div>
										</div>
									</div>

									<div className="relative group">
										<p className="text-[10px] font-black uppercase tracking-widest text-pink-100/30 mb-2.5 px-1">Verification Document *</p>
										<label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-[#F6D6E3]/10 rounded-2xl bg-white/[0.01] hover:bg-white/[0.03] transition-all cursor-pointer group-hover:border-[#E91E63]/30 overflow-hidden relative">
											{uploadedDoc ? (
												<div className="flex flex-col items-center animate-in zoom-in duration-300">
													<div className="bg-green-500/10 p-3 rounded-full mb-2">
														<svg className="w-6 h-6 text-green-500" fill="currentColor" viewBox="0 0 24 24">
															<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
														</svg>
													</div>
													<p className="text-xs font-black text-white tracking-tight leading-none">{uploadedDoc.name}</p>
													<p className="text-[9px] text-pink-100/30 mt-1.5 uppercase font-bold tracking-widest tracking-tighter">Ready for transmission</p>
												</div>
											) : (
												<div className="flex flex-col items-center py-6 text-center">
													<svg className="w-10 h-10 mb-3 text-pink-100/10 group-hover:text-[#E91E63]/30 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
													</svg>
													<p className="text-[10px] text-pink-100/30 font-black uppercase tracking-[0.2em]">Select ID or Consent Form</p>
													<p className="text-[8px] text-pink-100/20 mt-1 uppercase font-bold">PDF, JPG or PNG (Max 5MB)</p>
												</div>
											)}
											<input type="file" className="hidden" onChange={(e) => setUploadedDoc(e.target.files[0])} />
										</label>
									</div>
								</div>

								<div className="space-y-5 pt-4">
									<button
										onClick={confirmRegistration}
										disabled={registering}
										className="w-full relative group"
									>
										<div className="absolute -inset-1 bg-gradient-to-r from-[#E91E63] to-pink-600 rounded-[1.5rem] blur opacity-25 group-hover:opacity-100 transition duration-500 group-hover:duration-200"></div>
										<div className="relative flex items-center justify-center gap-3 rounded-[1.25rem] bg-[#E91E63] py-5 text-sm font-black uppercase tracking-[0.3em] text-white transition hover:bg-[#D81B60] active:scale-[0.98] shadow-2xl shadow-[#E91E63]/30 disabled:opacity-50 disabled:cursor-not-allowed">
											{registering ? (
												<>
													<div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
													Broadcasting...
												</>
											) : (
												<>
													<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
													</svg>
													Send to Hospital
												</>
											)}
										</div>
									</button>
									<p className="text-[9px] text-center text-pink-100/20 uppercase tracking-[0.2em] font-bold leading-relaxed max-w-[200px] mx-auto">
										Securely submitting to <span className="text-white">People Request</span> sheet
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
								Upcoming Events
							</h1>
							<p className="mt-1 text-sm text-pink-100/80">
								Discover blood donation drives and community events near you
							</p>
						</div>
						<div className="flex gap-2">
							<Link href="/donor/donate" legacyBehavior>
								<a className="rounded-lg bg-[#E91E63] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition">
									Book Appointment
								</a>
							</Link>
						</div>
					</div>
				</header>

				<section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
					{/* Active Registrations & Invoices Section */}
					{myRegistrations.length > 0 && myRegistrations.some(r => r.status !== 'ARRIVED') && (
						<div className="mb-12 space-y-6">
							<h2 className="text-xl font-bold text-white flex items-center gap-2">
								<span className="h-2 w-2 rounded-full bg-[#E91E63] animate-pulse" />
								My Active Event Invoices
							</h2>
							<div className="grid gap-6 md:grid-cols-2">
								{myRegistrations.filter(r => !['NOT_COMING', 'CANCELLED'].includes(r.status)).map((reg) => (
									<div key={reg.id} className="relative overflow-hidden rounded-2xl border border-[#F6D6E3]/20 bg-[#131326] shadow-2xl">
										{/* Invoice Background Header */}
										<div className={`px-6 py-4 flex items-center justify-between ${reg.status === 'APPROVED' ? 'bg-gradient-to-r from-green-600/20 to-transparent border-b border-green-500/20' : reg.status === 'ARRIVED' ? 'bg-gradient-to-r from-blue-600/20 to-transparent border-b border-blue-500/20' : reg.status === 'COMING' ? 'bg-gradient-to-r from-purple-600/20 to-transparent border-b border-purple-500/20' : reg.status === 'REJECTED' ? 'bg-gradient-to-r from-red-600/20 to-transparent border-b border-red-500/20' : 'bg-gradient-to-r from-yellow-600/20 to-transparent border-b border-yellow-500/20'}`}>
											<div>
												<p className="text-[10px] font-black uppercase tracking-[0.2em] text-pink-100/40">Donation Invoice</p>
												<h3 className="text-lg font-bold text-white">#{reg.invoice_number}</h3>
											</div>
											<span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${reg.status === 'APPROVED' ? 'bg-green-500/20 text-green-400' : reg.status === 'ARRIVED' ? 'bg-blue-500/20 text-blue-400' : reg.status === 'COMING' ? 'bg-purple-500/20 text-purple-400' : reg.status === 'REJECTED' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
												{reg.status === 'APPROVED' ? 'CONFIRMED - Respond Now' : reg.status === 'ARRIVED' ? 'COMPLETED' : reg.status === 'COMING' ? 'COMING' : reg.status === 'REJECTED' ? 'REJECTED' : 'WAITING APPROVAL'}
											</span>
										</div>

										<div className="p-6 space-y-4">
											<div>
												<p className="text-[10px] font-bold uppercase text-pink-100/30">Event Title</p>
												<p className="text-white font-bold">{reg.event?.title}</p>
											</div>

											{reg.status === 'APPROVED' ? (
												<div className="space-y-4 animate-in fade-in zoom-in duration-500">
													<div className="grid grid-cols-2 gap-4">
														<div>
															<p className="text-[10px] font-bold uppercase text-pink-100/30">Date & Time</p>
															<p className="text-sm text-pink-100/80">{reg.event?.event_date ? new Date(reg.event.event_date).toLocaleDateString() : '—'}</p>
														</div>
														<div>
															<p className="text-[10px] font-bold uppercase text-pink-100/30">Location</p>
															<p className="text-sm text-pink-100/80 line-clamp-1">{reg.event?.location}</p>
														</div>
													</div>

													<div className="flex gap-3">
														<button
															onClick={() => handleConfirmComing(reg.id)}
															className="flex-1 rounded-xl bg-[#E91E63] py-3 text-xs font-black uppercase tracking-widest text-white transition hover:opacity-90 shadow-xl shadow-[#E91E63]/20"
														>
															I'm Coming
														</button>
														<button
															onClick={() => handleCancelRegistration(reg.id)}
															className="flex-1 rounded-xl bg-red-600/20 border border-red-500/30 py-3 text-xs font-bold text-red-400 transition hover:bg-red-600/30"
														>
															Cancel
														</button>
													</div>
												</div>
											) : reg.status === 'COMING' ? (
												<div className="space-y-4 animate-in fade-in zoom-in duration-500">
													<div className="flex items-center gap-3 rounded-xl bg-purple-500/10 p-4 border border-purple-500/20">
														<div className="h-10 w-10 shrink-0 rounded-full bg-purple-500/20 flex items-center justify-center">
															<svg className="w-5 h-5 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
																<path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
															</svg>
														</div>
														<div>
															<p className="text-sm font-bold text-purple-400 tracking-tight">You're all set!</p>
															<p className="text-[10px] text-pink-100/40 mt-0.5">See you at the event!</p>
														</div>
													</div>
													<button
														onClick={() => handleCancelRegistration(reg.id)}
														className="w-full rounded-xl bg-red-600/10 border border-red-500/20 py-3 text-xs font-bold text-red-400 transition hover:bg-red-600/20"
													>
														Cancel Registration
													</button>
												</div>
											) : reg.status === 'ARRIVED' ? (
												<div className="space-y-4 animate-in fade-in zoom-in duration-500">
													<div className="flex items-center gap-3 rounded-xl bg-blue-500/10 p-4 border border-blue-500/20">
														<div className="h-10 w-10 shrink-0 rounded-full bg-blue-500/20 flex items-center justify-center">
															<svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
																<path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
															</svg>
														</div>
														<div>
															<p className="text-sm font-bold text-blue-400 tracking-tight">Donation Completed</p>
															<p className="text-[10px] text-pink-100/40 mt-0.5">Thank you for donating! Your attendance has been confirmed.</p>
														</div>
													</div>
													<button
														className="w-full rounded-xl bg-white/5 border border-white/10 py-3 text-xs font-bold text-white transition hover:bg-white/10"
														onClick={() => window.print()}
													>
														Print Donation Record
													</button>
												</div>
											) : reg.status === 'REJECTED' ? (
												<div className="flex items-center gap-4 rounded-xl bg-red-500/5 p-5 border border-red-500/20">
													<div className="h-10 w-10 shrink-0 rounded-full bg-red-500/20 flex items-center justify-center">
														<svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
														</svg>
													</div>
													<div>
														<p className="text-sm font-bold text-red-400 tracking-tight">Registration Rejected</p>
														<p className="text-[10px] text-pink-100/40 mt-0.5">The hospital was unable to accept your registration.</p>
													</div>
												</div>
											) : (
												<div className="flex items-center gap-4 rounded-xl bg-yellow-500/5 p-5 border border-yellow-500/20 animate-pulse">
													<div className="h-10 w-10 shrink-0 rounded-full bg-yellow-500/20 flex items-center justify-center">
														<svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
														</svg>
													</div>
													<div>
														<p className="text-sm font-bold text-yellow-500 tracking-tight">Registration Request Sent</p>
														<p className="text-[10px] text-pink-100/40 mt-0.5 leading-relaxed">Stored in hospital's <span className="text-pink-100/60 font-black">People Request</span> sheet. Awaiting confirmation.</p>
													</div>
												</div>
											)}
										</div>

										{/* Bottom Notch Decor */}
										<div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#E91E63] to-transparent opacity-20" />
									</div>
								))}
							</div>
							<div className="h-px bg-gradient-to-r from-transparent via-[#F6D6E3]/20 to-transparent my-12" />
						</div>
					)}

					<div className="space-y-6">
						{/* Filter/Sort Bar */}
						<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
							<div className="text-sm text-pink-100/80">
								Showing <span className="font-semibold text-white">{events.length}</span> upcoming event{events.length !== 1 ? "s" : ""}
							</div>
							<div className="flex gap-2">
								<button className="rounded-lg border border-[#F6D6E3]/40 bg-[#131326] px-4 py-2 text-sm font-medium text-pink-100 hover:bg-white/5 transition">
									Filter
								</button>
								<button className="rounded-lg border border-[#F6D6E3]/40 bg-[#131326] px-4 py-2 text-sm font-medium text-pink-100 hover:bg-white/5 transition">
									Sort
								</button>
							</div>
						</div>

						{/* Events Grid */}
						<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
							{events.map((event) => (
								<Link key={event.id} href={`/donor/events/${event.id}`} legacyBehavior>
									<a className="block rounded-2xl border border-[#F6D6E3]/40 bg-[#131326] p-6 hover:border-[#E91E63]/60 hover:bg-[#131326]/80 transition-all cursor-pointer group">
										{/* Date Badge */}
										<div className="flex items-center gap-2 mb-4">
											<div className="rounded-lg bg-[#E91E63]/20 p-2">
												<svg className="w-5 h-5 text-[#E91E63]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														strokeWidth={2}
														d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
													/>
												</svg>
											</div>
											<div>
												<p className="text-sm font-semibold text-white">{event.date || formatDate(event.fullDate)}</p>
												{event.time && <p className="text-xs text-pink-100/70">{event.time}</p>}
											</div>
										</div>

										{/* Event Title and Registration Badge */}
										<div className="flex items-start justify-between gap-2">
											<h3 className="text-lg font-semibold text-white mb-2 group-hover:text-[#E91E63] transition-colors line-clamp-2">
												{event.title}
											</h3>
											{(() => {
												const reg = myRegistrations.find((r) => r.event.id === event.id)
												if (!reg) return null

												return (
													<span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${reg.status === "APPROVED" ? "bg-green-500/20 text-green-400" :
														reg.status === "ARRIVED" ? "bg-blue-500/20 text-blue-400" :
															"bg-yellow-500/20 text-yellow-400"
														}`}>
														{reg.status === 'ARRIVED' ? "Complete" : reg.status === 'APPROVED' ? "Confirmed" : "Pending"}
													</span>
												)
											})()}
										</div>


										{/* Location */}
										<div className="flex items-start gap-2 mb-4">
											<svg className="w-4 h-4 text-pink-100/60 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
												/>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
												/>
											</svg>
											<p className="text-sm text-pink-100/70 line-clamp-2">{event.location}</p>
										</div>

										{/* Organizer */}
										{event.organizer && (
											<div className="flex items-center gap-2 mb-4">
												<svg className="w-4 h-4 text-pink-100/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														strokeWidth={2}
														d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
													/>
												</svg>
												<p className="text-xs text-pink-100/60">{event.organizer}</p>
											</div>
										)}

										{/* Blood Groups Needed */}
										{event.bloodGroupsNeeded && event.bloodGroupsNeeded.length > 0 && (
											<div className="mb-4">
												<p className="text-xs text-pink-100/60 mb-2">Blood Groups Needed:</p>
												<div className="flex flex-wrap gap-1.5">
													{event.bloodGroupsNeeded.slice(0, 4).map((group) => (
														<span
															key={group}
															className="rounded-md bg-[#E91E63]/20 border border-[#E91E63]/40 px-2 py-0.5 text-xs font-medium text-[#E91E63]"
														>
															{group}
														</span>
													))}
													{event.bloodGroupsNeeded.length > 4 && (
														<span className="rounded-md bg-[#E91E63]/20 border border-[#E91E63]/40 px-2 py-0.5 text-xs font-medium text-[#E91E63]">
															+{event.bloodGroupsNeeded.length - 4}
														</span>
													)}
												</div>
											</div>
										)}

										{/* Stats */}
										<div className="flex items-center justify-between pt-4 border-t border-[#F6D6E3]/20">
											<div className="flex items-center gap-4 text-xs text-pink-100/70">
												{event.registeredCount !== undefined && (
													<span>
														<span className="font-semibold text-white">{event.registeredCount}</span> registered
													</span>
												)}
												{event.estimatedDonors !== undefined && (
													<span>
														<span className="font-semibold text-white">{event.estimatedDonors}</span> expected
													</span>
												)}
											</div>
											<svg className="w-5 h-5 text-pink-100/40 group-hover:text-[#E91E63] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
											</svg>
										</div>
									</a>
								</Link>
							))}
						</div>

						{/* Additional Info Section */}
						<div className="mt-12 rounded-2xl border border-[#F6D6E3] bg-[#131326] p-6">
							<h2 className="text-lg font-semibold text-white mb-4">Can't find an event near you?</h2>
							<p className="text-sm text-pink-100/80 mb-4">
								Don't worry! You can still make a difference by booking a donation appointment at any hospital or blood center.
							</p>
							<div className="flex flex-wrap gap-3">
								<Link href="/donor/donate" legacyBehavior>
									<a className="rounded-lg bg-[#E91E63] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition">
										Book a Donation Appointment
									</a>
								</Link>
								<Link href="/needs" legacyBehavior>
									<a className="rounded-lg border border-[#F6D6E3] px-4 py-2 text-sm font-medium text-pink-100 hover:bg-white/5 transition">
										View Emergency Needs
									</a>
								</Link>
							</div>
						</div>
					</div>
				</section>
			</main>
		</>
	)
}

