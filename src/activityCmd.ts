import Discord from 'discord.js'
import { PrismaClient, User } from '@prisma/client'
const prisma = new PrismaClient()

async function handleActivityCmd(interaction: Discord.CommandInteraction) {
  const user = await prisma.user.findUnique({
    where: {
      discordId: interaction.user.id,
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

      if (statusTotals[activity.name]) {
        statusTotals[activity.name] += duration
      } else {
        statusTotals[activity.name] = duration
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
      value: `${duration} seconds`,
      inline: true,
    }
  })

  const statusFields: Discord.APIEmbedField[] = Object.entries(
    statusTotals
  ).map(([name, duration]) => {
    return {
      name,
      value: `${duration} seconds`,
      inline: true,
    }
  })

  embed.addFields({
    name: 'Activity',
    value: 'Total activity time',
    inline: false,
  })
  embed.addFields(activityFields)

  embed.addFields({
    name: 'Status',
    value: 'Total status time',
    inline: false,
  })
  embed.addFields(statusFields)

  interaction.reply({ embeds: [embed] })
}

export { handleActivityCmd }
