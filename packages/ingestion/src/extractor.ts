import type { SourceSnapshot } from "@offer-ai/domain";
import type { ExtractedFact, Extractor } from "./pipeline";

const EXTRACTOR_VERSION = "ingestion-v1-extract-1";

/**
 * Heuristic extractor for UK admissions facts.
 *
 * v1 is deliberately limited: it parses raw HTML/text snapshots for
 * 3 signals that are decision-critical and provenanced:
 *  - tuition fee (GBP)
 *  - application deadline
 *  - language requirement (IELTS)
 *
 * Extraction is rule-based (no LLM) so it never hallucinates unverified
 * facts. High-confidence matches become `machine_extracted` candidate facts;
 * they still require diff + review before publishing.
 *
 * The extractor is source-agnostic — it works for any UK university page —
 * but source-specific overrides can be added in `sourceSpecificExtract()`
 * without touching generic rules.
 */
export class HeuristicExtractor implements Extractor {
  async extract(snapshot: SourceSnapshot): Promise<ExtractedFact[]> {
    const facts: ExtractedFact[] = [];
    const raw = snapshot.rawContent;

    // Generic extraction — runs for every source.
    for (const fact of extractFeeFacts(raw, snapshot)) facts.push(fact);
    for (const fact of extractDeadlineFacts(raw, snapshot)) facts.push(fact);
    for (const fact of extractLanguageFacts(raw, snapshot)) facts.push(fact);
    for (const fact of extractAcademicRequirementFacts(raw, snapshot)) facts.push(fact);

    // Source-specific tweaks (Birmingham mentions UKPRN, etc.) — keep
    // deterministic and versioned.
    for (const fact of sourceSpecificExtract(raw, snapshot)) facts.push(fact);

    return facts;
  }
}

function extractFeeFacts(raw: string, snapshot: SourceSnapshot): ExtractedFact[] {
  const facts: ExtractedFact[] = [];
  // Matches: £33,400  £ 33,400  33400 GBP  tuition ... £33,400 etc.
  const feeRegex = /(?:tuition|fee|cost)[^£\d]{0,80}£\s?([\d,]{4,7})|£\s?([\d,]{4,7})\s*(?:per\s+year|\/year|GBP)?/gi;
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = feeRegex.exec(raw)) !== null) {
    const rawNumber = match[1] ?? match[2];
    if (!rawNumber) continue;
    const normalized = rawNumber.replace(/,/g, "");
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    const amount = Number(normalized);
    if (!Number.isFinite(amount) || amount < 5000 || amount > 80000) continue;
    // Capture surrounding context as sourceText (provenance).
    const start = Math.max(0, (match.index ?? 0) - 120);
    const sourceText = raw.slice(start, (match.index ?? 0) + match[0].length + 120).replace(/\s+/g, " ").trim().slice(0, 600);
    facts.push({
      sourceId: snapshot.sourceId,
      contentHash: snapshot.contentHash,
      extractorVersion: EXTRACTOR_VERSION,
      kind: "requirement",
      structured: {
        kind: "tuition_fee",
        tuitionFee: amount,
        currencyCode: "GBP",
        observedAt: snapshot.fetchedAt.toISOString(),
      },
      sourceText,
      confidence: 0.82,
    });
    // Only emit the first high-confidence fee per snapshot to avoid noise;
    // multiple fees on one page are ambiguous without course scoping.
    if (facts.length >= 1) break;
  }
  return facts;
}

function extractDeadlineFacts(raw: string, snapshot: SourceSnapshot): ExtractedFact[] {
  const facts: ExtractedFact[] = [];
  // Matches: 29 January 2026  15 October 2025  31 July 2026 etc.
  const month = "(January|February|March|April|May|June|July|August|September|October|November|December)";
  const deadlineRegex = new RegExp(`\\b(\\d{1,2})\\s+${month}\\s+(20\\d{2})\\b`, "gi");
  let match: RegExpExecArray | null;
  while ((match = deadlineRegex.exec(raw)) !== null) {
    const full = match[0];
    // Look for deadline-adjacent keywords to raise confidence.
    const window = raw.slice(Math.max(0, (match.index ?? 0) - 200), (match.index ?? 0) + full.length + 200).toLowerCase();
    const isDeadlineContext = /deadline|apply|application|ucas|closing date|equal consideration/.test(window);
    if (!isDeadlineContext) continue;
    const parsed = Date.parse(full);
    if (Number.isNaN(parsed)) continue;
    const deadline = new Date(parsed);
    // Only future or near-future deadlines are relevant for ingestion.
    if (deadline.getFullYear() < 2025 || deadline.getFullYear() > 2035) continue;
    const start = Math.max(0, (match.index ?? 0) - 120);
    const sourceText = raw.slice(start, (match.index ?? 0) + full.length + 120).replace(/\s+/g, " ").trim().slice(0, 600);
    facts.push({
      sourceId: snapshot.sourceId,
      contentHash: snapshot.contentHash,
      extractorVersion: EXTRACTOR_VERSION,
      kind: "requirement",
      structured: {
        kind: "application_deadline",
        applicationDeadline: deadline.toISOString(),
        observedAt: snapshot.fetchedAt.toISOString(),
      },
      sourceText: `${full} — ${sourceText}`,
      confidence: 0.78,
    });
    if (facts.length >= 2) break;
  }
  return facts;
}

