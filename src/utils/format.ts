export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`
}

export function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function formatMbps(mbps: number): string {
  if (mbps < 0.01) return '< 0.01 Mbps'
  if (mbps > 1000) return `${(mbps / 1000).toFixed(1)} Gbps`
  return `${mbps.toFixed(2)} Mbps`
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`
}

export function getHealthScore(cpu: number, ram: number, disk: number): number {
  const cpuScore = Math.max(0, 100 - cpu)
  const ramScore = Math.max(0, 100 - ram)
  const diskScore = Math.max(0, 100 - disk * 0.5)
  return Math.round((cpuScore * 0.3 + ramScore * 0.4 + diskScore * 0.3))
}

export function getHealthLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'Excellent', color: '#10b981' }
  if (score >= 60) return { label: 'Good', color: '#3b82f6' }
  if (score >= 40) return { label: 'Fair', color: '#f59e0b' }
  return { label: 'Poor', color: '#ef4444' }
}

export function maskLicenseKey(key: string): string {
  if (key.length <= 8) return '••••••••'
  return key.slice(0, 4) + '-••••-••••-' + key.slice(-4)
}
