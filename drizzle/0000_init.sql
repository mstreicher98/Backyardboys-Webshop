CREATE TABLE `addresses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_id` integer NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`company` text DEFAULT '' NOT NULL,
	`street` text NOT NULL,
	`zip` text NOT NULL,
	`city` text NOT NULL,
	`country` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`entity_id` integer,
	`label` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_created_idx` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `bike_brands` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bike_brands_name_unique` ON `bike_brands` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `bike_brands_slug_unique` ON `bike_brands` (`slug`);--> statement-breakpoint
CREATE TABLE `bike_models` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`brand_id` integer NOT NULL,
	`name` text NOT NULL,
	`category` text DEFAULT '' NOT NULL,
	`year_from` integer NOT NULL,
	`year_to` integer,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`brand_id`) REFERENCES `bike_brands`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `bike_models_brand_idx` ON `bike_models` (`brand_id`);--> statement-breakpoint
CREATE TABLE `bundle_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bundle_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`bundle_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `cart_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cart_id` text NOT NULL,
	`product_id` integer NOT NULL,
	`variant_id` integer NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`config_key` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`cart_id`) REFERENCES `carts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`variant_id`) REFERENCES `variants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `cart_items_cart_idx` ON `cart_items` (`cart_id`);--> statement-breakpoint
CREATE TABLE `carts` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` integer,
	`country` text DEFAULT 'AT' NOT NULL,
	`discount_code` text,
	`gift_card_codes` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`parent_id` integer,
	`name` text NOT NULL,
	`name_en` text DEFAULT '' NOT NULL,
	`tagline` text DEFAULT '' NOT NULL,
	`tagline_en` text DEFAULT '' NOT NULL,
	`description_html` text DEFAULT '' NOT NULL,
	`description_html_en` text DEFAULT '' NOT NULL,
	`media_id` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`show_in_menu` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_slug_unique` ON `categories` (`slug`);--> statement-breakpoint
CREATE TABLE `counters` (
	`key` text PRIMARY KEY NOT NULL,
	`value` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `customer_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`persistent` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `customer_sessions_customer_idx` ON `customer_sessions` (`customer_id`);--> statement-breakpoint
CREATE TABLE `customer_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`customer_id` integer,
	`purpose` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`password_hash` text,
	`email_verified_at` integer,
	`first_name` text DEFAULT '' NOT NULL,
	`last_name` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`company` text DEFAULT '' NOT NULL,
	`vat_id` text DEFAULT '' NOT NULL,
	`vat_id_valid` integer,
	`vat_id_checked_at` integer,
	`dealer_status` text DEFAULT 'kein' NOT NULL,
	`dealer_discount` integer,
	`locale` text DEFAULT 'de' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`internal_note` text DEFAULT '' NOT NULL,
	`last_login_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customers_email_unique` ON `customers` (`email`);--> statement-breakpoint
CREATE TABLE `dekor_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`order_item_id` integer NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'neu' NOT NULL,
	`title` text NOT NULL,
	`bike` text,
	`final_price` integer,
	`deposit_amount` integer DEFAULT 0 NOT NULL,
	`shipping_amount` integer,
	`revisions` integer DEFAULT 0 NOT NULL,
	`assignee_id` integer,
	`due_date` text,
	`internal_note` text DEFAULT '' NOT NULL,
	`approved_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assignee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `dekor_jobs_order_idx` ON `dekor_jobs` (`order_id`);--> statement-breakpoint
CREATE INDEX `dekor_jobs_status_idx` ON `dekor_jobs` (`status`);--> statement-breakpoint
CREATE TABLE `dekor_proofs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` integer NOT NULL,
	`version` integer NOT NULL,
	`message` text DEFAULT '' NOT NULL,
	`file_ids` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'offen' NOT NULL,
	`customer_note` text DEFAULT '' NOT NULL,
	`decided_at` integer,
	`created_by_id` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `dekor_jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `dekor_proofs_job_idx` ON `dekor_proofs` (`job_id`);--> statement-breakpoint
CREATE TABLE `discount_codes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`kind` text NOT NULL,
	`value` integer DEFAULT 0 NOT NULL,
	`min_order` integer,
	`valid_from` text,
	`valid_until` text,
	`max_uses` integer,
	`used_count` integer DEFAULT 0 NOT NULL,
	`once_per_customer` integer DEFAULT false NOT NULL,
	`category_ids` text DEFAULT '[]' NOT NULL,
	`dealers_allowed` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `discount_codes_code_unique` ON `discount_codes` (`code`);--> statement-breakpoint
CREATE TABLE `discount_redemptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code_id` integer NOT NULL,
	`order_id` integer NOT NULL,
	`email` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`code_id`) REFERENCES `discount_codes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `discount_redemptions_order_idx` ON `discount_redemptions` (`order_id`);--> statement-breakpoint
CREATE TABLE `files` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`original_name` text NOT NULL,
	`mime` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`has_preview` integer DEFAULT false NOT NULL,
	`width` integer,
	`height` integer,
	`source` text NOT NULL,
	`cart_id` text,
	`order_id` integer,
	`user_id` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `files_key_unique` ON `files` (`key`);--> statement-breakpoint
CREATE INDEX `files_order_idx` ON `files` (`order_id`);--> statement-breakpoint
CREATE INDEX `files_cart_idx` ON `files` (`cart_id`);--> statement-breakpoint
CREATE TABLE `gift_card_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gift_card_id` integer NOT NULL,
	`order_id` integer,
	`amount` integer NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`gift_card_id`) REFERENCES `gift_cards`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `gift_cards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`initial_value` integer NOT NULL,
	`balance` integer NOT NULL,
	`order_id` integer,
	`order_item_id` integer,
	`recipient_name` text DEFAULT '' NOT NULL,
	`recipient_email` text DEFAULT '' NOT NULL,
	`message` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sent_at` integer,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gift_cards_code_unique` ON `gift_cards` (`code`);--> statement-breakpoint
