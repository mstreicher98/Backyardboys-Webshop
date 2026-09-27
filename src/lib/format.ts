const TZ = 'Europe/Vienna';

/** 'YYYY-MM-DD' als Kalendertag, unabhängig von der Zeitzone */
function dayToDate(day: string): Date {
	const [y, m, d] = day.split('-').map(Number);
	return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('de-AT', { timeZone: 'UTC', ...opts });

const LONG = fmt({ day: 'numeric', month: 'long', year: 'numeric' });
const SHORT = fmt({ day: '2-digit', month: '2-digit', year: 'numeric' });
const WEEKDAY_LONG = fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const WEEKDAY_SHORT = fmt({ weekday: 'short' });
const MONTH_SHORT = fmt({ month: 'short' });
const MONTH_LONG_YEAR = fmt({ month: 'long', year: 'numeric' });

/** 23. September 2026 */
export const formatDay = (day: string) => LONG.format(dayToDate(day));
/** 23.09.2026 */
export const formatDayShort = (day: string) => SHORT.format(dayToDate(day));
/** Mittwoch, 23. September 2026 */
export const formatDayWeekday = (day: string) => WEEKDAY_LONG.format(dayToDate(day));
export const weekdayShort = (day: string) => WEEKDAY_SHORT.format(dayToDate(day)).replace('.', '');
export const monthShort = (day: string) => MONTH_SHORT.format(dayToDate(day)).replace('.', '');
export const monthYear = (day: string) => MONTH_LONG_YEAR.format(dayToDate(day));
export const dayOfMonth = (day: string) => String(Number(day.slice(8, 10)));

const STAMP = new Intl.DateTimeFormat('de-AT', {
	timeZone: TZ,
	day: '2-digit',
	month: '2-digit',
	year: 'numeric',
	hour: '2-digit',
	minute: '2-digit'
});

/** Zeitpunkt (Date) → 23.09.2026, 14:05 */
export const formatStamp = (d: Date | number | null | undefined) => (d ? STAMP.format(d) : '–');

const REL = new Intl.RelativeTimeFormat('de-AT', { numeric: 'auto' });

/** "vor 3 Stunden", "gestern" … */
export function relativeTime(d: Date | number, now = Date.now()): string {
	const diff = (typeof d === 'number' ? d : d.getTime()) - now;
	const abs = Math.abs(diff);
	const MIN = 60_000;
	const HOUR = 60 * MIN;
	const DAY = 24 * HOUR;
	if (abs < MIN) return 'gerade eben';
	if (abs < HOUR) return REL.format(Math.round(diff / MIN), 'minute');
	if (abs < DAY) return REL.format(Math.round(diff / HOUR), 'hour');
	if (abs < 30 * DAY) return REL.format(Math.round(diff / DAY), 'day');
	return formatStamp(d);
}

/** Heutiger Tag in Österreich als YYYY-MM-DD */
export function todayVienna(now = new Date()): string {
	return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function formatBytes(n: number): string {
	if (n < 1024) return `${n} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
	if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
	return `${(n / 1024 / 1024 / 1024).toFixed(2).replace('.', ',')} GB`;
}

export const formatNumber = (n: number) => new Intl.NumberFormat('de-AT').format(n);

/** Uhrzeit "15:44" → "15:44 Uhr" */
export const formatTime = (t: string | null | undefined) => (t ? `${t} Uhr` : '');

/** Name einer Sicherung "2026-09-24-033255" → "24.09.2026, 03:32" (Serverzeit, wie beim Anlegen) */
export function formatBackupName(name: string): string {
	const m = name.match(/^(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})\d{2}$/);
	return m ? `${m[3]}.${m[2]}.${m[1]}, ${m[4]}:${m[5]}` : name;
}
