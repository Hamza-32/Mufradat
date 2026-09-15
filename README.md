# Mufradat — مُفْرَدَات

Arabic vocabulary for Bengali speakers. Every word carries three layers: the
fully vowelled Arabic, the Bengali meaning, and the English meaning. Learning
happens through FSRS spaced-repetition flashcards, short games, and the
learner's own notes.

Built phone-first — most review sessions happen on a mid-range Android phone on
patchy data — with a separately designed desktop layout for browsing, notes and
stats.

## Status

| Step | Scope                                                      | State       |
| ---- | ---------------------------------------------------------- | ----------- |
| 1    | Repo, TS, Tailwind, CI, Drizzle schema, seed, sample words | done        |
| 2    | Design plan (palette, type, wireframes, self-critique)     | approved    |
| 3    | Design system, script-aware text, app shell                | done        |
| 4    | Google sign-in, guest mode, guest-to-account migration     | done        |
| 5    | Word browse, Arabic search, word detail                    | done        |
| 6    | FSRS review engine, flashcard UI, daily queue              | done        |
| 7    | Games — five of six built (listening needs real audio)     | 5 of 6 done |
| 8    | Notes - markdown editor, tags, search, pinning             | done        |
| 9    | Progress and stats                                         | done        |
| 10   | PWA, offline queue, sync                                   | done        |
| 11   | Content, audio pipeline, deploy                            | partly done |

## Requirements

- Node 20.11+ (CI runs 22)
- A Postgres database — Neon or Supabase free tier, or `postgres:16` locally

## Setup

```bash
npm install
cp .env.example .env        # then fill in DATABASE_URL and the auth values
npm run db:migrate          # apply committed SQL migrations
npm run db:seed             # load content/ into the database (idempotent)
npm run dev
```

`npm install` generates `package-lock.json`; commit it, because CI runs
`npm ci`.

## Environment variables

Every variable is documented in [`.env.example`](./.env.example) and validated
by Zod in `src/env.ts`, so a missing value fails the container start rather than
the first request.

| Variable                                | Required | Notes                                                                   |
| --------------------------------------- | -------- | ----------------------------------------------------------------------- |
| `DATABASE_URL`                          | yes      | Use the **pooled** connection string on Vercel.                         |
| `DATABASE_URL_UNPOOLED`                 | no       | Direct connection, used by migrations. Falls back to `DATABASE_URL`.    |
| `AUTH_SECRET`                           | yes      | `npx auth secret`                                                       |
| `AUTH_URL`                              | no       | Only needed when the deployment URL can't be inferred.                  |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | yes      | Google OAuth client. Redirect URI: `<origin>/api/auth/callback/google`. |
| `UPSTASH_REDIS_REST_URL` / `..._TOKEN`  | no       | Rate limiting. Blank in dev falls back to an in-memory limiter.         |
| `NEXT_PUBLIC_AUDIO_BASE_URL`            | no       | Cloudflare R2 base URL. Blank serves audio from `public/audio`.         |

Zero recurring cost is a hard constraint: every service above has a usable free
tier, and no paid API is called at runtime.

## Scripts

| Command                      | What it does                                                    |
| ---------------------------- | --------------------------------------------------------------- |
| `npm run dev`                | Next dev server                                                 |
| `npm run typecheck`          | `tsc --noEmit`, strict mode with `noUncheckedIndexedAccess`     |
| `npm run test`               | Vitest unit tests                                               |
| `npm run test:e2e`           | Playwright at 390px and 1440px                                  |
| `npm run content:check`      | Validates every content YAML file without touching the database |
| `npm run db:generate`        | Generates a SQL migration from `src/db/schema.ts`               |
| `npm run db:migrate`         | Applies committed migrations from `drizzle/`                    |
| `npm run db:seed`            | Upserts `content/` into the database                            |
| `npm run db:seed -- --prune` | Also deletes rows no longer present in the content files        |

## Content pipeline

Words and decks are versioned YAML in [`content/`](./content), not a CMS. YAML
rather than JSON so a gloss can carry a `# TODO: verify` comment next to the
line it doubts.

