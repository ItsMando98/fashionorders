"use client";

import React, { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { GramAvatar } from "./avatar";
import type { StoryGroup } from "./types";

const IMAGE_MS = 5000;

export function StoryViewer({
  groups,
  startGroup,
  onClose,
}: {
  groups: StoryGroup[];
  startGroup: number;
  onClose: () => void;
}) {
  const [groupIndex, setGroupIndex] = useState(startGroup);
  const [storyIndex, setStoryIndex] = useState(0);
  const group = groups[groupIndex];
  const story = group?.stories[storyIndex];

  const advance = useCallback(() => {
    if (!group) return;
    if (storyIndex + 1 < group.stories.length) {
      setStoryIndex(storyIndex + 1);
    } else if (groupIndex + 1 < groups.length) {
      setGroupIndex(groupIndex + 1);
      setStoryIndex(0);
    } else {
      onClose();
    }
  }, [group, storyIndex, groupIndex, groups.length, onClose]);

  useEffect(() => {
    if (!story) return;
    if (story.media_kind === "video") return; // videos advance on ended
    const timer = setTimeout(advance, IMAGE_MS);
    return () => clearTimeout(timer);
  }, [story, advance]);

  if (!group || !story) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={onClose}>
      <div
        className="relative flex h-full max-h-[760px] w-full max-w-[420px] flex-col overflow-hidden rounded-lg bg-card"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="absolute left-2 right-2 top-2 z-10 flex gap-1">
          {group.stories.map((entry, index) => (
            <div key={entry.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/25">
              <div
                className={`h-full bg-mandarine ${
                  index < storyIndex ? "w-full" : index === storyIndex ? "w-full animate-pulse" : "w-0"
                }`}
              />
            </div>
          ))}
        </div>

        <div className="absolute left-0 right-0 top-4 z-10 flex items-center gap-2 px-3">
          <GramAvatar initials={group.avatar_initials} size="xs" />
          <span className="text-sm font-semibold">{group.name}</span>
          <span className="text-xs text-muted-foreground">@{group.handle}</span>
          <button type="button" onClick={onClose} className="ml-auto rounded-full p-1 hover:bg-white/10" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <button type="button" className="min-h-0 flex-1" onClick={advance}>
          {story.media_kind === "video" ? (
            <video
              key={story.id}
              src={`/api/gram/media/${story.media}`}
              autoPlay
              playsInline
              onEnded={advance}
              className="h-full w-full object-contain"
            />
          ) : (
            <img
              key={story.id}
              src={`/api/gram/media/${story.media}`}
              alt=""
              className="h-full w-full object-contain"
            />
          )}
        </button>

        {story.caption && (
          <p className="absolute bottom-4 left-0 right-0 px-4 text-center text-sm text-white drop-shadow">
            {story.caption}
          </p>
        )}
      </div>
    </div>
  );
}
