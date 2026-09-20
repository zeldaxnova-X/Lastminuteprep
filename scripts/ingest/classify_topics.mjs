// Keyword classifier: tag every question with a topic within its section.
// SSC CGL topics are highly keyword-detectable from the stem. First matching
// rule wins (rules ordered specific -> general); anything unmatched falls to a
// section "General ..." bucket. Deterministic, free, re-runnable.
//   Dry-run: node scripts/ingest/classify_topics.mjs
//   Apply:   node scripts/ingest/classify_topics.mjs --apply
import fs from "fs";
import pg from "pg";

const APPLY = process.argv.includes("--apply");
const url = fs.readFileSync(".env.local", "utf8").match(/DATABASE_URL="?([^"\n\r]+)/)[1].trim();
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();

// Each section: ordered [topic, regex]. First hit wins.
const RULES = {
  quantitative_aptitude: [
    ["Data Interpretation", /pie[- ]?chart|bar[- ]?(graph|chart)|histogram|line graph|study the (given|following).{0,20}(chart|graph|table|data)|the following (pie|bar|graph|table|data)|frequency (table|distribution)/i],
    ["Trigonometry", /\b(sin|cos|tan|cot|sec|cosec|csc)\b|trigonometr|θ|\\theta|angle of (elevation|depression)|height and distance/i],
    ["Mensuration", /volume|surface area|cm ?[²³23]|\bsphere|cylinder|\bcone\b|cuboid|hemisphere|circumference|perimeter|trapez|frustum|area of (a|the|an|triangle|circle|rectangle|square|sector|rhombus)/i],
    ["Geometry", /triangle|\bcircle\b|quadrilateral|∠|parallelogram|\bchord\b|tangent|centroid|incentre|circumcentre|bisector|polygon|rhombus|perpendicular|\bABC\b|radius|diameter/i],
    ["Simple & Compound Interest", /compound interest|simple interest|\binterest\b|per annum|\bC\.?I\.?\b|\bS\.?I\.?\b/i],
    ["Profit & Loss", /profit|loss|cost price|selling price|marked price|\bC\.?P\.?\b|\bS\.?P\.?\b|discount|shopkeeper/i],
    ["Percentage", /percent|%|percentage/i],
    ["Time, Speed & Distance", /\bspeed\b|distance|km\/?h|km per hour|\btrain\b|\bboat|stream|upstream|downstream|\bkmph\b|metres? per second|\bm\/s\b/i],
    ["Time & Work", /time.{0,10}work|work.{0,10}days|efficiency|\bpipe|cistern|\btank\b.{0,15}fill|fill.{0,15}tank|alone can (do|complete|finish)|days? to complete/i],
    ["Mixture & Alligation", /mixture|alligation|\balloy|(juice|milk|acid|spirit|syrup) and water|dilut/i],
    ["Partnership", /partnership|invested|business with|started a business|capital.{0,15}(ratio|share)/i],
    ["Ratio & Proportion", /\bratio\b|proportion|\b\d+ ?: ?\d+\b/i],
    ["Average", /\baverage\b|\bmean\b(?! )/i],
    ["Number System", /number system|divisib|remainder|\bLCM\b|\bHCF\b|greatest common|least common|\bprime\b|unit digit|place value|consecutive (integer|number|odd|even)|natural number/i],
    ["Algebra", /\bequation|polynomial|factoris|value of x|\bx ?\+ ?y|\+ ?y ?=|\ba ?\^ ?2|x ?\^ ?2|quadratic|\bfactorise|algebra/i],
    ["Simplification", /simplif|\bBODMAS\b|solve ?:|value of the (expression|following)|√|\bof\b.{0,30}=/i],
    ["Progressions", /progression|arithmetic mean|geometric mean|\bA\.?P\.?\b|\bG\.?P\.?\b/i],
  ],
  reasoning: [
    ["Paper Folding & Cutting", /paper.{0,15}(fold|cut)|folded|\bpunch|transparent sheet.{0,15}pattern|unfolded/i],
    ["Mirror & Water Image", /mirror image|water image|mirror is placed|reflection of/i],
    ["Embedded Figures", /embedded|hidden figure|part of the given figure|which the given figure is|figure is a part/i],
    ["Counting Figures", /how many (triangles|squares|rectangles|circles|straight lines|lines)|number of (triangles|straight lines|rectangles|squares|circles)|count the number of/i],
    ["Dice & Cube", /\bdice\b|\bcube\b|folded to form a cube|number on the face/i],
    ["Seating Arrangement", /sitting|\bseated\b|seating arrangement|around a (circular )?table|\brow\b.{0,20}facing/i],
    ["Calendar & Clock", /\bcalendar\b|day of the week|\bclock\b|angle.{0,12}clock|what day (was|will|is)|hands of (a|the) clock/i],
    ["Figure Series & Completion", /replace the question mark.{0,25}(figure|pattern)|complete the (pattern|figure|series)|figure.{0,15}question mark|(answer|option) figure|which (answer )?figure|select the figure/i],
    ["Coding-Decoding", /code language|coded as|\bcode for\b|decode|coding|written in a certain code/i],
    ["Blood Relations", /mother of|father of|son of|daughter of|brother of|sister of|\bhusband\b|\bwife\b|how is .{0,30} related|blood relation/i],
    ["Direction Sense", /direction|facing (north|south|east|west)|turns? (to (the )?)?(left|right)|walks?.{0,25}(metre|meter|km).{0,20}(turn|direction|left|right)/i],
    ["Syllogism / Statements", /syllogism|conclusions? (follow|logically)|statements?.{0,40}conclusion|given statements to be true/i],
    ["Venn Diagram", /venn|diagram.{0,20}represent.{0,20}relation|relationship between the (following )?(classes|groups|items)/i],
    ["Analogy", /related to the (first|second|third|fourth|fifth).{0,40}same way|analog|is related to .{0,30} as .{0,30} is related|same way as the (second|first)/i],
    ["Classification (Odd One Out)", /odd one out|odd (one|man) out|does not belong|not belong to the group|which .{0,20}(is|are) different/i],
    ["Number & Letter Series", /\bseries\b|next in the series|missing (number|term|letter)|letter[- ]cluster|number series|alphabet(ical)? series/i],
    ["Mathematical Operations", /interchang.{0,15}sign|signs and numbers|which .{0,25}equation .{0,15}correct|balanc.{0,10}equation|mathematical operation/i],
    ["Word Formation", /meaningful.{0,15}word|letters of the word|letter English word|word can be formed|position of.{0,15}letter/i],
    ["Order & Ranking", /\brank\b|tallest|shortest|arranged in (ascending|descending)|order of (height|age|weight)/i],
    ["Missing Number", /missing number|number that will replace|matrix/i],
  ],
  english_comprehension: [
    ["Reading Comprehension", /read the (following |given )?passage|comprehension ?:|passage.{0,30}(answer|follow)|based on the passage/i],
    ["Spelling", /correctly spel|correct spelling|spelt correctly|incorrectly spel|mis-?spel/i],
    ["Idioms & Phrases", /\bidiom|meaning of the (idiom|phrase)|phrase.{0,15}(mean|highlighted)/i],
    ["Synonyms", /synonym|(same|similar) (in )?meaning/i],
    ["Antonyms", /antonym|opposite (in )?meaning/i],
    ["One Word Substitution", /one word|single word.{0,15}(for|substitut)|word substitution|group of words/i],
    ["Error Spotting", /segment that contains an error|contains? (an|no) error|identify the (segment|part).{0,15}error|no error/i],
    ["Sentence Improvement", /replace the highlighted|improve.{0,10}sentence|(appropriate|suitable).{0,25}replace.{0,15}(highlighted|underlined)|substitut.{0,10}(highlighted|underlined)/i],
    ["Fill in the Blanks / Cloze", /fill in (the )?blank|blank number|\bblank\b.{0,15}(sentence|passage)|complete the (sentence|passage)/i],
    ["Active & Passive Voice", /active voice|passive voice/i],
    ["Narration (Direct/Indirect)", /direct speech|indirect speech|\bnarration|reported speech/i],
    ["Para Jumbles", /jumbled|para.{0,10}sequence|arrange.{0,20}(sentences|parts).{0,15}order|rearrange the (parts|sentences)/i],
    ["Homonyms & Confusables", /homonym|homophone|confus/i],
  ],
  general_awareness: [
    ["Polity & Constitution", /constitution|fundamental (right|dut)|article \d+|\bparliament|lok sabha|rajya sabha|amendment|supreme court|high court|\bCAG\b|comptroller|directive principle|\bschedule\b|preamble|governor-general|president of india|prime minister|chief minister|\bgovernor\b|election commission|\bjudiciary|panchayat|\bbill\b|\bact\b.{0,20}(19|20|parliament|passed)|writ\b|attorney general/i],
    ["History", /dynasty|emperor|mughal|maurya|gupta|sultanate|freedom (struggle|movement)|\brevolt\b|battle of|\btreaty\b|ancient india|medieval|\bviceroy\b|independence|civilization|inscription|stupa|fought against|\brana\b|\bwar\b|gandhi|nehru|ashoka|akbar|shivaji|\bcongress\b.{0,15}session|\bveda|harappa|indus valley|movement of \d|satyagraha/i],
    ["Geography", /\briver\b|mountain|plateau|\bclimate\b|monsoon|\bisland\b|latitude|longitude|\bsoil\b|\bcrop\b|\bforest\b|\bocean\b|\bdesert\b|geographic|\bstrait\b|continent|earthquake|volcano|national park|wildlife sanctuary|capital of|\bdam\b|\blake\b|tributary|\bborder|located (in|near)|\bmineral\b|\bplateau|\bplains?\b|highest peak/i],
    ["Economics", /fiscal|monetary|\bGDP\b|inflation|\beconomy\b|economic|\bbudget\b|\btax\b|\bGST\b|\bRBI\b|repo rate|\byojana\b|(welfare|government) scheme|insurance cover|\bsubsidy\b|per capita|jan dhan|five[- ]year plan|\bcensus\b|poverty|\bemployment\b|stock (market|exchange)|\bfinance\b|\btrade\b|\bbank(ing)?\b/i],
    ["General Science", /chemical|\belement\b|\bcompound\b|\bacid\b|\bcell\b|\bvitamin|disease|\bforce\b|\benergy\b|velocity|optic|convex|concave|\blens\b|reaction|\batom|molecule|photosynthesis|newton|\bcurrent\b|voltage|\bmetal\b|\benzyme|\borgan\b|scientific name|SI unit|periodic table|\bplanet\b|solar system|gravit|magnet|\bsound\b|\blight\b|\bheat\b|temperature|deficiency of|\bblood\b|\bhormone|\bgas\b|\bmineral|\bprotein|physics|chemistry|biology/i],
    ["Sports", /cricket|olympic|\btrophy\b|\bcup\b|tournament|championship|\bmedal\b|\bFIFA\b|world cup|grand slam|\bstadium\b|\bhockey\b|\bkabaddi\b|badminton|athlet/i],
    ["Art & Culture", /\bdance\b|festival|\bmusic\b|painting|\btemple\b|architecture|classical|folk (dance|music|art)|tradition|\braga\b|\bfair\b|\bcuisine\b|\bheritage|\btribe/i],
    ["Books & Authors", /written by|author of|\bbook\b.{0,15}(author|written|by)|autobiograph|\bnovel\b|\bwrote\b/i],
    ["Current Affairs & Awards", /\b20(24|25|26)\b|recently|\baward\b|\bprize\b|appointed|\bsummit\b|conference (held|20)|launched|report 20|as of 20|nobel|padma|bharat ratna|first .{0,20}to (win|become|reach)/i],
  ],
};

