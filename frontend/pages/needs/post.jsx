import Head from "next/head"
import { useRouter } from "next/router"
import { useEffect, useState } from "react"
import { apiFetch } from "../../lib/api"

const NEED_TYPES = [
    { id: "BLOOD", label: "Blood" },
    { id: "PLATELETS", label: "Platelets" },
    { id: "ORGAN", label: "Organ" },
    { id: "FUNDS", label: "Funds" },
    { id: "OTHER", label: "Other" },
]

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]

export default function PostEmergency() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [successData, setSuccessData] = useState(null)
    const [form, setForm] = useState({
        title: "",
        description: "",
        need_type: "BLOOD",
        required_blood_group: "",
        organ_type: "",
        referral_phone: "",
        city: "",
        zip_code: "",
        contact_phone: "",
        needed_by: "",
        reward_amount: "",
    })
    const [donorCount, setDonorCount] = useState(null)
    const [posterImage, setPosterImage] = useState(null)
    const [error, setError] = useState(null)

    const fetchDonorCount = async () => {
        if (!form.city) return
        try {
            const query = new URLSearchParams({
                blood_group: form.required_blood_group,
                need_type: form.need_type,
                city: form.city,
                organ_type: form.organ_type
            }).toString()
            const response = await apiFetch(`/needs/donor_count/?${query}`)
            setDonorCount(response.count)
        } catch (err) {
            console.error("Failed to fetch donor count:", err)
        }
    }


    useEffect(() => {
        const timeout = setTimeout(() => {
            fetchDonorCount()
        }, 500)
        return () => clearTimeout(timeout)
    }, [form.required_blood_group, form.need_type, form.city, form.organ_type])

    const handleImageChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setPosterImage(e.target.files[0])
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const formData = new FormData()
            Object.keys(form).forEach(key => {
                formData.append(key, form[key])
            })
            if (posterImage) {
                formData.append("poster_image", posterImage)
            }

            if (navigator.geolocation) {
                const pos = await new Promise((resolve) => {
                    navigator.geolocation.getCurrentPosition(resolve, () => resolve(null))
                })
                if (pos) {
                    formData.append("latitude", pos.coords.latitude)
                    formData.append("longitude", pos.coords.longitude)
                }
            }

            // Map frontend fields to backend if necessary
            // In this case they match model fields

            const response = await apiFetch("/needs/critical_emergency/", {
                method: "POST",
                body: formData,
            })

            setSuccessData(response)
            window.scrollTo({ top: 0, behavior: "smooth" })
        } catch (err) {
            setError(err.message || "Something went wrong. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    const [pollingNeed, setPollingNeed] = useState(null)

    useEffect(() => {
        let interval
        if (successData && successData.emergency_need) {
            setPollingNeed(successData.emergency_need)
            interval = setInterval(async () => {
                try {
                    const latest = await apiFetch(`/needs/${successData.emergency_need.id}/`)
                    setPollingNeed(latest)
                    if (latest.status === "FULFILLED" || latest.accepted_by) {
                        clearInterval(interval)
                    }
                } catch (err) {
                    console.error("Polling error:", err)
                }
            }, 5000) // Poll every 5 seconds
        }
        return () => clearInterval(interval)
    }, [successData])

    if (successData) {
        return (
            <div className="min-h-screen bg-[#071325] py-20 px-4 text-white">
                <div className="max-w-2xl mx-auto text-center">
                    <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-500">
                        <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold mb-4">Request Posted Successfully!</h1>
                    <p className="text-pink-100/70 mb-8">{successData.message}</p>

                    {/* Status Tracker Box */}
                    <div className="bg-[#131326] border border-[#F6D6E3]/20 rounded-2xl p-6 text-left mb-8 shadow-xl">
                        <h2 className="text-lg font-bold mb-4 flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <span className="text-pink-500">📡</span> Live Status Tracking
                            </span>
                            <span className={`text-xs px-2 py-1 rounded ${pollingNeed?.status === "FULFILLED" ? "bg-green-500 text-white" : "bg-red-500 animate-pulse text-white"
                                }`}>
                                {pollingNeed?.status || "OPEN"}
                            </span>
                        </h2>

                        <div className="space-y-4">
                            {pollingNeed?.accepted_by ? (
                                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 animate-in fade-in zoom-in-95">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                                            ✅
                                        </div>
                                        <div>
                                            <p className="font-bold text-emerald-400">Donor Found!</p>
                                            <p className="text-sm text-pink-100/70">A donor has accepted your request. They have been given your contact details.</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 p-2">
                                    <div className="h-3 w-3 bg-red-500 rounded-full animate-ping"></div>
                                    <p className="text-sm text-pink-100/60 font-medium">Waiting for donors to respond...</p>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4 pt-2">
                                <div className="bg-white/5 p-3 rounded-lg border border-white/5 text-center">
                                    <p className="text-xs text-pink-100/40 uppercase">Expected Match</p>
                                    <p className="text-lg font-bold text-white">{successData.emails_sent || donorCount || 0}</p>
                                </div>
                                <div className="bg-white/5 p-3 rounded-lg border border-white/5 text-center">
                                    <p className="text-xs text-pink-100/40 uppercase">Alerts Sent</p>
                                    <p className="text-lg font-bold text-emerald-400">DONE</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {successData.emails_sent > 0 && (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 text-left mb-8">
                            <h2 className="text-lg font-bold mb-2 flex items-center gap-2 text-emerald-400">
                                <span>📧</span> Verification
                            </h2>
                            <p className="text-pink-100/80">
                                Alerts have been sent to registered donors. Keep your phone reachable.
                            </p>
                        </div>
                    )}

                    {successData.nearby_hospitals?.length > 0 && (
                        <div className="bg-[#131326] border border-[#F6D6E3]/20 rounded-2xl p-6 text-left mb-8">
                            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <span className="text-red-500">🏥</span> Nearby Hospitals Notified
                            </h2>
                            <div className="space-y-4">
                                {successData.nearby_hospitals.map((h) => (
                                    <div key={h.id} className="border-b border-white/5 last:border-0 pb-4 last:pb-0">
                                        <p className="font-bold text-white">{h.name}</p>
                                        <p className="text-xs text-pink-100/60">{h.address}</p>
                                        <p className="text-sm text-[#4e7fff] mt-1 font-medium">{h.phone}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button
                            onClick={() => router.push("/")}
                            className="rounded-xl px-8 py-3 bg-[#1B3C73] font-bold w-full sm:w-auto"
                        >
                            Back to Home
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <main className="min-h-screen bg-[#071325] text-white">
            <Head>
                <title>Post Emergency Request — LifeSaver Connect</title>
                <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@700;800&display=swap" rel="stylesheet" />
            </Head>

            <div className="absolute inset-0 -z-10 overflow-hidden">
                <div className="absolute top-0 right-0 h-[500px] w-[500px] rounded-full bg-red-900/20 blur-[120px]" />
                <div className="absolute bottom-0 left-0 h-[500px] w-[500px] rounded-full bg-[#1B3C73]/20 blur-[120px]" />
            </div>

            <div className="max-w-2xl mx-auto px-4 py-12">
                <header className="text-center mb-10">
                    <div className="inline-block px-3 py-1 rounded-full bg-red-600/10 text-red-500 text-xs font-bold uppercase tracking-widest mb-4 border border-red-500/20">
                        Emergency Portal
                    </div>
                    <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl" style={{ fontFamily: "'Poppins', sans-serif" }}>
                        Post <span className="text-red-500 italic">Emergency</span> Need
                    </h1>
                    <p className="mt-4 text-pink-100/70">
                        Tell us what you need. We'll alert nearby donors and hospitals immediately.
                    </p>
                </header>

                {error && (
                    <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="bg-[#131326] border border-[#F6D6E3]/20 rounded-3xl p-6 sm:p-8 shadow-2xl">
                        <div className="grid gap-6">
                            <div>
                                <label className="block text-sm font-bold text-pink-100/90 mb-2">Patient Name / Title</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Urgent O+ Blood for Patient Smith"
                                    className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-white focus:border-red-500 focus:outline-none transition"
                                    value={form.title}
                                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                                />
                            </div>

                            <div className="grid sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-pink-100/90 mb-2">Need Type</label>
                                    <select
                                        className="w-full h-12 bg-[#0b1730] border border-white/10 rounded-xl px-4 text-white focus:border-red-500 focus:outline-none transition"
                                        value={form.need_type}
                                        onChange={(e) => setForm({ ...form, need_type: e.target.value })}
                                    >
                                        {NEED_TYPES.map(type => (
                                            <option key={type.id} value={type.id}>{type.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-pink-100/90 mb-2">Required Blood Group</label>
                                    <select
                                        className="w-full h-12 bg-[#0b1730] border border-white/10 rounded-xl px-4 text-white focus:border-red-500 focus:outline-none transition"
                                        value={form.required_blood_group}
                                        onChange={(e) => setForm({ ...form, required_blood_group: e.target.value })}
                                        disabled={form.need_type === "ORGAN"}
                                    >
                                        <option value="">{form.need_type === "ORGAN" ? "Required for Organ" : "Any / Not Applicable"}</option>
                                        {BLOOD_GROUPS.map(bg => (
                                            <option key={bg} value={bg}>{bg}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {form.need_type === "ORGAN" && (
                                <div className="grid sm:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                                    <div>
                                        <label className="block text-sm font-bold text-pink-100/90 mb-2">Organ Type</label>
                                        <select
                                            required
                                            className="w-full h-12 bg-[#0b1730] border border-white/10 rounded-xl px-4 text-white focus:border-red-500 focus:outline-none transition"
                                            value={form.organ_type}
                                            onChange={(e) => setForm({ ...form, organ_type: e.target.value })}
                                        >
                                            <option value="">Select Organ</option>
                                            <option value="HEART">Heart</option>
                                            <option value="LIVER">Liver</option>
                                            <option value="KIDNEY">Kidney</option>
                                            <option value="LUNGS">Lungs</option>
                                            <option value="PANCREAS">Pancreas</option>
                                            <option value="OTHER">Other</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-pink-100/90 mb-2">Referral Contact (Optional)</label>
                                        <input
                                            type="tel"
                                            placeholder="Relative or Informant"
                                            className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-white focus:border-red-500 focus:outline-none transition"
                                            value={form.referral_phone}
                                            onChange={(e) => setForm({ ...form, referral_phone: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-pink-100/90 mb-2">Reward Amount (₹) (Optional)</label>
                                        <input
                                            type="number"
                                            placeholder="e.g. 500"
                                            className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-white focus:border-red-500 focus:outline-none transition"
                                            value={form.reward_amount}
                                            onChange={(e) => setForm({ ...form, reward_amount: e.target.value })}
                                        />
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-bold text-pink-100/90 mb-2">Description / Case Details</label>
                                <textarea
                                    rows={3}
                                    placeholder="Provide details about the emergency, hospital name, and contact instructions..."
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-red-500 focus:outline-none transition"
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                />
                            </div>

                            <div className="grid sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-pink-100/90 mb-2">Contact Phone</label>
                                    <input
                                        type="tel"
                                        required
                                        placeholder="Primary contact number"
                                        className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-white focus:border-red-500 focus:outline-none transition"
                                        value={form.contact_phone}
                                        onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-pink-100/90 mb-2">Needed By</label>
                                    <input
                                        type="datetime-local"
                                        className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-white focus:border-red-500 focus:outline-none transition"
                                        value={form.needed_by}
                                        onChange={(e) => setForm({ ...form, needed_by: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-pink-100/90 mb-2">City</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="City of emergency"
                                        className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-white focus:border-red-500 focus:outline-none transition"
                                        value={form.city}
                                        onChange={(e) => setForm({ ...form, city: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-pink-100/90 mb-2">Zip Code</label>
                                    <input
                                        type="text"
                                        placeholder="Optional zip code"
                                        className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-white focus:border-red-500 focus:outline-none transition"
                                        value={form.zip_code}
                                        onChange={(e) => setForm({ ...form, zip_code: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-pink-100/90 mb-2">Patient Poster / Image (Optional)</label>
                                <div className="relative group">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageChange}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    />
                                    <div className="h-24 w-full border-2 border-dashed border-white/10 rounded-xl flex items-center justify-center group-hover:bg-white/5 transition border-pink-100/10 font-medium text-pink-100/40 text-sm">
                                        {posterImage ? posterImage.name : "Click to upload patient poster"}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {donorCount !== null && (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-4 animate-in fade-in zoom-in-95">
                            <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                                📧
                            </div>
                            <div>
                                <p className="text-sm text-emerald-300 font-bold">
                                    {donorCount} Compatible Donors Found
                                </p>
                                <p className="text-xs text-emerald-100/60">
                                    They will be notified immediately via email if you post as emergency.
                                </p>
                            </div>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-14 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-2xl shadow-xl shadow-red-600/20 transition-all flex items-center justify-center gap-3 text-lg"
                    >
                        {loading ? (
                            <>
                                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                Posting Request...
                            </>
                        ) : (
                            <>🚨 Post Emergency Request Now</>
                        )}
                    </button>

                    <p className="text-center text-xs text-pink-100/40">
                        By submitting, you agree to share this information with nearby hospitals and registered donors.
                    </p>
                </form>
            </div>
        </main>
    )
}
