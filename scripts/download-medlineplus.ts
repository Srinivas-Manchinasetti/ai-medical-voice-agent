import fs from "fs";
import path from "path";
import crypto from "crypto";

const MPLUS_URL = "https://medlineplus.gov/xml/mplus_topics_2026-09-05.xml";
const RAW_DIR = path.join(process.cwd(), "data", "medlineplus", "raw");
const TARGET_FILE = path.join(RAW_DIR, "mplus_topics_2026-09-05.xml");
const META_FILE = path.join(RAW_DIR, "manifest.json");

export async function downloadMedlinePlusXml(force = false): Promise<{
  filePath: string;
  byteSize: number;
  sha256: string;
  downloadedAt: string;
  sourceUrl: string;
  releaseDate: string;
  publisher: string;
}> {
  if (!fs.existsSync(RAW_DIR)) {
    fs.mkdirSync(RAW_DIR, { recursive: true });
  }

  if (!force && fs.existsSync(TARGET_FILE) && fs.existsSync(META_FILE)) {
    try {
      const meta = JSON.parse(fs.readFileSync(META_FILE, "utf-8"));
      console.log(`[MedlinePlus] Using cached raw XML: ${TARGET_FILE} (${meta.byteSize} bytes, SHA: ${meta.sha256.slice(0, 12)}...)`);
      return meta;
    } catch {
      // Re-download if metadata unreadable
    }
  }

  console.log(`[MedlinePlus] Downloading canonical XML from ${MPLUS_URL}...`);
  const res = await fetch(MPLUS_URL);
  if (!res.ok) {
    throw new Error(`Failed to download MedlinePlus XML: HTTP ${res.status} ${res.statusText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const byteSize = buffer.length;

  const hash = crypto.createHash("sha256").update(buffer).digest("hex");
  fs.writeFileSync(TARGET_FILE, buffer);

  const meta = {
    filePath: TARGET_FILE,
    byteSize,
    sha256: hash,
    downloadedAt: new Date().toISOString(),
    sourceUrl: MPLUS_URL,
    releaseDate: "2026-09-05",
    publisher: "U.S. National Library of Medicine (NLM) / NIH",
  };

  fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2), "utf-8");
  console.log(`[MedlinePlus] Download complete: ${byteSize} bytes, SHA-256: ${hash}`);
  return meta;
}

if (require.main === module || process.argv[1]?.includes("download-medlineplus")) {
  downloadMedlinePlusXml()
    .then((m) => console.log("Success:", m))
    .catch((err) => {
      console.error("Error downloading MedlinePlus XML:", err);
      process.exit(1);
    });
}
