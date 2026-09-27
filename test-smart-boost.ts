import { runSmartBoostAnalysis, runSmartBoostOptimize } from './electron/services/ai/smartBoostService'

async function test() {
  console.log('Running analysis...')
  const analysis = await runSmartBoostAnalysis()
  console.log('Analysis result:', JSON.stringify(analysis.health, null, 2))
  console.log('Recommendations:', JSON.stringify(analysis.recommendations, null, 2))

  console.log('Running optimize...')
  const result = await runSmartBoostOptimize((step, pct) => {
    console.log(`[${pct}%] ${step}`)
  })
  console.log('Optimize result:', JSON.stringify(result, null, 2))
}

test().catch(console.error)
