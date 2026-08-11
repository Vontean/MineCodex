import { randomBytes } from "node:crypto";

export const BROWSER_EXCHANGE_TTL_MS = 30_000;

export class BrowserExchangeStore {
  constructor({ ttlMs = BROWSER_EXCHANGE_TTL_MS, now = () => Date.now(), createValue = () => randomBytes(32).toString("base64url") } = {}) {
    this.ttlMs = ttlMs;
    this.now = now;
    this.createValue = createValue;
    this.values = new Map();
  }

  issue(controlToken) {
    const now = this.now();
    for (const [value, entry] of this.values) {
      if (entry.expiresAt <= now) this.values.delete(value);
    }
    const value = this.createValue();
    this.values.set(value, { controlToken, expiresAt: now + this.ttlMs });
    return value;
  }

  consume(value) {
    const entry = this.values.get(value);
    this.values.delete(value);
    if (!entry || entry.expiresAt <= this.now()) {
      throw Object.assign(new Error("Browser exchange is invalid or expired."), { code: "INVALID_EXCHANGE" });
    }
    return entry.controlToken;
  }
}