```
content/
  words/quranic-core.yaml       13 words
  words/food-and-market.yaml     5 words
  words/people-and-family.yaml   5 words
  words/sky-and-earth.yaml       5 words
  words/verbs-form-i.yaml        5 words
  decks/decks.yaml               5 decks
```

Every file is validated by Zod (`src/content/schema.ts`) before it can reach the
database. The loader also fails on duplicate ids, decks pointing at unknown
words, and English glosses that have landed in a Bengali field, and warns about
words that belong to no deck.

`id` is a content-defined key (`kitab`, `imra-ah`), which is what makes the seed
idempotent: correcting a Bengali gloss and re-seeding updates the existing row,
so every learner's review history for that word survives. Run it on every
deploy.

Anything marked `needsReview: true` in the YAML — or flagged with a
`# TODO: verify` comment — is carried into `words.needs_review` and will be
badged in the editor view for your pass. Three items are flagged today: `ilm`,
`rahmah` and `alima`.

### Arabic search normalisation

`src/lib/arabic/normalize.ts` is the single source of truth, shared by the seed
script, the API routes, and the offline IndexedDB index. Before indexing or
comparing, it strips tashkeel and tatweel and folds `أ إ آ ٱ → ا`, `ى → ي`,
`ة → ه`, `ؤ → و`, `ئ → ي`. The result is stored in `words.arabic_plain`
(indexed) and folded, together with the transliteration, both meanings, the root
and the tags, into `words.search_blob` (GIN trigram index).

Verified end to end: `كتاب`, `كِتَاب`, `kitab`, `kitāb`, `বই` and `book` all
return the same word.

## Design system

Three primitives were added late, when the duplication made the case for them
rather than in advance:

- **`ButtonLink`** shares `buttonStyles` with `Button`, so a link that looks like
  the primary action cannot drift from the button that is one. The same
  seventy-character class string had been copied into eight files.
- **`SearchField`** exists because of `dir="auto"`: a learner typing Arabic must
  see the caret move right to left and a learner typing Bengali must not.
  Getting that wrong in one of the two places it appears would have been
  invisible to whoever wrote the other.
- **`Chip`** replaced two near-identical filter toggles, one of which had
  `aria-pressed` and one of which nearly did not.

`ProgressBar` now backs the review session's progress and the game timer; both
had hand-rolled the same `role="progressbar"` markup, and one of the two was
missing `aria-valuemax`.

Tokens live in `src/app/globals.css` as a Tailwind v4 `@theme` block — one
place, no JavaScript config. Six named colours, a fluid Latin/Bengali scale and
a separate Arabic scale that runs two steps larger, because vowelled naskh at
16px is a blur of harakat on a mid-range phone.

The system is visible on one page at `/design`: palette, type in all three
scripts, controls, and every loading, empty and error state. It is not linked
from the navigation — check it at 360, 414, 768, 1024, 1280 and 1600.

### Two components carry every string

Nothing renders text directly.

