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
        config={{ color: "#4444ff" }}
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
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <h3>1. Standard Trace (The "Memo Trap" Issue)</h3>
              <p style={{ fontSize: '12px', color: '#aaa', margin: 0 }}>Flashes on every parent render even if DOM doesn't change.</p>
              {/* Passes a new inline function every time. Standard trace will whine about it. */}
              <StandardTraced user={user} onClick={() => console.log('clicked')} />
            </div>

            <div>
              <h3>2. Smart Trace (New Feature)</h3>
              <p style={{ fontSize: '12px', color: '#aaa', margin: 0 }}>Wait for actual DOM mutation. Shows gray dot if only V-DOM runs. Ignores inline functions.</p>
              <SmartTraced user={user} onClick={() => console.log('clicked')} />
            </div>

            <div>
              <h3>3. Memoized Trace (Traditional Fix)</h3>
              <p style={{ fontSize: '12px', color: '#aaa', margin: 0 }}>Blocks V-DOM run entirely by deep-comparing props. Adds CPU overhead but stops flash.</p>
              {/* If we pass an inline function here without useCallback, Memo breaks! */}
              <MemoTraced user={user} />
            </div>
          </div>
        </div>
      </RenderTrace>
    </div>
  );
}

export default App;
