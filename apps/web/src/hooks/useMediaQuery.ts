import { useEffect, useState } from "react";

/** True while the CSS media query matches, e.g. useMediaQuery("(min-width: 768px)"). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

/** Laptop-sized screen (Tailwind's md breakpoint and up). */
export const useIsWide = () => useMediaQuery("(min-width: 768px)");
