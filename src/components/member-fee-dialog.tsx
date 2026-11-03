"use client";

import React, { useState, useEffect } from "react";
import { Sliders, RotateCcw } from "lucide-react";
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
import { User } from "@/lib/types";

interface MemberFeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUser: User | null;
  globalSettings: {
    default_item_fixed_eur: number;
    default_item_percent: number;
    default_haul_percent: number;
  };
  onSave: (
    userId: number,
    payload: {
      custom_item_fixed_eur?: number | null;
      custom_item_percent?: number | null;
      custom_haul_percent?: number | null;
      reset_item_fixed?: boolean;
      reset_item_percent?: boolean;
      reset_haul_percent?: boolean;
    }
  ) => Promise<void>;
}

export function MemberFeeDialog({
  open,
  onOpenChange,
  targetUser,
  globalSettings,
  onSave,
}: MemberFeeDialogProps) {
  const [fixedEur, setFixedEur] = useState<string>("");
  const [itemPct, setItemPct] = useState<string>("");
  const [haulPct, setHaulPct] = useState<string>("");

  const [useCustomFixed, setUseCustomFixed] = useState(false);
  const [useCustomItemPct, setUseCustomItemPct] = useState(false);
  const [useCustomHaulPct, setUseCustomHaulPct] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (targetUser) {
      const hasFixed = targetUser.custom_item_fixed_eur !== null && targetUser.custom_item_fixed_eur !== undefined;
      setUseCustomFixed(hasFixed);
      setFixedEur(hasFixed ? String(targetUser.custom_item_fixed_eur) : String(globalSettings.default_item_fixed_eur));

      const hasItemPct = targetUser.custom_item_percent !== null && targetUser.custom_item_percent !== undefined;
      setUseCustomItemPct(hasItemPct);
      setItemPct(hasItemPct ? String(targetUser.custom_item_percent) : String(globalSettings.default_item_percent));

      const hasHaulPct = targetUser.custom_haul_percent !== null && targetUser.custom_haul_percent !== undefined;
      setUseCustomHaulPct(hasHaulPct);
      setHaulPct(hasHaulPct ? String(targetUser.custom_haul_percent) : String(globalSettings.default_haul_percent));
    }
  }, [targetUser, globalSettings, open]);

  if (!targetUser) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!targetUser) return;
    setSaving(true);
    try {
      const payload: {
        custom_item_fixed_eur?: number | null;
        custom_item_percent?: number | null;
        custom_haul_percent?: number | null;
        reset_item_fixed?: boolean;
        reset_item_percent?: boolean;
        reset_haul_percent?: boolean;
      } = {};

      if (useCustomFixed) {
        payload.custom_item_fixed_eur = fixedEur.trim() !== "" ? parseFloat(fixedEur) : 0;
      } else {
        payload.reset_item_fixed = true;
      }

      if (useCustomItemPct) {
        payload.custom_item_percent = itemPct.trim() !== "" ? parseFloat(itemPct) : 0;
      } else {
        payload.reset_item_percent = true;
      }

      if (useCustomHaulPct) {
        payload.custom_haul_percent = haulPct.trim() !== "" ? parseFloat(haulPct) : 0;
      } else {
        payload.reset_haul_percent = true;
      }

      await onSave(targetUser.id, payload);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-900 font-mono text-xs font-semibold text-white">
              {targetUser.avatar_initials}
            </span>
            <div>
              <DialogTitle className="text-base font-bold">
                Fee &amp; Markup Settings &mdash; {targetUser.name}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Set individual fixed EUR or percentage markup for this member, or inherit standard defaults.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Global defaults info badge */}
          <div className="rounded-lg border bg-zinc-50 p-3 text-xs text-zinc-600">
            <span className="font-semibold text-zinc-900">Standard Defaults for All Members:</span>
            <div className="mt-1 flex flex-wrap gap-3 font-mono text-[11px]">
              <span>Fixed item: +€{globalSettings.default_item_fixed_eur.toFixed(2)}</span>
              <span>Item %: +{globalSettings.default_item_percent}%</span>
              <span>Haul %: +{globalSettings.default_haul_percent}%</span>
            </div>
          </div>

          {/* 1. Item Fixed Fee */}
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-zinc-900">Fixed EUR per Item</div>
                <div className="text-[11px] text-zinc-500">Added to every item ordered by {targetUser.name}</div>
              </div>
              <Badge variant={useCustomFixed ? "default" : "outline"} className="text-[10px]">
                {useCustomFixed ? "Custom Override" : "Using Standard"}
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
                className="font-mono text-xs h-8 w-32"
                placeholder="€ 0.00"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  setUseCustomFixed(!useCustomFixed);
                  if (useCustomFixed) {
                    setFixedEur(String(globalSettings.default_item_fixed_eur));
                  }
                }}
              >
                {useCustomFixed ? <RotateCcw className="h-3 w-3 mr-1" /> : <Sliders className="h-3 w-3 mr-1" />}
                {useCustomFixed ? "Reset to Standard" : "Customize for this Member"}
              </Button>
            </div>
          </div>

          {/* 2. Item Percentage Markup */}
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-zinc-900">Percentage per Item (%)</div>
                <div className="text-[11px] text-zinc-500">Percentage markup added on top of base EUR price per item</div>
              </div>
              <Badge variant={useCustomItemPct ? "default" : "outline"} className="text-[10px]">
                {useCustomItemPct ? "Custom Override" : "Using Standard"}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="0.5"
                min="0"
                disabled={!useCustomItemPct}
                value={itemPct}
                onChange={(e) => setItemPct(e.target.value)}
                className="font-mono text-xs h-8 w-32"
                placeholder="% 0"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  setUseCustomItemPct(!useCustomItemPct);
                  if (useCustomItemPct) {
                    setItemPct(String(globalSettings.default_item_percent));
                  }
                }}
              >
                {useCustomItemPct ? <RotateCcw className="h-3 w-3 mr-1" /> : <Sliders className="h-3 w-3 mr-1" />}
                {useCustomItemPct ? "Reset to Standard" : "Customize for this Member"}
              </Button>
            </div>
          </div>

          {/* 3. Haul Percentage Markup */}
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-zinc-900">Percentage on Whole Haul (%)</div>
                <div className="text-[11px] text-zinc-500">Handling fee percentage added on {targetUser.name}&apos;s entire haul total</div>
              </div>
              <Badge variant={useCustomHaulPct ? "default" : "outline"} className="text-[10px]">
                {useCustomHaulPct ? "Custom Override" : "Using Standard"}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="0.5"
                min="0"
                disabled={!useCustomHaulPct}
                value={haulPct}
                onChange={(e) => setHaulPct(e.target.value)}
                className="font-mono text-xs h-8 w-32"
                placeholder="% 0"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  setUseCustomHaulPct(!useCustomHaulPct);
                  if (useCustomHaulPct) {
                    setHaulPct(String(globalSettings.default_haul_percent));
                  }
                }}
              >
                {useCustomHaulPct ? <RotateCcw className="h-3 w-3 mr-1" /> : <Sliders className="h-3 w-3 mr-1" />}
                {useCustomHaulPct ? "Reset to Standard" : "Customize for this Member"}
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Member Fees"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
