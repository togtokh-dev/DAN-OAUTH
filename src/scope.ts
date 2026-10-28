import { randomBytes, timingSafeEqual } from "node:crypto";
import type { ServiceGroup } from "./types.js";

/** `base64(JSON(serviceStructure))`, the format DAN expects in the `scope` parameter. */
export function encodeScope(groups: ServiceGroup[]): string {
  return Buffer.from(JSON.stringify(groups), "utf8").toString("base64");
}

export function decodeScope(scope: string): ServiceGroup[] {
  return JSON.parse(Buffer.from(scope, "base64").toString("utf8")) as ServiceGroup[];
}

/** Cryptographically random, hex encoded CSRF state (64 chars by default). */
export function generateState(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

/** Constant-time comparison of the stored state against the one returned by DAN. */
export function verifyState(expected: string | null | undefined, received: string | null | undefined): boolean {
  if (!expected || !received) return false;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