- `<ArabicText>` sets `lang="ar"`, `dir="rtl"`, the Naskh face and the
  line-height, so none of the four can be forgotten. It can hide the harakat
  (the learner's toggle, and the harakat game) while still handing the vowelled
  form to a screen reader, and it can rubricate the marks in cinnabar.
- `<GlossText>` handles everything else, picking the face and the `lang` from
  the script rather than the caller's memory, with `dir="auto"` on every block —
  which is what lets the notes editor hold an Arabic paragraph and a Bengali one
  in the same document.

Spacing uses CSS logical properties throughout (`ms-`, `pe-`, `border-s`), so
an RTL subtree lays out correctly without a second stylesheet.

### The shell

Three designed states rather than one that stretches: a bottom bar under 768px,
a 64px icon rail from 768 to 1023, and a persistent 240px sidebar from 1024 —
never a hamburger. `AppShell` takes `chrome={false}` for the review session, so
leaving a session is a deliberate act rather than a stray thumb.

The UI language is a cookie, not a URL prefix: locale-prefixed routes would mean
every word, deck and note URL exists twice, which is a bad trade for an app
whose content is trilingual on every page. Numbers are formatted through ICU, so
the Bengali interface shows Bengali numerals (২৩টি শব্দ) and the English one
shows Western.

Fonts are self-hosted and documented in [`src/fonts/README.md`](./src/fonts/README.md).

## Auth and guest mode

Google only in v1, through Auth.js v5 with the Drizzle adapter, using **database
sessions rather than JWTs**: the cookie carries an opaque token, so signing out
or deleting an account genuinely ends every session instead of leaving signed
tokens valid until they expire.

Guest mode is not a degraded account — it is a full local one, in IndexedDB via
Dexie, with no server identity at all. Nothing leaves the phone until the
learner signs in.

### Migration

`POST /api/account/migrate-guest` moves that local progress into the new
account. Three properties, in order of how much damage their absence would do:

1. **Nothing is lost.** Every review log from the device is kept — the history
   is never reconciled away. Where the account and the device both hold a card
   for the same word (studied as a guest on a phone, already signed in on a
   laptop), the policy in `src/lib/guest/merge.ts` decides: most recently
   reviewed wins, then more repetitions, then higher stability, then the
   account's copy. Twelve unit tests cover it.
2. **Running it twice changes nothing.** Logs and games dedupe on their
   client-generated event id, notes on `notes.client_id`, cards on
   `(user_id, word_id)`. Daily activity and the streak are _recomputed_ from
   the logs rather than accumulated, so a replayed batch cannot inflate either.
   Verified against a real Postgres engine: a replayed log batch inserts zero
   rows, and two consecutive recomputes produce identical activity rows.
3. **The account comes from the session.** The payload contains no user id.
   `requireUser()` in `src/lib/auth/session.ts` is the only place a user id is
   established, and no route reads one from a body, query or header.

The local copy is deleted only after the server acknowledges the final batch.
On failure the learner is told plainly that nothing was lost and offered a
retry — the work stays on the device until it is provably somewhere else.

### Cost of all this on first load: none

Almost every session has no guest data. A localStorage flag answers that
question, and the migration UI — with Radix, Dexie and the batching driver —
is an async chunk fetched only by the one session that needs it. First Load JS
is unchanged at 132 kB.

### Rate limiting

`src/lib/rate-limit.ts` wraps Upstash's free tier with named buckets (grading a
card happens many times a minute; migrating an account happens once an hour).
With no Upstash credentials it falls back to an in-process limiter, so a missing
env var degrades to _still limited_ rather than _not limited at all_, and nobody
needs credentials to run the app locally.

## Review engine

`src/lib/review/` is deliberately split so that the parts that make decisions
are pure and tested, and only the parts that touch storage are not:

| File            | What it does                                                                                                                                                         | Tested       |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `scheduler.ts`  | The only place FSRS is called. Converts our card rows to and from `ts-fsrs`, classifies mastery, previews all four intervals, and computes the learner's local date. | 8 unit tests |
| `queue-core.ts` | Chooses what to show next, as a pure function.                                                                                                                       | 9 unit tests |
| `server.ts`     | Postgres: queue assembly, `applyGrade`.                                                                                                                              | e2e          |
| `adapters.ts`   | Two backends behind one interface — the API for signed-in learners, IndexedDB for guests.                                                                            | e2e          |

Three decisions worth knowing:

- **Fuzz is off.** FSRS normally jitters intervals to spread a day's load, but
  the grade buttons show the real interval under each one. A preview that
  doesn't match what happens is a lie, and predictability matters more here
  than load smoothing.
- **"Again" brings the card back in the same sitting**, three cards later, so
  the learner has to recall it rather than echo it — not scheduled a day out
  and forgotten.
- **New words are sprinkled, not stacked.** One new word every fourth review.
  A block of unfamiliar words at the start is discouraging; a block at the end
  arrives when attention is spent.

Guest mode uses the same scheduler and the same queue builder, so a guest gets
the identical session to a signed-in learner — it is not a lesser product.

