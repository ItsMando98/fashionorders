"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ShoppingBag,
  ShoppingCart,
  Package,
  UserRound,
  LogOut,
  Images,
  Settings,
  ScanSearch,
  Sparkles,
  ArrowUpRight,
  Heart,
  Search,
} from "lucide-react";
import { Notice } from "../commerce/client";
import { ShaderBackground } from "../shader-background";
import { Button } from "../ui/button";
import { HeaderSearch } from "./header-search";
import { Separator } from "../ui/separator";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
  SidebarTrigger,
  SidebarRail,
} from "../ui/sidebar";
export function ShopShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [info, setInfo] = useState<any>(null),
    [error, setError] = useState(""),
    [status, setStatus] = useState(0);
  useEffect(() => {
    const load = () => {
      void fetch("/api/commerce/session", { cache: "no-store" })
        .then(async (r) => {
          setStatus(r.status);
          const d = await r.json();
          if (!r.ok) throw Error(d.detail);
          setInfo(d);
          setError("");
        })
        .catch((e) => setError(e.message));
    };
    load();
    window.addEventListener("shop:changed", load);
    return () => window.removeEventListener("shop:changed", load);
  }, [pathname]);
  const links = [
    ["/shop", "Shop", ShoppingBag],
    ["/shop/saved", "Merkliste", Heart],
    ["/account", "Mein Konto", UserRound],
    ["/orders", "Bestellungen", Package],
    ["/cart", "Warenkorb", ShoppingCart],
  ] as const;
  const adminLinks = [
    ["/admin/products", "Produkte", Images],
    ["/admin/listing", "KI-Listing", Sparkles],
    ["/admin/catalog-agent", "Sortieragent", ScanSearch],
    ["/admin/orders", "Aufträge", Package],
    ["/admin/shop-settings", "Einstellungen", Settings],
  ] as const;
  const items = (values: ReadonlyArray<readonly [string, string, any]>) => (
    <SidebarMenu>
      {values.map(([href, label, Icon]) => (
        <SidebarMenuItem key={href}>
          <SidebarMenuButton
            asChild
            isActive={
              href === "/shop"
                ? pathname === "/shop"
                : pathname === href || pathname.startsWith(href + "/")
            }
            tooltip={label}
          >
            <Link href={href}>
              <Icon />
              <span>{label}</span>
              {href === "/cart" && info?.cart.lines.length > 0 && (
                <span className="ml-auto tabular-nums">
                  {info.cart.lines.reduce(
                    (n: number, l: any) => n + l.quantity,
                    0,
                  )}
                </span>
              )}
              {href === "/shop/saved" && info?.saved_count > 0 && (
                <span className="ml-auto tabular-nums">{info.saved_count}</span>
              )}
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
  return (
    <div className="commerce-app">
      <a className="commerce-skip" href="#shop-content">
        Zum Inhalt
      </a>
      <SidebarProvider
        style={{ "--sidebar-width": "14rem" } as React.CSSProperties}
      >
        <Sidebar
          variant="inset"
          collapsible="icon"
          className="shell-reveal-sidebar"
        >
          <SidebarHeader>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton size="lg" asChild>
                  <Link href="/shop">
                    <ShoppingBag />
                    <span className="font-display text-lg font-bold tracking-tight">
                      FASHION<span className="text-primary">/</span>SUPPLY
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Deine Auswahl</SidebarGroupLabel>
              <SidebarGroupContent>{items(links)}</SidebarGroupContent>
            </SidebarGroup>
            {info?.user.role === "admin" && (
              <SidebarGroup>
                <SidebarGroupLabel>Administration</SidebarGroupLabel>
                <SidebarGroupContent>{items(adminLinks)}</SidebarGroupContent>
              </SidebarGroup>
            )}
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={async () => {
                    await fetch("/api/auth/logout", { method: "POST" });
                    window.location.href = "/";
                  }}
                  tooltip="Abmelden"
                >
                  <LogOut />
                  <span className="truncate">
                    {info?.user.name || "Abmelden"}
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>
        {/* Rounded panel. The WebGL canvas behind the content is a rough
            black-gray concrete wall lit by several orange spotlights. */}
        <SidebarInset className="shell-panel relative min-w-0 backdrop-blur-md md:border md:border-white/10">
          <ShaderBackground className="pointer-events-none absolute inset-0 -z-10 h-full w-full rounded-xl" />
          <header className="shell-reveal-header shell-header sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 rounded-t-xl border-b border-white/10 px-4 backdrop-blur">
            <SidebarTrigger aria-label="Navigation öffnen oder schließen" />
            <Separator orientation="vertical" className="h-4" />
            <HeaderSearch />
            <Link
              href="/shop"
              className="md:hidden"
              aria-label="Produkte suchen"
            >
              <Search size={18} />
            </Link>
            <div className="ml-auto flex items-center gap-1">
              <Button asChild variant="ghost" size="icon">
                <Link
                  href="/shop/saved"
                  aria-label={`Merkliste${info?.saved_count ? `, ${info.saved_count} Produkte` : ""}`}
                >
                  <span className="relative">
                    <Heart size={18} />
                    {info?.saved_count > 0 && (
                      <span className="commerce-count">{info.saved_count}</span>
                    )}
                  </span>
                </Link>
              </Button>
              <Button asChild variant="ghost" size="icon">
                <Link
                  href="/cart"
                  aria-label={`Warenkorb${info?.cart?.lines?.length ? `, ${info.cart.lines.reduce((n: number, l: any) => n + l.quantity, 0)} Artikel` : ""}`}
                >
                  <span className="relative">
                    <ShoppingCart size={18} />
                    {info?.cart?.lines?.length > 0 && (
                      <span className="commerce-count">
                        {info.cart.lines.reduce(
                          (n: number, l: any) => n + l.quantity,
                          0,
                        )}
                      </span>
                    )}
                  </span>
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
                <Link href="/account?tab=imports">
                  Link importieren
                  <ArrowUpRight />
                </Link>
              </Button>
            </div>
          </header>
          {/* SidebarInset is already the page's <main>; a second <main> would be invalid. */}
          <div
            tabIndex={-1}
            id="shop-content"
            className="shell-reveal-content mx-auto w-full min-w-0 max-w-screen-2xl flex-1 p-4 md:p-6"
          >
            {!info ? (
              error ? (
                <div className="mx-auto flex max-w-lg flex-col gap-4 py-16">
                  <Notice error={error} />
                  {status === 401 && (
                    <Button asChild>
                      <Link href="/">Zur Anmeldung</Link>
                    </Button>
                  )}
                </div>
              ) : (
                <p role="status">Shop wird geladen …</p>
              )
            ) : (
              children
            )}
          </div>
          <footer className="flex flex-wrap justify-between gap-3 rounded-b-xl border-t border-white/10 px-4 py-5 text-xs text-muted-foreground md:px-6">
            <p>
              FASHION/SUPPLY ·{" "}
              {info?.operator || "Dein persönlicher Fashion-Service"}
            </p>
            <p>
              {info?.tax_note ||
                "Verbindlicher Preis und Versand nach Prüfung."}
            </p>
          </footer>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
