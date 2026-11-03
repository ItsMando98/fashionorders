"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import { ShopShell } from "@/components/shop/shell";
import { formatCny, formatEur, imgSrc } from "@/components/shop/format";
import type { PublicProduct } from "@/lib/types";

export default function ProductPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;

  const [product, setProduct] = useState<PublicProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [size, setSize] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/products/${productId}`);
        if (!res.ok) {
          setError("Product not found.");
          return;
        }
        const data = await res.json();
        setProduct(data.product);
      } finally {
        setLoading(false);
      }
    })();
  }, [productId]);

  // "S, M, L, XL" oder "EU 40 | EU 41" -> Array
  const sizes = useMemo(() => {
    if (!product?.available_sizes) return [];
    return product.available_sizes
      .split(/[,|]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20);
  }, [product]);

  useEffect(() => {
    if (sizes.length > 0 && !size) setSize(sizes[0]);
  }, [sizes, size]);

  const addToCart = async () => {
    if (!product) return;
    setAdding(true);
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: product.id,
          chosen_size: size,
          quantity,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Could not add to cart.");
        return;
      }
      setAdded(true);
    } finally {
      setAdding(false);
    }
  };

  return (
    <ShopShell>
      <div className="space-y-6">
        <button
          onClick={() => router.push("/shop")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to shop
        </button>

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : !product ? (
          <p className="text-muted-foreground">{error || "Product not found."}</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-8">
            <div className="aspect-square rounded-lg border border-border bg-secondary overflow-hidden">
              {imgSrc(product.local_image) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imgSrc(product.local_image)}
                  alt={product.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  No image
                </div>
              )}
            </div>

            <div className="space-y-5">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{product.brand}</p>
                <h1 className="font-display italic font-bold text-3xl mt-1">{product.title}</h1>
                <p className="text-sm text-muted-foreground mt-1">{product.category}</p>
              </div>

              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-semibold text-primary">{formatEur(product.price_eur)}</span>
                <span className="text-muted-foreground">{formatCny(product.price_cny)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Final price in EUR incl. service fee. Transparent base price in CNY.
              </p>

              {product.description && (
                <p className="text-sm text-muted-foreground whitespace-pre-line">{product.description}</p>
              )}

              {sizes.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Size</p>
                  <div className="flex flex-wrap gap-2">
                    {sizes.map((s) => (
                      <button
                        key={s}
                        onClick={() => setSize(s)}
                        className={`px-3 py-1.5 rounded-md border text-sm ${
                          size === s
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border bg-card text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-medium">Quantity</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="w-9 h-9 rounded-md border border-border bg-card hover:border-primary/60"
                  >
                    −
                  </button>
                  <span className="w-8 text-center">{quantity}</span>
                  <button
                    onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                    className="w-9 h-9 rounded-md border border-border bg-card hover:border-primary/60"
                  >
                    +
                  </button>
                </div>
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              {added ? (
                <div className="flex gap-3">
                  <Link
                    href="/cart"
                    className="flex-1 text-center px-4 py-3 rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90"
                  >
                    Go to cart
                  </Link>
                  <button
                    onClick={() => setAdded(false)}
                    className="px-4 py-3 rounded-md border border-border bg-card hover:border-primary/60"
                  >
                    Continue shopping
                  </button>
                </div>
              ) : (
                <button
                  onClick={addToCart}
                  disabled={adding}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50"
                >
                  <ShoppingCart className="h-5 w-5" />
                  {adding ? "Adding…" : "Add to cart"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </ShopShell>
  );
}
