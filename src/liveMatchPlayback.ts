import type { MatchTimelinePeriod } from './game.ts'

export type LiveMatchIncident = {
  minute: number
  message: string
  homeGoals: number
  awayGoals: number
  kind?: 'commentary' | 'goal' | 'shot' | 'penalty-missed' | 'card' | 'substitution' | 'injury'
  goalType?: 'normal' | 'own-goal' | 'penalty'
  card?: 'yellow' | 'red'
  secondYellow?: boolean
  period?: MatchTimelinePeriod
  addedTime?: number
  onTarget?: boolean
  teamName?: string
  scorerName?: string
  playerId?: string
  incomingPlayerId?: string
  injuryDescription?: string
}

export function continueLiveMatchIncidents(
  firstHalfIncidents: LiveMatchIncident[],
  generatedIncidents: LiveMatchIncident[],
  halftimeScore: { home: number; away: number },
  finalScore: { home: number; away: number },
  homeName: string,
  awayName: string,
) {
  const generatedGoals = generatedIncidents.filter((incident) => incident.kind === 'goal')
  const secondHalfIncidents = generatedIncidents.filter((incident) => incident.minute > 45 && incident.kind !== 'goal')
  const occupiedMinutes = new Set(generatedIncidents
    .filter((incident) => incident.minute > 45)
    .map((incident) => incident.minute))
  const goalsForTeam = (teamName: string, count: number) => {
    const available = generatedGoals.filter((incident) => incident.minute > 45 && incident.teamName === teamName)
    const templates = generatedGoals.filter((incident) => incident.teamName === teamName)
    const selected = available.slice(0, count)
    while (selected.length < count) {
      const template = templates[selected.length % Math.max(templates.length, 1)]
      if (!template) break
      let minute = 50
      while (occupiedMinutes.has(minute) && minute < 90) minute += 1
      occupiedMinutes.add(minute)
      selected.push({ ...template, minute, period: 'second-half' })
    }
    return selected
  }
  const continuedIncidents = [
    ...secondHalfIncidents,
    ...goalsForTeam(homeName, finalScore.home - halftimeScore.home),
    ...goalsForTeam(awayName, finalScore.away - halftimeScore.away),
  ].sort((first, second) => first.minute - second.minute || (first.addedTime ?? 0) - (second.addedTime ?? 0))
  let homeGoals = halftimeScore.home
  let awayGoals = halftimeScore.away
  const rebasedSecondHalfIncidents = continuedIncidents.map((incident) => {
    if (incident.kind === 'goal') {
      if (incident.teamName === homeName) homeGoals += 1
      if (incident.teamName === awayName) awayGoals += 1
    }
    return { ...incident, homeGoals, awayGoals }
  })

  return [...firstHalfIncidents, ...rebasedSecondHalfIncidents]
}
