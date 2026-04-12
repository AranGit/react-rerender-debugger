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
  hotRenderThresholdMs?: number;
  vdomRenderIndicator?: "none" | "dot" | "badge";
  as?: React.ElementType;
  ignoreFunctions?: boolean;
}

export interface RenderTraceDevProps {
  children?: ReactNode;
  name?: string;
  config?: RenderTraceConfig;
  track?: Record<string, any>;
  [key: string]: any;
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
    hotRenderThresholdMs = 16, // Default 16ms to flag frames drop
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

  const [flashState, setFlashState] = useState<'none' | 'normal' | 'hot'>('none');
  const [causes, setCauses] = useState<string[]>([]);
  const [hasVdomRendered, setHasVdomRendered] = useState(false);
  
  // Use ref to hold pending causes so we don't trigger unnecessary re-renders while waiting for DOM mutations
  const pendingCausesRef = useRef<string[]>([]);

  const isInternalRender = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const renderStartTimeRef = useRef(0);
  const lastRenderTimeRef = useRef(0);

  // Track the start of every render phase
  renderStartTimeRef.current = performance.now();

  const triggerFlash = (c: string[], type: 'normal' | 'hot' = 'normal') => {
    isInternalRender.current = true;
    renderCountRef.current += 1;
    setCauses(c);
    setFlashState(type);
    setHasVdomRendered(false);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      isInternalRender.current = true;
      setFlashState('none');
    }, duration);
  };

  useLayoutEffect(() => {
    if (!isInternalRender.current) {
      // Calculate time taken for render + commit
      const renderTime = performance.now() - renderStartTimeRef.current;
      lastRenderTimeRef.current = renderTime;

      // Detect Heavy V-DOM Calculation if we are in DOM-only mode
      if (flashOnDOMUpdateOnly && renderTime >= hotRenderThresholdMs) {
        setTimeout(() => {
          // If after a macrotask the pendingCauses are STILL there, 
          // it means MutationObserver never fired (DOM didn't mutate).
          // But since it was a heavy render, we WARN the user anyway!
          if (pendingCausesRef.current.length > 0) {
            triggerFlash([...pendingCausesRef.current, `🔥 Heavy V-DOM (${renderTime.toFixed(1)}ms)`], 'hot');
            pendingCausesRef.current = [];
          }
        }, 30);
      }
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
        // Queue it quietly
        pendingCausesRef.current = allCauses;
        isInternalRender.current = true;
        setHasVdomRendered(true);
      } else {
        triggerFlash(allCauses, 'normal');
      }
    }

    // Save current props/track for next external render
    prevPropsRef.current = props;
    prevTrackRef.current = track;
  });

  // Setup Mutation Observer
  useEffect(() => {
    if (!flashOnDOMUpdateOnly || !containerRef.current) return;

    const observer = new MutationObserver((mutations) => {
      let isRealMutation = false;

      for (const mutation of mutations) {
        // Exclude mutations happening exactly on the wrapper specifically due to our overlay elements
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

          if (hasRealChildChange || mutation.type === 'attributes') {
             isRealMutation = true;
          }
        } else {
          // Inner mutations
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

      if (pendingCausesRef.current.length > 0) {
        triggerFlash(pendingCausesRef.current, 'normal');
        pendingCausesRef.current = [];
      } else if (vdomRenderCountRef.current > 1) {
        triggerFlash(["Deep DOM Mutation"], 'normal');
      }
    });

    observer.observe(containerRef.current, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });

    return () => observer.disconnect();
  }, [flashOnDOMUpdateOnly, duration]); // pendingCauses safely decoupled via ref

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const isFlashing = flashState !== 'none';
  const showVdomDot = flashOnDOMUpdateOnly && hasVdomRendered && !isFlashing && vdomRenderIndicator === "dot";
  const showVdomBadge = flashOnDOMUpdateOnly && hasVdomRendered && !isFlashing && vdomRenderIndicator === "badge";
  
  const activeColor = flashState === 'hot' ? '#ff9900' : color;

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
          border: `2px solid ${activeColor}`,
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
              : (flashState === 'hot' ? 'rgba(255, 153, 0, 0.9)' : "rgba(150, 150, 150, 0.4)"),
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
              <span style={{ color: "#ccc", marginLeft: "4px" }}>
                (V-DOM only)
              </span>
            ) : (
              <span style={{ color: flashState === 'hot' ? '#fff' : activeColor }}>#{renderCountRef.current}</span>
            )}
            <span
              style={{ color: "#eee", marginLeft: "6px", fontWeight: "normal" }}
            >
              ({lastRenderTimeRef.current.toFixed(1)} ms)
            </span>
          </div>
          {causes.map((cause, idx) => (
            <div key={idx} style={{ color: "#fff", fontSize: "9px" }}>
              {cause}
            </div>
          ))}
        </div>
      )}
    </Wrapper>
  );
};
