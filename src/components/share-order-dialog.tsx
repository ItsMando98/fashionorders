"use client";

import React, { useState, useEffect } from "react";
import { Share2, Globe, Users, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FriendDirectoryEntry } from "@/lib/types";

interface ShareOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareAllFriends: boolean;
  sharedTargetIds: number[];
  friendsDirectory: FriendDirectoryEntry[];
  onSavePreferences: (shareAll: boolean, targetIds: number[]) => Promise<void>;
}

export function ShareOrderDialog({
  open,
  onOpenChange,
  shareAllFriends,
  sharedTargetIds,
  friendsDirectory,
  onSavePreferences,
}: ShareOrderDialogProps) {
  const [shareAll, setShareAll] = useState(shareAllFriends);
  const [selectedIds, setSelectedIds] = useState<number[]>(sharedTargetIds);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setShareAll(shareAllFriends);
    setSelectedIds(sharedTargetIds);
  }, [shareAllFriends, sharedTargetIds, open]);

  function toggleFriend(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSavePreferences(shareAll, selectedIds);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4" />
            <span>Share My Order with Friends</span>
          </DialogTitle>
          <DialogDescription>
            Choose whether all registered friends can see your shared haul items or select specific friends.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <button
            type="button"
            onClick={() => setShareAll(!shareAll)}
            className={`flex w-full items-start justify-between rounded-lg border p-3.5 text-left transition ${
              shareAll
                ? "border-zinc-900 bg-zinc-900/[0.03]"
                : "border-zinc-200 hover:bg-zinc-50"
            }`}
          >
            <div className="flex gap-3">
              <Globe className="mt-0.5 h-4 w-4 text-zinc-700 shrink-0" />
              <div>
                <div className="text-sm font-semibold text-zinc-900">
                  Share with all friends in the app
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">
                  All logged-in members can view your shared items in &ldquo;Shared by Friends&rdquo; and copy links to their cart.
                </p>
              </div>
            </div>
            <div
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                shareAll ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300"
              }`}
            >
              {shareAll && <Check className="h-3.5 w-3.5" />}
            </div>
          </button>

          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <Users className="h-3.5 w-3.5" />
              <span>Or Share with Specific Friends</span>
            </div>

            <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-lg border border-zinc-200 p-2">
              {friendsDirectory.map((f) => {
                const isSelected = shareAll || selectedIds.includes(f.id);
                return (
                  <button
                    key={f.id}
                    type="button"
                    disabled={shareAll}
                    onClick={() => toggleFriend(f.id)}
                    className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs transition ${
                      isSelected ? "bg-zinc-100 font-semibold text-zinc-900" : "hover:bg-zinc-50 text-zinc-700"
                    } ${shareAll ? "opacity-60 cursor-default" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded bg-zinc-900 font-mono text-[10px] font-semibold text-white">
                        {f.avatar_initials}
                      </span>
                      <span>{f.name}</span>
                    </div>
                    <div
                      className={`flex h-4 w-4 items-center justify-center rounded border ${
                        isSelected ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300"
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Sharing Settings"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
