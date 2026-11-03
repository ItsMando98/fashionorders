"use client";

import React, { useState } from "react";
import { PostCard } from "./post-card";
import { StoriesBar } from "./stories-bar";
import { StoryViewer } from "./story-viewer";
import type { FeedPost, StoryGroup } from "./types";

export function FeedScreen({
  feed,
  stories,
  meInitials,
  onOpenProfile,
  onStoriesChanged,
  onError,
}: {
  feed: FeedPost[];
  stories: StoryGroup[];
  meInitials: string;
  onOpenProfile: (handle: string) => void;
  onStoriesChanged: () => void;
  onError: (message: string) => void;
}) {
  const [viewerStart, setViewerStart] = useState<number | null>(null);

  return (
    <div className="mx-auto w-full max-w-[470px] space-y-6">
      <StoriesBar
        groups={stories}
        meInitials={meInitials}
        onOpen={(index) => setViewerStart(index)}
        onUploaded={onStoriesChanged}
        onError={onError}
      />
      {feed.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No posts from other users yet. Your own posts live on your profile.
        </p>
      )}
      {feed.map((post) => (
        <PostCard key={`${post.kind}-${post.id}`} post={post} onOpenProfile={onOpenProfile} />
      ))}
      {viewerStart !== null && (
        <StoryViewer groups={stories} startGroup={viewerStart} onClose={() => setViewerStart(null)} />
      )}
    </div>
  );
}
