import { and, eq, isNotNull } from 'drizzle-orm';
import { db } from './db';
import { users } from './db/schema';
import { queueMail, type MailContent } from './mail';
import { pushToTeam, type PushPayload } from './push';
import { getSettings } from './settings';

/**
 * Meldung an das Team: E-Mail an alle, die das eingeschaltet haben (sonst an
 * die Sammeladresse aus den Einstellungen) und Push aufs Handy.
 */
export async function notifyTeam(mail: MailContent | Promise<MailContent>, push: PushPayload, orderId: number | null = null) {
	try {
		const rows = await db
			.select({ email: users.email })
			.from(users)
			.where(and(eq(users.active, true), eq(users.notifyEmail, true), isNotNull(users.email)))
			.all();
		let recipients = rows.map((r) => r.email!).filter(Boolean);
		if (!recipients.length) {
			const s = await getSettings();
			if (s.mail.teamFallback) recipients = [s.mail.teamFallback];
		}
		const content = await mail;
		for (const to of new Set(recipients)) queueMail(to, content, { template: 'team', orderId });
	} catch (err) {
		console.error('[team-meldung]', err);
	}
	void pushToTeam(push);
}
