"use client";

import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Item, Look, MyReel, Post } from "./types";

type EditTab = "page" | "looks" | "reels" | "invite";

export function EditScreen({
  items,
  posts,
  looks,
  reels,
  initialBio,
  onChanged,
  onBack,
  onError,
}: {
  items: Item[];
  posts: Post[];
  looks: Look[];
  reels: MyReel[];
  initialBio: string;
  onChanged: () => void;
  onBack: () => void;
  onError: (message: string) => void;
}) {
  const [tab, setTab] = useState<EditTab>("page");
  const [bio, setBio] = useState(initialBio);
  const [note, setNote] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  const [lookTitle, setLookTitle] = useState("Night look");
  const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState("");
  const [caption, setCaption] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function postFor(itemId: number) {
    return posts.find((post) => post.item_id === itemId);
  }

  async function saveBio() {
    const res = await fetch("/api/gram/posts", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bio }),
    });
    const data = await res.json();
    if (!res.ok) onError(data.detail || "Could not save");
    else setNote("Saved. Other users see this on your profile.");
  }

  async function toggleItem(item: Item) {
    const current = postFor(item.id);
    const res = await fetch("/api/gram/posts", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: item.id, published: current?.published ? 0 : 1, caption: current?.caption || "" }),
    });
    const data = await res.json();
    if (!res.ok) onError(data.detail || "Could not update");
    else onChanged();
  }

  async function makeLook() {
    setBusy(true);
    try {
      const res = await fetch("/api/gram/looks", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: lookTitle, item_ids: picked }),
      });
      const data = await res.json();
      if (!res.ok) onError(data.detail || "Could not dress the model");
      else {
        setNote("The model is dressed. Turn the look on if other users should see it.");
        setPicked([]);
        onChanged();
      }
    } finally {
      setBusy(false);
    }
  }

  async function toggleLook(look: Look) {
    const res = await fetch("/api/gram/looks", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ look_id: look.id, published: look.published ? 0 : 1 }),
    });
    const data = await res.json();
    if (!res.ok) onError(data.detail || "Could not update the look");
    else onChanged();
  }

  async function uploadReel(file: File) {
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
      if (data.media_kind !== "video") {
        onError("Reels need a video file.");
        return;
      }
      const reel = await fetch("/api/gram/reels", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video: data.filename, caption }),
      });
      if (!reel.ok) {
        const fail = await reel.json();
        onError(fail.detail || "Reel failed");
        return;
      }
      setCaption("");
      setNote("Reel is live in the reel feed.");
      onChanged();
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function sendInvite() {
    const res = await fetch("/api/gram/invites", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: invite }),
    });
    const data = await res.json();
    if (!res.ok) onError(data.detail || "Invite failed");
    else {
      setInvite("");
      setNote(`Invite sent to ${data.email}. They still need an account before they can see pages.`);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[470px] space-y-4">
      <button type="button" onClick={onBack} className="text-xs font-semibold text-accent">
        ← My profile
      </button>
      <p className="text-sm text-muted-foreground">This is the back of your profile. Choose what other users see.</p>
      {note && <p className="text-sm text-accent">{note}</p>}

      <div className="flex flex-wrap gap-2">
        {(["page", "looks", "reels", "invite"] as EditTab[]).map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setTab(name)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize ${
              tab === name ? "bg-mandarine text-mandarine-foreground" : "bg-secondary text-secondary-foreground"
            }`}
          >
            {name === "page" ? "Posts" : name}
          </button>
        ))}
      </div>

      {tab === "page" && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input value={bio} onChange={(event) => setBio(event.target.value)} placeholder="A short line about you" />
            <Button type="button" variant="mandarine" onClick={() => void saveBio()}>
              Save
            </Button>
          </div>
          {items.map((item) => {
            const post = postFor(item.id);
            const on = Boolean(post?.published);
            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{item.title}</div>
                  <div className="text-xs text-muted-foreground">{item.brand}</div>
                </div>
                <Button type="button" variant={on ? "mandarine" : "outline"} onClick={() => void toggleItem(item)}>
                  {on ? "Visible" : "Hidden"}
                </Button>
              </div>
            );
          })}
          {items.length === 0 && <p className="text-sm text-muted-foreground">Scrape a product first, then show it here.</p>}
        </div>
      )}

      {tab === "looks" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Tick up to four products. One button dresses a model. The prompt stays on the server. One photo costs about
            $0.03.
          </p>
          <Input value={lookTitle} onChange={(event) => setLookTitle(event.target.value)} placeholder="Look name" />
          {items.map((item) => (
            <label key={item.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={picked.includes(item.id)}
                onChange={() =>
                  setPicked((current) =>
                    current.includes(item.id)
                      ? current.filter((id) => id !== item.id)
                      : current.length >= 4
                        ? current
                        : [...current, item.id]
                  )
                }
              />
              {item.title}
            </label>
          ))}
          <Button type="button" variant="mandarine" disabled={busy || picked.length === 0} onClick={() => void makeLook()}>
            {busy ? "Dressing the model…" : "Dress a model"}
          </Button>
          {looks.map((look) => (
            <div key={look.id} className="rounded-md border border-border bg-card p-3">
              {look.result_image ? (
                <img
                  src={`/api/gram/media/${look.result_image}`}
                  alt=""
                  className="mb-2 aspect-[4/5] w-full rounded-sm object-cover"
                />
              ) : (
                <p className="mb-2 text-xs text-muted-foreground">
                  {look.status === "failed" ? "Photo failed" : "Working…"}
                </p>
              )}
              <div className="font-semibold">{look.title}</div>
              <Button
                type="button"
                className="mt-2"
                variant={look.published ? "mandarine" : "outline"}
                onClick={() => void toggleLook(look)}
              >
                {look.published ? "Visible to users" : "Hidden"}
              </Button>
            </div>
          ))}
        </div>
      )}

      {tab === "reels" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload a video (MP4, WebM or MOV, up to 50 MB). It appears in the reel feed for all signed-in users.
          </p>
          <Input value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Reel caption" />
          <input
            ref={fileRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadReel(file);
            }}
          />
          <Button type="button" variant="mandarine" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? "Uploading…" : "Upload reel"}
          </Button>
          {reels.map((reel) => (
            <div key={reel.id} className="rounded-md border border-border bg-card p-3">
              <video
                src={`/api/gram/media/${reel.video}`}
                controls
                playsInline
                preload="metadata"
                className="mb-2 aspect-[9/16] max-h-72 w-full rounded-sm object-cover"
              />
              <div className="text-sm font-semibold">{reel.caption || "Reel"}</div>
            </div>
          ))}
        </div>
      )}

      {tab === "invite" && (
        <div className="flex gap-2">
          <Input value={invite} onChange={(event) => setInvite(event.target.value)} placeholder="their@email.com" />
          <Button type="button" variant="mandarine" onClick={() => void sendInvite()}>
            Invite
          </Button>
        </div>
      )}
    </div>
  );
}
