import Head from "next/head"
import { useRouter } from "next/router"

export default function HospitalReviews() {
	const router = useRouter()
	const { id } = router.query
	return (
		<>
			<Head><title>Hospital Reviews — LifeSaver Connect</title></Head>
			<main className="mx-auto max-w-3xl p-6">
				<h1 className="text-2xl font-bold">Hospital #{id} Reviews</h1>
				<p className="mt-2 text-gray-600">Placeholder list. Connect to API: GET /api/reviews/?hospital={id}</p>
			</main>
		</>
	)
}


