"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { GramAvatar } from "./avatar";
import type { ChatMessage, Person, Thread } from "./types";

export function MessagesScreen({ meId }: { meId: number }) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Person[]>([]);
  const [partner, setPartner] = useState<Person | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  const loadThreads = useCallback(async () => {
    const res = await fetch("/api/gram/messages", { credentials: "include" });
    const data = await res.json();
    setThreads(data.threads || []);
  }, []);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  async function openChat(person: Person) {
    setPartner(person);
    setError("");
    const res = await fetch(`/api/gram/messages?with=${person.id}`, { credentials: "include" });
    const data = await res.json();
    setChat(data.messages || []);
    await loadThreads();
  }

  async function search(value: string) {
    setQuery(value);
    if (value.trim().length < 1) {
      setFound([]);
      return;
    }
    const res = await fetch(`/api/gram/users?q=${encodeURIComponent(value)}`, { credentials: "include" });
    const data = await res.json();
    setFound(data.users || []);
  }

  async function send() {
    if (!partner || !draft.trim()) return;
    const res = await fetch("/api/gram/messages", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to_user_id: partner.id, body: draft }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.detail || "Message not sent");
    else {
      setDraft("");
      await openChat(partner);
    }
  }

  const threadList = (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-3">
        <Input value={query} onChange={(event) => void search(event.target.value)} placeholder="Search users" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {found.map((person) => (
          <button
            key={person.id}
            type="button"
            onClick={() => {
              setFound([]);
              setQuery("");
              void openChat(person);
            }}
            className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-secondary"
          >
            <GramAvatar initials={person.avatar_initials} />
            <span>
              <span className="block text-sm font-semibold">{person.name}</span>
              <span className="block text-xs text-muted-foreground">@{person.handle}</span>
            </span>
          </button>
        ))}
        {threads.map((thread) => (
          <button
            key={thread.partner_id}
            type="button"
            onClick={() =>
              void openChat({
                id: thread.partner_id,
                name: thread.name,
                handle: thread.handle,
                avatar_initials: thread.avatar_initials,
              })
            }
            className={`flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-secondary ${
              partner?.id === thread.partner_id ? "bg-secondary" : ""
            }`}
          >
            <GramAvatar initials={thread.avatar_initials} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{thread.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{thread.body}</span>
            </span>
          </button>
        ))}
        {threads.length === 0 && found.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">No conversations yet. Search a user to start one.</p>
        )}
      </div>
    </div>
  );

  const chatPane = partner ? (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <GramAvatar initials={partner.avatar_initials} />
        <div>
          <p className="text-sm font-semibold">{partner.name}</p>
          <p className="text-xs text-muted-foreground">@{partner.handle}</p>
        </div>
        <button
          type="button"
          onClick={() => setPartner(null)}
          className="ml-auto text-xs font-semibold text-accent md:hidden"
        >
          Back
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {chat.map((message) => {
          const mine = message.from_user_id === meId;
          return (
            <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <p
                className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                  mine ? "bg-mandarine text-mandarine-foreground" : "bg-secondary"
                }`}
              >
                {message.body}
              </p>
            </div>
          );
        })}
        {chat.length === 0 && (
          <p className="text-sm text-muted-foreground">Say hi to {partner.name}. Only the two of you can read this.</p>
        )}
      </div>
      <div className="flex gap-2 border-t border-border p-3">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && void send()}
          placeholder="Write a message"
        />
        <button
          type="button"
          onClick={() => void send()}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-mandarine text-mandarine-foreground"
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  ) : (
    <div className="hidden h-full place-items-center text-sm text-muted-foreground md:grid">
      Pick a conversation or search a user.
    </div>
  );

  return (
    <div className="mx-auto grid h-full w-full max-w-4xl grid-cols-1 overflow-hidden rounded-lg border border-border bg-card md:grid-cols-[280px_1fr]">
      <div className={`min-h-0 ${partner ? "hidden md:block" : ""} md:border-r md:border-border`}>{threadList}</div>
      <div className={`min-h-0 ${partner ? "" : "hidden md:block"}`}>{chatPane}</div>
    </div>
  );
}
