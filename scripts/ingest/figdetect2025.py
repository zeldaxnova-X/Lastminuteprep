import fitz, re, collections, sys, glob, os, json
DIR=r"C:/Users/jijo1/OneDrive/Desktop/Lastmileprep latest/ssc cgl/English"
pdfs=sorted(glob.glob(DIR+"/SSC-CGL*2025*English.pdf"))
report={}
for p in pdfs:
    d=fitz.open(p); npg=len(d)
    sizes=collections.Counter()
    for pg in d:
        for im in pg.get_images(full=True): sizes[(im[2],im[3])]+=1
    wm={s for s,ct in sizes.items() if ct>=max(2,npg*0.4)}  # recurring = furniture
    figs=collections.Counter()
    for pi,pg in enumerate(d):
        words=pg.get_text("words")
        qmarks=sorted((w[1],int(re.match(r'Q(\d+)\.?$',w[4]).group(1))) for w in words if re.match(r'Q(\d+)\.?$',w[4]))
        for im in pg.get_images(full=True):
            if (im[2],im[3]) in wm: continue
            for r in pg.get_image_rects(im[0]):
                cand=[qn for (y,qn) in qmarks if y<=r.y0+2]
                qn=cand[-1] if cand else (qmarks[0][1] if qmarks else -1)
                figs[qn]+=1
    report[os.path.basename(p)]={"pages":npg,"nonwm_images":sum(figs.values()),"fig_questions":sorted(k for k in figs if k>0)}
json.dump(report, open(r"C:/Users/jijo1/AppData/Local/Temp/claude/C--Users-jijo1-OneDrive-Desktop-Lastmileprep/e444d752-aabc-46fe-af74-5a2e83e5dc78/scratchpad/p2025/figreport.json","w"), indent=1)
tot=sum(r["nonwm_images"] for r in report.values())
withfig=[k for k,v in report.items() if v["fig_questions"]]
print("papers:",len(report),"| total non-watermark images:",tot,"| papers with figs:",len(withfig))
for k in withfig[:20]: print("  ",k.replace("SSC-CGL-","").replace("-English.pdf",""),"->",report[k]["fig_questions"])
