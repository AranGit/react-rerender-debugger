# react-rerender-debugger

A lightweight, zero-dependency React and Next.js library to visually debug and analyze component re-renders. 

With `react-rerender-debugger`, you can wrap any component and instantly understand **how often** it re-renders and **exactly what changed** to cause the render.

## Features
- **Visual Flashing Indicator**: Components flash whenever they re-render.
- **Smart DOM Tracking**: Differentiate between harmless Virtual DOM re-renders and costly Real DOM mutations. Wait for actual mutations to flash, avoiding the "Memo trap" (over-engineering with useMemo).
- **Render Analytics**: Displays real-time render counts and exact causes (`Changed: props.user.id`).
- **Zero Production Overhead**: Fully isolated. In production mode, the library is a complete No-Op and leaves your DOM completely untouched.
- **Smart Value Comparison**: Deep/Shallow props inspection. Can ignore inline function changes gracefully.
- **Next.js App Router Support**: Seamless integration as a Client Component across all modern React frameworks.
- **Lightweight & Zero-Dependency**: Ships only exactly what is needed for local development.

---

## Installation

```bash
npm install react-rerender-debugger
# or
yarn add react-rerender-debugger
# or
pnpm add react-rerender-debugger
```

---

## Quick Start

You can use the debugger in two ways: as a **Higher-Order Component (HOC)** or as a **Wrapper Component**.

### Option 1: Using the Wrapper `<RenderTrace />`

Wrap any component and pass the props you want to monitor.

```tsx
import { RenderTrace } from 'react-rerender-debugger';
import { UserCard } from './UserCard';

export default function App({ user, theme }) {
  return (
    <RenderTrace name="UserCard Wrapper" config={{ color: 'blue' }} track={{ theme }}>
      <UserCard user={user} />
    </RenderTrace>
  );
}
```

### Option 2: Using the HOC `withRenderTrace`

Wrap your component definition directly. It will automatically listen to all props passed into the component.

```tsx
import React, { useState } from 'react';
import { withRenderTrace } from 'react-rerender-debugger';

const MyButton = ({ label, onClick }) => {
  return <button onClick={onClick}>{label}</button>;
};

// Automatically inspects `label` and `onClick` changes
export default withRenderTrace(MyButton, { color: '#ff0000', duration: 300 });
```

---

## Configuration Options

Both `<RenderTrace>` and `withRenderTrace` accept a `config` object:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `color` | `string` | `'#ff0000'` | The color of the flashing border and the badge text. |
| `duration` | `number` | `300` | How long the border flashes in milliseconds. |
| `depth` | `number` | `1` | Depth of object comparison. `1` means shallow comparison. `2` means it will check one level inside props to report `props.user.name` changed. |
| `flashOnDOMUpdateOnly` | `boolean` | `false` | If `true`, the UI will only flash if the Real DOM actually mutates. Great for avoiding unnecessary `useMemo` optimizations! |
| `hotRenderThresholdMs` | `number` | `16` | If `flashOnDOMUpdateOnly` is enabled, and the V-DOM evaluation takes longer than this threshold, it overrides the DOM check and fires a **Hot Render Warning** (orange flash). |
| `vdomRenderIndicator` | `'dot' \| 'badge' \| 'none'` | `'dot'` | When `flashOnDOMUpdateOnly` is enabled, decides what to show for fast V-DOM only renders. |
| `as` | `string` | `'div'` | The HTML tag used as the wrapper. Adjust this (e.g. `'span'` or `'tr'`) to prevent CSS flexbox/grid breakages. |
| `wrapperClassName` | `string` | `undefined` | Passthrough CSS class directly applied to the wrapper element for advanced layout control. |
| `wrapperStyle` | `object` | `undefined` | Passthrough inline styles directly applied to the wrapper element for advanced layout control. |
| `ignoreFunctions` | `boolean` | `false` | If `true`, ignores inline function references (`onClick={() => set()}`) from causing false positive alerts. |
| `ignoreReactNodes` | `boolean` | `true` | If `true`, gracefully ignores false positive noises caused by React elements passed via props (e.g. `children`), since new V-DOM elements change reference endlessly. |

### Tracking Internal State / Context

Because React does not expose internal component state or Context changes to a parent wrapper, the debugger will log `"State/Context change"` if the component re-renders but no props have changed. 

If you want to track specific states, you can explicitly pass them via the `track` prop on the wrapper. You can track as many variables as you want by passing them as an object:

```tsx
<RenderTrace track={{ myLocalState, someOtherState, myContextData }}>
  <Component />
</RenderTrace>
```

---

## Environment Isolation

We designed `react-rerender-debugger` to be left inside your codebase without fear. 

The library uses constant-folding logic:
```javascript
export const RenderTrace = process.env.NODE_ENV === 'production' 
  ? ({ children }) => <>{children}</> 
  : RenderTraceDev;
```

When building your app for production (Next.js, Vite, Webpack, Rollup), the bundler recognizes `process.env.NODE_ENV === 'production'` is `true`, and **completely strips out all debugging logic**. The compiled wrapper becomes a literal React Fragment, adding absolutely **zero processing overhead, zero DOM wrappers, and zero bundle size** to your production applications.

---

## Known Limitations

While `react-rerender-debugger` covers the vast majority of debugging needs with zero production overhead, the following edge cases exist due to constraints in React and the DOM Observer API:

1. **React Portals (`createPortal`)**: Content rendered into external portals (e.g. `document.body`) is not observable by `MutationObserver` which is scoped to the wrapper element. In Smart DOM mode, these mutations will appear as silent V-DOM-only renders even if real DOM was updated.

2. **React 18 Concurrent Features (`useTransition`, `useDeferredValue`, etc.)**: React may evaluate a component's render function multiple times before a single commit phase in concurrent mode. The Render Duration (`ms`) value reflects only the final synchronous pass, not the sum of all interrupted evaluations.

3. **`useRef` Mutations**: Mutating a `ref.current` does not trigger React's prop/state change detection. If a re-render is caused purely by a ref mutation, the tool will display `"State/Context change"` generically. Use the `track` prop to explicitly surface ref values you care about: `track={{ myRef: myRef.current }}`.

4. **JS-only Render Timing**: The `ms` value covers JavaScript execution time only (the component function body). It does not account for subsequent browser work such as CSS recalculation, layout, paint, or compositor steps. A component with a 1ms JS render can still cause expensive layout reflows if it triggers forced layout reads/writes.

5. **Context Identity**: When a component re-renders due to a Context value change, the tool correctly logs `"State/Context change"` — but it cannot identify *which* Context triggered the update. This is a React API limitation; context subscriptions are internal to React and not observable from a wrapper component.

## License

MIT