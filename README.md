# NovelFinder · 拾页

A local Chinese novel discovery app. Add books you enjoy, select preferred or blocked reading elements, and get explainable recommendations. The interface draws on Qidian's category navigation and compact book listings while using its own branding and typographic covers.

See [README-zh.md](README-zh.md) for the platform research, scoring rules, public catalog coverage, local database setup and limitations.

## Run locally

Requires Node.js 22.13+.

```sh
npm run install:ci
npm run dev
```

The preview listens on `127.0.0.1:5173` by default. Reader preferences and feedback stay in browser localStorage; the bundled catalog is available even when the local database is unavailable. Initialize the local D1 migrations described in the Chinese README to enable catalog cache updates and on-demand public search.

```sh
npm test
npm run typecheck
npm run build
```

`npm start` runs the built Worker locally on 127.0.0.1. No command above deploys the app. Cloud creation and publication are prohibited by this project's [AGENTS.md](AGENTS.md).

The content-based ranker filters read/dismissed/blocked books, combines tag similarity, explicit preferences and same-author signals, then reranks for diversity and labeled exploration. It does not train on other readers, infer reading duration, or invent platform popularity statistics. Public metadata coverage is partial: the initial catalog contains 771 merged books, with successful snapshots from four platforms. No novel text or paid chapters are included.
