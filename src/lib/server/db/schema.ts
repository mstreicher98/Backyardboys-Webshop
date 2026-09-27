import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import type {
	AddressSnapshot,
	LineConfig,
	LineConfigSnapshot,
	PersonalizationField,
	ProductOption,
	StockMove,
	InvoiceData,
	BikeRef
} from '$lib/shop-types';

const bool = (name: string) => integer(name, { mode: 'boolean' });
const stamp = (name: string) => integer(name, { mode: 'timestamp_ms' });
const created = () =>
	stamp('created_at')
		.notNull()
		.$defaultFn(() => new Date());
const json = <T>(name: string) => text(name, { mode: 'json' }).$type<T>();

const timestamps = {
	createdAt: created(),
	updatedAt: stamp('updated_at')
		.notNull()
		.$defaultFn(() => new Date())
		.$onUpdateFn(() => new Date())
};

/* ================================================================ Team (interner Bereich) */

export const users = sqliteTable('users', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	username: text('username').notNull().unique(),
	name: text('name').notNull(),
	email: text('email'),
	role: text('role', { enum: ['admin', 'mitarbeiter'] })
		.notNull()
		.default('mitarbeiter'),
	passwordHash: text('password_hash').notNull(),
	mustChangePassword: bool('must_change_password').notNull().default(true),
	/** Base32-Geheimnis der Authenticator-App; null = noch nicht eingerichtet */
	totpSecret: text('totp_secret'),
	totpEnabled: bool('totp_enabled').notNull().default(false),
	/** Zuletzt benutzter 30-Sekunden-Schritt – ein Code gilt nur einmal */
	totpLastStep: integer('totp_last_step'),
	/** Der erste Admin: kann nicht gelöscht oder herabgestuft werden */
	owner: bool('owner').notNull().default(false),
	active: bool('active').notNull().default(true),
	/** Neue Bestellungen, Nachrichten und Freigaben per E-Mail melden */
	notifyEmail: bool('notify_email').notNull().default(true),
	/** … und als Push-Nachricht an alle Geräte, auf denen sie eingeschaltet ist */
	notifyPush: bool('notify_push').notNull().default(true),
	lastLoginAt: stamp('last_login_at'),
	...timestamps
});

export const sessions = sqliteTable(
	'sessions',
	{
		id: text('id').primaryKey(),
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		expiresAt: stamp('expires_at').notNull(),
		persistent: bool('persistent').notNull().default(false),
		userAgent: text('user_agent'),
		createdAt: created()
	},
	(t) => [index('sessions_user_idx').on(t.userId)]
);

/** Zwischenschritt nach richtigem Passwort, bis der 2FA-Code eingegeben ist */
export const loginChallenges = sqliteTable('login_challenges', {
	id: text('id').primaryKey(),
	userId: integer('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	persistent: bool('persistent').notNull().default(false),
	attempts: integer('attempts').notNull().default(0),
	expiresAt: stamp('expires_at').notNull()
});

/** Web-Push: ein Eintrag je Gerät und Browser */
export const pushSubscriptions = sqliteTable('push_subscriptions', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	userId: integer('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	endpoint: text('endpoint').notNull().unique(),
	p256dh: text('p256dh').notNull(),
	auth: text('auth').notNull(),
	userAgent: text('user_agent'),
	createdAt: created()
});

/* ================================================================ Medien */

/** Öffentliche Bilder (Produkte, Startseite, Kundenbikes) als WebP in mehreren Größen */
export const media = sqliteTable('media', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	kind: text('kind', { enum: ['bild', 'dokument'] })
		.notNull()
		.default('bild'),
	file: text('file').notNull().unique(),
	originalName: text('original_name').notNull().default(''),
	widths: text('widths').notNull(),
	width: integer('width').notNull(),
	height: integer('height').notNull(),
	sizeBytes: integer('size_bytes').notNull().default(0),
	alt: text('alt').notNull().default(''),
	uploadedById: integer('uploaded_by_id').references(() => users.id, { onDelete: 'set null' }),
	createdAt: created()
});

/**
 * Nicht öffentliche Dateien: Fotos und Logos, die Kunden hochladen, und
 * Entwürfe des Teams. Abrufbar nur über den zufälligen Schlüssel.
 */
