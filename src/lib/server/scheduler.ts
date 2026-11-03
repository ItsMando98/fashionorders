/**
 * Cron-Scheduler (Backend) fuer den Seller-Auto-Scrape.
 *
 * Laeuft in-process im Next.js-Server (gestartet ueber instrumentation.ts):
 * alle 60 Sekunden ein Tick, der alle aktiven Scrape-Quellen prueft. Eine
 * Quelle ist "faellig", wenn ihr letzter Lauf laenger als `interval_hours`
 * zurueckliegt (oder sie noch nie lief). Faellige Quellen werden im
 * Hintergrund gescraped — mit Lock, damit keine Quelle doppelt parallel laeuft.
 *
 * Bewusst ohne node-cron o.ae. implementiert: ein Intervall-Vergleich ist
 * robuster bei Server-Neustarts und braucht keine Cron-Syntax. Abschaltbar
 * ueber die Env-Variable DISABLE_SCRAPE_SCHEDULER=1.
 */
import { eq } from "drizzle-orm";
import { db, ensureDb, scrapeSources } from "./db";
import { runScrapeSource } from "./seller-scraper";

const TICK_MS = 60_000; // Pruefintervall: 1 Minute
const FIRST_RUN_DELAY_MS = 20_000; // erster Tick kurz nach Server-Start

// IDs der Quellen, die gerade laufen (Lock gegen Doppel-Ausfuehrung)
const runningIds = new Set<number>();
let ticking = false;

export function isSourceRunning(id: number): boolean {
  return runningIds.has(id);
}

// Startet einen Scrape-Lauf im Hintergrund. Gibt false zurueck, wenn die
// Quelle bereits laeuft. Wird vom Scheduler-Tick UND von der Admin-API
// ("Run now") genutzt.
export function triggerSourceRun(id: number): boolean {
  if (runningIds.has(id)) return false;
  runningIds.add(id);
  void (async () => {
    try {
      await ensureDb();
      const [source] = await db
        .select()
        .from(scrapeSources)
        .where(eq(scrapeSources.id, id))
        .limit(1);
      if (!source) return;
      const result = await runScrapeSource(source);
      console.log(
        `[scrape-scheduler] source #${id} (${source.sellerUrl}): ` +
          `${result.added} added/updated, ${result.failed} failed`
      );
    } catch (err) {
      console.error(`[scrape-scheduler] source #${id} failed:`, err);
    } finally {
      runningIds.delete(id);
    }
  })();
  return true;
}

// Parst das App-Zeitformat "YYYY-MM-DD HH:MM:SS" (UTC) in Millisekunden.
function parseUtc(ts: string | null): number {
  if (!ts) return 0;
  const ms = Date.parse(ts.replace(" ", "T") + "Z");
  return Number.isNaN(ms) ? 0 : ms;
}

async function tick() {
  if (ticking) return; // vorheriger Tick laeuft noch
  ticking = true;
  try {
    await ensureDb();
    const sources = await db.select().from(scrapeSources).where(eq(scrapeSources.active, 1));
    const now = Date.now();
    for (const source of sources) {
      if (runningIds.has(source.id)) continue;
      const dueMs = source.intervalHours * 3_600_000;
      if (now - parseUtc(source.lastRunAt) >= dueMs) {
        triggerSourceRun(source.id);
      }
    }
  } catch (err) {
    console.error("[scrape-scheduler] tick failed:", err);
  } finally {
    ticking = false;
  }
}

// Einmalig beim Server-Start aufrufen (mehrfache Aufrufe sind harmlos).
export function startScheduler() {
  const g = globalThis as { __scrapeSchedulerStarted?: boolean };
  if (g.__scrapeSchedulerStarted) return;
  g.__scrapeSchedulerStarted = true;

  const timer = setInterval(() => {
    void tick();
  }, TICK_MS);
  timer.unref?.(); // haelt den Prozess nicht kuenstlich am Leben

  const first = setTimeout(() => {
    void tick();
  }, FIRST_RUN_DELAY_MS);
  first.unref?.();

  console.log("[scrape-scheduler] started (tick every 60s)");
}
