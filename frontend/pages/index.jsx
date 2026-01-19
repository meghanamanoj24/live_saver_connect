import Head from "next/head"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { apiFetch } from "../lib/api"

export default function Home() {
	const [metrics, setMetrics] = useState({
		donors: 0,
		needsServed: 0,
		hospitals: 0,
		itemsListed: 0,
		moduleBreakdown: {
			donor: 0,
			hospital: 0,
			organ: 0,
			marketplace: 0,
		},
	})
	const [loadingMetrics, setLoadingMetrics] = useState(true)

	useEffect(() => {
		let cancelled = false
		async function loadMetrics() {
			try {
				const data = await apiFetch("/metrics/overview/")
				if (!cancelled && data) {
					setMetrics({
						donors: data.donors || 0,
						needsServed: data.needs_served || 0,
						hospitals: data.hospitals || 0,
						itemsListed: data.items_listed || 0,
						moduleBreakdown: data.module_breakdown || {
							donor: 0,
							hospital: 0,
							organ: 0,
							marketplace: 0,
						},
					})
				}
			} catch {
				// Keep zeros on error
			} finally {
				if (!cancelled) {
					setLoadingMetrics(false)
				}
			}
		}
		loadMetrics()
		return () => {
			cancelled = true
		}
	}, [])

	const totalActivity = useMemo(() => {
		const { donor, hospital, organ, marketplace } = metrics.moduleBreakdown
		const sum = donor + hospital + organ + marketplace
		return sum > 0 ? sum : 1
	}, [metrics.moduleBreakdown])

	const donutSegments = useMemo(() => {
		const order = ["donor", "hospital", "organ", "marketplace"]
		const colors = {
			donor: "#E91E63",
			hospital: "#4F46E5",
			organ: "#22C55E",
			marketplace: "#FBBF24",
		}
		let acc = 0
		return order.map((key) => {
			const value = metrics.moduleBreakdown[key] || 0
			const percent = (value / totalActivity) * 100
			const start = acc
			const end = acc + percent
			acc = end
			return {
				key,
				color: colors[key],
				start,
				end,
				percent: Math.round(percent),
			}
		})
	}, [metrics.moduleBreakdown, totalActivity])

	return (
		<>
			<Head>
				<title>LifeSaver Connect</title>
				<meta name="viewport" content="width=device-width, initial-scale=1" />
			</Head>
			<main className="min-h-screen bg-[#1A1A2E] text-white">
				{/* Top Header */}
				<header className="sticky top-0 z-20 border-b border-[#F6D6E3]/30 bg-[#131326]/80 backdrop-blur">
					<div className="mx-auto grid grid-cols-1 gap-3 md:grid-cols-[auto_1fr_auto] md:items-center max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
						<div className="flex items-center gap-3">
							<div className="h-9 w-9 rounded-lg bg-[#E91E63] text-white grid place-content-center font-bold">LC</div>
							<div>
								<h1 className="text-xl font-bold text-white">LifeSaver Connect</h1>
								<p className="text-xs text-pink-100/80 -mt-1">Donate | Support | Review</p>
							</div>
						</div>

						{/* Modules nav with small icons */}
						<nav className="order-3 md:order-none -mt-1 md:mt-0 overflow-x-auto">
							<ul className="flex items-center gap-4 md:justify-center whitespace-nowrap text-pink-100">
								<li className="px-2 py-1">
									<span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#1A1A2E] border border-[#F6D6E3]/40">
										<span className="sr-only">Donor module</span>
										<span className="text-xs">🩸</span>
									</span>
								</li>
								<li className="px-2 py-1">
									<span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#1A1A2E] border border-[#F6D6E3]/40">
										<span className="sr-only">Emergency needs</span>
										<span className="text-xs">⚡</span>
									</span>
								</li>
								<li className="px-2 py-1">
									<span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#1A1A2E] border border-[#F6D6E3]/40">
										<span className="sr-only">Organ registry</span>
										<span className="text-xs">🫀</span>
									</span>
								</li>
								<li className="px-2 py-1">
									<span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#1A1A2E] border border-[#F6D6E3]/40">
										<span className="sr-only">Marketplace</span>
										<span className="text-xs">💊</span>
									</span>
								</li>
								<li className="px-2 py-1">
									<span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#1A1A2E] border border-[#F6D6E3]/40">
										<span className="sr-only">Reviews</span>
										<span className="text-xs">⭐</span>
									</span>
								</li>
							</ul>
						</nav>

						<div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-end">
							<Link href="/auth/register" legacyBehavior>
								<a className="h-10 grid place-items-center rounded-md border border-[#F6D6E3] px-4 text-sm font-medium text-pink-100 hover:bg-white/5 transition">
									Register
								</a>
							</Link>
							<Link href="/auth/login" legacyBehavior>
								<a className="h-10 grid place-items-center rounded-md border border-[#F6D6E3] px-4 text-sm font-medium text-pink-100 hover:bg-white/5 transition">
									Log in
								</a>
							</Link>
						</div>
					</div>
				</header>

				{/* Hero Section */}
				<section className="relative overflow-hidden">
					<div className="absolute inset-0 -z-10 opacity-30">
						<div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[#E91E63] blur-3xl" />
						<div className="absolute top-40 -left-24 h-72 w-72 rounded-full bg-pink-400 blur-3xl" />
					</div>

					<div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
						<div className="grid items-center gap-10 md:grid-cols-2">
							<div>
								<h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white">
									Make lifesaving connections in minutes
								</h2>
								<p className="mt-4 text-base md:text-lg text-pink-100/90">
									Find nearby donors, post emergency needs, discover trusted hospitals and doctors, and access medical supplies—fast.
								</p>
									<Link href="/needs/post" legacyBehavior>
										<a className="inline-flex items-center rounded-md bg-[#DC2626] px-5 py-3 text-white transition hover:opacity-90">
											🚨 Post Emergency Request
										</a>
									</Link>
								<p className="mt-3 text-xs text-pink-100/70">
									Real-time stats and routing powered by the LifeSaver API.
								</p>
							</div>
							<div className="relative">
								<div className="rounded-2xl border border-[#F6D6E3] bg-[#131326] p-5">
									<div className="mb-4 flex items-center gap-3">
										<img src="/images/blood-drop.svg" alt="Blood drop" className="h-10 w-10" />
										<img src="/images/heartbeat.svg" alt="Heartbeat" className="h-10 w-10" />
										<img src="/images/hospital.svg" alt="Hospital" className="h-10 w-10" />
									</div>
									<div className="grid grid-cols-2 gap-3">
										<div className="rounded-xl border border-[#F6D6E3] bg-[#1A1A2E] p-4">
											<p className="text-xs font-medium text-pink-100">Donors</p>
											<p className="mt-1 text-2xl font-bold text-white">
												{loadingMetrics ? "…" : metrics.donors}
											</p>
										</div>
										<div className="rounded-xl border border-[#F6D6E3] bg-[#1A1A2E] p-4">
											<p className="text-xs font-medium text-pink-100">Needs Served</p>
											<p className="mt-1 text-2xl font-bold text-white">
												{loadingMetrics ? "…" : metrics.needsServed}
											</p>
										</div>
										<div className="rounded-xl border border-[#F6D6E3] bg-[#1A1A2E] p-4">
											<p className="text-xs font-medium text-pink-100">Hospitals</p>
											<p className="mt-1 text-2xl font-bold text-white">
												{loadingMetrics ? "…" : metrics.hospitals}
											</p>
										</div>
										<div className="rounded-xl border border-[#F6D6E3] bg-[#1A1A2E] p-4">
											<p className="text-xs font-medium text-pink-100">Items Listed</p>
											<p className="mt-1 text-2xl font-bold text-white">
												{loadingMetrics ? "…" : metrics.itemsListed}
											</p>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</section>

				{/* AI-style performance overview & module summaries */}
				<section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
					<div className="grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] items-center">
						<div>
							<h3 className="text-2xl font-bold text-white text-center lg:text-left">
								Smart overview of your lifesaving network
							</h3>
							<p className="mt-2 max-w-xl text-sm text-pink-100/85 text-center lg:text-left">
								This live chart blends donors, hospital activity, organ pledges, and marketplace listings to show how
								each module contributes to the overall impact of LifeSaver Connect.
							</p>

							<div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
								<div className="relative mx-auto h-40 w-40 sm:mx-0">
									<svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
										<circle
											className="text-slate-700"
											stroke="currentColor"
											strokeWidth="3.5"
											fill="transparent"
											r="15.915"
											cx="18"
											cy="18"
										/>
										{donutSegments.map((seg) => (
											<circle
												key={seg.key}
												stroke={seg.color}
												strokeWidth="3.5"
												strokeDasharray={`${Math.max(seg.end - seg.start, 0.5)} 100`}
												strokeDashoffset={25 - seg.start}
												strokeLinecap="round"
												fill="transparent"
												r="15.915"
												cx="18"
												cy="18"
											/>
										))}
									</svg>
									<div className="absolute inset-0 flex flex-col items-center justify-center text-center">
										<p className="text-xs text-pink-100/70">Total activity</p>
										<p className="text-lg font-bold text-white">{loadingMetrics ? "…" : totalActivity}</p>
									</div>
								</div>
								<ul className="flex-1 space-y-2 text-xs text-pink-100/80">
									<li className="flex items-center justify-between gap-3">
										<span className="inline-flex items-center gap-2">
											<span className="h-2 w-2 rounded-full bg-[#E91E63]" />
											Donor module
										</span>
										<span>{metrics.moduleBreakdown.donor}</span>
									</li>
									<li className="flex items-center justify-between gap-3">
										<span className="inline-flex items-center gap-2">
											<span className="h-2 w-2 rounded-full bg-[#4F46E5]" />
											Hospital & needs
										</span>
										<span>{metrics.moduleBreakdown.hospital}</span>
									</li>
									<li className="flex items-center justify-between gap-3">
										<span className="inline-flex items-center gap-2">
											<span className="h-2 w-2 rounded-full bg-[#22C55E]" />
											Organ & accident
										</span>
										<span>{metrics.moduleBreakdown.organ}</span>
									</li>
									<li className="flex items-center justify-between gap-3">
										<span className="inline-flex items-center gap-2">
											<span className="h-2 w-2 rounded-full bg-[#FBBF24]" />
											Medical marketplace
										</span>
										<span>{metrics.moduleBreakdown.marketplace}</span>
									</li>
								</ul>
							</div>
						</div>

						<div className="space-y-4">
							<div className="rounded-xl border border-[#F6D6E3]/25 bg-[#131326] p-5">
								<h4 className="text-sm font-semibold text-white mb-1">Donor & Emergency Module</h4>
								<p className="text-xs text-pink-100/80">
									Helps donors register once, stay discoverable by blood group, and respond to compatible emergencies and
									hospital needs in real time.
								</p>
							</div>
							<div className="rounded-xl border border-[#F6D6E3]/25 bg-[#131326] p-5">
								<h4 className="text-sm font-semibold text-white mb-1">Hospital & Organ Care Module</h4>
								<p className="text-xs text-pink-100/80">
									Enables hospitals to post structured needs, manage donor requests and appointments, and coordinate organ
									pledges and accident alerts responsibly.
								</p>
							</div>
							<div className="rounded-xl border border-[#F6D6E3]/25 bg-[#131326] p-5">
								<h4 className="text-sm font-semibold text-white mb-1">Medical Essentials & Marketplace</h4>
								<p className="text-xs text-pink-100/80">
									Connects verified suppliers with buyers for medicines and equipment, tracking orders, stock levels, and
									supplier performance across the network.
								</p>
							</div>
						</div>
					</div>
				</section>

				<footer className="border-t border-[#F6D6E3]/30 bg-[#131326]">
					<div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 text-sm text-pink-100/80">
						© {new Date().getFullYear()} LifeSaver Connect
					</div>
				</footer>
			</main>
		</>
	)
}


