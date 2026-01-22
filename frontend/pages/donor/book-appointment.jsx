import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import { useState, useEffect } from "react"
import { apiFetch } from "../../lib/api"

export default function BookAppointment() {
    const router = useRouter()
    const { hospitalId } = router.query
    const [hospitals, setHospitals] = useState([])
    const [doctors, setDoctors] = useState([])
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [formData, setFormData] = useState({
        hospital_id: hospitalId || "",
        doctor_id: "",
        appointment_date: "",
        appointment_time: "",
        notes: "",
    })

    useEffect(() => {
        loadHospitals()
    }, [])

    useEffect(() => {
        if (formData.hospital_id) {
            loadDoctors(formData.hospital_id)
        } else {
            setDoctors([])
        }
    }, [formData.hospital_id])

    async function loadHospitals() {
        try {
            const data = await apiFetch("/hospitals/?registered_only=true")
            setHospitals(data)
            if (hospitalId) {
                setFormData(prev => ({ ...prev, hospital_id: hospitalId }))
            }
        } catch (error) {
            console.error("Error loading hospitals:", error)
        } finally {
            setLoading(false)
        }
    }

    async function loadDoctors(hospitalPk) {
        try {
            const data = await apiFetch(`/doctors/?hospital=${hospitalPk}`)
            setDoctors(data)
        } catch (error) {
            console.error("Error loading doctors:", error)
        }
    }

    async function handleSubmit(e) {
        e.preventDefault()
        if (!formData.hospital_id || !formData.appointment_date || !formData.appointment_time) {
            alert("Please fill in all required fields.")
            return
        }

        setSubmitting(true)
        try {
            const appointmentDateTime = `${formData.appointment_date}T${formData.appointment_time}`
            await apiFetch("/appointments/", {
                method: "POST",
                body: JSON.stringify({
                    hospital_id: formData.hospital_id,
                    doctor_id: formData.doctor_id || null,
                    appointment_date: appointmentDateTime,
                    notes: formData.notes,
                    status: "PENDING",
                }),
            })
            alert("Appointment request sent successfully! The hospital will review and approve it.")
            router.push("/donor/dashboard")
        } catch (error) {
            console.error("Error booking appointment:", error)
            alert("Failed to book appointment. Please try again.")
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) {
        return (
            <main className="min-h-screen bg-[#1A1A2E] text-white flex items-center justify-center">
                <div className="text-center">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#E91E63] border-t-transparent mx-auto" />
                    <p className="mt-4 text-pink-100/70">Loading hospitals and doctors...</p>
                </div>
            </main>
        )
    }

    return (
        <>
            <Head>
                <title>Book Appointment — LifeSaver Connect</title>
            </Head>
            <main className="min-h-screen bg-[#1A1A2E] text-white">
                <header className="border-b border-[#F6D6E3]/30 bg-[#131326]/80 backdrop-blur sticky top-0 z-10">
                    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
                        <div className="flex items-center justify-between">
                            <h1 className="text-2xl font-bold">Book an Appointment</h1>
                            <Link href="/donor/dashboard" legacyBehavior>
                                <a className="text-sm text-pink-100/70 hover:text-white">Back to Dashboard</a>
                            </Link>
                        </div>
                    </div>
                </header>

                <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
                    <div className="rounded-2xl border border-[#F6D6E3]/30 bg-[#131326] p-8 shadow-2xl">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-pink-100 mb-2">Select Hospital *</label>
                                <select
                                    required
                                    value={formData.hospital_id}
                                    onChange={(e) => setFormData({ ...formData, hospital_id: e.target.value, doctor_id: "" })}
                                    className="w-full rounded-lg border border-[#F6D6E3]/30 bg-[#1A1A2E] px-4 py-3 text-white outline-none focus:border-[#E91E63] transition"
                                >
                                    <option value="">Choose a Hospital</option>
                                    {hospitals.map(h => (
                                        <option key={h.id} value={h.id}>{h.name} - {h.city}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-pink-100 mb-2">Select Doctor (Optional)</label>
                                <select
                                    value={formData.doctor_id}
                                    onChange={(e) => setFormData({ ...formData, doctor_id: e.target.value })}
                                    disabled={!formData.hospital_id}
                                    className="w-full rounded-lg border border-[#F6D6E3]/30 bg-[#1A1A2E] px-4 py-3 text-white outline-none focus:border-[#E91E63] transition disabled:opacity-50"
                                >
                                    <option value="">General Consultation / Any Available</option>
                                    {doctors.map(d => (
                                        <option key={d.id} value={d.id}>{d.name} - {d.specialization}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid gap-6 md:grid-cols-2">
                                <div>
                                    <label className="block text-sm font-medium text-pink-100 mb-2">Preferred Date *</label>
                                    <input
                                        type="date"
                                        required
                                        min={new Date().toISOString().split("T")[0]}
                                        value={formData.appointment_date}
                                        onChange={(e) => setFormData({ ...formData, appointment_date: e.target.value })}
                                        className="w-full rounded-lg border border-[#F6D6E3]/30 bg-[#1A1A2E] px-4 py-3 text-white outline-none focus:border-[#E91E63] transition"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-pink-100 mb-2">Preferred Time *</label>
                                    <input
                                        type="time"
                                        required
                                        value={formData.appointment_time}
                                        onChange={(e) => setFormData({ ...formData, appointment_time: e.target.value })}
                                        className="w-full rounded-lg border border-[#F6D6E3]/30 bg-[#1A1A2E] px-4 py-3 text-white outline-none focus:border-[#E91E63] transition"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-pink-100 mb-2">Notes for Doctor / Hospital</label>
                                <textarea
                                    rows={4}
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="Describe your concern or reason for visit..."
                                    className="w-full rounded-lg border border-[#F6D6E3]/30 bg-[#1A1A2E] px-4 py-3 text-white outline-none focus:border-[#E91E63] transition"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full rounded-xl bg-[#E91E63] py-4 font-bold text-white shadow-lg transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                            >
                                {submitting ? "Processing..." : "Send Appointment Request"}
                            </button>
                        </form>
                    </div>
                </div>
            </main>
        </>
    )
}
