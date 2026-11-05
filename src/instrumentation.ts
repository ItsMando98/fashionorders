/**
 * Next.js Instrumentation Hook (Backend): laeuft genau einmal beim
 * Server-Start — der richtige Ort, um den Cron-Scheduler zu starten.
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Nur im Node.js-Server (nicht im Build, nicht in der Edge-Runtime) und
  // abschaltbar via DISABLE_SCRAPE_SCHEDULER=1 (z.B. fuer CLI-Skripte/Tests).
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.DISABLE_SCRAPE_SCHEDULER !== "1" && process.env.SHOP_V2_ENABLED !== "1") {
    const { startScheduler } = await import("@/lib/server/scheduler");
    startScheduler();
  }
}
