"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Plus, RefreshCw } from "lucide-react";
import { ShopShell } from "@/components/shop/shell";
import {
  api,
  useData,
  ProductCard,
  Status,
  Pager,
  Notice,
} from "@/components/commerce/client";
export default function Account() {
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState("imports"),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const jobs = useData("imports"),
    products = useData(
      `products?scope=${tab === "imports" ? "imports" : "saved"}&page=${page}${tab === "saved" ? "&saved=1" : ""}`,
    ),
    collections = useData("collections"),
    addresses = useData("addresses");
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("tab");
    if (q && ["imports", "saved", "collections", "addresses"].includes(q))
      setTab(q);
  }, []);
  useEffect(() => {
    if (
      !jobs.data?.jobs.some((j: any) =>
        ["queued", "running"].includes(j.status),
      )
    )
      return;
    const t = setInterval(() => {
      void jobs.reload();
      void products.reload();
    }, 5000);
    return () => clearInterval(t);
  }, [jobs.data, jobs.reload, products.reload]);
  function select(t: string) {
    setTab(t);
    setPage(1);
    window.history.replaceState(null, "", `/account?tab=${t}`);
  }
  async function submit(
    path: string,
    body: Record<string, any>,
    reload: () => Promise<void>,
  ) {
    setBusy(true);
    setError("");
    try {
      await api(path, body);
      await reload();
      setMessage("Gespeichert.");
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <ShopShell>
      <div className="flex justify-between items-end gap-4">
        <div>
          <p className="commerce-eyebrow">Dein persönlicher Bereich</p>
          <h1 className="commerce-title">Deine Fundstücke.</h1>
        </div>
        <Link className="text-xs underline" href="/?view=gram">
          Fashiongram <ArrowUpRight size={13} className="inline" />
        </Link>
      </div>
      <nav
        aria-label="Kontobereiche"
        className="flex gap-2 overflow-x-auto border-b border-border py-6 mb-8"
      >
        {[
          ["imports", "Meine Importe"],
          ["saved", "Merkliste"],
          ["collections", "Sammlungen"],
          ["addresses", "Adressen"],
        ].map(([v, l]) => (
          <button
            key={v}
            aria-current={tab === v ? "page" : undefined}
            className={`commerce-tab ${tab === v ? "selected" : ""}`}
            onClick={() => select(v)}
          >
            {l}
          </button>
        ))}
      </nav>
      <Notice error={error || jobs.error || products.error} text={message} />
      {tab === "imports" && (
        <>
          <div className="commerce-panel grid md:grid-cols-[1fr_1fr] gap-8 mb-10">
            <div>
              <p className="commerce-eyebrow">Dein Fund. Deine Auswahl.</p>
              <h2 className="text-2xl mt-3">
                Link rein. Lieblingsstück sichern.
              </h2>
              <p className="text-sm text-muted-foreground leading-6 mt-3">
                Importiere Yupoo-Alben, ganze Collections oder Weidian-Produkte.
                Alle Collection-Seiten werden automatisch im Hintergrund
                verarbeitet. Deine Artikel werden privat gespeichert. Preise und
                Varianten prüfen wir vor deinem Angebot.
              </p>
            </div>
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const urls = String(new FormData(form).get("urls") || "")
                  .split(/\n/)
                  .map((s) => s.trim())
                  .filter(Boolean);
                const success = await submit("imports", { urls }, jobs.reload);
                if (success) form.reset();
              }}
            >
              <label className="commerce-field">
                Ein Produktlink pro Zeile
                <textarea
                  required
                  name="urls"
                  rows={4}
                  className="commerce-input resize-y"
                  placeholder="https://…x.yupoo.com/albums/…"
                />
              </label>
              <button disabled={busy} className="commerce-button w-full">
                {busy ? "Wird gestartet …" : "Privat importieren"}
                <Plus size={16} />
              </button>
            </form>
          </div>
          {jobs.data?.jobs.length > 0 && (
            <details
              className="commerce-panel mb-8"
              open={jobs.data?.jobs.some((j: any) => j.status !== "done")}
            >
              <summary className="cursor-pointer">Importfortschritt</summary>
              <div className="divide-y divide-border mt-4">
                {jobs.data?.jobs.map((j: any) => (
                  <div
                    key={j.id}
                    className="py-3 flex flex-wrap gap-3 justify-between items-center"
                  >
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground break-all">
                        {j.url}
                      </p>
                      {j.result?.type === "collection" && (
                        <p className="text-sm">
                          Collection erkannt · {j.result.albums} Produktalben
                          eingereiht
                        </p>
                      )}
                      {j.error && (
                        <p className="text-xs text-red-300">{j.error}</p>
                      )}
                      {j.result?.warnings?.map((w: string) => (
                        <p key={w} className="text-xs text-muted-foreground">
                          {w}
                        </p>
                      ))}
                    </div>
                    <div className="flex items-center gap-3">
                      <Status value={j.status} />
                      {j.result?.product_id && (
                        <Link
                          className="text-xs underline"
                          href={`/shop/product/${j.result.product_id}`}
                        >
                          Ansehen
                        </Link>
                      )}
                      {j.status === "failed" && (
                        <button
                          aria-label="Import wiederholen"
                          onClick={() =>
                            void submit(
                              `imports/${j.id}/retry`,
                              {},
                              jobs.reload,
                            )
                          }
                        >
                          <RefreshCw size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}
      {["imports", "saved"].includes(tab) &&
        (products.data?.products.length ? (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-5 gap-y-10">
            {products.data.products.map((p: any) => (
              <ProductCard
                key={p.id}
                product={p}
                onChange={() => void products.reload()}
              />
            ))}
          </div>
        ) : (
          <div className="commerce-empty">
            <h2>
              {tab === "imports"
                ? "Deine privaten Importe erscheinen hier."
                : "Noch keine gespeicherten Produkte."}
            </h2>
          </div>
        ))}
      {["imports", "saved"].includes(tab) && (
        <Pager
          page={page}
          total={products.data?.total || 0}
          onChange={setPage}
        />
      )}
      {tab === "collections" && (
        <div className="space-y-6">
          <form
            className="flex gap-3 max-w-lg"
            onSubmit={(e) => {
              e.preventDefault();
              void submit(
                "collections",
                { name: new FormData(e.currentTarget).get("name") },
                collections.reload,
              );
            }}
          >
            <input
              className="commerce-input flex-1 min-w-0"
              name="name"
              required
              placeholder="Name deiner Sammlung"
              aria-label="Name der Sammlung"
            />
            <button className="commerce-button" disabled={busy}>
              Anlegen
            </button>
          </form>
          {collections.data?.collections.map((c: any) => (
            <section className="commerce-panel" key={c.id}>
              <h2 className="text-xl mb-4">{c.name}</h2>
              <div className="space-y-3">
                {c.items.map((i: any) => (
                  <div className="flex gap-4" key={i.product_id}>
                    <Link
                      className="text-sm underline"
                      href={`/shop/product/${i.product_id}`}
                    >
                      Produkt {i.product_id} ansehen
                    </Link>
                    <button
                      className="text-xs text-muted-foreground"
                      onClick={async () => {
                        await api(
                          `collections/${c.id}/items`,
                          { product_id: i.product_id },
                          "DELETE",
                        );
                        void collections.reload();
                      }}
                    >
                      Entfernen
                    </button>
                  </div>
                ))}
              </div>
              <form
                className="flex gap-2 mt-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void submit(
                    `collections/${c.id}/items`,
                    {
                      product_id: new FormData(e.currentTarget).get(
                        "product_id",
                      ),
                    },
                    collections.reload,
                  );
                }}
              >
                <select
                  name="product_id"
                  className="commerce-input flex-1"
                  required
                  aria-label="Produkt zur Sammlung hinzufügen"
                >
                  <option value="">Gespeichertes Produkt auswählen</option>
                  {products.data?.products.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
                <button className="commerce-button secondary" disabled={busy}>
                  Hinzufügen
                </button>
              </form>
              <form
                className="flex flex-wrap gap-3 mt-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  await submit(
                    `collections/${c.id}/shares`,
                    { name: f.get("name") },
                    collections.reload,
                  );
                }}
              >
                <input
                  name="name"
                  className="commerce-input flex-1"
                  required
                  placeholder="Exakter Benutzername"
                  aria-label="Benutzer für Freigabe"
                />
                <button className="commerce-button secondary" disabled={busy}>
                  Sammlung freigeben
                </button>
                <button
                  type="button"
                  className="text-xs underline"
                  onClick={async (e) => {
                    const f = new FormData(e.currentTarget.form!);
                    try {
                      await api(
                        `collections/${c.id}/shares`,
                        { name: f.get("name") },
                        "DELETE",
                      );
                      setMessage("Freigabe widerrufen.");
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Freigabe widerrufen
                </button>
              </form>
            </section>
          ))}
          {collections.data?.shared?.map((c: any) => (
            <section key={c.id} className="commerce-panel">
              <h2 className="text-xl">{c.name}</h2>
              <p className="text-xs text-muted-foreground mt-2">
                Von {c.owner} für dich freigegeben
              </p>
              <div className="mt-4 space-y-3">
                {c.items?.map((i: any) => (
                  <Link
                    key={i.product_id}
                    className="block text-sm underline"
                    href={`/shop/product/${i.product_id}`}
                  >
                    Geteiltes Produkt ansehen →
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {tab === "addresses" && (
        <div className="grid md:grid-cols-2 gap-6">
          {addresses.data?.addresses.map((a: any) => (
            <div className="commerce-panel space-y-3" key={a.id}>
              <h2>{a.label}</h2>
              <address className="not-italic text-sm text-muted-foreground">
                {a.address.name}
                <br />
                {a.address.street}
                <br />
                {a.address.zip} {a.address.city}
                <br />
                {a.address.country}
              </address>
              <button
                className="text-xs underline"
                onClick={async () => {
                  await api(`addresses/${a.id}`, {}, "DELETE");
                  void addresses.reload();
                }}
              >
                Entfernen
              </button>
            </div>
          ))}
          <div className="commerce-panel">
            <h2 className="text-xl">Lieferadressen</h2>
            <p className="text-sm text-muted-foreground mt-3">
              Neue Adressen kannst du bei deiner nächsten Bestellanfrage
              speichern.
            </p>
            <Link href="/cart" className="commerce-button secondary mt-5">
              Zum Warenkorb
            </Link>
          </div>
        </div>
      )}
    </ShopShell>
  );
}
