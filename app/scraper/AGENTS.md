# Repository Guidelines

## Project Structure & Module Organization

This package is a small TypeScript scraper built with Playwright. Keep runtime code in `src/`; the current entry point is `src/index.ts`. Compiled output goes to `dist/` and should be treated as generated code. Tooling is defined in `package.json`, `tsconfig.json`, and `vite.config.ts`. Add new scraper helpers next to the feature they support, and keep tests in the same tree as `src/**/*.test.ts`.

## Build, Test, and Development Commands

- `npm run dev`: run the scraper in watch mode with `tsx`.
- `npm run start`: run the current TypeScript entry point once.
- `npm run build`: compile TypeScript into `dist/`.
- `npm run check`: run formatter, linter, and TypeScript checks together.
- `npm run fmt`: apply project formatting with `vp fmt`.
- `npm run lint`: run lint rules with `vp lint`.
- `npm run playwright:install`: install the Chromium browser required by Playwright.
- `npx vitest run`: run tests manually. At the moment this exits with “No test files found” until tests are added.

## Coding Style & Naming Conventions

Use strict TypeScript and ESM imports. Follow the existing 2-space indentation and double-quote style shown in `src/index.ts` and `vite.config.ts`. Prefer small, single-purpose functions and explicit return types for exported or non-trivial helpers. Use `camelCase` for variables/functions, `PascalCase` for types/classes, and descriptive filenames such as `price-parser.ts` or `price-parser.test.ts`.

## Testing Guidelines

Vitest is configured in `vite.config.ts` and discovers `src/**/*.test.ts`. Place unit tests beside the code they cover, and prefer deterministic tests for parsing, selectors, and transformation logic over live-site dependence. No coverage gate is configured yet, but new scraping logic should include tests for success cases and expected failure paths.

## Commit & Pull Request Guidelines

Recent commits use short, imperative, capitalized subjects such as `Add lefthook pre-commit checks`. Keep commits focused and use the same style. For pull requests, include the purpose, key implementation notes, commands you ran (for example `npm run check`), and any scraper-impacting URL or selector changes. Attach logs or screenshots only when they help explain browser automation behavior.

## Security & Configuration Tips

Do not commit credentials, cookies, or local `.env` files. When changing navigation targets, prefer constants and comments that explain why a selector or URL is fragile. Re-run `npm run playwright:install` after fresh setup or Playwright upgrades.
