"use client";

import React from "react";

const SIZES = {
  xs: "h-7 w-7 text-[9px]",
  sm: "h-9 w-9 text-[11px]",
  md: "h-11 w-11 text-xs",
  lg: "h-20 w-20 text-xl",
} as const;

export function GramAvatar({
  initials,
  size = "sm",
  ring = false,
}: {
  initials: string;
  size?: keyof typeof SIZES;
  ring?: boolean;
}) {
  const avatar = (
    <span
      className={`grid shrink-0 place-items-center rounded-full bg-mandarine font-bold text-mandarine-foreground ${SIZES[size]}`}
    >
      {initials}
    </span>
  );
  if (!ring) return avatar;
  return (
    <span className="gram-story-ring inline-flex rounded-full p-[2.5px]">
      <span className="inline-flex rounded-full bg-background p-[2px]">{avatar}</span>
    </span>
  );
}
