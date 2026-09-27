# Backyardboys Design – Webshop

Onlineshop für Motorrad-Dekore, Merchandise und Pflegeprodukte mit internem Bereich für das Team.
Eine einzige Anwendung (SvelteKit + SQLite) in einem Docker-Container – der Shop läuft unter
`shop.backyardboys.at`, der interne Bereich unter `admin.backyardboys.at`.

## Was drin ist

**Shop (Deutsch und Englisch, `/en/…`)**
- Kategorien mit Mega-Menü, Suche, Bike-Finder (Marke → Modell → Baujahr)
- Dekore in drei Arten: **Full Custom** (Anzahlung → Entwurf → Freigabe → Restzahlung),
  **Semi Custom** (Vorlage, personalisiert) und **Reprint** (mit früherer Bestellnummer)
- Upgrades **Premium Base / Premium Finish** mit Aufpreisen und Musterbildern
- Personalisierungsfelder je Produkt (Text, Auswahl, Zahl, Datei-Upload, Bike-Angaben) – im Admin frei zusammenstellbar
- Varianten (Größe, Farbe, Duft …), Lagerbestand oder „auf Bestellung“, Nachlieferung, Vorbestellung, Bundles
- Gutscheine (Mehrzweckgutscheine, per Mail an Käufer oder Beschenkte) und Rabattcodes
- Kasse ohne Konto möglich, Firmenkunden mit UID-Prüfung (VIES) und Reverse Charge
- Kundenkonto mit Passwort oder Anmelde-Link: Bestellungen, Rechnungen, Entwürfe freigeben, Nachrichten, Adressen, Händler-Antrag
- Händlerpreise (eigener Preis je Variante oder Rabatt in Prozent)
- Versandkosten je Land, Versandkostenfrei-Grenze, Abholung
- Zahlungsarten: **Stripe** (Karte, Apple/Google Pay, EPS, Klarna, SEPA – was im Stripe-Dashboard aktiv ist),
  **PayPal**, **Überweisung**, Barzahlung bei Abholung. Weitere lassen sich in `src/lib/server/payments/` ergänzen.
- Besucherzählung ohne Cookies

**Interner Bereich**
- Übersicht mit Start-Checkliste, offenen Überweisungen, Aufträgen, niedrigem Lagerstand, Besuchern
- Bestellungen: Zahlung verbuchen, versenden mit Sendungsverfolgung, Abholung, Storno, Erstattung, Nachrichten
- Dekor-Aufträge als Board: Entwürfe hochladen, Endpreis festlegen, Restzahlung anfordern
- Produkte, Kategorien, Base & Finish, Bike-Datenbank, Gutscheine & Rabatte, Kunden & Händler, Anfragen
- Startseite (Titelbild, Texte, Hinweisleiste, Kundenbikes, Bewertungen), Seiten (Info- und Rechtstexte)
- Rechnungen als PDF mit fortlaufender Nummer (Rechnung, Anzahlungs-, Schluss- und Stornorechnung),
  Berichte und Export (CSV und PDF-Sammlung) für die Buchhaltung
- Kleinunternehmer oder Regelbesteuerung umschaltbar, OSS für EU-Privatkunden
- Rollen **Admin** und **Mitarbeiter**, Anmeldung mit Authenticator-App (Pflicht)
- Benachrichtigung bei neuen Bestellungen, Nachrichten und Freigaben per **E-Mail** und **Push aufs Handy**
- Tägliche Sicherung am Server, Herunterladen und Wiederherstellen im Browser

## Lokal starten

Voraussetzung: Node.js 22 oder neuer.

```bash
npm install
npm run dev
```

Der Shop läuft dann unter http://localhost:5190, der interne Bereich unter http://localhost:5190/admin.
Beim ersten Start wird ein Admin-Zugang angelegt; Benutzername und Passwort stehen in der Konsole.
Beim ersten Login werden ein eigenes Passwort und die Authenticator-App eingerichtet.

Zum Ausprobieren gibt es Beispielprodukte und Bike-Modelle:

