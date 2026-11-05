import { spotRate } from "../src/lib/commerce/payments";
(async () => {
  const results = await Promise.all(
    ["BTC", "USDC"].map(async (currency) => {
      try {
        await spotRate(currency);
        return { currency, available: true };
      } catch {
        return { currency, available: false };
      }
    }),
  );
  console.log(JSON.stringify(results));
  if (results.some((r) => !r.available)) process.exitCode = 1;
})();
