import Head from "next/head"
import Link from "next/link"
import { useState } from "react"

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
const GENDERS = ["Female", "Male", "Non-binary", "Prefer not to say"]

export default function ProfileDashboard() {
	// Placeholder state; in a real app, fetch profile via token and prefill
	const [fullName, setFullName] = useState("Donor Name")
	const [email] = useState("donor@example.com")
	const [bloodGroup, setBloodGroup] = useState("O+")
	const [city, setCity] = useState("")
	const [zip, setZip] = useState("")
	const [phone, setPhone] = useState("")
	const [whatsapp, setWhatsapp] = useState("")
	const [isPlatelet, setIsPlatelet] = useState(false)
	const [gender, setGender] = useState("Prefer not to say")
	const [dateOfBirth, setDateOfBirth] = useState("")
	const [lastDonationDate, setLastDonationDate] = useState("")
	const [bio, setBio] = useState("")
	const [emergencyAvailable, setEmergencyAvailable] = useState(true)
	const [nextAvailableDate, setNextAvailableDate] = useState("")

	function onSave(e) {
		e.preventDefault()
		// TODO: PUT/PATCH /api/donors/:id
		alert("Profile saved (placeholder).")
	}

	return (
		<>
			<Head><title>Your Dashboard — LifeSaver Connect</title></Head>
			<main className="min-h-screen bg-gradient-to-b from-white to-brand-50">
				<section className="relative">
					<div className="absolute inset-0 -z-10 opacity-20">
						<div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-brand-100 blur-3xl" />
						<div className="absolute top-40 -left-20 h-72 w-72 rounded-full bg-rose-100 blur-3xl" />
					</div>

					<div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
						{/* Hero card */}
						<div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
							<div className="flex flex-col items-start gap-5 md:flex-row md:items-center md:justify-between">
								<div className="flex items-center gap-4">
									<div className="relative h-16 w-16 overflow-hidden rounded-full ring-2 ring-brand-100">
										<img
											alt="Avatar"
											src="https://api.dicebear.com/8.x/initials/svg?seed=DC&backgroundType=gradientLinear"
											className="h-full w-full object-cover"
										/>
									</div>
									<div>
										<h1 className="text-2xl font-bold text-ink">{fullName}</h1>
										<div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
											<span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-brand-800 ring-1 ring-brand-100">
												<span className="h-2 w-2 rounded-full bg-brand-500" /> {bloodGroup} Donor
											</span>
											<span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-amber-800 ring-1 ring-amber-100">
												🏅 Trusted
											</span>
											{emergencyAvailable ? (
												<span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700 ring-1 ring-emerald-100">
													<span className="h-2 w-2 rounded-full bg-emerald-500" /> Emergency Available
												</span>
											) : (
												<span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2.5 py-1 text-gray-700 ring-1 ring-gray-200">
													<span className="h-2 w-2 rounded-full bg-gray-400" /> Not Available
												</span>
											)}
										</div>
										<p className="mt-2 text-sm text-slate-600">{bio || "Add a short bio to let coordinators know more about you."}</p>
									</div>
								</div>
								<div className="flex gap-3">
									<Link href="/needs" legacyBehavior>
										<a className="rounded-md border border-brand-600 px-4 py-2 text-brand-700 hover:bg-brand-50 transition">Browse Needs</a>
									</Link>
									<Link href="/needs/post" legacyBehavior>
										<a className="rounded-md bg-brand-600 px-4 py-2 text-white hover:bg-brand-700 transition">Post Need</a>
									</Link>
								</div>
							</div>
						</div>

						<div className="mt-6 grid gap-6 md:grid-cols-5">
							{/* Left column: Profile */}
							<div className="md:col-span-3 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
								<h2 className="text-lg font-semibold text-ink">Donor Profile</h2>
								<form onSubmit={onSave} className="mt-4 space-y-5">
									<div className="grid gap-4 sm:grid-cols-2">
										<div>
											<label className="block text-sm font-medium text-ink">Full Name</label>
											<input
												type="text"
												required
												value={fullName}
												onChange={(e) => setFullName(e.target.value)}
												className="mt-1 h-11 w-full rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-ink">Email</label>
											<input
												type="email"
												disabled
												value={email}
												className="mt-1 h-11 w-full rounded-md border border-gray-200 bg-gray-50 px-3 text-sm text-slate-600"
											/>
										</div>
									</div>

									<div className="grid gap-4 sm:grid-cols-3">
										<div>
											<label className="block text-sm font-medium text-ink">Blood Group</label>
											<select
												value={bloodGroup}
												onChange={(e) => setBloodGroup(e.target.value)}
												className="mt-1 h-11 w-full rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
											>
												{BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
											</select>
										</div>
										<div>
											<label className="block text-sm font-medium text-ink">Gender</label>
											<select
												value={gender}
												onChange={(e) => setGender(e.target.value)}
												className="mt-1 h-11 w-full rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
											>
												{GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
											</select>
										</div>
										<div className="flex items-end gap-2">
											<input
												id="platelet"
												type="checkbox"
												checked={isPlatelet}
												onChange={(e) => setIsPlatelet(e.target.checked)}
												className="h-5 w-5 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
											/>
											<label htmlFor="platelet" className="text-sm text-ink">Available for platelet donation</label>
										</div>
									</div>

									<div className="grid gap-4 sm:grid-cols-3">
										<div>
											<label className="block text-sm font-medium text-ink">Date of Birth</label>
											<input
												type="date"
												value={dateOfBirth}
												onChange={(e) => setDateOfBirth(e.target.value)}
												className="mt-1 h-11 w-full rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-ink">Last Donation Date</label>
											<input
												type="date"
												value={lastDonationDate}
												onChange={(e) => setLastDonationDate(e.target.value)}
												className="mt-1 h-11 w-full rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-ink">City</label>
											<input
												type="text"
												required
												value={city}
												onChange={(e) => setCity(e.target.value)}
												className="mt-1 h-11 w-full rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-ink">Zip / Pincode</label>
											<input
												type="text"
												value={zip}
												onChange={(e) => setZip(e.target.value)}
												className="mt-1 h-11 w-full rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
											/>
										</div>
									</div>

									<div className="grid gap-4 sm:grid-cols-2">
										<div>
											<label className="block text-sm font-medium text-ink">Phone (SMS)</label>
											<input
												type="tel"
												required
												value={phone}
												onChange={(e) => setPhone(e.target.value)}
												className="mt-1 h-11 w-full rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-ink">WhatsApp Number</label>
											<input
												type="tel"
												value={whatsapp}
												onChange={(e) => setWhatsapp(e.target.value)}
												className="mt-1 h-11 w-full rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
											/>
										</div>
									</div>

									<div>
										<label className="block text-sm font-medium text-ink">Bio</label>
										<textarea
											rows={3}
											value={bio}
											onChange={(e) => setBio(e.target.value)}
											className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
											placeholder="Share a little about why you donate and any preferences."
										/>
									</div>

									<div className="grid gap-4 sm:grid-cols-2">
										<div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
											<div>
												<p className="text-sm font-medium text-ink">Emergency Availability</p>
												<p className="text-xs text-slate-600">Let coordinators contact you for urgent cases</p>
											</div>
											<button
												type="button"
												onClick={() => setEmergencyAvailable((v) => !v)}
												className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
													emergencyAvailable ? "bg-emerald-500" : "bg-gray-300"
												}`}
											>
												<span
													className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
														emergencyAvailable ? "translate-x-6" : "translate-x-1"
													}`}
												/>
											</button>
										</div>
										<div>
											<label className="block text-sm font-medium text-ink">Next Available Date</label>
											<input
												type="date"
												value={nextAvailableDate}
												onChange={(e) => setNextAvailableDate(e.target.value)}
												className="mt-1 h-11 w-full rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
											/>
										</div>
									</div>

									<button type="submit" className="h-11 w-full rounded-md bg-brand-600 text-white hover:bg-brand-700 transition">
										Save Changes
									</button>
								</form>
							</div>

							{/* Right column: Stats + Preferences */}
							<div className="md:col-span-2 space-y-6">
								<div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
									<h2 className="text-lg font-semibold text-ink">Impact Stats</h2>
									<div className="mt-4 grid grid-cols-3 gap-4 text-center">
										<div className="rounded-lg border border-gray-200 p-4">
											<p className="text-2xl font-bold text-ink">5</p>
											<p className="text-xs text-slate-600">Total Donations</p>
										</div>
										<div className="rounded-lg border border-gray-200 p-4">
											<p className="text-2xl font-bold text-ink">12</p>
											<p className="text-xs text-slate-600">Lives Impacted</p>
										</div>
										<div className="rounded-lg border border-gray-200 p-4">
											<p className="text-2xl font-bold text-ink">{isPlatelet ? "Yes" : "No"}</p>
											<p className="text-xs text-slate-600">Platelet Donor</p>
										</div>
									</div>
								</div>

								<div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
									<h2 className="text-lg font-semibold text-ink">Achievements</h2>
									<div className="mt-4 flex flex-wrap gap-2">
										<span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-3 py-1 text-violet-700 ring-1 ring-violet-100">🏆 3x Donor</span>
										<span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-3 py-1 text-sky-700 ring-1 ring-sky-100">⏱ Rapid Responder</span>
										<span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 ring-1 ring-emerald-100">💚 Emergency Hero</span>
									</div>
								</div>

								<div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
									<h2 className="text-lg font-semibold text-ink">Notification Preferences</h2>
									<ul className="mt-4 space-y-3 text-sm text-slate-700">
										<li>• Receive SMS alerts for matching blood group in your city</li>
										<li>• Receive WhatsApp alerts when opt-in is enabled</li>
										<li>• Change proximity rules (city / pincode)</li>
									</ul>
									<div className="mt-6 rounded-lg bg-brand-50 p-4 text-brand-900 border border-brand-100">
										<p className="text-sm">
											For real-time messaging, integrate providers like Twilio or WhatsApp Business API.
										</p>
									</div>
								</div>
							</div>
						</div>

						{/* Donation History */}
						<div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
							<h2 className="text-lg font-semibold text-ink">Donation History</h2>
							<ol className="mt-4 space-y-4">
								<li className="flex items-start gap-3">
									<span className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-500" />
									<div className="flex-1 rounded-lg border border-gray-200 p-4">
										<div className="flex items-center justify-between text-sm">
											<p className="font-medium text-ink">Whole Blood • City Hospital</p>
											<p className="text-slate-600">2025-06-12</p>
										</div>
										<p className="mt-1 text-sm text-slate-700">A+ patient, 1 unit</p>
									</div>
								</li>
								<li className="flex items-start gap-3">
									<span className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-500" />
									<div className="flex-1 rounded-lg border border-gray-200 p-4">
										<div className="flex items-center justify-between text-sm">
											<p className="font-medium text-ink">Platelets • Mercy Care</p>
											<p className="text-slate-600">2025-03-02</p>
										</div>
										<p className="mt-1 text-sm text-slate-700">Emergency case</p>
									</div>
								</li>
							</ol>
						</div>
					</div>
				</section>
			</main>
		</>
	)
}

