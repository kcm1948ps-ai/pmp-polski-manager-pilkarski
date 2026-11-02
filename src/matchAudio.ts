export type StadiumAudio = {
  startCrowd: () => Promise<void>
  stopCrowd: () => void
  whistle: (kind: 'kickoff' | 'break' | 'full-time') => Promise<void>
  dispose: () => void
}

export function createStadiumAudio(): StadiumAudio {
  const crowd = new Audio('/audio/football-match-ambience.mp3')
  crowd.loop = true
  crowd.preload = 'auto'
  crowd.volume = 0.4

  const whistleSound = new Audio('/audio/referee-whistle.mp3')
  whistleSound.preload = 'auto'
  whistleSound.volume = 0.85

  let disposed = false

  const startCrowd = () => {
    if (disposed) return Promise.resolve()
    return crowd.play()
  }

  const stopCrowd = () => {
    if (disposed) return
    crowd.pause()
  }

  const whistle = (_kind: 'kickoff' | 'break' | 'full-time') => {
    if (disposed) return Promise.resolve()
    whistleSound.pause()
    whistleSound.currentTime = 0
    return whistleSound.play()
  }

  const dispose = () => {
    if (disposed) return
    disposed = true
    crowd.pause()
    whistleSound.pause()
  }

  return { startCrowd, stopCrowd, whistle, dispose }
}