Grading is idempotent on a client-generated `clientEventId`, so the offline
queue in step 10 can flush the same batch twice without double-counting. Daily
activity is recomputed from the logs rather than incremented, and the streak
recomputation runs on the first review of a day rather than on every card.

## Offline

The scenario the whole step exists for: a learner on a Dhaka bus with two bars
of signal who wants to do their reviews.

### The outbox

Every write that must not be lost - a grade, a finished game, a note - goes
through `postOrQueue` in `src/lib/offline/outbox.ts`. It posts when it can and
queues in IndexedDB when it cannot, and nothing leaves the queue until the
server has answered.

That layer is deliberately dumb, and it can be, because **every write in this
app has carried a client-generated idempotency key since step 1** - decided
before there was an offline mode, precisely so a flush would never have to
reason about whether a request really went through before the signal died.
Sending the same item twice is harmless.

- Items flush oldest first, because FSRS state depends on the order the grades
  were given.
- Backoff is exponential and capped at a minute; a learner on patchy data should
  not spend their battery on retries.
- A 422 or 400 is dropped with a log rather than retried forever, because an
  unacceptable payload would otherwise sit at the head of the queue blocking
  every review behind it. A 401 is kept: signing in again must not cost someone
  their answers.

Because nothing can be lost, the per-screen "could not save" banners are gone.
There is one status line in the whole interface, and it disappears when the
queue empties.

### The service worker

`src/app/sw.ts`, built by Serwist. What is not cached matters most: auth routes
and every mutating endpoint are network-only, since serving a stale session or
replaying a POST from a cache would be worse than failing.

| Route                                         | Strategy                  | Why                                                                     |
| --------------------------------------------- | ------------------------- | ----------------------------------------------------------------------- |
| `/api/auth/*`, any non-GET                    | Network only              | Identity and writes are never cached                                    |
| `/api/review/queue`, `/api/review/candidates` | Network first, 4s timeout | A slightly stale queue is a study session; no queue is a wasted journey |
| `/api/words`                                  | Stale while revalidate    | Dictionary entries change rarely                                        |
| `/audio/*`                                    | Stale while revalidate    | Pronunciation files are immutable once published                        |

The offline fallback page is built without the app shell on purpose: the shell
reads the session, which means a database call, and the one page that must
render when nothing is available should depend on nothing.

### Installing

`start_url` is `/review`, not `/`. Someone who installed a vocabulary app on
their phone wants to review, not to read a home page.

Icons come from `npm run icons` - a dependency-free script that draws the mark
and encodes the PNG directly (`scripts/make-icons.ts`). The mark is the matra
with three descenders hanging from it and the rubricator's square in cinnabar:
the same motif as the section headings and the active nav indicator, and no
glyph, so it needs no font and reads at 48px on a launcher.

## Progress

Read from `review_logs` and `daily_activity`. The log table has been append-only
since the first migration precisely so this page could exist without anything
having been overwritten on the way here.

**No charting library.** A year of squares is 371 spans of server-rendered
markup, which costs less than the JavaScript a chart library would ship and
stays readable with scripting off. Colour carries intensity only, never
category: one hue, four steps, with the numbers beside each chart saying what
the colour says.

Three decisions worth knowing:

- **Heatmap levels are relative to the learner's own busiest day**, not to a
  fixed number of reviews. Someone doing ten a day should see a full-looking
  year - the heatmap rewards the habit, it does not rank them against a
  stranger.
- **Retention counts only cards already learned.** A word seen for the first
  time cannot be forgotten, and counting those would drag the number down for
  whoever is working hardest. It reads as a dash rather than zero per cent until
  there is something real to measure.
- **A screen reader gets one sentence, not 371 announcements** - the grid is a
  single `role="img"` with a summary, and the cells are hidden from the
  accessibility tree.

The date arithmetic - week alignment, level thresholds, the fourteen-day
forecast window - is pure and tested (15 unit tests), because that is the kind
of code that is wrong for months before anyone notices.

Phone: one column, the year scrolling sideways. Desktop: the year and the
forecast side by side, which is what the width is for - "have I been showing up"
and "what is coming" are better answered together.

## Notes

