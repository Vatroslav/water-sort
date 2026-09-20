# Water Sort

Slagalica s prelijevanjem obojane tekućine: prelij tako da svaka boca na kraju ima samo jednu boju.

**Bez reklama, bez računa, bez interneta.** Instalira se na telefon kao aplikacija i radi offline.

## Pravila

- Tapni bocu iz koje prelijevaš, pa bocu u koju prelijevaš.
- Tekućina se smije preliti samo na istu boju ili u praznu bocu.
- Prelije se cijeli niz iste boje s vrha - koliko stane.
- Boca je gotova kad je puna jedne boje.

## Značajke

- Razine idu redom i postaju teže (od 3 do 12 boja); svaka peta razina od 15. nadalje je tijesna - manje boja, ali samo jedna prazna boca
- **Svaka razina je provjereno rješiva** - generator odbacuje razmještaje koje solver ne uspije riješiti
- Ista razina je uvijek ista slagalica (seedani generator), pa "Ponovno" vraća identičnu početnu poziciju
- Neograničeni **Vrati** (undo), **Ponovno**, jedna dodatna prazna **Boca** po razini
- **Potez** - solver pokaže sljedeći potez koji vodi do rješenja
- **Prepoznaje zaglavljenu poziciju** - čim solver dokaže da se iz trenutne pozicije više ne može doći do rješenja, igra sama javi i ponudi izlaz (vrati potez, dodaj praznu bocu, kreni ispočetka); provjera se vrti nakon svakog poteza
- Pamti razinu, potez i najbolji rezultat po razini (localStorage)
- Zvuk se sintetizira u WebAudiju - nema audio datoteka

## Instalacija na telefon

PWA treba HTTPS ili `localhost`.

1. Otvori `https://vatroslav.github.io/water-sort/` u Chromeu na telefonu
2. Izbornik (⋮) → **Add to Home screen**

Lokalni test na PC-u (Git Bash, u korijenu repoa `~/github/water-sort`):

```bash
cd ~/github/water-sort && python -m http.server 8000
```

pa otvori `http://localhost:8000`.

## Struktura

| Datoteka | Sadržaj |
| --- | --- |
| `game.js` | pravila - stanje, legalni potezi, prelijevanje, provjera rješenja |
| `levels.js` | paleta, težina po razini, generator i solver (DFS s memoizacijom) |
| `app.js` | UI, animacija prelijevanja, čestice, spremanje |
| `audio.js` | WebAudio sinteza zvukova |
| `sw.js` | service worker (network-first, cache kao offline fallback) |
| `scripts/make-icons.py` | generiranje PWA ikona |
