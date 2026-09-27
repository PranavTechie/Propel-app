// ── Exclusions ────────────────────────────────────────────────────────────
export type ExclusionType = 'folder' | 'file' | 'extension' | 'browser' | 'category'

export interface ExclusionEntry {
  id:        string
  type:      ExclusionType
  value:     string
  label:     string
  addedAt:   number
}

export interface ExclusionsConfig {
  version: 1
  entries: ExclusionEntry[]
}

// ── System Stats ──────────────────────────────────────────────────────────
export interface SystemStats {
  cpu: number
  ram: { used: number; total: number; free: number; percent: number }
  disk: { used: number; total: number; free: number; percent: number }
  network: { download: number; upload: number }
  uptime: number
  processes: number
  cpuModel: string
  cpuCores: number
  cpuSpeed: number
}

export interface EntitlementStatus {
  status: 'checking' | 'logged_out' | 'active' | 'no_internet' | 'error'
  plan: 'FREE' | 'PRO' | 'MAX'
  source: 'plan' | 'subscription' | 'trial'
  trial_active: boolean
  trial_expires_at: string | null
  subscription_status: string
}

export interface ScanCategory {
  id: string
  name: string
  description: string
  totalSize: number
  fileCount: number
  isSafe: boolean
  isCapped: boolean
}

export interface CleanResult {
  freed: number
  errors: number
}

export interface CleanupReport {
  id: string
  timestamp: number
  totalFreed: number
  filesRemoved: number
  errors: number
  errorDetails?: { path: string; reason: string }[]
  durationMs: number
  categories: string[]
}

export interface ScanProgressEvent {
  type: 'category-start' | 'file-found' | 'category-done' | 'scan-complete'
  categoryId?: string
  categoryName?: string
  currentPath?: string
  totalSize?: number
  fileCount?: number
  id?: string
  name?: string
  categories?: ScanCategory[]
  isCapped?: boolean
}

export interface CleanProgressEvent {
  type: 'file-cleaned' | 'clean-complete'
  current?: number
  total?: number
  currentFile?: string
  freed?: number
  report?: CleanupReport
}

export interface ToastMessage {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  description?: string
  duration?: number
}

export type AppPhase = 'splash' | 'no_internet' | 'login' | 'main'

export interface ChartDataPoint {
  time: string
  cpu: number
  ram: number
}

export interface UpdateInfo {
  hasUpdate: boolean
  latest_version?: string
  current_version?: string
  download_url?: string | null
  release_notes?: string | null
}

export type NavPage = 'dashboard' | 'cleaner' | 'memory' | 'maintenance' | 'performance' | 'ai' | 'systemcheck' | 'settings' | 'about'

export interface MaintenanceSettings {
  scheduleEnabled:            boolean
  scheduleFrequency:          'daily' | 'weekly' | 'monthly'
  recycleBinEnabled:          boolean
  ignoreDownloads:            boolean
  browserMasterEnabled:       boolean
  browserChrome:              boolean
  browserEdge:                boolean
  browserBrave:               boolean
  browserFirefox:             boolean
  startupEnabled:             boolean
  ramAlertsEnabled:           boolean
  ramAlertThreshold:          number
  diskAlertsEnabled:          boolean
  diskAlertThreshold:         number
  junkAlertsEnabled:          boolean
  junkAlertThreshold:         number
  startupAlertsEnabled:       boolean
  permissionAlertsEnabled:    boolean
  updateNotificationsEnabled: boolean
  safeCleaningMode:           boolean
  lastCleanupAt:              number | null
}

export interface MaintenanceStatus {
  nextCleanupAt:          number | null
  lastCleanupAt:          number | null
  startupEnabled:         boolean
  scheduleEnabled:        boolean
  scheduleFrequency:      'daily' | 'weekly' | 'monthly'
  ramAlertsEnabled:       boolean
  browserProtectionCount: number
}

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export interface UpdateProgress {
  percent: number
  bytesPerSecond: number
  transferred: number
  total: number
}

export interface UpdateState {
  available: boolean
  status: UpdateStatus
  currentVersion: string
  latestVersion: string
  releaseNotes?: string | string[]
  progress?: UpdateProgress
  error?: string
}

export interface MemoryDetails {
  total: number
  used: number
  free: number
  active: number
  available: number
  cached: number
  swapTotal: number
  swapUsed: number
  swapFree: number
  pressurePercent: number
  cachedPercent: number
  availablePercent: number
}

export interface ProcessMemInfo {
  pid: number
  name: string
  memBytes: number
  memPercent: number
  cpuPercent: number
}

export interface OptimizationResult {
  recoveredBytes: number
  processesOptimized: number
  durationMs: number
  optimizedProcesses: string[]
}

export interface PerformanceModeResult {
  enabled: boolean
  processesAffected: number
}

// ── AI Feature Types ──────────────────────────────────────────────────────

export interface SystemHealthData {
  cpuLoad: number
  ramPressure: number
  diskUsage: number
  tempJunkBytes: number
  startupAppCount: number
  browserMemoryBytes: number
  backgroundProcessCount: number
  uptimeSeconds: number
  totalRam: number
  freeRam: number
  totalDisk: number
  freeDisk: number
}

export interface HealthScore {
  overall: number
  cpu: number
  ram: number
  disk: number
  startup: number
  background: number
}

export interface Recommendation {
  id: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  title: string
  detail: string
  reclaimableBytes?: number
  action: 'optimize_ram' | 'clean_temp' | 'startup' | 'background' | 'disk'
}

export interface SmartBoostAnalysis {
  health: HealthScore
  systemData: SystemHealthData
  recommendations: Recommendation[]
  reclaimableRam: number
  reclaimableStorage: number
  analyzedAt: number
}

export interface SmartBoostResult {
  ramFreedBytes: number
  storageFreedBytes: number
  processesOptimized: number
  actionsApplied: string[]
  durationMs: number
}


export type StartupImpact = 'critical' | 'high' | 'medium' | 'low' | 'unknown'

export interface StartupEntry {
  id: string
  name: string
  displayName: string
  command: string
  location: 'HKCU_Run' | 'HKLM_Run' | 'StartupFolder_User' | 'StartupFolder_All'
  enabled: boolean
  impact: StartupImpact
  impactLabel: string
  estimatedDelaySec: number
  recommendation: string
  publisher: string
}

export interface StartupAnalysis {
  entries: StartupEntry[]
  bootScore: number
  totalEstimatedDelaySec: number
  highImpactCount: number
  analyzedAt: number
}

export interface DuplicateFile {
  path: string
  size: number
  name: string
  extension: string
  isOriginal: boolean
}

export type DuplicateCategory = 'images' | 'videos' | 'documents' | 'archives' | 'installers' | 'other'

export interface DuplicateGroup {
  hash: string
  size: number
  count: number
  totalWasted: number
  files: DuplicateFile[]
  category: DuplicateCategory
}

export interface DuplicateScanResult {
  groups: DuplicateGroup[]
  totalFiles: number
  totalDuplicates: number
  totalWastedBytes: number
  scannedBytes: number
  scannedFiles: number
  durationMs: number
  scannedAt: number
}

export type DuplicateScanProgress = {
  phase: 'scanning' | 'hashing' | 'grouping' | 'done'
  scannedFiles: number
  hashedFiles: number
  totalFiles: number
  currentPath: string
  duplicatesFound: number
}
