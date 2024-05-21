import Discord from 'discord.js'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const activityTypeMap = {
  0: 'Playing',
  1: 'Streaming',
  2: 'Listening',
  3: 'Watching',
  4: 'Custom',
  5: 'Competing',
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

async function handleActivity(
  oldPresence: Discord.Presence | null,
  newPresence: Discord.Presence
) {
  const discordUser = newPresence.user

  if (!discordUser) return

  const user = await makeUser(discordUser)

  // if (discordUser.id != '472872051359612945') return // for testing

  const now = new Date()

  // ########## online status ##########

  const oldStatus = oldPresence?.status || 'offline'
  const newStatus = newPresence.status

  if (oldStatus !== newStatus) {
    // find the last status record
    // console.log('oldStatus:', oldStatus)

    console.log(
      `[${discordUser.username}] changed status from ${oldStatus} to ${newStatus}`
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

    if (lastStatusRecord?.endedAt != null) {
      console.log(
        `[${discordUser.username}] Last status record is already ended. Skipping...`
      )
      return
    }

    if (lastStatusRecord) {
      // update the last status record
      console.log(`[${discordUser.username}] Updateing last status record`)
      await prisma.activity.update({
        where: {
          id: lastStatusRecord.id,
        },
        data: {
          details: newStatus,

          endedAt: now,
          duration:
            (now.getTime() - lastStatusRecord.startedAt.getTime()) / 1000,
        },
      })

      // create a new status record
      console.log(`[${discordUser.username}] Creating new status record for`)
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
        `[${discordUser.username}] Creating new status record for. No last status record found. `
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

  // ############### activities ###############

  console.log(`[${discordUser.username}] Checking activities...`)

  for (const activity of newPresence.activities) {
    if (activity.type == 4) continue

    // console.log(activity)

    const existingActivity = await prisma.activity.findFirst({
      where: {
        userId: user.id,
        activityType: 'activity',

        type: activityTypeMap[activity.type],
        name: activity.name,

        startedAt: activity.timestamps?.start,
      },
    })

    if (existingActivity) {
      console.log(
        `[${discordUser.username}] Activity record already exists for ${activity.name}`
      )
      continue
    }
    console.log(
      `[${discordUser.username}] Creating activity record for ${activity.name}...`
    )

    const activityRecord = await prisma.activity.create({
      data: {
        userId: user.id,
        activityType: 'activity',

        type: activityTypeMap[activity.type],
        name: activity.name,
        details: activity.details,

        startedAt: activity.timestamps?.start || now,
      },
    })
  }

  if (oldPresence !== null) {
    for (const activity of oldPresence.activities) {
      if (activity.type == 4) continue
      // console.log(activity)
      const activityRecord = await prisma.activity.findFirst({
        where: {
          userId: user.id,
          activityType: 'activity',

          type: activityTypeMap[activity.type],
          name: activity.name,

          startedAt: activity.timestamps?.start,
        },
      })

      const endedAt = activity.timestamps?.end || now

      if (activityRecord) {
        console.log(
          `[${discordUser.username}] Updating activity record for old activity`
        )
        await prisma.activity.update({
          where: {
            id: activityRecord.id,
            activityType: 'activity',
          },
          data: {
            endedAt: endedAt,
            duration:
              (endedAt.getTime() - activityRecord.startedAt.getTime()) / 1000,
          },
        })
      } else {
        console.log(
          `[${discordUser.username}] Creating activity record for old activity ${activity.name}`
        )
        await prisma.activity.create({
          data: {
            userId: user.id,
            activityType: 'activity',

            type: activityTypeMap[activity.type],
            name: activity.name,
            details: activity.details,

            startedAt: activity.timestamps?.start || now,
            endedAt: endedAt,
            duration:
              (endedAt.getTime() - activity.timestamps?.start.getTime()) / 1000,
          },
        })
      }
    }
  }
}

export { handleActivity }