export const files = sqliteTable(
	'files',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		/** Zufälliger Schlüssel in der Adresse /datei/<key> */
		key: text('key').notNull().unique(),
		originalName: text('original_name').notNull(),
		mime: text('mime').notNull(),
		sizeBytes: integer('size_bytes').notNull(),
		/** Vorschau als WebP (nur bei Bildern) */
		hasPreview: bool('has_preview').notNull().default(false),
		width: integer('width'),
		height: integer('height'),
		source: text('source', { enum: ['kunde', 'team'] }).notNull(),
		cartId: text('cart_id'),
		orderId: integer('order_id').references(() => orders.id, { onDelete: 'set null' }),
		userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
		createdAt: created()
	},
	(t) => [index('files_order_idx').on(t.orderId), index('files_cart_idx').on(t.cartId)]
);

/* ================================================================ Einstellungen, Protokoll */

export const settings = sqliteTable('settings', {
	key: text('key').primaryKey(),
	value: text('value').notNull()
});

/** Fortlaufende Nummern (Bestellungen, Rechnungen je Jahr) */
export const counters = sqliteTable('counters', {
	key: text('key').primaryKey(),
	value: integer('value').notNull()
});

export const auditLog = sqliteTable(
	'audit_log',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
		action: text('action').notNull(),
		entity: text('entity').notNull(),
		entityId: integer('entity_id'),
		label: text('label').notNull().default(''),
		createdAt: created()
	},
	(t) => [index('audit_created_idx').on(t.createdAt)]
);

export const pageViews = sqliteTable(
	'page_views',
	{
		day: text('day').notNull(),
		path: text('path').notNull(),
		views: integer('views').notNull().default(0)
	},
	(t) => [primaryKey({ columns: [t.day, t.path] })]
);

/** Jede verschickte (oder gescheiterte) E-Mail – zur Fehlersuche im Admin */
export const mailLog = sqliteTable(
	'mail_log',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		to: text('to').notNull(),
		subject: text('subject').notNull(),
		template: text('template').notNull(),
		status: text('status', { enum: ['gesendet', 'fehler', 'nicht_eingerichtet'] }).notNull(),
		error: text('error'),
		orderId: integer('order_id'),
		createdAt: created()
	},
	(t) => [index('mail_created_idx').on(t.createdAt)]
);

/* ================================================================ Kunden */

export const customers = sqliteTable('customers', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	email: text('email').notNull().unique(),
	/** null = bisher nur Anmeldung per Link */
	passwordHash: text('password_hash'),
	emailVerifiedAt: stamp('email_verified_at'),
	firstName: text('first_name').notNull().default(''),
	lastName: text('last_name').notNull().default(''),
	phone: text('phone').notNull().default(''),
	company: text('company').notNull().default(''),
	vatId: text('vat_id').notNull().default(''),
	/** Ergebnis der letzten UID-Prüfung (VIES) */
	vatIdValid: bool('vat_id_valid'),
	vatIdCheckedAt: stamp('vat_id_checked_at'),
	dealerStatus: text('dealer_status', { enum: ['kein', 'angefragt', 'freigegeben', 'abgelehnt'] })
		.notNull()
		.default('kein'),
	/** Händlerrabatt in Prozent; null = Standard aus den Einstellungen */
	dealerDiscount: integer('dealer_discount'),
	locale: text('locale', { enum: ['de', 'en'] })
		.notNull()
		.default('de'),
	active: bool('active').notNull().default(true),
	internalNote: text('internal_note').notNull().default(''),
	lastLoginAt: stamp('last_login_at'),
	...timestamps
});

export const customerSessions = sqliteTable(
	'customer_sessions',
	{
		id: text('id').primaryKey(),
		customerId: integer('customer_id')
			.notNull()
			.references(() => customers.id, { onDelete: 'cascade' }),
		expiresAt: stamp('expires_at').notNull(),
		persistent: bool('persistent').notNull().default(false),
		createdAt: created()
	},
	(t) => [index('customer_sessions_customer_idx').on(t.customerId)]
);

/** Einmal-Links: Anmelden per Mail, E-Mail bestätigen, Passwort zurücksetzen */
export const customerTokens = sqliteTable('customer_tokens', {
	id: text('id').primaryKey(),
	email: text('email').notNull(),
	customerId: integer('customer_id').references(() => customers.id, { onDelete: 'cascade' }),
	purpose: text('purpose', { enum: ['login', 'verify', 'reset'] }).notNull(),
	expiresAt: stamp('expires_at').notNull(),
	usedAt: stamp('used_at'),
	createdAt: created()
});

