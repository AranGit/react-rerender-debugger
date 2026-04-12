'use client';

import React from 'react';

declare var process: {
  env: {
    NODE_ENV: string;
  };
};
import { RenderTrace } from './RenderTrace';
import { RenderTraceConfig } from './RenderTraceDev';

/**
 * Higher Order Component to wrap a React component with RenderTrace.
 * 
 * @param Component The component to trace
 * @param config Configuration options for RenderTrace
 * @param name Optional specific name to display. Defaults to Component.displayName || Component.name
 */
export function withRenderTrace<P extends object, TRef = any>(
  Component: React.ComponentType<P> | React.ForwardRefExoticComponent<React.PropsWithoutRef<P> & React.RefAttributes<TRef>>,
  config?: RenderTraceConfig,
  name?: string
) {
  const componentName = name || Component.displayName || Component.name || 'Component';

  // DEV HOC
  const WithRenderTraceDev = React.forwardRef<TRef, P & { track?: Record<string, any> }>((props, ref) => {
    const { track, ...restProps } = props;
    const Comp = Component as any;
    return (
      <RenderTrace name={componentName} config={config} track={track} {...restProps}>
        <Comp {...restProps} ref={ref} />
      </RenderTrace>
    );
  });

  // Set displayName for React DevTools
  WithRenderTraceDev.displayName = `withRenderTrace(${componentName})`;

  return process.env.NODE_ENV === 'production' 
    ? (Component as unknown as React.ForwardRefExoticComponent<React.PropsWithoutRef<P> & React.RefAttributes<TRef>>) 
    : WithRenderTraceDev;
}
