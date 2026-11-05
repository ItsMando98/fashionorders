"use client";
import Link from "next/link";
import { useState } from "react";
import { Trash2, ArrowRight } from "lucide-react";
import { ShopShell } from "@/components/shop/shell";
import {
  api,
  useData,
  eur,
  Notice,
  Loading,
} from "@/components/commerce/client";
export default function CartPage() {
  const { data, error, loading, reload } = useData("cart");
  const [failure, setFailure] = useState("");
  async function update(id: number, quantity?: number) {
    try {
      await api(
        `cart/${id}`,
        quantity ? { quantity } : {},
        quantity ? "PATCH" : "DELETE",
      );
      await reload();
    } catch (e) {
      setFailure((e as Error).message);
    }
  }
  const sum = data?.lines.some((l: any) => l.estimated_cents == null)
    ? null
    : data?.lines.reduce(
        (n: number, l: any) => n + Number(l.estimated_cents),
        0,
      );
  return (
    <ShopShell>
      <p className="commerce-eyebrow">Deine Auswahl</p>
      <h1 className="mb-8 text-3xl font-medium tracking-tight md:text-4xl">
        Warenkorb
      </h1>
      <Notice error={error || failure} />
      {loading ? (
        <Loading />
      ) : data?.lines.length ? (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="divide-y divide-white/10">
            {data.lines.map((l: any) => (
              <article key={l.id} className="flex gap-5 py-5">
                <Link
                  href={`/shop/product/${l.product_id}`}
                  className="aspect-[3/4] w-24 shrink-0 bg-secondary md:w-32"
                >
                  {l.image && (
                    <img
                      src={l.image}
                      className="h-full w-full object-cover"
                      alt={l.title}
                    />
                  )}
                </Link>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Link
                    href={`/shop/product/${l.product_id}`}
                    className="font-medium leading-snug"
                  >
                    {l.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {l.variant.size} · {l.variant.color || "Laut Abbildung"}
                  </p>
                  <p>{eur(l.estimated_cents)}</p>
                  <div className="mt-auto flex items-center gap-5">
                    <label className="text-xs">
                      Menge
                      <input
                        className="commerce-input ml-2 w-20"
                        aria-label={`Menge für ${l.title}`}
                        type="number"
                        min="1"
                        max="99"
                        value={l.quantity}
                        onChange={(e) =>
                          void update(l.id, Number(e.target.value))
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="text-xs underline"
                      aria-label={`${l.title} entfernen`}
                      onClick={() => void update(l.id)}
                    >
                      <Trash2 size={16} className="inline" /> Entfernen
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <aside className="commerce-panel self-start">
            <h2 className="text-xl">Zusammenfassung</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Wir prüfen die Artikel, Preise und Lieferbarkeit. Danach erhältst
              du dein Angebot mit Versandkosten. Du bezahlst erst nach deiner
              Annahme.
            </p>
            <p className="mt-6 flex justify-between text-sm">
              <span>Vorläufige Artikelsumme</span>
              <strong>{sum == null ? "Noch offen" : eur(sum)}</strong>
            </p>
            <Link href="/checkout" className="commerce-button mt-6 w-full">
              Zur Bestellanfrage <ArrowRight size={16} />
            </Link>
          </aside>
        </div>
      ) : (
        <div className="commerce-empty">
          <h2>Dein Warenkorb ist noch leer.</h2>
          <Link className="commerce-button" href="/shop">
            Produkte entdecken
          </Link>
        </div>
      )}
    </ShopShell>
  );
}
