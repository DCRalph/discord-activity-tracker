import Discord from 'discord.js'
import { PrismaClient, User } from '@prisma/client'
import { prettySeconds } from '../prettySeconds'
import { inBlacklist, music } from '../groups'

const prisma = new PrismaClient()

async function withoutUser(interaction: Discord.CommandInteraction) {
  const now = new Date()

  const recentSongs = await prisma.activity.findMany({
    where: {
      activityType: 'activity',
      name: { in: music },
    },
    include: {
      user: {
        select: {
          discordId: true,
          username: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 10,
  })

  if (recentSongs.length === 0) {
    await interaction.reply('No recent songs found')
    return
  }

  const embed = new Discord.EmbedBuilder()
    .setTitle('Recent Songs')
    .setDescription('Most recent songs played')
    .setColor('Random')
    .setTimestamp(now)

  let indexCol = ''
  let songCol = ''
  let userCol = ''

  for (let i = 0; i < recentSongs.length; i++) {
    const song = recentSongs[i]

    indexCol += `<t:${~~(song.createdAt.getTime() / 1000)}:R>\n`
    songCol += `${song.details}\n`
    userCol += `${song.user.username}\n`
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
      name: 'User',
      value: userCol,
      inline: true,
    },
  ])

  await interaction.reply({
    embeds: [embed],
  })
}

async function withUser(
  interaction: Discord.CommandInteraction,
  discordUser: Discord.User
) {
  const now = new Date()

  const recentSongs = await prisma.activity.findMany({
    where: {
      activityType: 'activity',
      name: { in: music },
      user: {
        discordId: discordUser.id,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 10,
  })

  if (recentSongs.length === 0) {
    await interaction.reply('No recent songs found for this user')
    return
  }

  const embed = new Discord.EmbedBuilder()
    .setTitle('Recent Songs for ' + discordUser.username)
    .setDescription('Most recent songs played')
    .setColor('Random')
    .setTimestamp(now)

  let indexCol = ''
  let songCol = ''
  let timeCol = ''

  for (let i = 0; i < recentSongs.length; i++) {
    const song = recentSongs[i]

    indexCol += `<t:${~~(song.createdAt.getTime() / 1000)}:R>\n`
    songCol += `${song.details}\n`
    // timeCol += `${prettySeconds(~~(song.duration / 1000))}\n`
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
    // {
    //   name: 'Time',
    //   value: timeCol,
    //   inline: true,
    // },
  ])

  await interaction.reply({
    embeds: [embed],
  })
}

async function handleRecentSongsCmd(interaction: Discord.CommandInteraction) {
  const discordUser = interaction.options.get('user', false)?.user

  if (!discordUser) {
    await withoutUser(interaction)
  } else {
    await withUser(interaction, discordUser)
  }
}

export { handleRecentSongsCmd }
