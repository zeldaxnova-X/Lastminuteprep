"""
Zero-Hallucination Validation Engine for SSC CGL Ingestion Pipeline
"""
import re
from typing import Dict, List, Any, Tuple

def validate_question(q: Dict[str, Any], existing_qnums: set, existing_qtexts: set) -> Tuple[bool, List[str], Dict[str, bool]]:
    """Validates a raw extracted question against strict Zero-Hallucination quality rules."""
    errors = []
    error_flags = {
        "missing_options": False,
        "missing_answers": False,
        "duplicate_numbering": False,
        "duplicate_text": False,
        "broken_formatting": False
    }

    # 1. Missing / Blank Question Text
    qtext = q.get("question_text") or ""
    if not qtext.strip() or len(qtext.strip()) < 3:
        if not q.get("question_image"):
            errors.append("MISSING_QUESTION_TEXT: Question text is empty or too short without diagram image.")

    # 2. Missing Options Check (Require Option A, B, C, D unless diagram question)
    opt_a = q.get("option_a")
    opt_b = q.get("option_b")
    opt_c = q.get("option_c")
    opt_d = q.get("option_d")

    missing_opts = []
    if not opt_a: missing_opts.append("Option A")
    if not opt_b: missing_opts.append("Option B")
    if not opt_c: missing_opts.append("Option C")
    if not opt_d: missing_opts.append("Option D")

    if missing_opts and not q.get("question_image"):
        errors.append(f"MISSING_OPTIONS: Missing options [{', '.join(missing_opts)}].")
        error_flags["missing_options"] = True

    # 3. Missing / Invalid Correct Answer Check
    ans = q.get("correct_answer")
    if not ans or ans not in ("A", "B", "C", "D"):
        errors.append("MISSING_CORRECT_ANSWER: Official correct answer option is missing or invalid.")
        error_flags["missing_answers"] = True

    # 4. Duplicate Question Numbering Check
    qnum = q.get("question_number")
    if qnum is not None and qnum in existing_qnums:
        errors.append(f"DUPLICATE_QUESTION_NUMBER: Question number {qnum} already exists in this paper.")
        error_flags["duplicate_numbering"] = True

    # 5. Duplicate Question Text Check
    clean_text_key = re.sub(r'\s+', ' ', qtext.lower()).strip()
    if clean_text_key and len(clean_text_key) > 15 and clean_text_key in existing_qtexts:
        errors.append("DUPLICATE_QUESTION_TEXT: Duplicate question text detected in paper.")
        error_flags["duplicate_text"] = True

    # 6. Broken Formatting / Binary Character Check
    if re.search(r'[\x00-\x08\x0B\x0C\x0E-\x1F]', qtext):
        errors.append("BROKEN_FORMATTING: Unprintable control characters detected in question text.")
        error_flags["broken_formatting"] = True

    is_valid = len(errors) == 0
    return is_valid, errors, error_flags

def process_and_validate_questions(raw_questions: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]], Dict[str, Any]]:
    """Processes raw questions and splits into validated records, review queue items, and per-paper metric flags."""
    validated = []
    failed_raw = []
    review_queue = []
    paper_metrics = {}

    papers = {}
    for q in raw_questions:
        pname = q.get("paper_name", "default")
        if pname not in papers:
            papers[pname] = []
        papers[pname].append(q)

    for pname, q_list in papers.items():
        existing_qnums = set()
        existing_qtexts = set()
        
        paper_metrics[pname] = {
            "raw_records": len(q_list),
            "validated_questions": 0,
            "manual_review": 0,
            "duplicates": 0,
            "missing_answers": 0,
            "missing_options": 0
        }

        for q in q_list:
            is_valid, errors, flags = validate_question(q, existing_qnums, existing_qtexts)

            if flags["missing_options"]: paper_metrics[pname]["missing_options"] += 1
            if flags["missing_answers"]: paper_metrics[pname]["missing_answers"] += 1
            if flags["duplicate_numbering"] or flags["duplicate_text"]: paper_metrics[pname]["duplicates"] += 1

            if is_valid:
                if q.get("question_number") is not None:
                    existing_qnums.add(q["question_number"])
                if q.get("question_text"):
                    existing_qtexts.add(re.sub(r'\s+', ' ', q["question_text"].lower()).strip())
                
                q["extraction_status"] = "validated"
                q["validation_errors"] = None
                validated.append(q)
                paper_metrics[pname]["validated_questions"] += 1
            else:
                q["extraction_status"] = "failed_validation"
                q["validation_errors"] = errors
                failed_raw.append(q)
                paper_metrics[pname]["manual_review"] += 1

                review_queue.append({
                    "raw_question_id": q["id"],
                    "paper_name": pname,
                    "question_number": q.get("question_number"),
                    "source_pdf": q.get("source_pdf"),
                    "review_reason": "; ".join(errors),
                    "details": {
                        "question_text": q.get("question_text"),
                        "errors": errors
                    }
                })

    return validated, failed_raw, review_queue, paper_metrics
