"use client";

// Backwards-compatible wrapper. The profile UI lives in
// src/components/gram/profile-screen.tsx and uses the enriched
// /api/gram/profile/[handle] payload (counts, follow state, reels, saved).
export { ProfileScreen as GramProfile } from "./gram/profile-screen";
export type { ProfilePayload } from "./gram/types";
