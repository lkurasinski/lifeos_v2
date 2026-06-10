import { Resend } from "resend";
import { RESEND_API_KEY } from "$env/static/private";
import { logger } from "$lib/server/logger";

const resend = new Resend(RESEND_API_KEY);

const FROM_EMAIL = "LifeOS <onboarding@lifeos.lukaszkurasinski.pl>";

export async function sendEmail(opts: { to: string; subject: string; html: string }) {
	const { error } = await resend.emails.send({
		from: FROM_EMAIL,
		to: opts.to,
		subject: opts.subject,
		html: opts.html,
	});
	if (error) {
		logger.error({ err: error, to: opts.to }, "Failed to send email");
		throw new Error(`Email delivery failed: ${error.message}`);
	}
}
