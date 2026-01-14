import { useState, useEffect } from "react"
import { apiFetch } from "../../lib/api"

export default function MedicalStore({ profile }) {
	const [products, setProducts] = useState([])
	const [loading, setLoading] = useState(true)
	const [showAddForm, setShowAddForm] = useState(false)
	const [cart, setCart] = useState([])
	const [searchTerm, setSearchTerm] = useState("")
	const [categoryFilter, setCategoryFilter] = useState("")

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
			setProducts(data.results || data)
		} catch (err) {
			console.error("Failed to load products:", err)
		} finally {
			setLoading(false)
		}
	}

	async function handleAddProduct(e) {
		e.preventDefault()
		try {
			await apiFetch("/medical-store-products/", {
				method: "POST",
				body: JSON.stringify({
					...newProduct,
					supplier_id: profile.id,
					price: parseFloat(newProduct.price),
					quantity_available: parseInt(newProduct.quantity_available),
					minimum_order_quantity: parseInt(newProduct.minimum_order_quantity),
				}),
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
			})
			loadProducts()
		} catch (err) {
			alert(err.message || "Failed to add product")
		}
	}

	function addToCart(product) {
		setCart([...cart, { ...product, quantity: 1, product_type: "STORE" }])
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
				store_product_id: item.id,
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
						<option value="MEDICINE">Medicines</option>
						<option value="SUPPLIES">Medical Supplies</option>
						<option value="CONSUMABLES">Consumables</option>
						<option value="INSTRUMENTS">Instruments</option>
						<option value="OTHER">Other</option>
					</select>
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
							required
							placeholder="SKU"
							value={newProduct.sku}
							onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
							className="px-4 py-2 rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] text-white"
						/>
						<select
							value={newProduct.category}
							onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
							className="px-4 py-2 rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] text-white"
						>
							<option value="MEDICINE">Medicines</option>
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
						<textarea
							placeholder="Description"
							value={newProduct.description}
							onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
							className="px-4 py-2 rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] text-white md:col-span-2"
							rows="3"
						/>
					</div>
					<div className="mt-4 flex items-center gap-4">
						<label className="flex items-center gap-2">
							<input
								type="checkbox"
								checked={newProduct.is_prescription_required}
								onChange={(e) => setNewProduct({ ...newProduct, is_prescription_required: e.target.checked })}
							/>
							<span>Prescription Required</span>
						</label>
						<button type="submit" className="px-6 py-2 bg-[#E91E63] rounded-lg">
							Add Product
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

			{/* Products Grid */}
			{loading ? (
				<div className="text-center py-12">Loading products...</div>
			) : products.length === 0 ? (
				<div className="text-center py-12 text-pink-100/70">No products found</div>
			) : (
				<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
					{products.map((product) => (
						<div
							key={product.id}
							className="p-6 rounded-xl border border-[#F6D6E3] bg-[#131326] hover:border-[#E91E63] transition-colors"
						>
							<div className="mb-4">
								<h3 className="text-lg font-bold mb-2">{product.name}</h3>
								{product.brand && <p className="text-sm text-pink-100/70 mb-1">Brand: {product.brand}</p>}
								<p className="text-sm text-pink-100/70 mb-2">{product.category}</p>
								{product.description && (
									<p className="text-sm text-pink-100/60 mb-2 line-clamp-2">{product.description}</p>
								)}
							</div>
							<div className="flex items-center justify-between mb-4">
								<div>
									<p className="text-2xl font-bold text-[#E91E63]">${product.price}</p>
									<p className="text-xs text-pink-100/70">
										Stock: {product.quantity_available} {product.unit}
									</p>
								</div>
							</div>
							{product.is_prescription_required && (
								<div className="mb-2 text-xs text-yellow-400">⚠️ Prescription Required</div>
							)}
							{isSupplier ? (
								<div className="text-xs text-pink-100/70">SKU: {product.sku}</div>
							) : (
								<button
									onClick={() => addToCart(product)}
									disabled={product.quantity_available === 0}
									className="w-full px-4 py-2 bg-[#E91E63] rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
								>
									{product.quantity_available === 0 ? "Out of Stock" : "Add to Cart"}
								</button>
							)}
						</div>
					))}
				</div>
			)}
		</div>
	)
}
