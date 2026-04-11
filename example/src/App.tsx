import { memo, useEffect, useState } from "react";
import { RenderTrace, withRenderTrace } from "react-rerender-debugger";

// An internal component
const UserCard = ({ user }: { user: { name: string; id: number } }) => {
  return (
    <div
      style={{
        padding: "16px",
        border: "1px solid #444",
        borderRadius: "8px",
        margin: "8px 0",
      }}
    >
      <p>ID: {user.id}</p>
      <p>Name: {user.name}</p>
    </div>
  );
};

// React Note: The component rendered inside App is actually the HOC wrapper (TracedUserCard).
// Therefore, to prevent the wrapper from re-rendering and flashing unnecessarily,
// we must apply React.memo() to the returned HOC output, rather than just the internal component!
const TracedUserCard = memo(
  withRenderTrace(
    UserCard,
    { color: "#00ff00", duration: 500 },
    "UserCard With Memo",
  ),
);
const TracedUserCardWithoutMemo = withRenderTrace(
  UserCard,
  {
    color: "#f6ff00ff",
    duration: 500,
  },
  "UserCard Without Memo",
);

function App() {
  const [count, setCount] = useState(0);
  const [user, setUser] = useState({ name: "Phop", id: 1 });

  useEffect(() => {
    // Triggers a random re-render just to show the flashing
    const interval = setInterval(() => {
      setCount((c) => c + 1);
    }, 2000);
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
      <h1>react-rerender-debugger playground</h1>
      <p>
        Every 2 seconds `count` increases. See how the wrapper visualizes it.
      </p>

      <div style={{ marginBottom: "24px", display: "flex", gap: "8px" }}>
        <button
          onClick={() => setUser({ ...user, id: user.id + 1 })}
          style={buttonStyle}
        >
          Change User Props (ID)
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
          Change User Props (Name)
        </button>
      </div>

      <RenderTrace
        name="Main Layout Box"
        config={{ color: "#ff4444" }}
        track={{ count }}
      >
        <div
          style={{
            padding: "32px",
            border: "1px solid #222",
            borderRadius: "8px",
            background: "#2a2a2a",
          }}
        >
          <h2>Layout Content</h2>
          <p>Count is: {count}</p>

          <TracedUserCard user={user} />
          <TracedUserCardWithoutMemo user={user} />
        </div>
      </RenderTrace>
    </div>
  );
}

export default App;