const FALLBACK = {
  quantitative_aptitude: "General Quantitative Aptitude",
  reasoning: "General Reasoning",
  english_comprehension: "General English & Vocabulary",
  general_awareness: "Static GK & General Awareness",
};

function optText(options) {
  if (!Array.isArray(options)) return "";
  return options.map((o) => (o && typeof o.text === "string" ? o.text : "")).join(" ");
}
function classify(section, stem, options) {
  const rules = RULES[section];
  if (!rules) return null;
  const base = (stem || "").replace(/\s+/g, " ");
  // Short stems (generic prompts) get option text appended for a better signal.
  const hay = base.length < 60 ? `${base} ${optText(options)}` : base;
  for (const [topic, re] of rules) if (re.test(hay)) return topic;
  return FALLBACK[section] || null;
}

const rows = (await c.query(
  "select id, section, stem_text, options from questions where section is not null"
)).rows;

const dist = {}; // section -> topic -> count
const updates = [];
let fallbacks = 0;
const examples = {}; // topic -> sample stem
for (const r of rows) {
  const topic = classify(r.section, r.stem_text, r.options);
  if (!topic) continue;
  (dist[r.section] ||= {})[topic] = ((dist[r.section] || {})[topic] || 0) + 1;
  if (topic.startsWith("General ") || topic.startsWith("Static GK")) fallbacks++;
  if (!examples[topic]) examples[topic] = (r.stem_text || "").replace(/\s+/g, " ").slice(0, 90);
  updates.push([r.id, topic]);
}

for (const sec of Object.keys(RULES)) {
  console.log(`\n===== ${sec} =====`);
  const t = dist[sec] || {};
  for (const [topic, n] of Object.entries(t).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${topic}`);
  }
}
console.log(`\nTOTAL tagged: ${updates.length} / ${rows.length} | fallback bucket: ${fallbacks} (${((fallbacks / updates.length) * 100).toFixed(1)}%)`);

if (!APPLY) {
  console.log("\nDry-run. Re-run with --apply to write questions.topic.");
  await c.end();
} else {
  // Batched UPDATE via unnest for speed.
  let done = 0;
  for (let i = 0; i < updates.length; i += 500) {
    const chunk = updates.slice(i, i + 500);
    const ids = chunk.map((u) => u[0]);
    const topics = chunk.map((u) => u[1]);
    await c.query(
      `update questions q set topic = u.topic, updated_at = now()
       from (select unnest($1::uuid[]) as id, unnest($2::text[]) as topic) u
       where q.id = u.id`,
      [ids, topics]
    );
    done += chunk.length;
    process.stdout.write(`\r  applied ${done}/${updates.length}`);
  }
  console.log("\nDONE.");
  await c.end();
}
