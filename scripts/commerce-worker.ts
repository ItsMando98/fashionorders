import { workOnce, queueSources } from "../src/lib/commerce/imports";
import { closeCommerce } from "../src/lib/commerce/core";
let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});
async function main() {
  if (process.env.SHOP_V2_ENABLED !== "1")
    throw new Error("SHOP_V2_ENABLED=1 required");
  let nextSourceTick = 0;
  while (!stopping) {
    try {
      if (Date.now() > nextSourceTick) {
        await queueSources();
        nextSourceTick = Date.now() + 60000;
      }
      if (!(await workOnce())) await new Promise((r) => setTimeout(r, 2000));
    } catch {
      console.error("Worker temporarily unavailable; retrying.");
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  await closeCommerce();
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