export const addresses = sqliteTable('addresses', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	customerId: integer('customer_id')
		.notNull()
		.references(() => customers.id, { onDelete: 'cascade' }),
	firstName: text('first_name').notNull(),
	lastName: text('last_name').notNull(),
	company: text('company').notNull().default(''),
	street: text('street').notNull(),
	zip: text('zip').notNull(),
	city: text('city').notNull(),
	country: text('country').notNull(),
	phone: text('phone').notNull().default(''),
	isDefault: bool('is_default').notNull().default(false),
	createdAt: created()
});

/* ================================================================ Sortiment */

export const categories = sqliteTable('categories', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	slug: text('slug').notNull().unique(),
	parentId: integer('parent_id'),
	name: text('name').notNull(),
	nameEn: text('name_en').notNull().default(''),
	/** Kurzer Zusatz im Menü, z. B. „Premium Dekor“ */
	tagline: text('tagline').notNull().default(''),
	taglineEn: text('tagline_en').notNull().default(''),
	descriptionHtml: text('description_html').notNull().default(''),
	descriptionHtmlEn: text('description_html_en').notNull().default(''),
	mediaId: integer('media_id').references(() => media.id, { onDelete: 'set null' }),
	sortOrder: integer('sort_order').notNull().default(0),
	active: bool('active').notNull().default(true),
	showInMenu: bool('show_in_menu').notNull().default(true)
});

export const products = sqliteTable(
	'products',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		slug: text('slug').notNull().unique(),
		kind: text('kind', { enum: ['standard', 'dekor', 'gutschein', 'bundle'] })
			.notNull()
			.default('standard'),
		dekorType: text('dekor_type', { enum: ['full_custom', 'semi_custom', 'reprint'] }),
		status: text('status', { enum: ['entwurf', 'aktiv', 'archiviert'] })
			.notNull()
			.default('entwurf'),
		title: text('title').notNull(),
		titleEn: text('title_en').notNull().default(''),
		subtitle: text('subtitle').notNull().default(''),
		subtitleEn: text('subtitle_en').notNull().default(''),
		descriptionHtml: text('description_html').notNull().default(''),
		descriptionHtmlEn: text('description_html_en').notNull().default(''),
		/** Auswahlmöglichkeiten wie Größe oder Farbe; jede Kombination ist eine Variante */
		options: json<ProductOption[]>('options').notNull().default([]),
		/** bestand = Lager führen, auf_bestellung = wird bei Bestellung gefertigt */
		stockMode: text('stock_mode', { enum: ['bestand', 'auf_bestellung'] })
			.notNull()
			.default('auf_bestellung'),
		/** Bei Bestand 0 trotzdem bestellbar (Nachlieferung) */
		backorder: bool('backorder').notNull().default(false),
		/** Vorbestellung: erscheint erst ab diesem Tag (YYYY-MM-DD) */
		releaseDate: text('release_date'),
		leadTime: text('lead_time').notNull().default(''),
		leadTimeEn: text('lead_time_en').notNull().default(''),
		/** Angebotene Upgrade-Gruppen (Premium Base, Finish …) */
		upgradeGroupIds: json<number[]>('upgrade_group_ids').notNull().default([]),
		/** Personalisierungs-Felder, im Admin je Produkt zusammengestellt */
		fields: json<PersonalizationField[]>('fields').notNull().default([]),
		/** Passt auf jedes Bike (z. B. Full Custom) – erscheint im Bike-Finder immer */
		universalFit: bool('universal_fit').notNull().default(false),
		requiresShipping: bool('requires_shipping').notNull().default(true),
		/** Händlerrabatt gilt für dieses Produkt */
		dealerDiscountable: bool('dealer_discountable').notNull().default(true),
		featured: bool('featured').notNull().default(false),
		sortOrder: integer('sort_order').notNull().default(0),
		...timestamps
	},
	(t) => [index('products_status_idx').on(t.status)]
);

export const productCategories = sqliteTable(
	'product_categories',
	{
		productId: integer('product_id')
			.notNull()
			.references(() => products.id, { onDelete: 'cascade' }),
		categoryId: integer('category_id')
			.notNull()
			.references(() => categories.id, { onDelete: 'cascade' })
	},
	(t) => [primaryKey({ columns: [t.productId, t.categoryId] }), index('product_categories_cat_idx').on(t.categoryId)]
);

