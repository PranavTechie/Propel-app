import { scanDirectories } from '../electron/services/cleaner/scannerService'
import { isProtectedPath } from '../electron/services/cleaner/pathGuard'
import {
  scanWindowsUpdateCache,
  scanPrefetch,
  scanDeliveryOptimization,
} from '../electron/services/cleaner/cacheCleaner'
import { scanBrowserCache } from '../electron/services/cleaner/browserCleaner'

async function run() {
  console.log('=== 1. Path Protection Guard Test ===')
  const testPath = 'C:\\Windows\\System32\\FakeSubfolder'
  console.log(`Testing isProtectedPath('${testPath}'):`, isProtectedPath(testPath))

  console.log(`Calling scanDirectories on protected path...`)
  const result = await scanDirectories([testPath], 'test-cat', () => {})
  console.log(`Files scanned in protected path (should be empty array):`, result)

  console.log('\n=== 3. New Categories Test ===')
  console.log('Scanning Windows Update Cache...')
  const winUpdateFiles = await scanWindowsUpdateCache(() => {})
  console.log(`Found ${winUpdateFiles.length} Windows Update cache files. Total Size: ${winUpdateFiles.reduce((acc, f) => acc + f.size, 0)} bytes.`)

  console.log('Scanning Prefetch...')
  const prefetchFiles = await scanPrefetch(() => {})
  console.log(`Found ${prefetchFiles.length} Prefetch files. Total Size: ${prefetchFiles.reduce((acc, f) => acc + f.size, 0)} bytes.`)
  if (prefetchFiles.length > 0) console.log(`Sample file: ${prefetchFiles[0].path}`)

  console.log('Scanning Delivery Optimization...')
  const deliveryFiles = await scanDeliveryOptimization(() => {})
  console.log(`Found ${deliveryFiles.length} Delivery Optimization files. Total Size: ${deliveryFiles.reduce((acc, f) => acc + f.size, 0)} bytes.`)

  console.log('Scanning Browser Cache (including Opera/Vivaldi/Arc)...')
  const browserFiles = await scanBrowserCache(() => {})
  console.log(`Found ${browserFiles.length} Browser Cache files. Total Size: ${browserFiles.reduce((acc, f) => acc + f.size, 0)} bytes.`)
}

run().catch(console.error)
