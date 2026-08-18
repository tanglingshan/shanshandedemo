import { Server } from "socket.io";
import { env } from "../config/env.js";
import { setSocketServer } from "./emitter.js";
import { readBearerToken, verifyAccessToken } from "../services/accessTokenService.js";

// 初始化 Socket.io，并让实时连接复用 Express 的 Session 鉴权。
export function setupSocket(httpServer, sessionMiddleware) {
  const io = new Server(httpServer, {
    cors: {
      origin: env.corsOrigin,
      credentials: true
    }
  });

  // Socket 握手阶段读取与 HTTP API 相同的 Session Cookie。
  io.engine.use(sessionMiddleware);

  // 只有已登录用户才能建立实时连接。
  io.use((socket, next) => {
    const authToken = socket.handshake.auth?.token || socket.handshake.auth?.accessToken;
    const headerToken = readBearerToken(socket.handshake.headers?.authorization);
    const suppliedToken = authToken || headerToken;
    const claims = verifyAccessToken(suppliedToken);
    if (suppliedToken && !claims) {
      return next(new Error("Invalid or expired access token"));
    }
    if (claims?.sub) {
      socket.data.userId = claims.sub;
      socket.data.authMethod = "token";
      return next();
    }
    if (!socket.request.session?.userId) {
      return next(new Error("Unauthenticated"));
    }
    socket.data.userId = socket.request.session.userId;
    socket.data.authMethod = "session";
    return next();
  });

  io.on("connection", (socket) => {
    // 告知前端连接已建立，并提供服务端时间作为连通性标记。
    socket.emit("server:ready", { timestamp: new Date().toISOString() });

    socket.on("dashboard:join", () => {
      // 仪表盘房间用于接收所有热点和统计更新。
      socket.join("dashboard");
    });

    socket.on("dashboard:leave", () => {
      socket.leave("dashboard");
    });

    socket.on("hot-items:subscribe", (payload = {}) => {
      // 保存客户端筛选条件，供后续扩展为按订阅条件推送。
      socket.data.subscription = {
        keywords: payload.keywords || [],
        sources: payload.sources || []
      };
    });

    socket.on("hot-items:unsubscribe", () => {
      socket.data.subscription = null;
    });
  });

  // 将实例交给 emitter 模块，使采集服务可以在非 Socket 文件中广播事件。
  setSocketServer(io);
  return io;
}
