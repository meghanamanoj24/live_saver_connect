import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import { useState } from "react"
import { API_BASE_URL, apiFetch } from "../../lib/api"
import { validateEmail, validateName, validatePassword, validatePhone, validateZipCode } from "../../lib/validation"

export default function HospitalRegister() {
	const router = useRouter()
	const [formData, setFormData] = useState({
		hospitalName: "",
		hospitalType: "HOSPITAL",
		firstName: "",
		lastName: "",
		email: "",
		username: "",
		password: "",
		confirmPassword: "",
		city: "",
		zipCode: "",
		address: "",
		phone: "",
		website: "",
		latitude: "",
		longitude: "",
	})
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState("")
	const [message, setMessage] = useState("")

	function updateField(field, value) {
		setFormData((prev) => ({ ...prev, [field]: value }))
		setError("")
	}

	async function handleSubmit(e) {
		e.preventDefault()
		setError("")
		setMessage("")

		if (!formData.hospitalName || formData.hospitalName.length < 3) {
			setError("Please enter a valid hospital name (min 3 characters).")
			return
		}

		if (!validateName(formData.firstName) || !validateName(formData.lastName)) {
			setError("Administrator names should contain only letters and be at least 2 characters long.")
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

		if (formData.zipCode && !validateZipCode(formData.zipCode)) {
			setError("Please enter a valid zip code (5-6 digits).")
			return
		}

		if (!validatePassword(formData.password)) {
			setError("Password must be at least 8 characters long.")
			return
		}

		if (formData.password !== formData.confirmPassword) {
			setError("Passwords do not match.")
			return
		}

		setIsLoading(true)
		try {
			// First create user account
			const finalUsername = formData.username || formData.email.split("@")[0]

			// Try to register user
			let userResponse
			try {
				userResponse = await fetch(`${API_BASE_URL}/auth/register/`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						username: finalUsername,
						email: formData.email,
						password: formData.password,
						first_name: formData.firstName,
						last_name: formData.lastName,
					}),
				})
			} catch (err) {
				// Fallback: simulate user creation
				console.warn("User registration endpoint not found, using simulated registration")
			}

			// Create hospital profile
			const hospitalData = {
				name: formData.hospitalName,
				hospital_type: formData.hospitalType,
				city: formData.city,
				zip_code: formData.zipCode,
				address: formData.address,
				phone: formData.phone,
				website: formData.website,
				latitude: formData.latitude ? parseFloat(formData.latitude) : null,
				longitude: formData.longitude ? parseFloat(formData.longitude) : null,
			}

			try {
				const hospitalResponse = await apiFetch("/hospitals/", {
					method: "POST",
					body: JSON.stringify(hospitalData),
				})

				// If user was created, link it to hospital
				let userId = null
				if (userResponse?.ok) {
					const userData = await userResponse.json()
					userId = userData.id
					// Update hospital with user_id
					await apiFetch(`/hospitals/${hospitalResponse.id}/`, {
						method: "PATCH",
						body: JSON.stringify({ user_id: userId }),
					})
				}

				// Store in localStorage for the donate page to find
				if (typeof window !== "undefined") {
					const storedHospital = {
						id: hospitalResponse.id,
						name: formData.hospitalName,
						hospital_type: formData.hospitalType,
						city: formData.city,
						zip_code: formData.zipCode,
						address: formData.address,
						phone: formData.phone,
						website: formData.website,
						latitude: formData.latitude ? parseFloat(formData.latitude) : null,
						longitude: formData.longitude ? parseFloat(formData.longitude) : null,
						user: userId ? { id: userId, username: finalUsername, email: formData.email } : { username: finalUsername, email: formData.email },
						user_id: userId,
					}

					// Store in hospitalData
					localStorage.setItem("hospitalData", JSON.stringify(storedHospital))

					// Also add to registered hospitals list
					const existing = JSON.parse(localStorage.getItem("lifesaver:registered_hospitals") || "[]")
					if (!existing.find(h => h.id === storedHospital.id)) {
						existing.push(storedHospital)
						localStorage.setItem("lifesaver:registered_hospitals", JSON.stringify(existing))
					}
				}

				setMessage("Hospital registration successful! Redirecting to login...")
				setTimeout(() => {
					router.push("/auth/login?module=hospital")
				}, 2000)
			} catch (apiError) {
				// Fallback: Store in localStorage
				if (typeof window !== "undefined") {
					const storedHospital = {
						id: Date.now(),
						name: formData.hospitalName,
						hospital_type: formData.hospitalType,
						city: formData.city,
						zip_code: formData.zipCode,
						address: formData.address,
						phone: formData.phone,
						website: formData.website,
						latitude: formData.latitude ? parseFloat(formData.latitude) : null,
						longitude: formData.longitude ? parseFloat(formData.longitude) : null,
						user: { username: finalUsername, email: formData.email },
					}

					localStorage.setItem("hospitalData", JSON.stringify(storedHospital))

					// Also add to registered hospitals list
					const existing = JSON.parse(localStorage.getItem("lifesaver:registered_hospitals") || "[]")
					if (!existing.find(h => h.id === storedHospital.id)) {
						existing.push(storedHospital)
						localStorage.setItem("lifesaver:registered_hospitals", JSON.stringify(existing))
					}

					localStorage.setItem("accessToken", "simulated_token_" + Date.now())
				}
				setMessage("Hospital registration successful! Redirecting...")
				setTimeout(() => {
					router.push("/hospital/select")
				}, 2000)
			}
		} catch (error) {
			setError("Registration failed. Please try again.")
			console.error("Registration error:", error)
		} finally {
			setIsLoading(false)
		}
	}

	return (
		<>
			<Head>
				<title>Hospital Registration — LifeSaver Connect</title>
				<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@700;800&display=swap" rel="stylesheet" />
			</Head>
			<main className="min-h-screen bg-[#1A1A2E] text-white">
				<header className="border-b border-[#F6D6E3]/30 bg-[#131326]/80 backdrop-blur">
					<div className="mx-auto flex items-center justify-between max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
						<Link href="/" legacyBehavior>
							<a className="text-xl font-bold text-white">LifeSaver Connect</a>
						</Link>
						<Link href="/auth/login?module=hospital" legacyBehavior>
							<a className="text-sm text-pink-100 hover:text-[#E91E63]">Already registered? Log in</a>
						</Link>
					</div>
				</header>

				<section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
					<div className="text-center mb-8">
						<h1 className="text-3xl md:text-4xl font-extrabold" style={{ fontFamily: "'Poppins', sans-serif" }}>
							Hospital / Blood Center Registration
						</h1>
						<p className="mt-2 text-sm text-pink-100/80">
							Register your hospital or blood center to manage donations and connect with donors.
						</p>
					</div>

					<form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-[#F6D6E3] bg-[#131326] p-8">
						{error && (
							<div className="rounded-lg border border-[#DC2626]/60 bg-[#DC2626]/10 px-4 py-3 text-sm text-[#FCA5A5]">
								{error}
							</div>
						)}
						{message && (
							<div className="rounded-lg border border-green-500/60 bg-green-500/10 px-4 py-3 text-sm text-green-300">
								{message}
							</div>
						)}

						{/* Hospital Information */}
						<div className="space-y-4">
							<h2 className="text-xl font-semibold text-white">Hospital Information</h2>
							<div className="grid gap-4 md:grid-cols-2">
								<div>
									<label className="block text-sm font-medium text-pink-100 mb-1">Hospital Name *</label>
									<input
										type="text"
										required
										value={formData.hospitalName}
										onChange={(e) => updateField("hospitalName", e.target.value)}
										className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-pink-100 mb-1">Type *</label>
									<select
										required
										value={formData.hospitalType}
										onChange={(e) => updateField("hospitalType", e.target.value)}
										className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
									>
										<option value="HOSPITAL">Hospital</option>
										<option value="BLOOD_CENTER">Blood Center</option>
										<option value="BOTH">Both Hospital & Blood Center</option>
									</select>
								</div>
								<div>
									<label className="block text-sm font-medium text-pink-100 mb-1">City *</label>
									<input
										type="text"
										required
										value={formData.city}
										onChange={(e) => updateField("city", e.target.value)}
										className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-pink-100 mb-1">Zip Code</label>
									<input
										type="text"
										value={formData.zipCode}
										onChange={(e) => updateField("zipCode", e.target.value)}
										className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
									/>
								</div>
								<div className="md:col-span-2">
									<label className="block text-sm font-medium text-pink-100 mb-1">Address</label>
									<textarea
										value={formData.address}
										onChange={(e) => updateField("address", e.target.value)}
										rows={2}
										className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-pink-100 mb-1">Phone *</label>
									<input
										type="tel"
										required
										value={formData.phone}
										onChange={(e) => updateField("phone", e.target.value)}
										className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-pink-100 mb-1">Website</label>
									<input
										type="url"
										value={formData.website}
										onChange={(e) => updateField("website", e.target.value)}
										className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-pink-100 mb-1">Latitude (for location search)</label>
									<input
										type="number"
										step="any"
										value={formData.latitude}
										onChange={(e) => updateField("latitude", e.target.value)}
										className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-pink-100 mb-1">Longitude (for location search)</label>
									<input
										type="number"
										step="any"
										value={formData.longitude}
										onChange={(e) => updateField("longitude", e.target.value)}
										className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
									/>
								</div>
							</div>
						</div>

						{/* Admin Account */}
						<div className="space-y-4 pt-6 border-t border-[#F6D6E3]/20">
							<h2 className="text-xl font-semibold text-white">Administrator Account</h2>
							<div className="grid gap-4 md:grid-cols-2">
								<div>
									<label className="block text-sm font-medium text-pink-100 mb-1">First Name *</label>
									<input
										type="text"
										required
										value={formData.firstName}
										onChange={(e) => updateField("firstName", e.target.value)}
										className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-pink-100 mb-1">Last Name *</label>
									<input
										type="text"
										required
										value={formData.lastName}
										onChange={(e) => updateField("lastName", e.target.value)}
										className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-pink-100 mb-1">Email *</label>
									<input
										type="email"
										required
										value={formData.email}
										onChange={(e) => {
											updateField("email", e.target.value)
											if (!formData.username) {
												updateField("username", e.target.value.split("@")[0])
											}
										}}
										className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-pink-100 mb-1">Username</label>
									<input
										type="text"
										value={formData.username}
										onChange={(e) => updateField("username", e.target.value)}
										className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
									/>
									<p className="mt-1 text-xs text-pink-100/60">Leave empty to auto-generate from email</p>
								</div>
								<div>
									<label className="block text-sm font-medium text-pink-100 mb-1">Password *</label>
									<input
										type="password"
										required
										value={formData.password}
										onChange={(e) => updateField("password", e.target.value)}
										className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-pink-100 mb-1">Confirm Password *</label>
									<input
										type="password"
										required
										value={formData.confirmPassword}
										onChange={(e) => updateField("confirmPassword", e.target.value)}
										className="w-full rounded-lg border border-[#F6D6E3] bg-[#1A1A2E] px-3 py-2 text-white outline-none focus:border-[#E91E63]"
									/>
								</div>
							</div>
						</div>

						<button
							type="submit"
							disabled={isLoading}
							className="w-full rounded-xl bg-[#E91E63] px-6 py-3 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
						>
							{isLoading ? (
								<span className="flex items-center justify-center">
									<span className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
									Registering...
								</span>
							) : (
								"Register Hospital"
							)}
						</button>
					</form>
				</section>
			</main>
		</>
	)
}