export const productImages = sqliteTable(
	'product_images',
	{
		productId: integer('product_id')
			.notNull()
			.references(() => products.id, { onDelete: 'cascade' }),
		mediaId: integer('media_id')
			.notNull()
			.references(() => media.id, { onDelete: 'cascade' }),
		sortOrder: integer('sort_order').notNull().default(0)
	},
	(t) => [primaryKey({ columns: [t.productId, t.mediaId] })]
);

export const variants = sqliteTable(
	'variants',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		productId: integer('product_id')
			.notNull()
			.references(() => products.id, { onDelete: 'cascade' }),
		sku: text('sku').notNull().default(''),
		/** Gewählte Werte in der Reihenfolge der Produkt-Optionen, z. B. ["M", "Schwarz"] */
		optionValues: json<string[]>('option_values').notNull().default([]),
		/** Preis in Cent inkl. USt. */
		price: integer('price').notNull(),
		/** Durchgestrichener Vergleichspreis */
		compareAtPrice: integer('compare_at_price'),
		/** Eigener Händlerpreis; null = Händlerrabatt in Prozent */
		dealerPrice: integer('dealer_price'),
		stock: integer('stock').notNull().default(0),
		active: bool('active').notNull().default(true),
		sortOrder: integer('sort_order').notNull().default(0)
	},
	(t) => [index('variants_product_idx').on(t.productId)]
);

/** Bestandteile eines Bundles; bei mehreren Varianten wählt der Kunde */
export const bundleItems = sqliteTable('bundle_items', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	bundleId: integer('bundle_id')
		.notNull()
		.references(() => products.id, { onDelete: 'cascade' }),
	productId: integer('product_id')
		.notNull()
		.references(() => products.id, { onDelete: 'restrict' }),
	quantity: integer('quantity').notNull().default(1),
	sortOrder: integer('sort_order').notNull().default(0)
});

/** Upgrade-Gruppen für Dekore, z. B. Premium Base oder Premium Finish */
export const upgradeGroups = sqliteTable('upgrade_groups', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	nameEn: text('name_en').notNull().default(''),
	descriptionHtml: text('description').notNull().default(''),
	descriptionEn: text('description_en').notNull().default(''),
	sortOrder: integer('sort_order').notNull().default(0)
});

export const upgradeOptions = sqliteTable('upgrade_options', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	groupId: integer('group_id')
		.notNull()
		.references(() => upgradeGroups.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	nameEn: text('name_en').notNull().default(''),
	/** Aufpreis in Cent inkl. USt. */
	surcharge: integer('surcharge').notNull().default(0),
	mediaId: integer('media_id').references(() => media.id, { onDelete: 'set null' }),
	isDefault: bool('is_default').notNull().default(false),
	active: bool('active').notNull().default(true),
	sortOrder: integer('sort_order').notNull().default(0)
});

/* ------------------------------------------------------------ Bike-Finder */

export const bikeBrands = sqliteTable('bike_brands', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull().unique(),
	slug: text('slug').notNull().unique(),
	sortOrder: integer('sort_order').notNull().default(0),
	active: bool('active').notNull().default(true)
});

export const bikeModels = sqliteTable(
	'bike_models',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		brandId: integer('brand_id')
			.notNull()
			.references(() => bikeBrands.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		/** Bauart, z. B. MX, Enduro, Supermoto – nur zur Gruppierung */
		category: text('category').notNull().default(''),
		yearFrom: integer('year_from').notNull(),
		/** null = wird noch gebaut */
		yearTo: integer('year_to'),
		active: bool('active').notNull().default(true)
	},
	(t) => [index('bike_models_brand_idx').on(t.brandId)]
);

/** Welches Dekor passt auf welches Modell (optional nur für bestimmte Baujahre) */
export const productBikes = sqliteTable(
	'product_bikes',
	{
		productId: integer('product_id')
			.notNull()
			.references(() => products.id, { onDelete: 'cascade' }),
		modelId: integer('model_id')
			.notNull()
			.references(() => bikeModels.id, { onDelete: 'cascade' }),
		yearFrom: integer('year_from'),
		yearTo: integer('year_to')
	},
	(t) => [primaryKey({ columns: [t.productId, t.modelId] }), index('product_bikes_model_idx').on(t.modelId)]
);

