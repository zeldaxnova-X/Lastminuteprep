// Keyword topic classifier for IBPS Clerk Prelims (its OWN taxonomy + section slugs
// english / numerical_ability / reasoning), writing ibps_clerk.questions.topic.
// First matching rule wins (ordered specific -> general); unmatched -> "General <section>".
// Deterministic, re-runnable. Dry-run by default; --apply to write.
//   node scripts/ingest/sbi/classify_topics_ibps.mjs [--apply]
import fs from "fs";
import pg from "pg";

const APPLY = process.argv.includes("--apply");
const url = fs.readFileSync(".env.local", "utf8").match(/DATABASE_URL="?([^"\n\r]+)/)[1].trim();
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();

// Arithmetic word-problem subtopics shared into Numerical Ability.
const ARITHMETIC = [
  ["Simple & Compound Interest", /compound interest|simple interest|\binterest\b|per annum|\bC\.?I\.?\b|\bS\.?I\.?\b/i],
  ["Profit & Loss", /profit|\bloss\b|cost price|selling price|marked price|\bC\.?P\.?\b|\bS\.?P\.?\b|discount|shopkeeper/i],
  ["Time, Speed & Distance", /\bspeed\b|distance|km\/?h|km per hour|\btrain\b|\bboat|stream|upstream|downstream|\bkmph\b|metres? per second|\bm\/s\b|cross(es)? (a|the) (platform|bridge|pole|train)/i],
  ["Time & Work", /time.{0,10}work|work.{0,10}days|efficiency|\bpipe|cistern|\btank\b.{0,15}fill|fill.{0,15}tank|alone can (do|complete|finish)|days? to complete/i],
  ["Mixture & Alligation", /mixture|alligation|\balloy|(juice|milk|acid|spirit|syrup) and water|dilut/i],
  ["Partnership", /partnership|invested|business with|started a business|capital.{0,15}(ratio|share)/i],
  ["Ages", /\bages?\b|years? (old|older|younger)|present age|\d+ years hence|years ago/i],
  ["Mensuration", /volume|surface area|cm ?[²³23]|\bsphere|cylinder|\bcone\b|cuboid|hemisphere|circumference|perimeter|area of (a|the|an|triangle|circle|rectangle|square)/i],
  ["Percentage", /percent|%|percentage/i],
  ["Ratio & Proportion", /\bratio\b|proportion|\b\d+ ?: ?\d+\b/i],
  ["Average", /\baverage\b|\bmean\b/i],
  ["Probability & P&C", /probabilit|permutation|combination|\bdice\b|drawn at random|\bballs?\b.{0,20}(bag|box)/i],
  ["Number System", /divisib|remainder|\bLCM\b|\bHCF\b|\bprime\b|unit digit|place value|natural number/i],
];

