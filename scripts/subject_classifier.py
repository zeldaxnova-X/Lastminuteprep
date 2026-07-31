"""
Deterministic Subject Classification Engine for Dataset Version 1.1
Categorizes validated SSC CGL questions using priority-weighted deterministic rules.
Priority Order: English (1) > Quant (2) > Reasoning (3) > GK (4)
"""
import re
import json
import sqlite3
from typing import Dict, List, Any, Tuple, Optional

ENGLISH_PATTERNS = [
    r'fill in (?:the )?blank', r'blank (?:number|no|\d+)', r'\bsynonym\b', r'\bantonym\b', r'\bidiom\b',
    r'one word substitution', r'spelling', r'correct(?:ly)? spell', r'\bspelt\b', r'meaning of the (?:given|underlined)',
    r'sentence improvement', r'\bpassage\b', r'\bcomprehension\b', r'\bgrammar\b', r'active voice', r'passive voice',
    r'direct speech', r'indirect speech', r'cloze test', r'error spotting', r'select the correct word',
    r'\bvocabulary\b', r'underlined (?:word|idiom|phrase)', r'word in bold', r'word in brackets',
    r'most appropriate option to fill', r'incorrectly spelt'
]

QUANT_PATTERNS = [
    r'%', r'√', r'²', r'³', r'π', r'\\frac', r'\\sqrt', r'\bratio\b', r'\bproportion\b', r'\bprofit\b',
    r'\bloss\b', r'\bSI\b', r'\bCI\b', r'\bLCM\b', r'\bHCF\b', r'\bspeed\b', r'\bdistance\b', r'\btime\b',
    r'\bpipe\b', r'\bcistern\b', r'\bprobability\b', r'\balgebra\b', r'\bgeometry\b', r'\bmensuration\b',
    r'\btriangle\b', r'\bcircle\b', r'\bnumber system\b', r'\bfraction\b', r'\barea\b', r'\bperimeter\b',
    r'\bvolume\b', r'\bangle\b', r'\btan\b', r'\bcos\b', r'\bsin\b', r'\bsec\b', r'\bcosec\b', r'\bcot\b',
    r'\bequation\b', r'\bdivisible\b', r'\bremainder\b', r'\bdiscount\b', r'\bmarked price\b',
    r'\bcost price\b', r'\bselling price\b', r'\bsimple interest\b', r'\bcompound interest\b',
    r'\baverage\b', r'\bmedian\b', r'\bmode\b', r'\bhypotenuse\b', r'\bradius\b', r'\bdiameter\b',
    r'\bquadrilateral\b', r'\brhombus\b', r'\btrapezium\b', r'\bpolygon\b', r'\bsum of money\b',
    r'\bfinish a task\b', r'\bdays\b', r'=\s*\d+', r'[0-9]+\s*[\+\-\*/]\s*[0-9]+'
]

REASONING_PATTERNS = [
    r'coding', r'decoding', r'code language', r'blood relation', r'mirror image', r'embedded figure',
    r'analogy', r'classification', r'series', r'missing number', r'syllogism',
    r'statement (?:and|&) conclusion', r'statements? (?:are|is) followed by', r'\bdirection\b',
    r'\bclock\b', r'\bcalendar\b', r'\bdice\b', r'\bcube\b', r'\bvenn\b', r'paper folding',
    r'\bmatrix\b', r'which option replaces', r'figure series', r'logical order', r'dictionary order',
    r'seating arrangement', r'related to each other in a certain way'
]

GK_PATTERNS = [
    r'\bhistory\b', r'\bgeography\b', r'\beconomics\b', r'\bpolity\b', r'\bscience\b', r'current affairs',
    r'constitution', r'\barticle \d+\b', r'\briver\b', r'\bmountain\b', r'\baward\b', r'\bbook\b',
    r'\bauthor\b', r'\bphysics\b', r'\bchemistry\b', r'\bbiology\b', r'government scheme',
    r'national park', r'\bcurrency\b', r'capital of', r'\bcountry\b', r'\bplanet\b', r'\bfestival\b',
    r'\bsports\b', r'\bdynasty\b', r'\bemperor\b', r'\bsultan\b', r'\bcommission\b', r'fundamental right',
    r'\bamendment\b', r'\bgovernor\b', r'\bviceroy\b', r'battle of', r'\btreaty\b', r'\borganism\b',
    r'\belement\b', r'periodic table', r'\bacid\b', r'\bbase\b', r'\benzyme\b', r'\bcell\b',
    r'\btrophy\b', r'\bcup\b', r'\bstadium\b', r'dance form', r'\bmonument\b'
]

