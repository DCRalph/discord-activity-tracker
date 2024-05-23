import Discord from 'discord.js'
import { PrismaClient, User } from '@prisma/client'

import { prettySeconds } from './prettySeconds'
import { inBlacklist } from './blacklist'

const prisma = new PrismaClient()

async function handleActivityCmd(interaction: Discord.CommandInteraction) {
  const discordUser = interaction.options.get('user', true)?.user

  if (!discordUser) {
    interaction.reply('User required')
    return
  }

  if (discordUser.bot) {
    interaction.reply('Bot users are not supported')
    return
  }

  const user = await prisma.user.findUnique({
    where: {
      discordId: discordUser.id,
    },
    include: {
      activities: {
        where: {
          type: {
            not: 'offline',
          },
        },
      },
    },
  })

  if (!user) {
    interaction.reply('User not found')
    return
  }

  const now = new Date()
  const activities = user.activities

  let activityTotals: Record<string, number> = {}
  let statusTotals: Record<string, number> = {}

  for (const activity of activities) {
    if (activity.activityType == 'activity') {
      const duration =
        activity.duration ||
        ~~((now.getTime() - activity.createdAt.getTime()) / 1000)

      if (activityTotals[activity.name]) {
        activityTotals[activity.name] += duration
      } else {
        activityTotals[activity.name] = duration
      }
    } else if (activity.activityType == 'status') {
      const duration =
        activity.duration ||
        ~~((now.getTime() - activity.createdAt.getTime()) / 1000)

      if (statusTotals[activity.type]) {
        statusTotals[activity.type] += duration
      } else {
        statusTotals[activity.type] = duration
      }
    }
  }

  const embed = new Discord.EmbedBuilder()
    .setTitle('Activity Summary')
    .setColor('Random')
    .setTimestamp(now)

  const activityFields: Discord.APIEmbedField[] = Object.entries(
    activityTotals
  ).map(([name, duration]) => {
    return {
      name,
      value: prettySeconds(duration),
      inline: true,
    }
  })

  const statusFields: Discord.APIEmbedField[] = Object.entries(
    statusTotals
  ).map(([name, duration]) => {
    return {
      name,
      value: prettySeconds(duration),
      inline: true,
    }
  })

  embed.addFields({
    name: 'Activity',
    value: 'Total activity time',
    inline: false,
  })
  embed.addFields(activityFields)

  embed.addFields([
    { name: '\u200B', value: '\u200B' }, // Add a blank field
    {
      name: 'Status',
      value: 'Total status time',
      inline: false,
    },
  ])
  embed.addFields(statusFields)

  interaction.reply({ embeds: [embed] })
}

async function handleActivityLeaderboardCmd(
  interaction: Discord.CommandInteraction
) {
  const users = await prisma.user.findMany({
    include: {
      activities: { where: { activityType: 'activity' } },
    },
  })

  const now = new Date()
  let userTotals: Record<string, number> = {}

  for (const user of users) {
    const activities = user.activities

    let total = 0
    inner: for (const activity of activities) {
      // if (inBlacklist(activity.name)) continue inner

      total += activity.duration || 0
    }

    userTotals[user.username] = total
  }

  const sortedUsers = Object.entries(userTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([username, duration]) => {
      return {
        username,
        duration,
      }
    })

  const embed = new Discord.EmbedBuilder()
    .setTitle('Activity Leaderboard')
    .setDescription('Rank users by total time spent playing games')
    .setColor('Random')
    .setTimestamp(now)

  let indexCol = ''
  let usernameCol = ''
  let durationCol = ''

  for (let i = 0; i < sortedUsers.length; i++) {
    indexCol += `${i + 1}\n`
    usernameCol += `${sortedUsers[i].username}\n`
    durationCol += `${prettySeconds(sortedUsers[i].duration)}\n`
  }

  embed.addFields([
    {
      name: 'Rank',
      value: indexCol,
      inline: true,
    },
    {
      name: 'Username',
      value: usernameCol,
      inline: true,
    },
    {
      name: 'Duration',
      value: durationCol,
      inline: true,
    },
  ])

  interaction.reply({ embeds: [embed] })
}

export { handleActivityCmd, handleActivityLeaderboardCmd }
