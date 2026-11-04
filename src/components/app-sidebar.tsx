"use client"

import * as React from "react"
import {
  ClipboardList,
  Images,
  LayoutDashboard,
  Link2,
  PackageCheck,
  Shield,
  ShoppingCart,
  Sliders,
  Users,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { User } from "@/lib/types"

export type NavSection =
  | "gram"
  | "scraper"
  | "my-cart"
  | "my-orders"
  | "shared-orders"
  | "admin-overview"
  | "admin-orders"
  | "admin-settings"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user?: User
  activeNav?: NavSection
  onSelectNav?: (nav: NavSection) => void
  cartCount?: number
  ordersCount?: number
  sharedCount?: number
  adminTotalCount?: number
  onOpenShareModal?: () => void
  onChangePassword?: () => void
  onLogout?: () => void
}

// Offizielle dashboard-01 Sidebar-Struktur (Header / NavMain / eigene
// Gruppen / NavUser) mit den echten Sektionen und Zaehlern der App.
// Props sind optional, damit die Demo-Seite /dashboard sie ohne
// App-State rendern kann.
export function AppSidebar({
  user,
  activeNav,
  onSelectNav,
  cartCount = 0,
  ordersCount = 0,
  sharedCount = 0,
  adminTotalCount = 0,
  onOpenShareModal,
  onChangePassword,
  onLogout,
  ...props
}: AppSidebarProps) {
  const isAdmin = user?.role === "admin"

  const haulItems = [
    {
      title: "FashionGram",
      icon: Images,
      isActive: activeNav === "gram",
      onClick: () => onSelectNav?.("gram"),
    },
    {
      title: "Link Scraper & EUR",
      icon: Link2,
      isActive: activeNav === "scraper",
      onClick: () => onSelectNav?.("scraper"),
    },
    {
      title: "My Cart",
      icon: ShoppingCart,
      isActive: activeNav === "my-cart",
      badge: cartCount,
      onClick: () => onSelectNav?.("my-cart"),
    },
    {
      title: "My Orders",
      icon: PackageCheck,
      isActive: activeNav === "my-orders",
      badge: ordersCount,
      onClick: () => onSelectNav?.("my-orders"),
    },
    {
      title: "Shared by users",
      icon: Users,
      isActive: activeNav === "shared-orders",
      badge: sharedCount,
      onClick: () => onSelectNav?.("shared-orders"),
    },
  ]

  const shopLinks = [
    ["/shop", "Storefront", ShoppingCart],
    ["/cart", "Shopping Cart", ShoppingCart],
    ["/orders", "My Shop Orders", PackageCheck],
  ] as const

  const adminItems = [
    {
      title: "Backend Overview",
      icon: LayoutDashboard,
      isActive: activeNav === "admin-overview",
      onClick: () => onSelectNav?.("admin-overview"),
    },
    {
      title: "All users' orders",
      icon: ClipboardList,
      isActive: activeNav === "admin-orders",
      badge: adminTotalCount,
      onClick: () => onSelectNav?.("admin-orders"),
    },
    {
      title: "EUR Rate & Export",
      icon: Sliders,
      isActive: activeNav === "admin-settings",
      onClick: () => onSelectNav?.("admin-settings"),
    },
  ]

  return (
    <Sidebar collapsible="icon" variant="inset" className="shell-reveal-sidebar" {...props}>
      {/* 1. Brand-Header (dashboard-01: SidebarMenuButton size lg) */}
      <SidebarHeader className="shell-reveal-item">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="/">
                <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-black">
                  <img src="/brand/mark-fit.png" alt="" className="size-full object-contain" />
                </span>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-display text-base font-bold italic tracking-wide">
                    FASHION SUPPLY
                  </span>
                  <span className="truncate font-mono text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                    {isAdmin ? "Admin & Haul Studio" : "Workspace"}
                  </span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* 2. My Personal Haul (NavMain mit Quick-Create = Share Order) */}
        <NavMain items={haulItems} onQuickCreate={onOpenShareModal} />

        {/* 3. Shop-Links (echte Routen) */}
        <SidebarGroup className="shell-reveal-item">
          <SidebarGroupLabel>Shop</SidebarGroupLabel>
          <SidebarMenu>
            {shopLinks.map(([href, label, Icon]) => (
              <SidebarMenuItem key={href}>
                <SidebarMenuButton asChild tooltip={label}>
                  <a href={href}>
                    <Icon />
                    <span>{label}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
            {isAdmin && (
              <>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Product Catalog">
                    <a href="/admin/products">
                      <ClipboardList />
                      <span>Product Catalog</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Shop Orders (All)">
                    <a href="/admin/orders">
                      <PackageCheck />
                      <span>Shop Orders (All)</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </>
            )}
          </SidebarMenu>
        </SidebarGroup>

        {/* 4. Admin Backend (interne Sektionen) */}
        {isAdmin && (
          <SidebarGroup className="shell-reveal-item">
            <SidebarGroupLabel>
              <Shield />
              <span>Admin Backend</span>
            </SidebarGroupLabel>
            <SidebarMenu>
              {adminItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    tooltip={item.title}
                    isActive={item.isActive}
                    onClick={item.onClick}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                  {item.badge !== undefined && item.badge > 0 && (
                    <SidebarMenuBadge className="rounded-full border border-white/15 font-mono text-[10px] text-[#FF7E33]">
                      {item.badge}
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* 5. User-Kachel mit Dropdown (Passwort / Logout) */}
      <SidebarFooter className="shell-reveal-item">
        <NavUser
          user={{
            name: user?.name ?? "Demo",
            subtitle: isAdmin ? "Admin Console" : "Member Account",
            initials: user?.avatar_initials ?? "FS",
          }}
          onChangePassword={onChangePassword}
          onLogout={onLogout}
        />
      </SidebarFooter>
    </Sidebar>
  )
}
