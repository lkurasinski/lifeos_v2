import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { env } from "$env/dynamic/private";
import { prisma } from "./db";
import { sendEmail } from "./email";

export const auth = betterAuth({
	// Read the secret through SvelteKit's env module rather than relying on Better Auth's
	// own process.env lookup: Vite/SvelteKit load .env into $env/*, not process.env, so the
	// bare process.env.BETTER_AUTH_SECRET is undefined during `vite build` and Better Auth
	// throws on the default secret (NODE_ENV=production). $env/dynamic/private resolves it
	// from .env at build and from the runtime environment (Railway) without baking it in.
	secret: env.BETTER_AUTH_SECRET,
	database: prismaAdapter(prisma, {
		provider: "postgresql",
	}),
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: true,
		sendResetPassword: async ({ user, url }) => {
			await sendEmail({
				to: user.email,
				subject: "Zresetuj swoje hasło — LifeOS",
				html: `
					<p>Cześć ${user.name},</p>
					<p>Kliknij poniższy link, aby zresetować swoje hasło:</p>
					<p><a href="${url}">Zresetuj hasło</a></p>
					<p>Link jest ważny przez 1 godzinę. Jeśli nie prosiłeś o zmianę hasła, zignoruj tę wiadomość.</p>
				`,
			});
		},
	},
	emailVerification: {
		sendOnSignUp: true,
		sendVerificationEmail: async ({ user, url }) => {
			await sendEmail({
				to: user.email,
				subject: "Potwierdź swój adres email — LifeOS",
				html: `
					<p>Cześć ${user.name},</p>
					<p>Kliknij poniższy link, aby potwierdzić swój adres email:</p>
					<p><a href="${url}">Potwierdź email</a></p>
					<p>Link jest ważny przez 1 godzinę.</p>
				`,
			});
		},
	},
	rateLimit: {
		enabled: true,
		window: 10,
		max: 100,
		storage: "memory",
	},
});
