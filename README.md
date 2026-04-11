# react-rerender-debugger

A lightweight, zero-dependency React and Next.js library to visually debug and analyze component re-renders. 

With `react-rerender-debugger`, you can wrap any component and instantly understand **how often** it re-renders and **exactly what changed** to cause the render.

## Features
- **Visual Flashing Indicator**: Components flash whenever they re-render.
- **Render Analytics**: Displays real-time render counts and exact causes (`Changed: props.user.id`).
- **Zero Production Overhead**: Fully isolated. In production mode, the library is a complete No-Op and leaves your DOM completely untouched.
- **Smart Value Comparison**: Deep/Shallow props inspection.
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

### Tracking Internal State / Context

Because React does not expose internal component state or Context changes to a parent wrapper, the debugger will log `"State/Context change"` if the component re-renders but no props have changed. 

If you want to track specific states, you can explicitly pass them via the `track` prop on the wrapper. You can track as many variables as you want by passing them as an object:

```tsx
<RenderTrace track={{ myLocalState, someOtherState, myContextData }}>
  <Component />
</RenderTrace>
```

---

## Testing / Playground

We have included a full Vite React development playground directly inside this repository. You can use it to test modifications or see the library in action without installing it elsewhere.

1. Navigate to the `example/` directory.
2. Run `npm install` (this will install React, Vite, and link the local library folder `file:..`).
3. Run `npm run dev` to start discovering re-renders live in your browser!

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