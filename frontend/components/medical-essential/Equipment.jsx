import { useState, useEffect } from "react"
import { apiFetch } from "../../lib/api"

export default function Equipment({ profile }) {
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
			setEquipment(data.results || data)
		} catch (err) {
			console.error("Failed to load equipment:", err)
		} finally {
			setLoading(false)
		}
	}

	async function handleAddEquipment(e) {
		e.preventDefault()
		try {
			await apiFetch("/medical-equipment/", {
				method: "POST",
				body: JSON.stringify({
					...newEquipment,
					supplier_id: profile.id,
					price: parseFloat(newEquipment.price),
					quantity_available: parseInt(newEquipment.quantity_available),
					warranty_period_months: parseInt(newEquipment.warranty_period_months),
				}),
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
			})
			loadEquipment()
		} catch (err) {
			alert(err.message || "Failed to add equipment")
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

		try {
			const shippingAddress = prompt("Enter shipping address:")
			const shippingCity = prompt("Enter shipping city:")
			const contactPhone = prompt("Enter contact phone:")

			if (!shippingAddress || !shippingCity || !contactPhone) {
				return
			}

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
			alert("Order placed successfully!")
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
							required
							placeholder="SKU"
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
							className="p-6 rounded-xl border border-[#F6D6E3] bg-[#131326] hover:border-[#E91E63] transition-colors"
						>
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
								<div className="text-xs text-pink-100/70">SKU: {item.sku}</div>
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
					))}
				</div>
			)}
		</div>
	)
}
