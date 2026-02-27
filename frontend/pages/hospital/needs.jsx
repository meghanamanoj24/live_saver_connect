import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import { useState, useEffect } from "react"
import { apiFetch } from "../../lib/api"
import { validatePositiveInteger, validateDateInFuture } from "../../lib/validation"
import MedicalStore from "../../components/medical-essential/MedicalStore"
import Equipment from "../../components/medical-essential/Equipment"

const statusColors = {
	PENDING: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
	ACCEPTED: "bg-green-500/10 text-green-500 border-green-500/20",
	SCHEDULED: "bg-blue-500/10 text-blue-500 border-blue-500/20",
	SCHEDULE_CONFIRMED: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
	REACHING: "bg-orange-500/10 text-orange-400 border-orange-500/20",
	REJECTED: "bg-red-500/10 text-red-500 border-red-500/20",
	ARRIVED: "bg-purple-500/10 text-purple-500 border-purple-500/20",
	COMPLETED: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
}

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
	const [activeTab, setActiveTab] = useState("medical_needs") // medical_needs, donation_requests, equipment_needs, completed, marketplace, orders
	const [marketplaceTab, setMarketplaceTab] = useState("medicines") // medicines, equipment
	const [myOrders, setMyOrders] = useState([])
	const [donationRequests, setDonationRequests] = useState([])
	const [schedulingRequest, setSchedulingRequest] = useState(null)
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
		patient_contact: "",
		time_to_reach: "",
		location_details: "",
		patient_details: "",
		poster_image: null,
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

	// Cart System
	const [cart, setCart] = useState([])
	const [selectedCartItems, setSelectedCartItems] = useState([]) // Track selected IDs
	const [showCart, setShowCart] = useState(false)
	const [supplierProducts, setSupplierProducts] = useState([])
	const [loadingProducts, setLoadingProducts] = useState(false)
	const [showInvoice, setShowInvoice] = useState(false)
	const [currentInvoice, setCurrentInvoice] = useState(null)
	const [currentOrder, setCurrentOrder] = useState(null)
	const [paymentProcessing, setPaymentProcessing] = useState(false)

	useEffect(() => {
		loadData()
	}, [id])

	useEffect(() => {
		if (showOrderForm && orderForm.supplier_id) {
			loadSupplierProducts(orderForm.supplier_id)
		}
	}, [showOrderForm, orderForm.supplier_id])

	async function loadData() {
		setLoading(true)
		try {
			let hospitalData
			try {
				hospitalData = await apiFetch("/hospitals/me/")
			} catch (err) {
				if (id) {
					hospitalData = await apiFetch(`/hospitals/${id}/`)
				} else {
					console.error("Failed to load hospital data:", err)
					return
				}
			}
			setHospital(hospitalData)
			const hospitalId = hospitalData.id
			await Promise.all([
				loadHospitalNeeds(hospitalId),
				loadDonationRequests(hospitalId),
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

	async function loadDonationRequests(hospitalId) {
		try {
			const data = await apiFetch(`/donation-requests/?hospital=${hospitalId}`)
			setDonationRequests(data)
		} catch (error) {
			setDonationRequests([])
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

	async function loadSupplierProducts(supplierId) {
		if (!supplierId) {
			setSupplierProducts([])
			return
		}
		try {
			setLoadingProducts(true)
			// Fetch both medicines and equipment from the supplier
			const [storeProducts, equipments] = await Promise.all([
				apiFetch(`/medical-store-products/?supplier=${supplierId}`),
				apiFetch(`/medical-equipment/?supplier=${supplierId}`)
			])

			const storeItems = (Array.isArray(storeProducts) ? storeProducts : (storeProducts.results || [])).map(p => ({ ...p, product_type: "STORE" }))
			const equipmentItems = (Array.isArray(equipments) ? equipments : (equipments.results || [])).map(e => ({ ...e, product_type: "EQUIPMENT", price: e.unit_price || e.price }))

			setSupplierProducts([...storeItems, ...equipmentItems])
		} catch (error) {
			console.error("Error loading supplier products:", error)
			setSupplierProducts([])
		} finally {
			setLoadingProducts(false)
		}
	}

	// Cart Operations
	function addToCart(product, type) {
		const cartId = `${type}-${product.id}`
		const cartItem = {
			...product,
			product_type: type,
			quantity: 1,
			cartId
		}
		setCart(prev => {
			const exists = prev.find(item => item.cartId === cartItem.cartId)
			if (exists) {
				return prev.map(item => item.cartId === cartItem.cartId ? { ...item, quantity: item.quantity + 1 } : item)
			}
			return [...prev, cartItem]
		})
		// Auto-select when adding
		if (!selectedCartItems.includes(cartId)) {
			setSelectedCartItems(prev => [...prev, cartId])
		}
		setShowCart(true)
	}

	function addEquipmentNeedToCart(need) {
		// Build a cart item directly from the equipment need + confirmed supplier
		const cartId = `EQUIP_NEED-${need.id}`
		const supplierDetails = need.requested_supplier_details
		const cartItem = {
			id: null, // No specific product/equipment ID yet — we create it on backend
			cartId,
			product_type: "EQUIPMENT",
			name: need.equipment_name,
			equipment_type: need.equipment_type,
			price: need.suggested_price || 0,
			quantity: need.quantity_needed || 1,
			supplier_id: supplierDetails?.id,
			supplier_name: supplierDetails?.company_name || "Supplier",
			equipment_need_id: need.id,
			is_direct_need_order: true, // flag: this comes from an equipment need, not catalog
		}
		setCart(prev => {
			const exists = prev.find(item => item.cartId === cartId)
			if (exists) return prev // Don't duplicate
			return [...prev, cartItem]
		})
		if (!selectedCartItems.includes(cartId)) {
			setSelectedCartItems(prev => [...prev, cartId])
		}
		setShowCart(true)
	}

	function removeFromCart(cartId) {
		setCart(prev => prev.filter(item => item.cartId !== cartId))
		setSelectedCartItems(prev => prev.filter(id => id !== cartId))
	}

	function updateCartQuantity(cartId, newQty) {
		if (newQty < 1) return
		setCart(prev => prev.map(item => item.cartId === cartId ? { ...item, quantity: newQty } : item))
	}

	function toggleCartSelection(cartId) {
		setSelectedCartItems(prev =>
			prev.includes(cartId) ? prev.filter(id => id !== cartId) : [...prev, cartId]
		)
	}

	function calculateCartTotal(onlySelected = true) {
		const itemsToSum = onlySelected
			? cart.filter(item => selectedCartItems.includes(item.cartId))
			: cart
		return itemsToSum.reduce((sum, item) => sum + (parseFloat(item.price || 0) * item.quantity), 0).toFixed(2)
	}

	async function handlePayOrder(orderId) {
		if (!confirm("Confirm payment for this order?")) return
		setPaymentProcessing(true)
		try {
			const paymentResponse = await apiFetch(`/medical-orders/${orderId}/pay/`, { method: "POST" })
			setCurrentOrder(paymentResponse.order)
			setCurrentInvoice(paymentResponse.invoice)
			setShowInvoice(true)
			loadMyOrders()
		} catch (error) {
			const msg = error.body?.detail || error.message || "Payment failed"
			alert(msg)
		} finally {
			setPaymentProcessing(false)
		}
	}

	async function handleMarkReceived(orderId) {
		if (!confirm("Confirm that you have received this order?")) return
		try {
			await apiFetch(`/medical-orders/${orderId}/update_status/`, {
				method: "POST",
				body: JSON.stringify({ status: "RECEIVED" })
			})
			alert("Order marked as Received!")
			loadData()
		} catch (err) {
			alert(err.message || "Failed to mark as received")
		}
	}

	async function handleCheckout() {
		const itemsToPay = cart.filter(item => selectedCartItems.includes(item.cartId))
		if (itemsToPay.length === 0) {
			alert("Please select at least one item from the cart to pay.")
			return
		}

		if (!confirm(`Total Amount: INR ${calculateCartTotal(true)}\nProceed with payment for ${itemsToPay.length} items?`)) return

		setPaymentProcessing(true)
		try {
			// 1. Build items array — handle both catalog products and direct need orders
			const items = itemsToPay.map(item => {
				if (item.is_direct_need_order) {
					return {
						product_type: "DIRECT_NEED",
						equipment_need_id: item.equipment_need_id,
						supplier_id: item.supplier_id,
						name: item.name,
						quantity: item.quantity,
						unit_price: parseFloat(item.price || 0),
					}
				}
				return {
					product_type: item.product_type,
					store_product_id: item.product_type === "STORE" ? item.id : null,
					equipment_id: item.product_type === "EQUIPMENT" ? item.id : null,
					quantity: item.quantity,
				}
			})

			const shippingAddress = hospital?.address || "Hospital Address"
			const shippingCity = hospital?.city || "Hospital City"
			const contactPhone = hospital?.phone || "Hospital Phone"

			// Get equipment_need_id from the first direct need item if any
			const directNeedItem = itemsToPay.find(i => i.is_direct_need_order)

			const payload = {
				items,
				shipping_address: shippingAddress,
				shipping_city: shippingCity,
				shipping_zip_code: hospital?.zip_code || "",
				contact_phone: contactPhone,
			}
			// Attach equipment_need_id if ordering from a direct need
			if (directNeedItem) {
				payload.equipment_need_id = directNeedItem.equipment_need_id
				payload.supplier_id = directNeedItem.supplier_id
			}
			console.log("DEBUG: Checkout Payload:", JSON.stringify(payload, null, 2))

			const order = await apiFetch("/medical-orders/create-order/", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload)
			})

			// 2. Pay order
			const paymentResponse = await apiFetch(`/medical-orders/${order.id}/pay/`, { method: "POST" })

			setCurrentOrder(paymentResponse.order)
			setCurrentInvoice(paymentResponse.invoice)

			// Remove paid items from cart
			setCart(prev => prev.filter(item => !selectedCartItems.includes(item.cartId)))
			setSelectedCartItems([])

			setShowCart(false)
			setShowOrderForm(null)
			setShowInvoice(true)
			loadMyOrders()
			loadEquipmentNeeds(hospital?.id || id)
			alert("Payment successful! Order placed.")
		} catch (error) {
			console.error("Checkout failed:", error)
			const errorDetail = error.body ? JSON.stringify(error.body, null, 2) : error.message
			alert(`Checkout failed:\n${errorDetail}`)
		} finally {
			setPaymentProcessing(false)
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

	async function handleMarkMarketplaceReceived(orderId, rating) {
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

	async function handleMarkEquipmentReceived(orderId) {
		if (!confirm("Confirm that you have received this equipment? This will fulfill the need.")) return
		try {
			await apiFetch(`/equipment-orders/${orderId}/mark_received/`, {
				method: "POST"
			})
			alert("Equipment marked as received successfully!")
			loadEquipmentNeeds(hospital?.id || id)
		} catch (error) {
			alert(error.message || "Failed to mark as received")
		}
	}

	async function handleReportComplaint(orderId) {
		const message = prompt("Enter your complaint (e.g., 'Item not received after 7 days of payment'):")
		if (!message) return
		try {
			await apiFetch(`/medical-orders/${orderId}/report_complaint/`, {
				method: "POST",
				body: JSON.stringify({ complaint_message: message })
			})
			alert("Complaint reported successfully. The supplier will be notified.")
			loadMyOrders()
		} catch (error) {
			alert(error.message || "Failed to report complaint")
		}
	}

	async function handleHospitalConfirm(needId) {
		try {
			await apiFetch(`/equipment-needs/${needId}/hospital_confirm/`, {
				method: "POST"
			})
			alert("Supplier confirmation verified. You can now proceed to order the item.")
			loadEquipmentNeeds(hospital?.id || id)
		} catch (error) {
			alert(error.message || "Failed to confirm supplier creation")
		}
	}

	async function handleAcceptRequest(requestId, scheduledDate) {
		const request = donationRequests.find(r => r.id === requestId)
		// If it's already accepted/scheduled/etc, we use set_schedule. Only PENDING uses accept.
		const endpoint = request.status === "PENDING" ? "accept" : "set_schedule"

		try {
			await apiFetch(`/donation-requests/${requestId}/${endpoint}/`, {
				method: "POST",
				body: JSON.stringify({ scheduled_date: scheduledDate })
			})
			alert(request.status === "PENDING" ? "Request accepted and scheduled!" : "Schedule updated successfully!")
			setSchedulingRequest(null)
			loadDonationRequests(hospital?.id || id)
		} catch (error) {
			alert(error.message || "Failed to accept request")
		}
	}

	async function handleRejectRequest(requestId) {
		const reason = prompt("Enter reason for rejection:")
		if (!reason) return
		try {
			await apiFetch(`/donation-requests/${requestId}/reject/`, {
				method: "POST",
				body: JSON.stringify({ notes: reason })
			})
			alert("Request rejected.")
			loadDonationRequests(hospital?.id || id)
		} catch (error) {
			alert(error.message || "Failed to reject request")
		}
	}

	async function handleConfirmArrival(requestId) {
		if (!confirm("Confirm patient arrival?")) return
		try {
			await apiFetch(`/donation-requests/${requestId}/confirm_arrival/`, {
				method: "POST"
			})
			alert("Arrival confirmed!")
			loadDonationRequests(hospital?.id || id)
		} catch (error) {
			alert(error.message || "Failed to confirm arrival")
		}
	}

	async function handleCompleteDonation(requestId) {
		const notes = prompt("Enter any completion notes / rewards information:")
		try {
			// Use hospital_verify as per views.py
			await apiFetch(`/donation-requests/${requestId}/hospital_verify/`, {
				method: "POST",
				body: JSON.stringify({
					notes: notes || "Donation completed successfully.",
					visit_date: new Date().toISOString()
				})
			})
			alert("Donation marked as completed! Rewards have been issued to the donor.")
			loadDonationRequests(hospital?.id || id)
		} catch (error) {
			console.error("Verification error:", error)
			alert(error.message || "Failed to complete donation")
		}
	}

	async function handleCreateOrder(equipmentNeedId) {
		if (!orderForm.supplier_id) {
			alert("Please select a supplier.")
			return
		}
		try {
			await apiFetch("/equipment-orders/", {
				method: "POST",
				body: JSON.stringify({
					equipment_need_id: equipmentNeedId,
					supplier_id: parseInt(orderForm.supplier_id),
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

			const formData = new FormData()
			Object.keys(needForm).forEach(key => {
				if (key === "poster_image") {
					if (needForm[key]) formData.append(key, needForm[key])
				} else if (key === "needed_by") {
					if (neededBy) formData.append(key, neededBy)
				} else {
					formData.append(key, needForm[key])
				}
			})
			formData.append("hospital_id", hospital?.id || id)

			await apiFetch("/hospital-needs/", {
				method: "POST",
				body: formData,
			})
			setShowNeedForm(false)
			setNeedForm({
				need_type: "BLOOD",
				required_blood_group: "",
				patient_name: "",
				patient_contact: "",
				time_to_reach: "",
				location_details: "",
				patient_details: "",
				poster_image: null,
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
	const openEquipmentNeeds = equipmentNeeds.filter(n => n.status !== "CANCELLED")

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
						<div className="flex gap-4 border-b border-[#F6D6E3]/20 overflow-x-auto no-scrollbar">
							<button
								onClick={() => setActiveTab("medical_needs")}
								className={`pb-2 px-4 text-sm font-medium transition-colors whitespace-nowrap border-b-2 ${activeTab === "medical_needs"
									? "border-[#E91E63] text-white"
									: "border-transparent text-pink-100/60 hover:text-white"
									}`}
							>
								💉 Needs Poster
							</button>
							<button
								onClick={() => setActiveTab("donation_requests")}
								className={`pb-2 px-4 text-sm font-medium transition-colors whitespace-nowrap border-b-2 ${activeTab === "donation_requests"
									? "border-[#E91E63] text-white"
									: "border-transparent text-pink-100/60 hover:text-white"
									}`}
							>
								🩸 Donation Requests
							</button>
							<button
								onClick={() => setActiveTab("equipment_needs")}
								className={`pb-2 px-4 text-sm font-medium transition-colors whitespace-nowrap border-b-2 ${activeTab === "equipment_needs"
									? "border-[#E91E63] text-white"
									: "border-transparent text-pink-100/60 hover:text-white"
									}`}
							>
								🔧 Equipment Needs
							</button>
							<button
								onClick={() => setActiveTab("completed")}
								className={`pb-2 px-4 text-sm font-medium transition-colors whitespace-nowrap border-b-2 ${activeTab === "completed"
									? "border-[#E91E63] text-white"
									: "border-transparent text-pink-100/60 hover:text-white"
									}`}
							>
								✅ Completed
							</button>
							<button
								onClick={() => setActiveTab("marketplace")}
								className={`pb-2 px-4 text-sm font-medium transition-colors whitespace-nowrap border-b-2 ${activeTab === "marketplace"
									? "border-[#E91E63] text-white"
									: "border-transparent text-pink-100/60 hover:text-white"
									}`}
							>
								🛒 Medical Marketplace
							</button>
							<button
								onClick={() => setActiveTab("orders")}
								className={`pb-2 px-4 text-sm font-medium transition-colors whitespace-nowrap border-b-2 ${activeTab === "orders"
									? "border-[#E91E63] text-white"
									: "border-transparent text-pink-100/60 hover:text-white"
									}`}
							>
								📦 My Orders
							</button>
						</div>
					</div>
				</header>

				<div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
					{/* Blood & Medical Needs Tab */}
					{activeTab === "medical_needs" && (
						<div>
							<div className="flex justify-between items-center mb-6">
								<h2 className="text-xl font-bold text-white">Blood & Medical Needs</h2>
								<button
									onClick={() => setShowNeedForm(!showNeedForm)}
									className="rounded-lg bg-[#E91E63] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 shadow-lg shadow-pink-600/20"
								>
									{showNeedForm ? "Cancel" : "+ Post Medical Need"}
								</button>
							</div>

							{showNeedForm && (
								<form onSubmit={handleSubmitNeed} className="rounded-xl border border-[#F6D6E3]/40 bg-[#131326] p-6 space-y-4 mb-8 shadow-2xl animate-in fade-in slide-in-from-top-4">
									<h2 className="text-xl font-bold text-white mb-4">Post Hospital Need</h2>
									<div className="grid gap-4 md:grid-cols-2">
										<div>
											<label className="block text-sm font-medium text-pink-100 mb-1">Need Type *</label>
											<select
												required
												value={needForm.need_type}
												onChange={(e) => setNeedForm({ ...needForm, need_type: e.target.value })}
												className="w-full rounded-lg border border-[#F6D6E3]/20 bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63] transition"
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
												className="w-full rounded-lg border border-[#F6D6E3]/20 bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63] transition"
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
												className="w-full rounded-lg border border-[#F6D6E3]/20 bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63] transition"
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-pink-100 mb-1">Patient Contact</label>
											<input
												type="text"
												value={needForm.patient_contact}
												onChange={(e) => setNeedForm({ ...needForm, patient_contact: e.target.value })}
												className="w-full rounded-lg border border-[#F6D6E3]/20 bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63] transition"
												placeholder="Phone or contact info"
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-pink-100 mb-1">Place / Local Location</label>
											<input
												type="text"
												value={needForm.location_details}
												onChange={(e) => setNeedForm({ ...needForm, location_details: e.target.value })}
												className="w-full rounded-lg border border-[#F6D6E3]/20 bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63] transition"
												placeholder="Ward, Room No, etc."
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-pink-100 mb-1">Time to Reach</label>
											<input
												type="text"
												value={needForm.time_to_reach}
												onChange={(e) => setNeedForm({ ...needForm, time_to_reach: e.target.value })}
												className="w-full rounded-lg border border-[#F6D6E3]/20 bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63] transition"
												placeholder="e.g. within 2 hours"
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-pink-100 mb-1">Quantity Needed</label>
											<input
												type="number"
												min="1"
												value={needForm.quantity_needed}
												onChange={(e) => setNeedForm({ ...needForm, quantity_needed: parseInt(e.target.value) })}
												className="w-full rounded-lg border border-[#F6D6E3]/20 bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63] transition"
											/>
										</div>
										<div className="md:col-span-2">
											<label className="block text-sm font-medium text-pink-100 mb-1">Patient Details</label>
											<textarea
												value={needForm.patient_details}
												onChange={(e) => setNeedForm({ ...needForm, patient_details: e.target.value })}
												rows={3}
												className="w-full rounded-lg border border-[#F6D6E3]/20 bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63] transition"
												placeholder="Patient information and medical condition"
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-pink-100 mb-1">Poster Image</label>
											<input
												type="file"
												accept="image/*"
												onChange={(e) => setNeedForm({ ...needForm, poster_image: e.target.files[0] })}
												className="w-full rounded-lg border border-[#F6D6E3]/20 bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63] transition"
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-pink-100 mb-1">Status</label>
											<select
												value={needForm.status}
												onChange={(e) => setNeedForm({ ...needForm, status: e.target.value })}
												className="w-full rounded-lg border border-[#F6D6E3]/20 bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63] transition"
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
												className="w-full rounded-lg border border-[#F6D6E3]/20 bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63] transition"
											/>
										</div>
										<div className="md:col-span-2">
											<label className="block text-sm font-medium text-pink-100 mb-1">Notes</label>
											<textarea
												value={needForm.notes}
												onChange={(e) => setNeedForm({ ...needForm, notes: e.target.value })}
												rows={2}
												className="w-full rounded-lg border border-[#F6D6E3]/20 bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63] transition"
												placeholder="Additional notes..."
											/>
										</div>
									</div>
									<button
										type="submit"
										className="rounded-lg bg-[#E91E63] px-6 py-2 font-semibold text-white transition hover:opacity-90 shadow-lg shadow-pink-600/20"
									>
										Post Need
									</button>
								</form>
							)}

							<div className="space-y-4">
								{activeNeeds.length === 0 ? (
									<div className="rounded-xl border border-dashed border-[#F6D6E3]/40 bg-[#131326] p-12 text-center">
										<p className="text-pink-100/40">No active blood or medical needs.</p>
									</div>
								) : (
									activeNeeds.map((need) => (
										<div key={need.id} className="rounded-xl border border-[#F6D6E3]/10 bg-[#131326] p-6 hover:border-[#E91E63]/30 transition group">
											<div className="flex items-start justify-between">
												<div className="flex-1">
													<div className="flex items-center gap-3">
														<span className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
														<h3 className="text-lg font-bold text-white group-hover:text-[#E91E63] transition">{need.need_type}</h3>
														{need.required_blood_group && (
															<span className="rounded bg-[#E91E63]/20 px-2 py-0.5 text-xs font-bold text-[#E91E63]">
																{need.required_blood_group}
															</span>
														)}
														<span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${need.status === "URGENT" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-500"
															}`}>
															{need.status}
														</span>
													</div>
													{need.patient_name && (
														<p className="mt-3 text-sm font-bold text-white">Patient: {need.patient_name}</p>
													)}
													<div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-pink-100/70">
														{need.patient_contact && (
															<span className="flex items-center gap-1">📞 {need.patient_contact}</span>
														)}
														{need.location_details && (
															<span className="flex items-center gap-1">📍 {need.location_details}</span>
														)}
														{need.time_to_reach && (
															<span className="flex items-center gap-1">🕒 {need.time_to_reach}</span>
														)}
													</div>
													{need.patient_details && (
														<p className="mt-1 text-sm text-pink-100/60 italic">"{need.patient_details}"</p>
													)}
													<div className="mt-4 flex items-center gap-4 text-xs text-pink-100/40">
														<span className="flex items-center gap-1">
															📊 Needed: <span className="text-white font-bold">{need.quantity_needed} Units</span>
														</span>
														{need.needed_by && (
															<span className="flex items-center gap-1">
																⏳ By: <span className="text-white font-bold">{new Date(need.needed_by).toLocaleString()}</span>
															</span>
														)}
													</div>
												</div>
												{need.poster_image && (
													<div className="ml-4 flex-shrink-0">
														<img
															src={need.poster_image}
															alt="Poster"
															className="h-24 w-24 rounded-xl object-cover border border-white/10 shadow-xl group-hover:scale-105 transition"
															onError={(e) => e.target.style.display = 'none'}
														/>
													</div>
												)}
											</div>
										</div>
									))
								)}
							</div>
						</div>
					)}

					{/* Donation Requests Tab */}
					{activeTab === "donation_requests" && (
						<div className="space-y-6">
							<div className="flex justify-between items-center">
								<h2 className="text-xl font-bold text-white">Incoming Donation Requests</h2>
								<div className="flex gap-2">
									<button onClick={() => loadDonationRequests(hospital?.id || id)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-pink-100 transition">
										<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
									</button>
								</div>
							</div>

							<div className="grid gap-6">
								{donationRequests.length === 0 ? (
									<div className="rounded-xl border border-dashed border-[#F6D6E3]/40 bg-[#131326] p-12 text-center">
										<p className="text-pink-100/40">No donation requests yet.</p>
									</div>
								) : (
									donationRequests.map((request) => {
										const donor = request.donor_profile || {}
										const user = request.user || {}
										return (
											<div key={request.id} className="rounded-xl border border-[#F6D6E3]/10 bg-[#131326] p-6 hover:border-[#E91E63]/30 transition group relative overflow-hidden">
												{request.status === "PENDING" && <div className="absolute top-0 right-0 h-1 w-full bg-yellow-500 animate-pulse"></div>}
												<div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
													<div className="flex-1 min-w-0">
														<div className="flex items-center gap-3 mb-2">
															<span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${request.request_type === "BLOOD" ? "bg-red-500/10 text-red-400" :
																request.request_type === "PLATELETS" ? "bg-orange-500/10 text-orange-400" :
																	"bg-blue-500/10 text-blue-400"
																}`}>
																{request.request_type}
															</span>
															<span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${statusColors[request.status]}`}>
																{request.status}
															</span>
														</div>
														<h3 className="text-lg font-bold text-white mb-1">{donor.name || user.username}</h3>
														<div className="flex flex-wrap gap-4 text-xs text-pink-100/60 font-medium">
															<span className="flex items-center gap-1.5">🩸 {donor.blood_group || "Unknown"}</span>
															<span className="flex items-center gap-1.5">📍 {donor.city || "N/A"}</span>
															<span className="flex items-center gap-1.5">📞 {donor.phone || "N/A"}</span>
														</div>
														{request.hospital_need && (
															<div className="mt-2 text-xs text-pink-100/80 bg-pink-500/10 p-2 rounded border border-pink-500/20 w-fit">
																<span className="font-bold text-pink-400">Responding to Need:</span> {request.hospital_need.patient_name || "General Need"}
																{request.hospital_need.required_blood_group && ` (${request.hospital_need.required_blood_group})`}
															</div>
														)}
														{request.scheduled_date && (
															<div className="mt-3 p-2 rounded-lg bg-green-500/5 border border-green-500/20 w-fit">
																<p className="text-[10px] font-black text-green-400 uppercase tracking-widest">Scheduled For</p>
																<p className="text-sm text-green-100/80 font-bold">{new Date(request.scheduled_date).toLocaleString()}</p>
															</div>
														)}
													</div>

													<div className="flex flex-wrap items-center gap-3">
														{request.status === "PENDING" && (
															<>
																<button
																	onClick={() => setSchedulingRequest(request)}
																	className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-bold transition shadow-lg shadow-green-600/20 uppercase"
																>
																	Accept & Schedule
																</button>
																<button
																	onClick={() => handleRejectRequest(request.id)}
																	className="px-4 py-2 rounded-lg bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-600/30 text-xs font-bold transition uppercase"
																>
																	Reject
																</button>
															</>
														)}
														{request.status === "ACCEPTED" && (
															<>
																<button
																	onClick={() => setSchedulingRequest(request)}
																	className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shadow-lg shadow-purple-600/20 uppercase"
																>
																	Set Schedule
																</button>
																<button
																	onClick={() => handleConfirmArrival(request.id)}
																	className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-lg shadow-blue-600/20 uppercase"
																>
																	Confirm Patient Arrival
																</button>
															</>
														)}
														{["SCHEDULED", "SCHEDULE_CONFIRMED", "REACHING"].includes(request.status) && (
															<button
																onClick={() => setSchedulingRequest(request)}
																className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-pink-100/60 border border-white/10 text-[10px] font-bold transition uppercase"
															>
																Update Schedule
															</button>
														)}
														{["SCHEDULED", "SCHEDULE_CONFIRMED", "REACHING"].includes(request.status) && (
															<button
																onClick={() => handleConfirmArrival(request.id)}
																className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-lg shadow-blue-600/20 uppercase"
															>
																Confirm Patient Arrival
															</button>
														)}
														{request.status === "ARRIVED" && (
															<button
																onClick={() => handleCompleteDonation(request.id)}
																className="px-4 py-2 rounded-lg bg-[#E91E63] hover:bg-[#D81B60] text-white text-xs font-bold transition shadow-lg shadow-pink-600/20 uppercase"
															>
																Verify & Complete Donation
															</button>
														)}
													</div>
												</div>
											</div>
										)
									})
								)}
							</div>

							{/* Scheduling Modal */}
							{schedulingRequest && (
								<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
									<div className="w-full max-w-md rounded-2xl border border-[#F6D6E3]/30 bg-[#131326] p-6 shadow-2xl animate-in fade-in zoom-in-95">
										<h3 className="text-xl font-bold text-white mb-2">Schedule Donation</h3>
										<p className="text-sm text-pink-100/60 mb-6">
											Select a date and time for <strong>{schedulingRequest.donor_profile?.name || schedulingRequest.user?.username}</strong> to visit for {schedulingRequest.request_type} donation.
										</p>
										<form onSubmit={(e) => {
											e.preventDefault()
											const date = e.target.scheduledDate.value
											if (date) handleAcceptRequest(schedulingRequest.id, date)
										}}>
											<input
												type="datetime-local"
												name="scheduledDate"
												required
												min={new Date().toISOString().slice(0, 16)}
												className="w-full rounded-lg border border-[#F6D6E3]/20 bg-[#1A1A2E] px-4 py-3 text-white outline-none focus:border-[#E91E63] mb-6 transition"
											/>
											<div className="flex gap-3">
												<button
													type="button"
													onClick={() => setSchedulingRequest(null)}
													className="flex-1 py-3 rounded-lg border border-white/10 text-white font-bold hover:bg-white/5 transition uppercase text-xs"
												>
													Cancel
												</button>
												<button
													type="submit"
													className="flex-1 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold shadow-lg shadow-green-600/20 transition uppercase text-xs"
												>
													Confirm Schedule
												</button>
											</div>
										</form>
									</div>
								</div>
							)}
						</div>
					)}

					{/* Equipment Needs Tab */}
					{activeTab === "equipment_needs" && (
						<div>
							<div className="flex justify-between items-center mb-6">
								<h2 className="text-xl font-bold text-white">Hospital Equipment Needs</h2>
								<button
									onClick={() => setShowEquipmentForm(!showEquipmentForm)}
									className="rounded-lg bg-[#22C55E] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 shadow-lg shadow-green-600/20"
								>
									{showEquipmentForm ? "Cancel" : "+ Add Equipment Need"}
								</button>
							</div>

							{showEquipmentForm && (
								<form onSubmit={handleSubmitEquipment} className="rounded-xl border border-[#F6D6E3]/40 bg-[#131326] p-6 space-y-4 mb-8 shadow-2xl animate-in fade-in slide-in-from-top-4">
									<h2 className="text-xl font-bold text-white mb-4">Add Equipment Need</h2>
									<div className="grid gap-4 md:grid-cols-2">
										<div>
											<label className="block text-sm font-medium text-pink-100 mb-1">Equipment Name *</label>
											<input
												type="text"
												required
												value={equipmentForm.equipment_name}
												onChange={(e) => setEquipmentForm({ ...equipmentForm, equipment_name: e.target.value })}
												className="w-full rounded-lg border border-[#F6D6E3]/20 bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#22C55E] transition"
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-pink-100 mb-1">Equipment Type *</label>
											<select
												required
												value={equipmentForm.equipment_type}
												onChange={(e) => setEquipmentForm({ ...equipmentForm, equipment_type: e.target.value })}
												className="w-full rounded-lg border border-[#F6D6E3]/20 bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#22C55E] transition"
											>
												<option value="DIAGNOSTIC">Diagnostic Equipment</option>
												<option value="SURGICAL">Surgical Equipment</option>
												<option value="MONITORING">Monitoring Equipment</option>
												<option value="LIFE_SUPPORT">Life Support Equipment</option>
												<option value="STERILIZATION">Sterilization Equipment</option>
												<option value="FURNITURE">Hospital Furniture</option>
												<option value="MEDICINE">Medicines</option>
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
												className="w-full rounded-lg border border-[#F6D6E3]/20 bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#22C55E] transition"
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-pink-100 mb-1">Needed By</label>
											<input
												type="date"
												min={new Date().toISOString().split("T")[0]}
												value={equipmentForm.needed_by}
												onChange={(e) => setEquipmentForm({ ...equipmentForm, needed_by: e.target.value })}
												className="w-full rounded-lg border border-[#F6D6E3]/20 bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#22C55E] transition"
											/>
										</div>
										<div className="md:col-span-2">
											<label className="block text-sm font-medium text-pink-100 mb-1">Notes</label>
											<textarea
												value={equipmentForm.notes}
												onChange={(e) => setEquipmentForm({ ...equipmentForm, notes: e.target.value })}
												rows={2}
												className="w-full rounded-lg border border-[#F6D6E3]/20 bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#22C55E] transition"
												placeholder="Additional notes or requirements..."
											/>
										</div>
										<div className="md:col-span-2">
											<label className="block text-sm font-medium text-pink-100 mb-1">Description</label>
											<textarea
												value={equipmentForm.description}
												onChange={(e) => setEquipmentForm({ ...equipmentForm, description: e.target.value })}
												rows={3}
												className="w-full rounded-lg border border-[#F6D6E3]/20 bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#22C55E] transition"
											/>
										</div>
									</div>
									<button
										type="submit"
										className="rounded-lg bg-[#22C55E] px-6 py-2 font-semibold text-white transition hover:opacity-90 shadow-lg shadow-green-600/20"
									>
										Post Equipment Need
									</button>
								</form>
							)}

							<div className="space-y-4">
								{openEquipmentNeeds.length === 0 ? (
									<div className="rounded-xl border border-dashed border-[#F6D6E3]/40 bg-[#131326] p-12 text-center">
										<p className="text-pink-100/40">No active equipment needs.</p>
									</div>
								) : (
									openEquipmentNeeds.map((need) => {
										const needOrders = equipmentOrders.filter(o => o.equipment_need?.id === need.id || o.equipment_need_id === need.id)
										return (
											<div key={need.id} className="rounded-xl border border-[#F6D6E3]/10 bg-[#131326] p-6 hover:border-[#22C55E]/30 transition group">
												<div className="flex items-start justify-between">
													<div className="flex-1">
														<div className="flex items-center gap-3 mb-4">
															<span className="h-4 w-4 rounded bg-green-500/20 flex items-center justify-center text-[10px]">⚙️</span>
															<h3 className="text-lg font-bold text-white group-hover:text-[#22C55E] transition">{need.equipment_name}</h3>
															<span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-black uppercase text-blue-400">
																{need.status || "OPEN"}
															</span>
														</div>
														<div className="grid sm:grid-cols-2 gap-4 text-xs">
															<div>
																<p className="text-pink-100/40 uppercase tracking-widest font-bold">Category</p>
																<p className="text-white font-medium mt-0.5">{need.equipment_type.replace('_', ' ')}</p>
															</div>
															<div>
																<p className="text-pink-100/40 uppercase tracking-widest font-bold">Required Qty</p>
																<p className="text-white font-medium mt-0.5">{need.quantity_needed} Units</p>
															</div>
														</div>
														{need.description && (
															<p className="mt-4 text-sm text-pink-100/60 line-clamp-2">"{need.description}"</p>
														)}
														<div className="mt-4 flex items-center gap-4 text-[10px] text-pink-100/30">
															{need.needed_by && (
																<span>DEADLINE: {new Date(need.needed_by).toLocaleDateString()}</span>
															)}
															<span>ID: #{need.id}</span>
														</div>
													</div>
													<div className="flex flex-col gap-2">
														{need.is_confirmed_by_supplier && need.requested_supplier_details ? (
															<div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 mb-2">
																<div className="flex items-center justify-between mb-1">
																	<p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Supplier Confirmed</p>
																	<span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 rounded-full font-bold">Default</span>
																</div>
																<p className="text-xs text-white font-bold">{need.requested_supplier_details.company_name}</p>
																<p className="text-xs text-pink-100/60 mt-1">Price: {need.suggested_price} INR</p>
																<button
																	onClick={() => addEquipmentNeedToCart(need)}
																	className="mt-3 w-full rounded-lg bg-indigo-600 px-3 py-2 text-[10px] font-black uppercase text-white hover:bg-indigo-700 transition shadow-lg shadow-indigo-600/20"
																>
																	🛒 Order from this Supplier
																</button>
															</div>
														) : (
															<button
																onClick={() => {
																	// If there is a confirmed supplier even if not displayed prominently, try to pre-fill
																	if (need.requested_supplier_id || need.requested_supplier_details?.id) {
																		setOrderForm({
																			...orderForm,
																			supplier_id: String(need.requested_supplier_details?.id || need.requested_supplier_id),
																			unit_price: need.suggested_price || "",
																			quantity: need.quantity_needed
																		})
																	}
																	setShowOrderForm(need.id)
																}}
																className="rounded-lg bg-[#22C55E] px-4 py-2 text-xs font-black uppercase tracking-widest text-white transition hover:bg-green-600 shadow-lg shadow-green-600/20"
															>
																Direct Order
															</button>
														)}
													</div>
												</div>

												{needOrders.length > 0 && (
													<div className="mt-6 space-y-3 border-t border-white/5 pt-4">
														<h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-pink-100/30">Active Orders</h4>
														{needOrders.map((order) => (
															<div key={order.id} className="rounded-lg border border-white/5 bg-white/[0.02] p-4 flex justify-between items-center">
																<div>
																	<div className="flex items-center gap-2 mb-1">
																		<span className="text-sm font-bold text-white">{order.supplier?.company_name || 'Generic Supplier'}</span>
																		<span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 rounded-full uppercase font-black">{order.status}</span>
																	</div>
																	<p className="text-xs text-pink-100/40">
																		{order.quantity} Units • {order.currency} {order.unit_price}/unit
																		<span className="ml-2 text-[10px] text-pink-100/30 font-mono">(Status: {order.status})</span>
																	</p>
																</div>
																<button
																	onClick={() => setViewingOrder(order)}
																	className="text-[10px] font-black text-pink-100/40 hover:text-white transition"
																>
																	DETAILS →
																</button>
															</div>
														))}
													</div>
												)}
											</div>
										)
									})
								)}
							</div>
						</div>
					)}

					{/* Completed Equipment Tab */}
					{activeTab === "completed" && (
						<div className="animate-in fade-in slide-in-from-bottom-4">
							<h2 className="text-xl font-bold text-white mb-6">Completed / Fulfilled Equipment</h2>
							<div className="space-y-4">
								{equipmentNeeds.filter(n => n.status === "FULFILLED").length === 0 ? (
									<div className="rounded-xl border border-dashed border-[#F6D6E3]/40 bg-[#131326] p-12 text-center">
										<p className="text-pink-100/40 text-sm">No equipment requests have been fulfilled yet.</p>
									</div>
								) : (
									equipmentNeeds.filter(n => n.status === "FULFILLED").map((need) => (
										<div key={need.id} className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.02] p-6 shadow-xl">
											<div className="flex items-center justify-between mb-4">
												<div className="flex items-center gap-3">
													<div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
														<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
														</svg>
													</div>
													<h3 className="text-lg font-bold text-white">{need.equipment_name}</h3>
												</div>
												<span className="px-3 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest">
													FULFILLED
												</span>
											</div>
											<div className="grid sm:grid-cols-3 gap-6 text-xs text-pink-100/60 uppercase tracking-widest font-bold">
												<div>
													<p className="text-emerald-400/60 mb-1">Quantity Received</p>
													<p className="text-white text-base">{need.quantity_needed} Units</p>
												</div>
												<div>
													<p className="text-emerald-400/60 mb-1">Equipment Type</p>
													<p className="text-white text-base">{need.equipment_type.replace('_', ' ')}</p>
												</div>
												<div>
													<p className="text-emerald-400/60 mb-1">Completion Date</p>
													<p className="text-white text-base">{new Date(need.updated_at).toLocaleDateString()}</p>
												</div>
											</div>
										</div>
									))
								)}
							</div>
						</div>
					)}

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
																				handleMarkMarketplaceReceived(order.id, star)
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
														<div className="flex gap-2">
															{!order.is_complained && (order.status === "APPROVED" || order.status === "SHIPPED") && (
																<button
																	onClick={() => handleReportComplaint(order.id)}
																	className="flex-1 px-4 py-2 bg-red-600/10 text-red-400 border border-red-600/20 rounded-lg text-xs font-bold hover:bg-red-600/20 transition-colors uppercase"
																>
																	Report Complaint
																</button>
															)}
															{order.is_complained && (
																<div className="flex-1 px-4 py-2 bg-red-600/20 text-red-400 border border-red-600/40 rounded-lg text-xs font-bold uppercase flex items-center justify-center gap-1">
																	<span>⚠️ Complained</span>
																</div>
															)}
															{order.invoice && (
																<button
																	onClick={() => setViewingOrder(order)}
																	className="flex-1 px-4 py-2 bg-[#E91E63]/10 text-[#E91E63] border border-[#E91E63]/20 rounded-lg text-xs font-bold hover:bg-[#E91E63]/20 transition-colors uppercase"
																>
																	View Details
																</button>
															)}
														</div>
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
						<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
							<div className="bg-[#131326] rounded-2xl border border-[#F6D6E3]/40 w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200">
								<div className="p-6 border-b border-[#F6D6E3]/10 flex justify-between items-center">
									<div>
										<h3 className="text-xl font-black text-white uppercase tracking-tight">Order from Supplier</h3>
										<p className="text-xs text-pink-100/40">Browse products and add to your cart</p>
									</div>
									<div className="flex items-center gap-4">
										{cart.length > 0 && (
											<button
												onClick={() => setShowCart(true)}
												className="flex items-center gap-2 px-4 py-2 bg-[#E91E63] rounded-lg text-white font-bold text-xs uppercase"
											>
												🛒 Cart ({cart.length})
											</button>
										)}
										<button onClick={() => setShowOrderForm(null)} className="text-pink-100/40 hover:text-white transition">
											<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
											</svg>
										</button>
									</div>
								</div>

								<div className="flex-1 overflow-y-auto p-6">
									<div className="mb-8">
										<label className="block text-[10px] font-black text-pink-100/40 uppercase tracking-widest mb-3">Target Supplier</label>
										{orderForm.supplier_id ? (
											<div className="flex items-center justify-between p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-xl">
												<div>
													<p className="text-white font-bold">{suppliers.find(s => String(s.id) === String(orderForm.supplier_id))?.company_name || "Pre-selected Supplier"}</p>
													<p className="text-xs text-pink-100/40">{suppliers.find(s => String(s.id) === String(orderForm.supplier_id))?.business_type}</p>
												</div>
												<span className="px-3 py-1 bg-indigo-500/20 text-indigo-400 rounded-full text-[10px] font-black uppercase">Active Supplier</span>
											</div>
										) : (
											<select
												value={String(orderForm.supplier_id || "")}
												onChange={(e) => setOrderForm({ ...orderForm, supplier_id: e.target.value })}
												className="w-full rounded-xl border border-[#F6D6E3]/20 bg-[#1A1A2E] px-4 py-3 text-white outline-none focus:border-[#E91E63] transition"
											>
												<option value="">Choose a different supplier...</option>
												{suppliers.map(s => (
													<option key={s.id} value={String(s.id)}>{s.company_name}</option>
												))}
											</select>
										)}
									</div>

									<div>
										<div className="flex items-center justify-between mb-6">
											<h4 className="text-sm font-black text-white uppercase tracking-widest">Supplier Catalog</h4>
											{loadingProducts && <span className="text-xs text-pink-100/40 animate-pulse">Fetching inventory...</span>}
										</div>

										{supplierProducts.length === 0 ? (
											<div className="text-center py-12 border border-dashed border-[#F6D6E3]/10 rounded-2xl bg-white/5">
												<p className="text-pink-100/40 font-medium">{loadingProducts ? "Loading..." : "This supplier has no listed products yet."}</p>
											</div>
										) : (
											<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
												{supplierProducts.map(product => (
													<div key={`${product.product_type}-${product.id}`} className="p-4 rounded-xl border border-[#F6D6E3]/10 bg-white/5 hover:border-[#E91E63]/30 transition group flex justify-between items-center">
														<div className="flex-1">
															<div className="flex items-center gap-2 mb-1">
																<span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${product.product_type === "STORE" ? "bg-amber-500/10 text-amber-400" : "bg-cyan-500/10 text-cyan-400"}`}>
																	{product.product_type}
																</span>
																<h5 className="text-sm font-bold text-white group-hover:text-[#E91E63] transition">{product.name || product.equipment_name}</h5>
															</div>
															<p className="text-xs font-black text-white">INR {parseFloat(product.price).toFixed(2)}</p>
														</div>
														<button
															onClick={() => addToCart(product)}
															className="p-2 rounded-lg bg-[#E91E63]/10 text-[#E91E63] hover:bg-[#E91E63] hover:text-white transition"
															title="Add to Cart"
														>
															<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
															</svg>
														</button>
													</div>
												))}
											</div>
										)}
									</div>
								</div>

								<div className="p-6 border-t border-[#F6D6E3]/10 bg-white/5 flex flex-col md:flex-row gap-4 items-center justify-between">
									<div className="text-center md:text-left">
										<p className="text-[10px] font-black text-pink-100/40 uppercase tracking-widest mb-1">Current Selection</p>
										<p className="text-white font-bold">{cart.length} item(s) in cart</p>
									</div>
									<div className="flex gap-3 w-full md:w-auto">
										<button
											onClick={() => setShowOrderForm(null)}
											className="flex-1 md:flex-none px-6 py-3 rounded-xl border border-white/10 text-white font-bold text-xs uppercase hover:bg-white/5 transition"
										>
											Close
										</button>
										{cart.length > 0 && (
											<button
												onClick={() => setShowCart(true)}
												className="flex-1 md:flex-none px-8 py-3 rounded-xl bg-[#E91E63] text-white font-black text-xs uppercase shadow-lg shadow-pink-600/20 hover:opacity-90 transition"
											>
												View Cart & Checkout
											</button>
										)}
									</div>
								</div>
							</div>
						</div>
					)}


					{showCart && (
						<div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-end z-[60]">
							<div className="bg-[#1A1A2E] w-full max-w-lg h-full border-l border-[#F6D6E3]/20 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
								<div className="p-6 border-b border-[#F6D6E3]/10 flex justify-between items-center bg-[#E91E63]/5">
									<div>
										<h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Your Order Cart</h3>
										<p className="text-xs text-pink-100/40">Review items before final checkout</p>
									</div>
									<button onClick={() => setShowCart(false)} className="p-2 hover:bg-white/5 rounded-full transition">
										<svg className="w-6 h-6 text-pink-100/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
										</svg>
									</button>
								</div>

								<div className="flex-1 overflow-y-auto p-6 space-y-4">
									{cart.map((item) => (
										<div key={item.cartId} className={`p-4 rounded-2xl border transition group ${selectedCartItems.includes(item.cartId) ? "bg-[#22C55E]/10 border-[#22C55E]/40" : "bg-white/5 border-white/10 hover:border-white/20"}`}>
											<div className="flex items-center gap-4">
												<button
													onClick={() => toggleCartSelection(item.cartId)}
													className={`w-6 h-6 rounded-md border flex items-center justify-center transition ${selectedCartItems.includes(item.cartId) ? "bg-[#22C55E] border-[#22C55E]" : "border-white/30"}`}
												>
													{selectedCartItems.includes(item.cartId) && (
														<svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
														</svg>
													)}
												</button>
												<div className="flex-1">
													<div className="flex justify-between items-start">
														<p className="font-bold text-white text-sm">{item.name || item.equipment_name}</p>
														<button onClick={() => removeFromCart(item.cartId)} className="text-pink-600 opacity-0 group-hover:opacity-100 transition">
															<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
															</svg>
														</button>
													</div>
													<div className="flex items-center justify-between mt-3">
														<div className="flex items-center gap-4 bg-black/40 px-3 py-1 rounded-lg border border-white/5">
															<button onClick={() => updateCartQuantity(item.cartId, item.quantity - 1)} className="text-pink-100 hover:text-white">-</button>
															<span className="text-sm font-black text-white w-4 text-center">{item.quantity}</span>
															<button onClick={() => updateCartQuantity(item.cartId, item.quantity + 1)} className="text-pink-100 hover:text-white">+</button>
														</div>
														<p className="text-sm font-bold text-white">INR {(parseFloat(item.price || 0) * item.quantity).toFixed(2)}</p>
													</div>
												</div>
											</div>
										</div>
									))}
								</div>

								<div className="p-8 border-t border-[#F6D6E3]/20 bg-white/5 space-y-6">
									<div className="flex justify-between items-center">
										<p className="text-sm font-bold text-pink-100/40 uppercase tracking-widest">Selected Total</p>
										<p className="text-2xl font-black text-white tracking-tighter">INR {calculateCartTotal(true)}</p>
									</div>
									<button
										onClick={handleCheckout}
										disabled={paymentProcessing}
										className={`w-full py-4 rounded-xl font-black text-xs uppercase tracking-widest transition shadow-xl ${paymentProcessing ? "bg-gray-600 cursor-wait" : "bg-[#22C55E] text-white hover:opacity-90 shadow-green-600/20"}`}
									>
										{paymentProcessing ? "Processing Payment..." : `Pay INR ${calculateCartTotal(true)} Now`}
									</button>
								</div>
							</div>
						</div>
					)}

					{showInvoice && currentOrder && currentInvoice && (
						<div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-[100] p-4">
							<div className="bg-[#1A1A2E] w-full max-w-3xl rounded-3xl border border-[#F6D6E3]/30 overflow-hidden shadow-[0_0_100px_rgba(233,30,99,0.2)] animate-in zoom-in-95 duration-500">
								<div className="bg-[#22C55E] p-8 text-white flex justify-between items-center relative overflow-hidden">
									<div className="relative z-10">
										<div className="flex items-center gap-3 mb-2">
											<span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-lg">✅</span>
											<h3 className="text-3xl font-black uppercase tracking-tighter">Payment Successful</h3>
										</div>
										<p className="text-sm opacity-90 font-medium">Invoice Generated: <span className="font-bold underline">{currentInvoice.invoice_number}</span></p>
									</div>
									<button onClick={() => setShowInvoice(false)} className="relative z-10 p-3 hover:bg-white/20 rounded-full transition">
										<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
										</svg>
									</button>
								</div>

								<div className="p-10 space-y-10">
									<div className="grid grid-cols-2 gap-12 text-pink-100">
										<div className="space-y-4">
											<p className="text-[10px] font-black text-[#22C55E] uppercase tracking-widest">Hospital Details</p>
											<div>
												<p className="text-xl font-bold text-white">{currentOrder.hospital_name}</p>
												<p className="text-sm leading-relaxed opacity-60">{currentOrder.shipping_address}</p>
												<p className="text-[10px] opacity-40 mt-2">TIMESTAMP: {new Date(currentOrder.created_at).toLocaleString()}</p>
											</div>
										</div>
										<div className="space-y-4 text-right">
											<p className="text-[10px] font-black text-[#22C55E] uppercase tracking-widest">Supplier Identity</p>
											<div>
												<p className="text-xl font-bold text-white">{currentOrder.supplier_name}</p>
												<p className="text-sm opacity-60">Status: Fully Paid & Confirmed</p>
												<p className="text-[10px] opacity-40 mt-2 uppercase">ORDER REF: {currentOrder.order_number}</p>
											</div>
										</div>
									</div>

									<div className="border border-[#F6D6E3]/20 rounded-2xl overflow-hidden bg-white/5">
										<table className="w-full text-left">
											<thead>
												<tr className="bg-white/5 border-b border-[#F6D6E3]/20">
													<th className="p-5 text-[10px] font-black text-pink-100/40 uppercase">Item Description</th>
													<th className="p-5 text-[10px] font-black text-pink-100/40 uppercase text-right">Price</th>
													<th className="p-5 text-[10px] font-black text-pink-100/40 uppercase text-center">Qty</th>
													<th className="p-5 text-[10px] font-black text-pink-100/40 uppercase text-right">Total</th>
												</tr>
											</thead>
											<tbody className="divide-y divide-[#F6D6E3]/10">
												{currentOrder.items?.map((item, i) => (
													<tr key={i} className="text-sm">
														<td className="p-5 text-white font-medium">
															{item.item_name || item.store_product?.name || item.equipment?.name || "Medical Item"}
														</td>
														<td className="p-5 text-pink-100/60 text-right">INR {parseFloat(item.unit_price).toFixed(2)}</td>
														<td className="p-5 text-pink-100/70 text-center">{item.quantity}</td>
														<td className="p-5 text-white font-bold text-right">INR {parseFloat(item.subtotal).toFixed(2)}</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>

									<div className="flex justify-between items-center p-8 rounded-2xl bg-[#22C55E]/5 border border-[#22C55E]/20">
										<div>
											<p className="text-[10px] font-black text-[#22C55E] uppercase tracking-widest mb-1">Total Settlement Paid</p>
											<p className="text-4xl font-black text-white tracking-tighter">INR {parseFloat(currentOrder.total_amount).toFixed(2)}</p>
										</div>
										<button
											onClick={() => {
												window.print();
												alert("Generating PDF... (Printing standard view)");
											}}
											className="px-8 py-4 rounded-xl bg-white text-black font-black text-xs uppercase shadow-xl hover:bg-indigo-50 transition flex items-center gap-3"
										>
											<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
											</svg>
											Download Receipt
										</button>
									</div>
								</div>
							</div>
						</div>
					)}
				</div>
			</main>

			{/* View Order Details Modal */}






			{viewingOrder && (
				<div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
					<div className="bg-[#1A1A2E] w-full max-w-md rounded-2xl border border-[#F6D6E3]/20 shadow-2xl animate-in zoom-in-95 overflow-hidden">
						{/* Header */}
						<div className="p-4 border-b border-[#F6D6E3]/10 flex justify-between items-center bg-white/5">
							<h3 className="text-lg font-bold text-white uppercase tracking-wider">Order #{viewingOrder.order_number}</h3>
							<button onClick={() => setViewingOrder(null)} className="p-2 hover:bg-white/10 rounded-full transition text-pink-100/60 hover:text-white">
								<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
							</button>
						</div>

						{/* Content */}
						<div className="p-6 space-y-6">
							{/* Status and Total */}
							<div className="flex justify-between items-start">
								<div>
									<p className="text-[10px] font-black text-pink-100/40 uppercase tracking-widest mb-1">Current Status</p>
									<span className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${viewingOrder.status === "SHIPPED" ? "bg-purple-500/20 text-purple-400" : viewingOrder.status === "RECEIVED" ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white"}`}>
										{viewingOrder.status === "SHIPPED" ? "ARRIVING / READY" : viewingOrder.status}
									</span>
								</div>
								<div className="text-right">
									<p className="text-[10px] font-black text-pink-100/40 uppercase tracking-widest mb-1">Total</p>
									<p className="text-xl font-black text-white">{viewingOrder.currency} {viewingOrder.total_amount}</p>
								</div>
							</div>

							{/* Items */}
							<div className="bg-white/5 rounded-xl p-4 border border-white/5">
								<p className="text-xs font-bold text-pink-100/60 mb-3 uppercase tracking-wider">Items Ordered</p>
								<div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
									{viewingOrder.items?.map((item, idx) => (
										<div key={idx} className="flex justify-between items-center text-sm">
											<span className="text-white font-medium">{item.item_name || item.store_product?.name || item.equipment?.name || "Medical Item"}</span>
											<span className="text-pink-100/60 font-mono text-xs">x{item.quantity}</span>
										</div>
									))}
								</div>
							</div>

							{/* Mark Received Action */}
							{viewingOrder.status === "SHIPPED" && (
								<div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl">
									<div className="flex gap-3 mb-3">
										<div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
											<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
										</div>
										<div>
											<p className="text-sm font-bold text-white">Item Received?</p>
											<p className="text-xs text-pink-100/60">Confirm if you have physically received this equipment.</p>
										</div>
									</div>
									<button
										onClick={() => {
											handleMarkReceived(viewingOrder.id);
											setViewingOrder(null);
										}}
										className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-600/20 transition-all transform active:scale-95"
									>
										Yes, Mark as Received
									</button>
								</div>
							)}
						</div>
					</div>
				</div>
			)}
		</>
	)
}
















