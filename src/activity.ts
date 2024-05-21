import Discord from 'discord.js'
import { PrismaClient, User } from '@prisma/client'

const prisma = new PrismaClient()

const activityTypeMap = {
  0: 'Playing',
  1: 'Streaming',
  2: 'Listening',
  3: 'Watching',
  // 4: 'Custom',
  // 5: 'Competing',
}

let usersProsessing = new Set<String>()

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

async function handleActivityV2Status(
  oldStatus: string,
  newStatus: string,
  user: User,
  guild: Discord.Guild
) {
  const now = new Date()

  if (oldStatus !== newStatus) {
    // find the last status record
    // console.log('oldStatus:', oldStatus)

    console.log(
      `[${user.username}, ${guild.name}] changed status from ${oldStatus} to ${newStatus}`
    )

    const lastStatusRecord = await prisma.activity.findFirst({
      where: {
        userId: user.id,
        activityType: 'status',
        type: oldStatus,
      },
      orderBy: {
        startedAt: 'desc',
      },
    })

    if (lastStatusRecord) {
      // update the last status record

      if (lastStatusRecord?.endedAt != null) {
        console.log(
          `[${user.username}, ${guild.name}] Last status record is already ended. Skipping...`
        )
        return
      }

      console.log(
        `[${user.username}, ${guild.name}] Updateing last status record`
      )

      await prisma.activity.update({
        where: {
          id: lastStatusRecord.id,
        },
        data: {
          details: `changed from ${oldStatus} to ${newStatus}`,

          endedAt: now,
          duration:
            (now.getTime() - lastStatusRecord.startedAt.getTime()) / 1000,
        },
      })

      // create a new status record
      console.log(
        `[${user.username}, ${guild.name}] Creating new status record for`
      )
      await prisma.activity.create({
        data: {
          userId: user.id,
          activityType: 'status',

          type: newStatus,

          startedAt: now,
        },
      })
    } else {
      // create a new status record if there is no last status record
      console.log(
        `[${user.username}, ${guild.name}] Creating new status record for. No last status record found. `
      )
      await prisma.activity.create({
        data: {
          userId: user.id,
          activityType: 'status',

          type: newStatus,
          name: 'unknown previous status',

          startedAt: now,
        },
      })
    }
  }
}

async function handleActivityV2OldActivity(
  oldPresence: Discord.Presence,
  user: User,
  guild: Discord.Guild
) {
  const now = new Date()

  for (const activity of oldPresence.activities) {
    if (activity.type! in activityTypeMap == false) continue

    const typeText = activityTypeMap[activity.type] || 'unknown'

    if (
      activity.timestamps == null ||
      activity.timestamps.start == null
      // || activity.timestamps.end == null
    ) {
      console.log(
        `[${user.username}, ${
          guild.name
        }] Old activity record has no timestamps. timestamps: ${
          activity.timestamps != null
        }, start: ${activity.timestamps?.start != null}, end: ${
          activity.timestamps?.end != null
        }. Skipping...`
      )
      continue
    }

    const endedAt = activity.timestamps.end || now

    // find the last activity record
    const activityRecord = await prisma.activity.findFirst({
      where: {
        userId: user.id,
        activityType: 'activity',

        type: typeText,
        name: activity.name,

        startedAt: activity.timestamps?.start,
      },
      orderBy: {
        startedAt: 'desc',
      },
    })

    if (activityRecord) {
      console.log(
        `[${user.username}, ${guild.name}] Updating activity record for old activity`
      )

      await prisma.activity.update({
        where: {
          id: activityRecord.id,
        },
        data: {
          endedAt: endedAt,
          duration:
            (endedAt.getTime() - activity.timestamps.start.getTime()) / 1000,
        },
      })
    } else {
      // create a new activity record if there is no last activity record
      console.log(
        `[${user.username}, ${guild.name}] Creating activity record for old activity ${activity.name}`
      )

      await prisma.activity.create({
        data: {
          userId: user.id,
          activityType: 'activity',

          type: typeText,
          name: activity.name,
          details: activity.details,

          startedAt: activity.timestamps.start,
          endedAt: endedAt,
          duration:
            (endedAt.getTime() - activity.timestamps.start.getTime()) / 1000,
        },
      })
    }
  }
}

