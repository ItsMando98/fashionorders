"use client";

import React, { useState } from "react";
import { Bookmark, Heart, MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GramAvatar } from "./avatar";
import type { Comment, FeedPost } from "./types";

export function PostCard({
  post,
  onOpenProfile,
}: {
  post: FeedPost;
  onOpenProfile: (handle: string) => void;
}) {
  const [liked, setLiked] = useState(Boolean(post.liked));
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [saved, setSaved] = useState(Boolean(post.saved));
  const [commentCount, setCommentCount] = useState(post.comment_count);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [draft, setDraft] = useState("");

  async function toggleLike() {
    const res = await fetch("/api/gram/likes", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_kind: post.kind, target_id: post.id }),
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
      body: JSON.stringify({ target_kind: post.kind, target_id: post.id }),
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
    const res = await fetch(`/api/gram/comments?kind=${post.kind}&id=${post.id}`, { credentials: "include" });
    const data = await res.json();
    if (res.ok) setComments(data.comments || []);
  }

  async function sendComment() {
    if (!draft.trim()) return;
    const res = await fetch("/api/gram/comments", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_kind: post.kind, target_id: post.id, body: draft }),
    });
    const data = await res.json();
    if (res.ok) {
      setDraft("");
      setCommentCount((count) => count + 1);
      setComments((current) => (current ? [...current, data.comment] : [data.comment]));
    }
  }

  const caption = post.kind === "look" ? post.title : post.caption || post.title;
  const isVideo = post.kind === "reel" || /\.(mp4|webm|mov)$/i.test(post.image);

  return (
    <article className="border-b border-border pb-4">
      <button
        type="button"
        onClick={() => onOpenProfile(post.handle)}
        className="flex w-full items-center gap-3 py-2.5 text-left"
      >
        <GramAvatar initials={post.avatar_initials} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{post.name}</span>
          <span className="block truncate text-xs text-muted-foreground">@{post.handle}</span>
        </span>
        {post.kind === "look" && (
          <span className="ml-auto rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-accent">
            Look
          </span>
        )}
      </button>

      {post.image ? (
        isVideo ? (
          <video
            src={`/api/gram/media/${post.image}`}
            controls
            playsInline
            preload="metadata"
            className="aspect-[4/5] w-full rounded-sm bg-card object-cover"
          />
        ) : (
          <img
            src={`/api/gram/media/${post.image}`}
            alt=""
            onDoubleClick={() => !liked && void toggleLike()}
            className="aspect-[4/5] w-full rounded-sm bg-card object-cover"
          />
        )
      ) : (
        <div className="grid aspect-[4/5] place-items-center rounded-sm bg-card text-xs text-muted-foreground">
          No photo
        </div>
      )}

      <div className="flex items-center gap-4 pt-3">
        <button type="button" onClick={() => void toggleLike()} aria-label="Like" className="transition hover:opacity-70">
          <Heart className={`h-6 w-6 ${liked ? "fill-mandarine text-mandarine" : ""}`} />
        </button>
        <button type="button" onClick={() => void loadComments()} aria-label="Comments" className="transition hover:opacity-70">
          <MessageCircle className="h-6 w-6" />
        </button>
        <button type="button" aria-label="Share" className="transition hover:opacity-70">
          <Send className="h-6 w-6" />
        </button>
        <button type="button" onClick={() => void toggleSave()} aria-label="Save" className="ml-auto transition hover:opacity-70">
          <Bookmark className={`h-6 w-6 ${saved ? "fill-crest text-crest" : ""}`} />
        </button>
      </div>

      {likeCount > 0 && <p className="pt-2 text-sm font-semibold">{likeCount} likes</p>}
      <p className="pt-1 text-sm">
        <button type="button" onClick={() => onOpenProfile(post.handle)} className="font-semibold">
          {post.name}
        </button>{" "}
        {caption}
      </p>
      {commentCount > 0 && (
        <button type="button" onClick={() => void loadComments()} className="pt-1 text-sm text-muted-foreground">
          View all {commentCount} comments
        </button>
      )}

      {showComments && (
        <div className="space-y-2 pt-2">
          {comments === null && <p className="text-xs text-muted-foreground">Loading…</p>}
          {comments?.map((comment) => (
            <p key={comment.id} className="text-sm">
              <span className="font-semibold">{comment.name}</span> {comment.body}
            </p>
          ))}
          <div className="flex gap-2">
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && void sendComment()}
              placeholder="Add a comment…"
              className="h-9"
            />
            <Button type="button" variant="mandarine" size="sm" onClick={() => void sendComment()}>
              Post
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}
