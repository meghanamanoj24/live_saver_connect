import Head from "next/head"
import Link from "next/link"

export default function NeedsList() {
	return (
		<>
			<Head><title>Emergency Needs — LifeSaver Connect</title></Head>
			<main className="mx-auto max-w-4xl p-6">
				<div className="flex items-center justify-between">
					<h1 className="text-2xl font-bold">Emergency Needs</h1>
					<Link href="/needs/post" legacyBehavior>
						<a className="rounded bg-indigo-600 px-3 py-2 text-white">Post Need</a>
					</Link>
				</div>
				<p className="mt-2 text-gray-600">Placeholder list. Connect to API: GET /api/needs/</p>
			</main>
		</>
	)
}


