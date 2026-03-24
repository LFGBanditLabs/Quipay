#301 Implement stream creation form validation with meaningful error messages
Repo Avatar
LFGBanditLabs/Quipay
Description
CreateStream.tsx does not map QuipayError codes from the contract to user-friendly messages. Users get raw contract errors when validation fails.

Requirements & Context

Map error codes: InvalidTimeRange, InvalidCliff, StartTimeInPast, InsufficientBalance → UI messages
Show inline field errors (e.g., "Start date must be in the future")
Disable submit button when form is invalid
Suggested Execution

git checkout -b feat/stream-form-validation
Add Zod client-side validation schema mirroring contract constraints
Add contract error code → message mapping
Update StreamCreator.tsx to surface errors inline
Commit Message

feat(frontend): add form validation and QuipayError mapping to stream creator
Guidelines

Timeframe: 48 hours



#216 [Frontend] Enterprise Dashboard: Custom Canvas/SVG Stream Topology Visualizer
Repo Avatar
LFGBanditLabs/Quipay
Description
Build an interactive, high-performance visualization of the payroll ecosystem. This should show the 'topology' of the protocol: from the Treasury Vault to all active Payroll Streams and finally to the destination Workers.

Component
Employer Dashboard / Analytics

Difficulty
🔴 Hard

Tasks
 Design a nodes-and-edges topology map using Canvas or SVG (e.g., D3.js or React Flow).
 Represent the Treasury Vault as the central source of liquidity.
 Animate 'flow' particles moving from Treasury to active Streams to indicate second-by-second payments.
 Implement drill-down capabilities: clicking a node shows detailed metadata for that stream/worker.
 Optimize for 100+ concurrent streams using virtualization or canvas optimization.
Acceptance Criteria
 Visualizer is interactive (pan/zoom).
 Data is reflected in real-time based on contract state.
 Performance remains smooth at 60fps even with many active streams.
Estimated Time
15-20 hours


#312 Make the worker dashboard mobile responsive
Repo Avatar
LFGBanditLabs/Quipay
Description
WorkerDashboard.tsx and EarningsDisplay.tsx do not render correctly on mobile screens (< 640px). Stream cards overflow and earnings numbers clip.

Suggested Execution

git checkout -b fix/worker-dashboard-responsive
Test on 375px, 640px, 768px breakpoints
Fix card layout to stack vertically on mobile
Ensure earnings counter is readable on small screens
Commit Message

fix(frontend): make worker dashboard responsive for mobile viewports
Guidelines

Include screenshots for 375px and 1280px in PR
Timeframe: 48 hours


#311 Add dark/light mode theme persistence across sessions
Repo Avatar
LFGBanditLabs/Quipay
Description
The ThemeToggle component switches themes but doesn't persist the choice across page reloads.

Suggested Execution

git checkout -b fix/theme-persistence
Save theme preference to localStorage
Read on app init and apply before first render (prevents flash)
Commit Message

fix(frontend): persist dark/light mode preference to localStorage
Guidelines

Timeframe: 24 hours

