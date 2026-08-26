import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Check bilibili hot items
  const items = await prisma.hotItem.findMany({
    where: {
      sourceCode: 'bilibili'
    },
    select: {
      id: true,
      title: true,
      analysisStatus: true,
      aiAnalysis: {
        select: {
          summary: true,
          relevanceScore: true
        }
      }
    },
    orderBy: {
      collectedAt: 'desc'
    },
    take: 10
  })

  console.log(`Found ${items.length} bilibili items:`)
  items.forEach((item, idx) => {
    console.log(`\n${idx + 1}. ${item.title?.slice(0, 50)}...`)
    console.log(`   Status: ${item.analysisStatus}`)
    console.log(`   AI Analysis: ${item.aiAnalysis ? 'YES' : 'NO'}`)
    if (item.aiAnalysis) {
      console.log(`   Summary: ${item.aiAnalysis.summary?.slice(0, 100)}...`)
      console.log(`   Score: ${item.aiAnalysis.relevanceScore}`)
    }
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
