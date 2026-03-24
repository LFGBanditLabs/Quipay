# Pull Request Description

## Description

This PR implements several key enhancements to the Quipay frontend interface, addressing critical form validation logic, introducing new data visualization components, improving responsive layouts for mobile usage, and preserving user theme preferences.

### Key Changes
- **Stream Creation Form Validation**: Integrated strict validation using `zod` mapped directly to the smart contract's constraints. Form submission is disabled until all inputs satisfy the schema. Added a robust error interceptor mapping raw contract error objects (e.g., `InvalidTimeRange`, `InsufficientBalance`) to user-friendly UI notifications in `StreamCreator.tsx`.
- **Enterprise Dashboard Topology Visualizer**: Developed and injected a new HTML5 Canvas component (`StreamVisualizer.tsx`) into the Enterprise Dashboard. It constructs an interactive map rendering the Treasury Vault flowing into downstream Worker Streams, featuring animated particles corresponding to real-time `flowRate`s.
- **Worker Dashboard Mobile Responsiveness**: Restyled `WorkerDashboard.module.css` to introduce mobile stacking and column-wrapping for screens smaller than `640px`. Corrected critical clipping issues around 7-decimal-precision token earnings arrays by enforcing word-breaks.
- **Theme Persistence**: Adjusted `PayrollDashboard.tsx` to query and cache the user's Dark/Light mode toggle directly to `localStorage`. The theme state is now synchronously initialized avoiding jarring CSS flashes across page loads.
- **Routing**: Updated `App.tsx` routes to properly export `/worker` and `/governance` paths, connecting the new dashboards to the main navigation layout.

## Related Issues
fixes: #301
fixes: #216
fixes: #312
fixes: #311
