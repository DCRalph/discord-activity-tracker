import dotenv from 'dotenv'
import Discord from 'discord.js'
import { PrismaClient } from '@prisma/client'

import { handleActivityV2 } from './activity'
import { handleActivityCmd } from './activityCmd'

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

const prisma = new PrismaClient()

const botActivity: Discord.ActivityOptions = {
  name: 'always watching you...',
  type: Discord.ActivityType.Playing,
}

let userGuildMap = new Map<string, string>()

client.once('ready', async () => {
  console.log(`Logged in as ${client.user?.tag}!`)

  client.user?.setActivity(botActivity)

  const guilds = [...client.guilds.cache.values()]

  let commands = await client.application.commands.fetch()
  console.log()
  console.log(`Global commands: ${commands.size}`)

  commands.forEach(async (command) => {
    await command.delete()
  })

  for (const guild of guilds) {
    const g = await client.guilds.fetch(guild.id)
    const c = await g.commands.fetch()
    console.log()
    console.log(`Guild: ${guild.name}, Commands: ${c.size}`)

    c.forEach(async (command) => {
      await command.delete()
    })

    g.commands.create({
      name: 'ping',
      description: 'Ping the bot',
    })

    g.commands.create({
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

    console.log(`Commands created for ${guild.name}`)
  }

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
    interaction.reply('Pong!')
  }

  if (commandName === 'activity') {
    const user = interaction.options.get('user', true)?.user

    if (!user) {
      interaction.reply('User required')
      return
    }

    if (user.bot) {
      interaction.reply('Bot users are not supported')
      return
    }

    handleActivityCmd(interaction)
  }
})

client.login(process.env.DISCORD_TOKEN)
