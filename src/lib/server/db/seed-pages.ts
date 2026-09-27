import type { pages } from './schema';

/**
 * Vorlagen für die Info- und Rechtsseiten. Platzhalter in {{…}} werden beim
 * Anzeigen durch die Angaben aus den Einstellungen ersetzt (siehe
 * src/lib/server/textpage.ts), damit Adresse, UID usw. nur an einer Stelle
 * gepflegt werden.
 *
 * WICHTIG: Die Rechtstexte sind sorgfältig erstellte Vorlagen nach
 * österreichischem Recht, ersetzen aber keine Rechtsberatung. Vor dem
 * Livegang von einer fachkundigen Stelle (z. B. WKO-Service, Anwalt) prüfen lassen.
 */

type NewPage = typeof pages.$inferInsert;

const EN_NOTE = '<p><em>This English version is provided for convenience. The German version is legally binding.</em></p>';

export const SEED_PAGES: NewPage[] = [
	/* ================================================================ Bestellung */
	{
		slug: 'bestellvorgang',
		group: 'bestellung',
		sortOrder: 0,
		title: 'Hilfe zum Bestellvorgang',
		titleEn: 'How to order',
		contentHtml: `<h2>So bestellst du</h2>
<ol>
<li><strong>Produkt wählen:</strong> Bei Dekoren wählst du Base und Finish und gibst die Daten zu deinem Bike an. Bei Kleidung wählst du Größe und Farbe.</li>
<li><strong>In den Warenkorb:</strong> Dort kannst du Mengen ändern, einen Rabattcode oder Gutschein eingeben.</li>
<li><strong>Kasse:</strong> Adresse eingeben, Versand oder Abholung wählen und die Zahlungsart aussuchen. Ein Kundenkonto brauchst du nicht.</li>
<li><strong>Bestätigung:</strong> Du bekommst sofort eine E-Mail mit einem Link zu deiner Bestellung. Dort siehst du jederzeit den Stand.</li>
</ol>
<h2>Full Custom Design</h2>
<p>Bei einem Full-Custom-Dekor bezahlst du zuerst nur die Anzahlung. Wir gestalten dein Design nach deinen Wünschen und schicken dir den Entwurf. Du gibst ihn online frei oder sagst uns, was wir ändern sollen – {{korrekturen}} Korrekturschleifen sind inklusive. Nach der Freigabe bekommst du den Link für die Restzahlung (Endpreis abzüglich Anzahlung), danach geht dein Dekor in Produktion.</p>
<h2>Semi Custom und Reprint</h2>
<p>Semi-Custom-Designs basieren auf unseren Vorlagen und werden mit deinen Angaben personalisiert. Für einen Reprint gib bitte die Nummer deiner früheren Bestellung an und was neu gedruckt werden soll.</p>
<h2>Kundenkonto</h2>
<p>Mit einem Konto siehst du alle Bestellungen, Rechnungen und Entwürfe an einem Ort. Bestellungen, die du vorher ohne Konto mit derselben E-Mail-Adresse aufgegeben hast, erscheinen nach der Bestätigung deiner E-Mail-Adresse automatisch in deinem Konto.</p>`,
		contentHtmlEn: `<h2>How to order</h2>
<ol>
<li><strong>Choose a product:</strong> for graphics, pick base and finish and tell us about your bike. For clothing, pick size and colour.</li>
<li><strong>Add to cart:</strong> change quantities, enter a discount code or gift card.</li>
<li><strong>Checkout:</strong> enter your address, choose shipping or pickup and a payment method. No account needed.</li>
<li><strong>Confirmation:</strong> you'll get an email with a link to your order where you can follow its progress.</li>
</ol>
<h2>Full custom design</h2>
<p>For full custom graphics you first pay a deposit. We design your graphics and send you the draft. Approve it online or tell us what to change – {{korrekturen}} revision rounds are included. After approval you'll receive a link for the remaining payment (final price minus deposit), then your graphics go into production.</p>
<h2>Semi custom and reprint</h2>
<p>Semi custom designs are based on our templates and personalised with your details. For a reprint, please enter the number of your earlier order and what should be reprinted.</p>`
	},
	{
		slug: 'versand',
		group: 'bestellung',
		sortOrder: 1,
		title: 'Versandzeiten & Kosten',
		titleEn: 'Shipping times & costs',
		contentHtml: `<h2>Versandkosten</h2>
<p>Wir liefern in folgende Länder. Die Versandkosten enthalten die gesetzliche Umsatzsteuer, sofern diese anfällt.</p>
{{versandtabelle}}
<h2>Lieferzeit</h2>
<p>Die Lieferzeit steht bei jedem Produkt. Dekore werden individuell für dich gefertigt – die Lieferzeit beginnt bei Full-Custom-Dekoren mit der Freigabe des Entwurfs und dem Eingang der Restzahlung. Lagernde Artikel verschicken wir in der Regel innerhalb weniger Werktage nach Zahlungseingang.</p>
<p>Sobald dein Paket unterwegs ist, bekommst du eine E-Mail mit der Sendungsnummer.</p>
<h2>Abholung</h2>
<p>{{abholung}}</p>`,
		contentHtmlEn: `<h2>Shipping costs</h2>
<p>We ship to the following countries. Shipping costs include VAT where applicable.</p>
{{versandtabelle}}
<h2>Delivery time</h2>
<p>The delivery time is shown with each product. Graphics are made to order – for full custom graphics the delivery time starts once you have approved the design and paid the remaining amount. Items in stock usually ship within a few working days after payment.</p>
<p>You'll get an email with the tracking number as soon as your parcel is on its way.</p>
<h2>Pickup</h2>
<p>{{abholung}}</p>`
	},
	{
		slug: 'zahlung',
		group: 'bestellung',
		sortOrder: 2,
		title: 'Zahlung',
		titleEn: 'Payment',
		contentHtml: `<h2>Zahlungsarten</h2>
{{zahlungsarten}}
<h2>Überweisung</h2>
<p>Bei Zahlung per Überweisung bekommst du unsere Bankverbindung in der Bestellbestätigung. Bitte gib die Bestellnummer als Verwendungszweck an. Wir starten mit deiner Bestellung, sobald das Geld bei uns eingelangt ist.</p>
<h2>Gutscheine</h2>
<p>Gutscheine löst du im Warenkorb ein. Ist der Gutschein mehr wert als deine Bestellung, bleibt der Rest auf dem Gutschein.</p>`,
		contentHtmlEn: `<h2>Payment methods</h2>
{{zahlungsarten}}
<h2>Bank transfer</h2>
<p>If you pay by bank transfer, you'll find our bank details in the order confirmation. Please use your order number as reference. We start working on your order as soon as the payment has arrived.</p>
<h2>Gift cards</h2>
<p>Redeem gift cards in your cart. Any remaining value stays on the card.</p>`
	},

	/* ================================================================ Hilfe */
	{
		slug: 'ruecksendung',
		group: 'hilfe',
		sortOrder: 0,
		title: 'Rücksendung',
		titleEn: 'Returns',
		contentHtml: `<h2>Rücksendung</h2>
<p>Standardartikel wie Kleidung, Sticker oder Pflegeprodukte kannst du innerhalb von 14 Tagen ab Erhalt ohne Angabe von Gründen zurückgeben. Alle Details stehen in der <a href="/info/widerruf">Widerrufsbelehrung</a>.</p>
<p><strong>Ausgenommen sind Dekore</strong>, die nach deinen Angaben gefertigt oder personalisiert wurden (Full Custom, Semi Custom, Reprint) – siehe § 18 Abs. 1 Z 3 FAGG.</p>
<h2>So geht's</h2>
<ol>
<li>Schreib uns eine kurze Nachricht an {{email}} mit deiner Bestellnummer.</li>
<li>Schick die Ware ausreichend frankiert an: {{firma}}, {{strasse}}, {{plz}} {{ort}}.</li>
<li>Nach Eingang erstatten wir dir den Betrag innerhalb von 14 Tagen auf dem ursprünglichen Zahlungsweg.</li>
</ol>
<h2>Etwas stimmt nicht?</h2>
<p>Wenn ein Artikel beschädigt ankommt oder nicht passt, obwohl deine Angaben gestimmt haben, melde dich bitte gleich mit Fotos bei uns – wir finden eine Lösung. Deine gesetzlichen Gewährleistungsrechte bleiben davon unberührt.</p>`,
		contentHtmlEn: `<h2>Returns</h2>
<p>You can return standard items such as clothing, stickers or care products within 14 days of receipt without giving a reason. See the <a href="/en/info/widerruf">right of withdrawal</a> for details.</p>
<p><strong>Graphics made to your specifications or personalised</strong> (full custom, semi custom, reprint) cannot be returned (§ 18 (1) 3 FAGG).</p>
<h2>How it works</h2>
<ol>
<li>Send a short message to {{email}} with your order number.</li>
<li>Ship the items with sufficient postage to: {{firma}}, {{strasse}}, {{plz}} {{ort}}, Austria.</li>
<li>We refund you within 14 days via the original payment method.</li>
</ol>
<h2>Something wrong?</h2>
<p>If an item arrives damaged or doesn't fit although your details were correct, contact us right away with photos – we'll find a solution. Your statutory warranty rights remain unaffected.</p>`
	},
	{
		slug: 'faq',
		group: 'hilfe',
		sortOrder: 1,
		title: 'FAQ',
		titleEn: 'FAQ',
		contentHtml: `<h3>Passt das Dekor auf mein Bike?</h3>
<p>Nutze den Bike-Finder: Marke, Modell und Baujahr wählen – dann siehst du alle passenden Dekore. Gib beim Bestellen immer Modell und Baujahr an und beschreibe, falls du nicht originale Kunststoffteile verbaut hast.</p>
<h3>Was ist der Unterschied zwischen Full Custom, Semi Custom und Reprint?</h3>
<p><strong>Full Custom:</strong> Wir gestalten dein Dekor komplett nach deinen Wünschen. <strong>Semi Custom:</strong> Eine unserer Vorlagen, personalisiert mit Namen, Nummer oder Logo. <strong>Reprint:</strong> Wir drucken ein Dekor, das du schon einmal bei uns bestellt hast, erneut.</p>
<h3>Was bedeuten Base und Finish?</h3>
<p>Die Base ist die Grundfolie (z. B. Regular oder Chrome), das Finish die Oberfläche (z. B. glänzend oder matt). Die Aufpreise siehst du direkt bei der Auswahl.</p>
<h3>Wie lange dauert es?</h3>
<p>Die Lieferzeit steht bei jedem Produkt. Bei Full Custom hängt sie zusätzlich davon ab, wie schnell wir uns beim Entwurf einig werden.</p>
<h3>Kann ich mein eigenes Logo verwenden?</h3>
<p>Ja. Lade dein Logo beim Bestellen hoch – am besten als Vektordatei (SVG, AI, EPS oder PDF). Du bestätigst damit, dass du es verwenden darfst.</p>
<h3>Brauche ich ein Kundenkonto?</h3>
<p>Nein. Über den Link in der Bestellbestätigung siehst du deine Bestellung und gibst Entwürfe frei. Mit Konto hast du alles an einem Ort.</p>
<h3>Ich habe eine andere Frage.</h3>
<p>Schreib uns über das <a href="/kontakt">Kontaktformular</a>, per E-Mail an {{email}} oder per WhatsApp.</p>`,
		contentHtmlEn: `<h3>Will the graphics fit my bike?</h3>
<p>Use the bike finder: choose brand, model and year to see all matching graphics. Always enter model and year when ordering, and tell us if you use non-original plastics.</p>
<h3>What's the difference between full custom, semi custom and reprint?</h3>
<p><strong>Full custom:</strong> we design your graphics entirely to your wishes. <strong>Semi custom:</strong> one of our templates, personalised with name, number or logo. <strong>Reprint:</strong> we print graphics you have ordered from us before once again.</p>
<h3>What do base and finish mean?</h3>
<p>The base is the underlying film (e.g. regular or chrome), the finish is the surface (e.g. glossy or matte). Surcharges are shown when you choose.</p>
<h3>How long does it take?</h3>
<p>The delivery time is shown with each product. For full custom it also depends on how quickly we agree on the design.</p>
<h3>Can I use my own logo?</h3>
<p>Yes. Upload your logo when ordering – ideally as a vector file (SVG, AI, EPS or PDF). You confirm that you are allowed to use it.</p>
<h3>Do I need an account?</h3>
<p>No. The link in your order confirmation shows your order and lets you approve designs. With an account you have everything in one place.</p>
<h3>Other questions?</h3>
<p>Use the <a href="/en/contact">contact form</a>, email {{email}} or message us on WhatsApp.</p>`
	},

	/* ================================================================ Rechtliches */
	{
		slug: 'agb',
		group: 'rechtliches',
		sortOrder: 0,
		title: 'Allgemeine Geschäftsbedingungen',
		titleEn: 'Terms and conditions',
		contentHtml: `<h2>1. Geltungsbereich</h2>
<p>Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für alle Bestellungen im Onlineshop von {{firma}}, {{strasse}}, {{plz}} {{ort}} ({{marke}}, im Folgenden „wir“). Abweichende Bedingungen des Kunden gelten nur, wenn wir ihnen ausdrücklich schriftlich zustimmen. Verbraucher im Sinne dieser AGB ist jede Person, für die das Geschäft nicht zum Betrieb ihres Unternehmens gehört (§ 1 KSchG).</p>
<h2>2. Vertragsabschluss</h2>
<p>Die Darstellung der Produkte im Shop ist kein verbindliches Angebot. Mit dem Klick auf „Zahlungspflichtig bestellen“ gibst du ein verbindliches Angebot ab. Wir bestätigen den Eingang per E-Mail; der Vertrag kommt mit dieser Bestellbestätigung zustande. Die Vertragssprache ist Deutsch. Den Vertragstext speichern wir; du findest deine Bestelldaten jederzeit über den Link in der Bestätigungsmail bzw. in deinem Kundenkonto.</p>
<h2>3. Preise</h2>
<p>Alle Preise sind Endpreise in Euro. {{steuerhinweis}} Versandkosten werden vor Abschluss der Bestellung angezeigt. Für Unternehmer mit gültiger UID-Nummer in einem anderen EU-Mitgliedstaat erfolgt die Lieferung netto (Reverse Charge), bei Lieferungen außerhalb der EU netto als Ausfuhrlieferung; allfällige Einfuhrabgaben trägt der Empfänger.</p>
<h2>4. Individuelle Dekore</h2>
<p><strong>Full Custom:</strong> Mit der Bestellung leistest du eine Anzahlung. Wir erstellen einen Entwurf nach deinen Angaben und stellen ihn dir online zur Freigabe bereit. {{korrekturen}} Korrekturschleifen sind im Preis enthalten; weitere Änderungen verrechnen wir nach vorheriger Absprache. Nach deiner Freigabe teilen wir dir den Endpreis mit, der sich nach Umfang und gewählten Upgrades richtet; die Anzahlung wird angerechnet. Die Produktion beginnt nach Eingang der Restzahlung. Kommt es trotz unserer Bemühungen zu keiner Einigung über den Entwurf, kann jede Seite vom Vertrag zurücktreten; die Anzahlung deckt dann den bereits geleisteten Gestaltungsaufwand und wird nicht erstattet.</p>
<p><strong>Semi Custom und Reprint:</strong> Wir fertigen das Dekor nach der gewählten Vorlage bzw. dem früheren Auftrag mit deinen Angaben.</p>
<p><strong>Deine Angaben:</strong> Für die Passgenauigkeit sind korrekte Angaben zu Marke, Modell, Baujahr und verbauten Kunststoffteilen nötig. Bitte prüfe den Entwurf sorgfältig, insbesondere Schreibweisen, Nummern und Farben – mit deiner Freigabe gilt der Entwurf als genehmigt. Geringe Farbabweichungen zwischen Bildschirmdarstellung und Druck sind technisch bedingt und stellen keinen Mangel dar.</p>
<p><strong>Rechte an Vorlagen:</strong> Mit dem Hochladen von Logos, Bildern oder Texten bestätigst du, dass du zu deren Verwendung berechtigt bist, und hältst uns gegenüber Ansprüchen Dritter schad- und klaglos. Unsere Entwürfe und Designs bleiben unser geistiges Eigentum; du erhältst das Recht, das gelieferte Dekor bestimmungsgemäß zu verwenden.</p>
<h2>5. Lieferung</h2>
<p>Wir liefern in die im Shop angeführten Länder. Die Lieferzeit ist beim jeweiligen Produkt angegeben. Bei vorbestellten Artikeln beginnt die Lieferzeit mit dem angegebenen Erscheinungstermin. Die Gefahr geht bei Verbrauchern mit der Übergabe an den Kunden über.</p>
<h2>6. Zahlung</h2>
<p>Die verfügbaren Zahlungsarten werden an der Kasse angezeigt. Bei Vorkasse per Überweisung ist der Betrag innerhalb von {{ueberweisungstage}} Tagen zu bezahlen; danach können wir die Bestellung stornieren. Bei Online-Zahlungen, die nicht abgeschlossen werden, wird die Bestellung automatisch storniert.</p>
<h2>7. Eigentumsvorbehalt</h2>
<p>Die Ware bleibt bis zur vollständigen Bezahlung unser Eigentum.</p>
<h2>8. Rücktrittsrecht</h2>
<p>Verbrauchern steht ein Rücktrittsrecht nach Maßgabe der <a href="/info/widerruf">Widerrufsbelehrung</a> zu. <strong>Kein Rücktrittsrecht besteht bei Waren, die nach Kundenspezifikationen angefertigt werden oder eindeutig auf die persönlichen Bedürfnisse zugeschnitten sind</strong> (§ 18 Abs. 1 Z 3 FAGG) – das betrifft insbesondere alle Full-Custom-, Semi-Custom- und Reprint-Dekore.</p>
<h2>9. Gewährleistung</h2>
<p>Es gilt die gesetzliche Gewährleistung. Bitte melde Mängel möglichst rasch mit Fotos an {{email}}. Keine Mängel sind Schäden durch unsachgemäße Montage oder Reinigung sowie übliche Abnutzung.</p>
<h2>10. Haftung</h2>
<p>Wir haften für Schäden nur bei Vorsatz und grober Fahrlässigkeit; dies gilt nicht für Personenschäden und nicht, soweit zwingende Bestimmungen (etwa das Produkthaftungsgesetz) entgegenstehen.</p>
<h2>11. Gutscheine</h2>
<p>Gutscheine sind nicht gegen Bargeld einlösbar. Ein Restguthaben bleibt erhalten. Gekaufte Gutscheine sind vom Rücktrittsrecht umfasst, solange sie nicht eingelöst wurden.</p>
<h2>12. Händler</h2>
<p>Händlerpreise gelten nur für freigeschaltete Unternehmer. Für Unternehmer gelten die Bestimmungen dieser AGB mit der Maßgabe, dass das Rücktrittsrecht nicht besteht und Mängel unverzüglich nach Erhalt zu rügen sind (§ 377 UGB).</p>
<h2>13. Recht und Gerichtsstand</h2>
<p>Es gilt österreichisches Recht unter Ausschluss des UN-Kaufrechts. Bei Verbrauchern gilt diese Rechtswahl nur, soweit dadurch nicht der Schutz zwingender Bestimmungen des Staates ihres gewöhnlichen Aufenthalts entzogen wird. Für Unternehmer ist Gerichtsstand das sachlich zuständige Gericht an unserem Sitz.</p>
<h2>14. Streitbeilegung</h2>
<p>Wir sind nicht verpflichtet und nicht bereit, an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen. Bei Fragen oder Problemen melde dich gerne direkt bei uns: {{email}}.</p>`,
		contentHtmlEn: `${EN_NOTE}
<h2>1. Scope</h2>
<p>These terms apply to all orders in the online shop of {{firma}}, {{strasse}}, {{plz}} {{ort}}, Austria ({{marke}}, "we").</p>
<h2>2. Contract</h2>
<p>Product listings are not binding offers. By clicking "Place order" you make a binding offer; the contract is concluded with our order confirmation by email.</p>
<h2>3. Prices</h2>
<p>All prices are final prices in euros. {{steuerhinweis}} Shipping costs are shown before you place your order.</p>
<h2>4. Custom graphics</h2>
<p>Full custom: you pay a deposit when ordering. We create a draft and make it available online for approval; {{korrekturen}} revision rounds are included. After approval we tell you the final price, the deposit is credited, and production starts after the remaining payment. Please check drafts carefully – your approval counts as acceptance. Slight colour differences between screen and print are not a defect. By uploading logos or images you confirm you are entitled to use them.</p>
<h2>5. Delivery and payment</h2>
<p>We ship to the countries listed in the shop. Bank transfers are due within {{ueberweisungstage}} days. Unfinished online payments lead to automatic cancellation.</p>
<h2>6. Right of withdrawal</h2>
<p>Consumers may withdraw according to the <a href="/en/info/widerruf">withdrawal information</a>. <strong>There is no right of withdrawal for goods made to customer specifications or clearly personalised</strong> – this includes all full custom, semi custom and reprint graphics.</p>
<h2>7. Warranty, liability, law</h2>
<p>Statutory warranty applies. Austrian law applies, excluding the UN Convention on Contracts for the International Sale of Goods; mandatory consumer protection of your country of residence remains unaffected.</p>`
	},
	{
		slug: 'widerruf',
		group: 'rechtliches',
		sortOrder: 1,
		title: 'Widerrufsbelehrung',
		titleEn: 'Right of withdrawal',
		contentHtml: `<h2>Widerrufsrecht</h2>
<p>Du hast das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag, an dem du oder ein von dir benannter Dritter, der nicht der Beförderer ist, die Waren in Besitz genommen hast bzw. hat. Bei mehreren Waren einer Bestellung, die getrennt geliefert werden, beginnt die Frist mit Erhalt der letzten Ware.</p>
<p>Um dein Widerrufsrecht auszuüben, musst du uns ({{firma}}, {{strasse}}, {{plz}} {{ort}}, E-Mail: {{email}}, Telefon: {{telefon}}) mittels einer eindeutigen Erklärung (z. B. ein mit der Post versandter Brief oder eine E-Mail) über deinen Entschluss, diesen Vertrag zu widerrufen, informieren. Du kannst dafür das unten stehende Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist. Zur Wahrung der Widerrufsfrist reicht es aus, dass du die Mitteilung vor Ablauf der Frist absendest.</p>
<h2>Folgen des Widerrufs</h2>
<p>Wenn du diesen Vertrag widerrufst, haben wir dir alle Zahlungen, die wir von dir erhalten haben, einschließlich der Lieferkosten (mit Ausnahme der zusätzlichen Kosten, die sich daraus ergeben, dass du eine andere Art der Lieferung als die von uns angebotene, günstigste Standardlieferung gewählt hast), unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über deinen Widerruf bei uns eingegangen ist. Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das du bei der ursprünglichen Transaktion eingesetzt hast, es sei denn, mit dir wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden dir wegen dieser Rückzahlung Entgelte berechnet. Wir können die Rückzahlung verweigern, bis wir die Waren wieder zurückerhalten haben oder bis du den Nachweis erbracht hast, dass du die Waren zurückgesandt hast, je nachdem, welches der frühere Zeitpunkt ist.</p>
<p>Du hast die Waren unverzüglich und in jedem Fall spätestens binnen vierzehn Tagen ab dem Tag, an dem du uns über den Widerruf dieses Vertrags unterrichtest, an uns zurückzusenden oder zu übergeben. Die Frist ist gewahrt, wenn du die Waren vor Ablauf der Frist von vierzehn Tagen absendest. Du trägst die unmittelbaren Kosten der Rücksendung der Waren. Du musst für einen etwaigen Wertverlust der Waren nur aufkommen, wenn dieser Wertverlust auf einen zur Prüfung der Beschaffenheit, Eigenschaften und Funktionsweise der Waren nicht notwendigen Umgang mit ihnen zurückzuführen ist.</p>
<h2>Ausschluss des Widerrufsrechts</h2>
<p>Das Widerrufsrecht besteht nicht bei Verträgen über Waren, die nach Kundenspezifikationen angefertigt werden oder eindeutig auf die persönlichen Bedürfnisse zugeschnitten sind (§ 18 Abs. 1 Z 3 FAGG). Das betrifft insbesondere <strong>alle Full-Custom-, Semi-Custom- und Reprint-Dekore</strong> sowie personalisierte Artikel. Bei Hygieneartikeln in versiegelter Verpackung erlischt das Widerrufsrecht, wenn die Versiegelung nach der Lieferung entfernt wurde (§ 18 Abs. 1 Z 5 FAGG).</p>
<h2>Muster-Widerrufsformular</h2>
<p>(Wenn du den Vertrag widerrufen willst, fülle bitte dieses Formular aus und sende es zurück.)</p>
<blockquote><p>An {{firma}}, {{strasse}}, {{plz}} {{ort}}, E-Mail: {{email}}</p>
<p>Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den Kauf der folgenden Waren (*):<br>__________________________________</p>
<p>Bestellt am (*) / erhalten am (*): ______________<br>Bestellnummer: ______________<br>Name des/der Verbraucher(s): ______________<br>Anschrift des/der Verbraucher(s): ______________<br>Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier): ______________<br>Datum: ______________</p>
<p>(*) Unzutreffendes streichen.</p></blockquote>`,
		contentHtmlEn: `${EN_NOTE}
<h2>Right of withdrawal</h2>
<p>You have the right to withdraw from this contract within fourteen days without giving any reason. The withdrawal period expires fourteen days after the day on which you, or a third party other than the carrier indicated by you, take physical possession of the goods.</p>
<p>To exercise your right of withdrawal, inform us ({{firma}}, {{strasse}}, {{plz}} {{ort}}, Austria, email: {{email}}, phone: {{telefon}}) by an unequivocal statement (e.g. a letter or email). You may use the model form below, but it is not obligatory.</p>
<h2>Effects of withdrawal</h2>
<p>We will reimburse all payments received from you, including standard delivery costs, without undue delay and not later than fourteen days from the day we are informed of your decision, using the same means of payment. We may withhold reimbursement until we have received the goods back or you have supplied proof of having sent them. You bear the direct cost of returning the goods.</p>
<h2>Exclusion</h2>
<p>There is no right of withdrawal for goods made to the consumer's specifications or clearly personalised – in particular <strong>all full custom, semi custom and reprint graphics</strong>.</p>
<h2>Model withdrawal form</h2>
<blockquote><p>To {{firma}}, {{strasse}}, {{plz}} {{ort}}, Austria, email: {{email}}</p>
<p>I/We (*) hereby give notice that I/We (*) withdraw from my/our (*) contract of sale of the following goods (*): ______________<br>Ordered on (*) / received on (*): ______________<br>Order number: ______________<br>Name and address of consumer(s): ______________<br>Signature (only if this form is notified on paper), date: ______________</p>
<p>(*) Delete as appropriate.</p></blockquote>`
	},
	{
		slug: 'datenschutz',
		group: 'rechtliches',
		sortOrder: 2,
		title: 'Datenschutzerklärung',
		titleEn: 'Privacy policy',
		contentHtml: `<h2>Verantwortlicher</h2>
<p>{{firma}}, {{strasse}}, {{plz}} {{ort}}, E-Mail: {{email}}, Telefon: {{telefon}}.</p>
<h2>Welche Daten wir verarbeiten und warum</h2>
<h3>Bestellungen</h3>
<p>Für die Abwicklung deiner Bestellung verarbeiten wir Name, Anschrift, E-Mail-Adresse, Telefonnummer (optional), bestellte Artikel, deine Angaben zum Bike, hochgeladene Dateien (z. B. Fotos, Logos) sowie Zahlungs- und Versandinformationen. Rechtsgrundlage ist die Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO). Rechnungs- und Buchhaltungsdaten bewahren wir aufgrund gesetzlicher Pflichten (§ 132 BAO, § 212 UGB) sieben Jahre auf (Art. 6 Abs. 1 lit. c DSGVO).</p>
<h3>Kundenkonto</h3>
<p>Wenn du ein Konto anlegst, speichern wir deine Kontodaten und Adressen, bis du das Konto löschen lässt. Passwörter speichern wir nur als sicheren Hash.</p>
<h3>Kontaktformular und E-Mail</h3>
<p>Nachrichten an uns verarbeiten wir zur Beantwortung deiner Anfrage (Art. 6 Abs. 1 lit. b bzw. f DSGVO) und löschen sie, wenn sie nicht mehr benötigt werden.</p>
<h3>Händler</h3>
<p>Bei einer Händleranfrage prüfen wir die angegebene UID-Nummer über das MIAS/VIES-System der EU-Kommission (Art. 6 Abs. 1 lit. c DSGVO).</p>
<h2>Cookies und Statistik</h2>
<p>Wir setzen nur technisch notwendige Cookies: für den Warenkorb, die Anmeldung im Kundenkonto und – nach einer Zahlung – für den Rücksprung zur Bestellung. Es gibt keine Werbe- oder Tracking-Cookies. Für eine einfache Besucherstatistik zählen wir Seitenaufrufe je Tag und Seite, ohne Cookies, ohne IP-Adresse und ohne Profile.</p>
<h2>Empfänger und Auftragsverarbeiter</h2>
<ul>
<li><strong>Hosting:</strong> Der Shop läuft auf einem Server, den wir selbst betreiben. Der Zugang aus dem Internet erfolgt über Cloudflare, Inc. (USA; Cloudflare Tunnel). Cloudflare verarbeitet dabei technische Verbindungsdaten wie IP-Adressen. Cloudflare ist unter dem EU-US Data Privacy Framework zertifiziert; zusätzlich bestehen Standardvertragsklauseln.</li>
<li><strong>Stripe</strong> (Stripe Payments Europe Ltd., Irland) bei Zahlung mit Karte, EPS, Klarna, SEPA und ähnlichen Zahlungsarten. Stripe kann Daten auch in die USA übermitteln (Data Privacy Framework).</li>
<li><strong>PayPal</strong> (PayPal (Europe) S.à r.l. et Cie, S.C.A., Luxemburg) bei Zahlung mit PayPal.</li>
<li><strong>E-Mail-Versand</strong> über unseren E-Mail-Anbieter.</li>
<li><strong>Versanddienstleister</strong> erhalten Name und Lieferadresse, soweit für die Zustellung nötig.</li>
<li>Unsere <strong>Steuerberatung</strong> erhält Rechnungsdaten zur Erfüllung gesetzlicher Pflichten.</li>
</ul>
<h2>Kundenbikes</h2>
<p>Fotos deines Bikes zeigen wir in der Galerie nur mit deiner ausdrücklichen Zustimmung (Art. 6 Abs. 1 lit. a DSGVO), die du jederzeit widerrufen kannst.</p>
<h2>Deine Rechte</h2>
<p>Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Wende dich dafür an {{email}}. Wenn du glaubst, dass die Verarbeitung deiner Daten gegen das Datenschutzrecht verstößt, kannst du dich bei der Österreichischen Datenschutzbehörde (Barichgasse 40–42, 1030 Wien, www.dsb.gv.at) beschweren.</p>`,
		contentHtmlEn: `${EN_NOTE}
<h2>Controller</h2>
<p>{{firma}}, {{strasse}}, {{plz}} {{ort}}, Austria, email: {{email}}, phone: {{telefon}}.</p>
<h2>What we process and why</h2>
<p>To handle your order we process name, address, email, phone (optional), ordered items, bike details, uploaded files and payment and shipping information (Art. 6 (1) (b) GDPR). Invoices and accounting records are kept for seven years as required by Austrian law (Art. 6 (1) (c) GDPR). Account data is kept until you ask us to delete your account. Messages via the contact form are used to answer your request.</p>
<h2>Cookies and statistics</h2>
<p>We only use technically necessary cookies (cart, login). No advertising or tracking cookies. Our visitor statistics count page views per day without cookies, IP addresses or profiles.</p>
<h2>Recipients</h2>
<p>Cloudflare, Inc. (USA, network access to our server), Stripe Payments Europe Ltd. (Ireland) and PayPal (Europe) S.à r.l. et Cie, S.C.A. (Luxembourg) for payments, our email provider, shipping carriers and our tax advisor.</p>
<h2>Your rights</h2>
<p>You have the right of access, rectification, erasure, restriction, data portability and objection – contact {{email}}. You may lodge a complaint with the Austrian Data Protection Authority (www.dsb.gv.at).</p>`
	},
	{
		slug: 'impressum',
		group: 'rechtliches',
		sortOrder: 3,
		title: 'Impressum',
		titleEn: 'Legal notice',
		contentHtml: `<h2>Angaben gemäß § 5 ECG, § 14 UGB und § 25 MedienG</h2>
<p><strong>{{firma}}</strong><br>{{strasse}}<br>{{plz}} {{ort}}<br>{{land}}</p>
<p>E-Mail: {{email}}<br>Telefon: {{telefon}}</p>
<p>Rechtsform: Offene Gesellschaft (OG)<br>Firmenbuchnummer: {{fn}}<br>Firmenbuchgericht: {{gericht}}<br>UID-Nummer: {{uid}}<br>Vertretungsbefugte Gesellschafter: {{vertretung}}</p>
<p>Mitglied der {{kammer}}<br>Gewerbe: {{gewerbe}}<br>Gewerbebehörde: {{behoerde}}<br>Anwendbare Rechtsvorschriften: Gewerbeordnung, abrufbar unter www.ris.bka.gv.at</p>
<h2>Offenlegung gemäß § 25 MedienG</h2>
<p>Medieninhaber: {{firma}}, {{strasse}}, {{plz}} {{ort}}.<br>Unternehmensgegenstand: Gestaltung, Herstellung und Vertrieb von Motorrad-Dekoren, Bekleidung und Zubehör.<br>Grundlegende Richtung: Information über Produkte und Leistungen von {{marke}} sowie deren Verkauf.</p>`,
		contentHtmlEn: `<h2>Legal notice</h2>
<p><strong>{{firma}}</strong><br>{{strasse}}<br>{{plz}} {{ort}}, Austria</p>
<p>Email: {{email}}<br>Phone: {{telefon}}</p>
<p>Legal form: general partnership (OG)<br>Company register number: {{fn}}, {{gericht}}<br>VAT ID: {{uid}}<br>Authorised representatives: {{vertretung}}</p>
<p>Member of the {{kammer}}. Trade: {{gewerbe}}. Supervisory authority: {{behoerde}}. Applicable regulations: Austrian Trade Regulation Act (www.ris.bka.gv.at).</p>`
	}
];
