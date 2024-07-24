import Discord from 'discord.js'
import { PrismaClient, User } from '@prisma/client'
import { getDuration, prettySeconds } from '../prettySeconds'
import { inBlacklist } from '../groups'
import prettyEmbeds from '../prettyEmbeds'

const prisma = new PrismaClient()

async function getUniqueGames() {
  const users = await prisma.user.findMany({
    include: {
      activities: {
        where: {
          activityType: 'activity',
        },
      },
    },
  })

  let gameTotals = new Set<string>()

  for (const user of users) {
    for (const activity of user.activities) {
      if (inBlacklist(activity.name)) continue

      gameTotals.add(activity.name)
    }
  }

  return gameTotals
}

async function handleTopForGame(interaction: Discord.CommandInteraction) {
  const game = interaction.options.get('game', false)?.value as string

  const embedStart = prettyEmbeds.general.titleAndDesc(
    `Top Users for ${game}`,
    'Loading...'
  )

  const reply = await interaction.reply({ embeds: [embedStart] })

  if (!game || inBlacklist(game)) {
    const games = await getUniqueGames()

    let msg = 'No game provided, valid games are:\n'

    for (const game of games) {
      msg += game + '\n'
    }

    const embed = new Discord.EmbedBuilder()
    embed.setTitle('Top Users for Game')
    embed.setDescription(msg)
    embed.setColor('Random')

    await reply.edit({ embeds: [embed] })

    return
  }

  const now = new Date()

  let activities = await prisma.activity.findMany({
    where: {
      activityType: 'activity',
    },
    include: {
      user: true,
    },
  })

  if (
    activities.find(
      (activity) => activity.name.toLowerCase() == game.toLowerCase()
    )
  ) {
    activities = activities.filter((activity) => {
      return activity.name == game
    })
  } else {
    activities = activities.filter((activity) => {
      return activity.name.toLowerCase().startsWith(game.toLowerCase())
    })
  }

  console.log(activities)

  if (!activities.length) {
    const games = await getUniqueGames()

    const embed = new Discord.EmbedBuilder()
    embed.setTitle('Top Users for Game')
    embed.setDescription('No activities found for game')
    embed.setColor('Random')
    embed.addFields({
      name: 'Valid games',
      value: [...games].join('\n'),
      inline: false,
    })

    await reply.edit({ embeds: [embed] })

    return
  }

  const fullGameName = activities[0].name

  let userTotals: Record<string, number> = {}

  for (const activity of activities) {
    const duration = getDuration(activity)

    if (userTotals[activity.user.username]) {
      userTotals[activity.user.username] += duration
    } else {
      userTotals[activity.user.username] = duration
    }
  }

  let userTotalsArray = Object.entries(userTotals)
  userTotalsArray.sort((a, b) => b[1] - a[1])

  let userTotalsMap = new Map<string, number>()

  for (const [username, duration] of userTotalsArray) {
    userTotalsMap.set(username, duration)
  }

  console.log(userTotalsMap)

  const embed = new Discord.EmbedBuilder()
  embed.setTitle(`Top users for ${fullGameName}`)
  embed.setColor('Random')

  let i = 1
  for (const [username, duration] of userTotalsMap) {
    if (i > 10) {
      break
    }

    try {
      embed.addFields({
        name: `${i}. ${username}`,
        value: prettySeconds(duration),
        inline: false,
      })
    } catch (error) {
      console.error('Error adding field:', error, { username, duration })
    }
    i++
  }

  await reply.edit({ embeds: [embed] })
}

export { handleTopForGame }
