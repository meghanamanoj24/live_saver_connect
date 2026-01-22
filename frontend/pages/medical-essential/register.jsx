import Head from "next/head"
import { useRouter } from "next/router"
import { useState } from "react"
import { apiFetch } from "../../lib/api"
import { validateEmail, validatePhone, validateZipCode } from "../../lib/validation"

export default function MedicalEssentialRegister() {
	const router = useRouter()
	const [formData, setFormData] = useState({
		company_name: "",
		business_type: "SUPPLIER",
		contact_person: "",
		phone: "",
		email: "",
		address: "",
		city: "",
		zip_code: "",
		license_number: "",
		tax_id: "",
	})
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState("")

	async function handleSubmit(e) {
		e.preventDefault()
		setError("")

		if (!formData.company_name || formData.company_name.length < 3) {
			setError("Please enter a valid company name (min 3 characters).")
			return
		}

		if (!formData.contact_person || formData.contact_person.length < 2) {
			setError("Please enter a valid contact person name.")
			return
		}

		if (!validateEmail(formData.email)) {
			setError("Please enter a valid email address.")
			return
		}

		if (!validatePhone(formData.phone)) {
			setError("Please enter a valid 10-15 digit phone number.")
			return
		}

		if (formData.zip_code && !validateZipCode(formData.zip_code)) {
			setError("Please enter a valid zip code (5-6 digits).")
			return
		}

		setLoading(true)

		try {
			// Ensure user is logged in (token required for authenticated API call)
			const token = localStorage.getItem("accessToken")
			if (!token) {
				throw new Error("Please login first")
			}

			// Use the authenticated "me" endpoint so we don't create duplicate profiles
			await apiFetch("/medical-essential/me/", {
				method: "PATCH", // creates if missing via view logic, updates otherwise
				body: JSON.stringify({
					...formData,
				}),
			})

			router.push("/medical-essential")
		} catch (err) {
			setError(err.message || "Failed to create profile")
		} finally {
			setLoading(false)
		}
	}

	return (
		<>
			<Head>
				<title>Complete Medical Essential Profile — LifeSaver Connect</title>
				<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@700;800&display=swap" rel="stylesheet" />
			</Head>

			<main className="min-h-screen bg-[#1A1A2E] text-white">
				<div className="max-w-2xl mx-auto px-4 py-12">
					<h1 className="text-3xl md:text-4xl font-extrabold mb-2" style={{ fontFamily: "'Poppins', sans-serif" }}>
						Complete Your Profile
					</h1>
					<p className="text-sm text-pink-100/90 mb-8">Set up your Medical Essential supplier account</p>

					<form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-[#F6D6E3] p-6">
						{error && (
							<div className="rounded-lg border border-red-600/60 bg-red-600/10 px-4 py-3 text-sm text-red-300">
								{error}
							</div>
						)}

						<div>
							<label className="block text-sm font-medium mb-2">Company Name *</label>
							<input
								type="text"
								required
								value={formData.company_name}
								onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
								className="inputStyle"
								placeholder="Your company name"
							/>
						</div>

						<div>
							<label className="block text-sm font-medium mb-2">Business Type *</label>
							<select
								value={formData.business_type}
								onChange={(e) => setFormData({ ...formData, business_type: e.target.value })}
								className="inputStyle"
							>
								<option value="SUPPLIER">Medical Supplier</option>
								<option value="DISTRIBUTOR">Distributor</option>
								<option value="RETAILER">Retailer</option>
								<option value="MANUFACTURER">Manufacturer</option>
								<option value="OTHER">Other</option>
							</select>
						</div>

						<div>
							<label className="block text-sm font-medium mb-2">Contact Person *</label>
							<input
								type="text"
								required
								value={formData.contact_person}
								onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
								className="inputStyle"
								placeholder="Full name"
							/>
						</div>

						<div className="grid gap-4 sm:grid-cols-2">
							<div>
								<label className="block text-sm font-medium mb-2">Phone *</label>
								<input
									type="tel"
									required
									value={formData.phone}
									onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
									className="inputStyle"
									placeholder="+1234567890"
								/>
							</div>
							<div>
								<label className="block text-sm font-medium mb-2">Email *</label>
								<input
									type="email"
									required
									value={formData.email}
									onChange={(e) => setFormData({ ...formData, email: e.target.value })}
									className="inputStyle"
									placeholder="contact@company.com"
								/>
							</div>
						</div>

						<div>
							<label className="block text-sm font-medium mb-2">Address *</label>
							<textarea
								required
								value={formData.address}
								onChange={(e) => setFormData({ ...formData, address: e.target.value })}
								className="inputStyle"
								rows="3"
								placeholder="Street address"
							/>
						</div>

						<div className="grid gap-4 sm:grid-cols-2">
							<div>
								<label className="block text-sm font-medium mb-2">City *</label>
								<input
									type="text"
									required
									value={formData.city}
									onChange={(e) => setFormData({ ...formData, city: e.target.value })}
									className="inputStyle"
									placeholder="City"
								/>
							</div>
							<div>
								<label className="block text-sm font-medium mb-2">Zip Code</label>
								<input
									type="text"
									value={formData.zip_code}
									onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
									className="inputStyle"
									placeholder="12345"
								/>
							</div>
						</div>

						<div className="grid gap-4 sm:grid-cols-2">
							<div>
								<label className="block text-sm font-medium mb-2">License Number</label>
								<input
									type="text"
									value={formData.license_number}
									onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
									className="inputStyle"
									placeholder="Business license"
								/>
							</div>
							<div>
								<label className="block text-sm font-medium mb-2">Tax ID</label>
								<input
									type="text"
									value={formData.tax_id}
									onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
									className="inputStyle"
									placeholder="Tax ID"
								/>
							</div>
						</div>

						<button
							type="submit"
							disabled={loading}
							className="h-12 w-full rounded-xl bg-[#E91E63] font-semibold disabled:opacity-50"
						>
							{loading ? "Creating Profile..." : "Create Profile"}
						</button>
					</form>
				</div>

				<style jsx>{`
					.inputStyle {
						width: 100%;
						border-radius: 8px;
						border: 1px solid #F6D6E3;
						background: #131326;
						padding: 12px;
						font-size: 14px;
						color: white;
					}
				`}</style>
			</main>
		</>
	)
}