```bash
npm run demo              # anlegen
npm run demo -- --entfernen   # Demo-Produkte wieder löschen
```

Ohne SMTP-Einstellungen werden E-Mails nicht verschickt, sondern in der Konsole ausgegeben
(und unter Einstellungen → E-Mail protokolliert) – praktisch zum Testen der Links.

Weitere Befehle: `npm run check` (Typprüfung), `npm test` (Tests), `npm run build` (Produktionsversion).

## Auf dem Server (Portainer + Cloudflare Tunnel)

1. **Image**: GitHub Actions baut bei jedem Push auf `main` das Image
   `ghcr.io/mstreicher98/backyardboys-webshop:latest`. Ist das Repository privat, in Portainer unter
   *Registries* `ghcr.io` mit einem GitHub-Token (Recht `read:packages`) hinterlegen – oder das Paket auf GitHub öffentlich stellen.
2. **Tunnel**: Im Cloudflare-Dashboard unter *Networking → Tunnels → Create a tunnel* (Typ *Cloudflared*)
   einen Tunnel anlegen. Beim Schritt *Install connector* nur das lange Token (beginnt mit `eyJ`) kopieren –
   installieren muss man nichts, das übernimmt der Dienst `cloudflared` im Stack.
   Dann im Tunnel unter *Routes → Add route → Published application* zwei Routen anlegen:

   | Subdomain | Domain | Service URL |
   |---|---|---|
   | `shop` | `backyardboys.at` | `http://app:3000` |
   | `admin` | `backyardboys.at` | `http://app:3000` |
3. **Stack**: In Portainer *Stacks → Add stack*, Inhalt von [`portainer-stack.yml`](portainer-stack.yml) einfügen und die
   Variablen setzen (`SHOP_URL`, `ADMIN_URL`, `TUNNEL_TOKEN`, `APP_SECRET`). `APP_SECRET` gut aufbewahren –
   damit sind die Zugangsdaten für Stripe, PayPal und SMTP verschlüsselt.
4. Im Log des Containers `app` steht der erste Admin-Zugang (sofern kein `INITIAL_ADMIN_PASSWORD` gesetzt war).

**Neue Version:** Stack → *Update the stack* mit *Re-pull image and redeploy*. Automatisch geht es, wenn in Portainer
ein Webhook für den Stack angelegt und dessen Adresse als GitHub-Secret `PORTAINER_WEBHOOK_URL` hinterlegt wird.

### Cloudflare Tunnel: wenn es nicht klappt

- **„An A, AAAA, or CNAME record with that host already exists“** beim Anlegen der Route: Die Adresse ist im
  DNS schon vergeben – meist noch vom Prototyp (der hatte eigene Tunnel für `shop` und `admin`).
  Unter *DNS → Records* die Einträge `shop` und `admin` löschen (oder beim alten Tunnel die Routen entfernen)
  und die Route erneut anlegen. Laufen die alten `cloudflared`-Container des Prototyps noch, in Portainer stoppen.
- **Domain steht nicht zur Auswahl**: `backyardboys.at` muss im selben Cloudflare-Konto als Website eingetragen
  sein und die Nameserver von Cloudflare verwenden.
- **Fehler 502 / „Bad gateway“**: `cloudflared` erreicht die App nicht. Die Service URL muss genau
  `http://app:3000` lauten (nicht `https`, nicht `localhost`), und `cloudflared` muss im selben Stack laufen
  wie `app` – ein Tunnel-Container aus einem anderen Stack kennt den Namen `app` nicht.
  Im Log von `app` prüfen, ob die App läuft (Portainer → Container `app` → Logs).
- **Tunnel bleibt „Inactive“ bzw. „Down“**: `TUNNEL_TOKEN` falsch oder unvollständig kopiert. Im Log von
  `cloudflared` steht dann „Unauthorized“ oder „Invalid tunnel secret“.
- **admin.… zeigt den Shop oder leitet im Kreis**: `SHOP_URL` und `ADMIN_URL` im Stack prüfen
  (mit `https://`, ohne Schrägstrich am Ende), danach den Stack neu starten.

