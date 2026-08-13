// 全项目共用的 Prisma Client，避免每个服务重复创建数据库连接对象。
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
