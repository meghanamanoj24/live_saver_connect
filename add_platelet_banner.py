import re

# Read the file
with open(r'C:\live_saver_connect\frontend\pages\donor\platelets.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add health verification banner before "My Platelet Requests Section"
search_pattern = r'(\t\t\t\t\t\t\t{/\* My Platelet Requests Section \(New\) \*/}\r?\n\t\t\t\t\t\t\t<div className="rounded-2xl border border-\[#F6D6E3\] bg-\[#131326\] p-8 shadow-xl">)'

banner_code = '''\t\t\t\t\t\t\t{/* Health Verification Banner */}
\t\t\t\t\t\t\t{!healthReportUploaded && (
\t\t\t\t\t\t\t\t<div className="rounded-2xl border-2 border-yellow-500/50 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 p-6 mb-6 shadow-lg">
\t\t\t\t\t\t\t\t\t<div className="flex items-start gap-4">
\t\t\t\t\t\t\t\t\t\t<div className="flex-shrink-0">
\t\t\t\t\t\t\t\t\t\t\t<div className="h-12 w-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
\t\t\t\t\t\t\t\t\t\t\t\t<svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
\t\t\t\t\t\t\t\t\t\t\t\t\t<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
\t\t\t\t\t\t\t\t\t\t\t\t</svg>
\t\t\t\t\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t\t\t\t<div className="flex-1">
\t\t\t\t\t\t\t\t\t\t\t<h3 className="text-lg font-bold text-yellow-300 mb-2">Health Verification Required</h3>
\t\t\t\t\t\t\t\t\t\t\t<p className="text-sm text-yellow-100/90 mb-4">
\t\t\t\t\t\t\t\t\t\t\t\tBefore requesting platelet donations, you must complete a health assessment and upload your health report.
\t\t\t\t\t\t\t\t\t\t\t</p>
\t\t\t\t\t\t\t\t\t\t\t<div className="flex flex-col sm:flex-row gap-3">
\t\t\t\t\t\t\t\t\t\t\t\t<Link href="/donor/blood#health-status" legacyBehavior>
\t\t\t\t\t\t\t\t\t\t\t\t\t<a className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#E91E63] px-5 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-[#D81B60] transition-all">
\t\t\t\t\t\t\t\t\t\t\t\t\t\t<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
\t\t\t\t\t\t\t\t\t\t\t\t\t\t</svg>
\t\t\t\t\t\t\t\t\t\t\t\t\t\tCheck Health Status
\t\t\t\t\t\t\t\t\t\t\t\t\t</a>
\t\t\t\t\t\t\t\t\t\t\t\t</Link>
\t\t\t\t\t\t\t\t\t\t\t\t<div className="flex-1">
\t\t\t\t\t\t\t\t\t\t\t\t\t<label className="block">
\t\t\t\t\t\t\t\t\t\t\t\t\t\t<input
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\ttype="file"
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\taccept="application/pdf"
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tonChange={handleHealthReportUpload}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tclassName="hidden"
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tid="health-report-upload"
\t\t\t\t\t\t\t\t\t\t\t\t\t\t/>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t<span className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-yellow-400 px-5 py-2.5 text-sm font-bold text-yellow-300 hover:bg-yellow-400/10 transition-all cursor-pointer">
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t</svg>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tUpload Health Report PDF
\t\t\t\t\t\t\t\t\t\t\t\t\t\t</span>
\t\t\t\t\t\t\t\t\t\t\t\t\t</label>
\t\t\t\t\t\t\t\t\t\t\t\t\t{uploadError && (
\t\t\t\t\t\t\t\t\t\t\t\t\t\t<p className="mt-2 text-xs text-red-300">{uploadError}</p>
\t\t\t\t\t\t\t\t\t\t\t\t\t)}
\t\t\t\t\t\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t)}

\t\t\t\t\t\t\t{/* Upload Success Banner */}
\t\t\t\t\t\t\t{healthReportUploaded && (
\t\t\t\t\t\t\t\t<div className="rounded-2xl border-2 border-green-500/50 bg-gradient-to-r from-green-500/10 to-emerald-500/10 p-4 mb-6">
\t\t\t\t\t\t\t\t\t<div className="flex items-center gap-3">
\t\t\t\t\t\t\t\t\t\t<div className="flex-shrink-0">
\t\t\t\t\t\t\t\t\t\t\t<div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
\t\t\t\t\t\t\t\t\t\t\t\t<svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
\t\t\t\t\t\t\t\t\t\t\t\t\t<path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
\t\t\t\t\t\t\t\t\t\t\t\t</svg>
\t\t\t\t\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t\t\t\t<div className="flex-1">
\t\t\t\t\t\t\t\t\t\t\t<p className="text-sm font-semibold text-green-300">✓ Health Report Verified</p>
\t\t\t\t\t\t\t\t\t\t\t<p className="text-xs text-green-200/80 mt-0.5">You can now request platelet donations</p>
\t\t\t\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t)}

\t\t\t\t\t\t\t{/* My Platelet Requests Section (New) */}
\t\t\t\t\t\t\t<div className="rounded-2xl border border-[#F6D6E3] bg-[#131326] p-8 shadow-xl">'''

content = re.sub(search_pattern, banner_code, content)

# Write back
with open(r'C:\live_saver_connect\frontend\pages\donor\platelets.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Added health verification banner successfully!")
