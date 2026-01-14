import Head from "next/head"
import Link from "next/link"
import { useEffect, useState } from "react"
import { apiFetch } from "../../lib/api"

export default function PostNeed() {
	const [needs, setNeeds] = useState([])
	const [accidents, setAccidents] = useState([])
	const [accidentProneAreas, setAccidentProneAreas] = useState([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState(null)
	const [showAccidentForm, setShowAccidentForm] = useState(false)
	const [reportingAccident, setReportingAccident] = useState(false)
	const [showCriticalEmergencyForm, setShowCriticalEmergencyForm] = useState(false)
	const [submittingCriticalEmergency, setSubmittingCriticalEmergency] = useState(false)
	const [userLocation, setUserLocation] = useState(null)
	const [locationError, setLocationError] = useState(null)
	const [formData, setFormData] = useState({
		title: "",
		description: "",
		location: "",
		city: "",
		severity: "MEDIUM",
		contact_phone: "",
	})
	const [criticalEmergencyData, setCriticalEmergencyData] = useState({
		title: "",
		description: "",
		need_type: "BLOOD",
		required_blood_group: "",
		city: "",
		zip_code: "",
		contact_phone: "",
		patient_condition: "",
		urgency_level: "CRITICAL",
	})
	const [posterImage, setPosterImage] = useState(null)
	const [posterPreview, setPosterPreview] = useState(null)

	// Get user location automatically
	useEffect(() => {
		if (navigator.geolocation) {
			navigator.geolocation.getCurrentPosition(
				(position) => {
					setUserLocation({
						latitude: position.coords.latitude,
						longitude: position.coords.longitude,
					})
				},
				(err) => {
					setLocationError("Location access denied. Please enable location services.")
					console.error("Location error:", err)
				}
			)
		} else {
			setLocationError("Geolocation is not supported by your browser.")
		}
	}, [])

	useEffect(() => {
		async function load() {
			setLoading(true)
			setError(null)
			try {
				const needsData = await apiFetch("/needs/?status=OPEN")
				setNeeds(Array.isArray(needsData) ? needsData.slice(0, 10) : [])
			} catch (e) {
				setNeeds([])
				setError("Unable to load emergency requests.")
			}
			try {
				const alerts = await apiFetch("/accident-alerts/?status=ACTIVE")
				setAccidents(Array.isArray(alerts) ? alerts.slice(0, 10) : [])
			} catch (e) {
				setAccidents([])
			}
			try {
				const areas = await apiFetch("/accident-alerts/accident_prone_areas/")
				setAccidentProneAreas(Array.isArray(areas?.accident_prone_areas) ? areas.accident_prone_areas : [])
			} catch (e) {
				setAccidentProneAreas([])
			} finally {
				setLoading(false)
			}
		}
		load()
		// Refresh every 30 seconds
		const interval = setInterval(load, 30000)
		return () => clearInterval(interval)
	}, [])

	const handleReportAccident = async (e) => {
		e.preventDefault()
		setReportingAccident(true)
		setError(null)

		try {
			const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null
			const accidentData = {
				...formData,
				latitude: userLocation?.latitude || null,
				longitude: userLocation?.longitude || null,
				status: "ACTIVE",
				accident_time: new Date().toISOString(),
			}

			// Try to get user ID from token if available (optional)
			if (token) {
				try {
					const payload = JSON.parse(atob(token.split(".")[1]))
					if (payload.user_id) {
						accidentData.reported_by_id = payload.user_id
					}
				} catch (e) {
					// Token parsing failed, continue without user_id
					console.log("Could not parse token, reporting as anonymous")
				}
			}

			const newAccident = await apiFetch("/accident-alerts/", {
				method: "POST",
				body: JSON.stringify(accidentData),
			})

			// Automatically send alert to nearest ambulance and hospital
			try {
				await apiFetch(`/accident-alerts/${newAccident.id}/speed_up/`, {
					method: "POST",
				})
			} catch (e) {
				console.error("Speed up error:", e)
			}

			// Reset form and reload
			setFormData({
				title: "",
				description: "",
				location: "",
				city: "",
				severity: "MEDIUM",
				contact_phone: "",
			})
			setShowAccidentForm(false)

			// Reload accidents
			const alerts = await apiFetch("/accident-alerts/?status=ACTIVE")
			setAccidents(Array.isArray(alerts) ? alerts.slice(0, 10) : [])
			const areas = await apiFetch("/accident-alerts/accident_prone_areas/")
			setAccidentProneAreas(Array.isArray(areas?.accident_prone_areas) ? areas.accident_prone_areas : [])

			alert("Accident reported! Ambulance and nearest hospital have been automatically alerted.")
		} catch (err) {
			setError(err.message || "Failed to report accident. Please try again.")
			console.error("Report accident error:", err)
		} finally {
			setReportingAccident(false)
		}
	}

	const handleSpeedUp = async (accidentId) => {
		try {
			const response = await apiFetch(`/accident-alerts/${accidentId}/speed_up/`, {
				method: "POST",
			})

			// Call ambulance
			if (typeof window !== "undefined") {
				window.open(`tel:108`, "_self")
			}

			alert(response.message || "Emergency alert sent! Ambulance and hospital have been notified.")
		} catch (err) {
			alert("Failed to send speed-up alert. Please call 108 manually.")
			console.error("Speed up error:", err)
		}
	}

	const handlePosterImageChange = (e) => {
		const file = e.target.files[0]
		if (file) {
			if (file.size > 5 * 1024 * 1024) {
				alert("Image size should be less than 5MB")
				return
			}
			if (!file.type.startsWith("image/")) {
				alert("Please select an image file")
				return
			}
			setPosterImage(file)
			const reader = new FileReader()
			reader.onloadend = () => {
				setPosterPreview(reader.result)
			}
			reader.readAsDataURL(file)
		}
	}

	const handleCriticalEmergency = async (e) => {
		e.preventDefault()
		setSubmittingCriticalEmergency(true)
		setError(null)

		try {
			// Use FormData for file upload
			const formData = new FormData()
			formData.append("title", criticalEmergencyData.title)
			formData.append("description", criticalEmergencyData.description)
			formData.append("need_type", criticalEmergencyData.need_type)
			formData.append("required_blood_group", criticalEmergencyData.required_blood_group)
			formData.append("city", criticalEmergencyData.city)
			formData.append("zip_code", criticalEmergencyData.zip_code)
			formData.append("contact_phone", criticalEmergencyData.contact_phone)
			if (userLocation?.latitude) {
				formData.append("latitude", userLocation.latitude)
			}
			if (userLocation?.longitude) {
				formData.append("longitude", userLocation.longitude)
			}
			if (posterImage) {
				formData.append("poster_image", posterImage)
			}

			const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null
			const headers = {}
			if (token) {
				headers["Authorization"] = `Bearer ${token}`
			}

			const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api"}/needs/critical_emergency/`, {
				method: "POST",
				headers,
				body: formData,
			})

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}))
				throw new Error(errorData.detail || errorData.message || `Request failed with status ${response.status}`)
			}

			const responseData = await response.json()

			// Call emergency helpline
			if (typeof window !== "undefined") {
				window.open(`tel:112`, "_self")
			}

			// Reset form
			setCriticalEmergencyData({
				title: "",
				description: "",
				need_type: "BLOOD",
				required_blood_group: "",
				city: "",
				zip_code: "",
				contact_phone: "",
				patient_condition: "",
				urgency_level: "CRITICAL",
			})
			setPosterImage(null)
			setPosterPreview(null)
			setShowCriticalEmergencyForm(false)

			// Reload needs
			const needsData = await apiFetch("/needs/?status=OPEN")
			setNeeds(Array.isArray(needsData) ? needsData.slice(0, 10) : [])

			// Show success message with hospital info
			let message = responseData.message || "Critical emergency need created!"
			if (responseData.nearby_hospitals && responseData.nearby_hospitals.length > 0) {
				message += `\n\nNearby hospitals alerted:\n${responseData.nearby_hospitals.map(h => `• ${h.name} - ${h.phone || 'No phone'}`).join('\n')}`
			}
			alert(message)
		} catch (err) {
			setError(err.message || "Failed to create critical emergency request. Please call 112 immediately.")
			console.error("Critical emergency error:", err)
			alert("Failed to create request. Please call 112 immediately for critical emergencies.")
		} finally {
			setSubmittingCriticalEmergency(false)
		}
	}

	const downloadPoster = (imageUrl, title) => {
		if (typeof window !== "undefined") {
			const link = document.createElement("a")
			link.href = imageUrl
			link.download = `${title || "emergency-poster"}.jpg`
			document.body.appendChild(link)
			link.click()
			document.body.removeChild(link)
		}
	}

	const sharePoster = (imageUrl, title, description, needType, bloodGroup, contactPhone) => {
		if (typeof window === "undefined") return

		const shareText = `🚨 URGENT: ${title}\n\n${description}\n\nType: ${needType}${bloodGroup ? `\nBlood Group: ${bloodGroup}` : ""}${contactPhone ? `\nContact: ${contactPhone}` : ""}\n\nPlease help share this emergency request!`

		// WhatsApp
		const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText + "\n\n" + imageUrl)}`
		
		// Instagram (opens in app or web)
		const instagramUrl = `https://www.instagram.com/`

		// Copy to clipboard
		const copyToClipboard = () => {
			if (navigator.clipboard) {
				navigator.clipboard.writeText(shareText + "\n" + imageUrl)
				alert("Link copied to clipboard!")
			}
		}

		return { whatsappUrl, instagramUrl, shareText, copyToClipboard }
	}

	const handleHelpEmergency = (needId, contactPhone) => {
		if (contactPhone) {
			window.open(`tel:${contactPhone}`, "_self")
		} else {
			alert("Please contact the emergency helpline at 112 or check the emergency case details.")
		}
	}

	const getLocationName = async (lat, lng) => {
		try {
			// Use reverse geocoding if available, otherwise return coordinates
			return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
		} catch (e) {
			return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
		}
	}

	return (
		<>
			<Head>
				<title>Emergency Requests — LifeSaver Connect</title>
			</Head>
			<main className="min-h-screen bg-[#1A1A2E] text-white">
				<div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 space-y-8">
					<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
						<div>
							<h1 className="text-3xl font-extrabold" style={{ fontFamily: "'Poppins', sans-serif" }}>
								Emergency Requests
							</h1>
							<p className="mt-2 text-sm text-pink-100/80">
								Active emergency needs and nearby accident alerts. Call the listed numbers or share with responders.
							</p>
						</div>
						<div className="flex gap-2">
							<button
								onClick={() => setShowAccidentForm(!showAccidentForm)}
								className="rounded-lg border border-[#DC2626] bg-[#DC2626]/20 px-4 py-2 text-sm font-medium text-white hover:bg-[#DC2626]/30 transition"
							>
								{showAccidentForm ? "Cancel Report" : "Report Accident"}
							</button>
							<Link href="/needs" legacyBehavior>
								<a className="rounded-lg border border-[#F6D6E3] px-4 py-2 text-sm font-medium text-pink-100 hover:bg-white/5 transition">
									View All Requests
								</a>
							</Link>
						</div>
					</div>

					{/* Accident Reporting Form */}
					{showAccidentForm && (
						<div id="accident-form" className="rounded-2xl border border-[#DC2626]/50 bg-[#131326] p-6">
							<h2 className="text-xl font-semibold text-white mb-4">Report an Accident</h2>
							<form onSubmit={handleReportAccident} className="space-y-4">
								<div className="grid gap-4 md:grid-cols-2">
									<div>
										<label className="block text-sm font-medium text-pink-100 mb-1">Title *</label>
										<input
											type="text"
											required
											value={formData.title}
											onChange={(e) => setFormData({ ...formData, title: e.target.value })}
											placeholder="e.g., Car accident on Main Street"
											className="w-full rounded-lg border border-[#F6D6E3]/30 bg-[#1A1A2E] px-3 py-2 text-white placeholder-pink-100/50 focus:border-[#E91E63] focus:outline-none"
										/>
									</div>
									<div>
										<label className="block text-sm font-medium text-pink-100 mb-1">Severity *</label>
										<select
											required
											value={formData.severity}
											onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
											className="w-full rounded-lg border border-[#F6D6E3]/30 bg-[#1A1A2E] px-3 py-2 text-white focus:border-[#E91E63] focus:outline-none"
										>
											<option value="LOW">Low</option>
											<option value="MEDIUM">Medium</option>
											<option value="HIGH">High</option>
											<option value="CRITICAL">Critical</option>
										</select>
									</div>
								</div>
								<div>
									<label className="block text-sm font-medium text-pink-100 mb-1">Location *</label>
									<input
										type="text"
										required
										value={formData.location}
										onChange={(e) => setFormData({ ...formData, location: e.target.value })}
										placeholder="e.g., Main Street near City Park"
										className="w-full rounded-lg border border-[#F6D6E3]/30 bg-[#1A1A2E] px-3 py-2 text-white placeholder-pink-100/50 focus:border-[#E91E63] focus:outline-none"
									/>
									{userLocation && (
										<p className="mt-1 text-xs text-green-400">
											📍 Location detected: {userLocation.latitude.toFixed(4)}, {userLocation.longitude.toFixed(4)}
										</p>
									)}
									{locationError && <p className="mt-1 text-xs text-yellow-400">{locationError}</p>}
								</div>
								<div className="grid gap-4 md:grid-cols-2">
									<div>
										<label className="block text-sm font-medium text-pink-100 mb-1">City *</label>
										<input
											type="text"
											required
											value={formData.city}
											onChange={(e) => setFormData({ ...formData, city: e.target.value })}
											placeholder="e.g., Mumbai"
											className="w-full rounded-lg border border-[#F6D6E3]/30 bg-[#1A1A2E] px-3 py-2 text-white placeholder-pink-100/50 focus:border-[#E91E63] focus:outline-none"
										/>
									</div>
									<div>
										<label className="block text-sm font-medium text-pink-100 mb-1">Contact Phone</label>
										<input
											type="tel"
											value={formData.contact_phone}
											onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
											placeholder="e.g., +91 9876543210"
											className="w-full rounded-lg border border-[#F6D6E3]/30 bg-[#1A1A2E] px-3 py-2 text-white placeholder-pink-100/50 focus:border-[#E91E63] focus:outline-none"
										/>
									</div>
								</div>
								<div>
									<label className="block text-sm font-medium text-pink-100 mb-1">Description</label>
									<textarea
										value={formData.description}
										onChange={(e) => setFormData({ ...formData, description: e.target.value })}
										placeholder="Additional details about the accident..."
										rows={3}
										className="w-full rounded-lg border border-[#F6D6E3]/30 bg-[#1A1A2E] px-3 py-2 text-white placeholder-pink-100/50 focus:border-[#E91E63] focus:outline-none"
									/>
								</div>
								<div className="flex gap-3">
									<button
										type="submit"
										disabled={reportingAccident}
										className="rounded-lg bg-[#DC2626] px-6 py-2 text-sm font-medium text-white hover:bg-[#DC2626]/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
									>
										{reportingAccident ? "Reporting..." : "Report Accident & Alert Emergency Services"}
									</button>
									<button
										type="button"
										onClick={() => setShowAccidentForm(false)}
										className="rounded-lg border border-[#F6D6E3]/30 px-6 py-2 text-sm font-medium text-pink-100 hover:bg-white/5 transition"
									>
										Cancel
									</button>
								</div>
								<p className="text-xs text-pink-100/70">
									⚠️ When you report an accident, the system will automatically alert the nearest ambulance (108) and hospital.
								</p>
							</form>
						</div>
					)}

					{/* Critical Medical Emergency Form */}
					{showCriticalEmergencyForm && (
						<div id="critical-emergency-form" className="rounded-2xl border border-[#F59E0B]/50 bg-[#131326] p-6">
							<h2 className="text-xl font-semibold text-white mb-4">🚨 Critical Medical Emergency Request</h2>
							<form onSubmit={handleCriticalEmergency} className="space-y-4">
								<div className="grid gap-4 md:grid-cols-2">
									<div>
										<label className="block text-sm font-medium text-pink-100 mb-1">Emergency Type *</label>
										<select
											required
											value={criticalEmergencyData.need_type}
											onChange={(e) => setCriticalEmergencyData({ ...criticalEmergencyData, need_type: e.target.value })}
											className="w-full rounded-lg border border-[#F6D6E3]/30 bg-[#1A1A2E] px-3 py-2 text-white focus:border-[#E91E63] focus:outline-none"
										>
											<option value="BLOOD">Emergency Blood Units</option>
											<option value="PLATELETS">Platelets Needed</option>
											<option value="OTHER">Critical Hospitalization</option>
										</select>
									</div>
									{(criticalEmergencyData.need_type === "BLOOD" || criticalEmergencyData.need_type === "PLATELETS") && (
										<div>
											<label className="block text-sm font-medium text-pink-100 mb-1">Blood Group Required *</label>
											<select
												required
												value={criticalEmergencyData.required_blood_group}
												onChange={(e) => setCriticalEmergencyData({ ...criticalEmergencyData, required_blood_group: e.target.value })}
												className="w-full rounded-lg border border-[#F6D6E3]/30 bg-[#1A1A2E] px-3 py-2 text-white focus:border-[#E91E63] focus:outline-none"
											>
												<option value="">Select Blood Group</option>
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
									)}
								</div>
								<div>
									<label className="block text-sm font-medium text-pink-100 mb-1">Patient Condition / Title *</label>
									<input
										type="text"
										required
										value={criticalEmergencyData.title}
										onChange={(e) => setCriticalEmergencyData({ ...criticalEmergencyData, title: e.target.value })}
										placeholder="e.g., Cardiac arrest, Severe bleeding, Critical surgery needed"
										className="w-full rounded-lg border border-[#F6D6E3]/30 bg-[#1A1A2E] px-3 py-2 text-white placeholder-pink-100/50 focus:border-[#E91E63] focus:outline-none"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-pink-100 mb-1">Patient Details / Description *</label>
									<textarea
										required
										value={criticalEmergencyData.description}
										onChange={(e) => setCriticalEmergencyData({ ...criticalEmergencyData, description: e.target.value })}
										placeholder="Describe patient condition, urgency, and any critical details..."
										rows={3}
										className="w-full rounded-lg border border-[#F6D6E3]/30 bg-[#1A1A2E] px-3 py-2 text-white placeholder-pink-100/50 focus:border-[#E91E63] focus:outline-none"
									/>
								</div>
								<div className="grid gap-4 md:grid-cols-3">
									<div>
										<label className="block text-sm font-medium text-pink-100 mb-1">City *</label>
										<input
											type="text"
											required
											value={criticalEmergencyData.city}
											onChange={(e) => setCriticalEmergencyData({ ...criticalEmergencyData, city: e.target.value })}
											placeholder="e.g., Mumbai"
											className="w-full rounded-lg border border-[#F6D6E3]/30 bg-[#1A1A2E] px-3 py-2 text-white placeholder-pink-100/50 focus:border-[#E91E63] focus:outline-none"
										/>
									</div>
									<div>
										<label className="block text-sm font-medium text-pink-100 mb-1">Zip Code</label>
										<input
											type="text"
											value={criticalEmergencyData.zip_code}
											onChange={(e) => setCriticalEmergencyData({ ...criticalEmergencyData, zip_code: e.target.value })}
											placeholder="e.g., 400001"
											className="w-full rounded-lg border border-[#F6D6E3]/30 bg-[#1A1A2E] px-3 py-2 text-white placeholder-pink-100/50 focus:border-[#E91E63] focus:outline-none"
										/>
									</div>
									<div>
										<label className="block text-sm font-medium text-pink-100 mb-1">Contact Phone *</label>
										<input
											type="tel"
											required
											value={criticalEmergencyData.contact_phone}
											onChange={(e) => setCriticalEmergencyData({ ...criticalEmergencyData, contact_phone: e.target.value })}
											placeholder="e.g., +91 9876543210"
											className="w-full rounded-lg border border-[#F6D6E3]/30 bg-[#1A1A2E] px-3 py-2 text-white placeholder-pink-100/50 focus:border-[#E91E63] focus:outline-none"
										/>
									</div>
								</div>
								<div>
									<label className="block text-sm font-medium text-pink-100 mb-1">Patient Poster / Image (Optional)</label>
									<input
										type="file"
										accept="image/*"
										onChange={handlePosterImageChange}
										className="w-full rounded-lg border border-[#F6D6E3]/30 bg-[#1A1A2E] px-3 py-2 text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#E91E63] file:text-white hover:file:bg-[#E91E63]/90 file:cursor-pointer"
									/>
									<p className="mt-1 text-xs text-pink-100/70">Upload a poster/image of the patient. Max size: 5MB. Can be shared on WhatsApp, Instagram, etc.</p>
									{posterPreview && (
										<div className="mt-3">
											<img src={posterPreview} alt="Poster preview" className="max-w-full h-auto rounded-lg border border-[#F6D6E3]/30 max-h-64" />
											<button
												type="button"
												onClick={() => {
													setPosterImage(null)
													setPosterPreview(null)
												}}
												className="mt-2 text-xs text-red-400 hover:text-red-300"
											>
												Remove image
											</button>
										</div>
									)}
								</div>
								{userLocation && (
									<p className="text-xs text-green-400">
										📍 Location detected: {userLocation.latitude.toFixed(4)}, {userLocation.longitude.toFixed(4)} - Nearby hospitals will be alerted automatically
									</p>
								)}
								{locationError && <p className="text-xs text-yellow-400">{locationError}</p>}
								<div className="flex gap-3">
									<button
										type="submit"
										disabled={submittingCriticalEmergency}
										className="rounded-lg bg-[#F59E0B] px-6 py-2 text-sm font-medium text-white hover:bg-[#F59E0B]/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
									>
										{submittingCriticalEmergency ? "Submitting..." : "🚨 Submit Emergency Request & Alert Hospitals"}
									</button>
									<button
										type="button"
										onClick={() => setShowCriticalEmergencyForm(false)}
										className="rounded-lg border border-[#F6D6E3]/30 px-6 py-2 text-sm font-medium text-pink-100 hover:bg-white/5 transition"
									>
										Cancel
									</button>
								</div>
								<p className="text-xs text-pink-100/70">
									⚠️ This will automatically alert nearby hospitals, blood banks, and emergency services. System will also call 112 for you.
								</p>
							</form>
						</div>
					)}

					{/* Accident Prone Areas Map */}
					{accidentProneAreas.length > 0 && (
						<div className="rounded-2xl border border-[#F6D6E3] bg-[#131326] p-6">
							<div className="flex items-center justify-between mb-4">
								<h2 className="text-lg font-semibold text-white">Accident Prone Areas</h2>
								<span className="text-xs text-pink-100/70">{accidentProneAreas.length} active areas</span>
							</div>
							<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
								{accidentProneAreas.map((area) => (
									<div key={area.id} className="rounded-xl border border-[#DC2626]/30 bg-[#1A1A2E] p-4">
										<div className="flex items-start justify-between">
											<div className="flex-1">
												<p className="text-sm font-semibold text-white">{area.title || "Accident Alert"}</p>
												<p className="mt-1 text-xs text-pink-100/70">{area.location || area.city}</p>
												<p className="mt-1 text-xs text-pink-100/70">
													Severity: <span className={`font-semibold ${
														area.severity === "CRITICAL" ? "text-red-400" :
														area.severity === "HIGH" ? "text-orange-400" :
														area.severity === "MEDIUM" ? "text-yellow-400" : "text-green-400"
													}`}>{area.severity}</span>
												</p>
												{area.latitude && area.longitude && (
													<p className="mt-1 text-xs text-pink-100/50">
														📍 {area.latitude.toFixed(4)}, {area.longitude.toFixed(4)}
													</p>
												)}
											</div>
										</div>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Immediate help options */}
					<div className="grid gap-4 md:grid-cols-2">
						<button
							onClick={() => {
								setShowAccidentForm(true)
								// Scroll to form after a brief delay to ensure it's rendered
								setTimeout(() => {
									const formElement = document.getElementById("accident-form")
									if (formElement) {
										formElement.scrollIntoView({ behavior: "smooth", block: "start" })
									}
								}, 100)
							}}
							className="rounded-2xl border border-[#DC2626]/50 bg-[#1A1A2E] p-6 transition hover:border-[#DC2626] hover:shadow-[0_10px_25px_rgba(220,38,38,0.2)] text-left cursor-pointer"
						>
							<p className="text-sm font-semibold text-white">Accident / Trauma — Report & Alert (108)</p>
							<p className="mt-2 text-xs text-[#FECACA]">
								Click to report accident and automatically alert nearest ambulance and hospital.
							</p>
							<p className="mt-1 text-xs text-[#FECACA]">System will detect your location and send alerts instantly.</p>
							<div className="mt-3 flex gap-2">
								<a
									href="tel:108"
									onClick={(e) => e.stopPropagation()}
									className="text-xs text-[#DC2626] hover:text-[#DC2626]/80 underline"
								>
									Or call 108 directly →
								</a>
							</div>
						</button>
						<button
							onClick={() => {
								setShowCriticalEmergencyForm(true)
								// Scroll to form after a brief delay to ensure it's rendered
								setTimeout(() => {
									const formElement = document.getElementById("critical-emergency-form")
									if (formElement) {
										formElement.scrollIntoView({ behavior: "smooth", block: "start" })
									}
								}, 100)
							}}
							className="rounded-2xl border border-[#F59E0B]/50 bg-[#1A1A2E] p-6 transition hover:border-[#F59E0B] hover:shadow-[0_10px_25px_rgba(245,158,11,0.2)] text-left cursor-pointer"
						>
							<p className="text-sm font-semibold text-white">Critical Medical Emergency — Alert Now</p>
							<p className="mt-2 text-xs text-[#FCD34D]">
								Click to request emergency blood, platelets, or critical hospitalization. System alerts nearby hospitals instantly.
							</p>
							<p className="mt-1 text-xs text-[#FCD34D]">For cardiac arrest, severe bleeding, or unconsciousness: immediate action required.</p>
							<div className="mt-3 flex gap-2">
								<a
									href="tel:112"
									onClick={(e) => e.stopPropagation()}
									className="text-xs text-[#F59E0B] hover:text-[#F59E0B]/80 underline"
								>
									Or call 112 directly →
								</a>
							</div>
						</button>
					</div>

					{loading ? (
						<div className="rounded-2xl border border-dashed border-[#F6D6E3]/40 bg-[#131326] p-6 text-sm text-pink-100/70">
							Loading emergency data…
						</div>
					) : error ? (
						<div className="rounded-2xl border border-rose-400 bg-rose-500/10 p-6 text-sm text-rose-100">{error}</div>
					) : (
						<div className="grid gap-6 md:grid-cols-2">
							<div className="rounded-2xl border border-[#F6D6E3] bg-[#131326] p-6">
								<div className="flex items-center justify-between">
									<h2 className="text-lg font-semibold text-white">Emergency Cases</h2>
									<Link href="/needs" legacyBehavior>
										<a className="text-sm text-[#E91E63]">View All</a>
									</Link>
								</div>
								{needs.length === 0 ? (
									<p className="mt-4 text-sm text-pink-100/70">No active emergency cases right now.</p>
								) : (
									<ul className="mt-4 space-y-3">
										{needs.map((need) => (
											<li key={need.id} className="rounded-xl border border-[#F6D6E3]/30 bg-[#1A1A2E] p-4">
												<div className="flex items-start justify-between">
													<div className="flex-1">
														<p className="text-sm font-semibold text-white">{need.title || "Emergency request"}</p>
														<p className="mt-1 text-xs text-pink-100/70">
															{need.city} {need.zip_code ? `• ${need.zip_code}` : ""}
														</p>
														<p className="mt-1 text-xs text-pink-100/70">
															Type: <span className="font-semibold text-white">{need.need_type || "EMERGENCY"}</span>
															{need.required_blood_group && (
																<span className="ml-2 text-red-400">• Blood Group: {need.required_blood_group}</span>
															)}
														</p>
														{need.contact_phone && (
															<p className="mt-1 text-xs text-pink-100/70">
																Call: <a className="text-[#E91E63]" href={`tel:${need.contact_phone}`}>{need.contact_phone}</a>
															</p>
														)}
														{need.description && (
															<p className="mt-2 text-xs text-pink-100/70 line-clamp-3">{need.description}</p>
														)}
														{need.poster_image && (
															<div className="mt-3">
																<img 
																	src={
																		need.poster_image.startsWith('http') 
																			? need.poster_image 
																			: `${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"}/media${need.poster_image.replace('/media/', '/')}`
																	} 
																	alt="Patient poster" 
																	className="w-full rounded-lg border border-[#F6D6E3]/30 max-h-48 object-contain bg-[#131326]"
																/>
															</div>
														)}
													</div>
												</div>
												{need.poster_image && (
													<div className="mt-3 flex flex-wrap gap-2">
														<button
															onClick={() => {
																const imageUrl = need.poster_image.startsWith('http') ? need.poster_image : `http://localhost:8000${need.poster_image}`
																downloadPoster(imageUrl, need.title || "emergency-poster")
															}}
															className="rounded-lg border border-[#F6D6E3]/30 bg-[#1A1A2E] px-3 py-1.5 text-xs font-medium text-pink-100 hover:bg-white/5 transition"
														>
															⬇️ Download Poster
														</button>
														{(() => {
															const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"
															const imageUrl = need.poster_image.startsWith('http') 
																? need.poster_image 
																: `${baseUrl}/media${need.poster_image.replace('/media/', '/')}`
															const shareData = sharePoster(
																imageUrl,
																need.title || "Emergency Request",
																need.description || "",
																need.need_type || "",
																need.required_blood_group || "",
																need.contact_phone || ""
															)
															return (
																<>
																	<a
																		href={shareData.whatsappUrl}
																		target="_blank"
																		rel="noopener noreferrer"
																		className="rounded-lg border border-green-500/50 bg-green-500/20 px-3 py-1.5 text-xs font-medium text-green-300 hover:bg-green-500/30 transition"
																	>
																		💬 Share on WhatsApp
																	</a>
																	<button
																		onClick={() => {
																			const shareUrl = `${window.location.origin}/needs/post#emergency-${need.id}`
																			shareData.copyToClipboard()
																		}}
																		className="rounded-lg border border-[#F6D6E3]/30 bg-[#1A1A2E] px-3 py-1.5 text-xs font-medium text-pink-100 hover:bg-white/5 transition"
																	>
																		📋 Copy Link
																	</button>
																</>
															)
														})()}
													</div>
												)}
												<div className="mt-3 flex gap-2">
													<button
														onClick={() => handleHelpEmergency(need.id, need.contact_phone)}
														className="flex-1 rounded-lg bg-[#E91E63] px-4 py-2 text-xs font-medium text-white hover:bg-[#E91E63]/90 transition"
													>
														💚 I Can Help - Contact Now
													</button>
													{need.contact_phone && (
														<a
															href={`tel:${need.contact_phone}`}
															className="rounded-lg border border-[#E91E63] px-4 py-2 text-xs font-medium text-white hover:bg-[#E91E63]/20 transition"
														>
															📞 Call
														</a>
													)}
												</div>
											</li>
										))}
									</ul>
								)}
							</div>

							<div className="rounded-2xl border border-[#F6D6E3] bg-[#131326] p-6">
								<div className="flex items-center justify-between">
									<h2 className="text-lg font-semibold text-white">Accident Alerts</h2>
									<span className="text-xs text-pink-100/70">Ambulance routing</span>
								</div>
								{accidents.length === 0 ? (
									<p className="mt-4 text-sm text-pink-100/70">No nearby accident alerts.</p>
								) : (
									<ul className="mt-4 space-y-3">
										{accidents.map((alert) => (
											<li key={alert.id} className="rounded-xl border border-[#F6D6E3]/30 bg-[#1A1A2E] p-4">
												<div className="flex items-start justify-between">
													<div className="flex-1">
														<p className="text-sm font-semibold text-white">{alert.title || "Accident Alert"}</p>
														<p className="mt-1 text-xs text-pink-100/70">
															{alert.location ? `${alert.location}` : ""} {alert.city ? `• ${alert.city}` : ""}
														</p>
														<p className="mt-1 text-xs text-pink-100/70">
															Severity: <span className={`font-semibold ${
																alert.severity === "CRITICAL" ? "text-red-400" :
																alert.severity === "HIGH" ? "text-orange-400" :
																alert.severity === "MEDIUM" ? "text-yellow-400" : "text-green-400"
															}`}>{alert.severity || "MEDIUM"}</span>
														</p>
														{alert.contact_phone ? (
															<p className="mt-1 text-xs text-pink-100/70">
																Ambulance/Contact: <a className="text-[#E91E63]" href={`tel:${alert.contact_phone}`}>{alert.contact_phone}</a>
															</p>
														) : (
															<p className="mt-1 text-xs text-pink-100/70">
																Ambulance: <a className="text-[#E91E63]" href="tel:108">108</a>
															</p>
														)}
														{alert.hospital_referred && (
															<p className="mt-1 text-xs text-green-400">
																🏥 Hospital Alerted: {alert.hospital_referred.name}
															</p>
														)}
														{alert.description && (
															<p className="mt-2 text-xs text-pink-100/70 line-clamp-3">{alert.description}</p>
														)}
													</div>
												</div>
												<div className="mt-3 flex gap-2">
													<button
														onClick={() => handleSpeedUp(alert.id)}
														className="flex-1 rounded-lg bg-[#DC2626] px-4 py-2 text-xs font-medium text-white hover:bg-[#DC2626]/90 transition"
													>
														⚡ Speed Up — Call Ambulance & Alert Hospital
													</button>
													<a
														href="tel:108"
														className="rounded-lg border border-[#DC2626] px-4 py-2 text-xs font-medium text-white hover:bg-[#DC2626]/20 transition"
													>
														📞 108
													</a>
												</div>
											</li>
										))}
									</ul>
								)}
							</div>
						</div>
					)}

					<div className="rounded-2xl border border-[#F6D6E3]/30 bg-[#131326] p-6 text-sm text-pink-100/80">
						<p className="font-semibold text-white">Need to post an emergency?</p>
						<p className="mt-1">Contact your hospital/center to post via their portal, or share the hotline:</p>
						<p className="mt-1">
							Emergency Hotline: <a className="text-[#E91E63]" href="tel:108">108</a> (ambulance) • <a className="text-[#E91E63]" href="tel:112">112</a> (national helpline)
						</p>
						<p className="mt-1">For platform requests, please reach an admin or hospital partner.</p>
					</div>
				</div>
			</main>
		</>
	)
}
