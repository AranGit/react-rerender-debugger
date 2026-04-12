'use client';

import React, { ReactNode } from 'react';

declare var process: {
  env: {
    NODE_ENV: string;
  };
};
import { RenderTraceDev, RenderTraceConfig } from './RenderTraceDev';

export interface RenderTraceProps {
  children?: ReactNode;
  name?: string;
  config?: RenderTraceConfig;
  track?: Record<string, any>;
  [key: string]: any;
}

// Prod version is a complete no-op, just rendering the children directly
const RenderTraceProd: React.FC<RenderTraceProps> = ({ children }) => <>{children}</>;

export const RenderTrace: React.FC<RenderTraceProps> = 
  process.env.NODE_ENV === 'production' ? RenderTraceProd : (RenderTraceDev as any);
