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
	const [dashboard, setDashboard] = useState(null)

	const fetchEvents = useCallback(async () => {
		setLoading(true)
		try {
			// Try to fetch from dashboard API first
			const data = await apiFetch("/donors/dashboard/")
			setDashboard(data)
			
			// If API returns upcoming_events, use them; otherwise use mock data
			if (data?.upcoming_events?.length) {
				// Merge API events with mock data for additional details
				const enrichedEvents = data.upcoming_events.map((apiEvent) => {
					const mockEvent = ALL_EVENTS.find((e) => e.id === apiEvent.id)
					return {
						...apiEvent,
						...mockEvent,
						...apiEvent, // API data takes precedence
					}
				})
				setEvents(enrichedEvents)
			} else {
				// Use mock data if API doesn't return events
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
				<header className="border-b border-[#F6D6E3]/30 bg-[#131326]/80 backdrop-blur">
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
					{loading ? (
						<div className="rounded-2xl border border-dashed border-[#F6D6E3]/40 bg-[#131326] p-6 text-sm text-pink-100/70">
							Loading upcoming events…
						</div>
					) : events.length === 0 ? (
						<div className="rounded-2xl border border-dashed border-[#F6D6E3]/40 bg-[#131326] p-12 text-center">
							<svg
								className="w-16 h-16 text-pink-100/40 mx-auto mb-4"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
								/>
							</svg>
							<p className="text-lg font-medium text-pink-100/80 mb-2">No upcoming events</p>
							<p className="text-sm text-pink-100/70">
								Stay tuned for community blood drives and hospital-specific events.
							</p>
						</div>
					) : (
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

											{/* Event Title */}
											<h3 className="text-lg font-semibold text-white mb-2 group-hover:text-[#E91E63] transition-colors line-clamp-2">
												{event.title}
											</h3>

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
					)}
				</section>
			</main>
		</>
	)
}

