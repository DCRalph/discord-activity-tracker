import Discord from 'discord.js'
import { PrismaClient, User } from '@prisma/client'

function prettySeconds(seconds: number) {
  // convert secconds to days, hours, minutes, seconds
  // only include the largest unit that is not zero
  const days = Math.floor(seconds / 86400)
  seconds %= 86400
  const hours = Math.floor(seconds / 3600)
  seconds %= 3600
  const minutes = Math.floor(seconds / 60)
  seconds %= 60

  let result = ''
  if (days) result += `${days} d `
  if (hours) result += `${hours} h `
  if (minutes) result += `${minutes} m `
  if (seconds) result += `${seconds} s `

  return result.trim()
}

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
      activities: true,
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
      activities: true,
    },
  })

  const now = new Date()
  let userTotals: Record<string, number> = {}

  for (const user of users) {
    const activities = user.activities

    let total = 0
    for (const activity of activities) {
      if (activity.activityType == 'activity') {
        total += activity.duration || 0
      }
    }

    userTotals[user.discordId] = total
  }

  const sortedUsers = Object.entries(userTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([discordId, duration]) => {
      return {
        discordId,
        duration,
      }
    })

  const embed = new Discord.EmbedBuilder()
    .setTitle('Activity Leaderboard')
    .setColor('Random')
    .setTimestamp(now)

  const fields: Discord.APIEmbedField[] = sortedUsers.map(
    ({ discordId, duration }, index) => {
      const discordUser = interaction.guild?.members.cache.get(discordId)?.user

      return {
        name: `${index + 1}. ${discordUser?.username || discordId}`,
        value: prettySeconds(duration),
        inline: false,
      }
    }
  )

  embed.addFields(fields)

  interaction.reply({ embeds: [embed] })
}

export { handleActivityCmd, handleActivityLeaderboardCmd }