/* ================================================================ Warenkorb */

export const carts = sqliteTable('carts', {
	/** SHA-256 des Cookie-Werts */
	id: text('id').primaryKey(),
	customerId: integer('customer_id').references(() => customers.id, { onDelete: 'set null' }),
	country: text('country').notNull().default('AT'),
	discountCode: text('discount_code'),
	giftCardCodes: json<string[]>('gift_card_codes').notNull().default([]),
	...timestamps
});

export const cartItems = sqliteTable(
	'cart_items',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		cartId: text('cart_id')
			.notNull()
			.references(() => carts.id, { onDelete: 'cascade' }),
		productId: integer('product_id')
			.notNull()
			.references(() => products.id, { onDelete: 'cascade' }),
		variantId: integer('variant_id')
			.notNull()
			.references(() => variants.id, { onDelete: 'cascade' }),
		quantity: integer('quantity').notNull().default(1),
		config: json<LineConfig>('config').notNull().default({}),
		/** Gleiche Konfiguration → Menge erhöhen statt neue Zeile */
		configKey: text('config_key').notNull().default(''),
		createdAt: created()
	},
	(t) => [index('cart_items_cart_idx').on(t.cartId)]
);

/* ================================================================ Bestellungen */

export const orders = sqliteTable(
	'orders',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		number: integer('number').notNull().unique(),
		/** Zufälliger Schlüssel für den Link in den E-Mails (auch ohne Konto) */
		token: text('token').notNull().unique(),
		customerId: integer('customer_id').references(() => customers.id, { onDelete: 'set null' }),
		email: text('email').notNull(),
		phone: text('phone').notNull().default(''),
		locale: text('locale', { enum: ['de', 'en'] })
			.notNull()
			.default('de'),
		status: text('status', {
			enum: ['zahlung_offen', 'in_bearbeitung', 'abholbereit', 'versendet', 'abgeschlossen', 'storniert']
		})
			.notNull()
			.default('zahlung_offen'),
		paymentStatus: text('payment_status', { enum: ['offen', 'bezahlt', 'erstattet', 'fehlgeschlagen'] })
			.notNull()
			.default('offen'),
		paymentMethod: text('payment_method').notNull(),
		billingAddress: json<AddressSnapshot>('billing_address').notNull(),
		shippingAddress: json<AddressSnapshot>('shipping_address'),
		shippingMethod: text('shipping_method', { enum: ['versand', 'abholung', 'keiner'] }).notNull(),
		shippingCountry: text('shipping_country'),
		/** Beträge in Cent */
		subtotal: integer('subtotal').notNull(),
		discountTotal: integer('discount_total').notNull().default(0),
		shippingTotal: integer('shipping_total').notNull().default(0),
		taxTotal: integer('tax_total').notNull().default(0),
		total: integer('total').notNull(),
		giftCardTotal: integer('gift_card_total').notNull().default(0),
		/** Was noch über die Zahlungsart zu zahlen ist (Summe minus Gutscheine) */
		amountDue: integer('amount_due').notNull(),
		taxMode: text('tax_mode', { enum: ['kleinunternehmer', 'regel'] }).notNull(),
		/** normal, reverse_charge oder export – bestimmt den Hinweis auf der Rechnung */
		taxCase: text('tax_case', { enum: ['normal', 'reverse_charge', 'export', 'kleinunternehmer'] }).notNull(),
		/** Steuersatz in Basispunkten (2000 = 20 %) */
		taxRate: integer('tax_rate').notNull().default(0),
		vatId: text('vat_id').notNull().default(''),
		isDealer: bool('is_dealer').notNull().default(false),
		discountCode: text('discount_code'),
		customerNote: text('customer_note').notNull().default(''),
		internalNote: text('internal_note').notNull().default(''),
		paidAt: stamp('paid_at'),
		trackingCarrier: text('tracking_carrier').notNull().default(''),
		trackingNumber: text('tracking_number').notNull().default(''),
		trackingUrl: text('tracking_url').notNull().default(''),
		shippedAt: stamp('shipped_at'),
		cancelledAt: stamp('cancelled_at'),
		...timestamps
	},
	(t) => [index('orders_customer_idx').on(t.customerId), index('orders_email_idx').on(t.email), index('orders_status_idx').on(t.status)]
);

