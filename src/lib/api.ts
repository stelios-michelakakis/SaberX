import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function created<T>(data: T) {
  return NextResponse.json(data, { status: 201 });
}

export function fail(message: string, status = 400, detail?: unknown) {
  return NextResponse.json({ error: message, detail }, { status });
}

export function mapError(error: unknown) {
  if (error instanceof ZodError) {
    console.error("[api] validation failed", JSON.stringify(error.flatten()));
    return fail("Validation failed", 422, error.flatten());
  }
  if (error instanceof Error) {
    const status = error.message === "Unauthorized" ? 401 : error.message === "Forbidden" ? 403 : 400;
    if (status >= 500 || (status === 400 && error.message !== "Unauthorized" && error.message !== "Forbidden")) {
      console.error("[api]", error.message, error.stack);
    }
    return fail(error.message, status);
  }
  console.error("[api] non-Error thrown", error);
  return fail("Unexpected server error", 500);
}
