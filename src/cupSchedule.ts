export type PolishCupScheduleStage =
  | 'regional-first'
  | 'regional-second'
  | 'regional-third'
  | 'regional-quarterfinal'
  | 'regional-semifinal'
  | 'regional-final'
  | 'central-preliminary'
  | 'central-first'
  | 'central-round-of-16'
  | 'central-round-of-8'
  | 'central-quarterfinal'
  | 'central-semifinal'
  | 'central-final'

export type ScheduledCupMatch = {
  date: Date
  kickoffTime: string
}

export function getLocalDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseLocalDateKey(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function getEasterSunday(year: number) {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

export function isPolishPublicHoliday(date: Date) {
  return getPolishPublicHolidayName(date) !== undefined
}

export function getPolishPublicHolidayName(date: Date) {
  const year = date.getFullYear()
  const fixedHolidays = new Map([
    [`${year}-01-01`, 'Nowy Rok'],
    [`${year}-01-06`, 'Święto Trzech Króli'],
    [`${year}-05-01`, 'Święto Pracy'],
    [`${year}-05-03`, 'Święto Konstytucji 3 Maja'],
    [`${year}-08-15`, 'Wniebowzięcie Najświętszej Maryi Panny'],
    [`${year}-11-01`, 'Wszystkich Świętych'],
    [`${year}-11-11`, 'Narodowe Święto Niepodległości'],
    [`${year}-12-24`, 'Wigilia Bożego Narodzenia'],
    [`${year}-12-25`, 'Boże Narodzenie'],
    [`${year}-12-26`, 'Drugi dzień Bożego Narodzenia'],
  ])
  const dateKey = getLocalDateKey(date)
  const fixedHoliday = fixedHolidays.get(dateKey)
  if (fixedHoliday) return fixedHoliday
  const easter = getEasterSunday(year)
  const movableHolidays = [
    { offset: 0, name: 'Wielkanoc' },
    { offset: 1, name: 'Poniedziałek Wielkanocny' },
    { offset: 49, name: 'Zielone Świątki' },
    { offset: 60, name: 'Boże Ciało' },
  ].map(({ offset, name }) => {
    const holiday = new Date(easter)
    holiday.setDate(holiday.getDate() + offset)
    return { date: getLocalDateKey(holiday), name }
  })
  return movableHolidays.find((holiday) => holiday.date === dateKey)?.name
}

export function moveMatchDateOffPolishHoliday(date: Date) {
  const adjustedDate = new Date(date)
  adjustedDate.setHours(12, 0, 0, 0)
  for (let offset = 0; offset < 14 && isPolishPublicHoliday(adjustedDate); offset += 1) {
    adjustedDate.setDate(adjustedDate.getDate() - 1)
  }
  if (isPolishPublicHoliday(adjustedDate)) {
    throw new Error(`Nie znaleziono terminu wolnego od świąt w pobliżu ${getLocalDateKey(date)}.`)
  }
  return adjustedDate
}

function seasonStartYear(season: string) {
  const parsed = Number.parseInt(season.split('/')[0], 10)
  return Number.isFinite(parsed) ? parsed : new Date().getFullYear()
}

function getSeasonYear(season: string, month: number) {
  return seasonStartYear(season) + (month <= 5 ? 1 : 0)
}

function getFirstWeekday(year: number, month: number, weekday: number, fromDay = 1) {
  const date = new Date(year, month, fromDay)
  date.setDate(date.getDate() + (weekday - date.getDay() + 7) % 7)
  return date
}

function getLastWeekday(year: number, month: number, weekday: number) {
  const date = new Date(year, month + 1, 0)
  date.setDate(date.getDate() - (date.getDay() - weekday + 7) % 7)
  return date
}

function getNthWednesday(year: number, month: number, occurrence: number) {
  const firstWednesday = getFirstWeekday(year, month, 3)
  firstWednesday.setDate(firstWednesday.getDate() + (occurrence - 1) * 7)
  return firstWednesday
}

function getFirstTuesdayThroughThursday(year: number, month: number) {
  return getFirstWeekday(year, month, 2)
}

function getLastTuesdayThroughThursday(year: number, month: number) {
  return getLastWeekday(year, month, 4)
}

function dateForStage(season: string, stage: PolishCupScheduleStage) {
  const monthByStage: Record<PolishCupScheduleStage, number> = {
    'regional-first': 7,
    'regional-second': 8,
    'regional-third': 9,
    'regional-quarterfinal': 3,
    'regional-semifinal': 3,
    'regional-final': 5,
    'central-preliminary': 7,
    'central-first': 8,
    'central-round-of-16': 9,
    'central-round-of-8': 11,
    'central-quarterfinal': 2,
    'central-semifinal': 3,
    'central-final': 4,
  }
  const month = monthByStage[stage]
  const year = getSeasonYear(season, month)

  switch (stage) {
    case 'regional-first':
    case 'regional-second':
      return getNthWednesday(year, month, 3)
    case 'regional-third':
      return getLastWeekday(year, month, 3)
    case 'regional-quarterfinal':
      return getFirstWeekday(year, month, 3)
    case 'central-quarterfinal':
      return getFirstTuesdayThroughThursday(year, month)
    case 'regional-semifinal':
      return getLastWeekday(year, month, 3)
    case 'regional-final':
      return getNthWednesday(year, month, 3)
    case 'central-preliminary':
      return getFirstWeekday(year, month, 3)
    case 'central-first':
    case 'central-round-of-16':
      return getLastTuesdayThroughThursday(year, month)
    case 'central-round-of-8':
    case 'central-semifinal':
      return getFirstTuesdayThroughThursday(year, month)
    case 'central-final':
      return new Date(year, month, 2)
  }
}

function getCupMatchDates(season: string, stage: PolishCupScheduleStage) {
  let endDate = dateForStage(season, stage)
  if (stage === 'central-final') return [endDate]
  const drawDate = getPolishCupDrawDate(season, stage)
  const stageOrder: PolishCupScheduleStage[] = [
    'regional-first',
    'regional-second',
    'regional-third',
    'regional-quarterfinal',
    'regional-semifinal',
    'regional-final',
    'central-preliminary',
    'central-first',
    'central-round-of-16',
    'central-round-of-8',
    'central-quarterfinal',
    'central-semifinal',
    'central-final',
  ]
  const nextStage = stageOrder[stageOrder.indexOf(stage) + 1]
  const nextDrawDate = nextStage ? getPolishCupDrawDate(season, nextStage) : null
  if (nextDrawDate && (!drawDate || nextDrawDate > drawDate)) {
    const lastMatchDate = new Date(nextDrawDate)
    lastMatchDate.setDate(lastMatchDate.getDate() - 1)
    if (lastMatchDate < endDate) endDate = lastMatchDate
  }
  const startDate = new Date(endDate)
  startDate.setDate(startDate.getDate() - 20)
  if (drawDate && startDate <= drawDate) {
    startDate.setTime(drawDate.getTime())
    startDate.setDate(startDate.getDate() + 1)
  }
  const cupWeekdays = [2, 3, 4]
  const dates: Date[] = []
  for (const date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
    if (cupWeekdays.includes(date.getDay())) dates.push(new Date(date))
  }
  return dates.length ? dates : [endDate]
}

export function getPolishCupMatchSchedule(
  season: string,
  stage: PolishCupScheduleStage,
  matchIndex = 0,
): ScheduledCupMatch {
  const dates = getCupMatchDates(season, stage)
  const isRegional = stage.startsWith('regional-')
  const kickoffTimes = isRegional ? ['16:00', '17:30', '19:00'] : ['17:30', '19:00', '20:30', '21:00']
  const slotIndex = Math.max(0, matchIndex)
  const dateIndex = slotIndex % dates.length
  const timeIndex = Math.floor(slotIndex / dates.length) % kickoffTimes.length
  const scheduledDate = moveMatchDateOffPolishHoliday(dates[dateIndex])
  const isFinal = stage === 'central-final'
  return {
    date: scheduledDate,
    kickoffTime: isFinal ? '16:00' : kickoffTimes[timeIndex],
  }
}

function getWinterBreakWeeks(tier: number) {
  if (tier <= 2) return 8
  if (tier === 3) return 9
  if (tier === 4) return 10
  return 12
}

export function getLeagueRoundDate(
  season: string,
  round: number,
  tier: number,
  roundCount = 34,
  matchesPerOpponent = 2,
) {
  const year = seasonStartYear(season)
  const lowerLeague = tier >= 4
  const start = new Date(year, 7, 1)
  const fridayOffset = (5 - start.getDay() + 7) % 7
  start.setDate(start.getDate() + fridayOffset + (lowerLeague ? 1 : 0))
  const dayOffsets = lowerLeague ? [0, 1] : [0, 1, 2, 3]
  const completedFirstHalfRounds = Math.ceil(roundCount / 2)
  const standardWinterBreakWeeks = getWinterBreakWeeks(tier)
  const winterBreakExtension = tier >= 4
    && matchesPerOpponent < 4
    ? roundCount <= 18 ? 4 : roundCount <= 22 ? 2 : 0
    : 0
  const winterBreakWeeks = standardWinterBreakWeeks + winterBreakExtension
  let roundWeek: number
  if (matchesPerOpponent >= 4) {
    roundWeek = round <= completedFirstHalfRounds
      ? round - 1
      : completedFirstHalfRounds - 1 + winterBreakWeeks + round - completedFirstHalfRounds
  } else if (round <= completedFirstHalfRounds) {
    const fallRoundIndex = round - 1
    roundWeek = completedFirstHalfRounds > 1
      ? fallRoundIndex / (completedFirstHalfRounds - 1) * 16
      : 0
  } else {
    const springRoundCount = roundCount - completedFirstHalfRounds
    const springRoundIndex = round - completedFirstHalfRounds - 1
    if (springRoundCount > 1) {
      const firstSpringWeek = 17 + winterBreakWeeks
      const finalSeasonWeek = 33 + standardWinterBreakWeeks
      roundWeek = firstSpringWeek
        + springRoundIndex / (springRoundCount - 1) * (finalSeasonWeek - firstSpringWeek)
    } else {
      roundWeek = 17 + winterBreakWeeks
    }
  }
  const fixtureDate = new Date(start)
  fixtureDate.setDate(fixtureDate.getDate() + Math.round(roundWeek * 7) + dayOffsets[(round - 1) % dayOffsets.length])
  return fixtureDate
}

export function getPolishCupDrawDate(season: string, stage: PolishCupScheduleStage) {
  const year = seasonStartYear(season)
  const monthByStage: Partial<Record<PolishCupScheduleStage, number>> = {
    'regional-first': 7,
    'regional-second': 8,
    'regional-third': 9,
    'regional-quarterfinal': 2,
    'central-preliminary': 6,
    'central-first': 7,
    'central-round-of-16': 8,
    'central-round-of-8': 9,
    'central-quarterfinal': 0,
    'central-semifinal': 3,
    'central-final': 3,
  }
  const month = monthByStage[stage]
  if (stage === 'regional-first' || stage === 'regional-second' || stage === 'regional-third') {
    return new Date(year, month as number, 1)
  }
  if (stage === 'regional-quarterfinal') return new Date(year + 1, month as number, 15)
  if (stage === 'regional-semifinal') {
    const quarterfinal = dateForStage(season, 'regional-quarterfinal')
    return new Date(quarterfinal.getFullYear(), quarterfinal.getMonth(), quarterfinal.getDate() + 1)
  }
  if (stage === 'regional-final') {
    const semifinal = dateForStage(season, 'regional-semifinal')
    return new Date(semifinal.getFullYear(), semifinal.getMonth(), semifinal.getDate() + 1)
  }
  if (stage === 'central-preliminary') return new Date(year, month as number, 15)
  if (stage === 'central-first') return getNthWednesday(year, month as number, 2)
  if (stage === 'central-round-of-16' || stage === 'central-round-of-8') {
    const precedingStage = stage === 'central-round-of-16' ? 'central-first' : 'central-round-of-16'
    const precedingDate = dateForStage(season, precedingStage)
    const friday = getFirstWeekday(precedingDate.getFullYear(), precedingDate.getMonth(), 5, precedingDate.getDate() + 1)
    return friday
  }
  if (stage === 'central-quarterfinal') return getFirstWeekday(year + 1, month as number, 1)
  if (stage === 'central-semifinal') {
    const quarterfinalBlockEnd = dateForStage(season, 'central-quarterfinal')
    quarterfinalBlockEnd.setDate(quarterfinalBlockEnd.getDate() + 2)
    return getFirstWeekday(quarterfinalBlockEnd.getFullYear(), quarterfinalBlockEnd.getMonth(), 5, quarterfinalBlockEnd.getDate() + 1)
  }
  if (stage === 'central-final') {
    const semifinalBlockEnd = dateForStage(season, 'central-semifinal')
    semifinalBlockEnd.setDate(semifinalBlockEnd.getDate() + 2)
    return getFirstWeekday(semifinalBlockEnd.getFullYear(), semifinalBlockEnd.getMonth(), 5, semifinalBlockEnd.getDate() + 1)
  }
  return null
}

export function getNextLeagueDateAfterCupCollision(
  conflictedDate: Date,
  occupiedDates: Date[],
) {
  const occupied = new Set(occupiedDates.map((date) => date.toDateString()))
  const candidate = new Date(conflictedDate)
  candidate.setHours(12, 0, 0, 0)
  for (let offset = 3; offset <= 16; offset += 1) {
    const date = new Date(candidate)
    date.setDate(date.getDate() + offset)
    if (![2, 3].includes(date.getDay())) continue
    if (occupied.has(date.toDateString())) continue
    return date
  }
  throw new Error('Nie znaleziono wolnego wtorku ani środy dla przełożonego meczu ligowego.')
}
