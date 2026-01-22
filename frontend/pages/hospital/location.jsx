import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import { useState, useEffect } from "react"
import { apiFetch } from "../../lib/api"

export default function HospitalLocation() {
    const router = useRouter()
    const { id } = router.query
    const [hospital, setHospital] = useState(null)
    const [loading, setLoading] = useState(true)
    const [copied, setCopied] = useState(false)

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
        } catch (error) {
            console.error("Error loading hospital:", error)
        } finally {
            setLoading(false)
        }
    }

    const handleShare = () => {
        const shareUrl = `${window.location.origin}/hospital/dashboard?id=${hospital.id}`
        navigator.clipboard.writeText(shareUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    if (loading) {
        return (
            <main className="min-h-screen bg-[#1A1A2E] text-white flex items-center justify-center">
                <div className="text-center">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#E91E63] border-t-transparent mx-auto" />
                    <p className="mt-4 text-pink-100/70">Loading location details...</p>
                </div>
            </main>
        )
    }

    if (!hospital) return null

    // Construct Google Maps URL
    const mapQuery = encodeURIComponent(`${hospital.name}, ${hospital.city}, ${hospital.address || ""}`)
    const mapSrc = `https://www.google.com/maps/embed/v1/place?key=YOUR_API_KEY&q=${mapQuery}`
    // Note: For demonstration without a real API key, we use the search URL
    const embedUrl = `https://maps.google.com/maps?q=${mapQuery}&t=&z=13&ie=UTF8&iwloc=&output=embed`

    return (
        <>
            <Head>
                <title>Location — {hospital.name} Dashboard</title>
            </Head>
            <main className="min-h-screen bg-[#1A1A2E] text-white">
                <header className="border-b border-[#F6D6E3]/30 bg-[#131326]/80 backdrop-blur sticky top-0 z-10">
                    <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-white">Hospital Location</h1>
                                <p className="text-sm text-pink-100/70">{hospital.name}</p>
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
                    <div className="grid gap-8 lg:grid-cols-3">
                        <div className="lg:col-span-2 space-y-6">
                            <div className="overflow-hidden rounded-2xl border border-[#F6D6E3]/30 bg-[#131326] shadow-xl">
                                <div className="p-4 border-b border-[#F6D6E3]/10 flex items-center justify-between">
                                    <h2 className="text-lg font-semibold flex items-center gap-2">
                                        <span className="text-[#E91E63]">📍</span> Interactive Map
                                    </h2>
                                </div>
                                <div className="aspect-video w-full bg-slate-800">
                                    <iframe
                                        width="100%"
                                        height="100%"
                                        frameBorder="0"
                                        scrolling="no"
                                        marginHeight="0"
                                        marginWidth="0"
                                        src={embedUrl}
                                        title="Hospital Map"
                                    ></iframe>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="rounded-2xl border border-[#F6D6E3]/30 bg-[#131326] p-6 shadow-xl">
                                <h2 className="text-xl font-bold mb-4">Share Location</h2>
                                <p className="text-sm text-pink-100/70 mb-6">
                                    Share the official dashboard link with patients, donors, and paramedics for quick access to hospital details.
                                </p>

                                <div className="space-y-4">
                                    <div className="rounded-lg bg-[#1A1A2E] p-3 border border-[#F6D6E3]/20 flex items-center justify-between">
                                        <span className="text-xs truncate text-pink-100/50">
                                            {typeof window !== "undefined" ? `${window.location.origin}/hospital/dashboard?id=${hospital.id}` : ""}
                                        </span>
                                    </div>
                                    <button
                                        onClick={handleShare}
                                        className="w-full rounded-lg bg-[#E91E63] py-3 font-semibold text-white transition hover:opacity-90 flex items-center justify-center gap-2"
                                    >
                                        {copied ? "✅ Link Copied!" : "🔗 Copy Sharable Link"}
                                    </button>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-[#F6D6E3]/30 bg-[#131326] p-6 shadow-xl">
                                <h2 className="text-xl font-bold mb-4">Contact Details</h2>
                                <div className="space-y-4 text-sm">
                                    <div className="flex items-start gap-3">
                                        <span className="text-[#E91E63]">🏥</span>
                                        <div>
                                            <p className="font-semibold text-white">Address</p>
                                            <p className="text-pink-100/70">{hospital.address || "No address provided"}</p>
                                            <p className="text-pink-100/70">{hospital.city}, {hospital.state || ""}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <span className="text-[#E91E63]">📞</span>
                                        <div>
                                            <p className="font-semibold text-white">Phone</p>
                                            <p className="text-pink-100/70">{hospital.phone || "Not available"}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <span className="text-[#E91E63]">✉️</span>
                                        <div>
                                            <p className="font-semibold text-white">Email</p>
                                            <p className="text-pink-100/70">{hospital.email || "Not available"}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </>
    )
}
