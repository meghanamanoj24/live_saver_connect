import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import { useState, useEffect } from "react"
import { apiFetch } from "../../lib/api"

export default function HospitalPatients() {
    const router = useRouter()
    const { id } = router.query
    const [hospital, setHospital] = useState(null)
    const [visits, setVisits] = useState([])
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
            await loadVisits(hospitalData.id || id)
        } catch (error) {
            console.error("Error loading data:", error)
        } finally {
            setLoading(false)
        }
    }

    async function loadVisits(hospitalId) {
        try {
            const data = await apiFetch(`/patient-visits/?hospital=${hospitalId}`)
            setVisits(data)
        } catch (error) {
            console.error("Error loading visits:", error)
            setVisits([])
        }
    }

    if (loading) {
        return (
            <main className="min-h-screen bg-[#1A1A2E] text-white flex items-center justify-center">
                <div className="text-center">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#E91E63] border-t-transparent mx-auto" />
                    <p className="mt-4 text-pink-100/70">Loading patient records...</p>
                </div>
            </main>
        )
    }

    return (
        <>
            <Head>
                <title>Donors & Patients — {hospital?.name || "Hospital"} Dashboard</title>
            </Head>
            <main className="min-h-screen bg-[#1A1A2E] text-white">
                <header className="border-b border-[#F6D6E3]/30 bg-[#131326]/80 backdrop-blur sticky top-0 z-10">
                    <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-white">Donors & Patients</h1>
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
                    <div className="grid gap-6">
                        {visits.length > 0 ? (
                            <div className="overflow-hidden rounded-xl border border-[#F6D6E3]/30 bg-[#131326]">
                                <table className="w-full text-left text-sm text-pink-100/80">
                                    <thead className="bg-[#1A1A2E] text-xs font-semibold uppercase text-pink-100/60">
                                        <tr>
                                            <th className="px-6 py-4">User Details</th>
                                            <th className="px-6 py-4">Purpose</th>
                                            <th className="px-6 py-4">Date & Time</th>
                                            <th className="px-6 py-4">Status & Payment</th>
                                            <th className="px-6 py-4">Notes</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#F6D6E3]/10">
                                        {visits.map((visit) => {
                                            const patient = visit.patient || {}
                                            return (
                                                <tr key={visit.id} className="hover:bg-white/5 transition">
                                                    <td className="px-6 py-4">
                                                        <div className="font-semibold text-white">
                                                            {patient.first_name || patient.username} {patient.last_name || ""}
                                                        </div>
                                                        <div className="text-xs">{patient.email}</div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="rounded bg-[#E91E63]/10 px-2 py-1 text-xs font-medium text-[#E91E63]">
                                                            {visit.visit_purpose?.replace("_", " ")}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-xs">
                                                        {new Date(visit.visit_date).toLocaleString()}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col gap-1">
                                                            <span className={`text-xs font-semibold ${visit.payment_status === "PAID" ? "text-green-400" : "text-yellow-400"}`}>
                                                                {visit.payment_status}
                                                            </span>
                                                            <span className="text-xs opacity-75">{visit.currency} {visit.charges}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-xs italic opacity-70">
                                                        {visit.notes || "No notes provided"}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="rounded-xl border border-dashed border-[#F6D6E3]/40 bg-[#131326] p-12 text-center">
                                <p className="text-pink-100/70">No patient visits recorded yet.</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </>
    )
}
