import re

# Read the file
with open(r'C:\live_saver_connect\frontend\pages\donor\blood.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add id to Health Status section
content = content.replace(
    '{/* Health Status Section */}\r\n\t\t\t\t\t\t\t\t\t\t\t<div className="mt-6 rounded-xl border border-[#F6D6E3]/30 bg-[#1A1A2E] p-6">',
    '{/* Health Status Section */}\r\n\t\t\t\t\t\t\t\t\t\t\t<div id="health-status" className="mt-6 rounded-xl border border-[#F6D6E3]/30 bg-[#1A1A2E] p-6">'
)

# Write back
with open(r'C:\live_saver_connect\frontend\pages\donor\blood.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Added id='health-status' to Health Status section!")
