"use client";

import React, { useRef, useState } from "react";
import { Plus } from "lucide-react";
import { GramAvatar } from "./avatar";
import type { StoryGroup } from "./types";

export function StoriesBar({
  groups,
  meInitials,
  onOpen,
  onUploaded,
  onError,
}: {
  groups: StoryGroup[];
  meInitials: string;
  onOpen: (index: number) => void;
  onUploaded: () => void;
  onError: (message: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const myGroup = groups.find((group) => group.mine);
  const others = groups.filter((group) => !group.mine);
  const ordered: (StoryGroup | null)[] = [myGroup || null, ...others];

  async function upload(file: File) {
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/gram/upload", { method: "POST", credentials: "include", body: form });
      const data = await res.json();
      if (!res.ok) {
        onError(data.detail || "Upload failed");
        return;
      }
      const story = await fetch("/api/gram/stories", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ media: data.filename, media_kind: data.media_kind }),
      });
      if (!story.ok) {
        const fail = await story.json();
        onError(fail.detail || "Story failed");
        return;
      }
      onUploaded();
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex gap-4 overflow-x-auto px-1 pb-4 pt-1">
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      {ordered.map((group, index) =>
        group === null ? (
          <button
            key="add"
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="flex w-16 shrink-0 flex-col items-center gap-1.5"
          >
            <span className="relative">
              <GramAvatar initials={meInitials} size="md" />
              <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full border-2 border-background bg-mandarine text-mandarine-foreground">
                <Plus className="h-3 w-3" strokeWidth={3} />
              </span>
            </span>
            <span className="w-full truncate text-center text-[11px] text-muted-foreground">
              {busy ? "Posting…" : "Your story"}
            </span>
          </button>
        ) : (
          <button
            key={group.user_id}
            type="button"
            onClick={() => onOpen(index)}
            className="flex w-16 shrink-0 flex-col items-center gap-1.5"
          >
            <GramAvatar initials={group.avatar_initials} size="md" ring />
            <span className="w-full truncate text-center text-[11px] text-muted-foreground">{group.name}</span>
          </button>
        )
      )}
    </div>
  );
}
