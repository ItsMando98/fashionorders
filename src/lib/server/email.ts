import crypto from "crypto";
import { Resend } from "resend";
import { PublicError } from "./http";

const CODE_MINUTES = 10;

export function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  if (email.length < 6 || email.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function initialsFromName(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
  return "??";
}

export function createLoginCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export function codeExpiresAt(from = Date.now()): string {
  return new Date(from + CODE_MINUTES * 60 * 1000).toISOString();
}

export async function sendLoginCodeEmail(email: string, code: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new PublicError(
      "Email login is not configured yet. Add RESEND_API_KEY and restart the app.",
      503
    );
  }

  const resend = new Resend(apiKey);
  const from = process.env.RESEND_FROM || "Fashion Supply <onboarding@resend.dev>";
  const { error } = await resend.emails.send({
    from,
    to: email,
    subject: "Your Fashion Supply login code",
    text: `Your Fashion Supply login code is ${code}. It expires in ${CODE_MINUTES} minutes.`,
    html: `
      <div style="font-family: sans-serif; color: #14281c; line-height: 1.5;">
        <p>Use this code to sign in to Fashion Supply:</p>
        <p style="font-size: 32px; letter-spacing: 6px; font-weight: 700;">${code}</p>
        <p>The code expires in ${CODE_MINUTES} minutes. If you did not ask for it, you can ignore this email.</p>
      </div>
    `,
  });

  if (error) {
    console.error("resend", error);
    throw new PublicError("The login email could not be sent. Check the Resend settings.", 502);
  }
}

export async function sendInviteEmail(email: string, fromName: string, joinUrl: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new PublicError(
      "Invites by email are not configured yet. Add RESEND_API_KEY and restart the app.",
      503
    );
  }

  const resend = new Resend(apiKey);
  const from = process.env.RESEND_FROM || "Fashion Supply <onboarding@resend.dev>";
  const safeName = fromName.replace(/[<>]/g, "");
  const { error } = await resend.emails.send({
    from,
    to: email,
    subject: `${safeName} invited you to Fashion Supply`,
    text: `${safeName} invited you to the Fashion Supply network. Create an account here: ${joinUrl}`,
    html: `
      <div style="font-family: sans-serif; color: #f4f4f5; background: #07080c; padding: 24px;">
        <p style="color: #ff4d00; font-weight: 700; letter-spacing: 0.08em;">FASHION SUPPLY</p>
        <p>${safeName} invited you into the network.</p>
        <p>Only signed-in users can see pages and posts.</p>
        <p><a href="${joinUrl}" style="color: #ff4d00;">Create your account</a></p>
      </div>
    `,
  });

  if (error) {
    console.error("resend invite", error);
    throw new PublicError("The invite email could not be sent. Check the Resend settings.", 502);
  }
}
