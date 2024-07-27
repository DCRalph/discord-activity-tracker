import Discord from 'discord.js'
import { PrismaClient } from '@prisma/client'

import { getDuration, prettySeconds } from '../prettySeconds'
import prettyEmbeds from '../prettyEmbeds'

const prisma = new PrismaClient()

async function handleActivityCmd(interaction: Discord.CommandInteraction) {
  const discordUser = interaction.options.get('user', true)?.user

  const embedStart = prettyEmbeds.general.titleAndDesc(
    'Activity Summary ' + discordUser.username,
    'Loading...'
  )

  const reply = await interaction.reply({ embeds: [embedStart] })

  if (!discordUser) {
    const embed = prettyEmbeds.general.titleAndDesc(
      'Activity Summary',
      'No user found'
    )
    reply.edit({ embeds: [embed] })
    return
  }

  if (discordUser.bot) {
    const embed = prettyEmbeds.general.titleAndDesc(
      'Activity Summary',
      'No activities found'
    )
    reply.edit({ embeds: [embed] })
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
    const embed = prettyEmbeds.general.titleAndDesc(
      'Activity Summary ' + discordUser.username,
      'No activities found'
    )
    reply.edit({ embeds: [embed] })
    return
  }

  const now = new Date()
  const activities = user.activities

  let activityTotals: Record<string, number> = {}
  let statusTotals: Record<string, number> = {}

  for (const activity of activities) {
    if (activity.activityType == 'activity') {
      const duration = getDuration(activity)

      if (activityTotals[activity.name]) {
        activityTotals[activity.name] += duration
      } else {
        activityTotals[activity.name] = duration
      }
    } else if (
      activity.activityType == 'status' &&
      activity.type != 'offline'
    ) {
      const duration = getDuration(activity)

      if (statusTotals[activity.type]) {
        statusTotals[activity.type] += duration
      } else {
        statusTotals[activity.type] = duration
      }
    }
  }

  const embed = new Discord.EmbedBuilder()
    .setTitle('Activity Summary ' + discordUser.username)
    .setColor('Random')
    .setTimestamp(now)

  const activityFields: Discord.APIEmbedField[] = Object.entries(activityTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([name, duration]) => {
      return {
        name,
        value: prettySeconds(duration),
        inline: true,
      }
    })

  const activityFieldsChunks = activityFields.reduce((resultArray, item, index) => {
    const chunkIndex = Math.floor(index / 24)
    if (!resultArray[chunkIndex]) {
      resultArray[chunkIndex] = [] // start a new chunk
    }
    resultArray[chunkIndex].push(item)
    return resultArray
  }, [])

  const statusFields: Discord.APIEmbedField[] = Object.entries(
    statusTotals
  ).map(([name, duration]) => {
    return {
      name,
      value: prettySeconds(duration),
      inline: true,
    }
  })

  const statusFieldsChunks = statusFields.reduce((resultArray, item, index) => {
    const chunkIndex = Math.floor(index / 24)
    if (!resultArray[chunkIndex]) {
      resultArray[chunkIndex] = [] // start a new chunk
    }
    resultArray[chunkIndex].push(item)
    return resultArray
  }, [])

  console.log(activityFieldsChunks)
  console.log(statusFieldsChunks)

  embed.addFields({
    name: 'Activity',
    value: 'Total activity time',
    inline: false,
  })
  for (const activityFieldsChunk of activityFieldsChunks) {
    embed.addFields(activityFieldsChunk)
  }

  embed.addFields([
    { name: '\u200B', value: '\u200B' }, // Add a blank field
    {
      name: 'Status',
      value: 'Total status time',
      inline: false,
    },
  ])
  for (const statusFieldsChunk of statusFieldsChunks) {
    embed.addFields(statusFieldsChunk)
  }

  reply.edit({ embeds: [embed] })
}

export { handleActivityCmd }
