import Head from "next/head"
import { useRouter } from "next/router"
import { useEffect, useState } from "react"
import { apiFetch } from "../../lib/api"
import MedicalStore from "../../components/medical-essential/MedicalStore"
import Equipment from "../../components/medical-essential/Equipment"
import Profile from "../../components/medical-essential/Profile"

export default function MedicalEssentialDashboard() {
	const router = useRouter()
	const [activeTab, setActiveTab] = useState("store")
	const [profile, setProfile] = useState(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState("")

	useEffect(() => {
		loadProfile()
	}, [])

	async function loadProfile() {
		try {
			setLoading(true)
			const data = await apiFetch("/medical-essential/me/")
			setProfile(data)
		} catch (err) {
			if (err.status === 404) {
				setError("Please complete your Medical Essential profile first.")
			} else {
				setError(err.message || "Failed to load profile")
			}
		} finally {
			setLoading(false)
		}
	}

	function handleLogout() {
		localStorage.removeItem("accessToken")
		localStorage.removeItem("refreshToken")
		router.push("/auth/login")
	}

	if (loading) {
		return (
			<div className="min-h-screen bg-[#1A1A2E] text-white flex items-center justify-center">
				<div className="text-xl">Loading...</div>
			</div>
		)
	}

	if (error && !profile) {
		return (
			<div className="min-h-screen bg-[#1A1A2E] text-white flex items-center justify-center">
				<div className="text-center max-w-md px-4">
					<div className="text-red-400 mb-4">{error}</div>
					<p className="text-pink-100/70 mb-6">
						You need to complete your Medical Essential profile to access the dashboard.
					</p>
					<button
						onClick={() => router.push("/medical-essential/register")}
						className="px-6 py-2 bg-[#E91E63] rounded-lg font-medium"
					>
						Complete Profile
					</button>
				</div>
			</div>
		)
	}

	return (
		<>
			<Head>
				<title>Medical Essential Dashboard — LifeSaver Connect</title>
				<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@700;800&display=swap" rel="stylesheet" />
			</Head>

			<main className="min-h-screen bg-[#1A1A2E] text-white">
				{/* Header */}
				<header className="border-b border-[#F6D6E3]/20 bg-[#131326]">
					<div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
						<div>
							<h1 className="text-2xl font-bold" style={{ fontFamily: "'Poppins', sans-serif" }}>
								Medical Essential
							</h1>
							{profile && (
								<p className="text-sm text-pink-100/70 mt-1">
									{profile.company_name} • {profile.business_type}
								</p>
							)}
						</div>
						<div className="flex items-center gap-4">
							{profile?.api_key && (
								<div className="text-xs bg-[#1A1A2E] px-3 py-1 rounded border border-[#F6D6E3]/20">
									API: {profile.api_key.substring(0, 12)}...
								</div>
							)}
							<button
								onClick={handleLogout}
								className="px-4 py-2 text-sm bg-red-600/20 border border-red-600/40 rounded-lg hover:bg-red-600/30"
							>
								Logout
							</button>
						</div>
					</div>
				</header>

				{/* Tabs */}
				<div className="max-w-7xl mx-auto px-4 py-6">
					<div className="flex gap-2 border-b border-[#F6D6E3]/20 mb-6">
						<button
							onClick={() => setActiveTab("store")}
							className={`px-6 py-3 font-medium transition-colors ${
								activeTab === "store"
									? "border-b-2 border-[#E91E63] text-[#E91E63]"
									: "text-pink-100/70 hover:text-white"
							}`}
						>
							Medical Store
						</button>
						<button
							onClick={() => setActiveTab("equipment")}
							className={`px-6 py-3 font-medium transition-colors ${
								activeTab === "equipment"
									? "border-b-2 border-[#E91E63] text-[#E91E63]"
									: "text-pink-100/70 hover:text-white"
							}`}
						>
							Equipment
						</button>
						<button
							onClick={() => setActiveTab("profile")}
							className={`px-6 py-3 font-medium transition-colors ${
								activeTab === "profile"
									? "border-b-2 border-[#E91E63] text-[#E91E63]"
									: "text-pink-100/70 hover:text-white"
							}`}
						>
							Profile
						</button>
					</div>

					{/* Tab Content */}
					{activeTab === "store" && <MedicalStore profile={profile} />}
					{activeTab === "equipment" && <Equipment profile={profile} />}
					{activeTab === "profile" && <Profile profile={profile} onUpdate={loadProfile} />}
				</div>
			</main>
		</>
	)
}
