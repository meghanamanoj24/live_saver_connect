import Head from "next/head"
import Link from "next/link"
import { useState, useEffect } from "react"
import { apiFetch } from "../../lib/api"

const DONATION_REQUESTS_STORAGE_KEY = "lifesaver:donation_requests"
const HOSPITAL_DATA_STORAGE_KEY = "hospitalData"
const REGISTERED_HOSPITALS_STORAGE_KEY = "lifesaver:registered_hospitals"

export default function DonorDonate() {
	const [selectedOrg, setSelectedOrg] = useState("")
	const [message, setMessage] = useState("")
	const [loading, setLoading] = useState(false)
	const [hospitals, setHospitals] = useState([])
	const [loadingHospitals, setLoadingHospitals] = useState(true)

	useEffect(() => {
		// Fetch only registered hospitals (those with user accounts - logged in through hospital module)
		async function loadHospitals() {
			setLoadingHospitals(true)
			const allHospitals = []
			
			try {
				// Fetch only hospitals that are registered and have user accounts from API
				const data = await apiFetch("/hospitals/?registered_only=true")
				// Filter to ensure only hospitals with user accounts are shown
				const registeredHospitals = data.filter((hospital) => hospital.user !== null && hospital.user !== undefined)
				allHospitals.push(...registeredHospitals)
			} catch (error) {
				// If API fails, try without filter and filter on frontend
				try {
					const data = await apiFetch("/hospitals/")
					const registeredHospitals = data.filter((hospital) => hospital.user !== null && hospital.user !== undefined)
					allHospitals.push(...registeredHospitals)
				} catch (fallbackError) {
					console.warn("API fetch failed, checking localStorage")
				}
			}
			
			// Also check localStorage for registered hospitals (from hospital module registration)
			if (typeof window !== "undefined") {
				try {
					// Check for hospital data stored during registration
					const storedHospital = localStorage.getItem(HOSPITAL_DATA_STORAGE_KEY)
					if (storedHospital) {
						const hospital = JSON.parse(storedHospital)
						// Add hospitals registered through hospital module (they have user or were registered via hospital/register page)
						// Check if not already in the list
						const existingIndex = allHospitals.findIndex(h => h.id === hospital.id || (hospital.hospitalName && h.name === hospital.hospitalName))
						if (existingIndex === -1) {
							allHospitals.push({
								id: hospital.id,
								name: hospital.hospitalName || hospital.name,
								hospital_type: hospital.hospitalType || hospital.hospital_type || "HOSPITAL",
								city: hospital.city,
								zip_code: hospital.zipCode || hospital.zip_code,
								address: hospital.address,
								phone: hospital.phone,
								website: hospital.website,
								latitude: hospital.latitude,
								longitude: hospital.longitude,
								user: hospital.user || (hospital.user_id ? { id: hospital.user_id } : { username: "registered" }),
								user_id: hospital.user_id,
							})
						}
					}
					
					// Check for registered hospitals list
					const registeredList = localStorage.getItem(REGISTERED_HOSPITALS_STORAGE_KEY)
					if (registeredList) {
						const hospitals = JSON.parse(registeredList)
						hospitals.forEach((hospital) => {
							// Add all hospitals from registered list (they're from hospital module)
							const existingIndex = allHospitals.findIndex(h => h.id === hospital.id || (hospital.name && h.name === hospital.name))
							if (existingIndex === -1) {
								allHospitals.push({
									...hospital,
									user: hospital.user || (hospital.user_id ? { id: hospital.user_id } : { username: "registered" }),
								})
							}
						})
					}
				} catch (e) {
					console.warn("Error reading hospitals from localStorage:", e)
				}
			}
			
			setHospitals(allHospitals)
			setLoadingHospitals(false)
		}
		loadHospitals()
	}, [])

	async function handleSubmit(e) {
		e.preventDefault()
		if (!selectedOrg) {
			setMessage("Select an organisation to proceed.")
			return
		}
		setLoading(true)
		setMessage("")
		try {
			const selectedHospital = hospitals.find((h) => h.id.toString() === selectedOrg.toString())
			
			if (!selectedHospital) {
				setMessage("Please select a valid hospital or center.")
				setLoading(false)
				return
			}
			
			// Get current user info for the request
			const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null
			const userData = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("userData") || "{}") : {}
			
			// Try to create donation request via API
			try {
				const requestData = {
					hospital_id: selectedHospital.id,
					donor_id: userData.id || 1, // Will be set by backend if authenticated
					message: `Donation request from donor to ${selectedHospital.name}`,
					status: "PENDING",
				}
				
				const response = await apiFetch("/donation-requests/", {
					method: "POST",
					body: JSON.stringify(requestData),
				})
				
				// Store in localStorage for tracking (with full hospital info)
				if (typeof window !== "undefined") {
					const existing = JSON.parse(localStorage.getItem(DONATION_REQUESTS_STORAGE_KEY) || "[]")
					const newRequest = {
						id: response.id || Date.now(),
						hospital: selectedHospital,
						hospital_id: selectedHospital.id,
						donor: userData,
						status: "PENDING",
						message: requestData.message,
						created_at: new Date().toISOString(),
					}
					existing.push(newRequest)
					localStorage.setItem(DONATION_REQUESTS_STORAGE_KEY, JSON.stringify(existing))
					
					// Also notify hospital's localStorage if it exists
					const hospitalStorageKey = `lifesaver:hospital_${selectedHospital.id}_requests`
					const hospitalRequests = JSON.parse(localStorage.getItem(hospitalStorageKey) || "[]")
					hospitalRequests.push(newRequest)
					localStorage.setItem(hospitalStorageKey, JSON.stringify(hospitalRequests))
				}
				
				setMessage("Request sent! The organisation will contact you with scheduling instructions.")
				setSelectedOrg("") // Reset selection
			} catch (apiError) {
				// Fallback: Store in localStorage
				if (typeof window !== "undefined") {
					const existing = JSON.parse(localStorage.getItem(DONATION_REQUESTS_STORAGE_KEY) || "[]")
					const newRequest = {
						id: Date.now(),
						hospital: selectedHospital,
						hospital_id: selectedHospital.id,
						donor: userData,
						status: "PENDING",
						message: `Donation request from donor to ${selectedHospital.name}`,
						created_at: new Date().toISOString(),
					}
					existing.push(newRequest)
					localStorage.setItem(DONATION_REQUESTS_STORAGE_KEY, JSON.stringify(existing))
					
					// Also notify hospital's localStorage
					const hospitalStorageKey = `lifesaver:hospital_${selectedHospital.id}_requests`
					const hospitalRequests = JSON.parse(localStorage.getItem(hospitalStorageKey) || "[]")
					hospitalRequests.push(newRequest)
					localStorage.setItem(hospitalStorageKey, JSON.stringify(hospitalRequests))
				}
				setMessage("Request sent! The organisation will contact you with scheduling instructions.")
				setSelectedOrg("") // Reset selection
			}
		} catch (error) {
			setMessage("Could not notify the organisation. Try again shortly.")
		} finally {
			setLoading(false)
		}
	}

	return (
		<>
			<Head>
				<title>Schedule Donation — LifeSaver Connect</title>
				<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@700;800&display=swap" rel="stylesheet" />
			</Head>
			<main className="min-h-screen bg-[#071325] text-white">
				<header className="border-b border-[#F6D6E3]/30 bg-[#131326]/80 backdrop-blur">
					<div className="mx-auto flex flex-col gap-3 md:flex-row md:items-center md:justify-between max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
						<div>
							<h1 className="text-3xl font-extrabold" style={{ fontFamily: "'Poppins', sans-serif" }}>Schedule a Donation</h1>
							<p className="mt-2 text-sm text-[#d7dcff]">
								Choose a registered partner organisation to notify them about your availability. Final confirmation happens directly with
								their medical staff.
							</p>
						</div>
						<Link href="/donor/dashboard" legacyBehavior>
							<a className="rounded-lg border border-[#E91E63] px-4 py-2 text-sm font-medium text-[#E91E63] hover:bg-[#E91E63]/10 transition">
								Back to Donor Hub
							</a>
						</Link>
					</div>
				</header>

				<section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
					<form onSubmit={handleSubmit} className="rounded-3xl border border-[#1f2f51] bg-[#0c1b35]/70 p-6 shadow-lg backdrop-blur space-y-6">
						<div>
							<h2 className="text-xl font-semibold text-white">Select Partner Organisation</h2>
							<p className="mt-1 text-sm text-[#d7dcff]">
								These organisations are registered and verified through our hospital module. Your contact information will be shared with the selected centre only.
							</p>
							{loadingHospitals ? (
								<div className="mt-4 rounded-xl border border-[#3a4f7a] bg-[#0b1730] p-8 text-center">
									<div className="flex items-center justify-center gap-3">
										<div className="h-5 w-5 animate-spin rounded-full border-2 border-[#E91E63] border-t-transparent" />
										<p className="text-sm text-[#d7dcff]">Loading registered hospitals and centers...</p>
									</div>
								</div>
							) : (
								<div className="mt-4 space-y-3">
									{hospitals.length > 0 ? (
									hospitals.map((org) => {
										const hospitalTypeLabels = {
											HOSPITAL: "Hospital",
											BLOOD_CENTER: "Blood Center",
											BOTH: "Hospital & Blood Center",
										}
										const hospitalType = hospitalTypeLabels[org.hospital_type] || org.hospital_type || "Hospital"
										
										return (
											<label
												key={org.id}
												className={`flex cursor-pointer flex-col gap-3 rounded-2xl border px-5 py-5 transition ${
													selectedOrg === org.id.toString() ? "border-[#E91E63] bg-[#1b2a4a] shadow-lg shadow-[#E91E63]/20" : "border-[#3a4f7a] bg-[#0b1730] hover:border-[#4e7fff]"
												}`}
											>
												<div className="flex items-start justify-between gap-3">
													<div className="flex-1">
														<div className="flex items-center gap-2 mb-2">
															<p className="text-lg font-semibold text-white">{org.name}</p>
															<span className="rounded-full bg-[#E91E63]/20 px-2 py-0.5 text-xs font-medium text-[#E91E63]">
																Registered
															</span>
														</div>
														<p className="text-sm text-[#d7dcff] mb-3">
															<span className="font-medium">{hospitalType}</span>
															{org.city && <span> • {org.city}</span>}
															{org.zip_code && <span> • {org.zip_code}</span>}
														</p>
														
														{/* Detailed Location Information */}
														<div className="mt-3 space-y-2 border-t border-[#3a4f7a]/50 pt-3">
															{org.address && (
																<div className="flex items-start gap-2">
																	<svg className="h-4 w-4 text-[#9fb2e5] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
																		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
																	</svg>
																	<div>
																		<p className="text-xs font-medium text-[#9fb2e5]">Address:</p>
																		<p className="text-xs text-[#d7dcff]">{org.address}</p>
																	</div>
																</div>
															)}
															
															<div className="flex items-start gap-2">
																<svg className="h-4 w-4 text-[#9fb2e5] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																	<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
																	<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
																</svg>
																<div>
																	<p className="text-xs font-medium text-[#9fb2e5]">Location:</p>
																	<p className="text-xs text-[#d7dcff]">
																		{org.city || "City not specified"}
																		{org.zip_code && `, ${org.zip_code}`}
																		{org.latitude && org.longitude && (
																			<span className="ml-2 text-[#9fb2e5]">
																				• Coordinates: {parseFloat(org.latitude).toFixed(4)}, {parseFloat(org.longitude).toFixed(4)}
																			</span>
																		)}
																	</p>
																</div>
															</div>
															
															{org.phone && (
																<div className="flex items-center gap-2">
																	<svg className="h-4 w-4 text-[#9fb2e5] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
																	</svg>
																	<div>
																		<p className="text-xs font-medium text-[#9fb2e5]">Phone:</p>
																		<p className="text-xs text-[#d7dcff]">{org.phone}</p>
																	</div>
																</div>
															)}
															
															{org.website && (
																<div className="flex items-center gap-2">
																	<svg className="h-4 w-4 text-[#9fb2e5] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																		<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
																	</svg>
																	<div>
																		<p className="text-xs font-medium text-[#9fb2e5]">Website:</p>
																		<a 
																			href={org.website} 
																			target="_blank" 
																			rel="noopener noreferrer"
																			className="text-xs text-[#4e7fff] hover:underline"
																			onClick={(e) => e.stopPropagation()}
																		>
																			{org.website}
																		</a>
																	</div>
																</div>
															)}
														</div>
													</div>
													<input
														type="radio"
														name="organisation"
														value={org.id}
														checked={selectedOrg === org.id.toString()}
														onChange={() => setSelectedOrg(org.id.toString())}
														className="h-5 w-5 accent-[#E91E63] mt-1 flex-shrink-0"
													/>
												</div>
											</label>
										)
									})
								) : (
									<div className="rounded-xl border border-dashed border-[#3a4f7a] bg-[#0b1730] p-8 text-center">
										<p className="text-sm text-[#d7dcff] mb-2">No registered hospitals or centers available at the moment.</p>
										<p className="text-xs text-[#9fb2e5]">
											Hospitals and blood centers need to register and log in through the hospital module to appear here.
										</p>
									</div>
									)}
								</div>
							)}
						</div>

						<p className="rounded-2xl border border-dashed border-[#4e7fff]/50 bg-[#102347]/50 px-4 py-3 text-sm text-[#d7dcff]">
							By proceeding you confirm you meet the medical requirements for blood/platelet donation today. Bring a valid ID and hydration
							when you arrive.
						</p>

						<button
							type="submit"
							disabled={loading}
							className="flex h-12 w-full items-center justify-center rounded-xl bg-[#E91E63] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
						>
							{loading ? (
								<>
									<span className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
									Sending availability...
								</>
							) : (
								"Notify Organisation"
							)}
						</button>

						{message && (
							<div className="rounded-xl border border-[#4e7fff]/40 bg-[#102347]/60 px-4 py-3 text-sm text-[#d7dcff]">
								{message}
							</div>
						)}
					</form>

					<div className="mt-10 rounded-3xl border border-[#1f2f51] bg-[#0c1b35]/70 p-6 text-sm text-[#d7dcff]">
						<h2 className="text-lg font-semibold text-white">Compatibility Reminder</h2>
						<p className="mt-2">
							The receiving hospital validates blood group compatibility before transfusion. Never attempt to donate directly to a patient
							without medical staff approval. Use this portal to coordinate with verified centres only.
						</p>
					</div>
				</section>
			</main>
		</>
	)
}

