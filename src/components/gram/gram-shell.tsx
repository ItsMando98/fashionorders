"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Clapperboard, Heart, Home, Search, Send, SquarePen } from "lucide-react";
import { GramAvatar } from "./avatar";
import { ActivityScreen } from "./activity-screen";
import { EditScreen } from "./edit-screen";
import { ExploreScreen } from "./explore-screen";
import { FeedScreen } from "./feed-screen";
import { MessagesScreen } from "./messages-screen";
import { ProfileScreen } from "./profile-screen";
import { ReelsScreen } from "./reels-screen";
import type { FeedPost, Item, Look, MyReel, Person, Post, ProfilePayload, StoryGroup } from "./types";

type Screen = "feed" | "explore" | "reels" | "activity" | "messages" | "profile" | "edit";

export function GramShell() {
  const [screen, setScreen] = useState<Screen>("feed");
  const [me, setMe] = useState<Person | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [looks, setLooks] = useState<Look[]>([]);
  const [reels, setReels] = useState<MyReel[]>([]);
  const [feed, setFeed] = useState<FeedPost[]>([]);
  const [stories, setStories] = useState<StoryGroup[]>([]);
  const [unread, setUnread] = useState(0);
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/gram", { credentials: "include" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.detail || "Could not load the network");
      return;
    }
    setMe(data.me);
    setItems(data.items || []);
    setPosts(data.posts || []);
    setLooks(data.looks || []);
    setReels(data.reels || []);
    setFeed(data.feed || []);
    setStories(data.stories || []);
    setUnread(data.unread || 0);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openProfile = useCallback(async (handle: string) => {
    setScreen("profile");
    setError("");
    const res = await fetch(`/api/gram/profile/${handle}`, { credentials: "include" });
    const data = await res.json();
    if (!res.ok) {
      setProfile(null);
      setError(data.detail || "No user with that page.");
      return;
    }
    setProfile(data);
  }, []);

  function nav(target: Screen) {
    setError("");
    if (target === "profile") {
      if (me?.handle) void openProfile(me.handle);
      return;
    }
    setScreen(target);
  }

  const navItems: { id: Screen; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "feed", label: "Feed", icon: <Home className="h-6 w-6" /> },
    { id: "explore", label: "Explore", icon: <Search className="h-6 w-6" /> },
    { id: "reels", label: "Reels", icon: <Clapperboard className="h-6 w-6" /> },
    { id: "activity", label: "Activity", icon: <Heart className="h-6 w-6" />, badge: unread },
    { id: "messages", label: "Messages", icon: <Send className="h-6 w-6" /> },
  ];

  return (
    <div className="flex h-[calc(100vh-3rem)] w-full bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden w-[220px] shrink-0 flex-col border-r border-border md:flex">
        <button
          type="button"
          onClick={() => nav("feed")}
          className="px-5 py-6 text-left font-display text-2xl font-bold italic tracking-wide"
        >
          FashionGram
        </button>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => nav(item.id)}
              className={`relative flex items-center gap-4 rounded-lg px-3 py-2.5 text-sm hover:bg-secondary ${
                screen === item.id ? "font-bold" : ""
              }`}
            >
              {item.icon}
              {item.label}
              {item.badge ? (
                <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-mandarine px-1 text-[10px] font-bold text-mandarine-foreground">
                  {item.badge}
                </span>
              ) : null}
            </button>
          ))}
          <button
            type="button"
            onClick={() => nav("edit")}
            className={`flex items-center gap-4 rounded-lg px-3 py-2.5 text-sm hover:bg-secondary ${
              screen === "edit" ? "font-bold" : ""
            }`}
          >
            <SquarePen className="h-6 w-6" />
            Create
          </button>
        </nav>
        <button
          type="button"
          onClick={() => nav("profile")}
          className={`flex items-center gap-4 px-6 py-5 text-sm hover:bg-secondary ${
            screen === "profile" ? "font-bold" : ""
          }`}
        >
          <GramAvatar initials={me?.avatar_initials || "??"} size="xs" />
          Profile
        </button>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3 md:hidden">
          <button type="button" onClick={() => nav("feed")} className="font-display text-2xl font-bold italic tracking-wide">
            FashionGram
          </button>
          <button type="button" onClick={() => nav("messages")} className="relative p-1" aria-label="Messages">
            <Send className="h-6 w-6" />
          </button>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6">
          {error && <p className="mx-auto mb-3 max-w-[470px] text-sm text-destructive">{error}</p>}

          {screen === "feed" && (
            <FeedScreen
              feed={feed}
              stories={stories}
              meInitials={me?.avatar_initials || "??"}
              onOpenProfile={(handle) => void openProfile(handle)}
              onStoriesChanged={() => void load()}
              onError={setError}
            />
          )}

          {screen === "explore" && <ExploreScreen onOpenProfile={(handle) => void openProfile(handle)} />}

          {screen === "reels" && <ReelsScreen onOpenProfile={(handle) => void openProfile(handle)} />}

          {screen === "activity" && (
            <ActivityScreen onOpenProfile={(handle) => void openProfile(handle)} onRead={() => setUnread(0)} />
          )}

          {screen === "messages" && me && <MessagesScreen meId={me.id} />}

          {screen === "profile" && profile && (
            <ProfileScreen
              profile={profile}
              onBack={() => setScreen("feed")}
              onEdit={profile.viewer_id === profile.person.id ? () => setScreen("edit") : undefined}
              onMessage={
                profile.viewer_id !== profile.person.id ? () => setScreen("messages") : undefined
              }
              onOpenProfile={(handle) => void openProfile(handle)}
              onProfileChanged={() => void load()}
            />
          )}

          {screen === "edit" && (
            <EditScreen
              items={items}
              posts={posts}
              looks={looks}
              reels={reels}
              initialBio={me?.bio || ""}
              onChanged={() => void load()}
              onBack={() => me?.handle && void openProfile(me.handle)}
              onError={setError}
            />
          )}
        </main>

        {/* Mobile bottom nav */}
        <nav className="flex shrink-0 border-t border-border bg-background md:hidden">
          {navItems
            .filter((item) => item.id !== "messages")
            .map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => nav(item.id)}
                className={`relative flex flex-1 justify-center py-3 ${
                  screen === item.id ? "text-mandarine" : "text-muted-foreground"
                }`}
                aria-label={item.label}
              >
                {item.icon}
                {item.badge ? (
                  <span className="absolute right-[calc(50%-18px)] top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-mandarine px-1 text-[9px] font-bold text-mandarine-foreground">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            ))}
          <button
            type="button"
            onClick={() => nav("profile")}
            className={`flex flex-1 justify-center py-3 ${screen === "profile" || screen === "edit" ? "text-mandarine" : "text-muted-foreground"}`}
            aria-label="Profile"
          >
            <GramAvatar initials={me?.avatar_initials || "??"} size="xs" />
          </button>
        </nav>
      </div>
    </div>
  );
}