export const orderItems = sqliteTable(
	'order_items',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		orderId: integer('order_id')
			.notNull()
			.references(() => orders.id, { onDelete: 'cascade' }),
		productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
		variantId: integer('variant_id').references(() => variants.id, { onDelete: 'set null' }),
		kind: text('kind', { enum: ['standard', 'dekor', 'gutschein', 'bundle'] }).notNull(),
		dekorType: text('dekor_type', { enum: ['full_custom', 'semi_custom', 'reprint'] }),
		title: text('title').notNull(),
		variantTitle: text('variant_title').notNull().default(''),
		sku: text('sku').notNull().default(''),
		quantity: integer('quantity').notNull(),
		/** Stückpreis inkl. Upgrades und Aufpreisen */
		unitPrice: integer('unit_price').notNull(),
		lineTotal: integer('line_total').notNull(),
		/** Anteil am Rabatt (für Rechnung und Steuer) */
		discountShare: integer('discount_share').notNull().default(0),
		/** Anzahlung für ein Full-Custom-Dekor: Endpreis folgt nach dem Entwurf */
		isDeposit: bool('is_deposit').notNull().default(false),
		config: json<LineConfigSnapshot>('config').notNull().default({}),
		/** Abgebuchter Lagerbestand – wird beim Stornieren zurückgebucht */
		stockMoves: json<StockMove[]>('stock_moves').notNull().default([])
	},
	(t) => [index('order_items_order_idx').on(t.orderId)]
);

export const payments = sqliteTable(
	'payments',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		orderId: integer('order_id')
			.notNull()
			.references(() => orders.id, { onDelete: 'cascade' }),
		dekorJobId: integer('dekor_job_id'),
		purpose: text('purpose', { enum: ['bestellung', 'restzahlung'] }).notNull(),
		method: text('method').notNull(),
		amount: integer('amount').notNull(),
		status: text('status', { enum: ['offen', 'bezahlt', 'fehlgeschlagen', 'abgebrochen', 'erstattet'] })
			.notNull()
			.default('offen'),
		/** Checkout-Session (Stripe) bzw. Order-ID (PayPal) */
		providerRef: text('provider_ref'),
		/** Schlüssel für den Zahlungslink /zahlung/<token> */
		token: text('token').notNull().unique(),
		note: text('note').notNull().default(''),
		paidAt: stamp('paid_at'),
		createdAt: created()
	},
	(t) => [index('payments_order_idx').on(t.orderId), index('payments_ref_idx').on(t.providerRef)]
);

export const invoices = sqliteTable(
	'invoices',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		number: text('number').notNull().unique(),
		orderId: integer('order_id')
			.notNull()
			.references(() => orders.id, { onDelete: 'restrict' }),
		paymentId: integer('payment_id'),
		kind: text('kind', { enum: ['rechnung', 'anzahlung', 'schluss', 'storno'] }).notNull(),
		/** Bei Storno: die stornierte Rechnung */
		refInvoiceId: integer('ref_invoice_id'),
		issuedAt: stamp('issued_at').notNull(),
		net: integer('net').notNull(),
		tax: integer('tax').notNull(),
		total: integer('total').notNull(),
		/** Vollständiger Stand zum Ausstellungszeitpunkt – spätere Änderungen wirken nicht zurück */
		data: json<InvoiceData>('data').notNull()
	},
	(t) => [index('invoices_order_idx').on(t.orderId), index('invoices_issued_idx').on(t.issuedAt)]
);

/* ------------------------------------------------------------ Dekor-Aufträge */

