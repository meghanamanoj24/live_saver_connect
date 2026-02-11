import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import { useState, useEffect } from "react"
import { apiFetch } from "../../lib/api"
import { validatePositiveInteger, validateDateInFuture } from "../../lib/validation"
import MedicalStore from "../../components/medical-essential/MedicalStore"
import Equipment from "../../components/medical-essential/Equipment"

export default function HospitalNeeds() {
	const router = useRouter()
	const { id } = router.query
	const [hospital, setHospital] = useState(null)
	const [hospitalNeeds, setHospitalNeeds] = useState([])
	const [equipmentNeeds, setEquipmentNeeds] = useState([])
	const [equipmentOrders, setEquipmentOrders] = useState([])
	const [suppliers, setSuppliers] = useState([])
	const [loading, setLoading] = useState(true)
	const [showNeedForm, setShowNeedForm] = useState(false)
	const [showEquipmentForm, setShowEquipmentForm] = useState(false)
	const [showOrderForm, setShowOrderForm] = useState(null)
	const [activeTab, setActiveTab] = useState("needs") // needs, marketplace, orders
	const [marketplaceTab, setMarketplaceTab] = useState("medicines") // medicines, equipment
	const [myOrders, setMyOrders] = useState([])
	const [viewingOrder, setViewingOrder] = useState(null)
	const [orderForm, setOrderForm] = useState({
		supplier_id: "",
		quantity: 1,
		unit_price: "",
		currency: "INR",
		notes: "",
	})
	const [needForm, setNeedForm] = useState({
		need_type: "BLOOD",
		required_blood_group: "",
		patient_name: "",
		patient_details: "",
		poster_image: "",
		status: "NORMAL",
		quantity_needed: 1,
		needed_by: "",
		notes: "",
	})
	const [equipmentForm, setEquipmentForm] = useState({
		equipment_name: "",
		equipment_type: "OTHER",
		quantity_needed: 1,
		description: "",
		needed_by: "",
		notes: "",
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
			const hospitalId = hospitalData.id || id
			await Promise.all([
				loadHospitalNeeds(hospitalId),
				loadEquipmentNeeds(hospitalId),
				loadSuppliers(),
				loadMyOrders(),
			])
		} catch (error) {
			console.error("Error loading data:", error)
		} finally {
			setLoading(false)
		}
	}

	async function loadHospitalNeeds(hospitalId) {
		try {
			const data = await apiFetch(`/hospital-needs/?hospital=${hospitalId}`)
			setHospitalNeeds(data)
		} catch (error) {
			setHospitalNeeds([])
		}
	}

	async function loadEquipmentNeeds(hospitalId) {
		try {
			const data = await apiFetch(`/equipment-needs/?hospital=${hospitalId}`)
			setEquipmentNeeds(data)
			// Load orders for each equipment need
			const ordersPromises = data.map(need =>
				apiFetch(`/equipment-orders/?equipment_need=${need.id}`).catch(() => [])
			)
			const ordersArrays = await Promise.all(ordersPromises)
			const allOrders = ordersArrays.flat()
			setEquipmentOrders(allOrders)
		} catch (error) {
			setEquipmentNeeds([])
			setEquipmentOrders([])
		}
	}

	async function loadSuppliers() {
		try {
			const data = await apiFetch("/medical-essential/")
			setSuppliers(data.filter(s => s.is_active && s.is_verified))
		} catch (error) {
			setSuppliers([])
		}
	}

	async function loadMyOrders() {
		try {
			const data = await apiFetch("/medical-orders/?my_orders=true")
			setMyOrders(data)
		} catch (error) {
			console.error("Error loading orders:", error)
		}
	}

	async function handlePayOrder(orderId) {
		if (!confirm("Confirm payment for this order?")) return

		try {
			await apiFetch(`/medical-orders/${orderId}/pay/`, { method: "POST" })
			alert("Payment successful! Invoice generated.")
			loadMyOrders()
		} catch (error) {
			const msg = error.body?.detail || error.message || "Payment failed"
			alert(msg)
		}
	}

	async function handleDownloadInvoice(order) {
		try {
			const response = await fetch(`http://localhost:8000/api/medical-orders/${order.id}/download_invoice/`, {
				headers: {
					'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
				}
			})

			if (!response.ok) {
				alert("Invoice PDF download not available.")
				return
			}

			const blob = await response.blob()
			const url = window.URL.createObjectURL(blob)
			window.open(url, '_blank')
		} catch (err) {
			alert("Error downloading invoice.")
		}
	}

	async function handleMarkReceived(orderId, rating) {
		try {
			await apiFetch(`/medical-orders/${orderId}/mark_received/`, {
				method: "POST",
				body: JSON.stringify({ rating })
			})
			alert("Order marked as received successfully!")
			setViewingOrder(null)
			loadMyOrders()
		} catch (error) {
			alert(error.message || "Failed to mark as received")
		}
	}

	async function handleCreateOrder(equipmentNeedId) {
		try {
			await apiFetch("/equipment-orders/", {
				method: "POST",
				body: JSON.stringify({
					equipment_need_id: equipmentNeedId,
					supplier_id: orderForm.supplier_id,
					quantity: parseInt(orderForm.quantity),
					unit_price: parseFloat(orderForm.unit_price),
					currency: orderForm.currency,
					notes: orderForm.notes || "",
				}),
			})
			setShowOrderForm(null)
			setOrderForm({
				supplier_id: "",
				quantity: 1,
				unit_price: "",
				currency: "INR",
				notes: "",
			})
			await loadEquipmentNeeds(hospital?.id || id)
			alert("Order created successfully! Supplier will be notified.")
		} catch (error) {
			console.error("Error creating order:", error)
			const errorMessage = error.body?.detail || error.message || "Error creating order. Please try again."
			alert(errorMessage)
		}
	}

	async function handleSubmitNeed(e) {
		e.preventDefault()

		if (!validatePositiveInteger(needForm.quantity_needed)) {
			alert("Quantity must be a positive integer.")
			return
		}

		if (needForm.needed_by && !validateDateInFuture(needForm.needed_by)) {
			alert("Needed by date must be in the future.")
			return
		}

		try {
			// Format needed_by datetime if provided
			let neededBy = null
			if (needForm.needed_by) {
				neededBy = new Date(needForm.needed_by).toISOString()
			}

			await apiFetch("/hospital-needs/", {
				method: "POST",
				body: JSON.stringify({
					...needForm,
					hospital_id: hospital?.id || id,
					needed_by: neededBy,
				}),
			})
			setShowNeedForm(false)
			setNeedForm({
				need_type: "BLOOD",
				required_blood_group: "",
				patient_name: "",
				patient_details: "",
				poster_image: "",
				status: "NORMAL",
				quantity_needed: 1,
				needed_by: "",
				notes: "",
			})
			await loadHospitalNeeds(hospital?.id || id)
			alert("Need posted successfully! Donors with matching blood groups will be notified.")
		} catch (error) {
			console.error("Error creating need:", error)
			const errorMessage = error.body?.detail || error.message || "Error creating need. Please try again."
			alert(errorMessage)
		}
	}

	async function handleSubmitEquipment(e) {
		e.preventDefault()

		if (!validatePositiveInteger(equipmentForm.quantity_needed)) {
			alert("Quantity must be a positive integer.")
			return
		}

		if (equipmentForm.needed_by && !validateDateInFuture(equipmentForm.needed_by)) {
			alert("Needed by date must be in the future.")
			return
		}

		try {
			const response = await apiFetch("/equipment-needs/", {
				method: "POST",
				body: JSON.stringify({
					...equipmentForm,
					hospital_id: hospital?.id || id,
					needed_by: equipmentForm.needed_by || null,
				}),
			})
			setShowEquipmentForm(false)
			setEquipmentForm({
				equipment_name: "",
				equipment_type: "OTHER",
				quantity_needed: 1,
				description: "",
				needed_by: "",
				notes: "",
			})
			await loadEquipmentNeeds(hospital?.id || id)
			alert("Equipment need posted successfully! Shopkeepers can now view and fulfill this request.")
		} catch (error) {
			console.error("Error creating equipment need:", error)
			const errorMessage = error.body?.detail || error.message || "Error creating equipment need. Please try again."
			alert(errorMessage)
		}
	}

	if (loading) {
		return (
			<main className="min-h-screen bg-[#1A1A2E] text-white flex items-center justify-center">
				<div className="text-center">
					<div className="h-12 w-12 animate-spin rounded-full border-4 border-[#E91E63] border-t-transparent mx-auto" />
					<p className="mt-4 text-pink-100/70">Loading needs...</p>
				</div>
			</main>
		)
	}

	const activeNeeds = hospitalNeeds.filter(n => n.status !== "FULFILLED" && n.status !== "CANCELLED")
	const openEquipmentNeeds = equipmentNeeds.filter(n => n.status === "OPEN")

	return (
		<>
			<Head>
				<title>Needs — {hospital?.name || "Hospital"} Dashboard</title>
			</Head>
			<main className="min-h-screen bg-[#1A1A2E] text-white">
				<header className="border-b border-[#F6D6E3]/30 bg-[#131326]/80 backdrop-blur sticky top-0 z-10">
					<div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
						<div className="flex items-center justify-between mb-4">
							<div>
								<h1 className="text-2xl font-bold text-white">Hospital Needs & Marketplace</h1>
								<p className="text-sm text-pink-100/70">{hospital?.name}</p>
							</div>
							<Link href={`/hospital/dashboard?id=${id}`} legacyBehavior>
								<a className="rounded-lg border border-[#F6D6E3] px-4 py-2 text-sm text-pink-100 hover:bg-white/5">
									Back to Dashboard
								</a>
							</Link>
						</div>

						{/* Main Tabs */}
						<div className="flex gap-4 border-b border-[#F6D6E3]/20">
							<button
								onClick={() => setActiveTab("needs")}
								className={`pb-2 px-4 text-sm font-medium transition-colors border-b-2 ${activeTab === "needs"
									? "border-[#E91E63] text-white"
									: "border-transparent text-pink-100/60 hover:text-white"
									}`}
							>
								Needs Management
							</button>
							<button
								onClick={() => setActiveTab("marketplace")}
								className={`pb-2 px-4 text-sm font-medium transition-colors border-b-2 ${activeTab === "marketplace"
									? "border-[#E91E63] text-white"
									: "border-transparent text-pink-100/60 hover:text-white"
									}`}
							>
								Medical Marketplace
							</button>
							<button
								onClick={() => setActiveTab("orders")}
								className={`pb-2 px-4 text-sm font-medium transition-colors border-b-2 ${activeTab === "orders"
									? "border-[#E91E63] text-white"
									: "border-transparent text-pink-100/60 hover:text-white"
									}`}
							>
								My Orders
							</button>
						</div>
					</div>
				</header>

				<div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
					{/* Needs Management Tab */}
					{activeTab === "needs" && (
						<div>
							<div className="flex justify-end gap-2 mb-6">
								<button
									onClick={() => setShowEquipmentForm(!showEquipmentForm)}
									className="rounded-lg bg-[#22C55E] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
								>
									{showEquipmentForm ? "Cancel" : "+ Add Equipment Need"}
								</button>
								<button
									onClick={() => setShowNeedForm(!showNeedForm)}
									className="rounded-lg bg-[#E91E63] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
								>
									{showNeedForm ? "Cancel" : "+ Post Need"}
								</button>
							</div>

							{showEquipmentForm && (
								<form onSubmit={handleSubmitEquipment} className="rounded-xl border border-[#F6D6E3]/40 bg-[#131326] p-6 space-y-4 mb-6">
									<h2 className="text-xl font-bold text-white mb-4">Add Equipment Need</h2>
									<div className="grid gap-4 md:grid-cols-2">
										<div>
											<label className="block text-sm font-medium text-pink-100 mb-1">Equipment Name *</label>
											<input
												type="text"
												required
												value={equipmentForm.equipment_name}
												onChange={(e) => setEquipmentForm({ ...equipmentForm, equipment_name: e.target.value })}
												className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-pink-100 mb-1">Equipment Type *</label>
											<select
												required
												value={equipmentForm.equipment_type}
												onChange={(e) => setEquipmentForm({ ...equipmentForm, equipment_type: e.target.value })}
												className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
											>
												<option value="DIAGNOSTIC">Diagnostic Equipment</option>
												<option value="SURGICAL">Surgical Equipment</option>
												<option value="MONITORING">Monitoring Equipment</option>
												<option value="LIFE_SUPPORT">Life Support Equipment</option>
												<option value="STERILIZATION">Sterilization Equipment</option>
												<option value="FURNITURE">Hospital Furniture</option>
												<option value="OTHER">Other</option>
											</select>
										</div>
										<div>
											<label className="block text-sm font-medium text-pink-100 mb-1">Quantity Needed</label>
											<input
												type="number"
												min="1"
												value={equipmentForm.quantity_needed}
												onChange={(e) => setEquipmentForm({ ...equipmentForm, quantity_needed: parseInt(e.target.value) })}
												className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-pink-100 mb-1">Needed By</label>
											<input
												type="date"
												min={new Date().toISOString().split("T")[0]}
												value={equipmentForm.needed_by}
												onChange={(e) => setEquipmentForm({ ...equipmentForm, needed_by: e.target.value })}
												className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
											/>
										</div>
										<div className="md:col-span-2">
											<label className="block text-sm font-medium text-pink-100 mb-1">Notes</label>
											<textarea
												value={equipmentForm.notes}
												onChange={(e) => setEquipmentForm({ ...equipmentForm, notes: e.target.value })}
												rows={2}
												className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
												placeholder="Additional notes or requirements..."
											/>
										</div>
										<div className="md:col-span-2">
											<label className="block text-sm font-medium text-pink-100 mb-1">Description</label>
											<textarea
												value={equipmentForm.description}
												onChange={(e) => setEquipmentForm({ ...equipmentForm, description: e.target.value })}
												rows={3}
												className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
											/>
										</div>
									</div>
									<button
										type="submit"
										className="rounded-lg bg-[#22C55E] px-6 py-2 font-semibold text-white transition hover:opacity-90"
									>
										Post Equipment Need
									</button>
									<p className="text-xs text-pink-100/70 mt-2">
										This will be visible to shopkeepers who can fulfill the order with payment options.
									</p>
								</form>
							)}

							{showNeedForm && (
								<form onSubmit={handleSubmitNeed} className="rounded-xl border border-[#F6D6E3]/40 bg-[#131326] p-6 space-y-4 mb-6">
									<h2 className="text-xl font-bold text-white mb-4">Post Hospital Need</h2>
									<div className="grid gap-4 md:grid-cols-2">
										<div>
											<label className="block text-sm font-medium text-pink-100 mb-1">Need Type *</label>
											<select
												required
												value={needForm.need_type}
												onChange={(e) => setNeedForm({ ...needForm, need_type: e.target.value })}
												className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
											>
												<option value="BLOOD">Blood</option>
												<option value="PLATELETS">Platelets</option>
												<option value="EMERGENCY">Emergency Case</option>
												<option value="ORGAN">Organ</option>
											</select>
										</div>
										<div>
											<label className="block text-sm font-medium text-pink-100 mb-1">Blood Group</label>
											<select
												value={needForm.required_blood_group}
												onChange={(e) => setNeedForm({ ...needForm, required_blood_group: e.target.value })}
												className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
											>
												<option value="">Any</option>
												<option value="O+">O+</option>
												<option value="O-">O-</option>
												<option value="A+">A+</option>
												<option value="A-">A-</option>
												<option value="B+">B+</option>
												<option value="B-">B-</option>
												<option value="AB+">AB+</option>
												<option value="AB-">AB-</option>
											</select>
										</div>
										<div>
											<label className="block text-sm font-medium text-pink-100 mb-1">Patient Name</label>
											<input
												type="text"
												value={needForm.patient_name}
												onChange={(e) => setNeedForm({ ...needForm, patient_name: e.target.value })}
												className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-pink-100 mb-1">Quantity Needed</label>
											<input
												type="number"
												min="1"
												value={needForm.quantity_needed}
												onChange={(e) => setNeedForm({ ...needForm, quantity_needed: parseInt(e.target.value) })}
												className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
											/>
										</div>
										<div className="md:col-span-2">
											<label className="block text-sm font-medium text-pink-100 mb-1">Patient Details</label>
											<textarea
												value={needForm.patient_details}
												onChange={(e) => setNeedForm({ ...needForm, patient_details: e.target.value })}
												rows={3}
												className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
												placeholder="Patient information and medical condition"
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-pink-100 mb-1">Poster Image URL</label>
											<input
												type="url"
												value={needForm.poster_image}
												onChange={(e) => setNeedForm({ ...needForm, poster_image: e.target.value })}
												className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
												placeholder="https://example.com/poster.jpg"
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-pink-100 mb-1">Status</label>
											<select
												value={needForm.status}
												onChange={(e) => setNeedForm({ ...needForm, status: e.target.value })}
												className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
											>
												<option value="NORMAL">Normal</option>
												<option value="URGENT">Urgent</option>
											</select>
										</div>
										<div>
											<label className="block text-sm font-medium text-pink-100 mb-1">Needed By (Date & Time)</label>
											<input
												type="datetime-local"
												min={new Date().toISOString().slice(0, 16)}
												value={needForm.needed_by}
												onChange={(e) => setNeedForm({ ...needForm, needed_by: e.target.value })}
												className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
											/>
										</div>
										<div className="md:col-span-2">
											<label className="block text-sm font-medium text-pink-100 mb-1">Notes</label>
											<textarea
												value={needForm.notes}
												onChange={(e) => setNeedForm({ ...needForm, notes: e.target.value })}
												rows={2}
												className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
												placeholder="Additional notes..."
											/>
										</div>
									</div>
									<button
										type="submit"
										className="rounded-lg bg-[#E91E63] px-6 py-2 font-semibold text-white transition hover:opacity-90"
									>
										Post Need
									</button>
								</form>
							)}

							<div className="space-y-6">
								<div>
									<h2 className="text-xl font-bold text-white mb-4">Equipment Needs</h2>
									<div className="space-y-4">
										{openEquipmentNeeds.length === 0 ? (
											<div className="rounded-xl border border-dashed border-[#F6D6E3]/40 bg-[#131326] p-8 text-center">
												<p className="text-pink-100/70">No equipment needs posted yet.</p>
											</div>
										) : (
											openEquipmentNeeds.map((need) => {
												const needOrders = equipmentOrders.filter(o => o.equipment_need?.id === need.id || o.equipment_need_id === need.id)
												const statusColors = {
													OPEN: "bg-blue-600/20 text-blue-400",
													FULFILLED: "bg-green-600/20 text-green-400",
													CANCELLED: "bg-gray-600/20 text-gray-400",
												}
												const statusColor = statusColors[need.status] || "bg-gray-600/20 text-gray-400"

												return (
													<div key={need.id} className="rounded-xl border border-[#F6D6E3]/40 bg-[#131326] p-6">
														<div className="flex items-start justify-between mb-4">
															<div className="flex-1">
																<div className="flex items-center gap-3 mb-2">
																	<h3 className="text-lg font-semibold text-white">{need.equipment_name}</h3>
																	<span className={`rounded-full px-2 py-1 text-xs font-medium ${statusColor}`}>
																		{need.status || "OPEN"}
																	</span>
																</div>
																<p className="mt-1 text-sm text-pink-100/70">Type: {need.equipment_type}</p>
																<p className="mt-1 text-sm text-pink-100/70">Quantity: {need.quantity_needed}</p>
																{need.description && (
																	<p className="mt-2 text-sm text-pink-100/60">{need.description}</p>
																)}
																{need.needed_by && (
																	<p className="mt-2 text-sm text-pink-100/60">
																		Needed by: {new Date(need.needed_by).toLocaleDateString()}
																	</p>
																)}
																{need.notes && (
																	<p className="mt-2 text-sm text-pink-100/60">Notes: {need.notes}</p>
																)}
															</div>
															<button
																onClick={() => setShowOrderForm(need.id)}
																className="rounded-lg bg-[#22C55E] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
															>
																Create Order
															</button>
														</div>

														{needOrders.length > 0 && (
															<div className="mt-4 space-y-3 border-t border-[#F6D6E3]/20 pt-4">
																<h4 className="text-sm font-semibold text-white">Orders & Status:</h4>
																{needOrders.map((order) => {
																	const statusColors = {
																		PENDING: "bg-yellow-600/20 text-yellow-400",
																		APPROVED: "bg-blue-600/20 text-blue-400",
																		INVOICED: "bg-purple-600/20 text-purple-400",
																		SENT: "bg-orange-600/20 text-orange-400",
																		RECEIVED: "bg-green-600/20 text-green-400",
																		REJECTED: "bg-red-600/20 text-red-400",
																	}
																	const statusColor = statusColors[order.status] || "bg-gray-600/20 text-gray-400"

																	return (
																		<div key={order.id} className="rounded-lg border border-[#F6D6E3]/20 bg-[#1A1A2E] p-4">
																			<div className="flex items-start justify-between">
																				<div className="flex-1">
																					<div className="flex items-center gap-2 mb-2">
																						<span className="text-sm font-medium text-white">
																							Supplier: {order.supplier?.company_name || "Unknown"}
																						</span>
																						<span className={`rounded-full px-2 py-1 text-xs font-medium ${statusColor}`}>
																							{order.status}
																						</span>
																					</div>
																					<p className="text-xs text-pink-100/70">
																						Quantity: {order.quantity} • Price: {order.currency} {order.unit_price} • Total: {order.currency} {order.total_amount}
																					</p>
																					{order.sent_date && (
																						<p className="text-xs text-orange-400 mt-1">
																							Sent: {new Date(order.sent_date).toLocaleString()}
																						</p>
																					)}
																					{order.received_date && (
																						<p className="text-xs text-green-400 mt-1">
																							Received: {new Date(order.received_date).toLocaleString()}
																						</p>
																					)}
																					{order.invoice && (
																						<div className="mt-2 p-2 bg-[#131326] rounded border border-[#F6D6E3]/10">
																							<p className="text-xs font-semibold text-white mb-1">Invoice Details:</p>
																							<p className="text-xs text-pink-100/70">
																								Invoice #: {order.invoice.invoice_number}
																							</p>
																							<p className="text-xs text-pink-100/70">
																								Date: {new Date(order.invoice.invoice_date).toLocaleDateString()} ({order.invoice.month_name})
																							</p>
																							<p className="text-xs text-pink-100/70">
																								Amount: {order.invoice.currency} {order.invoice.total_amount}
																							</p>
																							<p className="text-xs text-pink-100/70">
																								Status: {order.invoice.is_paid ? "Paid" : "Pending"}
																							</p>
																							<button
																								onClick={() => window.open(`/invoices/${order.invoice.id}`, '_blank')}
																								className="mt-2 text-xs text-[#E91E63] hover:underline"
																							>
																								View Invoice/Receipt
																							</button>
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
												)
											})
										)}
									</div>
								</div>

								<div>
									<h2 className="text-xl font-bold text-white mb-4">Blood & Medical Needs</h2>
									<div className="space-y-4">
										{activeNeeds.map((need) => (
											<div key={need.id} className="rounded-xl border border-[#F6D6E3]/40 bg-[#131326] p-6">
												<div className="flex items-start justify-between">
													<div className="flex-1">
														<div className="flex items-center gap-3">
															<h3 className="text-lg font-semibold text-white">{need.need_type}</h3>
															{need.required_blood_group && (
																<span className="rounded bg-[#E91E63]/10 px-2 py-1 text-xs text-[#E91E63]">
																	{need.required_blood_group}
																</span>
															)}
															<span className={`rounded px-2 py-1 text-xs font-semibold ${need.status === "URGENT" ? "bg-red-500/10 text-red-300" : "bg-yellow-500/10 text-yellow-300"
																}`}>
																{need.status}
															</span>
														</div>
														{need.patient_name && (
															<p className="mt-2 text-sm text-pink-100/80">Patient: {need.patient_name}</p>
														)}
														{need.patient_details && (
															<p className="mt-2 text-sm text-pink-100/70">{need.patient_details}</p>
														)}
														<p className="mt-2 text-sm text-pink-100/70">Quantity: {need.quantity_needed} units</p>
													</div>
												</div>
											</div>
										))}
									</div>
								</div>
							</div>
						</div>)}

					{/* Marketplace Tab */}
					{activeTab === "marketplace" && (
						<div>
							<div className="flex gap-4 mb-6">
								<button
									onClick={() => setMarketplaceTab("medicines")}
									className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${marketplaceTab === "medicines"
										? "bg-[#E91E63] text-white"
										: "bg-[#F6D6E3]/10 text-pink-100 hover:bg-[#F6D6E3]/20"
										}`}
								>
									Medicines & Supplies
								</button>
								<button
									onClick={() => setMarketplaceTab("equipment")}
									className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${marketplaceTab === "equipment"
										? "bg-[#E91E63] text-white"
										: "bg-[#F6D6E3]/10 text-pink-100 hover:bg-[#F6D6E3]/20"
										}`}
								>
									Equipment
								</button>
							</div>

							{marketplaceTab === "medicines" && <MedicalStore profile={null} hospitalProfile={hospital} />}
							{marketplaceTab === "equipment" && <Equipment profile={null} hospitalProfile={hospital} />}
						</div>
					)}

					{/* My Orders Tab */}
					{activeTab === "orders" && (
						<div className="space-y-6">
							<h2 className="text-xl font-bold text-white mb-4">My Orders</h2>
							{myOrders.length === 0 ? (
								<p className="text-pink-100/70">No orders found.</p>
							) : (
								<div className="space-y-4">
									{myOrders.map(order => (
										<div key={order.id} className="rounded-xl border border-[#F6D6E3]/40 bg-[#131326] p-6">
											<div className="flex items-start justify-between">
												<div>
													<div className="flex items-center gap-3 mb-2">
														<span className="text-lg font-bold text-white">Order #{order.order_number}</span>
														<span className={`px-2 py-1 rounded-full text-xs font-semibold ${order.status === "PENDING" ? "bg-yellow-500/20 text-yellow-300" :
															order.status === "APPROVED" ? "bg-blue-500/20 text-blue-300" :
																order.status === "SHIPPED" ? "bg-purple-500/20 text-purple-300" :
																	order.status === "RECEIVED" ? "bg-green-500/20 text-green-300" :
																		"bg-gray-500/20 text-gray-300"
															}`}>
															{order.status === "RECEIVED" ? "SHIPPING SUCCESSFUL" : order.status}
														</span>
													</div>
													<div className="text-sm text-pink-100/70">
														<p>Supplier: {order.supplier?.company_name}</p>
														<p>Total: {order.currency} {order.total_amount}</p>
														<p>Date: {new Date(order.created_at).toLocaleDateString()}</p>
													</div>
													{order.status === "SHIPPED" && order.estimated_arrival_at && (
														<div className="mt-2 text-xs bg-purple-500/10 text-purple-300 p-2 rounded-lg border border-purple-500/20">
															🚀 Estimated Reach: {new Date(order.estimated_arrival_at).toLocaleString()}
														</div>
													)}
													{order.status === "SHIPPED" && (
														<div className="mt-4 p-4 bg-[#E91E63]/5 border border-[#E91E63]/20 rounded-xl space-y-3">
															<p className="text-sm font-bold text-pink-100/90">Confirmation Required</p>
															<p className="text-xs text-pink-100/60">Please rate the order to confirm receipt:</p>
															<div className="flex gap-2">
																{[1, 2, 3, 4, 5].map((star) => (
																	<button
																		key={star}
																		onClick={() => {
																			if (confirm(`Mark as received with ${star} stars?`)) {
																				handleMarkReceived(order.id, star)
																			}
																		}}
																		className="w-8 h-8 flex items-center justify-center bg-[#131326] border border-[#F6D6E3]/20 rounded-lg hover:bg-[#E91E63] hover:text-white transition group"
																	>
																		<svg className="w-5 h-5 text-yellow-400 group-hover:text-white" fill="currentColor" viewBox="0 0 20 20">
																			<path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
																		</svg>
																	</button>
																))}
															</div>
														</div>
													)}

													{order.status === "RECEIVED" && order.rating && (
														<div className="mt-4 flex items-center gap-2 text-green-400 text-sm font-bold bg-green-400/5 p-2 rounded-lg border border-green-400/10">
															<svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
																<path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
															</svg>
															Received - Rated {order.rating} Stars
														</div>
													)}

													<div className="flex flex-col gap-2 mt-4">
														{order.status === "PENDING" && (
															<button
																onClick={() => handlePayOrder(order.id)}
																className="px-4 py-2 bg-[#22C55E] rounded-lg text-white font-medium hover:bg-green-600 transition"
															>
																Pay Now
															</button>
														)}
														{order.invoice && (
															<div className="flex items-center justify-between gap-2 mt-2">
																<div>
																	<p className="text-[10px] text-pink-100/50 uppercase font-bold">Invoice</p>
																	<p className="text-xs text-pink-100/50">#{order.invoice.invoice_number}</p>
																</div>
																<button
																	onClick={() => setViewingOrder(order)}
																	className="px-4 py-2 bg-[#E91E63]/10 text-[#E91E63] border border-[#E91E63]/20 rounded-lg text-xs font-bold hover:bg-[#E91E63]/20 transition-colors"
																>
																	View Details
																</button>
															</div>
														)}
													</div>
												</div>
											</div>
										</div>
									))}
								</div>
							)}
						</div>
					)}

					{showOrderForm && (
						<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
							<div className="bg-[#131326] rounded-xl border border-[#F6D6E3]/40 p-6 max-w-md w-full mx-4">
								<h3 className="text-xl font-bold text-white mb-4">Create Equipment Order</h3>
								<div className="space-y-4">
									<div>
										<label className="block text-sm font-medium text-pink-100 mb-1">Supplier *</label>
										<select
											required
											value={orderForm.supplier_id}
											onChange={(e) => setOrderForm({ ...orderForm, supplier_id: e.target.value })}
											className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
										>
											<option value="">Select Supplier</option>
											{suppliers.map(supplier => (
												<option key={supplier.id} value={supplier.id}>
													{supplier.company_name} - {supplier.business_type}
												</option>
											))}
										</select>
									</div>
									<div className="grid grid-cols-2 gap-4">
										<div>
											<label className="block text-sm font-medium text-pink-100 mb-1">Quantity *</label>
											<input
												type="number"
												required
												min="1"
												value={orderForm.quantity}
												onChange={(e) => setOrderForm({ ...orderForm, quantity: e.target.value })}
												className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-pink-100 mb-1">Unit Price *</label>
											<input
												type="number"
												required
												step="0.01"
												value={orderForm.unit_price}
												onChange={(e) => setOrderForm({ ...orderForm, unit_price: e.target.value })}
												className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
											/>
										</div>
									</div>
									<div>
										<label className="block text-sm font-medium text-pink-100 mb-1">Notes</label>
										<textarea
											value={orderForm.notes}
											onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
											rows={2}
											className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
										/>
									</div>
									<div className="flex gap-2">
										<button
											onClick={() => handleCreateOrder(showOrderForm)}
											className="flex-1 rounded-lg bg-[#22C55E] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
										>
											Create Order
										</button>
										<button
											onClick={() => {
												setShowOrderForm(null)
												setOrderForm({
													supplier_id: "",
													quantity: 1,
													unit_price: "",
													currency: "INR",
													notes: "",
												})
											}}
											className="rounded-lg border border-[#F6D6E3] px-4 py-2 text-sm text-pink-100 hover:bg-white/5"
										>
											Cancel
										</button>
									</div>
								</div>
							</div>
						</div>
					)}

					{viewingOrder && (
						<div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
							<div className="bg-[#1A1A2E] rounded-2xl border border-[#F6D6E3]/40 w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
								<div className="bg-[#E91E63] p-6 text-white flex justify-between items-center">
									<div>
										<h3 className="text-2xl font-black uppercase tracking-tighter">Receipt / Invoice</h3>
										<p className="text-xs opacity-80">Order #{viewingOrder.order_number}</p>
									</div>
									<button onClick={() => setViewingOrder(null)} className="p-2 hover:bg-white/20 rounded-full transition">
										<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
										</svg>
									</button>
								</div>

								<div className="p-6 space-y-6">
									<div className="grid grid-cols-2 gap-4 text-sm">
										<div>
											<p className="text-pink-100/50 uppercase text-[10px] font-bold">Supplier</p>
											<p className="font-bold text-white">{viewingOrder.supplier?.company_name}</p>
											<p className="text-pink-100/70">{viewingOrder.supplier?.contact_email}</p>
										</div>
										<div className="text-right">
											<p className="text-pink-100/50 uppercase text-[10px] font-bold">Billing Date</p>
											<p className="font-bold text-white">{new Date(viewingOrder.created_at).toLocaleDateString()}</p>
											{viewingOrder.invoice && (
												<p className="text-[#22C55E] font-medium text-xs">Invoice: {viewingOrder.invoice.invoice_number}</p>
											)}
										</div>
									</div>

									<div className="border border-[#F6D6E3]/20 rounded-xl overflow-hidden">
										<table className="w-full text-left text-sm">
											<thead className="bg-[#131326] text-pink-100/70 border-b border-[#F6D6E3]/20">
												<tr>
													<th className="px-4 py-3 font-bold">Description</th>
													<th className="px-4 py-3 font-bold text-center">Qty</th>
													<th className="px-4 py-3 font-bold text-right">Price</th>
													<th className="px-4 py-3 font-bold text-right">Total</th>
												</tr>
											</thead>
											<tbody className="divide-y divide-[#F6D6E3]/10">
												{viewingOrder.items.map((item) => (
													<tr key={item.id} className="text-white">
														<td className="px-4 py-3">
															{item.product_type === "STORE" ? item.store_product?.name : item.equipment?.name}
														</td>
														<td className="px-4 py-3 text-center">{item.quantity}</td>
														<td className="px-4 py-3 text-right">{viewingOrder.currency} {parseFloat(item.unit_price).toFixed(2)}</td>
														<td className="px-4 py-3 text-right font-bold">{viewingOrder.currency} {parseFloat(item.subtotal).toFixed(2)}</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>

									<div className="flex justify-between items-end">
										<div>
											{viewingOrder.status === "SHIPPED" && (
												<div className="space-y-3">
													<p className="text-white font-bold text-sm">Rate this order to complete:</p>
													<div className="flex gap-2">
														{[1, 2, 3, 4, 5].map((star) => (
															<button
																key={star}
																onClick={() => {
																	if (confirm(`Mark as received with ${star} stars?`)) {
																		handleMarkReceived(viewingOrder.id, star)
																	}
																}}
																className="w-10 h-10 flex items-center justify-center bg-white/5 border border-[#F6D6E3]/20 rounded-lg hover:bg-[#E91E63] hover:text-white transition group"
															>
																<svg className="w-6 h-6 text-yellow-400 group-hover:text-white" fill="currentColor" viewBox="0 0 20 20">
																	<path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
																</svg>
															</button>
														))}
													</div>
												</div>
											)}
											{viewingOrder.status === "RECEIVED" && (
												<div className="flex items-center gap-2 text-[#22C55E]">
													<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
														<path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
													</svg>
													<span className="font-bold">Shipment Received ({viewingOrder.rating} Stars)</span>
												</div>
											)}
										</div>
										<div className="text-right">
											<p className="text-pink-100/50 text-xs font-bold uppercase mb-1">Total Amount Paid</p>
											<p className="text-3xl font-black text-white">{viewingOrder.currency} {parseFloat(viewingOrder.total_amount).toFixed(2)}</p>
										</div>
									</div>
								</div>

								<div className="bg-[#131326] p-4 text-center border-t border-[#F6D6E3]/40">
									<p className="text-[10px] text-pink-100/30 uppercase tracking-[0.2em]">Generated by LifeSaver Connect Ledger System</p>
								</div>
							</div>
						</div>
					)}
				</div>
			</main>
		</>
	)
}
