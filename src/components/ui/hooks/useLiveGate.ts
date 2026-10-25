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
