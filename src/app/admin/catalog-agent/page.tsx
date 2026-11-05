"use client";
import { useEffect, useState } from "react";
import { ShopShell } from "@/components/shop/shell";
import { useData, api, Notice, Status } from "@/components/commerce/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
export default function CatalogAgent() {
  const { data, error, reload } = useData("admin/catalog-agent");
  const [busy, setBusy] = useState(false),
    [failure, setFailure] = useState("");
  useEffect(() => {
    const timer = setInterval(() => void reload(), 5000);
    return () => clearInterval(timer);
  }, [reload]);
  async function action(path: string, body: Record<string, unknown> = {}) {
    setBusy(true);
    try {
      await api("admin/catalog-agent/" + path, body);
      setFailure("");
      await reload();
    } catch (e) {
      setFailure((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <ShopShell>
      <div className="flex flex-col gap-6">
        <div>
          <p className="commerce-eyebrow">Visuelle Katalogprüfung</p>
          <h1 className="text-3xl font-medium tracking-tight">Sortieragent</h1>
          <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
            Der Agent prüft ausschließlich neue Shop-Produkte einschließlich
            ihrer Galerie, erkennt echte Produkte, ordnet passende Ansichten
            einer Galerie zu und blendet ungeeignete Einzelbilder aus. Unsichere
            Zuordnungen bleiben im Backend prüfbar. Bestellungen und persönliche
            Importe werden nicht umgeschrieben.
          </p>
        </div>
        <Notice error={error || failure} />
        {data && !data.consent && (
          <p className="text-sm text-muted-foreground">
            Die Bildanalyse ist noch nicht freigegeben. Erst nach ausdrücklicher
            Zustimmung werden Shop-Katalogbilder an{" "}
            {data.provider === "gemini" ? "Google Gemini" : "OpenAI"}{" "}
            übertragen. Altbestand und persönliche Importe werden hier nicht
            analysiert.
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button
            disabled={busy || !data?.configured}
            onClick={() => void action("queue", { auto_apply: true })}
          >
            Neue Produkte prüfen
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void action("warm")}
          >
            Bildgrößen vorab speichern
          </Button>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          {data?.jobs?.map((j: any) => (
            <span key={j.kind + j.status}>
              {j.kind === "media_warm" ? "Bildcache" : "Bildanalyse"} ·{" "}
              {j.status} · {j.count}
            </span>
          ))}
        </div>
        <div className="grid gap-4">
          {data?.audits?.map((a: any) => (
            <Card key={a.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-4">
                  <span>Prüflauf #{a.id}</span>
                  <Status value={a.status} />
                </CardTitle>
                <CardDescription className="break-all">
                  {a.source_album}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {a.error && <Notice error={a.error} />}
                <p className="text-sm">
                  {a.result?.decisions?.length || 0} Bilder geprüft ·{" "}
                  {a.result?.groups?.filter((g: any) => g.confidence >= 0.9)
                    .length || 0}{" "}
                  sichere Produktgruppen{a.model ? " · " + a.model : ""}
                </p>
                <div className="flex flex-wrap gap-3">
                  {a.status === "done" && (
                    <Button
                      disabled={busy}
                      onClick={() => void action(a.id + "/apply")}
                    >
                      Ergebnis übernehmen
                    </Button>
                  )}
                  {a.status === "applied" && (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => void action(a.id + "/revert")}
                    >
                      Änderungen rückgängig
                    </Button>
                  )}
                </div>
                {a.result && (
                  <details>
                    <summary className="cursor-pointer text-sm">
                      Entscheidungen und Gründe ansehen
                    </summary>
                    <ul className="mt-3 flex flex-col gap-2 text-sm">
                      {a.result.decisions.map((d: any) => (
                        <li key={d.product_id}>
                          <a
                            className="underline"
                            href={"/shop/product/" + d.product_id}
                          >
                            #{d.product_id}
                          </a>{" "}
                          · {d.kind} · {Math.round(d.confidence * 100)}% ·{" "}
                          {d.reason}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </ShopShell>
  );
}