async function handleActivityV2NewActivity(
  newPresence: Discord.Presence,
  user: User,
  guild: Discord.Guild
) {
  const now = new Date()

  for (const activity of newPresence.activities) {
    if (activity.type! in activityTypeMap == false) continue

    const typeText = activityTypeMap[activity.type] || 'unknown'

    if (activity.timestamps == null || activity.timestamps.start == null) {
      console.log(
        `[${user.username}, ${
          guild.name
        }] New activity record has no timestamps. timestamps: ${
          activity.timestamps != null
        }, start: ${activity.timestamps?.start != null}, end: ${
          activity.timestamps?.end != null
        }. Skipping...`
      )
      continue
    }

    const existingActivity = await prisma.activity.findFirst({
      where: {
        userId: user.id,
        activityType: 'activity',

        type: typeText,
        name: activity.name,

        startedAt: activity.timestamps.start,
        endedAt: null,
        duration: null,
      },
    })

    if (existingActivity) {
      console.log(
        `[${user.username}, ${guild.name}] Activity record already exists for ${activity.name}`
      )
      continue
    }

    console.log(
      `[${user.username}, ${guild.name}] Creating activity record for ${activity.name}...`
    )

    const activityRecord = await prisma.activity.create({
      data: {
        userId: user.id,
        activityType: 'activity',

        type: typeText,
        name: activity.name,
        details: activity.details,

        startedAt: activity.timestamps.start,
      },
    })
  }
}

async function handleActivityV2(
  oldPresence: Discord.Presence | null,
  newPresence: Discord.Presence,
  guild: Discord.Guild
) {
  const discordUser = newPresence.user

  if (!discordUser) return

  const user = await makeUser(discordUser)

  // if (discordUser.id != '472872051359612945') return // for testing

  const now = new Date()

  console.log('.')
  console.log('.')

  // ########## online status ##########

  const oldStatus = oldPresence?.status || 'offline'
  const newStatus = newPresence.status

  try {
    await handleActivityV2Status(oldStatus, newStatus, user, guild)
  } catch (error) {
    console.log('.')
    console.log('.')

    console.log(
      `[${discordUser.username}, ${guild.name}] Error on handle status: ${error}`
    )

    console.log(
      `[${discordUser.username}, ${guild.name}] oldStatus: ${oldStatus}`
    )
    console.log(
      `[${discordUser.username}, ${guild.name}] newStatus: ${newStatus}`
    )

    console.log(`[${discordUser.username}, ${guild.name}] user: ${user}`)

    console.log('.')
    console.log('.')

    return
  }

  // ############### activities ###############

  console.log(`[${discordUser.username}, ${guild.name}] Checking activities...`)

  if (oldPresence !== null) {
    try {
      await handleActivityV2OldActivity(oldPresence, user, guild)
    } catch (error) {
      console.log('.')
      console.log('.')

      console.log(
        `[${discordUser.username}, ${guild.name}] Error on handle old activity: ${error}`
      )

      console.log(
        `[${discordUser.username}, ${guild.name}] oldPresence: ${oldPresence}`
      )
      console.log(
        `[${discordUser.username}, ${guild.name}] oldPresence activities:`
      )
      console.log(oldPresence.activities)

      console.log(`[${discordUser.username}, ${guild.name}] user: ${user}`)

      console.log('.')
      console.log('.')

      return
    }
  }
  try {
    await handleActivityV2NewActivity(newPresence, user, guild)
  } catch (error) {
    console.log('.')

    console.log(
      `[${discordUser.username}, ${guild.name}] Error on handle new activity: ${error}`
    )

    console.log(
      `[${discordUser.username}, ${guild.name}] newPresence: ${newPresence}`
    )
    console.log(
      `[${discordUser.username}, ${guild.name}] newPresence activities:`
    )
    console.log(newPresence.activities)

    console.log(`[${discordUser.username}, ${guild.name}] user: ${user}`)

    console.log('.')

    return
  }
}

export { handleActivityV2 }
