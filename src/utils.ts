type ChangedProps = {
  [key: string]: { previous: any; current: any; deepChanged?: boolean };
};

export function getChangedProps(
  prevProps: Record<string, any>,
  nextProps: Record<string, any>,
  depth: number = 1
): string[] {
  const changed: string[] = [];

  const compare = (prev: any, next: any, path: string, currentDepth: number) => {
    if (prev === next) return;

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
    compare(prevProps[key], nextProps[key], key, depth);
  });

  return changed;
}