A markdown editor that has to hold Arabic, Bengali and English in one document,
which is the whole reason it is built the way it is.

**No `dangerouslySetInnerHTML` anywhere in the app.** `src/lib/notes/markdown.ts`
parses to a block tree and the renderer turns that tree into React elements, so
a note containing a script tag is text. Cross-site scripting is structurally
impossible rather than defended against by a sanitiser that has to stay ahead of
the attacks. Links are only made from https, http and mailto; a javascript
target stays visible as literal text rather than being silently dropped, so the
writer can see what they wrote. 15 unit tests.

The supported subset is small on purpose - headings, emphasis, code, lists,
quotes, links, rules. Every feature added is one more thing that has to lay out
correctly in three scripts.

**Direction is content's business, not a setting.** `dir="auto"` sits on the
textarea and on every rendered block, so a line that starts in Arabic lays out
right to left and the Bengali line under it lays out left to right, inside one
note, with the writer marking up nothing.

**There is no save button.** Saving is debounced and keyed on the note's own
client id, so the repeated saves of a learner typing collapse into one row
instead of racing to create several - and closing the tab mid-sentence loses
nothing. Deletes are soft: the row stays as a tombstone so a note deleted on one
device cannot reappear when an older device syncs in step 10.

Phone: the list fills the screen and opening a note covers it. Desktop: list and
editor side by side from 1024px. Guests get notes too, in IndexedDB, and the
step-4 migration already carries them into an account on first sign-in.

## Games

Every game draws from the learner's own review queue and grades through the same
scheduler under its own `review_logs.source`, so playing genuinely counts as
studying — there is no parallel scoring system to reconcile.

`src/lib/games/` holds the parts that make decisions, and they are pure:

- **`scoring.ts`** — how an answer becomes a grade. Clean answer to good, one
  slip to hard, two or more to again. **Never easy**: easy means trivially
  certain, and a four-option tap cannot establish that.
- **`distractors.ts`** — the wrong answers, which are most of the work. Random
  distractors are answerable from vibes, so they come from the target's own root
  first, then its semantic tag, then anywhere: كِتَاب against كَتَبَ and مَكْتَب
  forces a real distinction. 14 unit tests.

Built so far:

| Game              | Board                                                  | Notes                                                                                                                                                               |
| ----------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Match the pairs   | 2x4 on a phone, wider above 768px                      | Tiles stay face up — hiding them would test working memory, not vocabulary. Board size is fixed at the start of the round, so a rotation cannot reshuffle the game. |
| Pick the meaning  | One column, two above 768px                            | 1-4 answer it on a desktop, the same keys that grade a flashcard. A wrong tap does not end the question; the extra mistake is what lowers the grade.                |
| Spelling          | Custom keyboard on touch, physical keyboard on desktop | The input method is the game - see below.                                                                                                                           |
| Harakat challenge | Letter row plus a mark pad                             | The word is shown stripped of its vowels and the learner puts them back.                                                                                            |
| Streak rush       | Three options, sixty seconds                           | No second chances, and the direction alternates.                                                                                                                    |

Streak rush is the only game that does not let a wrong answer be corrected, and
that is the point of it: it measures what the learner knows _without_ working it
out, which is the state Quranic reading actually demands. The prompt direction
alternates between Arabic-to-Bengali and Bengali-to-Arabic, because recall in one
direction is not recall in the other and a sixty-second game should not drill
only half of it. The streak itself is the score - each answer in a run is worth
more than the last, so a run of six feels like a run of six rather than six ones.

Listening is the one game still unbuilt, and deliberately: a listening quiz
voiced by espeak would teach the wrong pronunciation. It needs a piper model or
a human reciter first.

### A bug the audit found

Sweeping for unreferenced exports turned up `getGuestId` in
`src/lib/guest/db.ts`, which nothing called. That was not dead code - it was the
function that mints a guest's device identity, and without it
`summariseGuestData` looked at a device holding a hundred reviews, found no id,
and reported nothing to migrate. **A guest could have studied for a week, signed
in, and silently lost all of it** - the exact failure the whole migration exists
to prevent.

