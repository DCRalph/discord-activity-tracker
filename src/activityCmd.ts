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
  if (days) {
    result += `${days} days `
  }
  if (hours) {
    result += `${hours} hours `
  }
  if (minutes) {
    result += `${minutes} minutes `
  }
  if (seconds) {
    result += `${seconds} seconds `
  }
}

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
      value: `${prettySeconds(duration)} seconds`,
      inline: true,
    }
  })

  const statusFields: Discord.APIEmbedField[] = Object.entries(
    statusTotals
  ).map(([name, duration]) => {
    return {
      name,
      value: `${prettySeconds(duration)} seconds`,
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
