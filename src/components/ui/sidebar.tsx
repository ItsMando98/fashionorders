"use client";

import * as React from "react";
import { PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface SidebarContextValue {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  toggleSidebar: () => void;
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const ctx = React.useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within a SidebarProvider");
  return ctx;
}

export function SidebarProvider({
  defaultOpen = true,
  children,
}: {
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const toggleSidebar = React.useCallback(() => setOpen((prev) => !prev), []);

  return (
    <SidebarContext.Provider value={{ open, setOpen, toggleSidebar }}>
      <div className="flex min-h-screen w-full bg-zinc-50/50">{children}</div>
    </SidebarContext.Provider>
  );
}

export function Sidebar({ className, children }: { className?: string; children: React.ReactNode }) {
  const { open } = useSidebar();
  return (
    <aside
      data-state={open ? "expanded" : "collapsed"}
      className={cn(
        "sticky top-0 flex h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-200 ease-in-out shrink-0 select-none",
        open ? "w-64" : "w-0 overflow-hidden border-r-0",
        className
      )}
    >
      {children}
    </aside>
  );
}

export function SidebarHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("flex flex-col gap-2 p-3 border-b border-sidebar-border", className)}>{children}</div>;
}

export function SidebarContent({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("flex flex-1 flex-col gap-4 overflow-auto p-3", className)}>{children}</div>;
}

export function SidebarGroup({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("flex flex-col gap-1", className)}>{children}</div>;
}

export function SidebarGroupLabel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground", className)}>
      {children}
    </div>
  );
}

export function SidebarMenu({ className, children }: { className?: string; children: React.ReactNode }) {
  return <ul className={cn("flex w-full flex-col gap-1", className)}>{children}</ul>;
}

export function SidebarMenuItem({ className, children }: { className?: string; children: React.ReactNode }) {
  return <li className={cn("relative", className)}>{children}</li>;
}

export function SidebarMenuButton({
  isActive,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { isActive?: boolean }) {
  return (
    <button
      data-active={isActive}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-semibold",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function SidebarFooter({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("flex flex-col gap-2 border-t border-sidebar-border p-3", className)}>{children}</div>;
}

export function SidebarInset({ className, children }: { className?: string; children: React.ReactNode }) {
  return <main className={cn("flex flex-1 flex-col min-w-0 bg-background", className)}>{children}</main>;
}

export function SidebarTrigger({ className }: { className?: string }) {
  const { toggleSidebar } = useSidebar();
  return (
    <Button variant="ghost" size="icon" className={cn("h-8 w-8", className)} onClick={toggleSidebar}>
      <PanelLeft className="h-4 w-4" />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  );
}
