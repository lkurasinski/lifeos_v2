import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { DATABASE_URL } from "$env/static/private";
import { logger } from "./logger";

const adapter = new PrismaPg({ connectionString: DATABASE_URL });

// Forward Prisma's warn/error events to the logger at their level. Each line inherits the
// request `reqId` via the mixin when emitted inside a request. Per-query logging is deliberately
// NOT forwarded — at `debug` it drowns every request in SQL noise; warn/error carry the signal
// (real DB problems) without the volume. Listeners are attached only on creation, so the
// hot-reload `globalThis` singleton below is never double-wrapped.
function createPrismaClient() {
	const client = new PrismaClient({
		adapter,
		log: [
			{ emit: "event", level: "warn" },
			{ emit: "event", level: "error" },
		],
	});
	client.$on("warn", (e) => logger.warn({ target: e.target }, e.message));
	client.$on("error", (e) => logger.error({ target: e.target }, e.message));
	return client;
}

const globalForPrisma = globalThis as unknown as { prisma: ReturnType<typeof createPrismaClient> };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
