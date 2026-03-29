# Design Tokens

Quipay now uses a unified token system defined in `src/styles/tokens.css`.

## Source of Truth

- Token file: `src/styles/tokens.css`
- Global import: `src/index.css`
- Visual token reference (Storybook CSF): `src/stories/DesignTokens.stories.js`

## Token Categories

### Color

- Brand: `--token-color-brand-*`
- Neutral: `--token-color-neutral-*`
- Semantic: `--token-color-success-*`, `--token-color-warning-*`, `--token-color-error-*`
- Surface/Text/Border semantic aliases: `--token-color-bg-*`, `--token-color-text-*`, `--token-color-border-*`

### Spacing (4px grid)

- `--token-space-1` = 4px
- `--token-space-2` = 8px
- `--token-space-3` = 12px
- `--token-space-4` = 16px
- `--token-space-5` = 20px
- `--token-space-6` = 24px
- `--token-space-8` = 32px
- `--token-space-10` = 40px

### Typography

- Families: `--token-font-family-sans`, `--token-font-family-mono`
- Sizes: `--token-font-size-xs|sm|md|lg`
- Weights: `--token-font-weight-regular|medium|semibold`
- Supporting: `--token-letter-spacing-caps`, `--token-line-height-*`

### Radius

- `--token-radius-sm|md|lg|xl|pill`

### Shadows

- `--token-shadow-sm|md|lg`

## Migration Rules

1. Do not hardcode colors (`#hex`, `rgb`, `rgba`) in component styles.
2. Do not hardcode spacing (`px`, one-off `rem`) for component layout if a spacing token exists.
3. Prefer semantic tokens (`--token-color-bg-surface`) over raw palette tokens (`--token-color-neutral-0`) in component CSS.
4. Keep existing aliases (`--bg`, `--surface`, `--text`, SDS vars) only for compatibility while migration is in progress.

## Updated Components

- `src/components/StreamProgress.css`
- `src/components/StreamProgressCard.tsx`
- `src/providers/NotificationProvider.css`
- `src/styles/accessibility.css`

## Visual Regression

Run:

```bash
npm run test:e2e:visual
```

If visual intent changed by design update, refresh snapshots:

```bash
npm run test:e2e:visual:update
```
