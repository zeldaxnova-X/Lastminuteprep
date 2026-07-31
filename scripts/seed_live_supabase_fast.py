import sqlite3
import json
import urllib.request
import urllib.error
import sys
import time

sys.stdout.reconfigure(encoding='utf-8')

supabase_url = "https://aiddngocebksoudlrvoh.supabase.co"
supabase_key = "sb_publishable_XwMkcgE8AXWvrPaXsRU_Tw_UlhaT7dI"

db_path = r"c:\Users\jijo1\OneDrive\Desktop\Lastmileprep\supabase\lastmileprep_local.db"
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

def post_batch(table_name, rows, batch_size=500):
    url = f"{supabase_url}/rest/v1/{table_name}"
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=ignore-duplicates"
    }
    
    total = len(rows)
    inserted = 0
    print(f"Seeding '{table_name}' ({total} total rows)...")
    
    for i in range(0, total, batch_size):
        chunk = rows[i:i + batch_size]
        data_bytes = json.dumps(chunk).encode('utf-8')
        req = urllib.request.Request(url, data=data_bytes, headers=headers, method='POST')
        try:
            with urllib.request.urlopen(req) as resp:
                inserted += len(chunk)
                print(f"  [{inserted}/{total}] Batch inserted ({resp.status})")
        except urllib.error.HTTPError as e:
            body = e.read().decode('utf-8', errors='ignore')
            print(f"  ❌ Batch failed at row {i}: HTTP {e.code} - {body[:200]}")
            return False
    return True

print("==================================================")
print("FAST BATCH SEEDING TO LIVE SUPABASE POSTGRESQL")
print("==================================================")

# 1. papers
print("\n--- 1. Seeding papers ---")
cursor.execute("SELECT paper_id, paper_name_original, paper_name_canonical, exam, year, tier, paper_date, shift, paper_type, expected_questions, validated_questions, source_pdf, dataset_version FROM papers;")
paper_rows = [dict(r) for r in cursor.fetchall()]
post_batch("papers", paper_rows)

# 2. paper_import_status
print("\n--- 2. Seeding paper_import_status ---")
cursor.execute("SELECT paper_name, year, shift, expected_questions, raw_records, validated_questions, manual_review, duplicates, missing_answers, missing_options, status, validation_percentage FROM paper_import_status;")
pis_rows = [dict(r) for r in cursor.fetchall()]
post_batch("paper_import_status", pis_rows)

# 3. validated_questions (10,614 rows in batches of 500)
print("\n--- 3. Seeding validated_questions (10,614 rows) ---")
cursor.execute("SELECT id, paper_name, year, shift, subject, question_number, question_text, question_image, option_a, option_b, option_c, option_d, correct_answer, official_explanation, marks, negative_marks, source_pdf, is_validated, dataset_version, paper_id FROM validated_questions ORDER BY paper_name, question_number;")
vq_rows = [dict(r) for r in cursor.fetchall()]
post_batch("validated_questions", vq_rows, batch_size=500)

conn.close()
print("\n🎉 LIVE SUPABASE SEEDING COMPLETE!")
