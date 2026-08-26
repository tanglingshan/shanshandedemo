import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Check current setting
  const setting = await prisma.appSetting.findUnique({
    where: { id: 'singleton' }
  })

  console.log('Current AI setting:', setting)

  // Enable AI analysis
  const updated = await prisma.appSetting.upsert({
    where: { id: 'singleton' },
    update: { hotItemAiEnabled: true },
    create: { id: 'singleton', hotItemAiEnabled: true }
  })

  console.log('Updated AI setting:', updated)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
