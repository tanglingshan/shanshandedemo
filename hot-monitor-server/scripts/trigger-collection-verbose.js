import { runAllCollectors } from '../src/services/collectorService.js'

console.log('Starting manual hot item collection with detailed logging...')

// Enable more verbose logging
const originalConsoleLog = console.log
const originalConsoleError = console.error

console.log = (...args) => {
  originalConsoleLog('[LOG]', new Date().toISOString(), ...args)
}

console.error = (...args) => {
  originalConsoleError('[ERROR]', new Date().toISOString(), ...args)
}

runAllCollectors()
  .then(() => {
    console.log('✅ Collection completed successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Collection failed:', error)
    console.error('Stack trace:', error.stack)
    process.exit(1)
  })
