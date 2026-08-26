import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const result = await prisma.user.deleteMany({
    where: {
      email: {
        in: ['13005573962', '15766146298']
      }
    }
  })
  console.log(`Deleted ${result.count} test users`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
