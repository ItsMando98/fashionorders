"use client";

import React, { useEffect, useState } from "react";
import { GramAvatar } from "./avatar";
import type { Notification } from "./types";

function label(notification: Notification): string {
  const target =
    notification.target_kind === "look" ? "look" : notification.target_kind === "reel" ? "reel" : "post";
  switch (notification.kind) {
    case "like":
      return `liked your ${target}.`;
    case "comment":
      return `commented on your ${target}.`;
    case "follow":
      return "started following you.";
    case "message":
      return "sent you a message.";
    default:
      return "interacted with you.";
  }
}

export function ActivityScreen({
  onOpenProfile,
  onRead,
}: {
  onOpenProfile: (handle: string) => void;
  onRead: () => void;
}) {
  const [items, setItems] = useState<Notification[] | null>(null);

  useEffect(() => {
    void fetch("/api/gram/notifications", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setItems(data.notifications || []));
    void fetch("/api/gram/notifications", { method: "POST", credentials: "include" }).then(() => onRead());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto w-full max-w-[470px]">
      <h2 className="mb-4 font-display text-2xl font-bold italic">Activity</h2>
      {items === null && <p className="text-sm text-muted-foreground">Loading…</p>}
      {items?.length === 0 && (
        <p className="text-sm text-muted-foreground">No activity yet. Likes, comments and follows show up here.</p>
      )}
      <div className="divide-y divide-border rounded-md border border-border bg-card">
        {items?.map((notification) => (
          <button
            key={notification.id}
            type="button"
            onClick={() => onOpenProfile(notification.handle)}
            className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-secondary"
          >
            <GramAvatar initials={notification.avatar_initials} />
            <p className="min-w-0 flex-1 text-sm">
              <span className="font-semibold">{notification.name}</span>{" "}
              <span className="text-muted-foreground">@{notification.handle}</span> {label(notification)}
            </p>
            {!notification.read_at && <span className="h-2 w-2 shrink-0 rounded-full bg-mandarine" />}
          </button>
        ))}
      </div>
    </div>
  );
}
