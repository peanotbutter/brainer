// A tiny "router": the current screen is stored after the # in the address,
// e.g. .../brainer/#/new. Using the # means the phone's Back button works
// and GitHub Pages never shows a "404 not found" page.

import { useEffect, useState } from 'react';

function currentPath(): string {
  return window.location.hash.replace(/^#/, '') || '/';
}

/** Returns the current path (like "/new") and re-renders when it changes. */
export function usePath(): string {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const onChange = () => setPath(currentPath());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return path;
}

/** Go to another screen, e.g. go('/new'). */
export function go(path: string) {
  window.location.hash = path;
}
