import Discord from 'discord.js'
import { PrismaClient, User } from '@prisma/client'
import { inspect } from 'util'

const prisma = new PrismaClient()

const activityTypeMap = {
  0: 'Playing',
  1: 'Streaming',
  2: 'Listening',
  3: 'Watching',
  // 4: 'Custom',
  // 5: 'Competing',
}

type ActivityItem = {
  type: string
  name: string
  details: string
  timestamps: {
    start: Date | null
    end: Date | null
  }
}

type Presence = {
  discordId: string
  username: string
  guildId: string
  guildName: string

  oldStatus: string
  newStatus: string
  oldActivities: ActivityItem[]
  newActivities: ActivityItem[]
}

async function makeUser(user: Discord.User) {
  const userRecord = await prisma.user.findFirst({
    where: {
      discordId: user.id,
    },
  })

  if (!userRecord) {
    const newUserRecord = await prisma.user.create({
      data: {
        discordId: user.id,
        username: user.username,
      },
    })

    return newUserRecord
  }

  return userRecord
}

async function handlePresence(
  oldPresence: Discord.Presence | null,
  newPresence: Discord.Presence,
  guild: Discord.Guild
) {
  const discordUser = newPresence.user

  if (!discordUser) return

  const user = await makeUser(discordUser)

  // if (discordUser.id != '472872051359612945') return // for testing

  const now = new Date()

  const oldStatus = oldPresence?.status ?? 'offline'
  const newStatus = newPresence.status

  const presenceObj: Presence = {
    discordId: discordUser.id,
    username: discordUser.username,
    guildId: guild.id,
    guildName: guild.name,
    oldStatus,
    newStatus,
    oldActivities: [],
    newActivities: [],
  }

  if (oldPresence) {
    presenceObj.oldActivities = oldPresence.activities.map((activity) => {
      return {
        type: activityTypeMap[activity.type],
        name: activity.name,
        details: activity.details,
        timestamps: {
          start: activity.timestamps?.start ?? now,
          end: activity.timestamps?.end ?? now,
        },
      }
    })
  }

  presenceObj.newActivities = newPresence.activities.map((activity) => {
    return {
      type: activityTypeMap[activity.type],
      name: activity.name,
      details: activity.details,
      timestamps: {
        start: activity.timestamps?.start ?? now,
        end: activity.timestamps?.end ?? now,
      },
    }
  })

  console.log(inspect(presenceObj, { depth: null }))
}

export { handlePresence }
