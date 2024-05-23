import dotenv from 'dotenv'
import Discord from 'discord.js'
import { PrismaClient } from '@prisma/client'

import { handleActivityV2 } from './activity'
import { handleActivityCmd, handleActivityLeaderboardCmd } from './activityCmd'
import { handleTopGames } from './top-games'
import { handleTopForGame } from './top-for-game'

dotenv.config()

const clientOptions = {
  intents: [
    Discord.GatewayIntentBits.Guilds,
    Discord.GatewayIntentBits.GuildMembers,
    Discord.GatewayIntentBits.GuildPresences,
    Discord.GatewayIntentBits.GuildMessages,
    Discord.GatewayIntentBits.GuildVoiceStates,
    Discord.GatewayIntentBits.DirectMessages,
  ],
}

const client = new Discord.Client(clientOptions)
let guilds = []
const coolGuy = '472872051359612945'

const prisma = new PrismaClient()

const botActivity: Discord.ActivityOptions = {
  name: 'always watching you...',
  type: Discord.ActivityType.Playing,
}

let userGuildMap = new Map<string, string>()

async function deleteCmds() {
  const commands = await client.application.commands.fetch()
  console.log()
  console.log(`Global commands: ${commands.size}`)

  commands.forEach(async (command) => {
    await command.delete()
  })

  console.log('Global commands deleted')

  for (const guild of guilds) {
    const g = await client.guilds.fetch(guild.id)
    const c = await g.commands.fetch()
    console.log()
    console.log(`Guild: ${guild.name}, Commands: ${c.size}`)

    c.forEach(async (command) => {
      await command.delete()
    })
  }

  console.log('Guild commands deleted')
}

async function createCmds() {
  for (const guild of guilds) {
    const g = await client.guilds.fetch(guild.id)

    await g.commands.create({
      name: 'ping',
      description: 'Ping the bot',
    })

    await g.commands.create({
      name: 'admin-recreate-cmds',
      description: 'Recreate all commands',
    })

    await g.commands.create({
      name: 'activity',
      description: 'Get user activity',
      options: [
        {
          name: 'user',
          type: Discord.ApplicationCommandOptionType.User,
          description: 'The user to get activity for',
          required: true,
        },
      ],
    })

    await g.commands.create({
      name: 'activity-leaderboard',
      description: 'Get user activity leaderboard',
    })

    await g.commands.create({
      name: 'top-games',
      description: 'Get list of top games',
    })

    await g.commands.create({
      name: 'top-for-game',
      description: 'Get top users for a game',
      options: [
        {
          name: 'game',
          type: Discord.ApplicationCommandOptionType.String,
          description: 'The game to get top users for',
          required: false,
        },
      ],
    })

    console.log(`Commands created for ${guild.name}`)
  }
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user?.tag}!`)

  client.user?.setActivity(botActivity)

  guilds = client.guilds.cache.map((guild) => {
    return {
      id: guild.id,
      name: guild.name,
    }
  })

  // await deleteCmds()
  await createCmds()

  console.log('Bot is ready')
  console.log('.')
  console.log('.')
})

client.on('presenceUpdate', async (oldPresence, newPresence) => {
  if (newPresence.user?.bot) return

  const discordUser = newPresence.user
  const guild = newPresence.guild

  if (!discordUser.id) return

  const userAllowedGuild = userGuildMap.get(discordUser.id)

  if (!userAllowedGuild) {
    userGuildMap.set(discordUser.id, guild.id)
  } else if (userAllowedGuild !== guild.id) {
    console.log(
      `User ${discordUser.username} is in multiple guilds, skipping ${guild.name}...`
    )
    return
  }

  console.log(`[${discordUser.username}, ${guild.name}] Processing...`)

  await handleActivityV2(oldPresence, newPresence, guild)

  console.log(`[${discordUser.username}, ${guild.name}] Done`)
  console.log('.')
  console.log('.')
})

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return

  const { commandName } = interaction

  if (commandName === 'ping') {
    const timeTaken = Date.now() - interaction.createdTimestamp

    const reply = await interaction.reply(
      `Pong! to me(${timeTaken}ms) and back(...ms)`
    )

    const roundTripTime = Date.now() - reply.createdTimestamp

    reply.edit(`Pong! toDiscord(${timeTaken}ms) and back(${roundTripTime}ms)`)
  }

  if (commandName === 'admin-recreate-cmds') {
    if (interaction.user.id != coolGuy && true) {
      //https://raw.githubusercontent.com/DCRalph/discord-activity-tracker/main/assets/wrong.mp4
      // send this video as a reply

      const embed = new Discord.EmbedBuilder()
        .setTitle('Nope')
        .setDescription('You are not allowed to do that')
        .setImage(
          'https://raw.githubusercontent.com/DCRalph/discord-activity-tracker/main/assets/wrong.mp4'
        )
        .setURL(
          'https://raw.githubusercontent.com/DCRalph/discord-activity-tracker/main/assets/wrong.mp4'
        )

      interaction.reply({ embeds: [embed] })
      return
    }

    await deleteCmds()
    await createCmds()
  }

  if (commandName === 'activity') {
    handleActivityCmd(interaction)
  }

  if (commandName === 'activity-leaderboard') {
    handleActivityLeaderboardCmd(interaction)
  }

  if (commandName === 'top-games') {
    handleTopGames(interaction)
  }

  if (commandName === 'top-for-game') {
    handleTopForGame(interaction)
  }
})

client.login(process.env.DISCORD_TOKEN)
