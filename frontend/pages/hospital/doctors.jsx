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
	const [editingDoctor, setEditingDoctor] = useState(null)
	const [arrivedAppointments, setArrivedAppointments] = useState([])
	const [showPrescriptionModal, setShowPrescriptionModal] = useState(null)
	const [medicalStoreProducts, setMedicalStoreProducts] = useState([])
	const [showHistory, setShowHistory] = useState(null)
	const [doctorHistory, setDoctorHistory] = useState([])
	const [loadingHistory, setLoadingHistory] = useState(false)

	const [doctorForm, setDoctorForm] = useState({
		name: "",
		specialization: "",
		qualifications: "",
		phone: "",
		email: "",
		nmc_number: "",
		consultation_charge: "",
		currency: "INR",
		time_schedule: "",
		is_available: true,
	})
	const [availabilityForm, setAvailabilityForm] = useState({
		day_of_week: 0,
		start_time: "",
		end_time: "",
		is_available: true,
	})

	const [prescriptionForm, setPrescriptionForm] = useState({
		medicines: [], // [{ id, name, dosage, timing }]
		custom_medicines: [], // [{ name, dosage, timing }]
		next_consultation_date: "",
	})
	const [currentMedicine, setCurrentMedicine] = useState({
		id: "",
		name: "",
		dosage: "1-0-1",
		timing: "AFTER_FOOD",
		is_custom: false
	})

	useEffect(() => {
		loadData()
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
				loadDoctors(hospitalId),
				loadArrivedPatients(hospitalId),
				loadMedicalStoreProducts()
			])
		} catch (error) {
			console.error("Error loading data:", error)
		} finally {
			setLoading(false)
		}
	}

	async function loadDoctors(hospitalId) {
		try {
			const data = await apiFetch(`/doctors/?hospital=${hospitalId}`)
			setDoctors(data.filter(d => String(d.hospital?.id || d.hospital_id) === String(hospitalId)))
		} catch (error) {
			console.error("Error loading doctors:", error)
			setDoctors([])
		}
	}

	async function loadArrivedPatients(hospitalId) {
		try {
			const data = await apiFetch(`/appointments/?hospital=${hospitalId}&status=ARRIVED`)
			setArrivedAppointments(data)
		} catch (error) {
			console.error("Error loading arrived patients:", error)
		}
	}

	async function loadMedicalStoreProducts() {
		try {
			const data = await apiFetch("/medical-store-products/?active=true")
			setMedicalStoreProducts(Array.isArray(data) ? data : (data.results || []))
		} catch (error) {
			console.error("Error loading medical store products:", error)
		}
	}

	async function handleSubmitDoctor(e) {
		e.preventDefault()
		try {
			const payload = {
				...doctorForm,
				hospital_id: hospital?.id || id,
				consultation_charge: doctorForm.consultation_charge ? parseFloat(doctorForm.consultation_charge) : null,
			}

			if (editingDoctor) {
				await apiFetch(`/doctors/${editingDoctor.id}/`, {
					method: "PATCH",
					body: JSON.stringify(payload),
				})
				alert("Doctor updated successfully!")
			} else {
				await apiFetch("/doctors/", {
					method: "POST",
					body: JSON.stringify(payload),
				})
				alert("Doctor added successfully!")
			}

			setShowDoctorForm(false)
			setEditingDoctor(null)
			setDoctorForm({
				name: "",
				specialization: "",
				qualifications: "",
				phone: "",
				email: "",
				nmc_number: "",
				consultation_charge: "",
				currency: "INR",
				time_schedule: "",
				is_available: true,
			})
			await loadDoctors(hospital?.id || id)
		} catch (error) {
			console.error("Error saving doctor:", error)
			alert(error.message || "Error saving doctor.")
		}
	}

	async function handleDeleteDoctor(doctorId) {
		if (!confirm("Are you sure you want to delete this doctor? This action cannot be undone.")) return

		try {
			await apiFetch(`/doctors/${doctorId}/`, {
				method: "DELETE",
			})
			alert("Doctor deleted successfully!")
			await loadDoctors(hospital?.id || id)
		} catch (error) {
			console.error("Error deleting doctor:", error)
			alert("Failed to delete doctor.")
		}
	}

	function addMedicine() {
		if (!currentMedicine.id && !currentMedicine.is_custom) return

		if (currentMedicine.is_custom) {
			if (!currentMedicine.name) return
			setPrescriptionForm(prev => ({
				...prev,
				custom_medicines: [...prev.custom_medicines, { ...currentMedicine, price: 0, currency: "INR" }]
			}))
		} else {
			const med = medicalStoreProducts.find(p => p.id === parseInt(currentMedicine.id))
			setPrescriptionForm(prev => ({
				...prev,
				medicines: [...prev.medicines, {
					...currentMedicine,
					product_id: med?.id,
					supplier_id: med?.supplier?.id || med?.supplier_id,
					name: med?.name,
					price: med?.price || 0,
					currency: med?.currency || "INR"
				}]
			}))
		}
		setCurrentMedicine({ id: "", name: "", dosage: "1-0-1", timing: "AFTER_FOOD", is_custom: false })
	}

	function removeMedicine(index, isCustom = false) {
		setPrescriptionForm(prev => {
			if (isCustom) {
				const newList = [...prev.custom_medicines]
				newList.splice(index, 1)
				return { ...prev, custom_medicines: newList }
			} else {
				const newList = [...prev.medicines]
				newList.splice(index, 1)
				return { ...prev, medicines: newList }
			}
		})
	}

	async function handleSubmitPrescription(e) {
		e.preventDefault()
		if (!showPrescriptionModal) return

		try {
			// Verify the appointment is still in ARRIVED status
			const currentAppt = await apiFetch(`/appointments/${showPrescriptionModal.id}/`)

			if (currentAppt.status !== "ARRIVED") {
				alert(`Cannot submit prescription. Appointment status is "${currentAppt.status}". Please ensure the patient has arrived first.`)
				setShowPrescriptionModal(null)
				loadArrivedPatients(hospital.id)
				return
			}

			await apiFetch(`/appointments/${showPrescriptionModal.id}/submit_prescription/`, {
				method: "POST",
				body: JSON.stringify({
					prescription_data: {
						medicines: prescriptionForm.medicines,
						custom_medicines: prescriptionForm.custom_medicines
					},
					next_consultation_date: prescriptionForm.next_consultation_date
				})
			})
			alert("Prescription submitted and appointment completed!")
			setShowPrescriptionModal(null)
			setPrescriptionForm({ medicines: [], custom_medicines: [], next_consultation_date: "" })
			loadArrivedPatients(hospital.id)
		} catch (error) {
			alert(error.message || "Failed to submit prescription.")
		}
	}

	function handleEditClick(doctor) {
		setEditingDoctor(doctor)
		setDoctorForm({
			name: doctor.name || "",
			specialization: doctor.specialization || "",
			qualifications: doctor.qualifications || "",
			phone: doctor.phone || "",
			email: doctor.email || "",
			nmc_number: doctor.nmc_number || "",
			consultation_charge: doctor.consultation_charge || "",
			currency: doctor.currency || "INR",
			time_schedule: doctor.time_schedule || "",
			is_available: doctor.is_available,
		})
		setShowDoctorForm(true)
		window.scrollTo({ top: 0, behavior: 'smooth' })
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

	async function loadDoctorHistory(doctorId) {
		setLoadingHistory(true)
		try {
			const data = await apiFetch(`/appointments/?doctor=${doctorId}&status=COMPLETED`)
			setDoctorHistory(data)
		} catch (error) {
			console.error("Error loading history:", error)
		} finally {
			setLoadingHistory(false)
		}
	}

	if (loading) {
		return (
			<main className="min-h-screen bg-[#1A1A2E] text-white flex items-center justify-center">
				<div className="text-center">
					<div className="h-12 w-12 animate-spin rounded-full border-4 border-[#E91E63] border-t-transparent mx-auto" />
					<p className="mt-4 text-pink-100/70">Loading dashboard...</p>
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
								<h1 className="text-2xl font-bold text-white">Doctors Dashboard</h1>
								<p className="text-sm text-pink-100/70">{hospital?.name}</p>
							</div>
							<div className="flex gap-2">
								<button
									onClick={() => {
										setEditingDoctor(null)
										setDoctorForm({
											name: "",
											specialization: "",
											qualifications: "",
											phone: "",
											email: "",
											nmc_number: "",
											consultation_charge: "",
											currency: "INR",
											time_schedule: "",
											is_available: true,
										})
										setShowDoctorForm(!showDoctorForm)
									}}
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

				<div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-12">
					{/* Arrived Patients Section */}
					<section className="space-y-4">
						<div className="flex items-center justify-between">
							<h2 className="text-xl font-black text-white uppercase tracking-wider flex items-center gap-2">
								<span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">🩺</span>
								Arrived Patients (Queue)
							</h2>
							<span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-400 border border-blue-500/20">
								{arrivedAppointments.length} Joined
							</span>
						</div>

						{arrivedAppointments.length > 0 ? (
							<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
								{arrivedAppointments.map((appt) => (
									<div key={appt.id} className="rounded-2xl border border-blue-500/30 bg-[#131326] p-5 shadow-lg relative overflow-hidden group">
										<div className="absolute top-0 right-0 p-4">
											<div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
										</div>
										<div className="flex items-start gap-4">
											<div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-xl font-bold text-white border border-white/10 group-hover:border-blue-500/50 transition-colors">
												{appt.donor?.first_name?.[0] || appt.donor?.username?.[0] || "?"}
											</div>
											<div className="flex-1">
												<h3 className="font-bold text-white leading-tight">{appt.donor?.first_name} {appt.donor?.last_name}</h3>
												<p className="text-xs text-pink-100/60 mt-0.5">{appt.donor?.email}</p>
											</div>
										</div>

										<div className="mt-4 p-3 rounded-xl bg-white/5 border border-white/10">
											<div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-2">
												<span>Doctor Assigned</span>
											</div>
											<p className="text-sm font-bold text-white">Dr. {appt.doctor?.name || "N/A"}</p>
											<p className="text-xs text-pink-100/50">{appt.doctor?.specialization}</p>
										</div>

										<div className="mt-4 flex gap-2">
											<button
												onClick={() => {
													setShowPrescriptionModal(appt)
													setPrescriptionForm({ medicines: [], custom_medicines: [], next_consultation_date: "" })
												}}
												className="flex-1 rounded-xl bg-blue-600 py-3 text-[10px] font-black uppercase tracking-widest text-white hover:bg-blue-500 transition shadow-lg shadow-blue-500/20"
											>
												Add Prescription
											</button>
										</div>
									</div>
								))}
							</div>
						) : (
							<div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-12 text-center">
								<p className="text-sm text-pink-100/40 font-medium italic">No patients have arrived yet. They will appear here once marked as arrived by staff.</p>
							</div>
						)}
					</section>

					<div className="h-px bg-white/5 w-full"></div>

					{/* Doctor Management Section */}
					<section className="space-y-6">
						<div className="flex items-center justify-between">
							<h2 className="text-xl font-black text-white uppercase tracking-wider">Hospital Doctors</h2>
						</div>

						{showDoctorForm && (
							<form onSubmit={handleSubmitDoctor} className="rounded-xl border border-[#F6D6E3]/40 bg-[#131326] p-6 space-y-4 mb-6 animate-in slide-in-from-top-4 duration-300">
								<h2 className="text-xl font-bold text-white mb-4">{editingDoctor ? "Edit Doctor" : "Add New Doctor"}</h2>
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
											placeholder="Registration Number"
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
										<label className="block text-sm font-medium text-pink-100 mb-1">Time Schedule *</label>
										<input
											type="text"
											required
											value={doctorForm.time_schedule}
											onChange={(e) => setDoctorForm({ ...doctorForm, time_schedule: e.target.value })}
											placeholder="e.g. Mon-Fri 10AM-4PM"
											className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
										/>
									</div>
								</div>
								<div className="flex gap-3 pt-2">
									<button type="submit" className="rounded-lg bg-[#E91E63] px-6 py-2 font-semibold text-white transition hover:opacity-90">
										{editingDoctor ? "Update Doctor" : "Add Doctor"}
									</button>
									<button type="button" onClick={() => { setShowDoctorForm(false); setEditingDoctor(null); }} className="rounded-lg border border-[#F6D6E3] px-6 py-2 text-pink-100 hover:bg-white/5">
										Cancel
									</button>
								</div>
							</form>
						)}

						<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
							{doctors.map((doctor) => (
								<div key={doctor.id} className="rounded-2xl border border-white/10 bg-[#131326] p-6 hover:border-pink-500/30 transition-colors shadow-xl">
									<h3 className="text-lg font-bold text-white">{doctor.name}</h3>
									<p className="text-sm text-pink-400 font-medium">{doctor.specialization}</p>
									<div className="mt-4 space-y-2 text-xs text-pink-100/60">
										<p>NMC: {doctor.nmc_number}</p>
										<p className="text-green-400 font-bold">Fee: {doctor.currency} {doctor.consultation_charge}</p>
										<p>📱 {doctor.phone}</p>
										<p className="mt-3 p-2 rounded bg-white/5 border border-white/10 text-white font-medium">
											{doctor.time_schedule}
										</p>
									</div>
									<div className="grid grid-cols-2 gap-2 mt-6">
										<button onClick={() => handleEditClick(doctor)} className="rounded-lg border border-white/10 py-2 text-xs font-bold text-white hover:bg-white/5 transition">Edit</button>
										<button onClick={() => handleDeleteDoctor(doctor.id)} className="rounded-lg border border-red-500/20 py-2 text-xs font-bold text-red-400 hover:bg-red-500/10 transition">Delete</button>
									</div>
									<button onClick={() => setShowAvailabilityForm(doctor.id)} className="mt-2 w-full rounded-lg bg-pink-500/10 py-2 text-[10px] font-black text-pink-400 uppercase tracking-widest hover:bg-pink-500/20 transition">Manage Specific Slots</button>
									<button
										onClick={() => {
											setShowHistory(doctor);
											loadDoctorHistory(doctor.id);
										}}
										className="mt-2 w-full rounded-lg bg-blue-500/10 py-2 text-[10px] font-black text-blue-400 uppercase tracking-widest hover:bg-blue-500/20 transition border border-blue-500/20"
									>
										View Patient History
									</button>
								</div>
							))}
						</div>
					</section>
				</div>

				{/* Prescription Modal */}
				{showPrescriptionModal && (
					<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0A0A1A]/90 backdrop-blur-md">
						<div className="w-full max-w-2xl rounded-3xl overflow-hidden border border-white/10 bg-[#131326] shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
							<div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 flex items-center justify-between">
								<div>
									<h2 className="text-xl font-black text-white uppercase tracking-widest">Medical Prescription</h2>
									<p className="text-blue-100/70 text-xs mt-1">Patient: {showPrescriptionModal.donor?.first_name} {showPrescriptionModal.donor?.last_name}</p>
								</div>
								<button onClick={() => setShowPrescriptionModal(null)} className="text-white/70 hover:text-white p-2">
									<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
								</button>
							</div>

							<div className="p-6 overflow-y-auto space-y-6 flex-1">
								<div className="space-y-4">
									<div className="flex items-center justify-between">
										<h3 className="text-xs font-black text-blue-400 uppercase tracking-widest">Add Medicine</h3>
										<button onClick={() => setCurrentMedicine({ ...currentMedicine, is_custom: !currentMedicine.is_custom, id: "", name: "" })} className="text-[10px] font-bold text-pink-400 uppercase tracking-widest">
											{currentMedicine.is_custom ? "Use Store Items" : "Custom Entry"}
										</button>
									</div>

									<div className="grid gap-4 md:grid-cols-2 bg-white/5 p-4 rounded-2xl border border-white/10">
										<div className="md:col-span-2">
											<label className="block text-[10px] font-black text-pink-500 uppercase tracking-widest mb-1.5">{currentMedicine.is_custom ? "Name" : "Store Item"}</label>
											{currentMedicine.is_custom ? (
												<input type="text" value={currentMedicine.name} onChange={(e) => setCurrentMedicine({ ...currentMedicine, name: e.target.value })} className="w-full rounded-xl border border-white/10 bg-[#1A1A2E] px-4 py-3 text-sm text-white focus:border-blue-500 outline-none" placeholder="Medicine name..." />
											) : (
												<select value={currentMedicine.id} onChange={(e) => setCurrentMedicine({ ...currentMedicine, id: e.target.value })} className="w-full rounded-xl border border-white/10 bg-[#1A1A2E] px-4 py-3 text-sm text-white focus:border-blue-500 outline-none">
													<option value="">-- Select medicine --</option>
													{medicalStoreProducts.map(p => <option key={p.id} value={p.id}>{p.name} - {p.brand}</option>)}
												</select>
											)}
										</div>
										<input type="text" value={currentMedicine.dosage} onChange={(e) => setCurrentMedicine({ ...currentMedicine, dosage: e.target.value })} className="rounded-xl border border-white/10 bg-[#1A1A2E] px-4 py-3 text-sm text-white outline-none" placeholder="Dosage (1-0-1)" />
										<select value={currentMedicine.timing} onChange={(e) => setCurrentMedicine({ ...currentMedicine, timing: e.target.value })} className="rounded-xl border border-white/10 bg-[#1A1A2E] px-4 py-3 text-sm text-white outline-none">
											<option value="AFTER_FOOD">After Food</option>
											<option value="BEFORE_FOOD">Before Food</option>
										</select>
										<button onClick={addMedicine} className="md:col-span-2 rounded-xl bg-white/10 py-3 text-[10px] font-black uppercase text-white hover:bg-white/20 transition">+ Add Medicine</button>
									</div>
								</div>

								<div className="space-y-3">
									<h3 className="text-xs font-black text-blue-400 uppercase tracking-widest">Prescribed Medicines</h3>
									{prescriptionForm.medicines.map((med, idx) => (
										<div key={`m-${idx}`} className="flex items-center justify-between p-4 rounded-xl bg-green-500/5 border border-green-500/20">
											<div><p className="text-sm font-bold text-white">{med.name}</p><p className="text-[10px] text-green-400 font-bold uppercase">{med.dosage} • {med.timing}</p></div>
											<button onClick={() => removeMedicine(idx, false)} className="text-red-400/50 hover:text-red-400"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
										</div>
									))}
									{prescriptionForm.custom_medicines.map((med, idx) => (
										<div key={`c-${idx}`} className="flex items-center justify-between p-4 rounded-xl bg-pink-500/5 border border-pink-500/20">
											<div><p className="text-sm font-bold text-white">{med.name} (Custom)</p><p className="text-[10px] text-pink-400 font-bold uppercase">{med.dosage} • {med.timing}</p></div>
											<button onClick={() => removeMedicine(idx, true)} className="text-red-400/50 hover:text-red-400"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
										</div>
									))}
								</div>

								<div className="bg-white/5 p-4 rounded-2xl border border-white/10">
									<label className="block text-[10px] font-black text-pink-500 uppercase mb-1.5">Next Consultation</label>
									<input type="date" value={prescriptionForm.next_consultation_date} onChange={(e) => setPrescriptionForm({ ...prescriptionForm, next_consultation_date: e.target.value })} className="w-full rounded-xl border border-white/10 bg-[#1A1A2E] px-4 py-3 text-sm text-white outline-none focus:border-blue-500" />
								</div>
							</div>

							<div className="p-6 bg-[#1A1A2E] border-t border-white/5 flex gap-4">
								<button onClick={() => setShowPrescriptionModal(null)} className="flex-1 rounded-xl bg-white/5 py-4 text-[10px] font-black uppercase text-white/70">Cancel</button>
								<button onClick={handleSubmitPrescription} disabled={[...prescriptionForm.medicines, ...prescriptionForm.custom_medicines].length === 0} className="flex-[2] rounded-xl bg-blue-600 py-4 text-[10px] font-black uppercase text-white shadow-xl hover:bg-blue-500 disabled:opacity-50">Complete & Save</button>
							</div>
						</div>
					</div>
				)}

				{showAvailabilityForm && (
					<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
						<div className="bg-[#131326] rounded-xl border border-[#F6D6E3]/40 p-6 max-w-md w-full mx-4">
							<h3 className="text-xl font-bold text-white mb-4">Add Availability Schedule</h3>
							<div className="space-y-4">
								<div>
									<label className="block text-sm font-medium text-pink-100 mb-1">Day of Week</label>
									<select value={availabilityForm.day_of_week} onChange={(e) => setAvailabilityForm({ ...availabilityForm, day_of_week: parseInt(e.target.value) })} className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]">
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
									<input type="time" value={availabilityForm.start_time} onChange={(e) => setAvailabilityForm({ ...availabilityForm, start_time: e.target.value })} className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none" />
									<input type="time" value={availabilityForm.end_time} onChange={(e) => setAvailabilityForm({ ...availabilityForm, end_time: e.target.value })} className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none" />
								</div>
								<div className="flex gap-2">
									<button onClick={() => handleAddAvailability(showAvailabilityForm)} className="flex-1 rounded-lg bg-[#E91E63] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90">Add Schedule</button>
									<button onClick={() => setShowAvailabilityForm(null)} className="rounded-lg border border-[#F6D6E3] px-4 py-2 text-sm text-pink-100 hover:bg-white/5">Cancel</button>
								</div>
							</div>
						</div>
					</div>
				)}

				{showHistory && (
					<div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#0A0A1A]/95 backdrop-blur-xl">
						<div className="w-full max-w-4xl rounded-[2.5rem] overflow-hidden border border-white/10 bg-[#131326] shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col max-h-[85vh]">
							<div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 flex items-center justify-between">
								<div>
									<h2 className="text-xl font-black text-white uppercase tracking-widest">Medical Visit Records</h2>
									<p className="text-blue-100/70 text-xs mt-1">Doctor: Dr. {showHistory.name} • {showHistory.specialization}</p>
								</div>
								<button onClick={() => setShowHistory(null)} className="text-white/70 hover:text-white p-2 bg-white/10 rounded-full transition-colors">
									<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
								</button>
							</div>

							<div className="p-8 overflow-y-auto space-y-6 flex-1 bg-[#131326]">
								{loadingHistory ? (
									<div className="flex flex-col items-center justify-center py-20 gap-4">
										<div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
										<p className="text-sm text-pink-100/40 uppercase font-black tracking-widest">Compiling Records...</p>
									</div>
								) : doctorHistory.length > 0 ? (
									<div className="grid gap-6">
										{doctorHistory.map((record) => (
											<div key={record.id} className="rounded-3xl border border-white/5 bg-[#1A1A2E] overflow-hidden hover:border-blue-500/30 transition-all group">
												<div className="p-6 flex flex-col md:flex-row gap-6">
													<div className="md:w-1/3 space-y-4">
														<div className="flex items-center gap-3">
															<div className="h-12 w-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-lg">
																{record.donor?.first_name?.[0] || "?"}
															</div>
															<div>
																<p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Patient Details</p>
																<p className="text-base font-bold text-white leading-tight">{record.donor?.first_name} {record.donor?.last_name}</p>
																<p className="text-xs text-pink-100/40">{record.donor?.email}</p>
															</div>
														</div>
														<div className="pt-4 border-t border-white/5 grid grid-cols-2 gap-4">
															<div>
																<p className="text-[9px] font-black text-pink-500 uppercase tracking-widest mb-1">Met On</p>
																<p className="text-xs text-white font-bold">{new Date(record.appointment_date).toLocaleDateString()}</p>
															</div>
															{record.next_consultation_date && (
																<div>
																	<p className="text-[9px] font-black text-green-500 uppercase tracking-widest mb-1">Next Follow-up</p>
																	<p className="text-xs text-white font-bold">{new Date(record.next_consultation_date).toLocaleDateString()}</p>
																</div>
															)}
														</div>
													</div>
													<div className="flex-1 bg-white/5 rounded-2xl p-6 border border-white/5">
														<div className="flex justify-between items-center mb-4">
															<p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Medical Prescription (RX)</p>
															<span className="text-[9px] font-mono text-white/30 truncate max-w-[100px]">{record.payment_receipt}</span>
														</div>
														<div className="space-y-4">
															<div className="grid gap-2">
																{record.prescription_data?.medicines?.map((m, i) => (
																	<div key={i} className="flex justify-between items-center text-xs bg-white/5 px-3 py-2 rounded-lg border border-white/5">
																		<span className="text-white/80 font-medium">{m.name}</span>
																		<span className="text-pink-100/40 text-[10px]">{m.dosage} • {m.timing}</span>
																	</div>
																))}
																{record.prescription_data?.custom_medicines?.map((m, i) => (
																	<div key={i} className="flex justify-between items-center text-xs bg-pink-500/5 px-3 py-2 rounded-lg border border-pink-500/10">
																		<span className="text-white/80 font-medium">{m.name} (Custom)</span>
																		<span className="text-pink-100/40 text-[10px]">{m.dosage} • {m.timing}</span>
																	</div>
																))}
															</div>
															<div className="pt-3 border-t border-white/10 flex items-center justify-between">
																<p className="text-[10px] text-pink-100/30 italic">Total Bill: {record.currency} {record.charges}</p>
																<span className="rounded-full bg-green-500/20 px-2 py-0.5 text-[9px] font-black text-green-400 border border-green-500/20 uppercase tracking-widest">Verified & Paid</span>
															</div>
														</div>
													</div>
												</div>
											</div>
										))}
									</div>
								) : (
									<div className="flex flex-col items-center justify-center py-20 text-center bg-white/5 border border-dashed border-white/10 rounded-3xl mx-4">
										<div className="h-16 w-16 bg-white/5 rounded-full flex items-center justify-center mb-4 text-pink-100/20 text-3xl">🗂️</div>
										<p className="text-sm text-pink-100/50 italic px-8">No historical records found for this doctor. Once an appointment is completed, it will appear here in the patient summary.</p>
									</div>
								)}
							</div>

							<div className="p-6 border-t border-white/5 bg-[#1A1A2E] flex justify-between items-center">
								<p className="text-[10px] text-pink-100/30 font-bold uppercase tracking-[0.3em]">Hospital Record Archive System</p>
								<button onClick={() => setShowHistory(null)} className="rounded-xl bg-white/10 px-8 py-3 text-[10px] font-black uppercase text-white hover:bg-white/20 transition-all">Exit Archive</button>
							</div>
						</div>
					</div>
				)}
			</main>
		</>
	)
}
