"use client";

import React, { useState, useEffect } from "react";
import { Tag, RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { OrderItem } from "@/lib/types";

interface ItemFeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: OrderItem | null;
  onSave: (
    itemId: number,
    payload: {
      custom_fee_fixed_eur: number | null;
      custom_fee_percent: number | null;
    }
  ) => Promise<void>;
}

export function ItemFeeDialog({ open, onOpenChange, item, onSave }: ItemFeeDialogProps) {
  const [fixedEur, setFixedEur] = useState<string>("");
  const [percent, setPercent] = useState<string>("");
  const [useCustomFixed, setUseCustomFixed] = useState(false);
  const [useCustomPercent, setUseCustomPercent] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      const hasF = item.custom_fee_fixed_eur !== null && item.custom_fee_fixed_eur !== undefined;
      setUseCustomFixed(hasF);
      setFixedEur(hasF ? String(item.custom_fee_fixed_eur) : String(item.effective_fee_fixed_eur ?? 0));

      const hasP = item.custom_fee_percent !== null && item.custom_fee_percent !== undefined;
      setUseCustomPercent(hasP);
      setPercent(hasP ? String(item.custom_fee_percent) : String(item.effective_fee_percent ?? 0));
    }
  }, [item, open]);

  if (!item) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!item) return;
    setSaving(true);
    try {
      await onSave(item.id, {
        custom_fee_fixed_eur: useCustomFixed && fixedEur.trim() !== "" ? parseFloat(fixedEur) : null,
        custom_fee_percent: useCustomPercent && percent.trim() !== "" ? parseFloat(percent) : null,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-zinc-700" />
            <DialogTitle className="text-base font-bold">Item Fee Override</DialogTitle>
          </div>
          <DialogDescription className="text-xs line-clamp-1">
            {item.title} ({item.user_name})
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="rounded-lg border bg-zinc-50 p-2.5 text-xs text-zinc-600 font-mono">
            <div>Base Seller Price: ¥{item.price_cny ?? "—"} (≈ €{item.base_price_eur ?? "—"})</div>
            <div className="text-[11px] text-zinc-500 mt-0.5">
              Member Default: +€{(item.effective_fee_fixed_eur ?? 0).toFixed(2)} fixed, +{item.effective_fee_percent ?? 0}%
            </div>
          </div>

          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">Custom Fixed EUR Fee (€)</span>
              <Badge variant={useCustomFixed ? "default" : "outline"} className="text-[10px]">
                {useCustomFixed ? "Override" : "Inherit Member Default"}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="0.5"
                min="0"
                disabled={!useCustomFixed}
                value={fixedEur}
                onChange={(e) => setFixedEur(e.target.value)}
                className="font-mono text-xs h-8 w-28"
                placeholder="€ 0.00"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setUseCustomFixed(!useCustomFixed)}
              >
                {useCustomFixed ? <RotateCcw className="h-3 w-3 mr-1" /> : null}
                {useCustomFixed ? "Reset to Default" : "Set Custom Amount"}
              </Button>
            </div>
          </div>

          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">Custom Percentage Markup (%)</span>
              <Badge variant={useCustomPercent ? "default" : "outline"} className="text-[10px]">
                {useCustomPercent ? "Override" : "Inherit Member Default"}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="0.5"
                min="0"
                disabled={!useCustomPercent}
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
                className="font-mono text-xs h-8 w-28"
                placeholder="% 0"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setUseCustomPercent(!useCustomPercent)}
              >
                {useCustomPercent ? <RotateCcw className="h-3 w-3 mr-1" /> : null}
                {useCustomPercent ? "Reset to Default" : "Set Custom Percent"}
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Item Fee"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
