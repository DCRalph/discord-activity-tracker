import dotenv from 'dotenv'
import Discord from 'discord.js'
import { PrismaClient } from '@prisma/client'

import { handleActivity, handleActivityV2 } from './activity'

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

    const userRecord = await prisma.user.findFirst({
      where: {
        discordId: user.id,
      },
    })

    if (!userRecord) {
      interaction.reply('User not found')
      return
    }

    const activityRecord = await prisma.activity.findMany({
      where: {
        userId: userRecord.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    let totals = {}

    for (const activity of activityRecord) {
      if (activity.activityType !== 'activity') continue

      let duration = 0

      if (!totals[activity.name]) totals[activity.name] = 0

      if (activity.endedAt == null)
        duration = (new Date().getTime() - activity.startedAt.getTime()) / 1000
      else duration = activity.duration

      totals[activity.name] += duration
    }

    let msg = `Activity for ${user.username}:\n`

    for (const [name, duration] of Object.entries(totals)) {
      msg += `${name}: ${duration}\n`
    }

    interaction.reply(msg)
  }
})

client.login(process.env.DISCORD_TOKEN)
