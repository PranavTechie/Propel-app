import { createContext, useContext, useEffect, useState } from "react";

/**
 * True while the page that renders the component is the active page.
 * AppLayout keeps every page mounted, so live widgets on hidden pages use
 * this to stop updating.
 */
export const PageActiveContext = createContext(true);

/** True while the window is visible (false when minimized or in the tray). */
export function useWindowVisible(): boolean {
  const [visible, setVisible] = useState(() => !document.hidden);
  useEffect(() => {
    const onChange = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);
  return visible;
}

/**
 * Gate for live UI work (sparkline buffers, clocks, count-ups, chart
 * redraws): false when the window is hidden or the page is not active.
 */
export function useLiveGate(): boolean {
  const pageActive = useContext(PageActiveContext);
  const windowVisible = useWindowVisible();
  return pageActive && windowVisible;
}

/**
 * Gate for framer-motion `layout` animations on pages that stay mounted
 * with display:none. AppLayout re-renders every page in the same commit that
 * toggles `display`, so a layout snapshot taken in that commit measures a
 * hidden (zero) rect and the element flies in from the top-left.
 *
 * Returns false while the page is inactive or the window is hidden, AND
 * until the page entrance transition has settled. Layout animation is
 * therefore only on for live reorders while the user is looking.
 */
const PAGE_SETTLE_MS = 240;

export function useLayoutReady(): boolean {
  const live = useLiveGate();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!live) {
      setReady(false);
      return;
    }
    // Arm after the 200ms page fade/slide has settled, so reorder snapshots
    // are never taken while an ancestor is still translating.
    const id = window.setTimeout(() => setReady(true), PAGE_SETTLE_MS);
    return () => window.clearTimeout(id);
  }, [live]);
  // `live` is read in the same render that toggles display, so layout is
  // already off in that commit (both on leave and on re-entry).
  return live && ready;
}
