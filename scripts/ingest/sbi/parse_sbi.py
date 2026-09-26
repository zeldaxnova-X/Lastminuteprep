#!/usr/bin/env python3
"""
SBI Clerk PDF -> normalized questions JSON, with a QC gate and a dry-run report.

Parameterised by exam: writes ONLY under out/<exam_code>/. Never touches another
exam's namespace. Two source formats are auto-detected:

  * prepp    : "Que. N" + options "1."-"5." + "Correct Option - N" (inline key)
  * adda247  : section headers + options "a."-"e." + a separate solutions section

QC gate (reject, never silently fix):
  - stem present; exactly `optionsCount` well-formed options; exactly one correct
    answer; answer key in range
  - section tag must be one of the exam blueprint's sections
For prepp (no section labels) sections are recovered by a keyword classifier and
then VALIDATED against the blueprint: the questions must fall into contiguous
blocks whose sizes match the blueprint counts; otherwise the paper's questions
are rejected to the review report rather than guessed.

Usage:
  python parse_sbi.py "<file-or-folder.pdf>" --exam sbi-clerk-prelims [--out data/ingested_sbi] [--emit]

Without --emit it is a DRY RUN: prints/writes the rejection report only.
"""
import sys, os, re, json, hashlib, argparse
from collections import Counter

try:
    import pdfplumber  # correct visual reading order (fitz scrambles option order)
except ImportError:
    sys.exit("pdfplumber is required: pip install pdfplumber")

# ---- Exam blueprints (mirror src/lib/exam/exam-config.ts; parser-local copy) ----
BLUEPRINTS = {
    "sbi-clerk-prelims": {
        "optionsCount": 5,
        "totalQuestions": 100,
        "sections": [
            {"key": "english", "count": 30, "names": ["english language", "english"]},
            {"key": "numerical_ability", "count": 35, "names": ["numerical ability", "quantitative aptitude", "numerical"]},
            {"key": "reasoning", "count": 35, "names": ["reasoning ability", "reasoning"]},
        ],
    },
}

# ---- Section keyword classifier (prepp fallback; content-based) -----------------
ENGLISH_KW = re.compile(r"\b(passage|sentence|paragraph|word|phrase|grammar|error|cloze|synonym|antonym|idiom|vocabulary|comprehension|rearrange|bold|underlined|meaning)\b", re.I)
NUMERIC_KW = re.compile(r"(\d+\s*%|\bratio\b|\baverage\b|\bprofit\b|\binterest\b|\bpercentage\b|\bspeed\b|\bdiscount\b|\bcompound\b|\bsimple interest\b|\bquantity\b|\bnumber series\b|wrong term|approximate value|what will come in place|\bsum of\b|\bcost price\b|\bselling price\b)", re.I)
REASON_KW = re.compile(r"\b(sitting|arrangement|blood relation|syllogism|direction|coding|decoding|inequalit|puzzle|ranking|seating|facing|immediate neighbour|series of letters|alphanumeric|which of the (following )?(statement|conclusion)|to the (left|right) of)\b", re.I)

def classify(stem: str) -> str:
    s = stem or ""
    scores = {
        "english": len(ENGLISH_KW.findall(s)),
        "numerical_ability": len(NUMERIC_KW.findall(s)),
        "reasoning": len(REASON_KW.findall(s)),
    }
    best = max(scores, key=lambda k: scores[k])
    return best if scores[best] > 0 else ""

# Source watermarks that leak into extracted text; stripped from stems + options.
WATERMARK = re.compile(
    r"\s*(www\.)?prepp\.in\s*|\s*Testbook Solution\s*|\s*Testbook\s*$|\s*Adda247\s*|\s*www\.\S+\s*",
    re.I,
)

def clean_text(s: str) -> str:
    if not s:
        return s
    s = WATERMARK.sub(" ", s)
    return re.sub(r"\s+", " ", s).strip()

def norm_hash(text: str) -> str:
    t = re.sub(r"\s+", " ", (text or "").lower()).strip()
    t = re.sub(r"[^a-z0-9 ]", "", t)
    return hashlib.sha256(t.encode()).hexdigest()

def full_text(path: str) -> str:
    out = []
    with pdfplumber.open(path) as pdf:
        for pg in pdf.pages:
            out.append(pg.extract_text() or "")
    return "\n".join(out)

def detect_format(text: str) -> str:
    if re.search(r"Que\.?\s*\d+", text) and "Correct Option" in text:
        return "prepp"
    if re.search(r"Total\s+Marks", text) and re.search(r"^\s*[a-e]\.\s", text, re.M):
        return "adda247"
    return "unknown"

# ---- prepp parser --------------------------------------------------------------
QUE_SPLIT = re.compile(r"Que\.?\s*(\d+)")
OPT_LINE = re.compile(r"^\s*([1-5])\.\s*(.*)$")
CORRECT = re.compile(r"Correct Option\s*[-:]\s*([1-5])")

def parse_prepp(text: str):
    parts = QUE_SPLIT.split(text)
    # parts: [pre, num, body, num, body, ...]
    out = []
    for i in range(1, len(parts), 2):
        num = int(parts[i]); body = parts[i + 1]
        cm = CORRECT.search(body)
        correct = int(cm.group(1)) if cm else None
        # stem = text before the first "1." option line
        # options are lines "1." .. "5."
        # cut body at "Correct Option"
        bcut = body[: cm.start()] if cm else body
        lines = bcut.split("\n")
        opts = {}
        stem_lines = []
        cur_opt = None
        for ln in lines:
            m = OPT_LINE.match(ln)
            if m:
                cur_opt = int(m.group(1)); opts[cur_opt] = m.group(2).strip()
            elif cur_opt and ln.strip():
                opts[cur_opt] += " " + ln.strip()
            elif cur_opt is None:
                stem_lines.append(ln)
        stem = clean_text(" ".join(stem_lines))
        out.append({"num": num, "stem": stem, "options": [clean_text(opts.get(k, "")) for k in range(1, 6)], "correct": correct})
    return out

