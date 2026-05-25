import { Resend } from "resend";
import { RESEND_API_KEY } from "$env/static/private";

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
		console.error(`Failed to send email to ${opts.to}: ${error.message}`);
		throw new Error(`Email delivery failed: ${error.message}`);
	}
}
