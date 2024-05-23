import Discord from 'discord.js'
import { PrismaClient, User } from '@prisma/client'
import { inspect } from 'util'

const prisma = new PrismaClient()

type ActivityType =
  | 'Playing'
  | 'Streaming'
  | 'Listening'
  | 'Watching'
  | 'Custom'
  | 'Competing'
type PresenceStatus = Discord.PresenceStatus

type ActivityItem = {
  type: ActivityType
  name: string
  details: string | null
  state: string | null
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

  oldStatus: PresenceStatus
  newStatus: PresenceStatus
  oldActivities: ActivityItem[]
  newActivities: ActivityItem[]
}

type WhatToDo = {
  presence: Presence
  status: {
    oldStatus: PresenceStatus
    newStatus: PresenceStatus
  } | null
  oldActivities: ActivityItem[]
  newActivities: ActivityItem[]
}

const activityTypeMap: { [key: number]: ActivityType } = {
  0: 'Playing',
  1: 'Streaming',
  2: 'Listening',
  3: 'Watching',
  4: 'Custom',
  5: 'Competing',
}

const allowedActivityTypes: ActivityType[] = [
  'Playing',
  'Streaming',
  'Listening',
]

async function makeUser(id: string, username: string) {
  const userRecord = await prisma.user.findFirst({
    where: {
      discordId: id,
    },
  })

  if (!userRecord) {
    const newUserRecord = await prisma.user.create({
      data: {
        discordId: id,
        username: username,
      },
    })

    return newUserRecord
  }

  return userRecord
}

async function preProcessPresence(presence: Presence) {
  let WhatToDo: WhatToDo = {
    presence: presence,
    status: null,
    oldActivities: [],
    newActivities: [],
  }

  // check if the status has changed
  if (presence.oldStatus !== presence.newStatus) {
    WhatToDo.status = {
      oldStatus: presence.oldStatus,
      newStatus: presence.newStatus,
    }
  }

  for (const activity of presence.newActivities) {
    // check if the activity is allowed
    if (!allowedActivityTypes.includes(activity.type)) continue

    // check if the activity is old
    const oldActivity1 = presence.oldActivities.find((oldActivity) => {
      return (
        oldActivity.type === activity.type &&
        oldActivity.name === activity.name &&
        oldActivity.details === activity.details &&
        oldActivity.state === activity.state
      )
    })

    if (oldActivity1) {
      continue
    }

    const oldActivity2 = WhatToDo.oldActivities.find((oldActivity) => {
      return oldActivity.timestamps.start === activity.timestamps.start
    })

    if (oldActivity2) {
      continue
    }

    WhatToDo.newActivities.push(activity)
  }

  for (const activity of presence.oldActivities) {
    // check if the activity is allowed
    if (!allowedActivityTypes.includes(activity.type)) continue

    // check if activity has timestamps
    if (activity.timestamps.end == null) {
      continue
    }

    if (activity.timestamps.start == null) {
      // check if the activity is in db
      const dbActivity = await prisma.activity.findFirst({
        where: {
          userId: presence.discordId,
          type: activity.type,
          name: activity.name,
          details: activity.details,
          state: activity.state,
          endedAt: activity.timestamps.end,
        },
      })

      if (!dbActivity) {
        continue
      }
    }

    WhatToDo.oldActivities.push(activity)
  }

  return WhatToDo
}

async function handlePresence(
  oldPresence: Discord.Presence | null,
  newPresence: Discord.Presence,
  guild: Discord.Guild
) {
  const discordUser = newPresence.user

  if (!discordUser) return

  const user = await makeUser(discordUser.id, discordUser.username)

  // if (discordUser.id != '472872051359612945') return // for testing

  const now = new Date()

  const oldStatus = oldPresence?.status ?? 'offline'
  const newStatus = newPresence.status

  const presenceObj: Presence = {
    discordId: discordUser.id,
    username: discordUser.username,
    guildId: guild.id,
    guildName: guild.name,
    oldStatus: null,
    newStatus,
    oldActivities: [],
    newActivities: [],
  }

  if (oldPresence) {
    presenceObj.oldStatus = oldPresence.status

    presenceObj.oldActivities = oldPresence.activities.map((activity) => {
      let obj = {
        type: activityTypeMap[activity.type],
        name: activity.name,
        details: activity.details,
        state: activity.state,
        timestamps: {
          start: null,
          end: null,
        },
      }

      if (activity.timestamps) {
        obj.timestamps.start = activity.timestamps.start ?? null
        obj.timestamps.end = activity.timestamps.end ?? null
      }

      return obj
    })
  }

  presenceObj.newActivities = newPresence.activities.map((activity) => {
    let obj = {
      type: activityTypeMap[activity.type],
      name: activity.name,
      details: activity.details,
      state: activity.state,
      timestamps: {
        start: null,
        end: null,
      },
    }

    if (activity.timestamps) {
      obj.timestamps.start = activity.timestamps.start ?? null
      obj.timestamps.end = activity.timestamps.end ?? null
    }

    return obj
  })

  console.log('presenceObj', inspect(presenceObj, { depth: null }))

  const WhatToDo = await preProcessPresence(presenceObj)

  console.log('WhatToDo', inspect(WhatToDo, { depth: null }))
}

export { handlePresence }
