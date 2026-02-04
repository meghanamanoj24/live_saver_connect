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
	const [activeTab, setActiveTab] = useState("events") // "events" or "registrations"
	const [showEventForm, setShowEventForm] = useState(false)

	const [selectedEvent, setSelectedEvent] = useState(null)
	const [registrations, setRegistrations] = useState([])
	const [loadingRegistrations, setLoadingRegistrations] = useState(false)
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
		image_url: "",
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
			await loadAllRegistrations(hospitalData.id || id)
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

	async function loadAllRegistrations(hospitalId) {
		setLoadingRegistrations(true)
		try {
			const data = await apiFetch(`/event-registrations/?hospital=${hospitalId}`)
			setRegistrations(data)
		} catch (error) {
			console.error("Error loading all registrations:", error)
		} finally {
			setLoadingRegistrations(false)
		}
	}

	async function loadRegistrations(eventId) {
		setLoadingRegistrations(true)
		try {
			const data = await apiFetch(`/event-registrations/?event=${eventId}`)
			setRegistrations(data)
			setSelectedEvent(events.find(e => e.id === eventId))
			setActiveTab("registrations")
		} catch (error) {
			console.error("Error loading registrations:", error)
		} finally {
			setLoadingRegistrations(false)
		}
	}

	async function handleConfirmRegistration(regId) {
		try {
			await apiFetch(`/event-registrations/${regId}/confirm/`, { method: "POST" })
			alert("Registration confirmed!")
			await loadAllRegistrations(hospital?.id || id)
		} catch (error) {
			console.error("Error confirming registration:", error)
			alert("Error confirming registration.")
		}
	}

	async function handleMarkArrived(regId) {
		try {
			await apiFetch(`/event-registrations/${regId}/mark_arrived/`, { method: "POST" })
			alert("Donor marked as arrived!")
			await loadAllRegistrations(hospital?.id || id)
		} catch (error) {
			console.error("Error marking arrival:", error)
			alert("Error marking arrival.")
		}
	}

	async function handleRejectRegistration(regId) {
		if (!confirm("Are you sure you want to reject this registration?")) return
		try {
			await apiFetch(`/event-registrations/${regId}/reject/`, { method: "POST" })
			alert("Registration rejected.")
			await loadAllRegistrations(hospital?.id || id)
		} catch (error) {
			console.error("Error rejecting registration:", error)
			alert("Error rejecting registration.")
		}
	}

	async function handleDeleteRegistration(regId) {
		if (!confirm("Are you sure you want to delete this registration?")) return
		try {
			await apiFetch(`/event-registrations/${regId}/`, { method: "DELETE" })
			alert("Registration deleted.")
			await loadAllRegistrations(hospital?.id || id)
		} catch (error) {
			console.error("Error deleting registration:", error)
			alert("Error deleting registration.")
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
				image_url: "",
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
						<div className="flex items-center justify-between gap-4">
							<div className="flex-1">
								<h1 className="text-2xl font-bold text-white">Blood Donation Events</h1>
								<p className="text-sm text-pink-100/70">{hospital?.name}</p>
							</div>

							<div className="flex bg-[#1A1A2E] p-1 rounded-xl border border-[#F6D6E3]/20 shadow-inner">
								<button
									onClick={() => setActiveTab("events")}
									className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-300 ${activeTab === "events" ? "bg-[#E91E63] text-white shadow-lg" : "text-pink-100 hover:text-white hover:bg-white/5"}`}
								>
									Manage Events
								</button>
								<button
									onClick={() => setActiveTab("registrations")}
									className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-300 ${activeTab === "registrations" ? "bg-[#E91E63] text-white shadow-lg" : "text-pink-100 hover:text-white hover:bg-white/5"}`}
								>
									People Request
								</button>
							</div>

							<div className="flex gap-2">
								<button
									onClick={() => {
										setShowEventForm(!showEventForm)
										setActiveTab("events")
									}}
									className="rounded-lg bg-[#E91E63] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 shadow-lg shadow-[#E91E63]/20"
								>
									{showEventForm ? "Cancel" : "+ Add Event"}
								</button>
								<Link href={`/hospital/dashboard?id=${id}`} legacyBehavior>
									<a className="rounded-lg border border-[#F6D6E3] px-4 py-2 text-sm text-pink-100 hover:bg-white/5 transition">
										Dashboard
									</a>
								</Link>
							</div>
						</div>
					</div>
				</header>

				<div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
					{activeTab === "events" && (
						<div className="animate-in fade-in slide-in-from-top-4 duration-500 space-y-6">
							{showEventForm && (
								<form onSubmit={handleSubmitEvent} className="rounded-xl border border-[#F6D6E3]/40 bg-[#131326] p-6 space-y-4 shadow-2xl">
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
												min={new Date().toISOString().split("T")[0]}
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
										<div className="md:col-span-2">
											<label className="block text-sm font-medium text-pink-100 mb-1">Event Image URL</label>
											<input
												type="url"
												value={eventForm.image_url}
												onChange={(e) => setEventForm({ ...eventForm, image_url: e.target.value })}
												placeholder="https://example.com/event-image.jpg"
												className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
											/>
										</div>
									</div>
									<button
										type="submit"
										className="rounded-lg bg-[#E91E63] px-6 py-2 font-semibold text-white transition hover:opacity-90 shadow-lg shadow-[#E91E63]/30"
									>
										Publish Event
									</button>
								</form>
							)}

							<div className="grid gap-4">
								{events.length === 0 ? (
									<div className="rounded-2xl border border-dashed border-[#F6D6E3]/40 bg-[#131326] p-20 text-center">
										<p className="text-pink-100/40">You haven't hosted any events yet.</p>
									</div>
								) : (
									events.map((event) => (
										<div key={event.id} className="rounded-2xl border border-[#F6D6E3]/40 bg-[#131326] p-6 hover:border-[#E91E63]/40 transition shadow-xl group">
											<div className="flex flex-col md:flex-row gap-6">
												{event.image_url ? (
													<div className="w-full md:w-56 h-36 rounded-xl overflow-hidden border border-[#F6D6E3]/10 shadow-lg">
														<img src={event.image_url} alt={event.title} className="w-full h-full object-cover group-hover:scale-110 transition duration-700" />
													</div>
												) : (
													<div className="w-full md:w-56 h-36 rounded-xl bg-[#1A1A2E] flex items-center justify-center border border-[#F6D6E3]/10">
														<svg className="w-12 h-12 text-pink-100/10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
														</svg>
													</div>
												)}
												<div className="flex-1">
													<div className="flex items-start justify-between">
														<div>
															<h3 className="text-xl font-bold text-white group-hover:text-[#E91E63] transition-colors">{event.title}</h3>
															<p className="mt-1 text-sm text-pink-100/50 line-clamp-2">{event.description}</p>
														</div>
														<span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${event.status === "UPCOMING" ? "bg-blue-600/10 text-blue-400 border border-blue-600/20" :
															event.status === "ONGOING" ? "bg-green-600/10 text-green-400 border border-green-600/20" :
																"bg-gray-600/10 text-gray-400 border border-gray-600/20"
															}`}>
															{event.status || "UPCOMING"}
														</span>
													</div>
													<div className="mt-4 grid gap-4 sm:grid-cols-2 text-sm text-pink-100/70">
														<div className="flex items-center gap-2">
															<svg className="w-4 h-4 text-[#E91E63]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
															</svg>
															{event.event_date ? new Date(event.event_date).toLocaleDateString() : "No date set"}
														</div>
														<div className="flex items-center gap-2">
															<svg className="w-4 h-4 text-[#E91E63]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
																<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
															</svg>
															{event.location || "Online/TBD"}
														</div>
													</div>
													<div className="mt-6 flex items-center justify-between pt-4 border-t border-[#F6D6E3]/10">
														<div className="flex gap-4">
															<div className="text-center">
																<div className="text-xs text-pink-100/40 uppercase">Attending</div>
																<div className="font-bold text-white">{event.registered_count || 0}</div>
															</div>
															<div className="text-center border-l border-[#F6D6E3]/10 pl-4">
																<div className="text-xs text-pink-100/40 uppercase">Groups</div>
																<div className="font-bold text-[#E91E63]">{event.blood_groups_needed || "ALL"}</div>
															</div>
														</div>
														<button
															onClick={() => loadRegistrations(event.id)}
															className="rounded-lg bg-white/5 px-4 py-2 text-xs font-bold text-white hover:bg-[#E91E63] transition shadow-lg"
														>
															View Members
														</button>
													</div>
												</div>
											</div>
										</div>
									))
								)}
							</div>
						</div>
					)}

					{activeTab === "registrations" && (
						<div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
							<div className="flex items-center justify-between border-b border-[#F6D6E3]/20 pb-4">
								<h2 className="text-xl font-bold text-white flex items-center gap-2">
									<svg className="w-6 h-6 text-[#E91E63]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
									</svg>
									Registration Requests (Invoices)
								</h2>
								<div className="flex items-center gap-4">
									{selectedEvent && (
										<button
											onClick={() => { setSelectedEvent(null); loadAllRegistrations(hospital?.id || id); }}
											className="text-xs text-[#E91E63] font-bold hover:underline"
										>
											Show All Events
										</button>
									)}
									<div className="text-xs font-mono text-pink-100/40 uppercase tracking-widest">
										Total Entries: {registrations.length}
									</div>
								</div>
							</div>

							{loadingRegistrations ? (
								<div className="text-center py-20">
									<div className="h-12 w-12 animate-spin rounded-full border-4 border-[#E91E63] border-t-transparent mx-auto mb-4" />
									<p className="text-pink-100/60 font-medium">Synchronizing requests...</p>
								</div>
							) : registrations.length === 0 ? (
								<div className="rounded-3xl border border-dashed border-[#F6D6E3]/40 bg-[#131326] p-24 text-center">
									<p className="text-xl font-medium text-pink-100/80 mb-2">No Member Requests</p>
									<p className="text-sm text-pink-100/40 max-w-sm mx-auto">When donors register from the events page, their digital invoices will appear here for your confirmation.</p>
								</div>
							) : (
								<div className="overflow-hidden rounded-2xl border border-[#F6D6E3]/40 bg-[#131326] shadow-2xl">
									<div className="overflow-x-auto">
										<table className="w-full text-left border-collapse">
											<thead className="bg-[#1A1A2E] text-[10px] font-black uppercase tracking-[0.2em] text-[#E91E63]/80">
												<tr>
													<th className="px-6 py-6">Event</th>
													<th className="px-6 py-6">Donor Details</th>
													<th className="px-6 py-6">Invoice ID</th>
													<th className="px-6 py-6">Status</th>
													<th className="px-6 py-6 text-right">Confirm / Action</th>
												</tr>
											</thead>
											<tbody className="divide-y divide-[#F6D6E3]/10">
												{registrations.map((reg) => (
													<tr key={reg.id} className="hover:bg-white/[0.02] transition-colors group">
														<td className="px-6 py-5">
															<div className="font-bold text-white group-hover:text-[#E91E63] transition-colors">{reg.event?.title}</div>
															<div className="text-[10px] text-pink-100/30 uppercase mt-1 font-semibold">{reg.event?.location}</div>
														</td>
														<td className="px-6 py-5">
															<div className="flex items-center gap-3">
																<div className="h-10 w-10 rounded-full bg-gradient-to-tr from-[#E91E63] to-pink-500 flex items-center justify-center font-black text-white text-sm shadow-lg shadow-[#E91E63]/20">
																	{reg.donor?.first_name?.[0]}
																</div>
																<div>
																	<div className="font-bold text-white">{reg.donor?.first_name} {reg.donor?.last_name}</div>
																	<div className="flex items-center gap-2 mt-0.5">
																		<span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-pink-100/60 font-mono italic">
																			{reg.donor?.blood_group || "??"}
																		</span>
																		<span className="text-[10px] text-pink-100/40">{reg.donor?.phone}</span>
																	</div>
																	{reg.verification_document && (
																		<a href={reg.verification_document} target="_blank" rel="noopener noreferrer" className="text-[9px] text-[#E91E63] font-bold block mt-1 hover:underline">
																			View ID Proof
																		</a>
																	)}
																</div>
															</div>
														</td>
														<td className="px-6 py-5">
															<span className="font-mono text-xs font-bold text-pink-100/60 bg-[#1A1A2E] px-3 py-1.5 rounded-lg border border-[#F6D6E3]/10">
																{reg.invoice_number}
															</span>
														</td>
														<td className="px-6 py-5">
															<div className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-wider ${reg.status === "APPROVED" ? "bg-green-500/10 text-green-400 border border-green-500/20" :
																reg.status === "ARRIVED" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" :
																	reg.status === "PENDING" ? "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20" :
																		reg.status === "REJECTED" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
																			reg.status === "COMING" ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" :
																				reg.status === "NOT_COMING" ? "bg-gray-500/10 text-gray-400 border border-gray-500/20" :
																					"bg-white/5 text-gray-400"
																}`}>
																<div className={`h-1.5 w-1.5 rounded-full animate-pulse ${reg.status === "APPROVED" ? "bg-green-400" :
																	reg.status === "ARRIVED" ? "bg-blue-400" :
																		reg.status === "PENDING" ? "bg-yellow-400" :
																			reg.status === "REJECTED" ? "bg-red-400" :
																				reg.status === "COMING" ? "bg-purple-400" :
																					"bg-gray-400"
																	}`} />
																{reg.status === "NOT_COMING" ? "Cancelled" : reg.status}
															</div>
														</td>
														<td className="px-6 py-5 text-right">
															<div className="flex justify-end gap-2">
																{reg.status === "PENDING" && (
																	<>
																		<button
																			onClick={() => handleConfirmRegistration(reg.id)}
																			className="rounded-xl bg-[#E91E63] px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-white hover:scale-105 transition active:scale-95 shadow-xl shadow-[#E91E63]/20"
																		>
																			Accept
																		</button>
																		<button
																			onClick={() => handleRejectRegistration(reg.id)}
																			className="rounded-xl bg-red-600 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-red-700 hover:scale-105 transition active:scale-95 shadow-xl shadow-red-600/20"
																		>
																			Reject
																		</button>
																	</>
																)}
																{(reg.status === "APPROVED" || reg.status === "COMING") && (
																	<button
																		onClick={() => handleMarkArrived(reg.id)}
																		className="rounded-xl bg-blue-600 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-blue-700 hover:scale-105 transition active:scale-95 shadow-xl shadow-blue-600/20"
																	>
																		Mark Arrived
																	</button>
																)}
																{reg.status === "ARRIVED" && (
																	<div className="flex items-center gap-2 text-green-400 font-bold text-xs pr-4">
																		<div className="h-6 w-6 rounded-full bg-green-500/20 flex items-center justify-center">
																			<svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
																				<path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
																			</svg>
																		</div>
																		Confirmed
																	</div>
																)}
																<button
																	onClick={() => handleDeleteRegistration(reg.id)}
																	className="rounded-xl bg-gray-600/20 border border-white/10 px-3 py-2.5 text-white hover:bg-red-600/80 hover:border-red-500/50 transition active:scale-95 group"
																	title="Delete Request"
																>
																	<svg className="w-4 h-4 text-gray-400 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
																	</svg>
																</button>
															</div>
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								</div>
							)}
						</div>
					)}
				</div>
			</main>
		</>
	)
}
