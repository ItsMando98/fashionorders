"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ProfileScreen } from "@/components/gram/profile-screen";
import type { ProfilePayload } from "@/components/gram/types";

export default function UserPage() {
  const params = useParams<{ handle: string }>();
  const handle = params.handle;
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [locked, setLocked] = useState(false);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/gram/profile/${handle}`, { credentials: "include" });
    if (res.status === 401) {
      setLocked(true);
      return;
    }
    const data = await res.json();
    if (!res.ok) {
      setMissing(true);
      return;
    }
    setProfile(data);
  }, [handle]);

  useEffect(() => {
    void load();
  }, [load]);

  if (locked) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
        <p className="font-display text-4xl font-bold italic">FASHION SUPPLY</p>
        <p className="mt-3 max-w-md text-sm text-muted-foreground">
          This network is only for signed-in users. Sign in, then open the page again.
        </p>
        <a href="/" className="mt-6 rounded-md bg-mandarine px-4 py-2 text-sm font-bold text-mandarine-foreground">
          Sign in
        </a>
      </main>
    );
  }

  if (missing || !profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        {missing ? "No user with that page." : "Loading…"}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto min-h-screen w-full max-w-3xl px-4 py-6">
        <a href="/?view=gram" className="mb-4 inline-block font-display text-2xl font-bold italic">
          FashionGram
        </a>
        <ProfileScreen
          profile={profile}
          onOpenProfile={(next) => {
            if (next !== handle) window.location.href = `/u/${next}`;
          }}
          onProfileChanged={() => void load()}
        />
      </div>
    </main>
  );
}
