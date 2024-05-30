import Discord from 'discord.js'

function anErrorOccurred() {
  const embed = new Discord.EmbedBuilder()

  embed.setTitle('An error occurred')
  embed.setColor('Red')
  embed.setTimestamp(new Date())

  return embed
}

function message(message: string) {
  const embed = new Discord.EmbedBuilder()

  embed.setTitle('Message')
  embed.setColor('Random')
  embed.setDescription(message)

  return embed
}

const general = {
  anErrorOccurred,
  message,
}

export default { general }
