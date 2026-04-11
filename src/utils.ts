type ChangedProps = {
  [key: string]: { previous: any; current: any; deepChanged?: boolean };
};

export function getChangedProps(
  prevProps: Record<string, any>,
  nextProps: Record<string, any>,
  depth: number = 1
): string[] {
  const allKeys = Array.from(new Set([...Object.keys(prevProps), ...Object.keys(nextProps)]));
  const changed: string[] = [];

  allKeys.forEach((key) => {
    if (prevProps[key] !== nextProps[key]) {
      // Shallow difference detected
      
      // If we want to support depth > 1 for objects (React props usually shallow compared)
      if (
        depth > 1 &&
        typeof prevProps[key] === 'object' && prevProps[key] !== null &&
        typeof nextProps[key] === 'object' && nextProps[key] !== null &&
        !Array.isArray(prevProps[key]) // Skip arrays for simplicity, or we can deep compare them too
      ) {
        const nestedChanges = getChangedProps(prevProps[key], nextProps[key], depth - 1);
        if (nestedChanges.length > 0) {
          nestedChanges.forEach(nestedKey => {
            changed.push(`${key}.${nestedKey}`);
          });
        } else {
           // Reference changed but values are same.
           changed.push(key);
        }
      } else {
        changed.push(key);
      }
    }
  });

  return changed;
}