# ---- QC + section assignment for prepp -----------------------------------------
from itertools import permutations

def assign_sections_prepp(questions, blueprint):
    """Sections are contiguous blocks whose SIZES are known from the blueprint
    (e.g. 30/35/35). We don't know the order, so try every ordering of the
    blueprint sections, cut at the fixed boundaries that ordering implies, assign
    each block its section, and score against the per-question classifier. Pick
    the best-scoring ordering; the caller gates on the confidence.

    Returns (section_per_question, confidence, chosen_order)."""
    n = len(questions)
    labels = [classify(q["stem"]) for q in questions]
    secs = blueprint["sections"]
    total_expected = sum(s["count"] for s in secs)
    best = None  # (score, assignment_list, order_keys)
    if n == total_expected:
        for perm in permutations(secs):
            assignment = []
            for s in perm:
                assignment += [s["key"]] * s["count"]
            score = sum(1 for i in range(n) if labels[i] and labels[i] == assignment[i])
            keyed = sum(1 for lb in labels if lb)
            conf = score / keyed if keyed else 0
            if best is None or conf > best[0]:
                best = (conf, assignment, [s["key"] for s in perm])
    if best is None:
        return [""] * n, 0.0, []
    return best[1], round(best[0], 3), best[2]

def qc_paper(path, exam_code, meta):
    bp = BLUEPRINTS[exam_code]
    text = full_text(path)
    fmt = detect_format(text)
    report = {"file": os.path.basename(path), "format": fmt, "accepted": 0, "rejected": 0, "reasons": Counter(), "questions": []}
    if fmt != "prepp":
        report["reasons"][f"unsupported_format:{fmt}"] += 1
        return report
    qs = parse_prepp(text)
    filled, conf, order = assign_sections_prepp(qs, bp)
    SECTION_CONF_MIN = 0.75  # below this, sections are unresolved -> review
    sections_ok = conf >= SECTION_CONF_MIN and len(filled) == len(qs)
    valid_keys = set(s["key"] for s in bp["sections"])

    for idx, q in enumerate(qs):
        reasons = []
        if not q["stem"] or len(q["stem"]) < 8:
            reasons.append("empty_or_short_stem")
        opts = [o.strip() for o in q["options"]]
        if any(not o for o in opts):
            reasons.append("missing_option")
        if len(set(opts)) < len(opts):
            reasons.append("duplicate_options")
        if q["correct"] is None or not (1 <= (q["correct"] or 0) <= bp["optionsCount"]):
            reasons.append("bad_or_missing_key")
        sec = filled[idx] if idx < len(filled) else ""
        if not sections_ok:
            reasons.append("section_unresolved")
        elif sec not in valid_keys:
            reasons.append("section_not_in_blueprint")
        if reasons:
            report["rejected"] += 1
            for r in reasons:
                report["reasons"][r] += 1
        else:
            report["accepted"] += 1
            report["questions"].append({
                "question_number": q["num"], "section": sec,
                "stem_text": q["stem"], "options": opts,
                "correct_index": q["correct"], "correct_letter": chr(64 + q["correct"]),
                "hash": norm_hash(q["stem"] + " " + " ".join(opts)),
            })
    report["section_confidence"] = conf
    report["section_order"] = order
    return report

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("--exam", required=True)
    ap.add_argument("--out", default="data/ingested_sbi")
    ap.add_argument("--emit", action="store_true", help="write per-paper JSON (default: dry-run report only)")
    args = ap.parse_args()
    if args.exam not in BLUEPRINTS:
        sys.exit(f"unknown exam {args.exam}")
    files = []
    if os.path.isdir(args.input):
        for f in sorted(os.listdir(args.input)):
            if f.lower().endswith(".pdf"):
                files.append(os.path.join(args.input, f))
    else:
        files = [args.input]

    grand = Counter()
    for f in files:
        rep = qc_paper(f, args.exam, {})
        print(f"\n{rep['file']}  [{rep['format']}]  accepted={rep['accepted']} rejected={rep['rejected']} sectionConf={rep.get('section_confidence')} order={rep.get('section_order')}")
        if rep["reasons"]:
            print("   reasons:", dict(rep["reasons"]))
        grand.update({"accepted": rep["accepted"], "rejected": rep["rejected"]})
        if args.emit and rep["accepted"]:
            od = os.path.join(args.out, args.exam)
            os.makedirs(od, exist_ok=True)
            base = re.sub(r"[^A-Za-z0-9]+", "_", os.path.splitext(rep["file"])[0])[:80]
            with open(os.path.join(od, base + ".json"), "w", encoding="utf-8") as fh:
                json.dump(rep, fh, ensure_ascii=False, indent=1)
    print(f"\n=== TOTAL accepted={grand['accepted']} rejected={grand['rejected']} ===")
    print("DRY RUN (no DB writes)." if not args.emit else "Emitted JSON (still no DB writes; use load_sbi.mjs).")

if __name__ == "__main__":
    main()
