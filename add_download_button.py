import re

# Read the file
with open(r'C:\live_saver_connect\frontend\pages\donor\blood.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Find and replace - add download button after health assessment results
pattern = r'(\t\t\t\t\t\t\t\t\t\t\t\t\t</div>\r?\n\t\t\t\t\t\t\t\t\t\t\t\t\)}\r?\n\r?\n\t\t\t\t\t\t\t\t\t\t\t\t{/\* Medicine Suggestions \*/})'

replacement = r'''\t\t\t\t\t\t\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t\t\t\t\t\t)}

\t\t\t\t\t\t\t\t\t\t\t\t{/* Download Health Report Button */}
\t\t\t\t\t\t\t\t\t\t\t\t{healthAssessment && healthAssessment.canDonate && (
\t\t\t\t\t\t\t\t\t\t\t\t\t<div className="mt-4">
\t\t\t\t\t\t\t\t\t\t\t\t\t\t<button
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\ttype="button"
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tonClick={generateHealthReportPDF}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tclassName="w-full rounded-lg bg-gradient-to-r from-[#E91E63] to-[#D81B60] px-6 py-3 text-sm font-bold text-white shadow-lg hover:shadow-xl hover:from-[#D81B60] hover:to-[#C2185B] transition-all flex items-center justify-center gap-2"
\t\t\t\t\t\t\t\t\t\t\t\t\t\t>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t</svg>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tDownload Health Report PDF
\t\t\t\t\t\t\t\t\t\t\t\t\t\t</button>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t<p className="mt-2 text-xs text-pink-100/60 text-center">
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t📋 Required for platelet donation requests
\t\t\t\t\t\t\t\t\t\t\t\t\t\t</p>
\t\t\t\t\t\t\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t\t\t\t\t\t)}

\t\t\t\t\t\t\t\t\t\t\t\t{/* Medicine Suggestions */}'''

if re.search(pattern, content):
    content = re.sub(pattern, replacement, content)
    with open(r'C:\live_saver_connect\frontend\pages\donor\blood.jsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Added Download Health Report button successfully!")
else:
    print("Pattern not found, trying simpler approach...")
    # Try simpler string replacement
    search_str = '\t\t\t\t\t\t\t\t\t\t\t\t\t</div>\r\n\t\t\t\t\t\t\t\t\t\t\t\t)}\r\n\r\n\t\t\t\t\t\t\t\t\t\t\t\t{/* Medicine Suggestions */}'
    
    replace_str = '''\t\t\t\t\t\t\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t\t\t\t\t\t)}

\t\t\t\t\t\t\t\t\t\t\t\t{/* Download Health Report Button */}
\t\t\t\t\t\t\t\t\t\t\t\t{healthAssessment && healthAssessment.canDonate && (
\t\t\t\t\t\t\t\t\t\t\t\t\t<div className="mt-4">
\t\t\t\t\t\t\t\t\t\t\t\t\t\t<button
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\ttype="button"
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tonClick={generateHealthReportPDF}
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tclassName="w-full rounded-lg bg-gradient-to-r from-[#E91E63] to-[#D81B60] px-6 py-3 text-sm font-bold text-white shadow-lg hover:shadow-xl hover:from-[#D81B60] hover:to-[#C2185B] transition-all flex items-center justify-center gap-2"
\t\t\t\t\t\t\t\t\t\t\t\t\t\t>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t</svg>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\tDownload Health Report PDF
\t\t\t\t\t\t\t\t\t\t\t\t\t\t</button>
\t\t\t\t\t\t\t\t\t\t\t\t\t\t<p className="mt-2 text-xs text-pink-100/60 text-center">
\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t📋 Required for platelet donation requests
\t\t\t\t\t\t\t\t\t\t\t\t\t\t</p>
\t\t\t\t\t\t\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t\t\t\t\t\t)}

\t\t\t\t\t\t\t\t\t\t\t\t{/* Medicine Suggestions */}'''
    
    if search_str in content:
        content = content.replace(search_str, replace_str)
        with open(r'C:\live_saver_connect\frontend\pages\donor\blood.jsx', 'w', encoding='utf-8') as f:
            f.write(content)
        print("Added Download Health Report button successfully (simple replace)!")
    else:
        print("Could not find pattern to replace")
