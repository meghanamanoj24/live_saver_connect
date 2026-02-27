import Head from "next/head"
import { useRouter } from "next/router"
import { useEffect, useState } from "react"
import { apiFetch } from "../../lib/api"

const NEED_TYPES = [
    { id: "BLOOD", label: "Blood" },
    { id: "PLATELETS", label: "Platelets" },
]

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]

const BLOOD_RECEIVE_COMPATIBILITY = {
    "O-": ["O-"],
    "O+": ["O-", "O+"],
    "A-": ["O-", "A-"],
    "A+": ["O-", "O+", "A-", "A+"],
    "B-": ["O-", "B-"],
    "B+": ["O-", "O+", "B-", "B+"],
    "AB-": ["O-", "A-", "B-", "AB-"],
    "AB+": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
};

const PLATELET_RECEIVE_COMPATIBILITY = {
    "O-": ["O-", "O+"],
    "O+": ["O-", "O+"],
    "A-": ["A-", "A+", "O-", "O+", "AB-", "AB+"],
    "A+": ["A-", "A+", "O-", "O+", "AB-", "AB+"],
    "B-": ["B-", "B+", "O-", "O+", "AB-", "AB+"],
    "B+": ["B-", "B+", "O-", "O+", "AB-", "AB+"],
    "AB-": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
    "AB+": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
}

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
    const [myRequests, setMyRequests] = useState([])
    const [donationRequests, setDonationRequests] = useState([]) // [NEW] Store donation requests
    const [historyLoading, setHistoryLoading] = useState(false)
    const [activeTab, setActiveTab] = useState("post") // post, history, hospital
    const [hospitalNeeds, setHospitalNeeds] = useState([])
    const [hospitalLoading, setHospitalLoading] = useState(false)
    const [actionLoading, setActionLoading] = useState(null) // [NEW] Track action loading state

    const fetchHospitalNeeds = async () => {
        setHospitalLoading(true)
        try {
            const data = await apiFetch("/hospital-needs/")
            setHospitalNeeds(data)
        } catch (err) {
            console.error("Failed to fetch hospital needs:", err)
        } finally {
            setHospitalLoading(false)
        }
    }

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

    const fetchMyRequests = async () => {
        setHistoryLoading(true)
        try {
            const [myNeeds, allDonationRequests] = await Promise.all([
                apiFetch("/needs/?my_requests=true"),
                apiFetch("/donation-requests/") // Fetch all requests involved with user
            ])

            // Handle pagination safely
            const safeNeeds = Array.isArray(myNeeds) ? myNeeds : (myNeeds?.results || [])
            const safeRequests = Array.isArray(allDonationRequests) ? allDonationRequests : (allDonationRequests?.results || [])

            setMyRequests(safeNeeds)
            setDonationRequests(safeRequests)
        } catch (err) {
            console.error("Failed to fetch my requests:", err)
        } finally {
            setHistoryLoading(false)
        }
    }

    // [NEW] Handle Request Actions
    async function handleRequestAction(requestId, action, method = 'POST', body = {}) {
        setActionLoading(requestId)
        try {
            await apiFetch(`/donation-requests/${requestId}/${action}/`, {
                method,
                body: Object.keys(body).length ? JSON.stringify(body) : undefined
            })
            // Refresh data
            await fetchMyRequests()
            alert(`Action ${action} successful!`)
        } catch (error) {
            console.error(`Error performing ${action}:`, error)
            alert(error.message || `Failed to perform ${action}`)
        } finally {
            setActionLoading(null)
        }
    }

    async function handleMarkRecovered(needId) {
        if (!confirm("Are you sure the patient has recovered and you want to close this request?")) return;
        setHistoryLoading(true)
        try {
            await apiFetch(`/needs/${needId}/mark_recovered/`, {
                method: 'POST'
            })
            await fetchMyRequests()
            alert("Request marked as Recovered!")
        } catch (error) {
            console.error("Error marking as recovered:", error)
            alert(error.message || "Failed to mark as recovered")
        } finally {
            setHistoryLoading(false)
        }
    }

    useEffect(() => {
        fetchMyRequests()
        fetchHospitalNeeds()
    }, [])

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
            fetchMyRequests()
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

                {/* Tabs Navigation */}
                <div className="flex bg-[#131326] p-1 rounded-2xl border border-white/5 mb-10 overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => setActiveTab("post")}
                        className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === "post" ? "bg-red-600 text-white shadow-lg" : "text-pink-100/40 hover:text-pink-100"
                            }`}
                    >
                        🚨 Post Emergency
                    </button>
                    <button
                        onClick={() => setActiveTab("history")}
                        className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === "history" ? "bg-[#1B3C73] text-white shadow-lg" : "text-pink-100/40 hover:text-pink-100"
                            }`}
                    >
                        📜 My Requests
                    </button>
                    <button
                        onClick={() => setActiveTab("hospital")}
                        className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === "hospital" ? "bg-purple-600 text-white shadow-lg" : "text-pink-100/40 hover:text-pink-100"
                            }`}
                    >
                        🏥 Hospital Needs
                    </button>
                </div>

                {error && (
                    <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                        {error}
                    </div>
                )}

                {activeTab === "post" && (
                    <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
                                        <label className="block text-sm font-bold text-pink-100/90 mb-2">🚨 Post Emergency</label>
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
                )}

                {/* My Requests Tab */}
                {activeTab === "history" && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold flex items-center gap-2">
                                <span className="text-pink-500">📜</span> Recovery Status
                            </h2>
                            <button
                                onClick={fetchMyRequests}
                                className="text-xs text-pink-100/50 hover:text-pink-100 transition flex items-center gap-1"
                            >
                                <svg className={`h-3 w-3 ${historyLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Refresh
                            </button>
                        </div>

                        {myRequests.length === 0 ? (
                            <div className="bg-[#131326] border border-dashed border-[#F6D6E3]/20 rounded-2xl p-10 text-center">
                                <p className="text-pink-100/40 text-sm">You haven't posted any emergency requests yet.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {myRequests.map((req) => {
                                    // Find donation requests for this need
                                    const requestsForThisNeed = (donationRequests || []).filter(r => {
                                        const needId = r.emergency_need?.id || r.emergency_need;
                                        return needId && String(needId) === String(req.id);
                                    })

                                    return (
                                        <div key={req.id} className="bg-[#131326] border border-[#F6D6E3]/10 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
                                            <div className={`absolute top-0 right-0 h-1 w-20 ${req.status === 'FULFILLED' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>

                                            <div className="flex flex-col sm:flex-row justify-between gap-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h3 className="font-bold text-lg">{req.title}</h3>
                                                        <span className={`text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-widest ${req.status === 'FULFILLED' ? 'bg-emerald-500/20 text-emerald-400' :
                                                            req.status === 'CANCELLED' ? 'bg-white/10 text-white/40' :
                                                                'bg-red-500/20 text-red-500'
                                                            }`}>
                                                            {req.status}
                                                        </span>
                                                        {req.status === 'OPEN' && (
                                                            <button
                                                                onClick={() => handleMarkRecovered(req.id)}
                                                                className="text-[10px] bg-emerald-500 hover:bg-emerald-600 text-white px-2 py-0.5 rounded font-bold transition flex items-center gap-1"
                                                            >
                                                                <span>✔</span> Mark as Recovered
                                                            </button>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-pink-100/50 mb-3">{req.need_type} • {req.required_blood_group || 'Any Blood'} • {req.city}</p>

                                                    <p className="text-sm text-pink-100/70 line-clamp-2 italic mb-4">"{req.description}"</p>

                                                    {/* Manage Donors Section */}
                                                    {requestsForThisNeed.length > 0 && (
                                                        <div className="mt-4 bg-[#0b1730] rounded-xl p-4 border border-white/5">
                                                            <h4 className="text-xs font-bold text-pink-100/60 uppercase tracking-wider mb-3">
                                                                Donor Responses ({requestsForThisNeed.length})
                                                            </h4>
                                                            <div className="space-y-3">
                                                                {requestsForThisNeed.map(dReq => {
                                                                    const isProcessing = actionLoading === dReq.id
                                                                    // Check for critical match
                                                                    const isSameCity = req.city && dReq.donor?.city && req.city.toLowerCase() === dReq.donor.city.toLowerCase();
                                                                    const compatMap = req.need_type === 'PLATELETS' ? PLATELET_RECEIVE_COMPATIBILITY : BLOOD_RECEIVE_COMPATIBILITY;
                                                                    const isCompatible = req.required_blood_group && dReq.donor?.blood_group && (compatMap[req.required_blood_group] || []).includes(dReq.donor.blood_group);
                                                                    const isCriticalMatch = isSameCity && (isCompatible || req.need_type === 'ORGAN');

                                                                    return (
                                                                        <div key={dReq.id} className={`p-3 rounded-lg border transition ${isCriticalMatch ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-white/5 border-white/5 hover:border-white/10'}`}>
                                                                            <div className="flex justify-between items-start mb-2">
                                                                                <div>
                                                                                    <div className="flex items-center gap-2">
                                                                                        <p className="font-bold text-sm text-white">{dReq.donor?.first_name || 'Donor'} {dReq.donor?.last_name || ''}</p>
                                                                                        {isCriticalMatch && (
                                                                                            <span className="text-[9px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-black animate-pulse">
                                                                                                CRITICAL MATCH
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                    <p className="text-[10px] text-pink-100/50">{dReq.donor?.blood_group || 'Unspecified'} • {dReq.status}</p>
                                                                                    {dReq.donor?.phone && (
                                                                                        <p className="text-[11px] text-emerald-400 mt-1 font-medium flex items-center gap-1">
                                                                                            <span>📞</span> {dReq.donor.phone}
                                                                                        </p>
                                                                                    )}
                                                                                </div>
                                                                                <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${dReq.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-500' :
                                                                                    dReq.status === 'ACCEPTED' ? 'bg-green-500/20 text-green-400' :
                                                                                        dReq.status === 'SCHEDULED' ? 'bg-blue-500/20 text-blue-400' :
                                                                                            dReq.status === 'SCHEDULE_CONFIRMED' ? 'bg-indigo-500/20 text-indigo-400' :
                                                                                                dReq.status === 'REACHING' ? 'bg-orange-500/20 text-orange-400' :
                                                                                                    dReq.status === 'ARRIVED' ? 'bg-purple-500/20 text-purple-400' :
                                                                                                        dReq.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' :
                                                                                                            'bg-white/10 text-pink-100/40'
                                                                                    }`}>
                                                                                    {dReq.status.replace('_', ' ')}
                                                                                </span>
                                                                            </div>

                                                                            <div className="flex flex-wrap gap-2 mt-2">
                                                                                {dReq.status === 'PENDING' && (
                                                                                    <div className="bg-white/5 p-4 rounded-xl space-y-3 border border-white/5 w-full">
                                                                                        <p className="text-[10px] font-black text-pink-100/40 uppercase tracking-widest">Set Appointment Schedule</p>
                                                                                        <div className="flex gap-2">
                                                                                            <input
                                                                                                type="datetime-local"
                                                                                                id={`schedule-${dReq.id}`}
                                                                                                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white flex-1 focus:border-[#E91E63] outline-none transition-colors"
                                                                                                onClick={(e) => e.stopPropagation()}
                                                                                            />
                                                                                        </div>
                                                                                        <div className="flex gap-2">
                                                                                            <button
                                                                                                onClick={() => {
                                                                                                    const dateInput = document.getElementById(`schedule-${dReq.id}`);
                                                                                                    const scheduledDate = dateInput?.value;
                                                                                                    if (!scheduledDate) {
                                                                                                        alert("Please select a schedule time before accepting.");
                                                                                                        return;
                                                                                                    }
                                                                                                    handleRequestAction(dReq.id, 'accept', 'POST', { 'notes': 'Accepted via dashboard', 'scheduled_date': scheduledDate })
                                                                                                }}
                                                                                                disabled={isProcessing}
                                                                                                className="flex-1 py-2 bg-[#22C55E] hover:bg-green-600 rounded-lg text-xs font-black text-white transition disabled:opacity-50 uppercase tracking-wider"
                                                                                            >
                                                                                                Accept & Schedule
                                                                                            </button>
                                                                                            <button
                                                                                                onClick={() => handleRequestAction(dReq.id, 'reject')}
                                                                                                disabled={isProcessing}
                                                                                                className="px-4 py-2 bg-red-900/40 hover:bg-red-900/60 border border-red-500/20 rounded-lg text-xs font-black text-red-100 transition disabled:opacity-50 uppercase tracking-wider"
                                                                                            >
                                                                                                Reject
                                                                                            </button>
                                                                                        </div>
                                                                                    </div>
                                                                                )}

                                                                                {['ACCEPTED', 'SCHEDULED'].includes(dReq.status) && (
                                                                                    <div className="w-full space-y-3">
                                                                                        <div className="text-center bg-green-500/5 p-2 rounded border border-green-500/20">
                                                                                            <p className="text-[10px] text-green-400 mb-1 font-bold">
                                                                                                {dReq.status === 'SCHEDULED' ? '📅 Schedule Set!' : '✅ Donor Accepted!'}
                                                                                            </p>
                                                                                            {dReq.scheduled_date && (
                                                                                                <p className="text-[10px] text-green-200/70">
                                                                                                    Scheduled: {new Date(dReq.scheduled_date).toLocaleString()}
                                                                                                </p>
                                                                                            )}
                                                                                            <p className="text-[9px] text-pink-100/40 mt-1">Waiting for donor to confirm schedule...</p>
                                                                                        </div>

                                                                                        <div className="bg-white/5 p-3 rounded-lg space-y-2 border border-white/5">
                                                                                            <p className="text-[9px] font-bold text-pink-100/40 uppercase tracking-widest">Reschedule / Set Date</p>
                                                                                            <div className="flex gap-2">
                                                                                                <input
                                                                                                    type="datetime-local"
                                                                                                    id={`reschedule-${dReq.id}`}
                                                                                                    defaultValue={dReq.scheduled_date ? dReq.scheduled_date.slice(0, 16) : ""}
                                                                                                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[10px] text-white flex-1 focus:border-blue-500 outline-none"
                                                                                                />
                                                                                                <button
                                                                                                    onClick={() => {
                                                                                                        const dateInput = document.getElementById(`reschedule-${dReq.id}`);
                                                                                                        const scheduledDate = dateInput?.value;
                                                                                                        if (!scheduledDate) {
                                                                                                            alert("Please select a date and time.");
                                                                                                            return;
                                                                                                        }
                                                                                                        handleRequestAction(dReq.id, 'set_schedule', 'POST', { 'scheduled_date': scheduledDate })
                                                                                                    }}
                                                                                                    disabled={isProcessing}
                                                                                                    className="px-3 py-1 bg-[#1B3C73] hover:bg-blue-600 rounded text-[10px] font-bold text-white transition disabled:opacity-50"
                                                                                                >
                                                                                                    Update
                                                                                                </button>
                                                                                            </div>
                                                                                        </div>

                                                                                        <button
                                                                                            onClick={() => handleRequestAction(dReq.id, 'confirm_arrival')}
                                                                                            disabled={isProcessing}
                                                                                            className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded text-xs font-bold text-white transition disabled:opacity-50 flex items-center justify-center gap-1 shadow-lg shadow-blue-900/40"
                                                                                        >
                                                                                            Donor Reached? Click to Confirm 📍
                                                                                        </button>
                                                                                    </div>
                                                                                )}

                                                                                {['SCHEDULE_CONFIRMED', 'REACHING'].includes(dReq.status) && (
                                                                                    <button
                                                                                        onClick={() => handleRequestAction(dReq.id, 'confirm_arrival')}
                                                                                        disabled={isProcessing}
                                                                                        className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded text-xs font-bold text-white transition disabled:opacity-50 flex items-center justify-center gap-1"
                                                                                    >
                                                                                        Mark as Arrived / Reached 📍
                                                                                    </button>
                                                                                )}

                                                                                {dReq.status === 'ARRIVED' && (
                                                                                    <div className="w-full space-y-2">
                                                                                        <div className="text-center p-2 bg-purple-500/10 rounded border border-purple-500/20">
                                                                                            <p className="text-[10px] text-purple-400 font-bold">Donor has Reached!</p>
                                                                                            {dReq.confirmed_arrival_at && (
                                                                                                <p className="text-[9px] text-purple-200/70 mt-1">
                                                                                                    Arrived at: {new Date(dReq.confirmed_arrival_at).toLocaleString()}
                                                                                                </p>
                                                                                            )}
                                                                                        </div>
                                                                                        <button
                                                                                            onClick={() => handleRequestAction(dReq.id, 'hospital_verify', 'POST', { 'notes': 'Verified by poster' })}
                                                                                            disabled={isProcessing}
                                                                                            className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 rounded text-xs font-bold text-white transition disabled:opacity-50 flex items-center justify-center gap-1"
                                                                                        >
                                                                                            Verify Donation & Complete ✨
                                                                                        </button>
                                                                                    </div>
                                                                                )}

                                                                                {dReq.status === 'COMPLETED' && (
                                                                                    <p className="w-full text-center text-[10px] text-emerald-400 font-bold">
                                                                                        Donation Verified & Awarded
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    )
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="text-right flex flex-col justify-between items-end">
                                                    <p className="text-[10px] text-pink-100/30 uppercase font-bold">Posted {new Date(req.created_at).toLocaleDateString()}</p>

                                                    {req.status === 'OPEN' && !req.accepted_by_details && requestsForThisNeed.length === 0 && (
                                                        <div className="flex items-center gap-2 text-[10px] text-yellow-500/60 font-bold">
                                                            <span className="h-1.5 w-1.5 bg-yellow-500 rounded-full animate-ping"></span>
                                                            Live
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Hospital Needs Tab */}
                {activeTab === "hospital" && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold flex items-center gap-2">
                                <span className="text-purple-500">🏥</span> Urgent Hospital Needs
                            </h2>
                            <button
                                onClick={fetchHospitalNeeds}
                                className="text-xs text-pink-100/50 hover:text-pink-100 transition flex items-center gap-1"
                            >
                                <svg className={`h-3 w-3 ${hospitalLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Refresh
                            </button>
                        </div>

                        {hospitalNeeds.length === 0 ? (
                            <div className="bg-[#131326] border border-dashed border-[#F6D6E3]/20 rounded-2xl p-10 text-center">
                                <p className="text-pink-100/40 text-sm">No hospital needs found at the moment.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {hospitalNeeds.map((need) => (
                                    <div key={need.id} className="bg-[#131326] border border-purple-500/20 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                                        <div className="flex flex-col md:flex-row gap-6">
                                            {need.poster_image && (
                                                <div className="w-full md:w-32 h-32 flex-shrink-0">
                                                    <img
                                                        src={need.poster_image}
                                                        alt="Poster"
                                                        className="w-full h-full object-cover rounded-xl border border-white/10"
                                                    />
                                                </div>
                                            )}
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <h3 className="font-bold text-lg text-purple-300">{need.hospital?.name || 'Hospital Request'}</h3>
                                                    <span className={`text-[10px] px-2 py-1 rounded font-black border uppercase tracking-widest ${need.status === 'URGENT' ? 'bg-red-500/20 text-red-500 border-red-500/30' : 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                                                        }`}>
                                                        {need.status}
                                                    </span>
                                                </div>
                                                <p className="font-medium text-white mb-2">{need.need_type} Needed: {need.quantity_needed} Units</p>
                                                <div className="flex flex-wrap gap-2 mb-4">
                                                    <span className="bg-white/5 px-2 py-1 rounded-lg text-xs font-bold text-pink-100/60 border border-white/5">
                                                        Group: {need.required_blood_group || 'Any'}
                                                    </span>
                                                    <span className="bg-white/5 px-2 py-1 rounded-lg text-xs font-bold text-pink-100/60 border border-white/5">
                                                        Patient: {need.patient_name || 'N/A'}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-pink-100/60 line-clamp-2">{need.patient_details}</p>
                                            </div>
                                            <div className="flex flex-col justify-between items-end">
                                                <div className="text-right">
                                                    <p className="text-[10px] text-pink-100/30 uppercase font-black">Needed By</p>
                                                    <p className="text-xs text-pink-100 font-bold">{new Date(need.needed_by).toLocaleString()}</p>
                                                </div>
                                                <button
                                                    onClick={() => router.push(`/hospital/needs?hospital=${need.hospital?.id}`)}
                                                    className="mt-4 px-4 py-2 bg-purple-600 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-purple-500 transition shadow-lg shadow-purple-600/20"
                                                >
                                                    Help Now
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </main>
    )
}
