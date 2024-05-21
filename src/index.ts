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

client.once('ready', () => {
  console.log(`Logged in as ${client.user?.tag}!`)

  client.user?.setActivity(botActivity)
})

client.on('presenceUpdate', (oldPresence, newPresence) => {
  // console.log('Presence update')

  handleActivity(oldPresence, newPresence)
})

client.login(process.env.DISCORD_TOKEN)
