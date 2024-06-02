import Discord from 'discord.js'
import { PrismaClient, User } from '@prisma/client'
import { getDuration, prettySeconds } from '../prettySeconds'
import { inBlacklist } from '../groups'

const prisma = new PrismaClient()

async function handleTopGames(interaction: Discord.CommandInteraction) {
  // get all users and group by game

  const now = new Date()

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
  let userTotals: Record<string, number> = {}
  let userTotalsMap = new Map<string, string>()

  for (const user of users) {
    inner: for (const activity of user.activities) {
      const duration = getDuration(activity)

      if (userTotals[activity.name]) {
        userTotals[activity.name] += duration
      } else {
        userTotals[activity.name] = duration
      }

      if (inBlacklist(activity.name)) continue inner

      if (gameTotals[activity.name]) {
        gameTotals[activity.name] += duration
      } else {
        gameTotals[activity.name] = duration
      }
    }
  }

  let gameTotalsArray = Object.entries(gameTotals)
  gameTotalsArray.sort((a, b) => b[1] - a[1])

  let userTotalsArray = Object.entries(userTotals)

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
