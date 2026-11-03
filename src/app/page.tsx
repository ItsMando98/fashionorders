"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Download,
  ExternalLink,
  Copy,
  Trash2,
  CheckCircle2,
  Sparkles,
  Search,
  Send,
  Share2,
  Eye,
  EyeOff,
  Euro,
  ArrowLeftRight,
  Layers,
  Sliders,
  DollarSign,
  TrendingUp,
  Tag,
} from "lucide-react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar, NavSection } from "@/components/app-sidebar";
import { AuthCard } from "@/components/auth-card";
import { ShareOrderDialog } from "@/components/share-order-dialog";
import { MemberFeeDialog } from "@/components/member-fee-dialog";
import { ItemFeeDialog } from "@/components/item-fee-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatEUR, formatCNY, parseSizeChips } from "@/lib/utils";
import {
  User,
  OrderItem,
  ScrapedDraft,
  FriendDirectoryEntry,
  HaulSummary,
  WorkspaceResponse,
} from "@/lib/types";

const ORDER_STATUSES = [
  "In Cart",
  "Pending",
  "To Order",
  "Ordered",
  "In Warehouse (QC)",
  "Shipped",
  "Delivered",
  "Cancelled",
  "Offline (404)",
];

function getStatusBadgeVariant(
  status: string
):
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "warning"
  | "info"
  | "success"
  | "forest-soft"
  | "crest"
  | "mandarine" {
  const s = (status || "").toLowerCase();
  if (s.includes("delivered") || s.includes("arrived")) return "forest-soft";
  if (s.includes("ordered") || s.includes("warehouse") || s.includes("shipped")) return "mandarine";
  if (s.includes("404") || s.includes("offline") || s.includes("cancel")) return "destructive";
  return "crest";
}

