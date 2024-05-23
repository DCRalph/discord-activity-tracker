const blacklistedGames = ['Visual Studio Code', 'Google Chrome', 'Spotify']

function inBlacklist(game: string) {
  for (const blacklistedGame of blacklistedGames) {
    if (game.toLowerCase().includes(blacklistedGame.toLowerCase())) {
      return true
    }
  }
}


export { inBlacklist }