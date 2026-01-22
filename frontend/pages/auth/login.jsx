import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import { useMemo, useState } from "react"
import { API_BASE_URL } from "../../lib/api"
import { validateEmail } from "../../lib/validation"

export default function Login() {
	const [email, setEmail] = useState("")
	const [password, setPassword] = useState("")
	const [module, setModule] = useState("")
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState("")
	const router = useRouter()

	const moduleRoutes = useMemo(() => ({
		donor: "/donor/dashboard",
		hospital: "/hospital/select",
		medical_essential: "/medical-essential",
	}), [])

	async function onSubmit(e) {
		e.preventDefault()
		setError("")

		if (!email || !password) {
			setError("Please enter both email and password.")
			return
		}

		if (!validateEmail(email)) {
			setError("Please enter a valid email address.")
			return
		}

		if (!module) {
			setError("Please select which module you want to access.")
			return
		}

		setIsLoading(true)
		try {
			const response = await fetch(`${API_BASE_URL}/auth/token/`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					email,
					password,
					donor_module: module,
				}),
			})

			if (response.ok) {
				const data = await response.json()
				if (data.access) {
					localStorage.setItem("accessToken", data.access)
					if (data.refresh) localStorage.setItem("refreshToken", data.refresh)
				}

				if (typeof router.query.next === "string") {
					router.replace(router.query.next)
				} else {
					router.replace(moduleRoutes[module] ?? "/profile")
				}
			} else {
				const errorData = await response.json().catch(() => ({}))
				const errorMessage = errorData.detail || errorData.message || "Invalid credentials. Please try again."
				setError(errorMessage)
			}
		} catch (err) {
			console.error("Login error:", err)
			setError("Unable to connect to server. Please check your connection and try again.")
		} finally {
			setIsLoading(false)
		}
	}

	return (
		<>
			<Head>
				<title>Log in — LifeSaver Connect</title>
				<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@700;800&display=swap" rel="stylesheet" />
			</Head>
			<main className="min-h-screen bg-[#1A1A2E] text-white">
				<div className="mx-auto max-w-md px-4 py-12 text-center">
					<h1 className="text-3xl md:text-4xl font-extrabold" style={{ fontFamily: "'Poppins', sans-serif" }}>Log In</h1>
					<p className="mt-1 text-sm text-pink-100/90">Welcome back — please enter your details.</p>

					<form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-xl border border-[#F6D6E3] bg-transparent p-6">
						{error && (
							<div className="rounded-lg border border-[#DC2626]/60 bg-[#DC2626]/10 px-4 py-3 text-sm text-[#FCA5A5]">
								{error}
							</div>
						)}

						<div>
							<label className="block text-sm font-medium text-pink-100">Email</label>
							<input
								type="email"
								autoComplete="email"
								required
								value={email}
								onChange={(e) => {
									setEmail(e.target.value)
									setError("")
								}}
								className="mt-1 h-12 w-full rounded-lg border border-[#F6D6E3] bg-[#131326] px-3 text-sm text-white placeholder:pink-100/80 outline-none caret-[#E91E63] focus:border-[#E91E63]"
								placeholder="you@example.com"
							/>
						</div>

						<div>
							<label className="block text-sm font-medium text-pink-100">Password</label>
							<input
								type="password"
								autoComplete="current-password"
								required
								value={password}
								onChange={(e) => {
									setPassword(e.target.value)
									setError("")
								}}
								className="mt-1 h-12 w-full rounded-lg border border-[#F6D6E3] bg-[#131326] px-3 text-sm text-white placeholder:pink-100/80 outline-none caret-white focus:border-[#E91E63]"
								placeholder="••••••••"
							/>
						</div>

						<div>
							<label className="block text-sm font-medium text-pink-100">Select Module</label>
							<select
								value={module}
								onChange={(e) => {
									setModule(e.target.value)
									setError("")
								}}
								className="mt-1 h-12 w-full rounded-lg border border-[#F6D6E3] bg-[#131326] px-3 text-sm text-white outline-none focus:border-[#E91E63]"
							>
								<option value="">Choose module</option>
								<option value="donor">Donor</option>
								<option value="hospital">Hospital</option>
								<option value="medical_essential">Medical Essential</option>
							</select>
						</div>

						<button
							type="submit"
							disabled={isLoading}
							className="h-12 w-full rounded-xl bg-[#E91E63] font-semibold text-white transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-70"
						>
							{isLoading ? "Logging in..." : "Log In"}
						</button>

						<p className="text-center text-sm text-pink-100/90">
							Don’t have an account?{" "}
							<Link href="/auth/register" legacyBehavior>
								<a className="text-[#E91E63] underline">Sign Up</a>
							</Link>
						</p>
					</form>
				</div>
			</main>
		</>
	)
}
