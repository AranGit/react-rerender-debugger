"use client";

import React, {
  ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { getChangedProps } from "./utils";

export interface RenderTraceConfig {
  color?: string;
  duration?: number;
  depth?: number;
  flashOnDOMUpdateOnly?: boolean;
  vdomRenderIndicator?: "none" | "dot" | "badge";
  as?: React.ElementType;
  ignoreFunctions?: boolean;
}

export interface RenderTraceDevProps {
  children?: ReactNode;
  name?: string;
  config?: RenderTraceConfig;
  track?: Record<string, any>;
  [key: string]: any; // other props to pass down or just arbitrary props passed to compare
}

export const RenderTraceDev: React.FC<RenderTraceDevProps> = ({
  children,
  name = "Component",
  config = {},
  track = {},
  ...props
}) => {
  const {
    color = "#ff0000",
    duration = 300,
    depth = 1,
    flashOnDOMUpdateOnly = false,
    vdomRenderIndicator = "dot",
    as = "div",
    ignoreFunctions = false,
  } = config;

  const Wrapper = as;
  const containerRef = useRef<HTMLElement>(null);
  const renderCountRef = useRef(0);
  const vdomRenderCountRef = useRef(0);
  const prevPropsRef = useRef<Record<string, any>>({});
  const prevTrackRef = useRef<Record<string, any>>({});

  const [isFlashing, setIsFlashing] = useState(false);
  const [causes, setCauses] = useState<string[]>([]);
  const [pendingCauses, setPendingCauses] = useState<string[]>([]); // Causes waiting for DOM update
  const [hasVdomRendered, setHasVdomRendered] = useState(false); // To show vdom indicator

  const isInternalRender = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const renderStartTimeRef = useRef(0);
  const lastRenderTimeRef = useRef(0);

  // Track the start of every render phase
  renderStartTimeRef.current = performance.now();

  useLayoutEffect(() => {
    if (!isInternalRender.current) {
      // Calculate time taken for render + commit
      lastRenderTimeRef.current =
        performance.now() - renderStartTimeRef.current;
    }
  });

  // Track the regular V-DOM re-renders
  useEffect(() => {
    if (isInternalRender.current) {
      isInternalRender.current = false;
      return;
    }

    vdomRenderCountRef.current += 1;

    // Only analyze diff after first render
    if (vdomRenderCountRef.current > 1) {
      const changedProps = getChangedProps(prevPropsRef.current, props, {
        depth,
        ignoreFunctions,
      });
      const changedTrack = getChangedProps(prevTrackRef.current, track, {
        depth,
        ignoreFunctions,
      });

      let allCauses: string[] = [];
      if (changedProps.length > 0) {
        allCauses = [...allCauses, ...changedProps.map((p) => `Props: ${p}`)];
      }
      if (changedTrack.length > 0) {
        allCauses = [...allCauses, ...changedTrack.map((p) => `Track: ${p}`)];
      }

      if (allCauses.length === 0) {
        allCauses.push("State/Context change");
      }

      if (flashOnDOMUpdateOnly) {
        // Queue the causes for the MutationObserver to pick up
        isInternalRender.current = true;
        setPendingCauses(allCauses);
        setHasVdomRendered(true);
      } else {
        // Trigger generic flash immediately
        triggerFlash(allCauses);
      }
    }

    // Save current props/track for next external render
    prevPropsRef.current = props;
    prevTrackRef.current = track;
  }); // Run on every render

  const triggerFlash = (c: string[]) => {
    renderCountRef.current += 1;
    isInternalRender.current = true;
    setCauses(c);
    setIsFlashing(true);
    setHasVdomRendered(false); // Reset vdom light because we have a real flash

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      // Mark the fade-out render as internal as well
      isInternalRender.current = true;
      setIsFlashing(false);
    }, duration);
  };

  // Setup Mutation Observer
  useEffect(() => {
    if (!flashOnDOMUpdateOnly || !containerRef.current) return;

    const observer = new MutationObserver((mutations) => {
      let isRealMutation = false;

      for (const mutation of mutations) {
        // If target is the container itself, check children that were added/removed
        if (mutation.target === containerRef.current) {
          let hasRealChildChange = false;
          mutation.addedNodes.forEach((node) => {
            if ((node as HTMLElement).dataset?.debuggerOverlay !== "true") {
              hasRealChildChange = true;
            }
          });
          mutation.removedNodes.forEach((node) => {
            if ((node as HTMLElement).dataset?.debuggerOverlay !== "true") {
              hasRealChildChange = true;
            }
          });

          // Also check attributes on the container? We shouldn't change the container's own attributes
          // other than style from our end, but let's just focus on child mutations.
          if (hasRealChildChange || mutation.type === 'attributes') {
             // If attributes of the wrapper itself changed
             isRealMutation = true;
          }
        } else {
          // Target is some child inside the wrapper. Check if it's inside our overlay.
          let current: HTMLElement | null = mutation.target as HTMLElement;
          let isOverlay = false;
          while (current && current !== containerRef.current) {
            if (current.dataset?.debuggerOverlay === "true") {
              isOverlay = true;
              break;
            }
            current = current.parentElement;
          }
          if (!isOverlay) {
            isRealMutation = true;
          }
        }

        if (isRealMutation) break;
      }

      if (!isRealMutation) return;

      // Only trigger if we have pending causes waiting from a recent render
      if (pendingCauses.length > 0) {
        triggerFlash(pendingCauses);
        // Clear pending so we don't double trigger on same render batch
        isInternalRender.current = true;
        setPendingCauses([]);
      } else if (vdomRenderCountRef.current > 1) {
        // Mutation happened without a known pending cause, might be deep child state change
        // Only do this if it's not the initial mount
        triggerFlash(["Deep DOM Mutation"]);
      }
    });

    observer.observe(containerRef.current, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });

    return () => observer.disconnect();
  }, [flashOnDOMUpdateOnly, pendingCauses, duration]);

  // Cleanup timeout
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const showVdomDot =
    flashOnDOMUpdateOnly &&
    hasVdomRendered &&
    !isFlashing &&
    vdomRenderIndicator === "dot";
  const showVdomBadge =
    flashOnDOMUpdateOnly &&
    hasVdomRendered &&
    !isFlashing &&
    vdomRenderIndicator === "badge";

  return (
    <Wrapper
      ref={containerRef}
      style={{
        position: "relative",
        display: as === "div" ? "inline-block" : undefined,
        width: as === "div" ? "100%" : undefined,
        height: as === "div" ? "100%" : undefined,
      }}
    >
      {/* The component being wrapped */}
      {children}

      {/* Flashing Overlay */}
      <div
        data-debugger-overlay="true"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: "none",
          boxSizing: "border-box",
          border: `2px solid ${color}`,
          opacity: isFlashing ? 1 : 0,
          transition: `opacity ${duration}ms ease-out`,
          zIndex: 9999,
        }}
      />

      {/* V-DOM Indicator (Subtle) */}
      {showVdomDot && (
        <div
          data-debugger-overlay="true"
          title={`V-DOM Executed (${lastRenderTimeRef.current.toFixed(1)}ms) - No DOM changes`}
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            backgroundColor: "rgba(150, 150, 150, 0.4)",
            transform: "translate(50%, -50%)",
            pointerEvents: "auto",
            zIndex: 10000,
            boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
            cursor: "help",
          }}
        />
      )}

      {/* Floating Badge (Full info) / V-DOM Badge */}
      {(renderCountRef.current > 1 || showVdomBadge) && (
        <div
          data-debugger-overlay="true"
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            transform: "translate(50%, -50%)",
            pointerEvents: "none",
            backgroundColor: showVdomBadge
              ? "rgba(80, 80, 80, 0.4)"
              : "rgba(150, 150, 150, 0.4)",
            color: "#fff",
            padding: "4px 8px",
            borderRadius: "4px",
            fontSize: "10px",
            fontFamily: "monospace",
            whiteSpace: "nowrap",
            zIndex: 10000,
            boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: "2px",
          }}
        >
          <div style={{ fontWeight: "bold" }}>
            {name}
            {showVdomBadge ? (
              <span style={{ color: "#aaa", marginLeft: "4px" }}>
                (V-DOM only)
              </span>
            ) : (
              <span style={{ color }}>#{renderCountRef.current}</span>
            )}
            <span
              style={{ color: "#aaa", marginLeft: "6px", fontWeight: "normal" }}
            >
              ({lastRenderTimeRef.current.toFixed(1)} ms)
            </span>
          </div>
          {causes.map((cause, idx) => (
            <div key={idx} style={{ color: "#aaa", fontSize: "9px" }}>
              {cause}
            </div>
          ))}
        </div>
      )}
    </Wrapper>
  );
};
