import fs from "fs";
import path from "path";
import readline from "readline";

export interface ProcessedTopic {
  topicId: string;
  title: string;
  metaDesc: string;
  url: string;
  alsoCalled: string[];
  language: string;
  dateCreated: string;
  sections: {
    overview?: string;
    symptoms?: string;
    emergency_guidance?: string;
    diagnosis?: string;
    treatment?: string;
    risk_factors?: string;
    prevention?: string;
  };
}

export interface IngestedPassage {
  id: string;
  topicId: string;
  title: string;
  section: "overview" | "symptoms" | "emergency_guidance" | "diagnosis" | "treatment" | "risk_factors" | "prevention";
  source: string;
  sourceUrl: string;
  releaseDate: string;
  authority: "government_reference";
  content: string;
  keyTerms: string[];
}

function cleanHtml(rawHtml: string): string {
  if (!rawHtml) return "";
  return rawHtml
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractKeyTerms(text: string, title: string, aliases: string[]): string[] {
  const terms = new Set<string>();
  terms.add(title.toLowerCase());
  for (const a of aliases) {
    terms.add(a.toLowerCase());
  }

  const matches = text.match(/\b[A-Za-z-]{4,}\b/g) || [];
  const stopWords = new Set([
    "this", "that", "with", "from", "have", "more", "your", "they", "will", "what",
    "when", "where", "which", "there", "their", "about", "other", "some", "these",
    "people", "cause", "call", "right", "away", "also", "into", "been", "only"
  ]);

  for (const m of matches) {
    const l = m.toLowerCase();
    if (!stopWords.has(l) && l.length > 3) {
      terms.add(l);
      if (terms.size >= 18) break;
    }
  }
  return Array.from(terms);
}

function parseSectionsFromSummary(rawSummary: string): Record<string, string> {
  const unescaped = rawSummary
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  const sections: Record<string, string> = {};

  // Split by <h3> headers
  const parts = unescaped.split(/<h3>(.*?)<\/h3>/i);

  if (parts.length === 1) {
    // No explicit h3 tags, entire text is overview
    const clean = cleanHtml(parts[0]);
    if (clean) sections.overview = clean;
    return sections;
  }

  // First part before any h3 is intro / overview
  const intro = cleanHtml(parts[0]);
  if (intro) sections.overview = intro;

  // Interleaved: parts[1] = header, parts[2] = content, parts[3] = header, parts[4] = content...
  for (let i = 1; i < parts.length; i += 2) {
    const header = (parts[i] || "").toLowerCase();
    const content = cleanHtml(parts[i + 1] || "");
    if (!content) continue;

    if (header.includes("symptom") || header.includes("sign")) {
      sections.symptoms = (sections.symptoms ? sections.symptoms + " " : "") + content;
      // Check for emergency guidance within symptoms
      if (/call 911|emergency|immediate medical|right away/i.test(content)) {
        const emergencySnippet = content.split(/(?<=[.!?])\s+/).filter(s => /call 911|emergency|immediate medical|right away/i.test(s)).join(" ");
        if (emergencySnippet) {
          sections.emergency_guidance = (sections.emergency_guidance ? sections.emergency_guidance + " " : "") + emergencySnippet;
        }
      }
    } else if (header.includes("diagnos") || header.includes("test")) {
      sections.diagnosis = (sections.diagnosis ? sections.diagnosis + " " : "") + content;
    } else if (header.includes("treatment") || header.includes("manage") || header.includes("therap")) {
      sections.treatment = (sections.treatment ? sections.treatment + " " : "") + content;
    } else if (header.includes("risk") || header.includes("cause") || header.includes("who is at")) {
      sections.risk_factors = (sections.risk_factors ? sections.risk_factors + " " : "") + content;
    } else if (header.includes("prevent")) {
      sections.prevention = (sections.prevention ? sections.prevention + " " : "") + content;
    } else {
      sections.overview = (sections.overview ? sections.overview + " " : "") + content;
    }
  }

  // If emergency phrases exist in intro and not captured yet
  if (!sections.emergency_guidance && intro && /call 911|emergency|immediate medical|right away/i.test(intro)) {
    const emergencySnippet = intro.split(/(?<=[.!?])\s+/).filter(s => /call 911|emergency|immediate medical|right away/i.test(s)).join(" ");
    if (emergencySnippet) sections.emergency_guidance = emergencySnippet;
  }

  return sections;
}

export async function ingestMedlinePlusXml(): Promise<{
  topicsCount: number;
  passagesCount: number;
  rawByteSize: number;
  sha256: string;
  releaseDate: string;
}> {
  const rawDir = path.join(process.cwd(), "data", "medlineplus", "raw");
  const processedDir = path.join(process.cwd(), "data", "medlineplus", "processed");
  const indexDir = path.join(process.cwd(), "data", "medlineplus", "index");

  fs.mkdirSync(processedDir, { recursive: true });
  fs.mkdirSync(indexDir, { recursive: true });

  const rawXmlPath = path.join(rawDir, "mplus_topics_2026-09-05.xml");
  const manifestPath = path.join(rawDir, "manifest.json");

  if (!fs.existsSync(rawXmlPath)) {
    throw new Error(`MedlinePlus XML not found at ${rawXmlPath}. Run scripts/download-medlineplus.ts first.`);
  }

  let rawMeta = { byteSize: 0, sha256: "", releaseDate: "2026-09-05" };
  if (fs.existsSync(manifestPath)) {
    try {
      rawMeta = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    } catch {}
  }

  const topicsOutPath = path.join(processedDir, "topics.jsonl");
  const passagesOutPath = path.join(processedDir, "passages.jsonl");

  const topicsStream = fs.createWriteStream(topicsOutPath, { encoding: "utf-8" });
  const passagesStream = fs.createWriteStream(passagesOutPath, { encoding: "utf-8" });

  const fileStream = fs.createReadStream(rawXmlPath, { encoding: "utf-8" });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let inTopic = false;
  let topicLines: string[] = [];
  let topicsCount = 0;
  let passagesCount = 0;

  const sectionCounts: Record<string, number> = {
    overview: 0,
    symptoms: 0,
    emergency_guidance: 0,
    diagnosis: 0,
    treatment: 0,
    risk_factors: 0,
    prevention: 0,
  };

  console.log(`[Ingest] Starting semantic parsing of MedlinePlus topics XML...`);

  for await (const line of rl) {
    if (line.includes("<health-topic")) {
      inTopic = true;
      topicLines = [line];
    } else if (inTopic) {
      topicLines.push(line);
      if (line.includes("</health-topic>")) {
        inTopic = false;
        const topicXml = topicLines.join("\n");
        topicLines = [];

        // Extract attributes from <health-topic ...>
        const openTagMatch = topicXml.match(/<health-topic([^>]*)>/);
        if (!openTagMatch) continue;

        const attrs = openTagMatch[1];
        const idMatch = attrs.match(/\bid="([^"]*)"/);
        const titleMatch = attrs.match(/\btitle="([^"]*)"/);
        const urlMatch = attrs.match(/\burl="([^"]*)"/);
        const langMatch = attrs.match(/\blanguage="([^"]*)"/);
        const dateMatch = attrs.match(/\bdate-created="([^"]*)"/);
        const metaDescMatch = attrs.match(/\bmeta-desc="([^"]*)"/);

        const language = langMatch ? langMatch[1] : "English";
        // Filter for English topics for canonical clinical knowledge
        if (language !== "English") continue;

        const topicId = idMatch ? idMatch[1] : `topic-${topicsCount + 1}`;
        const title = titleMatch ? titleMatch[1] : "Unknown";
        const url = urlMatch ? urlMatch[1] : "";
        const dateCreated = dateMatch ? dateMatch[1] : "2026-09-05";
        const metaDesc = metaDescMatch ? metaDescMatch[1] : "";

        // Also-called elements
        const alsoCalled: string[] = [];
        const alsoCalledMatches = topicXml.matchAll(/<also-called>([^<]*)<\/also-called>/g);
        for (const m of alsoCalledMatches) {
          if (m[1].trim()) alsoCalled.push(m[1].trim());
        }

        // Full-summary
        const summaryMatch = topicXml.match(/<full-summary>([\s\S]*?)<\/full-summary>/);
        const rawSummary = summaryMatch ? summaryMatch[1] : "";

        const sections = parseSectionsFromSummary(rawSummary);

        const topicRecord: ProcessedTopic = {
          topicId,
          title,
          metaDesc,
          url,
          alsoCalled,
          language,
          dateCreated,
          sections,
        };

        topicsStream.write(JSON.stringify(topicRecord) + "\n");
        topicsCount++;

        // Emit typed passages for each non-empty section
        for (const [secName, secContent] of Object.entries(sections)) {
          if (!secContent || secContent.length < 20) continue;
          const sectionType = secName as IngestedPassage["section"];

          const passageId = `MPLUS-${topicId}-${secName.toUpperCase()}`;
          const keyTerms = extractKeyTerms(secContent, title, alsoCalled);

          const passage: IngestedPassage = {
            id: passageId,
            topicId,
            title,
            section: sectionType,
            source: "MedlinePlus",
            sourceUrl: url,
            releaseDate: "2026-09-05",
            authority: "government_reference",
            content: secContent,
            keyTerms,
          };

          passagesStream.write(JSON.stringify(passage) + "\n");
          passagesCount++;
          sectionCounts[secName] = (sectionCounts[secName] || 0) + 1;
        }
      }
    }
  }

  topicsStream.end();
  passagesStream.end();

  const indexMeta = {
    corpus: "MedlinePlus Clinical Knowledge",
    publisher: "U.S. National Library of Medicine (NLM) / NIH",
    releaseDate: "2026-09-05",
    rawFile: {
      path: rawXmlPath,
      byteSize: rawMeta.byteSize,
      sha256: rawMeta.sha256,
    },
    ingestedAt: new Date().toISOString(),
    topicsCount,
    passagesCount,
    sectionDistribution: sectionCounts,
  };

  fs.writeFileSync(path.join(indexDir, "metadata.json"), JSON.stringify(indexMeta, null, 2), "utf-8");

  console.log(`[Ingest] Ingestion Complete!`);
  console.log(`  • Topics Processed: ${topicsCount}`);
  console.log(`  • Clinical Passages Generated: ${passagesCount}`);
  console.log(`  • Section Breakdown:`, sectionCounts);

  return {
    topicsCount,
    passagesCount,
    rawByteSize: rawMeta.byteSize,
    sha256: rawMeta.sha256,
    releaseDate: "2026-09-05",
  };
}

if (require.main === module || process.argv[1]?.includes("ingest-medlineplus")) {
  ingestMedlinePlusXml()
    .then((res) => console.log("Ingestion result:", res))
    .catch((err) => {
      console.error("Ingestion failed:", err);
      process.exit(1);
    });
}
