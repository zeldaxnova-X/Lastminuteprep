import os
import subprocess
import sys
import glob

sys.stdout.reconfigure(encoding='utf-8')

seed_path = r"c:\Users\jijo1\OneDrive\Desktop\Lastmileprep\supabase\seed_validated_questions.sql"
chunks_dir = r"c:\Users\jijo1\OneDrive\Desktop\Lastmileprep\scratch\chunks"
os.makedirs(chunks_dir, exist_ok=True)

# Clean previous chunks
for f in glob.glob(os.path.join(chunks_dir, "*.sql")):
    try: os.remove(f)
    except: pass

print("=== SPLITTING AND EXECUTING SEED SQL CHUNKS ===")
print(f"Reading {seed_path}...")

with open(seed_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

print(f"Total lines in seed file: {len(lines)}")

# Chunk size: 10,000 lines per file (~800KB each)
chunk_size = 10000
chunk_files = []

current_chunk = []
chunk_idx = 1

for line in lines:
    current_chunk.append(line)
    if len(current_chunk) >= chunk_size:
        c_path = os.path.join(chunks_dir, f"chunk_{chunk_idx:03d}.sql")
        with open(c_path, "w", encoding="utf-8") as cf:
            cf.writelines(current_chunk)
        chunk_files.append(c_path)
        chunk_idx += 1
        current_chunk = []

if current_chunk:
    c_path = os.path.join(chunks_dir, f"chunk_{chunk_idx:03d}.sql")
    with open(c_path, "w", encoding="utf-8") as cf:
        cf.writelines(current_chunk)
    chunk_files.append(c_path)

print(f"Generated {len(chunk_files)} chunk files in {chunks_dir}.")

# Execute each chunk via npx supabase db query --linked
success_count = 0
for idx, cpath in enumerate(chunk_files, 1):
    cname = os.path.basename(cpath)
    print(f"[{idx}/{len(chunk_files)}] Executing {cname} on live database...")
    cmd = f'npx supabase db query --linked --file "{cpath}"'
    result = subprocess.run(cmd, capture_output=True, text=True, shell=True, cwd=r"c:\Users\jijo1\OneDrive\Desktop\Lastmileprep")
    
    if result.returncode == 0:
        print(f"   ✅ {cname} executed successfully.")
        success_count += 1
    else:
        print(f"   ❌ {cname} failed: {result.stderr.strip() or result.stdout.strip()}")
        sys.exit(1)

print(f"\n🎉 ALL {success_count} SEED CHUNKS APPLIED SUCCESSFULLY TO LIVE SUPABASE DB!")
