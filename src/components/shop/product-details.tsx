"use client";

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="commerce-accordion" open={title === "Produktbeschreibung"}>
      <summary>{title}</summary>
      <div className="pt-3 text-sm leading-7 text-muted-foreground">{children}</div>
    </details>
  );
}

export function ProductDetails({
  product: p,
  listing,
  taxNote,
}: {
  product: any;
  listing: any;
  taxNote?: string;
}) {
  return (
    <div className="mt-8 divide-y divide-white/10 border-t border-white/10">
      <Block title="Produktbeschreibung">
        <p className="whitespace-pre-line">
          {p.description ||
            "Weitere Produktinformationen werden vor der Bestellung geprüft."}
        </p>
        {listing.highlights?.length > 0 && (
          <ul className="mt-3 list-disc space-y-1 pl-5">
            {listing.highlights.map((h: string) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        )}
      </Block>
      {(p.material || listing.care?.length > 0) && (
        <Block title="Material & Pflege">
          {p.material && <p>Material: {p.material}</p>}
          {p.fit && <p>Passform: {p.fit}</p>}
          {listing.care?.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {listing.care.map((c: string) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          )}
        </Block>
      )}
      {listing.size_guide && (
        <Block title="Größe & Passform">
          <p className="whitespace-pre-line">{listing.size_guide}</p>
        </Block>
      )}
      <Block title="Versand & Rückgabe">
        <p>
          Direktversand vom Lieferanten. Zahlung erst nach Annahme deines
          geprüften Angebots. {taxNote || "Verbindlicher Preis und Versand nach Prüfung."}
        </p>
      </Block>
      {listing.faq?.length > 0 && (
        <Block title="Häufige Fragen">
          <div className="space-y-3">
            {listing.faq.map((f: any) => (
              <div key={f.q}>
                <p className="font-medium text-foreground">{f.q}</p>
                <p>{f.a}</p>
              </div>
            ))}
          </div>
        </Block>
      )}
    </div>
  );
}
