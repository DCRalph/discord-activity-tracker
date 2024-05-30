const blacklistedActivities = [
  'bloatware1234!@#', // IGNORE THIS LINE
  'bloatware1234!@#', // IGNORE THIS LINE
  'bloatware1234!@#', // IGNORE THIS LINE
  'bloatware1234!@#', // IGNORE THIS LINE
  'Visual Studio Code',
  'Google Chrome',
  'Cider 2',
  'Spotify',
]

function inBlacklist(activity1: string) {
  for (const activity2 of blacklistedActivities) {
    if (activity1.toLowerCase().includes(activity2.toLowerCase())) {
      return true
    }
  }
}

const music = ['Cider 2', 'Spotify']

function isMusic(activity1: string) {
  return music.includes(activity1)
}

export { inBlacklist, music }
