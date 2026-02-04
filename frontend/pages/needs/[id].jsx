import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import { useEffect, useState } from "react"
import { apiFetch } from "../../lib/api"

export default function NeedDetails() {
    const router = useRouter()
    const { id } = router.query
    const [need, setNeed] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (!id) return

        async function loadNeed() {
            setLoading(true)
            setError(null)
            try {
                // We assume these are hospital needs based on the index page
                const data = await apiFetch(`/hospital-needs/${id}/`)
                setNeed(data)
            } catch (err) {
                console.error("Failed to load need:", err)
                setError(err.message || "Failed to load details. The request might not exist or has been removed.")
            } finally {
                setLoading(false)
            }
        }

        loadNeed()
    }, [id])

    if (loading) {
        return (
            <div className="min-h-screen bg-[#1A1A2E] flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#E91E63]"></div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen bg-[#1A1A2E] text-white flex flex-col items-center justify-center p-4">
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-8 text-center max-w-md">
                    <h1 className="text-xl font-bold text-rose-400 mb-2">Error Loading Details</h1>
                    <p className="text-pink-100/70 mb-6">{error}</p>
                    <Link href="/needs" legacyBehavior>
                        <a className="inline-flex rounded-lg bg-[#E91E63] px-6 py-2 text-sm font-medium text-white hover:opacity-90 transition">
                            Back to All Requests
                        </a>
                    </Link>
                </div>
            </div>
        )
    }

    if (!need) return null // Should be handled by loading state

    return (
        <>
            <Head>
                <title>{need.title || "Donation Request"} — LifeSaver Connect</title>
            </Head>
            <main className="min-h-screen bg-[#1A1A2E] text-white">
                {/* Header */}
                <header className="border-b border-[#F6D6E3]/30 bg-[#131326]/80 backdrop-blur sticky top-0 z-10">
                    <div className="mx-auto flex items-center justify-between max-w-4xl px-4 py-4 sm:px-6 lg:px-8">
                        <div className="flex items-center gap-4">
                            <Link href="/needs" legacyBehavior>
                                <a className="rounded-full p-2 hover:bg-white/5 transition text-pink-100/70 hover:text-white">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                    </svg>
                                </a>
                            </Link>
                            <h1 className="text-lg font-bold md:text-xl truncate" style={{ fontFamily: "'Poppins', sans-serif" }}>
                                Request Details
                            </h1>
                        </div>
                    </div>
                </header>

                <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">

                    {/* Status Banner */}
                    <div className={`rounded-xl border p-4 flex items-center justify-between ${need.status === "URGENT" || need.status === "CRITICAL"
                            ? "bg-red-500/10 border-red-500/30 text-red-200"
                            : need.status === "FULFILLED"
                                ? "bg-green-500/10 border-green-500/30 text-green-200"
                                : "bg-blue-500/10 border-blue-500/30 text-blue-200"
                        }`}>
                        <div className="flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${need.status === "URGENT" || need.status === "CRITICAL" ? "bg-red-500 animate-pulse" :
                                    need.status === "FULFILLED" ? "bg-green-500" : "bg-blue-500"
                                }`} />
                            <span className="font-semibold tracking-wide uppercase text-sm">
                                {need.status || "OPEN"} Request
                            </span>
                        </div>
                        {need.needed_by && (
                            <span className="text-sm font-medium">
                                Needed by: {new Date(need.needed_by).toLocaleDateString()}
                            </span>
                        )}
                    </div>

                    <div className="grid gap-6 md:grid-cols-3">

                        {/* Main Content - Left Column */}
                        <div className="md:col-span-2 space-y-6">

                            {/* Need Details Card */}
                            <div className="rounded-2xl border border-[#F6D6E3] bg-[#131326] p-6">
                                <h2 className="text-2xl font-bold text-white mb-2">{need.title || need.need_type + " Request"}</h2>

                                <div className="flex flex-wrap gap-2 mb-6">
                                    <span className="inline-flex items-center rounded bg-[#E91E63]/10 px-3 py-1 text-sm font-semibold text-[#E91E63] border border-[#E91E63]/20">
                                        {need.need_type}
                                    </span>
                                    {need.required_blood_group && (
                                        <span className="inline-flex items-center rounded bg-red-500/10 px-3 py-1 text-sm font-semibold text-red-400 border border-red-500/20">
                                            Blood Group: {need.required_blood_group}
                                        </span>
                                    )}
                                    {need.quantity_needed && (
                                        <span className="inline-flex items-center rounded bg-blue-500/10 px-3 py-1 text-sm font-semibold text-blue-400 border border-blue-500/20">
                                            Qty: {need.quantity_needed}
                                        </span>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <div className="bg-[#1A1A2E] rounded-xl p-4 border border-[#F6D6E3]/10">
                                        <p className="text-xs uppercase tracking-wide text-pink-100/50 mb-1">Patient Details</p>
                                        {need.patient_name && <p className="font-semibold text-white mb-1">{need.patient_name}</p>}
                                        <p className="text-pink-100/80 text-sm leading-relaxed">
                                            {need.patient_details || need.description || "No specific details provided."}
                                        </p>
                                    </div>

                                    {need.notes && (
                                        <div className="bg-[#1A1A2E] rounded-xl p-4 border border-[#F6D6E3]/10">
                                            <p className="text-xs uppercase tracking-wide text-pink-100/50 mb-1">Additional Notes</p>
                                            <p className="text-pink-100/80 text-sm leading-relaxed">{need.notes}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Poster Image */}
                            {need.poster_image && (
                                <div className="rounded-2xl border border-[#F6D6E3] bg-[#131326] p-6">
                                    <h3 className="text-lg font-semibold text-white mb-4">Patient Poster</h3>
                                    <div className="rounded-xl overflow-hidden bg-black/20 border border-white/10 flex justify-center">
                                        <img
                                            src={need.poster_image.startsWith('http') ? need.poster_image : `${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"}${need.poster_image}`}
                                            alt="Request Poster"
                                            className="max-h-96 w-auto object-contain"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Sidebar - Hospital Details */}
                        <div className="space-y-6">
                            <div className="rounded-2xl border border-[#F6D6E3] bg-[#131326] p-6 sticky top-24">
                                <h3 className="text-lg font-semibold text-white mb-4 border-b border-white/10 pb-2">
                                    Hospital Details
                                </h3>

                                {need.hospital ? (
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-xs uppercase tracking-wide text-pink-100/50">Name</p>
                                            <p className="font-bold text-lg text-white">{need.hospital.name}</p>
                                            <span className="inline-block mt-1 text-xs bg-white/10 px-2 py-0.5 rounded text-pink-100/70">
                                                {need.hospital.hospital_type || "Hospital"}
                                            </span>
                                        </div>

                                        <div>
                                            <p className="text-xs uppercase tracking-wide text-pink-100/50">Location</p>
                                            <p className="text-sm text-pink-100/90 mt-1">
                                                {need.hospital.address || "Address not listed"}
                                            </p>
                                            <p className="text-sm text-pink-100/90">
                                                {need.hospital.city} {need.hospital.zip_code ? `- ${need.hospital.zip_code}` : ""}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-xs uppercase tracking-wide text-pink-100/50">Contact</p>
                                            <p className="text-sm text-white mt-1 flex items-center gap-2">
                                                <svg className="w-4 h-4 text-[#E91E63]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                                </svg>
                                                {need.hospital.phone ? (
                                                    <a href={`tel:${need.hospital.phone}`} className="hover:text-[#E91E63] transition">
                                                        {need.hospital.phone}
                                                    </a>
                                                ) : "No phone listed"}
                                            </p>
                                            {need.hospital.website && (
                                                <p className="text-sm text-[#E91E63] mt-1 flex items-center gap-2">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                    </svg>
                                                    <a href={need.hospital.website} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                                        Visit Website
                                                    </a>
                                                </p>
                                            )}
                                        </div>

                                        {/* Respond Button */}
                                        <div className="pt-4 mt-2 border-t border-white/10">
                                            <Link href={`/donor/donate?type=${need.need_type}&hospital_id=${need.hospital.id}`} legacyBehavior>
                                                <a className="flex w-full items-center justify-center rounded-lg bg-[#E91E63] py-3 text-sm font-bold text-white shadow-lg shadow-pink-500/30 transition hover:bg-[#D81B60] hover:scale-[1.02]">
                                                    Resond to Need
                                                </a>
                                            </Link>
                                            {need.hospital.phone && (
                                                <a
                                                    href={`tel:${need.hospital.phone}`}
                                                    className="mt-3 flex w-full items-center justify-center rounded-lg border border-[#F6D6E3]/30 bg-transparent py-3 text-sm font-semibold text-white transition hover:bg-white/5"
                                                >
                                                    Call Hospital
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-sm text-pink-100/60 italic">
                                        Hospital details not available.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </>
    )
}
