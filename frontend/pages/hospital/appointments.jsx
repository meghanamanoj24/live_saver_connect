import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import { useState, useEffect } from "react"
import { apiFetch } from "../../lib/api"

export default function HospitalAppointments() {
	const router = useRouter()
	const { id } = router.query
	const [hospital, setHospital] = useState(null)
	const [appointments, setAppointments] = useState([])
	const [doctors, setDoctors] = useState([])
	const [loading, setLoading] = useState(true)

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
			const hospitalId = hospitalData.id || id
			await Promise.all([
				loadAppointments(hospitalId),
				loadDoctors(hospitalId),
			])
		} catch (error) {
			console.error("Error loading data:", error)
		} finally {
			setLoading(false)
		}
	}

	async function loadAppointments(hospitalId) {
		try {
			const data = await apiFetch(`/appointments/?hospital=${hospitalId}`)
			setAppointments(data)
		} catch (error) {
			console.error("Error loading appointments:", error)
			setAppointments([])
		}
	}

	async function loadDoctors(hospitalId) {
		try {
			const data = await apiFetch(`/doctors/?hospital=${hospitalId}`)
			setDoctors(data.filter(d => d.hospital?.id === hospitalId || d.hospital_id === hospitalId))
		} catch (error) {
			console.error("Error loading doctors:", error)
			setDoctors([])
		}
	}

	if (loading) {
		return (
			<main className="min-h-screen bg-[#1A1A2E] text-white flex items-center justify-center">
				<div className="text-center">
					<div className="h-12 w-12 animate-spin rounded-full border-4 border-[#E91E63] border-t-transparent mx-auto" />
					<p className="mt-4 text-pink-100/70">Loading appointments...</p>
				</div>
			</main>
		)
	}

	const scheduledAppointments = appointments.filter(a => a.status === "SCHEDULED")
	const completedAppointments = appointments.filter(a => a.status === "COMPLETED")

	return (
		<>
			<Head>
				<title>Appointments — {hospital?.name || "Hospital"} Dashboard</title>
			</Head>
			<main className="min-h-screen bg-[#1A1A2E] text-white">
				<header className="border-b border-[#F6D6E3]/30 bg-[#131326]/80 backdrop-blur sticky top-0 z-10">
					<div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
						<div className="flex items-center justify-between">
							<div>
								<h1 className="text-2xl font-bold text-white">Appointments</h1>
								<p className="text-sm text-pink-100/70">{hospital?.name}</p>
							</div>
							<Link href={`/hospital/dashboard?id=${id}`} legacyBehavior>
								<a className="rounded-lg border border-[#F6D6E3] px-4 py-2 text-sm text-pink-100 hover:bg-white/5">
									Back to Dashboard
								</a>
							</Link>
						</div>
					</div>
				</header>

				<div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
					<div className="mb-6 flex gap-4">
						<span className="rounded-full bg-blue-600/20 px-3 py-1 text-sm text-blue-400">
							{scheduledAppointments.length} Scheduled
						</span>
						<span className="rounded-full bg-green-600/20 px-3 py-1 text-sm text-green-400">
							{completedAppointments.length} Completed
						</span>
					</div>

					<div className="space-y-4">
						{appointments.map((appointment) => {
							const donor = appointment.donor || {}
							const doctor = appointment.doctor || {}
							const statusColors = {
								SCHEDULED: "bg-blue-600/20 text-blue-400",
								COMPLETED: "bg-green-600/20 text-green-400",
								CANCELLED: "bg-red-600/20 text-red-400",
								RESCHEDULED: "bg-yellow-600/20 text-yellow-400",
							}
							const statusColor = statusColors[appointment.status] || "bg-gray-600/20 text-gray-400"

							return (
								<div key={appointment.id} className="rounded-xl border border-[#F6D6E3]/40 bg-[#131326] p-6">
									<div className="flex items-start justify-between">
										<div className="flex-1">
											<div className="flex items-center gap-3 mb-2">
												<h3 className="text-lg font-semibold text-white">
													{donor.first_name || donor.username || "Patient"} {donor.last_name || ""}
												</h3>
												<span className={`rounded-full px-2 py-1 text-xs font-medium ${statusColor}`}>
													{appointment.status}
												</span>
											</div>
											{doctor.name && (
												<p className="mt-1 text-sm text-pink-100/70">
													Doctor: <span className="font-semibold">{doctor.name}</span>
													{doctor.specialization && ` (${doctor.specialization})`}
												</p>
											)}
											<p className="mt-1 text-sm text-pink-100/70">
												Date: {new Date(appointment.appointment_date).toLocaleDateString()}
											</p>
											{appointment.appointment_time && (
												<p className="mt-1 text-sm text-pink-100/70">
													Time: {appointment.appointment_time}
												</p>
											)}
											{appointment.charges && (
												<p className="mt-1 text-sm text-green-400">
													Charges: {appointment.currency} {appointment.charges}
												</p>
											)}
											{appointment.notes && (
												<p className="mt-2 text-sm text-pink-100/60">{appointment.notes}</p>
											)}
											<p className="mt-2 text-xs text-pink-100/60">
												Created: {new Date(appointment.created_at || Date.now()).toLocaleString()}
											</p>
										</div>
									</div>
								</div>
							)
						})}
					</div>

					{appointments.length === 0 && (
						<div className="rounded-xl border border-dashed border-[#F6D6E3]/40 bg-[#131326] p-12 text-center">
							<p className="text-pink-100/70">No appointments found</p>
						</div>
					)}
				</div>
			</main>
		</>
	)
}
