import Discord from 'discord.js'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function set(client: Discord.Client) {
  if (!prisma) {
    console.error('Prisma not connected')
    return
  }

  if (!client.isReady()) {
    console.error('Client not logged in')
    return
  }

  const userCount = await prisma.user.count()
  const activityCount = await prisma.activity.count()

  const botPresence = `always watching you... | ${userCount} users | ${activityCount} activities`

  const botActivity: Discord.ActivityOptions = {
    name: botPresence,
    type: Discord.ActivityType.Playing,
  }

  client.user.setActivity(botActivity)
}

async function updateBotActivity(client: Discord.Client) {
  await set(client)
  setInterval(() => {
    set(client)
  }, 60 * 1000)
}

export { updateBotActivity }
