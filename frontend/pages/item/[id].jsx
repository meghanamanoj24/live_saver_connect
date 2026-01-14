import Head from "next/head"
import { useRouter } from "next/router"

export default function ItemDetail() {
	const router = useRouter()
	const { id } = router.query
	return (
		<>
			<Head><title>Item #{id} — LifeSaver Connect</title></Head>
			<main className="mx-auto max-w-3xl p-6">
				<h1 className="text-2xl font-bold">Item #{id}</h1>
				<p className="mt-2 text-gray-600">Placeholder detail page. Connect to API: GET /api/marketplace/{id}/</p>
			</main>
		</>
	)
}


