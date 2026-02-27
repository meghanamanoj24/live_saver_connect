import { useState, useEffect } from "react"
import { apiFetch } from "../../lib/api"

export default function HospitalRequests({ profile }) {
    const [requests, setRequests] = useState([])
    const [loading, setLoading] = useState(true)
    const [confirmingNeed, setConfirmingNeed] = useState(null)
    const [confirmForm, setConfirmForm] = useState({
        suggested_price: ""
    })

    useEffect(() => {
        loadRequests()
    }, [])

    async function loadRequests() {
        try {
            setLoading(true)
            const data = await apiFetch("/equipment-needs/?status=OPEN")
            setRequests(data)
        } catch (err) {
            console.error("Failed to load requests:", err)
        } finally {
            setLoading(false)
        }
    }

    async function handleConfirmCreation(e) {
        e.preventDefault()
        if (!confirmingNeed) return

        try {
            await apiFetch(`/equipment-needs/${confirmingNeed.id}/confirm_creation/`, {
                method: "POST",
                body: JSON.stringify(confirmForm)
            })
            alert("Item creation confirmed! The hospital will be notified.")
            setConfirmingNeed(null)
            setConfirmForm({ suggested_price: "" })
            loadRequests()
        } catch (err) {
            alert(err.message || "Failed to confirm creation")
        }
    }

    if (loading) {
        return <div className="text-center py-12">Loading hospital requests...</div>
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">Hospital Equipment Requests</h2>
                <button
                    onClick={loadRequests}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-pink-100 transition"
                >
                    Refresh
                </button>
            </div>

            {requests.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#F6D6E3]/40 bg-[#131326] p-12 text-center">
                    <p className="text-pink-100/40 font-medium">No open hospital requests at the moment.</p>
                </div>
            ) : (
                <div className="grid gap-6">
                    {requests.map((request) => (
                        <div key={request.id} className="rounded-xl border border-[#F6D6E3]/10 bg-[#131326] p-6 hover:border-[#E91E63]/30 transition group">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-4">
                                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-indigo-500/10 text-indigo-400">
                                            {request.equipment_type.replace('_', ' ')}
                                        </span>
                                        <h3 className="text-lg font-bold text-white group-hover:text-[#E91E63] transition">{request.equipment_name}</h3>
                                        {request.is_confirmed_by_supplier && request.requested_supplier?.id === profile?.id && (
                                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-green-500/10 text-green-400 border border-green-500/20">
                                                Confirmed by You
                                            </span>
                                        )}
                                    </div>

                                    <div className="grid sm:grid-cols-2 gap-4 text-xs">
                                        <div>
                                            <p className="text-pink-100/40 uppercase tracking-widest font-bold">Hospital</p>
                                            <p className="text-white font-medium mt-0.5">{request.hospital?.name}</p>
                                            <p className="text-pink-100/60">{request.hospital?.city}</p>
                                        </div>
                                        <div>
                                            <p className="text-pink-100/40 uppercase tracking-widest font-bold">Quantity Needed</p>
                                            <p className="text-white font-medium mt-0.5">{request.quantity_needed} Units</p>
                                        </div>
                                    </div>

                                    {request.description && (
                                        <p className="mt-4 text-sm text-pink-100/60">"{request.description}"</p>
                                    )}

                                    <div className="mt-4 text-[10px] text-pink-100/30 uppercase tracking-widest">
                                        Posted: {new Date(request.created_at).toLocaleDateString()}
                                        {request.needed_by && ` • Required By: ${new Date(request.needed_by).toLocaleDateString()}`}
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    {!request.is_confirmed_by_supplier && (
                                        <button
                                            onClick={() => setConfirmingNeed(request)}
                                            className="rounded-lg bg-[#E91E63] px-6 py-2 text-xs font-black uppercase tracking-widest text-white transition hover:opacity-90 shadow-lg shadow-pink-600/20"
                                        >
                                            I Have This Item
                                        </button>
                                    )}
                                    {request.is_confirmed_by_supplier && request.requested_supplier?.id === profile?.id && (
                                        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                                            <p className="text-[10px] font-black text-green-400 uppercase tracking-widest mb-1">Your Confirmation</p>
                                            <p className="text-xs text-white font-bold">Price: {request.suggested_price} INR</p>
                                            <p className="text-[10px] text-pink-100/40 mt-2">Waiting for Hospital Order</p>
                                        </div>
                                    )}
                                    {request.is_confirmed_by_supplier && request.requested_supplier?.id !== profile?.id && (
                                        <span className="text-xs text-pink-100/40 italic">Confirmed by another supplier</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Confirmation Modal */}
            {confirmingNeed && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl border border-[#F6D6E3]/30 bg-[#131326] p-6 shadow-2xl animate-in fade-in zoom-in-95">
                        <h3 className="text-xl font-bold text-white mb-2">Confirm Availability</h3>
                        <p className="text-sm text-pink-100/60 mb-6">
                            You are confirming that you can provide <strong>{confirmingNeed.equipment_name}</strong> to <strong>{confirmingNeed.hospital?.name}</strong>.
                        </p>
                        <form onSubmit={handleConfirmCreation}>
                            <div className="mb-6">
                                <label className="block text-xs font-black text-pink-100/40 uppercase tracking-widest mb-2">Suggested Price (INR) *</label>
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    step="0.01"
                                    value={confirmForm.suggested_price}
                                    onChange={(e) => setConfirmForm({ ...confirmForm, suggested_price: e.target.value })}
                                    className="w-full rounded-lg border border-[#F6D6E3]/20 bg-[#1A1A2E] px-4 py-3 text-white outline-none focus:border-[#E91E63] transition"
                                    placeholder="e.g. 5000"
                                />
                                <p className="text-[10px] text-pink-100/40 mt-2 italic">
                                    Note: You should have this item listed in your Equipment catalog or be ready to list it before confirming.
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setConfirmingNeed(null)}
                                    className="flex-1 py-3 rounded-lg border border-white/10 text-white font-bold hover:bg-white/5 transition uppercase text-xs"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3 rounded-lg bg-[#E91E63] hover:opacity-90 text-white font-bold shadow-lg shadow-pink-600/20 transition uppercase text-xs"
                                >
                                    Confirm & Notify
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
