"use client";

declare var process: {
  env: {
    NODE_ENV: string;
  };
};

// RSC Guard
if (typeof window === 'undefined' && typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
  if (process.env.NODE_ENV === 'development') {
    console.error(
      '[react-rerender-debugger] Detected a Server-side render context. ' +
      'RenderTrace only works inside Client Components.'
    );
  }
}

import React, {
  ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  Profiler,
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
  ignoreReactNodes?: boolean;
  wrapperClassName?: string;
  wrapperStyle?: React.CSSProperties;
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
    hotRenderThresholdMs = 16,
    vdomRenderIndicator = "dot",
    as = "div",
    ignoreFunctions = false,
    ignoreReactNodes = true,
    wrapperClassName,
    wrapperStyle,
  } = config;

  const Wrapper = as;
  const containerRef = useRef<HTMLElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  
  const renderCountRef = useRef(0);
  const vdomRenderCountRef = useRef(0);
  const prevPropsRef = useRef<Record<string, any>>({});
  const prevTrackRef = useRef<Record<string, any>>({});
  
  const [flashState, setFlashState] = useState<'none' | 'normal' | 'hot'>('none');
  const [causes, setCauses] = useState<string[]>([]);
  const [hasVdomRendered, setHasVdomRendered] = useState(false);
  
  const pendingCausesRef = useRef<string[]>([]);
  const isInternalRender = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lastRenderDurationRef = useRef(0);
  const firstRenderDurationRef = useRef<number | null>(null);
  const [firstRenderHot, setFirstRenderHot] = useState(false);

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
    const totalTime = lastRenderDurationRef.current;

    if (!isInternalRender.current) {
      if (vdomRenderCountRef.current === 0 && firstRenderDurationRef.current === null) {
        firstRenderDurationRef.current = totalTime;
        if (flashOnDOMUpdateOnly && totalTime >= hotRenderThresholdMs) {
          isInternalRender.current = true;
          setFirstRenderHot(true);
        }
      }

      if (flashOnDOMUpdateOnly && totalTime >= hotRenderThresholdMs && vdomRenderCountRef.current > 0) {
        setTimeout(() => {
          if (pendingCausesRef.current.length > 0) {
            triggerFlash([...pendingCausesRef.current, `🔥 Heavy V-DOM (${totalTime.toFixed(1)}ms)`], 'hot');
            pendingCausesRef.current = [];
          }
        }, 30);
      }
    }
  });

  useLayoutEffect(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      let xOffset = 50;
      let yOffset = -50;
      if (rect.right + 60 > window.innerWidth) xOffset = 0;
      if (rect.top - 30 < 0) yOffset = 0;
      const transform = `translate(${xOffset}%, ${yOffset}%)`;
      if (badgeRef.current) badgeRef.current.style.transform = transform;
      if (dotRef.current) dotRef.current.style.transform = transform;
    }
  });

  useEffect(() => {
    if (isInternalRender.current) {
      isInternalRender.current = false;
      return;
    }

    vdomRenderCountRef.current += 1;

    if (vdomRenderCountRef.current > 1) {
      const changedProps = getChangedProps(prevPropsRef.current, props, {
        depth, ignoreFunctions, ignoreReactNodes,
      });
      const changedTrack = getChangedProps(prevTrackRef.current, track, {
        depth, ignoreFunctions, ignoreReactNodes,
      });

      let allCauses: string[] = [];
      if (changedProps.length > 0) allCauses = [...allCauses, ...changedProps.map((p) => `Props: ${p}`)];
      if (changedTrack.length > 0) allCauses = [...allCauses, ...changedTrack.map((p) => `Track: ${p}`)];

      if (allCauses.length === 0) allCauses.push("State/Context change");

      if (flashOnDOMUpdateOnly) {
        pendingCausesRef.current = allCauses;
        isInternalRender.current = true;
        setHasVdomRendered(true);
      } else {
        triggerFlash(allCauses, 'normal');
      }
    }

    prevPropsRef.current = props;
    prevTrackRef.current = track;
  });

  useEffect(() => {
    if (!flashOnDOMUpdateOnly || !containerRef.current) return;
    const observer = new MutationObserver((mutations) => {
      let isRealMutation = false;
      for (const mutation of mutations) {
        if (mutation.target === containerRef.current) {
          let hasRealChildChange = false;
          mutation.addedNodes.forEach((node) => { if ((node as HTMLElement).dataset?.debuggerOverlay !== "true") hasRealChildChange = true; });
          mutation.removedNodes.forEach((node) => { if ((node as HTMLElement).dataset?.debuggerOverlay !== "true") hasRealChildChange = true; });
          if (hasRealChildChange || mutation.type === 'attributes') isRealMutation = true;
        } else {
          let current: HTMLElement | null = mutation.target as HTMLElement;
          let isOverlay = false;
          while (current && current !== containerRef.current) {
            if (current.dataset?.debuggerOverlay === "true") { isOverlay = true; break; }
            current = current.parentElement;
          }
          if (!isOverlay) isRealMutation = true;
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
    observer.observe(containerRef.current, { childList: true, subtree: true, characterData: true, attributes: true });
    return () => observer.disconnect();
  }, [flashOnDOMUpdateOnly, duration]);

  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  const isFlashing = flashState !== 'none';
  const showVdomDot = flashOnDOMUpdateOnly && hasVdomRendered && !isFlashing && vdomRenderIndicator === "dot";
  const showVdomBadge = flashOnDOMUpdateOnly && hasVdomRendered && !isFlashing && vdomRenderIndicator === "badge";
  const showFirstRenderBadge = firstRenderHot && vdomRenderCountRef.current === 0;
  const activeColor = flashState === 'hot' ? '#ff9900' : color;

  return (
    <Wrapper ref={containerRef} className={wrapperClassName} style={{ position: "relative", ...wrapperStyle }}>
      <Profiler id={name} onRender={(_id, _phase, actualDuration) => {
        // This callback is triggered by React with precise timing of the tree under this Profiler.
        // We only capture it if it's an external render to avoid noise from our own flash state updates.
        if (!isInternalRender.current) {
          lastRenderDurationRef.current = actualDuration;
        }
      }}>
        {children}
      </Profiler>

      <div data-debugger-overlay="true" style={{
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none", boxSizing: "border-box",
        border: `2px solid ${activeColor}`, opacity: isFlashing ? 1 : 0, transition: `opacity ${duration}ms ease-out`, zIndex: 9999,
      }} />

      {showVdomDot && (
        <div ref={dotRef} data-debugger-overlay="true" title={`V-DOM Executed (${lastRenderDurationRef.current.toFixed(1)}ms)`}
          style={{
            position: "absolute", top: 0, right: 0, width: "8px", height: "8px", borderRadius: "50%",
            backgroundColor: "rgba(150, 150, 150, 0.4)", transform: "translate(50%, -50%)", pointerEvents: "auto",
            zIndex: 10000, boxShadow: "0 1px 2px rgba(0,0,0,0.3)", cursor: "help",
          }}
        />
      )}

      {showFirstRenderBadge && (
        <div data-debugger-overlay="true" style={{
          position: "absolute", top: 0, right: 0, transform: "translate(50%, -50%)", backgroundColor: "rgba(255, 100, 0, 0.9)",
          color: "#fff", padding: "4px 8px", borderRadius: "4px", fontSize: "10px", fontFamily: "monospace", zIndex: 10000,
        }}>
          🔥 {name} mount ({firstRenderDurationRef.current?.toFixed(1)} ms)
        </div>
      )}

      {(renderCountRef.current > 1 || showVdomBadge) && (
        <div ref={badgeRef} data-debugger-overlay="true" style={{
            position: "absolute", top: 0, right: 0, transform: "translate(50%, -50%)", pointerEvents: "none",
            backgroundColor: showVdomBadge ? "rgba(80, 80, 80, 0.4)" : (flashState === 'hot' ? 'rgba(255, 153, 0, 0.9)' : "rgba(150, 150, 150, 0.4)"),
            color: "#fff", padding: "4px 8px", borderRadius: "4px", fontSize: "10px", fontFamily: "monospace",
            whiteSpace: "nowrap", boxShadow: "0 2px 4px rgba(0,0,0,0.3)", zIndex: 10000,
            display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "2px",
          }}
        >
          <div style={{ fontWeight: "bold" }}>
            {name}
            {showVdomBadge ? <span style={{ color: "#ccc", marginLeft: "4px" }}>(V-DOM only)</span> : <span style={{ color: flashState === 'hot' ? '#fff' : activeColor }}>#{renderCountRef.current}</span>}
            <span style={{ color: "#eee", marginLeft: "6px", fontWeight: "normal" }}>({lastRenderDurationRef.current.toFixed(1)} ms)</span>
          </div>
          {causes.map((cause, idx) => <div key={idx} style={{ color: "#fff", fontSize: "9px" }}>{cause}</div>)}
        </div>
      )}
    </Wrapper>
  );
};
