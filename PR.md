Closes #1050

### Summary of Changes
Implemented an `AbortController` in the `useSubscription` hook to correctly cancel in-flight `getEvents` requests when the component unmounts. This prevents the React "can't perform a state update on an unmounted component" warnings and ensures no stale `onEvent` callbacks execute post-unmount.

### What changed
- **`src/hooks/useSubscription.ts`**:
  - Initialized an `AbortController` alongside the `stop` flag.
  - Passed the `controller.signal` to a wrapper promise around `server.getEvents` so that if the component unmounts, the request immediately rejects with an `AbortError`.
  - Added early returns (`if (stop || controller.signal.aborted) return;`) before processing events to ensure no callbacks are triggered on an unmounted component.
  - Added `controller.abort()` in the `useEffect` cleanup return block.
  - Updated the `catch` block to cleanly suppress expected `AbortError`s instead of logging them as unexpected failures.

### Testing / Local Verification
- Ran `npm run build:fast` to confirm there are no TypeScript compilation errors.
- Ran `npm run lint` to verify adherence to `@typescript-eslint/prefer-promise-reject-errors` and `@typescript-eslint/no-explicit-any`.
- Verified the cleanup correctly aborts and suppresses logs.
