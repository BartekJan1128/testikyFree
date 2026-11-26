<img src="assets/icon.svg" width="64" height="64" alt="">

# Testíky

Testovací aplikace pro kámoše: React (Vite) na GitHub Pages a Supabase jako backend. Všechno běží ve free tieru.

**Web:** https://bartekjan1128.github.io/testikyFree/

## Co umí

- **Přihlášení / registrace.** Bez přihlášení se do aplikace nedostaneš. Úplně první registrovaný účet se automaticky stane **adminem**.
- **Testy.** Uživatel vidí jen testy, ke kterým mu admin dal přístup. Otázky můžou mít jednu i víc správných odpovědí. Vyhodnocení proběhne na serveru až po odevzdání a správné odpovědi se do prohlížeče předem vůbec nedostanou.
- **Historie.** Každý pokus se uloží i se snapshotem otázek. V detailu jde filtrovat chybné/správné a **hledat podle ID otázky** (`#123`, `12 15`) nebo podle textu.
- **Žebříček.** Pro každý test se počítá nejlepší pokus každého hráče.
- **Administrace:**
  - vytváření testů (název, popis, míchání otázek/odpovědí, aktivní/skrytý),
  - **import** otázek z JSON nebo CSV (2 CSV formáty, šablony ke stažení, náhled před importem),
  - úprava každé otázky, odpovědi a její správnosti: rychlé přepnutí ✓ jedním klikem, nebo plná editace,
  - **vyhledávání otázek podle ID** nebo textu, filtry „více správných“ a „bez správné odpovědi“,
  - přidělování přístupů: po testech (záložka Přístupy) i po uživatelích (stránka Uživatelé),
  - výsledky všech uživatelů, mazání pokusů, povýšení dalšího admina.

## Formáty importu

**Typy otázek**
- `choice` (výchozí): výběr jedné nebo více správných odpovědí.
- `match`: přiřazování. Položky vlevo a možnosti, které se k nim přetahují. Dvojice se zapisuje `položka => možnost`, buňka bez `=>` je matoucí možnost navíc.

**Formátování textu** (v otázce, odpovědích i vysvětlení): `` `kód` ``, `**tučně**` a blok kódu mezi řádky s ```` ``` ````. Za ```` ``` ```` jde napsat název bloku, třeba ```` ```cisco ````, a ten se ukáže v hlavičce.

**CSV (řádek = otázka)**, oddělovač `;`, `,` nebo tab. Víceřádkový text patří do uvozovek:
```
question;type;A;B;C;D;correct;explanation
Který protokol šifruje vzdálenou správu?;;Telnet;SSH;HTTP;;B;Telnet posílá vše čitelně.
Přiřaď službu k portu.;match;SSH => 22;DNS => 53;HTTPS => 443;8080;;
```

**CSV (řádek = odpověď)**, prázdná buňka otázky znamená další odpověď k předchozí otázce:
```
question;type;answer;correct
Který protokol šifruje vzdálenou správu?;;Telnet;0
;;SSH;1
Přiřaď službu k portu.;match;SSH => 22;
;;DNS => 53;
;;8080;
```

**JSON**
```json
[
  { "question": "Který protokol šifruje vzdálenou správu?", "answers": [{ "text": "Telnet", "correct": false }, { "text": "SSH", "correct": true }] },
  { "question": "Vyber dvě:", "answers": ["Důvěrnost", "Rychlost", "Integrita"], "correct": [1, 3] },
  { "type": "match", "question": "Přiřaď službu k portu.", "pairs": [{ "left": "SSH", "right": "22" }, { "left": "DNS", "right": "53" }], "distractors": ["8080"] }
]
```

## Vývoj

```bash
npm install
npm run dev      # http://localhost:5173/testikyFree/
```

Supabase URL a publishable klíč jsou v `src/lib/supabase.ts`. Klíč je veřejný, data chrání Row Level Security. Jde je přepsat přes `.env` (viz `.env.example`).

Databázové schéma je v `supabase/schema.sql`. Skript je idempotentní, takže ho lze kdykoliv znovu spustit v Supabase SQL editoru.

## Nasazení

Každý push do `main` spustí GitHub Action, která aplikaci sestaví a nasadí na GitHub Pages
(v *Settings → Pages* musí být zdroj nastavený na **GitHub Actions**).
