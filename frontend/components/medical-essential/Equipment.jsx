import { useState, useEffect } from "react"
import { apiFetch } from "../../lib/api"

export default function Equipment({ profile, hospitalProfile }) {
	const [equipment, setEquipment] = useState([])
	const [loading, setLoading] = useState(true)
	const [showAddForm, setShowAddForm] = useState(false)
	const [cart, setCart] = useState([])
	const [searchTerm, setSearchTerm] = useState("")
	const [typeFilter, setTypeFilter] = useState("")

	const [newEquipment, setNewEquipment] = useState({
		name: "",
		description: "",
		equipment_type: "DIAGNOSTIC",
		brand: "",
		model_number: "",
		sku: "",
		price: "",
		quantity_available: "",
		warranty_period_months: "12",
		specifications: "",
		is_new: true,
		is_active: true,
		image: null,
	})

	useEffect(() => {
		loadEquipment()
	}, [searchTerm, typeFilter])

	async function loadEquipment() {
		try {
			setLoading(true)
			const params = new URLSearchParams()
			if (searchTerm) params.append("search", searchTerm)
			if (typeFilter) params.append("equipment_type", typeFilter)
			if (profile?.id) params.append("supplier", profile.id)

			const data = await apiFetch(`/medical-equipment/?${params}`)
			setEquipment(Array.isArray(data) ? data : (data.results || []))
		} catch (err) {
			console.error("Failed to load equipment:", err)
		} finally {
			setLoading(false)
		}
	}

	async function handleAddEquipment(e) {
		e.preventDefault()
		try {
			const finalEquipment = { ...newEquipment }
			if (!finalEquipment.sku) {
				const timestamp = new Date().getTime()
				finalEquipment.sku = `EQ-${timestamp}-${Math.floor(Math.random() * 1000)}`
			}

			const formData = new FormData()
			Object.keys(finalEquipment).forEach(key => {
				if (finalEquipment[key] !== null) {
					formData.append(key, finalEquipment[key])
				}
			})

			formData.append("supplier_id", profile.id)

			await apiFetch("/medical-equipment/", {
				method: "POST",
				body: formData,
				headers: {},
			})
			setShowAddForm(false)
			setNewEquipment({
				name: "",
				description: "",
				equipment_type: "DIAGNOSTIC",
				brand: "",
				model_number: "",
				sku: "",
				price: "",
				quantity_available: "",
				warranty_period_months: "12",
				specifications: "",
				is_new: true,
				is_active: true,
				image: null,
			})
			loadEquipment()
		} catch (err) {
			let errorMsg = err.message || "Failed to add equipment"
			if (err.body) {
				const fieldErrors = Object.entries(err.body)
					.map(([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(", ") : errors}`)
					.join("\n")
				if (fieldErrors) errorMsg = fieldErrors
			}
			alert(errorMsg)
		}
	}

	async function handleDeleteEquipment(id) {
		if (!confirm("Are you sure you want to delete this equipment?")) return

		try {
			await apiFetch(`/medical-equipment/${id}/`, {
				method: "DELETE",
			})
			loadEquipment()
		} catch (err) {
			alert(err.message || "Failed to delete equipment")
		}
	}

	async function handleUpdateStock(id, newQuantity) {
		if (newQuantity < 0) return
		try {
			await apiFetch(`/medical-equipment/${id}/`, {
				method: "PATCH",
				body: JSON.stringify({ quantity_available: newQuantity }),
			})
			loadEquipment()
		} catch (err) {
			alert(err.message || "Failed to update stock")
		}
	}

	function addToCart(item) {
		setCart([...cart, { ...item, quantity: 1, product_type: "EQUIPMENT" }])
	}

	function removeFromCart(index) {
		setCart(cart.filter((_, i) => i !== index))
	}

	async function handleCheckout() {
		if (cart.length === 0) {
			alert("Cart is empty")
			return
		}

		// Use hospital address if available, otherwise prompt
		let shippingAddress, shippingCity, contactPhone

		if (hospitalProfile) {
			shippingAddress = hospitalProfile.address || "Not specified"
			shippingCity = hospitalProfile.city || "Not specified"
			contactPhone = hospitalProfile.phone || "Not specified"

			const confirmMsg = `Order will be shipped to:\n${shippingAddress}, ${shippingCity}\nContact: ${contactPhone}\n\nContinue with checkout?`
			if (!confirm(confirmMsg)) {
				return
			}
		} else {
			// Fallback to prompts if no hospital profile
			shippingAddress = prompt("Enter shipping address:")
			shippingCity = prompt("Enter shipping city:")
			contactPhone = prompt("Enter contact phone:")

			if (!shippingAddress || !shippingCity || !contactPhone) {
				return
			}
		}

		try {
			const items = cart.map((item) => ({
				product_type: item.product_type,
				equipment_id: item.id,
				quantity: item.quantity,
			}))

			await apiFetch("/medical-orders/create-order/", {
				method: "POST",
				body: JSON.stringify({
					items,
					shipping_address: shippingAddress,
					shipping_city: shippingCity,
					contact_phone: contactPhone,
				}),
			})

			setCart([])
			alert("Order placed successfully! Check 'My Orders' tab to pay.")
		} catch (err) {
			alert(err.message || "Failed to place order")
		}
	}

	const isSupplier = profile?.id

	return (
		<div>
			{/* Header Actions */}
			<div className="flex items-center justify-between mb-6">
				<div className="flex-1 max-w-md">
					<input
						type="text"
						placeholder="Search equipment..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className="w-full px-4 py-2 rounded-lg border border-[#F6D6E3] bg-[#131326] text-white"
					/>
				</div>
				<div className="flex gap-4">
					<select
						value={typeFilter}
						onChange={(e) => setTypeFilter(e.target.value)}
						className="px-4 py-2 rounded-lg border border-[#F6D6E3] bg-[#131326] text-white"
					>
						<option value="">All Types</option>
						<option value="DIAGNOSTIC">Diagnostic Equipment</option>
						<option value="SURGICAL">Surgical Equipment</option>
						<option value="MONITORING">Monitoring Equipment</option>
						<option value="LIFE_SUPPORT">Life Support Equipment</option>
						<option value="STERILIZATION">Sterilization Equipment</option>
						<option value="FURNITURE">Hospital Furniture</option>
						<option value="OTHER">Other</option>
					</select>
					{isSupplier && (
						<button
							onClick={() => setShowAddForm(!showAddForm)}
							className="px-6 py-2 bg-[#E91E63] rounded-lg font-medium"
						>
							{showAddForm ? "Cancel" : "Add Equipment"}
						</button>
					)}
				</div>
			</div>

			{/* Add Equipment Form */}
			{showAddForm && isSupplier && (
				<form onSubmit={handleAddEquipment} className="mb-6 p-6 rounded-xl border border-[#F6D6E3] bg-[#131326]">
					<h3 className="text-xl font-bold mb-4">Add New Equipment</h3>
					<div className="grid gap-4 md:grid-cols-2">
						<input
							type="text"
							required
							placeholder="Equipment Name"
							value={newEquipment.name}
							onChange={(e) => setNewEquipment({ ...newEquipment, name: e.target.value })}
							className="px-4 py-2 rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] text-white"
						/>
						<input
							type="text"
							placeholder="Brand"
							value={newEquipment.brand}
							onChange={(e) => setNewEquipment({ ...newEquipment, brand: e.target.value })}
							className="px-4 py-2 rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] text-white"
						/>
						<input
							type="text"
							placeholder="Model Number"
							value={newEquipment.model_number}
							onChange={(e) => setNewEquipment({ ...newEquipment, model_number: e.target.value })}
							className="px-4 py-2 rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] text-white"
						/>
						<input
							type="text"
							placeholder="SKU (auto-generated if blank)"
							value={newEquipment.sku}
							onChange={(e) => setNewEquipment({ ...newEquipment, sku: e.target.value })}
							className="px-4 py-2 rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] text-white"
						/>
						<select
							value={newEquipment.equipment_type}
							onChange={(e) => setNewEquipment({ ...newEquipment, equipment_type: e.target.value })}
							className="px-4 py-2 rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] text-white"
						>
							<option value="DIAGNOSTIC">Diagnostic Equipment</option>
							<option value="SURGICAL">Surgical Equipment</option>
							<option value="MONITORING">Monitoring Equipment</option>
							<option value="LIFE_SUPPORT">Life Support Equipment</option>
							<option value="STERILIZATION">Sterilization Equipment</option>
							<option value="FURNITURE">Hospital Furniture</option>
							<option value="OTHER">Other</option>
						</select>
						<input
							type="number"
							required
							step="0.01"
							placeholder="Price"
							value={newEquipment.price}
							onChange={(e) => setNewEquipment({ ...newEquipment, price: e.target.value })}
							className="px-4 py-2 rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] text-white"
						/>
						<input
							type="number"
							required
							placeholder="Quantity Available"
							value={newEquipment.quantity_available}
							onChange={(e) => setNewEquipment({ ...newEquipment, quantity_available: e.target.value })}
							className="px-4 py-2 rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] text-white"
						/>
						<input
							type="number"
							placeholder="Warranty (months)"
							value={newEquipment.warranty_period_months}
							onChange={(e) => setNewEquipment({ ...newEquipment, warranty_period_months: e.target.value })}
							className="px-4 py-2 rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] text-white"
						/>
						<textarea
							placeholder="Description"
							value={newEquipment.description}
							onChange={(e) => setNewEquipment({ ...newEquipment, description: e.target.value })}
							className="px-4 py-2 rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] text-white md:col-span-2"
							rows="2"
						/>
						<textarea
							placeholder="Technical Specifications"
							value={newEquipment.specifications}
							onChange={(e) => setNewEquipment({ ...newEquipment, specifications: e.target.value })}
							className="px-4 py-2 rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] text-white md:col-span-2"
							rows="3"
						/>
						<div className="md:col-span-2">
							<label className="block text-xs font-medium text-pink-100/70 mb-2">Equipment Image</label>
							<input
								type="file"
								accept="image/*"
								onChange={(e) => setNewEquipment({ ...newEquipment, image: e.target.files[0] })}
								className="w-full text-sm text-pink-100/50 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-pink-600/20 file:text-pink-400 hover:file:bg-pink-600/30"
							/>
						</div>
					</div>
					<div className="mt-4 flex items-center gap-4">
						<label className="flex items-center gap-2">
							<input
								type="checkbox"
								checked={newEquipment.is_new}
								onChange={(e) => setNewEquipment({ ...newEquipment, is_new: e.target.checked })}
							/>
							<span>New Equipment</span>
						</label>
						<button type="submit" className="px-6 py-2 bg-[#E91E63] rounded-lg">
							Add Equipment
						</button>
					</div>
				</form>
			)}

			{/* Shopping Cart */}
			{cart.length > 0 && !isSupplier && (
				<div className="mb-6 p-4 rounded-xl border border-[#F6D6E3] bg-[#131326]">
					<h3 className="font-bold mb-2">Shopping Cart ({cart.length})</h3>
					{cart.map((item, index) => (
						<div key={index} className="flex items-center justify-between py-2">
							<span>{item.name} - ${item.price}</span>
							<button
								onClick={() => removeFromCart(index)}
								className="text-red-400 hover:text-red-300"
							>
								Remove
							</button>
						</div>
					))}
					<button
						onClick={handleCheckout}
						className="mt-4 w-full px-6 py-2 bg-[#E91E63] rounded-lg font-medium"
					>
						Checkout
					</button>
				</div>
			)}

			{/* Equipment Grid */}
			{loading ? (
				<div className="text-center py-12">Loading equipment...</div>
			) : equipment.length === 0 ? (
				<div className="text-center py-12 text-pink-100/70">No equipment found</div>
			) : (
				<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
					{equipment.map((item) => (
						<div
							key={item.id}
							className="rounded-xl border border-[#F6D6E3] bg-[#131326] hover:border-[#E91E63] transition-colors overflow-hidden flex flex-col"
						>
							{item.image ? (
								<div className="h-48 w-full overflow-hidden bg-black/20">
									<img src={item.image} alt={item.name} className="w-full h-full object-cover" />
								</div>
							) : (
								<div className="h-48 w-full bg-pink-600/10 flex items-center justify-center">
									<svg className="w-12 h-12 text-pink-600/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
									</svg>
								</div>
							)}
							<div className="p-6 flex-1 flex flex-col">
								<div className="mb-4">
									<h3 className="text-lg font-bold mb-2">{item.name}</h3>
									{item.brand && <p className="text-sm text-pink-100/70 mb-1">Brand: {item.brand}</p>}
									{item.model_number && (
										<p className="text-sm text-pink-100/70 mb-1">Model: {item.model_number}</p>
									)}
									<p className="text-sm text-pink-100/70 mb-2">{item.equipment_type.replace("_", " ")}</p>
									{item.description && (
										<p className="text-sm text-pink-100/60 mb-2 line-clamp-2">{item.description}</p>
									)}
									{item.specifications && (
										<p className="text-xs text-pink-100/50 mb-2 line-clamp-2">{item.specifications}</p>
									)}
								</div>
								<div className="flex items-center justify-between mb-4">
									<div>
										<p className="text-2xl font-bold text-[#E91E63]">${item.price}</p>
										<p className="text-xs text-pink-100/70">Stock: {item.quantity_available}</p>
										<p className="text-xs text-pink-100/70">Warranty: {item.warranty_period_months} months</p>
									</div>
								</div>
								<div className="mb-2">
									{item.is_new ? (
										<span className="text-xs bg-green-600/20 text-green-400 px-2 py-1 rounded">New</span>
									) : (
										<span className="text-xs bg-yellow-600/20 text-yellow-400 px-2 py-1 rounded">Used</span>
									)}
								</div>
								{isSupplier ? (
									<div className="flex flex-col gap-4 mt-2">
										<div className="flex items-center justify-between bg-[#1A1A2E] p-3 rounded-lg border border-[#F6D6E3]/20">
											<span className="text-xs font-medium text-pink-100/70">Manage Stock:</span>
											<div className="flex items-center gap-3">
												<button
													onClick={() => handleUpdateStock(item.id, item.quantity_available - 1)}
													disabled={item.quantity_available <= 0}
													className="w-8 h-8 flex items-center justify-center bg-red-600/20 text-red-400 rounded hover:bg-red-600/30 disabled:opacity-30"
												>
													-
												</button>
												<span className="w-8 text-center font-bold text-[#E91E63]">{item.quantity_available}</span>
												<button
													onClick={() => handleUpdateStock(item.id, item.quantity_available + 1)}
													className="w-8 h-8 flex items-center justify-center bg-green-600/20 text-green-400 rounded hover:bg-green-600/30"
												>
													+
												</button>
											</div>
										</div>
										<div className="flex items-center justify-between">
											<div className="text-xs text-pink-100/70">SKU: {item.sku}</div>
											<button
												onClick={() => handleDeleteEquipment(item.id)}
												className="text-xs bg-red-600/20 text-red-400 px-3 py-1.5 rounded hover:bg-red-600/30 transition-colors"
											>
												Delete
											</button>
										</div>
									</div>
								) : (
									<button
										onClick={() => addToCart(item)}
										disabled={item.quantity_available === 0}
										className="w-full px-4 py-2 bg-[#E91E63] rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
									>
										{item.quantity_available === 0 ? "Out of Stock" : "Add to Cart"}
									</button>
								)}
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	)
}
