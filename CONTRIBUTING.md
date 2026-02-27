# Contributing

This is a guide to contributing to `scaffold-stellar-frontend` itself. Feel free to delete or modify it for your own project.

## Development Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Set up Husky (pre-commit hooks):
   ```bash
   npm run prepare
   ```

## Pre-commit Hooks

This project uses [Husky](https://typicode.github.io/husky/) and [lint-staged](https://github.com/lint-staged/lint-staged) to automatically format and lint code before commits.

The pre-commit hook runs:

- **ESLint** with auto-fix for JavaScript/TypeScript files
- **Prettier** to format all files

### Bypassing Hooks (Emergency Use Only)

In rare cases, you may need to bypass the pre-commit hooks (e.g., to commit a fix when lint-staged is causing issues):

```bash
git commit --no-verify -m "Your commit message"
```

**Warning**: Use `--no-verify` sparingly. Commits that bypass hooks may fail CI checks and require additional cleanup.

## Code Style

- Use Prettier for formatting (runs automatically on commit)
- Follow ESLint rules (auto-fixable issues are corrected automatically)
- Run `npm run format` manually if needed
- Run `npm run lint` to check for issues without fixing
