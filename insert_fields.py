import sys

# Read the file
with open(r'C:\live_saver_connect\frontend\pages\donor\blood.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# The code to insert
insert_code = '''						{/* Age and Weight Fields */}
						<div className="grid gap-4 sm:grid-cols-2">
							<div>
								<label className="block text-xs font-medium text-pink-100/80 mb-1">
									Age (years) <span className="text-red-400">*</span>
								</label>
								<input
									type="number"
									value={healthStatus.age}
									onChange={(e) => setHealthStatus({ ...healthStatus, age: e.target.value })}
									min="1"
									max="120"
									className="w-full rounded-lg border border-[#F6D6E3]/30 bg-[#1A1A2E] px-3 py-2 text-sm text-white outline-none focus:border-[#E91E63]"
									placeholder="e.g., 25"
									required
								/>
								<p className="text-xs text-pink-100/50 mt-1">Must be at least 18 years old</p>
							</div>
							<div>
								<label className="block text-xs font-medium text-pink-100/80 mb-1">
									Weight (kg) <span className="text-red-400">*</span>
								</label>
								<input
									type="number"
									step="0.1"
									value={healthStatus.weight}
									onChange={(e) => setHealthStatus({ ...healthStatus, weight: e.target.value })}
									min="1"
									max="300"
									className="w-full rounded-lg border border-[#F6D6E3]/30 bg-[#1A1A2E] px-3 py-2 text-sm text-white outline-none focus:border-[#E91E63]"
									placeholder="e.g., 65.5"
									required
								/>
								<p className="text-xs text-pink-100/50 mt-1">Must be more than 50 kg (110 lbs)</p>
							</div>
						</div>
'''

# Insert after line 1008 (index 1007)
lines.insert(1008, insert_code)

# Write back
with open(r'C:\live_saver_connect\frontend\pages\donor\blood.jsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Age and weight fields added successfully!")
