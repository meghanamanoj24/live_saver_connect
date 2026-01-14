import { useState } from "react"
import { apiFetch } from "../../lib/api"

export default function Profile({ profile, onUpdate }) {
	const [formData, setFormData] = useState(profile || {})
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState("")
	const [success, setSuccess] = useState("")

	async function handleSubmit(e) {
		e.preventDefault()
		setError("")
		setSuccess("")
		setLoading(true)

		try {
			await apiFetch(`/medical-essential/me/`, {
				method: "PATCH",
				body: JSON.stringify(formData),
			})
			setSuccess("Profile updated successfully!")
			if (onUpdate) onUpdate()
		} catch (err) {
			setError(err.message || "Failed to update profile")
		} finally {
			setLoading(false)
		}
	}

	async function handleRegenerateApiKey() {
		if (!confirm("Are you sure you want to regenerate your API key? The old key will no longer work.")) {
			return
		}

		try {
			const data = await apiFetch("/medical-essential/regenerate_api_key/", {
				method: "POST",
			})
			setFormData({ ...formData, api_key: data.api_key })
			setSuccess("API key regenerated successfully!")
		} catch (err) {
			setError(err.message || "Failed to regenerate API key")
		}
	}

	if (!profile) {
		return <div className="text-center py-12">No profile found</div>
	}

	return (
		<div className="max-w-2xl">
			<form onSubmit={handleSubmit} className="space-y-6">
				{error && (
					<div className="rounded-lg border border-red-600/60 bg-red-600/10 px-4 py-3 text-sm text-red-300">
						{error}
					</div>
				)}
				{success && (
					<div className="rounded-lg border border-green-600/60 bg-green-600/10 px-4 py-3 text-sm text-green-300">
						{success}
					</div>
				)}

				<div>
					<label className="block text-sm font-medium mb-2">Company Name *</label>
					<input
						type="text"
						required
						value={formData.company_name || ""}
						onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
						className="w-full px-4 py-2 rounded-lg border border-[#F6D6E3] bg-[#131326] text-white"
					/>
				</div>

				<div>
					<label className="block text-sm font-medium mb-2">Business Type *</label>
					<select
						value={formData.business_type || "SUPPLIER"}
						onChange={(e) => setFormData({ ...formData, business_type: e.target.value })}
						className="w-full px-4 py-2 rounded-lg border border-[#F6D6E3] bg-[#131326] text-white"
					>
						<option value="SUPPLIER">Medical Supplier</option>
						<option value="DISTRIBUTOR">Distributor</option>
						<option value="RETAILER">Retailer</option>
						<option value="MANUFACTURER">Manufacturer</option>
						<option value="OTHER">Other</option>
					</select>
				</div>

				<div className="grid gap-4 md:grid-cols-2">
					<div>
						<label className="block text-sm font-medium mb-2">Contact Person *</label>
						<input
							type="text"
							required
							value={formData.contact_person || ""}
							onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
							className="w-full px-4 py-2 rounded-lg border border-[#F6D6E3] bg-[#131326] text-white"
						/>
					</div>
					<div>
						<label className="block text-sm font-medium mb-2">Phone *</label>
						<input
							type="tel"
							required
							value={formData.phone || ""}
							onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
							className="w-full px-4 py-2 rounded-lg border border-[#F6D6E3] bg-[#131326] text-white"
						/>
					</div>
				</div>

				<div>
					<label className="block text-sm font-medium mb-2">Email *</label>
					<input
						type="email"
						required
						value={formData.email || ""}
						onChange={(e) => setFormData({ ...formData, email: e.target.value })}
						className="w-full px-4 py-2 rounded-lg border border-[#F6D6E3] bg-[#131326] text-white"
					/>
				</div>

				<div>
					<label className="block text-sm font-medium mb-2">Address *</label>
					<textarea
						required
						value={formData.address || ""}
						onChange={(e) => setFormData({ ...formData, address: e.target.value })}
						className="w-full px-4 py-2 rounded-lg border border-[#F6D6E3] bg-[#131326] text-white"
						rows="3"
					/>
				</div>

				<div className="grid gap-4 md:grid-cols-2">
					<div>
						<label className="block text-sm font-medium mb-2">City *</label>
						<input
							type="text"
							required
							value={formData.city || ""}
							onChange={(e) => setFormData({ ...formData, city: e.target.value })}
							className="w-full px-4 py-2 rounded-lg border border-[#F6D6E3] bg-[#131326] text-white"
						/>
					</div>
					<div>
						<label className="block text-sm font-medium mb-2">Zip Code</label>
						<input
							type="text"
							value={formData.zip_code || ""}
							onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
							className="w-full px-4 py-2 rounded-lg border border-[#F6D6E3] bg-[#131326] text-white"
						/>
					</div>
				</div>

				<div className="grid gap-4 md:grid-cols-2">
					<div>
						<label className="block text-sm font-medium mb-2">License Number</label>
						<input
							type="text"
							value={formData.license_number || ""}
							onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
							className="w-full px-4 py-2 rounded-lg border border-[#F6D6E3] bg-[#131326] text-white"
						/>
					</div>
					<div>
						<label className="block text-sm font-medium mb-2">Tax ID</label>
						<input
							type="text"
							value={formData.tax_id || ""}
							onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
							className="w-full px-4 py-2 rounded-lg border border-[#F6D6E3] bg-[#131326] text-white"
						/>
					</div>
				</div>

				{/* API Key Section */}
				<div className="p-4 rounded-lg border border-[#F6D6E3] bg-[#131326]">
					<label className="block text-sm font-medium mb-2">API Key</label>
					<div className="flex items-center gap-2">
						<input
							type="text"
							readOnly
							value={formData.api_key || ""}
							className="flex-1 px-4 py-2 rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] text-white font-mono text-sm"
						/>
						<button
							type="button"
							onClick={handleRegenerateApiKey}
							className="px-4 py-2 bg-yellow-600/20 border border-yellow-600/40 rounded-lg text-yellow-400 hover:bg-yellow-600/30"
						>
							Regenerate
						</button>
					</div>
					<p className="text-xs text-pink-100/70 mt-2">
						Use this API key for programmatic access to your Medical Essential account.
					</p>
				</div>

				<button
					type="submit"
					disabled={loading}
					className="w-full px-6 py-3 bg-[#E91E63] rounded-lg font-medium disabled:opacity-50"
				>
					{loading ? "Updating..." : "Update Profile"}
				</button>
			</form>
		</div>
	)
}
