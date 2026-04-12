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
export function withRenderTrace<P extends object>(
  Component: React.ComponentType<P>,
  config?: RenderTraceConfig,
  name?: string
): React.FC<P & { track?: Record<string, any> }> {
  const componentName = name || Component.displayName || Component.name || 'Component';

  // DEV HOC
  const WithRenderTraceDev: React.FC<P> = (props) => (
    <RenderTrace name={componentName} config={config} {...props}>
      <Component {...props} />
    </RenderTrace>
  );

  // Set displayName for React DevTools
  WithRenderTraceDev.displayName = `withRenderTrace(${componentName})`;

  return process.env.NODE_ENV === 'production' ? Component as unknown as React.FC<P> : WithRenderTraceDev;
}
