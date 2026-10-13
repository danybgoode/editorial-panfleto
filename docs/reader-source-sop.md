# Adding a reading source

Use this checklist when a new feed or publisher leaves navigation, promotions, metadata, or a wall in the reading view.

1. Capture one representative article as feed HTML and, when crawling is enabled, extracted page HTML. Include a real body paragraph, title, author, date, images, and comments URL. Record which layer introduced the noise.
2. Prefer a Miniflux feed setting: scraper selector for a consistently bounded article body, URL rewrite for a publisher's text page, or `remove(".selector")` for stable page furniture. Keep publisher-specific selectors with that feed. [Miniflux rules](https://miniflux.app/docs/rules.html)
3. Add a shared reader cleanup rule only when the same bounded pattern occurs across sources. Match whole elements or a distinctive publisher phrase; never drop a generic word from a paragraph. Preserve article prose, images, captions, links, and quotations.
4. Keep author, date, and comments as metadata. If the source repeats them in the body, remove only the duplicate at the start. Discussion links and body text may come from different entries in a story cluster.
5. Add a fixture with the offending text and a false-positive fixture where similar words are genuine article content. Check both the article body and the homepage excerpt. A cleaned body under the thin-content threshold should trigger the existing fetch fallback, not look like a complete article.
6. Run `pnpm exec vitest run --config ./vitest.config.mts tests/int/personalized/readerClean.int.spec.ts tests/int/personalized/ranking.int.spec.ts`, then inspect a real article and its card at mobile and desktop widths. Check that the original-source link and comments still work.

Do not rewrite Miniflux `entries.content` through a script. The reader owns stored content; feed configuration and its fetch processor own extraction, while this app's reader cleanup owns presentation.
