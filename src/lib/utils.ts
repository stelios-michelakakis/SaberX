import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 180);
}

export function visibleId(prefix: string, sequence: number, zeroPad = 2) {
  const safePrefix = prefix.trim().toUpperCase();
  const padded = String(sequence).padStart(zeroPad, "0");
  return `${safePrefix}-${padded}`;
}

export function jsonDiff(beforeValue: unknown, afterValue: unknown) {
  return {
    before: beforeValue ?? null,
    after: afterValue ?? null
  };
}

export function getClientMeta(headers: Headers) {
  return {
    ip: headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headers.get("x-real-ip") ?? null,
    userAgent: headers.get("user-agent") ?? null
  };
}

export function assertNoCompoundPrefix(prefix: string) {
  if (!/^[A-Z0-9]{1,20}$/i.test(prefix)) {
    throw new Error("ID prefix must be 1-20 alphanumeric characters without separators.");
  }
  if (prefix.includes("-")) {
    throw new Error("Multi-prefix IDs are not allowed.");
  }
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