CREATE TABLE `inquiries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`subject` text DEFAULT '' NOT NULL,
	`message` text NOT NULL,
	`locale` text DEFAULT 'de' NOT NULL,
	`status` text DEFAULT 'neu' NOT NULL,
	`internal_note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `inquiries_status_idx` ON `inquiries` (`status`);--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`number` text NOT NULL,
	`order_id` integer NOT NULL,
	`payment_id` integer,
	`kind` text NOT NULL,
	`ref_invoice_id` integer,
	`issued_at` integer NOT NULL,
	`net` integer NOT NULL,
	`tax` integer NOT NULL,
	`total` integer NOT NULL,
	`data` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_number_unique` ON `invoices` (`number`);--> statement-breakpoint
CREATE INDEX `invoices_order_idx` ON `invoices` (`order_id`);--> statement-breakpoint
CREATE INDEX `invoices_issued_idx` ON `invoices` (`issued_at`);--> statement-breakpoint
CREATE TABLE `login_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`persistent` integer DEFAULT false NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `mail_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`to` text NOT NULL,
	`subject` text NOT NULL,
	`template` text NOT NULL,
	`status` text NOT NULL,
	`error` text,
	`order_id` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `mail_created_idx` ON `mail_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `media` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text DEFAULT 'bild' NOT NULL,
	`file` text NOT NULL,
	`original_name` text DEFAULT '' NOT NULL,
	`widths` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`size_bytes` integer DEFAULT 0 NOT NULL,
	`alt` text DEFAULT '' NOT NULL,
	`uploaded_by_id` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`uploaded_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_file_unique` ON `media` (`file`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`author` text NOT NULL,
	`user_id` integer,
	`body` text NOT NULL,
	`file_ids` text DEFAULT '[]' NOT NULL,
	`read_by_team_at` integer,
	`read_by_customer_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `messages_order_idx` ON `messages` (`order_id`);--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`product_id` integer,
	`variant_id` integer,
	`kind` text NOT NULL,
	`dekor_type` text,
	`title` text NOT NULL,
	`variant_title` text DEFAULT '' NOT NULL,
	`sku` text DEFAULT '' NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price` integer NOT NULL,
	`line_total` integer NOT NULL,
	`discount_share` integer DEFAULT 0 NOT NULL,
	`is_deposit` integer DEFAULT false NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`stock_moves` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`variant_id`) REFERENCES `variants`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `order_items_order_idx` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`number` integer NOT NULL,
	`token` text NOT NULL,
	`customer_id` integer,
	`email` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`locale` text DEFAULT 'de' NOT NULL,
	`status` text DEFAULT 'zahlung_offen' NOT NULL,
	`payment_status` text DEFAULT 'offen' NOT NULL,
	`payment_method` text NOT NULL,
	`billing_address` text NOT NULL,
	`shipping_address` text,
	`shipping_method` text NOT NULL,
	`shipping_country` text,
	`subtotal` integer NOT NULL,
	`discount_total` integer DEFAULT 0 NOT NULL,
	`shipping_total` integer DEFAULT 0 NOT NULL,
	`tax_total` integer DEFAULT 0 NOT NULL,
	`total` integer NOT NULL,
	`gift_card_total` integer DEFAULT 0 NOT NULL,
	`amount_due` integer NOT NULL,
	`tax_mode` text NOT NULL,
	`tax_case` text NOT NULL,
	`tax_rate` integer DEFAULT 0 NOT NULL,
	`vat_id` text DEFAULT '' NOT NULL,
	`is_dealer` integer DEFAULT false NOT NULL,
	`discount_code` text,
	`customer_note` text DEFAULT '' NOT NULL,
	`internal_note` text DEFAULT '' NOT NULL,
	`paid_at` integer,
	`tracking_carrier` text DEFAULT '' NOT NULL,
	`tracking_number` text DEFAULT '' NOT NULL,
	`tracking_url` text DEFAULT '' NOT NULL,
	`shipped_at` integer,
	`cancelled_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_number_unique` ON `orders` (`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_token_unique` ON `orders` (`token`);--> statement-breakpoint
CREATE INDEX `orders_customer_idx` ON `orders` (`customer_id`);--> statement-breakpoint
CREATE INDEX `orders_email_idx` ON `orders` (`email`);--> statement-breakpoint
CREATE INDEX `orders_status_idx` ON `orders` (`status`);--> statement-breakpoint
CREATE TABLE `page_views` (
	`day` text NOT NULL,
	`path` text NOT NULL,
	`views` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`day`, `path`)
);
--> statement-breakpoint
CREATE TABLE `pages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`title_en` text DEFAULT '' NOT NULL,
	`content_html` text DEFAULT '' NOT NULL,
	`content_html_en` text DEFAULT '' NOT NULL,
	`group` text DEFAULT 'hilfe' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pages_slug_unique` ON `pages` (`slug`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`dekor_job_id` integer,
	`purpose` text NOT NULL,
	`method` text NOT NULL,
	`amount` integer NOT NULL,
	`status` text DEFAULT 'offen' NOT NULL,
	`provider_ref` text,
	`token` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`paid_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payments_token_unique` ON `payments` (`token`);--> statement-breakpoint
CREATE INDEX `payments_order_idx` ON `payments` (`order_id`);--> statement-breakpoint
CREATE INDEX `payments_ref_idx` ON `payments` (`provider_ref`);--> statement-breakpoint
CREATE TABLE `product_bikes` (
	`product_id` integer NOT NULL,
	`model_id` integer NOT NULL,
	`year_from` integer,
	`year_to` integer,
	PRIMARY KEY(`product_id`, `model_id`),
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`model_id`) REFERENCES `bike_models`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `product_bikes_model_idx` ON `product_bikes` (`model_id`);--> statement-breakpoint
CREATE TABLE `product_categories` (
	`product_id` integer NOT NULL,
	`category_id` integer NOT NULL,
	PRIMARY KEY(`product_id`, `category_id`),
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `product_categories_cat_idx` ON `product_categories` (`category_id`);--> statement-breakpoint
CREATE TABLE `product_images` (
	`product_id` integer NOT NULL,
	`media_id` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`product_id`, `media_id`),
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`kind` text DEFAULT 'standard' NOT NULL,
	`dekor_type` text,
	`status` text DEFAULT 'entwurf' NOT NULL,
	`title` text NOT NULL,
	`title_en` text DEFAULT '' NOT NULL,
	`subtitle` text DEFAULT '' NOT NULL,
	`subtitle_en` text DEFAULT '' NOT NULL,
	`description_html` text DEFAULT '' NOT NULL,
	`description_html_en` text DEFAULT '' NOT NULL,
	`options` text DEFAULT '[]' NOT NULL,
	`stock_mode` text DEFAULT 'auf_bestellung' NOT NULL,
	`backorder` integer DEFAULT false NOT NULL,
	`release_date` text,
	`lead_time` text DEFAULT '' NOT NULL,
	`lead_time_en` text DEFAULT '' NOT NULL,
	`upgrade_group_ids` text DEFAULT '[]' NOT NULL,
	`fields` text DEFAULT '[]' NOT NULL,
	`universal_fit` integer DEFAULT false NOT NULL,
	`requires_shipping` integer DEFAULT true NOT NULL,
	`dealer_discountable` integer DEFAULT true NOT NULL,
	`featured` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_slug_unique` ON `products` (`slug`);--> statement-breakpoint
CREATE INDEX `products_status_idx` ON `products` (`status`);--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`user_agent` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_subscriptions_endpoint_unique` ON `push_subscriptions` (`endpoint`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`persistent` integer DEFAULT false NOT NULL,
	`user_agent` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shipping_countries` (
	`code` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_en` text NOT NULL,
	`active` integer DEFAULT false NOT NULL,
	`price` integer DEFAULT 0 NOT NULL,
	`free_from` integer,
	`eu` integer DEFAULT false NOT NULL,
	`vat_rate` integer DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `showcase` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`media_id` integer NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`bike` text DEFAULT '' NOT NULL,
	`product_id` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `testimonials` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`text` text NOT NULL,
	`text_en` text DEFAULT '' NOT NULL,
	`rating` integer DEFAULT 5 NOT NULL,
	`bike` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `upgrade_groups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`name_en` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`description_en` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `upgrade_options` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_id` integer NOT NULL,
	`name` text NOT NULL,
	`name_en` text DEFAULT '' NOT NULL,
	`surcharge` integer DEFAULT 0 NOT NULL,
	`media_id` integer,
	`is_default` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `upgrade_groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`role` text DEFAULT 'mitarbeiter' NOT NULL,
	`password_hash` text NOT NULL,
	`must_change_password` integer DEFAULT true NOT NULL,
	`totp_secret` text,
	`totp_enabled` integer DEFAULT false NOT NULL,
	`totp_last_step` integer,
	`owner` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`notify_email` integer DEFAULT true NOT NULL,
	`notify_push` integer DEFAULT true NOT NULL,
	`last_login_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `variants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`sku` text DEFAULT '' NOT NULL,
	`option_values` text DEFAULT '[]' NOT NULL,
	`price` integer NOT NULL,
	`compare_at_price` integer,
	`dealer_price` integer,
	`stock` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `variants_product_idx` ON `variants` (`product_id`);