def classify_question_text(question_text: str) -> Tuple[str, float, str, List[str]]:
    """
    Deterministic rule engine. Returns (predicted_subject, confidence, method, matched_rules).
    Priority Order: English (1) > Quant (2) > Reasoning (3) > GK (4)
    """
    if not question_text:
        return ("General Intelligence & Reasoning", 0.50, "FALLBACK_DEFAULT", [])

    text_lower = question_text.lower()
    
    eng_matches = [p for p in ENGLISH_PATTERNS if re.search(p, text_lower, re.I)]
    quant_matches = [p for p in QUANT_PATTERNS if re.search(p, text_lower, re.I)]
    reas_matches = [p for p in REASONING_PATTERNS if re.search(p, text_lower, re.I)]
    gk_matches = [p for p in GK_PATTERNS if re.search(p, text_lower, re.I)]

    # Priority 1: English Comprehension
    if eng_matches:
        conf = 0.98 if len(eng_matches) >= 2 or not quant_matches else 0.85
        return ("English Comprehension", conf, "RULE_PRIORITY_1_ENGLISH", eng_matches)

    # Priority 2: Quantitative Aptitude
    if quant_matches:
        conf = 0.95 if len(quant_matches) >= 2 or not reas_matches else 0.80
        return ("Quantitative Aptitude", conf, "RULE_PRIORITY_2_QUANT", quant_matches)

    # Priority 3: General Intelligence & Reasoning
    if reas_matches:
        conf = 0.92 if len(reas_matches) >= 2 or not gk_matches else 0.80
        return ("General Intelligence & Reasoning", conf, "RULE_PRIORITY_3_REASONING", reas_matches)

    # Priority 4: General Awareness
    if gk_matches:
        conf = 0.90
        return ("General Awareness", conf, "RULE_PRIORITY_4_GK", gk_matches)

    # Default Fallback
    return ("General Intelligence & Reasoning", 0.60, "RULE_FALLBACK", [])

def run_subject_classification_pipeline(db_path: str) -> Dict[str, Any]:
    """Executes deterministic subject classification across validated_questions table."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    try:
        cursor.execute("ALTER TABLE validated_questions ADD COLUMN predicted_subject TEXT;")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE validated_questions ADD COLUMN classification_confidence REAL;")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE validated_questions ADD COLUMN classification_method TEXT;")
    except Exception:
        pass

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS subject_review_queue (
        id TEXT PRIMARY KEY,
        question_id TEXT REFERENCES validated_questions(id) ON DELETE CASCADE,
        paper_name TEXT NOT NULL,
        question_number INTEGER,
        original_subject TEXT,
        predicted_subject TEXT,
        confidence REAL,
        matched_rules TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    cursor.execute("SELECT COUNT(*) FROM validated_questions;")
    total_q = cursor.fetchone()[0]

    cursor.execute("SELECT id, paper_name, question_number, subject, question_text FROM validated_questions;")
    questions = cursor.fetchall()

    orig_dist = {}
    new_dist = {}
    reclassified_count = 0
    review_queue_items = []
    corrected_examples = []

    for q in questions:
        q_id = q["id"]
        paper_name = q["paper_name"]
        q_num = q["question_number"]
        orig_sub = q["subject"]
        q_text = q["question_text"]

        orig_dist[orig_sub] = orig_dist.get(orig_sub, 0) + 1

        pred_sub, conf, method, matches = classify_question_text(q_text)

        new_dist[pred_sub] = new_dist.get(pred_sub, 0) + 1

        if pred_sub != orig_sub:
            reclassified_count += 1
            if len(corrected_examples) < 15:
                corrected_examples.append({
                    "id": q_id,
                    "paper_name": paper_name,
                    "question_number": q_num,
                    "original_subject": orig_sub,
                    "predicted_subject": pred_sub,
                    "confidence": conf,
                    "question_text": q_text[:90] + "..." if len(q_text) > 90 else q_text
                })

        if conf < 0.75:
            review_queue_items.append({
                "id": q_id,
                "question_id": q_id,
                "paper_name": paper_name,
                "question_number": q_num,
                "original_subject": orig_sub,
                "predicted_subject": pred_sub,
                "confidence": conf,
                "matched_rules": json.dumps(matches)
            })

        cursor.execute("""
        UPDATE validated_questions
        SET predicted_subject = ?, classification_confidence = ?, classification_method = ?
        WHERE id = ?;
        """, (pred_sub, conf, method, q_id))

    cursor.execute("DELETE FROM subject_review_queue;")
    for item in review_queue_items:
        cursor.execute("""
        INSERT INTO subject_review_queue (id, question_id, paper_name, question_number, original_subject, predicted_subject, confidence, matched_rules)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?);
        """, (item["id"], item["question_id"], item["paper_name"], item["question_number"], item["original_subject"], item["predicted_subject"], item["confidence"], item["matched_rules"]))

    conn.commit()
    conn.close()

    return {
        "total_questions": total_q,
        "original_subject_distribution": orig_dist,
        "new_subject_distribution": new_dist,
        "questions_reclassified": reclassified_count,
        "questions_requiring_manual_review": len(review_queue_items),
        "corrected_examples": corrected_examples
    }

if __name__ == "__main__":
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    db_file = r"c:\Users\jijo1\OneDrive\Desktop\Lastmileprep\supabase\lastmileprep_local.db"
    res = run_subject_classification_pipeline(db_file)
    
    with open(r"c:\Users\jijo1\OneDrive\Desktop\Lastmileprep\reports\subject_classification_report.json", "w", encoding="utf-8") as f:
        json.dump(res, f, indent=2)

    print("==================================================")
    print("DETERMINISTIC SUBJECT CLASSIFICATION COMPLETED")
    print("==================================================")
    print(f"Total Questions Processed: {res['total_questions']}")
    print(f"Questions Reclassified: {res['questions_reclassified']}")
    print(f"Questions in Review Queue: {res['questions_requiring_manual_review']}")
    print("\nOriginal Subject Distribution:")
    print(json.dumps(res['original_subject_distribution'], indent=2))
    print("\nNew Predicted Subject Distribution:")
    print(json.dumps(res['new_subject_distribution'], indent=2))
