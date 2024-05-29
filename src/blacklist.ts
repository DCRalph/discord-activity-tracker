const blacklistedGames = [
  'bloatware1234!@#', // IGNORE THIS LINE
  'bloatware1234!@#', // IGNORE THIS LINE
  'bloatware1234!@#', // IGNORE THIS LINE
  'bloatware1234!@#', // IGNORE THIS LINE
  'Visual Studio Code',
  'Google Chrome',
  'Cider 2',
  'Spotify',
]

function inBlacklist(game: string) {
  for (const blacklistedGame of blacklistedGames) {
    if (game.toLowerCase().includes(blacklistedGame.toLowerCase())) {
      return true
    }
  }
}

export { inBlacklist }