It is now `ensureGuestId`, called from every guest write path, with a fallback in
`summariseGuestData` for databases written by an older build. There is a
regression test in `tests/e2e/offline.spec.ts` that grades one card as a guest
and then reads the identity straight out of IndexedDB.

### The harakat challenge

The exercise that separates reading Arabic from recognising shapes: ذَهَبَ (he
went) and ذَهَب (gold) are the same four letters. It is the one screen in the app
where the vowel marks are the content rather than the typography.

- **Every letter is its own control**, so a screen reader can say which one is
  selected and a thumb has a 44px target for each. Tap a letter, tap a mark.
- **Nothing is marked right or wrong until the learner says they are done.**
  They can work back and forth across the word the way they would on paper, and
  checking is always available because leaving a letter bare is a real answer,
  not an omission.
- **A wrong check clears only the letters that were wrong** and jumps to the
  first of them. What they had right stays put.
- **Tapping the same mark twice removes it** - an undo that needs no button.
  Shadda stacks with a vowel and does not advance the cursor; a vowel does.
- `canonicalMarks` exists because real Arabic text stores shadda-plus-vowel in
  both orders. A test in `harakat.test.ts` fails without it, which is how it was
  found.

Words with no vowels to restore are filtered out before the round starts - there
is no puzzle in them.

### Spelling, and the input problem

Almost nobody in Dhaka has an Arabic keyboard installed, and telling a learner to
install one is telling them not to play. So the game brings its own input, and it
is genuinely different on each form factor rather than one compromise on both.

**On a phone: a custom Arabic keyboard with the vowel marks on the top row.** The
system Arabic keyboard hides tashkeel behind a long press, which is useless when
the vowels are the lesson, and it would cover half the screen. The layout is
alphabetical rather than the standard Arabic QWERTY - that layout is muscle
memory for someone who grew up typing Arabic and a maze for someone learning the
alphabet. Keys fire on `pointerdown`, because a click fires only after the finger
lifts and that lag is perceptible when typing quickly.

**On a desktop: Latin in, Arabic out, as they type.** The scheme is phonetic so
it can be guessed from the transliteration already printed beside every word -
`kitaab` gives كتاب. Capitals mark the emphatics (`S D T Z H`), the one
convention worth learning, because Bengali has no س/ص distinction to fall back
on. The on-screen keyboard is one tap away for the seats the scheme cannot reach.

**Marking has three outcomes, not two.** Right letters with missing or wrong
vowels is real progress and is marked as such: it costs one mistake, and the
vowelled form is held on screen for a moment afterwards, because that is exactly
the thing the learner did not know. Comparison runs through the same normaliser
as search, so writing ا for أ is not failed on an orthographic convention nobody
types.

The timer is derived from a wall-clock start rather than counted in interval
ticks, so a backgrounded tab on a phone cannot hand out extra time.

Listening, spelling, harakat and streak rush are listed on `/games` and marked
as not yet built, rather than hidden.

## Search

Verified end to end against a live database: `kitab`, `kitāb`, `كتاب`,
`كِتَاب`, `বই` and `book` all return the same word, and the bare root `كتب`
returns both `kitab` and `kataba`.

Ranking puts exact matches first, then prefix matches, then everything else,
and sorts by frequency inside each band — so typing `kit` gives you كِتَاب
before a rare word that merely contains those letters.

## Database

16 tables, generated into `drizzle/0000_init.sql` and committed. `pg_trgm` is
created by the first migration: Postgres has no Bengali or Arabic text-search
configuration, and a single note can mix all three scripts, so trigram
similarity is the portable choice.

Two rules the schema enforces:

- **`review_logs` is append-only.** Every grading event, from a review session
  or a game, with its FSRS state as it was, `elapsed_ms`, and the learner's
  local date. The stats page reads only from here; nothing overwrites it.
- **`review_cards` holds live FSRS state only**, one row per learner per word,
  unique on `(user_id, word_id)`.

Offline sync is idempotent by construction: `review_logs` and `game_sessions`
both carry a client-generated `client_event_id` unique per user, so flushing the
same queued batch twice cannot double-count a review.

