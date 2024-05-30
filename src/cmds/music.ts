import Discord from 'discord.js'
import { PrismaClient, User } from '@prisma/client'

import { prettySeconds } from '../prettySeconds'
import { inBlacklist, music } from '../groups'

const prisma = new PrismaClient()

async function handleMusicCmd(interaction: Discord.CommandInteraction) {
  const now = new Date()

  const users = await prisma.user.findMany({
    include: {
      activities: {
        where: {
          activityType: 'activity',
          name: { in: music },
        },
      },
    },
  })

  let userTotals: Record<string, number> = {}

  for (const user of users) {
    let total = 0
    inner: for (const activity of user.activities) {
      if (inBlacklist(activity.name)) continue inner

      total +=
        ~~(activity.duration / 1000) ||
        ~~((now.getTime() - activity.createdAt.getTime()) / 1000)
    }

    userTotals[user.username] = total
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

  embed.setTitle('Music Leaderboard')
  embed.setDescription('Rank users by total time spent listening to music')
  embed.setColor('Random')
  embed.setTimestamp(now)

  let indexCol = ''
  let usernameCol = ''
  let durationCol = ''

  for (let i = 0; i < sortedUsers.length; i++) {
    indexCol += `${i + 1}\n`
    usernameCol += `${sortedUsers[i].username}\n`
    durationCol += `${prettySeconds(sortedUsers[i].duration)}\n`
  }

  embed.addFields({
    name: 'Rank',
    value: indexCol,
    inline: true,
  })

  embed.addFields({
    name: 'Username',
    value: usernameCol,
    inline: true,
  })

  embed.addFields({
    name: 'Duration',
    value: durationCol,
    inline: true,
  })

  await interaction.reply({ embeds: [embed] })
}

export { handleMusicCmd }
