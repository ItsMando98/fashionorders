import { NextResponse } from "next/server";

export class PublicError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function errorResponse(scope: string, err: unknown) {
  if (err instanceof PublicError) {
    return NextResponse.json({ detail: err.message }, { status: err.status });
  }
  if (err && typeof err === "object" && "code" in err && ["23505","23503","23514"].includes(String(err.code))) return NextResponse.json({detail:"Datenkonflikt. Bitte neu laden und erneut prüfen."},{status:409});
  console.error(scope, err);
  return NextResponse.json(
    { detail: "Something went wrong. Please try again." },
    { status: 500 }
  );
}

export function tooManyAttempts(retryAfterSec: number) {
  return NextResponse.json(
    { detail: "Too many attempts. Please wait and try again." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    }
  );
}
