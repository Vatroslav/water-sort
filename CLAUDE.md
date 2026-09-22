# Water Sort - upute za Claude Code

Vanilla JS PWA bez build sustava. Sve u korijenu: `index.html`, `style.css`, `game.js`,
`levels.js`, `audio.js`, `app.js`, `sw.js`, `manifest.webmanifest`.

## Načela

- Bez ovisnosti, bez build koraka, bez frameworka - datoteke se serviraju kakve jesu.
- **Bez reklama, bez trackinga, bez računa.** To je razlog postojanja ove igre (Vatra i Monika
  nisu našli igru ovog žanra bez full-screen reklama). Ne dodavati analitiku ni mrežne pozive
  bez eksplicitnog dogovora.
- Skripte su klasične (`<script src>`, globalni `WSGame` / `WSLevels` / `WSAudio`), ne moduli -
  radi i preko `file://` i preko servera, service worker ostaje trivijalan.
- Hrvatski UI, s dijakriticima.

## Gdje što živi

- Pravila igre su u `game.js` i ne znaju za DOM - mogu se testirati u Nodeu
  (`eval(fs.readFileSync('game.js','utf8'))`).
- Težina razine je `WSLevels.levelConfig(level)`; generator je seedan brojem razine, pa je
  razina N uvijek ista slagalica. Mijenjanje generatora mijenja sve razine.
- Solver (`WSLevels.solve`) vraća: niz poteza, `null` (dokazano nerješivo) ili `undefined`
  (prekid na limitu čvorova). Koristi ga generator (provjera rješivosti) i
  zabrana poteza: potez nakon kojeg je pozicija dokazano nerješiva se ne izvrši (crveni X na
  ciljnoj boci), pa ekrana za game over nema. Zabrana se gasi u Opcijama (`opts.block`). Mijenjanje `solve` mijenja razine.
- Gumb "Potez" koristi `WSLevels.solveShortest` (A*, najkraće rješenje, izbjegava poteze
  koji trgaju hrpu); `solve` mu je samo rezerva ako A* stane na limitu.
- Animacija prelijevanja je u `app.js` (`doPour`): boca se rotira oko svog grla
  (`transform-origin: 50% 0%`), pa grlo ostaje na izračunatoj točki iznad ciljne boce.
  Pozicije se mjere preko `offsetLeft/offsetTop` (bez transformacija), ne `getBoundingClientRect`.
- Glavni izbornik (`#menu`) se otvara pri pokretanju i na gumb ☰ (Igraj, Razine, Opcije); opcije se spremaju u
  `localStorage` pod `ws:opts`. Otključane razine se izvode iz `ws:best` (do prve neriješene), nema zasebnog zapisa.
- Minimum poteza po razini = duljina `solveShortest` (egzaktan, A* heuristika ne precjenjuje),
  trajno cacheiran u `ws:min`. Ocjena u `ws:stars`: 4 = kruna (točno minimum, bez dodatne
  boce), 3 = do 110 %, 2 = do 150 %, 1 = riješeno. Pragovi bez zaokruživanja.

## Ikone

`python scripts/make-icons.py` (Pillow) regenerira `icons/`.

## Deploy

GitHub Pages s `main` brancha, root. Push na `main` je deploy.
