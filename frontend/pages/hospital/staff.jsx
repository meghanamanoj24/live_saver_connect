import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import { useState, useEffect } from "react"
import { apiFetch } from "../../lib/api"

export default function HospitalStaff() {
	const router = useRouter()
	const { id } = router.query
	const [hospital, setHospital] = useState(null)
	const [staff, setStaff] = useState([])
	const [loading, setLoading] = useState(true)
	const [showStaffForm, setShowStaffForm] = useState(false)
	const [staffForm, setStaffForm] = useState({
		name: "",
		staff_type: "NURSE",
		specialization: "",
		phone: "",
		email: "",
		qualifications: "",
		salary: "",
		currency: "INR",
		is_active: true,
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
			await loadStaff(hospitalData.id || id)
		} catch (error) {
			console.error("Error loading data:", error)
		} finally {
			setLoading(false)
		}
	}

	async function loadStaff(hospitalId) {
		try {
			const data = await apiFetch(`/staff/?hospital=${hospitalId}`)
			setStaff(data)
		} catch (error) {
			console.error("Error loading staff:", error)
			setStaff([])
		}
	}

	async function handleSubmitStaff(e) {
		e.preventDefault()
		try {
			await apiFetch("/staff/", {
				method: "POST",
				body: JSON.stringify({
					...staffForm,
					hospital_id: hospital?.id || id,
					salary: staffForm.salary ? parseFloat(staffForm.salary) : null,
				}),
			})
			setShowStaffForm(false)
			setStaffForm({
				name: "",
				staff_type: "NURSE",
				specialization: "",
				phone: "",
				email: "",
				qualifications: "",
				salary: "",
				currency: "INR",
				is_active: true,
			})
			await loadStaff(hospital?.id || id)
			alert("Staff member added successfully!")
		} catch (error) {
			console.error("Error adding staff:", error)
			const errorMessage = error.body?.detail || error.message || "Error adding staff member. Please try again."
			alert(errorMessage)
		}
	}

	if (loading) {
		return (
			<main className="min-h-screen bg-[#1A1A2E] text-white flex items-center justify-center">
				<div className="text-center">
					<div className="h-12 w-12 animate-spin rounded-full border-4 border-[#E91E63] border-t-transparent mx-auto" />
					<p className="mt-4 text-pink-100/70">Loading staff...</p>
				</div>
			</main>
		)
	}

	return (
		<>
			<Head>
				<title>Staff — {hospital?.name || "Hospital"} Dashboard</title>
			</Head>
			<main className="min-h-screen bg-[#1A1A2E] text-white">
				<header className="border-b border-[#F6D6E3]/30 bg-[#131326]/80 backdrop-blur sticky top-0 z-10">
					<div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
						<div className="flex items-center justify-between">
							<div>
								<h1 className="text-2xl font-bold text-white">Hospital Staff</h1>
								<p className="text-sm text-pink-100/70">{hospital?.name}</p>
							</div>
							<div className="flex gap-2">
								<button
									onClick={() => setShowStaffForm(!showStaffForm)}
									className="rounded-lg bg-[#E91E63] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
								>
									{showStaffForm ? "Cancel" : "+ Add Staff"}
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
					{showStaffForm && (
						<form onSubmit={handleSubmitStaff} className="rounded-xl border border-[#F6D6E3]/40 bg-[#131326] p-6 space-y-4 mb-6">
							<h2 className="text-xl font-bold text-white mb-4">Add New Staff Member</h2>
							<div className="grid gap-4 md:grid-cols-2">
								<div>
									<label className="block text-sm font-medium text-pink-100 mb-1">Name *</label>
									<input
										type="text"
										required
										value={staffForm.name}
										onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
										className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-pink-100 mb-1">Staff Type *</label>
									<select
										required
										value={staffForm.staff_type}
										onChange={(e) => setStaffForm({ ...staffForm, staff_type: e.target.value })}
										className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
									>
										<option value="NURSE">Nurse</option>
										<option value="ADMIN">Administrative Staff</option>
										<option value="TECHNICIAN">Technician</option>
										<option value="PHARMACIST">Pharmacist</option>
										<option value="LAB_TECH">Lab Technician</option>
										<option value="OTHER">Other</option>
									</select>
								</div>
								<div>
									<label className="block text-sm font-medium text-pink-100 mb-1">Specialization</label>
									<input
										type="text"
										value={staffForm.specialization}
										onChange={(e) => setStaffForm({ ...staffForm, specialization: e.target.value })}
										className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-pink-100 mb-1">Phone</label>
									<input
										type="tel"
										value={staffForm.phone}
										onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
										className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-pink-100 mb-1">Email</label>
									<input
										type="email"
										value={staffForm.email}
										onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
										className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-pink-100 mb-1">Salary</label>
									<input
										type="number"
										step="0.01"
										value={staffForm.salary}
										onChange={(e) => setStaffForm({ ...staffForm, salary: e.target.value })}
										className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
									/>
								</div>
								<div className="md:col-span-2">
									<label className="block text-sm font-medium text-pink-100 mb-1">Qualifications</label>
									<textarea
										value={staffForm.qualifications}
										onChange={(e) => setStaffForm({ ...staffForm, qualifications: e.target.value })}
										rows={3}
										className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
										placeholder="Certifications, degrees, etc."
									/>
								</div>
							</div>
							<button
								type="submit"
								className="rounded-lg bg-[#E91E63] px-6 py-2 font-semibold text-white transition hover:opacity-90"
							>
								Add Staff Member
							</button>
						</form>
					)}

					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
						{staff.length === 0 ? (
							<div className="md:col-span-3 rounded-xl border border-dashed border-[#F6D6E3]/40 bg-[#131326] p-8 text-center">
								<p className="text-pink-100/70">No staff members added yet.</p>
							</div>
						) : (
							staff.map((member) => (
								<div key={member.id} className="rounded-xl border border-[#F6D6E3]/40 bg-[#131326] p-6">
									<h3 className="text-lg font-semibold text-white">{member.name}</h3>
									<p className="mt-1 text-sm text-pink-100/70">{member.staff_type}</p>
									{member.specialization && (
										<p className="mt-1 text-sm text-pink-100/70">{member.specialization}</p>
									)}
									{member.qualifications && (
										<p className="mt-2 text-xs text-pink-100/60">{member.qualifications}</p>
									)}
									{member.phone && (
										<p className="mt-2 text-xs text-pink-100/60">Phone: {member.phone}</p>
									)}
									{member.email && (
										<p className="mt-1 text-xs text-pink-100/60">Email: {member.email}</p>
									)}
									{member.salary && (
										<p className="mt-2 text-sm text-green-400">
											Salary: {member.currency} {member.salary}
										</p>
									)}
									<div className="mt-3">
										<span className={`rounded-full px-2 py-1 text-xs font-medium ${
											member.is_active ? "bg-green-600/20 text-green-400" : "bg-gray-600/20 text-gray-400"
										}`}>
											{member.is_active ? "Active" : "Inactive"}
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
