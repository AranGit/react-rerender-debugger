export interface GetChangedPropsOptions {
  depth?: number;
  ignoreFunctions?: boolean;
  ignoreReactNodes?: boolean;
}

export function getChangedProps(
  prevProps: Record<string, any>,
  nextProps: Record<string, any>,
  options: GetChangedPropsOptions = { depth: 1, ignoreFunctions: false, ignoreReactNodes: true }
): string[] {
  const { depth = 1, ignoreFunctions = false, ignoreReactNodes = true } = options;
  const changed: string[] = [];

  const compare = (prev: any, next: any, path: string, currentDepth: number) => {
    if (prev === next) return;

    // Skip inline arrow function reference changes (common in JSX props)
    if (ignoreFunctions && typeof prev === 'function' && typeof next === 'function') {
      return;
    }

    // Skip React element / children prop noise — reference always changes on parent re-render
    const isReactNode = (obj: any) => obj && typeof obj === 'object' && obj.$$typeof;
    if (ignoreReactNodes && (isReactNode(prev) || isReactNode(next))) {
      return;
    }

    // --- ARRAY COMPARISON (Fix: element-by-element, not reference-only) ---
    if (Array.isArray(prev) && Array.isArray(next)) {
      if (prev.length !== next.length) {
        if (path !== '') changed.push(`${path} (length ${prev.length}→${next.length})`);
        return;
      }
      if (currentDepth > 0) {
        let anyElementChanged = false;
        for (let i = 0; i < prev.length; i++) {
          const before = changed.length;
          compare(prev[i], next[i], `${path}[${i}]`, currentDepth - 1);
          if (changed.length !== before) anyElementChanged = true;
        }
        // Array reference changed but ALL elements are deeply equal — treat as harmless
        if (!anyElementChanged) return;
      } else if (path !== '') {
        changed.push(path);
      }
      return;
    }

    // --- OBJECT COMPARISON ---
    if (
      currentDepth > 0 &&
      typeof prev === 'object' && prev !== null &&
      typeof next === 'object' && next !== null
    ) {
      const allKeys = Array.from(new Set([...Object.keys(prev), ...Object.keys(next)]));
      let internalChange = false;

      allKeys.forEach((key) => {
        if (prev[key] !== next[key]) {
          internalChange = true;
          const newPath = path ? `${path}.${key}` : key;
          compare(prev[key], next[key], newPath, currentDepth - 1);
        }
      });

      // Object reference changed but all shallow properties are the same — treat as harmless
      if (!internalChange) return;
    } else {
      // Primitive or exhausted depth
      if (path !== '') {
        changed.push(path);
      }
    }
  };

  const allTopKeys = Array.from(new Set([
    ...Object.keys(prevProps || {}),
    ...Object.keys(nextProps || {}),
  ]));

  allTopKeys.forEach(key => {
    compare(prevProps[key] ?? undefined, nextProps[key] ?? undefined, key, depth);
  });

  return changed;
}
