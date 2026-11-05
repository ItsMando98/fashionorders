"use client";
import Link from "next/link";
import { ShopShell } from "@/components/shop/shell";
import { useData, Status, Notice, date } from "@/components/commerce/client";
export default function Orders() {
  const { data, error, loading } = useData("orders");
  return (
    <ShopShell>
      <p className="commerce-eyebrow">Dein Konto</p>
      <h1 className="commerce-title mb-8">Bestellungen</h1>
      <Notice error={error} />
      {loading ? (
        <p>Wird geladen …</p>
      ) : data?.orders.length ? (
        <div className="space-y-3">
          {data.orders.map((o: any) => (
            <Link
              href={`/orders/${o.id}`}
              key={o.id}
              className="commerce-panel flex flex-wrap items-center justify-between gap-4"
            >
              <div>
                <h2>{o.number}</h2>
                <p className="text-xs text-muted-foreground mt-2">
                  {date(o.created_at)}
                </p>
              </div>
              <div className="flex gap-2">
                <Status value={o.status} />
                <Status value={o.payment_status} />
              </div>
              <span className="text-xs underline">Details ansehen →</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="commerce-empty">
          <h2>Noch keine Bestellungen.</h2>
          <Link href="/shop" className="commerce-button">
            Shop entdecken
          </Link>
        </div>
      )}
      <section className="mt-10 space-y-4">
        {data?.legacy_orders?.length > 0 && (
          <h2 className="text-xl">Bisherige Bestellungen</h2>
        )}
        {data?.legacy_orders?.map((o: any) => (
          <div
            key={o.id}
            className="commerce-panel flex justify-between gap-4 text-sm"
          >
            <span>
              {o.order_number} · {o.status}
            </span>
            <span>€ {Number(o.total_eur).toFixed(2)}</span>
          </div>
        ))}
        {data?.legacy_items?.length > 0 && (
          <h2 className="text-xl">Bisherige eingereichte Artikel</h2>
        )}
        {data?.legacy_items?.map((i: any) => (
          <div className="commerce-panel text-sm" key={i.id}>
            <p>
              {i.title} · {i.order_status}
            </p>
            {i.tracking_number && (
              <p className="text-xs text-muted-foreground mt-2">
                Tracking: {i.tracking_number}
              </p>
            )}
          </div>
        ))}
      </section>
    </ShopShell>
  );
}
