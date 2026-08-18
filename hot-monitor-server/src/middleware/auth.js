import { readBearerToken, verifyAccessToken } from "../services/accessTokenService.js";
import { ApiError } from "../utils/errors.js";

export function getAuthenticatedUserId(req) {
  return req.auth?.userId || req.session?.userId || null;
}

export function requireAuth(req, res, next) {
  const authorization = typeof req.get === "function" ? req.get("authorization") : req.headers?.authorization;
  const token = readBearerToken(authorization);
  const claims = token ? verifyAccessToken(token) : null;
  if (token && !claims) {
    return next(new ApiError(401, "Invalid or expired access token", "INVALID_TOKEN"));
  }
  if (claims?.sub) {
    // Do not copy token identity into the session. This keeps stateless token
    // requests independent from the browser's cookie session.
    req.auth = { userId: claims.sub, token: true, claims };
    return next();
  }

  if (req.session?.userId) {
    req.auth = { userId: req.session.userId, token: false };
    return next();
  }

  return next(new ApiError(401, "Unauthenticated", "UNAUTHENTICATED"));
}