const RULES = {
  english: [
    ["Reading Comprehension", /read the (following |given )?passage|comprehension\s*:|based on the passage|in the passage|according to the passage|the author|the passage/i],
    ["Cloze Test / Fill in the Blanks", /some words have been deleted|fill in (the )?blank|blank number|blanks with the help|fill up the blank|most appropriate (word|option).{0,15}(fill|blank)|five blanks/i],
    ["Para Jumbles", /rearrange the (following )?(five )?(sentences|segments|parts)|jumbled|proper sequence|meaningful paragraph|which is the (first|second|third|fourth|fifth) sentence|scattered segments/i],
    ["Error Spotting", /find (out )?the error|contains? (an|no) error|no error|(part|segment).{0,15}(has|contains).{0,10}error|identify the.{0,15}error|which (part|segment).{0,15}error/i],
    ["Sentence Improvement / Phrase Replacement", /improve.{0,10}(the )?(sentence|part|segment)|replace the (highlighted|underlined|bold|bracketed)|phrase.{0,15}replace|which.{0,15}(replace|substitute).{0,15}(highlighted|underlined|bold|bracketed)|no (improvement|replacement|correction)/i],
    ["Word Swap / Word Usage", /word.{0,10}swap|interchang.{0,15}word|swap.{0,15}word|correct usage of the word/i],
    ["Synonyms", /synonym|(same|similar) (in )?meaning|means (the )?same/i],
    ["Antonyms", /antonym|opposite (in )?meaning/i],
    ["Spelling", /correctly spel|incorrectly spel|spelt correctly|mis-?spel|spelling error/i],
    ["Idioms & Phrases", /\bidiom|meaning of the (idiom|phrase)/i],
    ["One Word Substitution", /one word.{0,15}substitut|single word.{0,15}(for|substitut)|group of words/i],
  ],
  numerical_ability: [
    ["Data Interpretation", /pie[- ]?chart|bar[- ]?(graph|chart)|line graph|the following (table|chart|graph|data|caselet)|study the (following|given|data).{0,25}(table|chart|graph|data|information)|given (table|chart|graph)|\bcaselet\b|read the (following )?(table|graph|information).{0,20}(carefully|answer)/i],
    ["Quadratic Equations", /quadratic|two equations are given|\bI[.):]\s.{0,50}\bII[.):]|find the relation.{0,10}(between )?x (and|&) y|establish.{0,10}relation.{0,10}x.{0,5}y/i],
    ["Number Series", /wrong (number|term)|(find|identify).{0,12}(missing|wrong).{0,10}(number|term)|number series|complete the series|what will come in place of.{0,20}(\?|question mark).{0,25}series/i],
    ["Simplification / Approximation", /simplif|approximate value|what (will|should) come in place of (the )?(\?|question mark)|value of the question mark|\bBODMAS\b|solve\s*:/i],
    ["Data Sufficiency", /data sufficien|which of the.{0,15}statements?.{0,15}sufficient|statement.{0,5}(I|1).{0,60}statement.{0,5}(II|2)/i],
    ...ARITHMETIC,
  ],
  reasoning: [
    ["Puzzles", /boxes.{0,25}(stack|kept|placed|arranged|one above)|different (floors|boxes|lockers)|\bfloor\b.{0,20}(number|building|numbered)|born (in|on).{0,20}(month|year|different)|months? (of|from).{0,20}(year|january|a year)|days of the week|scheduled|parking|different (cities|posts|subjects|departments|companies).{0,25}(person|people|friend)/i],
    ["Seating Arrangement", /sitting|\bseated\b|\bsit in\b|seating arrangement|around a (circular|square|rectangular)?\s*table|(two )?parallel rows|facing (the )?(centre|center|north|south|outside|inside|away)|in a (straight )?(row|line)/i],
    ["Blood Relations", /mother of|father of|son of|daughter of|brother of|sister of|\bhusband\b|\bwife\b|how is .{0,30} related|blood relation|grand(father|mother|son|daughter)|paternal|maternal|nephew|niece/i],
    ["Syllogism", /syllogism|conclusions? (follow|logically)|statements?.{0,40}conclusion|statements to be true|\b(some|all|no|only a few) [A-Za-z]+ (are|is)\b/i],
    ["Inequality", /inequalit|coded inequalit|[A-Z]\s?[<>≤≥=]\s?[A-Z]|['\"][<>≤≥@#%&]['\"].{0,20}(means|denotes)/i],
    ["Coding-Decoding", /code language|coded as|\bcode for\b|decoded?|coding[- ]decoding|written in a certain code|represented by (a )?code/i],
    ["Direction Sense", /direction sense|facing (north|south|east|west)|turns? (to (the )?)?(left|right)|walks?.{0,25}(metre|meter|\bkm\b|\bm\b).{0,20}(turn|left|right|north|south|east|west)|towards (north|south|east|west)/i],
    ["Order & Ranking", /\brank(ed|s)?\b|tallest|shortest|heaviest|lightest|oldest|youngest|arranged in (ascending|descending)|order of (height|age|weight|marks)/i],
    ["Machine Input-Output", /input.{0,10}output|(word|number).{0,15}arrangement machine|step (i|1|ii|2)\b/i],
    ["Alphanumeric / Symbol Series", /following (series|arrangement) of (letters|numbers|symbols|elements)|alphanumeric|letter[- ]?(cluster|series)|symbol.{0,10}series/i],
    ["Number Series", /number series|missing (number|term)|next (number )?in the series|wrong (number|term)/i],
    ["Analogy", /analog|is related to .{0,30} as .{0,30} is related|related.{0,15}same way/i],
    ["Odd One Out", /odd one out|does not belong|which.{0,12}(is|are) different/i],
    ["Data Sufficiency", /data sufficien|which.{0,15}statements?.{0,15}sufficient/i],
  ],
};
const FALLBACK = {
  english: "General English Language",
  numerical_ability: "General Numerical Ability",
  reasoning: "General Reasoning Ability",
};

function optText(options) {
  if (!Array.isArray(options)) return "";
  return options.map((o) => (o && typeof o.text === "string" ? o.text : "")).join(" ");
}
function classify(section, stem, options) {
  const rules = RULES[section];
  if (!rules) return null;
  const base = (stem || "").replace(/\s+/g, " ");
  const hay = base.length < 60 ? `${base} ${optText(options)}` : base;
  for (const [topic, re] of rules) if (re.test(hay)) return topic;
  return FALLBACK[section] || null;
}

const rows = (await c.query("select id, section, stem_text, options from ibps_clerk.questions where section is not null")).rows;
const dist = {};
const updates = [];
let fallbacks = 0;
for (const r of rows) {
  const topic = classify(r.section, r.stem_text, r.options);
  if (!topic) continue;
  (dist[r.section] ||= {})[topic] = ((dist[r.section] || {})[topic] || 0) + 1;
  if (topic.startsWith("General ")) fallbacks++;
  updates.push([r.id, topic]);
}
for (const sec of Object.keys(RULES)) {
  console.log(`\n===== ${sec} =====`);
  for (const [topic, n] of Object.entries(dist[sec] || {}).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${topic}`);
  }
}
console.log(`\nTOTAL tagged: ${updates.length} / ${rows.length} | fallback bucket: ${fallbacks} (${((fallbacks / updates.length) * 100).toFixed(1)}%)`);

if (!APPLY) {
  console.log("\nDry-run. Re-run with --apply to write ibps_clerk.questions.topic.");
} else {
  let done = 0;
  for (let i = 0; i < updates.length; i += 500) {
    const chunk = updates.slice(i, i + 500);
    await c.query(
      `update ibps_clerk.questions q set topic = u.topic, updated_at = now()
       from (select unnest($1::uuid[]) as id, unnest($2::text[]) as topic) u where q.id = u.id`,
      [chunk.map((u) => u[0]), chunk.map((u) => u[1])]
    );
    done += chunk.length;
    process.stdout.write(`\r  applied ${done}/${updates.length}`);
  }
  console.log("\nDONE.");
}
await c.end();
