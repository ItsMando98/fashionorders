"use client";

import React, { useEffect, useRef, useState } from "react";
import { Bookmark, Heart, MessageCircle, Volume2, VolumeX } from "lucide-react";
import { GramAvatar } from "./avatar";
import type { Comment, ReelCard } from "./types";

function Reel({
  reel,
  onOpenProfile,
}: {
  reel: ReelCard;
  onOpenProfile: (handle: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [liked, setLiked] = useState(Boolean(reel.liked));
  const [likeCount, setLikeCount] = useState(reel.like_count);
  const [saved, setSaved] = useState(Boolean(reel.saved));
  const [commentCount, setCommentCount] = useState(reel.comment_count);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) void video.play().catch(() => undefined);
          else video.pause();
        });
      },
      { threshold: 0.6 }
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  async function toggleLike() {
    const res = await fetch("/api/gram/likes", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_kind: "reel", target_id: reel.id }),
    });
    const data = await res.json();
    if (res.ok) {
      setLiked(data.liked);
      setLikeCount(data.count);
    }
  }

  async function toggleSave() {
    const res = await fetch("/api/gram/saved", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_kind: "reel", target_id: reel.id }),
    });
    const data = await res.json();
    if (res.ok) setSaved(data.saved);
  }

  async function loadComments() {
    if (showComments) {
      setShowComments(false);
      return;
    }
    setShowComments(true);
    const res = await fetch(`/api/gram/comments?kind=reel&id=${reel.id}`, { credentials: "include" });
    const data = await res.json();
    if (res.ok) setComments(data.comments || []);
  }

  async function sendComment() {
    if (!draft.trim()) return;
    const res = await fetch("/api/gram/comments", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_kind: "reel", target_id: reel.id, body: draft }),
    });
    const data = await res.json();
    if (res.ok) {
      setDraft("");
      setCommentCount((count) => count + 1);
      setComments((current) => (current ? [...current, data.comment] : [data.comment]));
    }
  }

  return (
    <section className="relative h-full w-full snap-start overflow-hidden rounded-lg bg-card">
      <video
        ref={videoRef}
        src={`/api/gram/media/${reel.video}`}
        loop
        muted={muted}
        playsInline
        className="h-full w-full object-contain"
        onClick={() => setMuted((value) => !value)}
      />

      <button
        type="button"
        onClick={() => setMuted((value) => !value)}
        className="absolute right-3 top-3 rounded-full bg-black/60 p-2 text-white"
        aria-label={muted ? "Unmute" : "Mute"}
      >
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>

      <div className="absolute bottom-0 left-0 right-14 bg-gradient-to-t from-black/80 to-transparent p-4 pt-12">
        <button type="button" onClick={() => onOpenProfile(reel.handle)} className="flex items-center gap-2 text-left">
          <GramAvatar initials={reel.avatar_initials} size="xs" />
          <span className="text-sm font-semibold text-white">{reel.name}</span>
          <span className="text-xs text-zinc-300">@{reel.handle}</span>
        </button>
        {reel.caption && <p className="mt-2 text-sm text-white">{reel.caption}</p>}
        {showComments && (
          <div className="mt-3 max-h-48 space-y-2 overflow-y-auto" onClick={(event) => event.stopPropagation()}>
            {comments?.map((comment) => (
              <p key={comment.id} className="text-sm text-white">
                <span className="font-semibold">{comment.name}</span> {comment.body}
              </p>
            ))}
            <div className="flex gap-2">
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && void sendComment()}
                placeholder="Add a comment…"
                className="h-8 flex-1 rounded-md border border-white/20 bg-black/50 px-2 text-sm text-white placeholder:text-zinc-400"
              />
              <button type="button" onClick={() => void sendComment()} className="text-xs font-bold text-mandarine">
                Post
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-4 right-2 flex flex-col items-center gap-5">
        <button type="button" onClick={() => void toggleLike()} className="flex flex-col items-center gap-1 text-white">
          <Heart className={`h-7 w-7 ${liked ? "fill-mandarine text-mandarine" : ""}`} />
          <span className="text-xs font-semibold">{likeCount}</span>
        </button>
        <button type="button" onClick={() => void loadComments()} className="flex flex-col items-center gap-1 text-white">
          <MessageCircle className="h-7 w-7" />
          <span className="text-xs font-semibold">{commentCount}</span>
        </button>
        <button type="button" onClick={() => void toggleSave()} className="text-white">
          <Bookmark className={`h-7 w-7 ${saved ? "fill-crest text-crest" : ""}`} />
        </button>
      </div>
    </section>
  );
}

export function ReelsScreen({
  onOpenProfile,
}: {
  onOpenProfile: (handle: string) => void;
}) {
  const [reels, setReels] = useState<ReelCard[] | null>(null);

  useEffect(() => {
    void fetch("/api/gram/reels", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setReels(data.reels || []));
  }, []);

  if (reels === null) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (reels.length === 0) {
    return (
      <div className="mx-auto max-w-[470px]">
        <p className="text-sm text-muted-foreground">
          No reels yet. Upload a video from your profile edit page to start the reel feed.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto h-full w-full max-w-[420px] snap-y snap-mandatory space-y-4 overflow-y-auto pb-4">
      {reels.map((reel) => (
        <div key={reel.id} className="h-[calc(100vh-10rem)] min-h-[420px]">
          <Reel reel={reel} onOpenProfile={onOpenProfile} />
        </div>
      ))}
    </div>
  );
}
