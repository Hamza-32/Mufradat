# Fonts

Three families, one per script, committed to the repo and served from our own
origin. No Google Fonts request at runtime: zero third-party latency on a
patchy mobile connection, and nothing outside our control on the critical path.

| File                                           | Family                                              | Licence | Bytes  |
| ---------------------------------------------- | --------------------------------------------------- | ------- | ------ |
| `amiri-arabic-400-normal.woff2`                | Amiri, Arabic subset                                | OFL     | 108 kB |
| `noto-serif-bengali-bengali-wght-normal.woff2` | Noto Serif Bengali, Bengali subset, variable weight | OFL     | 191 kB |
| `ibm-plex-sans-latin-400-normal.woff2`         | IBM Plex Sans, Latin subset                         | OFL     | 22 kB  |
| `ibm-plex-sans-latin-600-normal.woff2`         | IBM Plex Sans, Latin subset                         | OFL     | 24 kB  |

Licences are in this directory.

## Provenance

The files are the script subsets published by Fontsource. To refresh them:

```bash
npm i --no-save @fontsource/amiri @fontsource-variable/noto-serif-bengali @fontsource/ibm-plex-sans
cp node_modules/@fontsource/amiri/files/amiri-arabic-400-normal.woff2 src/fonts/
cp node_modules/@fontsource-variable/noto-serif-bengali/files/noto-serif-bengali-bengali-wght-normal.woff2 src/fonts/
cp node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-{400,600}-normal.woff2 src/fonts/
```

Only the script subset of each family is kept. The Latin glyphs inside Amiri
and Noto Serif Bengali are deliberately absent — Latin is always set in Plex,
so those subsets would be dead weight.

## What is not here, and why

- **No bold Amiri.** Bold naskh is a Latin habit; Arabic emphasises with size,
  colour and space. Dropping it saved 100 kB.
- **No Plex medium.** Regular and semibold only. A third weight would be
  another file for a difference nobody can see at 14px.

## Still to do

345 kB of font is preloaded, and the Bengali variable face is 191 kB of it.
Step 11 should subset Noto Serif Bengali to the glyphs the UI and the content
actually use, which should cut it by more than half.
