import React, { useEffect, useLayoutEffect, useRef, useState, ReactNode } from 'react';
import { getChangedProps } from './utils';

export interface RenderTraceConfig {
  color?: string;
  duration?: number;
  depth?: number;
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
  name = 'Component', 
  config = {}, 
  track = {}, 
  ...props 
}) => {
  const { color = '#ff0000', duration = 300, depth = 1 } = config;
  
  const renderCountRef = useRef(0);
  const prevPropsRef = useRef<Record<string, any>>({});
  const prevTrackRef = useRef<Record<string, any>>({});
  
  const [isFlashing, setIsFlashing] = useState(false);
  const [causes, setCauses] = useState<string[]>([]);
  
  const isInternalRender = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const renderStartTimeRef = useRef(0);
  const lastRenderTimeRef = useRef(0);

  // Track the start of every render phase
  renderStartTimeRef.current = performance.now();

  useLayoutEffect(() => {
    if (!isInternalRender.current) {
      // Calculate time taken for render + commit
      lastRenderTimeRef.current = performance.now() - renderStartTimeRef.current;
    }
  });

  useEffect(() => {
    if (isInternalRender.current) {
      // This render was caused by our own setCauses/setIsFlashing logic.
      // We skip tracking it and reset the flag.
      isInternalRender.current = false;
      return;
    }

    renderCountRef.current += 1;
    
    // Only analyze diff after first render
    if (renderCountRef.current > 1) {
      const changedProps = getChangedProps(prevPropsRef.current, props, depth);
      const changedTrack = getChangedProps(prevTrackRef.current, track, depth);
      
      let allCauses: string[] = [];
      if (changedProps.length > 0) {
        allCauses = [...allCauses, ...changedProps.map(p => `Props: ${p}`)];
      }
      if (changedTrack.length > 0) {
        allCauses = [...allCauses, ...changedTrack.map(p => `Track: ${p}`)];
      }
      
      if (allCauses.length === 0) {
        allCauses.push('State/Context change');
      }
      
      // Mark next render as internal so we don't infinite loop
      isInternalRender.current = true;
      setCauses(allCauses);
      setIsFlashing(true);
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        // Mark the fade-out render as internal as well
        isInternalRender.current = true;
        setIsFlashing(false);
      }, duration);
    }
    
    // Save current props/track for next external render
    prevPropsRef.current = props;
    prevTrackRef.current = track;
  }); // Run on every render

  // Cleanup timeout
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div style={{ position: 'relative', display: 'inline-block', width: '100%', height: '100%' }}>
      {/* The component being wrapped */}
      {children}
      
      {/* Flashing Overlay */}
      <div 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: 'none',
          boxSizing: 'border-box',
          border: `2px solid ${color}`,
          opacity: isFlashing ? 1 : 0,
          transition: `opacity ${duration}ms ease-out`,
          zIndex: 9999,
        }} 
      />

      {/* Floating Badge */}
      {renderCountRef.current > 1 && (
        <div 
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            transform: 'translate(50%, -50%)',
            pointerEvents: 'none',
            backgroundColor: '#282c34',
            color: '#fff',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '10px',
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
            zIndex: 10000,
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: '2px',
          }}
        >
          <div style={{ fontWeight: 'bold' }}>
            {name} <span style={{ color }}>#{renderCountRef.current}</span>
            <span style={{ color: '#aaa', marginLeft: '6px', fontWeight: 'normal' }}>
              ({lastRenderTimeRef.current.toFixed(1)} ms)
            </span>
          </div>
          {causes.map((cause, idx) => (
            <div key={idx} style={{ color: '#aaa', fontSize: '9px' }}>
              {cause}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