function extractLanguageFacts(raw: string, snapshot: SourceSnapshot): ExtractedFact[] {
  const facts: ExtractedFact[] = [];
  // Matches: IELTS 6.5 with 6.0 in each component, IELTS 6.5 overall etc.
  const ieltsRegex = /IELTS[^.]{0,120}?(\d\.\d)[^.]{0,120}?(\d\.\d)?/gi;
  let match: RegExpExecArray | null;
  while ((match = ieltsRegex.exec(raw)) !== null) {
    const overall = Number(match[1]);
    const component = match[2] ? Number(match[2]) : null;
    if (!Number.isFinite(overall) || overall < 5 || overall > 9) continue;
    const start = Math.max(0, (match.index ?? 0) - 120);
    const sourceText = raw.slice(start, (match.index ?? 0) + match[0].length + 120).replace(/\s+/g, " ").trim().slice(0, 600);
    facts.push({
      sourceId: snapshot.sourceId,
      contentHash: snapshot.contentHash,
      extractorVersion: EXTRACTOR_VERSION,
      kind: "requirement",
      structured: {
        kind: "language",
        test: "IELTS",
        overall,
        componentMinimum: component,
        observedAt: snapshot.fetchedAt.toISOString(),
      },
      sourceText,
      confidence: 0.85,
    });
    if (facts.length >= 1) break;
  }
  return facts;
}

function extractAcademicRequirementFacts(raw: string, snapshot: SourceSnapshot): ExtractedFact[] {
  const facts: ExtractedFact[] = [];
  // UK degree classes: 2:1, 2:2, First, Upper second etc.
  const degreeRegex = /(2:1|2:2|first[\s-]?class|upper second|lower second)[^.]{0,140}?(honours|hons|degree|bachelor)?/gi;
  let match: RegExpExecArray | null;
  while ((match = degreeRegex.exec(raw)) !== null) {
    const degreeClassRaw = match[1];
    if (!degreeClassRaw) continue;
    const window = raw.slice(Math.max(0, (match.index ?? 0) - 200), (match.index ?? 0) + match[0].length + 200).toLowerCase();
    const isAcademicContext = /degree|honours|hons|grade|a level|requirement|entry|academic/.test(window);
    if (!isAcademicContext) continue;
    const sourceText = raw.slice(Math.max(0, (match.index ?? 0) - 120), (match.index ?? 0) + match[0].length + 120).replace(/\s+/g, " ").trim().slice(0, 600);
    facts.push({
      sourceId: snapshot.sourceId,
      contentHash: snapshot.contentHash,
      extractorVersion: EXTRACTOR_VERSION,
      kind: "requirement",
      structured: {
        kind: "academic",
        degreeClass: normalizeDegreeClass(degreeClassRaw),
        observedAt: snapshot.fetchedAt.toISOString(),
      },
      sourceText,
      confidence: 0.7,
    });
    if (facts.length >= 1) break;
  }
  return facts;
}

function normalizeDegreeClass(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("first")) return "first";
  if (lower.includes("2:1") || lower.includes("upper second")) return "2:1";
  if (lower.includes("2:2") || lower.includes("lower second")) return "2:2";
  return lower;
}

function sourceSpecificExtract(_raw: string, _snapshot: SourceSnapshot): ExtractedFact[] {
  // Reserved for per-source overrides (e.g., Birmingham uses "Fees: £X" table
  // markup). v1 ships generic rules only so every source is handled uniformly.
  return [];
}

export const EXTRACTOR_VERSION_EXPORT = EXTRACTOR_VERSION;
