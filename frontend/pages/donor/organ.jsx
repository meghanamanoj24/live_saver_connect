import Head from "next/head"
import Link from "next/link"

export default function OrganDonation() {
	return (
		<>
			<Head>
				<title>Organ Donation — LifeSaver Connect</title>
			</Head>
			<main className="min-h-screen bg-[#1A1A2E] text-white">
				<div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8 space-y-8">
					<div>
						<h1 className="text-3xl font-extrabold" style={{ fontFamily: "'Poppins', sans-serif" }}>Organ Donation</h1>
						<p className="mt-2 text-sm text-pink-100/80">Register your post-mortem organ pledge, update consents, and connect with verified centers.</p>
					</div>

					<div className="grid gap-4 sm:grid-cols-2">
						<div className="rounded-2xl border border-[#F6D6E3]/30 bg-[#131326] p-6 space-y-2">
							<h2 className="text-xl font-semibold text-white">What you can do</h2>
							<ul className="text-sm text-pink-100/80 space-y-1">
								<li>• Select organs to pledge or choose all organs</li>
								<li>• Add family consent, emergency contact, and medical student donation</li>
								<li>• Pick registered hospitals/centers to receive your pledge</li>
							</ul>
						</div>
						<div className="rounded-2xl border border-[#F6D6E3]/30 bg-[#131326] p-6 space-y-2">
							<h2 className="text-xl font-semibold text-white">Need to submit a deceased donor?</h2>
							<ul className="text-sm text-pink-100/80 space-y-1">
								<li>• Quick form for relatives with organ availability</li>
								<li>• Route requests to registered hospitals</li>
								<li>• Track emergency organ cases and alerts</li>
							</ul>
						</div>
					</div>

					<div className="flex flex-wrap gap-3">
						<Link href="/donor/donate" legacyBehavior>
							<a className="inline-flex items-center rounded-lg bg-[#E91E63] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90">Select Hospital / Center</a>
						</Link>
						<Link href="/register/organ" legacyBehavior>
							<a className="inline-flex items-center rounded-lg border border-[#F6D6E3]/40 px-5 py-3 text-sm font-semibold text-pink-100 transition hover:bg-white/10">Open Organ Pledge Flow</a>
						</Link>
						<Link href="/donor/dashboard" legacyBehavior>
							<a className="inline-flex items-center rounded-lg border border-[#F6D6E3]/40 px-5 py-3 text-sm font-semibold text-pink-100 transition hover:bg-white/10">Back to Donor Hub</a>
						</Link>
					</div>
				</div>
			</main>
		</>
	)
}

