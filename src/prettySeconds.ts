function prettySeconds(seconds: number) {
  // convert seconds to days, hours, minutes, seconds
  // only include the largest unit that is not zero
  const days = Math.floor(seconds / 86400)
  seconds %= 86400
  const hours = Math.floor(seconds / 3600)
  seconds %= 3600
  const minutes = Math.floor(seconds / 60)
  seconds %= 60

  let result = ''
  if (days) result += `${days} d `
  if (hours) result += `${hours} h `
  if (minutes) result += `${minutes} m `
  if (seconds) result += `${seconds} s `

  if (!result) {
    result = '0 s'
  }

  return result.trim()
}

export { prettySeconds }