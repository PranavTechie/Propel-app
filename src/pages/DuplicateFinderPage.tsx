import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Files,
  Scan,
  CheckCircle,
  Shield,
  ChevronRight,
  Trash2,
  Search,
  ListChecks,
} from "lucide-react";
import { useSessionStore } from "@/store/sessionStore";
import { cn } from "@/utils/cn";
import { formatBytes } from "@/utils/format";
import { Button } from "@/components/ui/Button";
import { Card, CardEyebrow } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ConfirmDialog } from "@/components/ui/Modal";
import { Checkbox } from "@/components/ui/Checkbox";
import { Progress } from "@/components/ui/Progress";
import { StatusPill } from "@/components/ui/StatusPill";
import { Callout } from "@/components/ui/Callout";
import { EmptyState } from "@/components/ui/EmptyState";
import type {
  DuplicateScanResult,
  DuplicateGroup,
  DuplicateScanProgress,
} from "@/types";

const DuplicateSelectionBar: React.FC = () => {
  const [confirmOpen, setConfirmOpen] = useState(false);
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

  const affected =
    dupScanResult?.groups
      .flatMap((group: DuplicateGroup) => group.files)
      .filter((file: { path: string }) => dupSelected.has(file.path)) ?? [];

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
        className="fixed bottom-5 left-1/2 z-40 flex w-[min(100%-2rem,42rem)] -translate-x-1/2 items-center gap-4 rounded-card border border-line bg-surface-popover px-4 py-3 shadow-[var(--shadow-4),var(--highlight-top)]"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand-fg">
          <ListChecks className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-body font-semibold text-fg-1 tabular">{dupSelected.size} files selected</p>
          <p className="text-caption text-fg-3 tabular">Recoverable space: {formatBytes(selectedSpace)}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setAi({ dupSelected: new Set<string>() })}>
          Clear Selection
        </Button>
        <Button variant="danger" size="sm" icon={<Trash2 />} onClick={() => setConfirmOpen(true)}>
          Delete Selected
        </Button>
      </motion.div>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete ${dupSelected.size} duplicate ${dupSelected.size === 1 ? "file" : "files"}?`}
        description="These copies will be removed. The original in each group is always kept."
        summary={`${dupSelected.size} ${dupSelected.size === 1 ? "file" : "files"} · ${formatBytes(selectedSpace)}`}
        items={affected.map((f: { path: string; size: number }) => ({
          id: f.path,
          label: <span className="font-mono text-[11px]" title={f.path}>{f.path}</span>,
          meta: formatBytes(f.size),
        }))}
        confirmLabel="Delete Selected"
        onConfirm={() => {
          setConfirmOpen(false);
          window.dispatchEvent(new Event("propel:duplicate-delete-selected"));
        }}
      />
    </>
  );
};

const STEPS = [
  { n: "01", title: "Scan", desc: "Find potential duplicate files." },
  { n: "02", title: "Review", desc: "Compare duplicate groups and choose what to keep." },
  { n: "03", title: "Clean", desc: "Safely remove selected duplicates." },
];

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

  const selectedBytes = scanResult
    ? [...selected].reduce(
        (sum, path) =>
          sum +
          (scanResult.groups.flatMap((g) => g.files).find((f) => f.path === path)?.size ?? 0),
        0
      )
    : 0;

  return (
    <div className="page-shell relative">
      <div className="mx-auto w-full max-w-6xl space-y-4 pb-20">
        <PageHeader
          eyebrow="Storage care"
          title="Duplicate Finder"
          subtitle="Hash-based duplicate detection & safe removal"
          action={
            <Button onClick={startScan} loading={scanning} icon={<Scan />}>
              {scanning ? "Scanning..." : "Scan Files"}
            </Button>
          }
        />

        {!scanResult && !scanning && (
          <Card level="feature" className="p-0">
            <div className="grid grid-cols-[1.3fr_1fr] max-[860px]:grid-cols-1">
              <div className="relative p-7">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgb(var(--c-brand-glow)/.1),transparent)]"
                />
                <div className="relative">
                  <span className="flex h-12 w-12 items-center justify-center rounded-card bg-brand-soft text-brand-fg">
                    <Files className="h-6 w-6" />
                  </span>
                  <h2 className="mt-5 font-display text-[22px] font-semibold leading-7 tracking-[-.02em] text-fg-1">
                    Find duplicate files safely
                  </h2>
                  <p className="mt-2 text-body text-fg-2">
                    Scan selected locations for identical files using hash-based detection.
                  </p>
                  <p className="mt-4 text-body-sm text-fg-3">
                    Press <span className="font-semibold text-fg-1">Scan Files</span> at top right to
                    begin scanning. Files are only removed after your review.
                  </p>
                </div>
              </div>
              <div className="border-l border-line-subtle bg-surface-inset/60 p-6 max-[860px]:border-l-0 max-[860px]:border-t">
                <CardEyebrow>How it works</CardEyebrow>
                <ol className="mt-4 space-y-4">
                  {STEPS.map((s) => (
                    <li key={s.n} className="flex gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line bg-surface-raised text-caption font-bold text-brand-fg shadow-[var(--shadow-1)] tabular">
                        {s.n}
                      </span>
                      <span>
                        <span className="block text-body font-semibold text-fg-1">{s.title}</span>
                        <span className="block text-caption text-fg-3">{s.desc}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </Card>
        )}

        {scanning && progress && (
          <Card level="feature" className="p-6" role="status">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-control bg-brand-soft text-brand-fg">
                <Search className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-title font-semibold text-fg-1">
                  {progress.phase === "hashing" ? "Hashing files..." : "Scanning files..."}
                </p>
                <p className="truncate font-mono text-[11px] text-fg-3" title={progress.currentPath}>
                  {progress.currentPath || "Preparing…"}
                </p>
              </div>
            </div>
            <Progress
              value={
                progress.phase === "hashing" && progress.totalFiles > 0
                  ? (progress.hashedFiles / progress.totalFiles) * 100
                  : null
              }
              indeterminate={!(progress.phase === "hashing" && progress.totalFiles > 0)}
              tone="brand"
              size="md"
              className="mt-5"
              aria-label="Duplicate scan progress"
            />
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                ["Files scanned", progress.scannedFiles.toLocaleString()],
                ["Files hashed", progress.hashedFiles.toLocaleString()],
                ["Duplicates found", progress.duplicatesFound.toLocaleString()],
              ].map(([label, value]) => (
                <div key={label} className="rounded-control border border-line-subtle bg-surface-inset px-3 py-2.5">
                  <p className="text-caption text-fg-3">{label}</p>
                  <p className="mt-0.5 text-title font-semibold text-fg-1 tabular">{value}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {scanResult && !scanning && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {[
                ["Duplicate Groups", scanResult.groups.length],
                ["Duplicate Files", scanResult.totalDuplicates],
                ["Recoverable Space", formatBytes(scanResult.totalWastedBytes)],
              ].map(([label, value]) => (
                <Card key={label} className="p-4">
                  <p className="text-caption text-fg-3">{label}</p>
                  <p className="mt-1.5 font-display text-metric font-semibold text-fg-1 tabular">{value}</p>
                </Card>
              ))}
            </div>

            {deleteResult && (
              <Callout tone="success" compact>
                Removed {deleteResult.deletedCount} files and freed {formatBytes(deleteResult.freedBytes)}.
              </Callout>
            )}

            {groups.length === 0 ? (
              <Card>
                <EmptyState
                  icon={<CheckCircle />}
                  tone="brand"
                  title="No duplicates found"
                  description="Your selected locations don't contain identical files."
                />
              </Card>
            ) : (
              <Card className="overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-subtle px-5 py-3.5">
                  <div>
                    <CardEyebrow>Review</CardEyebrow>
                    <h3 className="mt-0.5 text-title font-semibold text-fg-1">Duplicate Groups</h3>
                  </div>
                  <span className="text-caption text-fg-3 tabular">
                    Selected: {selected.size} files · Potential space: {formatBytes(selectedBytes)}
                  </span>
                </div>

                <ul className="divide-y divide-line-subtle">
                  {groups.map((group) => {
                    const duplicates = group.files.filter((f) => !f.isOriginal);
                    const allSelected = duplicates.every((f) => selected.has(f.path));
                    const expanded = expandedGroups.has(group.hash);
                    return (
                      <li key={group.hash}>
                        <div className="flex items-center gap-3 px-5 py-3 transition-colors duration-fast hover:bg-state/[var(--a-hover)]">
                          <Checkbox
                            checked={allSelected}
                            onChange={() => selectFiles(duplicates.map((f) => f.path))}
                            aria-label={`Select duplicates of ${group.files[0]?.name}`}
                          />
                          <button
                            onClick={() => toggleGroup(group.hash)}
                            aria-expanded={expanded}
                            className="flex min-w-0 flex-1 items-center gap-3 rounded-chip text-left focus-visible:shadow-ring"
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-surface-inset text-fg-2">
                              <Files className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-body font-semibold text-fg-1">
                                {group.files[0]?.name}
                              </span>
                              <span className="block text-caption text-fg-3 tabular">
                                {group.count} copies · {formatBytes(group.size)} each
                              </span>
                            </span>
                            <ChevronRight
                              className={cn(
                                "h-4 w-4 shrink-0 text-fg-3 transition-transform duration-base",
                                expanded && "rotate-90"
                              )}
                            />
                          </button>
                        </div>
                        {expanded && (
                          <ul className="border-t border-line-subtle bg-surface-inset/70 px-5 py-1.5">
                            {group.files.map((file) => (
                              <li key={file.path} className="flex items-center gap-3 py-1.5">
                                <span className="flex w-4 shrink-0 justify-center">
                                  {file.isOriginal ? (
                                    <Shield className="h-3.5 w-3.5 text-success-fg" aria-label="Original, kept" />
                                  ) : (
                                    <Checkbox
                                      checked={selected.has(file.path)}
                                      onChange={() => selectFiles([file.path])}
                                      aria-label={`Select ${file.path}`}
                                    />
                                  )}
                                </span>
                                <span
                                  className="min-w-0 flex-1 truncate font-mono text-[11px] text-fg-2"
                                  title={file.path}
                                >
                                  {file.path}
                                </span>
                                {file.isOriginal && <StatusPill tone="healthy">Original</StatusPill>}
                                <span className="shrink-0 text-caption text-fg-3 tabular">{formatBytes(file.size)}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Card>
            )}

            {deleting && (
              <Callout tone="info" compact role="status">
                Deleting...
              </Callout>
            )}
          </div>
        )}
      </div>

      <DuplicateSelectionBar />
    </div>
  );
};
