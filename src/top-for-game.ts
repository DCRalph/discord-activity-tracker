import Discord from 'discord.js'
import { PrismaClient, User } from '@prisma/client'
import { prettySeconds } from './prettySeconds'

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
      gameTotals.add(activity.name)
    }
  }

  return gameTotals
}

async function handleTopForGame(interaction: Discord.CommandInteraction) {
  const game = interaction.options.get('game', true)?.value as string

  if (!game) {
    const games = await getUniqueGames()

    let msg = 'Game required'
    if (games.size) {
      msg += ', valid games are: ' + [...games].join(', ')
    }

    interaction.reply(msg)

    return
  }

  const users = await prisma.user.findMany({
    include: {
      activities: {
        where: {
          activityType: 'activity',
          name: game,
        },
      },
    },
  })

  if (!users.length) {
    interaction.reply('No users found for game')

    return
  }

  let userTotals: Record<string, number> = {}

  for (const user of users) {
    for (const activity of user.activities) {
      if (userTotals[user.username]) {
        userTotals[user.username] += activity.duration
      } else {
        userTotals[user.username] = activity.duration
      }
    }
  }

  let userTotalsArray = Object.entries(userTotals)
  userTotalsArray.sort((a, b) => b[1] - a[1])

  let userTotalsMap = new Map<string, number>()

  for (const [username, duration] of userTotalsArray) {
    userTotalsMap.set(username, duration)
  }

  const embed = new Discord.EmbedBuilder()
  embed.setTitle(`Top users for ${game}`)
  embed.setColor('Random')

  let i = 1
  for (const [username, duration] of userTotalsMap) {
    if (i > 10) {
      break
    }

    embed.addFields({
      name: `${i}. ${username}`,
      value: prettySeconds(duration),
      inline: false,
    })
    i++
  }

  interaction.reply({ embeds: [embed] })
}

export { handleTopForGame }
