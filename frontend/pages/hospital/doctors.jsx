import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import { useState, useEffect } from "react"
import { apiFetch } from "../../lib/api"

export default function HospitalDoctors() {
	const router = useRouter()
	const { id } = router.query
	const [hospital, setHospital] = useState(null)
	const [doctors, setDoctors] = useState([])
	const [loading, setLoading] = useState(true)
	const [showDoctorForm, setShowDoctorForm] = useState(false)
	const [showAvailabilityForm, setShowAvailabilityForm] = useState(null)
	const [doctorForm, setDoctorForm] = useState({
		name: "",
		specialization: "",
		qualifications: "",
		phone: "",
		email: "",
		nmc_number: "",
		consultation_charge: "",
		currency: "INR",
		is_available: true,
	})
	const [availabilityForm, setAvailabilityForm] = useState({
		day_of_week: 0,
		start_time: "",
		end_time: "",
		is_available: true,
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
			await loadDoctors(hospitalData.id || id)
		} catch (error) {
			console.error("Error loading data:", error)
		} finally {
			setLoading(false)
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

	async function handleSubmitDoctor(e) {
		e.preventDefault()
		try {
			const response = await apiFetch("/doctors/", {
				method: "POST",
				body: JSON.stringify({
					...doctorForm,
					hospital_id: hospital?.id || id,
					consultation_charge: doctorForm.consultation_charge ? parseFloat(doctorForm.consultation_charge) : null,
				}),
			})
			setShowDoctorForm(false)
			setDoctorForm({
				name: "",
				specialization: "",
				qualifications: "",
				phone: "",
				email: "",
				nmc_number: "",
				consultation_charge: "",
				currency: "INR",
				is_available: true,
			})
			await loadDoctors(hospital?.id || id)
			alert("Doctor added successfully!")
		} catch (error) {
			console.error("Error adding doctor:", error)
			const errorMessage = error.body?.detail || error.message || "Error adding doctor. Please try again."
			alert(errorMessage)
		}
	}

	async function handleAddAvailability(doctorId) {
		try {
			await apiFetch("/doctor-availabilities/", {
				method: "POST",
				body: JSON.stringify({
					...availabilityForm,
					doctor_id: doctorId,
				}),
			})
			setShowAvailabilityForm(null)
			setAvailabilityForm({
				day_of_week: 0,
				start_time: "",
				end_time: "",
				is_available: true,
			})
			loadDoctors(hospital.id)
			alert("Availability added successfully!")
		} catch (error) {
			alert("Error adding availability. Please try again.")
		}
	}

	if (loading) {
		return (
			<main className="min-h-screen bg-[#1A1A2E] text-white flex items-center justify-center">
				<div className="text-center">
					<div className="h-12 w-12 animate-spin rounded-full border-4 border-[#E91E63] border-t-transparent mx-auto" />
					<p className="mt-4 text-pink-100/70">Loading doctors...</p>
				</div>
			</main>
		)
	}

	return (
		<>
			<Head>
				<title>Doctors — {hospital?.name || "Hospital"} Dashboard</title>
			</Head>
			<main className="min-h-screen bg-[#1A1A2E] text-white">
				<header className="border-b border-[#F6D6E3]/30 bg-[#131326]/80 backdrop-blur sticky top-0 z-10">
					<div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
						<div className="flex items-center justify-between">
							<div>
								<h1 className="text-2xl font-bold text-white">Doctors</h1>
								<p className="text-sm text-pink-100/70">{hospital?.name}</p>
							</div>
							<div className="flex gap-2">
								<button
									onClick={() => setShowDoctorForm(!showDoctorForm)}
									className="rounded-lg bg-[#E91E63] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
								>
									{showDoctorForm ? "Cancel" : "+ Add Doctor"}
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
					{showDoctorForm && (
						<form onSubmit={handleSubmitDoctor} className="rounded-xl border border-[#F6D6E3]/40 bg-[#131326] p-6 space-y-4 mb-6">
							<h2 className="text-xl font-bold text-white mb-4">Add New Doctor</h2>
							<div className="grid gap-4 md:grid-cols-2">
								<div>
									<label className="block text-sm font-medium text-pink-100 mb-1">Name *</label>
									<input
										type="text"
										required
										value={doctorForm.name}
										onChange={(e) => setDoctorForm({ ...doctorForm, name: e.target.value })}
										className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-pink-100 mb-1">NMC Number *</label>
									<input
										type="text"
										required
										value={doctorForm.nmc_number}
										onChange={(e) => setDoctorForm({ ...doctorForm, nmc_number: e.target.value })}
										placeholder="National Medical Commission registration number"
										className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-pink-100 mb-1">Specialization</label>
									<input
										type="text"
										value={doctorForm.specialization}
										onChange={(e) => setDoctorForm({ ...doctorForm, specialization: e.target.value })}
										className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-pink-100 mb-1">Consultation Charge</label>
									<input
										type="number"
										step="0.01"
										value={doctorForm.consultation_charge}
										onChange={(e) => setDoctorForm({ ...doctorForm, consultation_charge: e.target.value })}
										className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-pink-100 mb-1">Phone</label>
									<input
										type="tel"
										value={doctorForm.phone}
										onChange={(e) => setDoctorForm({ ...doctorForm, phone: e.target.value })}
										className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-pink-100 mb-1">Email</label>
									<input
										type="email"
										value={doctorForm.email}
										onChange={(e) => setDoctorForm({ ...doctorForm, email: e.target.value })}
										className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
									/>
								</div>
								<div className="md:col-span-2">
									<label className="block text-sm font-medium text-pink-100 mb-1">Qualifications</label>
									<textarea
										value={doctorForm.qualifications}
										onChange={(e) => setDoctorForm({ ...doctorForm, qualifications: e.target.value })}
										rows={3}
										className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
										placeholder="Medical degrees, certifications, etc."
									/>
								</div>
							</div>
							<button
								type="submit"
								className="rounded-lg bg-[#E91E63] px-6 py-2 font-semibold text-white transition hover:opacity-90"
							>
								Add Doctor
							</button>
						</form>
					)}

					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
						{doctors.map((doctor) => (
							<div key={doctor.id} className="rounded-xl border border-[#F6D6E3]/40 bg-[#131326] p-6">
								<h3 className="text-lg font-semibold text-white">{doctor.name}</h3>
								{doctor.specialization && (
									<p className="mt-1 text-sm text-pink-100/70">{doctor.specialization}</p>
								)}
								{doctor.nmc_number && (
									<p className="mt-1 text-xs text-pink-100/60">NMC: {doctor.nmc_number}</p>
								)}
								{doctor.consultation_charge && (
									<p className="mt-1 text-sm text-green-400">
										Charge: {doctor.currency} {doctor.consultation_charge}
									</p>
								)}
								{doctor.qualifications && (
									<p className="mt-2 text-xs text-pink-100/60">{doctor.qualifications}</p>
								)}
								{doctor.phone && (
									<p className="mt-2 text-xs text-pink-100/60">Phone: {doctor.phone}</p>
								)}
								{doctor.email && (
									<p className="mt-1 text-xs text-pink-100/60">Email: {doctor.email}</p>
								)}
								{doctor.availability_schedules && doctor.availability_schedules.length > 0 && (
									<div className="mt-3">
										<p className="text-xs font-medium text-pink-100/80 mb-1">Availability:</p>
										{doctor.availability_schedules.map((schedule) => (
											<p key={schedule.id} className="text-xs text-pink-100/60">
												{schedule.day_name}: {schedule.start_time} - {schedule.end_time}
											</p>
										))}
									</div>
								)}
								<button
									onClick={() => setShowAvailabilityForm(doctor.id)}
									className="mt-3 w-full rounded-lg border border-[#E91E63] px-3 py-1.5 text-xs text-[#E91E63] hover:bg-[#E91E63]/10 transition"
								>
									+ Add Availability
								</button>
							</div>
						))}
					</div>

					{showAvailabilityForm && (
						<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
							<div className="bg-[#131326] rounded-xl border border-[#F6D6E3]/40 p-6 max-w-md w-full mx-4">
								<h3 className="text-xl font-bold text-white mb-4">Add Availability Schedule</h3>
								<div className="space-y-4">
									<div>
										<label className="block text-sm font-medium text-pink-100 mb-1">Day of Week</label>
										<select
											value={availabilityForm.day_of_week}
											onChange={(e) => setAvailabilityForm({ ...availabilityForm, day_of_week: parseInt(e.target.value) })}
											className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
										>
											<option value={0}>Monday</option>
											<option value={1}>Tuesday</option>
											<option value={2}>Wednesday</option>
											<option value={3}>Thursday</option>
											<option value={4}>Friday</option>
											<option value={5}>Saturday</option>
											<option value={6}>Sunday</option>
										</select>
									</div>
									<div className="grid grid-cols-2 gap-4">
										<div>
											<label className="block text-sm font-medium text-pink-100 mb-1">Start Time</label>
											<input
												type="time"
												value={availabilityForm.start_time}
												onChange={(e) => setAvailabilityForm({ ...availabilityForm, start_time: e.target.value })}
												className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-pink-100 mb-1">End Time</label>
											<input
												type="time"
												value={availabilityForm.end_time}
												onChange={(e) => setAvailabilityForm({ ...availabilityForm, end_time: e.target.value })}
												className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
											/>
										</div>
									</div>
									<div className="flex gap-2">
										<button
											onClick={() => handleAddAvailability(showAvailabilityForm)}
											className="flex-1 rounded-lg bg-[#E91E63] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
										>
											Add Schedule
										</button>
										<button
											onClick={() => {
												setShowAvailabilityForm(null)
												setAvailabilityForm({
													day_of_week: 0,
													start_time: "",
													end_time: "",
													is_available: true,
												})
											}}
											className="rounded-lg border border-[#F6D6E3] px-4 py-2 text-sm text-pink-100 hover:bg-white/5"
										>
											Cancel
										</button>
									</div>
								</div>
							</div>
						</div>
					)}
				</div>
			</main>
		</>
	)
}
