"use client";

import React from "react";
import {
  Link2,
  ShoppingCart,
  PackageCheck,
  Users,
  LayoutDashboard,
  ClipboardList,
  Sliders,
  Share2,
  LogOut,
  ShoppingBag,
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
  onLogout,
}: AppSidebarProps) {
  const isAdmin = user.role === "admin";

  return (
    <Sidebar className="border-r border-[#153828] bg-[#0D2218] text-[#D5E3DB]">
      {/* 1. Header with Logo & Workspace Title matching Image 1 */}
      <SidebarHeader className="border-b border-[#183827]/70 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#081710] border border-[#234A36] text-[#A3C4B3] shadow-xs">
            <ShoppingBag className="h-4.5 w-4.5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold leading-tight tracking-tight text-white">
              FashionOrders
            </span>
            <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-[#6B8F7D] mt-0.5">
              {isAdmin ? "ADMIN & HAUL STUDIO" : `${user.name.toUpperCase()}'S WORKSPACE`}
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-4 space-y-4">
        {/* 2. My Personal Haul Section */}
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 pb-1.5 text-[10px] font-mono font-bold tracking-wider text-[#6B8F7D] uppercase">
            MY PERSONAL HAUL
          </SidebarGroupLabel>
          <SidebarMenu className="gap-1">
            <SidebarMenuItem>
              <button
                type="button"
                onClick={() => onSelectNav("scraper")}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors",
                  activeNav === "scraper"
                    ? "bg-[#1A3B2B] text-[#F3C343] font-semibold"
                    : "text-[#D5E3DB] hover:bg-[#153426] hover:text-white"
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
                    ? "bg-[#1A3B2B] text-[#F3C343] font-semibold"
                    : "text-[#D5E3DB] hover:bg-[#153426] hover:text-white"
                )}
              >
                <ShoppingCart className="h-4 w-4 shrink-0" />
                <span className="flex-1">My Cart</span>
                <span className="ml-auto rounded-full border border-[#234A36] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#86AB97]">
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
                    ? "bg-[#1A3B2B] text-[#F3C343] font-semibold"
                    : "text-[#D5E3DB] hover:bg-[#153426] hover:text-white"
                )}
              >
                <PackageCheck className="h-4 w-4 shrink-0" />
                <span className="flex-1">My Orders</span>
                <span className="ml-auto rounded-full border border-[#234A36] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#86AB97]">
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
                    ? "bg-[#1A3B2B] text-[#F3C343] font-semibold"
                    : "text-[#D5E3DB] hover:bg-[#153426] hover:text-white"
                )}
              >
                <Users className="h-4 w-4 shrink-0" />
                <span className="flex-1">Shared by Friends</span>
                <span className="ml-auto rounded-full border border-[#234A36] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#86AB97]">
                  {sharedCount}
                </span>
              </button>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* 3. Mathis Admin Backend Section */}
        {isAdmin && (
          <SidebarGroup className="pt-2">
            <SidebarGroupLabel className="px-2 pb-1.5 text-[10px] font-mono font-bold tracking-wider text-[#6B8F7D] uppercase flex items-center gap-1.5">
              <Shield className="h-3 w-3 text-[#6B8F7D]" />
              <span>MATHIS ADMIN BACKEND</span>
            </SidebarGroupLabel>
            <SidebarMenu className="gap-1">
              <SidebarMenuItem>
                <button
                  type="button"
                  onClick={() => onSelectNav("admin-overview")}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors",
                    activeNav === "admin-overview"
                      ? "bg-[#1A3B2B] text-[#F3C343] font-semibold"
                      : "text-[#D5E3DB] hover:bg-[#153426] hover:text-white"
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
                      ? "bg-[#1A3B2B] text-[#F3C343] font-semibold"
                      : "text-[#D5E3DB] hover:bg-[#153426] hover:text-white"
                  )}
                >
                  <ClipboardList className="h-4 w-4 shrink-0" />
                  <span className="flex-1">All Friends&apos; Orders</span>
                  <span className="ml-auto rounded-full border border-[#234A36] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#86AB97]">
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
                      ? "bg-[#1A3B2B] text-[#F3C343] font-semibold"
                      : "text-[#D5E3DB] hover:bg-[#153426] hover:text-white"
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
      <SidebarFooter className="border-t border-[#183827]/70 p-3 space-y-2.5">
        <button
          type="button"
          onClick={onOpenShareModal}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-[#234A36] bg-transparent py-2 px-3 text-xs font-semibold text-[#D5E3DB] transition hover:bg-[#153426] hover:text-white"
        >
          <Share2 className="h-3.5 w-3.5 text-[#86AB97]" />
          <span>Share My Order with Users</span>
        </button>

        <div className="flex items-center justify-between rounded-xl border border-[#193B2B] bg-[#081710] p-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#122B1E] border border-[#234A36] font-mono text-xs font-bold text-white">
              {user.avatar_initials}
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-bold text-white">{user.name}</div>
              <div className="truncate text-[10px] font-medium text-[#6B8F7D]">
                {isAdmin ? "Admin Console" : "Member Account"}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#6B8F7D] transition hover:bg-[#153426] hover:text-white"
            onClick={onLogout}
            title="Log Out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
