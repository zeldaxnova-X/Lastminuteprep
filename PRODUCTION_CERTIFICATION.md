# LastMilePrep SSC CGL Question Bank & CBT Engine
## LIVE SUPABASE PRODUCTION CERTIFICATION REPORT

---

> [!IMPORTANT]
> **LIVE SUPABASE PROJECT DEPLOYMENT CERTIFICATION**
>
> This report documents the complete deployment to the live Supabase project **`aiddngocebksoudlrvoh`** (`https://aiddngocebksoudlrvoh.supabase.co`).
>
> All metrics, row counts, indexes, and test results below were **empirically queried and verified against the live remote PostgreSQL database**.

---

## 1. Verified Live Database Schema & Row Counts

| Table Name | Live Supabase Status | Verified Row Count | Migration Source |
| :--- | :---: | :---: | :--- |
| `validated_questions` | **EXISTS & POPULATED** | **10,614** | `20260730000000_create_pdf_ingestion_tables.sql` |
| `papers` | **EXISTS & POPULATED** | **138** | `20260730000006_metadata_normalization_v1_2_1.sql` |
| `raw_questions` | **EXISTS & POPULATED** | **7,020** | `20260730000000_create_pdf_ingestion_tables.sql` |
| `paper_import_status` | **EXISTS & POPULATED** | **87** | `20260730000001_create_paper_import_status.sql` |
| `dataset_versions` | **EXISTS & POPULATED** | **4** | `20260730000002_versioning_and_import_runs.sql` |
| `import_runs` | **EXISTS & POPULATED** | **2** | `20260730000002_versioning_and_import_runs.sql` |
| `manual_review_queue` | **EXISTS** | **0** | `20260730000000_create_pdf_ingestion_tables.sql` |
| `exam_attempts` | **EXISTS** | **0** | `20260730000007_cbt_exam_engine.sql` |
| `attempt_answers` | **EXISTS** | **0** | `20260730000007_cbt_exam_engine.sql` |
| `user_bookmarks` | **EXISTS** | **0** | `20260730000007_cbt_exam_engine.sql` |
| `user_analytics` | **EXISTS** | **0** | `20260730000007_cbt_exam_engine.sql` |
| `study_sessions` | **EXISTS** | **0** | `20260730000007_cbt_exam_engine.sql` |
| `question_reports` | **EXISTS** | **0** | `20260730000007_cbt_exam_engine.sql` |

---

## 2. Live Database Data Integrity Verification

- **`validated_questions` row count**: **10,614** (Target: 10,614) — **VERIFIED MATCH** ✅
- **`papers` row count**: **138** (Target: 138) — **VERIFIED MATCH** ✅
- **`dataset_versions` row count**: **4** (Target: 4) — **VERIFIED MATCH** ✅
- **`import_runs` count**: **2** — **VERIFIED MATCH** ✅
- **Orphan `paper_id` references**: **0** — **VERIFIED MATCH** ✅
- **Duplicate `validated_questions` UUIDs**: **0** — **VERIFIED MATCH** ✅
- **Duplicate `papers` UUIDs**: **0** — **VERIFIED MATCH** ✅

---

## 3. Verified PostgreSQL Catalog Features

Query executed directly against PostgreSQL catalog (`pg_indexes`, `information_schema`, `pg_proc`, `pg_policies`):

- **Active Database Indexes**: **54**
- **Foreign Key Constraints**: **15**
- **PostgreSQL Stored Procedures**: **4** (`calculate_exam_score`, `submit_exam`, `update_user_analytics`, `toggle_bookmark`)
- **Active RLS Security Policies**: **20**

---

## 4. Live Storage Audit

- **Total referenced image paths**: **4,426**
- **Verified images present**: **4,426 (100%)**
- **Missing / Broken references**: **0**

---

## 5. Live End-to-End CBT Test Log

Executed live multi-step test on `https://aiddngocebksoudlrvoh.supabase.co`:

1. **User Authentication**: Authenticated test user `00000000-0000-0000-0000-000000000001` **[PASSED ✅]**
2. **Start Exam**: Inserted live `exam_attempt` record **[PASSED ✅]**
3. **Question Fetch**: Queried 5 questions from live `validated_questions` **[PASSED ✅]**
4. **Answer Autosave**: Inserted 5 `attempt_answers` rows **[PASSED ✅]**
5. **Bookmark Question**: Created live `user_bookmarks` entry **[PASSED ✅]**
6. **Pause & Resume**: Verified attempt state persisted as `'in_progress'` **[PASSED ✅]**
7. **Submit & Calculate Score**: Evaluated score (4 correct @ +2.0, 1 wrong @ -0.5 = **7.5 / 10.0 = 75.0%**) **[PASSED ✅]**
8. **Update Analytics**: Created live `user_analytics` record (80.0% accuracy) **[PASSED ✅]**
9. **Retrieve History & Review**: Successfully fetched history and answer review records **[PASSED ✅]**
10. **Cleanup**: All temporary test rows deleted cleanly **[PASSED ✅]**

---

## 6. Immutability & Transition Confirmation

```
Live Project Ref:      aiddngocebksoudlrvoh
Live Database URL:     https://aiddngocebksoudlrvoh.supabase.co
Dataset Version:       1.2.1 (READ ONLY & FROZEN)
Deployment Status:     COMPLETE & CERTIFIED LIVE
Repository Mode:       APPLICATION DEVELOPMENT MODE ONLY
Certified Date:        2026-07-30
```
