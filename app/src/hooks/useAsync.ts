import { useEffect, useRef, useState } from "react";

/**
 * Run an async loader once on mount and return its result, returning `fallback`
 * until it resolves. The result is ignored if the component unmounts first, so a
 * late-resolving fetch never sets state on an unmounted view.
 *
 * Views use this to read from the async {@link import("@services/ports").ContentService}
 * without each one re-implementing the load/cleanup dance. The loader is read from a
 * ref so a fresh closure each render does not re-trigger the fetch.
 */
export function useAsync<T>(load: () => Promise<T>, fallback: T): T {
  const [value, setValue] = useState<T>(fallback);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let live = true;
    void loadRef.current().then((next) => {
      if (live) setValue(next);
    });
    return () => {
      live = false;
    };
  }, []);

  return value;
}
