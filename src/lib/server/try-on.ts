import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { CACHE_DIR } from "./gram";
import { PublicError } from "./http";

const execFileAsync = promisify(execFile);

function tregBin(): string {
  if (process.env.TREG_BIN && fs.existsSync(process.env.TREG_BIN)) return process.env.TREG_BIN;
  const local = "/Users/superno/.local/bin/treg";
  if (fs.existsSync(local)) return local;
  return "treg";
}

/** Hidden from the user. They only pick products; this sentence builds the photo. */
export function lookPrompt(titles: string[]): string {
  const list = titles.map((title, index) => `${index + 1}. ${title}`).join("\n");
  return [
    "Photoreal full-body fashion photograph. No text, no letters, no logo, no watermark.",
    "A fashion model stands in a night desert under a huge orange planet, with a cyan neon ring to one side.",
    "Dress the model in one complete outfit made only from these products:",
    list,
    "Match the reference photos for color, cut, and material. Orange rim light. Sharp editorial photo.",
  ].join("\n");
}

async function hostFile(file: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(tregBin(), ["host", file], { timeout: 30000 });
    const url = stdout
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.startsWith("http"));
    return url || null;
  } catch (err) {
    console.error("treg host", err);
    return null;
  }
}

export async function dressModel(lookId: number, titles: string[], imageFiles: string[]): Promise<string> {
  const imageUrls: string[] = [];
  for (const file of imageFiles.slice(0, 4)) {
    if (!fs.existsSync(file)) continue;
    const url = await hostFile(file);
    if (url) imageUrls.push(url);
  }

  const body = {
    model: "gemini-3-pro-image-preview",
    prompt: lookPrompt(titles),
    size: "3:4",
    resolution: "1K",
    ...(imageUrls.length ? { image_urls: imageUrls } : {}),
  };

  let stdout = "";
  try {
    const result = await execFileAsync(
      tregBin(),
      [
        "call",
        "reapi.image-gen.gemini-3-pro-image",
        "--await",
        "--timeout",
        "150",
        "--json",
        "--data",
        JSON.stringify(body),
      ],
      { timeout: 170000, maxBuffer: 4_000_000 }
    );
    stdout = result.stdout;
  } catch (err) {
    console.error("treg look", err);
    throw new PublicError("The model photo could not be created. Try again in a minute.", 502);
  }

  const start = stdout.indexOf("{");
  const data = start >= 0 ? JSON.parse(stdout.slice(start)) : {};
  const url: string | undefined = data?.output?.image_urls?.[0];
  if (!url) throw new PublicError("The model photo came back empty. Try again.", 502);

  const filename = `look_${lookId}.png`;
  const dest = path.join(CACHE_DIR, filename);
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const response = await fetch(url);
  if (!response.ok) throw new PublicError("The model photo could not be saved.", 502);
  fs.writeFileSync(dest, Buffer.from(await response.arrayBuffer()));
  return filename;
}