export const dekorJobs = sqliteTable(
	'dekor_jobs',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		orderId: integer('order_id')
			.notNull()
			.references(() => orders.id, { onDelete: 'cascade' }),
		orderItemId: integer('order_item_id')
			.notNull()
			.references(() => orderItems.id, { onDelete: 'cascade' }),
		type: text('type', { enum: ['full_custom', 'semi_custom', 'reprint'] }).notNull(),
		status: text('status', {
			enum: [
				'neu',
				'in_gestaltung',
				'entwurf_gesendet',
				'aenderung_gewuenscht',
				'freigegeben',
				'restzahlung_offen',
				'in_produktion',
				'versendet',
				'abgeschlossen',
				'storniert'
			]
		})
			.notNull()
			.default('neu'),
		title: text('title').notNull(),
		bike: json<BikeRef>('bike'),
		/** Full Custom: vereinbarter Endpreis inkl. USt. */
		finalPrice: integer('final_price'),
		depositAmount: integer('deposit_amount').notNull().default(0),
		/** Versandkosten, die mit der Restzahlung verrechnet werden */
		shippingAmount: integer('shipping_amount'),
		revisions: integer('revisions').notNull().default(0),
		assigneeId: integer('assignee_id').references(() => users.id, { onDelete: 'set null' }),
		dueDate: text('due_date'),
		internalNote: text('internal_note').notNull().default(''),
		approvedAt: stamp('approved_at'),
		...timestamps
	},
	(t) => [index('dekor_jobs_order_idx').on(t.orderId), index('dekor_jobs_status_idx').on(t.status)]
);

export const dekorProofs = sqliteTable(
	'dekor_proofs',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		jobId: integer('job_id')
			.notNull()
			.references(() => dekorJobs.id, { onDelete: 'cascade' }),
		version: integer('version').notNull(),
		message: text('message').notNull().default(''),
		fileIds: json<number[]>('file_ids').notNull().default([]),
		status: text('status', { enum: ['offen', 'freigegeben', 'aenderung', 'ersetzt'] })
			.notNull()
			.default('offen'),
		customerNote: text('customer_note').notNull().default(''),
		decidedAt: stamp('decided_at'),
		createdById: integer('created_by_id').references(() => users.id, { onDelete: 'set null' }),
		createdAt: created()
	},
	(t) => [index('dekor_proofs_job_idx').on(t.jobId)]
);

/** Nachrichten zwischen Kunde und Team zu einer Bestellung */
export const messages = sqliteTable(
	'messages',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		orderId: integer('order_id')
			.notNull()
			.references(() => orders.id, { onDelete: 'cascade' }),
		author: text('author', { enum: ['kunde', 'team', 'system'] }).notNull(),
		userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
		body: text('body').notNull(),
		fileIds: json<number[]>('file_ids').notNull().default([]),
		readByTeamAt: stamp('read_by_team_at'),
		readByCustomerAt: stamp('read_by_customer_at'),
		createdAt: created()
	},
	(t) => [index('messages_order_idx').on(t.orderId)]
);

/* ------------------------------------------------------------ Gutscheine & Rabatte */

export const giftCards = sqliteTable('gift_cards', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	code: text('code').notNull().unique(),
	initialValue: integer('initial_value').notNull(),
	balance: integer('balance').notNull(),
	/** Kauf im Shop (null = im Admin angelegt) */
	orderId: integer('order_id').references(() => orders.id, { onDelete: 'set null' }),
	orderItemId: integer('order_item_id'),
	recipientName: text('recipient_name').notNull().default(''),
	recipientEmail: text('recipient_email').notNull().default(''),
	message: text('message').notNull().default(''),
	active: bool('active').notNull().default(true),
	sentAt: stamp('sent_at'),
	note: text('note').notNull().default(''),
	createdAt: created()
});

export const giftCardTransactions = sqliteTable('gift_card_transactions', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	giftCardId: integer('gift_card_id')
		.notNull()
		.references(() => giftCards.id, { onDelete: 'cascade' }),
	orderId: integer('order_id').references(() => orders.id, { onDelete: 'set null' }),
	/** negativ = eingelöst, positiv = aufgeladen / zurückgebucht */
	amount: integer('amount').notNull(),
	note: text('note').notNull().default(''),
	createdAt: created()
});

export const discountCodes = sqliteTable('discount_codes', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	code: text('code').notNull().unique(),
	kind: text('kind', { enum: ['prozent', 'betrag', 'versandfrei'] }).notNull(),
	/** Prozent (ganze Zahl) oder Betrag in Cent */
	value: integer('value').notNull().default(0),
	minOrder: integer('min_order'),
	validFrom: text('valid_from'),
	validUntil: text('valid_until'),
	maxUses: integer('max_uses'),
	usedCount: integer('used_count').notNull().default(0),
	oncePerCustomer: bool('once_per_customer').notNull().default(false),
	/** leer = alle Kategorien */
	categoryIds: json<number[]>('category_ids').notNull().default([]),
	/** Auch für Händler mit Händlerpreisen gültig */
	dealersAllowed: bool('dealers_allowed').notNull().default(false),
	active: bool('active').notNull().default(true),
	note: text('note').notNull().default(''),
	createdAt: created()
});

