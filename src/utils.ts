type ChangedProps = {
  [key: string]: { previous: any; current: any; deepChanged?: boolean };
};

export interface GetChangedPropsOptions {
  depth?: number;
  ignoreFunctions?: boolean;
}

export function getChangedProps(
  prevProps: Record<string, any>,
  nextProps: Record<string, any>,
  options: GetChangedPropsOptions = { depth: 1, ignoreFunctions: false }
): string[] {
  const { depth = 1, ignoreFunctions = false } = options;
  const changed: string[] = [];

  const compare = (prev: any, next: any, path: string, currentDepth: number) => {
    if (prev === next) return;

    if (ignoreFunctions && typeof prev === 'function' && typeof next === 'function') {
      return;
    }

    if (
      currentDepth > 0 &&
      typeof prev === 'object' && prev !== null &&
      typeof next === 'object' && next !== null &&
      !Array.isArray(prev) && !Array.isArray(next)
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

      if (!internalChange && path !== '') {
        // Reference changed but shallower properties are the same
        changed.push(path);
      }
    } else {
      if (path !== '') {
        changed.push(path);
      }
    }
  };

  const allTopKeys = Array.from(new Set([...Object.keys(prevProps || {}), ...Object.keys(nextProps || {})]));
  allTopKeys.forEach(key => {
    compare(prevProps[key] || undefined, nextProps[key] || undefined, key, depth);
  });

  return changed;
}
