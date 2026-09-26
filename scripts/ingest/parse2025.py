#!/usr/bin/env python3
"""Parse an Adda247 SSC CGL 2025 Tier-I PDF into structured questions JSON.
Usage: python scripts/ingest/parse2025.py <pdf> <out.json>
Each question: {qn, section, stem, options:{A,B,C,D}, answer, warnings}
"""
import fitz, re, sys, json, unicodedata

pdf, out = sys.argv[1], sys.argv[2]
d = fitz.open(pdf)
raw = "\n".join(pg.get_text() for pg in d)

# --- normalise ---
raw = raw.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
raw = raw.replace("–", "-").replace("—", "-").replace("ﬁ", "fi").replace(" ", " ")

# strip page furniture lines
FURN = re.compile(r"^\s*(SSC CGL.*Paper.*|.*adda247.*|www\..*|GET IT ON.*|Google Play.*|Page\s*\d+.*|\d{1,3}\s*)$", re.I)
lines = [ln for ln in raw.split("\n") if not FURN.match(ln.strip())]
text = "\n".join(lines)

# split into question blocks
idxs = [(m.start(), int(m.group(1))) for m in re.finditer(r"Q(\d+)\.", text)]
blocks = []
for i, (pos, qn) in enumerate(idxs):
    end = idxs[i + 1][0] if i + 1 < len(idxs) else len(text)
    blocks.append((qn, text[pos:end]))

def section_for(qn):
    if qn <= 25: return "reasoning"
    if qn <= 50: return "general_awareness"
    if qn <= 75: return "quantitative_aptitude"
    return "english_comprehension"

OPT = re.compile(r"\(([a-d])\)\s*")  # options are lowercase; avoids matching Assertion (A)/(R)
questions = []
for qn, blk in blocks:
    w = []
    body = re.sub(r"^Q\d+\.\s*", "", blk).strip()
    mAns = re.search(r"Ans\.?\s*\(([a-dA-D])\)", body)
    ans = mAns.group(1).upper() if mAns else None
    if mAns:
        body = body[:mAns.start()]
    # find option markers (a)(b)(c)(d) — take the LAST run of a,b,c,d in order
    marks = [(m.start(), m.group(1).lower()) for m in OPT.finditer(body)]
    # locate the (a) that begins the option block: the last (a) whose following (b),(c),(d) also appear in order after it
    opts = {}
    stem = body
    # try from each (a)
    a_positions = [p for p, k in marks if k == "a"]
    chosen = None
    for ap in a_positions:
        seq = [(p, k) for p, k in marks if p >= ap]
        letters = [k for p, k in seq]
        # need a,b,c,d appearing in order at least once
        need = ["a", "b", "c", "d"]; j = 0; picks = []
        for p, k in seq:
            if j < 4 and k == need[j]:
                picks.append((p, k)); j += 1
        if j == 4:
            chosen = picks; break
    if chosen:
        stem = body[:chosen[0][0]].strip()
        for oi in range(4):
            s = chosen[oi][0] + 3  # skip "(x)"
            e = chosen[oi + 1][0] if oi + 1 < 4 else len(body)
            opts["ABCD"[oi]] = re.sub(r"\s+", " ", body[s:e]).strip()
    else:
        w.append("no 4 options parsed")
    stem = re.sub(r"[ \t]+", " ", stem).strip()
    stem = re.sub(r"\n{2,}", "\n", stem)
    if not ans: w.append("no answer")
    if len(stem) < 3: w.append("short stem")
    questions.append({"qn": qn, "section": section_for(qn), "stem": stem,
                      "options": opts, "answer": ans, "warnings": w})

json.dump({"pdf": pdf, "n": len(questions), "questions": questions}, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
# summary
bad = [q for q in questions if q["warnings"]]
print(f"parsed {len(questions)} questions; with warnings: {len(bad)}")
for q in bad[:15]: print("  Q%d %s :: %s" % (q["qn"], q["warnings"], q["stem"][:50]))
# boundary sanity
for qn in (1, 25, 26, 50, 51, 75, 76, 100):
    q = next((x for x in questions if x["qn"] == qn), None)
    if q: print("  [%d %s] ans=%s | %s" % (qn, q["section"], q["answer"], q["stem"][:55].replace("\n", " ")))
