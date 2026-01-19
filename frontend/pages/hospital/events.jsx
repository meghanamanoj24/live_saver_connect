import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import { useState, useEffect } from "react"
import { apiFetch } from "../../lib/api"

export default function HospitalEvents() {
	const router = useRouter()
	const { id } = router.query
	const [hospital, setHospital] = useState(null)
	const [events, setEvents] = useState([])
	const [loading, setLoading] = useState(true)
	const [showEventForm, setShowEventForm] = useState(false)
	const [eventForm, setEventForm] = useState({
		title: "",
		description: "",
		event_date: "",
		start_time: "",
		end_time: "",
		location: "",
		address: "",
		contact_phone: "",
		contact_email: "",
		blood_groups_needed: "",
		estimated_donors: 0,
		organizer: "",
		latitude: "",
		longitude: "",
	})

	useEffect(() => {
		if (id) {
			loadData()
		}
	}, [id])

	async function loadData() {
		setLoading(true)
		try {
			let hospitalData
			try {
				hospitalData = await apiFetch("/hospitals/me/")
			} catch {
				hospitalData = await apiFetch(`/hospitals/${id}/`)
			}
			setHospital(hospitalData)
			await loadEvents(hospitalData.id || id)
		} catch (error) {
			console.error("Error loading data:", error)
		} finally {
			setLoading(false)
		}
	}

	async function loadEvents(hospitalId) {
		try {
			const data = await apiFetch(`/blood-donation-events/?hospital=${hospitalId}`)
			setEvents(data)
		} catch (error) {
			console.error("Error loading events:", error)
			setEvents([])
		}
	}

	async function handleSubmitEvent(e) {
		e.preventDefault()
		try {
			const eventDateTime = eventForm.event_date && eventForm.start_time 
				? `${eventForm.event_date}T${eventForm.start_time}` 
				: null
			
			await apiFetch("/blood-donation-events/", {
				method: "POST",
				body: JSON.stringify({
					...eventForm,
					hospital_id: hospital?.id || id,
					event_date: eventDateTime,
					estimated_donors: parseInt(eventForm.estimated_donors) || 0,
					latitude: eventForm.latitude ? parseFloat(eventForm.latitude) : null,
					longitude: eventForm.longitude ? parseFloat(eventForm.longitude) : null,
				}),
			})
			setShowEventForm(false)
			setEventForm({
				title: "",
				description: "",
				event_date: "",
				start_time: "",
				end_time: "",
				location: "",
				address: "",
				contact_phone: "",
				contact_email: "",
				blood_groups_needed: "",
				estimated_donors: 0,
				organizer: "",
				latitude: "",
				longitude: "",
			})
			await loadEvents(hospital?.id || id)
			alert("Event created successfully!")
		} catch (error) {
			console.error("Error creating event:", error)
			const errorMessage = error.body?.detail || error.message || "Error creating event. Please try again."
			alert(errorMessage)
		}
	}

	if (loading) {
		return (
			<main className="min-h-screen bg-[#1A1A2E] text-white flex items-center justify-center">
				<div className="text-center">
					<div className="h-12 w-12 animate-spin rounded-full border-4 border-[#E91E63] border-t-transparent mx-auto" />
					<p className="mt-4 text-pink-100/70">Loading events...</p>
				</div>
			</main>
		)
	}

	return (
		<>
			<Head>
				<title>Events — {hospital?.name || "Hospital"} Dashboard</title>
			</Head>
			<main className="min-h-screen bg-[#1A1A2E] text-white">
				<header className="border-b border-[#F6D6E3]/30 bg-[#131326]/80 backdrop-blur sticky top-0 z-10">
					<div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
						<div className="flex items-center justify-between">
							<div>
								<h1 className="text-2xl font-bold text-white">Blood Donation Events</h1>
								<p className="text-sm text-pink-100/70">{hospital?.name}</p>
							</div>
							<div className="flex gap-2">
								<button
									onClick={() => setShowEventForm(!showEventForm)}
									className="rounded-lg bg-[#E91E63] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
								>
									{showEventForm ? "Cancel" : "+ Add Event"}
								</button>
								<Link href={`/hospital/dashboard?id=${id}`} legacyBehavior>
									<a className="rounded-lg border border-[#F6D6E3] px-4 py-2 text-sm text-pink-100 hover:bg-white/5">
										Back to Dashboard
									</a>
								</Link>
							</div>
						</div>
					</div>
				</header>

				<div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
					{showEventForm && (
						<form onSubmit={handleSubmitEvent} className="rounded-xl border border-[#F6D6E3]/40 bg-[#131326] p-6 space-y-4 mb-6">
							<h2 className="text-xl font-bold text-white mb-4">Create Blood Donation Event</h2>
							<div className="grid gap-4 md:grid-cols-2">
								<div className="md:col-span-2">
									<label className="block text-sm font-medium text-pink-100 mb-1">Event Title *</label>
									<input
										type="text"
										required
										value={eventForm.title}
										onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
										className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
									/>
								</div>
								<div className="md:col-span-2">
									<label className="block text-sm font-medium text-pink-100 mb-1">Description</label>
									<textarea
										value={eventForm.description}
										onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
										rows={3}
										className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-pink-100 mb-1">Event Date *</label>
									<input
										type="date"
										required
										value={eventForm.event_date}
										onChange={(e) => setEventForm({ ...eventForm, event_date: e.target.value })}
										className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-pink-100 mb-1">Start Time *</label>
									<input
										type="time"
										required
										value={eventForm.start_time}
										onChange={(e) => setEventForm({ ...eventForm, start_time: e.target.value })}
										className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-pink-100 mb-1">End Time</label>
									<input
										type="time"
										value={eventForm.end_time}
										onChange={(e) => setEventForm({ ...eventForm, end_time: e.target.value })}
										className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-pink-100 mb-1">Location</label>
									<input
										type="text"
										value={eventForm.location}
										onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
										className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-pink-100 mb-1">Blood Groups Needed</label>
									<input
										type="text"
										value={eventForm.blood_groups_needed}
										onChange={(e) => setEventForm({ ...eventForm, blood_groups_needed: e.target.value })}
										placeholder="e.g., O+,A+,B+"
										className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-pink-100 mb-1">Contact Phone</label>
									<input
										type="tel"
										value={eventForm.contact_phone}
										onChange={(e) => setEventForm({ ...eventForm, contact_phone: e.target.value })}
										className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-pink-100 mb-1">Contact Email</label>
									<input
										type="email"
										value={eventForm.contact_email}
										onChange={(e) => setEventForm({ ...eventForm, contact_email: e.target.value })}
										className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
									/>
								</div>
							</div>
							<button
								type="submit"
								className="rounded-lg bg-[#E91E63] px-6 py-2 font-semibold text-white transition hover:opacity-90"
							>
								Create Event
							</button>
						</form>
					)}

					<div className="space-y-4">
						{events.length === 0 ? (
							<div className="rounded-xl border border-dashed border-[#F6D6E3]/40 bg-[#131326] p-8 text-center">
								<p className="text-pink-100/70">No events created yet.</p>
							</div>
						) : (
							events.map((event) => (
								<div key={event.id} className="rounded-xl border border-[#F6D6E3]/40 bg-[#131326] p-6">
									<div className="flex items-start justify-between">
										<div className="flex-1">
											<h3 className="text-lg font-semibold text-white">{event.title}</h3>
											{event.description && (
												<p className="mt-2 text-sm text-pink-100/70">{event.description}</p>
											)}
											<div className="mt-3 grid gap-2 sm:grid-cols-2">
												{event.event_date && (
													<p className="text-sm text-pink-100/70">
														Date: {new Date(event.event_date).toLocaleDateString()}
													</p>
												)}
												{event.start_time && (
													<p className="text-sm text-pink-100/70">
														Time: {event.start_time} {event.end_time && `- ${event.end_time}`}
													</p>
												)}
												{event.location && (
													<p className="text-sm text-pink-100/70">Location: {event.location}</p>
												)}
												{event.blood_groups_needed && (
													<p className="text-sm text-pink-100/70">
														Blood Groups: {event.blood_groups_needed}
													</p>
												)}
											</div>
										</div>
										<span className={`rounded-full px-2 py-1 text-xs font-medium ${
											event.status === "UPCOMING" ? "bg-blue-600/20 text-blue-400" :
											event.status === "ONGOING" ? "bg-green-600/20 text-green-400" :
											event.status === "COMPLETED" ? "bg-gray-600/20 text-gray-400" :
											"bg-yellow-600/20 text-yellow-400"
										}`}>
											{event.status || "UPCOMING"}
										</span>
									</div>
								</div>
							))
						)}
					</div>
				</div>
			</main>
		</>
	)
}
