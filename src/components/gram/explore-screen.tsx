"use client";

import React, { useEffect, useState } from "react";
import { Clapperboard, Heart, MessageCircle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { ExploreItem, Person } from "./types";

export function ExploreScreen({
  onOpenProfile,
}: {
  onOpenProfile: (handle: string) => void;
}) {
  const [items, setItems] = useState<ExploreItem[]>([]);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Person[]>([]);

  useEffect(() => {
    void fetch("/api/gram/explore", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setItems(data.items || []));
  }, []);

  async function search(value: string) {
    setQuery(value);
    if (value.trim().length < 1) {
      setFound([]);
      return;
    }
    const res = await fetch(`/api/gram/users?q=${encodeURIComponent(value)}`, { credentials: "include" });
    const data = await res.json();
    setFound(data.users || []);
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => void search(event.target.value)}
          placeholder="Search people"
          className="pl-9"
        />
      </div>

      {found.length > 0 && (
        <div className="mb-4 rounded-md border border-border bg-card">
          {found.map((person) => (
            <button
              key={person.id}
              type="button"
              onClick={() => onOpenProfile(person.handle)}
              className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-secondary"
            >
              <span className="grid h-8 w-8 place-items-center rounded-full bg-mandarine text-[10px] font-bold text-mandarine-foreground">
                {person.avatar_initials}
              </span>
              <span>
                <span className="block text-sm font-semibold">{person.name}</span>
                <span className="block text-xs text-muted-foreground">@{person.handle}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {items.length === 0 && <p className="text-sm text-muted-foreground">Nothing to explore yet.</p>}
      <div className="grid grid-cols-3 gap-1 sm:gap-2">
        {items.map((item) => (
          <button
            key={`${item.kind}-${item.id}`}
            type="button"
            onClick={() => onOpenProfile(item.handle)}
            className="group relative aspect-square overflow-hidden rounded-sm bg-card"
          >
            {item.kind === "reel" ? (
              <video
                src={`/api/gram/media/${item.image}`}
                muted
                playsInline
                preload="metadata"
                className="h-full w-full object-cover"
              />
            ) : (
              <img src={`/api/gram/media/${item.image}`} alt="" className="h-full w-full object-cover" />
            )}
            {item.kind === "reel" && (
              <Clapperboard className="absolute right-1.5 top-1.5 h-4 w-4 text-white drop-shadow" />
            )}
            <span className="absolute inset-0 flex items-center justify-center gap-4 bg-black/50 opacity-0 transition group-hover:opacity-100">
              <span className="flex items-center gap-1 text-sm font-semibold text-white">
                <Heart className="h-4 w-4 fill-white" /> {item.like_count}
              </span>
              <span className="flex items-center gap-1 text-sm font-semibold text-white">
                <MessageCircle className="h-4 w-4 fill-white" /> {item.comment_count}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