export const discountRedemptions = sqliteTable(
	'discount_redemptions',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		codeId: integer('code_id')
			.notNull()
			.references(() => discountCodes.id, { onDelete: 'cascade' }),
		orderId: integer('order_id')
			.notNull()
			.references(() => orders.id, { onDelete: 'cascade' }),
		email: text('email').notNull(),
		createdAt: created()
	},
	(t) => [uniqueIndex('discount_redemptions_order_idx').on(t.orderId)]
);

/* ------------------------------------------------------------ Versand */

export const shippingCountries = sqliteTable('shipping_countries', {
	/** ISO-3166 Alpha-2, z. B. AT */
	code: text('code').primaryKey(),
	name: text('name').notNull(),
	nameEn: text('name_en').notNull(),
	active: bool('active').notNull().default(false),
	/** Pauschale in Cent inkl. USt. */
	price: integer('price').notNull().default(0),
	/** Versandkostenfrei ab (Warenwert in Cent) */
	freeFrom: integer('free_from'),
	eu: bool('eu').notNull().default(false),
	/** Normalsteuersatz des Landes (Basispunkte) – nur für OSS */
	vatRate: integer('vat_rate').notNull().default(0),
	sortOrder: integer('sort_order').notNull().default(0)
});

/* ================================================================ Inhalte */

export const pages = sqliteTable('pages', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	slug: text('slug').notNull().unique(),
	title: text('title').notNull(),
	titleEn: text('title_en').notNull().default(''),
	contentHtml: text('content_html').notNull().default(''),
	contentHtmlEn: text('content_html_en').notNull().default(''),
	/** Spalte im Footer */
	group: text('group', { enum: ['bestellung', 'hilfe', 'rechtliches', 'keine'] })
		.notNull()
		.default('hilfe'),
	sortOrder: integer('sort_order').notNull().default(0),
	updatedAt: stamp('updated_at')
		.notNull()
		.$defaultFn(() => new Date())
		.$onUpdateFn(() => new Date())
});

/** Kundenbikes für die Galerie auf der Startseite */
export const showcase = sqliteTable('showcase', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	mediaId: integer('media_id')
		.notNull()
		.references(() => media.id, { onDelete: 'cascade' }),
	title: text('title').notNull().default(''),
	bike: text('bike').notNull().default(''),
	productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
	sortOrder: integer('sort_order').notNull().default(0),
	active: bool('active').notNull().default(true),
	createdAt: created()
});

export const testimonials = sqliteTable('testimonials', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	text: text('text').notNull(),
	textEn: text('text_en').notNull().default(''),
	rating: integer('rating').notNull().default(5),
	bike: text('bike').notNull().default(''),
	sortOrder: integer('sort_order').notNull().default(0),
	active: bool('active').notNull().default(true),
	createdAt: created()
});

export const inquiries = sqliteTable(
	'inquiries',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		name: text('name').notNull(),
		email: text('email').notNull(),
		phone: text('phone').notNull().default(''),
		subject: text('subject').notNull().default(''),
		message: text('message').notNull(),
		locale: text('locale', { enum: ['de', 'en'] })
			.notNull()
			.default('de'),
		status: text('status', { enum: ['neu', 'in_bearbeitung', 'erledigt'] })
			.notNull()
			.default('neu'),
		internalNote: text('internal_note').notNull().default(''),
		createdAt: created()
	},
	(t) => [index('inquiries_status_idx').on(t.status)]
);

/* ================================================================ Typen */

export type User = typeof users.$inferSelect;
export type Media = typeof media.$inferSelect;
export type FileRow = typeof files.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Address = typeof addresses.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Variant = typeof variants.$inferSelect;
export type UpgradeGroup = typeof upgradeGroups.$inferSelect;
export type UpgradeOption = typeof upgradeOptions.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type DekorJob = typeof dekorJobs.$inferSelect;
export type DekorProof = typeof dekorProofs.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type GiftCard = typeof giftCards.$inferSelect;
export type DiscountCode = typeof discountCodes.$inferSelect;
export type ShippingCountry = typeof shippingCountries.$inferSelect;
export type Page = typeof pages.$inferSelect;
export type Inquiry = typeof inquiries.$inferSelect;