export default function DashboardPage() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);

  // Workspace Data
  const [cnyToEur, setCnyToEur] = useState<number>(0.13);
  const [feeSettings, setFeeSettings] = useState({
    default_item_fixed_eur: 0,
    default_item_percent: 0,
    default_haul_percent: 0,
  });
  const [primaryCurrency, setPrimaryCurrency] = useState<"EUR" | "CNY">("EUR");
  const [myItems, setMyItems] = useState<OrderItem[]>([]);
  const [myHaulSummary, setMyHaulSummary] = useState<HaulSummary | null>(null);
  const [sharedItems, setSharedItems] = useState<OrderItem[]>([]);
  const [friendsDirectory, setFriendsDirectory] = useState<FriendDirectoryEntry[]>([]);
  const [myShareTargets, setMyShareTargets] = useState<number[]>([]);
  const [adminAllItems, setAdminAllItems] = useState<OrderItem[]>([]);
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [adminHaulSummaries, setAdminHaulSummaries] = useState<HaulSummary[]>([]);

  // Navigation & UI state
  const [activeNav, setActiveNav] = useState<NavSection>("scraper");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [zoomImage, setZoomImage] = useState<{ src: string; title: string } | null>(null);
  const [editingMemberUser, setEditingMemberUser] = useState<User | null>(null);
  const [editingFeeItem, setEditingFeeItem] = useState<OrderItem | null>(null);

  // Scraper state
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [scrapingSingle, setScrapingSingle] = useState(false);
  const [scrapedDraft, setScrapedDraft] = useState<ScrapedDraft | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBrand, setDraftBrand] = useState("");
  const [draftCategory, setDraftCategory] = useState("");
  const [draftSize, setDraftSize] = useState("");
  const [draftColor, setDraftColor] = useState("");
  const [draftPriceCny, setDraftPriceCny] = useState("");
  const [draftPriceEur, setDraftPriceEur] = useState("");
  const [draftQty, setDraftQty] = useState("1");
  const [draftNotes, setDraftNotes] = useState("");

  // Bulk Scraper state
  const [bulkUrlsText, setBulkUrlsText] = useState("");
  const [bulkStage, setBulkStage] = useState<"cart" | "submitted">("cart");
  const [scrapingBulk, setScrapingBulk] = useState(false);

  // Filters & Form inputs
  const [myOrdersSearch, setMyOrdersSearch] = useState("");
  const [sharedFriendFilter, setSharedFriendFilter] = useState<string>("ALL");
  const [adminFriendFilter, setAdminFriendFilter] = useState<string>("ALL");
  const [adminStatusFilter, setAdminStatusFilter] = useState<string>("ALL");
  const [adminSearch, setAdminSearch] = useState("");
  const [selectedAdminIds, setSelectedAdminIds] = useState<number[]>([]);

  // Admin Fee Form Inputs
  const [rateInput, setRateInput] = useState("0.13");
  const [inputDefaultFixed, setInputDefaultFixed] = useState("0");
  const [inputDefaultItemPct, setInputDefaultItemPct] = useState("0");
  const [inputDefaultHaulPct, setInputDefaultHaulPct] = useState("0");

  function notify(msg: string) {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  }

  const fetchWorkspace = useCallback(async (authToken: string) => {
    setLoadingWorkspace(true);
    try {
      const res = await fetch("/api/workspace", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) {
        localStorage.removeItem("fo_token");
        setToken(null);
        setUser(null);
        return;
      }
      const data: WorkspaceResponse = await res.json();
      setUser(data.current_user);
      setCnyToEur(data.settings.cny_to_eur);
      setRateInput(String(data.settings.cny_to_eur));
      setFeeSettings({
        default_item_fixed_eur: data.settings.default_item_fixed_eur || 0,
        default_item_percent: data.settings.default_item_percent || 0,
        default_haul_percent: data.settings.default_haul_percent || 0,
      });
      setInputDefaultFixed(String(data.settings.default_item_fixed_eur || 0));
      setInputDefaultItemPct(String(data.settings.default_item_percent || 0));
      setInputDefaultHaulPct(String(data.settings.default_haul_percent || 0));
      setMyItems(data.my_items || []);
      setMyHaulSummary(data.my_haul_summary || null);
      setSharedItems(data.shared_items || []);
      setFriendsDirectory(data.friends_directory || []);
      setMyShareTargets(data.my_share_targets || []);
      setAdminAllItems(data.admin_all_items || []);
      setAdminUsers(data.admin_users || []);
      setAdminHaulSummaries(data.admin_haul_summaries || []);
    } finally {
      setLoadingWorkspace(false);
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("fo_token");
    if (saved) {
      setToken(saved);
      fetchWorkspace(saved);
    } else {
      setLoadingWorkspace(false);
    }
  }, [fetchWorkspace]);

  function handleAuthenticated(newToken: string, loggedUser: User) {
    localStorage.setItem("fo_token", newToken);
    setToken(newToken);
    setUser(loggedUser);
    setActiveNav(loggedUser.role === "admin" ? "admin-overview" : "my-orders");
    fetchWorkspace(newToken);
  }

  async function handleLogout() {
    if (token) {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    localStorage.removeItem("fo_token");
    setToken(null);
    setUser(null);
  }

  function renderPricePair(cny: number | null | undefined, finalEur: number | null | undefined) {
    if (cny === null || cny === undefined) {
      return <span className="font-mono text-xs text-zinc-400">Price TBD</span>;
    }
    const eurVal = finalEur !== undefined && finalEur !== null ? finalEur : cny * cnyToEur;
    if (primaryCurrency === "EUR") {
      return (
        <div className="flex flex-col items-end">
          <span className="font-mono text-sm font-bold text-zinc-900">
            {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(eurVal)}
          </span>
          <span className="font-mono text-[11px] text-zinc-500">{formatCNY(cny)}</span>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-end">
        <span className="font-mono text-sm font-bold text-zinc-900">{formatCNY(cny)}</span>
        <span className="font-mono text-[11px] text-zinc-500">
          {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(eurVal)}
        </span>
      </div>
    );
  }

  // Single Link Scrape
  async function handleScrapeSingle(e: React.FormEvent) {
    e.preventDefault();
    if (!scrapeUrl.trim() || !token) return;
    setScrapingSingle(true);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: scrapeUrl }),
      });
      if (res.ok) {
        const d: ScrapedDraft = await res.json();
        setScrapedDraft(d);
        setDraftTitle(d.title);
        setDraftBrand(d.brand);
        setDraftCategory(d.category);
        setDraftSize("");
        setDraftColor("");
        setDraftPriceCny(d.price_cny !== null ? String(d.price_cny) : "");
        setDraftPriceEur(
          d.price_cny !== null ? (d.price_cny * cnyToEur).toFixed(2) : ""
        );
        setDraftQty("1");
        setDraftNotes("");
        notify("Scraped product details & converted price to EUR");
      } else {
        notify("Could not scrape URL");
      }
    } finally {
      setScrapingSingle(false);
    }
  }

  async function handleSaveDraft(stage: "cart" | "submitted") {
    if (!scrapedDraft || !token) return;
    const cnyVal = draftPriceCny.trim() !== "" ? parseFloat(draftPriceCny) : null;
    const eurVal = draftPriceEur.trim() !== "" ? parseFloat(draftPriceEur) : null;

    const res = await fetch("/api/items", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        url: scrapedDraft.url,
        weidian_url: scrapedDraft.weidian_url,
        source_platform: scrapedDraft.source_platform,
        seller: scrapedDraft.seller,
        title: draftTitle.trim() || scrapedDraft.title,
        brand: draftBrand.trim() || "—",
        category: draftCategory.trim() || "Apparel / Item",
        available_sizes: scrapedDraft.available_sizes,
        chosen_size: draftSize.trim(),
        color_variant: draftColor.trim(),
        quantity: parseInt(draftQty, 10) || 1,
        price_cny: cnyVal,
        price_eur_override: eurVal,
        stage,
        order_status: stage === "cart" ? "In Cart" : scrapedDraft.order_status || "Pending",
        is_shared: 1,
        description: scrapedDraft.description,
        user_notes: draftNotes.trim(),
        local_image: scrapedDraft.local_image,
      }),
    });
    if (res.ok) {
      setScrapedDraft(null);
      setScrapeUrl("");
      await fetchWorkspace(token);
      setActiveNav(stage === "cart" ? "my-cart" : "my-orders");
      notify(stage === "cart" ? "Added item to My Cart" : "Submitted item to My Orders");
    }
  }

  // Bulk Scrape
  async function handleScrapeBulk(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    const urls = bulkUrlsText
      .split(/\r?\n/)
      .map((u) => u.trim())
      .filter((u) => u.startsWith("http"));
    if (urls.length === 0) {
      notify("Paste at least one valid URL starting with http");
      return;
    }
    setScrapingBulk(true);
    try {
      const res = await fetch("/api/scrape/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ urls, stage: bulkStage }),
      });
      if (res.ok) {
        const data = await res.json();
        setBulkUrlsText("");
        await fetchWorkspace(token);
        setActiveNav(bulkStage === "cart" ? "my-cart" : "my-orders");
        notify(`Scraped and imported ${data.added} items`);
      }
    } finally {
      setScrapingBulk(false);
    }
  }

  async function handlePatchItem(itemId: number, updates: Record<string, unknown>) {
    if (!token) return;
    const res = await fetch(`/api/items/${itemId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      await fetchWorkspace(token);
      notify("Saved changes");
    }
  }

  async function handleDeleteItem(itemId: number) {
    if (!token) return;
    const res = await fetch(`/api/items/${itemId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      await fetchWorkspace(token);
      setSelectedAdminIds((prev) => prev.filter((id) => id !== itemId));
      notify("Item deleted");
    }
  }

  async function handleSubmitMyCart() {
    if (!token) return;
    const res = await fetch("/api/orders/submit", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      await fetchWorkspace(token);
      setActiveNav("my-orders");
      notify("Submitted your cart to Mathis's order queue");
    }
  }

  async function handleCloneSharedItem(itemId: number) {
    if (!token) return;
    const res = await fetch(`/api/shares/clone/${itemId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      await fetchWorkspace(token);
      notify("Copied friend's item into your Shopping Cart");
    }
  }

  async function handleSaveSharePreferences(shareAll: boolean, targetIds: number[]) {
    if (!token) return;
    const res = await fetch("/api/shares/preferences", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        share_all_friends: shareAll ? 1 : 0,
        shared_with_user_ids: targetIds,
      }),
    });
    if (res.ok) {
      await fetchWorkspace(token);
      notify("Updated order sharing settings");
    }
  }

  async function handleAdminBulkStatus(status: string) {
    if (!token || selectedAdminIds.length === 0) {
      notify("Select at least one row first");
      return;
    }
    const res = await fetch("/api/admin/bulk-status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ item_ids: selectedAdminIds, order_status: status }),
    });
    if (res.ok) {
      setSelectedAdminIds([]);
      await fetchWorkspace(token);
      notify(`Updated ${selectedAdminIds.length} items to "${status}"`);
    }
  }

  async function handleSaveGlobalFeeSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        cny_to_eur: parseFloat(rateInput) || 0.13,
        default_item_fixed_eur: parseFloat(inputDefaultFixed) || 0,
        default_item_percent: parseFloat(inputDefaultItemPct) || 0,
        default_haul_percent: parseFloat(inputDefaultHaulPct) || 0,
      }),
    });
    if (res.ok) {
      await fetchWorkspace(token);
      notify("Saved global standard fee settings for all members");
    }
  }

  async function handleSaveMemberFees(
    userId: number,
    payload: {
      custom_item_fixed_eur?: number | null;
      custom_item_percent?: number | null;
      custom_haul_percent?: number | null;
      reset_item_fixed?: boolean;
      reset_item_percent?: boolean;
      reset_haul_percent?: boolean;
    }
  ) {
    if (!token) return;
    const res = await fetch(`/api/admin/users/${userId}/fees`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      await fetchWorkspace(token);
      notify("Saved individual member fee overrides");
    }
  }

  async function handleSaveItemFee(
    itemId: number,
    payload: {
      custom_fee_fixed_eur: number | null;
      custom_fee_percent: number | null;
    }
  ) {
    if (!token) return;
    const res = await fetch(`/api/items/${itemId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      await fetchWorkspace(token);
      notify("Saved custom fee override for this item");
    }
  }

  function handleExportExcel() {
    if (!token) return;
    window.open(`/api/export/excel?token=${encodeURIComponent(token)}`, "_blank");
  }

  if (loadingWorkspace && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 text-sm text-zinc-500">
        Loading workspace...
      </div>
    );
  }

  if (!token || !user) {
    return <AuthCard onAuthenticated={handleAuthenticated} />;
  }

  // Lists for current user
  const myCartItems = myItems.filter((i) => i.stage === "cart");
  const mySubmittedItems = myItems.filter((i) => i.stage !== "cart");

  // Filtered My Orders
  const filteredMyOrders = mySubmittedItems.filter((i) => {
    if (!myOrdersSearch.trim()) return true;
    const q = myOrdersSearch.toLowerCase();
    return (
      i.title.toLowerCase().includes(q) ||
      i.brand.toLowerCase().includes(q) ||
      i.seller.toLowerCase().includes(q)
    );
  });

  // Filtered Shared Items
  const sharedSenders = Array.from(
    new Map(sharedItems.map((i) => [i.user_id, i.user_name])).entries()
  );
  const filteredSharedItems = sharedItems.filter((i) => {
    if (sharedFriendFilter === "ALL") return true;
    return String(i.user_id) === sharedFriendFilter;
  });

  // Admin Filtered Items
  const filteredAdminItems = adminAllItems.filter((i) => {
    if (adminFriendFilter !== "ALL" && String(i.user_id) !== adminFriendFilter) return false;
    if (adminStatusFilter !== "ALL" && i.order_status !== adminStatusFilter) return false;
    if (adminSearch.trim()) {
      const q = adminSearch.toLowerCase();
      const hay = `${i.title} ${i.brand} ${i.seller} ${i.user_name} ${i.chosen_size}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // Cumulative Admin Totals
  const totalBaseCostEur = adminHaulSummaries.reduce((sum, h) => sum + h.base_eur_sum, 0);
  const totalAdminProfit = adminHaulSummaries.reduce((sum, h) => sum + h.total_admin_profit_eur, 0);
  const totalGrandHaulEur = adminHaulSummaries.reduce((sum, h) => sum + h.final_total_eur, 0);

  const navLabels: Record<NavSection, string> = {
    scraper: "Link Scraper & EUR Calculator",
    "my-cart": "My Shopping Cart",
    "my-orders": "My Submitted Orders",
    "shared-orders": "Shared Orders from Friends",
    "admin-overview": "Mathis Admin Backend — Overview",
    "admin-orders": "Mathis Admin Backend — All Friends' Orders",
    "admin-settings": "Mathis Admin Backend — Fees, Rates & Export",
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar
        user={user}
        activeNav={activeNav}
        onSelectNav={setActiveNav}
        cartCount={myCartItems.length}
        ordersCount={mySubmittedItems.length}
        sharedCount={sharedItems.length}
        adminTotalCount={adminAllItems.length}
        onOpenShareModal={() => setShareDialogOpen(true)}
        onLogout={handleLogout}
      />

      <SidebarInset>
        {/* Top Header */}
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-zinc-200/80 bg-white px-6">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="text-zinc-700 hover:text-zinc-950" />
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-normal text-zinc-500">
                {activeNav.startsWith("admin-") ? "Mathis Admin Console" : `${user.name}'s Workspace`}
              </span>
              <span className="text-zinc-400">/</span>
              <span className="font-semibold text-zinc-900">{navLabels[activeNav]}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Exchange Rate Pill matching Image 1 */}
            <div className="hidden md:flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 font-mono text-[11px] text-zinc-700 shadow-2xs">
              <span>€ 1 ¥ = €{cnyToEur} (1 € ≈ ¥{(1 / cnyToEur).toFixed(2)})</span>
            </div>

            {/* EUR / CNY Pill Switcher matching Image 1 */}
            <div className="inline-flex rounded-full border border-zinc-200 bg-zinc-100/80 p-0.5">
              <button
                type="button"
                onClick={() => setPrimaryCurrency("EUR")}
                className={`rounded-full px-3 py-1 font-mono text-[11px] font-bold transition ${
                  primaryCurrency === "EUR"
                    ? "bg-white text-zinc-900 shadow-2xs"
                    : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                € EUR
              </button>
              <button
                type="button"
                onClick={() => setPrimaryCurrency("CNY")}
                className={`rounded-full px-3 py-1 font-mono text-[11px] font-bold transition ${
                  primaryCurrency === "CNY"
                    ? "bg-white text-zinc-900 shadow-2xs"
                    : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                ¥ CNY
              </button>
            </div>

            {/* Export Master .XLSX Button matching Image 1 */}
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-800 shadow-2xs transition hover:bg-zinc-50"
            >
              <Download className="h-3.5 w-3.5 text-zinc-700" />
              <span>{user.role === "admin" ? "Export Master .XLSX" : "Export My .XLSX"}</span>
            </button>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 space-y-6 p-6 max-w-7xl w-full mx-auto">
          {/* ================================================================
              1. LINK SCRAPER & EUR CALCULATOR
             ================================================================ */}
          {activeNav === "scraper" && (
            <div className="space-y-6">
              <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
                  Link Scraper &amp; EUR Converter
                </h1>
                <p className="text-sm text-zinc-500">
                  Paste any Yupoo, Weidian, Taobao, or 1688 link. Scrapes photos, specs, and calculates EUR prices with all item/haul markups applied.
                </p>
              </div>

              {/* Member Haul KPI Strip matching Image 1 */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-2xs">
                  <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-zinc-800">
                    MY TOTAL HAUL AMOUNT
                  </div>
                  <div className="text-3xl font-extrabold font-mono text-zinc-950 mt-2 mb-1">
                    {formatEUR(myHaulSummary?.final_total_eur ? myHaulSummary.final_total_eur / cnyToEur : 0, cnyToEur)}
                  </div>
                  <div className="text-xs text-zinc-400 font-medium">
                    Includes {myItems.length} items + markup fees
                  </div>
                </div>

                <div
                  className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-2xs cursor-pointer hover:border-zinc-300 transition"
                  onClick={() => setActiveNav("my-cart")}
                >
                  <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-zinc-800">
                    SHOPPING CART
                  </div>
                  <div className="text-3xl font-extrabold font-mono text-zinc-950 mt-2 mb-1">
                    {myCartItems.length}
                  </div>
                  <div className="text-xs text-zinc-400">Configure sizes &amp; submit</div>
                </div>

                <div
                  className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-2xs cursor-pointer hover:border-zinc-300 transition"
                  onClick={() => setActiveNav("my-orders")}
                >
                  <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-zinc-800">
                    SUBMITTED ORDERS
                  </div>
                  <div className="text-3xl font-extrabold font-mono text-zinc-950 mt-2 mb-1">
                    {mySubmittedItems.length}
                  </div>
                  <div className="text-xs text-zinc-400">Tracked in Mathis&apos;s queue</div>
                </div>

                <div
                  className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-2xs cursor-pointer hover:border-zinc-300 transition"
                  onClick={() => setActiveNav("shared-orders")}
                >
                  <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-zinc-800">
                    FRIENDS&apos; SHARED ITEMS
                  </div>
                  <div className="text-3xl font-extrabold font-mono text-zinc-950 mt-2 mb-1">
                    {sharedItems.length}
                  </div>
                  <div className="text-xs text-zinc-400">Browse &amp; copy to cart</div>
                </div>
              </div>

              {/* Scraper Card matching Image 1 */}
              <div className="rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-2xs">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="h-4 w-4 text-zinc-900" />
                  <span className="text-base font-bold text-zinc-900">Scrape Product Links</span>
                </div>
                <p className="text-xs text-zinc-500 mb-5">
                  Inspect a single link before adding, or paste multiple links in Bulk Import.
                </p>

                <Tabs defaultValue="single">
                  <TabsList className="mb-5 rounded-full bg-zinc-100 p-1 inline-flex">
                    <TabsTrigger
                      value="single"
                      className="rounded-full px-4 py-1.5 text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-2xs"
                    >
                      Single Link Inspector
                    </TabsTrigger>
                    <TabsTrigger
                      value="bulk"
                      className="rounded-full px-4 py-1.5 text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-2xs text-zinc-500"
                    >
                      Bulk URL Import
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="single" className="space-y-4">
                    <form onSubmit={handleScrapeSingle} className="flex gap-3">
                      <input
                        type="url"
                        placeholder="https://happywhale.x.yupoo.com/albums/... or https://weidian.com/item.html?itemID=..."
                        value={scrapeUrl}
                        onChange={(e) => setScrapeUrl(e.target.value)}
                        className="w-full rounded-xl border border-[#FF5B00] bg-white px-4 py-2.5 font-mono text-xs text-zinc-900 shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#FF5B00]/20"
                        required
                      />
                      <button
                        type="submit"
                        disabled={scrapingSingle}
                        className="rounded-full bg-[#FF5B00] hover:bg-[#E55200] disabled:opacity-50 text-white px-6 py-2.5 text-xs font-bold transition shadow-sm active:scale-[0.98] shrink-0"
                      >
                        {scrapingSingle ? "Scraping..." : "Scrape Info"}
                      </button>
                    </form>

                      {scrapedDraft && (
                        <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50/50 p-4">
                          <div className="grid grid-cols-1 gap-6 md:grid-cols-[160px_1fr]">
                            <div className="flex h-40 w-40 items-center justify-center overflow-hidden rounded-lg border bg-white">
                              {scrapedDraft.local_image ? (
                                <img
                                  src={scrapedDraft.local_image}
                                  alt={draftTitle}
                                  className="h-full w-full object-contain"
                                />
                              ) : (
                                <span className="font-mono text-xs text-zinc-400">No Image</span>
                              )}
                            </div>

                            <div className="space-y-4">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <Badge>{scrapedDraft.source_platform}</Badge>
                                  <Badge variant="outline">Seller: {scrapedDraft.seller}</Badge>
                                  <Badge variant="secondary">
                                    Available: {scrapedDraft.available_sizes}
                                  </Badge>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setScrapedDraft(null)}
                                >
                                  Discard
                                </Button>
                              </div>

                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <div className="sm:col-span-2 space-y-1">
                                  <label className="text-xs font-medium text-zinc-600">
                                    Product Title
                                  </label>
                                  <Input
                                    value={draftTitle}
                                    onChange={(e) => setDraftTitle(e.target.value)}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-medium text-zinc-600">Brand</label>
                                  <Input
                                    value={draftBrand}
                                    onChange={(e) => setDraftBrand(e.target.value)}
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                                <div className="space-y-1">
                                  <label className="text-xs font-medium text-zinc-600">
                                    Selected Size
                                  </label>
                                  <Input
                                    placeholder="e.g. L, 42, 32..."
                                    value={draftSize}
                                    onChange={(e) => setDraftSize(e.target.value)}
                                  />
                                  {parseSizeChips(scrapedDraft.available_sizes).length > 0 && (
                                    <div className="flex flex-wrap gap-1 pt-1">
                                      {parseSizeChips(scrapedDraft.available_sizes).map((chip) => (
                                        <button
                                          key={chip}
                                          type="button"
                                          onClick={() => setDraftSize(chip)}
                                          className="rounded border border-zinc-200 bg-white px-2 py-0.5 font-mono text-[10px] hover:border-zinc-900"
                                        >
                                          {chip}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                <div className="space-y-1">
                                  <label className="text-xs font-medium text-zinc-600">
                                    Color / Variant
                                  </label>
                                  <Input
                                    placeholder="e.g. Black, Brown..."
                                    value={draftColor}
                                    onChange={(e) => setDraftColor(e.target.value)}
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="text-xs font-medium text-zinc-600">
                                    Price in CNY (¥)
                                  </label>
                                  <Input
                                    type="number"
                                    step="1"
                                    placeholder="¥ CNY"
                                    value={draftPriceCny}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setDraftPriceCny(v);
                                      const n = parseFloat(v);
                                      setDraftPriceEur(!isNaN(n) ? (n * cnyToEur).toFixed(2) : "");
                                    }}
                                    className="font-mono"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="text-xs font-medium text-emerald-700">
                                    Converted EUR (€)
                                  </label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="€ EUR"
                                    value={draftPriceEur}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setDraftPriceEur(v);
                                      const n = parseFloat(v);
                                      setDraftPriceCny(
                                        !isNaN(n) && cnyToEur > 0 ? (n / cnyToEur).toFixed(0) : ""
                                      );
                                    }}
                                    className="font-mono border-emerald-300 bg-emerald-50/30"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                                <div className="space-y-1">
                                  <label className="text-xs font-medium text-zinc-600">Qty</label>
                                  <Input
                                    type="number"
                                    min="1"
                                    value={draftQty}
                                    onChange={(e) => setDraftQty(e.target.value)}
                                  />
                                </div>
                                <div className="sm:col-span-3 space-y-1">
                                  <label className="text-xs font-medium text-zinc-600">
                                    Notes for Mathis
                                  </label>
                                  <Input
                                    placeholder="Box preference, sizing notes..."
                                    value={draftNotes}
                                    onChange={(e) => setDraftNotes(e.target.value)}
                                  />
                                </div>
                              </div>

                              <div className="flex justify-end gap-2 pt-2">
                                <Button variant="outline" className="border-forest-200 hover:bg-forest-50 text-forest-900" onClick={() => handleSaveDraft("cart")}>
                                  Add to My Cart
                                </Button>
                                <Button variant="mandarine" onClick={() => handleSaveDraft("submitted")}>
                                  Submit Directly to Order Queue
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="bulk">
                      <form onSubmit={handleScrapeBulk} className="space-y-3">
                        <textarea
                          rows={5}
                          placeholder="Paste multiple Yupoo / Weidian / Taobao links here (one URL per line)..."
                          value={bulkUrlsText}
                          onChange={(e) => setBulkUrlsText(e.target.value)}
                          className="w-full rounded-lg border border-input bg-transparent p-3 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground">Import destination:</span>
                            <select
                              value={bulkStage}
                              onChange={(e) =>
                                setBulkStage(e.target.value as "cart" | "submitted")
                              }
                              className="rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium"
                            >
                              <option value="cart">My Shopping Cart</option>
                              <option value="submitted">My Submitted Orders</option>
                            </select>
                          </div>
                          <Button type="submit" variant="mandarine" disabled={scrapingBulk}>
                            <Layers className="h-3.5 w-3.5" />
                            <span>
                              {scrapingBulk ? "Scraping All Links..." : "Scrape & Import All"}
                            </span>
                          </Button>
                        </div>
                      </form>
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
          )}

          {/* ================================================================
              2. MY SHOPPING CART
             ================================================================ */}
          {activeNav === "my-cart" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-forest-950">My Shopping Cart</h1>
                  <p className="text-sm text-forest-700/80">
                    Configure sizes and check prices before submitting your haul to Mathis.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" className="border-forest-200 hover:bg-forest-50 text-forest-900" onClick={() => setActiveNav("scraper")}>
                    + Paste Link
                  </Button>
                  {myCartItems.length > 0 && (
                    <Button variant="mandarine" onClick={handleSubmitMyCart}>
                      <Send className="h-3.5 w-3.5" />
                      <span>Submit All ({myCartItems.length}) to Order Queue</span>
                    </Button>
                  )}
                </div>
              </div>

              {myCartItems.length === 0 ? (
                <Card className="p-12 text-center">
                  <p className="text-sm font-semibold text-zinc-900">Your cart is empty</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Paste a Yupoo or Weidian link in the Link Scraper or copy an item from Friends&apos; Shared Orders.
                  </p>
                  <Button className="mt-4" size="sm" onClick={() => setActiveNav("scraper")}>
                    Go to Link Scraper
                  </Button>
                </Card>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-3">
                    {myCartItems.map((item) => (
                      <Card key={item.id} className="p-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-[88px_1.5fr_1.2fr_auto] items-center">
                          <div
                            className="flex h-22 w-22 cursor-zoom-in items-center justify-center overflow-hidden rounded-lg border bg-zinc-50"
                            onClick={() =>
                              item.local_image &&
                              setZoomImage({ src: item.local_image, title: item.title })
                            }
                          >
                            {item.local_image ? (
                              <img
                                src={item.local_image}
                                alt={item.title}
                                className="h-20 w-20 object-contain"
                              />
                            ) : (
                              <span className="font-mono text-[10px] text-zinc-400">No Img</span>
                            )}
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Badge variant="secondary">{item.brand}</Badge>
                              <Badge variant="outline">{item.category}</Badge>
                              <span className="font-mono text-[11px] text-zinc-500">
                                {item.seller}
                              </span>
                            </div>
                            <div className="font-semibold text-sm text-zinc-900">{item.title}</div>
                            <div className="text-xs text-zinc-500">
                              Available: <span className="font-mono">{item.available_sizes}</span>
                            </div>
                            <div className="flex gap-3 pt-1">
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener"
                                className="inline-flex items-center gap-1 font-mono text-[11px] text-blue-600 hover:underline"
                              >
                                Source Link <ExternalLink className="h-3 w-3" />
                              </a>
                              {item.weidian_url && (
                                <a
                                  href={item.weidian_url}
                                  target="_blank"
                                  rel="noopener"
                                  className="inline-flex items-center gap-1 font-mono text-[11px] text-emerald-700 hover:underline"
                                >
                                  Weidian Link <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block font-mono text-[10px] uppercase text-zinc-500">
                                Size
                              </label>
                              <Input
                                defaultValue={item.chosen_size}
                                placeholder="Size..."
                                className="h-8 text-xs"
                                onBlur={(e) =>
                                  e.target.value !== item.chosen_size &&
                                  handlePatchItem(item.id, { chosen_size: e.target.value })
                                }
                              />
                            </div>
                            <div>
                              <label className="block font-mono text-[10px] uppercase text-zinc-500">
                                Price (CNY ¥)
                              </label>
                              <Input
                                type="number"
                                defaultValue={item.price_cny ?? ""}
                                placeholder="¥..."
                                className="h-8 font-mono text-xs"
                                onBlur={(e) => {
                                  const val =
                                    e.target.value.trim() === ""
                                      ? null
                                      : parseFloat(e.target.value);
                                  if (val !== item.price_cny) {
                                    handlePatchItem(item.id, { price_cny: val });
                                  }
                                }}
                              />
                            </div>
                            <div className="col-span-2">
                              <label className="block font-mono text-[10px] uppercase text-zinc-500">
                                Color / Notes
                              </label>
                              <Input
                                defaultValue={item.user_notes}
                                placeholder="Colorway or note..."
                                className="h-8 text-xs"
                                onBlur={(e) =>
                                  e.target.value !== item.user_notes &&
                                  handlePatchItem(item.id, { user_notes: e.target.value })
                                }
                              />
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-2">
                            {renderPricePair(item.line_total_cny, item.line_total_eur)}
                            <div className="flex gap-1.5">
                              <Button
                                size="sm"
                                onClick={() =>
                                  handlePatchItem(item.id, {
                                    stage: "submitted",
                                    order_status: "Pending",
                                  })
                                }
                              >
                                Submit Item
                              </Button>
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-8 w-8 text-red-600"
                                onClick={() => handleDeleteItem(item.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>

                  {/* Cart Total Breakdown Card */}
                  {myHaulSummary && (
                    <Card className="bg-zinc-50/70 p-4 border-zinc-300">
                      <div className="flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
                        <div className="space-y-1">
                          <div className="text-zinc-600">
                            Items Subtotal: <strong>€{myHaulSummary.subtotal_eur.toFixed(2)}</strong>
                          </div>
                          {myHaulSummary.haul_fee_percent > 0 && (
                            <div className="text-zinc-600">
                              Haul Handling Fee (+{myHaulSummary.haul_fee_percent}%):{" "}
                              <strong>+€{myHaulSummary.haul_fee_eur.toFixed(2)}</strong>
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] text-zinc-500 block uppercase">
                            Final Haul Total
                          </span>
                          <span className="text-xl font-bold text-zinc-900">
                            €{myHaulSummary.final_total_eur.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </Card>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ================================================================
              3. MY SUBMITTED ORDERS
             ================================================================ */}
          {activeNav === "my-orders" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">
                    {user.name}&apos;s Submitted Orders ({mySubmittedItems.length})
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Live order status, transparent prices in EUR &amp; CNY, and sharing visibility controls.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                    <Input
                      placeholder="Filter my orders..."
                      value={myOrdersSearch}
                      onChange={(e) => setMyOrdersSearch(e.target.value)}
                      className="pl-8 w-56 h-9 text-xs"
                    />
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setShareDialogOpen(true)}>
                    <Share2 className="h-3.5 w-3.5" />
                    <span>Share Settings</span>
                  </Button>
                </div>
              </div>

              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[72px]">Photo</TableHead>
                      <TableHead>Product &amp; Brand</TableHead>
                      <TableHead>Available Specs</TableHead>
                      <TableHead className="w-[150px]">My Size &amp; Note</TableHead>
                      <TableHead className="text-right">Price (EUR / CNY)</TableHead>
                      <TableHead>Order Status</TableHead>
                      <TableHead>Shared</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMyOrders.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div
                            className="flex h-14 w-14 cursor-zoom-in items-center justify-center overflow-hidden rounded-md border bg-zinc-50"
                            onClick={() =>
                              item.local_image &&
                              setZoomImage({ src: item.local_image, title: item.title })
                            }
                          >
                            {item.local_image ? (
                              <img
                                src={item.local_image}
                                alt={item.title}
                                className="h-full w-full object-contain"
                              />
                            ) : (
                              <span className="font-mono text-[10px] text-zinc-400">404</span>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="max-w-[280px]">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              {item.brand}
                            </Badge>
                            <span className="font-mono text-[10px] text-zinc-500">
                              {item.seller}
                            </span>
                          </div>
                          <div className="font-semibold text-xs text-zinc-900 line-clamp-2">
                            {item.title}
                          </div>
                          <div className="flex gap-2 mt-1">
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener"
                              className="font-mono text-[10px] text-blue-600 hover:underline"
                            >
                              Yupoo &nearr;
                            </a>
                            {item.weidian_url && (
                              <a
                                href={item.weidian_url}
                                target="_blank"
                                rel="noopener"
                                className="font-mono text-[10px] text-emerald-700 hover:underline"
                              >
                                Buy Link &nearr;
                              </a>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="font-mono text-[11px] text-zinc-500 max-w-[160px]">
                          {item.available_sizes}
                        </TableCell>

                        <TableCell>
                          <Input
                            defaultValue={item.chosen_size}
                            placeholder="Enter size..."
                            className="h-7 text-xs mb-1"
                            onBlur={(e) =>
                              e.target.value !== item.chosen_size &&
                              handlePatchItem(item.id, { chosen_size: e.target.value })
                            }
                          />
                          <Input
                            defaultValue={item.user_notes}
                            placeholder="Note / color..."
                            className="h-7 text-xs"
                            onBlur={(e) =>
                              e.target.value !== item.user_notes &&
                              handlePatchItem(item.id, { user_notes: e.target.value })
                            }
                          />
                        </TableCell>

                        <TableCell className="text-right">
                          {renderPricePair(item.line_total_cny, item.line_total_eur)}
                        </TableCell>

                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(item.order_status)}>
                            {item.order_status}
                          </Badge>
                          {(item.admin_notes || item.tracking_number) && (
                            <div className="mt-1 font-mono text-[10px] text-emerald-700">
                              {item.admin_notes} {item.tracking_number && `(${item.tracking_number})`}
                            </div>
                          )}
                        </TableCell>

                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() =>
                              handlePatchItem(item.id, {
                                is_shared: item.is_shared ? 0 : 1,
                              })
                            }
                            title="Toggle whether friends can see this item"
                          >
                            {item.is_shared ? (
                              <span className="flex items-center gap-1 text-emerald-700">
                                <Eye className="h-3.5 w-3.5" /> Shared
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-zinc-400">
                                <EyeOff className="h-3.5 w-3.5" /> Private
                              </span>
                            )}
                          </Button>
                        </TableCell>

                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-600"
                            onClick={() => handleDeleteItem(item.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>
          )}

          {/* ================================================================
              4. SHARED ORDERS FROM FRIENDS
             ================================================================ */}
          {activeNav === "shared-orders" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">Shared Orders from Friends</h1>
                  <p className="text-sm text-muted-foreground">
                    Explore items your friends have shared with you. Click &ldquo;Copy to My Cart&rdquo; to add any item to your own haul.
                  </p>
                </div>
                <Button variant="outline" onClick={() => setShareDialogOpen(true)}>
                  <Share2 className="h-3.5 w-3.5" />
                  <span>Manage Who Sees My Order</span>
                </Button>
              </div>

              {/* Friend filter buttons */}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={sharedFriendFilter === "ALL" ? "default" : "outline"}
                  onClick={() => setSharedFriendFilter("ALL")}
                >
                  All Shared ({sharedItems.length})
                </Button>
                {sharedSenders.map(([uid, uname]) => {
                  const cnt = sharedItems.filter((i) => i.user_id === uid).length;
                  return (
                    <Button
                      key={uid}
                      size="sm"
                      variant={sharedFriendFilter === String(uid) ? "default" : "outline"}
                      onClick={() => setSharedFriendFilter(String(uid))}
                    >
                      {uname} ({cnt})
                    </Button>
                  );
                })}
              </div>

              {filteredSharedItems.length === 0 ? (
                <Card className="p-12 text-center">
                  <p className="text-sm font-semibold text-zinc-900">
                    No shared orders found for this filter
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Friends can share their orders with you via the &ldquo;Share My Order with Users&rdquo; button in the sidebar.
                  </p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredSharedItems.map((item) => (
                    <Card key={item.id} className="flex flex-col justify-between overflow-hidden">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded bg-zinc-900 font-mono text-[10px] font-semibold text-white">
                              {item.user_initials}
                            </span>
                            <span className="text-xs font-semibold text-zinc-900">
                              Shared by {item.user_name}
                            </span>
                          </div>
                          <Badge variant={getStatusBadgeVariant(item.order_status)}>
                            {item.order_status}
                          </Badge>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-3">
                        <div
                          className="flex h-44 w-full cursor-zoom-in items-center justify-center overflow-hidden rounded-lg border bg-zinc-50"
                          onClick={() =>
                            item.local_image &&
                            setZoomImage({ src: item.local_image, title: item.title })
                          }
                        >
                          {item.local_image ? (
                            <img
                              src={item.local_image}
                              alt={item.title}
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <span className="font-mono text-xs text-zinc-400">
                              Album Offline (404)
                            </span>
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <Badge variant="secondary" className="text-[10px]">
                              {item.brand}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">
                              {item.category}
                            </Badge>
                          </div>
                          <h3 className="font-semibold text-sm text-zinc-900 line-clamp-2">
                            {item.title}
                          </h3>
                          <p className="mt-1 font-mono text-[11px] text-zinc-500">
                            Sizes: {item.available_sizes}
                            {item.chosen_size ? ` · Picked: ${item.chosen_size}` : ""}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t">
                          <div>{renderPricePair(item.line_total_cny, item.line_total_eur)}</div>
                          <div className="flex items-center gap-1.5">
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener"
                              className="inline-flex h-8 items-center rounded-md border px-2.5 text-xs font-medium hover:bg-zinc-50"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                            <Button size="sm" onClick={() => handleCloneSharedItem(item.id)}>
                              <Copy className="h-3.5 w-3.5" />
                              <span>Copy to My Cart</span>
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ================================================================
              5. MATHIS ADMIN BACKEND — OVERVIEW (WITH FINANCIAL TOTALS)
             ================================================================ */}
          {user.role === "admin" && activeNav === "admin-overview" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <Badge className="mb-1.5">Separated Admin Console</Badge>
                  <h1 className="text-2xl font-bold tracking-tight">
                    Mathis Master Backend &mdash; Overview
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Financial profit margins, seller cost vs. member charges, and haul management.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleExportExcel}>
                    <Download className="h-3.5 w-3.5" />
                    <span>Download Master .XLSX</span>
                  </Button>
                  <Button onClick={() => setActiveNav("admin-orders")}>
                    Manage All Orders ({adminAllItems.length})
                  </Button>
                </div>
              </div>

              {/* Enhanced Financial Bento Cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="border-crest-300 bg-gradient-to-br from-crest-50/80 via-crest-100/30 to-white shadow-xs">
                  <CardHeader className="pb-2">
                    <CardDescription className="font-mono text-[11px] font-bold uppercase text-crest-800 flex items-center justify-between">
                      <span>Total Admin Profit / Margin</span>
                      <TrendingUp className="h-4 w-4 text-crest-600" />
                    </CardDescription>
                    <CardTitle className="text-3xl font-extrabold font-mono text-crest-950">
                      +€{totalAdminProfit.toFixed(2)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-crest-800/80 font-medium">
                      Earned via item fixed fees &amp; % markups
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-mandarine-200 bg-gradient-to-br from-mandarine-50/60 to-white shadow-xs">
                  <CardHeader className="pb-2">
                    <CardDescription className="font-mono text-[11px] font-bold uppercase text-mandarine-800">
                      Total Collect from Members
                    </CardDescription>
                    <CardTitle className="text-3xl font-extrabold font-mono text-mandarine-950">
                      €{totalGrandHaulEur.toFixed(2)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-mandarine-800/80 font-mono font-medium">
                      Grand total across {adminAllItems.length} items
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-forest-200 bg-gradient-to-br from-forest-50/50 to-white shadow-xs">
                  <CardHeader className="pb-2">
                    <CardDescription className="font-mono text-[11px] font-bold uppercase text-forest-800">
                      Seller Base Cost (Your Cost)
                    </CardDescription>
                    <CardTitle className="text-3xl font-extrabold font-mono text-forest-900">
                      €{totalBaseCostEur.toFixed(2)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-forest-700/80 font-medium">
                      Base purchase cost to Chinese suppliers
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-forest-200 bg-white shadow-xs">
                  <CardHeader className="pb-2">
                    <CardDescription className="font-mono text-[11px] font-bold uppercase text-forest-800">
                      Active In Fulfillment
                    </CardDescription>
                    <CardTitle className="text-3xl font-extrabold text-forest-950">
                      {
                        adminAllItems.filter((i) =>
                          ["Ordered", "In Warehouse (QC)", "Shipped", "Delivered"].includes(
                            i.order_status
                          )
                        ).length
                      }
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-forest-700/80 font-medium">
                      {adminAllItems.filter((i) => ["In Cart", "Pending", "To Order"].includes(i.order_status)).length} awaiting order
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Per-Friend Breakdown Cards with Fee Margins */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Friends &amp; Haul Margin Breakdown</CardTitle>
                  <CardDescription>
                    Overview of seller base cost, admin fees, and member total for each friend. Click &ldquo;Customize Fees&rdquo; to adjust.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {adminUsers.map((u) => {
                      const h = adminHaulSummaries.find((s) => s.user_id === u.id);
                      const hasCustom = u.custom_item_fixed_eur !== null || u.custom_item_percent !== null || u.custom_haul_percent !== null;
                      return (
                        <div
                          key={u.id}
                          className="rounded-xl border border-zinc-200 p-4 transition hover:border-zinc-400 bg-white"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2.5">
                              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-900 font-mono text-xs font-semibold text-white">
                                {u.avatar_initials}
                              </span>
                              <div>
                                <div className="font-semibold text-sm text-zinc-900">{u.name}</div>
                                <div className="text-[11px] text-zinc-500">
                                  {h?.items_count ?? 0} items in haul
                                </div>
                              </div>
                            </div>
                            <Badge variant={hasCustom ? "default" : "outline"} className="text-[10px]">
                              {hasCustom ? "Custom Fees" : "Standard Fees"}
                            </Badge>
                          </div>

                          <div className="space-y-1.5 pt-2 border-t font-mono text-xs">
                            <div className="flex justify-between text-zinc-500">
                              <span>Seller Base Cost:</span>
                              <span>€{(h?.base_eur_sum ?? 0).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-emerald-700 font-semibold">
                              <span>Admin Profit / Markup:</span>
                              <span>+€{(h?.total_admin_profit_eur ?? 0).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-zinc-900 font-bold pt-1 border-t">
                              <span>Final Member Total:</span>
                              <span>€{(h?.final_total_eur ?? 0).toFixed(2)}</span>
                            </div>
                          </div>

                          <div className="mt-3 flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full text-xs"
                              onClick={() => setEditingMemberUser(u)}
                            >
                              <Sliders className="h-3 w-3 mr-1" />
                              <span>Customize Fees</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs"
                              onClick={() => {
                                setAdminFriendFilter(String(u.id));
                                setActiveNav("admin-orders");
                              }}
                            >
                              Orders &rarr;
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ================================================================
              6. MATHIS ADMIN BACKEND — ALL FRIENDS' ORDERS TABLE
             ================================================================ */}
          {user.role === "admin" && activeNav === "admin-orders" && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">
                    All Friends&apos; Orders &mdash; Master Backend
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Inspect base cost, customize fixed/percentage item fees, update statuses, and add QC tracking notes.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleExportExcel}>
                  <Download className="h-3.5 w-3.5" />
                  <span>Export Master .XLSX</span>
                </Button>
              </div>

              {/* Filter & Bulk Action Card */}
              <Card className="p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      size="sm"
                      variant={adminFriendFilter === "ALL" ? "default" : "outline"}
                      onClick={() => setAdminFriendFilter("ALL")}
                    >
                      All Friends ({adminAllItems.length})
                    </Button>
                    {adminUsers.map((u) => {
                      const cnt = adminAllItems.filter((i) => i.user_id === u.id).length;
                      return (
                        <Button
                          key={u.id}
                          size="sm"
                          variant={adminFriendFilter === String(u.id) ? "default" : "outline"}
                          onClick={() => setAdminFriendFilter(String(u.id))}
                        >
                          {u.name} ({cnt})
                        </Button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={adminStatusFilter}
                      onChange={(e) => setAdminStatusFilter(e.target.value)}
                      className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium"
                    >
                      <option value="ALL">All Statuses</option>
                      {ORDER_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                    <Input
                      placeholder="Search title, brand, friend..."
                      value={adminSearch}
                      onChange={(e) => setAdminSearch(e.target.value)}
                      className="h-8 w-56 text-xs"
                    />
                  </div>
                </div>

                <Separator />

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <label className="flex items-center gap-2 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={
                        filteredAdminItems.length > 0 &&
                        selectedAdminIds.length === filteredAdminItems.length
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedAdminIds(filteredAdminItems.map((i) => i.id));
                        } else {
                          setSelectedAdminIds([]);
                        }
                      }}
                    />
                    <span>Select All Visible ({selectedAdminIds.length} selected)</span>
                  </label>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-muted-foreground mr-1">Bulk Status:</span>
                    {["To Order", "Ordered", "In Warehouse (QC)", "Shipped", "Delivered"].map(
                      (st) => (
                        <Button
                          key={st}
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => handleAdminBulkStatus(st)}
                        >
                          {st}
                        </Button>
                      )
                    )}
                  </div>
                </div>
              </Card>

              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-9"></TableHead>
                      <TableHead className="w-[72px]">Photo</TableHead>
                      <TableHead>Friend</TableHead>
                      <TableHead>Product &amp; Brand</TableHead>
                      <TableHead>Size &amp; Variant</TableHead>
                      <TableHead className="text-right">Base Price (¥ / €)</TableHead>
                      <TableHead className="text-center">Admin Fee / Markup</TableHead>
                      <TableHead className="text-right">Final Member Price</TableHead>
                      <TableHead>Order Status</TableHead>
                      <TableHead>Admin / QC / Tracking</TableHead>
                      <TableHead className="text-right">Links</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAdminItems.map((item) => (
                      <TableRow
                        key={item.id}
                        className={
                          item.order_status.includes("404") ? "bg-red-50/40" : undefined
                        }
                      >
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedAdminIds.includes(item.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedAdminIds((prev) => [...prev, item.id]);
                              } else {
                                setSelectedAdminIds((prev) =>
                                  prev.filter((id) => id !== item.id)
                                );
                              }
                            }}
                          />
                        </TableCell>

                        <TableCell>
                          <div
                            className="flex h-14 w-14 cursor-zoom-in items-center justify-center overflow-hidden rounded-md border bg-zinc-50"
                            onClick={() =>
                              item.local_image &&
                              setZoomImage({ src: item.local_image, title: item.title })
                            }
                          >
                            {item.local_image ? (
                              <img
                                src={item.local_image}
                                alt={item.title}
                                className="h-full w-full object-contain"
                              />
                            ) : (
                              <span className="font-mono text-[10px] text-zinc-400">404</span>
                            )}
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge variant="outline" className="font-semibold">
                            {item.user_name}
                          </Badge>
                        </TableCell>

                        <TableCell className="max-w-[240px]">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="font-mono text-[10px] font-semibold uppercase text-zinc-600">
                              {item.brand}
                            </span>
                            <span className="text-zinc-300">&middot;</span>
                            <span className="font-mono text-[10px] text-zinc-500">
                              {item.seller}
                            </span>
                          </div>
                          <div className="font-semibold text-xs text-zinc-900 line-clamp-2">
                            {item.title}
                          </div>
                          <div className="font-mono text-[10px] text-zinc-400 mt-0.5">
                            Specs: {item.available_sizes}
                          </div>
                        </TableCell>

                        <TableCell className="w-[130px]">
                          <Input
                            defaultValue={item.chosen_size}
                            placeholder="Size..."
                            className="h-7 text-xs mb-1"
                            onBlur={(e) =>
                              e.target.value !== item.chosen_size &&
                              handlePatchItem(item.id, { chosen_size: e.target.value })
                            }
                          />
                          <Input
                            defaultValue={item.color_variant}
                            placeholder="Variant..."
                            className="h-7 text-xs"
                            onBlur={(e) =>
                              e.target.value !== item.color_variant &&
                              handlePatchItem(item.id, { color_variant: e.target.value })
                            }
                          />
                        </TableCell>

                        {/* Base Seller Price */}
                        <TableCell className="text-right w-[120px]">
                          <div className="font-mono text-xs font-semibold text-zinc-600">
                            {item.line_base_eur !== null && item.line_base_eur !== undefined
                              ? `€${item.line_base_eur.toFixed(2)}`
                              : "—"}
                          </div>
                          <div className="mt-1 flex items-center justify-end gap-1">
                            <span className="font-mono text-[10px] text-zinc-400">¥</span>
                            <Input
                              type="number"
                              defaultValue={item.price_cny ?? ""}
                              placeholder="CNY"
                              className="h-6 w-16 font-mono text-[11px] text-right"
                              onBlur={(e) => {
                                const val =
                                  e.target.value.trim() === ""
                                    ? null
                                    : parseFloat(e.target.value);
                                if (val !== item.price_cny) {
                                  handlePatchItem(item.id, { price_cny: val });
                                }
                              }}
                            />
                          </div>
                        </TableCell>

                        {/* Admin Fee Column with Clickable Override Dialog */}
                        <TableCell className="text-center w-[125px]">
                          <button
                            type="button"
                            onClick={() => setEditingFeeItem(item)}
                            className="flex flex-col items-center mx-auto hover:opacity-80 transition cursor-pointer"
                            title="Click to override fee for this item"
                          >
                            <Badge
                              variant={item.has_item_fee_override ? "default" : "outline"}
                              className="text-[10px] font-mono px-1.5 py-0.5"
                            >
                              {item.has_item_fee_override ? "Custom" : "Standard"}
                            </Badge>
                            <span className="font-mono text-[11px] font-bold text-emerald-700 mt-0.5">
                              +€{(item.line_fee_eur ?? 0).toFixed(2)}
                            </span>
                            <span className="font-mono text-[9px] text-zinc-400">
                              (+€{item.effective_fee_fixed_eur?.toFixed(2)} / +{item.effective_fee_percent}%)
                            </span>
                          </button>
                        </TableCell>

                        {/* Final Price for Member */}
                        <TableCell className="text-right w-[130px]">
                          <div className="font-mono text-sm font-bold text-zinc-900">
                            {item.line_total_eur !== null && item.line_total_eur !== undefined
                              ? `€${item.line_total_eur.toFixed(2)}`
                              : "—"}
                          </div>
                          <div className="font-mono text-[10px] text-zinc-500">
                            (Qty: {item.quantity || 1})
                          </div>
                        </TableCell>

                        <TableCell className="w-[155px]">
                          <select
                            value={item.order_status}
                            onChange={(e) =>
                              handlePatchItem(item.id, {
                                order_status: e.target.value,
                                stage: e.target.value === "In Cart" ? "cart" : "submitted",
                              })
                            }
                            className="w-full rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5 font-mono text-[11px] font-semibold"
                          >
                            {ORDER_STATUSES.map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                        </TableCell>

                        <TableCell className="w-[170px]">
                          <Input
                            defaultValue={item.admin_notes}
                            placeholder="Admin / QC note..."
                            className="h-7 text-xs mb-1"
                            onBlur={(e) =>
                              e.target.value !== item.admin_notes &&
                              handlePatchItem(item.id, { admin_notes: e.target.value })
                            }
                          />
                          <Input
                            defaultValue={item.tracking_number}
                            placeholder="Tracking #..."
                            className="h-7 font-mono text-xs"
                            onBlur={(e) =>
                              e.target.value !== item.tracking_number &&
                              handlePatchItem(item.id, { tracking_number: e.target.value })
                            }
                          />
                          {item.user_notes && (
                            <div className="mt-1 text-[10px] text-amber-700">
                              User: {item.user_notes}
                            </div>
                          )}
                        </TableCell>

                        <TableCell className="text-right whitespace-nowrap">
                          <div className="flex flex-col items-end gap-1">
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener"
                              className="font-mono text-[11px] text-blue-600 hover:underline"
                            >
                              Yupoo &nearr;
                            </a>
                            {item.weidian_url && (
                              <a
                                href={item.weidian_url}
                                target="_blank"
                                rel="noopener"
                                className="font-mono text-[11px] text-emerald-700 hover:underline"
                              >
                                Weidian &nearr;
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item.id)}
                              className="text-[11px] text-red-600 hover:underline mt-1"
                            >
                              Delete
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>
          )}

          {/* ================================================================
              7. MATHIS ADMIN BACKEND — FEES, RATES & EXPORT SETTINGS
             ================================================================ */}
          {user.role === "admin" && activeNav === "admin-settings" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  Fee Markups, EUR Rates &amp; Multi-Sheet Export
                </h1>
                <p className="text-sm text-muted-foreground">
                  Configure global standard markups for all members, customize individual member fees, and export to Excel.
                </p>
              </div>

              {/* Section 1: Global Standard Fee Settings */}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <DollarSign className="h-4 w-4 text-emerald-700" />
                      <span>Standard Markup Settings (All Members)</span>
                    </CardTitle>
                    <CardDescription>
                      These standard fees apply to every member unless individually overridden.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSaveGlobalFeeSettings} className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-zinc-700">
                            1 CNY (¥) in EUR (€)
                          </label>
                          <Input
                            type="number"
                            step="0.001"
                            min="0.01"
                            max="1"
                            value={rateInput}
                            onChange={(e) => setRateInput(e.target.value)}
                            className="font-mono"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-zinc-700">
                            Fixed EUR per Item (+€)
                          </label>
                          <Input
                            type="number"
                            step="0.5"
                            min="0"
                            value={inputDefaultFixed}
                            onChange={(e) => setInputDefaultFixed(e.target.value)}
                            className="font-mono"
                            placeholder="e.g. 3.00"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-zinc-700">
                            Markup per Item (+%)
                          </label>
                          <Input
                            type="number"
                            step="0.5"
                            min="0"
                            value={inputDefaultItemPct}
                            onChange={(e) => setInputDefaultItemPct(e.target.value)}
                            className="font-mono"
                            placeholder="e.g. 5"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-zinc-700">
                            Markup on Whole Haul (+%)
                          </label>
                          <Input
                            type="number"
                            step="0.5"
                            min="0"
                            value={inputDefaultHaulPct}
                            onChange={(e) => setInputDefaultHaulPct(e.target.value)}
                            className="font-mono"
                            placeholder="e.g. 4"
                          />
                        </div>
                      </div>

                      <div className="rounded-lg border bg-zinc-50 p-3 font-mono text-xs text-zinc-600 space-y-1">
                        <div className="font-semibold text-zinc-900">Live Simulation Example:</div>
                        <div>
                          ¥300 item &rarr; Base €{(300 * (parseFloat(rateInput) || 0.13)).toFixed(2)} + €{parseFloat(inputDefaultFixed) || 0} fixed + {parseFloat(inputDefaultItemPct) || 0}% ={" "}
                          <strong className="text-zinc-900">
                            €{(
                              300 * (parseFloat(rateInput) || 0.13) +
                              (parseFloat(inputDefaultFixed) || 0) +
                              (300 * (parseFloat(rateInput) || 0.13) * ((parseFloat(inputDefaultItemPct) || 0) / 100))
                            ).toFixed(2)}
                          </strong>
                        </div>
                        {parseFloat(inputDefaultHaulPct) > 0 && (
                          <div className="text-emerald-700">
                            + {parseFloat(inputDefaultHaulPct)}% whole haul handling fee applied at checkout
                          </div>
                        )}
                      </div>

                      <Button type="submit" className="w-full">
                        Save Global Standard Fees
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Download className="h-4 w-4" />
                      <span>Multi-Sheet Excel Workbook (.XLSX)</span>
                    </CardTitle>
                    <CardDescription>
                      Exports `FashionOrders_Master.xlsx` with separate tabs per friend, with all fee columns and grand total formulas.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-lg border bg-zinc-50 p-3 text-xs text-zinc-600 space-y-1.5">
                      <div className="font-semibold text-zinc-900">Exported Workbook Features:</div>
                      <div>&bull; <strong>Column K:</strong> Base Price (CNY ¥) from seller</div>
                      <div>&bull; <strong>Column L:</strong> Base Price (EUR €) at live rate</div>
                      <div>&bull; <strong>Column M:</strong> Admin Fee (€) markup per item</div>
                      <div>&bull; <strong>Column N:</strong> Final Member Price (€)</div>
                      <div>&bull; <strong>Bottom Rows:</strong> Subtotal, Haul % Fee, and Grand Total formulas</div>
                    </div>
                    <Button onClick={handleExportExcel} className="w-full">
                      <Download className="h-4 w-4" />
                      <span>Download Master FashionOrders.xlsx</span>
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Section 2: Individual Member Overrides Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-zinc-700" />
                    <span>Individual Member Overrides</span>
                  </CardTitle>
                  <CardDescription>
                    Customize fixed EUR, item %, or whole haul % for specific members. If left unset, standard defaults are used automatically.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Fixed Fee / Item</TableHead>
                        <TableHead>Item Markup %</TableHead>
                        <TableHead>Whole Haul Markup %</TableHead>
                        <TableHead className="text-right">Admin Profit Earned</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adminUsers.map((u) => {
                        const h = adminHaulSummaries.find((s) => s.user_id === u.id);
                        return (
                          <TableRow key={u.id}>
                            <TableCell className="font-semibold">
                              <div className="flex items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded bg-zinc-900 font-mono text-[10px] font-semibold text-white">
                                  {u.avatar_initials}
                                </span>
                                <span>{u.name}</span>
                              </div>
                            </TableCell>

                            <TableCell>
                              <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                                {u.role}
                              </Badge>
                            </TableCell>

                            <TableCell className="font-mono text-xs">
                              {u.custom_item_fixed_eur !== null && u.custom_item_fixed_eur !== undefined ? (
                                <span className="font-bold text-zinc-900">
                                  €{u.custom_item_fixed_eur.toFixed(2)} (Custom)
                                </span>
                              ) : (
                                <span className="text-zinc-500">
                                  €{feeSettings.default_item_fixed_eur.toFixed(2)} (Standard)
                                </span>
                              )}
                            </TableCell>

                            <TableCell className="font-mono text-xs">
                              {u.custom_item_percent !== null && u.custom_item_percent !== undefined ? (
                                <span className="font-bold text-zinc-900">
                                  +{u.custom_item_percent}% (Custom)
                                </span>
                              ) : (
                                <span className="text-zinc-500">
                                  +{feeSettings.default_item_percent}% (Standard)
                                </span>
                              )}
                            </TableCell>

                            <TableCell className="font-mono text-xs">
                              {u.custom_haul_percent !== null && u.custom_haul_percent !== undefined ? (
                                <span className="font-bold text-zinc-900">
                                  +{u.custom_haul_percent}% (Custom)
                                </span>
                              ) : (
                                <span className="text-zinc-500">
                                  +{feeSettings.default_haul_percent}% (Standard)
                                </span>
                              )}
                            </TableCell>

                            <TableCell className="text-right font-mono text-xs font-bold text-emerald-700">
                              +€{(h?.total_admin_profit_eur ?? 0).toFixed(2)}
                            </TableCell>

                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => setEditingMemberUser(u)}
                              >
                                <Sliders className="h-3 w-3 mr-1" />
                                <span>Customize</span>
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </SidebarInset>

      {/* Member Fee Override Dialog */}
      <MemberFeeDialog
        open={Boolean(editingMemberUser)}
        onOpenChange={(o) => !o && setEditingMemberUser(null)}
        targetUser={editingMemberUser}
        globalSettings={feeSettings}
        onSave={handleSaveMemberFees}
      />

      {/* Item-level Fee Override Dialog */}
      <ItemFeeDialog
        open={Boolean(editingFeeItem)}
        onOpenChange={(o) => !o && setEditingFeeItem(null)}
        item={editingFeeItem}
        onSave={handleSaveItemFee}
      />

      {/* Share Order Dialog */}
      <ShareOrderDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        shareAllFriends={Boolean(user.share_all_friends)}
        sharedTargetIds={myShareTargets}
        friendsDirectory={friendsDirectory}
        onSavePreferences={handleSaveSharePreferences}
      />

      {/* Image Zoom Lightbox Dialog */}
      <Dialog open={Boolean(zoomImage)} onOpenChange={(o) => !o && setZoomImage(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm">{zoomImage?.title}</DialogTitle>
          </DialogHeader>
          {zoomImage && (
            <div className="flex items-center justify-center overflow-hidden rounded-lg bg-zinc-50 p-2">
              <img
                src={zoomImage.src}
                alt={zoomImage.title}
                className="max-h-[65vh] w-auto object-contain rounded"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-xs font-medium text-white shadow-lg">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </SidebarProvider>
  );
}
