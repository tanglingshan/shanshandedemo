import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { ApiError, validationError } from "../utils/errors.js";

export function toUserSummary(user) {
  if (!user) return null;
  return {
    id: user.id,
    // Keep email for API compatibility; it is now also the account identifier.
    email: user.email,
    account: user.email,
    displayName: user.displayName,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt
  };
}

function normalizeAccount(value) {
  const account = String(value ?? "").trim().toLowerCase();
  if (!account || account.length > 254 || /[\u0000-\u001f\u007f\s]/u.test(account)) {
    throw validationError("Invalid account");
  }
  return account;
}

function isSha256Credential(value) {
  return /^[a-f0-9]{64}$/i.test(value);
}

function resolveCredential(input = {}) {
  const digest = input.passwordDigest ?? input.credential;
  if (digest !== undefined && digest !== null && digest !== "") {
    const normalizedDigest = String(digest);
    if (!isSha256Credential(normalizedDigest)) {
      throw validationError("password digest has an invalid format");
    }
    return normalizedDigest;
  }
  return input.password;
}

function resolveAccount(input = {}) {
  return input.account ?? input.username ?? input.email;
}

function validateAccountAndPassword(accountValue, password) {
  const account = normalizeAccount(accountValue);
  if (password === undefined || password === null || String(password).length === 0) {
    throw validationError("Password is required");
  }
  return { account, password: String(password) };
}

export async function register(input = {}) {
  const { account, password } = validateAccountAndPassword(resolveAccount(input), resolveCredential(input));
  // Keep registration permissive while bounding abuse and accidental payloads.
  if (password.length > 256) throw validationError("Password is too long");

  const confirmPassword = input.confirmPasswordDigest ?? input.confirmPassword;
  if (confirmPassword === undefined || confirmPassword === null || String(confirmPassword).length === 0) {
    throw validationError("Password confirmation is required");
  }
  if (input.confirmPasswordDigest !== undefined && !isSha256Credential(String(confirmPassword))) {
    throw validationError("password digest has an invalid format");
  }
  if (String(confirmPassword) !== password) throw validationError("Passwords do not match");

  const existing = await prisma.user.findUnique({ where: { email: account } });
  if (existing) throw new ApiError(422, "Account already exists", "EMAIL_EXISTS");

  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.user.create({
    data: {
      email: account,
      passwordHash,
      displayName: account.split("@")[0] || account
    }
  });
}

export async function login(input = {}) {
  const { account, password } = validateAccountAndPassword(resolveAccount(input), resolveCredential(input));
  const user = await prisma.user.findUnique({ where: { email: account } });

  if (!user || user.status !== "active") {
    throw new ApiError(401, "Invalid account or password", "INVALID_CREDENTIALS");
  }
  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    throw new ApiError(401, "Invalid account or password", "INVALID_CREDENTIALS");
  }
  return prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
}
