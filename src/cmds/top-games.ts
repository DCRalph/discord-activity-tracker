import Discord from 'discord.js'
import { PrismaClient, User } from '@prisma/client'
import { getDuration, prettySeconds } from '../prettySeconds'
import { inBlacklist } from '../groups'
import prettyEmbeds from '../prettyEmbeds'

// let UserTotals = {
//   bob: {
//     game: 300,
//     game2: 100,
//   },
//   alice: {
//     game: 200,
//   },
// }

type UserTotals = Record<string, Record<string, number>>

const prisma = new PrismaClient()

async function handleTopGames(interaction: Discord.CommandInteraction) {
  // get all users and group by game

  const embedStart = prettyEmbeds.general.titleAndDesc(
    'Top Games',
    'Loading...'
  )

  const reply = await interaction.reply({ embeds: [embedStart] })

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

  let gameTotals = new Map<string, number>()
  let userTotals = new Map<string, Map<string, number>>()
  let userTotalsMap = new Map<string, string>()

  for (const user of users) {
    inner: for (const activity of user.activities) {
      const duration = getDuration(activity)

      if (!userTotals.has(user.username)) {
        userTotals.set(user.username, new Map<string, number>())
      }

      if (!userTotals.get(user.username).has(activity.name)) {
        userTotals.get(user.username).set(activity.name, 0)
      }

      userTotals
        .get(user.username)
        .set(
          activity.name,
          userTotals.get(user.username).get(activity.name) + duration
        )

      if (inBlacklist(activity.name)) continue inner

      if (!gameTotals.has(activity.name)) {
        gameTotals.set(activity.name, 0)
      }

      gameTotals.set(activity.name, gameTotals.get(activity.name) + duration)
    }
  }

  let finalList: { game: string; duration: number, highestUser: string, userTime: number }[] = []

  for (const [game, duration] of gameTotals) {
    let highestUser = ''
    let userTime = 0

    for (const [user, games] of userTotals) {
      for (const [gameName, time] of games) {
        if (gameName == game && time > userTime) {
          highestUser = user
          userTime = time
        }
      }
    }

    finalList.push({ game, duration, highestUser, userTime })
  }

  finalList.sort((a, b) => b.duration - a.duration)

  // let gameTotalsArray = Object.entries(gameTotals)
  // gameTotalsArray.sort((a, b) => b[1] - a[1])

  // let userTotalsArray = Object.entries(userTotals)

  // for (const [game, duration] of userTotalsArray) {
  //   let user = users.find((user) => {
  //     let activity = user.activities.find((activity) => activity.name == game)
  //     return activity
  //   })

  //   if (user) {
  //     userTotalsMap.set(game, user.username)
  //   }
  // }

  // create embed

  const embed = new Discord.EmbedBuilder()
    .setTitle('Top 10 Games')
    .setColor('Random')

  let i = 1
  for (const item of finalList) {
    if (i > 10) {
      break
    }


    embed.addFields({
      name: `${i}. ${item.game}`,
      value: `${prettySeconds(item.duration)}\n${item.highestUser}(${prettySeconds(item.userTime)})`,
      inline: false,
    })

    i++
  }

  await reply.edit({ embeds: [embed] })
}

export { handleTopGames }
