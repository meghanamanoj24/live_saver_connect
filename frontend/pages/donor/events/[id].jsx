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

	// Mock event data - in production, fetch from API
	useEffect(() => {
		if (!id) return
		
		// Simulate API call - replace with actual API endpoint
		setTimeout(() => {
			// Mock event data based on ID
			const mockEvents = {
				1: {
					id: 1,
					date: "Sat • 7 Dec",
					fullDate: "Saturday, December 7, 2024",
					time: "9:00 AM - 5:00 PM",
					title: "Community Mega Blood Drive",
					location: "City Care Hospital, Downtown",
					address: "123 Main Street, Downtown District",
					description: "Join us for our largest community blood drive of the year! This event brings together donors from across the city to help save lives. We're expecting over 500 donors and need your support.",
					organizer: "City Care Hospital",
					contactPhone: "+1 (555) 123-4567",
					contactEmail: "blooddrive@citycarehospital.org",
					bloodGroupsNeeded: ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"],
					estimatedDonors: 500,
					registeredCount: 342,
					requirements: [
						"Must be 18 years or older (16-17 with parental consent)",
						"Minimum weight of 110 lbs (50 kg)",
						"Good general health",
						"Valid government-issued ID",
						"No tattoos or piercings in the last 3 months",
					],
					whatToBring: [
						"Government-issued photo ID",
						"List of current medications",
						"Contact information for emergency contact",
						"Comfortable clothing with sleeves that can be rolled up",
					],
					preparationTips: [
						"Drink plenty of water 24 hours before",
						"Eat a healthy meal before donating",
						"Get a good night's sleep",
						"Avoid alcohol 24 hours before",
						"Eat iron-rich foods (red meat, spinach, beans)",
					],
					latitude: 40.7128,
					longitude: -74.0060,
				},
				2: {
					id: 2,
					date: "Sun • 22 Dec",
					fullDate: "Sunday, December 22, 2024",
					time: "10:00 AM - 4:00 PM",
					title: "LifeSaver Outreach Camp",
					location: "Unity Convention Centre",
					address: "456 Convention Boulevard, City Center",
					description: "A special holiday season blood drive organized by LifeSaver Connect. This outreach camp focuses on raising awareness about blood donation and helping those in need during the holiday season.",
					organizer: "LifeSaver Connect",
					contactPhone: "+1 (555) 987-6543",
					contactEmail: "outreach@lifesaverconnect.org",
					bloodGroupsNeeded: ["O+", "O-", "A+", "B+"],
					estimatedDonors: 300,
					registeredCount: 189,
					requirements: [
						"Must be 18 years or older",
						"Minimum weight of 110 lbs (50 kg)",
						"Good general health",
						"Valid government-issued ID",
					],
					whatToBring: [
						"Government-issued photo ID",
						"List of current medications",
						"Emergency contact information",
					],
					preparationTips: [
						"Stay hydrated",
						"Eat a balanced meal",
						"Rest well the night before",
					],
					latitude: 40.7589,
					longitude: -73.9851,
				},
			}
			
			const eventData = mockEvents[id] || mockEvents[1]
			setEvent(eventData)
			setLoading(false)
		}, 500)
	}, [id])

	async function handleRegister() {
		setRegistering(true)
		try {
			// In production, call API to register
			// await apiFetch(`/events/${id}/register/`, { method: "POST" })
			await new Promise((resolve) => setTimeout(resolve, 1000))
			setRegistered(true)
		} catch (error) {
			console.error("Registration failed:", error)
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
				<header className="border-b border-[#F6D6E3]/30 bg-[#131326]/80 backdrop-blur">
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
									<div className="rounded-xl border border-green-500/40 bg-green-500/10 p-4">
										<div className="flex items-center gap-2 mb-2">
											<svg className="w-5 h-5 text-green-300" fill="currentColor" viewBox="0 0 20 20">
												<path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
											</svg>
											<p className="text-base font-semibold text-green-300">You're Registered!</p>
										</div>
										<p className="text-sm text-green-200/80">
											We've confirmed your registration. You'll receive a reminder email 24 hours before the event.
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

					<div className="grid gap-6 md:grid-cols-2">
						{/* Blood Groups Needed */}
						<div className="rounded-2xl border border-[#F6D6E3] bg-[#131326] p-6">
							<h2 className="text-lg font-semibold text-white mb-4">Blood Groups Needed</h2>
							<div className="flex flex-wrap gap-2">
								{event.bloodGroupsNeeded.map((group) => (
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
								{event.requirements.map((req, index) => (
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
								{event.whatToBring.map((item, index) => (
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
							{event.preparationTips.map((tip, index) => (
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

