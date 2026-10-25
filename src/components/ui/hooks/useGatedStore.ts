import { useRef } from "react";
import { useAppStore } from "@/store/appStore";
import { useLiveGate } from "./useLiveGate";

type AppState = ReturnType<typeof useAppStore.getState>;

/**
 * Read-only store selector that freezes while the page is inactive or the
 * window is hidden. The frozen value is returned by reference, so the
 * component does not re-render on background stat polls.
 */
export function useGatedStore<T>(selector: (s: AppState) => T): T {
  const live = useLiveGate();
  const last = useRef<{ v: T } | null>(null);
  return useAppStore((s) => {
    if (live || last.current === null) last.current = { v: selector(s) };
    return last.current.v;
  });
}
