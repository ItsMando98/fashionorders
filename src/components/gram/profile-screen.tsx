"use client";

import React, { useState } from "react";
import { Bookmark, Clapperboard, Grid3X3, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GramAvatar } from "./avatar";
import { PostCard } from "./post-card";
import type { FeedPost, ProfilePayload } from "./types";

type ProfileTab = "posts" | "looks" | "reels" | "saved";

export function ProfileScreen({
  profile,
  onBack,
  onEdit,
  onMessage,
  onOpenProfile,
  onProfileChanged,
}: {
  profile: ProfilePayload;
  onBack?: () => void;
  onEdit?: () => void;
  onMessage?: () => void;
  onOpenProfile: (handle: string) => void;
  onProfileChanged: () => void;
}) {
  const mine = profile.viewer_id === profile.person.id;
  const [following, setFollowing] = useState(profile.is_following);
  const [followers, setFollowers] = useState(profile.counts.followers);
  const [tab, setTab] = useState<ProfileTab>("posts");
  const [open, setOpen] = useState<FeedPost | null>(null);
  const [draft, setDraft] = useState("");
  const [sent, setSent] = useState("");

  async function toggleFollow() {
    const res = await fetch("/api/gram/follows", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: profile.person.id }),
    });
    const data = await res.json();
    if (res.ok) {
      setFollowing(data.following);
      setFollowers(data.followers);
      onProfileChanged();
    }
  }

  async function sendInline() {
    const res = await fetch("/api/gram/messages", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to_user_id: profile.person.id, body: draft }),
    });
    if (res.ok) {
      setDraft("");
      setSent("Sent. Only the two of you can read it.");
    }
  }

  const tiles: { tab: ProfileTab; post: FeedPost }[] = [
    ...profile.looks.map((look) => ({ tab: "looks" as const, post: look })),
    ...profile.posts.map((post) => ({ tab: "posts" as const, post })),
  ];
  const reels: FeedPost[] = profile.reels;
  const savedTiles = profile.saved.map((tile) => ({
    tab: "saved" as const,
    post: {
      kind: tile.kind,
      id: tile.id,
      title: tile.title,
      caption: "",
      image: tile.image,
      created_at: "",
      user_id: 0,
      name: "",
      handle: profile.person.handle,
      avatar_initials: profile.person.avatar_initials,
      like_count: 0,
      comment_count: 0,
      liked: 0,
      saved: 1,
    } satisfies FeedPost,
  }));

  const visible =
    tab === "posts"
      ? tiles.filter((tile) => tile.tab === "posts")
      : tab === "looks"
        ? tiles.filter((tile) => tile.tab === "looks")
        : tab === "reels"
          ? reels.map((reel) => ({ tab: "reels" as const, post: reel }))
          : savedTiles;

  const tabs: { id: ProfileTab; label: React.ReactNode; show: boolean }[] = [
    { id: "posts", label: <Grid3X3 className="h-4 w-4" />, show: true },
    { id: "looks", label: <Layers className="h-4 w-4" />, show: profile.looks.length > 0 },
    { id: "reels", label: <Clapperboard className="h-4 w-4" />, show: profile.reels.length > 0 },
    { id: "saved", label: <Bookmark className="h-4 w-4" />, show: mine && profile.saved.length > 0 },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl">
      {onBack && (
        <button type="button" onClick={onBack} className="mb-4 text-xs font-semibold tracking-wide text-accent">
          ← Feed
        </button>
      )}

      <div className="flex items-center gap-5 sm:gap-10">
        <GramAvatar initials={profile.person.avatar_initials} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="truncate text-xl font-semibold">{profile.person.handle}</h1>
            {mine && onEdit && (
              <Button type="button" variant="outline" size="sm" onClick={onEdit}>
                Edit page
              </Button>
            )}
            {!mine && (
              <>
                <Button type="button" variant={following ? "outline" : "mandarine"} size="sm" onClick={() => void toggleFollow()}>
                  {following ? "Following" : "Follow"}
                </Button>
                {onMessage && (
                  <Button type="button" variant="outline" size="sm" onClick={onMessage}>
                    Message
                  </Button>
                )}
              </>
            )}
          </div>
          <div className="mt-3 flex gap-5 text-sm">
            <span>
              <strong>{profile.counts.posts}</strong> <span className="text-muted-foreground">posts</span>
            </span>
            <span>
              <strong>{followers}</strong> <span className="text-muted-foreground">followers</span>
            </span>
            <span>
              <strong>{profile.counts.following}</strong> <span className="text-muted-foreground">following</span>
            </span>
          </div>
          <p className="mt-2 text-sm font-semibold">{profile.person.name}</p>
          {profile.person.bio && <p className="text-sm text-muted-foreground">{profile.person.bio}</p>}
        </div>
      </div>

      {!mine && !onMessage && (
        <div className="mt-4">
          <div className="flex gap-2">
            <Input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Private message" />
            <Button type="button" variant="mandarine" onClick={() => void sendInline()}>
              Send
            </Button>
          </div>
          {sent && <p className="mt-2 text-sm text-accent">{sent}</p>}
        </div>
      )}

      <div className="mt-6 flex justify-center gap-10 border-t border-border">
        {tabs
          .filter((entry) => entry.show)
          .map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setTab(entry.id)}
              className={`-mt-px flex items-center gap-1.5 border-t-2 px-1 py-3 text-xs font-semibold uppercase tracking-widest ${
                tab === entry.id ? "border-mandarine text-foreground" : "border-transparent text-muted-foreground"
              }`}
            >
              {entry.label}
              {entry.id}
            </button>
          ))}
      </div>

      {visible.length === 0 && <p className="mt-6 text-center text-sm text-muted-foreground">Nothing here yet.</p>}
      <div className="grid grid-cols-3 gap-1 sm:gap-2">
        {visible.map(({ post }) => (
          <button
            key={`${post.kind}-${post.id}`}
            type="button"
            onClick={() => setOpen(post)}
            className="relative aspect-square overflow-hidden rounded-sm bg-card"
          >
            {post.kind === "reel" ? (
              <video
                src={`/api/gram/media/${post.image}`}
                muted
                playsInline
                preload="metadata"
                className="h-full w-full object-cover"
              />
            ) : post.image ? (
              <img src={`/api/gram/media/${post.image}`} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="grid h-full place-items-center text-[10px] text-muted-foreground">No photo</span>
            )}
            {post.kind === "reel" && (
              <Clapperboard className="absolute right-1.5 top-1.5 h-4 w-4 text-white drop-shadow" />
            )}
          </button>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setOpen(null)}>
          <div
            className="max-h-full w-full max-w-[470px] overflow-y-auto rounded-lg bg-background p-3"
            onClick={(event) => event.stopPropagation()}
          >
            <PostCard post={open} onOpenProfile={onOpenProfile} />
            <button type="button" className="mt-2 text-sm text-muted-foreground" onClick={() => setOpen(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
