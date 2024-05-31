import Discord from 'discord.js'
import { PrismaClient } from '@prisma/client'

import { prettySeconds } from '../prettySeconds'
import { blacklistedActivities, inBlacklist } from '../groups'

const prisma = new PrismaClient()

async function handleGameLeaderboardCmd(
  interaction: Discord.CommandInteraction
) {
  const users = await prisma.user.findMany({
    include: {
      activities: {
        where: {
          activityType: 'activity',
          name: { notIn: blacklistedActivities },
        },
      },
    },
  })

  const now = new Date()
  let userTotals: Record<string, number> = {}

  for (const user of users) {
    const activities = user.activities

    let total = 0
    inner: for (const activity of activities) {
      // if (inBlacklist(activity.name)) continue inner

      total +=
        ~~(activity.duration / 1000) ||
        ~~((now.getTime() - activity.createdAt.getTime()) / 1000)
    }

    userTotals[user.username] = total
    console.log(user.username, total)
  }

  const sortedUsers = Object.entries(userTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([username, duration]) => {
      return {
        username,
        duration,
      }
    })
    .filter((user) => user.duration > 0)

  const embed = new Discord.EmbedBuilder()
    .setTitle('Game Leaderboard')
    .setDescription('Rank users by total time spent playing games')
    .setColor('Random')
    .setTimestamp(now)

  let indexCol = ''
  let usernameCol = ''
  let durationCol = ''

  for (let i = 0; i < sortedUsers.length; i++) {
    indexCol += `${i + 1}\n`
    usernameCol += `${sortedUsers[i].username}\n`
    durationCol += `${prettySeconds(sortedUsers[i].duration)}\n`
  }

  embed.addFields([
    {
      name: 'Rank',
      value: indexCol,
      inline: true,
    },
    {
      name: 'Username',
      value: usernameCol,
      inline: true,
    },
    {
      name: 'Duration',
      value: durationCol,
      inline: true,
    },
  ])

  interaction.reply({ embeds: [embed] })
}

export { handleGameLeaderboardCmd }
