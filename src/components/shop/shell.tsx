"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ShoppingBag, ShoppingCart, Package, LayoutDashboard, Store, Boxes, ClipboardList } from "lucide-react";

interface ShellInfo {
  user: { id: number; name: string; role: string };
  cart_count: number;
}

// Einheitlicher Rahmen fuer alle Shop-Seiten (Storefront + Shop-Admin).
export function ShopShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [info, setInfo] = useState<ShellInfo | null>(null);
  const [authFailed, setAuthFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/shop/settings");
      if (res.status === 401) {
        setAuthFailed(true);
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      setInfo({ user: data.user, cart_count: data.cart_count });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, pathname]);

  if (authFailed) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Please log in to use the shop.</p>
          <Link href="/" className="text-primary underline">
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  const isAdmin = info?.user.role === "admin";

  const navLink = (href: string, label: string, icon: React.ReactNode, badge?: number) => {
    const active = pathname === href || (href !== "/shop" && pathname.startsWith(href));
    return (
      <Link
        key={href}
        href={href}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
          active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {icon}
        {label}
        {badge !== undefined && badge > 0 && (
          <span className="ml-1 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
            {badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-2">
          <Link href="/shop" className="flex items-center gap-2 mr-4">
            <Store className="h-5 w-5 text-primary" />
            <span className="font-display italic font-bold text-lg tracking-wide">
              FASHION SUPPLY
            </span>
          </Link>
          <nav className="flex items-center gap-1 flex-1">
            {navLink("/shop", "Shop", <ShoppingBag className="h-4 w-4" />)}
            {navLink("/cart", "Cart", <ShoppingCart className="h-4 w-4" />, info?.cart_count)}
            {navLink("/orders", "My Orders", <Package className="h-4 w-4" />)}
            {isAdmin && navLink("/admin/products", "Products", <Boxes className="h-4 w-4" />)}
            {isAdmin && navLink("/admin/orders", "All Orders", <ClipboardList className="h-4 w-4" />)}
          </nav>
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </button>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
