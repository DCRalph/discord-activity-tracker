import Discord from 'discord.js'
import { PrismaClient } from '@prisma/client'

import { prettySeconds } from '../prettySeconds'
import { inBlacklist, music } from '../groups'
import prettyEmbeds from '../prettyEmbeds'

const prisma = new PrismaClient()

async function handleMusicLeaderboardCmd(
  interaction: Discord.CommandInteraction
) {
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

  if (users.length === 0) {
    await interaction.reply('No users found')
    return
  }

  let userTotals: Record<string, number> = {}

  for (const user of users) {
    let total = 0
    inner: for (const activity of user.activities) {
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
    .setTitle('Music Leaderboard')
    .setDescription('Rank users by total time spent listening to music')
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

  // console.table({ sortedUsers })

  try {
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

    await interaction.reply({ embeds: [embed] })
  } catch (e) {
    console.log(e)

    const embed = prettyEmbeds.general.anErrorOccurred()

    interaction.reply({ embeds: [embed] })

    prisma.error.create({
      data: {
        where: 'handleMusicLeaderboardCmd',
        message: e.message,
        stack: e.stack,
      },
    })
  }
}

export { handleMusicLeaderboardCmd }
