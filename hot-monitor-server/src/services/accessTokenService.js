import crypto from "node:crypto";
import { env } from "../config/env.js";

const TOKEN_HEADER = { alg: "HS256", typ: "JWT" };

function encode(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function sign(input) {
  return crypto.createHmac("sha256", env.authTokenSecret).update(input).digest("base64url");
}

function safeEqual(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function createAccessToken(user) {
  const iat = Math.floor(Date.now() / 1000);
  const payload = {
    sub: String(user.id),
    email: user.email,
    iat,
    exp: iat + env.authTokenTtlSeconds
  };
  const encodedHeader = encode(TOKEN_HEADER);
  const encodedPayload = encode(payload);
  const unsigned = `${encodedHeader}.${encodedPayload}`;
  return `${unsigned}.${sign(unsigned)}`;
}

export function verifyAccessToken(token) {
  if (typeof token !== "string" || token.length > 4096) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return null;

  const unsigned = `${parts[0]}.${parts[1]}`;
  if (!safeEqual(sign(unsigned), parts[2])) return null;

  try {
    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    const now = Math.floor(Date.now() / 1000);
    if (header?.alg !== "HS256" || header?.typ !== "JWT") return null;
    if (!payload?.sub || !Number.isInteger(payload.exp) || payload.exp <= now) return null;
    return payload;
  } catch {
    return null;
  }
}

export function readBearerToken(authorization) {
  if (typeof authorization !== "string") return null;
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

