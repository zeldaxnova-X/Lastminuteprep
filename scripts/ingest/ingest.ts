/**
 * One-command DOCX ingestion CLI.
 *
 *   npm run ingest -- "<path-to.docx>"                 # single file
 *   npm run ingest -- "<folder>"                        # every .docx in folder
 *   npm run ingest -- "<path>" --out data/ingested      # custom output root
 *
 * For each paper it writes, under <out>/<paperId>/:
 *   paper.json     canonical ParsedPaper (assets without bytes)
 *   stats.json     parse statistics
 *   assets/*       extracted images (only those referenced by content)
 *
 * The output is deliberately DB-agnostic; `loader.ts` pushes it to Supabase.
 */
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { readDocx } from "./docx-reader";
import { detectFormat, extractPaperMeta } from "./format-detector";
import { parseTcsResponseSheet } from "./parsers/tcs-parser";
import type { ParsedPaper, RawAsset } from "./model";

interface CliArgs {
  inputs: string[];
  outRoot: string;
}

function parseArgs(argv: string[]): CliArgs {
  const inputs: string[] = [];
  let outRoot = "data/ingested";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out") outRoot = argv[++i];
    else inputs.push(argv[i]);
  }
  if (!inputs.length) {
    throw new Error(
      'Usage: npm run ingest -- "<file-or-folder.docx>" [--out data/ingested]'
    );
  }
  return { inputs, outRoot };
}

async function collectDocxFiles(input: string): Promise<string[]> {
  const s = await stat(input);
  if (s.isDirectory()) {
    const entries = await readdir(input);
    return entries
      .filter((e) => e.toLowerCase().endsWith(".docx") && !e.startsWith("~$"))
      .map((e) => join(input, e));
  }
  return [input];
}

async function ingestFile(filePath: string, outRoot: string): Promise<ParsedPaper> {
  const doc = await readDocx(filePath);
  const format = detectFormat(doc);
  const meta = extractPaperMeta(filePath, doc, format);

  let paper: ParsedPaper;
  if (format === "tcs_response_sheet") {
    paper = parseTcsResponseSheet(doc, meta);
  } else {
    throw new Error(
      `No parser yet for format "${format}" (${basename(filePath)}). ` +
        `Publisher solved-paper parser is a follow-up milestone.`
    );
  }

  const outDir = resolve(outRoot, paper.paperId);
  const assetsDir = join(outDir, "assets");
  await mkdir(assetsDir, { recursive: true });

  // Write image assets, then strip bytes before serialising JSON.
  await Promise.all(
    paper.assets.map(async (a: RawAsset) => {
      if (a.bytes) await writeFile(join(assetsDir, `${a.id}.${a.ext}`), a.bytes);
    })
  );
  const serialisablePaper: ParsedPaper = {
    ...paper,
    assets: paper.assets.map(({ bytes, ...rest }) => rest),
  };

  await writeFile(join(outDir, "paper.json"), JSON.stringify(serialisablePaper, null, 2), "utf8");
  await writeFile(join(outDir, "stats.json"), JSON.stringify(paper.stats, null, 2), "utf8");

  return paper;
}

function printSummary(filePath: string, paper: ParsedPaper): void {
  const s = paper.stats;
  console.log(`\n📄 ${basename(filePath)}`);
  console.log(`   paperId      : ${paper.paperId}`);
  console.log(`   format       : ${paper.format}`);
  console.log(`   exam/tier    : ${paper.exam} ${paper.tier}  year=${paper.year}  date=${paper.examDate}  ${paper.shift ?? ""}`);
  console.log(`   language     : ${paper.language}`);
  console.log(`   questions    : ${s.totalQuestions}`);
  console.log(`   sections     : ${Object.entries(s.bySection).map(([k, v]) => `${k}:${v}`).join("  ")}`);
  console.log(`   answers      : withKey=${s.withCorrectAnswer}  needsKey=${s.needsAnswerKey}  (answered=${s.answered} notAnswered=${s.notAnswered} marked=${s.markedForReview})`);
  console.log(`   content      : textQ=${s.textQuestions}  imageQ=${s.imageQuestions}`);
  console.log(`   assets       : used=${s.usedAssets}/${s.totalAssets}`);
  console.log(`   warnings     : ${s.warnings}`);
}

async function main() {
  const { inputs, outRoot } = parseArgs(process.argv.slice(2));
  const files: string[] = [];
  for (const input of inputs) files.push(...(await collectDocxFiles(input)));

  console.log(`Ingesting ${files.length} file(s) → ${resolve(outRoot)}`);
  let ok = 0;
  for (const file of files) {
    try {
      const paper = await ingestFile(file, outRoot);
      printSummary(file, paper);
      ok++;
    } catch (err) {
      console.error(`\n✖ ${basename(file)}: ${(err as Error).message}`);
    }
  }
  console.log(`\nDone. ${ok}/${files.length} parsed successfully.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
