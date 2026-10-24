import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Files,
  Scan,
  RefreshCw,
  CheckCircle,
  Shield,
  ChevronRight,
} from "lucide-react";
import { useSessionStore } from "@/store/sessionStore";
import { cn } from "@/utils/cn";
import { formatBytes } from "@/utils/format";
import type {
  DuplicateScanResult,
  DuplicateGroup,
  DuplicateScanProgress,
} from "@/types";

const DuplicateSelectionBar: React.FC = () => {
  const { dupScanResult, dupSelected } = useSessionStore((s) => s.ai);
  const setAi = useSessionStore((s) => s.setAi);
  const selectedSpace =
    dupScanResult?.groups
      .flatMap((group: DuplicateGroup) => group.files)
      .filter((file: { path: string; size: number }) =>
        dupSelected.has(file.path)
      )
      .reduce(
        (total: number, file: { path: string; size: number }) =>
          total + file.size,
        0
      ) ?? 0;

  if (dupSelected.size === 0) return null;

  return (
    <div className="fixed bottom-5 left-1/2 z-40 flex w-[min(100%-2rem,42rem)] -translate-x-1/2 items-center gap-4 rounded-xl border border-border/70 bg-bg-elevated/95 px-4 py-3 shadow-xl backdrop-blur-md">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text-primary">
          {dupSelected.size} files selected
        </p>
        <p className="text-xs text-text-muted">
          Recoverable space: {formatBytes(selectedSpace)}
        </p>
      </div>
      <button
        onClick={() => setAi({ dupSelected: new Set<string>() })}
        className="text-xs font-semibold text-text-muted hover:text-text-primary"
      >
        Clear Selection
      </button>
      <button
        onClick={() =>
          window.dispatchEvent(new Event("propel:duplicate-delete-selected"))
        }
        className="rounded-lg bg-[#5AA63C] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#4f9635]"
      >
        Delete Selected
      </button>
    </div>
  );
};

