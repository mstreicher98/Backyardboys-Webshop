import nodemailer, { type Transporter } from 'nodemailer';
import { db } from './db';
import { mailLog } from './db/schema';
import { getSecrets } from './secrets';
import { getSettings } from './settings';

/**
 * E-Mail-Versand über den SMTP-Server aus den Einstellungen. Jede Mail wird
 * protokolliert (Einstellungen → E-Mail). Ist noch kein Server eingetragen,
 * steht die Mail nur im Protokoll und in der Konsole – die Bestellung läuft
 * trotzdem durch.
 */

export interface MailContent {
	subject: string;
	html: string;
	text: string;
}

export interface Attachment {
	filename: string;
	content: Buffer;
	contentType?: string;
}

let transport: { key: string; t: Transporter } | null = null;

async function transporter(): Promise<{ t: Transporter; from: string } | null> {
	const s = await getSettings();
	const secrets = await getSecrets();
	const m = s.mail;
	if (!m.host || !m.from) return null;
	const key = JSON.stringify([m.host, m.port, m.secure, m.user, secrets.smtpPassword]);
	if (!transport || transport.key !== key) {
		transport = {
			key,
			t: nodemailer.createTransport({
				host: m.host,
				port: m.port,
				secure: m.secure,
				auth: m.user ? { user: m.user, pass: secrets.smtpPassword } : undefined,
				connectionTimeout: 15_000,
				greetingTimeout: 15_000,
				socketTimeout: 30_000
			})
		};
	}
	const name = m.fromName.replace(/["<>]/g, '');
	return { t: transport.t, from: name ? `"${name}" <${m.from}>` : m.from };
}

export function forgetTransport() {
	transport = null;
}

export async function sendMail(
	to: string,
	content: MailContent,
	opts: { template: string; orderId?: number | null; replyTo?: string; attachments?: Attachment[] }
): Promise<boolean> {
	const tp = await transporter();
	if (!tp) {
		console.info(`[mail] (kein SMTP) an ${to}: ${content.subject}\n${content.text.slice(0, 1200)}\n`);
		await log(to, content.subject, opts, 'nicht_eingerichtet', null);
		return false;
	}
	try {
		await tp.t.sendMail({
			from: tp.from,
			to,
			subject: content.subject,
			html: content.html,
			text: content.text,
			replyTo: opts.replyTo,
			attachments: opts.attachments
		});
		await log(to, content.subject, opts, 'gesendet', null);
		return true;
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error('[mail]', msg);
		await log(to, content.subject, opts, 'fehler', msg);
		return false;
	}
}

/** Versand im Hintergrund – Seitenaufrufe warten nicht auf den Mailserver */
export function queueMail(to: string, content: MailContent | Promise<MailContent>, opts: Parameters<typeof sendMail>[2]) {
	void Promise.resolve(content)
		.then((c) => sendMail(to, c, opts))
		.catch((err) => console.error('[mail]', err));
}

async function log(to: string, subject: string, opts: { template: string; orderId?: number | null }, status: 'gesendet' | 'fehler' | 'nicht_eingerichtet', error: string | null) {
	try {
		await db.insert(mailLog).values({ to: to.slice(0, 300), subject: subject.slice(0, 300), template: opts.template, status, error: error?.slice(0, 500) ?? null, orderId: opts.orderId ?? null });
	} catch (err) {
		console.error('[mail-protokoll]', err);
	}
}

export async function verifySmtp(): Promise<string | null> {
	const tp = await transporter();
	if (!tp) return 'Es ist noch kein SMTP-Server eingetragen.';
	try {
		await tp.t.verify();
		return null;
	} catch (err) {
		return err instanceof Error ? err.message : String(err);
	}
}
