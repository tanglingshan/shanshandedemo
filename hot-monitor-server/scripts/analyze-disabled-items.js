import { PrismaClient } from '@prisma/client'
import { analyzeHotItem } from '../src/services/aiAnalyzer.js'

const prisma = new PrismaClient()

async function main() {
  // Find all items with disabled status
  const items = await prisma.hotItem.findMany({
    where: {
      analysisStatus: 'disabled'
    },
    orderBy: {
      collectedAt: 'desc'
    }
  })

  console.log(`Found ${items.length} items with 'disabled' status`)

  let analyzed = 0
  let failed = 0

  for (const item of items) {
    try {
      console.log(`\nAnalyzing: ${item.title?.slice(0, 60)}...`)
      await analyzeHotItem(item)
      analyzed++
      console.log(`  ✅ Success (${analyzed}/${items.length})`)
    } catch (error) {
      failed++
      console.error(`  ❌ Failed: ${error.message}`)

      // Mark as failed in database
      await prisma.hotItem.update({
        where: { id: item.id },
        data: { analysisStatus: 'failed' }
      })
    }
  }

  console.log(`\n\n📊 Summary:`)
  console.log(`  Total: ${items.length}`)
  console.log(`  Analyzed: ${analyzed}`)
  console.log(`  Failed: ${failed}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
