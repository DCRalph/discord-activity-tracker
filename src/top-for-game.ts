import Discord from 'discord.js'
import { PrismaClient, User } from '@prisma/client'
import { prettySeconds } from './prettySeconds'
import { inBlacklist } from './blacklist'


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

  if (!game || inBlacklist(game)) {
    const games = await getUniqueGames()

    let msg = 'No game provided, valid games are:\n'
    if (games.size) {
      msg += [...games].join('\n')
    }

    interaction.reply(msg)

    return
  }

  let activitys = await prisma.activity.findMany({
    where: {
      activityType: 'activity',
    },
    include: {
      user: true,
    },
  })

  if (
    activitys.find(
      (activity) => activity.name.toLowerCase() == game.toLowerCase()
    )
  ) {
    activitys = activitys.filter((activity) => {
      return activity.name == game
    })
  } else {
    activitys = activitys.filter((activity) => {
      return activity.name.toLowerCase().startsWith(game.toLowerCase())
    })
  }

  console.log(activitys)

  if (!activitys.length) {
    const games = await getUniqueGames()

    let msg = 'No users found for game, valid games are:\n'
    if (games.size) {
      msg += [...games].join('\n')
    }

    interaction.reply(msg)

    return
  }

  const fullGameName = activitys[0].name

  let userTotals: Record<string, number> = {}

  for (const activity of activitys) {
    if (userTotals[activity.user.username]) {
      userTotals[activity.user.username] += activity.duration
    } else {
      userTotals[activity.user.username] = activity.duration
    }
  }

  let userTotalsArray = Object.entries(userTotals)
  userTotalsArray.sort((a, b) => b[1] - a[1])

  let userTotalsMap = new Map<string, number>()

  for (const [username, duration] of userTotalsArray) {
    userTotalsMap.set(username, duration)
  }

  const embed = new Discord.EmbedBuilder()
  embed.setTitle(`Top users for ${fullGameName}`)
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
