import { memo, useEffect, useState } from "react";
import { RenderTrace, withRenderTrace } from "react-rerender-debugger";

// An internal component
const UserCard = ({ user, onClick }: { user: { name: string; id: number }, onClick?: () => void }) => {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "16px",
        border: "1px solid #444",
        borderRadius: "8px",
        margin: "8px 0",
        cursor: onClick ? "pointer" : "default"
      }}
    >
      <p>ID: {user.id}</p>
      <p>Name: {user.name}</p>
    </div>
  );
};

// Standard Wrapper (Flash on ANY V-DOM render)
const StandardTraced = withRenderTrace(
  UserCard,
  { color: "#ff4444", duration: 500 },
  "Standard Trace"
);

// Smart Wrapper (Flash ONLY on Real DOM updates)
const SmartTraced = withRenderTrace(
  UserCard,
  { 
    color: "#00ff00", 
    duration: 500, 
    flashOnDOMUpdateOnly: true, 
    vdomRenderIndicator: 'dot',
    ignoreFunctions: true // Ignore onClick arrow function changes
  },
  "Smart Trace (DOM only)"
);

const SmartHeavyTraced = withRenderTrace(
  ({ user }: { user: { name: string; id: number } }) => {
    // Simulate heavy V-DOM computation (approx 30ms)
    const start = performance.now();
    while (performance.now() - start < 30) {
      // Artificial delay
    }
    return (
      <div style={{ padding: "16px", border: "1px solid #444", borderRadius: "8px", margin: "8px 0" }}>
        <p>Heavy Component (ID: {user.id})</p>
      </div>
    );
  },
  { color: "#00ff00", flashOnDOMUpdateOnly: true, hotRenderThresholdMs: 16 },
  "Smart Heavy Trace"
);

// Traditional approach: Memoizing the component to prevent V-DOM runs
const MemoTraced = memo(
  withRenderTrace(
    UserCard,
    { color: "#aaaaaa", duration: 500 },
    "Memoized Trace"
  )
);

function App() {
  const [ticker, setTicker] = useState(0);
  const [user, setUser] = useState({ name: "Phop", id: 1 });

  useEffect(() => {
    // Triggers a random re-render just to show the flashing
    // It updates parent state, meaning all non-memoized children will re-evaluate V-DOM
    const interval = setInterval(() => {
      setTicker((c) => c + 1);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const buttonStyle: React.CSSProperties = {
    padding: "8px 16px",
    cursor: "pointer",
    background: "#444",
    color: "white",
    border: "none",
    borderRadius: "4px",
  };

  return (
    <div
      style={{
        maxWidth: "600px",
        margin: "40px auto",
        fontFamily: "sans-serif",
      }}
    >
      <h1>react-rerender-debugger</h1>
      <p>
        Every 2.5 seconds `ticker` increases (Parent State Change). Watch how different tools react.
      </p>

      <div style={{ marginBottom: "24px", display: "flex", gap: "8px" }}>
        <button
          onClick={() => setUser({ ...user, id: user.id + 1 })}
          style={buttonStyle}
        >
          Change User ID (Mutates DOM)
        </button>
        <button
          onClick={() =>
            setUser({
              ...user,
              name: user.name === "Phop" ? "Mr.Phop" : "Phop",
            })
          }
          style={buttonStyle}
        >
          Change User Name (Mutates DOM)
        </button>
        <button
          onClick={() =>
            setUser({ ...user }) // Same data, new reference
          }
          style={buttonStyle}
        >
          New Ref, Same Data (No DOM Mutate)
        </button>
      </div>

      <RenderTrace
        name="Main Layout Box"
        config={{ color: "#f99615ff" }}
        track={{ ticker }}
      >
        <div
          style={{
            padding: "32px",
            border: "1px solid #222",
            borderRadius: "8px",
            background: "#2a2a2a",
          }}
        >
          <h2>Layout Content (Ticker: {ticker})</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Box 1: Standard Trace */}
            <div style={{ background: '#333', padding: '16px', borderRadius: '8px' }}>
              <h3 style={{ margin: '0 0 8px 0', color: '#ff7777' }}>1. Standard Trace (The "Memo Trap" Issue)</h3>
              <p style={{ fontSize: '14px', color: '#ccc', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                Notice how this box <b>flashes red EVERY 2.5 seconds</b> just because the parent updates its <code>ticker</code> state, even though this component's DOM didn't change! <br/>
                <i>Result: Developers panic and unnecessarily add <code>React.memo</code> to "fix" the flashing.</i>
              </p>
              {/* Passes a new inline function every time. Standard trace will whine about it. */}
              <StandardTraced user={user} onClick={() => console.log('clicked')} />
            </div>

            {/* Box 2: Smart Trace */}
            <div style={{ background: '#333', padding: '16px', borderRadius: '8px' }}>
              <h3 style={{ margin: '0 0 8px 0', color: '#77ff77' }}>2. Smart Trace (Ignore V-DOM Only)</h3>
              <p style={{ fontSize: '14px', color: '#ccc', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                With <code>flashOnDOMUpdateOnly: true</code>, we wait to see if the Real DOM actually mutates. <br/>
                It shows a gray dot 🔘 indicating "V-DOM ran, but it's harmless."<br/>
                Even if we track an inline object <code>track={`{{ ticker }}`}</code>, it stays perfectly quiet.<br/>
                <i>Result: You realize you <b>don't</b> need <code>React.memo</code> here! V-DOM runs are extremely fast.</i>
              </p>
              {/* Using SmartTraced but passing track={{ ticker }} to prove it's silent even with inline objects */}
              <SmartTraced user={user} onClick={() => console.log('clicked')} track={{ ticker }} />
            </div>

            {/* Box 3: Smart Heavy Trace */}
            <div style={{ background: '#333', padding: '16px', borderRadius: '8px' }}>
              <h3 style={{ margin: '0 0 8px 0', color: '#ffcc00' }}>3. The Exception: Heavy Computation</h3>
              <p style={{ fontSize: '14px', color: '#ccc', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                What if V-DOM doesn't mutate the DOM, but evaluating it takes a ridiculously long time (e.g. &gt; 16ms)? <br/>
                Smart mode detects this and fires a <b style={{color: '#ffcc00'}}>WARNING FLASH</b> because dropped frames ruin UX. <br/>
                <i>Result: This is the ONLY time you should actually use <code>React.memo</code> or <code>useMemo</code>!</i>
              </p>
              <SmartHeavyTraced user={user} />
            </div>

            {/* Box 4: Memoized */}
            <div style={{ background: '#333', padding: '16px', borderRadius: '8px' }}>
              <h3 style={{ margin: '0 0 8px 0', color: '#aaaaaa' }}>4. Traditional Fix (React.memo)</h3>
              <p style={{ fontSize: '14px', color: '#ccc', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                This is the old way: wrapping your component in <code>React.memo()</code> to completely block V-DOM execution. <br/>
                It stops the flash, but you pay the CPU cost of deep prop comparison on every render, which is often slower than just letting V-DOM run!
              </p>
              <MemoTraced user={user} />
            </div>
          </div>
        </div>
      </RenderTrace>
    </div>
  );
}

export default App;
