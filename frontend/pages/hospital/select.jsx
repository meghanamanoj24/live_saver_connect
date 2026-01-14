import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import { useState, useEffect } from "react"
import { apiFetch } from "../../lib/api"

export default function HospitalSelect() {
	const router = useRouter()
	const [hospitals, setHospitals] = useState([])
	const [loading, setLoading] = useState(true)
	const [selectedHospital, setSelectedHospital] = useState(null)

	useEffect(() => {
		loadHospitals()
	}, [])

	async function loadHospitals() {
		setLoading(true)
		try {
			// Try to get hospital for logged-in user
			const hospital = await apiFetch("/hospitals/me/")
			if (hospital) {
				router.push(`/hospital/dashboard?id=${hospital.id}`)
				return
			}
		} catch (error) {
			// If not authenticated, send to hospital login
			if (error?.status === 401 || error?.status === 403) {
				router.push("/auth/login?module=hospital&redirect=/hospital/select")
				return
			}
			// User might not have a hospital profile yet
		}

		// If we have a stored hospital (from prior registration), go directly
		if (typeof window !== "undefined") {
			const stored = localStorage.getItem("hospitalData")
			if (stored) {
				try {
					const hospital = JSON.parse(stored)
					if (hospital?.id) {
						router.push(`/hospital/dashboard?id=${hospital.id}`)
						return
					}
				} catch {
					// ignore parse errors and continue to fetch list
				}
			}
		}

		try {
			// Load all hospitals
			const data = await apiFetch("/hospitals/")
			setHospitals(data)
		} catch (error) {
			if (error?.status === 401 || error?.status === 403) {
				router.push("/auth/login?module=hospital&redirect=/hospital/select")
				return
			}
			// Fallback: Load from localStorage
			if (typeof window !== "undefined") {
				const stored = localStorage.getItem("hospitalData")
				if (stored) {
					const hospital = JSON.parse(stored)
					setHospitals([hospital])
				}
			}
		} finally {
			setLoading(false)
		}
	}

	function handleSelect(hospitalId) {
		router.push(`/hospital/dashboard?id=${hospitalId}`)
	}

	return (
		<>
			<Head>
				<title>Select Hospital — LifeSaver Connect</title>
				<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@700;800&display=swap" rel="stylesheet" />
			</Head>
			<main className="min-h-screen bg-[#1A1A2E] text-white">
				<header className="border-b border-[#F6D6E3]/30 bg-[#131326]/80 backdrop-blur">
					<div className="mx-auto flex items-center justify-between max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
						<Link href="/" legacyBehavior>
							<a className="text-xl font-bold text-white">LifeSaver Connect</a>
						</Link>
						<Link href="/hospital/register" legacyBehavior>
							<a className="text-sm text-pink-100 hover:text-[#E91E63]">Register New Hospital</a>
						</Link>
					</div>
				</header>

				<section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
					<div className="text-center mb-8">
						<h1 className="text-3xl md:text-4xl font-extrabold" style={{ fontFamily: "'Poppins', sans-serif" }}>
							Select Your Hospital / Blood Center
						</h1>
						<p className="mt-2 text-sm text-pink-100/80">
							Choose the hospital or blood center you want to manage.
						</p>
					</div>

					{loading ? (
						<div className="text-center py-12 text-pink-100/70">Loading hospitals...</div>
					) : hospitals.length > 0 ? (
						<div className="space-y-4">
							{hospitals.map((hospital) => (
								<button
									key={hospital.id}
									onClick={() => handleSelect(hospital.id)}
									className="w-full text-left rounded-xl border border-[#F6D6E3] bg-[#131326] p-6 transition hover:border-[#E91E63] hover:bg-[#1A1A2E]"
								>
									<div className="flex items-center justify-between">
										<div>
											<h3 className="text-lg font-semibold text-white">{hospital.name}</h3>
											<p className="mt-1 text-sm text-pink-100/70">
												{hospital.hospital_type || "Hospital"} • {hospital.city}
											</p>
											{hospital.phone && (
												<p className="mt-1 text-xs text-pink-100/60">Phone: {hospital.phone}</p>
											)}
										</div>
										<svg className="h-6 w-6 text-[#E91E63]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
										</svg>
									</div>
								</button>
							))}
						</div>
					) : (
						<div className="text-center py-12">
							<p className="text-pink-100/70 mb-4">No hospitals found. Please register a new hospital.</p>
							<Link href="/hospital/register" legacyBehavior>
								<a className="inline-flex rounded-xl bg-[#E91E63] px-6 py-3 font-semibold text-white transition hover:opacity-90">
									Register Hospital
								</a>
							</Link>
						</div>
					)}
				</section>
			</main>
		</>
	)
}

