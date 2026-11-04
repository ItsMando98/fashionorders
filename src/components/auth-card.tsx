"use client";

import React, { useEffect, useState } from "react";
import { UserPlus, LogIn, ArrowRight, Mail } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { User } from "@/lib/types";

interface AuthCardProps {
  onAuthenticated: (user: User) => void;
}

type Step = "details" | "code";

const heroSlides = [
  { src: "/brand/slides/loud.jpg", mobileSrc: "/brand/slides/loud_p.jpg", name: "Loud Luxury" },
  { src: "/brand/slides/stairs.jpg", mobileSrc: "/brand/slides/stairs_p.jpg", name: "The Lineup" },
  { src: "/brand/slides/duo.jpg", mobileSrc: "/brand/slides/duo_p.jpg", name: "Two Worlds" },
];

export function AuthCard({ onAuthenticated }: AuthCardProps) {
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      setSlide((current) => (current + 1) % heroSlides.length);
    }, 5200);
    return () => window.clearInterval(timer);
  }, []);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [loginStep, setLoginStep] = useState<Step>("details");
  const [passwordMode, setPasswordMode] = useState(false);
  const [loginName, setLoginName] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupCode, setSignupCode] = useState("");
  const [signupStep, setSignupStep] = useState<Step>("details");

  const [setupUser, setSetupUser] = useState<User | null>(null);
  const [setupStep, setSetupStep] = useState<Step>("details");
  const [setupEmail, setSetupEmail] = useState("");
  const [setupCode, setSetupCode] = useState("");
  const [setupPassword, setSetupPassword] = useState("");
  const [setupPassword2, setSetupPassword2] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendCode(purpose: "login" | "signup") {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/email/send", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose,
          email: purpose === "login" ? loginEmail : signupEmail,
          name: purpose === "signup" ? signupName : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Could not send the email");
        return;
      }
      if (purpose === "login") setLoginStep("code");
      else setSignupStep("code");
    } catch {
      setError("Could not connect to server");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(purpose: "login" | "signup") {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/email/verify", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose,
          email: purpose === "login" ? loginEmail : signupEmail,
          code: purpose === "login" ? loginCode : signupCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Code was not accepted");
        return;
      }
      onAuthenticated(data.user);
    } catch {
      setError("Could not connect to server");
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: loginName, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Login failed");
        return;
      }
      if (data.user?.must_setup === 1) {
        setSetupUser(data.user);
        setError(null);
        return;
      }
      onAuthenticated(data.user);
    } catch {
      setError("Could not connect to server");
    } finally {
      setLoading(false);
    }
  }

  async function setupSendCode() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/setup/email", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: setupEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Could not send the email");
        return;
      }
      setSetupStep("code");
    } catch {
      setError("Could not connect to server");
    } finally {
      setLoading(false);
    }
  }

  async function setupFinish() {
    setError(null);
    if (setupPassword !== setupPassword2) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/setup/complete", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: setupEmail,
          code: setupCode,
          new_password: setupPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Setup failed");
        return;
      }
      onAuthenticated(data.user);
    } catch {
      setError("Could not connect to server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#07080c] text-white">
      <section className="absolute inset-0 overflow-hidden">
        {heroSlides.map((item, index) => (
          <picture key={item.src}>
            <source media="(max-width: 640px)" srcSet={item.mobileSrc} />
            <img
              src={item.src}
              alt=""
              className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-1000 ease-in-out will-change-opacity ${
                index === slide ? "opacity-100" : "opacity-0"
              }`}
            />
          </picture>
        ))}
        <div className="absolute inset-0 bg-black/35" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/45 to-transparent" />
        <div className="absolute left-3 top-[max(0.75rem,env(safe-area-inset-top))] flex items-center gap-2.5 rounded-md bg-black/55 px-2.5 py-1.5 backdrop-blur-sm sm:left-5 sm:top-5 sm:gap-3 sm:px-3 sm:py-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-black sm:h-10 sm:w-10">
            <img src="/brand/mark-fit.png" alt="" className="h-full w-full object-contain" />
          </span>
          <div>
            <div className="font-display text-xl font-bold italic leading-none tracking-wide sm:text-3xl">FASHION SUPPLY</div>
            <p className="mt-1 text-[9px] font-semibold tracking-[0.18em] text-white/70 sm:text-[10px] sm:tracking-[0.28em]">FAST FASHION FOR YOUR NEXT LOOK</p>
          </div>
        </div>
        <div className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 flex items-center gap-3 sm:bottom-5 sm:left-5">
          <div className="flex gap-2">
            {heroSlides.map((item, index) => (
              <button
                key={item.src}
                type="button"
                aria-label={item.name}
                onClick={() => setSlide(index)}
                className={`h-1.5 rounded-full transition-all ${index === slide ? "w-8 bg-[#FF4D00]" : "w-3 bg-white/70"}`}
              />
            ))}
          </div>
          <p className="text-[11px] font-semibold tracking-[0.22em] text-white">{heroSlides[slide].name}</p>
        </div>
      </section>

      <section className="relative z-10 flex min-h-dvh items-center justify-center px-4 py-6 sm:py-10">
      {setupUser ? (
      <Card className="w-full max-w-md border-white/15 bg-[#12141c]/80 text-white shadow-2xl backdrop-blur-xl">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-xl font-bold tracking-tight text-white">Secure your account</CardTitle>
          <CardDescription className="text-white/60">
            Welcome, {setupUser.name}! One-time setup: verify your email, then choose your own password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {setupStep === "details" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void setupSendCode();
              }}
              className="space-y-3.5"
            >
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-white/80">Your Email</label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={setupEmail}
                  onChange={(e) => setSetupEmail(e.target.value)}
                  className="focus-visible:ring-mandarine-500 border-white/15"
                  required
                />
              </div>
              <p className="text-xs text-white/50">
                We email you a 6-digit code to verify this address is really yours.
              </p>
              {error && <ErrorBox message={error} />}
              <Button type="submit" variant="mandarine" className="w-full h-11" disabled={loading}>
                <Mail className="mr-1.5 h-4 w-4" />
                {loading ? "Sending..." : "Send verification code"}
              </Button>
            </form>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void setupFinish();
              }}
              className="space-y-3.5"
            >
              <p className="text-xs text-white/70">
                Enter the 6-digit code sent to <span className="font-semibold">{setupEmail}</span>.
              </p>
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                value={setupCode}
                onChange={(e) => setSetupCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="focus-visible:ring-mandarine-500 border-white/15 text-center font-mono text-lg tracking-[0.3em]"
                required
              />
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-white/80">New Password</label>
                <Input
                  type="password"
                  placeholder="At least 8 characters"
                  value={setupPassword}
                  onChange={(e) => setSetupPassword(e.target.value)}
                  className="focus-visible:ring-mandarine-500 border-white/15"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-white/80">Repeat Password</label>
                <Input
                  type="password"
                  placeholder="Same password again"
                  value={setupPassword2}
                  onChange={(e) => setSetupPassword2(e.target.value)}
                  className="focus-visible:ring-mandarine-500 border-white/15"
                  required
                />
              </div>
              {error && <ErrorBox message={error} />}
              <Button
                type="submit"
                variant="mandarine"
                className="w-full"
                disabled={loading || setupCode.length !== 6 || setupPassword.length < 8}
              >
                {loading ? "Saving..." : "Verify email & set password"}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
              <button
                type="button"
                className="w-full text-xs font-medium text-white/60 underline decoration-white/30"
                onClick={() => {
                  setSetupStep("details");
                  setSetupCode("");
                  setError(null);
                }}
              >
                Use a different email
              </button>
            </form>
          )}
        </CardContent>
      </Card>
      ) : (
      <Card className="w-full max-w-md border-white/15 bg-[#12141c]/80 text-white shadow-2xl backdrop-blur-xl">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-xl font-bold tracking-tight text-white">Account Access</CardTitle>
          <CardDescription className="text-white/60">
            We email you a 6-digit code. No password is stored for new accounts.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="login" className="w-full" onValueChange={() => setError(null)}>
            <TabsList className="grid w-full grid-cols-2 mb-4 bg-white/10">
              <TabsTrigger value="login" className="data-[state=active]:bg-[#FF4D00] data-[state=active]:text-white font-semibold text-white/70">
                <LogIn className="mr-1.5 h-3.5 w-3.5" />
                Sign In
              </TabsTrigger>
              <TabsTrigger value="signup" className="data-[state=active]:bg-[#FF4D00] data-[state=active]:text-white font-semibold text-white/70">
                <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                Sign Up
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              {passwordMode ? (
                <form onSubmit={handlePasswordLogin} className="space-y-3.5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-white/80">Username</label>
                    <Input
                      placeholder="Your username"
                      value={loginName}
                      onChange={(e) => setLoginName(e.target.value)}
                      className="focus-visible:ring-mandarine-500 border-white/15"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-white/80">Password</label>
                    <Input
                      type="password"
                      placeholder="••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="focus-visible:ring-mandarine-500 border-white/15"
                      required
                    />
                  </div>
                  {error && <ErrorBox message={error} />}
                  <Button type="submit" variant="mandarine" className="w-full h-11" disabled={loading}>
                    {loading ? "Signing in..." : "Sign In to Haul"}
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                  <button
                    type="button"
                    className="w-full text-xs font-medium text-white/60 underline decoration-white/30"
                    onClick={() => {
                      setPasswordMode(false);
                      setError(null);
                    }}
                  >
                    Use email code instead
                  </button>
                </form>
              ) : loginStep === "details" ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void sendCode("login");
                  }}
                  className="space-y-3.5"
                >
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-white/80">Email</label>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="focus-visible:ring-mandarine-500 border-white/15"
                      required
                    />
                  </div>
                  {error && <ErrorBox message={error} />}
                  <Button type="submit" variant="mandarine" className="w-full h-11" disabled={loading}>
                    <Mail className="mr-1.5 h-4 w-4" />
                    {loading ? "Sending..." : "Email me a code"}
                  </Button>
                  <button
                    type="button"
                    className="w-full text-xs font-medium text-white/60 underline decoration-white/30"
                    onClick={() => {
                      setPasswordMode(true);
                      setError(null);
                    }}
                  >
                    Sign in with username and password
                  </button>
                </form>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void verifyCode("login");
                  }}
                  className="space-y-3.5"
                >
                  <p className="text-xs text-white/70">
                    Enter the 6-digit code sent to <span className="font-semibold">{loginEmail}</span>.
                  </p>
                  <Input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    value={loginCode}
                    onChange={(e) => setLoginCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="focus-visible:ring-mandarine-500 border-white/15 text-center font-mono text-lg tracking-[0.3em]"
                    required
                  />
                  {error && <ErrorBox message={error} />}
                  <Button type="submit" variant="mandarine" className="w-full h-11" disabled={loading || loginCode.length !== 6}>
                    {loading ? "Checking..." : "Sign In to Haul"}
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                  <button
                    type="button"
                    className="w-full text-xs font-medium text-white/60 underline decoration-white/30"
                    onClick={() => {
                      setLoginStep("details");
                      setLoginCode("");
                      setError(null);
                    }}
                  >
                    Use a different email
                  </button>
                </form>
              )}
            </TabsContent>

            <TabsContent value="signup">
              {signupStep === "details" ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void sendCode("signup");
                  }}
                  className="space-y-3.5"
                >
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/80">Your Name</label>
                    <Input
                      placeholder="e.g. Leon, Max, Anna"
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/80">Email</label>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      required
                    />
                  </div>
                  {error && <ErrorBox message={error} />}
                  <Button type="submit" variant="mandarine" className="w-full h-11" disabled={loading}>
                    <Mail className="mr-1.5 h-4 w-4" />
                    {loading ? "Sending..." : "Email me a code"}
                  </Button>
                </form>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void verifyCode("signup");
                  }}
                  className="space-y-3.5"
                >
                  <p className="text-xs text-white/70">
                    Enter the 6-digit code sent to <span className="font-semibold">{signupEmail}</span>.
                  </p>
                  <Input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    value={signupCode}
                    onChange={(e) => setSignupCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="text-center font-mono text-lg tracking-[0.3em]"
                    required
                  />
                  {error && <ErrorBox message={error} />}
                  <Button type="submit" variant="mandarine" className="w-full h-11" disabled={loading || signupCode.length !== 6}>
                    <UserPlus className="mr-1.5 h-4 w-4" />
                    {loading ? "Creating Account..." : "Create account"}
                  </Button>
                  <button
                    type="button"
                    className="w-full text-xs font-medium text-white/60 underline decoration-white/30"
                    onClick={() => {
                      setSignupStep("details");
                      setSignupCode("");
                      setError(null);
                    }}
                  >
                    Change name or email
                  </button>
                </form>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      )}
      </section>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
      {message}
    </div>
  );
}
