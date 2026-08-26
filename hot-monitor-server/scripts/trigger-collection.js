import { runAllCollectors } from '../src/services/collectorService.js'

console.log('Starting manual hot item collection...')

runAllCollectors()
  .then(() => {
    console.log('✅ Collection completed successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Collection failed:', error)
    process.exit(1)
  })
