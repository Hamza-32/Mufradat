# Content

Words and decks as versioned YAML. Validate with `npm run content:check`.

Fields worth knowing:

- `arabic` — fully vowelled headword, written **without** tanwīn (`كِتَاب`, not
  `كِتَابٌ`), because that is how a learner meets it in a wordlist.
- `bn` — Bengali glosses, plain Bengali word first, then the borrowed Arabic
  form a Bangladeshi learner already knows (`["বই", "কিতাব"]`). The first gloss
  is what the flashcard shows.
- `needsReview: true` — the Bengali is not yet confirmed. Add a
  `# TODO: verify` comment on the same line saying what you doubt.
- `root` — spaced letters, `"ك ت ب"`. The seed derives the folded lookup key.
- `frequencyRank` — lower is commoner. Currently a rough editorial ordering, to
  be replaced from a published frequency list.