Day boundaries use the learner's timezone (`user_settings.timezone`, default
`Asia/Dhaka`), not UTC — otherwise a 1 a.m. session in Dhaka would break a
streak.

## CI

`.github/workflows/ci.yml` runs three jobs:

1. **verify** — typecheck, lint, Prettier, unit tests, content validation.
2. **migrations** — applies the committed migrations to a clean Postgres 16,
   seeds, seeds _again_ to prove idempotence, then fails if `schema.ts` has
   drifted from `drizzle/`.
3. **e2e** — Playwright against a production build at 390px and 1440px.

## Content

**181 words across 6 decks**, every gloss written by hand. Short of the 300 the
brief asks for, and deliberately so: the remaining ~120 are the ones where I
would be guessing at Bengali register rather than translating, and a wrong gloss
learned by spaced repetition is worse than a missing one.

| Deck                          | Words |
| ----------------------------- | ----- |
| Quranic vocabulary: first 300 | 53    |
| Particles and connectors      | 34    |
| Verbs: form I                 | 30    |
| Sky and earth                 | 25    |
| Everyday MSA: food and market | 24    |
| People and family             | 21    |

The particles deck is the one I would not cut. Small words, biggest payoff: a
learner who knows every noun in a verse still cannot read it without the words
for in, from, to, not and what.

Four items carry `needsReview` and are badged in the app for your pass: `nafar`,
`ilm`, `rahmah`, `alima`. Frequency ranks are an editorial ordering by how early
a learner is likely to meet a word, not a corpus count - the whole set should be
replaced from a published Quranic frequency list before launch, and every file
says so at the top.

Example sentences exist for the first 28 words only. Extending them is the other
half of the remaining content work.

## Audio

`npm run audio` generates pronunciation MP3s **offline** into
`public/audio/words/`. No TTS is called at runtime and no audio API is called at
all, which is what keeps the running cost at zero and keeps a review session
working with no network.

Two engines, in order of preference:

- **piper** - a neural voice, genuinely listenable. Needs a model; set
  `PIPER_MODEL`. This is what should ship.
- **espeak-ng** - a formant synthesiser: robotic, but it reads tashkeel
  correctly, which is the thing a learner is listening for. A placeholder.

Words are spoken _with_ their vowel marks, on purpose - the learner is checking
whether it is kitab or kutub, and an unvowelled string would let the synthesiser
guess. Output is mono, 64 kbps, 22.05 kHz, silence-trimmed: anything richer is
bytes a learner pays for and cannot hear.

Neither engine is a dependency of the app. With neither installed the script
says so and exits cleanly, and every word without a file shows a disabled play
button reading "no recording yet".

## Deploying

**Vercel.** Import the repo, set the env vars above (`DATABASE_URL` = the pooled
string), and add `npm run db:migrate && npm run db:seed` to the build command.

**Container (Railway / Render / Fly).** A multi-stage `Dockerfile` is committed.
`output: 'standalone'` keeps the runtime stage small - the traced server, not
`node_modules`. Migrations and content ship inside the image so
`npm run db:migrate && npm run db:seed` can run as a release command.

`GET /api/health` backs the container healthcheck. It touches the database on
purpose: a process that is running but cannot reach Postgres is not healthy, it
only looks it.

No business logic imports a Vercel-only primitive - an ESLint rule blocks
`@vercel/functions` - and the database client is `postgres.js` rather than a
provider-specific driver, so the same build runs in both places.

### Before a release

```bash
npm run icons        # regenerate the app icons (CI fails if they are stale)
npm run audio        # pronunciation files, offline
npm run content:check
npm run test && npm run test:e2e
```

Accessibility is checked on every pull request rather than once before a
release: `tests/e2e/a11y.spec.ts` runs axe over eight routes at both 390px and
1440px, contrast rules included.

## Licence and attribution

Application code: MIT. Content glosses are written for this project; Quranic
citations carry a `source` reference. Typefaces are Google's Noto and Amiri
families, all open-licensed — no paid fonts.
