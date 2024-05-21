import dotenv from 'dotenv'
import Discord from 'discord.js'
import { PrismaClient } from '@prisma/client'

import { handleActivity } from './activity'

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

client.once('ready', async () => {
  console.log(`Logged in as ${client.user?.tag}!`)

  client.user?.setActivity(botActivity)

  const g = await client.guilds.fetch('689384013047005199')
  const c = await g.commands.fetch()

  console.log(c)

  c.forEach(async (command) => {
    console.log(command)
    await command.delete()
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
})

client.on('presenceUpdate', (oldPresence, newPresence) => {
  // console.log('Presence update')

  if (newPresence.user?.bot) return

  try {
    handleActivity(oldPresence, newPresence)
  } catch (e) {
    console.log('\n\nError')
    console.error(e)
    console.log('\n')

    if (oldPresence) {
      console.log('Old presence:')
      console.log(oldPresence)

      console.log('oldPresence activities:')
      console.log(oldPresence.activities)
    }

    console.log('New presence:')
    console.log(newPresence)

    console.log('newPresence activities:')
    console.log(newPresence.activities)

    console.log('\n\n')
  }
})

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return

  const { commandName } = interaction

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
