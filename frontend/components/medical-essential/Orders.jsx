import { useState, useEffect } from "react"
import { apiFetch } from "../../lib/api"

export default function Orders({ profile }) {
    const [orders, setOrders] = useState([])
    const [loading, setLoading] = useState(true)
    const [viewingOrder, setViewingOrder] = useState(null)
    const [activeTab, setActiveTab] = useState("active") // active, completed
    const [shippingForm, setShippingForm] = useState(null)

    useEffect(() => {
        loadOrders()
    }, [])

    async function loadOrders() {
        try {
            setLoading(true)
            const data = await apiFetch("/medical-orders/?supplier_orders=true")
            setOrders(data.results || data)
        } catch (err) {
            console.error("Failed to load orders:", err)
        } finally {
            setLoading(false)
        }
    }

    async function handleUpdateStatus(orderId, newStatus) {
        try {
            const res = await apiFetch(`/medical-orders/${orderId}/update_status/`, {
                method: "POST",
                body: JSON.stringify({ status: newStatus }),
            })
            if (newStatus === 'DELIVERED' || newStatus === 'DISPENSED') {
                alert(`Successful: Order marked as ${newStatus}.`)
            }
            loadOrders()
        } catch (err) {
            alert(err.message || "Failed to update status")
        }
    }

    async function handleResolveComplaint(orderId) {
        if (!confirm("Are you sure you want to mark this complaint as resolved?")) return;
        try {
            await apiFetch(`/medical-orders/${orderId}/resolve_complaint/`, {
                method: "POST"
            });
            alert("Complaint resolved successfully.");
            loadOrders();
        } catch (error) {
            alert(error.message || "Failed to resolve complaint");
        }
    }

    async function handleMarkDispensed(orderId) {
        try {
            await apiFetch(`/medical-orders/${orderId}/mark_dispensed/`, {
                method: "POST"
            })
            alert("Successful: Medicine marked as Dispensed (Given).")
            loadOrders()
        } catch (err) {
            alert(err.message || "Failed to mark as dispensed")
        }
    }

    async function handleViewInvoice(order) {
        try {
            await apiFetch(`/medical-orders/${order.id}/mark_invoice_viewed/`, {
                method: "POST"
            })
            setViewingOrder(order)
            loadOrders()
        } catch (err) {
            console.error("Failed to view invoice:", err)
        }
    }

    async function handleShipItems(e) {
        e.preventDefault()
        try {
            await apiFetch(`/medical-orders/${shippingForm.orderId}/mark_shipped/`, {
                method: "POST",
                body: JSON.stringify({
                    actual_shipping_at: shippingForm.actual_shipping_at,
                    estimated_arrival_at: shippingForm.estimated_arrival_at
                })
            })
            setShippingForm(null)
            loadOrders()
        } catch (err) {
            alert(err.message || "Failed to mark as shipped")
        }
    }

    if (loading) return <div className="text-center py-12 text-pink-100/50">Loading orders...</div>

    const filteredOrders = orders.filter(order => {
        if (activeTab === "active") return ["PENDING", "APPROVED", "SHIPPED"].includes(order.status)
        return ["DELIVERED", "RECEIVED", "DISPENSED", "CANCELLED"].includes(order.status)
    })

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black uppercase tracking-tighter text-white">Order Management</h2>
                    <p className="text-sm text-pink-100/50">Manage incoming and completed medical orders</p>
                </div>
                <button onClick={loadOrders} className="p-2 hover:bg-white/5 rounded-full transition">
                    <svg className="w-5 h-5 text-pink-100/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 p-1 bg-[#131326] rounded-xl border border-[#F6D6E3]/10 w-fit">
                <button
                    onClick={() => setActiveTab("active")}
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'active'
                        ? 'bg-[#E91E63] text-white shadow-lg shadow-[#E91E63]/20'
                        : 'text-pink-100/50 hover:text-white hover:bg-white/5'
                        }`}
                >
                    Active Orders ({orders.filter(o => ["PENDING", "APPROVED", "SHIPPED"].includes(o.status)).length})
                </button>
                <button
                    onClick={() => setActiveTab("completed")}
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'completed'
                        ? 'bg-[#E91E63] text-white shadow-lg shadow-[#E91E63]/20'
                        : 'text-pink-100/50 hover:text-white hover:bg-white/5'
                        }`}
                >
                    Completed Orders ({orders.filter(o => ["DELIVERED", "RECEIVED", "DISPENSED", "CANCELLED"].includes(o.status)).length})
                </button>
            </div>

            <div className="grid gap-6">
                {filteredOrders.length === 0 ? (
                    <div className="text-center py-20 border-2 border-dashed border-[#F6D6E3]/10 rounded-2xl">
                        <div className="w-16 h-16 bg-[#F6D6E3]/5 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-pink-100/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                            </svg>
                        </div>
                        <p className="text-pink-100/40 font-medium">No {activeTab} orders found.</p>
                    </div>
                ) : (
                    filteredOrders.map((order) => (
                        <div key={order.id} className="group relative p-6 rounded-2xl border border-[#F6D6E3]/10 bg-[#131326] hover:border-[#E91E63]/30 transition-all duration-300">
                            <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-widest ${order.status === "PENDING" ? "bg-yellow-500/20 text-yellow-500" :
                                            order.status === "APPROVED" ? "bg-blue-500/20 text-blue-500 animate-pulse" :
                                                order.status === "SHIPPED" ? "bg-purple-500/20 text-purple-500" :
                                                    order.status === "RECEIVED" ? "bg-green-500/20 text-green-500" :
                                                        order.status === "DISPENSED" ? "bg-teal-500/20 text-teal-500" :
                                                            "bg-white/10 text-white"
                                            }`}>
                                            {order.status === "SHIPPED" ? "ARRIVING / READY" : order.status}
                                        </span>
                                        <span className="text-pink-100/30 text-xs font-mono">#{order.order_number}</span>
                                    </div>
                                    <h3 className="text-lg font-bold text-white mb-1">
                                        {order.user?.first_name} {order.user?.last_name}
                                    </h3>
                                    <p className="text-xs text-pink-100/50 flex items-center gap-2">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        {new Date(order.created_at).toLocaleString()}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-pink-100/50 uppercase font-black tracking-widest mb-1">Total Amount</p>
                                    <p className="text-2xl font-black text-white">{order.currency} {parseFloat(order.total_amount).toFixed(2)}</p>
                                </div>
                            </div>

                            {order.is_complained && (
                                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl animate-in slide-in-from-right-4">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-500">
                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                        <p className="text-sm font-bold text-red-400 uppercase tracking-widest">Order Complaint Reported</p>
                                    </div>
                                    <p className="text-sm text-pink-100/80 italic ml-11">"{order.complaint_message}"</p>
                                    <div className="mt-3 ml-11 flex items-center gap-4">
                                        <p className="text-[10px] text-red-500/50 font-bold uppercase">Action Required: Please contact the hospital to resolve the issue.</p>
                                        <button
                                            onClick={() => handleResolveComplaint(order.id)}
                                            className="px-3 py-1 bg-green-500/20 text-green-400 border border-green-500/40 rounded-lg text-[10px] font-black uppercase hover:bg-green-500/30 transition shadow-lg shadow-green-600/10"
                                        >
                                            Mark as Resolved
                                        </button>
                                    </div>
                                </div>
                            )}



                            {
                                order.status === 'RECEIVED' && order.rating && (
                                    <div className="mb-6 p-4 bg-green-500/5 border border-green-500/20 rounded-xl flex items-center justify-between animate-in slide-in-from-top-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                                                <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-white">Hospital Received Items</p>
                                                <p className="text-xs text-pink-100/60 font-medium">Confirmation message received from hospital</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="flex justify-end gap-0.5 mb-1">
                                                {[1, 2, 3, 4, 5].map((s) => (
                                                    <svg key={s} className={`w-4 h-4 ${s <= order.rating ? 'text-yellow-400' : 'text-[#30304D]'}`} fill="currentColor" viewBox="0 0 20 20">
                                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                    </svg>
                                                ))}
                                            </div>
                                            <p className="text-[10px] font-black text-green-500 uppercase tracking-widest">{order.rating} Star Rating</p>
                                        </div>
                                    </div>
                                )
                            }

                            <div className="grid md:grid-cols-2 gap-8 py-6 border-y border-[#F6D6E3]/5">
                                <div className="space-y-4">
                                    <div>
                                        <h4 className="text-[10px] font-black text-pink-100/30 uppercase tracking-[0.2em] mb-3">Delivery Address</h4>
                                        <div className="text-sm text-pink-100/80 leading-relaxed">
                                            <p className="font-bold text-white mb-1">{order.user?.first_name} {order.user?.last_name}</p>
                                            <p>{order.shipping_address}, {order.shipping_city}</p>
                                            <p className="text-[#E91E63]/70 font-bold mt-2">📱 {order.contact_phone}</p>
                                        </div>
                                    </div>

                                    {(order.status === 'SHIPPED' || order.status === 'RECEIVED' || order.status === 'DELIVERED') && order.estimated_arrival_at && (
                                        <div className="p-4 bg-purple-500/5 rounded-2xl border border-purple-500/10">
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                                    <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                    </svg>
                                                </div>
                                                <p className="text-[10px] text-purple-400 uppercase font-black tracking-widest">Tracking Status</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-xs text-pink-100/60 font-medium">Estimated Arrival: <span className="text-white">{new Date(order.estimated_arrival_at).toLocaleDateString()}</span></p>
                                                <p className="text-[10px] text-purple-400/50 font-bold uppercase">Dispatched {new Date(order.actual_shipping_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <h4 className="text-[10px] font-black text-pink-100/30 uppercase tracking-[0.2em] mb-3">Order Inventory</h4>
                                    <div className="space-y-2">
                                        {order.items.map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-center text-sm p-2 rounded-lg bg-white/5 border border-white/5">
                                                <span className="text-pink-100/80">{item.store_product?.name || item.equipment?.name}</span>
                                                <span className="font-bold text-white">x{item.quantity}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-4 mt-6 pt-2">
                                <div className="flex items-center gap-3">
                                    {order.invoice && (
                                        <button
                                            onClick={() => handleViewInvoice(order)}
                                            className={`group px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${order.invoice.is_viewed_by_supplier
                                                ? "bg-green-500/10 text-green-500 border border-green-500/20"
                                                : "bg-[#E91E63]/10 text-[#E91E63] border border-[#E91E63]/20 hover:bg-[#E91E63] hover:text-white shadow-lg shadow-black/20"
                                                }`}
                                        >
                                            <span className="flex items-center gap-2">
                                                {order.invoice.is_viewed_by_supplier ? "✓ Invoice Processed" : "📄 Review Invoice Details"}
                                            </span>
                                        </button>
                                    )}
                                </div>

                                <div className="flex gap-3">
                                    {order.status === 'PENDING' && (
                                        <button
                                            onClick={() => handleUpdateStatus(order.id, 'APPROVED')}
                                            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-600/20"
                                        >
                                            Approve Order
                                        </button>
                                    )}

                                    {order.status === 'APPROVED' && (
                                        <div className="flex flex-col items-end gap-2">
                                            {!order.invoice?.is_viewed_by_supplier && (
                                                <span className="text-[10px] text-pink-100/30 font-bold uppercase animate-pulse">Required: Review Invoice First</span>
                                            )}
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleMarkDispensed(order.id)}
                                                    className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${order.invoice?.is_viewed_by_supplier
                                                        ? "bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-600/20"
                                                        : "bg-white/5 text-pink-100/20 cursor-not-allowed border border-white/5"
                                                        }`}
                                                    disabled={!order.invoice?.is_viewed_by_supplier}
                                                >
                                                    Mark as Given
                                                </button>
                                                <button
                                                    onClick={() => setShippingForm({
                                                        orderId: order.id,
                                                        actual_shipping_at: new Date().toISOString().slice(0, 16),
                                                        estimated_arrival_at: ""
                                                    })}
                                                    className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${order.invoice?.is_viewed_by_supplier
                                                        ? "bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/20"
                                                        : "bg-white/5 text-pink-100/20 cursor-not-allowed border border-white/5"
                                                        }`}
                                                    disabled={!order.invoice?.is_viewed_by_supplier}
                                                >
                                                    Ship Items
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {order.status === 'RECEIVED' && (
                                        <div className="flex flex-col items-end gap-2">
                                            <span className="text-[10px] text-green-400 font-bold uppercase tracking-widest bg-green-400/10 px-2 py-1 rounded">Customer Received Item</span>
                                            <button
                                                onClick={() => handleMarkDispensed(order.id)}
                                                className="px-6 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-green-600/20"
                                            >
                                                Completed
                                            </button>
                                        </div>
                                    )}

                                    {order.status === 'SHIPPED' && (
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleMarkDispensed(order.id)}
                                                className="px-6 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-green-600/20"
                                            >
                                                Mark Dispensed
                                            </button>
                                        </div>
                                    )}

                                    {order.status === 'RECEIVED' && (
                                        <button
                                            onClick={() => handleUpdateStatus(order.id, 'DELIVERED')}
                                            className="px-6 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-green-600/20"
                                        >
                                            Archive / Complete
                                        </button>
                                    )}

                                    {['PENDING', 'APPROVED'].includes(order.status) && (
                                        <button
                                            onClick={() => {
                                                if (confirm("Are you sure you want to cancel this order?")) {
                                                    handleUpdateStatus(order.id, 'CANCELLED')
                                                }
                                            }}
                                            className="px-6 py-2.5 bg-transparent hover:bg-red-500/10 text-red-500/60 hover:text-red-500 rounded-xl text-xs font-black uppercase tracking-widest transition-all border border-red-500/10 hover:border-red-500/30"
                                        >
                                            Reject
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {shippingForm && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
                    <div className="bg-[#1A1A2E] rounded-3xl border border-[#F6D6E3]/20 w-full max-w-md p-8 shadow-2xl">
                        <div className="w-16 h-16 bg-purple-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                            <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <h3 className="text-2xl font-black text-white mb-2 text-center uppercase tracking-tighter">Enter Shipping Info</h3>
                        <p className="text-center text-pink-100/50 text-sm mb-8">Set the dispatch time and estimated delivery date</p>

                        <form onSubmit={handleShipItems} className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-pink-100/30 uppercase tracking-[0.2em] mb-3">Dispatch Timestamp</label>
                                <input
                                    type="datetime-local"
                                    required
                                    value={shippingForm.actual_shipping_at}
                                    onChange={(e) => setShippingForm({ ...shippingForm, actual_shipping_at: e.target.value })}
                                    className="w-full bg-[#131326] border border-[#F6D6E3]/10 rounded-xl px-5 py-4 text-white outline-none focus:border-[#E91E63] transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-pink-100/30 uppercase tracking-[0.2em] mb-3">Estimated reach date</label>
                                <input
                                    type="datetime-local"
                                    required
                                    value={shippingForm.estimated_arrival_at}
                                    onChange={(e) => setShippingForm({ ...shippingForm, estimated_arrival_at: e.target.value })}
                                    className="w-full bg-[#131326] border border-[#F6D6E3]/10 rounded-xl px-5 py-4 text-white outline-none focus:border-[#E91E63] transition-all"
                                />
                            </div>
                            <div className="flex gap-3 pt-6">
                                <button type="submit" className="flex-1 bg-[#E91E63] hover:bg-[#D81B60] text-white font-black py-4 rounded-xl transition shadow-xl shadow-[#E91E63]/20 uppercase text-xs tracking-widest">
                                    Finalize Dispatch
                                </button>
                                <button type="button" onClick={() => setShippingForm(null)} className="px-6 py-4 bg-white/5 hover:bg-white/10 text-pink-100 rounded-xl transition border border-white/5 uppercase text-xs font-black tracking-widest">
                                    Back
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {
                viewingOrder && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
                        <div className="bg-[#1A1A2E] rounded-3xl border border-[#F6D6E3]/20 w-full max-w-2xl overflow-hidden shadow-2xl relative">
                            <div className="absolute top-6 right-6 z-10">
                                <button onClick={() => setViewingOrder(null)} className="p-2 bg-black/20 hover:bg-black/40 text-white rounded-full transition">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <div className="bg-gradient-to-br from-[#E91E63] to-[#D81B60] p-10 text-white">
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.4em] mb-2 opacity-60">System Generated</p>
                                        <h3 className="text-4xl font-black uppercase tracking-tighter">Official Invoice</h3>
                                        <p className="text-sm font-bold mt-1 opacity-80">Reference ID: {viewingOrder.order_number}</p>
                                    </div>
                                    <div className="text-right">
                                        <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center ml-auto mb-4 border border-white/30 backdrop-blur-md">
                                            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                                                <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-10 space-y-10">
                                <div className="grid grid-cols-2 gap-10">
                                    <div>
                                        <p className="text-[10px] font-black text-pink-100/30 uppercase tracking-[0.2em] mb-4">Supplier Identity</p>
                                        <div className="space-y-1">
                                            <p className="text-lg font-black text-white">{viewingOrder.supplier?.company_name}</p>
                                            <p className="text-sm text-pink-100/60 font-medium">{viewingOrder.supplier?.business_type}</p>
                                            <p className="text-xs text-[#E91E63] font-bold">{viewingOrder.supplier?.contact_email}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-pink-100/30 uppercase tracking-[0.2em] mb-4">Invoice Metadata</p>
                                        <div className="space-y-1">
                                            <p className="text-sm font-bold text-white">Date: {new Date(viewingOrder.created_at).toLocaleDateString()}</p>
                                            {viewingOrder.invoice && (
                                                <p className="text-xs font-black text-[#22C55E] uppercase tracking-wider">Doc #: {viewingOrder.invoice.invoice_number}</p>
                                            )}
                                            <p className="text-[10px] text-pink-100/30 font-bold uppercase mt-2">Verified Blockchain Ledger Item</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-[#F6D6E3]/10 overflow-hidden shadow-xl">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-[#131326] text-pink-100/40 border-b border-[#F6D6E3]/10">
                                            <tr>
                                                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px]">Description</th>
                                                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-center">Qty</th>
                                                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-right">Unit Price</th>
                                                <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-right">Extended</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#F6D6E3]/5">
                                            {viewingOrder.items.map((item) => (
                                                <tr key={item.id} className="text-white hover:bg-white/5 transition-colors">
                                                    <td className="px-6 py-4 font-medium">
                                                        {item.item_name || item.store_product?.name || item.equipment?.name || "Unknown Item"}
                                                    </td>
                                                    <td className="px-6 py-4 text-center font-bold">0{item.quantity}</td>
                                                    <td className="px-6 py-4 text-right font-medium">{viewingOrder.currency} {parseFloat(item.unit_price).toLocaleString()}</td>
                                                    <td className="px-6 py-4 text-right font-black">{viewingOrder.currency} {parseFloat(item.subtotal).toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="flex justify-between items-center border-t border-[#F6D6E3]/10 pt-8">
                                    <div>
                                        <p className="text-[10px] text-pink-100/30 font-bold uppercase mb-2">Authenticated By</p>
                                        <div className="bg-[#E91E63]/10 px-4 py-2 rounded-lg border border-[#E91E63]/20">
                                            <p className="text-[#E91E63] text-[10px] font-black uppercase tracking-[0.2em]">Medical Essentials Ledger</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-pink-100/30 uppercase tracking-[0.2em] mb-2">Total Settlement Amount</p>
                                        <p className="text-5xl font-black text-white tracking-tighter">{viewingOrder.currency} {parseFloat(viewingOrder.total_amount).toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-[#131326] p-6 text-center border-t border-[#F6D6E3]/10">
                                <p className="text-[9px] text-pink-100/20 uppercase font-black tracking-[0.5em]">Security Protocol 721-B • Official Digital Document</p>
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    )
}

