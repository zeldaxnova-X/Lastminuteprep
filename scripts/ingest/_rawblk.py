import fitz, re, json, sys
src=sys.argv[1]; qns=json.loads(sys.argv[2])
d=fitz.open(src); full="\n".join(pg.get_text() for pg in d)
out={}
for qn in qns:
    m=re.search(r'(?s)Q'+str(qn)+r'\.(.*?)(?:Q'+str(qn+1)+r'\.|$)', full)
    out[qn]=(m.group(0)[:700] if m else '')
print(json.dumps(out, ensure_ascii=False))
