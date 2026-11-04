"use client"

import { Share2, type LucideIcon } from "lucide-react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

// Ein Navigations-Eintrag der Hauptgruppe. onClick statt url, weil die
// App-Shell interne Sektionen (keine Routen) umschaltet.
export interface NavMainItem {
  title: string
  icon?: LucideIcon
  isActive?: boolean
  badge?: number
  onClick?: () => void
}

export function NavMain({
  items,
  onQuickCreate,
}: {
  items: NavMainItem[]
  onQuickCreate?: () => void
}) {
  return (
    <SidebarGroup className="shell-reveal-item">
      <SidebarGroupContent className="flex flex-col gap-2">
        {onQuickCreate && (
          <SidebarMenu>
            <SidebarMenuItem className="flex items-center gap-2">
              <SidebarMenuButton
                tooltip="Share My Order"
                onClick={onQuickCreate}
                className="min-w-8 bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
              >
                <Share2 />
                <span>Share My Order</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                tooltip={item.title}
                isActive={item.isActive}
                onClick={item.onClick}
              >
                {item.icon && <item.icon />}
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
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
