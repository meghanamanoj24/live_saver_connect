import Head from "next/head"
import Link from "next/link"

export default function AppGuide() {
    return (
        <>
            <Head>
                <title>How it Works — LifeSaver Connect</title>
            </Head>
            <main className="min-h-screen bg-[#1A1A2E] text-white">
                <header className="border-b border-[#F6D6E3]/30 bg-[#131326]/80 backdrop-blur sticky top-0 z-10">
                    <div className="mx-auto flex items-center justify-between max-w-4xl px-4 py-4 sm:px-6 lg:px-8">
                        <div className="flex items-center gap-4">
                            <Link href="/donor/blood" legacyBehavior>
                                <a className="rounded-full p-2 hover:bg-white/5 transition text-pink-100/70 hover:text-white">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                    </svg>
                                </a>
                            </Link>
                            <h1 className="text-xl font-bold md:text-2xl" style={{ fontFamily: "'Poppins', sans-serif" }}>
                                User Guide
                            </h1>
                        </div>
                    </div>
                </header>

                <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">

                    {/* Intro */}
                    <div className="rounded-2xl border border-[#F6D6E3]/20 bg-[#131326] p-8">
                        <h2 className="text-2xl font-bold text-white mb-4">Welcome to LifeSaver Connect</h2>
                        <p className="text-pink-100/80 leading-relaxed">
                            Our platform bridges the gap between those in urgent need of blood and willing donors like you.
                            This guide will help you understand how to navigate the app, verify your eligibility, and make a life-saving difference.
                        </p>
                    </div>

                    {/* Step 1: Eligibility */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E91E63] font-bold text-white">1</div>
                            <h3 className="text-xl font-semibold text-white">Check Your Eligibility</h3>
                        </div>
                        <div className="ml-5 border-l-2 border-[#F6D6E3]/10 pl-8 pb-4">
                            <p className="text-pink-100/70 mb-4">Before donating, it's crucial to ensure you are healthy enough to give blood safely.</p>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="rounded-xl bg-[#1A1A2E] p-4 border border-[#F6D6E3]/10 hover:border-[#E91E63]/30 transition">
                                    <h4 className="font-semibold text-white mb-2">Health Status Tool</h4>
                                    <p className="text-sm text-pink-100/60">
                                        Use the "Update Health" button on your dashboard to report any symptoms. Our AI will analyze your health score and suggest if you can donate.
                                    </p>
                                </div>
                                <div className="rounded-xl bg-[#1A1A2E] p-4 border border-[#F6D6E3]/10 hover:border-[#E91E63]/30 transition">
                                    <h4 className="font-semibold text-white mb-2">Download Report</h4>
                                    <p className="text-sm text-pink-100/60">
                                        After checking your health, you can download a PDF report of your eligibility status to take to the hospital.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Step 2: Finding Requests */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E91E63] font-bold text-white">2</div>
                            <h3 className="text-xl font-semibold text-white">Find Donation Requests</h3>
                        </div>
                        <div className="ml-5 border-l-2 border-[#F6D6E3]/10 pl-8 pb-4">
                            <p className="text-pink-100/70 mb-4">There are two ways to find people who need help:</p>
                            <ul className="space-y-3">
                                <li className="flex gap-3">
                                    <svg className="w-6 h-6 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <div>
                                        <span className="font-semibold text-white block">Compatible Matches</span>
                                        <span className="text-sm text-pink-100/60">
                                            On your dashboard, look for "Critical Matches". These are patients who specifically need
                                            <span className="text-[#E91E63]"> your blood group</span>.
                                        </span>
                                    </div>
                                </li>
                                <li className="flex gap-3">
                                    <svg className="w-6 h-6 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    <div>
                                        <span className="font-semibold text-white block">Browse All Requests</span>
                                        <span className="text-sm text-pink-100/60">
                                            Click "View All" to see the full list of requests from all hospitals. You can filter them to find opportunities to help.
                                        </span>
                                    </div>
                                </li>
                            </ul>
                        </div>
                    </section>

                    {/* Step 3: Donating */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E91E63] font-bold text-white">3</div>
                            <h3 className="text-xl font-semibold text-white">Make a Donation</h3>
                        </div>
                        <div className="ml-5 pl-8">
                            <p className="text-pink-100/70 mb-4">Once you find a match:</p>
                            <ol className="list-decimal space-y-2 text-pink-100/80 pl-4">
                                <li>Click on the request to see details.</li>
                                <li>Contact the hospital or click "Respond" to let them know you are coming.</li>
                                <li>Arrive at the location with your ID and digital health report.</li>
                                <li>After donating, your profile will be updated with your latest life-saving contribution!</li>
                            </ol>

                            <div className="mt-8 flex justify-center">
                                <Link href="/donor/blood" legacyBehavior>
                                    <a className="rounded-xl bg-[#E91E63] px-8 py-3 font-semibold text-white shadow-lg hover:opacity-90 transition">
                                        Go to Dashboard
                                    </a>
                                </Link>
                            </div>
                        </div>
                    </section>

                </div>
            </main>
        </>
    )
}
