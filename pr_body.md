## Summary

This PR resolves two UX issues across the Quipay frontend.

### Issue #453: Add copy-to-clipboard buttons for blockchain addresses and transaction hashes

Long blockchain addresses and transaction hashes are now copyable with a single click. A new reusable `CopyButton` component has been added that:

- Shows a clipboard icon that toggles to a checkmark on success
- Copies the value using the `navigator.clipboard` API with a fallback for older browsers
- Provides accessible `aria-label` and `title` attributes
- Resets the feedback indicator after 2 seconds

The component is used in:

- `EmployerDashboard` - employee wallet addresses in the active streams list
- `WorkerDashboard` - employer addresses on stream cards, completed stream cards, and transaction hashes in the withdrawal history table

### Issue #454: Add missing `type="button"` attributes to standalone buttons

Several `button` elements were missing the `type="button"` attribute. Without it, buttons inside or near forms default to `type="submit"`, causing unexpected form submissions. All standalone buttons have been updated with the correct attribute.

### Additional changes

- Resolved merge conflicts with upstream/main (incorporating CancelStreamModal, buildCancelStreamTx, StreamTimeline, and skeleton loading components from upstream)
- Applied prettier formatting fixes to satisfy the CI check

Closes #453
Closes #454
