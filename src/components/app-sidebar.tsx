"use client";

import React from "react";
import {
  KeyRound,
  Link2,
  ShoppingCart,
  PackageCheck,
  Users,
  Images,
  LayoutDashboard,
  ClipboardList,
  Sliders,
  Share2,
  LogOut,
  Shield,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { User } from "@/lib/types";
import { cn } from "@/lib/utils";

export type NavSection =
  | "gram"
  | "scraper"
  | "my-cart"
  | "my-orders"
  | "shared-orders"
  | "admin-overview"
  | "admin-orders"
  | "admin-settings";

interface AppSidebarProps {
  user: User;
  activeNav: NavSection;
  onSelectNav: (nav: NavSection) => void;
  cartCount: number;
  ordersCount: number;
  sharedCount: number;
  adminTotalCount: number;
  onOpenShareModal: () => void;
  onChangePassword: () => void;
  onLogout: () => void;
}

export function AppSidebar({
  user,
  activeNav,
  onSelectNav,
  cartCount,
  ordersCount,
  sharedCount,
  adminTotalCount,
  onOpenShareModal,
  onChangePassword,
  onLogout,
}: AppSidebarProps) {
  const isAdmin = user.role === "admin";

  return (
    <Sidebar className="border-r border-white/10 bg-[#07080c] text-zinc-300">
      {/* 1. Header with Logo & Workspace Title matching Image 1 */}
      <SidebarHeader className="border-b border-white/10 px-4 py-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 overflow-hidden rounded-md bg-black">
            <img src="/brand/mark.png" alt="" className="h-full w-full scale-150 object-cover" />
          </span>
          <div className="flex flex-col">
            <span className="font-display text-lg font-bold italic leading-none tracking-wide text-white">
              FASHION SUPPLY
            </span>
            <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-zinc-500 mt-0.5">
              {isAdmin ? "ADMIN & HAUL STUDIO" : `${user.name.toUpperCase()}'S WORKSPACE`}
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-4 space-y-4">
        {/* 2. My Personal Haul Section */}
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 pb-1.5 text-[10px] font-mono font-bold tracking-wider text-zinc-500 uppercase">
            MY PERSONAL HAUL
          </SidebarGroupLabel>
          <SidebarMenu className="gap-1">
            <SidebarMenuItem>
              <button
                type="button"
                onClick={() => onSelectNav("gram")}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors",
                  activeNav === "gram"
                    ? "bg-[#FF4D00]/15 text-[#FF4D00] font-semibold"
                    : "text-zinc-300 hover:bg-white/5 hover:text-white"
                )}
              >
                <Images className="h-4 w-4 shrink-0" />
                <span className="flex-1">FashionGram</span>
              </button>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <button
                type="button"
                onClick={() => onSelectNav("scraper")}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors",
                  activeNav === "scraper"
                    ? "bg-[#FF4D00]/15 text-[#FF4D00] font-semibold"
                    : "text-zinc-300 hover:bg-white/5 hover:text-white"
                )}
              >
                <Link2 className="h-4 w-4 shrink-0" />
                <span className="flex-1">Link Scraper &amp; EUR</span>
              </button>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <button
                type="button"
                onClick={() => onSelectNav("my-cart")}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors",
                  activeNav === "my-cart"
                    ? "bg-[#FF4D00]/15 text-[#FF4D00] font-semibold"
                    : "text-zinc-300 hover:bg-white/5 hover:text-white"
                )}
              >
                <ShoppingCart className="h-4 w-4 shrink-0" />
                <span className="flex-1">My Cart</span>
                <span className="ml-auto rounded-full border border-white/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-[#7ee7ff]">
                  {cartCount}
                </span>
              </button>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <button
                type="button"
                onClick={() => onSelectNav("my-orders")}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors",
                  activeNav === "my-orders"
                    ? "bg-[#FF4D00]/15 text-[#FF4D00] font-semibold"
                    : "text-zinc-300 hover:bg-white/5 hover:text-white"
                )}
              >
                <PackageCheck className="h-4 w-4 shrink-0" />
                <span className="flex-1">My Orders</span>
                <span className="ml-auto rounded-full border border-white/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-[#7ee7ff]">
                  {ordersCount}
                </span>
              </button>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <button
                type="button"
                onClick={() => onSelectNav("shared-orders")}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors",
                  activeNav === "shared-orders"
                    ? "bg-[#FF4D00]/15 text-[#FF4D00] font-semibold"
                    : "text-zinc-300 hover:bg-white/5 hover:text-white"
                )}
              >
                <Users className="h-4 w-4 shrink-0" />
                <span className="flex-1">Shared by users</span>
                <span className="ml-auto rounded-full border border-white/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-[#7ee7ff]">
                  {sharedCount}
                </span>
              </button>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* 2b. Shop Section (neues Shop-System, eigene Routen) */}
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 pb-1.5 text-[10px] font-mono font-bold tracking-wider text-zinc-500 uppercase">
            SHOP
          </SidebarGroupLabel>
          <SidebarMenu className="gap-1">
            {(
              [
                ["/shop", "Storefront"],
                ["/cart", "Shopping Cart"],
                ["/orders", "My Shop Orders"],
              ] as const
            ).map(([href, label]) => (
              <SidebarMenuItem key={href}>
                <a
                  href={href}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
                >
                  <ShoppingCart className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{label}</span>
                </a>
              </SidebarMenuItem>
            ))}
            {isAdmin && (
              <>
                <SidebarMenuItem>
                  <a
                    href="/admin/products"
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
                  >
                    <ClipboardList className="h-4 w-4 shrink-0" />
                    <span className="flex-1">Product Catalog</span>
                  </a>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <a
                    href="/admin/orders"
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
                  >
                    <PackageCheck className="h-4 w-4 shrink-0" />
                    <span className="flex-1">Shop Orders (All)</span>
                  </a>
                </SidebarMenuItem>
              </>
            )}
          </SidebarMenu>
        </SidebarGroup>

        {/* 3. Mathis Admin Backend Section */}
        {isAdmin && (
          <SidebarGroup className="pt-2">
            <SidebarGroupLabel className="px-2 pb-1.5 text-[10px] font-mono font-bold tracking-wider text-zinc-500 uppercase flex items-center gap-1.5">
              <Shield className="h-3 w-3 text-zinc-500" />
              <span>ADMIN BACKEND</span>
            </SidebarGroupLabel>
            <SidebarMenu className="gap-1">
              <SidebarMenuItem>
                <button
                  type="button"
                  onClick={() => onSelectNav("admin-overview")}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors",
                    activeNav === "admin-overview"
                      ? "bg-[#FF4D00]/15 text-[#FF4D00] font-semibold"
                      : "text-zinc-300 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <LayoutDashboard className="h-4 w-4 shrink-0" />
                  <span className="flex-1">Backend Overview</span>
                </button>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <button
                  type="button"
                  onClick={() => onSelectNav("admin-orders")}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors",
                    activeNav === "admin-orders"
                      ? "bg-[#FF4D00]/15 text-[#FF4D00] font-semibold"
                      : "text-zinc-300 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <ClipboardList className="h-4 w-4 shrink-0" />
                  <span className="flex-1">All users&apos; orders</span>
                  <span className="ml-auto rounded-full border border-white/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-[#7ee7ff]">
                    {adminTotalCount}
                  </span>
                </button>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <button
                  type="button"
                  onClick={() => onSelectNav("admin-settings")}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors",
                    activeNav === "admin-settings"
                      ? "bg-[#FF4D00]/15 text-[#FF4D00] font-semibold"
                      : "text-zinc-300 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <Sliders className="h-4 w-4 shrink-0" />
                  <span className="flex-1">EUR Rate &amp; Export</span>
                </button>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* 4. Footer with Share Button & User Profile Container matching Image 1 */}
      <SidebarFooter className="border-t border-white/10 p-3 space-y-2.5">
        <button
          type="button"
          onClick={onOpenShareModal}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-white/15 bg-transparent py-2 px-3 text-xs font-semibold text-zinc-300 transition hover:bg-white/5 hover:text-white"
        >
          <Share2 className="h-3.5 w-3.5 text-[#7ee7ff]" />
          <span>Share My Order with Users</span>
        </button>

        <div className="flex items-center justify-between rounded-md border border-white/10 bg-black p-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#FF4D00]/50 bg-[#FF4D00]/15 font-mono text-xs font-bold text-white">
              {user.avatar_initials}
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-bold text-white">{user.name}</div>
              <div className="truncate text-[10px] font-medium text-zinc-500">
                {isAdmin ? "Admin Console" : "Member Account"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/5 hover:text-white"
              onClick={onChangePassword}
              title="Change password"
            >
              <KeyRound className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/5 hover:text-white"
              onClick={onLogout}
              title="Log Out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
