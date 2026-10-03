/**
 * Repair the English (and shared) section data quality for a banking exam schema:
 *
 *  A. Artifacts (all sections): strip a trailing " Solution" leaked into an option
 *     and a trailing "(NN)" question-number leaked into a stem.
 *  B. Shared context (english): reading-comprehension / cloze / para-jumble sets
 *     share a passage or a set of sentences that the source prints once. Follow-up
 *     questions were ingested BARE (just "What does the author…?") — unanswerable.
 *     Group each set, recover the shared body, and rebuild every member's stem as
 *     [ {kind:context}, {kind:text, the ask} ] so the passage renders once, in its
 *     own panel, above the actual question.
 *  C. Framing (english, non-set): split a leading "Directions:/In the following…"
 *     preamble into a {kind:context} block so the instruction reads apart from the
 *     sentence it applies to.
 *
 * Reversible: writes a full backup of every changed row. Dry-run unless --apply.
 *   node scripts/ingest/sbi/fix_english_sets.mjs --schema ibps_clerk [--apply]
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const schema = args[args.indexOf("--schema") + 1] || "ibps_clerk";
if (!/^[a-z_]+$/.test(schema)) throw new Error("bad schema");
const SCRATCH = process.env.SCRATCH ||
  "C:/Users/jijo1/AppData/Local/Temp/claude/C--Users-jijo1-OneDrive-Desktop-Lastmileprep/e444d752-aabc-46fe-af74-5a2e83e5dc78/scratchpad";
const env = fs.readFileSync(".env.local", "utf8");
const DBURL = env.match(/DATABASE_URL="?([^"\n\r]+)/)[1].trim();

// ---- text helpers ---------------------------------------------------------
const collapse = (s) => (s || "").replace(/\s+/g, " ").trim();
const words = (s) => collapse(s).split(" ").filter(Boolean);
const sentences = (s) => collapse(s).split(/(?<=[.?!])\s+/).filter(Boolean);
function commonPrefix(a, b) {
  const wa = words(a), wb = words(b);
  let i = 0;
  while (i < wa.length && i < wb.length && wa[i] === wb[i]) i++;
  return wa.slice(0, i).join(" ");
}
/** Round a word-prefix down to end at the last complete sentence within it. */
function roundToSentence(prefix, full) {
  const p = collapse(prefix);
  const m = [...p.matchAll(/[.?!]["')\]]?\s/g)];
  if (!m.length) return p;
  const last = m[m.length - 1];
  return p.slice(0, last.index + last[0].trimEnd().length).trim();
}
const cleanOption = (t) => collapse(t).replace(/[.\s]*\bSolution\s*$/i, "").trim();
const cleanStem = (t) => collapse(t).replace(/\s*\((?:Q\.?\s*)?\d{1,3}\)\s*$/i, "").trim();

const LONG = 300;
// a bare follow-up that needs the shared body
const REF = /\b(as per (the|this|given)? ?passage|as used in the passage|according to the passage|in the passage|the author|which statement is (true|false)|is (true|false) as per|fill in .{0,12}blank (number|[A-G0-9])|blank number|(first|second|third|fourth|fifth|last) sentence (after|of the)|sentence after rearrangement|synonym .{0,25}passage|antonym .{0,25}passage|meaning of the word|the word ['"“][^'"”]+['"”]|closest in meaning)\b/i;
const SELF = /identify the sentence that is grammatically|select the most appropriate sentence with respect to grammar|which of the following sentences? (is|are) grammatically/i;
// a sentence that is instructional (directions), not passage/content
const DIRSENT = /^(directions?\b|direction\b|in the following|in this question|read the (following|given|passage|sentence)|study the (following|given)|select the (correct|most appropriate|option)|choose the (correct|most appropriate|option)|identify the|find out|rearrange|arrange the|a sentence (is|has been)|the given (sentence|passage)|four words|(four|five) sentences|below (are|is)|these words|four options|mark the option|answer the (given )?questions?)/i;
const DIRVOCAB = /\b(as the answer|rearrangement is required|no rearrangement|mark (the )?option|mark option|click the button|no error.{0,14}(option|answer)|answer the (given )?questions?|find out which part|corresponding to it|different arrangements|has been provided|deleted from the|ignore (the )?errors? of punctuation|no improvement|improvement is needed|choose the alternative|free from error|select option \(?5\)?|if (a|the) sentence is (already )?(correct|free))\b/i;
// a sentence that STARTS the actual ask (question), used to split a passage from it
const ASKSENT = /^(which|what|who|whose|why|how|when|where|according to the passage|the author|choose the (word|correct|most appropriate|option)|select the (word|correct|most appropriate|option)|fill in (the )?blank|find the|state |name the|in the context of the passage|as per the passage|the passage (suggests|implies|conveys)|identify the (synonym|antonym)|the (synonym|antonym))\b/i;
function splitAsk(text) {
  const ss = sentences(text);
  // Prefer the LAST sentence that explicitly starts an ask (asks sit after the
  // passage). Fall back to a trailing "?" only if it's the final sentence, so a
  // rhetorical "?" inside the passage never triggers a bad cut.
  let start = -1;
  for (let n = 1; n < ss.length; n++) if (ASKSENT.test(ss[n])) start = n;
  if (start < 0 && ss.length > 1 && /\?\s*$/.test(ss[ss.length - 1])) start = ss.length - 1;
  if (start < 1) return { body: collapse(text), ask: "" };
  return { body: ss.slice(0, start).join(" "), ask: ss.slice(start).join(" ") };
}

const isLong = (s) => collapse(s).length >= LONG;
/** Does this short question belong to the passage/cloze set it follows? An RC
 *  follow-up is often just a question about the passage with no keyword ("Why is
 *  there an increase…?") — so inside a passage set, any short question that has no
 *  directions preamble of its own and isn't self-contained is a follow-up. */
function isFollowup(s, inPassageSet) {
  const t = collapse(s);
  if (t.length >= LONG) return false;            // a long question starts a NEW set
  if (SELF.test(t)) return false;                // grammatically-correct-sentence type
  if (/_{3,}/.test(t)) return false;             // single fill-in with the sentence inline
  if (/\b(as per the passage|as used in the passage|according to the passage|in the passage|from the passage|the author|which statement is (true|false)|is (true|false) as per|the passage (suggests|implies|conveys))\b/i.test(t)) return true;
  if (/\bblank\s*(number|no\.?\s*\d|[A-G]\b)/i.test(t)) return true;
  if (/\b(first|second|third|fourth|fifth|last) sentence (after|of)\b/i.test(t)) return true;
  // Inside a reading/cloze passage set, every following SHORT question is a
  // follow-up of that passage (RC asks like "Choose the synonym of X" or
  // "Restricted sleep is thought to:" carry no keyword), until the next long
  // directions-bearing lead. Do NOT gate on a directions-y opener here — a
  // synonym/antonym ask legitimately starts with "Choose/Select".
  if (inPassageSet) return true;
  return false;
}
function stemText(blocks, fallback) {
  if (Array.isArray(blocks)) {
    const t = blocks.filter((b) => (b.kind === "text" || b.kind === "context") && b.text).map((b) => b.text).join(" ");
    if (t) return t;
  }
  return fallback || "";
}
function labelFor(context) {
  const c = context.toLowerCase();
  if (/five sentences|four sentences|rearrange|sentences? (are )?given|meaningful (and )?(logical )?para|scattered segments/.test(c)) return "Sentences";
  if (/passage/.test(c) || collapse(context).length > 800) return "Passage"; // long prose = a reading passage
  return "Directions";
}
/** Move any leading directions sentences off the ask into `dirTail`. */
function peelDirections(ask) {
  let rest = collapse(ask);
  const tail = [];
  for (;;) {
    const ss = sentences(rest);
    if (ss.length <= 1) break;
    const first = ss[0];
    if (DIRSENT.test(first) || DIRVOCAB.test(first)) { tail.push(first); rest = ss.slice(1).join(" "); }
    else break;
  }
  return { dirTail: tail.join(" "), ask: rest };
}
function makeStem(context, ask, label) {
  const ctx = collapse(context), q = collapse(ask);
  if (ctx && q && ctx !== q) return { blocks: [{ kind: "context", label, text: ctx }, { kind: "text", text: q }], flat: `${ctx}  ${q}` };
  const only = q || ctx;
  return { blocks: [{ kind: "text", text: only }], flat: only };
}

// ---- main -----------------------------------------------------------------
const c = new pg.Client({ connectionString: DBURL, ssl: { rejectUnauthorized: false } });
await c.connect();

// --restore: revert every row in the last backup to its original stem/options.
if (args.includes("--restore")) {
  const bpath = path.join(SCRATCH, `fix_english_${schema}_backup.json`);
  const rows = JSON.parse(fs.readFileSync(bpath, "utf8"));
  let n = 0;
  for (const r of rows) {
    if (r.phase === "A") {
      await c.query(`update ${schema}.questions set options=$1::jsonb, stem=$2::jsonb, stem_text=$3, updated_at=now() where id=$4`,
        [JSON.stringify(r.options), JSON.stringify(r.stem), r.stem_text, r.id]);
    } else {
      await c.query(`update ${schema}.questions set stem=$1::jsonb, stem_text=$2, updated_at=now() where id=$3`,
        [JSON.stringify(r.stem), r.stem_text, r.id]);
    }
    n++;
  }
  console.log(`restored ${n} rows in ${schema} from ${bpath}`);
  await c.end();
  process.exit(0);
}
const backup = [];
let optFix = 0, stemNumFix = 0, sets = 0, framed = 0;

// Phase A: artifacts (all sections)
const all = (await c.query(`select id, section, stem, stem_text, options from ${schema}.questions`)).rows;
for (const q of all) {
  let changed = false;
  const opts = Array.isArray(q.options) ? q.options : [];
  const newOpts = opts.map((o) => {
    const cleaned = cleanOption(o.text || "");
    if (cleaned !== collapse(o.text || "")) {
      changed = true; optFix++;
      const blocks = Array.isArray(o.blocks) ? o.blocks.map((b) => b.kind === "text" ? { ...b, text: cleanOption(b.text || "") } : b) : o.blocks;
      return { ...o, text: cleaned, blocks };
    }
    return o;
  });
  const st = cleanStem(q.stem_text || "");
  const numFixed = st !== collapse(q.stem_text || "");
  if (numFixed) { changed = true; stemNumFix++; }
  if (changed) {
    backup.push({ id: q.id, phase: "A", options: q.options, stem: q.stem, stem_text: q.stem_text });
    if (APPLY) {
      let stemBlocks = q.stem;
      if (numFixed && Array.isArray(q.stem)) {
        stemBlocks = q.stem.map((b, i, arr) => (i === arr.length - 1 && (b.kind === "text" || b.kind === "context") && b.text) ? { ...b, text: cleanStem(b.text) } : b);
      }
      await c.query(`update ${schema}.questions set options=$1::jsonb, stem=$2::jsonb, stem_text=$3, updated_at=now() where id=$4`,
        [JSON.stringify(newOpts), JSON.stringify(stemBlocks), st, q.id]);
    }
  }
}

// Phase B & C: english (per paper)
const papers = (await c.query(`select distinct paper_id from ${schema}.questions where section='english'`)).rows.map((r) => r.paper_id);
const report = [];
for (const pid of papers) {
  const qs = (await c.query(
    `select id, question_number qn, stem, stem_text, options from ${schema}.questions where paper_id=$1 and section='english' order by question_number`, [pid]
  )).rows.map((q) => ({ ...q, text: collapse(stemText(q.stem, q.stem_text)) }));
  const handled = new Set();

  let i = 0;
  while (i < qs.length) {
    if (handled.has(qs[i].qn)) { i++; continue; }
    if (isLong(qs[i].text)) {
      // anchor run of contiguous long Qs sharing a big common prefix
      let j = i;
      while (j + 1 < qs.length && isLong(qs[j + 1].text) && collapse(commonPrefix(qs[i].text, qs[j + 1].text)).length >= 150) j++;
      const carriers = qs.slice(i, j + 1);
      // A "passage set" shares a reading passage / cloze passage (prose the
      // follow-ups refer to); a "directions set" shares only the instruction.
      // A passage set = an RC/cloze carrier: says "passage"/"read the", is a cloze
      // ("words … deleted"), or is simply a long block of prose (a raw passage with
      // no directions preamble). Long prose reliably marks a reading passage.
      const passageSet = /\bpassage\b/i.test(carriers[0].text)
        || /read the (following|given)/i.test(carriers[0].text)
        || /words?\b.{0,25}(deleted|removed)/i.test(carriers[0].text)
        || collapse(carriers[0].text).length > 1200;
      // extend over the set's bare follow-up questions
      let k = j;
      while (k + 1 < qs.length && isFollowup(qs[k + 1].text, passageSet)) k++;
      const members = qs.slice(i, k + 1);
      const hasFollowups = k > j;

      let body, bodyIsShared;
      if (passageSet) {
        // passage = common content across carriers, with any trailing ask stripped
        const cp = carriers.length > 1 ? carriers.map((m) => m.text).reduce((a, b) => commonPrefix(a, b)) : carriers[0].text;
        body = splitAsk(cp).body || cp;
        bodyIsShared = collapse(body).length >= 150;
      } else {
        // shared directions/sentences = common prefix across carriers
        body = j > i
          ? roundToSentence(carriers.map((m) => m.text).reduce((a, b) => commonPrefix(a, b)))
          : splitAsk(qs[i].text).body;
        bodyIsShared = collapse(body).length >= 120 && (j > i || hasFollowups);
      }

      if (bodyIsShared) {
        sets++;
        const label = labelFor(body);
        const bw = words(body);
        for (const m of members) {
          let ask;
          if (passageSet) {
            // carriers: their own trailing question; bare follow-ups: whole stem
            if (isLong(m.text)) {
              const a = splitAsk(m.text).ask;
              const cp = collapse(commonPrefix(m.text, body));
              ask = a || (cp.length >= 120 ? words(m.text).slice(words(cp).length).join(" ") : m.text);
            } else ask = m.text;
          } else {
            const mw = words(m.text);
            ask = mw.slice(0, bw.length).join(" ") === collapse(body) ? mw.slice(bw.length).join(" ") : m.text;
          }
          const { dirTail, ask: cleanAsk } = peelDirections(ask);
          const ctx = collapse(dirTail) ? `${body} ${dirTail}` : body;
          m._stem = makeStem(ctx, cleanAsk || ask, label);
          handled.add(m.qn);
        }
        report.push({ pid: pid.slice(-10), lead: members[0].qn, members: members.map((m) => m.qn), label, bodyLen: collapse(body).length, head: collapse(body).slice(0, 62), asks: members.map((m) => (m._stem.blocks.find((b) => b.kind === "text")?.text || "«none»").slice(0, 44)) });
        i = k + 1;
        continue;
      }
    }
    i++;
  }

  // Phase C: frame remaining self-contained english questions (directions split)
  for (const q of qs) {
    if (handled.has(q.qn) || q._stem) continue;
    const ss = sentences(q.text);
    if (ss.length < 2 || !DIRSENT.test(ss[0])) continue;
    let d = 0;
    while (d < ss.length - 1 && (DIRSENT.test(ss[d]) || DIRVOCAB.test(ss[d]))) d++;
    if (d < 1 || d >= ss.length) continue;
    const dir = ss.slice(0, d).join(" "), rest = ss.slice(d).join(" ");
    if (collapse(dir).length >= 15 && collapse(rest).length >= 8) {
      q._stem = makeStem(dir, rest, "Directions");
      framed++;
    }
  }

  // Phase D: any still-bare question that clearly refers to a passage/sentences
  // (an RC follow-up the contiguous grouping missed) inherits the NEAREST such
  // context in the same paper. Robust to gaps and to follow-ups printed before
  // their carrier.
  const REFD = /\b(as per the passage|according to the passage|from the passage|used in the passage|in the passage|the author|inferred from the passage|title for the passage|main idea of the passage|the passage (suggest|impl|convey)|which of the following.{0,30}passage|blank\s*(number|[A-G]\b|given in the passage)|(first|second|third|fourth|fifth|last) sentence (after|of))\b/i;
  const sources = qs
    .filter((q) => q._stem && q._stem.blocks[0] && q._stem.blocks[0].kind === "context")
    .map((q) => ({ qn: q.qn, block: q._stem.blocks[0] }));
  if (sources.length) {
    for (const q of qs) {
      if (q._stem) continue;
      const hasCtx = Array.isArray(q.stem) && q.stem.some((b) => b.kind === "context");
      if (hasCtx) continue;
      const t = collapse(q.text);
      if (t.length >= LONG || !REFD.test(t)) continue;
      // pick the nearest source, preferring a passage for RC refs / sentences for jumble
      const wantSentences = /(first|second|third|fourth|fifth|last) sentence (after|of)/i.test(t);
      const pool = sources.filter((s) => wantSentences ? s.block.label === "Sentences" : s.block.label !== "Sentences");
      const use = (pool.length ? pool : sources).reduce((a, b) => (Math.abs(b.qn - q.qn) < Math.abs(a.qn - q.qn) ? b : a));
      q._stem = { blocks: [use.block, { kind: "text", text: t }], flat: `${use.block.text}  ${t}` };
    }
  }

  for (const q of qs) {
    if (!q._stem) continue;
    backup.push({ id: q.id, phase: "BC", stem: q.stem, stem_text: q.stem_text });
    if (APPLY) {
      await c.query(`update ${schema}.questions set stem=$1::jsonb, stem_text=$2, updated_at=now() where id=$3`,
        [JSON.stringify(q._stem.blocks), q._stem.flat, q.id]);
    }
  }
}

fs.writeFileSync(path.join(SCRATCH, `fix_english_${schema}_backup.json`), JSON.stringify(backup, null, 1));
console.log(`\n[${APPLY ? "APPLY" : "DRY-RUN"}] ${schema}: optionSolutionFix=${optFix} stemNumFix=${stemNumFix} sets=${sets} framed=${framed} backup=${backup.length}`);
for (const r of report.slice(0, 30)) {
  console.log(`\n  ${r.pid} q${r.lead} [${r.members.join(",")}] ${r.label} body=${r.bodyLen} "${r.head}…"`);
  r.asks.forEach((a, ix) => console.log(`      q${r.members[ix]}: ${a}`));
}
await c.end();
