"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type Media = {
  id: number;
  url: string;
  alt?: string;
  kind?: string;
  variant_id?: number | null;
};

export function ProductGallery({
  title,
  media,
  variantIds,
}: {
  title: string;
  media: Media[];
  variantIds: number[];
}) {
  const photos = media.filter((m) => m.kind !== "size_chart");
  const preferred = photos.filter(
    (m) => m.variant_id && variantIds.includes(m.variant_id),
  );
  const rest = photos.filter((m) => !preferred.includes(m));
  const list = preferred.length
    ? [...preferred, ...rest.filter((m) => !m.variant_id)]
    : photos;
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const start = useRef(0);
  const key = list.map((m) => m.id).join(",");
  useEffect(() => {
    setIndex(0);
  }, [key]);
  const current = list[index];
  function go(next: number) {
    if (!list.length) return;
    setIndex((next + list.length) % list.length);
  }
  return (
    <section
      aria-label="Produktgalerie"
      className="grid gap-3 md:grid-cols-[72px_minmax(0,1fr)]"
    >
      <div className="hidden max-h-[70vh] flex-col gap-2 overflow-auto md:flex">
        {list.map((m, i) => (
          <button
            key={m.id}
            type="button"
            className={`aspect-square overflow-hidden border ${index === i ? "border-foreground" : "border-transparent"}`}
            aria-label={`Bild ${i + 1}: ${m.alt || title}`}
            aria-pressed={index === i}
            onClick={() => setIndex(i)}
          >
            <img
              src={`${m.url}?w=240`}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </button>
        ))}
      </div>
      <div>
        <div
          className="relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden bg-secondary"
          onTouchStart={(e) => {
            start.current = e.changedTouches[0].clientX;
          }}
          onTouchEnd={(e) => {
            const dx = e.changedTouches[0].clientX - start.current;
            if (dx > 40) go(index - 1);
            if (dx < -40) go(index + 1);
          }}
        >
          {current ? (
            <img
              src={current.url}
              srcSet={`${current.url}?w=640 640w, ${current.url} 1600w`}
              sizes="(max-width: 768px) 100vw, 50vw"
              alt={current.alt || title}
              className="h-full w-full object-contain"
            />
          ) : (
            <span>Bild in Vorbereitung</span>
          )}
          {list.length > 1 && (
            <>
              <button
                type="button"
                className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-background/80 p-2 md:inline-flex"
                aria-label="Vorheriges Bild"
                onClick={() => go(index - 1)}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-background/80 p-2 md:inline-flex"
                aria-label="Nächstes Bild"
                onClick={() => go(index + 1)}
              >
                <ChevronRight size={18} />
              </button>
            </>
          )}
          <button
            type="button"
            className="absolute bottom-4 right-4 rounded-full bg-background/80 p-2"
            aria-label="Produktbild vergrößern"
            disabled={!current}
            onClick={() => current && setZoom(true)}
          >
            <ZoomIn size={18} />
          </button>
        </div>
        {current?.kind === "ai_model" && (
          <p className="mt-2 text-xs text-muted-foreground">
            KI-generiertes Model-Foto. Farbe und Details können leicht
            abweichen; maßgeblich sind die Produktfotos.
          </p>
        )}
        {list.length > 1 && (
          <div className="mt-3 grid grid-cols-5 gap-2 md:hidden">
            {list.map((m, i) => (
              <button
                key={m.id}
                type="button"
                className={`aspect-square overflow-hidden border ${index === i ? "border-foreground" : "border-border"}`}
                aria-pressed={index === i}
                onClick={() => setIndex(i)}
              >
                <img
                  src={`${m.url}?w=240`}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </div>
      <Dialog open={zoom} onOpenChange={setZoom}>
        <DialogContent className="max-w-5xl">
          <DialogTitle>{title}</DialogTitle>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Vorheriges Bild"
              onClick={() => go(index - 1)}
            >
              <ChevronLeft />
            </button>
            <img
              className="max-h-[75vh] min-w-0 flex-1 object-contain"
              src={current?.url}
              alt={current?.alt || title}
            />
            <button
              type="button"
              aria-label="Nächstes Bild"
              onClick={() => go(index + 1)}
            >
              <ChevronRight />
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
