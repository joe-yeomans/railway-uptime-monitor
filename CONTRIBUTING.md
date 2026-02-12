# Contributing

Thanks for contributing to railway-uptime-monitor.

## Getting started

1. Fork the repository and create a feature branch.
2. Install dependencies:
   - `bun install`
3. Copy environment variables:
   - `cp .env.example .env`
4. Fill required Railway variables in `.env`.

## Development workflow

1. Start the monitor locally:
   - `bun run dev`
2. Run migrations only (optional):
   - `bun run migrate`
3. Regenerate GraphQL types when query/schema changes:
   - `bun run codegen`

## Quality checks

Run before opening a pull request:

- `bun run check`

This runs:

- TypeScript type checking
- Biome linting
- Biome formatting checks

If lint or formatting fails, run:

- `bun run lint:fix`
- `bun run format`

## Pull request guidelines

1. Keep PRs focused and small.
2. Include a clear summary of what changed and why.
3. If behavior changed, include test coverage or a manual test plan.
4. Update docs (`README.md`, `.env.example`) when configuration or usage changes.
5. Ensure CI is green.

## Commit messages

Use clear, imperative commit messages, for example:

- `Add discord notifier retry logging`
- `Fix monitor URL resolution for private domains`

## Reporting bugs

Open an issue with:

- Steps to reproduce
- Expected behavior
- Actual behavior
- Relevant logs (remove secrets)
- Environment details (Bun version, OS)
