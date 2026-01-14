import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import { useState, useEffect } from "react"
import { apiFetch } from "../../lib/api"

export default function HospitalNeeds() {
	const router = useRouter()
	const { hospital } = router.query
	const [needs, setNeeds] = useState([])
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		if (hospital) {
			loadNeeds()
		}
	}, [hospital])

	async function loadNeeds() {
		setLoading(true)
		try {
			const data = await apiFetch(`/hospital-needs/?hospital=${hospital}`)
			setNeeds(data.filter(n => n.status !== "FULFILLED" && n.status !== "CANCELLED"))
		} catch (error) {
			setNeeds([])
		} finally {
			setLoading(false)
		}
	}

	return (
		<>
			<Head>
				<title>Hospital Needs — LifeSaver Connect</title>
			</Head>
			<main className="min-h-screen bg-[#1A1A2E] text-white">
				<header className="border-b border-[#F6D6E3]/30 bg-[#131326]/80 backdrop-blur">
					<div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
						<Link href="/" legacyBehavior>
							<a className="text-xl font-bold text-white">LifeSaver Connect</a>
						</Link>
					</div>
				</header>

				<section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
					<h1 className="text-3xl font-bold mb-8">Hospital Needs</h1>
					{loading ? (
						<div className="text-center py-12 text-pink-100/70">Loading needs...</div>
					) : needs.length > 0 ? (
						<div className="space-y-4">
							{needs.map((need) => (
								<div key={need.id} className="rounded-xl border border-[#F6D6E3]/40 bg-[#131326] p-6">
									<div className="flex items-start justify-between">
										<div className="flex-1">
											<div className="flex items-center gap-3">
												<h3 className="text-lg font-semibold text-white">{need.need_type}</h3>
												{need.required_blood_group && (
													<span className="rounded bg-[#E91E63]/10 px-2 py-1 text-xs text-[#E91E63]">
														{need.required_blood_group}
													</span>
												)}
												<span className={`rounded px-2 py-1 text-xs font-semibold ${
													need.status === "URGENT" ? "bg-red-500/10 text-red-300" : "bg-yellow-500/10 text-yellow-300"
												}`}>
													{need.status}
												</span>
											</div>
											{need.patient_name && (
												<p className="mt-2 text-sm text-pink-100/80">Patient: {need.patient_name}</p>
											)}
											{need.patient_details && (
												<p className="mt-2 text-sm text-pink-100/70">{need.patient_details}</p>
											)}
											<p className="mt-2 text-sm text-pink-100/70">Quantity: {need.quantity_needed} units</p>
											{need.poster_image && (
												<div className="mt-4">
													<img src={need.poster_image} alt="Patient poster" className="max-w-xs rounded-lg" />
												</div>
											)}
										</div>
									</div>
								</div>
							))}
						</div>
					) : (
						<div className="text-center py-12 text-pink-100/70">No active needs at this time.</div>
					)}
				</section>
			</main>
		</>
	)
}