export const DuplicateFinderPage: React.FC = () => {
  const {
    dupScanResult: scanResult,
    dupProgress: progress,
    dupSelected: selected,
    dupExpandedGroups: expandedGroups,
    dupDeleteResult: deleteResult,
    dupFilterCategory: filterCategory,
  } = useSessionStore((s) => s.ai) as {
    dupScanResult: DuplicateScanResult | null;
    dupProgress: DuplicateScanProgress | null;
    dupSelected: Set<string>;
    dupExpandedGroups: Set<string>;
    dupDeleteResult: { freedBytes: number; deletedCount: number } | null;
    dupFilterCategory: string;
  };
  const setAi = useSessionStore((s) => s.setAi);
  const [scanning, setScanning] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const startScan = useCallback(async () => {
    setScanning(true);
    setAi({
      dupScanResult: null,
      dupSelected: new Set(),
      dupDeleteResult: null,
      dupProgress: {
        phase: "scanning",
        scannedFiles: 0,
        hashedFiles: 0,
        totalFiles: 0,
        currentPath: "",
        duplicatesFound: 0,
      },
    });
    window.propel.ai.onDuplicateScanProgress((p) => setAi({ dupProgress: p }));
    try {
      setAi({
        dupScanResult: await window.propel.ai.scanDuplicates(null, []),
      });
    } finally {
      setScanning(false);
      setAi({ dupProgress: null });
      window.propel.ai.removeListeners();
    }
  }, [setAi]);

  const toggleGroup = (hash: string) =>
    setAi((s) => {
      const next = new Set<string>(s.dupExpandedGroups);
      next.has(hash) ? next.delete(hash) : next.add(hash);
      return { dupExpandedGroups: next };
    });

  const selectFiles = (paths: string[]) =>
    setAi((s) => {
      const next = new Set<string>(s.dupSelected);
      paths.forEach((path) =>
        next.has(path) ? next.delete(path) : next.add(path)
      );
      return { dupSelected: next };
    });

  const deleteSelected = useCallback(async () => {
    if (!selected.size) return;
    setDeleting(true);
    try {
      const res = await window.propel.ai.deleteDuplicates([...selected]);
      setAi((s) => ({
        dupDeleteResult: {
          freedBytes: res.freedBytes,
          deletedCount: res.deletedCount,
        },
        dupSelected: new Set<string>(),
        dupScanResult: s.dupScanResult
          ? {
              ...s.dupScanResult,
              groups: s.dupScanResult.groups
                .map((g: DuplicateGroup) => ({
                  ...g,
                  files: g.files.filter((f) => !selected.has(f.path)),
                }))
                .filter((g: DuplicateGroup) => g.files.length > 1),
            }
          : null,
      }));
    } finally {
      setDeleting(false);
    }
  }, [selected, setAi]);

  useEffect(() => {
    const onDeleteSelected = () => {
      void deleteSelected();
    };
    window.addEventListener(
      "propel:duplicate-delete-selected",
      onDeleteSelected
    );
    return () =>
      window.removeEventListener(
        "propel:duplicate-delete-selected",
        onDeleteSelected
      );
  }, [deleteSelected]);

  const groups =
    scanResult?.groups.filter(
      (g) => filterCategory === "all" || g.category === filterCategory
    ) ?? [];

  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      {/* ── Page Header ── */}
      <div className="shrink-0 px-6 pt-6 pb-4">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-5xl mx-auto w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center shadow-glow-md">
              <Files className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-text-primary">
                Duplicate Finder
              </h1>
              <p className="text-sm text-text-secondary mt-0.5">
                Hash-based duplicate detection &amp; safe removal
              </p>
            </div>
          </div>
          <button
            onClick={startScan}
            disabled={scanning}
            className="flex items-center gap-2 rounded-lg bg-[#5AA63C] px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[#4f9635] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Scan className={cn("h-3.5 w-3.5", scanning && "animate-spin")} />
            {scanning ? "Scanning..." : "Scan Files"}
          </button>
        </motion.div>
      </div>

      {/* ── Page Content ── */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="max-w-5xl mx-auto w-full space-y-5">
          {!scanResult && !scanning && (
            <div className="grid gap-5 rounded-2xl border border-border/60 bg-white/[0.025] p-7 md:grid-cols-[1.3fr_1fr]">
              <div>
                <h3 className="text-lg font-bold text-text-primary">
                  Find duplicate files safely
                </h3>
                <p className="mt-2 text-sm text-text-secondary leading-relaxed">
                  Scan selected locations for identical files using hash-based
                  detection.
                </p>
                <p className="mt-4 text-xs text-text-muted leading-relaxed">
                  Press{" "}
                  <span className="font-semibold text-text-primary">
                    Scan Files
                  </span>{" "}
                  at top right to begin scanning. Files are only removed after
                  your review.
                </p>
              </div>
              <div className="border-l border-border/40 pl-5 text-xs text-text-muted">
                <p className="font-semibold text-text-primary">How it works</p>
                <div className="mt-3 space-y-3">
                  <p>
                    <b className="mr-2 text-brand-primary">01</b>Scan
                    <br />
                    <span className="ml-7 text-2xs text-text-muted/80">
                      Find potential duplicate files.
                    </span>
                  </p>
                  <p>
                    <b className="mr-2 text-brand-primary">02</b>Review
                    <br />
                    <span className="ml-7 text-2xs text-text-muted/80">
                      Compare duplicate groups and choose what to keep.
                    </span>
                  </p>
                  <p>
                    <b className="mr-2 text-brand-primary">03</b>Clean
                    <br />
                    <span className="ml-7 text-2xs text-text-muted/80">
                      Safely remove selected duplicates.
                    </span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {scanning && progress && (
            <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-white/[0.025] p-5 text-sm text-text-secondary">
              <RefreshCw className="h-4 w-4 animate-spin text-brand-primary" />
              {progress.phase === "hashing"
                ? "Hashing files..."
                : "Scanning files..."}
            </div>
          )}

          {scanResult && !scanning && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  ["Duplicate Groups", scanResult.groups.length],
                  ["Duplicate Files", scanResult.totalDuplicates],
                  ["Recoverable Space", formatBytes(scanResult.totalWastedBytes)],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-border/50 bg-white/[0.025] p-3"
                  >
                    <p className="text-2xs text-text-muted">{label}</p>
                    <p className="mt-1 text-lg font-bold text-text-primary">
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              {deleteResult && (
                <p className="text-xs text-emerald-400">
                  Removed {deleteResult.deletedCount} files and freed{" "}
                  {formatBytes(deleteResult.freedBytes)}.
                </p>
              )}

              {groups.length === 0 ? (
                <div className="flex flex-col items-center rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-10 text-center">
                  <CheckCircle className="h-8 w-8 text-emerald-400" />
                  <h3 className="mt-3 text-base font-bold text-text-primary">
                    No duplicates found
                  </h3>
                  <p className="mt-1 text-xs text-text-muted">
                    Your selected locations don't contain identical files.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-sm font-bold text-text-primary">
                      Duplicate Groups
                    </h3>
                    <span className="text-xs text-text-muted">
                      Selected: {selected.size} files · Potential space:{" "}
                      {formatBytes(
                        [...selected].reduce(
                          (sum, path) =>
                            sum +
                            (scanResult.groups
                              .flatMap((g) => g.files)
                              .find((f) => f.path === path)?.size ?? 0),
                          0
                        )
                      )}
                    </span>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-border/50 divide-y divide-border/40">
                    {groups.map((group) => {
                      const duplicates = group.files.filter((f) => !f.isOriginal);
                      const allSelected = duplicates.every((f) =>
                        selected.has(f.path)
                      );
                      return (
                        <div key={group.hash}>
                          <div className="flex items-center gap-3 p-4 hover:bg-white/[0.025]">
                            <input
                              type="checkbox"
                              checked={allSelected}
                              onChange={() =>
                                selectFiles(duplicates.map((f) => f.path))
                              }
                              className="accent-[rgb(var(--c-accent))]"
                            />
                            <button
                              onClick={() => toggleGroup(group.hash)}
                              className="flex min-w-0 flex-1 items-center gap-3 text-left"
                            >
                              <Files className="h-4 w-4 shrink-0 text-brand-primary" />
                              <span className="truncate text-sm font-semibold text-text-primary">
                                {group.files[0]?.name}
                              </span>
                              <span className="text-2xs text-text-muted">
                                {group.count} copies · {formatBytes(group.size)}{" "}
                                each
                              </span>
                              <ChevronRight
                                className={cn(
                                  "ml-auto h-4 w-4 text-text-muted transition-transform",
                                  expandedGroups.has(group.hash) && "rotate-90"
                                )}
                              />
                            </button>
                          </div>
                          {expandedGroups.has(group.hash) && (
                            <div className="border-t border-border/40 bg-white/[0.015] px-4 py-2">
                              {group.files.map((file) => (
                                <div
                                  key={file.path}
                                  className="flex items-center gap-3 py-2 text-xs"
                                >
                                  <span className="w-4 shrink-0">
                                    {file.isOriginal ? (
                                      <Shield className="h-3.5 w-3.5 text-emerald-400" />
                                    ) : (
                                      <input
                                        type="checkbox"
                                        checked={selected.has(file.path)}
                                        onChange={() =>
                                          selectFiles([file.path])
                                        }
                                        className="accent-[rgb(var(--c-accent))]"
                                      />
                                    )}
                                  </span>
                                  <span
                                    className="min-w-0 flex-1 truncate text-text-secondary"
                                    title={file.path}
                                  >
                                    {file.path}
                                  </span>
                                  <span className="shrink-0 text-text-muted">
                                    {formatBytes(file.size)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {selected.size > 0 && (
                    <button
                      onClick={deleteSelected}
                      disabled={deleting}
                      className="rounded-lg bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/25 disabled:opacity-60"
                    >
                      {deleting
                        ? "Deleting..."
                        : `Delete ${selected.size} selected`}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <DuplicateSelectionBar />
    </div>
  );
};
