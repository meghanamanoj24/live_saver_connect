import Head from "next/head"
import Link from "next/link"

export default function Marketplace() {
	return (
		<>
			<Head><title>Marketplace — LifeSaver Connect</title></Head>
			<main className="mx-auto max-w-4xl p-6">
				<h1 className="text-2xl font-bold">Medical Supplies Marketplace</h1>
				<p className="mt-2 text-gray-600">Placeholder list. Connect to API: GET /api/marketplace/</p>
				<div className="mt-4">
					<Link href="/item/1" legacyBehavior>
						<a className="text-indigo-600 underline">Sample Item</a>
					</Link>
				</div>
			</main>
		</>
	)
}


