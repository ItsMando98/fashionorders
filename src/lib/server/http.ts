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
