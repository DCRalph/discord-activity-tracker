import Discord from 'discord.js'
import { PrismaClient } from '@prisma/client'

import { prettySeconds } from '../prettySeconds'

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
        activity.duration !== null
          ? ~~(activity.duration / 1000)
          : ~~((now.getTime() - activity.createdAt.getTime()) / 1000)

      if (activityTotals[activity.name]) {
        activityTotals[activity.name] += duration
      } else {
        activityTotals[activity.name] = duration
      }
    } else if (
      activity.activityType == 'status' &&
      activity.type != 'offline'
    ) {
      const duration =
        activity.duration !== null
          ? ~~(activity.duration / 1000)
          : ~~((now.getTime() - activity.createdAt.getTime()) / 1000)

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

export { handleActivityCmd }