Alle Daten (Datenbank, Bilder, Kunden-Dateien, Sicherungen) liegen im Volume `byb-data` unter `/data`.
Beim Entfernen des Stacks das Volume **nicht** mitlöschen.

## Vor dem Livegang

Die Übersicht im Admin zeigt eine Checkliste. Im Detail:

- **Einstellungen → Firma**: Firmenwortlaut, Adresse, Firmenbuchnummer und -gericht, UID (falls vorhanden),
  Gesellschafter, Gewerbe, Behörde, Bankverbindung. Diese Angaben erscheinen auf Rechnungen und im Impressum.
- **Einstellungen → Steuer & Rechnungen**: Kleinunternehmer oder Regelbesteuerung, Präfix der Rechnungsnummer.
- **Einstellungen → Zahlung**:
  - Stripe: geheimer Schlüssel (*Entwickler → API-Schlüssel*) und Webhook (*Entwickler → Webhooks*) mit der Adresse
    `https://shop.backyardboys.at/api/zahlung/stripe` und den Ereignissen `checkout.session.completed`,
    `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`.
    Das *Signing secret* (`whsec_…`) ebenfalls eintragen. Zahlungsarten (EPS, Klarna, Apple Pay …) im Stripe-Dashboard aktivieren.
  - PayPal: Client-ID und Secret aus developer.paypal.com (zuerst mit Sandbox testen).
- **Einstellungen → E-Mail**: SMTP-Zugang des Postfachs `office@backyardboys.at`, danach „Test-E-Mail an mich“.
- **Einstellungen → Versand**: Länder aktivieren, Versandkosten und Frei-ab-Grenze prüfen, Abholadresse.
- **Base & Finish**: Aufpreise festlegen.
- **Bike-Datenbank**: Modelle anlegen (auch als Liste einfügbar).
- **Seiten**: AGB, Widerrufsbelehrung, Datenschutzerklärung und Impressum sind Vorlagen nach österreichischem Recht
  und müssen vor dem Livegang von einer fachkundigen Stelle geprüft werden. Platzhalter wie `{{firma}}` werden automatisch
  mit den Firmendaten gefüllt.
- **Mein Konto**: E-Mail-Adresse hinterlegen und Push-Nachrichten am Handy einschalten
  (iPhone: den Admin-Bereich in Safari über *Teilen → Zum Home-Bildschirm* als App installieren und dort einschalten).

## Sicherungen

Jede Nacht ab 2 Uhr entsteht eine Sicherung unter `/data/backups` (14 werden aufbewahrt). Unter
*Einstellungen → Sicherungen* lassen sie sich herunterladen und wiederherstellen – auch auf einem neuen Server.
Die Zugangsdaten (Stripe, PayPal, SMTP) sind darin verschlüsselt; auf einem neuen Server mit anderem `APP_SECRET`
müssen sie neu eingetragen werden.

## Notfall-Zugang

Handy mit der Authenticator-App verloren und kein anderer Admin da? In Portainer beim Container `app` die
*Console* öffnen und:

```bash
node scripts/zugang.mjs liste
node scripts/zugang.mjs zuruecksetzen admin
```

Das erzeugt ein vorläufiges Passwort und setzt die Zwei-Faktor-Anmeldung zurück.

## Aufbau

```
src/lib/server/db/schema.ts        Datenbank (Drizzle); Änderungen mit `npm run db:generate` als Migration anlegen
src/lib/server/shop/pricing.ts      Preise, Rabatte, Steuer (mit Tests)
src/lib/server/shop/cart.ts         Warenkorb
src/lib/server/shop/orders.ts       Bestellen, Zahlungseingang, Storno
src/lib/server/shop/dekor.ts        Ablauf der Dekor-Aufträge
src/lib/server/shop/invoices.ts     Rechnungen und PDF
src/lib/server/payments/            Zahlungsarten (Stripe, PayPal)
src/lib/server/emails.ts            alle E-Mails
src/routes/(shop)/                  Shop
src/routes/admin/                   interner Bereich
```
