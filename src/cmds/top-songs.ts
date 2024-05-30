import Discord from 'discord.js'
import { PrismaClient, User } from '@prisma/client'
import { prettySeconds } from '../prettySeconds'
import { inBlacklist, music } from '../groups'

const prisma = new PrismaClient()

async function handleTopSongs(interaction: Discord.CommandInteraction) {
  // get all users and group by game

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

  let songCounts: Record<string, number> = {}

  for (const user of users) {
    for (const activity of user.activities) {
      if (songCounts[activity.details]) {
        songCounts[activity.details]++
      } else {
        songCounts[activity.details] = 1
      }
    }
  }

  const sortedSongs = Object.entries(songCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([song, count]) => {
      return {
        song,
        count,
      }
    })

  const embed = new Discord.EmbedBuilder()
    .setTitle('Top Songs')
    .setDescription('Rank songs by total plays. Unique songs: ' + sortedSongs.length)
    .setColor('Random')
    .setTimestamp(now)

  let indexCol = ''
  let songCol = ''
  let countCol = ''

  for (let i = 0; i < 10; i++) {
    const song = sortedSongs[i]

    indexCol += `${i + 1}\n`
    songCol += `${song.song}\n`
    countCol += `${song.count}\n`
  }

  embed.addFields([
    {
      name: 'Index',
      value: indexCol,
      inline: true,
    },
    {
      name: 'Song',
      value: songCol,
      inline: true,
    },
    {
      name: 'Count',
      value: countCol,
      inline: true,
    },
  ])

  await interaction.reply({ embeds: [embed] })
}

export { handleTopSongs }
