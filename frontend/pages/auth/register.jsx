import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import { useEffect, useMemo, useState } from "react"
import { API_BASE_URL } from "../../lib/api"
import { validateEmail, validateName, validatePassword, validatePhone } from "../../lib/validation"

export default function Register() {
    const [firstName, setFirstName] = useState("")
    const [lastName, setLastName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [bloodGroup, setBloodGroup] = useState("")
    const [gender, setGender] = useState("")
    const [phone, setPhone] = useState("")
    const [donorModule, setDonorModule] = useState("")

    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState("")
    const router = useRouter()

    const moduleRoutes = useMemo(() => ({
        donor: "/donor/dashboard",
        hospital: "/hospital/register",
        medical_essential: "/medical-essential",
    }), [])

    // useEffect(() => {
    //     if (typeof router.query.module === "string") {
    //         setDonorModule(router.query.module)
    //     }
    // }, [router.query.module])

    async function onSubmit(e) {
        e.preventDefault()
        setError("")

        if (!email || !firstName || !lastName || !donorModule || !phone) {
            setError("Please fill in all required fields.")
            return
        }

        if (!validateName(firstName)) {
            setError("First name should contain only letters and be at least 2 characters long.")
            return
        }

        if (!validateName(lastName)) {
            setError("Last name should contain only letters and be at least 2 characters long.")
            return
        }

        if (!validateEmail(email)) {
            setError("Please enter a valid email address.")
            return
        }

        if (!validatePassword(password)) {
            setError("Password must be at least 8 characters long.")
            return
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match.")
            return
        }

        if (!validatePhone(phone)) {
            setError("Please enter a valid 10-15 digit phone number.")
            return
        }

        setIsLoading(true)

        try {
            const registerResponse = await fetch(`${API_BASE_URL}/auth/register/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    first_name: firstName,
                    last_name: lastName,
                    email: email,
                    password: password,
                    confirm_password: confirmPassword,
                    blood_group: bloodGroup,
                    gender: gender,
                    phone: phone,
                    donor_module: donorModule
                }),
            })

            if (registerResponse.ok) {
                // Login immediately after registration
                const loginResponse = await fetch(`${API_BASE_URL}/auth/token/`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        email: email,
                        password: password,
                        donor_module: donorModule
                    }),
                })

                if (loginResponse.ok) {
                    const tokenData = await loginResponse.json()

                    if (tokenData.access) {
                        localStorage.setItem("accessToken", tokenData.access)
                        if (tokenData.refresh) {
                            localStorage.setItem("refreshToken", tokenData.refresh)
                        }
                    }

                    if (typeof router.query.next === "string") {
                        router.replace(router.query.next)
                    } else {
                        router.replace(moduleRoutes[donorModule] ?? "/profile")
                    }

                    return
                }
            }

            const errorData = await registerResponse.json().catch(() => ({}))
            setError(errorData.detail || errorData.message || "Registration failed.")
        } catch (err) {
            console.error("Registration error:", err)
            setError("Registration failed. Please try again.")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <>
            <Head>
                <title>Register — LifeSaver Connect</title>
                <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@700;800&display=swap" rel="stylesheet" />
            </Head>

            <main className="min-h-screen bg-[#1A1A2E] text-white">
                <div className="mx-auto max-w-md px-4 py-12 text-center">
                    <h1 className="text-3xl md:text-4xl font-extrabold">Sign Up</h1>
                    <p className="mt-1 text-sm text-pink-100/90">Create your account to get started.</p>

                    <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-xl border border-[#F6D6E3] p-6">

                        {error && (
                            <div className="rounded-lg border border-red-600/60 bg-red-600/10 px-4 py-3 text-sm text-red-300">
                                {error}
                            </div>
                        )}

                        <div className="grid gap-3 sm:grid-cols-2">
                            <input
                                type="text"
                                required
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                className="inputStyle"
                                placeholder="First Name"
                            />
                            <input
                                type="text"
                                required
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                className="inputStyle"
                                placeholder="Last Name"
                            />
                        </div>

                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="inputStyle"
                            placeholder="Email"
                        />

                        <div className="grid gap-3 sm:grid-cols-2">
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="inputStyle"
                                placeholder="Password"
                            />
                            <input
                                type="password"
                                required
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="inputStyle"
                                placeholder="Confirm Password"
                            />
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <select
                                value={bloodGroup}
                                onChange={(e) => setBloodGroup(e.target.value)}
                                className="inputStyle"
                            >
                                <option value="">Blood Group</option>
                                <option>O+</option><option>O-</option>
                                <option>A+</option><option>A-</option>
                                <option>B+</option><option>B-</option>
                                <option>AB+</option><option>AB-</option>
                            </select>

                            <select
                                value={gender}
                                onChange={(e) => setGender(e.target.value)}
                                className="inputStyle"
                            >
                                <option value="">Gender</option>
                                <option value="F">Female</option>
                                <option value="M">Male</option>
                                <option value="O">Other</option>
                            </select>
                        </div>

                        <input
                            type="tel"
                            required
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="inputStyle"
                            placeholder="Phone Number"
                        />

                        <select
                            value={donorModule}
                            onChange={(e) => setDonorModule(e.target.value)}
                            className="inputStyle"
                        >
                            <option value="">Registering For</option>
                            <option value="donor">Donor</option>
                            <option value="hospital">Hospital</option>
                            <option value="medical_essential">Medical Essential</option>
                        </select>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="h-12 w-full rounded-xl bg-[#E91E63] font-semibold"
                        >
                            {isLoading ? "Creating account..." : "Sign Up"}
                        </button>

                        <p className="text-center text-sm text-pink-100/90">
                            Already have an account?{" "}
                            <Link href="/auth/login" legacyBehavior>
                                <a className="text-[#E91E63] underline">Log in</a>
                            </Link>
                        </p>
                    </form>
                </div>
            </main>

            <style jsx>{`
                .inputStyle {
                    height: 48px;
                    width: 100%;
                    border-radius: 8px;
                    border: 1px solid #F6D6E3;
                    background: #131326;
                    padding: 0 12px;
                    font-size: 14px;
                    color: white;
                }
            `}</style>
        </>
    )
}
