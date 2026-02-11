import { useState, useEffect } from "react"
import { apiFetch } from "../../lib/api"

export default function MedicalStore({ profile, hospitalProfile }) {
	const [products, setProducts] = useState([])
	const [loading, setLoading] = useState(true)
	const [showAddForm, setShowAddForm] = useState(false)
	const [cart, setCart] = useState([])
	const [searchTerm, setSearchTerm] = useState("")
	const [categoryFilter, setCategoryFilter] = useState("")
	const [showCart, setShowCart] = useState(false)
	const [paymentProcessing, setPaymentProcessing] = useState(false)
	const [showInvoice, setShowInvoice] = useState(false)
	const [currentInvoice, setCurrentInvoice] = useState(null)
	const [currentOrder, setCurrentOrder] = useState(null)

	const [newProduct, setNewProduct] = useState({
		name: "",
		description: "",
		category: "MEDICINE",
		brand: "",
		sku: "",
		price: "",
		quantity_available: "",
		minimum_order_quantity: "1",
		unit: "unit",
		is_prescription_required: false,
		is_active: true,
		image: null,
	})

	useEffect(() => {
		loadProducts()
	}, [searchTerm, categoryFilter])

	async function loadProducts() {
		try {
			setLoading(true)
			const params = new URLSearchParams()
			if (searchTerm) params.append("search", searchTerm)
			if (categoryFilter) params.append("category", categoryFilter)
			if (profile?.id) params.append("supplier", profile.id)

			const data = await apiFetch(`/medical-store-products/?${params}`)
			setProducts(Array.isArray(data) ? data : (data.results || []))
		} catch (err) {
			console.error("Failed to load products:", err)
		} finally {
			setLoading(false)
		}
	}

	async function handleAddProduct(e) {
		e.preventDefault()
		try {
			const finalProduct = { ...newProduct }
			if (!finalProduct.sku) {
				const timestamp = new Date().getTime()
				finalProduct.sku = `ST-${timestamp}-${Math.floor(Math.random() * 1000)}`
			}

			const formData = new FormData()
			Object.keys(finalProduct).forEach(key => {
				if (finalProduct[key] !== null) {
					formData.append(key, finalProduct[key])
				}
			})

			if (profile?.id) {
				formData.append("supplier_id", profile.id)
			}

			await apiFetch("/medical-store-products/", {
				method: "POST",
				body: formData, // apiFetch should handle FormData automatically if configured correctly, or we might need to adjust it
				headers: {}, // Do not set Content-Type, browser will set it with boundary
			})
			setShowAddForm(false)
			setNewProduct({
				name: "",
				description: "",
				category: "MEDICINE",
				brand: "",
				sku: "",
				price: "",
				quantity_available: "",
				minimum_order_quantity: "1",
				unit: "unit",
				is_prescription_required: false,
				is_active: true,
				image: null,
			})
			loadProducts()
		} catch (err) {
			let errorMsg = err.message || "Failed to add product"
			if (err.body) {
				const fieldErrors = Object.entries(err.body)
					.map(([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(", ") : errors}`)
					.join("\n")
				if (fieldErrors) errorMsg = fieldErrors
			}
			alert(errorMsg)
		}
	}

	async function handleDeleteProduct(id) {
		if (!confirm("Are you sure you want to delete this product?")) return

		try {
			await apiFetch(`/medical-store-products/${id}/`, {
				method: "DELETE",
			})
			loadProducts()
		} catch (err) {
			alert(err.message || "Failed to delete product")
		}
	}

	async function handleUpdateStock(id, newQuantity) {
		if (newQuantity < 0) return
		try {
			await apiFetch(`/medical-store-products/${id}/`, {
				method: "PATCH",
				body: JSON.stringify({ quantity_available: newQuantity }),
			})
			loadProducts()
		} catch (err) {
			alert(err.message || "Failed to update stock")
		}
	}

	function addToCart(product) {
		setCart([...cart, { ...product, quantity: 1, product_type: "STORE" }])
		setShowCart(true)
	}

	function removeFromCart(index) {
		setCart(cart.filter((_, i) => i !== index))
	}

	function updateQuantity(index, newQuantity) {
		if (newQuantity < 1) return
		const updatedCart = [...cart]
		updatedCart[index].quantity = newQuantity
		setCart(updatedCart)
	}

	function calculateTotal() {
		return cart.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0).toFixed(2)
	}

	async function handlePayNow() {
		if (cart.length === 0) {
			alert("Cart is empty")
			return
		}

		const confirmMsg = hospitalProfile
			? `Total Amount: $${calculateTotal()}\n\nShipping to:\n${hospitalProfile.address}, ${hospitalProfile.city}\nContact: ${hospitalProfile.phone}\n\nProceed with payment?`
			: `Total Amount: $${calculateTotal()}\n\nProceed with payment?`

		if (!confirm(confirmMsg)) return

		setPaymentProcessing(true)

		try {
			const shippingAddress = hospitalProfile?.address || "Not specified"
			const shippingCity = hospitalProfile?.city || "Not specified"
			const contactPhone = hospitalProfile?.phone || "Not specified"

			const items = cart.map((item) => ({
				product_type: item.product_type,
				store_product_id: item.id,
				quantity: item.quantity,
			}))

			// Create order
			const order = await apiFetch("/medical-orders/create-order/", {
				method: "POST",
				body: JSON.stringify({
					items,
					shipping_address: shippingAddress,
					shipping_city: shippingCity,
					contact_phone: contactPhone,
				}),
			})

			// Process payment
			const paymentResponse = await apiFetch(`/medical-orders/${order.id}/pay/`, {
				method: "POST",
			})

			setCurrentOrder(paymentResponse.order)
			setCurrentInvoice(paymentResponse.invoice)
			setCart([])
			setShowCart(false)
			setShowInvoice(true)
		} catch (err) {
			alert(err.message || "Payment failed")
		} finally {
			setPaymentProcessing(false)
		}
	}

	async function downloadInvoice() {
		if (!currentOrder || !currentInvoice) return

		try {
			const blob = await apiFetch(`/medical-orders/${currentOrder.id}/download_invoice/`, {
				responseAs: "blob"
			})
			const url = window.URL.createObjectURL(blob)
			const a = document.createElement('a')
			a.href = url
			a.download = `invoice_${currentInvoice.invoice_number}.pdf`
			a.click()
			window.URL.revokeObjectURL(url)
		} catch (err) {
			alert("Invoice PDF download failed or will be available soon!")
		}
	}

	const isSupplier = profile?.id

	return (
		<div>
			{/* Header */}
			<div className="flex items-center justify-between mb-6">
				<div className="flex-1 max-w-md">
					<input
						type="text"
						placeholder="Search products..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className="w-full px-4 py-2 rounded-lg border border-[#F6D6E3] bg-[#131326] text-white"
					/>
				</div>
				<div className="flex gap-4">
					<select
						value={categoryFilter}
						onChange={(e) => setCategoryFilter(e.target.value)}
						className="px-4 py-2 rounded-lg border border-[#F6D6E3] bg-[#131326] text-white"
					>
						<option value="">All Categories</option>
						<option value="MEDICINE">Medicine</option>
						<option value="SUPPLIES">Medical Supplies</option>
						<option value="CONSUMABLES">Consumables</option>
						<option value="INSTRUMENTS">Instruments</option>
						<option value="OTHER">Other</option>
					</select>
					{!isSupplier && cart.length > 0 && (
						<button
							onClick={() => setShowCart(true)}
							className="relative px-6 py-2 bg-[#E91E63] rounded-lg font-medium flex items-center gap-2"
						>
							<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
							</svg>
							Cart ({cart.length})
							<span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">
								{cart.length}
							</span>
						</button>
					)}
					{isSupplier && (
						<button
							onClick={() => setShowAddForm(!showAddForm)}
							className="px-6 py-2 bg-[#E91E63] rounded-lg font-medium"
						>
							{showAddForm ? "Cancel" : "Add Product"}
						</button>
					)}
				</div>
			</div>

			{/* Add Product Form */}
			{showAddForm && isSupplier && (
				<form onSubmit={handleAddProduct} className="mb-6 p-6 rounded-xl border border-[#F6D6E3] bg-[#131326]">
					<h3 className="text-xl font-bold mb-4">Add New Product</h3>
					<div className="grid gap-4 md:grid-cols-2">
						<input
							type="text"
							required
							placeholder="Product Name"
							value={newProduct.name}
							onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
							className="px-4 py-2 rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] text-white"
						/>
						<input
							type="text"
							placeholder="Brand"
							value={newProduct.brand}
							onChange={(e) => setNewProduct({ ...newProduct, brand: e.target.value })}
							className="px-4 py-2 rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] text-white"
						/>
						<input
							type="text"
							placeholder="SKU (auto-generated if blank)"
							value={newProduct.sku}
							onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
							className="px-4 py-2 rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] text-white"
						/>
						<select
							value={newProduct.category}
							onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
							className="px-4 py-2 rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] text-white"
						>
							<option value="MEDICINE">Medicine</option>
							<option value="SUPPLIES">Medical Supplies</option>
							<option value="CONSUMABLES">Consumables</option>
							<option value="INSTRUMENTS">Instruments</option>
							<option value="OTHER">Other</option>
						</select>
						<input
							type="number"
							required
							step="0.01"
							placeholder="Price"
							value={newProduct.price}
							onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
							className="px-4 py-2 rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] text-white"
						/>
						<input
							type="number"
							required
							placeholder="Quantity Available"
							value={newProduct.quantity_available}
							onChange={(e) => setNewProduct({ ...newProduct, quantity_available: e.target.value })}
							className="px-4 py-2 rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] text-white"
						/>
						<input
							type="number"
							placeholder="Min Order Qty"
							value={newProduct.minimum_order_quantity}
							onChange={(e) => setNewProduct({ ...newProduct, minimum_order_quantity: e.target.value })}
							className="px-4 py-2 rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] text-white"
						/>
						<input
							type="text"
							placeholder="Unit (e.g., bottle, strip)"
							value={newProduct.unit}
							onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })}
							className="px-4 py-2 rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] text-white"
						/>
						<textarea
							placeholder="Description"
							value={newProduct.description}
							onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
							className="px-4 py-2 rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] text-white md:col-span-2"
							rows="2"
						/>
						<div className="md:col-span-2">
							<label className="block text-xs font-medium text-pink-100/70 mb-2">Product Image</label>
							<input
								type="file"
								accept="image/*"
								onChange={(e) => setNewProduct({ ...newProduct, image: e.target.files[0] })}
								className="w-full text-sm text-pink-100/50 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-pink-600/20 file:text-pink-400 hover:file:bg-pink-600/30"
							/>
						</div>
					</div>
					<div className="mt-4 flex items-center gap-4">
						<label className="flex items-center gap-2">
							<input
								type="checkbox"
								checked={newProduct.is_prescription_required}
								onChange={(e) => setNewProduct({ ...newProduct, is_prescription_required: e.target.checked })}
							/>
							<span className="text-sm">Prescription Required</span>
						</label>
						<button type="submit" className="px-6 py-2 bg-[#E91E63] rounded-lg font-medium">
							Add Product
						</button>
					</div>
				</form>
			)}

			{/* Products Grid */}
			{loading ? (
				<div className="text-center py-10">Loading...</div>
			) : (
				<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
					{products.map((product) => (
						<div key={product.id} className="rounded-xl border border-[#F6D6E3] bg-[#131326] overflow-hidden flex flex-col">
							{product.image ? (
								<div className="h-48 w-full overflow-hidden bg-black/20">
									<img src={product.image} alt={product.name} className="w-full h-full object-cover" />
								</div>
							) : (
								<div className="h-48 w-full bg-pink-600/10 flex items-center justify-center">
									<svg className="w-12 h-12 text-pink-600/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
									</svg>
								</div>
							)}
							<div className="p-6 flex-1 flex flex-col">
								<h3 className="font-bold text-lg mb-2">{product.name}</h3>
								<p className="text-sm text-pink-100/70 mb-2">{product.brand}</p>
								<p className="text-sm text-pink-100/50 mb-4">{product.category}</p>
								<div className="flex items-center justify-between mb-4">
									<span className="text-2xl font-bold text-[#E91E63]">${product.price}</span>
									<span className="text-sm text-pink-100/70">{product.quantity_available} available</span>
								</div>
								{product.is_prescription_required && (
									<div className="mb-2 text-xs text-yellow-400">⚠️ Prescription Required</div>
								)}
								{isSupplier ? (
									<div className="flex flex-col gap-4 mt-2">
										<div className="flex items-center justify-between bg-[#1A1A2E] p-3 rounded-lg border border-[#F6D6E3]/20">
											<span className="text-xs font-medium text-pink-100/70">Manage Stock:</span>
											<div className="flex items-center gap-3">
												<button
													onClick={() => handleUpdateStock(product.id, product.quantity_available - 1)}
													disabled={product.quantity_available <= 0}
													className="w-8 h-8 flex items-center justify-center bg-red-600/20 text-red-400 rounded hover:bg-red-600/30 disabled:opacity-30"
												>
													-
												</button>
												<span className="w-8 text-center font-bold text-[#E91E63]">{product.quantity_available}</span>
												<button
													onClick={() => handleUpdateStock(product.id, product.quantity_available + 1)}
													className="w-8 h-8 flex items-center justify-center bg-green-600/20 text-green-400 rounded hover:bg-green-600/30"
												>
													+
												</button>
											</div>
										</div>
										<div className="flex items-center justify-between">
											<div className="text-xs text-pink-100/70">SKU: {product.sku}</div>
											<button
												onClick={() => handleDeleteProduct(product.id)}
												className="text-xs bg-red-600/20 text-red-400 px-3 py-1.5 rounded hover:bg-red-600/30"
											>
												Delete
											</button>
										</div>
									</div>
								) : (
									<button
										onClick={() => addToCart(product)}
										disabled={product.quantity_available === 0}
										className="w-full px-4 py-2 bg-[#E91E63] rounded-lg font-medium disabled:opacity-50"
									>
										{product.quantity_available === 0 ? "Out of Stock" : "Add to Cart"}
									</button>
								)}
							</div>
						</div>
					))}
				</div>
			)}

			{/* Cart Drawer */}
			{showCart && (
				<div className="fixed inset-0 z-50">
					<div className="absolute inset-0 bg-black/50" onClick={() => setShowCart(false)} />
					<div className="absolute right-0 top-0 h-full w-full max-w-md bg-[#1A1A2E] shadow-2xl flex flex-col">
						<div className="flex items-center justify-between p-6 border-b border-[#F6D6E3]/20">
							<h2 className="text-2xl font-bold">Shopping Cart</h2>
							<button onClick={() => setShowCart(false)} className="text-3xl hover:text-white">×</button>
						</div>

						<div className="flex-1 overflow-y-auto p-6 space-y-4">
							{cart.length === 0 ? (
								<p className="text-center mt-10 text-pink-100/70">Your cart is empty</p>
							) : (
								cart.map((item, index) => (
									<div key={index} className="bg-[#131326] rounded-lg p-4 border border-[#F6D6E3]/20">
										<div className="flex justify-between items-start mb-2">
											<div className="flex-1">
												<h4 className="font-semibold">{item.name}</h4>
												<p className="text-sm text-pink-100/70">{item.brand}</p>
											</div>
											<button onClick={() => removeFromCart(index)} className="text-red-400 text-xl">×</button>
										</div>
										<div className="flex items-center justify-between mt-3">
											<div className="flex items-center gap-2">
												<button onClick={() => updateQuantity(index, item.quantity - 1)} className="w-8 h-8 bg-[#F6D6E3]/10 rounded">-</button>
												<span className="w-12 text-center font-medium">{item.quantity}</span>
												<button onClick={() => updateQuantity(index, item.quantity + 1)} className="w-8 h-8 bg-[#F6D6E3]/10 rounded">+</button>
											</div>
											<div className="text-right">
												<p className="text-lg font-bold text-[#E91E63]">${(parseFloat(item.price) * item.quantity).toFixed(2)}</p>
												<p className="text-xs text-pink-100/50">${item.price} each</p>
											</div>
										</div>
									</div>
								))
							)}
						</div>

						{cart.length > 0 && (
							<div className="border-t border-[#F6D6E3]/20 p-6 bg-[#131326]">
								<div className="flex justify-between items-center mb-6">
									<span className="text-lg">Total:</span>
									<span className="text-3xl font-bold">${calculateTotal()}</span>
								</div>
								<button
									onClick={handlePayNow}
									disabled={paymentProcessing}
									className="w-full bg-[#E91E63] py-4 rounded-lg font-bold text-lg hover:opacity-90 disabled:opacity-50"
								>
									{paymentProcessing ? "Processing Payment..." : "Pay Now"}
								</button>
							</div>
						)}
					</div>
				</div>
			)}

			{/* Invoice Success Modal */}
			{showInvoice && currentInvoice && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
					<div className="absolute inset-0 bg-black/70" onClick={() => setShowInvoice(false)} />
					<div className="relative bg-[#1A1A2E] rounded-xl border-2 border-green-500 p-8 max-w-md w-full">
						<div className="text-center">
							<div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
								<svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
								</svg>
							</div>
							<h2 className="text-2xl font-bold mb-2">Payment Successful!</h2>
							<p className="text-pink-100/70 mb-6">Your invoice has been generated</p>

							<div className="bg-[#131326] rounded-lg p-4 mb-6 text-left space-y-2">
								<div className="flex justify-between">
									<span className="text-pink-100/70">Invoice #:</span>
									<span className="font-bold">{currentInvoice.invoice_number}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-pink-100/70">Total Amount:</span>
									<span className="font-bold text-[#E91E63]">${currentInvoice.total_amount}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-pink-100/70">Status:</span>
									<span className="font-bold text-green-500">PAID</span>
								</div>
							</div>

							<div className="space-y-3">
								<button
									onClick={downloadInvoice}
									className="w-full bg-[#E91E63] py-3 rounded-lg font-semibold hover:opacity-90"
								>
									Download Invoice PDF
								</button>
								<button
									onClick={() => setShowInvoice(false)}
									className="w-full border border-[#F6D6E3] py-3 rounded-lg hover:bg-white/5"
								>
									Close
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
