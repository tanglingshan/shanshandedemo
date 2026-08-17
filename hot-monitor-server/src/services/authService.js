// 用户业务服务：负责邮箱校验、密码加密、注册和登录验证。
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { ApiError, validationError } from "../utils/errors.js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function toUserSummary(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt
  };
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
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

function validateEmailAndPassword(email, password) {
  const normalizedEmail = normalizeEmail(email);

  if (!emailPattern.test(normalizedEmail)) {
    // 统一在服务层校验输入，避免不同路由出现不一致的验证逻辑。
    throw validationError("请输入有效的邮箱地址");
  }

  if (!password) {
    throw validationError("请输入密码");
  }

  return { email: normalizedEmail, password: String(password) };
}

export async function register(input) {
  const { email, password } = validateEmailAndPassword(input.email, resolveCredential(input));

  if (!isSha256Credential(password) && String(password).length < 8) {
    throw validationError("密码长度至少为 8 位");
  }

  const confirmPassword = input.confirmPasswordDigest ?? input.confirmPassword;
  if (confirmPassword === undefined) {
    throw validationError("请输入确认密码");
  }

  if (input.confirmPasswordDigest !== undefined && !isSha256Credential(String(confirmPassword))) {
    throw validationError("password digest has an invalid format");
  }

  if (String(confirmPassword) !== password) {
    throw validationError("两次输入的密码不一致");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ApiError(422, "该邮箱已注册", "EMAIL_EXISTS");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // 数据库只保存密码哈希，绝不保存明文密码。
  return prisma.user.create({
    data: {
      email,
      passwordHash,
      displayName: email.split("@")[0]
    }
  });
}

export async function login(input) {
  const { email, password } = validateEmailAndPassword(input.email, resolveCredential(input));
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || user.status !== "active") {
    throw new ApiError(401, "邮箱或密码错误", "INVALID_CREDENTIALS");
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    throw new ApiError(401, "邮箱或密码错误", "INVALID_CREDENTIALS");
  }

  return prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() }
  });
}
