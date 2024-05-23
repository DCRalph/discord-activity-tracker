import Discord from 'discord.js'
import { PrismaClient, User } from '@prisma/client'
import { prettySeconds } from './prettySeconds'
import { blacklistedGames } from './blacklist'

const prisma = new PrismaClient()

async function handleTopGames(interaction: Discord.CommandInteraction) {
  // get all users and group by game

  const users = await prisma.user.findMany({
    include: {
      activities: {
        where: {
          activityType: 'activity',
        },
      },
    },
  })

  let gameTotals: Record<string, number> = {}

  for (const user of users) {
    for (const activity of user.activities) {
      if (blacklistedGames.includes(activity.name)) continue

      if (gameTotals[activity.name]) {
        gameTotals[activity.name] += activity.duration
      } else {
        gameTotals[activity.name] = activity.duration
      }
    }
  }

  let gameTotalsArray = Object.entries(gameTotals)
  gameTotalsArray.sort((a, b) => b[1] - a[1])

  // get user with most time in each game

  let userTotals: Record<string, number> = {}

  for (const user of users) {
    for (const activity of user.activities) {
      if (userTotals[activity.name]) {
        userTotals[activity.name] += activity.duration
      } else {
        userTotals[activity.name] = activity.duration
      }
    }
  }

  let userTotalsArray = Object.entries(userTotals)

  let userTotalsMap = new Map<string, string>()

  for (const [game, duration] of userTotalsArray) {
    let user = users.find((user) => {
      let activity = user.activities.find((activity) => activity.name == game)
      return activity
    })

    if (user) {
      userTotalsMap.set(game, user.username)
    }
  }

  // create embed

  const embed = new Discord.EmbedBuilder()
    .setTitle('Top 10 Games')
    .setColor('Random')

  let i = 1
  for (const [game, duration] of gameTotalsArray) {
    if (i > 10) {
      break
    }

    let user = userTotalsMap.get(game)

    embed.addFields({
      name: `${i}. ${game}`,
      value: `${prettySeconds(duration)}\n${user}`,
      inline: false,
    })

    i++
  }

  interaction.reply({ embeds: [embed] })
}

export { handleTopGames }
