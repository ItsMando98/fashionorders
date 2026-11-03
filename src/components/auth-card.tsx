"use client";

import React, { useState } from "react";
import { ShoppingBag, ShieldCheck, UserPlus, LogIn, ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User } from "@/lib/types";

interface AuthCardProps {
  onAuthenticated: (token: string, user: User) => void;
}

export function AuthCard({ onAuthenticated }: AuthCardProps) {
  const [loginName, setLoginName] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    await performLogin(loginName, loginPassword);
  }

  async function performLogin(name: string, password: string) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Login failed");
        return;
      }
      onAuthenticated(data.token, data.user);
    } catch {
      setError("Could not connect to server");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: signupName, password: signupPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Sign up failed");
        return;
      }
      onAuthenticated(data.token, data.user);
    } catch {
      setError("Could not connect to server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-forest-50/60 via-background to-background px-4 py-12">
      <div className="mb-6 flex items-center gap-2.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-mandarine-500 text-white shadow-md shadow-mandarine-500/25 ring-2 ring-crest-400/50">
          <ShoppingBag className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-extrabold tracking-tight text-forest-950">FashionOrders</span>
            <span className="rounded-full bg-crest-100 border border-crest-300 px-2 py-0.5 font-mono text-[10px] font-bold text-crest-900">
              NEXT.JS + SHADCN
            </span>
          </div>
          <p className="text-xs font-medium text-forest-700/70">Curated Fashion Hauls &bull; Yupoo &bull; Weidian &bull; Taobao</p>
        </div>
      </div>

      <Card className="w-full max-w-md border-forest-200/80 shadow-lg shadow-forest-950/5 bg-white">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-xl font-bold tracking-tight text-forest-950">Account Access</CardTitle>
          <CardDescription className="text-forest-800/60">
            Sign in to your personal member dashboard or create a new friend account.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="login" className="w-full" onValueChange={() => setError(null)}>
            <TabsList className="grid w-full grid-cols-2 mb-4 bg-forest-100/60">
              <TabsTrigger value="login" className="data-[state=active]:bg-white data-[state=active]:text-forest-950 font-semibold">
                <LogIn className="mr-1.5 h-3.5 w-3.5" />
                Sign In
              </TabsTrigger>
              <TabsTrigger value="signup" className="data-[state=active]:bg-white data-[state=active]:text-forest-950 font-semibold">
                <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                Sign Up
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-forest-900">Username</label>
                  <Input
                    placeholder="e.g. Tom Luis, Fynn, Mathis"
                    value={loginName}
                    onChange={(e) => setLoginName(e.target.value)}
                    className="focus-visible:ring-mandarine-500 border-forest-200"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-forest-900">Password / PIN</label>
                  <Input
                    type="password"
                    placeholder="••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="focus-visible:ring-mandarine-500 border-forest-200"
                    required
                  />
                </div>
                {error && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                    {error}
                  </div>
                )}
                <Button type="submit" variant="mandarine" className="w-full" disabled={loading}>
                  {loading ? "Signing in..." : "Sign In to Haul"}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-700">Your Name / Username</label>
                  <Input
                    placeholder="e.g. Leon, Max, Anna"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-700">Create Password / PIN</label>
                  <Input
                    type="password"
                    placeholder="At least 3 characters"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    required
                  />
                </div>
                {error && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                    {error}
                  </div>
                )}
                <Button type="submit" variant="forest" className="w-full" disabled={loading}>
                  {loading ? "Creating Account..." : "Create Friend Account"}
                  <UserPlus className="ml-1.5 h-4 w-4" />
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {/* Pre-seeded 1-click quick login accounts */}
          <div className="mt-6 pt-5 border-t border-forest-100">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-forest-700">
                1-Click Demo Login (Pre-Seeded)
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => performLogin("Tom Luis", "1234")}
                className="flex items-center justify-between rounded-lg border border-forest-200/80 bg-forest-50/40 px-3 py-2 text-left transition hover:bg-forest-100/60"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-forest-800 font-mono text-xs font-bold text-white">
                    TL
                  </span>
                  <div>
                    <div className="text-xs font-bold text-forest-950">Tom Luis</div>
                    <div className="text-[11px] text-forest-700/80">Member View &middot; 13 Yupoo Items (PIN: 1234)</div>
                  </div>
                </div>
                <Badge variant="forest-soft">Member</Badge>
              </button>

              <button
                type="button"
                onClick={() => performLogin("Fynn", "1234")}
                className="flex items-center justify-between rounded-lg border border-forest-200/80 bg-forest-50/40 px-3 py-2 text-left transition hover:bg-forest-100/60"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-forest-800 font-mono text-xs font-bold text-white">
                    FY
                  </span>
                  <div>
                    <div className="text-xs font-bold text-forest-950">Fynn</div>
                    <div className="text-[11px] text-forest-700/80">Member View &middot; 27 Yupoo Items (PIN: 1234)</div>
                  </div>
                </div>
                <Badge variant="forest-soft">Member</Badge>
              </button>

              <button
                type="button"
                onClick={() => performLogin("Mathis", "admin123")}
                className="flex items-center justify-between rounded-lg border border-mandarine-500/30 bg-mandarine-50/40 px-3 py-2 text-left transition hover:bg-mandarine-100/60 shadow-xs"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-mandarine-500 font-mono text-xs font-bold text-white shadow-xs">
                    MA
                  </span>
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-mandarine-950">
                      <span>Mathis</span>
                      <ShieldCheck className="h-3.5 w-3.5 text-mandarine-600" />
                    </div>
                    <div className="text-[11px] text-mandarine-800/80">Separated Admin Backend + Personal View (PW: admin123)</div>
                  </div>
                </div>
                <Badge variant="crest-solid">Admin Backend</Badge>
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
