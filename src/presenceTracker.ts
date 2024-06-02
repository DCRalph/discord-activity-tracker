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
  user: User
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
  toDelete: string[]
  nothing: boolean
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
    toDelete: [],
    nothing: true,
  }

  // check if the status has changed
  console.log(
    `[${presence.user.username}, ${presence.guildName}] pre processing status...`
  )
  if (
    presence.oldStatus !== presence.newStatus &&
    presence.oldStatus !== null
  ) {
    WhatToDo.status = {
      oldStatus: presence.oldStatus,
      newStatus: presence.newStatus,
    }
    WhatToDo.nothing = false
    console.log(
      `[${presence.user.username}, ${presence.guildName}] changed status from ${presence.oldStatus} to ${presence.newStatus}`
    )
  } else {
    console.log(
      `[${presence.user.username}, ${presence.guildName}] status has not changed`
    )
  }

  console.log('.')
  console.log(
    `[${presence.user.username}, ${presence.guildName}] pre processing new activities...`
  )
  for (const activity of presence.newActivities) {
    // check if the activity is allowed
    if (!allowedActivityTypes.includes(activity.type)) {
      console.log(
        `[${presence.user.username}, ${presence.guildName}] [${activity.type}] ${activity.name} is not allowed. Continuing...`
      )
      continue
    }

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
      console.log(
        `[${presence.user.username}, ${presence.guildName}]  [${activity.type}] ${activity.name} is in old activities. Continuing...`
      )

      continue
    }

    // const oldActivity2 = WhatToDo.oldActivities.find((oldActivity) => {
    //   return oldActivity.timestamps.start === activity.timestamps.start
    // })

    // if (oldActivity2) {
    //   console.log(
    //     `[${presence.user.username}, ${presence.guildName}] already started 2 [${activity.type}] ${activity.name}. Continuing...`
    //   )
    //   continue
    // }

    // check if the activity is already in db with the same name but no details and state
    const dbActivity = await prisma.activity.findFirst({
      where: {
        userId: presence.user.id,
        type: activity.type,
        name: activity.name,
        details: null,
        state: null,
        endedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    if (dbActivity) {
      console.log(
        `[${presence.user.username}, ${presence.guildName}] [${activity.type}] ${activity.name} is already in db with no details and state. Queued for deletion...`
      )
      WhatToDo.toDelete.push(dbActivity.id)
    }

    WhatToDo.newActivities.push(activity)
    WhatToDo.nothing = false

    console.log(
      `[${presence.user.username}, ${presence.guildName}] started [${activity.type}] ${activity.name}`
    )
  }

  console.log('.')
  console.log(
    `[${presence.user.username}, ${presence.guildName}] pre processing old activities...`
  )
  for (const activity of presence.oldActivities) {
    // check if the activity is allowed
    if (!allowedActivityTypes.includes(activity.type)) {
      console.log(
        `[${presence.user.username}, ${presence.guildName}] [${activity.type}] ${activity.name} is not allowed. Continuing...`
      )
      continue
    }

    // check if activity has timestamps
    if (activity.timestamps.end == null) {
      // console.log(
      //   `[${presence.user.username}, ${presence.guildName}] has an ongoing activity [${activity.type}] ${activity.name}. Continuing...`
      // )
      // continue

      console.log(
        `[${presence.user.username}, ${presence.guildName}] [${activity.type}] ${activity.name} has no end time. Setting to now...`
      )

      activity.timestamps.end = new Date()
    }

    // check if the activity is new
    const newActivity = presence.newActivities.find((newActivity) => {
      return (
        newActivity.type === activity.type &&
        newActivity.name === activity.name &&
        newActivity.details === activity.details &&
        newActivity.state === activity.state
      )
    })

    if (newActivity) {
      console.log(
        `[${presence.user.username}, ${presence.guildName}] [${activity.type}] ${activity.name} is in new activities. Continuing...`
      )
      continue
    }

    if (activity.timestamps.start == null) {
      // check if the activity is in db
      const dbActivity = await prisma.activity.findFirst({
        where: {
          userId: presence.user.id,
          type: activity.type,
          name: activity.name,
          details: activity.details,
          state: activity.state,
        },
        orderBy: {
          createdAt: 'desc',
        },
      })

      if (!dbActivity) {
        console.log(
          `[${presence.user.username}, ${presence.guildName}] [${activity.type}] ${activity.name} was not found in db. Continuing...`
        )
        continue
      }
    }

    WhatToDo.oldActivities.push(activity)
    WhatToDo.nothing = false

    console.log(
      `[${presence.user.username}, ${presence.guildName}] ended [${activity.type}] ${activity.name}`
    )
  }

  console.log(
    `[${presence.user.username}, ${presence.guildName}] pre processing done`
  )

  return WhatToDo
}

async function processPresence(WhatToDo: WhatToDo) {
  const now = new Date()

  console.log(
    `[${WhatToDo.presence.user.username}, ${WhatToDo.presence.guildName}] processing...`
  )

  if (WhatToDo.nothing) {
    console.log(
      `[${WhatToDo.presence.user.username}, ${WhatToDo.presence.guildName}] nothing to do`
    )
    return
  }

  if (WhatToDo.toDelete.length > 0) {
    console.log(
      `[${WhatToDo.presence.user.username}, ${WhatToDo.presence.guildName}] deleting #${WhatToDo.toDelete.length} activities form db...`
    )

    const deleted = await prisma.activity.deleteMany({
      where: {
        id: {
          in: WhatToDo.toDelete,
        },
      },
    })

    console.log(
      `[${WhatToDo.presence.user.username}, ${WhatToDo.presence.guildName}] deleted #${deleted.count} activities`
    )
  }

  if (WhatToDo.status) {
    console.log('.')
    console.log(
      `[${WhatToDo.presence.user.username}, ${WhatToDo.presence.guildName}] updating status...`
    )

    const lastStatusRecord = await prisma.activity.findFirst({
      where: {
        userId: WhatToDo.presence.user.id,
        activityType: 'status',
        type: WhatToDo.status.oldStatus,
        endedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    if (lastStatusRecord) {
      // update the end time of the last status

      console.log(
        `[${WhatToDo.presence.user.username}, ${WhatToDo.presence.guildName}] updating last status...`
      )

      await prisma.activity.update({
        where: {
          id: lastStatusRecord.id,
        },
        data: {
          details: `${WhatToDo.status.oldStatus} -> ${WhatToDo.status.newStatus}`,
          endedAt: now,
          duration: now.getTime() - lastStatusRecord.startedAt.getTime(),
        },
      })
    }
    // create a new status record

    await prisma.activity.create({
      data: {
        userId: WhatToDo.presence.user.id,
        activityType: 'status',
        type: WhatToDo.status.newStatus,
        name: lastStatusRecord ? null : 'no previous status',
        startedAt: now,
      },
    })

    console.log(
      `[${WhatToDo.presence.user.username}, ${WhatToDo.presence.guildName}] updated status`
    )
  }

  // process old activities
  for (const activity of WhatToDo.oldActivities) {
    console.log('.')
    console.log(
      `[${WhatToDo.presence.user.username}, ${WhatToDo.presence.guildName}] processing old activity, [${activity.type}] ${activity.name}...`
    )

    // if (!activity.timestamps.start) {
    //   console.log(
    //     `[${WhatToDo.presence.user.username}, ${WhatToDo.presence.guildName}] activity has no start time, skipping...`
    //   )
    //   continue
    // }

    const dbActivity = await prisma.activity.findFirst({
      where: {
        userId: WhatToDo.presence.user.id,
        activityType: 'activity',
        type: activity.type,
        name: activity.name,
        details: activity.details,
        state: activity.state,
        endedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // if (!dbActivity) {
    //   if (
    //     activity.timestamps.start != null &&
    //     activity.timestamps.end != null
    //   ) {
    //     console.log(
    //       `[${WhatToDo.presence.user.username}, ${WhatToDo.presence.guildName}] activity not found in db but have start and end time.`
    //     )
    //     console.log(
    //       `[${WhatToDo.presence.user.username}, ${WhatToDo.presence.guildName}] creating new activity, [${activity.type}] ${activity.name}`
    //     )

    //     await prisma.activity.create({
    //       data: {
    //         userId: WhatToDo.presence.user.id,
    //         activityType: 'activity',
    //         type: activity.type,
    //         name: activity.name,
    //         details: activity.details,
    //         state: activity.state,
    //         startedAt: activity.timestamps.start,
    //         endedAt: now,
    //         duration:
    //           now.getTime() -
    //           activity.timestamps.start.getTime(),
    //       },
    //     })
    //   } else {
    //     console.log(
    //       `[${WhatToDo.presence.user.username}, ${WhatToDo.presence.guildName}] activity not found in db, skipping...`
    //     )
    //   }
    //   continue
    // }

    if (!dbActivity) {
      console.log(
        `[${WhatToDo.presence.user.username}, ${WhatToDo.presence.guildName}] activity not found in db, skipping...`
      )
      continue
    }

    if (dbActivity.startedAt !== activity.timestamps.start) {
      console.log(
        `[${WhatToDo.presence.user.username}, ${WhatToDo.presence.guildName}] activity start time mismatch. potential wrong`
      )
      // continue
    }

    await prisma.activity.update({
      where: {
        id: dbActivity.id,
      },
      data: {
        endedAt: now,
        duration: now.getTime() - dbActivity.startedAt.getTime(),
      },
    })

    console.log(
      `[${WhatToDo.presence.user.username}, ${WhatToDo.presence.guildName}] updated old activity, [${activity.type}] ${activity.name}`
    )
  }

  // process new activities
  for (const activity of WhatToDo.newActivities) {
    console.log('.')
    console.log(
      `[${WhatToDo.presence.user.username}, ${WhatToDo.presence.guildName}] processing new activity, [${activity.type}] ${activity.name}...`
    )

    // if (!activity.timestamps.start) {
    //   console.log(
    //     `[${WhatToDo.presence.user.username}, ${WhatToDo.presence.guildName}] activity has no start time, skipping...`
    //   )
    //   continue
    // }

    if (!activity.timestamps.start) {
      console.log(
        `[${WhatToDo.presence.user.username}, ${WhatToDo.presence.guildName}] activity has no start time, setting to now...`
      )
      activity.timestamps.start = now
    }

    // check if the activity is in db

    const dbActivity = await prisma.activity.findFirst({
      where: {
        userId: WhatToDo.presence.user.id,
        activityType: 'activity',
        type: activity.type,
        name: activity.name,
        details: activity.details,
        state: activity.state,
        startedAt: activity.timestamps.start,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    if (dbActivity) {
      console.log(
        `[${WhatToDo.presence.user.username}, ${WhatToDo.presence.guildName}] activity already in db, skipping...`
      )
      continue
    }

    await prisma.activity.create({
      data: {
        userId: WhatToDo.presence.user.id,
        activityType: 'activity',
        type: activity.type,
        name: activity.name,
        details: activity.details,
        state: activity.state,
        startedAt: activity.timestamps.start,
      },
    })

    console.log(
      `[${WhatToDo.presence.user.username}, ${WhatToDo.presence.guildName}] created new activity, [${activity.type}] ${activity.name}`
    )
  }

  console.log(
    `[${WhatToDo.presence.user.username}, ${WhatToDo.presence.guildName}] processing done`
  )
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
    user: user,
    guildId: guild.id,
    guildName: guild.name,
    oldStatus: null,
    newStatus,
    oldActivities: [],
    newActivities: [],
  }

  if (oldPresence) {
    presenceObj.oldStatus = oldStatus

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

  let WhatToDo: WhatToDo

  try {
    WhatToDo = await preProcessPresence(presenceObj)
    await processPresence(WhatToDo)
  } catch (error) {
    console.log('.')
    console.log('.')

    console.log(
      `[${presenceObj.user.username}, ${presenceObj.guildName}] Error on handle status: ${error}`
    )

    prisma.error.create({
      data: {
        where: 'handlePresence',
        message: error.message,
        stack: error.stack,
        extra: `User: ${presenceObj.user.username}, Guild: ${presenceObj.guildName}`,
      },
    })

    console.log('.')
    console.log('.')
  }

  // console.log('presenceObj', inspect(presenceObj, { depth: null }))
  console.log('WhatToDo', inspect(WhatToDo, { depth: null }))
}

export { handlePresence }
