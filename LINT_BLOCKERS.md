# Pre-existing ESLint Errors Blocking CI

This document tracks 21 pre-existing ESLint errors that exist on the `main` branch and are blocking CI for Issue #1012.

**These errors are NOT introduced by the exponential backoff implementation.**

## Summary

- **Total**: 21 problems (19 errors, 2 warnings)
- **Auto-fixable**: 7 errors can be fixed with `--fix` option
- **Manual fixes required**: 12 errors + 2 warnings

## Errors by File

### src/components/TransactionSimulationModal.tsx

- **Line 297**: `react-hooks/set-state-in-effect` - setState called directly in useEffect

### src/debug/components/InvokeContractForm.tsx

- **Line 174**: `react-hooks/set-state-in-effect` - setState in effect
- **Line 194**: `react-hooks/immutability` - triggerSubmit accessed before declared
- **Line 198**: `react-hooks/set-state-in-effect` - setState in effect
- **Line 214**: `react-hooks/immutability` - triggerSimulate accessed before declared
- **Line 436**: `react-hooks/set-state-in-effect` - setState in effect

### src/debug/components/RenderArrayType.tsx

- **Line 57**: `@typescript-eslint/no-unnecessary-type-assertion`

### src/debug/components/ValidationResponseCard.tsx

- **Line 89**: `@typescript-eslint/no-unnecessary-type-assertion`

### src/debug/util/sorobanUtils.ts

- **Line 219**: `@typescript-eslint/no-unnecessary-type-assertion`
- **Line 275**: `@typescript-eslint/no-unnecessary-type-assertion`

### src/debug/validate/methods/getMemoError.ts

- **Line 20**: `@typescript-eslint/no-unnecessary-type-assertion`

### src/hooks/usePayroll.ts

- **Line 137**: `react-hooks/exhaustive-deps` (warning) - missing dependency

### src/hooks/useSubscription.ts

- **Line 39**: `react-hooks/immutability` - modifying external value

### src/lib/stellar-compat.tsx

- **Line 33**: `react-refresh/only-export-components` (warning)

### src/pages/Debugger.tsx

- **Line 28**: `react-hooks/set-state-in-effect` - setState in effect
- **Line 39**: `react-hooks/set-state-in-effect` - setState in effect
- **Line 204**: `@typescript-eslint/no-unnecessary-type-assertion`

### src/providers/NetworkStatusProvider.tsx

- **Line 74**: `react-hooks/set-state-in-effect` - calling async function in effect

### src/providers/WalletProvider.tsx

- **Line 128**: `react-hooks/immutability` - nullify accessed before declared
- **Line 159**: `react-hooks/set-state-in-effect` - calling async function in effect

### src/util/wallet.ts

- **Line 12**: `@typescript-eslint/no-unnecessary-type-assertion`

## Recommended Fix

These errors should be fixed in a **separate maintenance PR** before merging Issue #1012, OR lint should be made temporarily non-blocking with a tracked issue to fix these errors.

**The exponential backoff implementation in `src/contracts/payroll_stream.ts` has zero linting errors and is ready to merge once these pre-existing issues are resolved.**
