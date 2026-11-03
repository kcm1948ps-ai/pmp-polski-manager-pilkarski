import { lazy, Suspense, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type TouchEvent as ReactTouchEvent } from 'react'
import {
  Activity,
  Ambulance,
  ArrowDownLeft,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Coins,
  Compass,
  Dumbbell,
  Flag,
  Home,
  ImagePlus,
  Landmark,
  Mail,
  MapPin,
  Menu,
  Newspaper,
  Play,
  Search,
  RotateCcw,
  Settings,
  Shield,
  Shirt,
  Snowflake,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Star,
  Target,
  Trophy,
  TrendingUp,
  TriangleAlert,
  Tv,
  UsersRound,
  Users,
  Wallet,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { continueLiveMatchIncidents, type LiveMatchIncident } from './liveMatchPlayback.ts'
import {
  createGame,
  createGameSaveSnapshot,
  completeFacilityConstruction,
  canPlayPosition,
  clubsByLeague,
  ensureUniqueGamePlayerNames,
  getClubCity,
  getClub,
  getClubRivalryLevel,
  getDerbyKind,
  getLeagueChampionTrophyName,
  getLeagueTier,
  getRegionForCity,
  getRegionsForLeague,
  getCompetitionDiscipline,
  getEffectivePlayerSpecialRoles,
  getInjuryDurationLabel,
  formationOptions,
  getLeagueTable,
  getLeagueTableZones,
  getNextMatch,
  getNextFriendlyMatch,
  getNextScheduledCompetition,
  getPolishCupNextMatch,
  getPmpLeagueNextMatch,
  isPolishCupDrawPublished,
  getPolishCupMatchStageLabel,
  getPolishCupStageLabel,
  publishPolishCupDrawIfDue,
  simulateCalendarDay,
  getGameMatchupsPerOpponent,
  getSeasonRoundCount,
  getTransferWindowInfo,
  getPlayerContractDemand,
  getTeamName,
  getTransferMarketGroups,
  getTransferMarketTeams,
  prepareTransferMarketLeague,
  transferMarketTiers,
  estimateAttendance,
  dismissScout,
  hireScout,
  hireStaffMember,
  dismissStaffMember,
  leagues,
  regionalOptions,
  loadGameFromJSON,
  loadSavedGame,
  negotiateSponsorOffer,
  renewSponsorDeal,
  notifyPolishCupWeek,
  overallRating,
  isLocalDerby,
  playerPersonalityLabels,
  positionTrainingSessionsRequired,
  playMatchday,
  saveMatchPreparation,
  saveMatchConference,
  saveDerbyMatchAction,
  playFriendlyMatch,
  playChampionsCupMatch,
  playPolishCupRound,
  playPmpLeagueEvent,
  playPromotionPlayoffRound,
  signAcademyProspect,
  recruitAcademyProspect,
  trainAcademyPlayer,
  promoteAcademyPlayer,
  signCommercialDeal,
  signScoutedProspect,
  scoutPackages,
  staffRoles,
  sellPlayer,
  offerPlayerToClubs,
  withdrawOutgoingPlayerTransferListing,
  setTicketPrice,
  signPlayer,
  setTactics,
  setMatchSquadRole,
  setPlayerSpecialRole,
  makeMatchdaySubstitution,
  replaceMatchPlayer,
  applyPreviousMatchSquad,
  acceptClubTransferCounteroffer,
  respondToClubTransferCounteroffer,
  proposeClubTransfer,
  rejectClubTransferCounteroffer,
  respondToIncomingTransferOffer,
  renamePlayer,
  renameOwnClub,
  renewPlayerContract,
  resolveSeasonEvent,
  resolvePlayerStory,
  talkToPlayer,
  getSuspensionMatches,
  starsFor,
  startNewSeason,
  toggleLineupPlayer,
  trainSquad,
  trainPlayerForPosition,
  setPlayerTrainingPlan,
  loanPlayerIn,
  loanPlayerOut,
  valueLabel,
  type GameState,
  type FinanceEntry,
  type Team,
  type Match,
  type FriendlyMatch,
  type ChampionsCupMatch,
  type MatchSubstitutionEvent,
  type MatchPenaltyEvent,
  type PlayerSpecialRole,
  type MatchTimelinePeriod,
  type PolishCupMatch,
  type PmpLeagueMatch,
  type PromotionPlayoffFixture,
  type InboxMessage,
  type LeagueId,
  type StaffRole,
  type Player,
  type Position,
  type ScoutExperience,
  type TrainingFocus,
  type PlayerTrainingPlan,
  type Formation,
  type PressingIntensity,
  type TacticalStyle,
} from './game.ts'
import { createStadiumAudio, type StadiumAudio } from './matchAudio.ts'
import { getLeagueRoundDate, getLocalDateKey, getNextLeagueDateAfterCupCollision, getPolishCupMatchSchedule, getPolishPublicHolidayName, parseLocalDateKey, type PolishCupScheduleStage } from './cupSchedule.ts'
import type { LeagueTier } from './leagueData.ts'
import { createId } from './id.ts'
import './App.css'

type Section = 'overview' | 'squad' | 'availability' | 'tactics' | 'calendar' | 'matches' | 'standings' | 'statistics' | 'player-statistics' | 'match-stats' | 'other-leagues' | 'cup' | 'regional-cup' | 'pmp-league' | 'transfers' | 'inbox' | 'scouting' | 'academy' | 'finances' | 'club' | 'media' | 'history' | 'board' | 'settings'
const SECTIONS: Section[] = ['overview', 'squad', 'availability', 'tactics', 'calendar', 'matches', 'standings', 'statistics', 'player-statistics', 'match-stats', 'other-leagues', 'cup', 'regional-cup', 'pmp-league', 'transfers', 'inbox', 'scouting', 'academy', 'finances', 'club', 'media', 'history', 'board', 'settings']
type DeferredSection = Extract<Section, 'club' | 'history' | 'board' | 'media'>
const MATCH_HALF_DURATION_MS = 30_000
const MATCHDAY_FALLBACK_DATE = new Date()
const GAME_MUSIC_VOLUME_KEY = 'polski-manager-music-volume'
const GAME_MUSIC_LOCK_NAME = 'pmp27-background-music'
const DEFAULT_GAME_MUSIC_VOLUME = 20
const CAREER_CUSTOMIZATION_KEY = 'polski-manager-career-customization'
type CareerCustomization = {
  clubName: string
  clubColor: string
  crestIdentity?: string
  playerNamesByShirtNumber: Record<string, { firstName: string; lastName: string }>
  playerIdsByShirtNumber: Record<string, string>
}

function readCareerCustomization(): CareerCustomization {
  const serialized = readStorage(CAREER_CUSTOMIZATION_KEY)
  if (!serialized) return { clubName: '', clubColor: '#d8fa54', playerNamesByShirtNumber: {}, playerIdsByShirtNumber: {} }
  let parsed: unknown
  try {
    parsed = JSON.parse(serialized)
  } catch {
    throw new Error('Zapis personalizacji kariery jest uszkodzony. Możesz kontynuować, ale wcześniejsze ustawienia nie zostaną użyte.')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Zapis personalizacji kariery ma nieprawidłowy format.')
  }
  const value = parsed as Record<string, unknown>
  const savedPlayerNames = value.playerNamesByShirtNumber
  const playerNamesByShirtNumber = savedPlayerNames && typeof savedPlayerNames === 'object' && !Array.isArray(savedPlayerNames)
    ? Object.fromEntries(Object.entries(savedPlayerNames).flatMap(([shirtNumber, savedName]) => {
      if (!savedName || typeof savedName !== 'object' || Array.isArray(savedName)) return []
      const { firstName, lastName } = savedName as Record<string, unknown>
      return typeof firstName === 'string' && typeof lastName === 'string'
        ? [[shirtNumber, { firstName, lastName }]]
        : []
    }))
    : {}
  return {
    clubName: typeof value.clubName === 'string' ? value.clubName : '',
    clubColor: typeof value.clubColor === 'string' ? value.clubColor : '#d8fa54',
    crestIdentity: typeof value.crestIdentity === 'string' ? value.crestIdentity : undefined,
    playerNamesByShirtNumber,
    playerIdsByShirtNumber: value.playerIdsByShirtNumber && typeof value.playerIdsByShirtNumber === 'object'
      ? Object.fromEntries(Object.entries(value.playerIdsByShirtNumber).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
      : {},
  }
}

function applyCareerCustomization(game: GameState, customization: CareerCustomization) {
  let next = structuredClone(game)
  if (customization.clubName && customization.clubName !== next.clubName) {
    const renamed = renameOwnClub(next, customization.clubName)
    if (renamed.error) throw new Error(renamed.error)
    next = renamed.game
  }
  next.clubColor = customization.clubColor
  if (customization.crestIdentity) {
    const crest = readClubCrestLibrary()[customization.crestIdentity]
    if (crest) {
      next.clubCrestDataUrl = crest
      next.clubCrestsByTeamId ??= {}
      next.clubCrestsByTeamId[next.teamId] = crest
    }
  }
  const updatedPlayerIds = new Map<string, string>()
  for (const player of next.squad) {
    if (player.shirtNumber === undefined) continue
    const shirtNumber = String(player.shirtNumber)
    const originalId = player.id
    const savedId = customization.playerIdsByShirtNumber[shirtNumber]
    if (savedId) {
      player.id = savedId
      updatedPlayerIds.set(originalId, savedId)
    }
    const savedName = customization.playerNamesByShirtNumber[shirtNumber]
    if (!savedName) continue
    player.firstName = savedName.firstName
    player.lastName = savedName.lastName
  }
  const updatePlayerIds = (ids: string[] | undefined) => ids?.map((id) => updatedPlayerIds.get(id) ?? id)
  next.lineupIds = updatePlayerIds(next.lineupIds) ?? []
  next.matchLineupIds = updatePlayerIds(next.matchLineupIds) ?? []
  next.matchBenchIds = updatePlayerIds(next.matchBenchIds) ?? []
  next.previousMatchLineupIds = updatePlayerIds(next.previousMatchLineupIds) ?? []
  next.previousMatchBenchIds = updatePlayerIds(next.previousMatchBenchIds) ?? []
  next.matchOutsideSquadIds = updatePlayerIds(next.matchOutsideSquadIds)
  if (next.matchLineupPositions) {
    next.matchLineupPositions.slots = Object.fromEntries(Object.entries(next.matchLineupPositions.slots)
      .map(([slot, playerId]) => [slot, updatedPlayerIds.get(playerId) ?? playerId]))
  }
  if (next.playerSpecialRoles) {
    for (const role of ['captain', 'viceCaptain', 'penaltyTaker', 'freeKickTaker', 'cornerTaker'] as const) {
      const playerId = next.playerSpecialRoles[role]
      if (playerId) next.playerSpecialRoles[role] = updatedPlayerIds.get(playerId) ?? playerId
    }
  }
  ensureUniqueGamePlayerNames(next)
  return next
}

const GAME_MUSIC_TRACKS = [
  '/music/match-day-pulse.mp3',
  '/music/match-point-1.mp3',
  '/music/match-point-2.mp3',
  '/music/match-point.mp3',
  '/music/matchday-pulse-1.mp3',
  '/music/matchday-pulse.mp3',
  '/music/tense-breakbeat-groove-1.mp3',
  '/music/tense-breakbeat-groove.mp3',
  '/music/tryb-walki.mp3',
  '/music/tryumf-na-boisku.mp3',
  '/music/untitled-1.mp3',
  '/music/untitled.mp3',
]
type MatchTeamStatistics = {
  possession: number
  shots: number
  shotsOnTarget: number
  passes: number
  passAccuracy: number
  corners: number
  fouls: number
  offsides: number
  saves: number
}
type MatchStatistics = { home: MatchTeamStatistics; away: MatchTeamStatistics }
type AvailabilityEntry = { player: Player; kind: 'injury' | 'suspension'; title: string; detail: string }
type LiveLineupPlayer = {
  id: string
  name: string
  position: Position
  rating: number
  shirtNumber: number
}

const generatedScorerFirstNames = ['Adam', 'Bartosz', 'Filip', 'Jakub', 'Kacper', 'Michał', 'Mateusz', 'Paweł', 'Szymon', 'Tomasz']
const generatedScorerLastNames = ['Bąk', 'Czarnecki', 'Duda', 'Kamiński', 'Kowalczyk', 'Lewandowski', 'Mazur', 'Nowak', 'Piotrowski', 'Wójcik']

function generatedScorerName() {
  const firstName = generatedScorerFirstNames[Math.floor(Math.random() * generatedScorerFirstNames.length)]
  const lastName = generatedScorerLastNames[Math.floor(Math.random() * generatedScorerLastNames.length)]
  return `${firstName} ${lastName}`
}

function createMatchStatistics(match: Match, game: GameState): MatchStatistics {
  const homeGoals = match.homeGoals ?? 0
  const awayGoals = match.awayGoals ?? 0
  const strengthFor = (teamId: string) => teamId === game.teamId
    ? overallRating(game.squad)
    : game.teams.find((team) => team.id === teamId)?.strength
      ?? game.polishCup?.teams.find((team) => team.id === teamId)?.strength
      ?? overallRating(game.squad)
  const strengthDifference = strengthFor(match.homeId) - strengthFor(match.awayId)
  const homePossession = Math.max(35, Math.min(65, 50 + Math.round(strengthDifference * 0.25) + Math.floor(Math.random() * 7) - 3))
  const homeShots = Math.max(homeGoals, 5 + Math.floor(Math.random() * 11) + Math.max(0, Math.round(strengthDifference / 12)))
  const awayShots = Math.max(awayGoals, 5 + Math.floor(Math.random() * 11) + Math.max(0, Math.round(-strengthDifference / 12)))
  const homeShotsOnTarget = Math.min(homeShots, Math.max(homeGoals, 2 + Math.floor(Math.random() * 5)))
  const awayShotsOnTarget = Math.min(awayShots, Math.max(awayGoals, 2 + Math.floor(Math.random() * 5)))
  const homePasses = Math.round(220 + homePossession * 2.1 + Math.random() * 85)
  const awayPasses = Math.round(220 + (100 - homePossession) * 2.1 + Math.random() * 85)
  const homePassAccuracy = Math.min(91, Math.max(65, 74 + Math.round(strengthDifference / 10) + Math.floor(Math.random() * 9)))
  const awayPassAccuracy = Math.min(91, Math.max(65, 74 - Math.round(strengthDifference / 10) + Math.floor(Math.random() * 9)))
  return {
    home: {
      possession: homePossession,
      shots: homeShots,
      shotsOnTarget: homeShotsOnTarget,
      passes: homePasses,
      passAccuracy: homePassAccuracy,
      corners: 2 + Math.floor(Math.random() * 8),
      fouls: 5 + Math.floor(Math.random() * 13),
      offsides: Math.floor(Math.random() * 5),
      saves: Math.max(0, awayShotsOnTarget - awayGoals),
    },
    away: {
      possession: 100 - homePossession,
      shots: awayShots,
      shotsOnTarget: awayShotsOnTarget,
      passes: awayPasses,
      passAccuracy: awayPassAccuracy,
      corners: 2 + Math.floor(Math.random() * 8),
      fouls: 5 + Math.floor(Math.random() * 13),
      offsides: Math.floor(Math.random() * 5),
      saves: Math.max(0, homeShotsOnTarget - homeGoals),
    },
  }
}

function createMatchIntermissionGame(game: GameState, round: number, matchId: string) {
  const intermissionGame = structuredClone(game)
  intermissionGame.pendingMatchEvent = {
    id: createId(),
    round,
    matchId,
    title: 'Przerwa w meczu',
    description: 'Możesz dokonać zmian i skorygować taktykę przed drugą połową.',
    options: [],
    substitutionsUsed: 0,
    substitutedPlayerIds: [],
    substitutePlayerIds: [],
  }
  return intermissionGame
}

type LiveMatchPlayback = {
  id: string
  round: number
  matchId: string
  homeId: string
  awayId: string
  competitionLabel: string
  competitionDescription: string
  homeName: string
  awayName: string
  homeLineup: LiveLineupPlayer[]
  awayLineup: LiveLineupPlayer[]
  substitutions: MatchSubstitutionEvent[]
  minute: number
  homeGoals: number
  awayGoals: number
  finalHomeGoals: number
  finalAwayGoals: number
  commentary: string
  incidents: LiveMatchIncident[]
  feed: LiveMatchIncident[]
  statistics: MatchStatistics
  matchFinanceEntries: GameState['finances']
  startedAt: number
  startingGame: GameState
  finalGame: GameState
  intermissionGame: GameState | null
  matchdayEvent: GameState['pendingMatchEvent'] | null
  matchdayDecisionId?: string
  halftimePaused: boolean
  secondHalfStarted: boolean
  resumeError?: string
  resultMessage: string
  finished: boolean
  penaltyScore?: string
  penaltyShootoutEvents?: MatchPenaltyEvent[]
  extraTimePlayed: boolean
}

function getLiveMatchLineup(game: GameState, teamId: string, lineupSource: GameState, matchId: string): LiveLineupPlayer[] {
  const players = teamId === game.teamId
    ? game.matchLineupIds
      .map((playerId) => game.squad.find((player) => player.id === playerId))
      .filter((player): player is Player => player !== undefined)
    : (() => {
      const roster = lineupSource.clubSquads[teamId]?.map(({ player }) => player) ?? []
      const sortedRoster = [...roster].sort((first, second) => second.skill - first.skill)
      const goalkeeper = sortedRoster.find((player) => player.position === 'BR')
      return [
        ...(goalkeeper ? [goalkeeper] : []),
        ...sortedRoster.filter((player) => player.id !== goalkeeper?.id).slice(0, goalkeeper ? 10 : 11),
      ]
    })()
  const report = lineupSource.lastMatchReport?.matchId === matchId ? lineupSource.lastMatchReport : null
  const performanceByPlayerId = new Map(
    (report?.playerRatings ?? []).map((performance) => [performance.playerId, performance.rating]),
  )
  const usedNumbers = new Set<number>()
  let nextFallbackNumber = 12
  return players.map((player) => {
    const preferredNumbers = player.position === 'BR'
      ? [1]
      : ['PO', 'ŚO', 'LO'].includes(player.position)
        ? [2, 3, 4, 5]
        : ['DP', 'ŚP', 'OP', 'PP', 'LP'].includes(player.position)
          ? [6, 7, 8]
          : [9, 10, 11]
    const shirtNumber = preferredNumbers.find((number) => !usedNumbers.has(number))
      ?? nextFallbackNumber++
    usedNumbers.add(shirtNumber)
    return {
      id: player.id,
      name: `${player.firstName} ${player.lastName}`,
      position: player.position,
      rating: performanceByPlayerId.get(player.id)
        ?? Math.max(1, Math.min(99, player.skill + Math.round((player.morale - 70) / 15))),
      shirtNumber,
    }
  })
}

function getCupMatchCompetitionDescription(game: GameState, match: PolishCupMatch) {
  const regionalCup = game.regionalCups?.find((cup) =>
    [...cup.matches, ...cup.history].some((fixture) => fixture.id === match.id),
  )
  if (regionalCup) {
    return `${getCupCompetitionLabel(game, match)} · runda ${match.round}`
  }
  const centralCup = game.polishCup
  if (centralCup && [...centralCup.matches, ...centralCup.history].some((fixture) => fixture.id === match.id)) {
    return `Polski Puchar · ${getPolishCupStageLabel(centralCup)}`
  }
  return `Polski Puchar · ${getPolishCupMatchStageLabel(match.stage, match.round)}`
}

function getMatchCompetitionDescription(game: GameState, match: Match, defaultLabel?: string) {
  if (match.competitionId === 'friendly' || defaultLabel === 'SPARING PRZEDSEZONOWY') {
    return 'Sparing przedsezonowy'
  }
  if (match.competitionId === 'polish-cup' || defaultLabel === 'POLSKI PUCHAR') {
    const cupMatch = [
      ...(game.polishCup?.matches ?? []),
      ...(game.polishCup?.history ?? []),
      ...(game.regionalCups ?? []).flatMap((cup) => [...cup.matches, ...cup.history]),
    ].find((fixture) => fixture.id === match.id)
    if (cupMatch) return getCupMatchCompetitionDescription(game, cupMatch)
    return 'Polski Puchar'
  }
  if (match.competitionId === 'champions-cup' || defaultLabel === 'PUCHAR MISTRZÓW') {
    return 'Puchar Mistrzów'
  }
  if (match.competitionId === 'other') return 'Inne rozgrywki'
  const leagueName = leagues.find((league) => league.id === game.leagueId)?.name ?? 'Liga'
  return `${leagueName} · rozgrywki ligowe`
}

function createLiveMatchPlayback(
  game: GameState,
  finalGame: GameState,
  match: Match,
  report: GameState['lastMatchReport'],
  competitionLabel: string,
  round: number,
  resultMessage: string,
  penaltyScore?: string,
  matchdayEvent?: GameState['pendingMatchEvent'],
  matchdayDecisionId?: string,
): LiveMatchPlayback {
  const homeName = getTeamName(finalGame, match.homeId)
  const awayName = getTeamName(finalGame, match.awayId)
  const competitionDescription = getMatchCompetitionDescription(game, match, competitionLabel)
  const homeLineup = getLiveMatchLineup(game, match.homeId, finalGame, match.id)
  const awayLineup = getLiveMatchLineup(game, match.awayId, finalGame, match.id)
  const getPlayerName = (playerId: string) => {
    const player = finalGame.squad.find((candidate) => candidate.id === playerId)
      ?? game.squad.find((candidate) => candidate.id === playerId)
    return player ? `${player.firstName} ${player.lastName}` : 'Nieznany zawodnik'
  }
  const savedSubstitutions = match.substitutions ?? (matchdayEvent?.substitutedPlayerIds ?? []).flatMap((outgoingPlayerId, index) => {
    const incomingPlayerId = matchdayEvent?.substitutePlayerIds?.[index]
    return incomingPlayerId
      ? [{ minute: 45, teamId: game.teamId, outgoingPlayerId, incomingPlayerId, reason: 'manual' as const }]
      : []
  })
  const substitutionsByPair = new Map<string, MatchSubstitutionEvent>()
  savedSubstitutions.forEach((substitution) => {
    const key = `${substitution.teamId}:${substitution.outgoingPlayerId}:${substitution.incomingPlayerId}`
    const previous = substitutionsByPair.get(key)
    if (!previous || (previous.reason === 'manual' && substitution.reason !== 'manual')) {
      substitutionsByPair.set(key, substitution)
    }
  })
  const substitutions = [...substitutionsByPair.values()]
  const statistics = createMatchStatistics(match, finalGame)
  const originalFinanceIds = new Set(game.finances.map((entry) => entry.id))
  const matchFinanceEntries = finalGame.finances.filter((entry) => !originalFinanceIds.has(entry.id))
  const finalHomeGoals = match.homeGoals ?? 0
  const finalAwayGoals = match.awayGoals ?? 0
  const matchEvents: Array<{ minute: number; addedTime?: number; period?: MatchTimelinePeriod; message: string; homeDelta: number; awayDelta: number; kind: 'goal' | 'shot' | 'penalty-missed' | 'card' | 'substitution' | 'injury'; goalType?: LiveMatchIncident['goalType']; card?: LiveMatchIncident['card']; secondYellow?: boolean; onTarget?: boolean; teamName?: string; scorerName?: string; playerId?: string; incomingPlayerId?: string; injuryDescription?: string }> = []
  const occupiedMinutes = new Set<number>()
  const nextGoalMinute = () => {
    let minute = 5 + Math.floor(Math.random() * 82)
    while (occupiedMinutes.has(minute)) minute = 5 + Math.floor(Math.random() * 82)
    occupiedMinutes.add(minute)
    return minute
  }
  const getPeriodForMinute = (minute: number): MatchTimelinePeriod => match.extraTimePlayed && minute > 105
    ? 'extra-time-second-half'
    : match.extraTimePlayed && minute > 90
      ? 'extra-time-first-half'
      : minute <= 45
        ? 'first-half'
        : 'second-half'
  const matchReport = report?.matchId === match.id ? report : null
  const getReportedScorers = (lineup: LiveLineupPlayer[]) => (matchReport?.playerRatings ?? [])
    .filter((rating) => rating.goals > 0 && lineup.some((player) => player.id === rating.playerId))
    .flatMap((rating) => Array.from({ length: rating.goals }, () => rating.playerName))
  const homeScorerNames = getReportedScorers(homeLineup)
  const awayScorerNames = getReportedScorers(awayLineup)
  let homeScorerIndex = 0
  let awayScorerIndex = 0
  const getScorer = (lineup: LiveLineupPlayer[], index: number) => {
    const attackingPlayers = lineup.filter((player) => ['OP', 'PP', 'LP', 'PN', 'LN', 'ŚN'].includes(player.position))
    const candidates = attackingPlayers.length ? attackingPlayers : lineup
    return candidates.length ? candidates[index % candidates.length].name : generatedScorerName()
  }

  const timelineGoalCounts = (match.timeline ?? []).reduce(
    (counts, event) => {
      if (event.type !== 'penalty-missed') {
        if (event.teamId === match.homeId) counts.home += 1
        if (event.teamId === match.awayId) counts.away += 1
      }
      return counts
    },
    { home: 0, away: 0 },
  )
  const timelineMatchesScore = Boolean(match.timeline)
    && timelineGoalCounts.home === finalHomeGoals
    && timelineGoalCounts.away === finalAwayGoals

  if (timelineMatchesScore && match.timeline) {
    match.timeline.forEach((event) => {
      occupiedMinutes.add(event.minute)
      const teamName = getTeamName(finalGame, event.teamId)
      const scored = event.type !== 'penalty-missed'
      const period = event.period ?? getPeriodForMinute(event.minute)
      matchEvents.push({
        minute: event.minute,
        addedTime: event.addedTime,
        period,
        message: event.type === 'penalty-missed'
          ? `Rzut karny ${teamName} nie został wykorzystany. ${event.playerName}`
          : `${event.type === 'own-goal' ? 'BRAMKA SAMOBÓJCZA' : event.type === 'penalty-goal' ? 'GOL Z KARNEGO' : 'GOL'} DLA ${teamName}! ${event.playerName}`,
        teamName,
        scorerName: event.playerName,
        playerId: event.playerId,
        kind: scored ? 'goal' : 'penalty-missed',
        goalType: !scored ? undefined : event.type === 'own-goal' ? 'own-goal' : event.type === 'penalty-goal' ? 'penalty' : 'normal',
        homeDelta: scored && event.teamId === match.homeId ? 1 : 0,
        awayDelta: scored && event.teamId === match.awayId ? 1 : 0,
      })
    })
  } else {
    ;(match.timeline ?? []).filter((event) => event.type === 'penalty-missed').forEach((event) => {
      const teamName = getTeamName(finalGame, event.teamId)
      const period = event.period ?? getPeriodForMinute(event.minute)
      matchEvents.push({
        minute: event.minute,
        addedTime: event.addedTime,
        period,
        message: `Rzut karny ${teamName} nie został wykorzystany. ${event.playerName}`,
        teamName,
        scorerName: event.playerName,
        playerId: event.playerId,
        kind: 'penalty-missed',
        homeDelta: 0,
        awayDelta: 0,
      })
    })
    for (let index = 0; index < finalHomeGoals; index += 1) {
      const scorerName = homeScorerNames[homeScorerIndex++] ?? getScorer(homeLineup, index)
      const minute = nextGoalMinute()
      matchEvents.push({
        minute,
        period: minute <= 45 ? 'first-half' : 'second-half',
        message: `GOL DLA ${homeName}! ${scorerName}`,
        teamName: homeName,
        scorerName,
        kind: 'goal',
        goalType: 'normal',
        homeDelta: 1,
        awayDelta: 0,
      })
    }
    for (let index = 0; index < finalAwayGoals; index += 1) {
      const scorerName = awayScorerNames[awayScorerIndex++] ?? getScorer(awayLineup, index)
      const minute = nextGoalMinute()
      matchEvents.push({
        minute,
        period: minute <= 45 ? 'first-half' : 'second-half',
        message: `GOL DLA ${awayName}! ${scorerName}`,
        teamName: awayName,
        scorerName,
        kind: 'goal',
        goalType: 'normal',
        homeDelta: 0,
        awayDelta: 1,
      })
    }
  }
  substitutions.forEach((substitution) => {
    const teamName = getTeamName(finalGame, substitution.teamId)
    matchEvents.push({
      minute: substitution.minute,
      period: getPeriodForMinute(substitution.minute),
      message: `Zmiana ${teamName}: ${getPlayerName(substitution.outgoingPlayerId)} schodzi, ${getPlayerName(substitution.incomingPlayerId)} wchodzi.`,
      teamName,
      scorerName: getPlayerName(substitution.outgoingPlayerId),
      playerId: substitution.outgoingPlayerId,
      incomingPlayerId: substitution.incomingPlayerId,
      kind: 'substitution',
      homeDelta: 0,
      awayDelta: 0,
    })
  })
  ;(match.injuryEvents ?? []).forEach((injury) => {
    const teamName = getTeamName(finalGame, injury.teamId)
    matchEvents.push({
      minute: injury.minute,
      period: getPeriodForMinute(injury.minute),
      message: `Kontuzja: ${injury.playerName} (${injury.description}).`,
      teamName,
      scorerName: injury.playerName,
      playerId: injury.playerId,
      injuryDescription: injury.description,
      kind: 'injury',
      homeDelta: 0,
      awayDelta: 0,
    })
  })
  ;(match.disciplinaryEvents ?? []).forEach((event) => {
    const teamId = event.teamId
      ?? (homeLineup.some((player) => player.id === event.playerId) ? match.homeId : match.awayId)
    const teamName = getTeamName(finalGame, teamId)
    const minute = event.minute ?? 45
    const period = getPeriodForMinute(minute)
    matchEvents.push({
      minute,
      period,
      message: `${event.secondYellow ? 'Druga żółta kartka i czerwona' : event.card === 'red' ? 'Czerwona' : 'Żółta'} kartka dla ${event.playerName}${event.card === 'red' || event.secondYellow ? '. Zawodnik schodzi z boiska, a drużyna gra w osłabieniu.' : event.suspensionApplied ? '. Zawodnik pauzuje w kolejnym meczu tych rozgrywek.' : '.'}`,
      teamName,
      scorerName: event.playerName,
      playerId: event.playerId,
      kind: 'card',
      card: event.card,
      secondYellow: event.secondYellow,
      homeDelta: 0,
      awayDelta: 0,
    })
  })
  const addShots = (teamName: string, teamLineup: LiveLineupPlayer[], shots: number, shotsOnTarget: number, goals: number) => {
    const nonGoalShots = Math.max(0, shots - goals)
    const onTargetNonGoalShots = Math.max(0, shotsOnTarget - goals)
    const attackers = teamLineup.filter((player) => ['OP', 'PP', 'LP', 'PN', 'LN', 'ŚN'].includes(player.position))
    const candidates = attackers.length ? attackers : teamLineup
    for (let index = 0; index < nonGoalShots; index += 1) {
      const onTarget = index < onTargetNonGoalShots
      const shooter = candidates[index % Math.max(1, candidates.length)]
      matchEvents.push({
        minute: nextGoalMinute(),
        message: onTarget
          ? `Strzał ${shooter?.name ?? 'zawodnika'}! Bramkarz broni.`
          : `Niecelny strzał ${shooter?.name ?? 'zawodnika'}.`,
        homeDelta: 0,
        awayDelta: 0,
        kind: 'shot',
        onTarget,
        teamName,
        playerId: shooter?.id,
      })
    }
  }
  addShots(homeName, homeLineup, statistics.home.shots, statistics.home.shotsOnTarget, finalHomeGoals)
  addShots(awayName, awayLineup, statistics.away.shots, statistics.away.shotsOnTarget, finalAwayGoals)

  const commentary = [
    { minute: 1, message: 'Pierwszy gwizdek! Piłka w grze, oba zespoły ruszają do walki.' },
    { minute: 14, message: 'Drużyny badają swoje ustawienie i szukają miejsca na boisku.' },
    { minute: 31, message: 'Mecz nabiera tempa. Każda akcja może otworzyć drogę do bramki.' },
    { minute: 45, message: 'Koniec pierwszej połowy. Czas na krótką przerwę i wskazówki trenerów.' },
    { minute: 46, message: 'Wracamy do gry! Rozpoczyna się druga połowa spotkania.' },
    { minute: 63, message: 'Ostatnie pół godziny. Zawodnicy walczą o przejęcie inicjatywy.' },
    { minute: 78, message: 'Wchodzimy w decydującą fazę meczu. Trybuny żyją każdą akcją.' },
    {
      minute: 90,
      message: match.extraTimePlayed
        ? 'Koniec regulaminowego czasu gry. Przed nami dogrywka.'
        : 'Koniec meczu.',
    },
    ...(match.extraTimePlayed ? [
      { minute: 105, message: 'Koniec pierwszej połowy dogrywki.' },
      { minute: 106, message: 'Rozpoczyna się druga połowa dogrywki.' },
      {
        minute: 120,
        message: penaltyScore
          ? `Koniec dogrywki. O awansie rozstrzygną rzuty karne: ${penaltyScore}.`
          : 'Koniec dogrywki.',
      },
    ] : []),
  ]
  const ordered = [
    ...commentary.map((event) => ({ ...event, homeDelta: 0, awayDelta: 0, kind: 'commentary' as const, goalType: undefined, card: undefined, secondYellow: undefined, period: undefined, addedTime: undefined, onTarget: undefined, teamName: undefined, scorerName: undefined, playerId: undefined, incomingPlayerId: undefined, injuryDescription: undefined })),
    ...matchEvents,
  ].sort((first, second) => first.minute - second.minute || (first.addedTime ?? 0) - (second.addedTime ?? 0))
  let homeGoals = 0
  let awayGoals = 0
  const incidents = ordered.map((event) => {
    homeGoals += event.homeDelta
    awayGoals += event.awayDelta
    return { minute: event.minute, addedTime: event.addedTime, period: event.period, message: event.message, homeGoals, awayGoals, kind: event.kind, goalType: event.goalType, card: event.card, secondYellow: event.secondYellow, onTarget: event.onTarget, teamName: event.teamName, scorerName: event.scorerName, playerId: event.playerId, incomingPlayerId: event.incomingPlayerId, injuryDescription: event.injuryDescription }
  })

  return {
    id: createId(),
    round,
    matchId: match.id,
    homeId: match.homeId,
    awayId: match.awayId,
    competitionLabel,
    competitionDescription,
    homeName,
    awayName,
    homeLineup,
    awayLineup,
    substitutions,
    minute: 0,
    homeGoals: 0,
    awayGoals: 0,
    finalHomeGoals,
    finalAwayGoals,
    commentary: 'Zawodnicy wychodzą na murawę. Za chwilę rozpocznie się spotkanie.',
    incidents,
    feed: [],
    statistics,
    matchFinanceEntries,
    startedAt: Date.now(),
    startingGame: structuredClone(game),
    finalGame,
    intermissionGame: createMatchIntermissionGame(game, round, match.id),
    matchdayEvent: matchdayEvent ? structuredClone(matchdayEvent) : null,
    matchdayDecisionId,
    halftimePaused: false,
    secondHalfStarted: false,
    resultMessage,
    finished: false,
    penaltyScore,
    penaltyShootoutEvents: match.penaltyShootoutEvents,
    extraTimePlayed: match.extraTimePlayed ?? false,
  }
}

const DeferredPages = lazy(() => import('./DeferredPages.tsx'))

function isDeferredSection(section: Section): section is DeferredSection {
  return section === 'club' || section === 'history' || section === 'board' || section === 'media'
}

const saveSlots = ['slot-1', 'slot-2', 'slot-3'] as const
const saveSlotLabels: Record<typeof saveSlots[number], string> = {
  'slot-1': 'Slot 1',
  'slot-2': 'Slot 2',
  'slot-3': 'Slot 3',
}

const navigation: Array<{ id: Section; label: string; icon: typeof Home }> = [
  { id: 'overview', label: 'Centrum klubu', icon: Home },
  { id: 'squad', label: 'Pierwsza drużyna', icon: Shirt },
  { id: 'availability', label: 'Pauzy i Kontuzje', icon: Ambulance },
  { id: 'tactics', label: 'Skład i taktyka', icon: Compass },
  { id: 'calendar', label: 'Kalendarz', icon: CalendarDays },
  { id: 'matches', label: 'Terminarz i wyniki', icon: CalendarDays },
  { id: 'standings', label: 'Tabela ligowa', icon: Activity },
  { id: 'statistics', label: 'Statystyki', icon: TrendingUp },
  { id: 'player-statistics', label: 'Statystyki piłkarzy', icon: Users },
  { id: 'other-leagues', label: 'Inne ligi', icon: TrendingUp },
  { id: 'cup', label: 'Polski Puchar', icon: Trophy },
  { id: 'regional-cup', label: 'Puchar regionalny', icon: Trophy },
  { id: 'pmp-league', label: 'Liga PMP', icon: Trophy },
  { id: 'transfers', label: 'Rynek transferowy', icon: Search },
  { id: 'inbox', label: 'Skrzynka e-mail', icon: Mail },
  { id: 'scouting', label: 'Skauting', icon: Compass },
  { id: 'academy', label: 'Akademia młodzieżowa', icon: Users },
  { id: 'finances', label: 'Finanse', icon: Wallet },
  { id: 'club', label: 'Stadion i teren', icon: Building2 },
  { id: 'media', label: 'Media społecznościowe', icon: Newspaper },
  { id: 'history', label: 'Historia i statystyki', icon: Activity },
  { id: 'board', label: 'Zarząd i cele', icon: Landmark },
  { id: 'settings', label: 'Ustawienia gry', icon: Settings },
]

const positionLabels: Record<Position, string> = {
  BR: 'Bramkarz',
  PO: 'Prawy obrońca',
  ŚO: 'Środkowy obrońca',
  LO: 'Lewy obrońca',
  DP: 'Defensywny pomocnik',
  ŚP: 'Środkowy pomocnik',
  OP: 'Ofensywny pomocnik',
  PP: 'Prawy pomocnik',
  LP: 'Lewy pomocnik',
  PN: 'Prawy napastnik',
  LN: 'Lewy napastnik',
  ŚN: 'Środkowy napastnik',
}

const positionAbbreviations: Record<Position, string> = {
  BR: 'BR',
  PO: 'PO',
  ŚO: 'ŚO',
  LO: 'LO',
  DP: 'DP',
  ŚP: 'ŚP',
  OP: 'OP',
  PP: 'PP',
  LP: 'LP',
  PN: 'PN',
  LN: 'LN',
  ŚN: 'ŚN',
}

type FormationSlot = Position

const formationSlotRows: Record<Formation, FormationSlot[][]> = {
  '4-3-3': [['BR'], ['LO', 'ŚO', 'ŚO', 'PO'], ['DP', 'ŚP', 'OP'], ['LN', 'ŚN', 'PN']],
  '4-4-2': [['BR'], ['LO', 'ŚO', 'ŚO', 'PO'], ['LP', 'ŚP', 'ŚP', 'PP'], ['ŚN', 'ŚN']],
  '4-2-3-1': [['BR'], ['LO', 'ŚO', 'ŚO', 'PO'], ['DP', 'DP'], ['LN', 'OP', 'PN'], ['ŚN']],
  '3-5-2': [['BR'], ['LO', 'ŚO', 'PO'], ['LP', 'DP', 'ŚP', 'OP', 'PP'], ['ŚN', 'ŚN']],
  '3-4-3': [['BR'], ['LO', 'ŚO', 'PO'], ['LP', 'DP', 'OP', 'PP'], ['LN', 'ŚN', 'PN']],
  '5-3-2': [['BR'], ['LO', 'ŚO', 'ŚO', 'ŚO', 'PO'], ['DP', 'ŚP', 'OP'], ['ŚN', 'ŚN']],
  '4-1-4-1': [['BR'], ['LO', 'ŚO', 'ŚO', 'PO'], ['DP'], ['LP', 'ŚP', 'ŚP', 'PP'], ['ŚN']],
  '4-3-2-1': [['BR'], ['LO', 'ŚO', 'ŚO', 'PO'], ['DP', 'ŚP', 'OP'], ['LP', 'PP'], ['ŚN']],
}

const formatMoney = (amount: number) => `${Math.round(amount).toLocaleString('pl-PL')} zł`
const CLUB_CREST_LIBRARY_KEY = 'polski-manager-club-crest-library'
const TACTIC_PRESETS_KEY = 'polski-manager-tactic-presets'
type TacticPresetPlayer = { shirtNumber: number | null; name: string; position: Position }
type TacticPreset = {
  id: string
  name: string
  formation: Formation
  style: TacticalStyle
  pressing: PressingIntensity
  lineup: TacticPresetPlayer[]
  bench: TacticPresetPlayer[]
  outside: TacticPresetPlayer[]
  lineupSlots: Record<string, TacticPresetPlayer>
}

function isTacticPreset(value: unknown): value is TacticPreset {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const preset = value as Record<string, unknown>
  const formations = formationOptions.map(({ id }) => id)
  const playerLists = [preset.lineup, preset.bench, preset.outside]
  const isPlayerRef = (reference: unknown): reference is TacticPresetPlayer => {
    if (!reference || typeof reference !== 'object' || Array.isArray(reference)) return false
    const player = reference as Record<string, unknown>
    return (player.shirtNumber === null || (typeof player.shirtNumber === 'number' && Number.isInteger(player.shirtNumber)))
      && typeof player.name === 'string'
      && typeof player.position === 'string'
      && Object.hasOwn(positionLabels, player.position)
  }
  return typeof preset.id === 'string'
    && typeof preset.name === 'string'
    && formations.includes(preset.formation as Formation)
    && ['balanced', 'attacking', 'counter'].includes(String(preset.style))
    && ['low', 'normal', 'high'].includes(String(preset.pressing))
    && playerLists.every((list) => Array.isArray(list) && list.every(isPlayerRef))
    && Boolean(preset.lineupSlots)
    && typeof preset.lineupSlots === 'object'
    && !Array.isArray(preset.lineupSlots)
    && Object.values(preset.lineupSlots as Record<string, unknown>).every(isPlayerRef)
}

function readTacticPresets() {
  const serialized = readStorage(TACTIC_PRESETS_KEY)
  if (!serialized) return []
  const parsed: unknown = JSON.parse(serialized)
  if (!Array.isArray(parsed) || !parsed.every(isTacticPreset)) {
    throw new Error('Zapis wariantów składu ma nieprawidłowy format.')
  }
  return parsed
}

function readStorage(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

function removeStorage(key: string) {
  try {
    localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}

function getInitialSave() {
  try {
    const game = loadSavedGame()
    if (!game) return { game, error: '' }
    try {
      migrateCareerCrestsToLibrary(game)
      return { game, error: '' }
    } catch (error) {
      return {
        game,
        error: error instanceof Error ? error.message : 'Nie udało się przenieść herbów do biblioteki przeglądarki.',
      }
    }
  } catch (error) {
    return { game: null, error: error instanceof Error ? error.message : 'Nie udało się odczytać zapisu gry.' }
  }
}

function crestHash(value: string) {
  return [...value].reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0, 7)
}

function getClubCrestImage(game: GameState, teamId: string) {
  return game.clubCrestsByTeamId?.[teamId]
    ?? (teamId === game.teamId ? game.clubCrestDataUrl : undefined)
}

function getClubCrestIdentity(team: Pick<Team, 'name' | 'regionId'>) {
  const normalizedName = team.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pl-PL')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${normalizedName}|${team.regionId ?? ''}`
}

function getCareerTeams(game: GameState) {
  const teams = [
    ...game.teams,
    ...Object.values(game.leagueWorld ?? {}).flat(),
    ...(game.polishCup?.teams ?? []),
    ...(game.regionalCups?.flatMap((cup) => cup.teams) ?? []),
  ]
  return [...new Map(teams.map((team) => [team.id, team])).values()]
}

function readClubCrestLibrary() {
  const serialized = readStorage(CLUB_CREST_LIBRARY_KEY)
  if (!serialized) return {} as Record<string, string>
  const parsed: unknown = JSON.parse(serialized)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Biblioteka herbów ma nieprawidłowy format.')
  }
  return Object.fromEntries(
    Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  )
}

function applyClubCrestLibrary(game: GameState) {
  const library = readClubCrestLibrary()
  const next = structuredClone(game)
  next.clubCrestsByTeamId ??= {}
  for (const team of getCareerTeams(next)) {
    const image = library[getClubCrestIdentity(team)]
    if (image) next.clubCrestsByTeamId[team.id] = image
  }
  const ownTeam = next.teams.find((team) => team.id === next.teamId)
  const ownClubCrest = ownTeam ? library[getClubCrestIdentity(ownTeam)] : undefined
  if (ownClubCrest) next.clubCrestDataUrl = ownClubCrest
  return next
}

function migrateCareerCrestsToLibrary(game: GameState) {
  const library = readClubCrestLibrary()
  const teamsById = new Map(getCareerTeams(game).map((team) => [team.id, team]))
  let changed = false
  for (const [teamId, image] of Object.entries(game.clubCrestsByTeamId ?? {})) {
    const team = teamsById.get(teamId)
    if (!team) continue
    const identity = getClubCrestIdentity(team)
    if (library[identity]) continue
    library[identity] = image
    changed = true
  }
  const ownTeam = teamsById.get(game.teamId)
  if (ownTeam && game.clubCrestDataUrl) {
    const identity = getClubCrestIdentity(ownTeam)
    if (!library[identity]) {
      library[identity] = game.clubCrestDataUrl
      changed = true
    }
  }
  if (changed && !writeStorage(CLUB_CREST_LIBRARY_KEY, JSON.stringify(library))) {
    throw new Error('Nie udało się zachować dotychczasowych herbów w bibliotece przeglądarki.')
  }
}

function getClubProfileData(game: GameState, teamId: string) {
  const currentTeam = game.teams.find((team) => team.id === teamId)
  const worldEntry = Object.entries(game.leagueWorld ?? {}).find(([, teams]) => teams.some((team) => team.id === teamId))
  const worldTeam = worldEntry?.[1].find((team) => team.id === teamId)
  const cupTeam = game.polishCup?.teams.find((team) => team.id === teamId)
    ?? game.regionalCups?.flatMap((cup) => cup.teams).find((team) => team.id === teamId)
  const team = currentTeam ?? worldTeam ?? cupTeam
  if (!team) return null
  const leagueId = currentTeam
    ? game.leagueId
    : (worldEntry?.[0] as LeagueId | undefined) ?? cupTeam?.leagueId ?? game.leagueId
  const leagueTeams = leagueId === game.leagueId
    ? game.teams
    : game.leagueWorld?.[leagueId] ?? []
  const rank = leagueTeams.length
    ? getLeagueTable({ ...game, leagueId, teams: leagueTeams }).findIndex((item) => item.id === teamId) + 1
    : 0
  const squad = teamId === game.teamId
    ? game.squad
    : (game.clubSquads[teamId] ?? []).map((offer) => offer.player)
  return {
    team,
    leagueId,
    leagueName: leagues.find((league) => league.id === leagueId)?.name ?? 'Liga',
    rank,
    squad,
    strength: teamId === game.teamId ? overallRating(game.squad) : team.strength,
  }
}

async function optimizeUserImage(file: File) {
  const supportedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!supportedTypes.includes(file.type)) {
    throw new Error('Wybierz obraz JPG, PNG lub WebP.')
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error('Obraz może mieć maksymalnie 8 MB.')
  }

  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Nie udało się przygotować obrazu. Spróbuj ponownie.')
    context.drawImage(bitmap, 0, 0, width, height)
    return canvas.toDataURL('image/webp', 0.82)
  } finally {
    bitmap.close()
  }
}

function ClubCrest({
  name,
  seedKey,
  color,
  imageSrc,
  large = false,
  small = false,
  className = '',
}: {
  name: string
  seedKey?: string
  color?: string
  imageSrc?: string
  large?: boolean
  small?: boolean
  className?: string
}) {
  const seed = crestHash((seedKey ?? name).toLocaleLowerCase('pl-PL'))
  const primary = color || `hsl(${seed % 360} 52% 43%)`
  const secondary = `hsl(${(seed + 137) % 360} 64% 69%)`
  const clipId = `crest-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const pattern = seed % 6
  const emblem = Math.floor(seed / 6) % 4
  const initials = name.split(/\s+/).map((word) => word[0]).join('').slice(0, 3).toUpperCase()
  return <div className={`club-crest ${large ? 'club-crest-large' : ''} ${small ? 'club-crest-small' : ''} ${className}`.trim()} style={{ '--club-color': primary } as CSSProperties} role="img" aria-label={`Fikcyjny herb ${name}`}>
    {imageSrc ? <img className="club-crest-uploaded" src={imageSrc} alt="" /> : <svg className="club-crest-art" viewBox="0 0 48 54" aria-hidden="true">
      <defs><clipPath id={clipId}><path d="M4 4 Q24 0 44 4 V25 Q42 41 24 51 Q6 41 4 25 Z" /></clipPath></defs>
      <path d="M4 4 Q24 0 44 4 V25 Q42 41 24 51 Q6 41 4 25 Z" fill={primary} />
      <g clipPath={`url(#${clipId})`}>
        <path d="M0 0 H48 V54 H0 Z" fill={primary} />
        {pattern === 0 && <g fill={secondary}><path d="M8 0 H14 V54 H8 Z" /><path d="M20 0 H26 V54 H20 Z" /><path d="M32 0 H38 V54 H32 Z" /></g>}
        {pattern === 1 && <g fill={secondary}><path d="M-8 5 L-1 0 L33 54 L26 59 Z" /><path d="M12 -5 L19 -10 L53 44 L46 49 Z" /><path d="M32 -15 L39 -20 L62 17 L55 22 Z" /></g>}
        {pattern === 2 && <g fill={secondary}><path d="M0 13 H48 V19 H0 Z" /><path d="M0 29 H48 V35 H0 Z" /><path d="M0 45 H48 V51 H0 Z" /></g>}
        {pattern === 3 && <path d="M0 0 H48 V14 L24 29 L0 14 Z" fill={secondary} />}
        {pattern === 4 && <><path d="M0 0 H24 V54 H0 Z" fill={secondary} /><path d="M20 0 H28 V54 H20 Z" fill="#f5edda" opacity=".82" /></>}
        {pattern === 5 && <g fill="none" stroke={secondary} strokeWidth="5"><path d="M-4 18 Q8 8 20 18 T44 18 T68 18" /><path d="M-4 34 Q8 24 20 34 T44 34 T68 34" /></g>}
        <path d="M24 12 L27 18 L34 19 L29 24 L30 31 L24 28 L18 31 L19 24 L14 19 L21 18 Z" fill="#f5edda" opacity=".92" />
        {emblem === 0 && <circle cx="24" cy="21" r="5" fill="none" stroke="#26362f" strokeWidth="1.5" />}
        {emblem === 1 && <path d="M18 24 L24 17 L30 24 L24 31 Z" fill="none" stroke="#26362f" strokeWidth="1.5" />}
        {emblem === 2 && <path d="M17 25 H31 M19 21 H29 M21 17 H27" fill="none" stroke="#26362f" strokeWidth="1.5" />}
        {emblem === 3 && <path d="M18 28 L24 17 L30 28 Z" fill="none" stroke="#26362f" strokeWidth="1.5" />}
        <path d="M5 34 H43 V48 H5 Z" fill="#17231f" opacity=".76" />
      </g>
      <path d="M4 4 Q24 0 44 4 V25 Q42 41 24 51 Q6 41 4 25 Z" fill="none" stroke="#f5edda" strokeWidth="1.5" />
      <path d="M7 7 Q24 3 41 7 V25 Q39 39 24 47 Q9 39 7 25 Z" fill="none" stroke="#17231f" strokeWidth=".8" opacity=".7" />
    </svg>}
    {!imageSrc && <span>{initials}</span>}
  </div>
}

function ClubCrestEditor({ game, teamId, onUpdate }: {
  game: GameState
  teamId: string
  onUpdate: (game: GameState, message?: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploadError, setUploadError] = useState('')
  const image = getClubCrestImage(game, teamId)

  async function updateCrest(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const next = structuredClone(game)
      const imageDataUrl = await optimizeUserImage(file)
      next.clubCrestsByTeamId ??= {}
      next.clubCrestsByTeamId[teamId] = imageDataUrl
      if (teamId === next.teamId) next.clubCrestDataUrl = imageDataUrl
      const team = getCareerTeams(next).find((entry) => entry.id === teamId)
      let libraryError = ''
      if (team) {
        try {
          const library = readClubCrestLibrary()
          library[getClubCrestIdentity(team)] = imageDataUrl
          if (!writeStorage(CLUB_CREST_LIBRARY_KEY, JSON.stringify(library))) {
            throw new Error('Brak miejsca w pamięci przeglądarki.')
          }
        } catch (error) {
          libraryError = `Herb zapisano w bieżącej karierze, ale nie udało się zachować go dla kolejnych: ${error instanceof Error ? error.message : 'błąd pamięci przeglądarki'}`
        }
      }
      setUploadError(libraryError)
      onUpdate(next, `Zapisano herb klubu ${getTeamName(next, teamId)} w bibliotece na tym urządzeniu.`)
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Nie udało się wczytać herbu.')
    } finally {
      event.target.value = ''
    }
  }

  function resetCrest() {
    const next = structuredClone(game)
    if (next.clubCrestsByTeamId) delete next.clubCrestsByTeamId[teamId]
    if (teamId === next.teamId) delete next.clubCrestDataUrl
    const team = getCareerTeams(next).find((entry) => entry.id === teamId)
    let libraryError = ''
    if (team) {
      try {
        const library = readClubCrestLibrary()
        delete library[getClubCrestIdentity(team)]
        if (!writeStorage(CLUB_CREST_LIBRARY_KEY, JSON.stringify(library))) {
          throw new Error('Nie udało się zapisać biblioteki herbów.')
        }
      } catch (error) {
        libraryError = `Przywrócono herb w bieżącej karierze, ale nie udało się usunąć go z biblioteki: ${error instanceof Error ? error.message : 'błąd pamięci przeglądarki'}`
      }
    }
    setUploadError(libraryError)
    onUpdate(next, `Przywrócono fikcyjny herb klubu ${getTeamName(next, teamId)}.`)
  }

  return <div className="club-crest-editor">
    <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={updateCrest} />
    <button type="button" className="club-crest-edit-button" onClick={() => inputRef.current?.click()}><ImagePlus size={12} /> {image ? 'Zmień herb' : 'Dodaj własny herb'}</button>
    {image && <button type="button" className="club-crest-reset-button" onClick={resetCrest}>Przywróć fikcyjny</button>}
    {uploadError && <small className="image-upload-error" role="alert">{uploadError}</small>}
  </div>
}

function ClubProfileModal({ game, teamId, onUpdate, onClose }: {
  game: GameState
  teamId: string
  onUpdate: (game: GameState, message?: string) => void
  onClose: () => void
}) {
  const [editedClubName, setEditedClubName] = useState(game.clubName)
  const [clubNameError, setClubNameError] = useState('')
  const [trophyCabinetExpanded, setTrophyCabinetExpanded] = useState(false)
  const [trophyFilter, setTrophyFilter] = useState<'all' | 'league' | 'cups'>('all')
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])
  const profile = getClubProfileData(game, teamId)
  if (!profile) return null
  const { team, leagueName, rank, squad, strength } = profile
  const crestImage = getClubCrestImage(game, teamId)
  const isOwnClub = teamId === game.teamId
  const trophies = game.trophyCabinet ?? []
  const filteredTrophies = trophies.filter((trophy) =>
    trophyFilter === 'all'
    || (trophyFilter === 'league' ? trophy.competition === 'league' : trophy.competition !== 'league'),
  )
  const visibleTrophies = trophyCabinetExpanded ? filteredTrophies : filteredTrophies.slice(0, 6)
  const trophiesBySeason = visibleTrophies.reduce((groups, trophy) => {
    const seasonTrophies = groups.get(trophy.season) ?? []
    seasonTrophies.push(trophy)
    groups.set(trophy.season, seasonTrophies)
    return groups
  }, new Map<string, typeof visibleTrophies>())
  const crestClass = crestImage ? 'club-crest-profile-preview club-crest-profile-image' : 'club-crest-profile-preview'
  const teamCity = isOwnClub ? game.city : getClubCity(team.name)
  function saveClubName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = renameOwnClub(game, editedClubName)
    if (result.error) {
      setClubNameError(result.error)
      return
    }
    setClubNameError('')
    onUpdate(result.game, `Zmieniono nazwę klubu na ${editedClubName.trim()}.`)
  }

  return <div className="player-profile-overlay club-profile-overlay" onClick={onClose}>
    <section className="club-profile-modal" role="dialog" aria-modal="true" aria-labelledby="club-profile-title" onClick={(event) => event.stopPropagation()}>
      <header className="club-profile-header">
        <ClubCrest name={team.name} seedKey={team.id} color={isOwnClub ? game.clubColor : undefined} imageSrc={crestImage} className={crestClass} />
        <div>
          <p className="eyebrow">PROFIL KLUBU · {game.season}</p>
          <h2 id="club-profile-title">{team.name}</h2>
          <span><MapPin size={13} /> {teamCity} · {leagueName}</span>
        </div>
        <button className="icon-button player-profile-close" aria-label="Zamknij profil klubu" onClick={onClose}><X size={18} /></button>
      </header>
      <div className="club-profile-summary">
        <span><small>ROZGRYWKI</small><strong>{leagueName}</strong></span>
        <span><small>POZYCJA</small><strong>{rank > 0 ? `${rank}. miejsce` : '—'}</strong></span>
        <span><small>SIŁA KADRY</small><strong>{strength}/100</strong></span>
        <span><small>ZAWODNICY</small><strong>{squad.length || '—'}</strong></span>
      </div>
      {isOwnClub && <section className="club-profile-trophies">
        <div className="panel-heading">
          <div><p className="eyebrow">GABLOTA KLUBU</p><h3>Zdobyte trofea</h3></div>
          <span className="roster-count">{trophies.length}</span>
        </div>
        {trophies.length > 0
          ? <>
            <div className="club-profile-trophy-filters" role="group" aria-label="Filtruj trofea">
              {([
                ['all', 'Wszystkie', trophies.length],
                ['league', 'Liga', trophies.filter((trophy) => trophy.competition === 'league').length],
                ['cups', 'Puchary', trophies.filter((trophy) => trophy.competition !== 'league').length],
              ] as const).map(([filter, label, count]) => <button
                type="button"
                key={filter}
                className={trophyFilter === filter ? 'club-profile-trophy-filter is-active' : 'club-profile-trophy-filter'}
                aria-pressed={trophyFilter === filter}
                onClick={() => setTrophyFilter(filter)}
              >{label} <span>{count}</span></button>)}
            </div>
            {visibleTrophies.length > 0
              ? <div id="club-trophy-list" className="club-profile-trophy-seasons">{[...trophiesBySeason].map(([season, seasonTrophies]) => <section className="club-profile-trophy-season" key={season}>
                <h4>{season}</h4>
                <div className="club-profile-trophy-list">{seasonTrophies.map((trophy) => <span key={trophy.id}><Trophy size={13} /><strong>{trophy.competition === 'league' && trophy.leagueId
                  ? getLeagueChampionTrophyName(trophy.leagueId)
                  : trophy.competition === 'regional-cup' && trophy.regionId
                    ? `Puchar Regionalny · ${regionalOptions.find((region) => region.id === trophy.regionId)?.name.split('·').at(-1)?.trim() ?? trophy.regionId}`
                    : trophy.competition === 'league' && /superklas/i.test(trophy.name)
                      ? 'Mistrz Polski'
                      : trophy.name}</strong></span>)}</div>
              </section>)}</div>
              : <p className="club-profile-trophy-empty">Brak trofeów w tej kategorii.</p>}
            {filteredTrophies.length > 6 && <button
              type="button"
              className="text-button club-profile-trophy-toggle"
              aria-expanded={trophyCabinetExpanded}
              aria-controls="club-trophy-list"
              onClick={() => setTrophyCabinetExpanded((expanded) => !expanded)}
            >{trophyCabinetExpanded ? 'Pokaż mniej' : `Pokaż wszystkie (${filteredTrophies.length})`}</button>}
          </>
          : <p className="club-profile-trophy-empty">Trofea pojawią się po zdobyciu mistrzostwa lub pucharu.</p>}
      </section>}
      <section className="club-profile-crest-section">
        <div>
          <p className="eyebrow">TOŻSAMOŚĆ KLUBU</p>
          <h3>Herb drużyny</h3>
          <p>Dodaj własny plik graficzny. Zachowujemy jego proporcje i przezroczystość, a herb wyświetlamy bez dodatkowej ramki.</p>
        </div>
        <ClubCrestEditor game={game} teamId={teamId} onUpdate={onUpdate} />
      </section>
      {isOwnClub && <section className="club-profile-crest-section">
        <div>
          <p className="eyebrow">TOŻSAMOŚĆ KLUBU</p>
          <h3>Nazwa drużyny</h3>
          <p>Zapamiętamy ją na tym urządzeniu i użyjemy również w kolejnych karierach.</p>
        </div>
        <form className="club-name-editor" onSubmit={saveClubName}>
          <input
            aria-label="Nazwa klubu"
            value={editedClubName}
            onChange={(event) => {
              setEditedClubName(event.target.value)
              setClubNameError('')
            }}
            maxLength={36}
          />
          <button type="submit" className="club-crest-edit-button">Zapisz nazwę</button>
          {clubNameError && <small className="image-upload-error" role="alert">{clubNameError}</small>}
        </form>
      </section>}
      <p className="club-profile-storage-note">Herb jest zapisywany lokalnie na tym urządzeniu i będzie dostępny również w kolejnych karierach. Nie jest wysyłany na serwer. Obsługiwane formaty: JPG, PNG i WebP, maksymalnie 8 MB.</p>
    </section>
  </div>
}

function Stars({ skill, compact = false }: { skill: number; compact?: boolean }) {
  const count = starsFor(skill)
  return <span className="player-stars" aria-label={`${count} na 5 gwiazdek`}>
    {Array.from({ length: 5 }, (_, index) => <Star key={index} size={compact ? 8 : 12} fill={index < count ? 'currentColor' : 'none'} />)}
  </span>
}

function PlayerMatchRating({ player, compact = false }: { player: Player; compact?: boolean }) {
  return <span className={compact ? 'player-match-rating player-match-rating-compact' : 'player-match-rating'}>
    <Stars skill={player.skill} compact={compact} />
    <span>OG <strong>{player.skill}</strong></span>
  </span>
}

function PlayerName({ player }: { player: Player }) {
  return <>
    {player.shirtNumber !== undefined && <><span className="player-shirt-number">{player.shirtNumber}.</span>{' '}</>}
    {player.firstName} {player.lastName}
  </>
}

function BenchPlayerInfo({ player }: { player: Player }) {
  const stamina = Math.max(0, Math.min(100, player.stamina))
  const staminaLevel = stamina <= 40 ? 'low' : stamina <= 70 ? 'medium' : 'high'
  return <span className="bench-player-info">
    <span className="bench-player-topline">
      <strong><PlayerName player={player} /></strong>
      <span className="bench-player-rating"><span>OG <b>{player.skill}</b></span><Stars skill={player.skill} compact /></span>
    </span>
    <span className="bench-player-stamina" role="img" aria-label={`Kondycja ${stamina}%`}>
      <span className={`bench-player-stamina-fill bench-player-stamina-${staminaLevel}`} style={{ width: `${stamina}%` }} />
      <small>{stamina}%</small>
    </span>
  </span>
}

function PitchPlayerStamina({ player }: { player: Player }) {
  const stamina = Math.max(0, Math.min(100, player.stamina))
  const staminaLevel = stamina <= 40 ? 'low' : stamina <= 70 ? 'medium' : 'high'
  return <span className="pitch-player-stamina" role="img" aria-label={`Kondycja ${stamina}%`} title={`Kondycja ${stamina}%`}>
    <span className="pitch-player-stamina-track">
      <span className={`pitch-player-stamina-fill bench-player-stamina-${staminaLevel}`} style={{ width: `${stamina}%` }} />
    </span>
    <small>{stamina}%</small>
  </span>
}

function PositionBadge({ position }: { position: Position }) {
  return <span className={`position-badge position-${position}`} aria-label={positionLabels[position]} title={positionLabels[position]}>
    {positionAbbreviations[position]}
  </span>
}

const portraitSkinTones = ['#f1c9a5', '#dca77d', '#bd805d', '#8f5c43', '#e7b990', '#a96f50']
const portraitHairColors = ['#302721', '#48362c', '#191b1d', '#76563d', '#b69a62', '#4d4d4d']
const portraitShirtColors = ['#cf534b', '#3973a3', '#427b60', '#78528c', '#c48139', '#354d67']

function PlayerPortrait({ player, className = '' }: { player: Player; className?: string }) {
  const seed = crestHash(player.id)
  const skin = portraitSkinTones[seed % portraitSkinTones.length]
  const hair = portraitHairColors[Math.floor(seed / 7) % portraitHairColors.length]
  const shirt = portraitShirtColors[Math.floor(seed / 13) % portraitShirtColors.length]
  const portraitId = `portrait-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const hairStyle = Math.floor(seed / 19) % 4
  const facialHair = Math.floor(seed / 31) % 4
  const faceShape = Math.floor(seed / 43) % 3
  const facePath = faceShape === 0
    ? 'M13 18 Q13 8 24 8 Q35 8 35 18 L34 31 Q32 40 24 42 Q16 40 14 31 Z'
    : faceShape === 1
      ? 'M13 18 Q14 8 24 8 Q34 8 35 18 L33 31 Q30 40 24 42 Q17 40 14 31 Z'
      : 'M13 19 Q13 8 24 8 Q35 8 35 19 L33 30 Q31 39 24 42 Q17 39 15 30 Z'
  return <span className={`player-avatar ${className}`.trim()} role="img" aria-label={`Portret fikcyjnego zawodnika ${player.firstName} ${player.lastName}`}>
    {player.portraitDataUrl ? <img className="player-avatar-uploaded" src={player.portraitDataUrl} alt="" /> : <svg viewBox="0 0 48 56" aria-hidden="true">
      <defs>
        <clipPath id={portraitId}><rect width="48" height="56" rx="8" /></clipPath>
        <linearGradient id={`${portraitId}-bg`} x1="0" x2="1" y1="0" y2="1"><stop stopColor="#45544a" /><stop offset="1" stopColor="#1c2825" /></linearGradient>
        <linearGradient id={`${portraitId}-skin`} x1="0" x2="0.85" y1="0" y2="1"><stop stopColor={skin} /><stop offset="1" stopColor={skin} stopOpacity=".82" /></linearGradient>
      </defs>
      <g clipPath={`url(#${portraitId})`}>
        <rect width="48" height="56" fill={`url(#${portraitId}-bg)`} />
        <circle cx="39" cy="11" r="13" fill="#ffffff" opacity=".06" />
        <path d="M3 58 Q4 40 15 38 L24 36 L34 38 Q45 42 46 58 Z" fill={shirt} />
        <path d="M18 36 L24 43 L30 36 L34 39 L30 56 H18 L14 39 Z" fill="#f0e8d3" opacity=".88" />
        <path d={facePath} fill={`url(#${portraitId}-skin)`} />
        <path d="M13 22 Q10 17 13 13 Q14 6 23 6 Q32 5 36 12 Q39 17 35 23 L33 17 Q30 13 26 13 Q20 16 14 15 Z" fill={hair} />
        {hairStyle === 1 && <g fill={hair}><circle cx="15" cy="12" r="4" /><circle cx="20" cy="8" r="4" /><circle cx="27" cy="8" r="4" /><circle cx="33" cy="12" r="4" /></g>}
        {hairStyle === 2 && <path d="M13 17 Q10 7 18 6 Q29 1 36 10 L35 17 Q31 11 26 11 Q20 15 14 14 Z" fill={hair} />}
        {hairStyle === 3 && <path d="M12 16 Q12 6 24 5 Q36 6 36 16 L33 16 Q31 11 24 12 Q17 11 14 17 Z" fill={hair} />}
        <path d="M15 22 Q18 20 21 22 M27 22 Q30 20 33 22" fill="none" stroke="#49352d" strokeWidth="1.2" strokeLinecap="round" />
        <ellipse cx="19" cy="24" rx="1.1" ry="1.35" fill="#26312e" />
        <ellipse cx="29" cy="24" rx="1.1" ry="1.35" fill="#26312e" />
        <path d="M24 24 L22 30 Q24 31 26 30" fill="none" stroke="#9b684d" strokeWidth="1" strokeLinecap="round" />
        <path d="M21 34 Q24 35.5 27 34" fill="none" stroke="#8d4f49" strokeWidth="1.1" strokeLinecap="round" />
        {facialHair === 1 && <path d="M17 32 Q20 34 24 32 Q28 34 31 32 L30 36 Q24 40 18 36 Z" fill={hair} opacity=".85" />}
        {facialHair === 2 && <path d="M20 35 Q24 37 28 35 L27 39 Q24 41 21 39 Z" fill={hair} opacity=".82" />}
        {facialHair === 3 && <><path d="M16 29 Q17 35 20 36 L20 32 Z M32 29 Q31 35 28 36 L28 32 Z" fill={hair} opacity=".8" /><path d="M21 35 Q24 37 27 35 L26 38 Q24 39 22 38 Z" fill={hair} opacity=".8" /></>}
        <path d="M16 39 L24 46 L32 39" fill="none" stroke="#f0e8d3" strokeWidth=".7" opacity=".45" />
        <path d="M2 53 H46" stroke="#ffffff" opacity=".12" />
      </g>
    </svg>}
  </span>
}

function PlayerPositionBadges({ player }: { player: Player }) {
  return <span className="player-position-badges">
    <PositionBadge position={player.position} />
    {player.secondaryPositions?.map((position) => <PositionBadge key={position} position={position} />)}
  </span>
}

function PlayerProfileModal({ player, clubName, isOwnPlayer, game, onUpdate, onClose }: {
  player: Player
  clubName: string
  isOwnPlayer: boolean
  game: GameState
  onUpdate: (game: GameState, message?: string) => void
  onClose: () => void
}) {
  const portraitInputRef = useRef<HTMLInputElement>(null)
  const [portraitUploadError, setPortraitUploadError] = useState('')
  const activePlayerListing = game.outgoingPlayerTransferListings?.find((listing) =>
    listing.playerId === player.id && listing.status === 'active',
  )
  const [transferAskingAmount, setTransferAskingAmount] = useState(String(
    activePlayerListing?.askingAmount ?? Math.max(50_000, Math.round(player.value / 1000) * 1000),
  ))
  const [transferTargetClubIds, setTransferTargetClubIds] = useState<string[]>([])
  const transferWindow = getTransferWindowInfo(game)
  const availableTransferTargets = game.teams
    .filter((team) => team.id !== game.teamId
      && (game.clubSquads[team.id]?.length ?? 0) > 0
      && !activePlayerListing?.clubIds.includes(team.id))
    .sort((first, second) => second.strength - first.strength)
  const activeListingClubs = (activePlayerListing?.clubIds ?? []).map((clubId) => {
    const team = game.teams.find((item) => item.id === clubId)
    const offer = (activePlayerListing?.offerIds ?? [])
      .map((offerId) => game.incomingTransferOffers?.find((item) => item.id === offerId))
      .find((item) => item?.clubId === clubId)
    const message = game.inboxMessages?.find((item) =>
      item.relatedOutgoingListingId === activePlayerListing?.id
      && item.sender === team?.name
      && (!offer || item.relatedTransferOfferId === offer.id),
    )
    const status = offer
      ? offer.status === 'pending' ? 'Oczekuje na decyzję'
        : offer.status === 'countered' ? 'Kontroferta wysłana'
          : offer.status === 'player-negotiation' ? 'Negocjacje kontraktu'
            : offer.status === 'accepted' ? 'Transfer sfinalizowany'
              : message?.body.toLocaleLowerCase('pl-PL').includes('wygas') ? 'Oferta wygasła'
                : message?.body.toLocaleLowerCase('pl-PL').includes('nie chce odejść') ? 'Zawodnik odmówił transferu'
                  : 'Negocjacje zakończone'
      : message?.status === 'rejected' ? 'Klub odmówił'
        : message?.status === 'info' ? 'Negocjacje już aktywne'
          : 'Oczekiwanie na odpowiedź'
    return { clubId, clubName: team?.name ?? 'Nieznany klub', offer, status }
  })
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  const discipline = Object.values(player.discipline ?? {})
  const yellowCards = discipline.reduce((total, item) => total + (item.yellowCardsTotal ?? 0), 0)
  const redCards = discipline.reduce((total, item) => total + (item.redCards ?? 0), 0)
  const suspensions = discipline.reduce((total, item) => total + (item.suspendedMatches ?? 0), 0)
  const history = player.history ?? []
  const strongestTeammateLink = isOwnPlayer
    ? game.squad
      .filter((teammate) => teammate.id !== player.id)
      .map((teammate) => ({
        teammate,
        chemistry: game.teamChemistry?.[[player.id, teammate.id].sort().join('::')] ?? 50,
      }))
      .sort((first, second) => second.chemistry - first.chemistry)[0]
    : undefined

  function updateSavedPortrait(next: GameState, portraitDataUrl?: string) {
    let updated = false
    const updatePlayer = (candidate: Player) => {
      if (candidate.id !== player.id) return
      if (portraitDataUrl) candidate.portraitDataUrl = portraitDataUrl
      else delete candidate.portraitDataUrl
      updated = true
    }
    next.squad.forEach(updatePlayer)
    next.market.forEach(updatePlayer)
    Object.values(next.clubSquads).forEach((offers) => offers.forEach(({ player: candidate }) => updatePlayer(candidate)))
    next.academyPlayers?.forEach(updatePlayer)
    if (next.academyProspect) updatePlayer(next.academyProspect)
    next.scouts.forEach((scout) => {
      if (scout.prospect) updatePlayer(scout.prospect)
    })
    return updated
  }

  async function updatePortrait(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const portraitDataUrl = await optimizeUserImage(file)
      const next = structuredClone(game)
      if (!updateSavedPortrait(next, portraitDataUrl)) throw new Error('Nie znaleziono zawodnika w bieżącym zapisie kariery.')
      setPortraitUploadError('')
      onUpdate(next, `Zapisano zdjęcie zawodnika ${player.firstName} ${player.lastName}.`)
    } catch (error) {
      setPortraitUploadError(error instanceof Error ? error.message : 'Nie udało się wczytać zdjęcia.')
    } finally {
      event.target.value = ''
    }
  }

  function resetPortrait() {
    const next = structuredClone(game)
    if (!updateSavedPortrait(next)) return
    setPortraitUploadError('')
    onUpdate(next, 'Przywrócono wygenerowany portret zawodnika.')
  }

  function toggleTransferTarget(clubId: string) {
    setTransferTargetClubIds((current) => current.includes(clubId)
      ? current.filter((id) => id !== clubId)
      : current.length >= 3 ? current : [...current, clubId])
  }

  function offerPlayerForTransfer() {
    const result = offerPlayerToClubs(game, player.id, Number(transferAskingAmount), transferTargetClubIds)
    if (result.error) {
      onUpdate(game, result.error)
      return
    }
    setTransferTargetClubIds([])
    onUpdate(result.game, result.message)
  }

  function withdrawPlayerListing() {
    if (!activePlayerListing) return
    const result = withdrawOutgoingPlayerTransferListing(game, activePlayerListing.id)
    if (result.error) {
      onUpdate(game, result.error)
      return
    }
    onUpdate(result.game, `${player.firstName} ${player.lastName} został wycofany z listy transferowej. Jego morale wzrosło.`)
  }

  return <div className="player-profile-overlay" onClick={onClose}>
    <section className="player-profile-modal" role="dialog" aria-modal="true" aria-labelledby="player-profile-title" onClick={(event) => event.stopPropagation()}>
      <header className="player-profile-header">
        <PlayerPortrait player={player} className="player-profile-portrait" />
        <div className="player-profile-heading">
          <p className="eyebrow">PROFIL ZAWODNIKA · {clubName}</p>
          <h2 id="player-profile-title"><PlayerName player={player} /></h2>
          <span>{player.age} lat · {positionLabels[player.position]}{player.secondaryPositions?.length ? ` · także ${player.secondaryPositions.map((position) => positionLabels[position]).join(', ')}` : ''}</span>
        </div>
        <button className="icon-button player-profile-close" aria-label="Zamknij profil zawodnika" onClick={onClose}><X size={18} /></button>
      </header>
      <div className="player-image-controls">
        <input ref={portraitInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={updatePortrait} />
        <button type="button" className="secondary-button" onClick={() => portraitInputRef.current?.click()}><ImagePlus size={14} /> Zmień zdjęcie</button>
        {player.portraitDataUrl && <button type="button" className="secondary-button" onClick={resetPortrait}>Przywróć portret</button>}
        <small>{isOwnPlayer ? 'JPG, PNG lub WebP · maks. 8 MB. Zdjęcie zostanie zmniejszone i zapisane lokalnie w tej karierze.' : 'JPG, PNG lub WebP · maks. 8 MB. Zdjęcie zapisze się w tej karierze.'}</small>
        {portraitUploadError && <small className="image-upload-error" role="alert">{portraitUploadError}</small>}
      </div>
      <div className="player-profile-rating">
        <div><small>OVERALL</small><strong>{player.skill}</strong><Stars skill={player.skill} /></div>
        <div><small>POTENCJAŁ</small><strong>{player.potential}</strong></div>
        <div><small>WARTOŚĆ</small><strong>{valueLabel(player.value)}</strong></div>
      </div>
      <div className="player-profile-sections">
        <section className="player-profile-section">
          <h3>Kontrakt</h3>
          <div className="player-profile-facts">
            <span>Pensja <strong>{formatMoney(player.wage)} / kolejkę</strong></span>
            <span>Do końca umowy <strong>{player.contractSeasonsRemaining ?? 2} sez.</strong></span>
            <span>Klauzula przy degradacji <strong>{player.relegationReleaseClause ? 'Tak' : 'Nie'}</strong></span>
          </div>
        </section>
        <section className="player-profile-section">
          <h3>Osobowość, forma i zdrowie</h3>
          <div className="player-profile-facts">
            <span>Osobowość <strong>{player.personality ? playerPersonalityLabels[player.personality] : 'Nieznana'}</strong></span>
            {strongestTeammateLink && <span>Najlepsza relacja <strong>{strongestTeammateLink.teammate.firstName} {strongestTeammateLink.teammate.lastName} · {strongestTeammateLink.chemistry}%</strong></span>}
            <span>Morale <strong>{player.morale}%</strong></span>
            <span>Kondycja <strong>{player.stamina}%</strong></span>
            <span>Status <strong>{(player.injury?.matchesRemaining ?? 0) > 0 ? `Kontuzja · ${player.injury?.description}, ${getInjuryDurationLabel(player.injury?.matchesRemaining ?? 0)}` : 'Gotowy do gry'}</strong></span>
          </div>
        </section>
        <section className="player-profile-section">
          <h3>Statystyki</h3>
          <p className="player-profile-subheading">Bieżący sezon</p>
          <div className="player-profile-stat-grid">
            <span><strong>{player.seasonAppearances ?? 0}</strong><small>Występy</small></span>
            <span><strong>{(player.seasonGoals ?? 0) + (player.cupGoals ?? 0)}</strong><small>Gole liga + puchar</small></span>
            <span><strong>{player.seasonAssists ?? 0}</strong><small>Asysty</small></span>
            <span><strong>{player.seasonCleanSheets ?? 0}</strong><small>Czyste konta</small></span>
            <span><strong>{player.seasonRatedAppearances ? ((player.seasonRatingTotal ?? 0) / player.seasonRatedAppearances).toFixed(1) : '—'}</strong><small>Śr. ocena</small></span>
          </div>
          <p className="player-profile-subheading">Kariera i dyscyplina</p>
          <div className="player-profile-facts">
            <span>Występy <strong>{player.careerAppearances ?? 0}</strong></span>
            <span>Profil · gole łącznie (liga + puchar) <strong>{player.careerLeagueAndCupGoals ?? player.careerGoals ?? 0}</strong></span>
            <span>Polski Puchar <strong>{player.cupAppearances ?? 0} wyst. · {player.cupGoals ?? 0} goli</strong></span>
            <span>Kartki <strong>🟨 {yellowCards} · 🟥 {redCards}{suspensions ? ` · Pauza ${suspensions}` : ''}</strong></span>
          </div>
        </section>
        <section className="player-profile-section">
          <h3>Historia klubów i rozwoju</h3>
          {history.length > 0
            ? <ol className="player-profile-history">{history.map((event, index) => <li key={`${event.season}-${event.type}-${index}`}>
              <span className={`player-profile-history-${event.type}`}>{event.type === 'overall' ? 'OG' : event.type === 'position' ? 'POZ' : event.type === 'award' ? 'NAGRODA' : 'KLUB'}</span>
              <div><small>{event.season}</small><strong>{event.title}</strong><p>{event.details}</p></div>
            </li>)}</ol>
            : <p className="player-profile-history-empty">Starszy zapis nie zawiera historii tego zawodnika. Historia transferów i zmian umiejętności będzie rejestrowana od teraz.</p>}
        </section>
        {isOwnPlayer && <section className="player-profile-section player-profile-transfer-section">
          <h3>Wystaw zawodnika na transfer</h3>
          {activePlayerListing
            ? <>
              <div className="player-profile-facts">
                <span>Oferta aktywna <strong>Cena {formatMoney(activePlayerListing.askingAmount)}</strong></span>
                <span>Kluby <strong>{activePlayerListing.clubIds.length}</strong></span>
                <button type="button" className="secondary-button player-transfer-withdraw" onClick={withdrawPlayerListing}>Wycofaj zawodnika z rynku <X size={14} /></button>
              </div>
              <div className="player-transfer-club-statuses">
                {activeListingClubs.map(({ clubId, clubName: targetName, offer, status }) => <div className="player-transfer-club-status" key={clubId}>
                  <span>{targetName}<strong>{status}</strong></span>
                  {offer && <small>
                    Oferta {formatMoney(offer.offeredAmount)}
                    {offer.counterAmount ? ` · kontroferta ${formatMoney(offer.counterAmount)}` : ''}
                    {offer.expiresAfterRound && ['pending', 'countered', 'player-negotiation'].includes(offer.status)
                      ? ` · termin: kolejka ${offer.expiresAfterRound}`
                      : ''}
                  </small>}
                </div>)}
              </div>
              {!transferWindow.isOpen
                ? <p className="player-profile-history-empty">Wystawienie i odpowiedzi pozostają widoczne, ale zmianę ceny lub dodanie klubów można wykonać tylko podczas okna transferowego.</p>
                : <>
                  <p className="player-profile-history-empty">Możesz zmienić cenę i zaoferować zawodnika maksymalnie 3 nowym klubom naraz. Zmiana ceny nie modyfikuje ofert już otrzymanych.</p>
                  <label className="player-transfer-asking-price">
                    Cena wywoławcza
                    <input
                      type="number"
                      min="50000"
                      step="1000"
                      value={transferAskingAmount}
                      onChange={(event) => setTransferAskingAmount(event.target.value)}
                    />
                  </label>
                  {availableTransferTargets.length > 0 && <div className="player-transfer-target-list">
                    {availableTransferTargets.slice(0, 12).map((team) => {
                      const selected = transferTargetClubIds.includes(team.id)
                      return <label className="player-transfer-target" key={team.id}>
                        <input type="checkbox" checked={selected} onChange={() => toggleTransferTarget(team.id)} disabled={!selected && transferTargetClubIds.length >= 3} />
                        <span>{team.name}</span>
                        <small>Siła {team.strength}</small>
                      </label>
                    })}
                  </div>}
                  <button
                    type="button"
                    className="primary-button"
                    disabled={!transferWindow.isOpen || (transferTargetClubIds.length === 0 && !activePlayerListing)}
                    onClick={offerPlayerForTransfer}
                  >
                    {transferTargetClubIds.length > 0
                      ? `Zapisz cenę i wyślij do ${transferTargetClubIds.length} klubów`
                      : 'Zapisz nową cenę'}
                    <ArrowRight size={14} />
                  </button>
                </>}
            </>
            : !transferWindow.isOpen
              ? <p className="player-profile-history-empty">Oferty transferowe można składać tylko podczas okna letniego lub zimowego.</p>
              : <>
                <p className="player-profile-history-empty">Wybierz maksymalnie 3 kluby. Ich odpowiedzi i kontroferty pojawią się w skrzynce e-mail.</p>
                <label className="player-transfer-asking-price">
                  Cena wywoławcza
                  <input
                    type="number"
                    min="50000"
                    step="1000"
                    value={transferAskingAmount}
                    onChange={(event) => setTransferAskingAmount(event.target.value)}
                  />
                </label>
                <div className="player-transfer-target-list">
                  {availableTransferTargets.slice(0, 12).map((team) => {
                    const selected = transferTargetClubIds.includes(team.id)
                    return <label className="player-transfer-target" key={team.id}>
                      <input type="checkbox" checked={selected} onChange={() => toggleTransferTarget(team.id)} disabled={!selected && transferTargetClubIds.length >= 3} />
                      <span>{team.name}</span>
                      <small>Siła {team.strength}</small>
                    </label>
                  })}
                </div>
                <button type="button" className="primary-button" disabled={!transferWindow.isOpen || transferTargetClubIds.length === 0} onClick={offerPlayerForTransfer}>
                  Wyślij ofertę do {transferTargetClubIds.length} klubów <ArrowRight size={14} />
                </button>
              </>}
        </section>}
        {isOwnPlayer && <>
          <PlayerProfileTrainingPlan player={player} game={game} onUpdate={onUpdate} />
          <PlayerProfilePositionTraining player={player} game={game} onUpdate={onUpdate} />
        </>}
      </div>
    </section>
  </div>
}

function PlayerProfileTrainingPlan({ player, game, onUpdate }: {
  player: Player
  game: GameState
  onUpdate: (game: GameState, message?: string) => void
}) {
  const savedPlayer = game.squad.find((candidate) => candidate.id === player.id) ?? player
  const availablePlans: Array<{ id: PlayerTrainingPlan; label: string; description: string }> = [
    { id: 'fitness', label: 'Kondycja', description: '+6 kondycji przy każdej sesji treningu kondycyjnego.' },
    { id: 'finishing', label: 'Wykańczanie akcji', description: 'Po 3 treningach ofensywnych +1 umiejętności dla napastników i ofensywnych pomocników.' },
    { id: 'playmaking', label: 'Rozgrywanie', description: 'Po 3 treningach taktycznych +1 umiejętności dla pomocników.' },
    { id: 'leadership', label: 'Przywództwo', description: '+3 morale przy każdym treningu taktycznym.' },
  ]
  const allowedPlans = availablePlans.filter((plan) =>
    plan.id !== 'finishing' || ['ŚN', 'LN', 'PN', 'OP'].includes(savedPlayer.position),
  ).filter((plan) =>
    plan.id !== 'playmaking' || ['DP', 'ŚP', 'OP', 'PP', 'LP'].includes(savedPlayer.position),
  )

  function choosePlan(value: string) {
    const plan = allowedPlans.find((candidate) => candidate.id === value)?.id
    const result = setPlayerTrainingPlan(game, savedPlayer.id, plan)
    if (result.error) return onUpdate(game, result.error)
    onUpdate(result.game, plan
      ? `Ustawiono indywidualny plan „${allowedPlans.find((candidate) => candidate.id === plan)?.label}” dla ${savedPlayer.firstName} ${savedPlayer.lastName}.`
      : `Zakończono indywidualny plan ${savedPlayer.firstName} ${savedPlayer.lastName}.`)
  }

  const plan = allowedPlans.find((candidate) => candidate.id === savedPlayer.trainingPlan)
  return <section className="player-profile-section player-profile-training-plan">
    <h3>Indywidualny plan treningowy</h3>
    <p className="player-profile-history-empty">Plan rozwija zawodnika podczas zwykłych sesji drużynowych. Trening jest opłacany jak dotychczas: 25 000 zł za sesję.</p>
    <label className="player-profile-position-select">Plan rozwoju
      <select aria-label={`Plan treningowy dla ${savedPlayer.firstName} ${savedPlayer.lastName}`} value={savedPlayer.trainingPlan ?? ''} onChange={(event) => choosePlan(event.target.value)}>
        <option value="">Bez indywidualnego planu</option>
        {allowedPlans.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
    </label>
    {plan && <>
      <p className="player-profile-training-description">{plan.description}</p>
      {['finishing', 'playmaking'].includes(plan.id) && <div className="player-profile-training-progress">
        <span>Postęp <strong>{savedPlayer.trainingPlanSessions ?? 0} / 3</strong></span>
        <span>sesje zgodne z planem</span>
      </div>}
    </>}
  </section>
}

function PlayerProfilePositionTraining({ player, game, onUpdate }: {
  player: Player
  game: GameState
  onUpdate: (game: GameState, message?: string) => void
}) {
  const availablePositions = player.position === 'BR'
    ? []
    : (Object.keys(positionLabels) as Position[]).filter((position) =>
      position !== 'BR'
      && position !== player.position
      && !player.secondaryPositions?.includes(position),
    )
  const initialPosition = player.positionTraining?.targetPosition
  const [targetPosition, setTargetPosition] = useState<Position>(
    initialPosition && availablePositions.includes(initialPosition) ? initialPosition : availablePositions[0] ?? player.position,
  )
  const effectiveTarget = availablePositions.includes(targetPosition) ? targetPosition : availablePositions[0]
  const sessionsRequired = effectiveTarget ? positionTrainingSessionsRequired(player, effectiveTarget) : null
  const activeTraining = player.positionTraining?.targetPosition === effectiveTarget ? player.positionTraining : null
  const trainingWouldReset = Boolean(player.positionTraining && player.positionTraining.targetPosition !== effectiveTarget)

  function trainPosition() {
    if (!effectiveTarget) return
    const result = trainPlayerForPosition(game, player.id, effectiveTarget)
    if (result.error) return onUpdate(game, result.error)
    const message = result.completedPosition
      ? `${player.firstName} ${player.lastName} ukończył trening i może teraz grać jako ${positionLabels[result.completedPosition]}.`
      : `Postęp treningu ${player.firstName} ${player.lastName}: ${result.sessionsCompleted} / ${result.sessionsRequired} sesji na pozycji ${positionLabels[effectiveTarget]}.`
    onUpdate(result.game, message)
  }

  return <section className="player-profile-section player-profile-training">
    <h3>Rozwój pozycyjny</h3>
    {player.position === 'BR'
      ? <p className="player-profile-history-empty">Bramkarz nie może zmienić swojej pozycji ani trenować dodatkowej pozycji w polu.</p>
      : availablePositions.length === 0
        ? <p className="player-profile-history-empty">Zawodnik ma już dwie dodatkowe pozycje — to maksymalny limit.</p>
        : <>
          <p className="player-profile-history-empty">Odblokuj drugą pozycję treningiem indywidualnym. W obrębie tej samej formacji potrzeba 3 sesji, a przy zmianie formacji 5. Sesja kosztuje 25 000 zł i obniża kondycję o 4 punkty.</p>
          <label className="player-profile-position-select">Trenuj jako
            <select aria-label={`Nowa pozycja dla ${player.firstName} ${player.lastName}`} value={effectiveTarget} onChange={(event) => setTargetPosition(event.target.value as Position)}>
              {availablePositions.map((position) => <option key={position} value={position}>{positionAbbreviations[position]} · {positionLabels[position]}</option>)}
            </select>
          </label>
          <div className="player-profile-training-progress">
            <span>Postęp <strong>{activeTraining?.sessionsCompleted ?? 0} / {sessionsRequired}</strong></span>
            <span>{effectiveTarget ? `${positionLabels[effectiveTarget]}` : ''}</span>
          </div>
          {trainingWouldReset && <p className="player-profile-training-warning">Wybranie innej pozycji wyzeruje dotychczasowy postęp treningu.</p>}
          <button type="button" className="primary-button player-profile-train-button" disabled={!effectiveTarget || !sessionsRequired || game.cash < 25_000} onClick={trainPosition}>
            Trenuj pozycję · 25 000 zł <ArrowRight size={14} />
          </button>
        </>}
  </section>
}

function PositionTrainingPanel({ game, onUpdate }: { game: GameState; onUpdate: (game: GameState, message?: string) => void }) {
  const [playerId, setPlayerId] = useState(game.squad[0]?.id ?? '')
  const selectedPlayer = game.squad.find((player) => player.id === playerId) ?? game.squad[0]
  const [targetPosition, setTargetPosition] = useState<Position>('ŚP')
  const availableTargets = selectedPlayer
    ? selectedPlayer.position === 'BR'
      ? []
      : (Object.keys(positionLabels) as Position[]).filter((position) =>
      position !== 'BR'
      && position !== selectedPlayer.position
      && !selectedPlayer.secondaryPositions?.includes(position),
    )
    : []
  const effectiveTarget = availableTargets.includes(targetPosition) ? targetPosition : availableTargets[0]
  const sessionsRequired = selectedPlayer && effectiveTarget
    ? positionTrainingSessionsRequired(selectedPlayer, effectiveTarget)
    : null
  const activeTraining = selectedPlayer?.positionTraining?.targetPosition === effectiveTarget
    ? selectedPlayer.positionTraining
    : null
  function train() {
    if (!selectedPlayer || !effectiveTarget) return
    const result = trainPlayerForPosition(game, selectedPlayer.id, effectiveTarget)
    if (result.error) return onUpdate(game, result.error)
    const message = result.completedPosition
      ? `${selectedPlayer.firstName} ${selectedPlayer.lastName} ukończył trening i może teraz grać jako ${positionLabels[result.completedPosition]}.`
      : `Postęp treningu pozycyjnego: ${result.sessionsCompleted} / ${result.sessionsRequired} sesji.`
    onUpdate(result.game, message)
  }
  return <section className="position-training-panel">
    <div className="position-training-heading"><span className="training-icon"><Target size={18} /></span><div><p className="eyebrow">INDYWIDUALNY ROZWÓJ</p><h2>Trening nowej pozycji</h2><p>Po ukończeniu treningu gracz dostanie dodatkową pozycję. Trening kosztuje 25 000 zł za sesję.</p></div></div>
    <div className="position-training-controls">
      <label>Zawodnik<select aria-label="Zawodnik do treningu pozycyjnego" value={selectedPlayer?.id ?? ''} onChange={(event) => setPlayerId(event.target.value)}>{game.squad.map((player) => <option key={player.id} value={player.id}>{player.shirtNumber !== undefined ? `${player.shirtNumber}. ` : ''}{player.firstName} {player.lastName} · {positionLabels[player.position]}</option>)}</select></label>
      {selectedPlayer && availableTargets.length > 0 && <label>Pozycja do nauki<select aria-label="Nowa pozycja do nauki" value={effectiveTarget ?? ''} onChange={(event) => setTargetPosition(event.target.value as Position)}>{availableTargets.map((position) => <option key={position} value={position}>{positionAbbreviations[position]} · {positionLabels[position]}</option>)}</select></label>}
      {selectedPlayer && effectiveTarget && <div className="position-training-progress"><span>Wymagany trening <strong>{sessionsRequired} sesje</strong></span><span>Postęp <strong>{activeTraining?.sessionsCompleted ?? 0} / {sessionsRequired}</strong></span></div>}
      <button className="primary-button" disabled={!selectedPlayer || !effectiveTarget || !sessionsRequired || game.cash < 25_000} onClick={train}>Trenuj pozycję · 25 000 zł <ArrowRight size={14} /></button>
    </div>
    {selectedPlayer?.position === 'BR' && <p className="position-training-note">Bramkarz nie może zmienić swojej pozycji ani trenować dodatkowej pozycji w polu.</p>}
    {selectedPlayer && selectedPlayer.position !== 'BR' && availableTargets.length === 0 && <p className="position-training-note">Zawodnik ma już odblokowane dwie dodatkowe pozycje.</p>}
    {selectedPlayer?.positionTraining && selectedPlayer.positionTraining.targetPosition !== effectiveTarget && <p className="position-training-note">Rozpoczęcie treningu innej pozycji wyzeruje dotychczasowy postęp.</p>}
  </section>
}

function resolveSetupRegion(city: string, leagueId: LeagueId, fallbackRegion: string) {
  const regions = getRegionsForLeague(leagueId)
  const cityRegion = getRegionForCity(city)
  if (cityRegion && regions.includes(cityRegion)) return cityRegion
  if (regions.includes(fallbackRegion)) return fallbackRegion
  return regions[0] ?? fallbackRegion
}

const defaultSetupLeague = leagues.find((league) => league.selectable !== false && getLeagueTier(league.id) === 8)?.id
  ?? leagues.filter((league) => league.selectable !== false).reduce((lowestLeague, league) =>
    getLeagueTier(league.id) > getLeagueTier(lowestLeague.id) ? league : lowestLeague,
  ).id

function getSavedMusicVolume() {
  const saved = readStorage(GAME_MUSIC_VOLUME_KEY)
  if (saved === null) return DEFAULT_GAME_MUSIC_VOLUME
  const volume = Number(saved)
  return Number.isFinite(volume) && volume >= 0 && volume <= 100 ? volume : DEFAULT_GAME_MUSIC_VOLUME
}

function App() {
  const [initialSave] = useState(getInitialSave)
  const [careerCustomizationLoad] = useState(() => {
    try {
      return { customization: readCareerCustomization(), error: '' }
    } catch (error) {
      return {
        customization: { clubName: '', clubColor: '#d8fa54', playerNamesByShirtNumber: {}, playerIdsByShirtNumber: {} },
        error: error instanceof Error ? error.message : 'Nie udało się odczytać personalizacji kariery.',
      }
    }
  })
  const [game, setGame] = useState<GameState | null>(initialSave.game)
  const [careerCustomization, setCareerCustomization] = useState(careerCustomizationLoad.customization)
  const [musicMuted, setMusicMuted] = useState(() => readStorage('polski-manager-music-muted') === 'true')
  const [musicVolume, setMusicVolume] = useState(getSavedMusicVolume)
  const [section, setSection] = useState<Section>('overview')
  const [autoOpenInboxMessageId, setAutoOpenInboxMessageId] = useState<string | null>(null)
  const [calendarSimulationDate, setCalendarSimulationDate] = useState<string | null>(null)
  const [calendarSimulationTargetDate, setCalendarSimulationTargetDate] = useState<string | null>(null)
  const [calendarSimulationActive, setCalendarSimulationActive] = useState(false)
  const [matchPlayback, setMatchPlayback] = useState<LiveMatchPlayback | null>(null)
  const [matchStatistics, setMatchStatistics] = useState<LiveMatchPlayback | null>(null)
  const [playerProfile, setPlayerProfile] = useState<{ player: Player; clubName: string; isOwnPlayer: boolean } | null>(null)
  const [clubProfileTeamId, setClubProfileTeamId] = useState<string | null>(null)
  const [setupName, setSetupName] = useState(() => careerCustomization.clubName)
  const [setupCity, setSetupCity] = useState('')
  const [setupLeague, setSetupLeague] = useState<LeagueId>(defaultSetupLeague)
  const [setupRegion, setSetupRegion] = useState(getRegionsForLeague(defaultSetupLeague)[0] ?? 'fourth-mazowieckie')
  const [setupMode, setSetupMode] = useState<'custom' | 'existing'>('custom')
  const [setupExistingClub, setSetupExistingClub] = useState(clubsByLeague[defaultSetupLeague][0])
  const [setupColor, setSetupColor] = useState(() => careerCustomization.clubColor)
  const [search, setSearch] = useState('')
  const [positionFilter, setPositionFilter] = useState<Position | 'all'>('all')
  const [notice, setNotice] = useState(initialSave.error || careerCustomizationLoad.error)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [savingError, setSavingError] = useState('')
  const [activeSaveSlot, setActiveSaveSlot] = useState<typeof saveSlots[number]>(() => {
    const stored = readStorage('polski-manager-active-slot')
    return saveSlots.includes(stored as typeof saveSlots[number]) ? stored as typeof saveSlots[number] : 'slot-1'
  })
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const musicAudioRef = useRef<HTMLAudioElement | null>(null)
  const matchAudioRef = useRef<StadiumAudio | null>(null)
  const matchAudioPausedForMatchRef = useRef(false)
  const matchAudioTransitionRef = useRef<number | null>(null)
  const musicResumeTransitionRef = useRef<number | null>(null)
  const matchAudioPhaseRef = useRef({ playbackId: '', lastMinute: 0, phase: '' })
  const matchPlaybackRef = useRef<LiveMatchPlayback | null>(null)
  matchPlaybackRef.current = matchPlayback
  const musicStartRef = useRef<() => void>(() => {})
  const musicReleaseLockRef = useRef<() => void>(() => {})
  const musicMutedRef = useRef(musicMuted)
  const musicVolumeRef = useRef(musicVolume)
  const sectionHistoryInitializedRef = useRef(false)
  const skipSectionHistoryPushRef = useRef(false)
  const knownInboxMessageIdsRef = useRef(new Set(initialSave.game?.inboxMessages?.map((message) => message.id) ?? []))
  const calendarSimulationActiveRef = useRef(false)
  const scrollToMatchdayOnOverviewRef = useRef(false)
  const scrollToMatchStatisticsRef = useRef(false)
  const scrollToFinanceSponsorsRef = useRef(false)
  const finalizedMatchPlaybackId = useRef<string | null>(null)
  const initialSaveMigrationDone = useRef(false)
  const constructionCompletesAt = game?.facilityConstruction?.completesAt

  useEffect(() => {
    const currentState = window.history.state
    window.history.replaceState({
      ...(currentState && typeof currentState === 'object' ? currentState : {}),
      pmp27Section: 'overview',
    }, '', window.location.href)
    const handlePopState = (event: PopStateEvent) => {
      const previousSection = SECTIONS.find((candidate) => candidate === event.state?.pmp27Section) ?? 'overview'
      skipSectionHistoryPushRef.current = true
      setSection(previousSection)
    }
    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
      sectionHistoryInitializedRef.current = false
      skipSectionHistoryPushRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!sectionHistoryInitializedRef.current) {
      sectionHistoryInitializedRef.current = true
      return
    }
    if (skipSectionHistoryPushRef.current) {
      skipSectionHistoryPushRef.current = false
      return
    }
    window.history.pushState({ pmp27Section: section }, '', window.location.href)
  }, [section])

  useEffect(() => {
    if (section !== 'overview' || !scrollToMatchdayOnOverviewRef.current) return
    scrollToMatchdayOnOverviewRef.current = false
    window.requestAnimationFrame(() => {
      document.getElementById('matchday-center-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [section])

  useEffect(() => {
    if (section !== 'match-stats' || !scrollToMatchStatisticsRef.current) return
    scrollToMatchStatisticsRef.current = false
    window.requestAnimationFrame(() => {
      document.getElementById('match-statistics-page')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [section])

  useEffect(() => {
    if (section !== 'finances' || !scrollToFinanceSponsorsRef.current) return
    scrollToFinanceSponsorsRef.current = false
    window.requestAnimationFrame(() => {
      document.getElementById('finance-sponsor-offers')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [section])

  const returnToClubOverview = useCallback(() => {
    scrollToMatchdayOnOverviewRef.current = true
    setSection('overview')
  }, [])

  useEffect(() => {
    const audio = new Audio()
    audio.preload = 'auto'
    audio.volume = musicVolumeRef.current / 100
    musicAudioRef.current = audio
    let playlist = [...GAME_MUSIC_TRACKS]
    let playlistIndex = playlist.length
    let disposed = false
    let lockPending = false
    let lockHeld = false
    let releaseLock: (() => void) | null = null
    const removeInteractionListeners = () => {
      window.removeEventListener('pointerdown', startMusic)
      window.removeEventListener('keydown', startMusic)
    }
    const loadNextTrack = () => {
      if (playlistIndex >= playlist.length) {
        playlist = [...GAME_MUSIC_TRACKS]
        for (let index = playlist.length - 1; index > 0; index -= 1) {
          const randomIndex = Math.floor(Math.random() * (index + 1))
          ;[playlist[index], playlist[randomIndex]] = [playlist[randomIndex], playlist[index]]
        }
        playlistIndex = 0
      }
      audio.src = playlist[playlistIndex]
      playlistIndex += 1
      audio.load()
    }
    const releaseCurrentLock = () => {
      const resolve = releaseLock
      releaseLock = null
      resolve?.()
      if (musicReleaseLockRef.current === releaseCurrentLock) {
        musicReleaseLockRef.current = () => {}
      }
    }
    const playAudio = () => {
      void audio.play().then(() => {
        removeInteractionListeners()
      }).catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'NotAllowedError') {
          releaseCurrentLock()
          return
        }
        if (error instanceof DOMException && error.name === 'AbortError') return
        setNotice('Nie udało się odtworzyć muzyki. Sprawdź, czy plik audio jest dostępny.')
        releaseCurrentLock()
      })
    }
    const startMusic = () => {
      if (disposed || musicMutedRef.current || matchAudioPausedForMatchRef.current || !audio.paused) return
      if (!navigator.locks) {
        playAudio()
        return
      }
      if (lockHeld) {
        playAudio()
        return
      }
      if (lockPending) return
      lockPending = true
      void navigator.locks.request(GAME_MUSIC_LOCK_NAME, { ifAvailable: true }, async (lock) => {
        lockPending = false
        if (!lock || disposed || musicMutedRef.current || matchAudioPausedForMatchRef.current) return
        lockHeld = true
        await new Promise<void>((resolve) => {
          releaseLock = resolve
          musicReleaseLockRef.current = releaseCurrentLock
          playAudio()
        })
        lockHeld = false
      }).catch(() => {
        lockPending = false
        setNotice('Nie udało się uzyskać dostępu do odtwarzania muzyki w tej karcie.')
      })
    }
    const playNextTrack = () => {
      loadNextTrack()
      audio.volume = musicVolumeRef.current / 100
      startMusic()
    }
    loadNextTrack()
    audio.addEventListener('ended', playNextTrack)
    musicStartRef.current = startMusic
    const lockRetryTimer = window.setInterval(startMusic, 3_000)
    window.addEventListener('pointerdown', startMusic)
    window.addEventListener('keydown', startMusic)
    startMusic()

    return () => {
      disposed = true
      removeInteractionListeners()
      window.clearInterval(lockRetryTimer)
      releaseCurrentLock()
      audio.removeEventListener('ended', playNextTrack)
      audio.pause()
      audio.currentTime = 0
      if (musicAudioRef.current === audio) musicAudioRef.current = null
      musicStartRef.current = () => {}
      musicReleaseLockRef.current = () => {}
    }
  }, [])

  useEffect(() => {
    const audio = musicAudioRef.current
    if (audio) audio.volume = musicVolume / 100
    musicVolumeRef.current = musicVolume
  }, [musicVolume])

  useEffect(() => {
    musicMutedRef.current = musicMuted
    if (musicMuted) {
      musicAudioRef.current?.pause()
      if (musicAudioRef.current) musicAudioRef.current.volume = musicVolumeRef.current / 100
      musicReleaseLockRef.current()
    }
    else if (!matchAudioPausedForMatchRef.current) musicStartRef.current()
  }, [musicMuted])

  function setMusicEnabled(enabled: boolean) {
    const muted = !enabled
    musicMutedRef.current = muted
    setMusicMuted(muted)
    if (!writeStorage('polski-manager-music-muted', String(muted))) {
      setNotice('Nie udało się zapisać ustawienia muzyki w tej przeglądarce.')
    }
    if (enabled && !matchAudioPausedForMatchRef.current) musicStartRef.current()
  }

  function toggleMusic() {
    setMusicEnabled(musicMuted)
  }

  function updateMusicVolume(volume: number) {
    const nextVolume = Math.min(100, Math.max(0, Math.round(volume)))
    musicVolumeRef.current = nextVolume
    setMusicVolume(nextVolume)
    if (!writeStorage(GAME_MUSIC_VOLUME_KEY, String(nextVolume))) {
      setNotice('Nie udało się zapisać głośności muzyki w tej przeglądarce.')
    }
  }

  function clearMatchAudioTransition() {
    if (matchAudioTransitionRef.current !== null) {
      window.clearTimeout(matchAudioTransitionRef.current)
      matchAudioTransitionRef.current = null
    }
    if (musicResumeTransitionRef.current !== null) {
      window.clearTimeout(musicResumeTransitionRef.current)
      musicResumeTransitionRef.current = null
    }
  }

  function pauseMusicForMatch() {
    clearMatchAudioTransition()
    matchAudioPausedForMatchRef.current = true
    musicAudioRef.current?.pause()
    musicReleaseLockRef.current()
  }

  function resumeMusicAfterMatch(delay = 0) {
    if (musicResumeTransitionRef.current !== null) window.clearTimeout(musicResumeTransitionRef.current)
    musicResumeTransitionRef.current = window.setTimeout(() => {
      musicResumeTransitionRef.current = null
      matchAudioPausedForMatchRef.current = false
      if (!musicMutedRef.current) musicStartRef.current()
    }, delay)
  }

  function playMatchWhistle(stadiumAudio: StadiumAudio, kind: 'kickoff' | 'break' | 'full-time') {
    void stadiumAudio.whistle(kind).catch((error: unknown) => {
      if (matchAudioRef.current !== stadiumAudio) return
      setNotice(error instanceof Error ? `Nie udało się odtworzyć gwizdka: ${error.message}` : 'Nie udało się odtworzyć gwizdka sędziego.')
    })
  }

  function handleStadiumAudioStartError(stadiumAudio: StadiumAudio, error: unknown) {
    if (matchAudioRef.current !== stadiumAudio) return
    stadiumAudio.dispose()
    matchAudioRef.current = null
    matchAudioPausedForMatchRef.current = false
    if (!musicMutedRef.current) musicStartRef.current()
    setNotice(error instanceof Error ? `Nie udało się uruchomić dźwięku stadionu: ${error.message}` : 'Nie udało się uruchomić dźwięku stadionu.')
  }

  function startMatchAudio() {
    clearMatchAudioTransition()
    matchAudioRef.current?.dispose()
    try {
      const stadiumAudio = createStadiumAudio()
      matchAudioRef.current = stadiumAudio
      pauseMusicForMatch()
      playMatchWhistle(stadiumAudio, 'kickoff')
      void stadiumAudio.startCrowd().catch((error: unknown) => handleStadiumAudioStartError(stadiumAudio, error))
    } catch (error) {
      matchAudioRef.current = null
      setNotice(error instanceof Error ? error.message : 'Nie udało się uruchomić dźwięku stadionu.')
    }
  }

  function resumeMatchAudio() {
    const stadiumAudio = matchAudioRef.current
    if (!stadiumAudio) return
    pauseMusicForMatch()
    playMatchWhistle(stadiumAudio, 'kickoff')
    void stadiumAudio.startCrowd().catch((error: unknown) => handleStadiumAudioStartError(stadiumAudio, error))
  }

  function finishMatchAudio() {
    clearMatchAudioTransition()
    const stadiumAudio = matchAudioRef.current
    if (!stadiumAudio) {
      matchAudioPausedForMatchRef.current = false
      if (!musicMutedRef.current) musicStartRef.current()
      return
    }
    stadiumAudio.stopCrowd()
    playMatchWhistle(stadiumAudio, 'full-time')
    resumeMusicAfterMatch(1_500)
    matchAudioTransitionRef.current = window.setTimeout(() => {
      matchAudioTransitionRef.current = null
      stadiumAudio.dispose()
      if (matchAudioRef.current === stadiumAudio) matchAudioRef.current = null
    }, 2_500)
  }

  useEffect(() => () => {
    clearMatchAudioTransition()
    matchAudioRef.current?.dispose()
  }, [])

  function getSaveMeta(slotId: typeof saveSlots[number]) {
    try {
      const stored = readStorage(`polski-manager-save-${slotId}`)
      if (!stored) return null
      const parsed = JSON.parse(stored) as Partial<GameState>
      return typeof parsed.clubName === 'string'
        && typeof parsed.season === 'string'
        && typeof parsed.round === 'number'
        ? { clubName: parsed.clubName, season: parsed.season, round: parsed.round }
        : null
    } catch {
      return null
    }
  }

  const persistGame = useCallback((next: GameState, slotId = activeSaveSlot) => {
    const serialized = JSON.stringify(createGameSaveSnapshot(next))
    const slotKey = `polski-manager-save-${slotId}`
    let slotSaved = writeStorage(slotKey, serialized)
    let previousPrimarySave: string | null = null
    if (!slotSaved) {
      previousPrimarySave = readStorage('polski-manager-save')
      if (previousPrimarySave !== null && removeStorage('polski-manager-save')) {
        slotSaved = writeStorage(slotKey, serialized)
        if (!slotSaved) writeStorage('polski-manager-save', previousPrimarySave)
      }
    }
    const activeSaved = writeStorage('polski-manager-active-slot', slotId)
    if (slotSaved) removeStorage('polski-manager-save')

    if (!slotSaved || !activeSaved) {
      setSavingError('Przeglądarka nie mogła zapisać kariery. Zwolnij miejsce w pamięci witryny lub wyeksportuj zapis, aby zachować kopię.')
      return
    }

    setActiveSaveSlot(slotId)
    setSavingError('')
  }, [activeSaveSlot])

  useEffect(() => {
    if (!game || initialSaveMigrationDone.current) return
    initialSaveMigrationDone.current = true
    persistGame(game)
  }, [game, persistGame])

  const club = game ? getClub(game) : null
  const table = useMemo(() => game ? getLeagueTable(game) : [], [game])
  const clubPosition = club ? table.findIndex((team) => team.id === club.id) + 1 : 0
  const nextMatch = game ? getNextMatch(game) : undefined
  const nextCompetition = game ? getNextScheduledCompetition(game) : 'season-complete'
  const nextFriendlyMatch = game && nextCompetition === 'friendly' ? getNextFriendlyMatch(game) : undefined
  const nextCupMatch = game && nextCompetition === 'polish-cup' ? getPolishCupNextMatch(game) : undefined
  const nextChampionsCupMatch = game && nextCompetition === 'champions-cup' ? game.championsCupMatch : undefined
  const nextPmpMatch = game && nextCompetition === 'pmp-league' ? getPmpLeagueNextMatch(game) : undefined
  const opponentId = nextMatch && game ? nextMatch.homeId === game.teamId ? nextMatch.awayId : nextMatch.homeId : ''
  const pmpOpponentId = nextPmpMatch && game
    ? nextPmpMatch.homeId === game.teamId ? nextPmpMatch.awayId : nextPmpMatch.homeId
    : ''
  const isHome = Boolean(nextCompetition === 'pmp-league'
    ? nextPmpMatch?.homeId === game?.teamId
    : nextMatch && game && nextMatch.homeId === game.teamId)
  const clubRating = game ? overallRating(game.squad) : 0

  const savedCareers = saveSlots.flatMap((slotId) => {
    const meta = getSaveMeta(slotId)
    return meta ? [{ slotId, label: saveSlotLabels[slotId], ...meta }] : []
  })

  function navigateToSection(nextSection: Section) {
    if (nextSection !== 'inbox') setAutoOpenInboxMessageId(null)
    setSection(nextSection)
    setMobileNavOpen(false)
  }

  function navigateToSponsorOffers() {
    if (section === 'finances') {
      setMobileNavOpen(false)
      window.requestAnimationFrame(() => {
        document.getElementById('finance-sponsor-offers')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
      return
    }
    scrollToFinanceSponsorsRef.current = true
    navigateToSection('finances')
  }

  const updateGame = useCallback((next: GameState, message = '') => {
    const knownMessageIds = knownInboxMessageIdsRef.current
    const newUnreadMessage = (next.inboxMessages ?? []).find((inboxMessage) =>
      !inboxMessage.read && !knownMessageIds.has(inboxMessage.id),
    )
    for (const inboxMessage of next.inboxMessages ?? []) knownMessageIds.add(inboxMessage.id)
    if (newUnreadMessage) {
      next.inboxMessages = (next.inboxMessages ?? []).map((inboxMessage) =>
        inboxMessage.id === newUnreadMessage.id ? { ...inboxMessage, read: true } : inboxMessage,
      )
      setAutoOpenInboxMessageId(newUnreadMessage.id)
      setSection('inbox')
    }

    let customizationError = ''
    if (game) {
      const updatedCustomization = { ...careerCustomization }
      let customizationChanged = false
      if (next.clubName !== game.clubName) {
        updatedCustomization.clubName = next.clubName
        customizationChanged = true
        if (updatedCustomization.crestIdentity) {
          try {
            const library = readClubCrestLibrary()
            const oldIdentity = updatedCustomization.crestIdentity
            const ownTeam = next.teams.find((team) => team.id === next.teamId)
            if (ownTeam && library[oldIdentity]) {
              const nextIdentity = getClubCrestIdentity(ownTeam)
              library[nextIdentity] = library[oldIdentity]
              if (nextIdentity !== oldIdentity) delete library[oldIdentity]
              if (!writeStorage(CLUB_CREST_LIBRARY_KEY, JSON.stringify(library))) {
                throw new Error('Nie udało się przenieść herbu do nowej nazwy klubu.')
              }
              updatedCustomization.crestIdentity = nextIdentity
            }
          } catch (error) {
            customizationError = error instanceof Error ? error.message : 'Nie udało się zachować herbu dla kolejnych karier.'
          }
        }
      }
      if (next.clubColor !== game.clubColor) {
        updatedCustomization.clubColor = next.clubColor
        customizationChanged = true
      }
      const nextOwnCrest = next.clubCrestDataUrl
        ?? next.clubCrestsByTeamId?.[next.teamId]
      const previousOwnCrest = game.clubCrestDataUrl
        ?? game.clubCrestsByTeamId?.[game.teamId]
      if (nextOwnCrest !== previousOwnCrest) {
        if (nextOwnCrest) {
          const ownTeam = next.teams.find((team) => team.id === next.teamId)
          if (ownTeam) updatedCustomization.crestIdentity = getClubCrestIdentity(ownTeam)
        } else {
          if (updatedCustomization.crestIdentity) {
            try {
              const library = readClubCrestLibrary()
              delete library[updatedCustomization.crestIdentity]
              if (!writeStorage(CLUB_CREST_LIBRARY_KEY, JSON.stringify(library))) {
                throw new Error('Nie udało się usunąć herbu z biblioteki przeglądarki.')
              }
            } catch (error) {
              customizationError = error instanceof Error ? error.message : 'Nie udało się usunąć herbu z biblioteki.'
            }
          }
          updatedCustomization.crestIdentity = undefined
        }
        customizationChanged = true
      }
      const previousPlayersById = new Map(game.squad.map((player) => [player.id, player]))
      for (const player of next.squad) {
        const previousPlayer = previousPlayersById.get(player.id)
        if (!previousPlayer
          || (previousPlayer.firstName === player.firstName && previousPlayer.lastName === player.lastName)
          || player.shirtNumber === undefined) continue
        updatedCustomization.playerNamesByShirtNumber[String(player.shirtNumber)] = {
          firstName: player.firstName,
          lastName: player.lastName,
        }
        updatedCustomization.playerIdsByShirtNumber[String(player.shirtNumber)] = player.id
        customizationChanged = true
      }
      if (customizationChanged) {
        if (writeStorage(CAREER_CUSTOMIZATION_KEY, JSON.stringify(updatedCustomization))) {
          setCareerCustomization(updatedCustomization)
        } else {
          customizationError = 'Personalizacji nie udało się zapisać dla kolejnych karier — brakuje miejsca w pamięci przeglądarki.'
        }
      }
    }
    persistGame(next)
    setGame(next)
    setNotice(customizationError ? `${message}${message ? ' ' : ''}${customizationError}` : message)
  }, [careerCustomization, game, persistGame])

  const matchPlaybackId = matchPlayback?.id
  const matchPlaybackFinished = matchPlayback?.finished
  const matchPlaybackHalftimePaused = matchPlayback?.halftimePaused
  useEffect(() => {
    if (!matchPlaybackId || matchPlaybackFinished || matchPlaybackHalftimePaused) return
    const playbackId = matchPlaybackId
    const timer = window.setInterval(() => {
      setMatchPlayback((current) => {
        if (!current || current.id !== playbackId || current.finished || current.halftimePaused) return current
        const matchEndMinute = current.extraTimePlayed ? 120 : 90
        const elapsedMinute = Math.min(matchEndMinute, Math.floor((Date.now() - current.startedAt) * 45 / MATCH_HALF_DURATION_MS))
        const minute = Math.min(current.secondHalfStarted ? matchEndMinute : 45, elapsedMinute)
        const halftimePaused = !current.secondHalfStarted && elapsedMinute >= 45
        if (minute === current.minute && halftimePaused === current.halftimePaused) return current
        const feed = current.incidents.filter((incident) => incident.minute <= minute)
        const latestIncident = feed[feed.length - 1]
        return {
          ...current,
          minute,
          homeGoals: latestIncident?.homeGoals ?? 0,
          awayGoals: latestIncident?.awayGoals ?? 0,
          commentary: latestIncident?.message ?? current.commentary,
          feed: feed.slice(-5),
          halftimePaused,
        }
      })
    }, 200)
    return () => window.clearInterval(timer)
  }, [matchPlaybackId, matchPlaybackFinished, matchPlaybackHalftimePaused])

  useEffect(() => {
    if (!matchPlayback) return
    const soundPhase = matchAudioPhaseRef.current
    if (soundPhase.playbackId !== matchPlayback.id) {
      matchAudioPhaseRef.current = {
        playbackId: matchPlayback.id,
        lastMinute: matchPlayback.minute,
        phase: 'playing',
      }
      return
    }

    if (matchPlayback.finished) {
      if (soundPhase.phase !== 'full-time') {
        soundPhase.phase = 'full-time'
        soundPhase.lastMinute = matchPlayback.minute
        finishMatchAudio()
      }
      return
    }

    if (matchPlayback.halftimePaused) {
      if (soundPhase.phase !== 'half-time') {
        soundPhase.phase = 'half-time'
        soundPhase.lastMinute = matchPlayback.minute
        const stadiumAudio = matchAudioRef.current
        if (stadiumAudio) {
          stadiumAudio.stopCrowd()
          playMatchWhistle(stadiumAudio, 'break')
          resumeMusicAfterMatch(1_000)
        }
      }
      return
    }

    const previousMinute = soundPhase.lastMinute
    if (matchPlayback.extraTimePlayed && previousMinute < 90 && matchPlayback.minute >= 90) {
      soundPhase.phase = 'extra-time-break'
      const stadiumAudio = matchAudioRef.current
      if (stadiumAudio) playMatchWhistle(stadiumAudio, 'break')
    } else if (matchPlayback.extraTimePlayed && previousMinute < 105 && matchPlayback.minute >= 105) {
      soundPhase.phase = 'extra-time-half-time'
      const stadiumAudio = matchAudioRef.current
      if (stadiumAudio) playMatchWhistle(stadiumAudio, 'break')
    } else if (soundPhase.phase !== 'playing') {
      soundPhase.phase = 'playing'
    }
    soundPhase.lastMinute = matchPlayback.minute
  }, [matchPlayback])

  useEffect(() => {
    if (!matchPlayback || matchPlayback.minute < (matchPlayback.extraTimePlayed ? 120 : 90) || matchPlayback.finished) return
    if (finalizedMatchPlaybackId.current === matchPlayback.id) return
    finalizedMatchPlaybackId.current = matchPlayback.id
    const postMatchGame = structuredClone(matchPlayback.finalGame)
    if (postMatchGame.currentDate) {
      const nextDate = parseLocalDateKey(postMatchGame.currentDate)
      nextDate.setDate(nextDate.getDate() + 1)
      postMatchGame.currentDate = getLocalDateKey(nextDate)
    }
    updateGame(postMatchGame, matchPlayback.resultMessage)
    setMatchPlayback((current) => current && current.id === matchPlayback.id
      ? {
        ...current,
        homeGoals: current.finalHomeGoals,
        awayGoals: current.finalAwayGoals,
        finished: true,
      }
      : current)
  }, [matchPlayback, updateGame])

  useEffect(() => {
    if (!game?.facilityConstruction || constructionCompletesAt === undefined) return
    const timer = window.setTimeout(() => {
      const result = completeFacilityConstruction(game, Date.now())
      if (result.completed) updateGame(result.game, 'Zakończono rozbudowę. Nowy obiekt jest już dostępny dla klubu.')
    }, Math.max(0, constructionCompletesAt - Date.now()))
    return () => window.clearTimeout(timer)
  }, [game, constructionCompletesAt, updateGame])

  function handleCreateClub(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedName = setupName.trim()
    const trimmedCity = setupCity.trim()

    if (setupMode === 'custom') {
      if (trimmedName.length < 2) {
        setNotice('Nazwa klubu musi mieć co najmniej 2 znaki.')
        return
      }
      if (!trimmedCity) {
        setNotice('Wpisz miasto klubu, aby rozpocząć karierę.')
        return
      }
    }

    const cityRegion = setupMode === 'custom' ? getRegionForCity(trimmedCity) : undefined
    const effectiveRegion = setupMode === 'custom'
      ? resolveSetupRegion(trimmedCity, setupLeague, setupRegion)
      : setupRegion

    if (cityRegion && !getRegionsForLeague(setupLeague).includes(cityRegion)) {
      setNotice('Miasto nie należy do dostępnych regionów tej ligi. Zmień poziom rozgrywek albo miasto, aby kontynuować.')
      return
    }

    const selectedClubName = setupMode === 'existing' ? setupExistingClub : trimmedName
    const clubName = setupMode === 'existing' ? selectedClubName : trimmedName
    const city = setupMode === 'existing' ? getClubCity(setupExistingClub) : trimmedCity
    if (setupMode === 'custom') setSetupRegion(effectiveRegion)
    try {
      const baseGame = applyClubCrestLibrary(
        createGame(selectedClubName, city, setupLeague, setupColor, setupMode, effectiveRegion),
      )
      const nextCustomization = {
        ...careerCustomization,
        clubName,
        clubColor: setupColor,
      }
      const newGame = applyCareerCustomization(baseGame, nextCustomization)
      for (const player of newGame.squad) {
        if (player.shirtNumber === undefined) continue
        nextCustomization.playerNamesByShirtNumber[String(player.shirtNumber)] = {
          firstName: player.firstName,
          lastName: player.lastName,
        }
        nextCustomization.playerIdsByShirtNumber[String(player.shirtNumber)] = player.id
      }
      const personalizationSaved = writeStorage(CAREER_CUSTOMIZATION_KEY, JSON.stringify(nextCustomization))
      if (personalizationSaved) setCareerCustomization(nextCustomization)
      updateGame(
        newGame,
        `${setupMode === 'existing'
          ? `Przejmujesz ${clubName}. Skład i statystyki zawodników są fikcyjne w tej wersji gry.`
          : 'Kariera rozpoczęta. Powodzenia w pierwszym sezonie!'}${personalizationSaved ? '' : ' Personalizacji nie udało się zapisać dla kolejnych karier — brakuje miejsca w pamięci przeglądarki.'}`,
      )
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Nie udało się rozpocząć nowej kariery.')
    }
  }

  function getAutomaticMatchDecisionId(event: NonNullable<GameState['pendingMatchEvent']>) {
    return [...event.options]
      .sort((first, second) =>
        Math.abs(first.attackModifier) + Math.abs(first.defenseModifier) + Math.abs(first.staminaModifier) / 2
        - Math.abs(second.attackModifier) - Math.abs(second.defenseModifier) - Math.abs(second.staminaModifier) / 2,
      )[0]?.id
  }

  function startMatchPlayback(
    startingGame: GameState,
    finalGame: GameState,
    match: Match,
    competitionLabel: string,
    round: number,
    resultMessage: string,
    penaltyScore?: string,
    matchdayEvent?: GameState['pendingMatchEvent'],
    matchdayDecisionId?: string,
  ) {
    setCalendarSimulationDate(null)
    if (match.scheduledAt) finalGame.currentDate = match.scheduledAt
    const playback = createLiveMatchPlayback(
      startingGame,
      finalGame,
      match,
      finalGame.lastMatchReport,
      competitionLabel,
      round,
      resultMessage,
      penaltyScore,
      matchdayEvent,
      matchdayDecisionId,
    )
    persistGame(finalGame)
    matchAudioPhaseRef.current = { playbackId: playback.id, lastMinute: 0, phase: 'playing' }
    startMatchAudio()
    const orientation = window.screen.orientation
    if (typeof orientation?.lock === 'function') {
      void orientation.lock('portrait').catch(() => {})
    }
    setMatchPlayback(playback)
  }

  function handlePlayMatch() {
    if (!game) return
    const competition = getNextScheduledCompetition(game)
    let scheduledMatchDate: string | undefined
    if (competition === 'friendly') {
      scheduledMatchDate = getNextFriendlyMatch(game)?.scheduledAt
    } else if (competition === 'champions-cup') {
      scheduledMatchDate = game.championsCupMatch?.scheduledAt
    } else if (competition === 'pmp-league') {
      scheduledMatchDate = getPmpLeagueNextMatch(game)?.scheduledAt
    } else if (competition === 'polish-cup') {
      const cupMatch = getPolishCupNextMatch(game)
      if (cupMatch) scheduledMatchDate = getLocalDateKey(getCupFixtureSchedule(game, cupMatch).date)
    } else if (competition === 'promotion-playoff') {
      scheduledMatchDate = game.promotionPlayoffs?.fixtures.find((fixture) =>
        fixture.round === game.promotionPlayoffs?.round && !fixture.played
        && (fixture.homeId === game.teamId || fixture.awayId === game.teamId),
      )?.scheduledAt
    } else if (competition === 'league') {
      const scheduledMatch = getNextMatch(game)
      if (scheduledMatch && !scheduledMatch.bye) {
        scheduledMatchDate = scheduledMatch.scheduledAt
          ?? getLocalDateKey(getLeagueFixtureDate(game, scheduledMatch))
      }
    }
    const currentCalendarDate = calendarSimulationDate
      ?? game.currentDate
      ?? `${game.season.split('/')[0]}-07-01`
    if (scheduledMatchDate && currentCalendarDate < scheduledMatchDate) {
      if (competition === 'pmp-league' || competition === 'polish-cup') {
        void handleSimulateToNextMatch()
        return
      }
      setNotice(`Najbliższy mecz odbędzie się ${scheduledMatchDate}. Użyj „Symuluj do meczu”, aby przejść do terminu.`)
      return
    }
    if (competition === 'champions-cup') {
      const result = playChampionsCupMatch(game)
      if (result.error) {
        setNotice(result.error)
        return
      }
      if (!result.completedMatch) {
        setNotice('Nie udało się przygotować podglądu meczu Pucharu Mistrzów.')
        return
      }
      startMatchPlayback(
        game,
        result.game,
        result.completedMatch,
        'PUCHAR MISTRZÓW',
        result.completedMatch.round,
        `Puchar Mistrzów: ${result.summary}`,
        result.penaltyScore,
      )
      return
    }
    if (competition === 'pmp-league') {
      const pmpMatch = getPmpLeagueNextMatch(game)
      const nextPmpEventDate = game.pmpLeague?.matches
        .filter((match) => !match.played)
        .map((match) => match.scheduledAt)
        .filter((date): date is string => Boolean(date))
        .sort()[0]
      if (pmpMatch?.scheduledAt && pmpMatch.scheduledAt !== nextPmpEventDate) {
        void handleSimulateToNextMatch()
        return
      }
      const result = playPmpLeagueEvent(game)
      if (result.error) {
        setNotice(result.error)
        return
      }
      if (!pmpMatch || !result.completedMatch) {
        setCalendarSimulationDate(null)
        updateGame(result.game, result.summary || 'Rozegrano mecze Ligi PMP.')
        return
      }
      startMatchPlayback(
        game,
        result.game,
        result.completedMatch,
        'LIGA PMP',
        result.completedMatch.round,
        `Liga PMP: ${result.summary}`,
        result.completedMatch.penaltyScore,
      )
      return
    }
    if (getNextScheduledCompetition(game) === 'friendly') {
      const friendly = getNextFriendlyMatch(game)
      if (!friendly) {
        setNotice('Nie znaleziono zaplanowanego sparingu.')
        return
      }
      const result = playFriendlyMatch(game, friendly.id)
      if (result.error) {
        setNotice(result.error)
        return
      }
      const completedFriendly = result.game.preseasonFriendlies?.find((match) => match.id === friendly.id && match.played)
      if (!completedFriendly) {
        setNotice('Nie udało się przygotować podglądu sparingu: nie znaleziono końcowego wyniku meczu.')
        return
      }
      startMatchPlayback(
        game,
        result.game,
        completedFriendly,
        'SPARING PRZEDSEZONOWY',
        completedFriendly.round,
        `Sparing przedsezonowy: ${result.summary} Wynik nie wpływa na tabelę rozgrywek.`,
      )
      return
    }
    if (getNextScheduledCompetition(game) === 'promotion-playoff') {
      const currentFixture = game.promotionPlayoffs?.fixtures.find((fixture) =>
        fixture.round === game.promotionPlayoffs?.round && !fixture.played
        && (fixture.homeId === game.teamId || fixture.awayId === game.teamId),
      )
      const currentCalendarDate = calendarSimulationDate ?? game.currentDate ?? ''
      if (currentFixture && currentCalendarDate.localeCompare(currentFixture.scheduledAt) < 0) {
        setNotice(`Baraż zostanie rozegrany ${currentFixture.scheduledAt} o ${currentFixture.kickoffTime}. Użyj „Symuluj do meczu”, aby przejść do terminu.`)
        return
      }
      const result = playPromotionPlayoffRound(game)
      if (result.error) {
        setNotice(result.error)
        return
      }
      const completedFixture = currentFixture
        ? result.game.promotionPlayoffs?.history.find((fixture) => fixture.id === currentFixture.id)
        : undefined
      setCalendarSimulationDate(null)
      if (currentFixture && completedFixture) {
        if (!completedFixture.winnerId) {
          setNotice('Nie udało się przygotować relacji: nie ustalono zwycięzcy barażu.')
          return
        }
        const homeName = getTeamName(result.game, completedFixture.homeId)
        const awayName = getTeamName(result.game, completedFixture.awayId)
        const winnerName = getTeamName(result.game, completedFixture.winnerId)
        const playbackFixture = { ...completedFixture, competitionId: 'league' as const }
        startMatchPlayback(
          game,
          result.game,
          playbackFixture,
          'BARAŻE O AWANS',
          completedFixture.round,
          `Baraże o awans: ${homeName} ${completedFixture.homeGoals}:${completedFixture.awayGoals} ${awayName}. Awansuje ${winnerName}.`,
        )
        return
      }
      updateGame(result.game, result.summary || 'Rozegrano mecze barażowe.')
      return
    }
    if (getNextScheduledCompetition(game) === 'polish-cup') {
      const clubCupMatch = getPolishCupNextMatch(game)
      if (clubCupMatch?.scheduledAt) {
        const notifiedGame = notifyPolishCupWeek(game, clubCupMatch.scheduledAt)
        const existingMessageIds = new Set((game.inboxMessages ?? []).map((message) => message.id))
        const hasNewUnreadMessage = (notifiedGame.inboxMessages ?? []).some((message) =>
          !message.read && !existingMessageIds.has(message.id),
        )
        if (hasNewUnreadMessage) {
          updateGame(notifiedGame, 'Rozpoczął się tydzień Polskiego Pucharu. Sprawdź terminarz w skrzynce e-mail przed meczem.')
          return
        }
      }
      const result = playPolishCupRound(game)
      if (result.error) {
        setNotice(result.error)
        return
      }
      const completedCupMatch = clubCupMatch
        ? result.game.polishCup?.history.find((match) => match.id === clubCupMatch.id)
          ?? ('completedMatch' in result ? result.completedMatch : undefined)
        : undefined
      if (!clubCupMatch || !completedCupMatch) {
        setCalendarSimulationDate(null)
        updateGame(result.game, `Puchar: ${result.summary}`)
        return
      }
      startMatchPlayback(
        game,
        result.game,
        completedCupMatch,
        getCupCompetitionLabel(game, completedCupMatch).toLocaleUpperCase('pl-PL'),
        game.round,
        `${getCupCompetitionLabel(game, completedCupMatch)}: ${result.summary}`,
        completedCupMatch.penaltyScore,
      )
      return
    }
    const scheduledMatch = getNextMatch(game)
    if (!scheduledMatch) {
      setNotice('Nie znaleziono meczu klubu w aktualnej kolejce.')
      return
    }
    let matchdayEvent = game.pendingMatchEvent ? structuredClone(game.pendingMatchEvent) : undefined
    let matchdayDecisionId = game.pendingMatchEvent
      ? getAutomaticMatchDecisionId(game.pendingMatchEvent)
      : undefined
    let result = game.pendingMatchEvent
      ? playMatchday(game, matchdayDecisionId)
      : playMatchday(game)
    if (result.error) {
      setNotice(result.error)
      if (game.sponsorRequired) setSection('finances')
      return
    }
    if (result.game.pendingMatchEvent) {
      matchdayEvent = structuredClone(result.game.pendingMatchEvent)
      matchdayDecisionId = getAutomaticMatchDecisionId(result.game.pendingMatchEvent)
      if (!matchdayDecisionId) {
        setNotice('Nie udało się rozpocząć symulacji meczu: brak dostępnej decyzji taktycznej.')
        return
      }
      result = playMatchday(result.game, matchdayDecisionId)
      if (result.error) {
        setNotice(result.error)
        return
      }
    }
    const completedMatch = result.game.matches.find((match) => match.id === scheduledMatch.id && match.played)
    if (!completedMatch || completedMatch.bye) {
      setCalendarSimulationDate(null)
      updateGame(result.game, `Twój klub pauzuje w kolejce ${scheduledMatch.round}. Wyniki pozostałych spotkań zostały rozegrane.`)
      return
    }
    const homeName = getTeamName(result.game, completedMatch.homeId)
    const awayName = getTeamName(result.game, completedMatch.awayId)
    startMatchPlayback(
      game,
      result.game,
      completedMatch,
      'ROZGRYWKI LIGOWE',
      completedMatch.round,
      `Koniec meczu: ${homeName} ${completedMatch.homeGoals} : ${completedMatch.awayGoals} ${awayName}.`,
      undefined,
      matchdayEvent,
      matchdayDecisionId,
    )
  }

  function handleResumeMatchPlayback() {
    const current = matchPlayback
    if (!current?.halftimePaused) return
    const intermissionGame = current.intermissionGame
      ?? createMatchIntermissionGame(current.startingGame, current.round, current.matchId)
    const failResume = (message: string) => {
      setNotice(message)
      setMatchPlayback((playback) => playback?.id === current.id
        ? { ...playback, resumeError: message }
        : playback)
    }

    let resumedGame = structuredClone(current.startingGame)
    resumedGame.matchLineupIds = [...intermissionGame.matchLineupIds]
    resumedGame.matchBenchIds = [...intermissionGame.matchBenchIds]
    resumedGame.tactics = { ...intermissionGame.tactics }

    let finalGame: GameState
    let completedMatch: Match | PolishCupMatch | ChampionsCupMatch | undefined
    let resultMessage: string
    let penaltyScore: string | undefined

    if (current.competitionLabel === 'ROZGRYWKI LIGOWE') {
      let matchdayEvent = current.matchdayEvent ?? resumedGame.pendingMatchEvent
      let matchdayDecisionId = current.matchdayDecisionId
      if (!matchdayEvent) {
        const preparedMatch = playMatchday(resumedGame)
        if (preparedMatch.error || !preparedMatch.game.pendingMatchEvent) {
          failResume(`Nie udało się przygotować wznowienia meczu: ${preparedMatch.error || 'brak wydarzenia meczowego.'}`)
          return
        }
        resumedGame = preparedMatch.game
        matchdayEvent = structuredClone(preparedMatch.game.pendingMatchEvent)
      }
      matchdayDecisionId ??= getAutomaticMatchDecisionId(matchdayEvent)
      if (!matchdayDecisionId) {
        failResume('Nie udało się wznowić meczu: brak dostępnej decyzji meczowej.')
        return
      }
      const intermissionEvent = intermissionGame.pendingMatchEvent
      resumedGame.pendingMatchEvent = {
        ...structuredClone(matchdayEvent),
        substitutionsUsed: intermissionEvent?.substitutionsUsed ?? 0,
        substitutedPlayerIds: [...(intermissionEvent?.substitutedPlayerIds ?? [])],
        substitutePlayerIds: [...(intermissionEvent?.substitutePlayerIds ?? [])],
      }
      const preservedResults = new Map(
        current.finalGame.matches
          .filter((match) => match.round === current.round)
          .map((match) => [match.id, match]),
      )
      const result = playMatchday(resumedGame, matchdayDecisionId, preservedResults)
      if (result.error) {
        failResume(`Nie udało się wznowić meczu: ${result.error}`)
        return
      }
      finalGame = result.game
      completedMatch = finalGame.matches.find((match) => match.id === current.matchId && match.played)
      if (!completedMatch) {
        failResume('Nie udało się wznowić meczu: nie znaleziono wyniku spotkania.')
        return
      }
      const homeName = getTeamName(finalGame, completedMatch.homeId)
      const awayName = getTeamName(finalGame, completedMatch.awayId)
      resultMessage = `Koniec meczu: ${homeName} ${completedMatch.homeGoals} : ${completedMatch.awayGoals} ${awayName}.`
    } else if (current.competitionLabel === 'SPARING PRZEDSEZONOWY') {
      resumedGame.pendingMatchEvent = undefined
      const preservedFriendly = current.finalGame.preseasonFriendlies?.find((match) =>
        match.id === current.matchId && match.played,
      )
      if (!preservedFriendly || preservedFriendly.homeGoals === undefined || preservedFriendly.awayGoals === undefined) {
        failResume('Nie udało się wznowić sparingu: brakuje zapisanego wyniku pierwszej połowy.')
        return
      }
      const result = playFriendlyMatch(resumedGame, current.matchId, preservedFriendly)
      if (result.error) {
        failResume(`Nie udało się wznowić sparingu: ${result.error}`)
        return
      }
      finalGame = result.game
      completedMatch = finalGame.preseasonFriendlies?.find((match) => match.id === current.matchId && match.played)
      if (!completedMatch) {
        failResume('Nie udało się wznowić sparingu: nie znaleziono wyniku spotkania.')
        return
      }
      const intermissionEvent = intermissionGame.pendingMatchEvent
      completedMatch.substitutions = (intermissionEvent?.substitutedPlayerIds ?? []).flatMap((outgoingPlayerId, index) => {
        const incomingPlayerId = intermissionEvent?.substitutePlayerIds?.[index]
        return incomingPlayerId
          ? [{ minute: 45, teamId: resumedGame.teamId, outgoingPlayerId, incomingPlayerId, reason: 'manual' as const }]
          : []
      })
      const homeName = getTeamName(finalGame, completedMatch.homeId)
      const awayName = getTeamName(finalGame, completedMatch.awayId)
      resultMessage = `Sparing przedsezonowy: ${homeName} ${completedMatch.homeGoals} : ${completedMatch.awayGoals} ${awayName}. Wynik nie wpływa na tabelę rozgrywek.`
    } else if (current.competitionLabel === 'LIGA PMP') {
      const preservedResults = new Map<string, NonNullable<GameState['pmpLeague']>['matches'][number]>(
        [
          ...(current.finalGame.pmpLeague?.history ?? []),
          ...(current.finalGame.pmpLeague?.matches ?? []),
        ].map((match) => [match.id, match] as const),
      )
      const result = playPmpLeagueEvent(resumedGame, preservedResults)
      if (result.error) {
        failResume(`Nie udało się wznowić meczu Ligi PMP: ${result.error}`)
        return
      }
      finalGame = result.game
      completedMatch = finalGame.pmpLeague?.history.find((match) => match.id === current.matchId)
        ?? finalGame.pmpLeague?.matches.find((match) => match.id === current.matchId)
      if (!completedMatch) {
        failResume('Nie udało się wznowić meczu Ligi PMP: nie znaleziono końcowego wyniku.')
        return
      }
      penaltyScore = 'penaltyScore' in completedMatch && typeof completedMatch.penaltyScore === 'string'
        ? completedMatch.penaltyScore
        : undefined
      resultMessage = `Liga PMP: ${getTeamName(finalGame, completedMatch.homeId)} ${completedMatch.homeGoals} : ${completedMatch.awayGoals} ${getTeamName(finalGame, completedMatch.awayId)}.`
    } else if (current.competitionLabel === 'PUCHAR MISTRZÓW') {
      const preservedMatch = current.finalGame.championsCupMatch
      if (!preservedMatch?.played || preservedMatch.id !== current.matchId) {
        failResume('Nie udało się wznowić meczu Pucharu Mistrzów: brakuje zapisanego wyniku pierwszej połowy.')
        return
      }
      const result = playChampionsCupMatch(resumedGame, preservedMatch)
      if (result.error) {
        failResume(`Nie udało się wznowić meczu Pucharu Mistrzów: ${result.error}`)
        return
      }
      finalGame = result.game
      completedMatch = finalGame.championsCupMatch
      if (!completedMatch) {
        failResume('Nie udało się wznowić meczu Pucharu Mistrzów: nie znaleziono końcowego wyniku.')
        return
      }
      penaltyScore = 'penaltyScore' in completedMatch ? completedMatch.penaltyScore : undefined
      resultMessage = `Puchar Mistrzów: ${getTeamName(finalGame, completedMatch.homeId)} ${completedMatch.homeGoals} : ${completedMatch.awayGoals} ${getTeamName(finalGame, completedMatch.awayId)}${penaltyScore ? ` · rzuty karne ${penaltyScore}` : ''}.`
    } else if (current.competitionLabel === 'BARAŻE O AWANS') {
      const preservedResults = new Map(
        [
          ...(current.finalGame.promotionPlayoffs?.history ?? []),
          ...(current.finalGame.promotionPlayoffs?.fixtures ?? []),
        ]
          .filter((fixture) => fixture.played && fixture.round === current.round)
          .map((fixture) => [fixture.id, fixture] as const),
      )
      const result = playPromotionPlayoffRound(resumedGame, preservedResults)
      if (result.error) {
        failResume(`Nie udało się wznowić barażu: ${result.error}`)
        return
      }
      finalGame = result.game
      const fixture = finalGame.promotionPlayoffs?.history.find((item) => item.id === current.matchId)
      if (!fixture) {
        failResume('Nie udało się wznowić barażu: nie znaleziono końcowego wyniku.')
        return
      }
      completedMatch = { ...fixture, competitionId: 'league' }
      const winnerName = fixture.winnerId ? getTeamName(finalGame, fixture.winnerId) : 'nieustalony'
      resultMessage = `Baraże o awans: ${getTeamName(finalGame, fixture.homeId)} ${fixture.homeGoals} : ${fixture.awayGoals} ${getTeamName(finalGame, fixture.awayId)}. Awansuje ${winnerName}.`
    } else {
      resumedGame.pendingMatchEvent = undefined
      const preservedResults = new Map(
        [
          ...(current.finalGame.polishCup?.history ?? []),
          ...(current.finalGame.regionalCups ?? []).flatMap((cup) => cup.history),
        ].map((match) => [match.id, match]),
      )
      const result = playPolishCupRound(resumedGame, preservedResults)
      if (result.error) {
        failResume(`Nie udało się wznowić meczu: ${result.error}`)
        return
      }
      finalGame = result.game
      completedMatch = finalGame.polishCup?.history.find((match) => match.id === current.matchId)
        ?? finalGame.regionalCups?.flatMap((cup) => cup.history).find((match) => match.id === current.matchId)
      if (!completedMatch) {
        failResume('Nie udało się wznowić meczu: nie znaleziono wyniku spotkania pucharowego.')
        return
      }
      penaltyScore = 'penaltyScore' in completedMatch ? completedMatch.penaltyScore : undefined
      resultMessage = `Polski Puchar: ${completedMatch.homeGoals} : ${completedMatch.awayGoals}${penaltyScore ? ` · rzuty karne ${penaltyScore}` : ''}.`
    }

    const resumedPlayback = createLiveMatchPlayback(
      resumedGame,
      finalGame,
      completedMatch,
      finalGame.lastMatchReport,
      current.competitionLabel,
      current.round,
      resultMessage,
      penaltyScore,
      current.matchdayEvent ?? undefined,
      current.matchdayDecisionId,
    )
    if (!completedMatch.substitutions?.length) {
      const substitutedPlayerIds = intermissionGame.pendingMatchEvent?.substitutedPlayerIds
        ?? current.startingGame.matchLineupIds.filter((playerId) => !intermissionGame.matchLineupIds.includes(playerId))
      const substitutePlayerIds = intermissionGame.pendingMatchEvent?.substitutePlayerIds
        ?? intermissionGame.matchLineupIds.filter((playerId) => !current.startingGame.matchLineupIds.includes(playerId))
      resumedPlayback.substitutions = substitutedPlayerIds.flatMap((outgoingPlayerId, index) => {
        const incomingPlayerId = substitutePlayerIds[index]
        return incomingPlayerId
          ? [{ minute: 45, teamId: resumedGame.teamId, outgoingPlayerId, incomingPlayerId, reason: 'manual' as const }]
          : []
      })
    }
    resumedPlayback.startingGame = current.startingGame
    const finalHomeGoals = resumedPlayback.finalHomeGoals
    const finalAwayGoals = resumedPlayback.finalAwayGoals
    if (current.homeGoals > finalHomeGoals || current.awayGoals > finalAwayGoals) {
      failResume('Nie udało się wznowić relacji: wynik pierwszej połowy jest wyższy niż końcowy zapisany wynik.')
      return
    }
    const firstHalfIncidents = current.incidents.filter((incident) => incident.minute <= 45)
    resumedPlayback.incidents = continueLiveMatchIncidents(
      firstHalfIncidents,
      resumedPlayback.incidents,
      { home: current.homeGoals, away: current.awayGoals },
      { home: finalHomeGoals, away: finalAwayGoals },
      resumedPlayback.homeName,
      resumedPlayback.awayName,
    )
    const firstHalfFeed = firstHalfIncidents
    resumedPlayback.minute = 45
    resumedPlayback.homeGoals = current.homeGoals
    resumedPlayback.awayGoals = current.awayGoals
    resumedPlayback.commentary = current.commentary
    resumedPlayback.feed = firstHalfFeed.slice(-5)
    resumedPlayback.startedAt = Date.now() - MATCH_HALF_DURATION_MS
    resumedPlayback.intermissionGame = null
    resumedPlayback.halftimePaused = false
    resumedPlayback.secondHalfStarted = true
    resumedPlayback.resumeError = undefined
    resumeMatchAudio()
    persistGame(finalGame)
    setMatchPlayback(resumedPlayback)
  }

  async function handleSimulateToNextMatch(targetDateKey?: string) {
    if (!game || calendarSimulationActiveRef.current) return

    if (targetDateKey) setCalendarSimulationDate(null)
    const initialUnreadMessages = game.inboxMessages?.filter((message) => !message.read) ?? []
    if (initialUnreadMessages.length > 0) {
      setNotice(`Symulacja wstrzymana: w skrzynce czeka ${initialUnreadMessages.length} ${initialUnreadMessages.length === 1 ? 'nieprzeczytana wiadomość' : 'nieprzeczytanych wiadomości'}.`)
      return
    }
    const existingMessageIds = new Set((game.inboxMessages ?? []).map((message) => message.id))

    let nextGame = game
    let leagueRounds = 0
    let cupRounds = 0
    let pmpRounds = 0
    let otherClubMatches = 0
    let errorMessage = ''
    let inboxPause = ''
    let simulatedDate = calendarSimulationDate
      ? parseLocalDateKey(calendarSimulationDate)
      : parseLocalDateKey(nextGame.currentDate ?? `${nextGame.season.split('/')[0]}-07-01`)
    const requestedDate = targetDateKey ? parseLocalDateKey(targetDateKey) : null
    if (requestedDate && requestedDate.getTime() <= simulatedDate.getTime()) {
      setNotice('Wybierz dzień późniejszy niż aktualna data kariery.')
      return
    }
    setCalendarSimulationTargetDate(targetDateKey ?? null)
    calendarSimulationActiveRef.current = true
    setCalendarSimulationActive(true)

    const advanceCalendarTo = async (targetDateKey: string) => {
      const targetDate = parseLocalDateKey(targetDateKey)
      const boundedTargetDate = requestedDate && requestedDate.getTime() < targetDate.getTime()
        ? requestedDate
        : targetDate
      const checkCalendarMessages = (dateKey: string) => {
        const drawMessageGame = publishPolishCupDrawIfDue(nextGame, dateKey)
        if (drawMessageGame) nextGame = drawMessageGame
        nextGame.currentDate = dateKey
        const newUnreadCount = (nextGame.inboxMessages ?? []).filter((message) =>
          !message.read && !existingMessageIds.has(message.id),
        ).length
        if (newUnreadCount > 0) {
          inboxPause = drawMessageGame
            ? 'Symulacja wstrzymana: w skrzynce czeka terminarz po losowaniu Polskiego Pucharu.'
            : `Symulacja wstrzymana: otrzymano ${newUnreadCount} ${newUnreadCount === 1 ? 'nową wiadomość' : 'nowe wiadomości'}.`
          return false
        }
        return true
      }
      if (boundedTargetDate.getTime() <= simulatedDate.getTime()) {
        const dateKey = getLocalDateKey(boundedTargetDate)
        simulatedDate = boundedTargetDate
        setCalendarSimulationDate(dateKey)
        return checkCalendarMessages(dateKey) && boundedTargetDate.getTime() === targetDate.getTime()
      }
      while (simulatedDate.getTime() < boundedTargetDate.getTime()) {
        simulatedDate.setDate(simulatedDate.getDate() + 1)
        const dateKey = getLocalDateKey(simulatedDate)
        setCalendarSimulationDate(dateKey)
        await new Promise<void>((resolve) => window.setTimeout(resolve, 1_000))
        const dayResult = simulateCalendarDay(nextGame, dateKey)
        if (dayResult.error) {
          errorMessage = dayResult.error
          return false
        }
        nextGame = dayResult.game
        if (!checkCalendarMessages(dateKey)) return false
      }
      return boundedTargetDate.getTime() === targetDate.getTime()
    }

    try {
      for (let event = 0; event < 200; event += 1) {
        if (requestedDate && simulatedDate.getTime() >= requestedDate.getTime()) break
        const competition = getNextScheduledCompetition(nextGame)
        if (competition === 'season-complete') break

        if (competition === 'friendly') {
          const friendly = getNextFriendlyMatch(nextGame)
          if (!friendly?.scheduledAt) {
            errorMessage = 'Nie znaleziono terminu następnego sparingu.'
            break
          }
          if (!await advanceCalendarTo(friendly.scheduledAt)) break
          if (!requestedDate) break
          const result = playFriendlyMatch(nextGame, friendly.id)
          if (result.error) {
            errorMessage = result.error
            break
          }
          nextGame = result.game
          otherClubMatches += 1
          continue
        }

        if (competition === 'champions-cup') {
          const match = nextGame.championsCupMatch
          if (!match?.scheduledAt) {
            errorMessage = 'Nie znaleziono terminu meczu Pucharu Mistrzów.'
            break
          }
          if (!await advanceCalendarTo(match.scheduledAt)) break
          if (!requestedDate) break
          const result = playChampionsCupMatch(nextGame)
          if (result.error) {
            errorMessage = result.error
            break
          }
          nextGame = result.game
          otherClubMatches += 1
          continue
        }

        if (competition === 'promotion-playoff') {
          const playoffFixtures = nextGame.promotionPlayoffs?.fixtures.filter((fixture) =>
            fixture.round === nextGame.promotionPlayoffs?.round && !fixture.played,
          ) ?? []
          const playoffDate = playoffFixtures.map((fixture) => fixture.scheduledAt).sort()[0]
          if (playoffDate && !await advanceCalendarTo(playoffDate)) break
          if (!requestedDate && playoffFixtures.some((fixture) => fixture.homeId === nextGame.teamId || fixture.awayId === nextGame.teamId)) break
          const result = playPromotionPlayoffRound(nextGame)
          if (result.error) {
            errorMessage = result.error
            break
          }
          nextGame = result.game
          if (playoffFixtures.some((fixture) => fixture.homeId === nextGame.teamId || fixture.awayId === nextGame.teamId)) {
            otherClubMatches += 1
          }
          const newUnreadCount = (nextGame.inboxMessages ?? []).filter((message) =>
            !message.read && !existingMessageIds.has(message.id),
          ).length
          if (newUnreadCount > 0) {
            inboxPause = `Symulacja wstrzymana: otrzymano ${newUnreadCount} ${newUnreadCount === 1 ? 'nową wiadomość' : 'nowe wiadomości'}.`
            break
          }
          continue
        }

        if (competition === 'pmp-league') {
          const pmpEventDate = nextGame.pmpLeague?.matches
            .filter((match) => !match.played)
            .map((match) => match.scheduledAt)
            .filter((date): date is string => Boolean(date))
            .sort()[0]
          if (!pmpEventDate) {
            errorMessage = 'Nie znaleziono terminu kolejnego meczu Ligi PMP.'
            break
          }
          if (!await advanceCalendarTo(pmpEventDate)) break
          const userFixture = nextGame.pmpLeague?.matches.some((match) =>
            !match.played && match.scheduledAt === pmpEventDate && !match.bye
            && (match.homeId === nextGame.teamId || match.awayId === nextGame.teamId),
          )
          if (userFixture && !requestedDate) break
          const result = playPmpLeagueEvent(nextGame)
          if (result.error) {
            errorMessage = result.error
            break
          }
          nextGame = result.game
          pmpRounds += 1
          if (userFixture) otherClubMatches += 1
          continue
        }

        if (competition === 'polish-cup') {
          const nextCupEventDate = [
            ...(nextGame.polishCup?.stage === 'complete' ? [] : nextGame.polishCup?.matches ?? []),
            ...(nextGame.regionalCups ?? []).flatMap((cup) => cup.matches),
          ].filter((match) => !match.played)
            .map((match) => match.scheduledAt)
            .filter((date): date is string => Boolean(date))
            .sort()[0]
          if (nextCupEventDate && !await advanceCalendarTo(nextCupEventDate)) break
          const userCupMatchOnEventDate = nextCupEventDate && [
            ...(nextGame.polishCup?.stage === 'complete' ? [] : nextGame.polishCup?.matches ?? []),
            ...(nextGame.regionalCups ?? []).flatMap((cup) => cup.matches),
          ].some((match) =>
            !match.played
            && !match.bye
            && match.scheduledAt === nextCupEventDate
            && (match.homeId === nextGame.teamId || match.awayId === nextGame.teamId),
          )
          if (userCupMatchOnEventDate && nextCupEventDate && !requestedDate) {
            const notifiedGame = notifyPolishCupWeek(nextGame, nextCupEventDate)
            const newUnreadCount = (notifiedGame.inboxMessages ?? []).filter((message) =>
              !message.read && !existingMessageIds.has(message.id),
            ).length
            if (newUnreadCount > 0) {
              nextGame = notifiedGame
              inboxPause = `Symulacja wstrzymana: otrzymano ${newUnreadCount} ${newUnreadCount === 1 ? 'nową wiadomość' : 'nowe wiadomości'}.`
            }
            break
          }
          if (userCupMatchOnEventDate && nextCupEventDate) {
            nextGame = notifyPolishCupWeek(nextGame, nextCupEventDate)
          }
          const result = playPolishCupRound(nextGame)
          if (result.error) {
            errorMessage = result.error
            break
          }
          nextGame = result.game
          cupRounds += 1
          if (userCupMatchOnEventDate) otherClubMatches += 1
          const newUnreadCount = (nextGame.inboxMessages ?? []).filter((message) => !message.read && !existingMessageIds.has(message.id)).length
          if (newUnreadCount > 0) {
            inboxPause = `Symulacja wstrzymana: otrzymano ${newUnreadCount} ${newUnreadCount === 1 ? 'nową wiadomość' : 'nowe wiadomości'}.`
            break
          }
          continue
        }

        const scheduledMatch = getNextMatch(nextGame)
        if (!scheduledMatch) {
          errorMessage = 'Nie znaleziono kolejnego meczu w terminarzu.'
          break
        }
        const leagueEventDate = scheduledMatch.scheduledAt
          ?? nextGame.matches
            .filter((match) => match.round === nextGame.round && !match.played)
            .map((match) => match.scheduledAt)
            .filter((date): date is string => Boolean(date))
            .sort()[0]
          ?? getLocalDateKey(getLeagueRoundDate(
            nextGame.season,
            nextGame.round,
            getLeagueTier(nextGame.leagueId),
            getSeasonRoundCount(nextGame),
            getGameMatchupsPerOpponent(nextGame),
          ))
        if (!await advanceCalendarTo(leagueEventDate)) break
          if (!scheduledMatch.bye && !requestedDate) break

          let result = nextGame.pendingMatchEvent
            ? playMatchday(nextGame, getAutomaticMatchDecisionId(nextGame.pendingMatchEvent))
            : playMatchday(nextGame)
          if (result.error) {
            errorMessage = result.error
            break
          }
          if (result.game.pendingMatchEvent) {
            const decisionId = getAutomaticMatchDecisionId(result.game.pendingMatchEvent)
            if (!decisionId) {
              errorMessage = 'Nie udało się automatycznie rozegrać meczu: brak dostępnej decyzji taktycznej.'
              break
            }
            result = playMatchday(result.game, decisionId)
            if (result.error) {
              errorMessage = result.error
              break
            }
          }
          nextGame = result.game
          leagueRounds += 1
          if (!scheduledMatch.bye) otherClubMatches += 1
        const newUnreadCount = (nextGame.inboxMessages ?? []).filter((message) => !message.read && !existingMessageIds.has(message.id)).length
        if (newUnreadCount > 0) {
          inboxPause = `Symulacja wstrzymana: otrzymano ${newUnreadCount} ${newUnreadCount === 1 ? 'nową wiadomość' : 'nowe wiadomości'}.`
          break
        }
      }
    } finally {
      calendarSimulationActiveRef.current = false
      setCalendarSimulationActive(false)
      setCalendarSimulationTargetDate(null)
    }
    const finalSimulationDate = getLocalDateKey(simulatedDate)
    if (nextGame === game && finalSimulationDate !== (game.currentDate ?? `${game.season.split('/')[0]}-07-01`)) {
      nextGame = structuredClone(game)
    }
    if (nextGame !== game) nextGame.currentDate = finalSimulationDate

    if (nextGame === game) {
      if (errorMessage) {
        setNotice(errorMessage)
        if (game.sponsorRequired) setSection('finances')
      } else {
        setNotice('Następny mecz Twojego klubu jest już gotowy do rozegrania.')
      }
      return
    }

    const simulatedEvents = [
      pmpRounds ? `${pmpRounds} ${pmpRounds === 1 ? 'kolejkę Ligi PMP' : 'kolejki Ligi PMP'}` : '',
      cupRounds ? `${cupRounds} ${cupRounds === 1 ? 'rundę Polskiego Pucharu' : 'rundy Polskiego Pucharu'}` : '',
      leagueRounds ? `${leagueRounds} ${leagueRounds === 1 ? 'kolejkę ligową' : 'kolejki ligowe'}` : '',
      otherClubMatches ? `${otherClubMatches} ${otherClubMatches === 1 ? 'mecz klubu' : 'mecze klubu'} rozegrane automatycznie` : '',
    ].filter(Boolean)
    const nextCompetition = getNextScheduledCompetition(nextGame)
    const nextCupMatch = nextCompetition === 'polish-cup' ? getPolishCupNextMatch(nextGame) : undefined
    const nextChampionsCupMatch = nextCompetition === 'champions-cup' ? nextGame.championsCupMatch : undefined
    const nextLeagueMatch = nextCompetition === 'league' ? getNextMatch(nextGame) : undefined
    const nextFriendlyMatch = nextCompetition === 'friendly' ? getNextFriendlyMatch(nextGame) : undefined
    const nextMatchLabel = nextCupMatch || nextChampionsCupMatch || (nextLeagueMatch && !nextLeagueMatch.bye)
      ? 'Przed Tobą mecz — możesz jeszcze zmienić skład i taktykę.'
      : nextFriendlyMatch
        ? `Przed Tobą sparing przedsezonowy${nextFriendlyMatch.scheduledAt ? ` · ${nextFriendlyMatch.scheduledAt}` : ''}.`
      : nextCompetition === 'season-complete'
        ? 'Sezon dobiegł końca.'
        : 'Kolejny termin również nie obejmuje meczu Twojego klubu.'
    const simulatedEventsLabel = simulatedEvents.length ? simulatedEvents.join(' i ') : 'bez rozegranych spotkań'
    const targetDateLabel = requestedDate ? ` do ${getLocalDateKey(requestedDate)}` : ''
    const noticeMessage = inboxPause || `Symulacja kalendarza${targetDateLabel}: ${simulatedEventsLabel}. ${nextMatchLabel}`
    updateGame(nextGame, errorMessage ? `${noticeMessage} ${errorMessage}` : noticeMessage)
    if (errorMessage && nextGame.sponsorRequired) setSection('finances')
  }

  function handleStartSeason() {
    if (!game) return
    const result = startNewSeason(game)
    if (result.error) {
      if (result.game !== game) updateGame(result.game, result.error)
      else setNotice(result.error)
      return
    }
    const movement = game.leagueId === result.game.leagueId
      ? ''
      : ` Twój klub ${getLeagueTier(result.game.leagueId) < getLeagueTier(game.leagueId) ? 'awansował' : 'spadł'} do ${leagues.find((league) => league.id === result.game.leagueId)?.name ?? 'nowej ligi'}.`
    const review = result.game.boardHistory?.[0]
    const boardNotice = review
      ? ` Zarząd rozliczył poprzedni sezon: ${review.positionAchieved ? 'cel sportowy zrealizowany' : 'cel sportowy niezrealizowany'}, ${review.financesAchieved ? 'cel finansowy zrealizowany' : 'cel finansowy niezrealizowany'}. Zaufanie: ${review.confidenceAfter}%.`
      : ''
    updateGame(result.game, `Rozpoczął się sezon ${result.game.season}.${movement}${boardNotice} Wybierz nowego sponsora w finansach, aby zagrać pierwszy mecz.`)
    setSection('finances')
  }

  function handleTraining(focus: TrainingFocus) {
    if (!game) return
    const result = trainSquad(game, focus)
    if (result.error) {
      setNotice(result.error)
      return
    }
    const labels: Record<TrainingFocus, string> = { fitness: 'regenerację i kondycję', attack: 'wykańczanie akcji', tactics: 'zgranie i morale' }
    updateGame(result.game, `Trening: poprawiono ${labels[focus]} podstawowej jedenastki.`)
  }

  function handleResetCareer() {
    if (!window.confirm('Na pewno chcesz usunąć zapisaną karierę i wrócić do ekranu startowego?')) return
    removeStorage('polski-manager-save')
    saveSlots.forEach((slotId) => removeStorage(`polski-manager-save-${slotId}`))
    removeStorage('polski-manager-active-slot')
    setSavingError('')
    knownInboxMessageIdsRef.current = new Set()
    setAutoOpenInboxMessageId(null)
    setGame(null)
    setNotice('Kariera została usunięta. Możesz zacząć nową trasę menedżera.')
    setSection('overview')
    setSetupName(careerCustomization.clubName)
    setSetupCity('')
    setSetupLeague('ekstraklasa')
    setSetupRegion('fourth-mazowieckie')
    setSetupMode('custom')
    setSetupExistingClub(clubsByLeague.ekstraklasa[0])
    setSetupColor(careerCustomization.clubColor)
    setActiveSaveSlot('slot-1')
  }

  function handleSelectSaveSlot(slotId: typeof saveSlots[number]) {
    try {
      const stored = readStorage(`polski-manager-save-${slotId}`)
      if (!stored) {
        setNotice(`Slot ${saveSlotLabels[slotId]} jest pusty. Zacznij nową karierę albo zaimportuj zapis.`)
        setActiveSaveSlot(slotId)
        writeStorage('polski-manager-active-slot', slotId)
        return
      }
      const restored = loadGameFromJSON(stored)
      if (!restored) {
        setNotice('Nie udało się wczytać stanu z tego slotu.')
        return
      }
      persistGame(restored, slotId)
      knownInboxMessageIdsRef.current = new Set(restored.inboxMessages?.map((message) => message.id) ?? [])
      setAutoOpenInboxMessageId(null)
      setGame(restored)
      setNotice(`Wczytano ${saveSlotLabels[slotId]}: ${restored.clubName}.`)
      setSection('overview')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Nie udało się wczytać zapisu z tego slotu.')
    }
  }

  function handleExportSave() {
    if (!game) return
    const payload = JSON.stringify(game, null, 2)
    const blob = new Blob([payload], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${game.clubName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'polski-manager'}-save.json`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
    setNotice('Pobrano zapis kariery jako plik JSON.')
  }

  async function handleImportSave(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const isJsonFile = file.type === 'application/json' || file.name.toLowerCase().endsWith('.json')
      if (!isJsonFile) {
        throw new Error('Dozwolony jest tylko plik JSON z zapisem gry.')
      }

      const raw = await file.text()
      const restored = loadGameFromJSON(raw)
      if (!restored) throw new Error('Brak danych w pliku zapisu.')
      const next = structuredClone(restored)
      const availableSlot = saveSlots.find((slotId) => !readStorage(`polski-manager-save-${slotId}`))
      const targetSlot = availableSlot ?? activeSaveSlot
      if (!availableSlot && !window.confirm(`Wszystkie sloty są zajęte. Czy nadpisać ${saveSlotLabels[targetSlot]}?`)) return
      persistGame(next, targetSlot)
      knownInboxMessageIdsRef.current = new Set(next.inboxMessages?.map((message) => message.id) ?? [])
      setAutoOpenInboxMessageId(null)
      setGame(next)
      setNotice(`Wczytano zapis klubu ${next.clubName}.`)
      setSection('overview')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Nie udało się wczytać zapisanej kariery.')
    } finally {
      event.target.value = ''
    }
  }

  if (!game || !club) {
    return <SetupScreen
      name={setupName}
      city={setupCity}
      league={setupLeague}
      region={setupRegion}
      regions={getRegionsForLeague(setupLeague)}
      color={setupColor}
      mode={setupMode}
      existingClub={setupExistingClub}
      notice={notice}
      savedCareers={savedCareers}
      onLoadCareer={handleSelectSaveSlot}
      onImportSave={handleImportSave}
      musicMuted={musicMuted}
      onToggleMusic={toggleMusic}
      setName={setSetupName}
      setCity={(value) => {
        setSetupCity(value)
        setSetupRegion((currentRegion) => resolveSetupRegion(value, setupLeague, currentRegion))
      }}
      setLeague={(value) => {
        setSetupLeague(value)
        setSetupExistingClub(clubsByLeague[value][0])
        setSetupRegion((currentRegion) => resolveSetupRegion(setupCity, value, currentRegion))
      }}
      setRegion={setSetupRegion}
      setColor={setSetupColor}
      setMode={setSetupMode}
      setExistingClub={setSetupExistingClub}
      onSubmit={handleCreateClub}
    />
  }

  const pageTitle = section === 'match-stats'
    ? 'Statystyki meczu'
    : navigation.find((item) => item.id === section)?.label ?? 'Centrum klubu'
  const unreadMailCount = game.inboxMessages?.filter((message) => !message.read).length ?? 0
  const boardConfidence = game.boardConfidence ?? 65
  const boardConfidenceLabel = boardConfidence >= 70
    ? 'Zarząd jest zadowolony'
    : boardConfidence >= 40
      ? 'Zarząd oczekuje poprawy'
      : 'Niskie zaufanie zarządu'
  const leagueName = leagues.find((item) => item.id === game.leagueId)?.name ?? 'Liga Polska'
  const recentMatches = game.matches
    .filter((match) => match.played && (match.homeId === game.teamId || match.awayId === game.teamId))
    .slice(-4)
    .reverse()

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`}>
      <a className="brand" href="#" onClick={(event) => { event.preventDefault(); navigateToSection('overview') }}>
        <span className="brand-mark"><img src="/images/pmp27-crest.png" alt="" /></span>
        <span>PMP27<small>POLSKI MANAGER PIŁKARSKI 2027</small></span>
      </a>
      <div className="sidebar-club">
        <ClubCrest name={game.clubName} seedKey={game.teamId} color={game.clubColor} imageSrc={getClubCrestImage(game, game.teamId)} />
        <span><strong>{game.clubName}</strong><small><MapPin size={11} />{game.city}</small></span>
        <ChevronDown size={15} />
      </div>
      <div className="sidebar-caption">ZARZĄDZANIE KLUBEM</div>
      <nav aria-label="Menu klubu">
        {navigation.map(({ id, label, icon: Icon }) => <button key={id} className={section === id ? 'nav-item nav-item-active' : 'nav-item'} onClick={() => navigateToSection(id)}>
          <Icon size={17} /><span>{label}</span>{id === 'matches' && nextMatch && <i className="nav-dot" />}{id === 'inbox' && unreadMailCount > 0 && <i className="nav-mail-count">{unreadMailCount > 99 ? '99+' : unreadMailCount}</i>}
        </button>)}
      </nav>
      <div className="sidebar-spacer" />
      <div className="side-season"><span>SEZON</span><strong>{game.season}</strong><small>{leagueName}</small></div>
      <div className="save-slot-panel">
        <span className="save-slot-label">ZAPISY LOKALNE</span>
        <div className="save-slot-list">
          {saveSlots.map((slotId) => {
            const meta = getSaveMeta(slotId)
            return <button key={slotId} type="button" className={slotId === activeSaveSlot ? 'save-slot save-slot-active' : 'save-slot'} onClick={() => handleSelectSaveSlot(slotId)}>
              <strong>{saveSlotLabels[slotId]}</strong>
              <span>{meta ? `${meta.clubName} · ${meta.season}` : 'Pusty slot'}</span>
            </button>
          })}
        </div>
      </div>
      <div className="sidebar-action-stack">
        <button className="sidebar-reset-button" onClick={handleResetCareer}><RotateCcw size={15} /> Nowa kariera</button>
        <button className="sidebar-ghost-button" onClick={handleExportSave}><ArrowDownLeft size={15} /> Eksport zapisu</button>
        <button className="sidebar-ghost-button" onClick={() => fileInputRef.current?.click()}><ArrowUpRight size={15} /> Import zapisu</button>
      </div>
      <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleImportSave} />
      <button className="sidebar-help" onClick={() => setNotice('To wczesny prototyp gry. Postępy zapisują się lokalnie w tej przeglądarce.')}><CircleHelp size={16} /> Pomoc i informacje</button>
      <div className={`sidebar-footer ${savingError ? 'sidebar-footer-error' : ''}`} role="status" aria-live="polite">
        <span className="online-dot" />
        {savingError ? 'Błąd zapisu kariery' : 'Kariera zapisana lokalnie'}
      </div>
    </aside>
    {mobileNavOpen && <button className="mobile-scrim" aria-label="Zamknij menu" onClick={() => setMobileNavOpen(false)} />}

    <main className="main-area">
      <header className="topbar">
        <button className="icon-button mobile-menu-button" aria-label="Otwórz menu" onClick={() => setMobileNavOpen(true)}><Menu size={20} /></button>
        <button className="topbar-brand" type="button" aria-label="PMP27 — przejdź do centrum klubu" onClick={() => navigateToSection('overview')}>
          <img src="/images/pmp27-wordmark.png" alt="PMP27" />
        </button>
        <div className="breadcrumbs"><span>KLUB</span><ArrowRight size={13} /><strong>{pageTitle}</strong></div>
        <div className="topbar-right">
          <span className="season-pill"><span /> Sezon {game.season}</span>
          {section === 'overview' && <button type="button" className="topbar-budget-pill" onClick={() => navigateToSection('finances')} aria-label={`Budżet klubu ${formatMoney(game.cash)}. Otwórz finanse`}>
            <Wallet size={13} /><span>Budżet</span><strong>{formatMoney(game.cash)}</strong>
          </button>}
          <span
            className={`board-confidence-pill ${boardConfidence >= 70 ? 'board-confidence-high' : boardConfidence >= 40 ? 'board-confidence-medium' : 'board-confidence-low'}`}
            title={`${boardConfidenceLabel} · wyniki i realizacja celów sezonowych`}
            aria-label={`${boardConfidenceLabel}: ${boardConfidence}%`}
          ><Landmark size={13} /><span>Zarząd</span><strong>{boardConfidence}%</strong></span>
          <span className="topbar-divider" />
          <div className="manager-avatar">MK</div><span className="manager-name">Menedżer klubu</span>
        </div>
      </header>

      <div className="page-content">
        <div className="page-heading">
          <div><p className="eyebrow">CENTRUM ZARZĄDZANIA</p><h1>{pageTitle}</h1></div>
          <button className="date-pill" onClick={() => navigateToSection('calendar')}><CalendarDays size={15} />{nextCompetition === 'friendly'
            ? `Sparing ${nextFriendlyMatch?.round ?? 1} / ${game.preseasonFriendlies?.length ?? 3}`
            : nextCompetition === 'champions-cup'
            ? 'Puchar Mistrzów'
            : nextCompetition === 'polish-cup'
            ? nextCupMatch
              ? `${getCupCompetitionLabel(game, nextCupMatch)} · runda ${nextCupMatch.round}`
              : `Polski Puchar · po kolejce ${game.polishCup?.scheduledAfterLeagueRound ?? 1}`
            : nextCompetition === 'pmp-league'
            ? 'Liga PMP · turniej zimowy'
            : `Kolejka ${Math.min(game.round, getSeasonRoundCount(game))} / ${getSeasonRoundCount(game)}`}
          </button>
        </div>
        {notice && <div className="notice"><Sparkles size={16} /><span>{notice}</span><button aria-label="Zamknij komunikat" onClick={() => setNotice('')}><X size={15} /></button></div>}
        {savingError && <div className="notice notice-error"><CircleHelp size={16} /><span>{savingError}</span><button aria-label="Zamknij komunikat" onClick={() => setSavingError('')}><X size={15} /></button></div>}

        {section === 'overview' && <OverviewPage
          game={game}
          club={club}
          table={table}
          clubPosition={clubPosition}
          nextMatch={nextMatch}
          opponentId={opponentId}
          isHome={isHome}
          rating={clubRating}
          recentMatches={recentMatches}
          nextCompetition={nextCompetition}
          nextCupMatch={nextCupMatch}
          nextChampionsCupMatch={nextChampionsCupMatch}
          nextPmpMatch={nextPmpMatch}
          pmpOpponentId={pmpOpponentId}
          nextFriendlyMatch={nextFriendlyMatch}
          calendarSimulationDate={calendarSimulationDate}
          calendarSimulationActive={calendarSimulationActive}
          onPlay={handlePlayMatch}
          onSimulateToNextMatch={handleSimulateToNextMatch}
          onUpdate={updateGame}
          onOpenClubProfile={(teamId) => setClubProfileTeamId(teamId)}
          onStartSeason={handleStartSeason}
          onNavigate={navigateToSection}
          onNavigateToSponsorOffers={navigateToSponsorOffers}
        />}
        {section === 'calendar' && <CalendarPage
          game={game}
          nextMatch={nextMatch}
          nextCompetition={nextCompetition}
          nextCupMatch={nextCupMatch}
          nextChampionsCupMatch={nextChampionsCupMatch}
          nextFriendlyMatch={nextFriendlyMatch}
          calendarSimulationActive={calendarSimulationActive}
          calendarSimulationDate={calendarSimulationDate}
          calendarSimulationTargetDate={calendarSimulationTargetDate}
          onSimulateToDate={handleSimulateToNextMatch}
          onStartSeason={handleStartSeason}
          onNavigate={navigateToSection}
        />}
        {section === 'squad' && <SquadPage game={game} onUpdate={updateGame} onTrain={handleTraining} onOpenProfile={(player) => setPlayerProfile({ player, clubName: game.clubName, isOwnPlayer: true })} />}
        {section === 'availability' && <AvailabilityPage game={game} onOpenProfile={(player) => setPlayerProfile({ player, clubName: game.clubName, isOwnPlayer: true })} />}
        {section === 'tactics' && <MatchSetupPage game={game} nextMatch={nextMatch} nextCompetition={nextCompetition} nextCupMatch={nextCupMatch} nextChampionsCupMatch={nextChampionsCupMatch} onUpdate={updateGame} />}
        {section === 'matches' && <MatchesPage game={game} nextMatch={nextMatch} nextCompetition={nextCompetition} nextFriendlyMatch={nextFriendlyMatch} nextChampionsCupMatch={nextChampionsCupMatch} onNavigate={navigateToSection} />}
        {section === 'match-stats' && matchStatistics && <MatchStatisticsPage id="match-statistics-page" playback={matchStatistics} onBack={returnToClubOverview} />}
        {section === 'standings' && <section className="panel-card table-panel"><div className="panel-heading"><div><p className="eyebrow">KLASYFIKACJA</p><h2>Tabela ligowa · {leagueName}</h2></div><span className="table-season-tag">{game.season}</span></div><LeagueTable game={game} table={table} clubId={game.teamId} onOpenClubProfile={(teamId) => setClubProfileTeamId(teamId)} /></section>}
        {section === 'statistics' && <LeagueStatisticsPage game={game} />}
        {section === 'player-statistics' && <PlayerStatisticsPage game={game} onOpenProfile={(player) => setPlayerProfile({ player, clubName: game.clubName, isOwnPlayer: true })} />}
        {section === 'other-leagues' && <OtherLeaguesPage game={game} onOpenClubProfile={(teamId) => setClubProfileTeamId(teamId)} />}
        {section === 'cup' && <PolishCupPage game={game} nextCompetition={nextCompetition} onNavigate={navigateToSection} />}
        {section === 'regional-cup' && <RegionalCupPage game={game} onNavigate={navigateToSection} />}
        {section === 'pmp-league' && <PmpLeaguePage game={game} onNavigate={navigateToSection} />}
        {section === 'transfers' && <TransfersPage
          game={game}
          search={search}
          positionFilter={positionFilter}
          setSearch={setSearch}
          setPositionFilter={setPositionFilter}
          onUpdate={updateGame}
          onOpenProfile={(player, clubName) => setPlayerProfile({ player, clubName, isOwnPlayer: false })}
        />}
        {section === 'inbox' && <MailboxPage
          key={autoOpenInboxMessageId ?? 'inbox'}
          game={game}
          onUpdate={updateGame}
          onNavigate={navigateToSection}
          onNavigateToSponsorOffers={navigateToSponsorOffers}
          autoOpenMessageId={autoOpenInboxMessageId}
        />}
        {section === 'scouting' && <ScoutingPage game={game} onUpdate={updateGame} />}
        {section === 'academy' && <AcademyPage game={game} onUpdate={updateGame} />}
        {section === 'finances' && <FinancesPage game={game} onUpdate={updateGame} onNavigate={navigateToSection} />}
        {section === 'settings' && <GameSettingsPage
          musicMuted={musicMuted}
          musicVolume={musicVolume}
          onMusicEnabledChange={setMusicEnabled}
          onMusicVolumeChange={updateMusicVolume}
        />}
        {isDeferredSection(section) && <Suspense fallback={<div className="panel-card empty-state" role="status">Wczytywanie sekcji…</div>}>
          <DeferredPages section={section} game={game} onUpdate={updateGame} />
        </Suspense>}

        <footer className="page-footer"><img className="page-footer-brand" src="/images/pmp27-wordmark.png" alt="PMP27" /><span>Autorskie wyceny zawodników · dane kariery w tej przeglądarce</span></footer>
      </div>
    </main>
    {playerProfile && <PlayerProfileModal
      player={playerProfile.isOwnPlayer ? game.squad.find((player) => player.id === playerProfile.player.id) ?? playerProfile.player : playerProfile.player}
      clubName={playerProfile.clubName}
      isOwnPlayer={playerProfile.isOwnPlayer}
      game={game}
      onUpdate={updateGame}
      onClose={() => setPlayerProfile(null)}
    />}
    {clubProfileTeamId && <ClubProfileModal key={clubProfileTeamId} game={game} teamId={clubProfileTeamId} onUpdate={updateGame} onClose={() => setClubProfileTeamId(null)} />}
    {matchPlayback && <LiveMatchOverlay
      key={matchPlayback.id}
      playback={matchPlayback}
      onIntermissionUpdate={(intermissionGame) => setMatchPlayback((current) =>
        current && current.id === matchPlayback.id ? { ...current, intermissionGame } : current,
      )}
      onResume={handleResumeMatchPlayback}
      onSkip={() => setMatchPlayback((current) => {
        if (!current) return current
        const halftimeIncident = current.incidents.filter((incident) => incident.minute <= 45).at(-1)
        return {
          ...current,
          minute: 45,
          homeGoals: halftimeIncident?.homeGoals ?? current.homeGoals,
          awayGoals: halftimeIncident?.awayGoals ?? current.awayGoals,
          commentary: halftimeIncident?.message ?? current.commentary,
          feed: current.incidents.filter((incident) => incident.minute <= 45).slice(-5),
          halftimePaused: true,
        }
      })}
      onShowStatistics={() => {
        if (!matchPlayback?.finished) return
        setMatchStatistics(matchPlayback)
        setMatchPlayback(null)
        scrollToMatchStatisticsRef.current = true
        navigateToSection('match-stats')
      }}
    />}
  </div>
}

function SetupScreen(props: {
  name: string
  city: string
  league: LeagueId
  region: string
  regions: string[]
  color: string
  mode: 'custom' | 'existing'
  existingClub: string
  notice: string
  savedCareers: Array<{
    slotId: typeof saveSlots[number]
    label: string
    clubName: string
    season: string
    round: number
  }>
  onLoadCareer: (slotId: typeof saveSlots[number]) => void
  onImportSave: (event: React.ChangeEvent<HTMLInputElement>) => void
  musicMuted: boolean
  onToggleMusic: () => void
  setName: (value: string) => void
  setCity: (value: string) => void
  setLeague: (value: LeagueId) => void
  setRegion: (value: string) => void
  setColor: (value: string) => void
  setMode: (value: 'custom' | 'existing') => void
  setExistingClub: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  const colors = ['#d8fa54', '#ff744d', '#73b8ff', '#e98bdb', '#f1c65b']
  const [clubSearchQuery, setClubSearchQuery] = useState('')
  const regions: Array<{ id: string; name: string }> = props.regions.flatMap((id) => {
    const region = regionalOptions.find((option) => option.id === id)
    return region ? [{ id: region.id, name: region.name }] : []
  })
  const clubOptions = clubsByLeague[props.league]
  const filteredClubs = clubOptions.filter((club) =>
    `${club} ${getClubCity(club)}`.toLocaleLowerCase('pl').includes(clubSearchQuery.trim().toLocaleLowerCase('pl')),
  )
  const slogans = [
    {
      eyebrow: 'TWOJA HISTORIA ZACZYNA SIĘ TUTAJ',
      firstLine: 'Od lokalnego boiska',
      secondLine: 'do',
      highlight: 'wielkiej piłki.',
      description: 'Buduj klub, odkrywaj talenty i poprowadź swoją drużynę na szczyt polskiej ligi.',
    },
    {
      eyebrow: 'KAŻDY KLUB ZACZYNA OD MARZEŃ',
      firstLine: 'Zbuduj drużynę,',
      secondLine: 'która',
      highlight: 'zapisze się w historii.',
      description: 'Wybieraj mądrze, rozwijaj zawodników i twórz własną piłkarską opowieść.',
    },
    {
      eyebrow: 'TWOJE DECYZJE · TWOJA DROGA',
      firstLine: 'Poprowadź klub',
      secondLine: 'prosto',
      highlight: 'na szczyt ligi.',
      description: 'Znajdź talenty, buduj silną kadrę i walcz o miejsce wśród najlepszych.',
    },
    {
      eyebrow: 'PIŁKARSKA PASJA ZACZYNA SIĘ TUTAJ',
      firstLine: 'Od pierwszego gwizdka',
      secondLine: 'do',
      highlight: 'wielkich zwycięstw.',
      description: 'Zostań menedżerem, który odmieni losy swojego klubu.',
    },
  ]
  const [sloganIndex, setSloganIndex] = useState(0)
  const [sloganVisible, setSloganVisible] = useState(true)
  const [startView, setStartView] = useState<'new' | 'load'>('new')
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const slogan = slogans[sloganIndex]
  const selectableLeagues = leagues.filter((league) => league.selectable !== false)
  const getLeagueDistrictName = (leagueName: string) => {
    const districtName = leagueName.split('·').slice(1).join('·').trim()
    return districtName.replace(/(?:,|·)\s*grupa\s+\d+$/i, '').trim()
  }
  const leagueOptionsByTier = transferMarketTiers
    .map((tier) => ({
      ...tier,
      leagues: selectableLeagues
        .filter((league) => getLeagueTier(league.id) === tier.tier)
        .sort((first, second) => {
          if (tier.tier < 6) return 0
          return getLeagueDistrictName(first.name).localeCompare(getLeagueDistrictName(second.name), 'pl', { numeric: true, sensitivity: 'base' })
            || first.name.localeCompare(second.name, 'pl', { numeric: true, sensitivity: 'base' })
        }),
    }))
    .filter((tier) => tier.leagues.length > 0)

  useEffect(() => {
    if (sloganVisible) {
      const hideTimer = window.setTimeout(() => setSloganVisible(false), 5000)
      return () => window.clearTimeout(hideTimer)
    }
    const showTimer = window.setTimeout(() => {
      setSloganIndex((current) => (current + 1) % slogans.length)
      setSloganVisible(true)
    }, 3000)
    return () => window.clearTimeout(showTimer)
  }, [sloganVisible, slogans.length])

  return <div className="setup-screen">
    <button className="setup-music-toggle" type="button" aria-pressed={props.musicMuted} onClick={props.onToggleMusic}>
      {props.musicMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
      {props.musicMuted ? 'Włącz muzykę' : 'Wycisz muzykę'}
    </button>
    <div className="setup-left">
      <a className="brand" href="#"><span className="brand-mark"><img src="/images/pmp27-crest.png" alt="" /></span><span>PMP27<small>POLSKI MANAGER PIŁKARSKI 2027</small></span></a>
      <div className={`setup-copy ${sloganVisible ? '' : 'setup-copy-hidden'}`}><p className="eyebrow">{slogan.eyebrow}</p><h1>{slogan.firstLine}<br />{slogan.secondLine} <em>{slogan.highlight}</em></h1><p>{slogan.description}</p>
        <div className="setup-feature-list"><span><Check size={15} /> Zbuduj klub od podstaw</span><span><Check size={15} /> Rozwijaj kadrę i odkrywaj talenty</span><span><Check size={15} /> Walcz o awans i mistrzostwo</span></div>
      </div>
      <div className="setup-footer">PMP27 <i>·</i> POLSKI MANAGER PIŁKARSKI 2027</div>
    </div>
    <div className="setup-right">
      <div className="setup-form-wrap">
        <div className="setup-mobile-mark"><img src="/images/pmp27-crest.png" alt="PMP27 — Polski Manager Piłkarski 2027" /></div>
        <div className="setup-start-tabs" role="group" aria-label="Wybór na stronie głównej">
          <button type="button" aria-pressed={startView === 'new'} className={startView === 'new' ? 'setup-start-tab setup-start-tab-active' : 'setup-start-tab'} onClick={() => setStartView('new')}>Nowa kariera</button>
          <button type="button" aria-pressed={startView === 'load'} className={startView === 'load' ? 'setup-start-tab setup-start-tab-active' : 'setup-start-tab'} onClick={() => setStartView('load')}>Wczytaj karierę{props.savedCareers.length > 0 ? ` · ${props.savedCareers.length}` : ''}</button>
        </div>
        {props.notice && <div className="setup-error">{props.notice}</div>}
        {startView === 'load' ? <section className="setup-saved-careers" aria-label="Zapisane kariery">
          <div className="setup-saved-careers-heading"><div><p className="eyebrow">WRÓĆ DO GRY</p><h3>Twoje kariery</h3></div><span>{props.savedCareers.length}</span></div>
          {props.savedCareers.length > 0
            ? <div className="setup-saved-career-list">{props.savedCareers.map((career) => <article className="setup-saved-career" key={career.slotId}>
              <div><strong>{career.clubName}</strong><small>{career.label} · Sezon {career.season} · Kolejka {career.round}</small></div>
              <button type="button" className="setup-saved-career-load" onClick={() => props.onLoadCareer(career.slotId)}>Wczytaj <ArrowRight size={14} /></button>
            </article>)}</div>
            : <p className="setup-empty-saves">Nie ma jeszcze lokalnie zapisanych karier. Możesz wczytać zapis z pliku JSON.</p>}
          <input ref={importInputRef} type="file" accept="application/json,.json" hidden onChange={props.onImportSave} />
          <button type="button" className="setup-import-career" onClick={() => importInputRef.current?.click()}><ArrowUpRight size={15} /> Wczytaj karierę z pliku JSON</button>
        </section> : <>
          <p className="eyebrow">NOWA KARIERA · 01 / 03</p>
          <h2>Załóż swój klub</h2>
          <p className="setup-intro">Stwórz własną drużynę od podstaw albo przejmij klub grający w polskiej lidze.</p>
          <form className="setup-form" onSubmit={props.onSubmit}>
            <div className="setup-mode-picker" role="group" aria-label="Sposób rozpoczęcia kariery">
              <button type="button" className={props.mode === 'custom' ? 'setup-mode-option setup-mode-selected' : 'setup-mode-option'} onClick={() => props.setMode('custom')}><span className="setup-mode-icon"><Sparkles size={16} /></span><span><strong>Własny klub</strong><small>Zacznij od podstaw</small></span>{props.mode === 'custom' && <Check className="setup-mode-check" size={15} />}</button>
              <button type="button" className={props.mode === 'existing' ? 'setup-mode-option setup-mode-selected' : 'setup-mode-option'} onClick={() => props.setMode('existing')}><span className="setup-mode-icon"><Trophy size={16} /></span><span><strong>Przejmij klub</strong><small>Wybierz istniejący</small></span>{props.mode === 'existing' && <Check className="setup-mode-check" size={15} />}</button>
            </div>
            {props.mode === 'custom' ? <>
              <label>Nazwa klubu<input value={props.name} onChange={(event) => props.setName(event.target.value)} placeholder="np. KS Błyskawica" maxLength={36} required /><small>Nazwa zostanie zapamiętana na tym urządzeniu dla kolejnych karier</small></label>
              <label>Miasto<input value={props.city} onChange={(event) => props.setCity(event.target.value)} placeholder="np. Radom" maxLength={40} /></label>
              {regions.length > 1 && <label>Województwo klubu<select value={props.region} onChange={(event) => props.setRegion(event.target.value)}>{regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}</select><small>Region określa grupę IV ligi, do której klub trafi po spadku.</small></label>}
            </> : <div className="setup-club-picker">
              <label htmlFor="setup-club-search">Wybierz klub</label>
              <div className="setup-club-selected">
                <span className="setup-club-selected-mark"><Shield size={16} /></span>
                <span><strong>{props.existingClub}</strong><small><MapPin size={11} />{getClubCity(props.existingClub)}</small></span>
                <Check size={15} />
              </div>
              <div className="setup-club-search">
                <Search size={15} aria-hidden="true" />
                <input
                  id="setup-club-search"
                  type="search"
                  value={clubSearchQuery}
                  onChange={(event) => setClubSearchQuery(event.target.value)}
                  placeholder="Szukaj po nazwie lub mieście"
                  autoComplete="off"
                  aria-label="Szukaj klubu po nazwie lub mieście"
                />
              </div>
              <div className="setup-club-results" role="listbox" aria-label="Kluby w wybranej lidze">
                {filteredClubs.length > 0
                  ? filteredClubs.map((club) => <button
                    key={club}
                    type="button"
                    role="option"
                    aria-selected={club === props.existingClub}
                    className={club === props.existingClub ? 'setup-club-result setup-club-result-selected' : 'setup-club-result'}
                    onClick={() => props.setExistingClub(club)}
                  >
                    <span><strong>{club}</strong><small><MapPin size={10} />{getClubCity(club)}</small></span>
                    {club === props.existingClub && <Check size={14} />}
                  </button>)
                  : <p className="setup-club-no-results">Nie znaleziono klubu pasującego do wyszukiwania.</p>}
              </div>
              <small className="setup-club-help">Własna zapisana nazwa klubu i herb zostaną użyte również dla tej kariery.</small>
            </div>}
            <label>Poziom rozgrywek<select value={props.league} onChange={(event) => {
              setClubSearchQuery('')
              props.setLeague(event.target.value as LeagueId)
            }}>
              {leagueOptionsByTier.map((tier) => <optgroup key={tier.tier} label={`${tier.name} · poziom ${tier.tier}`}>{tier.leagues.map((league) => <option key={league.id} value={league.id}>{league.name} — {league.subtitle}{getLeagueTier(league.id) === 8 ? ' · polecany start' : ''}</option>)}</optgroup>)}
            </select><small>Polecamy zacząć od B-klasy. W regionach bez dostępnej B-klasy wybierz najniższą dostępną ligę.</small>{getLeagueTier(props.league) >= 6 && <small>W niższych ligach Podkarpacia, Zachodniopomorskiego, Pomorskiego, Warmińsko-Mazurskiego i Opolskiego działa autorski, uproszczony model awansów i spadków.</small>}</label>
            <div className="color-picker-field"><span>Kolory klubowe</span><div>{colors.map((color) => <button key={color} type="button" className={props.color === color ? 'color-swatch selected' : 'color-swatch'} style={{ background: color }} aria-label={`Wybierz kolor ${color}`} onClick={() => props.setColor(color)} />)}</div></div>
            <button className="primary-button setup-submit" type="submit" disabled={props.mode === 'custom' && (!props.name.trim() || !props.city.trim())}>Rozpocznij karierę <ArrowRight size={17} /></button>
          </form>
          {props.mode === 'existing' && <p className="setup-fiction-note"><Shield size={13} /> Uwaga: zawodnicy i statystyki są fikcyjne, nie odpowiadają aktualnej kadrze klubu.</p>}
          <p className="local-save-note"><Shield size={13} /> Kariera zapisze się lokalnie na tym urządzeniu.</p>
        </>}
      </div>
    </div>
  </div>
}

function GameSettingsPage({ musicMuted, musicVolume, onMusicEnabledChange, onMusicVolumeChange }: {
  musicMuted: boolean
  musicVolume: number
  onMusicEnabledChange: (enabled: boolean) => void
  onMusicVolumeChange: (volume: number) => void
}) {
  const musicEnabled = !musicMuted
  return <section className="panel-card game-settings-panel">
    <div className="panel-heading">
      <div><p className="eyebrow">DŹWIĘK I ROZGRYWKA</p><h2>Ustawienia gry</h2></div>
      <span className="settings-heading-icon"><Settings size={17} /></span>
    </div>
    <div className="game-settings-group">
      <div className="game-setting-row">
        <div><strong>Muzyka w tle</strong><p>Losowe soundtracki odtwarzane w pętli podczas gry.</p></div>
        <button
          type="button"
          className={`game-setting-switch ${musicEnabled ? 'game-setting-switch-on' : ''}`}
          role="switch"
          aria-checked={musicEnabled}
          aria-label="Muzyka w tle"
          onClick={() => onMusicEnabledChange(!musicEnabled)}
        ><span /></button>
      </div>
      <label className="game-setting-volume">
        <span><strong>Głośność muzyki</strong><output>{musicVolume}%</output></span>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={musicVolume}
          aria-label="Głośność muzyki w tle"
          onChange={(event) => onMusicVolumeChange(Number(event.target.value))}
        />
        <small>Zalecany poziom początkowy to 20%. Możesz dopasować go do własnych preferencji.</small>
      </label>
    </div>
    <p className="game-settings-note"><Volume2 size={14} /> Ustawienia zapisywane są lokalnie w tej przeglądarce. Jeśli przeglądarka zablokuje autoodtwarzanie, muzyka rozpocznie się po pierwszej interakcji ze stroną.</p>
  </section>
}

function OverviewPage(props: {
  game: GameState
  club: GameState['teams'][number]
  table: GameState['teams']
  clubPosition: number
  nextMatch: ReturnType<typeof getNextMatch>
  opponentId: string
  isHome: boolean
  rating: number
  recentMatches: GameState['matches']
  nextCompetition: ReturnType<typeof getNextScheduledCompetition>
  nextCupMatch?: PolishCupMatch
  nextChampionsCupMatch?: Match
  nextPmpMatch?: PmpLeagueMatch
  pmpOpponentId: string
  nextFriendlyMatch?: FriendlyMatch
  calendarSimulationDate: string | null
  calendarSimulationActive: boolean
  onPlay: () => void
  onSimulateToNextMatch: () => void
  onUpdate: (game: GameState, message?: string) => void
  onOpenClubProfile: (teamId: string) => void
  onStartSeason: () => void
  onNavigate: (section: Section) => void
  onNavigateToSponsorOffers: () => void
}) {
  const unreadMailCount = props.game.inboxMessages?.filter((message) => !message.read).length ?? 0
  const pmpClubMatch = props.nextCompetition === 'pmp-league'
    ? getPmpLeagueNextMatch(props.game)
    : undefined
  const pmpMatchOpponentId = pmpClubMatch
    ? pmpClubMatch.homeId === props.game.teamId ? pmpClubMatch.awayId : pmpClubMatch.homeId
    : ''
  const friendlyOpponentId = props.nextFriendlyMatch
    ? props.nextFriendlyMatch.homeId === props.game.teamId ? props.nextFriendlyMatch.awayId : props.nextFriendlyMatch.homeId
    : ''
  const friendlyOpponent = friendlyOpponentId
    ? props.game.teams.find((team) => team.id === friendlyOpponentId)
      ?? props.game.polishCup?.teams.find((team) => team.id === friendlyOpponentId)
      ?? props.game.regionalCups?.flatMap((cup) => cup.teams).find((team) => team.id === friendlyOpponentId)
    : null
  const cupOpponentId = props.nextCupMatch
    ? props.nextCupMatch.homeId === props.game.teamId ? props.nextCupMatch.awayId : props.nextCupMatch.homeId
    : ''
  const leagueOpponent = props.nextMatch ? props.game.teams.find((team) => team.id === props.opponentId) : null
  const cupOpponent = cupOpponentId
    ? props.game.teams.find((team) => team.id === cupOpponentId)
      ?? props.game.polishCup?.teams.find((team) => team.id === cupOpponentId)
      ?? props.game.regionalCups?.flatMap((cup) => cup.teams).find((team) => team.id === cupOpponentId)
      ?? null
    : null
  const playoffFixture = props.nextCompetition === 'promotion-playoff'
    ? props.game.promotionPlayoffs?.fixtures.find((fixture) =>
      fixture.round === props.game.promotionPlayoffs?.round && !fixture.played
      && (fixture.homeId === props.game.teamId || fixture.awayId === props.game.teamId),
    )
    : undefined
  const playoffOpponentId = playoffFixture
    ? playoffFixture.homeId === props.game.teamId ? playoffFixture.awayId : playoffFixture.homeId
    : ''
  const playoffOpponent = playoffOpponentId
    ? Object.values(props.game.leagueWorld ?? {}).flat().find((team) => team.id === playoffOpponentId) ?? null
    : null
  const championsCupOpponentId = props.nextChampionsCupMatch
    ? props.nextChampionsCupMatch.homeId === props.game.teamId
      ? props.nextChampionsCupMatch.awayId
      : props.nextChampionsCupMatch.homeId
    : ''
  const championsCupOpponent = championsCupOpponentId
    ? Object.values(props.game.leagueWorld ?? {}).flat().find((team) => team.id === championsCupOpponentId)
      ?? props.game.polishCup?.teams.find((team) => team.id === championsCupOpponentId)
      ?? null
    : null
  const pmpOpponent = pmpClubMatch
    ? props.game.pmpLeague?.teams.find((team) => team.id === pmpMatchOpponentId)
      ?? Object.values(props.game.leagueWorld ?? {}).flat().find((team) => team.id === pmpMatchOpponentId)
      ?? null
    : null
  const opponent = props.nextCompetition === 'polish-cup' && props.nextCupMatch
    ? cupOpponent
    : props.nextCompetition === 'champions-cup'
      ? championsCupOpponent
      : props.nextCompetition === 'pmp-league'
        ? pmpOpponent
      : props.nextCompetition === 'friendly' ? friendlyOpponent
        : props.nextCompetition === 'promotion-playoff' ? playoffOpponent : leagueOpponent
  const cupIsHome = props.nextCupMatch?.homeId === props.game.teamId
  const matchIsHome = props.nextCompetition === 'polish-cup' && props.nextCupMatch
    ? cupIsHome
    : props.nextCompetition === 'champions-cup' && props.nextChampionsCupMatch
      ? props.nextChampionsCupMatch.homeId === props.game.teamId
    : props.nextCompetition === 'pmp-league' && pmpClubMatch
      ? pmpClubMatch.homeId === props.game.teamId
    : props.nextCompetition === 'friendly' && props.nextFriendlyMatch
      ? props.nextFriendlyMatch.homeId === props.game.teamId
    : props.nextCompetition === 'promotion-playoff' && playoffFixture
      ? playoffFixture.homeId === props.game.teamId
      : props.isHome
  const hasUpcomingMatch = Boolean((props.nextCompetition === 'polish-cup' && props.nextCupMatch)
    || (props.nextCompetition === 'champions-cup' && props.nextChampionsCupMatch)
    || (props.nextCompetition === 'pmp-league' && pmpClubMatch)
    || (props.nextCompetition === 'friendly' && props.nextFriendlyMatch)
    || (props.nextCompetition === 'league' && props.nextMatch && !props.nextMatch.bye)
    || playoffFixture)
  const upcomingMatchId = props.nextCompetition === 'friendly'
    ? props.nextFriendlyMatch?.id
    : props.nextCompetition === 'polish-cup'
      ? props.nextCupMatch?.id
      : props.nextCompetition === 'champions-cup'
        ? props.nextChampionsCupMatch?.id
      : props.nextCompetition === 'pmp-league'
        ? pmpClubMatch?.id
      : props.nextCompetition === 'promotion-playoff'
        ? playoffFixture?.id
        : props.nextMatch?.id
  const isRegionalCupMatch = Boolean(
    props.nextCompetition === 'polish-cup'
    && props.nextCupMatch
    && getRegionalCupForMatch(props.game, props.nextCupMatch),
  )
  const localDerby = Boolean(opponent && isLocalDerby(
    props.game,
    opponent.name,
    isRegionalCupMatch ? 'regional-cup' : undefined,
  ))
  const derbyKind = opponent
    ? getDerbyKind(props.game, opponent.name, isRegionalCupMatch ? 'regional-cup' : undefined)
    : null
  const opponentRivalry = (props.nextCompetition === 'league' || props.nextCompetition === 'polish-cup') && opponent
    ? props.game.clubRivalries?.find((rivalry) => rivalry.opponentId === opponent.id)
    : undefined
  const featuredRivalry = opponentRivalry
    && (localDerby || opponentRivalry.rivalryPoints >= 3)
    ? opponentRivalry
    : undefined
  const selectedPreparation = upcomingMatchId && props.game.pendingMatchPreparation?.matchId === upcomingMatchId
    ? props.game.pendingMatchPreparation.choice
    : undefined
  const selectedConference = upcomingMatchId && props.game.pendingMatchConference?.matchId === upcomingMatchId
    ? props.game.pendingMatchConference.choice
    : undefined
  const selectedDerbyAction = upcomingMatchId && props.game.pendingDerbyMatchAction?.matchId === upcomingMatchId
    ? props.game.pendingDerbyMatchAction.choice
    : undefined
  const nextMatchDate = useMemo(() => props.nextCompetition === 'friendly' && props.nextFriendlyMatch?.scheduledAt
    ? parseLocalDateKey(props.nextFriendlyMatch.scheduledAt)
    : props.nextCompetition === 'polish-cup' && props.nextCupMatch
    ? getCupFixtureSchedule(props.game, props.nextCupMatch).date
    : props.nextCompetition === 'champions-cup' && props.nextChampionsCupMatch?.scheduledAt
      ? parseLocalDateKey(props.nextChampionsCupMatch.scheduledAt)
    : props.nextCompetition === 'pmp-league' && pmpClubMatch?.scheduledAt
      ? parseLocalDateKey(pmpClubMatch.scheduledAt)
    : props.nextCompetition === 'promotion-playoff' && playoffFixture
      ? new Date(`${playoffFixture.scheduledAt}T12:00:00`)
      : props.nextMatch && !props.nextMatch.bye
        ? getLeagueFixtureDate(props.game, props.nextMatch)
        : null,
  [playoffFixture, pmpClubMatch, props.game, props.nextCompetition, props.nextCupMatch, props.nextChampionsCupMatch, props.nextFriendlyMatch, props.nextMatch])
  const nextMatchKickoff = props.nextCompetition === 'friendly' && props.nextFriendlyMatch
    ? props.nextFriendlyMatch.kickoffTime
    : props.nextCompetition === 'polish-cup' && props.nextCupMatch
    ? getCupFixtureSchedule(props.game, props.nextCupMatch).kickoffTime
    : props.nextCompetition === 'champions-cup' && props.nextChampionsCupMatch
      ? props.nextChampionsCupMatch.kickoffTime ?? '20:00'
    : props.nextCompetition === 'pmp-league' && pmpClubMatch
      ? pmpClubMatch.kickoffTime ?? '17:00'
    : props.nextCompetition === 'promotion-playoff' && playoffFixture
      ? playoffFixture.kickoffTime
    : props.nextMatch && !props.nextMatch.bye
      ? getLeagueKickoffTime(props.game, props.nextMatch)
      : null
  const matchCompetitionLabel = props.nextCompetition === 'friendly'
    ? 'SPARING PRZEDSEZONOWY'
    : props.nextCompetition === 'polish-cup'
    ? props.nextCupMatch
      ? getCupCompetitionLabel(props.game, props.nextCupMatch).toLocaleUpperCase('pl-PL')
      : 'POLSKI PUCHAR'
    : props.nextCompetition === 'champions-cup'
      ? 'SUPER POLSKI PUCHAR'
    : props.nextCompetition === 'pmp-league'
      ? 'LIGA PMP'
    : props.nextCompetition === 'promotion-playoff'
      ? `${playoffFixture?.leagueName ?? 'BARAŻE'} · BARAŻE O AWANS`
    : `MECZ LIGOWY · ${leagues.find((league) => league.id === props.game.leagueId)?.name.toLocaleUpperCase('pl-PL') ?? 'SUPERKLASA'}`
  const [preMatchTab, setPreMatchTab] = useState<'opponent' | 'opponent-tactics' | 'tactics' | 'prediction' | 'alerts'>('opponent')
  const sameDay = (first: Date, second: Date) => first.getFullYear() === second.getFullYear()
    && first.getMonth() === second.getMonth()
    && first.getDate() === second.getDate()
  const currentGameDate = props.game.currentDate ? parseLocalDateKey(props.game.currentDate) : null
  const matchdayWeekStart = useMemo(() => {
    const anchor = props.calendarSimulationDate
      ? parseLocalDateKey(props.calendarSimulationDate)
      : currentGameDate
        ? currentGameDate
        : nextMatchDate ?? MATCHDAY_FALLBACK_DATE
    const start = new Date(anchor)
    start.setHours(0, 0, 0, 0)
    const dayOffset = (start.getDay() + 6) % 7
    start.setDate(start.getDate() - dayOffset)
    return start
  }, [currentGameDate, nextMatchDate, props.calendarSimulationDate])
  const matchdayWeek = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const day = new Date(matchdayWeekStart)
    day.setDate(matchdayWeekStart.getDate() + index)
    return day
  }), [matchdayWeekStart])
  const matchdayWeekLabel = useMemo(() => {
    const end = new Date(matchdayWeekStart)
    end.setDate(end.getDate() + 6)
    const format = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })
    return `${format.format(matchdayWeekStart)} – ${format.format(end)}`
  }, [matchdayWeekStart])
  const pendingMatchdayAlerts = useMemo(() => {
    const alerts: Array<{ key: 'match' | 'mail' | 'board' | 'transfer'; dayIndex: number; label: string; summary: string }> = []
    const matchDayIndex = nextMatchDate ? matchdayWeek.findIndex((day) => sameDay(day, nextMatchDate)) : -1
    if (nextMatchDate && matchDayIndex >= 0) {
      alerts.push({ key: 'match', dayIndex: matchDayIndex, label: 'Mecz', summary: `${matchIsHome ? 'Mecz u siebie' : 'Mecz wyjazdowy'} · ${nextMatchKickoff ?? 'godzina do ustalenia'}` })
    }
    if (unreadMailCount > 0) {
      alerts.push({ key: 'mail', dayIndex: Math.min(1, matchdayWeek.length - 1), label: 'Mail', summary: `${unreadMailCount} nieprzeczytanych wiadomości` })
    }
    if (props.game.boardGoal && props.game.cash < props.game.boardGoal.targetCash) {
      alerts.push({ key: 'board', dayIndex: Math.min(2, matchdayWeek.length - 1), label: 'Zarząd', summary: `Cel zarządu: ${formatMoney(props.game.boardGoal.targetCash)}` })
    }
    const transferAlertActive = props.game.transferNegotiations.some((negotiation) => negotiation.status === 'countered')
      || props.game.inboxMessages?.some((message) => message.category === 'transfer' || /transfer|negocj|oferta/i.test(`${message.subject} ${message.body}`))
    if (transferAlertActive) {
      alerts.push({ key: 'transfer', dayIndex: Math.min(3, matchdayWeek.length - 1), label: 'Transfer', summary: 'Trwa rozmowa z klubem lub agentem' })
    }
    return alerts.slice(0, 4)
  }, [matchdayWeek, matchIsHome, nextMatchDate, nextMatchKickoff, props.game, unreadMailCount])
  const simulationDate = props.calendarSimulationDate ? parseLocalDateKey(props.calendarSimulationDate) : null
  const simulationDayIndex = simulationDate
    ? matchdayWeek.findIndex((day) => sameDay(day, simulationDate))
    : -1
  const matchdayFocusIndex = simulationDayIndex >= 0
    ? simulationDayIndex
    : currentGameDate
      ? matchdayWeek.findIndex((day) => sameDay(day, currentGameDate))
      : pendingMatchdayAlerts[0]?.dayIndex
        ?? (nextMatchDate ? matchdayWeek.findIndex((day) => sameDay(day, nextMatchDate)) : 0)
  const calendarReferenceDate = simulationDate
    ?? (props.game.currentDate ? parseLocalDateKey(props.game.currentDate) : null)
    ?? matchdayWeek[matchdayFocusIndex]
  const daysUntilNextMatch = nextMatchDate && calendarReferenceDate
    ? Math.max(0, Math.round((new Date(nextMatchDate.getFullYear(), nextMatchDate.getMonth(), nextMatchDate.getDate()).getTime()
      - new Date(calendarReferenceDate.getFullYear(), calendarReferenceDate.getMonth(), calendarReferenceDate.getDate()).getTime()) / 86400000))
    : null
  const isNextMatchInFuture = daysUntilNextMatch !== null && daysUntilNextMatch > 0
  const [matchdayDialog, setMatchdayDialog] = useState<'preparation' | 'briefing' | null>(null)
  const completedClubMatches = useMemo(() => [
    ...props.game.matches,
    ...(props.game.polishCup?.history ?? []),
    ...(props.game.regionalCups ?? []).flatMap((cup) => cup.history),
  ].filter((match) => match.played && !match.bye), [props.game.matches, props.game.polishCup?.history, props.game.regionalCups])
  const recentForm = (teamId: string) => completedClubMatches
    .filter((match) => match.homeId === teamId || match.awayId === teamId)
    .sort((first, second) => second.round - first.round)
    .slice(0, 5)
    .map((match) => {
      const goalsFor = match.homeId === teamId ? match.homeGoals ?? 0 : match.awayGoals ?? 0
      const goalsAgainst = match.homeId === teamId ? match.awayGoals ?? 0 : match.homeGoals ?? 0
      return goalsFor > goalsAgainst ? 'W' : goalsFor === goalsAgainst ? 'R' : 'P'
    })
  const getLeagueStanding = (teamId: string) => {
    const leagueEntry = Object.entries(props.game.leagueWorld ?? {}).find(([, teams]) => teams.some((team) => team.id === teamId))
    const teams = leagueEntry?.[1] ?? (props.game.teams.some((team) => team.id === teamId) ? props.game.teams : [])
    const sorted = [...teams].sort((first, second) =>
      second.points - first.points
      || (second.goalsFor - second.goalsAgainst) - (first.goalsFor - first.goalsAgainst)
      || second.goalsFor - first.goalsFor
      || second.wins - first.wins
      || first.name.localeCompare(second.name, 'pl'),
    )
    const rank = sorted.findIndex((team) => team.id === teamId) + 1
    if (rank === 0) return { rank: null, teamCount: sorted.length, label: 'Poza ligą' }
    const leagueName = leagues.find((league) => league.id === leagueEntry?.[0])?.name
      ?? leagues.find((league) => league.id === props.game.leagueId)?.name
      ?? 'Liga'
    return { rank, teamCount: sorted.length, label: `${rank}. miejsce · ${leagueName}` }
  }
  const leaguePosition = (teamId: string) => getLeagueStanding(teamId).label
  const formFor = (teamId: string) => {
    const form = recentForm(teamId)
    return <span className="team-form" aria-label={form.length ? `Forma z ostatnich ${form.length} meczów: ${form.join(', ')}` : 'Brak rozegranych meczów'}>
      {form.length ? form.map((result, index) => <i key={`${teamId}-${index}`} className={`team-form-${result.toLowerCase()}`} title={result === 'W' ? 'Wygrana' : result === 'R' ? 'Remis' : 'Przegrana'}>{result}</i>) : <i className="team-form-empty">-</i>}
    </span>
  }
  const squadFormAverage = useMemo(() => Math.min(95, Math.max(45, Math.round(props.game.squad.reduce((sum, player) => sum + player.morale, 0) / Math.max(1, props.game.squad.length)))), [props.game.squad])
  const squadInjuryCount = props.game.squad.filter((player) => player.injury && player.injury.matchesRemaining > 0).length
  const injuredPlayers = props.game.squad.filter((player) => player.injury && player.injury.matchesRemaining > 0)
  const opponentTacticalBriefing = useMemo(() => {
    if (!opponent) return null
    const roster = (props.game.clubSquads[opponent.id] ?? [])
      .map(({ player }) => player)
      .sort((first, second) => second.skill - first.skill)
      .slice(0, 11)
    const formationEstimate = roster.length < 11
      ? null
      : formationOptions
        .map(({ id }) => {
          const availablePlayers = [...roster]
          const slots = formationSlotRows[id].flat().sort((first, second) =>
            availablePlayers.filter((player) => canPlayPosition(player, first)).length
            - availablePlayers.filter((player) => canPlayPosition(player, second)).length,
          )
          const rating = slots.reduce((total, slot) => {
            const suitableIndex = availablePlayers.findIndex((player) => canPlayPosition(player, slot))
            const playerIndex = suitableIndex >= 0
              ? suitableIndex
              : availablePlayers.findIndex((player) => player.position !== 'BR')
            if (playerIndex < 0) return total
            const [player] = availablePlayers.splice(playerIndex, 1)
            return total + player.skill * (canPlayPosition(player, slot) ? 1 : 0.72)
          }, 0) / 11
          return { formation: id, rating }
        })
        .sort((first, second) => second.rating - first.rating)[0]?.formation ?? null
    const recentMatches = completedClubMatches
      .filter((match) => match.homeId === opponent.id || match.awayId === opponent.id)
      .sort((first, second) => second.round - first.round)
      .slice(0, 5)
    const goalsScored = recentMatches.reduce((total, match) =>
      total + (match.homeId === opponent.id ? match.homeGoals ?? 0 : match.awayGoals ?? 0), 0)
    const goalsConceded = recentMatches.reduce((total, match) =>
      total + (match.homeId === opponent.id ? match.awayGoals ?? 0 : match.homeGoals ?? 0), 0)
    const goalsPerMatch = recentMatches.length ? goalsScored / recentMatches.length : null
    const concededPerMatch = recentMatches.length ? goalsConceded / recentMatches.length : null
    const resultsSignal = goalsPerMatch === null || concededPerMatch === null
      ? 'Za mało rozegranych spotkań do oceny stylu'
      : goalsPerMatch >= 1.8 && concededPerMatch >= 1.5
        ? 'Ostatnie wyniki wskazują na otwarte, bramkostrzelne mecze'
        : goalsPerMatch >= 1.6
          ? 'Ostatnie wyniki wskazują na większy nacisk na atak'
          : concededPerMatch <= 0.8
            ? 'Ostatnie wyniki wskazują na skuteczną grę w obronie'
            : 'Ostatnie wyniki nie wskazują na wyraźny kierunek gry'
    return {
      formation: formationEstimate,
      recentMatchesCount: recentMatches.length,
      goalsPerMatch,
      concededPerMatch,
      resultsSignal,
    }
  }, [completedClubMatches, opponent, props.game.clubSquads])
  const tacticalPressureLabel = props.game.tactics.pressing === 'high' ? 'wysoki pressing' : props.game.tactics.pressing === 'low' ? 'niski pressing' : 'umiarkowany pressing'
  const tacticalStyleLabel = props.game.tactics.style === 'attacking' ? 'ofensywny' : props.game.tactics.style === 'counter' ? 'kontratak' : 'zrównoważony'
  const bookmakerOdds = (() => {
    const bookmakers = [
      { name: 'Kursik', logo: '/images/bookmakers/kursik.jpg', homeShift: -0.018, drawShift: 0.008, margin: 1.045 },
      { name: 'Pewniak 24', logo: '/images/bookmakers/pewniak-24.jpg', homeShift: -0.006, drawShift: -0.004, margin: 1.055 },
      { name: 'Meczomat', logo: '/images/bookmakers/meczomat.jpg', homeShift: 0.008, drawShift: 0.003, margin: 1.065 },
      { name: 'Trybuna Bet', logo: '/images/bookmakers/trybuna-bet.jpg', homeShift: 0.017, drawShift: -0.007, margin: 1.075 },
    ]
    const formAdjustment = (teamId: string) => {
      const form = recentForm(teamId)
      if (!form.length) return 0
      const averagePoints = form.reduce((total, result) => total + (result === 'W' ? 3 : result === 'R' ? 1 : 0), 0) / form.length
      return (averagePoints - 1.5) * 4
    }
    const standingAdjustment = (teamId: string) => {
      const standing = getLeagueStanding(teamId)
      if (standing.rank === null || standing.teamCount < 2) return 0
      const rankStrength = (standing.teamCount - standing.rank) / (standing.teamCount - 1)
      return (rankStrength - 0.5) * 8
    }
    const homeTeamId = matchIsHome ? props.game.teamId : opponent?.id
    const awayTeamId = matchIsHome ? opponent?.id : props.game.teamId
    const homeStrength = (matchIsHome ? props.rating : opponent?.strength ?? props.rating)
      + (homeTeamId ? formAdjustment(homeTeamId) + standingAdjustment(homeTeamId) : 0)
    const awayStrength = (matchIsHome ? opponent?.strength ?? props.rating : props.rating)
      + (awayTeamId ? formAdjustment(awayTeamId) + standingAdjustment(awayTeamId) : 0)
    const difference = homeStrength - awayStrength + 4
    const draw = Math.max(0.19, Math.min(0.3, 0.29 - Math.abs(difference) * 0.0015))
    const homeShare = 1 / (1 + Math.exp(-difference / 18))
    const homeWin = (1 - draw) * homeShare
    const awayWin = (1 - draw) * (1 - homeShare)
    return bookmakers.map((bookmaker) => {
      const shiftedHome = Math.max(0.05, homeWin + bookmaker.homeShift)
      const shiftedDraw = Math.max(0.12, draw + bookmaker.drawShift)
      const total = shiftedHome + shiftedDraw + Math.max(0.05, awayWin - bookmaker.homeShift - bookmaker.drawShift)
      return {
        ...bookmaker,
        home: (total / shiftedHome / bookmaker.margin).toFixed(2),
        draw: (total / shiftedDraw / bookmaker.margin).toFixed(2),
        away: (total / Math.max(0.05, awayWin - bookmaker.homeShift - bookmaker.drawShift) / bookmaker.margin).toFixed(2),
      }
    })
  })()
  const nextMatchBriefing = useMemo(() => {
    const injurySummary = injuredPlayers.slice(0, 3)
    return {
      form: squadFormAverage >= 75 ? 'Wysoka forma' : squadFormAverage >= 62 ? 'Prawidłowa forma' : 'Nadmierne wahania',
      injuries: injurySummary.length > 0 ? injurySummary.map((player) => `${player.firstName} ${player.lastName}`).join(', ') : 'Brak istotnych kontuzji',
      pressure: props.clubPosition <= 3 ? 'Wysoka · walka o czołówkę' : props.clubPosition >= props.table.length - 2 ? 'Wysoka · walka o utrzymanie' : 'Umiarkowana · stabilna pozycja',
      tactic: `${tacticalStyleLabel} · ${tacticalPressureLabel}`,
    }
  }, [injuredPlayers, props.clubPosition, props.table.length, squadFormAverage, tacticalPressureLabel, tacticalStyleLabel])
  const officialMatchesPlayed = [
    ...props.game.matches,
    ...(props.game.polishCup?.history ?? []),
    ...(props.game.regionalCups ?? []).flatMap((cup) => cup.history),
  ].some((match) =>
    match.played && !match.bye && (match.homeId === props.game.teamId || match.awayId === props.game.teamId),
  )
  const preseasonActive = props.game.round === 1 && !officialMatchesPlayed
  const lineupReady = props.game.matchLineupIds.length === 11
  const sponsorReady = !props.game.sponsorRequired
  const guideStep = !sponsorReady ? 1 : !lineupReady ? 2 : 3
  return <>
    {preseasonActive && <section className="panel-card preseason-panel">
      <div className="panel-heading">
        <div><p className="eyebrow">PRZEWODNIK STARTU · KROK {guideStep} Z 3</p><h2>Pierwsze kroki przed meczem</h2></div>
      </div>
      <p className="preseason-intro">Wykonaj te trzy kroki po kolei. Kliknij wybrany punkt, aby przejść dokładnie tam, gdzie możesz go zrobić.</p>
      <div className="preseason-checklist">
        <button type="button" aria-current={guideStep === 1 ? 'step' : undefined} className={`preseason-task ${sponsorReady ? 'preseason-task-ready' : ''} ${guideStep === 1 ? 'preseason-task-current' : ''}`} onClick={props.onNavigateToSponsorOffers}>
          <span>{sponsorReady ? <Check size={17} /> : '1'}</span><strong>Wybierz i podpisz umowę sponsorską</strong><small>{sponsorReady ? `Gotowe${props.game.sponsorDeal ? ` · ${props.game.sponsorDeal.company}` : ''}` : 'Wejdź w Finanse → Sponsorzy i kliknij „Podpisz na rundę” lub „Podpisz na sezon”.'}</small><ArrowRight size={15} />
        </button>
        <button type="button" aria-current={guideStep === 2 ? 'step' : undefined} className={`preseason-task ${lineupReady ? 'preseason-task-ready' : ''} ${guideStep === 2 ? 'preseason-task-current' : ''}`} onClick={() => props.onNavigate('tactics')}>
          <span>{lineupReady ? <Check size={17} /> : '2'}</span><strong>Ustaw skład i taktykę</strong><small>{lineupReady ? 'Gotowe — możesz wrócić i zmienić ustawienia' : `Wybierz 11 zawodników. Teraz w składzie: ${props.game.matchLineupIds.length}.`}</small><ArrowRight size={15} />
        </button>
        <button type="button" aria-current={guideStep === 3 ? 'step' : undefined} className={`preseason-task ${guideStep === 3 ? 'preseason-task-current' : ''}`} disabled={guideStep !== 3} onClick={props.onPlay}>
          <span>{guideStep === 3 ? '3' : <Activity size={17} />}</span><strong>Rozegraj pierwszy mecz</strong><small>{guideStep === 3 ? 'Kliknij, aby przejść do następnego spotkania. Jeśli jest później w kalendarzu, gra doprowadzi Cię do jego terminu.' : 'Najpierw podpisz umowę sponsorską i ustaw jedenastkę.'}</small><ArrowRight size={15} />
        </button>
      </div>
      <button type="button" className="preseason-optional-link" onClick={props.onNavigateToSponsorOffers}>
        <Tv size={14} /> Prawa telewizyjne są opcjonalne — możesz podpisać je w finansach
      </button>
    </section>}
    <section id="matchday-center-panel" className="matchday-center-panel">
      <div className="matchday-center-header">
        <div className="matchday-club-summary">
          <button type="button" className="club-profile-open" onClick={() => props.onOpenClubProfile(props.game.teamId)} aria-label={`Otwórz profil klubu ${props.game.clubName}`}>
            <ClubCrest name={props.game.clubName} seedKey={props.game.teamId} color={props.game.clubColor} imageSrc={getClubCrestImage(props.game, props.game.teamId)} large />
          </button>
          <div>
            <p className="eyebrow">TWÓJ KLUB · {leagues.find((league) => league.id === props.game.leagueId)?.name}</p>
            <h2>{props.game.clubName}</h2>
            <span><MapPin size={12} /> {props.game.city} <i /> {props.clubPosition}. miejsce w lidze <i /> Siła kadry {props.rating}/100</span>
            <button type="button" className="club-profile-link" onClick={() => props.onOpenClubProfile(props.game.teamId)}>Profil klubu <ArrowRight size={12} /></button>
          </div>
        </div>
        <div className="matchday-center-heading">
          <p className="eyebrow">CENTRUM DNIA MECZOWEGO</p>
          <h2>{props.nextCompetition === 'season-complete' ? 'Sezon zakończony' : isNextMatchInFuture ? `Do meczu · ${daysUntilNextMatch} dni` : playoffFixture ? `Dzień barażowy · ${playoffFixture.leagueName}` : props.nextCompetition === 'friendly' ? 'Dzień sparingowy' : props.nextCompetition === 'champions-cup' ? 'Puchar Mistrzów' : props.nextMatch?.bye ? 'Dzień wolny od meczu' : `Dzień meczowy · ${matchCompetitionLabel}`}</h2>
        </div>
        <div className="matchday-center-actions">
          <button className="secondary-button" onClick={() => props.onNavigate('inbox')}>Skrzynka e-mail{unreadMailCount > 0 && <span className="matchday-mail-count">{unreadMailCount > 99 ? '99+' : unreadMailCount}</span>}</button>
          {daysUntilNextMatch === 1 && hasUpcomingMatch && opponent && <button className="secondary-button" onClick={() => setMatchdayDialog('preparation')}>Przygotuj drużynę</button>}
          <button className="primary-button" disabled={props.calendarSimulationActive} onClick={() => {
            if (isNextMatchInFuture) {
              props.onSimulateToNextMatch()
              return
            }
            if (playoffFixture) {
              props.onPlay()
              return
            }
            if (props.nextCompetition === 'friendly' && props.nextFriendlyMatch?.scheduledAt
              && (props.calendarSimulationDate ?? props.game.currentDate ?? '').localeCompare(props.nextFriendlyMatch.scheduledAt) < 0) {
              props.onSimulateToNextMatch()
              return
            }
            if (props.nextCompetition === 'champions-cup' && props.nextChampionsCupMatch?.scheduledAt
              && (props.calendarSimulationDate ?? props.game.currentDate ?? '').localeCompare(props.nextChampionsCupMatch.scheduledAt) < 0) {
              props.onSimulateToNextMatch()
              return
            }
            if (hasUpcomingMatch) {
              setMatchdayDialog('briefing')
              setPreMatchTab('opponent')
              return
            }
            if (props.nextCompetition === 'season-complete') {
              props.onStartSeason()
              return
            }
            props.onSimulateToNextMatch()
          }}>{props.calendarSimulationActive ? 'Symulacja kalendarza…' : isNextMatchInFuture ? 'Symuluj do meczu' : playoffFixture ? `Rozegraj baraż · ${playoffFixture.scheduledAt} ${playoffFixture.kickoffTime}` : props.nextCompetition === 'friendly' ? 'Rozegraj sparing' : hasUpcomingMatch ? 'Briefing przedmeczowy' : props.nextCompetition === 'season-complete' ? 'Rozpocznij nowy sezon' : 'Symuluj do meczu'} <ArrowRight size={15} /></button>
        </div>
      </div>
      <div className="matchday-week-label"><CalendarDays size={13} /> TYDZIEŃ MECZOWY <span>{matchdayWeekLabel}</span></div>
      {hasUpcomingMatch && opponent && !isNextMatchInFuture ? <div className={`matchday-center-hero ${!matchIsHome ? 'matchday-center-hero-away' : ''}`}>
        <div className="matchday-center-competition-label">{matchCompetitionLabel}</div>
        <div className={`matchday-center-club ${matchIsHome ? 'matchday-center-club-inner-left' : 'matchday-center-club-inner-right'}`}><ClubCrest name={props.game.clubName} seedKey={props.game.teamId} color={props.game.clubColor} imageSrc={getClubCrestImage(props.game, props.game.teamId)} large /><div><small>{matchIsHome ? 'GOSPODARZE' : 'GOŚCIE'}</small><strong>{props.game.clubName}</strong><span>{leaguePosition(props.game.teamId)}</span>{formFor(props.game.teamId)}</div></div>
        <div className="matchday-center-vs"><span>VS</span><small>{props.game.season}</small></div>
        <div className="matchday-center-opponent"><ClubCrest name={opponent.name} seedKey={opponent.id} imageSrc={getClubCrestImage(props.game, opponent.id)} className="opponent-crest" /><div><small>{matchIsHome ? 'GOŚCIE' : 'GOSPODARZE'}</small><strong>{opponent.name}</strong><span>{leaguePosition(opponent.id)}</span>{formFor(opponent.id)}</div></div>
      </div> : <div className="matchday-center-hero matchday-center-hero-offline"><div><small>PLAN TYGODNIA</small><strong>{isNextMatchInFuture ? 'DZIEŃ BEZ MECZU' : 'BRAK MECZU W TYM DNIU'}</strong>{daysUntilNextMatch !== null && <span>Do najbliższego meczu: {daysUntilNextMatch === 0 ? 'dzisiaj' : `za ${daysUntilNextMatch} dni`}</span>}{isNextMatchInFuture && opponent && <span>Następny rywal: {opponent.name}</span>}</div></div>}
      <div className="matchday-week-grid" role="list" aria-label="Tydzień meczu">
        {matchdayWeek.map((date, index) => {
          const isSelected = index === matchdayFocusIndex
          const isMatchDay = nextMatchDate ? sameDay(date, nextMatchDate) : false
          const alertEntry = pendingMatchdayAlerts.find((alert) => alert.dayIndex === index)
          const alertKind = alertEntry?.key ?? (isMatchDay ? 'match' : null)
          const canOpenMatch = isMatchDay && hasUpcomingMatch && Boolean(opponent)
          const handleSelectMatchday = () => {
            if (!canOpenMatch) return
            if (isNextMatchInFuture) {
              props.onSimulateToNextMatch()
              return
            }
            setMatchdayDialog('briefing')
            setPreMatchTab('opponent')
          }
          return <button type="button" role="listitem" key={`${date.toISOString()}-${index}`} className={`matchday-week-tile ${isSelected ? 'matchday-week-tile-active' : ''} ${isMatchDay ? 'matchday-week-tile-match' : ''} ${alertKind ? 'matchday-week-tile-alert' : ''}`} aria-current={isMatchDay ? 'date' : undefined} aria-label={`${new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' }).format(date)}${isMatchDay ? ` · ${matchCompetitionLabel} · ${opponent?.name ?? ''}` : ''}${canOpenMatch ? isNextMatchInFuture ? ' · Symuluj do meczu' : ' · Otwórz briefing meczu' : ''}`} disabled={!canOpenMatch || props.calendarSimulationActive} onClick={handleSelectMatchday}>
            <span>{new Intl.DateTimeFormat('pl-PL', { weekday: 'short' }).format(date)}</span>
            <strong>{date.getDate()}</strong>
            <small>{alertEntry?.label ?? (isMatchDay ? 'Mecz' : 'Plan')}</small>
            {isMatchDay && <>
              <b className={`matchday-week-tile-competition ${props.nextCompetition === 'polish-cup' ? 'matchday-week-tile-competition-cup' : ''}`}>{matchCompetitionLabel}</b>
              <b className="matchday-week-tile-opponent">{opponent?.name}</b>
              <b className="matchday-week-tile-venue">{matchIsHome ? 'Dom' : 'Wyjazd'}</b>
            </>}
            {alertKind && <i className={`matchday-alert-dot matchday-alert-${alertKind}`} aria-label={alertEntry?.label ?? 'Mecz'} />}
          </button>
        })}
      </div>
      {pendingMatchdayAlerts.some((alert) => alert.key !== 'match') && <div className="matchday-event-queue" role="list" aria-label="Aktywne alerty">
        {pendingMatchdayAlerts.filter((alert) => alert.key !== 'match').map((alert) => (
          <div key={`${alert.key}-${alert.dayIndex}`} className={`matchday-event-card matchday-event-${alert.key}`} role="listitem">
            <span>{alert.label}</span>
            <strong>{alert.summary}</strong>
            <small>{alert.key === 'mail' ? 'Skrzynka e-mail' : alert.key === 'board' ? 'Komunikat zarządu' : alert.key === 'transfer' ? 'Negocjacje transferowe' : 'Najbliższy mecz'}</small>
          </div>
        ))}
      </div>}
      {matchdayDialog && opponent && hasUpcomingMatch && <div className="matchday-preview-overlay" onClick={() => setMatchdayDialog(null)}>
        <div className="matchday-preview" onClick={(event) => event.stopPropagation()}>
          <div className="matchday-preview-header">
            <div>
              <p className="eyebrow">{matchdayDialog === 'preparation' ? 'DZIEŃ PRZED MECZEM · PRZYGOTOWANIA' : `BRIEFING PRZEDMECZOWY · ${matchCompetitionLabel}`}</p>
              <h3>{matchIsHome ? `${props.game.clubName} vs ${opponent.name}` : `${opponent.name} vs ${props.game.clubName}`}</h3>
            </div>
            <button type="button" className="close-button" onClick={() => setMatchdayDialog(null)}>Zamknij</button>
          </div>
          <div className={`matchday-preview-body ${!matchIsHome ? 'matchday-preview-body-away' : ''}`}>
            <div className="matchday-preview-team">
              <ClubCrest name={props.game.clubName} seedKey={props.game.teamId} color={props.game.clubColor} imageSrc={getClubCrestImage(props.game, props.game.teamId)} large />
              <div>
                <small>{matchIsHome ? 'Gospodarz' : 'Gość'}</small>
                <strong>{props.game.clubName}</strong>
              </div>
            </div>
            <div className="matchday-preview-score"><span>{matchIsHome ? 'GOSPODARZ' : 'GOŚĆ'}</span><strong>VS</strong><small>{matchIsHome ? 'GOŚĆ' : 'GOSPODARZ'}</small></div>
            <div className="matchday-preview-team">
              <ClubCrest name={opponent.name} seedKey={opponent.id} imageSrc={getClubCrestImage(props.game, opponent.id)} className="opponent-crest" />
              <div>
                <small>{matchIsHome ? 'Gość' : 'Gospodarz'}</small>
                <strong>{opponent.name}</strong>
              </div>
            </div>
          </div>
          {(localDerby || featuredRivalry) && <div className="matchday-derby-banner">
            <Flag size={15} />
            <span>
              <strong>{derbyKind === 'city' ? 'Derby miejskie' : derbyKind === 'district' ? 'Derby okręgowe' : featuredRivalry ? getClubRivalryLevel(featuredRivalry) : 'Rywalizacja klubowa'}</strong>
              <small>{localDerby ? `${derbyKind === 'city' ? 'Mecz o lokalną dumę' : isRegionalCupMatch ? 'Rywal z tego samego regionu' : 'Rywal z tej samej grupy rozgrywkowej'} — wynik wpłynie na zainteresowanie kibiców i reputację klubu. ` : ''}
                {featuredRivalry
                  ? `Bilans we wszystkich oficjalnych rozgrywkach: ${featuredRivalry.wins}-${featuredRivalry.draws}-${featuredRivalry.losses}. Ostatnie mecze: ${(featuredRivalry.recentMatches ?? []).slice(-3).reverse().map((match) => `${match.result} ${match.score} · ${match.competition === 'regional-cup' ? 'Puchar regionalny' : match.competition === 'polish-cup' ? 'Polski Puchar' : 'liga'}`).join(' | ') || featuredRivalry.recentResults.join(' ')}.`
                  : props.nextCompetition === 'league'
                    ? 'To pierwsze zapisane spotkanie ligowe z tym rywalem. Historia zacznie się po meczu.'
                    : 'Derby dodają lokalnej stawki temu spotkaniu pucharowemu.'}
              </small>
            </span>
          </div>}
          {matchdayDialog === 'preparation' && upcomingMatchId && <section className="match-preparation-panel" aria-label="Przygotowanie do meczu">
            <div><p className="eyebrow">WYBÓR MENEDŻERA</p><h4>Jak przygotujesz drużynę?</h4><small>Wybierz jeden plan. Możesz go zmienić przed rozpoczęciem spotkania.</small></div>
            <div className="match-preparation-options">
              {([
                ['tactical', 'Analiza taktyczna', 'Lepsze przygotowanie planu gry · +3 do siły zespołu.'],
                ['recovery', 'Regeneracja', 'Zawodnicy odzyskają 6 punktów kondycji przed meczem.'],
                ['motivation', 'Mobilizacja', 'Podnieś morale kadry o 2 punkty · +1 do siły zespołu.'],
              ] as const).map(([choice, label, description]) => <button
                key={choice}
                type="button"
                aria-pressed={selectedPreparation === choice}
                className={`match-preparation-option ${selectedPreparation === choice ? 'match-preparation-option-active' : ''}`}
                onClick={() => {
                  const result = saveMatchPreparation(props.game, upcomingMatchId, choice)
                  props.onUpdate(result.game, result.error || `${label} — plan przygotowań zapisany.`)
                }}
              ><strong>{label}</strong><small>{description}</small>{selectedPreparation === choice && <Check size={14} />}</button>)}
            </div>
          </section>}
          {matchdayDialog === 'preparation' && upcomingMatchId && <section className="match-preparation-panel press-conference-panel" aria-label="Konferencja prasowa przedmeczowa">
            <div><p className="eyebrow">KONFERENCJA PRASOWA</p><h4>Jakie przesłanie przekażesz przed meczem?</h4><small>Twoje słowa wpływają na przygotowanie drużyny. Decyzję można zmienić przed spotkaniem.</small></div>
            <div className="match-preparation-options">
              {([
                ['confident', 'Pewność siebie', 'Wzmocnij siłę zespołu o 2 punkty.'],
                ['respectful', 'Szacunek do rywala', 'Spokojny ton i +1 do siły zespołu.'],
                ['protective', 'Chroń zawodników', 'Bez presji wyniku; podstawowi odzyskają 3 kondycji i zużyją o 2 mniej.'],
              ] as const).map(([choice, label, description]) => <button
                key={choice}
                type="button"
                aria-pressed={selectedConference === choice}
                className={`match-preparation-option ${selectedConference === choice ? 'match-preparation-option-active' : ''}`}
                onClick={() => {
                  const result = saveMatchConference(props.game, upcomingMatchId, choice)
                  props.onUpdate(result.game, result.error || `Konferencja: ${label.toLocaleLowerCase('pl')} — przesłanie zapisane.`)
                }}
              ><strong>{label}</strong><small>{description}</small>{selectedConference === choice && <Check size={14} />}</button>)}
            </div>
          </section>}
          {matchdayDialog === 'preparation' && upcomingMatchId && localDerby && <section className="match-preparation-panel press-conference-panel" aria-label="Organizacja derbów">
            <div><p className="eyebrow">ORGANIZACJA DERBÓW</p><h4>{matchIsHome ? 'Jak zadbasz o wsparcie kibiców?' : 'Jak zorganizujesz wyjazd kibiców?'}</h4><small>Jedna decyzja dla tego meczu. Koszt zostanie pobrany od razu; możesz ją później zmienić lub odwołać.</small></div>
            <div className="match-preparation-options">
              {matchIsHome ? <>
                {([
                  ['home-tifo', 'Przygotuj oprawę na stadionie', 'Koszt 15 000 zł · +8% pojemności wypełnionej na meczu · +2 reputacji lokalnej.'],
                  ['none', 'Zachowaj budżet', 'Bez dodatkowych kosztów i bonusów.'],
                ] as const).map(([choice, label, description]) => <button
                  key={choice}
                  type="button"
                  aria-pressed={selectedDerbyAction === choice}
                  className={`match-preparation-option ${selectedDerbyAction === choice || (choice === 'none' && !selectedDerbyAction) ? 'match-preparation-option-active' : ''}`}
                  onClick={() => {
                    const result = saveDerbyMatchAction(props.game, upcomingMatchId, choice)
                    props.onUpdate(result.game, result.error || (choice === 'none' ? 'Organizacja derbów odwołana.' : `${label} — decyzja zapisana.`))
                  }}
                ><strong>{label}</strong><small>{description}</small>{(selectedDerbyAction === choice || (choice === 'none' && !selectedDerbyAction)) && <Check size={14} />}</button>)}
              </> : <>
                {([
                  ['away-supporters-bus', 'Zorganizuj autokar kibiców', 'Koszt 10 000 zł · morale drużyny +1 · +2 reputacji lokalnej.'],
                  ['none', 'Zachowaj budżet', 'Bez dodatkowych kosztów i bonusów.'],
                ] as const).map(([choice, label, description]) => <button
                  key={choice}
                  type="button"
                  aria-pressed={selectedDerbyAction === choice || (choice === 'none' && !selectedDerbyAction)}
                  className={`match-preparation-option ${selectedDerbyAction === choice || (choice === 'none' && !selectedDerbyAction) ? 'match-preparation-option-active' : ''}`}
                  onClick={() => {
                    const result = saveDerbyMatchAction(props.game, upcomingMatchId, choice)
                    props.onUpdate(result.game, result.error || (choice === 'none' ? 'Organizacja derbów odwołana.' : `${label} — decyzja zapisana.`))
                  }}
                ><strong>{label}</strong><small>{description}</small>{(selectedDerbyAction === choice || (choice === 'none' && !selectedDerbyAction)) && <Check size={14} />}</button>)}
              </>}
            </div>
          </section>}
          {matchdayDialog === 'briefing' && <div className="matchday-briefing-content">
          <div className="matchday-preview-tabs" role="tablist" aria-label="Briefing przedmeczowy">
            {([
              ['opponent', 'Rywal'],
              ['opponent-tactics', 'Taktyka rywala'],
              ['tactics', 'Nasza taktyka'],
              ['prediction', 'Przewidywanie'],
              ['alerts', 'Alerty'],
            ] as const).map(([tab, label]) => <button key={tab} type="button" role="tab" aria-selected={preMatchTab === tab} className={preMatchTab === tab ? 'matchday-preview-tab matchday-preview-tab-active' : 'matchday-preview-tab'} onClick={() => setPreMatchTab(tab)}>{label}</button>)}
          </div>
          <div className="matchday-preview-content" role="tabpanel">
            {preMatchTab === 'opponent' && <div className="matchday-preview-detail-grid">
              <div><span>Pozycja w lidze</span><strong>{leaguePosition(opponent.id)}</strong></div>
              <div><span>Siła rywala</span><strong>{opponent.strength}/100</strong></div>
              <div><span>Forma rywala · ostatnie mecze</span><strong>{recentForm(opponent.id).join(' ') || 'Brak rozegranych spotkań'}</strong>{formFor(opponent.id)}</div>
              <div><span>Forma naszego klubu · ostatnie mecze</span><strong>{recentForm(props.game.teamId).join(' ') || 'Brak rozegranych spotkań'}</strong>{formFor(props.game.teamId)}</div>
            </div>}
            {preMatchTab === 'opponent-tactics' && <div className="matchday-opponent-scout">
              <p className="matchday-opponent-scout-note">Rozpoznanie taktyczne · prognoza na podstawie kadry i wyników, nie potwierdzony plan rywala</p>
              <div className="matchday-preview-detail-grid">
                <div><span>Ustawienie najlepiej pasujące do kadry</span><strong>{opponentTacticalBriefing?.formation ?? 'Brak danych o składzie'}</strong><small>Szacunek z dostępnych zawodników; rywal nie ma zapisanego ustawienia meczowego.</small></div>
                <div><span>Sygnał z ostatnich wyników</span><strong>{opponentTacticalBriefing?.resultsSignal ?? 'Brak danych'}</strong><small>{opponentTacticalBriefing?.recentMatchesCount ?? 0} zbadanych spotkań · maksymalnie 5 ostatnich</small></div>
                <div><span>Średnio strzelone gole</span><strong>{opponentTacticalBriefing?.goalsPerMatch?.toFixed(1) ?? '—'} na mecz</strong></div>
                <div><span>Średnio stracone gole</span><strong>{opponentTacticalBriefing?.concededPerMatch?.toFixed(1) ?? '—'} na mecz</strong></div>
              </div>
              <div className="matchday-preview-alert matchday-preview-alert-scout"><Shield size={15} /><span><strong>Pressing i instrukcje rywala są nieznane</strong><small>Gra nie zapisuje taktyki drużyn AI. Ustawienie pokazane wyżej to dopasowanie kadry, a wnioski o stylu są szacunkiem z wyników.</small></span></div>
            </div>}
            {preMatchTab === 'tactics' && <div className="matchday-preview-detail-grid">
              <div><span>Ustawienie</span><strong>{props.game.tactics.formation}</strong></div>
              <div><span>Styl gry</span><strong>{tacticalStyleLabel} · {tacticalPressureLabel}</strong></div>
              <div><span>Dyspozycja kadry</span><strong>{squadFormAverage}% · {nextMatchBriefing.form}</strong></div>
              <div><span>Plan meczu</span><strong>{matchIsHome ? 'Kontrola tempa i cierpliwe budowanie akcji' : 'Zwarta obrona i szybkie przejście do ataku'}</strong></div>
            </div>}
            {preMatchTab === 'prediction' && <div className="matchday-prediction-panel">
              <div className="matchday-preview-detail-grid">
                <div><span>Siła naszej kadry</span><strong>{props.rating}/100</strong></div>
                <div><span>Siła rywala</span><strong>{opponent.strength}/100</strong></div>
                <div><span>Przewaga boiska</span><strong>{matchIsHome ? 'Gospodarz' : 'Wyjazd'}</strong></div>
                <div><span>Osłabienia</span><strong>{squadInjuryCount ? `${squadInjuryCount} kontuzjowanych` : 'Pełna dostępność kadry'}</strong></div>
              </div>
            </div>}
            {preMatchTab === 'alerts' && <div className="matchday-preview-alerts">
              {injuredPlayers.length > 0
                ? injuredPlayers.map((player) => <div className="matchday-preview-alert matchday-preview-alert-injury" key={player.id}><TriangleAlert size={15} /><span><strong><PlayerName player={player} /></strong><small>{player.injury?.description} · {getInjuryDurationLabel(player.injury?.matchesRemaining ?? 0)}</small></span></div>)
                : <div className="matchday-preview-alert"><Check size={15} /><span><strong>Brak kontuzji w kadrze</strong><small>Nie odnotowano aktywnych urazów.</small></span></div>}
              {unreadMailCount > 0 && <div className="matchday-preview-alert"><Mail size={15} /><span><strong>{unreadMailCount} nieprzeczytanych wiadomości</strong><small>Przejrzyj skrzynkę przed pierwszym gwizdkiem.</small></span></div>}
              {props.game.boardGoal && props.game.cash < props.game.boardGoal.targetCash && <div className="matchday-preview-alert matchday-preview-alert-warning"><Landmark size={15} /><span><strong>Presja zarządu</strong><small>Do celu finansowego brakuje {formatMoney(props.game.boardGoal.targetCash - props.game.cash)}.</small></span></div>}
              {injuredPlayers.length === 0 && unreadMailCount === 0 && !(props.game.boardGoal && props.game.cash < props.game.boardGoal.targetCash) && <div className="matchday-preview-alert"><Check size={15} /><span><strong>Brak pilnych alertów</strong><small>Kadra i klub są gotowe do spotkania.</small></span></div>}
            </div>}
            <section className="matchday-odds" aria-label="Symulowane kursy bukmacherskie">
              <div className="matchday-odds-heading"><div><p className="eyebrow">JAK WIDZĄ MECZ BUKMACHERZY</p><h4>Symulowane kursy 1 · X · 2</h4></div><span>PRZYKŁADOWE</span></div>
              <div className="matchday-odds-labels"><span>GOSPODARZ · 1</span><span>REMIS · X</span><span>GOŚĆ · 2</span></div>
              <div className="matchday-odds-list">{bookmakerOdds.map((bookmaker) => <div className="matchday-odds-row" key={bookmaker.name}>
                <img className="bookmaker-logo" src={bookmaker.logo} alt="" />
                <strong>{bookmaker.name}</strong>
                <b>{bookmaker.home}</b><b>{bookmaker.draw}</b><b>{bookmaker.away}</b>
              </div>)}</div>
              <small className="matchday-odds-disclaimer">Fikcyjne marki i orientacyjne kursy generowane na potrzeby gry. Bez prawdziwych zakładów; kursy nie są ofertą bukmacherską.</small>
            </section>
          </div>
          </div>}
          <div className="matchday-preview-footer">
            {matchdayDialog === 'preparation' ? <button type="button" className="secondary-button" onClick={() => setMatchdayDialog(null)}>Wróć do centrum</button> : <>
            <button type="button" className="secondary-button" onClick={() => { setMatchdayDialog(null); props.onNavigate('tactics') }}>Skład i taktyka</button>
            <button type="button" className="primary-button" onClick={() => {
              if (props.game.sponsorRequired) {
                setMatchdayDialog(null)
                props.onNavigate('finances')
                return
              }
              setMatchdayDialog(null)
              props.onPlay()
            }}>{props.game.sponsorRequired ? 'Wybierz sponsora' : 'Rozegraj mecz'} <ArrowRight size={14} /></button>
            </>}
          </div>
        </div>
      </div>}
      <div className="matchday-center-details">
        <div className="matchday-briefing-card">
          <span className="eyebrow">GOTOWOŚĆ I CZYNNIKI MECZOWE</span>
          <div className="matchday-readiness-row">
            <div><strong>{squadFormAverage}%</strong><small>Forma kadry</small></div>
            <div><strong>{squadInjuryCount}</strong><small>Kontuzje</small></div>
            <div><strong>{props.clubPosition}.</strong><small>Miejsce</small></div>
          </div>
          <ul className="matchday-briefing-list">
            <li><span>Forma · ostatnie mecze</span><strong>{recentForm(props.game.teamId).join(' ') || 'Brak rozegranych spotkań'}</strong></li>
            <li><span>Kontuzje</span><strong>{nextMatchBriefing.injuries}</strong></li>
            <li><span>Taktyka</span><strong>{props.game.tactics.formation} · {nextMatchBriefing.tactic}</strong></li>
            <li><span>Presja ligowa</span><strong>{nextMatchBriefing.pressure}</strong></li>
          </ul>
        </div>
        <div className="matchday-checklist">
          <p className="eyebrow">CO SPRAWDZIĆ PRZED MECZEM</p>
          <ul>
            <li><CalendarDays size={14} /> {nextMatchDate ? `Termin: ${new Intl.DateTimeFormat('pl-PL', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(nextMatchDate)}` : 'Termin: brak danych'}</li>
            <li><Shield size={14} /> {opponent ? `Rywal: ${opponent.name} · siła ${opponent.strength.toFixed(0)}` : 'Rywal: do ustalenia'}</li>
            <li><Mail size={14} /> {unreadMailCount > 0 ? `${unreadMailCount} nieprzeczytanych wiadomości` : 'Brak nowych wiadomości'}</li>
            <li><Landmark size={14} /> {props.game.boardGoal && props.game.cash < props.game.boardGoal.targetCash ? `Cel zarządu: ${formatMoney(props.game.boardGoal.targetCash)}` : 'Zarząd: wszystkie cele w zakresie planu'}</li>
          </ul>
        </div>
      </div>
    </section>

    <div className="overview-grid">
      <section className="panel-card overview-standings-card">
        <div className="panel-heading"><div><p className="eyebrow">TABELA LIGOWA</p><h2>{leagues.find((league) => league.id === props.game.leagueId)?.name}</h2></div><span className="table-season-tag">{props.game.season}</span></div>
        <LeagueTable game={props.game} table={props.table} clubId={props.game.teamId} limit={6} onOpenClubProfile={props.onOpenClubProfile} />
        <button className="panel-link" onClick={() => props.onNavigate('standings')}>Pełna tabela <ArrowRight size={14} /></button>
      </section>
    </div>

  </>
}

function LeagueTable({ game, table, clubId, limit, onOpenClubProfile }: { game: GameState; table: GameState['teams']; clubId: string; limit?: number; onOpenClubProfile?: (teamId: string) => void }) {
  const visible = limit ? table.slice(0, limit) : table
  const zones = getLeagueTableZones(game)
  return <div className="league-table-container">
    <div className="league-table-wrap">
    <table className="league-table"><thead><tr><th>#</th><th>KLUB</th><th title="Rozegrane mecze">RM</th><th title="Wygrane">W</th><th title="Remisy">R</th><th title="Przegrane">P</th><th title="Bramki zdobyte">BZ</th><th title="Bramki stracone">BS</th><th title="Różnica bramek">RB +/-</th><th title="Żółte kartki">ŻK</th><th title="Czerwone kartki (w tym za drugą żółtą)">CK</th><th title="Punkty fair play: żółta kartka = 1, druga żółta skutkująca czerwoną = dodatkowe 2, bezpośrednia czerwona = 4; mniej punktów oznacza wyższą pozycję">FP</th><th title="Punkty">PKT</th></tr></thead><tbody>
    {visible.map((team) => {
      const rank = table.indexOf(team) + 1
      const isRelegated = zones.relegationRanks.includes(rank)
      const isDirectPromotion = zones.directPromotionRanks.includes(rank)
      const isPlayoff = zones.playoffRanks.includes(rank)
      const isMaintenancePlayoff = zones.maintenancePlayoffRanks.includes(rank)
      const isPromotionCandidate = zones.promotionCandidateRanks.includes(rank)
      const positionClass = rank === 1
        ? 'table-position-champion'
        : rank === 2
          ? 'table-position-runner-up'
          : rank === 3
            ? 'table-position-third'
            : ''
      const labels = [
        rank === 1 ? 'Mistrz ligi' : '',
        rank === 2 ? 'Wicemistrz ligi' : '',
        rank === 3 ? '3. miejsce' : '',
        isDirectPromotion ? 'Awans bezpośredni' : '',
        isPromotionCandidate && !isDirectPromotion ? 'Lider grupy — kandydat do awansu' : '',
        isPlayoff ? 'Baraże o awans' : '',
        isMaintenancePlayoff ? 'Baraże o utrzymanie' : '',
        isRelegated ? 'Spadek' : '',
      ].filter(Boolean)
      const relegationClass = isRelegated ? ' table-position-relegation' : ''
      return <tr key={team.id} className={`${team.id === clubId ? 'own-team-row ' : ''}${positionClass}${relegationClass}`} aria-label={labels.join(', ') || undefined}><td><span className={`table-rank ${rank <= 2 ? 'rank-promo' : ''}`}>{rank}</span></td><td><span className="table-club"><ClubCrest name={team.name} seedKey={team.id} imageSrc={getClubCrestImage(game, team.id)} small /><span className="table-club-name">{onOpenClubProfile ? <button type="button" className="table-club-profile-button" onClick={() => onOpenClubProfile(team.id)}>{team.name}</button> : team.name}{isDirectPromotion && <small className="table-zone-badge table-zone-direct">Awans</small>}{isPromotionCandidate && !isDirectPromotion && <small className="table-zone-badge table-zone-candidate">Lider grupy</small>}{isPlayoff && <small className="table-zone-badge table-zone-playoff">Baraże</small>}{isMaintenancePlayoff && <small className="table-zone-badge table-zone-playoff">Utrzymanie</small>}{isRelegated && <small className="table-zone-badge table-zone-relegation">Spadek</small>}</span></span></td><td>{team.played}</td><td>{team.wins}</td><td>{team.draws}</td><td>{team.losses}</td><td>{team.goalsFor}</td><td>{team.goalsAgainst}</td><td>{team.goalsFor - team.goalsAgainst > 0 ? '+' : ''}{team.goalsFor - team.goalsAgainst}</td><td>{team.yellowCards ?? 0}</td><td>{team.redCards ?? 0}</td><td>{team.fairPlayPoints ?? 0}</td><td><strong>{team.points}</strong></td></tr>
    })}
  </tbody></table>
  {!limit && <div className="table-position-legend">
    <span><i className="table-position-mark table-position-mark-champion" /> Mistrz ligi</span>
    <span><i className="table-position-mark table-position-mark-runner-up" /> Wicemistrz</span>
    <span><i className="table-position-mark table-position-mark-third" /> 3. miejsce</span>
    {zones.directPromotionRanks.length > 0 && <span><i className="table-position-mark table-position-mark-direct" /> Awans bezpośredni</span>}
    {zones.promotionCandidateRanks.length > 0 && <span><i className="table-position-mark table-position-mark-candidate" /> Lider grupy — kandydat do awansu</span>}
    {zones.playoffRanks.length > 0 && <span><i className="table-position-mark table-position-mark-playoff" /> Baraże o awans</span>}
    {zones.maintenancePlayoffRanks.length > 0 && <span><i className="table-position-mark table-position-mark-playoff" /> Baraże o utrzymanie</span>}
    {zones.relegationRanks.length > 0 && <span><i className="table-position-mark table-position-mark-relegation" /> Spadek — ostatnie {zones.relegationRanks.length}</span>}
  </div>}
  {limit && <div className="table-caption"><span><i className="caption-own-dot" /> Twój klub</span><span>{leagues.find((league) => league.id === game.leagueId)?.name} · {game.season}</span></div>}
    </div>
  </div>
}

type LeagueStatisticCategory = 'goals' | 'assists' | 'yellowCards' | 'redCards' | 'appearances' | 'averageRating' | 'cleanSheets'

function LeagueStatisticsPage({ game }: { game: GameState }) {
  const [category, setCategory] = useState<LeagueStatisticCategory>('goals')
  const leagueName = leagues.find((league) => league.id === game.leagueId)?.name ?? 'Liga'
  const rows = game.teams.flatMap((team) => {
    const players = team.id === game.teamId
      ? game.squad
      : (game.clubSquads[team.id] ?? []).map(({ player }) => player)
    return players.map((player) => {
      const discipline = getCompetitionDiscipline(player, 'league')
      return {
        playerId: player.id,
        playerName: `${player.firstName} ${player.lastName}`,
        clubName: team.name,
        appearances: player.seasonAppearances ?? 0,
        goals: player.seasonGoals ?? 0,
        assists: player.seasonAssists ?? 0,
        yellowCards: discipline.yellowCardsTotal,
        redCards: discipline.redCards,
        averageRating: player.seasonRatedAppearances
          ? (player.seasonRatingTotal ?? 0) / player.seasonRatedAppearances
          : 0,
        cleanSheets: player.seasonCleanSheets ?? 0,
      }
    })
  })
  const categories: Array<{ id: LeagueStatisticCategory; label: string; heading: string }> = [
    { id: 'goals', label: 'Strzelcy', heading: 'Klasyfikacja strzelców' },
    { id: 'assists', label: 'Asysty', heading: 'Klasyfikacja asystentów' },
    { id: 'yellowCards', label: 'Żółte kartki', heading: 'Klasyfikacja żółtych kartek' },
    { id: 'redCards', label: 'Czerwone kartki', heading: 'Klasyfikacja czerwonych kartek' },
    { id: 'appearances', label: 'Występy', heading: 'Najwięcej występów' },
    { id: 'averageRating', label: 'Średnia ocen', heading: 'Najwyższa średnia ocen' },
    { id: 'cleanSheets', label: 'Czyste konta', heading: 'Klasyfikacja czystych kont' },
  ]
  const selectedCategory = categories.find((item) => item.id === category) ?? categories[0]
  const sortedRows = [...rows]
    .filter((row) => row[category] > 0)
    .sort((first, second) =>
      second[category] - first[category]
      || second.goals - first.goals
      || second.appearances - first.appearances
      || first.playerName.localeCompare(second.playerName, 'pl'),
    )
  const totalGoals = rows.reduce((total, row) => total + row.goals, 0)
  const totalAssists = rows.reduce((total, row) => total + row.assists, 0)
  const totalYellowCards = rows.reduce((total, row) => total + row.yellowCards, 0)
  const totalRedCards = rows.reduce((total, row) => total + row.redCards, 0)
  const valueLabels: Record<LeagueStatisticCategory, string> = {
    goals: 'Bramki',
    assists: 'Asysty',
    yellowCards: 'Żółte kartki',
    redCards: 'Czerwone kartki',
    appearances: 'Występy',
    averageRating: 'Średnia ocena',
    cleanSheets: 'Czyste konta',
  }
  const statisticColumns: Array<{ key: LeagueStatisticCategory; label: string }> = category === 'appearances'
    ? [{ key: 'appearances', label: 'Występy' }, { key: 'goals', label: 'Bramki' }]
    : [{ key: 'appearances', label: 'Występy' }, { key: category, label: valueLabels[category] }]

  return <section className="league-statistics-page">
    <div className="league-statistics-summary">
      {[
        { label: 'Bramki w lidze', value: totalGoals },
        { label: 'Asysty w lidze', value: totalAssists },
        { label: 'Żółte kartki', value: totalYellowCards },
        { label: 'Czerwone kartki', value: totalRedCards },
      ].map((item) => <article className="panel-card league-statistics-summary-card" key={item.label}>
        <span>{item.label}</span><strong>{item.value}</strong>
      </article>)}
    </div>
    <section className="panel-card league-statistics-panel">
      <div className="panel-heading">
        <div><p className="eyebrow">{leagueName.toLocaleUpperCase('pl')} · SEZON {game.season}</p><h2>{selectedCategory.heading}</h2></div>
        <span className="table-season-tag">Po kolejce {Math.max(0, game.round - 1)}</span>
      </div>
      <div className="league-statistics-tabs" role="tablist" aria-label="Rodzaj statystyk ligowych">
        {categories.map((item) => <button
          type="button"
          role="tab"
          aria-selected={category === item.id}
          className={category === item.id ? 'league-statistics-tab league-statistics-tab-active' : 'league-statistics-tab'}
          key={item.id}
          onClick={() => setCategory(item.id)}
        >{item.label}</button>)}
      </div>
      <div className="league-table-container league-statistics-table-container">
        <table className="league-table league-statistics-table">
          <thead><tr><th>#</th><th>Zawodnik</th><th>Klub</th>{statisticColumns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead>
          <tbody>{sortedRows.map((row, index) => <tr className={row.clubName === game.clubName ? 'own-team-row' : ''} key={row.playerId}>
            <td><span className={`table-rank ${index === 0 ? 'rank-promo' : ''}`}>{index + 1}</span></td>
            <td><strong>{row.playerName}</strong></td>
            <td>{row.clubName}</td>
            {statisticColumns.map((column) => <td key={column.key}>
              <strong>{column.key === 'averageRating' ? row[column.key].toFixed(1) : row[column.key]}</strong>
            </td>)}
          </tr>)}</tbody>
        </table>
        {!sortedRows.length && <p className="league-statistics-empty">Statystyki pojawią się po rozegraniu meczów ligowych.</p>}
      </div>
      <p className="league-statistics-note">Statystyki dotyczą bieżącego sezonu ligowego i są aktualizowane po każdej rozegranej kolejce.</p>
    </section>
  </section>
}

function PlayerStatisticsPage({ game, onOpenProfile }: { game: GameState; onOpenProfile: (player: Player) => void }) {
  const rows = [...game.squad]
    .map((player) => ({
      player,
      league: getCompetitionDiscipline(player, 'league'),
      cup: getCompetitionDiscipline(player, 'polish-cup'),
    }))
    .sort((first, second) =>
      (second.player.seasonAppearances ?? 0) + (second.player.cupAppearances ?? 0)
      - (first.player.seasonAppearances ?? 0) - (first.player.cupAppearances ?? 0)
      || second.player.skill - first.player.skill
      || first.player.lastName.localeCompare(second.player.lastName, 'pl'),
    )
  const totals = rows.reduce((summary, row) => {
    summary.appearances += (row.player.seasonAppearances ?? 0) + (row.player.cupAppearances ?? 0)
    summary.goals += (row.player.seasonGoals ?? 0) + (row.player.cupGoals ?? 0)
    summary.yellowCards += row.league.yellowCardsTotal + row.cup.yellowCardsTotal
    summary.redCards += row.league.redCards + row.cup.redCards
    summary.suspensions += row.league.suspendedMatches + row.cup.suspendedMatches
    return summary
  }, { appearances: 0, goals: 0, yellowCards: 0, redCards: 0, suspensions: 0 })

  return <section className="league-statistics-page player-statistics-page">
    <div className="league-statistics-summary">
      {[
        { label: 'Występy w sezonie', value: totals.appearances },
        { label: 'Bramki w sezonie', value: totals.goals },
        { label: 'Żółte kartki', value: totals.yellowCards },
        { label: 'Czerwone kartki', value: totals.redCards },
        { label: 'Aktywne pauzy', value: totals.suspensions },
      ].map((item) => <article className="panel-card league-statistics-summary-card" key={item.label}>
        <span>{item.label}</span><strong>{item.value}</strong>
      </article>)}
    </div>
    <section className="panel-card league-statistics-panel">
      <div className="panel-heading">
        <div><p className="eyebrow">SEZON {game.season} · PIERWSZA DRUŻYNA</p><h2>Statystyki piłkarzy</h2></div>
        <span className="table-season-tag">{rows.length} zawodników</span>
      </div>
      <div className="league-table-container league-statistics-table-container player-statistics-table-container">
        <table className="league-table player-statistics-table">
          <thead><tr>
            <th>#</th><th>Zawodnik</th><th title="Występy ligowe">Wyst. liga</th><th title="Bramki ligowe">Gole liga</th>
            <th title="Asysty ligowe">Asysty</th><th title="Żółte kartki ligowe">ŻK liga</th><th title="Czerwone kartki ligowe">CK liga</th>
            <th title="Występy w Polskim Pucharze">Wyst. PP</th><th title="Bramki w Polskim Pucharze">Gole PP</th>
            <th title="Żółte kartki w Polskim Pucharze">ŻK PP</th><th title="Czerwone kartki w Polskim Pucharze">CK PP</th>
            <th title="Aktywne zawieszenia ligowe">Pauza liga</th><th title="Aktywne zawieszenia w Polskim Pucharze">Pauza PP</th>
          </tr></thead>
          <tbody>{rows.map(({ player, league, cup }, index) => <tr key={player.id}>
            <td><span className={`table-rank ${index === 0 ? 'rank-promo' : ''}`}>{index + 1}</span></td>
            <td><button type="button" className="table-player-profile-button" onClick={() => onOpenProfile(player)}><PositionBadge position={player.position} /><PlayerName player={player} /></button></td>
            <td>{player.seasonAppearances ?? 0}</td><td>{player.seasonGoals ?? 0}</td><td>{player.seasonAssists ?? 0}</td>
            <td>{league.yellowCardsTotal}</td><td>{league.redCards}</td>
            <td>{player.cupAppearances ?? 0}</td><td>{player.cupGoals ?? 0}</td>
            <td>{cup.yellowCardsTotal}</td><td>{cup.redCards}</td>
            <td>{league.suspendedMatches}</td><td>{cup.suspendedMatches}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <p className="league-statistics-note">Kartki i pauzy są rozdzielone na ligę oraz Polski Puchar. Pauza w jednych rozgrywkach nie wyklucza gry w drugich.</p>
    </section>
  </section>
}

function OtherLeaguesPage({ game, onOpenClubProfile }: { game: GameState; onOpenClubProfile: (teamId: string) => void }) {
  const availableGroups = transferMarketTiers.flatMap(({ tier }) => getTransferMarketGroups(game, tier))
    .filter((group) => group.id !== game.leagueId)
  const availableTiers = transferMarketTiers.filter(({ tier }) =>
    availableGroups.some((group) => getLeagueTier(group.id as LeagueId) === tier),
  )
  const [selectedTier, setSelectedTier] = useState<LeagueTier>(() => availableTiers[0]?.tier ?? 1)
  const groupsForTier = availableGroups.filter((group) => getLeagueTier(group.id as LeagueId) === selectedTier)
  const [selectedLeagueId, setSelectedLeagueId] = useState(() => groupsForTier[0]?.id ?? availableGroups[0]?.id ?? '')
  const leagueId = groupsForTier.some((group) => group.id === selectedLeagueId)
    ? selectedLeagueId
    : groupsForTier[0]?.id ?? ''
  const league = leagues.find((entry) => entry.id === leagueId)
  const teams = leagueId ? getLeagueTable({ ...game, leagueId: leagueId as LeagueId, teams: game.leagueWorld?.[leagueId] ?? [] }) : []
  const tableGame = leagueId
    ? { ...game, leagueId: leagueId as LeagueId, teams }
    : game

  return <section className="panel-card table-panel other-leagues-panel">
    <div className="panel-heading">
      <div><p className="eyebrow">ROZGRYWKI W POLSCE</p><h2>Podgląd innych lig</h2><p className="other-leagues-description">Sprawdź aktualne tabele lig i grup w swojej karierze.</p></div>
      <span className="table-season-tag">{game.season}</span>
    </div>
    {availableGroups.length === 0 ? <div className="empty-state">Brak innych lig do wyświetlenia w tym zapisie.</div> : <>
      <div className="other-leagues-filters">
        <label><span>Poziom rozgrywek</span><select value={selectedTier} onChange={(event) => {
          const tier = Number(event.target.value) as LeagueTier
          setSelectedTier(tier)
          const firstGroup = availableGroups.find((group) => getLeagueTier(group.id as LeagueId) === tier)
          setSelectedLeagueId(firstGroup?.id ?? '')
        }}>{availableTiers.map(({ tier, name }) => <option key={tier} value={tier}>{name}</option>)}</select></label>
        <label><span>Liga / grupa</span><select value={leagueId} onChange={(event) => setSelectedLeagueId(event.target.value)}>{groupsForTier.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
      </div>
      {leagueId && <div className="other-leagues-table">
        <div className="other-leagues-table-heading"><strong>{league?.name ?? leagueId}</strong><span>{teams.length} drużyn</span></div>
        {leagueId.startsWith('zachodniopomorskie-b-') && <p className="other-leagues-promotion-note">Mistrzowie 7 grup awansują bezpośrednio do A klasy. Mistrzowie dwóch pozostałych grup rozgrywają pojedynczy mecz barażowy o ostatnie miejsce. „Awans” oznacza miejsce bezpośrednie, a „Baraże” — udział w meczu po zakończeniu sezonu.</p>}
        <LeagueTable game={tableGame} table={teams} clubId={game.teamId} onOpenClubProfile={onOpenClubProfile} />
      </div>}
    </>}
  </section>
}

function TacticsPanel({ game, onUpdate, inMatch = false }: { game: GameState; onUpdate: (game: GameState, message?: string) => void; inMatch?: boolean }) {
  const [presetState, setPresetState] = useState(() => {
    try {
      return { presets: readTacticPresets(), error: '' }
    } catch (error) {
      return { presets: [], error: error instanceof Error ? error.message : 'Nie udało się odczytać wariantów składu.' }
    }
  })
  const [newPresetName, setNewPresetName] = useState('')
  const update = (changes: { formation?: Formation; style?: TacticalStyle; pressing?: PressingIntensity }) => {
    onUpdate(setTactics(game, changes), 'Plan taktyczny zapisany.')
  }
  const getPlayerReference = (playerId: string): TacticPresetPlayer | null => {
    const player = game.squad.find((candidate) => candidate.id === playerId)
    if (!player) return null
    return {
      shirtNumber: player.shirtNumber ?? null,
      name: `${player.firstName} ${player.lastName}`,
      position: player.position,
    }
  }
  function persistPresets(presets: TacticPreset[]) {
    if (!writeStorage(TACTIC_PRESETS_KEY, JSON.stringify(presets))) {
      setPresetState((state) => ({ ...state, error: 'Nie udało się zapisać wariantów w tej przeglądarce.' }))
      return false
    }
    setPresetState({ presets, error: '' })
    return true
  }
  function makePreset(name: string, id: string): TacticPreset {
    const lineupSlots = game.matchLineupPositions?.formation === game.tactics.formation
      ? Object.fromEntries(Object.entries(game.matchLineupPositions.slots).flatMap(([slotIndex, playerId]) => {
        const reference = getPlayerReference(playerId)
        return reference ? [[slotIndex, reference]] : []
      }))
      : {}
    return {
      id,
      name,
      formation: game.tactics.formation,
      style: game.tactics.style,
      pressing: game.tactics.pressing,
      lineup: game.matchLineupIds.flatMap((playerId) => {
        const reference = getPlayerReference(playerId)
        return reference ? [reference] : []
      }),
      bench: game.matchBenchIds.flatMap((playerId) => {
        const reference = getPlayerReference(playerId)
        return reference ? [reference] : []
      }),
      outside: (game.matchOutsideSquadIds ?? []).flatMap((playerId) => {
        const reference = getPlayerReference(playerId)
        return reference ? [reference] : []
      }),
      lineupSlots,
    }
  }
  function savePreset(name: string, existingId?: string) {
    const normalizedName = name.trim().slice(0, 32)
    if (!normalizedName) {
      setPresetState((state) => ({ ...state, error: 'Wpisz nazwę wariantu.' }))
      return
    }
    const duplicate = presetState.presets.find((preset) => preset.name.toLocaleLowerCase('pl-PL') === normalizedName.toLocaleLowerCase('pl-PL'))
    if (existingId && duplicate && duplicate.id !== existingId) {
      setPresetState((state) => ({ ...state, error: 'Ta nazwa jest już używana przez inny wariant.' }))
      return
    }
    const id = existingId ?? duplicate?.id ?? `preset-${Date.now()}`
    if (!existingId && !duplicate && presetState.presets.length >= 12) {
      setPresetState((state) => ({ ...state, error: 'Możesz zapisać maksymalnie 12 wariantów. Usuń jeden, aby dodać kolejny.' }))
      return
    }
    if (persistPresets([...presetState.presets.filter((preset) => preset.id !== id), makePreset(normalizedName, id)])) {
      setNewPresetName('')
    }
  }
  function resolvePlayer(reference: TacticPresetPlayer, usedIds: Set<string>) {
    const normalizedName = reference.name.toLocaleLowerCase('pl-PL')
    return game.squad.find((player) => !usedIds.has(player.id)
      && `${player.firstName} ${player.lastName}`.toLocaleLowerCase('pl-PL') === normalizedName)
      ?? game.squad.find((player) => !usedIds.has(player.id)
        && player.shirtNumber === reference.shirtNumber && player.position === reference.position)
      ?? game.squad.find((player) => !usedIds.has(player.id) && player.shirtNumber === reference.shirtNumber)
  }
  function applyPreset(preset: TacticPreset) {
    const competition = getNextScheduledCompetition(game) === 'polish-cup' ? 'polish-cup' : 'league'
    const isAvailable = (player: Player) =>
      (player.injury?.matchesRemaining ?? 0) <= 0 && getSuspensionMatches(player, competition) === 0
    const usedIds = new Set<string>()
    const resolveList = (references: TacticPresetPlayer[]) => references.flatMap((reference) => {
      const player = resolvePlayer(reference, usedIds)
      if (!player) return []
      usedIds.add(player.id)
      return [player.id]
    })
    const savedLineupIds = resolveList(preset.lineup)
    const savedBenchIds = resolveList(preset.bench)
    const savedOutsideIds = resolveList(preset.outside)
    const reservedOutsideIds = new Set(savedOutsideIds)
    const lineupIds = savedLineupIds.filter((id) => {
      const player = game.squad.find((candidate) => candidate.id === id)
      return Boolean(player && isAvailable(player))
    })
    const fallbackStarters = [
      ...savedBenchIds.map((id) => game.squad.find((player) => player.id === id)),
      ...game.matchLineupIds.map((id) => game.squad.find((player) => player.id === id)),
      ...[...game.squad].sort((first, second) => second.skill - first.skill),
    ].filter((player): player is Player => Boolean(player))
    for (const player of fallbackStarters) {
      if (lineupIds.length >= 11) break
      if (!isAvailable(player) || lineupIds.includes(player.id) || reservedOutsideIds.has(player.id)) continue
      if (player.position === 'BR' && lineupIds.some((id) => game.squad.find((candidate) => candidate.id === id)?.position === 'BR')) continue
      lineupIds.push(player.id)
    }
    const benchIds = savedBenchIds.filter((id) => {
      const player = game.squad.find((candidate) => candidate.id === id)
      return Boolean(player && isAvailable(player) && !lineupIds.includes(id) && !reservedOutsideIds.has(id))
    }).slice(0, 7)
    for (const player of [
      ...game.matchBenchIds.map((id) => game.squad.find((candidate) => candidate.id === id)).filter((player): player is Player => Boolean(player)),
      ...[...game.squad].sort((first, second) => second.skill - first.skill),
    ]) {
      if (benchIds.length >= 7) break
      if (!isAvailable(player) || lineupIds.includes(player.id) || benchIds.includes(player.id) || reservedOutsideIds.has(player.id)) continue
      benchIds.push(player.id)
    }
    const savedOutside = savedOutsideIds.filter((id) => !lineupIds.includes(id) && !benchIds.includes(id))
    const availableOutside = game.squad
      .filter((player) => !lineupIds.includes(player.id) && !benchIds.includes(player.id) && isAvailable(player))
      .map((player) => player.id)
    const unavailableOutside = game.squad
      .filter((player) => !lineupIds.includes(player.id) && !benchIds.includes(player.id) && !isAvailable(player))
      .map((player) => player.id)
    const nextGame = structuredClone(game)
    nextGame.tactics = { formation: preset.formation, style: preset.style, pressing: preset.pressing }
    nextGame.matchLineupIds = lineupIds
    nextGame.matchBenchIds = benchIds
    nextGame.matchOutsideSquadIds = [
      ...savedOutside.filter((id) => availableOutside.includes(id)),
      ...availableOutside.filter((id) => !savedOutside.includes(id)),
      ...savedOutside.filter((id) => unavailableOutside.includes(id)),
      ...unavailableOutside.filter((id) => !savedOutside.includes(id)),
    ]
    const slots: Record<string, string> = {}
    for (const [slotIndex, reference] of Object.entries(preset.lineupSlots)) {
      const player = resolvePlayer(reference, new Set())
      if (player && lineupIds.includes(player.id)) slots[slotIndex] = player.id
    }
    nextGame.matchLineupPositions = { formation: preset.formation, slots }
    onUpdate(nextGame, `${preset.name} — wariant składu i taktyki zastosowany.${lineupIds.length < 11 ? ' Nie wszyscy zawodnicy z wariantu są dostępni; skład uzupełniono aktualną kadrą.' : ''}`)
  }
  const formationRows = [...formationSlotRows[game.tactics.formation]].reverse()
  return <section className="tactics-panel">
    <div className="tactics-heading"><span className="training-icon"><Compass size={19} /></span><div><p className="eyebrow">{inMatch ? 'ZMIANY W TRAKCIE MECZU' : 'PRZYGOTOWANIE MECZOWE'}</p><h2>{inMatch ? 'Dostosuj taktykę' : 'Plan taktyczny'}</h2><p>Ustawienia wpływają na siłę ataku, obrony i zmęczenie po meczu.</p></div></div>
    <div className="tactics-layout">
      <div className="tactics-preview">
        <div className="tactics-preview-heading"><strong>Podgląd ustawienia</strong><span>{game.tactics.formation}</span></div>
        <div className="tactics-pitch" role="img" aria-label={`Ustawienie ${game.tactics.formation}: ${formationSlotRows[game.tactics.formation].flat().map((position) => positionLabels[position]).join(', ')}`}>
          <span className="tactics-pitch-box tactics-pitch-box-top" aria-hidden="true" />
          <span className="tactics-pitch-box tactics-pitch-box-bottom" aria-hidden="true" />
          <span className="tactics-pitch-center-line" aria-hidden="true" />
          <span className="tactics-pitch-center-circle" aria-hidden="true" />
          <div className="tactics-pitch-row">
            {formationRows.map((slots, rowIndex) => <div className="tactics-pitch-line" key={`${rowIndex}-${slots.join('-')}`}>
              {slots.map((slot, slotIndex) => <span className="tactics-pitch-position" key={`${slot}-${slotIndex}`} title={positionLabels[slot]}><i /><small>{positionAbbreviations[slot]}</small></span>)}
            </div>)}
          </div>
        </div>
        <span className="tactics-pitch-caption">Bramka własna na dole boiska</span>
      </div>
      <div className="tactics-options">
        <div className="tactics-formation-picker" role="group" aria-label="Wybierz ustawienie drużyny">
          <strong>Wybierz ustawienie</strong>
          <div className="tactics-formation-options">
            {formationOptions.map((option) => <button
              type="button"
              key={option.id}
              className={`tactics-formation-option ${game.tactics.formation === option.id ? 'tactics-formation-option-selected' : ''}`}
              aria-label={`${option.label}. ${option.description}`}
              aria-pressed={game.tactics.formation === option.id}
              onClick={() => update({ formation: option.id })}
            >
              <span className="tactics-formation-mini" aria-hidden="true">
                {[...formationSlotRows[option.id]].reverse().map((row, rowIndex) => <span className="tactics-formation-mini-row" key={`${option.id}-${rowIndex}`}>
                  {row.map((position, positionIndex) => <i key={`${position}-${positionIndex}`} />)}
                </span>)}
              </span>
              <span className="tactics-formation-option-copy"><b>{option.label}</b><small>{option.description}</small></span>
            </button>)}
          </div>
        </div>
        <div className="tactics-controls">
        <label><span>Styl gry</span><select aria-label="Styl gry" value={game.tactics.style} onChange={(event) => update({ style: event.target.value as TacticalStyle })}>
          <option value="balanced">Zrównoważony — bez dużego ryzyka</option><option value="attacking">Ofensywny — mocniejszy atak, słabsza obrona</option><option value="counter">Kontratak — szybkie wyjścia i stabilna obrona</option>
        </select></label>
        <label><span>Pressing</span><select aria-label="Intensywność pressingu" value={game.tactics.pressing} onChange={(event) => update({ pressing: event.target.value as PressingIntensity })}>
          <option value="low">Niski — oszczędza kondycję</option><option value="normal">Normalny — standardowa intensywność</option><option value="high">Wysoki — mocniejszy pressing, większe zmęczenie</option>
        </select></label>
        </div>
      </div>
    </div>
    {game.tactics.pressing === 'high' && <p className="tactics-warning"><Activity size={14} /> Wysoki pressing szybciej zużywa kondycję podstawowych zawodników.</p>}
    {!inMatch && <div className="tactic-presets">
      <div className="tactic-presets-heading">
        <div><strong>Zapisane warianty</strong><small>Warianty są dostępne także w nowych karierach na tym urządzeniu.</small></div>
        <span>{presetState.presets.length} / 12</span>
      </div>
      <form className="tactic-preset-save" onSubmit={(event) => {
        event.preventDefault()
        savePreset(newPresetName)
      }}>
        <input
          aria-label="Nazwa nowego wariantu"
          maxLength={32}
          placeholder="Nazwa, np. Ofensywnie"
          value={newPresetName}
          onChange={(event) => setNewPresetName(event.target.value)}
        />
        <button className="secondary-button" type="submit" disabled={!newPresetName.trim()}>Zapisz aktualny skład</button>
      </form>
      {presetState.error && <p className="tactic-preset-error" role="alert">{presetState.error}</p>}
      {presetState.presets.length > 0
        ? <div className="tactic-preset-list">{presetState.presets.map((preset) => <article className="tactic-preset-card" key={preset.id}>
          <div className="tactic-preset-summary">
            <strong>{preset.name}</strong>
            <span>{preset.formation} · {preset.lineup.length} zawodników · {preset.style === 'attacking' ? 'ofensywny' : preset.style === 'counter' ? 'kontratak' : 'zrównoważony'} · pressing {preset.pressing === 'high' ? 'wysoki' : preset.pressing === 'low' ? 'niski' : 'normalny'}</span>
          </div>
          <div className="tactic-preset-actions">
            <button type="button" className="primary-button" onClick={() => applyPreset(preset)}>Zastosuj</button>
            <button type="button" className="secondary-button" onClick={() => savePreset(preset.name, preset.id)}>Nadpisz</button>
            <button type="button" className="secondary-button tactic-preset-delete" aria-label={`Usuń wariant ${preset.name}`} onClick={() => persistPresets(presetState.presets.filter((item) => item.id !== preset.id))}>Usuń</button>
          </div>
        </article>)}</div>
        : <p className="tactic-presets-empty">Zapisz aktualny skład, aby szybko przywracać go przed kolejnymi meczami lub w nowych karierach.</p>}
    </div>}
  </section>
}

function TacticalReport({ report }: { report: NonNullable<GameState['lastMatchReport']> }) {
  return <>
    <section className={`tactical-report tactical-report-${report.outcome}`} id="match-report">
      <div><p className="eyebrow">RAPORT MECZOWY · KOLEJKA {report.round} · {report.score}</p><h2>{report.headline}</h2><p>{report.summary}</p><small>{report.tacticalNote}</small></div>
      <Trophy size={20} />
    </section>
  </>
}

function PlayerMatchRatings({ playerRatings }: {
  playerRatings: NonNullable<GameState['lastMatchReport']>['playerRatings']
}) {
  const sortedRatings = [...(playerRatings ?? [])].sort((first, second) => second.rating - first.rating || second.goals - first.goals)
  const bestPlayer = sortedRatings[0]
  const lowestPlayer = sortedRatings[sortedRatings.length - 1]
  if (!sortedRatings.length) return null
  return <section className="panel-card player-match-ratings">
      <div className="panel-heading"><div><p className="eyebrow">OCENY PO MECZU</p><h2>Występ drużyny</h2></div><span className="roster-count">{sortedRatings.length} zawodników</span></div>
      {bestPlayer && lowestPlayer && <div className="match-rating-highlights">
        <span><Star size={14} /><span>Najlepszy występ <strong>{bestPlayer.playerName} · {bestPlayer.rating.toFixed(1)}</strong></span></span>
        <span><Activity size={14} /><span>Do poprawy <strong>{lowestPlayer.playerName} · {lowestPlayer.rating.toFixed(1)}</strong></span></span>
      </div>}
      <div className="match-rating-list">{sortedRatings.map((performance) => <div className="match-rating-row" key={performance.playerId}>
        <strong className={`match-rating-score ${performance.rating >= 7.5 ? 'match-rating-high' : performance.rating < 5.5 ? 'match-rating-low' : ''}`}>{performance.rating.toFixed(1)}</strong>
        <span><strong>{performance.playerName}</strong><small>{performance.position ? `${positionAbbreviations[performance.position]} · ` : ''}{performance.appearance === 'starting' ? 'W podstawowym składzie' : 'Rezerwowy'}{performance.goals ? ` · ${performance.goals} ${performance.goals === 1 ? 'gol' : performance.goals < 5 ? 'gole' : 'goli'}` : ''}</small></span>
        {performance.goals > 0 && <span className="match-rating-goals">⚽ {performance.goals}</span>}
      </div>)}</div>
      <p className="match-rating-explainer">Ocena uwzględnia wynik zespołu, gole, morale i kartki. Nota 8,5 lub wyższa może podnieść overall o 1, do poziomu potencjału.</p>
    </section>
}

function PlayerOverallsCard({ playback }: { playback: LiveMatchPlayback }) {
  const startingPlayersById = new Map(playback.startingGame.squad.map((player) => [player.id, player]))
  const ratedPlayerIds = new Set(
    playback.finalGame.lastMatchReport?.matchId === playback.matchId
      ? playback.finalGame.lastMatchReport.playerRatings?.map((performance) => performance.playerId) ?? []
      : [],
  )
  const players = playback.finalGame.squad
    .filter((player) => ratedPlayerIds.size === 0 || ratedPlayerIds.has(player.id))
    .map((player) => ({
      player,
      previousOverall: startingPlayersById.get(player.id)?.skill ?? player.skill,
    }))
    .sort((first, second) => second.player.skill - first.player.skill || first.player.lastName.localeCompare(second.player.lastName, 'pl'))

  return <section className="panel-card player-overalls-card" aria-label="Overalle zawodników">
    <div className="panel-heading"><div><p className="eyebrow">ROZWÓJ PO MECZU</p><h2>Overalle zawodników</h2></div><span className="roster-count">{players.length} zawodników</span></div>
    {players.length ? <div className="player-overalls-list">{players.map(({ player, previousOverall }) => {
      const increase = player.skill - previousOverall
      return <div className="player-overall-row" key={player.id}>
        <PositionBadge position={player.position} />
        <strong className="player-overall-name"><PlayerName player={player} /></strong>
        <span className="player-overall-value">{player.skill}</span>
        {increase > 0
          ? <span className="player-overall-increase">+{increase}</span>
          : <span className="player-overall-no-change">bez zmian</span>}
      </div>
    })}</div> : <p className="player-overalls-empty">Brak zawodników do wyświetlenia.</p>}
    {!players.some(({ player, previousOverall }) => player.skill > previousOverall) && players.length > 0
      ? <p className="player-overalls-empty">Po tym meczu overall żadnego zawodnika nie wzrósł.</p>
      : null}
  </section>
}

function MatchEventsCard({ playback }: { playback: LiveMatchPlayback }) {
  const getPlayerName = (playerId: string) => {
    const player = playback.finalGame.squad.find((candidate) => candidate.id === playerId)
      ?? playback.startingGame.squad.find((candidate) => candidate.id === playerId)
    return player ? `${player.firstName} ${player.lastName}` : 'Nieznany zawodnik'
  }
  type MatchEventRow = {
    id: string
    minute: number
    addedTime?: number
    side: 'home' | 'away'
    period: MatchTimelinePeriod
    type: 'goal' | 'own-goal' | 'penalty-goal' | 'penalty-missed' | 'penalty-kick-scored' | 'penalty-kick-missed' | 'yellow-card' | 'red-card' | 'second-yellow-red' | 'substitution' | 'injury'
    playerName: string
    incomingPlayerName?: string
  }
  const events: MatchEventRow[] = []

  playback.incidents.forEach((incident, index) => {
    const side = incident.teamName === playback.homeName
      ? 'home'
      : incident.teamName === playback.awayName
        ? 'away'
        : undefined
    if (incident.kind === 'card' && side && incident.scorerName && incident.period) {
      events.push({
        id: `card-${incident.minute}-${index}`,
        minute: incident.minute,
        addedTime: incident.addedTime,
        side,
        period: incident.period,
        type: incident.secondYellow ? 'second-yellow-red' : incident.card === 'red' ? 'red-card' : 'yellow-card',
        playerName: incident.scorerName,
      })
    } else if (incident.kind === 'goal' && side && incident.scorerName && incident.period) {
      events.push({
        id: `goal-${incident.minute}-${index}`,
        minute: incident.minute,
        addedTime: incident.addedTime,
        side,
        period: incident.period,
        type: incident.goalType === 'own-goal' ? 'own-goal' : incident.goalType === 'penalty' ? 'penalty-goal' : 'goal',
        playerName: incident.scorerName,
      })
    } else if (incident.kind === 'penalty-missed' && side && incident.scorerName && incident.period) {
      events.push({
        id: `penalty-missed-${incident.minute}-${index}`,
        minute: incident.minute,
        addedTime: incident.addedTime,
        side,
        period: incident.period,
        type: 'penalty-missed',
        playerName: incident.scorerName,
      })
    } else if (incident.kind === 'injury' && side && incident.scorerName && incident.period) {
      events.push({
        id: `injury-${incident.minute}-${index}`,
        minute: incident.minute,
        addedTime: incident.addedTime,
        side,
        period: incident.period,
        type: 'injury',
        playerName: incident.scorerName,
      })
    }
  })

  playback.substitutions.forEach((substitution, index) => {
    events.push({
      id: `substitution-${index}-${substitution.outgoingPlayerId}-${substitution.incomingPlayerId}`,
      minute: substitution.minute,
      side: substitution.teamId === playback.homeId ? 'home' : 'away',
      period: substitution.minute > 105 && playback.extraTimePlayed
        ? 'extra-time-second-half'
        : substitution.minute > 90 && playback.extraTimePlayed
          ? 'extra-time-first-half'
          : substitution.minute <= 45
            ? 'first-half'
            : 'second-half',
      type: 'substitution',
      playerName: getPlayerName(substitution.outgoingPlayerId),
      incomingPlayerName: getPlayerName(substitution.incomingPlayerId),
    })
  })

  const periods: Array<{ id: MatchTimelinePeriod; label: string }> = [
    ...(playback.extraTimePlayed ? [
      { id: 'extra-time-second-half' as const, label: 'II połowa dogrywki' },
      { id: 'extra-time-first-half' as const, label: 'I połowa dogrywki' },
    ] : []),
    { id: 'second-half', label: 'II połowa' },
    { id: 'first-half', label: 'I połowa' },
  ]
  const eventCount = events.length + (playback.penaltyShootoutEvents?.length ?? 0)
  const renderEventContent = (event: MatchEventRow) => <div className={`match-event-content match-event-${event.type}`}>
    {event.type === 'substitution'
      ? <span className="match-event-substitution-arrows" aria-label="zmiana zawodników"><b>↓</b><b>↑</b></span>
      : event.type === 'injury'
        ? <span className="match-event-injury-icon" aria-label="kontuzja"><Ambulance size={17} /></span>
      : event.type === 'yellow-card' || event.type === 'red-card' || event.type === 'second-yellow-red'
        ? <span className={`match-event-card-icon match-event-card-icon-${event.type}`} aria-label={event.type === 'red-card' ? 'czerwona kartka' : event.type === 'second-yellow-red' ? 'druga żółta kartka i czerwona' : 'żółta kartka'} />
      : <span className={`match-event-ball match-event-ball-${event.type}`} aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <circle cx="12" cy="12" r="9" />
          <path d="m9.4 8.8 2.6-1.7 2.6 1.7-.9 3.1h-3.4z" />
          <path d="m9.4 8.8-2.8-.9M14.6 8.8l2.8-.9m-6.8 4-1.2 3m4.6-3 1.2 3m-7.4-7.9-1.2-2m10.2 2 1.2-2m-4.8 10.9v2.3" />
        </svg>
        {(event.type === 'penalty-goal' || event.type === 'penalty-kick-scored') && <b>!</b>}
        {(event.type === 'penalty-missed' || event.type === 'penalty-kick-missed') && <i />}
      </span>}
    <span className="match-event-copy">
      {['goal', 'own-goal', 'penalty-goal'].includes(event.type) && <small>GOOOOOL!!!</small>}
      {event.type === 'own-goal' && <small>BRAMKA SAMOBÓJCZA</small>}
      {event.type === 'penalty-goal' && <small>Z KARNEGO</small>}
      {event.type === 'injury' && <small>KONTUZJA</small>}
      {event.type === 'yellow-card' && <small>ŻÓŁTA KARTKA</small>}
      {event.type === 'red-card' && <small>CZERWONA KARTKA</small>}
      {event.type === 'second-yellow-red' && <small>DRUGA ŻÓŁTA · CZERWONA</small>}
      {(event.type === 'penalty-missed' || event.type === 'penalty-kick-missed') && <strong>Karny nie trafiony</strong>}
      {event.type === 'penalty-kick-scored' && <small>TRAFIONY KARNY</small>}
      {event.type === 'substitution'
        ? <strong>({event.playerName}, {event.incomingPlayerName})</strong>
        : event.type === 'penalty-missed' || event.type === 'penalty-kick-missed'
          ? <span>{event.playerName}</span>
          : <strong>{event.playerName}</strong>}
    </span>
  </div>
  const renderTimelineRow = (event: MatchEventRow) => <li className="match-event-row" key={event.id}>
    <div className="match-event-side match-event-side-home">{event.side === 'home' && renderEventContent(event)}</div>
    <span className="match-event-minute">{event.minute}{event.addedTime ? `+${event.addedTime}` : ''}&apos;</span>
    <div className="match-event-side match-event-side-away">{event.side === 'away' && renderEventContent(event)}</div>
  </li>

  return <section className="panel-card match-events-card" aria-label="Przebieg meczu">
    <div className="panel-heading"><div><p className="eyebrow">PRZEBIEG MECZU</p><h2>Gole, kontuzje, kartki i zmiany</h2></div><span className="roster-count">{eventCount} {eventCount === 1 ? 'zdarzenie' : 'zdarzeń'}</span></div>
    <div className="match-events-team-headings" aria-hidden="true">
      <span>{playback.homeName}<small>GOSPODARZ</small></span>
      <span>MIN</span>
      <span>{playback.awayName}<small>GOŚĆ</small></span>
    </div>
    {periods.map((period) => {
      const periodEvents = events
        .filter((event) => event.period === period.id)
        .sort((first, second) => second.minute - first.minute || (second.addedTime ?? 0) - (first.addedTime ?? 0))
      return <section className="match-event-period" key={period.id}>
        <h3>{period.label}</h3>
        {periodEvents.length
          ? <ol className="match-events-list">{periodEvents.map(renderTimelineRow)}</ol>
          : <p className="match-events-empty">Bez bramek, kontuzji, kartek i zmian</p>}
      </section>
    })}
    {playback.penaltyShootoutEvents?.length ? <section className="match-event-shootout">
      <h3>Rzuty karne · {playback.penaltyScore}</h3>
      <ol className="match-events-list">{playback.penaltyShootoutEvents.map((kick, index) => {
        const side = kick.teamId === playback.homeId ? 'home' : 'away'
        const kickEvent: MatchEventRow = {
          id: `shootout-${kick.order}-${index}`,
          minute: kick.order,
          side,
          period: 'second-half',
          type: kick.scored ? 'penalty-kick-scored' : 'penalty-kick-missed',
          playerName: kick.playerName ?? 'Nieznany zawodnik',
        }
        return <li className="match-event-row match-event-shootout-row" key={kickEvent.id}>
          <div className="match-event-side match-event-side-home">{side === 'home' && renderEventContent(kickEvent)}</div>
          <span className="match-event-minute">{kick.order}. strzał</span>
          <div className="match-event-side match-event-side-away">{side === 'away' && renderEventContent(kickEvent)}</div>
        </li>
      })}</ol>
    </section> : null}
  </section>
}

function MatchdayFinanceCard({ entries }: { entries: FinanceEntry[] }) {
  const expenses = entries.filter((entry) => entry.amount < 0)
  const income = entries.filter((entry) => entry.amount > 0)
  const total = (items: FinanceEntry[]) => items.reduce((sum, entry) => sum + Math.abs(entry.amount), 0)
  const incomeTotal = total(income)
  const expensesTotal = total(expenses)
  const balance = incomeTotal - expensesTotal
  const totalFlow = incomeTotal + expensesTotal
  const incomeShare = totalFlow ? incomeTotal / totalFlow * 100 : 0
  const expensesShare = totalFlow ? expensesTotal / totalFlow * 100 : 0
  const formatEntryCount = (count: number) => {
    const lastTwoDigits = count % 100
    const lastDigit = count % 10
    const noun = count === 1
      ? 'pozycja'
      : lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)
        ? 'pozycje'
        : 'pozycji'
    return `${count} ${noun}`
  }
  const renderEntries = (items: FinanceEntry[], kind: 'income' | 'expense') => items.length
    ? items.map((entry) => <div className="match-finance-row" key={entry.id}>
      <span>{entry.label}</span><strong className={kind === 'income' ? 'amount-positive' : 'amount-negative'}><i>{kind === 'income' ? '+' : '−'}</i>{formatMoney(Math.abs(entry.amount))}</strong>
    </div>)
    : <p className="match-finance-empty">Brak pozycji w tej kategorii</p>
  return <section className="panel-card matchday-finance-card" aria-label="Finanse dnia meczowego">
    <div className="matchday-finance-heading">
      <div><p className="eyebrow">ROZLICZENIE MECZU DOMOWEGO</p><h2>Finanse dnia meczowego</h2><p>Wpływy i koszty związane z rozegranym spotkaniem.</p></div>
      <span className="finance-icon"><Landmark size={17} /></span>
    </div>
    <div className="match-finance-summary">
      <div className={`match-finance-balance ${balance < 0 ? 'match-finance-balance-negative' : ''}`}>
        <span><Wallet size={14} /> BILANS MECZU</span>
        <strong className={balance >= 0 ? 'amount-positive' : 'amount-negative'}>{formatMoney(balance)}</strong>
        <small>{balance >= 0 ? 'Wpływy pokryły koszty spotkania' : 'Koszty przewyższyły wpływy'}</small>
      </div>
      <div className="match-finance-totals">
        <div className="match-finance-total match-finance-total-income">
          <span><ArrowDownLeft size={14} /> Wpływy</span>
          <strong className="amount-positive">{formatMoney(incomeTotal)}</strong>
        </div>
        <div className="match-finance-total match-finance-total-expense">
          <span><ArrowUpRight size={14} /> Wydatki</span>
          <strong className="amount-negative">{formatMoney(expensesTotal)}</strong>
        </div>
      </div>
    </div>
    <div className="match-finance-flow" role="img" aria-label={`Udział wpływów: ${Math.round(incomeShare)}%, udział wydatków: ${Math.round(expensesShare)}%`}>
      <span style={{ width: `${incomeShare}%` }} />
      <span style={{ width: `${expensesShare}%` }} />
    </div>
    <div className="match-finance-columns">
      <section className="match-finance-breakdown match-finance-breakdown-income" aria-label="Pozycje wpływów">
        <header><div><h3>Wpływy</h3><small>{formatEntryCount(income.length)}</small></div><strong>{formatMoney(incomeTotal)}</strong></header>
        <div>{renderEntries(income, 'income')}</div>
      </section>
      <section className="match-finance-breakdown match-finance-breakdown-expense" aria-label="Pozycje wydatków">
        <header><div><h3>Wydatki</h3><small>{formatEntryCount(expenses.length)}</small></div><strong>{formatMoney(expensesTotal)}</strong></header>
        <div>{renderEntries(expenses, 'expense')}</div>
      </section>
    </div>
  </section>
}

function MatchStatisticsPage({ id, playback, onBack }: { id?: string; playback: LiveMatchPlayback; onBack: () => void }) {
  const [activeStatisticsCard, setActiveStatisticsCard] = useState(0)
  const playerRatings = playback.finalGame.lastMatchReport?.playerRatings ?? []
  const hasPlayerRatings = playerRatings.length > 0
  const hasHomeMatchFinance = playback.homeId === playback.startingGame.teamId
  const financeCardIndex = hasHomeMatchFinance ? 1 : -1
  const ratingsCardIndex = hasPlayerRatings ? (hasHomeMatchFinance ? 2 : 1) : -1
  const overallCardIndex = 1 + Number(hasHomeMatchFinance) + Number(hasPlayerRatings)
  const eventsCardIndex = overallCardIndex + 1
  const cardCount = eventsCardIndex + 1
  const statisticsCardTitle = activeStatisticsCard === 0
    ? 'Statystyki obu drużyn'
    : activeStatisticsCard === financeCardIndex
      ? 'Finanse dnia meczowego'
    : activeStatisticsCard === eventsCardIndex
      ? 'Przebieg meczu'
      : activeStatisticsCard === overallCardIndex
        ? 'Overalle zawodników'
        : activeStatisticsCard === ratingsCardIndex
          ? 'Oceny po meczu'
          : 'Statystyki meczu'
  const rows: Array<{ label: string; key: keyof MatchTeamStatistics; suffix?: string }> = [
    { label: 'Posiadanie piłki', key: 'possession', suffix: '%' },
    { label: 'Strzały', key: 'shots' },
    { label: 'Strzały celne', key: 'shotsOnTarget' },
    { label: 'Podania', key: 'passes' },
    { label: 'Celność podań', key: 'passAccuracy', suffix: '%' },
    { label: 'Rzuty rożne', key: 'corners' },
    { label: 'Faule', key: 'fouls' },
    { label: 'Spalone', key: 'offsides' },
    { label: 'Obrony bramkarza', key: 'saves' },
  ]
  return <section id={id} className="match-statistics-page">
    <div className="match-statistics-result panel-card">
      <div><p className="eyebrow">STATYSTYKI MECZU · {playback.competitionLabel} · {playback.round}</p><h2>Koniec meczu</h2></div>
      <div className="match-statistics-score"><span>{playback.homeName}</span><strong>{playback.finalHomeGoals} : {playback.finalAwayGoals}</strong><span>{playback.awayName}</span>
        {playback.penaltyScore && <small>Rzuty karne: {playback.penaltyScore}</small>}
      </div>
    </div>
    <section className="match-statistics-carousel" aria-label="Karty statystyk meczu">
      <div className="match-statistics-carousel-heading">
        <div><p className="eyebrow">PODSUMOWANIE SPOTKANIA</p><h2>{statisticsCardTitle}</h2></div>
        <div className="match-statistics-carousel-controls">
          <button type="button" className="match-statistics-carousel-arrow" aria-label="Poprzednia karta statystyk" onClick={() => setActiveStatisticsCard((card) => Math.max(0, card - 1))} disabled={activeStatisticsCard === 0}><ChevronLeft size={16} /></button>
          <span>{activeStatisticsCard + 1} / {cardCount}</span>
          <button type="button" className="match-statistics-carousel-arrow" aria-label="Następna karta statystyk" onClick={() => setActiveStatisticsCard((card) => Math.min(cardCount - 1, card + 1))} disabled={activeStatisticsCard >= cardCount - 1}><ChevronRight size={16} /></button>
        </div>
      </div>
      <div className="match-statistics-carousel-viewport">
        <div className="match-statistics-carousel-track" style={{ transform: `translateX(-${activeStatisticsCard * 100}%)` }}>
          <section className="panel-card match-statistics-panel match-statistics-carousel-card" aria-label="Statystyki obu drużyn">
            <div className="match-statistics-table">
              <div className="match-statistics-header"><strong>{playback.homeName}</strong><span>STATYSTYKA</span><strong>{playback.awayName}</strong></div>
              {rows.map(({ label, key, suffix }) => {
                const homeValue = playback.statistics.home[key]
                const awayValue = playback.statistics.away[key]
                const total = Number(homeValue) + Number(awayValue)
                const homeShare = total ? Number(homeValue) / total * 100 : 50
                return <div className="match-statistics-row" key={key}>
                  <strong>{homeValue}{suffix}</strong><span>{label}</span><strong>{awayValue}{suffix}</strong>
                  <div className="match-statistics-bars" aria-hidden="true"><i style={{ width: `${homeShare}%` }} /><i style={{ width: `${100 - homeShare}%` }} /></div>
                </div>
              })}
            </div>
            <p className="match-statistics-note">Statystyki są szacowane na potrzeby symulacji meczu.</p>
          </section>
          {hasHomeMatchFinance && <div className="match-statistics-carousel-card"><MatchdayFinanceCard entries={playback.matchFinanceEntries} /></div>}
          {hasPlayerRatings && <div className="match-statistics-carousel-card"><PlayerMatchRatings playerRatings={playerRatings} /></div>}
          <div className="match-statistics-carousel-card"><PlayerOverallsCard playback={playback} /></div>
          <div className="match-statistics-carousel-card"><MatchEventsCard playback={playback} /></div>
        </div>
      </div>
    </section>
    {playback.finalGame.lastMatchReport && <TacticalReport report={playback.finalGame.lastMatchReport} />}
    <button className="primary-button match-statistics-back" onClick={onBack}>Wróć do klubu <ArrowRight size={14} /></button>
  </section>
}

const liveMatchLineupGroups: Array<{ id: string; label: string; positions: Position[] }> = [
  { id: 'goalkeeper', label: 'Bramkarz', positions: ['BR'] },
  { id: 'defense', label: 'Obrońcy', positions: ['PO', 'ŚO', 'LO'] },
  { id: 'midfield', label: 'Pomocnicy', positions: ['DP', 'ŚP', 'OP', 'PP', 'LP'] },
  { id: 'attack', label: 'Napastnicy', positions: ['PN', 'LN', 'ŚN'] },
]

function MatchLineupPanel({ teamName, lineup, incidents, side }: {
  teamName: string
  lineup: LiveLineupPlayer[]
  incidents: LiveMatchIncident[]
  side: 'home' | 'away'
}) {
  const scorers = [...incidents.reduce((goalsByScorer, incident) => {
    if (incident.kind === 'goal' && incident.scorerName && incident.teamName === teamName) {
      goalsByScorer.set(incident.scorerName, (goalsByScorer.get(incident.scorerName) ?? 0) + 1)
    }
    return goalsByScorer
  }, new Map<string, number>()).entries()]
  const cardsByPlayerId = new Map<string, LiveMatchIncident>()
  const injuriesByPlayerId = new Map<string, LiveMatchIncident>()
  incidents.forEach((incident) => {
    if (incident.teamName !== teamName || !incident.playerId) return
    if (incident.kind === 'card') cardsByPlayerId.set(incident.playerId, incident)
    if (incident.kind === 'injury') injuriesByPlayerId.set(incident.playerId, incident)
  })
  const lineupGroups = liveMatchLineupGroups
    .map((group) => ({ ...group, players: lineup.filter((player) => group.positions.includes(player.position)) }))
    .filter((group) => group.players.length > 0)

  return <aside className={`live-match-lineup live-match-lineup-${side}`} aria-label={`Skład ${teamName}`}>
    <h3>{teamName}</h3>
    <p className="live-match-lineup-label">SKŁAD · FORMA</p>
    {lineupGroups.map((group) => <section className={`live-match-lineup-group live-match-lineup-group-${group.id}`} key={group.label}>
      <ol>
      {group.players.map((player) => {
        const goals = scorers.find(([name]) => name === player.name)?.[1] ?? 0
        const card = cardsByPlayerId.get(player.id)
        const injury = injuriesByPlayerId.get(player.id)
        const cardLabel = card?.secondYellow
          ? 'Druga żółta kartka i czerwona'
          : card?.card === 'red'
            ? 'Czerwona kartka'
            : card?.card === 'yellow'
              ? 'Żółta kartka'
              : undefined
        return <li className={goals ? 'live-match-lineup-scorer' : ''} key={player.id}>
          <span className="live-match-lineup-position">#{player.shirtNumber} · {player.position}</span>
          <span className="live-match-lineup-player">
            <strong>{player.name}{card && <i
              className={`live-match-lineup-card live-match-lineup-card-${card.secondYellow ? 'second-yellow-red' : card.card}`}
              title={cardLabel}
              aria-label={cardLabel}
            />}{injury && <span title={`Kontuzja: ${injury.injuryDescription ?? 'uraz'}`}>
              <Ambulance
                className="live-match-lineup-injury"
                size={11}
                aria-label={`Kontuzja: ${injury.injuryDescription ?? 'uraz'}`}
              />
            </span>}</strong>
            <small>{goals ? `⚽ ${goals}` : 'FORMA'}</small>
          </span>
          <b>{player.rating}</b>
        </li>
      })}
      </ol>
    </section>)}
    {scorers.some(([name]) => !lineup.some((player) => player.name === name)) && <div className="live-match-lineup-extra-scorers">
      {scorers.filter(([name]) => !lineup.some((player) => player.name === name)).map(([name, goals]) =>
        <span key={name}>⚽ {name}{goals > 1 ? ` ×${goals}` : ''}</span>,
      )}
    </div>}
    {[...injuriesByPlayerId.entries()]
      .filter(([playerId]) => !lineup.some((player) => player.id === playerId))
      .map(([playerId, injury]) => <div className="live-match-lineup-injury-note" key={playerId}>
        <Ambulance size={12} /><span>{injury.scorerName} · kontuzja</span>
      </div>)}
  </aside>
}

function getMovingPitchPosition(
  position: { x: number; y: number },
  index: number,
  side: 'home' | 'away',
  possession: 'home' | 'away',
  frame: number,
): { x: number; y: number } {
  const attacking = side === possession
  const progress = (frame % 9) / 8
  const movementByLine = index === 0 ? 0.5 : index <= 4 ? 2.5 : index <= 7 ? 5 : 8
  const attackDirection = side === 'home' ? -1 : 1
  const forwardMovement = attacking ? movementByLine * (0.25 + progress * 0.75) : -movementByLine * 0.2
  return {
    x: Math.max(7, Math.min(93, position.x + Math.sin((frame + index * 1.7) * 0.56) * (attacking ? 3.1 : 2.2))),
    y: Math.max(7, Math.min(93, position.y + attackDirection * forwardMovement + Math.cos((frame + index) * 0.42) * 1.4)),
  }
}

function LiveMatchOverlay({ playback, onSkip, onResume, onIntermissionUpdate, onShowStatistics }: {
  playback: LiveMatchPlayback
  onSkip: () => void
  onResume: () => void
  onIntermissionUpdate: (game: GameState) => void
  onShowStatistics: () => void
}) {
  const [showHalftimeChanges, setShowHalftimeChanges] = useState(false)
  const [currentFrame, setCurrentFrame] = useState(0)
  const intermissionChangesRef = useRef<HTMLDivElement | null>(null)
  const getVisibleLineup = (lineup: LiveLineupPlayer[], teamId: string) => {
    const teamName = teamId === playback.homeId ? playback.homeName : playback.awayName
    const unavailablePlayerIds = new Set(playback.incidents
      .filter((incident) => incident.teamName === teamName
        && Boolean(incident.playerId)
        && incident.minute <= playback.minute
        && (incident.kind === 'injury' || (incident.kind === 'card' && (incident.card === 'red' || incident.secondYellow))))
      .flatMap((incident) => incident.playerId ? [incident.playerId] : []))
    return playback.substitutions
      .filter((substitution) => substitution.teamId === teamId && substitution.minute <= playback.minute)
      .sort((first, second) => first.minute - second.minute)
      .reduce((currentLineup, substitution) => {
        const outgoingIndex = currentLineup.findIndex((player) => player.id === substitution.outgoingPlayerId)
        const incoming = playback.finalGame.squad.find((player) => player.id === substitution.incomingPlayerId)
        if (outgoingIndex < 0 || !incoming) return currentLineup
        const performance = playback.finalGame.lastMatchReport?.playerRatings?.find((item) => item.playerId === incoming.id)
        const replacement = {
          id: incoming.id,
          name: `${incoming.firstName} ${incoming.lastName}`,
          position: currentLineup[outgoingIndex].position,
          rating: performance?.rating
            ? performance.rating
            : Math.max(1, Math.min(99, incoming.skill + Math.round((incoming.morale - 70) / 15))),
          shirtNumber: currentLineup[outgoingIndex].shirtNumber,
        }
        return currentLineup.map((player, index) => index === outgoingIndex ? replacement : player)
      }, lineup)
      .filter((player) => !unavailablePlayerIds.has(player.id))
  }
  const homeLineup = getVisibleLineup(playback.homeLineup, playback.homeId)
  const awayLineup = getVisibleLineup(playback.awayLineup, playback.awayId)
  const homeFormation = [{ x: 50, y: 92 }, { x: 20, y: 72 }, { x: 40, y: 74 }, { x: 60, y: 74 }, { x: 80, y: 72 }, { x: 27, y: 52 }, { x: 50, y: 54 }, { x: 73, y: 52 }, { x: 25, y: 30 }, { x: 50, y: 27 }, { x: 75, y: 30 }]
  const awayFormation = homeFormation.map((player) => ({ ...player, y: 100 - player.y }))
  const latestIncident = playback.feed[playback.feed.length - 1]
  const visibleIncidents = playback.incidents.filter((incident) => incident.minute <= playback.minute)
  const latestGoal = [...visibleIncidents].reverse().find((incident) => incident.kind === 'goal' && incident.scorerName)
  const latestGoalKey = latestGoal ? `${latestGoal.minute}:${latestGoal.teamName}:${latestGoal.scorerName}` : null
  const [dismissedGoalKey, setDismissedGoalKey] = useState<string | null>(null)
  const goalBannerVisible = latestGoalKey !== null && latestGoalKey !== dismissedGoalKey
  const latestIncidentKind = latestIncident?.kind
  const possession: 'home' | 'away' = latestIncident?.teamName === playback.homeName
    ? 'home'
    : latestIncident?.teamName === playback.awayName
      ? 'away'
      : Math.floor(currentFrame / 9) % 2 === 0 ? 'home' : 'away'
  const attackingLineup = possession === 'home' ? homeLineup : awayLineup
  const attackingFormation = possession === 'home' ? homeFormation : awayFormation
  const attackCandidates = attackingLineup
    .map((player, index) => ({ player, index }))
    .filter(({ player }) => ['DP', 'ŚP', 'OP', 'PP', 'LP', 'PN', 'LN', 'ŚN'].includes(player.position))
  const passTargetIndex = latestIncident?.playerId
    ? attackingLineup.findIndex((player) => player.id === latestIncident.playerId)
    : attackCandidates.length
      ? attackCandidates[Math.floor(currentFrame / 2) % attackCandidates.length].index
      : 0
  const actionPlayerIndex = latestIncident?.kind === 'shot' && latestIncident.playerId
    ? attackingLineup.findIndex((player) => player.id === latestIncident.playerId)
    : passTargetIndex
  const actionIndex = Math.max(0, actionPlayerIndex)
  const actionBasePosition = attackingFormation[actionIndex] ?? { x: 50, y: possession === 'home' ? 50 : 50 }
  const movingBallPosition = getMovingPitchPosition(actionBasePosition, actionIndex, possession, possession, currentFrame)
  const intermissionGame = playback.intermissionGame
    ?? (playback.halftimePaused
      ? createMatchIntermissionGame(playback.startingGame, playback.round, playback.matchId)
      : null)
  const isCupPlayback = playback.competitionLabel === 'POLSKI PUCHAR'
    || playback.competitionLabel.startsWith('PUCHAR REGIONALNY')
  const matchForSquadPanel = {
    round: playback.round,
    competitionId: isCupPlayback
      ? 'polish-cup' as const
      : playback.competitionLabel === 'PUCHAR MISTRZÓW'
        ? 'champions-cup' as const
        : playback.competitionLabel === 'SPARING PRZEDSEZONOWY' ? 'friendly' as const : 'league' as const,
  }
  const scoreLabel = playback.penaltyScore && playback.finished
    ? `${playback.finalHomeGoals} : ${playback.finalAwayGoals} · k. ${playback.penaltyScore}`
    : playback.finished
      ? `${playback.finalHomeGoals} : ${playback.finalAwayGoals}`
      : `${playback.homeGoals} : ${playback.awayGoals}`

  useEffect(() => {
    if (!showHalftimeChanges || !playback.halftimePaused) return
    intermissionChangesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [showHalftimeChanges, playback.halftimePaused])

  useEffect(() => {
    if (!latestGoalKey) return
    const timeout = window.setTimeout(() => setDismissedGoalKey(latestGoalKey), 2600)
    return () => window.clearTimeout(timeout)
  }, [latestGoalKey])

  useEffect(() => {
    if (playback.finished || playback.halftimePaused) return
    const interval = window.setInterval(() => setCurrentFrame((frame) => frame + 1), 400)
    return () => window.clearInterval(interval)
  }, [playback.finished, playback.halftimePaused])

  return <div className="live-match-backdrop">
    <section className={`live-match-modal${showHalftimeChanges && playback.halftimePaused ? ' live-match-modal-intermission' : ''}`} role="dialog" aria-modal="true" aria-labelledby="live-match-title">
      <div className="live-match-header">
        <div className="live-match-brand">
          <img className="live-match-logo" src="/images/pmp27-crest.png" alt="PMP27" />
          <span className="live-match-status"><i className={playback.finished || playback.halftimePaused ? '' : 'live-match-pulse'} />{playback.finished ? 'KONIEC MECZU' : playback.halftimePaused ? 'PRZERWA · CZAS NA ZMIANY' : 'RELACJA NA ŻYWO'}</span>
        </div>
        <span className="live-match-round">{playback.competitionLabel}{playback.competitionLabel === 'SPARING PRZEDSEZONOWY' || playback.competitionLabel === 'PUCHAR MISTRZÓW' ? ' · MECZ' : ` · ${isCupPlayback ? 'RUNDA' : 'KOLEJKA'} ${playback.round}`}</span>
      </div>
      <div className="live-match-scoreboard">
        <span className="live-match-team">{playback.homeName}</span>
        <strong id="live-match-title">{scoreLabel}</strong>
        <span className="live-match-team">{playback.awayName}</span>
        <span className={`live-match-clock ${playback.halftimePaused ? 'live-match-halftime' : ''}`}>{playback.halftimePaused ? 'PRZERWA' : `${playback.minute}'`}</span>
      </div>
      <div className="live-match-field-layout">
        <MatchLineupPanel
          teamName={playback.homeName}
          lineup={homeLineup}
          incidents={visibleIncidents}
          side="home"
        />
        <div className={`live-match-pitch ${playback.halftimePaused ? 'live-match-pitch-paused' : ''}`} role="group" aria-label={`Boisko piłkarskie, wynik ${scoreLabel}, minuta ${playback.minute}`}>
          <span className="live-pitch-line live-pitch-center-line" />
          <span className="live-pitch-circle" />
          <span className="live-pitch-box live-pitch-box-home" />
          <span className="live-pitch-box live-pitch-box-away" />
          <span
            key={latestIncidentKind === 'shot' ? `${latestIncident?.minute}:${latestIncident.teamName}:${latestIncident.playerId}` : 'ball'}
            className={`live-pitch-ball ${goalBannerVisible ? 'live-pitch-ball-goal' : ''} ${latestIncidentKind === 'shot' ? `live-pitch-ball-shot-${possession}` : ''}`}
            style={{ left: `${movingBallPosition.x}%`, top: `${movingBallPosition.y}%` }}
            aria-label={`Piłka przy drużynie ${possession === 'home' ? playback.homeName : playback.awayName}`}
          />
          {homeFormation.map((position, index) => {
            const player = homeLineup[index]
            const movingPosition = getMovingPitchPosition(position, index, 'home', possession, currentFrame)
            return <span
              key={`home-${player?.id ?? index}`}
              className={`live-pitch-player live-pitch-player-home ${possession === 'home' && index === actionIndex ? 'live-pitch-player-in-possession' : ''}`}
              style={{ left: `${movingPosition.x}%`, top: `${movingPosition.y}%` }}
              title={player ? `${player.name} · nr ${player.shirtNumber}` : playback.homeName}
              aria-label={player ? `${player.name}, numer ${player.shirtNumber}` : playback.homeName}
            >{player?.shirtNumber ?? '–'}</span>
          })}
          {awayFormation.map((position, index) => {
            const player = awayLineup[index]
            const movingPosition = getMovingPitchPosition(position, index, 'away', possession, currentFrame)
            return <span
              key={`away-${player?.id ?? index}`}
              className={`live-pitch-player live-pitch-player-away ${possession === 'away' && index === actionIndex ? 'live-pitch-player-in-possession' : ''}`}
              style={{ left: `${movingPosition.x}%`, top: `${movingPosition.y}%` }}
              title={player ? `${player.name} · nr ${player.shirtNumber}` : playback.awayName}
              aria-label={player ? `${player.name}, numer ${player.shirtNumber}` : playback.awayName}
            >{player?.shirtNumber ?? '–'}</span>
          })}
          <span className="live-pitch-team-name live-pitch-team-home" title={playback.homeName}><i aria-hidden="true" />{playback.homeName}</span>
          <span className="live-pitch-team-name live-pitch-team-away" title={playback.awayName}><i aria-hidden="true" />{playback.awayName}</span>
          {!playback.finished && !playback.halftimePaused && goalBannerVisible && latestGoal?.teamName && latestGoal.scorerName && <div className="live-match-goal-banner" role="status" aria-live="assertive">
            <strong>GOL DLA {latestGoal.teamName.toLocaleUpperCase('pl-PL')}!</strong>
            <span>{latestGoal.scorerName} · {latestGoal.minute}&apos;</span>
          </div>}
          {!playback.finished && !playback.halftimePaused && latestIncident?.kind === 'shot' && <div className={`live-match-shot-callout ${latestIncident.onTarget ? '' : 'live-match-shot-callout-wide'}`} role="status">
            {latestIncident.onTarget ? 'STRZAŁ · OBRONA BRAMKARZA' : 'STRZAŁ NIECELNY'}
          </div>}
          {playback.halftimePaused && <div className="live-match-halftime-actions">
            <p>Pierwsza połowa zakończona · {playback.homeGoals} : {playback.awayGoals}</p>
            <div>
              <button className="secondary-button" onClick={() => setShowHalftimeChanges((shown) => !shown)}>{showHalftimeChanges ? 'Ukryj zmiany' : 'Zmiany'}</button>
              <button className="primary-button" onClick={onResume}>Wznów <ArrowRight size={14} /></button>
            </div>
          </div>}
          {playback.finished && <div className="live-match-fulltime-actions" role="status">
            <strong>Koniec meczu</strong>
            <button className="primary-button" onClick={onShowStatistics}>Przejdź do statystyk <ArrowRight size={14} /></button>
          </div>}
        </div>
        <MatchLineupPanel
          teamName={playback.awayName}
          lineup={awayLineup}
          incidents={visibleIncidents}
          side="away"
        />
      </div>
      <div className={`live-match-commentary ${latestIncident?.scorerName && goalBannerVisible ? 'live-match-goal' : ''}`} aria-live="polite">
        <span className="live-commentary-minute">{playback.minute ? `${playback.minute}'` : 'NA ŻYWO'}</span>
        <p>{playback.commentary}</p>
      </div>
      <div className="live-match-feed" aria-label="Przebieg meczu">
        {playback.feed.slice(-4).map((incident, index) => <div className="live-match-feed-row" key={`${incident.minute}-${index}`}>
          <span>{incident.minute}'</span><p>{incident.message}</p><strong>{incident.homeGoals} : {incident.awayGoals}</strong>
        </div>)}
      </div>
      {showHalftimeChanges && playback.halftimePaused && intermissionGame && <div className="live-match-intermission" ref={intermissionChangesRef}>
        <p className="live-match-intermission-copy">Wprowadź zmiany w składzie lub formacji, a następnie kliknij „Wznów”. Zmiany zostaną uwzględnione w dalszej symulacji, a wynik spotkania pozostanie zgodny z relacją i statystykami.</p>
        <MatchSquadPanel game={intermissionGame} match={matchForSquadPanel} onUpdate={onIntermissionUpdate} inMatch />
        <TacticsPanel game={intermissionGame} onUpdate={onIntermissionUpdate} inMatch />
      </div>}
      {playback.resumeError && <p className="live-match-resume-error" role="alert">{playback.resumeError}</p>}
      {!playback.finished && <div className="live-match-footer">
        <span>{playback.halftimePaused ? `Przerwa · zmiany: ${playback.intermissionGame?.pendingMatchEvent?.substitutionsUsed ?? 0}/3` : `Każda połowa trwa 30 sekund · ${playback.minute < 45 ? 'do przerwy' : 'druga połowa'}`}</span>
        {!playback.halftimePaused && <button className="live-match-skip" onClick={onSkip}>Pomiń do przerwy <ArrowRight size={14} /></button>}
      </div>}
    </section>
  </div>
}

function MatchSquadPanel({ game, match, onUpdate, inMatch = false }: {
  game: GameState
  match: Pick<Match, 'round' | 'competitionId'>
  onUpdate: (game: GameState, message?: string) => void
  inMatch?: boolean
}) {
  const [selectedRolePlayerId, setSelectedRolePlayerId] = useState<string | null>(null)
  const [draggedPlayerId, setDraggedPlayerId] = useState<string | null>(null)
  const [dragOverSlotIndex, setDragOverSlotIndex] = useState<number | null>(null)
  const [rosterDropTarget, setRosterDropTarget] = useState<'bench' | 'outside' | null>(null)
  const [rosterInsertion, setRosterInsertion] = useState<{ playerId: string; after: boolean } | null>(null)
  const [touchDragging, setTouchDragging] = useState(false)
  const [dragPreviewPosition, setDragPreviewPosition] = useState<{ x: number; y: number } | null>(null)
  const touchDragActivatedRef = useRef(false)
  const touchHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchListenersCleanupRef = useRef<(() => void) | null>(null)
  const touchHoldStartRef = useRef<{ x: number; y: number } | null>(null)
  const touchDragPointRef = useRef<{ x: number; y: number } | null>(null)
  const touchAutoScrollFrameRef = useRef<number | null>(null)
  const mouseDragRef = useRef<{ playerId: string; pointerId: number; x: number; y: number; active: boolean } | null>(null)
  const rosterRowsRef = useRef(new Map<string, HTMLDivElement>())
  const previousRosterRectsRef = useRef(new Map<string, DOMRect>())
  const dragStartRectsRef = useRef(new Map<string, DOMRect>())
  const pendingRosterAnimationRectsRef = useRef(new Map<string, DOMRect>())
  function updateTouchAutoScroll(x: number, y: number) {
    touchDragPointRef.current = { x, y }
    if (touchAutoScrollFrameRef.current !== null) return
    const scrollAtEdge = () => {
      const point = touchDragPointRef.current
      if (!point) {
        touchAutoScrollFrameRef.current = null
        return
      }
      const edgeSize = 72
      const distanceFromEdge = point.y < edgeSize
        ? point.y - edgeSize
        : point.y > window.innerHeight - edgeSize
          ? point.y - (window.innerHeight - edgeSize)
          : 0
      if (distanceFromEdge === 0) {
        touchAutoScrollFrameRef.current = null
        return
      }
      const scrollAmount = Math.sign(distanceFromEdge) * Math.min(18, Math.max(4, Math.ceil(Math.abs(distanceFromEdge) / 3)))
      const previousScrollY = window.scrollY
      window.scrollBy(0, scrollAmount)
      if (window.scrollY === previousScrollY) {
        touchAutoScrollFrameRef.current = null
        return
      }
      touchAutoScrollFrameRef.current = window.requestAnimationFrame(scrollAtEdge)
    }
    touchAutoScrollFrameRef.current = window.requestAnimationFrame(scrollAtEdge)
  }
  function stopTouchAutoScroll() {
    touchDragPointRef.current = null
    if (touchAutoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(touchAutoScrollFrameRef.current)
      touchAutoScrollFrameRef.current = null
    }
  }
  function updateDragPreviewPosition(x: number, y: number) {
    setDragPreviewPosition({
      x: Math.max(8, Math.min(x + 16, window.innerWidth - 210)),
      y: Math.max(8, Math.min(y + 16, window.innerHeight - 76)),
    })
  }
  const competition = match.competitionId ?? 'league'
  const eligiblePlayers = game.squad.filter((player) => getSuspensionMatches(player, competition) === 0 && (player.injury?.matchesRemaining ?? 0) <= 0)
  const effectiveSpecialRoles = getEffectivePlayerSpecialRoles(game, game.matchLineupIds, competition)
  const selectedSpecialRoles = game.playerSpecialRoles
  const selectedRolePlayer = game.squad.find((player) => player.id === selectedRolePlayerId)
  const specialRoleOptions: Array<{ id: PlayerSpecialRole; label: string }> = [
    { id: 'captain', label: 'Kapitan' },
    { id: 'viceCaptain', label: 'Wicekapitan' },
    { id: 'penaltyTaker', label: 'Wykonawca rzutów karnych' },
    { id: 'freeKickTaker', label: 'Wykonawca rzutów wolnych' },
    { id: 'cornerTaker', label: 'Wykonawca rzutów rożnych' },
  ]
  const slotAssignments: Record<string, string> = game.matchLineupPositions?.formation === game.tactics.formation
    ? game.matchLineupPositions.slots
    : {}
  const formationRows = formationSlotRows[game.tactics.formation]
  const assignedToManualSlots = new Set(
    Object.entries(slotAssignments)
      .filter(([slotIndex, playerId]) =>
        Number.isInteger(Number(slotIndex))
        && Number(slotIndex) >= 0
        && Number(slotIndex) < formationRows.flat().length
        && game.matchLineupIds.includes(playerId)
        && eligiblePlayers.some((player) => player.id === playerId),
      )
      .map(([, playerId]) => playerId),
  )
  const assignedIds = new Set<string>()
  let nextSlotIndex = 0
  const positionedLineup = formationRows.map((slots) =>
    slots.map((slot) => {
      const slotIndex = nextSlotIndex++
      const manuallyAssignedPlayer = eligiblePlayers.find((candidate) =>
        slotAssignments[slotIndex] === candidate.id
        && game.matchLineupIds.includes(candidate.id)
        && !assignedIds.has(candidate.id),
      )
      const player = manuallyAssignedPlayer ?? eligiblePlayers.find((candidate) =>
        game.matchLineupIds.includes(candidate.id)
        && canPlayPosition(candidate, slot)
        && !assignedIds.has(candidate.id)
        && !assignedToManualSlots.has(candidate.id),
      ) ?? eligiblePlayers
        .filter((candidate) => game.matchLineupIds.includes(candidate.id) && !assignedIds.has(candidate.id) && !assignedToManualSlots.has(candidate.id))
        .sort((first, second) => second.skill - first.skill)[0]
      if (player) assignedIds.add(player.id)
      return { slot, player, slotIndex }
    }),
  )
  const isUnavailableForMatch = useCallback((player: Player) =>
    getSuspensionMatches(player, competition) > 0 || (player.injury?.matchesRemaining ?? 0) > 0,
  [competition])
  const nonStartingPlayers = game.squad.filter((player) => !game.matchLineupIds.includes(player.id))
  const benchPlayers = nonStartingPlayers.filter((player) =>
    game.matchBenchIds.includes(player.id) && !isUnavailableForMatch(player),
  )
  const outsideOrder = new Map((game.matchOutsideSquadIds ?? []).map((playerId, index) => [playerId, index]))
  const outsideSquadPlayers = nonStartingPlayers
    .filter((player) => !game.matchBenchIds.includes(player.id) || isUnavailableForMatch(player))
    .sort((first, second) =>
      Number(isUnavailableForMatch(first)) - Number(isUnavailableForMatch(second))
      || (outsideOrder.get(first.id) ?? Number.MAX_SAFE_INTEGER) - (outsideOrder.get(second.id) ?? Number.MAX_SAFE_INTEGER)
      || game.squad.indexOf(first) - game.squad.indexOf(second),
    )
  function getPreviewOrder(players: Player[], isOnBench: boolean) {
    if (!rosterInsertion || !draggedPlayerId || game.matchBenchIds.includes(draggedPlayerId) !== isOnBench) return players
    const from = players.findIndex((player) => player.id === draggedPlayerId)
    const target = players.findIndex((player) => player.id === rosterInsertion.playerId)
    if (from < 0 || target < 0 || from === target) return players
    const next = [...players]
    const [dragged] = next.splice(from, 1)
    const targetIndex = next.findIndex((player) => player.id === rosterInsertion.playerId)
    next.splice(targetIndex + Number(rosterInsertion.after), 0, dragged)
    return isOnBench
      ? next
      : [...next.filter((player) => !isUnavailableForMatch(player)), ...next.filter(isUnavailableForMatch)]
  }
  const displayedBenchPlayers = getPreviewOrder(benchPlayers, true)
  const displayedOutsidePlayers = getPreviewOrder(outsideSquadPlayers, false)
  const displayedBenchOrder = displayedBenchPlayers.map((player) => player.id).join(',')
  const displayedOutsideOrder = displayedOutsidePlayers.map((player) => player.id).join(',')
  const draggedPlayer = draggedPlayerId ? game.squad.find((player) => player.id === draggedPlayerId) : undefined
  const draggedPlayerIsStarter = Boolean(draggedPlayer && game.matchLineupIds.includes(draggedPlayer.id))
  const canDropOnPitchPlayer = (player: Player) => {
    if (!draggedPlayer || draggedPlayer.id === player.id) return false
    if (draggedPlayerIsStarter) return !inMatch && game.matchLineupIds.includes(player.id)
    if (!game.matchLineupIds.includes(player.id)) return false
    if (inMatch && (!game.matchBenchIds.includes(draggedPlayer.id)
      || (game.pendingMatchEvent?.substitutionsUsed ?? 0) >= 3
      || game.pendingMatchEvent?.substitutedPlayerIds?.includes(draggedPlayer.id))) return false
    return !isUnavailableForMatch(draggedPlayer)
      && (draggedPlayer.position === 'BR') === (player.position === 'BR')
  }
  const canDropOnRosterPlayer = (player: Player) =>
    Boolean(draggedPlayer && !inMatch && !draggedPlayerIsStarter && draggedPlayer.id !== player.id)

  useEffect(() => {
    if (inMatch) return
    const availableBenchIds = game.matchBenchIds.filter((id) => {
      const player = game.squad.find((candidate) => candidate.id === id)
      return Boolean(player && !game.matchLineupIds.includes(id) && !isUnavailableForMatch(player))
    })
    const unavailableBenchIds = game.matchBenchIds.filter((id) => !availableBenchIds.includes(id))
    const openSlots = Math.max(0, 7 - availableBenchIds.length)
    const hasBenchGoalkeeper = availableBenchIds.some((id) =>
      game.squad.find((player) => player.id === id)?.position === 'BR',
    )
    const playersToPromote = outsideSquadPlayers
      .filter((player) => !isUnavailableForMatch(player))
      .sort((first, second) =>
        Number(!hasBenchGoalkeeper && second.position === 'BR') - Number(!hasBenchGoalkeeper && first.position === 'BR')
        || second.skill - first.skill,
      )
      .slice(0, openSlots)
    if (unavailableBenchIds.length === 0 && playersToPromote.length === 0) return
    const next = structuredClone(game)
    next.matchBenchIds = [...availableBenchIds, ...playersToPromote.map((player) => player.id)]
    next.matchOutsideSquadIds = [...new Set([
      ...(game.matchOutsideSquadIds ?? []).filter((id) =>
        !next.matchLineupIds.includes(id) && !next.matchBenchIds.includes(id),
      ),
      ...unavailableBenchIds.filter((id) =>
        game.squad.some((player) => player.id === id) && !next.matchLineupIds.includes(id),
      ),
    ])]
    onUpdate(next)
  }, [game, inMatch, isUnavailableForMatch, onUpdate, outsideSquadPlayers])

  useLayoutEffect(() => {
    const rosterRows = rosterRowsRef.current
    rosterRows.forEach((row, playerId) => {
      const previous = pendingRosterAnimationRectsRef.current.get(playerId) ?? previousRosterRectsRef.current.get(playerId)
      if (!previous) return
      const current = row.getBoundingClientRect()
      const x = previous.left - current.left
      const y = previous.top - current.top
      if ((x || y) && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        row.animate(
          [{ transform: `translate(${x}px, ${y}px)` }, { transform: 'translate(0, 0)' }],
          { duration: 180, easing: 'ease-out' },
        )
      }
      pendingRosterAnimationRectsRef.current.delete(playerId)
    })
    return () => {
      const rects = new Map<string, DOMRect>()
      rosterRows.forEach((row, playerId) => rects.set(playerId, row.getBoundingClientRect()))
      previousRosterRectsRef.current = rects
    }
  }, [displayedBenchOrder, displayedOutsideOrder])
  function replaceStarter(incoming: Player, outgoing: Player) {
    if (inMatch && (game.pendingMatchEvent?.substitutionsUsed ?? 0) >= 3) {
      return onUpdate(game, 'W tym meczu wykorzystano już wszystkie 3 zmiany.')
    }
    const result = inMatch
      ? makeMatchdaySubstitution(game, outgoing.id, incoming.id, competition)
      : replaceMatchPlayer(game, outgoing.id, incoming.id, competition)
    if (result.error) return onUpdate(game, result.error)
    const nextGame = result.game
    const targetSlotIndex = positionedLineup.flat().find(({ player }) => player?.id === outgoing.id)?.slotIndex
    const slots: Record<string, string> = Object.fromEntries(
      Object.entries(slotAssignments).filter(([, playerId]) => playerId !== incoming.id && playerId !== outgoing.id),
    )
    if (targetSlotIndex !== undefined) slots[targetSlotIndex] = incoming.id
    nextGame.matchLineupPositions = { formation: game.tactics.formation, slots }
    onUpdate(nextGame, `${incoming.firstName} ${incoming.lastName} ${inMatch ? 'wchodzi za' : 'zastępuje'} ${outgoing.firstName} ${outgoing.lastName} w składzie.${inMatch ? ` Wykorzystane zmiany: ${nextGame.pendingMatchEvent?.substitutionsUsed ?? 0}/3.` : ''}`)
  }
  function assignSpecialRole(role: PlayerSpecialRole) {
    if (!selectedRolePlayer || inMatch) return
    const result = setPlayerSpecialRole(game, selectedRolePlayer.id, role)
    if (result.error) return onUpdate(game, result.error)
    onUpdate(result.game, `${selectedRolePlayer.firstName} ${selectedRolePlayer.lastName} otrzymuje rolę: ${specialRoleOptions.find((option) => option.id === role)?.label.toLocaleLowerCase('pl-PL')}.`)
  }
  function applyPitchDrop(incomingId: string | null, slotIndex: number, outgoing?: Player) {
    setDraggedPlayerId(null)
    setDragPreviewPosition(null)
    setDragOverSlotIndex(null)
    if (!incomingId || incomingId === outgoing?.id || (inMatch && !outgoing)) return
    const incoming = game.squad.find((player) => player.id === incomingId)
    if (!incoming) return
    if (game.matchLineupIds.includes(incomingId)) {
      if (inMatch) return
      const sourceSlotIndex = positionedLineup.flat().find(({ player }) => player?.id === incomingId)?.slotIndex
      if (sourceSlotIndex === undefined || sourceSlotIndex === slotIndex) return
      const slots: Record<string, string> = { ...slotAssignments, [slotIndex]: incomingId }
      if (outgoing) slots[String(sourceSlotIndex)] = outgoing.id
      else delete slots[sourceSlotIndex]
      const nextGame = structuredClone(game)
      nextGame.matchLineupPositions = { formation: game.tactics.formation, slots }
      onUpdate(nextGame, 'Ustawienie zawodników na boisku zostało zmienione.')
      return
    }
    if (outgoing) {
      if (inMatch && !game.matchBenchIds.includes(incomingId)) return
      replaceStarter(incoming, outgoing)
      return
    }
    const result = setMatchSquadRole(game, incomingId, 'starting', competition)
    if (result.error) return onUpdate(game, result.error)
    result.game.matchLineupPositions = {
      formation: game.tactics.formation,
      slots: { ...slotAssignments, [slotIndex]: incomingId },
    }
    onUpdate(result.game, `${incoming.firstName} ${incoming.lastName} trafia do pierwszej jedenastki.`)
  }
  function startMousePlayerDrag(event: ReactPointerEvent<HTMLButtonElement>, playerId: string) {
    if (event.pointerType !== 'mouse' || event.button !== 0 || (inMatch && game.matchLineupIds.includes(playerId))) return
    const sourceRect = rosterRowsRef.current.get(playerId)?.getBoundingClientRect()
      ?? event.currentTarget.getBoundingClientRect()
    if (sourceRect) dragStartRectsRef.current.set(playerId, sourceRect)
    mouseDragRef.current = {
      playerId,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      active: false,
    }

    const onMove = (moveEvent: PointerEvent) => {
      const drag = mouseDragRef.current
      if (!drag || drag.pointerId !== moveEvent.pointerId) return
      if (!drag.active) {
        if (Math.hypot(moveEvent.clientX - drag.x, moveEvent.clientY - drag.y) < 6) return
        drag.active = true
        touchDragActivatedRef.current = true
        setDraggedPlayerId(drag.playerId)
        setTouchDragging(true)
      }
      updateDragPreviewPosition(moveEvent.clientX, moveEvent.clientY)
      moveEvent.preventDefault()
      const target = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)
      const pitchPlayer = target?.closest<HTMLElement>('[data-pitch-player-id]')
      const pitchSlot = target?.closest<HTMLElement>('[data-pitch-slot-index]')
      const row = target?.closest<HTMLElement>('[data-roster-player-id]')
      const section = target?.closest<HTMLElement>('[data-roster-drop-target]')
      if (pitchPlayer || pitchSlot) {
        setDragOverSlotIndex(Number((pitchPlayer ?? pitchSlot)?.dataset.pitchSlotIndex))
        setRosterDropTarget(null)
        setRosterInsertion(null)
      } else if (row && !inMatch) {
        const targetId = row.dataset.rosterPlayerId
        const targetIsOnBench = row.dataset.rosterBench === 'true'
        if (targetId && targetId !== drag.playerId && !game.matchLineupIds.includes(drag.playerId)) {
          const bounds = row.getBoundingClientRect()
          setRosterInsertion({ playerId: targetId, after: moveEvent.clientY > bounds.top + bounds.height / 2 })
        } else {
          setRosterInsertion(null)
        }
        setRosterDropTarget(targetIsOnBench ? 'bench' : 'outside')
        setDragOverSlotIndex(null)
      } else if (section && !inMatch) {
        setRosterDropTarget(section.dataset.rosterDropTarget === 'bench' ? 'bench' : 'outside')
        setRosterInsertion(null)
        setDragOverSlotIndex(null)
      } else {
        setRosterDropTarget(null)
        setRosterInsertion(null)
        setDragOverSlotIndex(null)
      }
    }
    const onUp = (upEvent: PointerEvent) => {
      const drag = mouseDragRef.current
      if (!drag || drag.pointerId !== upEvent.pointerId) return
      if (drag.active) {
        const target = document.elementFromPoint(upEvent.clientX, upEvent.clientY)
        const pitchPlayer = target?.closest<HTMLElement>('[data-pitch-player-id]')
        const pitchSlot = target?.closest<HTMLElement>('[data-pitch-slot-index]')
        const row = target?.closest<HTMLElement>('[data-roster-player-id]')
        const section = target?.closest<HTMLElement>('[data-roster-drop-target]')
        if (pitchPlayer || pitchSlot) {
          const slotIndex = Number((pitchPlayer ?? pitchSlot)?.dataset.pitchSlotIndex)
          const outgoingId = pitchPlayer?.dataset.pitchPlayerId
          const outgoing = outgoingId ? game.squad.find((player) => player.id === outgoingId) : undefined
          applyPitchDrop(drag.playerId, slotIndex, outgoing)
        } else if (!inMatch && row?.dataset.rosterPlayerId && row.dataset.rosterPlayerId !== drag.playerId
          && !game.matchLineupIds.includes(drag.playerId)) {
          const bounds = row.getBoundingClientRect()
          reorderRosterPlayer(drag.playerId, row.dataset.rosterPlayerId, row.dataset.rosterBench === 'true', upEvent.clientY > bounds.top + bounds.height / 2)
        } else if (!inMatch && section) {
          movePlayerToRoster(drag.playerId, section.dataset.rosterDropTarget === 'bench' ? 'bench' : 'none')
        }
        setDraggedPlayerId(null)
        setDragPreviewPosition(null)
        setRosterDropTarget(null)
        setRosterInsertion(null)
        setDragOverSlotIndex(null)
        setTouchDragging(false)
        window.setTimeout(() => {
          touchDragActivatedRef.current = false
        }, 500)
      }
      mouseDragRef.current = null
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointercancel', onUp)
    }
    document.addEventListener('pointermove', onMove, { passive: false })
    document.addEventListener('pointerup', onUp)
    document.addEventListener('pointercancel', onUp)
  }
  function movePlayerToRoster(
    playerId: string,
    role: 'bench' | 'none',
    insertion?: { targetPlayerId: string; after: boolean },
  ) {
    if (!playerId || inMatch) return
    const player = game.squad.find((candidate) => candidate.id === playerId)
    if (!player || (role === 'bench' && game.matchBenchIds.includes(playerId))
      || (role === 'none' && !game.matchBenchIds.includes(playerId))) return
    if (role === 'bench' && (getSuspensionMatches(player, competition) > 0 || (player.injury?.matchesRemaining ?? 0) > 0)) {
      return onUpdate(game, getSuspensionMatches(player, competition) > 0
        ? 'Zawodnik pauzuje w tych rozgrywkach.'
        : 'Kontuzjowany zawodnik nie może znaleźć się w składzie meczowym.')
    }
    const result = setMatchSquadRole(game, playerId, 'none', competition)
    if (result.error) return onUpdate(game, result.error)
    const next = result.game
    const outsideIds = outsideSquadPlayers
      .filter((candidate) => candidate.id !== playerId)
      .map((candidate) => candidate.id)
    if (role === 'none') {
      const targetIndex = insertion ? outsideIds.indexOf(insertion.targetPlayerId) : -1
      outsideIds.splice(targetIndex < 0 ? outsideIds.length : targetIndex + Number(Boolean(insertion?.after)), 0, playerId)
      next.matchOutsideSquadIds = outsideIds
    } else {
      const benchIds = next.matchBenchIds.filter((id) => id !== playerId)
      const targetIndex = insertion
        ? benchIds.indexOf(insertion.targetPlayerId)
        : benchIds.length >= 7 ? benchIds.length - 1 : benchIds.length
      benchIds.splice(targetIndex < 0 ? benchIds.length : targetIndex + Number(Boolean(insertion?.after)), 0, playerId)
      if (benchIds.length > 7) {
        const displacedPlayerId = benchIds.pop()
        if (displacedPlayerId) outsideIds.push(displacedPlayerId)
      }
      next.matchBenchIds = benchIds
      next.matchOutsideSquadIds = outsideIds
    }
    const sourceRect = dragStartRectsRef.current.get(playerId) ?? rosterRowsRef.current.get(playerId)?.getBoundingClientRect()
    if (sourceRect) pendingRosterAnimationRectsRef.current.set(playerId, sourceRect)
    onUpdate(next, role === 'bench'
      ? `${player.firstName} ${player.lastName} dołącza do ławki rezerwowych.`
      : `${player.firstName} ${player.lastName} trafia poza skład.`)
  }
  function reorderRosterPlayer(draggedId: string, targetPlayerId: string, targetIsOnBench: boolean, after: boolean) {
    if (!draggedId || draggedId === targetPlayerId) return
    const draggedIsOnBench = game.matchBenchIds.includes(draggedId)
    if (draggedIsOnBench !== targetIsOnBench) {
      movePlayerToRoster(draggedId, targetIsOnBench ? 'bench' : 'none', { targetPlayerId, after })
      setDraggedPlayerId(null)
      setRosterDropTarget(null)
      setRosterInsertion(null)
      return
    }
    const orderedIds = targetIsOnBench ? benchPlayers.map((player) => player.id) : outsideSquadPlayers.map((player) => player.id)
    const sourceIndex = orderedIds.indexOf(draggedId)
    if (sourceIndex < 0 || !orderedIds.includes(targetPlayerId)) return
    const [playerId] = orderedIds.splice(sourceIndex, 1)
    const targetIndex = orderedIds.indexOf(targetPlayerId)
    orderedIds.splice(targetIndex + Number(after), 0, playerId)
    const nextGame = structuredClone(game)
    if (targetIsOnBench) {
      nextGame.matchBenchIds = orderedIds
      nextGame.matchOutsideSquadIds = outsideSquadPlayers.map((player) => player.id)
    }
    else nextGame.matchOutsideSquadIds = orderedIds
    const sourceRect = dragStartRectsRef.current.get(draggedId) ?? rosterRowsRef.current.get(draggedId)?.getBoundingClientRect()
    if (sourceRect) pendingRosterAnimationRectsRef.current.set(draggedId, sourceRect)
    setDraggedPlayerId(null)
    setRosterDropTarget(null)
    setRosterInsertion(null)
    onUpdate(nextGame)
  }
  function finishTouchDrag() {
    touchListenersCleanupRef.current?.()
    touchListenersCleanupRef.current = null
    stopTouchAutoScroll()
    setDraggedPlayerId(null)
    setDragPreviewPosition(null)
    setDragOverSlotIndex(null)
    setRosterDropTarget(null)
    setRosterInsertion(null)
    setTouchDragging(false)
    window.setTimeout(() => {
      touchDragActivatedRef.current = false
    }, 500)
  }
  function handleRosterTouchStart(event: ReactTouchEvent<HTMLElement>, playerId: string) {
    if (event.touches.length !== 1) {
      if (touchHoldTimerRef.current) clearTimeout(touchHoldTimerRef.current)
      touchHoldTimerRef.current = null
      touchHoldStartRef.current = null
      return
    }
    if (touchHoldTimerRef.current) clearTimeout(touchHoldTimerRef.current)
    const touch = event.touches[0]
    touchHoldStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null
    const sourceElement = event.currentTarget
    touchHoldTimerRef.current = setTimeout(() => {
      touchHoldTimerRef.current = null
      const sourceRect = rosterRowsRef.current.get(playerId)?.getBoundingClientRect()
        ?? sourceElement.getBoundingClientRect()
      if (sourceRect) dragStartRectsRef.current.set(playerId, sourceRect)
      setDraggedPlayerId(playerId)
      updateDragPreviewPosition(sourceRect.left + sourceRect.width / 2, sourceRect.top + sourceRect.height / 2)
      setTouchDragging(true)
      touchDragActivatedRef.current = true
      const onMove = (moveEvent: TouchEvent) => {
        moveEvent.preventDefault()
        const touch = moveEvent.touches[0]
        if (!touch) return
        updateDragPreviewPosition(touch.clientX, touch.clientY)
        updateTouchAutoScroll(touch.clientX, touch.clientY)
        const target = document.elementFromPoint(touch.clientX, touch.clientY)
        const pitchPlayer = target?.closest<HTMLElement>('[data-pitch-player-id]')
        const emptyPitchSlot = target?.closest<HTMLElement>('[data-pitch-slot-index]')
        const row = target?.closest<HTMLElement>('[data-roster-player-id]')
        const section = target?.closest<HTMLElement>('[data-roster-drop-target]')
        if (pitchPlayer || emptyPitchSlot) {
          setRosterInsertion(null)
          setRosterDropTarget(null)
          setDragOverSlotIndex(Number((pitchPlayer ?? emptyPitchSlot)?.dataset.pitchSlotIndex))
        } else if (row && !inMatch) {
          const targetId = row.dataset.rosterPlayerId
          const targetBench = row.dataset.rosterBench === 'true'
          if (targetId && targetId !== playerId && !game.matchLineupIds.includes(playerId)) {
            const rect = row.getBoundingClientRect()
            const after = touch.clientY > rect.top + rect.height / 2
            setRosterInsertion({ playerId: targetId, after })
            setRosterDropTarget(targetBench ? 'bench' : 'outside')
          } else {
            setRosterInsertion(null)
            setRosterDropTarget(targetBench ? 'bench' : 'outside')
          }
        } else if (section && !inMatch) {
          setRosterInsertion(null)
          setRosterDropTarget(section.dataset.rosterDropTarget === 'bench' ? 'bench' : 'outside')
        } else {
          setRosterInsertion(null)
          setRosterDropTarget(null)
        }
      }
      const onEnd = (endEvent: TouchEvent) => {
        const touch = endEvent.changedTouches[0]
        const target = touch ? document.elementFromPoint(touch.clientX, touch.clientY) : null
        const pitchPlayer = target?.closest<HTMLElement>('[data-pitch-player-id]')
        const emptyPitchSlot = target?.closest<HTMLElement>('[data-pitch-slot-index]')
        const row = target?.closest<HTMLElement>('[data-roster-player-id]')
        const section = target?.closest<HTMLElement>('[data-roster-drop-target]')
        if (pitchPlayer || emptyPitchSlot) {
          const slotIndex = Number((pitchPlayer ?? emptyPitchSlot)?.dataset.pitchSlotIndex)
          const outgoingId = pitchPlayer?.dataset.pitchPlayerId
          const outgoing = outgoingId ? game.squad.find((player) => player.id === outgoingId) : undefined
          applyPitchDrop(playerId, slotIndex, outgoing)
        } else if (!inMatch && row?.dataset.rosterPlayerId && row.dataset.rosterPlayerId !== playerId
          && !game.matchLineupIds.includes(playerId)) {
          const rect = row.getBoundingClientRect()
          reorderRosterPlayer(playerId, row.dataset.rosterPlayerId, row.dataset.rosterBench === 'true', Boolean(touch && touch.clientY > rect.top + rect.height / 2))
        } else if (!inMatch && section) {
          movePlayerToRoster(playerId, section.dataset.rosterDropTarget === 'bench' ? 'bench' : 'none')
        }
        finishTouchDrag()
      }
      document.addEventListener('touchmove', onMove, { passive: false })
      document.addEventListener('touchend', onEnd, { once: true })
      document.addEventListener('touchcancel', onEnd, { once: true })
      touchListenersCleanupRef.current = () => {
        document.removeEventListener('touchmove', onMove)
        document.removeEventListener('touchend', onEnd)
        document.removeEventListener('touchcancel', onEnd)
      }
    }, 350)
  }
  function handleRosterTouchMove(event: ReactTouchEvent<HTMLElement>) {
    const touch = event.touches[0]
    const start = touchHoldStartRef.current
    if (!touch || !start || !touchHoldTimerRef.current) return
    if (Math.hypot(touch.clientX - start.x, touch.clientY - start.y) < 8) return
    clearTimeout(touchHoldTimerRef.current)
    touchHoldTimerRef.current = null
    touchHoldStartRef.current = null
  }
  function handleRosterTouchEnd() {
    if (touchHoldTimerRef.current) {
      clearTimeout(touchHoldTimerRef.current)
      touchHoldTimerRef.current = null
    }
    touchHoldStartRef.current = null
    if (!touchDragging) stopTouchAutoScroll()
  }
  function renderRosterPlayer(player: Player, isOnBench: boolean) {
    const suspended = getSuspensionMatches(player, competition)
    const alreadySubstituted = Boolean(game.pendingMatchEvent?.substitutedPlayerIds?.includes(player.id))
    const substitutionsFull = (game.pendingMatchEvent?.substitutionsUsed ?? 0) >= 3
    const injured = (player.injury?.matchesRemaining ?? 0) > 0
    const unavailableReason = suspended > 0
      ? `Pauzuje · ${suspended}`
      : injured ? 'Kontuzjowany' : null
    const currentInsertion = rosterInsertion?.playerId === player.id ? rosterInsertion : null
    return <div className={`bench-player-row ${currentInsertion ? `bench-player-row-insertion-${currentInsertion.after ? 'after' : 'before'}` : ''} ${canDropOnRosterPlayer(player) ? 'bench-player-row-drop-available' : ''} ${draggedPlayerId === player.id ? 'bench-player-row-dragged' : ''}`}
      key={player.id}
      ref={(row) => {
        if (row) rosterRowsRef.current.set(player.id, row)
        else rosterRowsRef.current.delete(player.id)
      }}
      data-roster-player-id={player.id}
      data-roster-bench={isOnBench}>
      <button className="bench-player" disabled={Boolean(unavailableReason) || (inMatch && (alreadySubstituted || substitutionsFull))} title={unavailableReason ? `${unavailableReason}. Zawodnik jest niedostępny w tych rozgrywkach.` : undefined} onTouchStart={(event) => handleRosterTouchStart(event, player.id)} onTouchMove={handleRosterTouchMove} onTouchEnd={handleRosterTouchEnd} onTouchCancel={handleRosterTouchEnd} onPointerDown={(event) => startMousePlayerDrag(event, player.id)}>
        <PositionBadge position={player.position} /><BenchPlayerInfo player={player} />{unavailableReason && <span className="bench-add">{unavailableReason}</span>}
      </button>
    </div>
  }
  function restorePrevious() {
    const result = applyPreviousMatchSquad(game, competition)
    if (result.error) return onUpdate(game, result.error)
    delete result.game.matchLineupPositions
    onUpdate(result.game, 'Skład i ławka z poprzedniego meczu zostały przywrócone.')
  }
  return <section className={`match-squad-panel ${touchDragging ? 'roster-touch-dragging' : ''}`} id="match-squad-panel">
    <div className="match-squad-heading">
      <div className="tactics-heading"><span className="training-icon"><Users size={19} /></span><div><p className="eyebrow">{inMatch ? 'ZMIANY W TRAKCIE MECZU' : `KOLEJKA ${match.round} · ${competition === 'league' ? 'ROZGRYWKI LIGOWE' : 'PUCHAR'}`}</p><h2>{inMatch ? 'Rezerwowi do wejścia' : `Ustawienie na mecz · ${game.tactics.formation}`}</h2><p>{inMatch ? `Przeciągnij lub przytrzymaj rezerwowego i upuść na zawodnika na boisku. Wykorzystano zmiany: ${game.pendingMatchEvent?.substitutionsUsed ?? 0}/3.` : 'Przeciągnij zawodnika i upuść na piłkarza na boisku, aby go zastąpić. Na ekranie dotykowym przytrzymaj kartę i przesuń na pozycję.'}</p></div></div>
      {!inMatch && <button className="previous-squad-button" disabled={!game.previousMatchLineupIds.length} onClick={restorePrevious}><ArrowDownLeft size={14} /> Użyj składu z poprzedniego meczu</button>}
    </div>
    <div className="match-squad-counts"><span>Pierwsza jedenastka <strong>{game.matchLineupIds.length} / 11</strong></span><span>Ławka rezerwowych <strong>{benchPlayers.length} / 7</strong></span></div>
    {game.squad.some((player) => (player.injury?.matchesRemaining ?? 0) > 0) && <p className="injury-notice"><TriangleAlert size={14} /> Kontuzjowani zawodnicy są niedostępni przez szacowany czas rekonwalescencji. Zatrudniony fizjoterapeuta przyspiesza ich powrót do zdrowia.</p>}
    <div className={`match-squad-formation-layout ${inMatch ? 'match-squad-formation-layout-live' : ''}`}>
      <div className="match-squad-field-column">
        <div className="football-pitch" role="group" aria-label={`Boisko, ustawienie ${game.tactics.formation}`}>
          <span className="pitch-halfway" />
          {positionedLineup.slice().reverse().map((line, rowIndex) => <div className="pitch-line" key={`${game.tactics.formation}-${rowIndex}`} style={{ gridTemplateColumns: `repeat(${line.length}, minmax(0, 1fr))` }}>
            {line.map(({ slot, player, slotIndex }, playerIndex) => player
              ? <button key={player.id} type="button" data-pitch-player-id={player.id} data-pitch-slot-index={slotIndex} draggable={false} aria-pressed={!inMatch && selectedRolePlayerId === player.id} aria-label={`${player.firstName} ${player.lastName}, pozycja ${positionLabels[slot]}${effectiveSpecialRoles.captain === player.id ? ', kapitan' : ''}. Kliknij, aby przypisać role; przeciągnij lub przytrzymaj, aby zmienić ustawienie`} className={`pitch-player ${!inMatch && selectedRolePlayerId === player.id ? 'pitch-player-active' : ''} ${canDropOnPitchPlayer(player) ? 'pitch-player-drop-available' : ''} ${dragOverSlotIndex === slotIndex ? 'pitch-player-drop-target' : ''} ${draggedPlayerId === player.id ? 'pitch-player-dragged' : ''}`} onClick={(event) => { if (touchDragActivatedRef.current) { event.preventDefault(); touchDragActivatedRef.current = false; return } if (!inMatch) setSelectedRolePlayerId((current) => current === player.id ? null : player.id) }} onTouchStart={(event) => handleRosterTouchStart(event, player.id)} onTouchMove={handleRosterTouchMove} onTouchEnd={handleRosterTouchEnd} onTouchCancel={handleRosterTouchEnd} onPointerDown={(event) => startMousePlayerDrag(event, player.id)}>
                {effectiveSpecialRoles.captain === player.id && <span className="pitch-player-captain-badge" title={selectedSpecialRoles?.captain === player.id ? 'Kapitan' : 'Tymczasowy kapitan'} aria-label={selectedSpecialRoles?.captain === player.id ? 'Kapitan' : 'Tymczasowy kapitan'}>C</span>}
                <span className="pitch-player-position"><PositionBadge position={player.position} />{!canPlayPosition(player, slot) && <TriangleAlert className="position-warning-icon" size={14} aria-label={`Nieprzeszkolony na pozycję ${positionLabels[slot]}`} />}</span><strong><PlayerName player={player} /></strong>
                <small>{positionLabels[slot]}</small><PlayerMatchRating player={player} compact /><PitchPlayerStamina player={player} />
              </button>
              : <button type="button" data-pitch-slot-index={slotIndex} className={`pitch-player pitch-player-empty ${draggedPlayerIsStarter && !inMatch ? 'pitch-player-drop-available' : ''} ${dragOverSlotIndex === slotIndex ? 'pitch-player-drop-target' : ''}`} key={`${rowIndex}-${playerIndex}`} aria-label={`Wolne miejsce: ${positionLabels[slot]}`}>Wolne miejsce · {positionLabels[slot]}</button>)}
          </div>)}
        </div>
        {!inMatch && selectedRolePlayer && <div className="player-special-roles" aria-label="Przypisywanie ról zawodnikowi">
          <div className="player-special-roles-heading">
            <strong>Role zawodnika · {selectedRolePlayer.firstName} {selectedRolePlayer.lastName}</strong>
            <button type="button" onClick={() => setSelectedRolePlayerId(null)} aria-label="Zamknij role zawodnika"><X size={14} /></button>
          </div>
          <div className="player-special-role-list">{specialRoleOptions.map(({ id, label }) => {
            const assignedPlayerId = selectedSpecialRoles?.[id] ?? null
            const actingPlayer = game.squad.find((candidate) => candidate.id === effectiveSpecialRoles[id])
            const isAssigned = assignedPlayerId === selectedRolePlayer.id
            const isActing = effectiveSpecialRoles[id] === selectedRolePlayer.id
            return <button type="button" className={`player-special-role ${isAssigned ? 'player-special-role-selected' : ''}`} key={id} onClick={() => assignSpecialRole(id)}>
              <span>{label}</span>
              <strong>{isAssigned ? 'Przypisano' : isActing ? 'Tymczasowo pełni rolę' : assignedPlayerId ? `Przypisany: ${game.squad.find((candidate) => candidate.id === assignedPlayerId)?.firstName ?? 'inny zawodnik'}` : 'Automatyczny wybór'}</strong>
              {!isAssigned && isActing && actingPlayer && <small>Zastępstwo tymczasowe</small>}
            </button>
          })}</div>
        </div>}
        {!inMatch && <AvailabilityPitchPanel game={game} />}
      </div>
      <div className="bench-area">
        <section className={`bench-roster-window ${rosterDropTarget === 'bench' ? 'bench-roster-window-drop-target' : ''}`} {...(!inMatch ? { 'data-roster-drop-target': 'bench' } : {})}>
          <div className="substitution-heading"><strong>{inMatch ? 'Dostępni rezerwowi do zmian' : 'Ławka rezerwowych'}</strong><span>{displayedBenchPlayers.length} / 7 · przeciągnij lub przytrzymaj i przenieś na boisko</span></div>
          {displayedBenchPlayers.filter((player) => !inMatch || !game.pendingMatchEvent?.substitutedPlayerIds?.includes(player.id)).length
            ? <div className="bench-players">{displayedBenchPlayers.filter((player) => !inMatch || !game.pendingMatchEvent?.substitutedPlayerIds?.includes(player.id)).map((player) => renderRosterPlayer(player, true))}</div>
            : <p className="discipline-explainer">Nie wybrano jeszcze zawodników na ławkę.</p>}
        </section>
        {!inMatch && <section className={`bench-roster-window bench-roster-window-outside ${rosterDropTarget === 'outside' ? 'bench-roster-window-drop-target' : ''}`} data-roster-drop-target="outside">
          <div className="substitution-heading"><strong>Poza składem</strong><span>{outsideSquadPlayers.length} · przeciągnij kartę lub przytrzymaj i przenieś</span></div>
          {displayedOutsidePlayers.length
            ? <div className="bench-players">{displayedOutsidePlayers.map((player) => renderRosterPlayer(player, false))}</div>
            : <p className="discipline-explainer">Wszyscy dostępni zawodnicy są w pierwszym składzie lub na ławce.</p>}
        </section>}
      </div>
    </div>
    {touchDragging && draggedPlayer && dragPreviewPosition && <div
      className="player-drag-preview"
      style={{ left: dragPreviewPosition.x, top: dragPreviewPosition.y }}
      aria-hidden="true"
    >
      <PositionBadge position={draggedPlayer.position} />
      <span className="player-drag-preview-info">
        <strong><PlayerName player={draggedPlayer} /></strong>
        <small>Przenosisz zawodnika</small>
      </span>
      <PitchPlayerStamina player={draggedPlayer} />
    </div>}
  </section>
}

function ContractOffer({ game, player, onUpdate }: { game: GameState; player: Player; onUpdate: (game: GameState, message?: string) => void }) {
  const [wage, setWage] = useState(getPlayerContractDemand(player))
  const [extension, setExtension] = useState(2)
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = renewPlayerContract(game, player.id, wage, extension)
    if (result.error) return onUpdate(game, result.error)
    onUpdate(result.game, `Przedłużono kontrakt zawodnika ${player.firstName} ${player.lastName} o ${extension} ${extension === 1 ? 'sezon' : 'sezony'}.`)
  }
  return <form className="contract-offer" onSubmit={submit}>
    <label>Oferta / kolejkę<input type="number" min={getPlayerContractDemand(player)} step="100" value={wage} onChange={(event) => setWage(Number(event.target.value))} aria-label={`Oferta pensji dla ${player.firstName} ${player.lastName}`} /></label>
    <label>Przedłuż o<select value={extension} onChange={(event) => setExtension(Number(event.target.value))} aria-label={`Okres przedłużenia umowy ${player.firstName} ${player.lastName}`}><option value={1}>1 sezon</option><option value={2}>2 sezony</option><option value={3}>3 sezony</option></select></label>
    <button type="submit">Złóż ofertę</button>
    <small>Oczekiwania zawodnika: min. {formatMoney(getPlayerContractDemand(player))} / kolejkę</small>
  </form>
}

function PlayerMoraleCell({ game, player, onUpdate }: { game: GameState; player: Player; onUpdate: (game: GameState, message?: string) => void }) {
  const conversationAvailable = player.lastConversationSeason !== game.season
    || game.round - (player.lastConversationRound ?? game.round) >= 3
  const remainingFixtures = game.matches.filter((match) =>
    !match.played && !match.bye && (match.homeId === game.teamId || match.awayId === game.teamId),
  ).length
  const canPromise = conversationAvailable && !player.moralePromise && remainingFixtures >= 6
  const captain = game.squad.find((candidate) => candidate.id === game.playerSpecialRoles?.captain && candidate.id !== player.id)
    ?? game.squad.find((candidate) => candidate.personality === 'leader' && candidate.id !== player.id)
  const captainChemistry = captain
    ? game.teamChemistry?.[[player.id, captain.id].sort().join('::')] ?? 50
    : undefined
  const canMediate = Boolean(conversationAvailable && captain && player.morale < 100)
  const moraleLabel = player.morale >= 75 ? 'Dobre' : player.morale >= 50 ? 'Stabilne' : 'Niskie'
  const promise = player.moralePromise
  function talk(action: 'encourage' | 'minutes' | 'wage' | 'mediate') {
    const result = talkToPlayer(game, player.id, action)
    if (result.error) return onUpdate(game, result.error)
    const message = action === 'encourage'
      ? `Rozmowa podniosła morale zawodnika ${player.firstName} ${player.lastName}.`
      : action === 'mediate'
        ? `${captain?.firstName} ${captain?.lastName} pomógł poprawić relacje z ${player.firstName} ${player.lastName}.`
      : `Złożono obietnicę zawodnikowi ${player.firstName} ${player.lastName}.`
    onUpdate(result.game, message)
  }

  return <div className="player-morale-cell">
    <div className={`morale-summary morale-${player.morale >= 75 ? 'good' : player.morale >= 50 ? 'steady' : 'low'}`}><span>{player.personality ? playerPersonalityLabels[player.personality] : moraleLabel}</span><strong>{player.morale}%</strong></div>
    <div className="morale-meter" aria-label={`Morale: ${player.morale}%`}><span style={{ width: `${player.morale}%` }} /></div>
    {player.transferRequest && <small className="transfer-request-label">Prośba o transfer</small>}
    {captain && <small className="player-chemistry-status">Relacja z kapitanem: {captainChemistry}%</small>}
    {promise && <small className="player-promise-status">{promise.kind === 'stay' ? 'Pozostanie w klubie' : promise.kind === 'minutes' ? 'Minuty' : 'Podwyżka'}: {promise.kind === 'stay' ? 'obietnica aktywna' : `${promise.startsCompleted}/${promise.startsRequired} startów`} · {promise.matchesRemaining} meczów</small>}
    <div className="player-conversation-actions">
      <button disabled={!conversationAvailable || player.morale >= 100} title="Podnieś morale o 8 punktów" onClick={() => talk('encourage')}>Wesprzyj</button>
      <button disabled={!canMediate} title={captain ? `Poproś ${captain.firstName} ${captain.lastName} o poprawę relacji` : 'Brak dostępnego lidera w drużynie'} onClick={() => talk('mediate')}>Kapitan</button>
      <button disabled={!canPromise} title="Obiecaj 4 starty w najbliższych 6 meczach ligowych" onClick={() => talk('minutes')}>Minuty</button>
      <button disabled={!canPromise} title="Obiecaj 4 starty w najbliższych 6 meczach ligowych i podwyżkę pensji o 15%" onClick={() => talk('wage')}>Podwyżka</button>
    </div>
    {!conversationAvailable && <small className="conversation-cooldown">Kolejna rozmowa za kilka kolejek</small>}
    {conversationAvailable && !player.moralePromise && remainingFixtures < 6 && <small className="conversation-cooldown">Za mało meczów na obietnicę</small>}
  </div>
}

function getAvailabilityEntries(game: GameState): AvailabilityEntry[] {
  const competitionLabels: Record<string, string> = {
    league: 'Liga',
    'polish-cup': 'Polski Puchar',
    friendly: 'Sparingi',
    other: 'Inne rozgrywki',
  }
  return game.squad.flatMap((player) => {
    const playerEntries: AvailabilityEntry[] = []
    const injuryMatches = player.injury?.matchesRemaining ?? 0
    if (injuryMatches > 0) {
      playerEntries.push({
        player,
        kind: 'injury',
        title: `Kontuzja: ${player.injury?.description ?? 'uraz'}`,
        detail: `${getInjuryDurationLabel(injuryMatches)} · ${injuryMatches} ${injuryMatches === 1 ? 'mecz' : 'meczów'} do końca`,
      })
    }
    Object.entries(player.discipline ?? {}).forEach(([competition, discipline]) => {
      const suspendedMatches = discipline?.suspendedMatches ?? 0
      if (suspendedMatches <= 0) return
      playerEntries.push({
        player,
        kind: 'suspension',
        title: discipline?.redCards ? 'Pauza po czerwonej kartce' : 'Pauza dyscyplinarna',
        detail: `${competitionLabels[competition] ?? competition} · ${suspendedMatches} ${suspendedMatches === 1 ? 'mecz' : 'meczów'} do końca`,
      })
    })
    return playerEntries
  })
}

function AvailabilityPitchPanel({ game }: { game: GameState }) {
  const entries = getAvailabilityEntries(game)

  return <section className="availability-pitch-panel" aria-label="Pauzy i Kontuzje">
    <div className="availability-pitch-heading"><strong>Pauzy i Kontuzje</strong><span>{entries.length} zgłoszeń</span></div>
    <p className="availability-pitch-note">Pauzy są liczone osobno dla ligi i Polskiego Pucharu. Zawieszenie w jednych rozgrywkach nie wyklucza gry w drugich.</p>
    {entries.length
      ? <div className="availability-pitch-list">{entries.map((entry, index) => <article className={`availability-pitch-row availability-row-${entry.kind}`} key={`${entry.player.id}-${entry.kind}-${index}`}>
        <span className="availability-icon">{entry.kind === 'injury' ? <Ambulance size={16} /> : <Shield size={16} />}</span>
        <span className="availability-pitch-player"><strong>{entry.player.firstName} {entry.player.lastName}</strong><small>{entry.title}</small></span>
        <span className="availability-detail">{entry.detail}</span>
      </article>)}</div>
      : <p className="availability-pitch-empty">Brak kontuzji i aktywnych pauz.</p>}
  </section>
}

function AvailabilityPage({ game, onOpenProfile }: { game: GameState; onOpenProfile: (player: Player) => void }) {
  const entries = getAvailabilityEntries(game)
  const injuredCount = game.squad.filter((player) => (player.injury?.matchesRemaining ?? 0) > 0).length
  const suspendedCount = entries.filter((entry) => entry.kind === 'suspension').length
  const unavailableCount = new Set(entries.map((entry) => entry.player.id)).size

  return <>
    <div className="page-stats-row availability-stats">
      <StatCard icon={<Ambulance size={17} />} label="KONTUZJOWANI" value={String(injuredCount)} />
      <StatCard icon={<Shield size={17} />} label="AKTYWNE PAUZY" value={String(suspendedCount)} />
      <StatCard icon={<Users size={17} />} label="NIEDOSTĘPNI ZAWODNICY" value={String(unavailableCount)} />
    </div>
    <section className="panel-card availability-panel">
      <div className="panel-heading">
        <div><p className="eyebrow">DOSTĘPNOŚĆ KADRY</p><h2>Pauzy i Kontuzje</h2></div>
        <span className="roster-count">{entries.length} zgłoszeń</span>
      </div>
      <p className="availability-pitch-note">Pauzy są liczone osobno dla ligi i Polskiego Pucharu. Zawieszenie w jednych rozgrywkach nie wyklucza gry w drugich.</p>
      {entries.length
        ? <div className="availability-list">{entries.map((entry, index) => <article className={`availability-row availability-row-${entry.kind}`} key={`${entry.player.id}-${entry.kind}-${index}`}>
          <span className="availability-icon">{entry.kind === 'injury' ? <Ambulance size={17} /> : <Shield size={17} />}</span>
          <PositionBadge position={entry.player.position} />
          <span className="availability-player">
            <button type="button" onClick={() => onOpenProfile(entry.player)}>{entry.player.firstName} {entry.player.lastName}</button>
            <small>{entry.title}</small>
          </span>
          <span className="availability-detail">{entry.detail}</span>
        </article>)}</div>
        : <div className="empty-state availability-empty"><Check size={20} /><span>Wszyscy zawodnicy są dostępni. Brak kontuzji i aktywnych pauz.</span></div>}
    </section>
  </>
}

function SquadPage({ game, onUpdate, onTrain, onOpenProfile }: { game: GameState; onUpdate: (game: GameState, message?: string) => void; onTrain: (focus: TrainingFocus) => void; onOpenProfile: (player: Player) => void }) {
  const [filter, setFilter] = useState<Position | 'all'>('all')
  const [sortField, setSortField] = useState<'lineup' | 'number' | 'name' | 'position' | 'age' | 'skill' | 'morale' | 'value' | 'wage' | 'contract'>('lineup')
  const [sortAscending, setSortAscending] = useState(false)
  const [rosterFilters, setRosterFilters] = useState({
    numberMin: '', numberMax: '',
    ageMin: '', ageMax: '',
    skillMin: '', skillMax: '',
    moraleMin: '', moraleMax: '',
    valueMin: '', valueMax: '',
    wageMin: '', wageMax: '',
    contractMin: '', contractMax: '',
  })
  const [activeSquadCard, setActiveSquadCard] = useState(0)
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null)
  const [editedFirstName, setEditedFirstName] = useState('')
  const [editedLastName, setEditedLastName] = useState('')
  const transferWindowOpen = getTransferWindowInfo(game).isOpen
  const squadCompetition = getNextScheduledCompetition(game) === 'polish-cup' ? 'polish-cup' : 'league'
  const sortedPlayers = [...game.squad].sort((first, second) => {
    if (sortField === 'lineup') return Number(game.lineupIds.includes(second.id)) - Number(game.lineupIds.includes(first.id)) || second.skill - first.skill
    const direction = sortAscending ? 1 : -1
    const comparison = sortField === 'number'
      ? (first.shirtNumber ?? 0) - (second.shirtNumber ?? 0)
      : sortField === 'name'
        ? `${first.lastName} ${first.firstName}`.localeCompare(`${second.lastName} ${second.firstName}`, 'pl-PL')
        : sortField === 'position'
          ? first.position.localeCompare(second.position, 'pl-PL')
          : sortField === 'age'
            ? first.age - second.age
            : sortField === 'skill'
              ? first.skill - second.skill
              : sortField === 'morale'
                ? first.morale - second.morale
                : sortField === 'value'
                  ? first.value - second.value
                  : sortField === 'wage'
                    ? first.wage - second.wage
                    : (first.contractSeasonsRemaining ?? 2) - (second.contractSeasonsRemaining ?? 2)
    return comparison * direction
  })
  const shownPlayers = sortedPlayers.filter((player) => {
    const matchesRange = (value: number, min: string, max: string) =>
      (min === '' || value >= Number(min)) && (max === '' || value <= Number(max))
    return (filter === 'all' || player.position === filter || player.secondaryPositions?.includes(filter))
      && matchesRange(player.shirtNumber ?? 0, rosterFilters.numberMin, rosterFilters.numberMax)
      && matchesRange(player.age, rosterFilters.ageMin, rosterFilters.ageMax)
      && matchesRange(player.skill, rosterFilters.skillMin, rosterFilters.skillMax)
      && matchesRange(player.morale, rosterFilters.moraleMin, rosterFilters.moraleMax)
      && matchesRange(player.value, rosterFilters.valueMin, rosterFilters.valueMax)
      && matchesRange(player.wage, rosterFilters.wageMin, rosterFilters.wageMax)
      && matchesRange(player.contractSeasonsRemaining ?? 2, rosterFilters.contractMin, rosterFilters.contractMax)
  })
  const activeRosterFilterCount = Object.values(rosterFilters).filter((value) => value !== '').length + Number(filter !== 'all')
  function sortRosterBy(field: typeof sortField) {
    if (field === sortField) {
      setSortAscending((ascending) => !ascending)
    } else {
      setSortField(field)
      setSortAscending(field === 'name' || field === 'position' || field === 'number' || field === 'age' || field === 'contract')
    }
  }
  function rosterSortHeader(field: typeof sortField, label: string) {
    const active = sortField === field
    return <th aria-sort={active ? sortAscending ? 'ascending' : 'descending' : 'none'}>
      <button type="button" className="roster-sort-button" onClick={() => sortRosterBy(field)}>{label}{active && <span aria-hidden="true">{sortAscending ? ' ↑' : ' ↓'}</span>}</button>
    </th>
  }
  function rangeFilter(label: string, minKey: keyof typeof rosterFilters, maxKey: keyof typeof rosterFilters, max?: number, suffix?: string) {
    return <fieldset className="roster-range-filter">
      <legend>{label}</legend>
      <input type="number" min="0" max={max} value={rosterFilters[minKey]} aria-label={`${label} od`} placeholder="od" onChange={(event) => setRosterFilters((current) => ({ ...current, [minKey]: event.target.value }))} />
      <input type="number" min="0" max={max} value={rosterFilters[maxKey]} aria-label={`${label} do`} placeholder={`do${suffix ? ` ${suffix}` : ''}`} onChange={(event) => setRosterFilters((current) => ({ ...current, [maxKey]: event.target.value }))} />
    </fieldset>
  }
  const retirementCandidates = game.squad.filter((player) => player.age >= 37 && (player.contractSeasonsRemaining ?? 2) > 1)
  const disciplineRows = game.squad.flatMap((player) => {
    const competitionDiscipline = getCompetitionDiscipline(player, squadCompetition)
    const leagueDiscipline = getCompetitionDiscipline(player, 'league')
    if (
      competitionDiscipline.yellowCardsTotal === 0
      && competitionDiscipline.redCards === 0
      && competitionDiscipline.suspendedMatches === 0
      && (squadCompetition === 'league'
        || (leagueDiscipline.yellowCardsTotal === 0 && leagueDiscipline.redCards === 0 && leagueDiscipline.suspendedMatches === 0))
    ) return []
    return [{ player, competitionDiscipline, leagueDiscipline }]
  })
  const disciplineTotals = game.squad.reduce((totals, player) => {
    const discipline = getCompetitionDiscipline(player, squadCompetition)
    totals.yellowCards += discipline.yellowCardsTotal
    totals.redCards += discipline.redCards
    totals.suspendedMatches += discipline.suspendedMatches
    return totals
  }, { yellowCards: 0, redCards: 0, suspendedMatches: 0 })
  function toggle(player: Player) {
    const result = toggleLineupPlayer(game, player.id, squadCompetition)
    if (result.error) return onUpdate(game, result.error)
    onUpdate(result.game, `${player.firstName} ${player.lastName} ${game.lineupIds.includes(player.id) ? 'opuszcza' : 'wchodzi do'} podstawowego składu.`)
  }
  function sell(player: Player) {
    const result = sellPlayer(game, player.id)
    if (result.error) return onUpdate(game, result.error)
    onUpdate(result.game, `Sprzedano zawodnika za ${formatMoney(Math.round(player.value * 0.82))}.`)
  }
  function beginRename(player: Player) {
    setEditingPlayerId(player.id)
    setEditedFirstName(player.firstName)
    setEditedLastName(player.lastName)
  }
  function saveRename(player: Player) {
    const result = renamePlayer(game, player.id, editedFirstName, editedLastName)
    if (result.error) return onUpdate(game, result.error)
    setEditingPlayerId(null)
    onUpdate(result.game, `Zmieniono dane zawodnika na ${editedFirstName.trim()} ${editedLastName.trim()}; zapamiętano je dla kolejnych karier.`)
  }
  function hireCoach(role: StaffRole) {
    const result = hireStaffMember(game, role)
    if (result.error) return onUpdate(game, result.error)
    onUpdate(result.game, `Zatrudniono ${staffRoles[role].label.toLocaleLowerCase('pl')}.`)
  }
  function fireCoach(staffId: string) {
    const result = dismissStaffMember(game, staffId)
    if (result.error) return onUpdate(game, result.error)
    onUpdate(result.game, 'Zakończono współpracę z członkiem sztabu.')
  }
  return <>
    <section className="squad-stats-carousel" aria-label="Karty statystyk pierwszej drużyny">
      <div className="squad-stats-carousel-heading">
        <div><p className="eyebrow">PODSUMOWANIE KADRY</p><h2>{activeSquadCard === 0 ? 'Informacje o drużynie' : `Kartki i pauzy · ${squadCompetition === 'league' ? 'liga' : 'Polski Puchar'}`}</h2></div>
        <div className="match-statistics-carousel-controls">
          <button type="button" className="match-statistics-carousel-arrow" aria-label="Poprzednia karta drużyny" onClick={() => setActiveSquadCard((card) => Math.max(0, card - 1))} disabled={activeSquadCard === 0}><ChevronLeft size={16} /></button>
          <span>{activeSquadCard + 1} / 2</span>
          <button type="button" className="match-statistics-carousel-arrow" aria-label="Następna karta drużyny" onClick={() => setActiveSquadCard((card) => Math.min(1, card + 1))} disabled={activeSquadCard === 1}><ChevronRight size={16} /></button>
        </div>
      </div>
      <div className="squad-stats-carousel-viewport">
        <div className="squad-stats-carousel-track" style={{ transform: `translateX(-${activeSquadCard * 100}%)` }}>
          <div className="squad-stats-carousel-card">
            <div className="page-stats-row"><StatCard icon={<Users size={17} />} label="ZAWODNICY" value={String(game.squad.length)} /><StatCard icon={<Activity size={17} />} label="SIŁA KADRY" value={`${overallRating(game.squad)} / 100`} /><StatCard icon={<Star size={17} />} label="W SKŁADZIE" value={`${game.lineupIds.length} / 11`} /><StatCard icon={<Banknote size={17} />} label="PŁACE / KOLEJKĘ" value={formatMoney(game.squad.reduce((total, player) => total + player.wage, 0))} /></div>
          </div>
          <section className="squad-stats-carousel-card squad-discipline-card panel-card" aria-label="Kartki i pauzy">
            <div className="squad-discipline-summary">
              <StatCard icon={<Shield size={17} />} label="ŻÓŁTE KARTKI" value={String(disciplineTotals.yellowCards)} />
              <StatCard icon={<Shield size={17} />} label="CZERWONE KARTKI" value={String(disciplineTotals.redCards)} />
              <StatCard icon={<TriangleAlert size={17} />} label="AKTYWNE PAUZY" value={String(disciplineTotals.suspendedMatches)} />
            </div>
            <p className="squad-discipline-note">Cztery żółte kartki oznaczają pauzę w następnym meczu tych rozgrywek. Zawieszenia ligowe i pucharowe są liczone osobno.</p>
            {disciplineRows.length
              ? <div className="squad-discipline-list">{disciplineRows.map(({ player, competitionDiscipline, leagueDiscipline }) => <div className="discipline-roster-player" key={player.id}>
                <PositionBadge position={player.position} />
                <strong><PlayerName player={player} /></strong>
                <span>🟨 {competitionDiscipline.yellowCardsTotal} · 🟥 {competitionDiscipline.redCards}{competitionDiscipline.suspendedMatches ? ` · Pauza: ${competitionDiscipline.suspendedMatches} ${competitionDiscipline.suspendedMatches === 1 ? 'mecz' : 'mecze'}` : ''}{squadCompetition !== 'league' && leagueDiscipline.suspendedMatches ? ` · Pauza ligowa: ${leagueDiscipline.suspendedMatches} (może zagrać w Polskim Pucharze)` : ''}</span>
              </div>)}</div>
              : <p className="availability-pitch-empty">Brak kartek i aktywnych pauz w kadrze.</p>}
          </section>
        </div>
      </div>
    </section>
    <section className="panel-card roster-panel">
      <div className="panel-heading"><div><p className="eyebrow">KADRA KLUBU</p><h2>Pierwsza drużyna</h2></div><span className="roster-count">{shownPlayers.length} / {game.squad.length} zawodników</span></div>
      <div className="roster-toolbar">
        <label className="position-filter"><SlidersHorizontal size={14} /><select value={filter} onChange={(event) => setFilter(event.target.value as Position | 'all')}><option value="all">Wszystkie pozycje</option>{Object.entries(positionLabels).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select><ChevronDown size={13} /></label>
        <details className="roster-filter-details">
          <summary>Filtry{activeRosterFilterCount > 0 ? ` · ${activeRosterFilterCount}` : ''}</summary>
          <div className="roster-filter-grid">
            {rangeFilter('Numer', 'numberMin', 'numberMax', 99)}
            {rangeFilter('Wiek', 'ageMin', 'ageMax', 60)}
            {rangeFilter('Umiejętności', 'skillMin', 'skillMax', 100)}
            {rangeFilter('Morale', 'moraleMin', 'moraleMax', 100)}
            {rangeFilter('Wycena (zł)', 'valueMin', 'valueMax')}
            {rangeFilter('Płaca / kolejkę (zł)', 'wageMin', 'wageMax')}
            {rangeFilter('Kontrakt (sezony)', 'contractMin', 'contractMax', 10)}
            <button type="button" className="roster-filter-reset" onClick={() => {
              setFilter('all')
              setRosterFilters({
                numberMin: '', numberMax: '', ageMin: '', ageMax: '',
                skillMin: '', skillMax: '', moraleMin: '', moraleMax: '',
                valueMin: '', valueMax: '', wageMin: '', wageMax: '',
                contractMin: '', contractMax: '',
              })
            }}>Wyczyść filtry</button>
          </div>
        </details>
        <span><i className="lineup-legend" /> Podstawowy skład</span>
      </div>
      {(game.squad.filter((player) => (player.contractSeasonsRemaining ?? 2) <= 1).length > 0) && <p className="contract-expiry-notice"><TriangleAlert size={14} /> {game.squad.filter((player) => (player.contractSeasonsRemaining ?? 2) <= 1).length} umów wygasa po tym sezonie. Negocjuj przedłużenia przed rozpoczęciem nowego sezonu.</p>}
      {retirementCandidates.length > 0 && <p className="retirement-notice"><TriangleAlert size={14} /> Po tym sezonie karierę zakończą: {retirementCandidates.map((player) => `${player.firstName} ${player.lastName}`).join(', ')}. Uzupełnij kadrę do co najmniej 11 zawodników.</p>}
      {game.squad.some((player) => (player.injury?.matchesRemaining ?? 0) > 0) && <p className="injury-notice"><TriangleAlert size={14} /> Kontuzje: {game.squad.filter((player) => (player.injury?.matchesRemaining ?? 0) > 0).map((player) => `${player.firstName} ${player.lastName} — ${player.injury?.description}, ${getInjuryDurationLabel(player.injury?.matchesRemaining ?? 0)}`).join('; ')}.</p>}
      <div className="table-scroll"><table className="roster-table"><thead><tr>
        {rosterSortHeader('number', 'NR')}
        {rosterSortHeader('name', 'ZAWODNIK')}
        {rosterSortHeader('position', 'POZ')}
        {rosterSortHeader('age', 'WIEK')}
        {rosterSortHeader('skill', 'UMIEJĘTNOŚCI')}
        {rosterSortHeader('morale', 'MORALE / ROZMOWY')}
        {rosterSortHeader('value', 'WYCENA GRY')}
        {rosterSortHeader('wage', 'PŁACA / KOL.')}
        {rosterSortHeader('contract', 'KONTRAKT')}
        <th>SKŁAD</th><th />
      </tr></thead><tbody>
        {shownPlayers.length === 0 && <tr><td className="roster-empty-result" colSpan={11}>Brak zawodników spełniających wybrane kryteria.</td></tr>}
        {shownPlayers.map((player) => <tr key={player.id} className={game.lineupIds.includes(player.id) ? 'lineup-row' : ''}>
          {(() => {
            const injuryMatches = player.injury?.matchesRemaining ?? 0
            const activeSuspensions = Object.entries(player.discipline ?? {})
              .filter(([, discipline]) => (discipline?.suspendedMatches ?? 0) > 0)
            const suspensionCount = activeSuspensions.reduce((total, [, discipline]) => total + (discipline?.suspendedMatches ?? 0), 0)
            const suspensionCompetitions = activeSuspensions.map(([competition]) =>
              competition === 'league' ? 'liga' : competition === 'polish-cup' ? 'Polski Puchar' : 'inne rozgrywki',
            )
            return <>
          <td>{player.shirtNumber ?? '—'}</td>
          <td><span className="player-name-cell">
            <PlayerPortrait player={player} />
            <span className="roster-player-name">
              <span className="roster-player-name-heading">
                {editingPlayerId === player.id
                  ? <strong><PlayerName player={player} /></strong>
                  : <button type="button" className="player-profile-link" onClick={() => onOpenProfile(player)}>{player.firstName} {player.lastName}</button>}
                {injuryMatches > 0 && <Ambulance className="player-injury-icon" size={14} aria-label={`Kontuzja: ${player.injury?.description}, ${getInjuryDurationLabel(injuryMatches)}`} />}
                {suspensionCount > 0 && <i className="player-red-card-icon" role="img" aria-label={`Aktywna pauza za kartki: ${suspensionCount} meczów · ${suspensionCompetitions.join(', ')}`} title={`Pauza za kartki · ${suspensionCount} meczów · ${suspensionCompetitions.join(', ')}`} />}
              </span>
              <small>{(player.injury?.matchesRemaining ?? 0) > 0 ? `Kontuzja: ${player.injury?.description} · ${getInjuryDurationLabel(player.injury?.matchesRemaining ?? 0)}` : `Potencjał ${player.potential}`}</small>
              {editingPlayerId === player.id && <span className="roster-name-editor"><input aria-label="Imię zawodnika" maxLength={32} value={editedFirstName} onChange={(event) => setEditedFirstName(event.target.value)} /><input aria-label="Nazwisko zawodnika" maxLength={40} value={editedLastName} onChange={(event) => setEditedLastName(event.target.value)} /><button type="button" onClick={() => saveRename(player)}>Zapisz</button><button type="button" onClick={() => setEditingPlayerId(null)}>Anuluj</button></span>}
            </span>
            {editingPlayerId !== player.id && <button type="button" className="roster-rename-button" onClick={() => beginRename(player)}>Zmień nazwę</button>}
          </span></td>
          <td><PlayerPositionBadges player={player} /></td><td>{player.age}</td>
          <td><span className="skill-cell"><strong>{player.skill}</strong><Stars skill={player.skill} /></span></td>
          <td><PlayerMoraleCell game={game} player={player} onUpdate={onUpdate} /></td>
          <td>{valueLabel(player.value)}</td><td>{formatMoney(player.wage)}</td>
          <td><span className={(player.contractSeasonsRemaining ?? 2) <= 1 ? 'contract-expiring' : 'contract-term'}>{(player.contractSeasonsRemaining ?? 2) <= 1 ? 'Wygasa' : `${player.contractSeasonsRemaining} sez.`}</span>{player.relegationReleaseClause && <small className="relegation-clause">Klauzula odejścia przy degradacji</small>}{(player.contractSeasonsRemaining ?? 2) <= 1 && <ContractOffer game={game} player={player} onUpdate={onUpdate} />}</td>
          <td><button className={game.lineupIds.includes(player.id) ? 'lineup-toggle lineup-selected' : 'lineup-toggle'} disabled={((player.injury?.matchesRemaining ?? 0) > 0 || getCompetitionDiscipline(player, squadCompetition).suspendedMatches > 0) && !game.lineupIds.includes(player.id)} onClick={() => toggle(player)}>{game.lineupIds.includes(player.id) ? <><Check size={12} /> W XI</> : 'Dodaj do XI'}</button></td>
          <td><button className="sell-player-button" title={transferWindowOpen ? 'Sprzedaj zawodnika' : 'Sprzedaż możliwa tylko w oknie transferowym'} disabled={!transferWindowOpen} onClick={() => sell(player)}><ArrowUpRight size={15} /></button></td>
            </>
          })()}
        </tr>)}
      </tbody></table></div>
    </section>
    <PositionTrainingPanel game={game} onUpdate={onUpdate} />
    <section className="panel-card coaching-staff-panel">
      <div className="panel-heading"><div><p className="eyebrow">SZTAB SZKOLENIOWY</p><h2>Trenerzy i rozwój drużyny</h2></div><span className="roster-count">{(game.staff ?? []).length} / 3 specjalistów</span></div>
      <p className="staff-panel-intro">Specjaliści usprawniają wybrane treningi. Wynagrodzenie sztabu jest pobierane po każdej rozegranej kolejce.</p>
      <div className="staff-card-grid">{(Object.entries(staffRoles) as Array<[StaffRole, typeof staffRoles[StaffRole]]>).map(([role, profile]) => {
        const coach = (game.staff ?? []).find((member) => member.role === role)
        return <article className="staff-card" key={role}>
          <span className="staff-card-icon">{role === 'physiotherapist' ? <Activity size={17} /> : <Dumbbell size={17} />}</span>
          <div className="staff-card-copy"><strong>{profile.label}</strong><p>{profile.description}</p><small>Kontrakt {formatMoney(profile.hiringCost)} · płaca {formatMoney(profile.wagePerRound)} / kolejkę</small></div>
          {coach ? <div className="staff-member-actions"><span>Zatrudniony: {coach.name}</span><button onClick={() => fireCoach(coach.id)}>Zwolnij</button></div> : <button className="staff-hire-button" disabled={game.cash < profile.hiringCost} onClick={() => hireCoach(role)}>Zatrudnij</button>}
        </article>
      })}</div>
    </section>
    <section className="training-panel">
      <div><span className="training-icon"><Dumbbell size={19} /></span><div><p className="eyebrow">ROZWÓJ DRUŻYNY</p><h2>Sesja treningowa</h2><p>Wybierz trening dla podstawowej jedenastki. Koszt sesji: 25 000 zł.</p></div></div>
      <div className="training-actions"><button onClick={() => onTrain('fitness')}><Activity size={15} /> Kondycja</button><button onClick={() => onTrain('attack')}><ArrowUpRight size={15} /> Atak</button><button onClick={() => onTrain('tactics')}><Users size={15} /> Zgranie</button></div>
    </section>
  </>
}

function getSeasonFixtureDate(season: string, round: number, tier: number, roundCount = 34, matchesPerOpponent = 2) {
  return getLeagueRoundDate(season, round, tier, roundCount, matchesPerOpponent)
}

function getCupFixtureDate(
  season: string,
  afterLeagueRound: number,
  tier: number,
  roundCount = 34,
  matchesPerOpponent = 2,
) {
  const previousLeagueDate = getSeasonFixtureDate(season, afterLeagueRound, tier, roundCount, matchesPerOpponent)
  const dayOffset = previousLeagueDate.getDay() === 1 ? 3 : 4
  previousLeagueDate.setDate(previousLeagueDate.getDate() + dayOffset)
  return previousLeagueDate
}

function getLeagueKickoffSlots(season: string, round: number, tier: number, roundCount = 34, matchesPerOpponent = 2) {
  const date = getSeasonFixtureDate(season, round, tier, roundCount, matchesPerOpponent)
  const day = date.getDay()
  const slotsByDay: Record<number, string[]> = tier >= 4
    ? { 0: ['12:30', '14:45', '17:30'], 6: ['14:45', '17:30'] }
    : {
      1: ['19:00'],
      5: ['18:00', '20:30'],
      6: ['14:45', '17:30', '20:15'],
      0: ['12:30', '14:45', '17:30'],
    }
  if (tier >= 4 && round % 2 === 0) return ['17:30']
  return slotsByDay[day] ?? ['17:30']
}

function matchAttractiveness(
  match: Match | PolishCupMatch,
  teams: Array<{ id: string; strength: number }>,
) {
  const home = teams.find((team) => team.id === match.homeId)
  const away = teams.find((team) => team.id === match.awayId)
  if (!home || !away) return 0
  return home.strength + away.strength + (100 - Math.abs(home.strength - away.strength)) * 0.35
}

function selectKickoffTime(
  match: Match | PolishCupMatch,
  matches: Array<Match | PolishCupMatch>,
  teams: Array<{ id: string; strength: number }>,
  slots: string[],
) {
  const rankedMatches = [...matches].sort((first, second) =>
    matchAttractiveness(second, teams) - matchAttractiveness(first, teams) || first.id.localeCompare(second.id),
  )
  const rank = Math.max(0, rankedMatches.findIndex((fixture) => fixture.id === match.id))
  const slotIndex = Math.max(0, slots.length - 1 - Math.floor(rank * slots.length / Math.max(1, rankedMatches.length)))
  return slots[slotIndex]
}

function getLeagueKickoffTime(game: GameState, match: Match) {
  if (match.kickoffTime) return match.kickoffTime
  const tier = getLeagueTier(game.leagueId)
  const slots = getLeagueKickoffSlots(
    game.season,
    match.round,
    tier,
    getSeasonRoundCount(game),
    getGameMatchupsPerOpponent(game),
  )
  const roundMatches = game.matches.filter((fixture) => fixture.round === match.round && !fixture.bye)
  return selectKickoffTime(match, roundMatches, game.teams, slots)
}

function getCupScheduleStage(match: PolishCupMatch, participants: number): PolishCupScheduleStage {
  if (match.stage === 'regional') {
    return ([
      'regional-first',
      'regional-second',
      'regional-third',
      'regional-quarterfinal',
      'regional-semifinal',
      'regional-final',
    ][Math.min(match.round, 6) - 1] ?? 'regional-final') as PolishCupScheduleStage
  }
  if (match.stage === 'third') return 'central-preliminary'
  if (match.stage === 'second') return 'central-first'
  if (match.stage === 'first') return 'central-round-of-16'
  if (match.stage === 'ekstraklasa') return 'central-round-of-8'
  if (participants >= 64) return 'central-first'
  if (participants >= 32) return 'central-round-of-16'
  if (participants >= 16) return 'central-round-of-8'
  if (participants >= 8) return 'central-quarterfinal'
  if (participants >= 4) return 'central-semifinal'
  return 'central-final'
}

function getCupFixtureSchedule(
  game: GameState,
  match: PolishCupMatch,
  _afterLeagueRound = game.polishCup?.scheduledAfterLeagueRound ?? 1,
  _eventIndex?: number,
) {
  const cup = game.polishCup
  const roundMatches = cup
    ? [...cup.history, ...cup.matches].filter((fixture) => fixture.stage === match.stage && fixture.round === match.round)
    : [match]
  const participants = cup?.participants.length ?? 0
  const scheduleStage = getCupScheduleStage(match, participants)
  const matchIndex = [...roundMatches]
    .sort((first, second) => first.id.localeCompare(second.id))
    .findIndex((fixture) => fixture.id === match.id)
  const schedule = getPolishCupMatchSchedule(game.season, scheduleStage, Math.max(0, matchIndex))
  if (!match.scheduledAt) return schedule
  const regionalCup = getRegionalCupForMatch(game, match)
  return {
    ...schedule,
    date: parseLocalDateKey(match.scheduledAt),
    kickoffTime: regionalCup ? match.kickoffTime ?? schedule.kickoffTime : schedule.kickoffTime,
  }
}

function getRegionalCupForMatch(game: GameState, match: Pick<PolishCupMatch, 'id'>) {
  return game.regionalCups?.find((cup) =>
    cup.matches.some((fixture) => fixture.id === match.id)
    || cup.history.some((fixture) => fixture.id === match.id),
  )
}

function getCupCompetitionLabel(game: GameState, match: Pick<PolishCupMatch, 'id'>) {
  const regionalCup = getRegionalCupForMatch(game, match)
  if (!regionalCup) return 'Polski Puchar'
  const regionName = regionalOptions.find((region) => region.id === regionalCup.regionId)?.name
    .split('·').at(-1)?.trim() ?? regionalCup.regionId
  return `Puchar regionalny · ${regionName}`
}

function getLeagueFixtureDate(game: GameState, match: Match) {
  if (match.scheduledAt) return parseLocalDateKey(match.scheduledAt)
  const date = getSeasonFixtureDate(
    game.season,
    match.round,
    getLeagueTier(game.leagueId),
    getSeasonRoundCount(game),
    getGameMatchupsPerOpponent(game),
  )
  const cup = game.polishCup
  if (!cup) return date
  const occupiedCupDates = cup.matches
    .filter((fixture) => !fixture.bye)
    .map((fixture) => getCupFixtureSchedule(game, fixture).date)
  if (!occupiedCupDates.some((cupDate) => cupDate.toDateString() === date.toDateString())) return date
  return getNextLeagueDateAfterCupCollision(date, occupiedCupDates)
}

type CalendarFixture = {
  match: Match | PolishCupMatch | PmpLeagueMatch | PromotionPlayoffFixture
  date: Date
  kickoffTime: string
  competition: string
  isNext: boolean
}

function MatchSetupPage({
  game,
  nextMatch,
  nextCompetition,
  nextCupMatch,
  nextChampionsCupMatch,
  onUpdate,
}: {
  game: GameState
  nextMatch: ReturnType<typeof getNextMatch>
  nextCompetition: ReturnType<typeof getNextScheduledCompetition>
  nextCupMatch?: PolishCupMatch
  nextChampionsCupMatch?: Match
  onUpdate: (game: GameState, message?: string) => void
}) {
  const upcomingLeagueMatch = game.matches.find((match) =>
    !match.played && !match.bye && (match.homeId === game.teamId || match.awayId === game.teamId),
  )
  const latestLeagueMatch = [...game.matches].reverse().find((match) =>
    !match.bye && (match.homeId === game.teamId || match.awayId === game.teamId),
  )
  const setupMatch = (nextCompetition === 'polish-cup' && nextCupMatch)
    || (nextCompetition === 'champions-cup' && nextChampionsCupMatch)
    || (nextCompetition === 'league' && nextMatch && !nextMatch.bye ? nextMatch : undefined)
    || upcomingLeagueMatch
    || latestLeagueMatch
  const competitionLabel = nextCompetition === 'friendly'
    ? 'sparing przedsezonowy'
    : setupMatch?.competitionId === 'polish-cup'
      ? getRegionalCupForMatch(game, setupMatch)
        ? getCupCompetitionLabel(game, setupMatch)
        : 'Polski Puchar'
      : setupMatch?.competitionId === 'champions-cup' ? 'Puchar Mistrzów' : 'rozgrywki ligowe'

  return <>
    <section className="match-detail-card calendar-next-match">
      <div>
        <p className="eyebrow">USTAWIENIA DRUŻYNY · SEZON {game.season}</p>
        <h2>{nextCompetition === 'friendly' ? `Przygotowanie na ${competitionLabel}` : setupMatch ? `Przygotowanie na ${competitionLabel}` : 'Ustaw skład i plan taktyczny'}</h2>
        <p><Users size={14} /> Przeciągnij zawodników z ławki lub kadry na wybraną pozycję na boisku. Możesz też kliknąć zawodnika, aby zmienić go z listy.</p>
      </div>
    </section>
    {setupMatch
      ? <MatchSquadPanel game={game} match={setupMatch} onUpdate={onUpdate} />
      : <section className="panel-card empty-state"><Users size={20} /><span>Nie znaleziono meczu, do którego można przypisać skład. Plan taktyczny możesz ustawić poniżej.</span></section>}
    <TacticsPanel game={game} onUpdate={onUpdate} />
  </>
}

function CalendarPage({
  game,
  nextMatch,
  nextCompetition,
  nextCupMatch,
  nextChampionsCupMatch,
  nextFriendlyMatch,
  calendarSimulationActive,
  calendarSimulationDate,
  calendarSimulationTargetDate,
  onSimulateToDate,
  onStartSeason,
  onNavigate,
}: {
  game: GameState
  nextMatch: ReturnType<typeof getNextMatch>
  nextCompetition: ReturnType<typeof getNextScheduledCompetition>
  nextCupMatch?: PolishCupMatch
  nextChampionsCupMatch?: Match
  nextFriendlyMatch?: FriendlyMatch
  calendarSimulationActive: boolean
  calendarSimulationDate: string | null
  calendarSimulationTargetDate: string | null
  onSimulateToDate: (dateKey: string) => void
  onStartSeason: () => void
  onNavigate: (section: Section) => void
}) {
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null)
  const nextPmpMatch = getPmpLeagueNextMatch(game)
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const tier = getLeagueTier(game.leagueId)
    const playoffFixture = game.promotionPlayoffs?.fixtures.find((fixture) =>
      !fixture.played && (fixture.homeId === game.teamId || fixture.awayId === game.teamId),
    )
    const referenceDate = game.currentDate
      ? parseLocalDateKey(game.currentDate)
      : nextCompetition === 'friendly' && nextFriendlyMatch?.scheduledAt
      ? parseLocalDateKey(nextFriendlyMatch.scheduledAt)
      : nextCompetition === 'champions-cup' && nextChampionsCupMatch?.scheduledAt
      ? parseLocalDateKey(nextChampionsCupMatch.scheduledAt)
      : nextCompetition === 'promotion-playoff' && playoffFixture
      ? new Date(`${playoffFixture.scheduledAt}T12:00:00`)
      : nextCompetition === 'polish-cup' && game.polishCup
      ? nextCupMatch
        ? getCupFixtureSchedule(game, nextCupMatch).date
        : getCupFixtureDate(
          game.season,
          game.polishCup.scheduledAfterLeagueRound ?? 1,
          tier,
          getSeasonRoundCount(game),
          getGameMatchupsPerOpponent(game),
        )
      : nextCompetition === 'pmp-league' && nextPmpMatch?.scheduledAt
      ? parseLocalDateKey(nextPmpMatch.scheduledAt)
      : nextMatch ? getLeagueFixtureDate(game, nextMatch) : getSeasonFixtureDate(
        game.season,
        1,
        tier,
        getSeasonRoundCount(game),
        getGameMatchupsPerOpponent(game),
      )
    return new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1)
  })
  const [followSimulationDate, setFollowSimulationDate] = useState(false)
  const followedDateKey = calendarSimulationDate
    ? calendarSimulationActive ? calendarSimulationDate : followSimulationDate ? game.currentDate : null
    : null
  const followedDate = followedDateKey ? parseLocalDateKey(followedDateKey) : null
  const displayedMonth = followedDate
    ? new Date(followedDate.getFullYear(), followedDate.getMonth(), 1)
    : visibleMonth
  const leagueTier = getLeagueTier(game.leagueId)
  const clubLeagueMatches = game.matches.filter((match) => !match.bye && (match.homeId === game.teamId || match.awayId === game.teamId))
  const fixtures: CalendarFixture[] = clubLeagueMatches.map((match) => ({
    match,
    date: getLeagueFixtureDate(game, match),
    kickoffTime: getLeagueKickoffTime(game, match),
    competition: `${leagues.find((league) => league.id === game.leagueId)?.name ?? 'Liga'} · kolejka ${match.round}`,
    isNext: nextCompetition === 'league' && match.id === nextMatch?.id,
  }))
  ;(game.preseasonFriendlies ?? []).forEach((match) => {
    if (!match.scheduledAt) return
    fixtures.push({
      match,
      date: parseLocalDateKey(match.scheduledAt),
      kickoffTime: match.kickoffTime ?? '17:00',
      competition: 'Sparing przedsezonowy',
      isNext: nextCompetition === 'friendly' && match.id === nextFriendlyMatch?.id,
    })
    if (game.championsCupMatch
      && (game.championsCupMatch.homeId === game.teamId || game.championsCupMatch.awayId === game.teamId)
      && game.championsCupMatch.scheduledAt) {
      fixtures.push({
        match: game.championsCupMatch,
        date: parseLocalDateKey(game.championsCupMatch.scheduledAt),
        kickoffTime: game.championsCupMatch.kickoffTime ?? '20:00',
        competition: 'Puchar Mistrzów',
        isNext: nextCompetition === 'champions-cup' && !game.championsCupMatch.played,
      })
    }
  })
  const cup = game.polishCup
  if (cup) {
    const cupRounds = [...new Set(cup.history.map((match) => `${match.stage}:${match.round}`))]
    cup.history.forEach((match) => {
      if (match.bye || (match.homeId !== game.teamId && match.awayId !== game.teamId)) return
      const cupRoundIndex = cupRounds.indexOf(`${match.stage}:${match.round}`)
      const afterLeagueRound = Math.min(1 + cupRoundIndex * 2, getSeasonRoundCount(game))
      const schedule = getCupFixtureSchedule(game, match, afterLeagueRound, cupRoundIndex)
      fixtures.push({
        match,
        date: schedule.date,
        kickoffTime: schedule.kickoffTime,
        competition: `Polski Puchar · ${getPolishCupMatchStageLabel(match.stage, match.round)}`,
        isNext: false,
      })
    })
    if (isPolishCupDrawPublished(game)) {
      cup.matches.forEach((match) => {
        if (match.bye || (match.homeId !== game.teamId && match.awayId !== game.teamId)) return
        const schedule = getCupFixtureSchedule(game, match, undefined, cupRounds.length)
        fixtures.push({
          match,
          date: schedule.date,
          kickoffTime: schedule.kickoffTime,
          competition: `Polski Puchar · ${getPolishCupMatchStageLabel(match.stage, match.round)}`,
          isNext: nextCompetition === 'polish-cup' && match.id === nextCupMatch?.id,
        })
      })
    }
  }
  const regionalCupMatches = (game.regionalCups ?? []).flatMap((regionalCup) => [
    ...regionalCup.history,
    ...regionalCup.matches,
  ])
  regionalCupMatches.forEach((match) => {
    if (match.bye || (match.homeId !== game.teamId && match.awayId !== game.teamId)) return
    if (fixtures.some((fixture) => fixture.match.id === match.id)) return
    const schedule = getCupFixtureSchedule(game, match)
    fixtures.push({
      match,
      date: schedule.date,
      kickoffTime: match.kickoffTime ?? schedule.kickoffTime,
      competition: `${getCupCompetitionLabel(game, match)} · runda ${match.round}`,
      isNext: nextCompetition === 'polish-cup' && match.id === nextCupMatch?.id,
    })
  })
  ;(game.pmpLeague ? [...game.pmpLeague.history, ...game.pmpLeague.matches] : []).forEach((match) => {
    if (match.homeId !== game.teamId && match.awayId !== game.teamId) return
    if (!match.scheduledAt || fixtures.some((fixture) => fixture.match.id === match.id)) return
    fixtures.push({
      match,
      date: parseLocalDateKey(match.scheduledAt),
      kickoffTime: match.kickoffTime ?? '17:00',
      competition: `Liga PMP · ${match.phase === 'groups' ? `grupa · kolejka ${match.round}` : match.phase.replaceAll('-', ' ')}`,
      isNext: nextCompetition === 'pmp-league' && match.id === getPmpLeagueNextMatch(game)?.id,
    })
  })
  game.promotionPlayoffs?.fixtures.forEach((match) => {
    if (match.homeId !== game.teamId && match.awayId !== game.teamId) return
    fixtures.push({
      match,
      date: new Date(`${match.scheduledAt}T12:00:00`),
      kickoffTime: match.kickoffTime,
      competition: `${match.leagueName} · baraże o awans · ${match.round === 1 ? 'półfinał' : 'finał'}`,
      isNext: nextCompetition === 'promotion-playoff'
        && match.round === game.promotionPlayoffs?.round && !match.played,
    })
  })
  fixtures.sort((first, second) => first.date.getTime() - second.date.getTime() || Number(second.isNext) - Number(first.isNext))

  const currentClubMatch = nextCompetition === 'champions-cup'
    ? nextChampionsCupMatch
    : nextCompetition === 'polish-cup'
    ? nextCupMatch
    : nextCompetition === 'pmp-league'
      ? nextPmpMatch
    : nextCompetition === 'friendly'
      ? nextFriendlyMatch
    : nextCompetition === 'league' && !nextMatch?.bye
      ? nextMatch
      : nextCompetition === 'promotion-playoff'
        ? game.promotionPlayoffs?.fixtures.find((fixture) =>
          fixture.round === game.promotionPlayoffs?.round && !fixture.played
          && (fixture.homeId === game.teamId || fixture.awayId === game.teamId),
        )
      : undefined
  const actionLabel = nextCompetition === 'season-complete'
    ? 'Rozpocznij nowy sezon'
    : 'Przejdź do Centrum klubowego'
  const handleCalendarAction = nextCompetition === 'season-complete'
    ? onStartSeason
    : () => onNavigate('overview')
  const dateFormatter = new Intl.DateTimeFormat('pl-PL', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
  const monthFormatter = new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' })
  const calendarDayOrdinal = (dateKey: string) => {
    const [year, month, day] = dateKey.split('-').map(Number)
    return Date.UTC(year, month - 1, day) / 86_400_000
  }
  const simulationStartDate = game.currentDate ?? `${game.season.split('/')[0]}-07-01`
  const simulationCurrentDate = calendarSimulationDate ?? simulationStartDate
  const simulationProgress = calendarSimulationTargetDate
    ? Math.max(0, Math.min(100, Math.round(
      (calendarDayOrdinal(simulationCurrentDate) - calendarDayOrdinal(simulationStartDate))
      / Math.max(1, calendarDayOrdinal(calendarSimulationTargetDate) - calendarDayOrdinal(simulationStartDate))
      * 100,
    )))
    : 0
  const weekdayLabels = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Niedz']
  const firstWeekday = (displayedMonth.getDay() + 6) % 7
  const daysInMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 0).getDate()
  const calendarDays = Array.from({ length: firstWeekday + daysInMonth }, (_, index) =>
    index < firstWeekday ? null : new Date(displayedMonth.getFullYear(), displayedMonth.getMonth(), index - firstWeekday + 1),
  )
  const fixtureKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
  const currentDateKey = calendarSimulationActive && calendarSimulationDate
    ? calendarSimulationDate
    : game.currentDate ?? `${game.season.split('/')[0]}-07-01`
  const nextMatchDateKey = nextCompetition === 'friendly' && nextFriendlyMatch?.scheduledAt
    ? fixtureKey(parseLocalDateKey(nextFriendlyMatch.scheduledAt))
    : nextCompetition === 'champions-cup' && nextChampionsCupMatch?.scheduledAt
    ? fixtureKey(parseLocalDateKey(nextChampionsCupMatch.scheduledAt))
    : nextCompetition === 'polish-cup' && nextCupMatch
    ? fixtureKey(getCupFixtureSchedule(game, nextCupMatch).date)
    : nextCompetition === 'pmp-league' && nextPmpMatch?.scheduledAt
      ? fixtureKey(parseLocalDateKey(nextPmpMatch.scheduledAt))
    : nextCompetition === 'promotion-playoff' && currentClubMatch
      ? fixtureKey(new Date(`${currentClubMatch.scheduledAt}T12:00:00`))
    : nextCompetition === 'league' && nextMatch && !nextMatch.bye
      ? fixtureKey(getLeagueFixtureDate(game, nextMatch))
      : nextCompetition === 'season-complete'
        ? fixtureKey(getSeasonFixtureDate(
          game.season,
          1,
          leagueTier,
          getSeasonRoundCount(game),
          getGameMatchupsPerOpponent(game),
        ))
        : undefined
  const getRoundFixtureRange = (round: number) => {
    const roundDates = game.matches
      .filter((match) => match.round === round && !match.bye)
      .map((match) => getLeagueFixtureDate(game, match))
      .sort((first, second) => first.getTime() - second.getTime())
    if (roundDates.length === 0) {
      const fallback = getSeasonFixtureDate(
        game.season,
        round,
        leagueTier,
        getSeasonRoundCount(game),
        getGameMatchupsPerOpponent(game),
      )
      return { start: fallback, end: fallback }
    }
    return { start: roundDates[0], end: roundDates[roundDates.length - 1] }
  }
  const seasonRoundCount = getSeasonRoundCount(game)
  const winterBreakAfterRound = Math.ceil(seasonRoundCount / 2)
  const winterBreakStart = new Date(getRoundFixtureRange(winterBreakAfterRound).end)
  winterBreakStart.setDate(winterBreakStart.getDate() + 1)
  const leagueResumeDate = getRoundFixtureRange(Math.min(winterBreakAfterRound + 1, seasonRoundCount)).start
  const seasonEndDate = getRoundFixtureRange(seasonRoundCount).end
  const seasonMarkersByDate = new Map<string, Array<{ type: 'winter-start' | 'resume' | 'season-end' | 'holiday'; label: string }>>()
  const addSeasonMarker = (date: Date, type: 'winter-start' | 'resume' | 'season-end' | 'holiday', label: string) => {
    const key = fixtureKey(date)
    const markers = seasonMarkersByDate.get(key) ?? []
    markers.push({ type, label })
    seasonMarkersByDate.set(key, markers)
  }
  addSeasonMarker(winterBreakStart, 'winter-start', `Początek przerwy zimowej po kolejce ${winterBreakAfterRound}`)
  if (seasonRoundCount > winterBreakAfterRound) {
    addSeasonMarker(leagueResumeDate, 'resume', `Wznowienie ligi · kolejka ${winterBreakAfterRound + 1}`)
  }
  addSeasonMarker(seasonEndDate, 'season-end', 'Koniec sezonu ligowego')
  const winterBreakEndTime = new Date(leagueResumeDate.getFullYear(), leagueResumeDate.getMonth(), leagueResumeDate.getDate()).getTime()
  const winterBreakStartTime = new Date(winterBreakStart.getFullYear(), winterBreakStart.getMonth(), winterBreakStart.getDate()).getTime()
  const seasonStartYear = Number.parseInt(game.season.split('/')[0] || game.currentDate?.slice(0, 4) || '2000', 10)
  const summerWindowStart = new Date(Number.isFinite(seasonStartYear) ? seasonStartYear : 2000, 6, 1)
  const summerWindowEnd = getRoundFixtureRange(Math.min(4, getSeasonRoundCount(game))).end
  const winterWindowStart = new Date(seasonStartYear + 1, 0, 1)
  const winterWindowEnd = new Date(seasonStartYear + 1, 0, 31)
  const transferWindows = [
    { key: 'summer', label: 'letniego', start: summerWindowStart, end: summerWindowEnd },
    { key: 'winter', label: 'zimowego', start: winterWindowStart, end: winterWindowEnd },
  ]
  const isSameCalendarDate = (first: Date, second: Date) => first.getFullYear() === second.getFullYear()
    && first.getMonth() === second.getMonth()
    && first.getDate() === second.getDate()
  const isInCalendarRange = (date: Date, start: Date, end: Date) => {
    const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
    return day >= new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()
      && day <= new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime()
  }
  const fixturesByDate = new Map<string, CalendarFixture[]>()
  fixtures.forEach((fixture) => {
    const key = fixtureKey(fixture.date)
    const dayFixtures = fixturesByDate.get(key) ?? []
    dayFixtures.push(fixture)
    fixturesByDate.set(key, dayFixtures)
  })

  return <>
    <section className="panel-card calendar-panel">
      <div className="panel-heading">
        <div><p className="eyebrow">TERMINARZ TWOJEGO KLUBU · SEZON {game.season}</p><h2>Kalendarz meczów</h2></div>
        <div className="calendar-month-navigation">
          <button type="button" aria-label="Poprzedni miesiąc" disabled={calendarSimulationActive} onClick={() => {
            setFollowSimulationDate(false)
            setVisibleMonth(new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() - 1, 1))
          }}><ChevronLeft size={17} /></button>
          <strong>{monthFormatter.format(displayedMonth)}</strong>
          <button type="button" aria-label="Następny miesiąc" disabled={calendarSimulationActive} onClick={() => {
            setFollowSimulationDate(false)
            setVisibleMonth(new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 1))
          }}><ChevronRight size={17} /></button>
        </div>
      </div>
      {calendarSimulationActive && calendarSimulationTargetDate && <div className="calendar-simulation-progress" role="status" aria-live="polite">
        <div className="calendar-simulation-progress-copy">
          <span><Play size={14} /> Symulacja kalendarza</span>
          <strong>{dateFormatter.format(parseLocalDateKey(simulationCurrentDate))} <small>z</small> {dateFormatter.format(parseLocalDateKey(calendarSimulationTargetDate))}</strong>
        </div>
        <div className="calendar-simulation-progress-track" role="progressbar" aria-label="Postęp symulacji kalendarza" aria-valuemin={0} aria-valuemax={100} aria-valuenow={simulationProgress}>
          <span style={{ width: `${simulationProgress}%` }} />
        </div>
      </div>}
      <div className="calendar-month-grid" role="grid" aria-label={`Kalendarz na ${monthFormatter.format(displayedMonth)}`}>
        {weekdayLabels.map((weekday) => <div className="calendar-weekday" role="columnheader" key={weekday}>{weekday}</div>)}
        {calendarDays.map((date, index) => {
          if (!date) return <div className="calendar-day calendar-day-empty" aria-hidden="true" key={`empty-${index}`} />
          const dayKey = fixtureKey(date)
          const dateKey = getLocalDateKey(date)
          const isSelectableDate = !calendarSimulationActive && dateKey > currentDateKey
          const isSelectedDate = selectedDateKey === dateKey
          const isSimulatedDay = calendarSimulationActive && calendarSimulationDate === dateKey
          const dayFixtures = fixturesByDate.get(dayKey) ?? []
          const isMatchdayFocus = nextMatchDateKey === dayKey
          const holidayName = getPolishPublicHolidayName(date)
          const seasonMarkers = [
            ...(seasonMarkersByDate.get(dayKey) ?? []),
            ...(holidayName ? [{ type: 'holiday' as const, label: `Święto ustawowe · ${holidayName}` }] : []),
          ]
          const dayTime = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
          const isWinterBreak = dayTime >= winterBreakStartTime && dayTime < winterBreakEndTime
          const activeTransferWindows = transferWindows.filter((window) => isInCalendarRange(date, window.start, window.end))
          const transferMarkers = activeTransferWindows.map((window) => ({
            window,
            edge: isSameCalendarDate(date, window.start) ? 'start' as const
              : isSameCalendarDate(date, window.end) ? 'end' as const
                : 'ongoing' as const,
          }))
          return <div className={`calendar-day ${isSelectableDate ? 'calendar-day-selectable' : ''} ${isSelectedDate ? 'calendar-day-selected' : ''} ${isSimulatedDay ? 'calendar-day-simulating' : ''} ${isWinterBreak ? 'calendar-day-winter-break' : ''} ${dayFixtures.some((fixture) => fixture.isNext) ? 'calendar-day-next' : ''} ${isMatchdayFocus ? 'calendar-day-matchday' : ''} ${activeTransferWindows.map((window) => `calendar-day-transfer-${window.key}`).join(' ')}`} role="gridcell" aria-selected={isSelectedDate} aria-current={isSimulatedDay ? 'date' : undefined} aria-label={`${dateFormatter.format(date)}${isSimulatedDay ? ' · symulowany dzień' : ''}`} tabIndex={isSelectableDate ? 0 : -1} key={dayKey} title={isSimulatedDay ? 'Aktualnie symulowany dzień' : isWinterBreak ? 'Przerwa zimowa w rozgrywkach ligowych' : undefined} onClick={isSelectableDate ? () => setSelectedDateKey(dateKey) : undefined} onKeyDown={isSelectableDate ? (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              setSelectedDateKey(dateKey)
            }
          } : undefined}>
            <div className="calendar-day-top">
              {seasonMarkers.length > 0 && <span className="calendar-season-markers">{seasonMarkers.map(({ type, label }) => {
                const MarkerIcon = type === 'winter-start' ? Snowflake : type === 'resume' ? Play : type === 'holiday' ? CalendarDays : Flag
                return <i className={`calendar-season-marker calendar-season-marker-${type}`} key={`${type}-${label}`} title={label} aria-label={label}><MarkerIcon size={10} aria-hidden="true" /></i>
              })}</span>}
              {transferMarkers.length > 0 && <span className="calendar-transfer-markers">{transferMarkers.map(({ window, edge }) => {
                const ArrowIcon = edge === 'end' ? ArrowLeft : ArrowRight
                const markerLabel = `${edge === 'start' ? 'Początek' : edge === 'end' ? 'Koniec' : 'Trwa'} ${window.label} okna transferowego`
                return <i className={`calendar-transfer-marker calendar-transfer-marker-${window.key}`} key={window.key} title={markerLabel} aria-label={markerLabel}><ArrowIcon size={10} aria-hidden="true" /></i>
              })}</span>}
              <span className="calendar-day-number">{date.getDate()}</span>
            </div>
            {dayFixtures.map(({ match, competition, isNext, kickoffTime }) => {
              const homeName = getTeamName(game, match.homeId)
              const awayName = match.bye ? 'Wolny los' : getTeamName(game, match.awayId)
              const score = match.bye
                ? match.played ? 'Awans' : 'Pauza'
                : match.played ? `${match.homeGoals ?? 0} : ${match.awayGoals ?? 0}${'penaltyScore' in match && match.penaltyScore ? ` (k. ${match.penaltyScore})` : ''}` : '— : —'
              const isRegionalCupMatch = competition.startsWith('Puchar regionalny')
              const isCupMatch = competition.startsWith('Polski Puchar') || isRegionalCupMatch
              const isChampionsCupMatch = competition === 'Puchar Mistrzów'
              const isPlayoffMatch = competition.includes('baraże o awans')
              const isClubHome = match.homeId === game.teamId
              const cupWinnerId = (isCupMatch || isChampionsCupMatch) && 'winnerId' in match ? match.winnerId : undefined
              const isFriendlyMatch = competition === 'Sparing przedsezonowy'
              const isClubWin = cupWinnerId
                ? cupWinnerId === game.teamId
                : isClubHome
                  ? (match.homeGoals ?? 0) > (match.awayGoals ?? 0)
                  : (match.awayGoals ?? 0) > (match.homeGoals ?? 0)
              const isClubDraw = !cupWinnerId && (match.homeGoals ?? 0) === (match.awayGoals ?? 0)
              const resultClass = match.played && !match.bye
                ? isClubWin ? 'calendar-day-match-win' : isClubDraw ? 'calendar-day-match-draw' : 'calendar-day-match-loss'
                : ''
              return <div className={`calendar-day-match ${isFriendlyMatch ? 'calendar-day-match-friendly' : isCupMatch || isChampionsCupMatch || isPlayoffMatch ? 'calendar-day-match-cup' : 'calendar-day-match-league'} ${match.played ? 'calendar-day-match-played' : ''} ${resultClass} ${isNext ? 'calendar-day-match-next' : ''}`} key={match.id} title={`${competition}: ${isClubHome ? 'Dom' : 'Wyjazd'}${resultClass ? ` · ${isClubWin ? 'Wygrana' : isClubDraw ? 'Remis' : 'Porażka'}` : ''} · ${homeName} ${score} ${awayName}`}>
                <small>{isFriendlyMatch ? 'SPARING' : isChampionsCupMatch ? 'PUCHAR MISTRZÓW' : isRegionalCupMatch ? 'PUCHAR REGIONALNY' : isCupMatch ? 'POLSKI PUCHAR' : isPlayoffMatch ? 'BARAŻE' : 'LIGA'} · {kickoffTime}</small>
                <small className={`calendar-day-match-venue ${isClubHome ? 'calendar-day-match-venue-home' : 'calendar-day-match-venue-away'}`}>{isClubHome ? 'DOM' : 'WYJAZD'}</small>
                <strong className={match.homeId === game.teamId ? 'fixture-own' : ''}>{homeName}</strong>
                <span>{score}</span>
                <strong className={match.awayId === game.teamId ? 'fixture-own' : ''}>{awayName}</strong>
              </div>
            })}
          </div>
        })}
      </div>
      {selectedDateKey && selectedDateKey > currentDateKey && <div className="calendar-selected-day">
        <p>Wybrany dzień: <strong>{dateFormatter.format(parseLocalDateKey(selectedDateKey))}</strong></p>
        <button type="button" className="primary-button" disabled={calendarSimulationActive} onClick={() => {
          setFollowSimulationDate(true)
          onSimulateToDate(selectedDateKey)
          setSelectedDateKey(null)
        }}>
          {calendarSimulationActive ? 'Symulacja kalendarza…' : 'Symuluj do dnia'} <ArrowRight size={15} />
        </button>
      </div>}
      <div className="calendar-legend"><span><i className="calendar-legend-next" /> Najbliższy mecz</span><span><i className="calendar-legend-friendly" /> Sparing</span><span><i className="calendar-legend-cup" /> Puchary</span><span><i className="calendar-legend-played" /> Rozegrany</span><span><i className="calendar-legend-win" /> Wygrana</span><span><i className="calendar-legend-draw" /> Remis</span><span><i className="calendar-legend-loss" /> Porażka</span><span><i className="calendar-legend-transfer-summer"><ArrowRight size={9} /></i> Letnie okno</span><span><i className="calendar-legend-transfer-winter"><ArrowRight size={9} /></i> Zimowe okno</span><span><i className="calendar-legend-season-winter"><Snowflake size={9} /></i> Przerwa zimowa</span><span><i className="calendar-legend-season-resume"><Play size={9} /></i> Wznowienie ligi</span><span><i className="calendar-legend-season-end"><Flag size={9} /></i> Koniec sezonu ligowego</span><span><i className="calendar-legend-season-holiday"><CalendarDays size={9} /></i> Święto ustawowe</span></div>
      <p className="calendar-simulation-note">Kliknij przyszły dzień, aby wybrać „Symuluj do dnia”. Mecze Twojego klubu zostaną rozegrane automatycznie; symulacja zatrzyma się po otrzymaniu nowej wiadomości.</p>
    </section>

    <section className="match-detail-card calendar-next-match">
      <div>
        <p className="eyebrow">NAJBLIŻSZE WYDARZENIE · SEZON {game.season}</p>
        <h2>{currentClubMatch
          ? `${getTeamName(game, currentClubMatch.homeId)} vs ${getTeamName(game, currentClubMatch.awayId)}`
          : nextCompetition === 'season-complete'
            ? 'Sezon zakończony'
            : 'Dzień bez meczu Twojego klubu'}
        </h2>
        <p><CalendarDays size={14} /> {nextCompetition === 'friendly' && currentClubMatch
          ? `Sparing przedsezonowy · ${dateFormatter.format(parseLocalDateKey(currentClubMatch.scheduledAt ?? game.currentDate ?? `${game.season.split('/')[0]}-06-01`))} · ${currentClubMatch.kickoffTime ?? '17:00'}`
          : nextCompetition === 'promotion-playoff' && currentClubMatch
          ? `${dateFormatter.format(new Date(`${currentClubMatch.scheduledAt}T12:00:00`))} · ${currentClubMatch.kickoffTime}`
          : nextCompetition === 'polish-cup'
          ? `${nextCupMatch ? getCupCompetitionLabel(game, nextCupMatch) : 'Polski Puchar'} · ${dateFormatter.format(nextCupMatch ? getCupFixtureSchedule(game, nextCupMatch).date : getCupFixtureDate(game.season, cup?.scheduledAfterLeagueRound ?? 1, leagueTier, getSeasonRoundCount(game), getGameMatchupsPerOpponent(game)))} · ${nextCupMatch ? getCupFixtureSchedule(game, nextCupMatch).kickoffTime : leagueTier >= 4 ? '12:00' : '20:00'}`
          : nextCompetition === 'champions-cup' && nextChampionsCupMatch?.scheduledAt
          ? `Puchar Mistrzów · ${dateFormatter.format(parseLocalDateKey(nextChampionsCupMatch.scheduledAt))} · ${nextChampionsCupMatch.kickoffTime ?? '20:00'}`
          : nextMatch
            ? `${dateFormatter.format(getLeagueFixtureDate(game, nextMatch))} · ${getLeagueKickoffTime(game, nextMatch)} · kolejka ${nextMatch.round}`
            : 'Możesz przejść do nowego sezonu.'}
        </p>
      </div>
      <div className="calendar-next-actions">
        {currentClubMatch && <button className="secondary-button" onClick={() => onNavigate('tactics')}>Ustaw skład i taktykę</button>}
        <button className="primary-button" onClick={handleCalendarAction}>{actionLabel} <ArrowRight size={15} /></button>
      </div>
    </section>
  </>
}

function MatchesPage({ game, nextMatch, nextCompetition, nextFriendlyMatch, nextChampionsCupMatch, onNavigate }: { game: GameState; nextMatch: ReturnType<typeof getNextMatch>; nextCompetition: ReturnType<typeof getNextScheduledCompetition>; nextFriendlyMatch?: FriendlyMatch; nextChampionsCupMatch?: Match; onNavigate: (section: Section) => void }) {
  const matches = game.matches.filter((match) => match.homeId === game.teamId || match.awayId === game.teamId)
  const nextCupMatch = nextCompetition === 'polish-cup' ? getPolishCupNextMatch(game) : undefined
  const nextPmpMatch = nextCompetition === 'pmp-league' ? getPmpLeagueNextMatch(game) : undefined
  const leagueTier = getLeagueTier(game.leagueId)
  const dateFormatter = new Intl.DateTimeFormat('pl-PL', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  const currentDate = game.currentDate ?? `${game.season.split('/')[0]}-07-01`
  return <>
    {nextCompetition === 'champions-cup' && nextChampionsCupMatch && <section className="match-detail-card">
      <div>
        <p className="eyebrow">INAUGURACJA SEZONU · PUCHAR MISTRZÓW</p>
        <h2>{getTeamName(game, nextChampionsCupMatch.homeId)} <span>vs</span> {getTeamName(game, nextChampionsCupMatch.awayId)}</h2>
        <p><CalendarDays size={14} /> {dateFormatter.format(parseLocalDateKey(nextChampionsCupMatch.scheduledAt ?? game.currentDate ?? `${game.season.split('/')[0]}-07-01`))} · {nextChampionsCupMatch.kickoffTime ?? '20:00'}</p>
      </div>
      <button className="primary-button" onClick={() => onNavigate('overview')}>
        Przejdź do Centrum klubowego <ArrowRight size={13} />
      </button>
    </section>}
    {nextCompetition === 'friendly' && nextFriendlyMatch && <section className="match-detail-card">
      <div>
        <p className="eyebrow">PRZYGOTOWANIA · SPARING {nextFriendlyMatch.round} Z {game.preseasonFriendlies?.length ?? 3}</p>
        <h2>{getTeamName(game, nextFriendlyMatch.homeId)} <span>vs</span> {getTeamName(game, nextFriendlyMatch.awayId)}</h2>
        <p><CalendarDays size={14} /> {dateFormatter.format(parseLocalDateKey(nextFriendlyMatch.scheduledAt ?? game.currentDate ?? `${game.season.split('/')[0]}-06-01`))} · {nextFriendlyMatch.kickoffTime ?? '17:00'}</p>
        <p>Wynik sparingu nie wpływa na tabelę ligi ani Polskiego Pucharu.</p>
      </div>
      <button className="primary-button" onClick={() => onNavigate('overview')}>
        Przejdź do Centrum klubowego <ArrowRight size={13} />
      </button>
    </section>}
    {nextCompetition === 'pmp-league' && nextPmpMatch && <section className="match-detail-card">
      <div>
        <p className="eyebrow">LIGA PMP · {nextPmpMatch.phase === 'groups' ? `FAZA GRUPOWA · KOLEJKA ${nextPmpMatch.round}` : nextPmpMatch.phase.replaceAll('-', ' ')}</p>
        <h2>{getTeamName(game, nextPmpMatch.homeId)} <span>vs</span> {getTeamName(game, nextPmpMatch.awayId)}</h2>
        <p><CalendarDays size={14} /> {dateFormatter.format(parseLocalDateKey(nextPmpMatch.scheduledAt ?? currentDate))}</p>
      </div>
      <button className="primary-button" onClick={() => onNavigate('overview')}>
        Przejdź do Centrum klubowego <ArrowRight size={13} />
      </button>
    </section>}
    {nextCompetition === 'polish-cup' ? <section className="match-detail-card"><div><p className="eyebrow">TERMINARZ · {nextCupMatch ? getCupCompetitionLabel(game, nextCupMatch).toLocaleUpperCase('pl-PL') : 'POLSKI PUCHAR'}</p><h2>{nextCupMatch ? <>{getTeamName(game, nextCupMatch.homeId)} <span>vs</span> {getTeamName(game, nextCupMatch.awayId)}</> : 'Runda pucharowa'}</h2><p>{nextCupMatch ? <><MapPin size={14} /> {nextCupMatch.homeId === game.teamId ? `${game.clubName}, ${game.city}` : `${getTeamName(game, nextCupMatch.homeId)} — wyjazd`}</> : 'Twój klub ma wolny los. Pozostałe spotkania zostaną rozegrane automatycznie.'}</p><p><CalendarDays size={14} /> {dateFormatter.format(nextCupMatch ? getCupFixtureSchedule(game, nextCupMatch).date : getCupFixtureDate(game.season, game.polishCup?.scheduledAfterLeagueRound ?? 1, leagueTier, getSeasonRoundCount(game), getGameMatchupsPerOpponent(game)))} · {nextCupMatch ? getCupFixtureSchedule(game, nextCupMatch).kickoffTime : leagueTier >= 4 ? '12:00' : '20:00'}</p></div><button className="primary-button" onClick={() => onNavigate('overview')}>Przejdź do Centrum klubowego <ArrowRight size={15} /></button></section>
      : nextCompetition === 'league' && nextMatch && <section className="match-detail-card"><div><p className="eyebrow">{nextMatch.bye ? 'PAUZA LIGOWA' : 'NAJBLIŻSZY MECZ'} · KOLEJKA {nextMatch.round}</p><h2>{nextMatch.bye ? 'Twój klub pauzuje' : <>{getTeamName(game, nextMatch.homeId)} <span>vs</span> {getTeamName(game, nextMatch.awayId)}</>}</h2><p>{nextMatch.bye ? 'Pozostałe mecze kolejki i terminy bez udziału Twojego klubu zostaną rozegrane automatycznie.' : <><MapPin size={14} /> {nextMatch.homeId === game.teamId ? `${game.clubName}, ${game.city}` : `${getTeamName(game, nextMatch.homeId)} — wyjazd`}</>}</p>{!nextMatch.bye && <p><CalendarDays size={14} /> {dateFormatter.format(getLeagueFixtureDate(game, nextMatch))} · {getLeagueKickoffTime(game, nextMatch)}</p>}{!nextMatch.bye && nextMatch.homeId === game.teamId && <p className="attendance-forecast"><UsersRound size={14} /> Prognozowana frekwencja: {estimateAttendance(game, nextMatch).toLocaleString('pl-PL')} kibiców</p>}</div><button className="primary-button" onClick={() => onNavigate('overview')}>Przejdź do Centrum klubowego <ArrowRight size={15} /></button></section>}
    {game.lastMatchReport && <TacticalReport report={game.lastMatchReport} />}
    <section className="panel-card">
      <div className="panel-heading"><div><p className="eyebrow">SEZON {game.season}</p><h2>Terminarz i wyniki</h2></div><span className="roster-count">{matches.filter((match) => match.played && !match.bye).length} / {matches.filter((match) => !match.bye).length} spotkań</span></div>
      <div className="fixtures-list">{matches.map((match) => <div key={match.id} className={`fixture-row ${match.played ? '' : match.round === game.round ? 'fixture-next' : 'fixture-upcoming'}`}>
        <span className="fixture-round">K{String(match.round).padStart(2, '0')}</span><span className="fixture-team"><strong className={match.homeId === game.teamId ? 'fixture-own' : ''}>{getTeamName(game, match.homeId)}</strong><small>{dateFormatter.format(getLeagueFixtureDate(game, match))} · {getLeagueKickoffTime(game, match)}</small></span><strong>{match.bye ? '—' : match.played ? `${match.homeGoals} : ${match.awayGoals}` : '— : —'}</strong><span className="fixture-team"><strong className={match.awayId === game.teamId ? 'fixture-own' : ''}>{match.bye ? 'Pauza' : getTeamName(game, match.awayId)}</strong></span>
        <span className={`fixture-state ${match.played ? 'fixture-played' : ''}`}>{match.played ? match.attendance ? `${match.attendance.toLocaleString('pl-PL')} kib.` : 'Rozegrany' : match.round === game.round ? 'Następny' : 'W planie'}</span>
      </div>)}</div>
    </section>
    {(game.preseasonFriendlies?.length ?? 0) > 0 && <section className="panel-card">
      <div className="panel-heading"><div><p className="eyebrow">PRZYGOTOWANIA</p><h2>Sparingi przedsezonowe</h2></div><span className="roster-count">{game.preseasonFriendlies?.filter((match) => match.played).length ?? 0} / {game.preseasonFriendlies?.length} rozegranych</span></div>
      <div className="fixtures-list">{game.preseasonFriendlies?.map((match) => {
        const isNext = nextCompetition === 'friendly' && match.id === nextFriendlyMatch?.id
        const homeName = getTeamName(game, match.homeId)
        const awayName = getTeamName(game, match.awayId)
        const matchDate = match.scheduledAt
          ? dateFormatter.format(parseLocalDateKey(match.scheduledAt))
          : 'Termin do ustalenia'
        return <div key={match.id} className={`fixture-row ${isNext ? 'fixture-next' : ''}`}>
          <span className="fixture-round">S{match.round}</span>
          <span className="fixture-team"><strong className={match.homeId === game.teamId ? 'fixture-own' : ''}>{homeName}</strong><small>{matchDate} · {match.kickoffTime ?? '17:00'}</small></span>
          <strong>{match.played ? `${match.homeGoals ?? 0} : ${match.awayGoals ?? 0}` : '— : —'}</strong>
          <span className="fixture-team"><strong className={match.awayId === game.teamId ? 'fixture-own' : ''}>{awayName}</strong></span>
          <span className={`fixture-state ${match.played ? 'fixture-played' : ''}`}>{match.played ? 'Rozegrany' : isNext ? 'Następny' : 'W planie'}</span>
        </div>
      })}</div>
    </section>}
  </>
}

function PmpLeaguePage({ game, onNavigate }: { game: GameState; onNavigate: (section: Section) => void }) {
  const tournament = game.pmpLeague
  if (!tournament) {
    return <section className="panel-card"><div className="panel-heading"><div><p className="eyebrow">ZIMOWY TURNIEJ</p><h2>Liga PMP jeszcze nie wystartowała</h2></div><Trophy size={20} /></div><p>Losowanie odbędzie się po zakończeniu jesiennej części sezonu. Do turnieju zakwalifikują się kluby A i B klasy z lig, które mają długą przerwę zimową.</p></section>
  }
  const phaseLabels: Record<string, string> = {
    groups: 'Faza grupowa',
    'regional-quarterfinal': 'Ćwierćfinały regionalne',
    'regional-semifinal': 'Półfinały regionalne',
    'regional-final': 'Finały regionalne',
    'national-first-round': 'Ogólnopolska runda wstępna',
    'national-semifinal': 'Półfinały ogólnopolskie',
    'national-final': 'Finał ogólnopolski',
    complete: 'Turniej zakończony',
  }
  const allFixtures = [...tournament.history, ...tournament.matches]
  const phaseFixtures = new Map<string, typeof allFixtures>()
  for (const match of allFixtures) {
    const fixtures = phaseFixtures.get(match.phase) ?? []
    fixtures.push(match)
    phaseFixtures.set(match.phase, fixtures)
  }
  const phaseOrder = Object.keys(phaseLabels)
  const nextMatch = getPmpLeagueNextMatch(game)
  return <section className="panel-card">
    <div className="panel-heading"><div><p className="eyebrow">ZIMOWY TURNIEJ · {tournament.season}</p><h2>Liga PMP</h2><p>{phaseLabels[tournament.phase]} · {tournament.groups.length} grup · {tournament.teams.length} klubów</p></div><Trophy size={20} /></div>
    <div className="notice-banner">Mecze turnieju rozgrywane są co najmniej co 4 dni. Klub otrzymuje wpływy z biletów za mecze u siebie, przychód meczowy oraz premie za zwycięstwa i awanse.</div>
    {tournament.phase === 'groups' && <div className="cup-bracket-rounds">{tournament.groups.map((group) => {
      const standings = group.teamIds.map((teamId) => {
        const row = { teamId, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0 }
        for (const match of allFixtures.filter((fixture) => fixture.phase === 'groups' && fixture.groupId === group.id && fixture.played && !fixture.bye)) {
          if (match.homeId === teamId) {
            row.played += 1
            row.goalsFor += match.homeGoals ?? 0
            row.goalsAgainst += match.awayGoals ?? 0
            if ((match.homeGoals ?? 0) > (match.awayGoals ?? 0)) { row.wins += 1; row.points += 3 }
            else if ((match.homeGoals ?? 0) === (match.awayGoals ?? 0)) { row.draws += 1; row.points += 1 }
            else row.losses += 1
          } else if (match.awayId === teamId) {
            row.played += 1
            row.goalsFor += match.awayGoals ?? 0
            row.goalsAgainst += match.homeGoals ?? 0
            if ((match.awayGoals ?? 0) > (match.homeGoals ?? 0)) { row.wins += 1; row.points += 3 }
            else if ((match.homeGoals ?? 0) === (match.awayGoals ?? 0)) { row.draws += 1; row.points += 1 }
            else row.losses += 1
          }
        }
        return row
      }).sort((first, second) => second.points - first.points
        || (second.goalsFor - second.goalsAgainst) - (first.goalsFor - first.goalsAgainst)
        || second.goalsFor - first.goalsFor)
      return <details className="cup-bracket-round" key={group.id} open>
        <summary><span>{group.regionId.replace('fourth-', '').replaceAll('-', ' ')} · Grupa {group.id.split('-group-')[1]}</span><small>{standings.filter((row) => row.played > 0).length ? 'Tabela na żywo' : 'Terminarz grupy'}</small></summary>
        <div className="league-table-wrap"><table className="league-table"><thead><tr><th>#</th><th>Klub</th><th>M</th><th>Z</th><th>R</th><th>P</th><th>Bramki</th><th>PKT</th></tr></thead><tbody>{standings.map((row, index) => <tr key={row.teamId} className={row.teamId === game.teamId ? 'league-table-own' : ''}><td>{index + 1}</td><td>{getTeamName(game, row.teamId)}</td><td>{row.played}</td><td>{row.wins}</td><td>{row.draws}</td><td>{row.losses}</td><td>{row.goalsFor}:{row.goalsAgainst}</td><td><strong>{row.points}</strong></td></tr>)}</tbody></table></div>
        <div className="cup-bracket-games">{allFixtures.filter((match) => match.phase === 'groups' && match.groupId === group.id).sort((a, b) => (a.round - b.round)).map((match) => <article className="cup-bracket-game" key={match.id}><div><span>{getTeamName(game, match.homeId)}</span><strong>{match.played ? match.homeGoals : '—'}</strong></div><div><span>{getTeamName(game, match.awayId)}</span><strong>{match.played ? match.awayGoals : '—'}</strong></div><small>{match.scheduledAt} · kolejka {match.round}</small></article>)}</div>
      </details>
    })}</div>}
    {phaseOrder.filter((phase) => phaseFixtures.has(phase) && phase !== 'groups').map((phase) => <details className="cup-bracket-round" key={phase} open={phase === tournament.phase || phase === 'complete'}>
      <summary><span>{phaseLabels[phase]}</span><small>{phaseFixtures.get(phase)?.filter((match) => !match.bye).length} meczów</small></summary>
      <div className="cup-bracket-games">{phaseFixtures.get(phase)?.map((match) => <article className="cup-bracket-game" key={match.id}><div><span>{getTeamName(game, match.homeId)}</span><strong>{match.bye ? 'WOLNY LOS' : match.played ? match.homeGoals : '—'}</strong></div>{!match.bye && <div><span>{getTeamName(game, match.awayId)}</span><strong>{match.played ? match.awayGoals : '—'}</strong></div>}<small>{match.scheduledAt}{match.penaltyScore ? ` · karne ${match.penaltyScore}` : ''}</small></article>)}</div>
    </details>)}
    {tournament.regionalChampions && Object.keys(tournament.regionalChampions).length > 0 && <div className="panel-card"><h3>Mistrzowie regionów</h3><div className="cup-bracket-games">{Object.entries(tournament.regionalChampions).map(([regionId, teamId]) => <article className="cup-bracket-game" key={regionId}><strong>{regionId.replace('fourth-', '').replaceAll('-', ' ')}</strong><span>{getTeamName(game, teamId)}</span></article>)}</div></div>}
    {tournament.nationalChampionId && <div className="notice-banner"><strong>Mistrz Ligi PMP:</strong> {getTeamName(game, tournament.nationalChampionId)}</div>}
    {tournament.phase !== 'complete' && <div className="matchday-actions"><button className="primary-button" onClick={() => onNavigate('overview')}><ArrowRight size={16} /> {nextMatch ? 'Przejdź do meczu w Centrum klubu' : 'Przejdź do Centrum klubu'}</button></div>}
  </section>
}

function PolishCupPage({ game, nextCompetition, onNavigate }: { game: GameState; nextCompetition: ReturnType<typeof getNextScheduledCompetition>; onNavigate: (section: Section) => void }) {
  const cup = game.polishCup
  if (!cup) {
    return <section className="panel-card"><h2>Polski Puchar jest niedostępny</h2><p>Wczytaj ponownie zapis kariery, aby odtworzyć rozgrywki pucharowe.</p></section>
  }
  const nextMatch = getPolishCupNextMatch(game)
  const currentFixtures = [
    ...cup.matches.filter((match) => match.homeId === game.teamId || match.awayId === game.teamId),
    ...cup.matches.filter((match) => match.homeId !== game.teamId && match.awayId !== game.teamId),
  ].slice(0, 12)
  const cupFixturesPlayed = cup.history.filter((match) => !match.bye)
  const recentResults = cupFixturesPlayed.slice(-12).reverse()
  const allCupFixtures = [...cup.history, ...cup.matches]
  const clubRoute = allCupFixtures.filter((match) => match.homeId === game.teamId || match.awayId === game.teamId)
  const bracketGroups = [...allCupFixtures.reduce((groups, match) => {
    const groupId = `${match.stage}-${match.round}-${match.poolId ?? 'national'}`
    const group = groups.get(groupId)
    if (group) group.matches.push(match)
    else groups.set(groupId, { stage: match.stage, round: match.round, poolId: match.poolId, matches: [match] })
    return groups
  }, new Map<string, { stage: PolishCupMatch['stage']; round: number; poolId?: string; matches: PolishCupMatch[] }>()).values()]

  function fixtureScore(match: PolishCupMatch) {
    if (!match.played) return '— : —'
    if (match.bye) return 'Awans'
    return `${match.homeGoals} : ${match.awayGoals}${match.penaltyScore ? ` · k. ${match.penaltyScore}` : ''}`
  }

  return <>
    <section className="match-detail-card">
      <div>
        <p className="eyebrow">POLSKI PUCHAR · SEZON {cup.season}</p>
        <h2>{cup.stage === 'complete'
          ? `Zdobywca Pucharu: ${cup.championId ? getTeamName(game, cup.championId) : 'ustalany'}`
          : getPolishCupStageLabel(cup)}
        </h2>
        <p><Trophy size={14} /> Zwycięzcy pucharów regionalnych i kluby lig centralnych walczą o awans do 1/32 finału. Wszystkie kluby Superklasy dołączają w 1/32 finału.</p>
      </div>
      <div className="calendar-next-actions">
        <button className="secondary-button" onClick={() => onNavigate('regional-cup')}>Puchary regionalne <ArrowRight size={15} /></button>
        <button className="primary-button" disabled={cup.stage === 'complete'} onClick={() => onNavigate('overview')}>
          {cup.stage === 'complete'
            ? 'Puchar zakończony'
            : nextMatch
              ? 'Przejdź do meczu w Centrum klubu'
              : 'Przejdź do Centrum klubu'
          }
          <ArrowRight size={15} />
        </button>
      </div>
    </section>
    {cup.stage !== 'complete' && <p className="cup-note cup-schedule-note">{nextCompetition === 'polish-cup'
      ? 'Teraz przypada termin pucharowy. Po rozegraniu rundy terminarz wróci do ligi.'
      : `Najbliższa runda Polskiego Pucharu odbędzie się po kolejce ${cup.scheduledAfterLeagueRound ?? 1}. Do tego czasu rozgrywaj mecze ligowe.`}
    </p>}
    <section className="panel-card">
      <div className="panel-heading"><div><p className="eyebrow">TWOJA DRUŻYNA</p><h2>{nextMatch
        ? `${getTeamName(game, nextMatch.homeId)} vs ${getTeamName(game, nextMatch.awayId)}`
        : cup.stage === 'complete'
          ? 'Turniej dobiegł końca'
          : 'Klub nie gra w tej rundzie'}
      </h2></div><span className="roster-count">{cupFixturesPlayed.length} rozegranych meczów</span></div>
      <p className="cup-note">{nextMatch
        ? `${nextMatch.homeId === game.teamId ? 'Mecz u siebie' : 'Mecz wyjazdowy'}. Wynik remisu rozstrzygną rzuty karne.`
        : cup.stage === 'complete'
          ? 'Nowa edycja Polskiego Pucharu rozpocznie się wraz z kolejnym sezonem.'
          : 'Pozostałe spotkania zostaną rozegrane automatycznie. Symuluj kalendarz, aby przejść do następnego meczu Twojego klubu.'}
      </p>
    </section>
    <section className="panel-card cup-bracket-panel">
      <div className="panel-heading"><div><p className="eyebrow">DRABINKA PUCHARU POLSKI</p><h2>Droga klubu do finału</h2></div><span className="roster-count">{clubRoute.filter((match) => match.played).length} rozegranych rund</span></div>
      {clubRoute.length ? <div className="cup-bracket-track">
        {clubRoute.map((match, index) => {
          const homeWon = match.winnerId === game.teamId
          const roundFixtures = allCupFixtures.filter((fixture) =>
            fixture.stage === match.stage
            && fixture.round === match.round
            && (match.stage !== 'regional' || fixture.poolId === match.poolId),
          )
          const participantCount = roundFixtures.reduce((total, fixture) => total + (fixture.bye ? 1 : 2), 0)
          const stageLabel = getPolishCupMatchStageLabel(match.stage, match.round, participantCount)
          const regionalName = match.stage === 'regional'
            ? leagues.find((league) => league.id === match.poolId)?.name
            : undefined
          return <div className="cup-bracket-step" key={match.id}>
            {index > 0 && <ArrowRight className="cup-bracket-connector" size={17} aria-hidden="true" />}
            <article className={`cup-bracket-match ${match.played ? homeWon ? 'cup-bracket-advanced' : 'cup-bracket-eliminated' : 'cup-bracket-upcoming'}`}>
              <p className="eyebrow">{regionalName ? `${regionalName} · ` : ''}{stageLabel}</p>
              <div className={match.homeId === game.teamId ? 'cup-bracket-team cup-bracket-own' : 'cup-bracket-team'}><span>{getTeamName(game, match.homeId)}</span><strong>{match.played ? match.homeGoals : '—'}</strong></div>
              <div className={match.awayId === game.teamId ? 'cup-bracket-team cup-bracket-own' : 'cup-bracket-team'}><span>{match.bye ? 'Wolny los' : getTeamName(game, match.awayId)}</span><strong>{match.bye ? 'AWANS' : match.played ? match.awayGoals : '—'}</strong></div>
              {match.penaltyScore && <small>Rzuty karne: {match.penaltyScore}</small>}
              <span className="cup-bracket-status">{match.played ? homeWon ? 'Awans do następnej rundy' : 'Koniec udziału' : 'Nadchodzący mecz'}</span>
            </article>
          </div>
        })}
      </div> : <div className="empty-state"><Trophy size={20} /><span>Twój klub dołączy do rozgrywek po zakończeniu rund regionalnych.</span></div>}
    </section>
    <section className="panel-card cup-full-bracket">
      <div className="panel-heading"><div><p className="eyebrow">WYNIKI WSZYSTKICH FAZ</p><h2>Pełna drabinka turnieju</h2></div><span className="roster-count">{allCupFixtures.filter((match) => !match.bye).length} meczów</span></div>
      <p className="cup-note">Rozwiń rundę, aby zobaczyć wszystkie pary. Zwycięzcy są oznaczeni jako awansujący.</p>
      <div className="cup-bracket-rounds">{bracketGroups.map((group) => {
        const participantCount = group.matches.reduce((total, match) => total + (match.bye ? 1 : 2), 0)
        const regionalName = group.poolId ? leagues.find((league) => league.id === group.poolId)?.name : undefined
        const isActiveRound = group.stage === cup.stage && group.round === cup.regionalRound
        const includesClub = group.matches.some((match) => match.homeId === game.teamId || match.awayId === game.teamId)
        return <details className="cup-bracket-round" key={`${group.stage}-${group.round}-${group.poolId ?? 'national'}`} open={isActiveRound && (group.stage !== 'regional' || includesClub)}>
          <summary><span>{regionalName ? `${regionalName} · ` : ''}{getPolishCupMatchStageLabel(group.stage, group.round, participantCount)}</span><small>{group.matches.filter((match) => !match.bye).length} meczów{group.matches.some((match) => match.bye) ? ` · ${group.matches.filter((match) => match.bye).length} wolnych losów` : ''}</small></summary>
          <div className="cup-bracket-games">{group.matches.map((match) => <article className={`cup-bracket-game ${match.winnerId === game.teamId ? 'cup-bracket-game-own-win' : ''}`} key={match.id}>
            <div className={match.winnerId === match.homeId ? 'cup-bracket-game-winner' : ''}><span>{getTeamName(game, match.homeId)}</span><strong>{match.bye ? match.played ? 'AWANS' : '—' : match.played ? match.homeGoals : '—'}</strong></div>
            {!match.bye && <div className={match.winnerId === match.awayId ? 'cup-bracket-game-winner' : ''}><span>{getTeamName(game, match.awayId)}</span><strong>{match.played ? match.awayGoals : '—'}</strong></div>}
            {match.winnerId && <small>{match.bye ? 'Wolny los' : `Awans: ${getTeamName(game, match.winnerId)}`}{match.penaltyScore ? ` · karne ${match.penaltyScore}` : ''}</small>}
          </article>)}</div>
        </details>
      })}</div>
    </section>
    {cup.matches.length > 0 && <section className="panel-card">
      <div className="panel-heading"><div><p className="eyebrow">BIEŻĄCA FAZA</p><h2>Spotkania w rundzie</h2></div><span className="roster-count">{cup.matches.length} meczów i wolnych losów</span></div>
      <div className="fixtures-list">{currentFixtures.map((match) => <div key={match.id} className={`fixture-row ${match.played ? '' : 'fixture-upcoming'}`}>
        <span className="fixture-round">{match.poolId?.replace('fourth-', '').slice(0, 3).toUpperCase() ?? `R${match.round}`}</span>
        <span className={match.homeId === game.teamId ? 'fixture-own' : ''}>{getTeamName(game, match.homeId)}</span>
        <strong>{fixtureScore(match)}</strong>
        <span className={match.awayId === game.teamId ? 'fixture-own' : ''}>{match.bye ? 'Wolny los' : getTeamName(game, match.awayId)}</span>
        <span className="fixture-state">{match.played ? 'Rozstrzygnięty' : 'Oczekuje'}</span>
      </div>)}</div>
      {cup.matches.length > currentFixtures.length && <p className="cup-note">Pokazano {currentFixtures.length} z {cup.matches.length} spotkań tej rundy.</p>}
    </section>}
    {recentResults.length > 0 && <section className="panel-card">
      <div className="panel-heading"><div><p className="eyebrow">ARCHIWUM PUCHARU</p><h2>Ostatnie wyniki</h2></div></div>
      <div className="fixtures-list">{recentResults.map((match) => <div key={match.id} className="fixture-row">
        <span className="fixture-round">R{match.round}</span>
        <span className={match.homeId === game.teamId ? 'fixture-own' : ''}>{getTeamName(game, match.homeId)}</span>
        <strong>{fixtureScore(match)}</strong>
        <span className={match.awayId === game.teamId ? 'fixture-own' : ''}>{match.bye ? 'Wolny los' : getTeamName(game, match.awayId)}</span>
        <span className="fixture-state">{match.winnerId ? `Awans: ${getTeamName(game, match.winnerId)}` : 'Rozegrany'}</span>
      </div>)}</div>
      {cupFixturesPlayed.length > recentResults.length && <p className="cup-note">Widocznych jest 12 z {cupFixturesPlayed.length} rozegranych meczów.</p>}
    </section>}
  </>
}

function RegionalCupPage({ game, onNavigate }: { game: GameState; onNavigate: (section: Section) => void }) {
  const userTeam = game.teams.find((team) => team.id === game.teamId)
    ?? Object.values(game.leagueWorld ?? {}).flat().find((team) => team.id === game.teamId)
  const regionId = userTeam?.regionId ?? getRegionForCity(game.city)
  const cup = game.regionalCups?.find((regionalCup) => regionalCup.regionId === regionId)
  const regionLabel = regionalOptions.find((region) => region.id === regionId)?.name
    .split('·').at(-1)?.trim() ?? regionId ?? 'nieznany region'
  if (!cup) {
    return <section className="panel-card empty-state">
      <Trophy size={20} />
      <span>Nie znaleziono regionalnego pucharu dla regionu prowadzonego klubu.</span>
    </section>
  }

  const allFixtures = [...cup.history, ...cup.matches]
  const clubRoute = allFixtures.filter((match) =>
    match.homeId === game.teamId || match.awayId === game.teamId,
  )
  const upcomingClubMatch = cup.matches.find((match) =>
    !match.played && (match.homeId === game.teamId || match.awayId === game.teamId),
  )
  const currentRound = cup.matches[0]?.round
  const champion = cup.teams.find((team) => team.id === cup.championId)
  const rounds = [...new Set(allFixtures.map((match) => match.round))].sort((first, second) => first - second)
  const pastChampions = Object.entries(game.regionalCupWinners ?? {})
    .flatMap(([season, winnersByRegion]) => {
      const championId = winnersByRegion[cup.regionId]?.[0]
      if (!championId) return []
      const currentName = game.regionalCupWinnerNames?.[season]?.[cup.regionId]
        ?? game.leagueWorld?.[game.leagueId]?.find((team) => team.id === championId)?.name
        ?? Object.values(game.leagueWorld ?? {}).flat().find((team) => team.id === championId)?.name
        ?? game.polishCup?.teams.find((team) => team.id === championId)?.name
        ?? championId
      return [{ season, name: currentName }]
    })
    .sort((first, second) => second.season.localeCompare(first.season))
  const score = (match: PolishCupMatch) => match.bye
    ? 'Wolny los'
    : match.played
      ? `${match.homeGoals ?? 0} : ${match.awayGoals ?? 0}${match.penaltyScore ? ` · k. ${match.penaltyScore}` : ''}`
      : '— : —'

  return <>
    <section className="match-detail-card">
      <div>
        <p className="eyebrow">PUCHAR REGIONALNY · SEZON {cup.season}</p>
        <h2>{champion ? `Zdobywca pucharu: ${champion.name}` : `Puchar Polski · ${regionLabel}`}</h2>
        <p><Trophy size={14} /> W rozgrywkach uczestniczą kluby z regionu od III ligi i niższych poziomów. Zwycięzca uzyskuje kwalifikację do kolejnej edycji centralnego Polskiego Pucharu.</p>
      </div>
      <button className="secondary-button" onClick={() => onNavigate('cup')}>Polski Puchar <ArrowRight size={15} /></button>
    </section>
    <section className="panel-card">
      <div className="panel-heading">
        <div><p className="eyebrow">TWOJA DRUŻYNA</p><h2>{upcomingClubMatch
          ? `${getTeamName(game, upcomingClubMatch.homeId)} vs ${getTeamName(game, upcomingClubMatch.awayId)}`
          : champion
            ? 'Turniej dobiegł końca'
            : clubRoute.length
              ? 'Oczekiwanie na kolejny mecz'
              : 'Klub nie uczestniczy w tej edycji'}
        </h2></div>
        <span className="roster-count">{clubRoute.filter((match) => match.played && !match.bye).length} rozegranych meczów</span>
      </div>
      <p className="cup-note">{upcomingClubMatch
        ? `Runda ${upcomingClubMatch.round} · ${upcomingClubMatch.homeId === game.teamId ? 'mecz u siebie' : 'mecz wyjazdowy'}.`
        : champion
          ? `${champion.name} reprezentuje region w kolejnej edycji Polskiego Pucharu.`
          : clubRoute.length
            ? 'Twój klub awansował do następnej rundy; kolejne pary zostaną ustalone po jej skompletowaniu.'
            : 'Zespoły z regionu rozgrywają puchar równolegle z ligą. Sprawdź terminarz regionu poniżej.'}
      </p>
      {upcomingClubMatch && <button className="primary-button" onClick={() => onNavigate('overview')}>
        Przejdź do meczu w Centrum klubu <ArrowRight size={15} />
      </button>}
    </section>
    {pastChampions.length > 0 && <section className="panel-card">
      <div className="panel-heading"><div><p className="eyebrow">ARCHIWUM PUCHARU</p><h2>Mistrzowie regionu</h2></div><span className="roster-count">{pastChampions.length} sezonów</span></div>
      <div className="fixtures-list">{pastChampions.map(({ season, name }) => <div className="fixture-row" key={season}>
        <span className="fixture-round">{season}</span>
        <span>{name}</span>
        <strong>Zdobywca pucharu</strong>
      </div>)}</div>
    </section>}
    {cup.matches.length > 0 && <section className="panel-card">
      <div className="panel-heading"><div><p className="eyebrow">BIEŻĄCA FAZA</p><h2>Runda {currentRound}</h2></div><span className="roster-count">{cup.matches.filter((match) => !match.bye).length} spotkań</span></div>
      <div className="fixtures-list">{cup.matches.map((match) => <div key={match.id} className={`fixture-row ${match.played ? '' : 'fixture-upcoming'}`}>
        <span className="fixture-round">R{match.round}</span>
        <span className={match.homeId === game.teamId ? 'fixture-own' : ''}>{getTeamName(game, match.homeId)}</span>
        <strong>{score(match)}</strong>
        <span className={match.awayId === game.teamId ? 'fixture-own' : ''}>{match.bye ? 'Wolny los' : getTeamName(game, match.awayId)}</span>
        <span className="fixture-state">{match.played ? match.winnerId ? `Awans: ${getTeamName(game, match.winnerId)}` : 'Rozstrzygnięty' : match.scheduledAt ?? 'Termin do ustalenia'}</span>
      </div>)}</div>
    </section>}
    <section className="panel-card cup-bracket-panel">
      <div className="panel-heading"><div><p className="eyebrow">DRABINKA REGIONALNA</p><h2>Droga do finału</h2></div><span className="roster-count">{clubRoute.filter((match) => match.played).length} rozegranych rund</span></div>
      {clubRoute.length > 0 && <div className="cup-bracket-track">{clubRoute.map((match, index) => <div className="cup-bracket-step" key={match.id}>
        {index > 0 && <ArrowRight className="cup-bracket-connector" size={17} aria-hidden="true" />}
        <article className={`cup-bracket-match ${match.played ? match.winnerId === game.teamId ? 'cup-bracket-advanced' : 'cup-bracket-eliminated' : 'cup-bracket-upcoming'}`}>
          <p className="eyebrow">Runda {match.round}</p>
          <div className={match.homeId === game.teamId ? 'cup-bracket-team cup-bracket-own' : 'cup-bracket-team'}><span>{getTeamName(game, match.homeId)}</span><strong>{match.played ? match.homeGoals : '—'}</strong></div>
          {!match.bye && <div className={match.awayId === game.teamId ? 'cup-bracket-team cup-bracket-own' : 'cup-bracket-team'}><span>{getTeamName(game, match.awayId)}</span><strong>{match.played ? match.awayGoals : '—'}</strong></div>}
          <small>{match.bye ? 'Wolny los' : match.scheduledAt ?? 'Termin do ustalenia'}{match.penaltyScore ? ` · karne ${match.penaltyScore}` : ''}</small>
        </article>
      </div>)}</div>}
      {rounds.length > 0 && <div className="cup-bracket-rounds">{rounds.map((round) => {
        const fixtures = allFixtures.filter((match) => match.round === round)
        return <details className="cup-bracket-round" key={round} open={round === currentRound || round === rounds.at(-1)}>
          <summary><span>Runda {round}</span><small>{fixtures.filter((match) => !match.bye).length} meczów</small></summary>
          <div className="cup-bracket-games">{fixtures.map((match) => <article className="cup-bracket-game" key={match.id}>
            <div><span>{getTeamName(game, match.homeId)}</span><strong>{score(match)}</strong></div>
            {!match.bye && <div><span>{getTeamName(game, match.awayId)}</span></div>}
            <small>{match.scheduledAt ?? 'Termin do ustalenia'}{match.winnerId ? ` · awans: ${getTeamName(game, match.winnerId)}` : ''}</small>
          </article>)}</div>
        </details>
      })}</div>}
      {allFixtures.length === 0 && <p className="cup-note">Drabinka zostanie opublikowana przed rozpoczęciem rozgrywek.</p>}
    </section>
  </>
}

function TransfersPage(props: {
  game: GameState
  search: string
  positionFilter: Position | 'all'
  setSearch: (value: string) => void
  setPositionFilter: (value: Position | 'all') => void
  onUpdate: (game: GameState, message?: string) => void
  onOpenProfile: (player: Player, clubName: string) => void
}) {
  const [selectedTier, setSelectedTier] = useState<LeagueTier>(getLeagueTier(props.game.leagueId))
  const [selectedGroupId, setSelectedGroupId] = useState<string>(props.game.leagueId)
  const [selectedClubId, setSelectedClubId] = useState('')
  const [marketSort, setMarketSort] = useState<'skill' | 'potential' | 'value' | 'age'>('skill')
  const transferWindow = getTransferWindowInfo(props.game)
  const activeNegotiations = props.game.transferNegotiations.filter((item) => item.status === 'countered')
  const [clubOfferInputs, setClubOfferInputs] = useState<Record<string, string>>({})
  const [clubOfferErrors, setClubOfferErrors] = useState<Record<string, string>>({})
  const [counterOfferInputs, setCounterOfferInputs] = useState<Record<string, string>>({})
  const [outgoingLoanPlayerId, setOutgoingLoanPlayerId] = useState('')
  const [outgoingLoanClubId, setOutgoingLoanClubId] = useState('')
  const matchesPlayerFilters = (player: Player) => {
    const fullName = `${player.firstName} ${player.lastName}`.toLocaleLowerCase('pl')
    return (!props.search || fullName.includes(props.search.toLocaleLowerCase('pl')))
      && (props.positionFilter === 'all'
        || player.position === props.positionFilter
        || player.secondaryPositions?.includes(props.positionFilter))
  }
  const compareMarketPlayers = (first: Player, second: Player) => {
    const difference = marketSort === 'potential'
      ? second.potential - first.potential
      : marketSort === 'value'
        ? first.value - second.value
        : marketSort === 'age'
          ? first.age - second.age
          : second.skill - first.skill
    return difference || first.lastName.localeCompare(second.lastName, 'pl')
  }
  const filtered = props.game.market.filter(matchesPlayerFilters).sort(compareMarketPlayers)
  const marketGroups = getTransferMarketGroups(props.game, selectedTier)
  const activeGroupId = marketGroups.some((group) => group.id === selectedGroupId)
    ? selectedGroupId
    : marketGroups[0]?.id ?? ''
  const marketTeams = getTransferMarketTeams(props.game, activeGroupId)
  const activeClubId = marketTeams.some((team) => team.id === selectedClubId)
    ? selectedClubId
    : marketTeams[0]?.id ?? ''
  const selectedClub = marketTeams.find((team) => team.id === activeClubId)
  const clubOffers = (props.game.clubSquads[activeClubId] ?? [])
    .filter(({ player }) => matchesPlayerFilters(player))
    .sort((first, second) => compareMarketPlayers(first.player, second.player))
  function selectMarketTier(tier: LeagueTier) {
    setSelectedTier(tier)
    const groups = getTransferMarketGroups(props.game, tier)
    const nextGroupId = groups[0]?.id ?? ''
    setSelectedGroupId(nextGroupId)
    const teams = getTransferMarketTeams(props.game, nextGroupId)
    setSelectedClubId(teams[0]?.id ?? '')
    if (nextGroupId) {
      const result = prepareTransferMarketLeague(props.game, nextGroupId)
      if (result.error) return props.onUpdate(props.game, result.error)
      if (result.game !== props.game) props.onUpdate(result.game)
    }
  }
  function selectMarketGroup(leagueId: string) {
    setSelectedGroupId(leagueId)
    const teams = getTransferMarketTeams(props.game, leagueId)
    setSelectedClubId(teams[0]?.id ?? '')
    const result = prepareTransferMarketLeague(props.game, leagueId)
    if (result.error) return props.onUpdate(props.game, result.error)
    if (result.game !== props.game) props.onUpdate(result.game)
  }
  function sign(player: Player) {
    const result = signPlayer(props.game, player.id)
    if (result.error) return props.onUpdate(props.game, result.error)
    props.onUpdate(result.game, `Podpisano kontrakt z ${player.firstName} ${player.lastName}.`)
  }
  function borrowPlayer(playerId: string) {
    const result = loanPlayerIn(props.game, activeClubId, playerId)
    if (result.error) return props.onUpdate(props.game, result.error)
    const player = props.game.clubSquads[activeClubId]?.find((offer) => offer.player.id === playerId)?.player
    props.onUpdate(result.game, `${player ? `${player.firstName} ${player.lastName}` : 'Zawodnik'} dołączył na wypożyczenie do końca sezonu.`)
  }
  function sendPlayerOnLoan() {
    const targetClubId = marketTeams.some((team) => team.id === outgoingLoanClubId) ? outgoingLoanClubId : activeClubId
    if (!outgoingLoanPlayerId || !targetClubId) return
    const player = props.game.squad.find((candidate) => candidate.id === outgoingLoanPlayerId)
    const result = loanPlayerOut(props.game, outgoingLoanPlayerId, targetClubId)
    if (result.error) return props.onUpdate(props.game, result.error)
    props.onUpdate(result.game, `${player ? `${player.firstName} ${player.lastName}` : 'Zawodnik'} został wypożyczony do ${getTeamName(props.game, targetClubId)} do końca sezonu.`)
  }
  function makeClubOffer(playerId: string) {
    const selectedOffer = props.game.clubSquads[activeClubId]?.find((offer) => offer.player.id === playerId)
    const defaultAmount = selectedOffer?.askingPrice
    const amount = Number(clubOfferInputs[playerId] ?? defaultAmount ?? '')
    const result = proposeClubTransfer(props.game, activeClubId, playerId, amount)
    if (result.error) {
      setClubOfferErrors((current) => ({ ...current, [playerId]: result.error === 'Budżet klubu nie wystarcza na taką ofertę.'
        ? 'Za mało środków na ten transfer.'
        : result.error }))
      return
    }
    setClubOfferErrors((current) => {
      const next = { ...current }
      delete next[playerId]
      return next
    })
    const playerName = selectedOffer ? `${selectedOffer.player.firstName} ${selectedOffer.player.lastName}` : 'Zawodnik'
    const response = 'message' in result
      ? `${result.message} Odpowiedź zapisana w skrzynce e-mail.`
      : `Klub zaakceptował ofertę za ${playerName}. Transfer został sfinalizowany. Wiadomość znajdziesz w skrzynce e-mail.`
    props.onUpdate(result.game, response)
  }
  function makeCounterOffer(negotiationId: string) {
    const amount = Number(counterOfferInputs[negotiationId])
    const result = respondToClubTransferCounteroffer(props.game, negotiationId, amount)
    if (result.error) return props.onUpdate(props.game, result.error)
    props.onUpdate(result.game, 'message' in result ? result.message : 'Klub zaakceptował kontrpropozycję.')
  }
  function acceptCounter(negotiationId: string) {
    const result = acceptClubTransferCounteroffer(props.game, negotiationId)
    if (result.error) return props.onUpdate(props.game, result.error)
    props.onUpdate(result.game, 'Zaakceptowano kontrofertę. Zawodnik dołącza do klubu.')
  }
  function rejectCounter(negotiationId: string) {
    const result = rejectClubTransferCounteroffer(props.game, negotiationId)
    if (result.error) return props.onUpdate(props.game, result.error)
    props.onUpdate(result.game, 'Odrzucono kontrofertę klubu.')
  }
  return <>
    <section className="market-banner"><div className="market-banner-icon"><ShoppingBag size={21} /></div><div><p className="eyebrow">OKNO TRANSFEROWE</p><h2>Znajdź brakujący element</h2><p>Wyceny i umiejętności są generowane przez grę — nie pochodzą z zewnętrznych baz danych.</p></div><div className="market-budget"><small>BUDŻET TRANSFEROWY</small><strong>{formatMoney(props.game.cash)}</strong></div></section>
    <section className={transferWindow.isOpen ? 'transfer-window-status transfer-window-open' : 'transfer-window-status'}>
      <span className="transfer-window-status-icon"><CalendarDays size={17} /></span>
      <div><strong>{transferWindow.currentWindow ? `Otwarte okno ${transferWindow.currentWindow.name}` : 'Okno transferowe zamknięte'}</strong>
        <p>{transferWindow.currentWindow
          ? transferWindow.isPreseason
            ? `Letnie okno przedsezonowe jest otwarte. Transfery można finalizować przed startem rozgrywek oraz w kolejkach 1–${transferWindow.currentWindow.closeRound}.`
            : `Transfery można finalizować do końca kolejki ${transferWindow.currentWindow.closeRound}.`
          : transferWindow.nextWindow
            ? `Najbliższe: okno ${transferWindow.nextWindow.name}, kolejki ${transferWindow.nextWindow.openRound}–${transferWindow.nextWindow.closeRound}.`
            : 'Najbliższe okno letnie otworzy się wraz z rozpoczęciem nowego sezonu.'}
          {transferWindow.currentWindow && !transferWindow.isPreseason && props.game.round >= transferWindow.currentWindow.closeRound - 1 ? ' To ostatnia kolejka okna — sfinalizuj transfery przed jego zamknięciem.' : ''}
        </p>
      </div>
      <span className="transfer-window-round">{transferWindow.currentWindow ? transferWindow.isPreseason ? 'PRZED SEZONEM' : `KOLEJKA ${props.game.round} / ${transferWindow.currentWindow.closeRound}` : 'POZA OKNEM'}</span>
    </section>
    {!transferWindow.isOpen && <p className="transfer-window-notice"><TriangleAlert size={14} /> Poza oknem nie można składać nowych ofert ani finalizować transferów. Aktywne kontroferty pozostają dostępne do następnego okna.</p>}
    <section className="panel-card club-market-panel">
      <div className="panel-heading"><div><p className="eyebrow">WYSZUKIWARKA TRANSFEROWA</p><h2>Znajdź zawodnika w dowolnej lidze</h2></div><span className="roster-count">{clubOffers.length} dostępnych</span></div>
      <p className="club-market-intro">Wybierz poziom rozgrywek, a następnie grupę lub województwo. Złóż ofertę wybranemu klubowi — może ją zaakceptować, odrzucić lub przedstawić kontrofertę.</p>
      {activeNegotiations.length > 0 && <p className="active-negotiations-count">{activeNegotiations.length} {activeNegotiations.length === 1 ? 'aktywna kontroferta' : activeNegotiations.length < 5 ? 'aktywne kontroferty' : 'aktywnych kontrofert'}{transferWindow.isOpen ? ' — można je zaakceptować lub negocjować.' : ' — decyzję można podjąć podczas kolejnego okna.'}</p>}
      <div className="transfer-market-selectors">
        <label className="club-market-select"><Shield size={15} /><span>Liga</span><select aria-label="Wybierz poziom ligi" value={selectedTier} onChange={(event) => selectMarketTier(Number(event.target.value) as LeagueTier)}>{transferMarketTiers.map((tier) => <option key={tier.tier} value={tier.tier}>{tier.name}</option>)}</select><ChevronDown size={13} /></label>
        {marketGroups.length > 1 && <label className="club-market-select"><MapPin size={15} /><span>Grupa / województwo</span><select aria-label="Wybierz grupę lub województwo" value={activeGroupId} onChange={(event) => selectMarketGroup(event.target.value)}>{marketGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select><ChevronDown size={13} /></label>}
        <label className="club-market-select"><UsersRound size={15} /><span>Klub</span><select aria-label="Wybierz klub" value={activeClubId} onChange={(event) => setSelectedClubId(event.target.value)}>{marketTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select><ChevronDown size={13} /></label>
      </div>
      <div className="market-toolbar"><label className="search-input"><Search size={16} /><input value={props.search} onChange={(event) => props.setSearch(event.target.value)} placeholder="Szukaj zawodnika..." /><kbd>⌘ K</kbd></label><label className="market-position"><SlidersHorizontal size={14} /><select value={props.positionFilter} onChange={(event) => props.setPositionFilter(event.target.value as Position | 'all')}><option value="all">Wszystkie pozycje</option>{Object.entries(positionLabels).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select><ChevronDown size={13} /></label><label className="market-position market-sort"><span>Sortuj</span><select value={marketSort} onChange={(event) => setMarketSort(event.target.value as typeof marketSort)}><option value="skill">Umiejętności</option><option value="potential">Potencjał</option><option value="value">Najniższa wycena</option><option value="age">Wiek</option></select><ChevronDown size={13} /></label></div>
      {props.game.transferNegotiations.filter((item) => item.status === 'countered').map((negotiation) => {
        const player = props.game.clubSquads[negotiation.clubId]?.find((offer) => offer.player.id === negotiation.playerId)?.player
        if (!player) return null
        return <div className="club-counteroffer" key={negotiation.id}>
          <div><p className="eyebrow">KONTROFERTA · {getTeamName(props.game, negotiation.clubId)}</p><strong><PlayerName player={player} /></strong><span>Klub żąda: <b>{formatMoney(negotiation.counterAmount ?? 0)}</b> · Twoja poprzednia oferta: {formatMoney(negotiation.offeredAmount)}</span></div>
          <div className="club-counter-actions"><button disabled={!transferWindow.isOpen || props.game.cash < (negotiation.counterAmount ?? 0) || props.game.squad.length >= 30} onClick={() => acceptCounter(negotiation.id)}>Akceptuj</button><label><span>Kontroferta</span><input disabled={!transferWindow.isOpen} type="number" min={negotiation.offeredAmount + 1000} max={(negotiation.counterAmount ?? 1000) - 1000} step="1000" value={counterOfferInputs[negotiation.id] ?? String(Math.round(((negotiation.offeredAmount + (negotiation.counterAmount ?? 0)) / 2) / 1000) * 1000)} onChange={(event) => setCounterOfferInputs((current) => ({ ...current, [negotiation.id]: event.target.value }))} /></label><button disabled={!transferWindow.isOpen || props.game.squad.length >= 30} onClick={() => makeCounterOffer(negotiation.id)}>Zaproponuj</button><button onClick={() => rejectCounter(negotiation.id)}>Odrzuć</button></div>
        </div>
      })}
      {selectedClub && <div className="market-grid club-market-grid">{clubOffers.map(({ player, askingPrice }) => <article className="market-card" key={player.id}>
        <div className="market-player-heading"><PlayerPortrait player={player} className="player-avatar-market" /><PlayerPositionBadges player={player} /><span className="market-player-name"><button type="button" className="player-profile-link" onClick={() => props.onOpenProfile(player, selectedClub?.name ?? 'Klub')}><PlayerName player={player} /></button><small>{player.age} lat · {positionLabels[player.position]}</small></span><span className="market-player-rating">{player.skill}</span></div>
        <div className="market-skill-row"><Stars skill={player.skill} /><span>Potencjał <strong>{player.potential}</strong></span></div>
        <div className="market-card-stats"><span><small>CENA KLUBU</small><strong>{formatMoney(askingPrice)}</strong></span><span><small>PŁACA / TYG.</small><strong>{formatMoney(player.wage)}</strong></span></div>
        <label className="club-offer-input"><span>Twoja oferta</span><input type="number" min="1000" step="1000" value={clubOfferInputs[player.id] ?? String(askingPrice)} onChange={(event) => {
          setClubOfferInputs((current) => ({ ...current, [player.id]: event.target.value }))
          setClubOfferErrors((current) => {
            if (!current[player.id]) return current
            const next = { ...current }
            delete next[player.id]
            return next
          })
        }} /><span>zł</span></label>
        <button className="sign-player-button" disabled={!transferWindow.isOpen || props.game.squad.length >= 30} onClick={() => makeClubOffer(player.id)}><span>{transferWindow.isOpen ? 'Złóż ofertę klubowi' : 'Poza oknem transferowym'}</span><ArrowRight size={15} /></button>
        <button className="loan-player-button" disabled={!transferWindow.isOpen || props.game.squad.length >= 30 || props.game.cash < Math.max(5_000, Math.round(player.value * 0.05 / 1000) * 1000)} onClick={() => borrowPlayer(player.id)}>Wypożycz · {formatMoney(Math.max(5_000, Math.round(player.value * 0.05 / 1000) * 1000))}</button>
        {clubOfferErrors[player.id] && <p className="club-offer-error" role="alert">{clubOfferErrors[player.id]}</p>}
      </article>)}
      {clubOffers.length === 0 && <div className="empty-state empty-state-large"><Search size={22} /><span>Brak zawodników spełniających kryteria w tym klubie.</span></div>}</div>}
    </section>
    <section className="panel-card free-agent-market">
      <div className="panel-heading"><div><p className="eyebrow">ZAWODNICY BEZ KLUBU</p><h2>Wolni zawodnicy</h2></div><span className="roster-count">{filtered.length} dostępnych</span></div>
      <p className="club-market-intro">Zawodnicy bez obecnego klubu mogą dołączyć bez negocjacji transferowych.</p>
      <div className="market-grid">{filtered.map((player) => <article className="market-card" key={player.id}><div className="market-player-heading"><PlayerPortrait player={player} className="player-avatar-market" /><PositionBadge position={player.position} /><span className="market-player-name"><button type="button" className="player-profile-link" onClick={() => props.onOpenProfile(player, 'Wolny zawodnik')}><PlayerName player={player} /></button><small>{player.age} lat · {positionLabels[player.position]}</small></span><span className="market-player-rating">{player.skill}</span></div><div className="market-skill-row"><Stars skill={player.skill} /><span>Potencjał <strong>{player.potential}</strong></span></div><div className="market-card-stats"><span><small>WYCENA</small><strong>{valueLabel(player.value)}</strong></span><span><small>PŁACA / TYG.</small><strong>{formatMoney(player.wage)}</strong></span></div><button className="sign-player-button" disabled={!transferWindow.isOpen || props.game.cash < player.value || props.game.squad.length >= 30} onClick={() => sign(player)}><span>{transferWindow.isOpen ? 'Pozyskaj zawodnika' : 'Poza oknem transferowym'}</span><ArrowRight size={15} /></button></article>)}
      {filtered.length === 0 && <div className="empty-state empty-state-large"><Search size={22} /><span>Nie znaleziono wolnych zawodników spełniających kryteria.</span></div>}</div>
    </section>
    <section className="panel-card loan-management-panel">
      <div className="panel-heading"><div><p className="eyebrow">RUCHY KADROWE</p><h2>Wypożyczenia</h2></div><span className="roster-count">{props.game.loanDeals?.length ?? 0} aktywne</span></div>
      <p className="club-market-intro">Wypożyczenie obowiązuje do końca sezonu. Zawodnik wróci automatycznie po rozliczeniu sezonu. Przy wypożyczeniu do klubu opłata wynosi 5% wartości piłkarza.</p>
      <div className="loan-outgoing-controls">
        <label><span>Zawodnik z kadry</span><select aria-label="Wybierz zawodnika do wypożyczenia" value={outgoingLoanPlayerId} onChange={(event) => setOutgoingLoanPlayerId(event.target.value)}>
          <option value="">Wybierz zawodnika</option>
          {props.game.squad.filter((player) => !props.game.loanDeals?.some((deal) => deal.player.id === player.id)).map((player) => <option key={player.id} value={player.id}>{player.firstName} {player.lastName} · {positionLabels[player.position]}</option>)}
        </select></label>
        <label><span>Klub docelowy</span><select aria-label="Wybierz klub docelowy wypożyczenia" value={marketTeams.some((team) => team.id === outgoingLoanClubId) ? outgoingLoanClubId : activeClubId} onChange={(event) => setOutgoingLoanClubId(event.target.value)}>
          {marketTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
        </select></label>
        <button type="button" className="primary-button" disabled={!transferWindow.isOpen || props.game.squad.length <= 11 || !outgoingLoanPlayerId || !(outgoingLoanClubId || activeClubId)} onClick={sendPlayerOnLoan}>{transferWindow.isOpen ? 'Wypożycz zawodnika' : 'Poza oknem transferowym'} <ArrowRight size={14} /></button>
      </div>
      {(props.game.loanDeals?.length ?? 0) > 0 && <div className="active-loan-list">{props.game.loanDeals?.map((deal) => <div key={deal.id}>
        <strong>{deal.player.firstName} {deal.player.lastName}</strong>
        <span>{deal.direction === 'in' ? `Wypożyczony z ${getTeamName(props.game, deal.parentClubId)}` : `Wypożyczony do ${getTeamName(props.game, deal.destinationClubId)}`} · do końca sezonu</span>
      </div>)}</div>}
    </section>
    <p className="market-disclaimer"><Sparkles size={14} /> Wartości rynkowe są autorskimi szacunkami gry na podstawie umiejętności, wieku i potencjału.</p>
  </>
}

function MailboxPage({ game, onUpdate, onNavigate, onNavigateToSponsorOffers, autoOpenMessageId }: {
  game: GameState
  onUpdate: (game: GameState, message?: string) => void
  onNavigate: (section: Section) => void
  onNavigateToSponsorOffers: () => void
  autoOpenMessageId: string | null
}) {
  const messages = game.inboxMessages ?? []
  const initialAutoOpenMessage = autoOpenMessageId
    ? messages.find((message) => message.id === autoOpenMessageId) ?? null
    : null
  const initialAutoOpenOffer = initialAutoOpenMessage?.relatedTransferOfferId
    ? game.incomingTransferOffers?.find((offer) => offer.id === initialAutoOpenMessage.relatedTransferOfferId)
    : undefined
  const initialAutoOpenPlayer = initialAutoOpenOffer
    ? game.squad.find((player) => player.id === initialAutoOpenOffer.playerId)
    : undefined
  const [selectedMessage, setSelectedMessage] = useState<InboxMessage | null>(initialAutoOpenMessage)
  const [incomingOfferCounterAmount, setIncomingOfferCounterAmount] = useState(
    initialAutoOpenPlayer ? String(Math.round(initialAutoOpenPlayer.value * 1.15 / 1000) * 1000) : '',
  )
  const [incomingContractWage, setIncomingContractWage] = useState(
    initialAutoOpenOffer?.playerWageDemand ? String(initialAutoOpenOffer.playerWageDemand) : '',
  )
  const [incomingContractSeasons, setIncomingContractSeasons] = useState(
    String(initialAutoOpenOffer?.playerContractSeasons ?? 3),
  )
  const selectedIncomingOffer = selectedMessage?.relatedTransferOfferId
    ? game.incomingTransferOffers?.find((offer) => offer.id === selectedMessage.relatedTransferOfferId)
    : undefined
  const comparedIncomingOffers = selectedIncomingOffer
    ? (game.incomingTransferOffers ?? [])
      .filter((offer) =>
        offer.playerId === selectedIncomingOffer.playerId
        && ['pending', 'countered', 'player-negotiation'].includes(offer.status),
      )
      .sort((first, second) => second.offeredAmount - first.offeredAmount)
    : []
  const getIncomingOfferRoundsLeft = (offer: NonNullable<GameState['incomingTransferOffers']>[number]) =>
    Math.max(0, (offer.expiresAfterRound ?? offer.createdRound + 2) - game.round + 1)
  const isSponsorRenewalNotice = (message: InboxMessage) =>
    message.category === 'club' && message.subject === 'Umowa sponsorska wkrótce dobiegnie końca'
  const getRejectedSponsorOffer = (message: InboxMessage) => {
    if (message.status !== 'rejected' || message.category !== 'club' || message.subject !== 'Sponsor odrzucił kontrofertę') return undefined
    return message.relatedSponsorOfferId
      ? game.commercialOffers.sponsors.find((offer) => offer.id === message.relatedSponsorOfferId)
      : game.commercialOffers.sponsors.find((offer) => offer.company === message.sender)
  }
  const getMessageSponsorBrand = (message: InboxMessage) => {
    const offer = (message.relatedSponsorOfferId
      ? game.commercialOffers.sponsors.find((item) => item.id === message.relatedSponsorOfferId)
      : undefined)
      ?? game.commercialOffers.sponsors.find((item) => item.company === message.sender)
    if (offer) return getCommercialBrand('sponsor', offer.id, offer.company)
    if (game.sponsorDeal?.company === message.sender) {
      return getCommercialBrand('sponsor', game.sponsorDeal.id, game.sponsorDeal.company)
    }
    return Object.values(sponsorBrandDetails).find((brand) => brand.name === message.sender)
  }
  const selectedSponsorOffer = selectedMessage ? getRejectedSponsorOffer(selectedMessage) : undefined
  const selectedSponsorBrand = selectedMessage ? getMessageSponsorBrand(selectedMessage) : undefined
  const canAcceptSponsorOffer = Boolean(selectedSponsorOffer && !game.sponsorDeal)
  const selectedMessageAction = selectedMessage
    ? selectedMessage.action === 'club'
      ? 'club'
      : selectedMessage.action === 'tactics'
      || ['Czerwona kartka:', 'Pauza za żółte kartki:', 'Kontuzja:', 'Gotowy do gry:']
        .some((subjectPrefix) => selectedMessage.subject.startsWith(subjectPrefix))
      ? 'tactics'
      : selectedMessage.action
    : undefined
  const getCupGroups = (message: InboxMessage) => {
    const cupEmail = message.polishCupDraw ?? message.polishCupResults
    if (!cupEmail) return []
    const poolIds = cupEmail.fixtures.flatMap((fixture) => fixture.poolId ? [fixture.poolId] : [])
    return cupEmail.groups?.length
      ? cupEmail.groups
      : [...new Set(poolIds)].map((poolId) => regionalOptions.find((region) => region.id === poolId)?.name ?? poolId)
  }

  const openMessage = (message: InboxMessage) => {
    setSelectedMessage(message)
    const incomingOffer = message.relatedTransferOfferId
      ? game.incomingTransferOffers?.find((offer) => offer.id === message.relatedTransferOfferId)
      : undefined
    const player = incomingOffer ? game.squad.find((item) => item.id === incomingOffer.playerId) : undefined
    setIncomingOfferCounterAmount(player ? String(Math.round(player.value * 1.15 / 1000) * 1000) : '')
    setIncomingContractWage(incomingOffer?.playerWageDemand ? String(incomingOffer.playerWageDemand) : '')
    setIncomingContractSeasons(String(incomingOffer?.playerContractSeasons ?? 3))
    if (message.read) return
    const next = structuredClone(game)
    next.inboxMessages = (next.inboxMessages ?? []).map((item) =>
      item.id === message.id ? { ...item, read: true } : item,
    )
    onUpdate(next)
  }

  const closeMessage = useCallback(() => {
    setSelectedMessage(null)
    onNavigate('overview')
  }, [onNavigate])

  const respondToIncomingOffer = (response:
    | 'accept'
    | 'reject'
    | 'promise-stay'
    | 'counter'
    | 'accept-player-terms'
    | 'counter-player-terms'
    | 'reject-player-terms') => {
    if (!selectedIncomingOffer) return
    const result = respondToIncomingTransferOffer(
      game,
      selectedIncomingOffer.id,
      response,
      response === 'counter' ? Number(incomingOfferCounterAmount) : undefined,
      response === 'counter-player-terms' ? Number(incomingContractWage) : undefined,
      response === 'counter-player-terms' ? Number(incomingContractSeasons) : undefined,
    )
    if (result.error) {
      onUpdate(game, result.error)
      return
    }
    const updatedMessage = result.game.inboxMessages?.find((message) => message.id === selectedMessage?.id)
    const updatedOffer = result.game.incomingTransferOffers?.find((offer) => offer.id === selectedIncomingOffer.id)
    if (response === 'accept' || response === 'counter' || response === 'counter-player-terms') {
      setIncomingContractWage(updatedOffer?.playerWageDemand ? String(updatedOffer.playerWageDemand) : '')
      setIncomingContractSeasons(String(updatedOffer?.playerContractSeasons ?? 3))
    }
    setSelectedMessage(updatedMessage ?? null)
    onUpdate(result.game, response === 'accept'
      ? 'Zaakceptowano ofertę transferową.'
      : response === 'counter'
        ? 'Wysłano kontrofertę do klubu.'
        : response === 'promise-stay'
          ? 'Odrzucono ofertę i obiecano zawodnikowi pozostanie w klubie.'
            : response === 'accept-player-terms'
              ? 'Zaakceptowano warunki kontraktu zawodnika i sfinalizowano transfer.'
              : response === 'reject-player-terms'
                ? 'Wycofano zgodę na transfer.'
                  : response === 'counter-player-terms'
                    ? 'Wysłano kontrofertę kontraktu. Zawodnik odpowiedział na propozycję.'
                    : 'Odrzucono ofertę transferową.')
  }

  const openSponsorFinances = () => {
    setSelectedMessage(null)
    onNavigateToSponsorOffers()
  }

  const acceptOriginalSponsorOffer = () => {
    if (!selectedSponsorOffer) return
    const result = signCommercialDeal(game, 'sponsor', selectedSponsorOffer.id)
    if (result.error) {
      onUpdate(game, result.error)
      return
    }
    const deal = result.game.sponsorDeal
    setSelectedMessage(null)
    onUpdate(result.game, `Podpisano umowę z ${selectedSponsorOffer.company} na ${deal?.duration ?? getSeasonRoundCount(game)} kolejek. Premia ${formatMoney(deal?.signingBonus ?? 0)} trafiła do budżetu.`)
    onNavigateToSponsorOffers()
  }

  const chooseSeasonEventOption = (choiceId: string) => {
    if (!selectedMessage?.seasonEvent) return
    const result = resolveSeasonEvent(game, selectedMessage.id, choiceId)
    if (result.error) {
      onUpdate(game, result.error)
      return
    }
    const updatedMessage = result.game.inboxMessages?.find((message) => message.id === selectedMessage.id)
    setSelectedMessage(updatedMessage ?? null)
    onUpdate(result.game, result.outcome)
  }

  const choosePlayerStoryOption = (choiceId: string) => {
    if (!selectedMessage?.playerStory) return
    const result = resolvePlayerStory(game, selectedMessage.id, choiceId)
    if (result.error) {
      onUpdate(game, result.error)
      return
    }
    const updatedMessage = result.game.inboxMessages?.find((message) => message.id === selectedMessage.id)
    setSelectedMessage(updatedMessage ?? null)
    onUpdate(result.game, result.outcome)
  }

  useEffect(() => {
    if (!selectedMessage) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMessage()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedMessage, closeMessage])

  const statusLabels = {
    accepted: 'Oferta zaakceptowana',
    countered: 'Kontroferta',
    rejected: 'Oferta odrzucona',
    offered: 'Nowa oferta',
    'player-negotiation': 'Warunki kontraktu zawodnika',
    info: 'Wiadomość',
  }
  return <section className="panel-card mailbox-panel">
    <div className="panel-heading"><div><p className="eyebrow">WIADOMOŚCI KLUBOWE</p><h2>Skrzynka e-mail</h2></div><span className="roster-count">{messages.length} wiadomości</span></div>
    <p className="mailbox-intro">Wiadomości pozostają w archiwum kariery. Otwórz e-mail, aby przeczytać jego treść i zobaczyć szczegóły.</p>
    {messages.length === 0
      ? <div className="empty-state"><Mail size={20} /><span>Brak wiadomości. Informacje od klubów, zarządu i sponsora pojawią się tutaj.</span><button className="panel-link" onClick={() => onNavigate('transfers')}>Przejdź na rynek transferowy <ArrowRight size={14} /></button></div>
      : <div className="mailbox-list">{messages.map((message) => {
        const sponsorBrand = getMessageSponsorBrand(message)
        return <article
          className={`mail-message mail-message-draw ${message.read ? '' : 'mail-message-unread'}`}
          key={message.id}
          onClick={() => openMessage(message)}
          onKeyDown={(event) => {
            if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault()
              openMessage(message)
            }
          }}
          tabIndex={0}
          role="button"
          aria-label={`Otwórz wiadomość: ${message.subject}`}
        >
          <span className={`mail-message-icon mail-message-${message.status ?? 'info'} ${sponsorBrand ? 'mail-message-sponsor' : ''}`}>
            {sponsorBrand?.logo ? <img className="mail-message-sponsor-logo" src={sponsorBrand.logo} alt={sponsorBrand.name} /> : <Mail size={17} />}
            {!message.read && <i className="mail-unread-dot" aria-hidden="true" />}
          </span>
          <div className="mail-message-content">
            <div className="mail-message-meta"><span>{message.sender}{!message.read && <b className="mail-unread-indicator">NIEPRZECZYTANA</b>}</span><time>{message.date}</time></div>
            <h3>{message.subject}</h3>
            {message.relatedTransferOfferId && (() => {
              const incomingOffer = game.incomingTransferOffers?.find((offer) => offer.id === message.relatedTransferOfferId)
              if (!incomingOffer || !['pending', 'countered', 'player-negotiation'].includes(incomingOffer.status)) return null
              const roundsLeft = getIncomingOfferRoundsLeft(incomingOffer)
              return <div className={`season-event-mail-status ${roundsLeft <= 1 ? 'incoming-offer-deadline-urgent' : ''}`}>
                Decyzja do końca {roundsLeft} {roundsLeft === 1 ? 'kolejki' : 'kolejek'}
              </div>
            })()}
            {message.seasonEvent && <div className="season-event-mail-status">{message.seasonEvent.selectedChoiceId ? 'Wydarzenie rozstrzygnięte' : 'Wybierz reakcję, aby poznać konsekwencje'}</div>}
            {message.playerStory && <div className="season-event-mail-status">{message.playerStory.playerGroup === 'academy'
              ? message.playerStory.selectedChoiceId ? 'Plan rozwoju juniora rozstrzygnięty' : 'Junior czeka na decyzję o rozwoju'
              : message.playerStory.selectedChoiceId ? 'Prośba zawodnika rozstrzygnięta' : 'Zawodnik czeka na Twoją odpowiedź'}</div>}
            {(message.polishCupDraw || message.polishCupResults) && <div className="mail-cup-summary">
              <span>Polski Puchar {(message.polishCupDraw ?? message.polishCupResults)?.season ?? ''}</span>
              <span>{(message.polishCupDraw ?? message.polishCupResults)?.stage}</span>
              <span>{getCupGroups(message).length ? `Grupy: ${getCupGroups(message).join(', ')}` : 'Faza centralna · bez podziału na grupy'}</span>
              {message.polishCupDraw?.userParticipates !== undefined && <span className={message.polishCupDraw.userParticipates ? 'mail-cup-relevance' : 'mail-cup-not-relevant'}>
                {message.polishCupDraw.userParticipates
                  ? `Dotyczy Twojego klubu${message.polishCupDraw.userGroup ? ` · grupa ${message.polishCupDraw.userGroup}` : ''}`
                  : 'Nie dotyczy bezpośrednio Twojego klubu'}
              </span>}
            </div>}
            <div className="mail-message-footer"><span className={`mail-status mail-status-${message.status ?? 'info'}`}>{statusLabels[message.status ?? 'info']}</span>
              {message.polishCupDraw && <span className="panel-link">Otwórz terminarz <ArrowRight size={14} /></span>}
              {message.polishCupResults && <span className="panel-link">Otwórz wyniki spotkań <ArrowRight size={14} /></span>}
              {message.status === 'countered' && <button className="panel-link" onClick={(event) => { event.stopPropagation(); onNavigate('transfers') }}>Odpowiedz na kontrofertę <ArrowRight size={14} /></button>}
              {message.status === 'player-negotiation' && <button className="panel-link" onClick={(event) => { event.stopPropagation(); openMessage(message) }}>Zobacz warunki kontraktu <ArrowRight size={14} /></button>}
              {getRejectedSponsorOffer(message) && <button className="panel-link" onClick={(event) => { event.stopPropagation(); onNavigateToSponsorOffers() }}>Wybierz sponsora w finansach <ArrowRight size={14} /></button>}
              {isSponsorRenewalNotice(message) && <button className="panel-link" onClick={(event) => { event.stopPropagation(); onNavigateToSponsorOffers() }}>Zobacz oferty sponsorskie <ArrowRight size={14} /></button>}
            </div>
          </div>
        </article>
      })}</div>}
    {selectedMessage && <div className="matchday-preview-overlay" onClick={closeMessage}>
      <section className={`matchday-preview mail-detail-preview ${selectedMessage.polishCupDraw || selectedMessage.polishCupResults ? 'cup-draw-preview' : ''}`} role="dialog" aria-modal="true" aria-labelledby="mail-detail-title" onClick={(event) => event.stopPropagation()}>
        <div className="matchday-preview-header">
          <div>
            <p className="eyebrow">{selectedMessage.polishCupDraw || selectedMessage.polishCupResults ? `POLSKI PUCHAR ${(selectedMessage.polishCupDraw ?? selectedMessage.polishCupResults)?.season ?? ''}` : selectedMessage.sender}</p>
            <h3 id="mail-detail-title">{selectedMessage.subject}</h3>
          </div>
          <button type="button" className="close-button" onClick={closeMessage}>Wróć do centrum</button>
        </div>
        <div className="mail-detail-meta"><span>Od: {selectedMessage.sender}</span><time>{selectedMessage.date}</time></div>
        {selectedMessage.polishCupDraw || selectedMessage.polishCupResults
          ? <>
            <p className="mail-detail-body">{selectedMessage.body.split('\n\n')[0]}</p>
            <div className="cup-draw-context">
              <p><strong>Etap / runda:</strong> {(selectedMessage.polishCupDraw ?? selectedMessage.polishCupResults)?.stage}</p>
              {selectedMessage.polishCupDraw?.regionalRound !== undefined && <p><strong>Runda regionalna:</strong> {selectedMessage.polishCupDraw.regionalRound}</p>}
              {selectedMessage.polishCupResults && <p><strong>Numer rundy:</strong> {selectedMessage.polishCupResults.round}</p>}
              <p><strong>Okręgi objęte rozgrywkami:</strong> {getCupGroups(selectedMessage).length ? getCupGroups(selectedMessage).join(', ') : 'Faza centralna — bez podziału na grupy'}</p>
              {selectedMessage.polishCupDraw?.userParticipates !== undefined && <p className={selectedMessage.polishCupDraw.userParticipates ? 'mail-cup-relevance' : 'mail-cup-not-relevant'}>
                <strong>Twój klub:</strong> {selectedMessage.polishCupDraw.userParticipates
                  ? `bierze udział${selectedMessage.polishCupDraw.userGroup ? ` · grupa ${selectedMessage.polishCupDraw.userGroup}` : ''}`
                  : 'nie bierze udziału w tym etapie'}
              </p>}
            </div>
            {selectedMessage.polishCupDraw && <p className="cup-draw-date">Data losowania: {new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' }).format(parseLocalDateKey(selectedMessage.polishCupDraw.drawDate))}</p>}
            {(() => {
              const fixtures = selectedMessage.polishCupResults
                ? selectedMessage.polishCupResults.fixtures
                : (selectedMessage.polishCupDraw?.fixtures ?? []).map((fixture) => ({ ...fixture, homeGoals: undefined, awayGoals: undefined, penaltyScore: undefined }))
              const poolIds = [...new Set(fixtures.flatMap((fixture) => fixture.poolId ? [fixture.poolId] : []))]
                .sort((first, second) => regionalOptions.findIndex((region) => region.id === first) - regionalOptions.findIndex((region) => region.id === second))
              const sections = poolIds.length
                ? poolIds.map((poolId) => ({
                  id: poolId,
                  label: regionalOptions.find((region) => region.id === poolId)?.name ?? poolId,
                  fixtures: fixtures.filter((fixture) => fixture.poolId === poolId),
                }))
                : [{ id: 'central', label: selectedMessage.polishCupResults ? 'Wyniki rundy' : 'Terminarz centralny', fixtures }]
              return <div className="cup-draw-fixture-groups">
                {sections.map((group) => <section className="cup-draw-fixture-group" key={group.id}>
                  <h4>{group.label}</h4>
                  <div className="cup-draw-fixtures">
                    {group.fixtures.map((fixture, index) => {
                      const isUserMatch = fixture.homeId === game.teamId || fixture.awayId === game.teamId
                      const fixtureDate = parseLocalDateKey(fixture.date)
                      const formatter = new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                      const homeName = game.polishCup?.teams.find((team) => team.id === fixture.homeId)?.name ?? getTeamName(game, fixture.homeId)
                      const awayName = game.polishCup?.teams.find((team) => team.id === fixture.awayId)?.name ?? getTeamName(game, fixture.awayId)
                      const score = fixture.homeGoals !== undefined && fixture.awayGoals !== undefined
                        ? `${fixture.homeGoals} : ${fixture.awayGoals}${fixture.penaltyScore ? ` · karne ${fixture.penaltyScore}` : ''}`
                        : undefined
                      return <article key={`${fixture.homeId}-${fixture.awayId}-${index}`} className={`cup-draw-fixture ${isUserMatch ? 'cup-draw-fixture-user' : ''}`}>
                        <div><small>{formatter.format(fixtureDate)} · {fixture.kickoffTime}</small><strong>{homeName} {score ?? <span>vs</span>} {awayName}</strong></div>
                        {isUserMatch && <b>TWÓJ KLUB</b>}
                      </article>
                    })}
                  </div>
                </section>)}
              </div>
            })()}
          </>
          : selectedMessage.subject.startsWith('Rozpoczyna się tydzień Polskiego Pucharu')
            ? <div className="mail-cup-week-body">
              {selectedMessage.body.split('\n\n').map((section, index) => {
                const [heading, ...fixtures] = section.split('\n')
                return index === 0
                  ? <p className="mail-detail-body" key={index}>{section}</p>
                  : <section className="mail-cup-week-group" key={`${heading}-${index}`}>
                    <h4>{heading}</h4>
                    <ul>{fixtures.map((fixture, fixtureIndex) => <li key={`${fixture}-${fixtureIndex}`}>{fixture.replace(/^•\s*/, '')}</li>)}</ul>
                  </section>
              })}
            </div>
          : <p className="mail-detail-body">{selectedMessage.body}</p>}
        {selectedIncomingOffer && (selectedIncomingOffer.status === 'pending' || selectedIncomingOffer.status === 'countered' || selectedIncomingOffer.status === 'player-negotiation') && <section className="season-event-choice-panel" aria-label="Decyzja o ofercie transferowej">
          <h4>Oferta za zawodnika</h4>
          {comparedIncomingOffers.length > 1 && <div className="incoming-offer-comparison">
            <h4>Porównanie ofert za {game.squad.find((player) => player.id === selectedIncomingOffer.playerId)?.firstName} {game.squad.find((player) => player.id === selectedIncomingOffer.playerId)?.lastName}</h4>
            <div className="incoming-offer-comparison-list">
              {comparedIncomingOffers.map((offer) => {
                const club = game.teams.find((team) => team.id === offer.clubId)
                const linkedMessage = messages.find((message) => message.relatedTransferOfferId === offer.id)
                const wage = offer.playerWageDemand ?? offer.estimatedPlayerWage
                const contractSeasons = offer.playerContractSeasons ?? offer.estimatedPlayerContractSeasons
                const isCurrentOffer = offer.id === selectedIncomingOffer.id
                const stateLabel = offer.status === 'player-negotiation'
                  ? 'Negocjacje kontraktu'
                  : offer.status === 'countered' ? 'Kontroferta klubu' : 'Oczekuje na decyzję'
                return <article className={`incoming-offer-comparison-card ${isCurrentOffer ? 'incoming-offer-comparison-current' : ''}`} key={offer.id}>
                  <div className="incoming-offer-comparison-heading">
                    <strong>{club?.name ?? getTeamName(game, offer.clubId)}</strong>
                    <span>{stateLabel}</span>
                  </div>
                  <div className="incoming-offer-comparison-stats">
                    <span>Kwota transferu<strong>{formatMoney(offer.counterAmount ?? offer.agreedAmount ?? offer.offeredAmount)}</strong></span>
                    <span>Siła klubu<strong>{club?.strength ?? '—'}</strong></span>
                    <span>Pensja zawodnika<strong>{wage ? `${formatMoney(wage)} / kolejkę` : '—'}</strong></span>
                    <span>Długość umowy<strong>{contractSeasons ? `${contractSeasons} sez.` : '—'}</strong></span>
                    <span>Termin decyzji<strong>{getIncomingOfferRoundsLeft(offer)} kol.</strong></span>
                  </div>
                  {!isCurrentOffer && linkedMessage && <button type="button" className="panel-link" onClick={() => openMessage(linkedMessage)}>Otwórz tę ofertę <ArrowRight size={14} /></button>}
                </article>
              })}
            </div>
          </div>}
          <p>Oferta podstawowa: <strong>{formatMoney(selectedIncomingOffer.offeredAmount)}</strong></p>
          <p className="incoming-offer-deadline">Czas na decyzję: <strong>{getIncomingOfferRoundsLeft(selectedIncomingOffer)} {getIncomingOfferRoundsLeft(selectedIncomingOffer) === 1 ? 'kolejka' : 'kolejki'}</strong>. Po terminie oferta wygaśnie, a zawodnik może stracić morale.</p>
          {selectedIncomingOffer.status === 'player-negotiation'
            ? <>
              <p>Uzgodniona kwota transferu: <strong>{formatMoney(selectedIncomingOffer.agreedAmount ?? selectedIncomingOffer.offeredAmount)}</strong></p>
              <p>Oczekiwania zawodnika: pensja <strong>{formatMoney(selectedIncomingOffer.playerWageDemand ?? 0)}</strong> za kolejkę · kontrakt <strong>{selectedIncomingOffer.playerContractSeasons ?? 0} lata</strong></p>
              <p>Runda negocjacji: <strong>{selectedIncomingOffer.playerNegotiationRounds ?? 0}/2</strong></p>
              <label className="mail-detail-counteroffer">
                Twoja propozycja pensji (zł / kolejkę)
                <input
                  type="number"
                  min={game.squad.find((player) => player.id === selectedIncomingOffer.playerId)?.wage ?? 1}
                  step="100"
                  value={incomingContractWage}
                  onChange={(event) => setIncomingContractWage(event.target.value)}
                />
              </label>
              <label className="mail-detail-counteroffer">
                Długość kontraktu (sezony)
                <input
                  type="number"
                  min="1"
                  max="4"
                  step="1"
                  value={incomingContractSeasons}
                  onChange={(event) => setIncomingContractSeasons(event.target.value)}
                />
              </label>
              <div className="season-event-choice-list">
                <button type="button" className="primary-button" onClick={() => respondToIncomingOffer('accept-player-terms')}>Akceptuj warunki i sfinalizuj <ArrowRight size={14} /></button>
                <button type="button" className="panel-link" onClick={() => respondToIncomingOffer('counter-player-terms')}>Zaproponuj inne warunki</button>
                <button type="button" className="panel-link" onClick={() => respondToIncomingOffer('reject-player-terms')}>Wycofaj zgodę na transfer</button>
              </div>
            </>
            : selectedIncomingOffer.status === 'countered' && selectedIncomingOffer.counterAmount !== undefined
            ? <>
              <p>Kontroferta klubu: <strong>{formatMoney(selectedIncomingOffer.counterAmount)}</strong></p>
              <div className="season-event-choice-list">
                <button type="button" className="primary-button" onClick={() => respondToIncomingOffer('accept')}>Akceptuj kontrofertę <ArrowRight size={14} /></button>
                <button type="button" className="panel-link" onClick={() => respondToIncomingOffer('reject')}>Odrzuć ofertę</button>
              </div>
            </>
            : <>
              <label className="mail-detail-counteroffer">
                Twoja kontroferta
                <input
                  type="number"
                  min={selectedIncomingOffer.offeredAmount + 1}
                  step="1000"
                  value={incomingOfferCounterAmount}
                  onChange={(event) => setIncomingOfferCounterAmount(event.target.value)}
                />
              </label>
              <div className="season-event-choice-list">
                <button type="button" className="primary-button" onClick={() => respondToIncomingOffer('accept')}>Akceptuj ofertę <ArrowRight size={14} /></button>
                <button type="button" className="panel-link" onClick={() => respondToIncomingOffer('counter')}>Wyślij kontrofertę</button>
                <button type="button" className="panel-link" onClick={() => respondToIncomingOffer('promise-stay')}>Obiecaj zawodnikowi pozostanie</button>
                <button type="button" className="panel-link" onClick={() => respondToIncomingOffer('reject')}>Odrzuć ofertę</button>
              </div>
            </>}
        </section>}
        {selectedMessage.seasonEvent && <section className="season-event-choice-panel" aria-label="Wybór reakcji na wydarzenie">
          <h4>{selectedMessage.seasonEvent.selectedChoiceId ? 'Twoja decyzja' : 'Jak zareagujesz?'}</h4>
          {selectedMessage.seasonEvent.selectedChoiceId
            ? <div className="season-event-resolution">
              <strong>{selectedMessage.seasonEvent.choices.find((choice) => choice.id === selectedMessage.seasonEvent?.selectedChoiceId)?.label}</strong>
              <p>{selectedMessage.seasonEvent.resolution}</p>
            </div>
            : <div className="season-event-choice-list">{selectedMessage.seasonEvent.choices.map((choice) => {
              const { cash, morale, stamina, confidence, followers, localReputation } = choice.effects
              const effects = [
                cash ? `${cash > 0 ? '+' : '−'}${formatMoney(Math.abs(cash))}` : '',
                morale ? `morale ${morale > 0 ? '+' : ''}${morale}` : '',
                stamina ? `kondycja ${stamina > 0 ? '+' : ''}${stamina}` : '',
                confidence ? `zarząd ${confidence > 0 ? '+' : ''}${confidence}` : '',
                followers ? `kibice ${followers > 0 ? '+' : ''}${followers.toLocaleString('pl-PL')}` : '',
                localReputation ? `reputacja lokalna ${localReputation > 0 ? '+' : ''}${localReputation}` : '',
              ].filter(Boolean)
              const unaffordable = cash < 0 && game.cash + cash < 0
              return <article className="season-event-choice" key={choice.id}>
                <div><strong>{choice.label}</strong><p>{choice.description}</p><small>{effects.join(' · ')}</small></div>
                <button type="button" className="primary-button" disabled={unaffordable} onClick={() => chooseSeasonEventOption(choice.id)}>
                  Wybierz <ArrowRight size={14} />
                </button>
                {unaffordable && <small className="season-event-unaffordable">Za mało środków</small>}
              </article>
            })}</div>}
        </section>}
        {selectedMessage.playerStory && <section className="season-event-choice-panel" aria-label={selectedMessage.playerStory.playerGroup === 'academy' ? 'Decyzja o rozwoju juniora' : 'Odpowiedź na prośbę zawodnika'}>
          <h4>{selectedMessage.playerStory.playerGroup === 'academy'
            ? selectedMessage.playerStory.selectedChoiceId ? 'Decyzja o rozwoju juniora' : `Ustal plan dla juniora: ${selectedMessage.playerStory.playerName}`
            : selectedMessage.playerStory.selectedChoiceId ? 'Twoja rozmowa' : `Odpowiedz zawodnikowi: ${selectedMessage.playerStory.playerName}`}</h4>
          {selectedMessage.playerStory.selectedChoiceId
            ? <div className="season-event-resolution">
              <strong>{selectedMessage.playerStory.choices.find((choice) => choice.id === selectedMessage.playerStory?.selectedChoiceId)?.label}</strong>
              <p>{selectedMessage.playerStory.resolution}</p>
            </div>
            : <div className="season-event-choice-list">{selectedMessage.playerStory.choices.map((choice) => <article className="season-event-choice" key={choice.id}>
              <div><strong>{choice.label}</strong><p>{choice.description}</p></div>
              <button type="button" className="primary-button" onClick={() => choosePlayerStoryOption(choice.id)}>Wybierz <ArrowRight size={14} /></button>
            </article>)}</div>}
        </section>}
        {selectedMessageAction && <div className="mail-detail-actions">
          <button type="button" className="primary-button" onClick={() => { setSelectedMessage(null); onNavigate(selectedMessageAction) }}>
          {selectedMessageAction === 'club' ? 'Przejdź do Stadion i teren' : selectedMessageAction === 'tactics' ? 'Przejdź do składu i taktyki' : 'Przejdź do składu'} <ArrowRight size={14} />
          </button>
        </div>}
        {selectedSponsorOffer && <div className="mail-detail-actions mail-sponsor-actions">
          {!game.sponsorDeal && <div className="mail-sponsor-terms">
            <strong>Pierwotne warunki oferty</strong>
            <span>{formatMoney(selectedSponsorOffer.paymentPerMatch)} za kolejkę · {formatMoney(game.round === 1 && game.sponsorSigningBonusAvailable !== false ? selectedSponsorOffer.signingBonus : 0)} premii za podpis</span>
          </div>}
          <button type="button" className="secondary-button" onClick={openSponsorFinances}>
            Zobacz oferty w finansach <ArrowRight size={14} />
          </button>
          {canAcceptSponsorOffer && <button type="button" className="primary-button" onClick={acceptOriginalSponsorOffer}>
            Zaakceptuj pierwotne warunki <Check size={14} />
          </button>}
        </div>}
        {isSponsorRenewalNotice(selectedMessage) && <div className="mail-detail-actions">
          <button type="button" className="primary-button" onClick={openSponsorFinances}>
            Zobacz oferty sponsorskie <ArrowRight size={14} />
          </button>
        </div>}
        {selectedMessage.category === 'club' && selectedSponsorBrand?.logo && <footer className="mail-sponsor-signature">
          <span>Pozdrawiamy,</span>
          <img src={selectedSponsorBrand.logo} alt={selectedSponsorBrand.name} />
        </footer>}
      </section>
    </div>}
  </section>
}

function ScoutingPage({ game, onUpdate }: { game: GameState; onUpdate: (game: GameState, message?: string) => void }) {
  const totalWages = game.scouts.reduce((sum, scout) => sum + scout.wagePerRound, 0)
  const transferWindowOpen = getTransferWindowInfo(game).isOpen
  const experienceLabels: Record<ScoutExperience, string> = {
    rookie: 'Początkujący',
    experienced: 'Doświadczony',
    expert: 'Ekspert',
  }
  function hire(experience: ScoutExperience) {
    const result = hireScout(game, experience)
    if (result.error) return onUpdate(game, result.error)
    const scout = result.game.scouts[result.game.scouts.length - 1]
    onUpdate(result.game, `Zatrudniono skauta ${scout.name}. Koszt kontraktu: ${formatMoney(scout.hiringCost)}, wynagrodzenie: ${formatMoney(scout.wagePerRound)} po każdej kolejce.`)
  }
  function dismiss(scoutId: string) {
    const scout = game.scouts.find((item) => item.id === scoutId)
    const result = dismissScout(game, scoutId)
    if (result.error) return onUpdate(game, result.error)
    onUpdate(result.game, `Zakończono współpracę ze skautem ${scout?.name}.`)
  }
  function recruit(scoutId: string) {
    const scout = game.scouts.find((item) => item.id === scoutId)
    const prospect = scout?.prospect
    const result = signScoutedProspect(game, scoutId)
    if (result.error) return onUpdate(game, result.error)
    onUpdate(result.game, `Podpisano kontrakt z odkrytym talentem ${prospect?.firstName} ${prospect?.lastName}.`)
  }
  return <>
    <section className="scouting-banner">
      <span className="scouting-banner-icon"><Compass size={22} /></span>
      <div><p className="eyebrow">DZIAŁ OBSERWACJI</p><h2>Odkrywaj talenty dla klubu</h2><p>Zatrudnij skautów, którzy będą regularnie wyszukiwać młodych zawodników. Doświadczenie wpływa na cenę, pensję i szybkość raportowania.</p></div>
      <div className="scouting-capacity"><strong>{game.scouts.length} / 3</strong><small>SKAUTÓW</small></div>
    </section>
    <div className="scouting-summary">
      <div><Banknote size={16} /><span><small>WYNAGRODZENIA PO KAŻDEJ KOLEJCE</small><strong>{formatMoney(totalWages)}</strong></span></div>
      <div><UsersRound size={16} /><span><small>GOTOWE RAPORTY</small><strong>{game.scouts.filter((scout) => scout.prospect).length}</strong></span></div>
      <div><Star size={16} /><span><small>MAKS. KADRA</small><strong>{game.squad.length} / 30 zawodników</strong></span></div>
    </div>
    <section className="panel-card scout-hiring-panel">
      <div className="panel-heading"><div><p className="eyebrow">RYNEK SZTABU</p><h2>Zatrudnij skauta</h2></div><span className="market-budget"><small>BUDŻET KLUBU</small><strong>{formatMoney(game.cash)}</strong></span></div>
      <div className="scout-package-grid">{(Object.keys(scoutPackages) as ScoutExperience[]).map((experience) => {
        const scoutPackage = scoutPackages[experience]
        return <article className="scout-package-card" key={experience}>
          <span className={`scout-experience-icon scout-experience-${experience}`}><Compass size={19} /></span>
          <p className="eyebrow">{experienceLabels[experience]}</p>
          <h3>{formatMoney(scoutPackage.hiringCost)} <small>za kontrakt</small></h3>
          <p>{scoutPackage.description}</p>
          <div><span>Pensja / kolejkę</span><strong>{formatMoney(scoutPackage.wagePerRound)}</strong></div>
          <button className="primary-button" disabled={game.scouts.length >= 3 || game.cash < scoutPackage.hiringCost} onClick={() => hire(experience)}>{game.scouts.length >= 3 ? 'Limit skautów' : 'Zatrudnij skauta'} <ArrowRight size={14} /></button>
        </article>
      })}</div>
      <p className="scouting-footnote"><CircleHelp size={14} /> Pensja jest pobierana po każdej rozegranej kolejce. Skaut, który znalazł talent, czeka na decyzję klubu i w tym czasie nie szuka kolejnego zawodnika.</p>
    </section>
    <section className="panel-card scout-roster-panel">
      <div className="panel-heading"><div><p className="eyebrow">TWOI OBSERWATORZY</p><h2>Raporty skautingowe</h2></div></div>
      {game.scouts.length === 0 ? <div className="empty-state"><Compass size={20} /><span>Zatrudnij pierwszego skauta, aby rozpocząć obserwację młodych zawodników.</span></div> : <div className="scout-roster-list">{game.scouts.map((scout) => {
        const prospect = scout.prospect
        return <article className="scout-roster-card" key={scout.id}>
          <div className="scout-roster-heading"><span className={`scout-avatar scout-experience-${scout.experience}`}><Compass size={17} /></span><span><strong>{scout.name}</strong><small>{experienceLabels[scout.experience]} · pensja {formatMoney(scout.wagePerRound)} / kolejkę</small></span><button className="sell-player-button" title={`Zwolnij skauta ${scout.name}`} aria-label={`Zwolnij skauta ${scout.name}`} onClick={() => dismiss(scout.id)}><X size={14} /></button></div>
          {prospect ? <div className="scouted-prospect">
            <div className="scouted-prospect-title"><PlayerPortrait player={prospect} className="prospect-avatar" /><span><small>ODKRYTY TALENT · {prospect.age} LAT</small><strong><PlayerName player={prospect} /></strong></span><PositionBadge position={prospect.position} /></div>
            <div className="scouted-prospect-stats"><span>Umiejętności <strong>{prospect.skill}</strong></span><span>Potencjał <strong>{prospect.potential}</strong></span><Stars skill={prospect.potential} /></div>
            <div className="scouted-prospect-footer"><span>Szacowany koszt kontraktu <strong>{formatMoney(prospect.value)}</strong></span><button className="primary-button" disabled={!transferWindowOpen || game.squad.length >= 30 || game.cash < prospect.value} onClick={() => recruit(scout.id)}>{!transferWindowOpen ? 'Poza oknem transferowym' : game.squad.length >= 30 ? 'Kadra pełna' : 'Zaproś do klubu'} <ArrowRight size={14} /></button></div>
          </div> : <div className="scout-report-progress"><span className="scout-progress-track"><i style={{ width: `${Math.max(0, Math.min(100, (scout.roundsPerReport - scout.roundsUntilReport) / scout.roundsPerReport * 100))}%` }} /></span><span>{scout.roundsUntilReport === 1 ? 'Raport po następnej kolejce' : `Raport za ${scout.roundsUntilReport} kolejki`}</span></div>}
        </article>
      })}</div>}
    </section>
  </>
}

function BrandMark({ brandKey, className }: { brandKey: string; className: string }) {
  return <span className={className} aria-hidden="true">
    <svg className="brand-mark-art" viewBox="0 0 32 32" fill="none">
      {brandKey === 'sponsor-mark-local' && <>
        <circle cx="16" cy="16" r="12" stroke="#fff3c4" strokeWidth="1.5" />
        <path d="M18.5 4 9 17h6l-1.5 11L23 14h-6l1.5-10Z" fill="#fff7d5" />
        <path d="m5 8 2 1M25 23l2 1" stroke="#fff7d5" strokeWidth="2" strokeLinecap="round" />
      </>}
      {brandKey === 'sponsor-mark-regional' && <>
        <path d="M4 10c4 0 4 4 8 4s4-4 8-4 4 4 8 4" stroke="#e6fffa" strokeWidth="3" strokeLinecap="round" />
        <path d="M4 17c4 0 4 4 8 4s4-4 8-4 4 4 8 4M8 25c3 0 3-3 6-3s3 3 6 3 3-3 6-3" stroke="#baf2e8" strokeWidth="2" strokeLinecap="round" />
      </>}
      {brandKey === 'sponsor-mark-national' && <>
        <circle cx="16" cy="16" r="12" stroke="#e8edff" strokeWidth="2" />
        <circle cx="16" cy="16" r="7" stroke="#e8edff" strokeWidth="2" />
        <circle cx="16" cy="16" r="2.5" fill="#fff" />
        <path d="M16 2v4M30 16h-4M16 30v-4M2 16h4" stroke="#fff" strokeWidth="1.5" />
      </>}
      {brandKey === 'sponsor-mark-premium' && <>
        <path d="m3 25 8-12 4 5 5-10 9 17H3Z" fill="#fff0ff" />
        <path d="m20 4 .9 2.8L24 8l-3.1 1.1L20 12l-1.1-2.9L16 8l2.9-1.2L20 4Z" fill="#fff" />
        <path d="m8 22 3-4 3 4m5 0 1-2 2 2" stroke="#bc80ca" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </>}
      {brandKey === 'sponsor-mark-tv' && <>
        <rect x="4" y="7" width="24" height="17" rx="3" stroke="#eaf4ff" strokeWidth="2" />
        <path d="m12 4 4 3 4-3M10 28h12M16 24v4" stroke="#eaf4ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m14 12 6 3-6 4v-7Z" fill="#fff" />
      </>}
      {brandKey === 'sponsor-mark-default' && <>
        <path d="m16 3 13 13-13 13L3 16 16 3Z" fill="#f4f6f1" />
        <circle cx="16" cy="16" r="5" fill="#758371" />
      </>}
    </svg>
  </span>
}

const sponsorBrandDetails: Record<string, { name: string; monogram: string; className: string; logo: string }> = {
  'sponsor-local': { name: 'Elektrownia', monogram: 'E', className: 'sponsor-mark-local', logo: '/images/sponsors/elektrownia.jpg' },
  'sponsor-regional': { name: 'Nurt Mobile', monogram: 'NM', className: 'sponsor-mark-regional', logo: '/images/sponsors/nurt-mobile.jpg' },
  'sponsor-national': { name: 'Punkt Zero', monogram: 'PZ', className: 'sponsor-mark-national', logo: '/images/sponsors/punkt-zero.jpg' },
  'sponsor-iskra': { name: 'ISKRA PALIWA', monogram: 'IP', className: 'sponsor-mark-iskra', logo: '/images/sponsors/iskra-paliwa.svg' },
  'sponsor-morlen': { name: 'ISKRA PALIWA', monogram: 'IP', className: 'sponsor-mark-iskra', logo: '/images/sponsors/iskra-paliwa.svg' },
  'sponsor-dild': { name: 'Dild', monogram: 'D', className: 'sponsor-mark-dild', logo: '/images/sponsors/dild.jpg' },
  'sponsor-premium': { name: 'Szczyt Sport', monogram: 'SS', className: 'sponsor-mark-premium', logo: '/images/sponsors/szczyt-sport.jpg' },
  'sponsor-kcm1948': { name: 'KCM1948', monogram: 'K', className: 'sponsor-mark-kcm', logo: '/images/sponsors/kcm1948.jpg' },
}

const tvBrandDetails: Record<string, { name: string; monogram: string; className: string; logo: string }> = {
  'tv-basic': { name: 'Liga TV', monogram: 'LT', className: 'sponsor-mark-tv', logo: '/images/tv/liga-tv.jpg' },
  'tv-standard': { name: 'Sport Polska', monogram: 'SP', className: 'sponsor-mark-tv', logo: '/images/tv/sport-polska.jpg' },
  'tv-premium': { name: 'Kanał Mistrzów', monogram: 'KM', className: 'sponsor-mark-tv', logo: '/images/tv/kanal-mistrzow.jpg' },
  'tv-kcm': { name: 'KCMtv', monogram: 'KCM', className: 'sponsor-mark-tv', logo: '/images/tv/kcmtv.jpg' },
}

type FinanceCategory = { label: string; matcher: RegExp }

const financeExpenseCategories: FinanceCategory[] = [
  { label: 'Utrzymanie stadionu', matcher: /utrzymanie stadionu/i },
  { label: 'Wynagrodzenie kadry trenerskiej', matcher: /wynagrodzenie sztabu|kontrakt sztabu/i },
  { label: 'Wynagrodzenie dla piłkarzy', matcher: /wynagrodzenia kadry/i },
  { label: 'Organizacja dnia meczowego', matcher: /organizacja dnia meczowego/i },
  { label: 'Koszty akademii piłkarskiej', matcher: /akademi|juniorski|juniora|nab[oó]r/i },
  { label: 'Premie i bonusy dla piłkarzy', matcher: /premi|bonus/i },
  { label: 'Kary pieniężne', matcher: /kara|grzywn|sankcj/i },
  { label: 'Transfery piłkarzy przychodzące', matcher: /transfer(?! wychodz[aą]cy)/i },
  { label: 'Prowizje dla agentów piłkarzy', matcher: /agent|prowizj/i },
  { label: 'Skauting', matcher: /skaut/i },
  { label: 'Baza treningowa', matcher: /trening|obiekt treningowy/i },
  { label: 'Transport', matcher: /transport|przejazd/i },
]

const financeIncomeCategories: FinanceCategory[] = [
  { label: 'Przychód z dnia meczowego', matcher: /przych[oó]d z dnia meczowego/i },
  { label: 'Sponsorzy', matcher: /sponsor/i },
  { label: 'Przychód z praw telewizyjnych', matcher: /prawa telewizyjne|tv/i },
  { label: 'Sprzedaż pamiątek', matcher: /pami[aą]tk/i },
  { label: 'Sprzedaż koszulek', matcher: /koszulk/i },
  { label: 'Sprzedaż z biletów', matcher: /bilet|wp[łl]ywy z dnia meczowego|wp[łl]ywy z meczu/i },
  { label: 'Sprzedaż z karnetów', matcher: /karnet/i },
  { label: 'Transfery odchodzące', matcher: /transfer wychodz[aą]cy/i },
  { label: 'Premie za miejsce w tabeli', matcher: /premia ligowa|premia zarz[aą]du/i },
  { label: 'Premie za zdobycie tytułu', matcher: /premia za zwyci[eę]stwo|mistrzostwo/i },
]

function categorizeFinanceEntry(entry: FinanceEntry) {
  const categories = entry.amount < 0 ? financeExpenseCategories : financeIncomeCategories
  return categories.find((category) => category.matcher.test(entry.label))?.label ?? 'Pozostałe'
}

function getCommercialBrand(kind: 'sponsor' | 'tv', id: string, company: string) {
  if (kind === 'sponsor' && sponsorBrandDetails[id]) return sponsorBrandDetails[id]
  if (kind === 'tv' && tvBrandDetails[id]) return tvBrandDetails[id]
  return {
    name: company,
    monogram: company.split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase(),
    className: kind === 'tv' ? 'sponsor-mark-tv' : 'sponsor-mark-default',
    logo: '',
  }
}

function FinancesPage({ game, onUpdate, onNavigate }: {
  game: GameState
  onUpdate: (game: GameState, message?: string) => void
  onNavigate: (section: Section) => void
}) {
  const totalWages = game.squad.reduce((sum, player) => sum + player.wage, 0)
  const staffWages = (game.staff ?? []).reduce((sum, member) => sum + member.wagePerRound, 0)
  const scoutWages = game.scouts.reduce((sum, scout) => sum + scout.wagePerRound, 0)
  const academyWages = (game.academyPlayers ?? []).reduce((sum, player) => sum + player.wage, 0)
  const academyUpkeep = game.facilities.academy * 8_000 + academyWages
  const debt = game.debt ?? Math.max(0, -game.cash)
  const stadiumUpkeep = Math.round(game.stadiumCapacity * 2.5 / 1000) * 1000
  const positive = game.finances.filter((entry) => entry.amount > 0).reduce((sum, entry) => sum + entry.amount, 0)
  const negative = game.finances.filter((entry) => entry.amount < 0).reduce((sum, entry) => sum + Math.abs(entry.amount), 0)
  const seasonRounds = getSeasonRoundCount(game)
  const halfSeasonRounds = Math.ceil(seasonRounds / 2)
  const remainingRounds = Math.max(0, seasonRounds - game.round + 1)
  const signedIncome = [game.sponsorDeal, game.tvDeal].reduce((total, deal) =>
    total + (deal ? Math.min(remainingRounds, deal.roundsRemaining) * deal.paymentPerMatch : 0),
  0)
  const recurringCostsPerRound = totalWages + staffWages + scoutWages + academyUpkeep + stadiumUpkeep
  const projectedSeasonEndBalance = game.cash + signedIncome - recurringCostsPerRound * remainingRounds
  function signDeal(kind: 'sponsor' | 'tv', offerId: string, duration = seasonRounds) {
    const result = signCommercialDeal(game, kind, offerId, duration)
    if (result.error) return onUpdate(game, result.error)
    const deal = kind === 'sponsor'
      ? result.game.sponsorDeal
      : result.game.tvDeal
    const company = deal ? getCommercialBrand(kind, deal.id, deal.company).name : 'partnerem'
    onUpdate(result.game, `Podpisano umowę z ${company} na ${deal?.duration ?? duration} kolejek. Premia ${formatMoney(deal?.signingBonus ?? 0)} trafiła do budżetu.`)
    if (kind === 'sponsor' && game.sponsorRequired) onNavigate('overview')
  }
  function renewSponsor() {
    const result = renewSponsorDeal(game)
    if (result.error) return onUpdate(game, result.error)
    onUpdate(result.game, `Przedłużono umowę z ${game.sponsorDeal?.company ?? 'aktualnym sponsorem'}.`)
  }
  function negotiate(offerId: string) {
    const result = negotiateSponsorOffer(game, offerId)
    onUpdate(result.game, result.error || 'Sponsor zaakceptował kontrofertę. Zaktualizowane stawki są gotowe do podpisania.')
  }
  return <>
    <div className="finance-highlight"><div className="finance-highlight-top"><span><Wallet size={17} /> SALDO KLUBU</span><span className={`finance-health ${debt > 0 ? 'finance-health-warning' : ''}`}><i /> {debt > 0 ? (debt >= 1_000_000 ? 'ZADŁUŻENIE · SANKCJE' : 'KLUB ZADŁUŻONY') : 'W DOBREJ KONDYCJI'}</span></div><strong>{formatMoney(game.cash)}</strong><p>Stan budżetu operacyjnego klubu</p><div className="finance-summary"><span><ArrowDownLeft size={14} /> Przychody w historii <strong>{formatMoney(positive)}</strong></span><span><ArrowUpRight size={14} /> Wydatki w historii <strong>{formatMoney(negative)}</strong></span><span><Wallet size={14} /> Dług klubu <strong>{formatMoney(debt)}</strong></span></div></div>
    <section className={`finance-projection panel-card ${projectedSeasonEndBalance < 0 ? 'finance-projection-warning' : ''}`} aria-label="Prognoza finansów do końca sezonu">
      <div className="panel-heading">
        <div><p className="eyebrow">PLANOWANIE BUDŻETU</p><h2>Prognoza do końca sezonu</h2></div>
        <span className={`finance-projection-result ${projectedSeasonEndBalance < 0 ? 'amount-negative' : 'amount-positive'}`}>{formatMoney(projectedSeasonEndBalance)}</span>
      </div>
      <p className="finance-description">Szacowane saldo po {remainingRounds} {remainingRounds === 1 ? 'kolejce' : 'kolejkach'} na podstawie obecnego budżetu, aktywnych umów i stałych kosztów.</p>
      <div className="finance-projection-breakdown">
        <span><small>WPŁYWY Z PODPISANYCH UMÓW</small><strong className="amount-positive">+{formatMoney(signedIncome)}</strong></span>
        <span><small>STAŁE KOSZTY ({remainingRounds} {remainingRounds === 1 ? 'KOLEJKA' : 'KOLEJEK'})</small><strong className="amount-negative">−{formatMoney(recurringCostsPerRound * remainingRounds)}</strong></span>
      </div>
      <p className="finance-projection-note">Prognoza nie uwzględnia biletów, transferów, premii, nowych umów ani kosztów jednorazowych. Zakłada brak zmian w obecnej kadrze, sztabie i obiektach.</p>
    </section>
    <div className="finance-grid">
      <section className="panel-card ticket-panel"><div className="panel-heading"><div><p className="eyebrow">PRZYCHODY MECZOWE</p><h2>Ceny biletów</h2></div><span className="finance-icon"><Coins size={18} /></span></div><p className="finance-description">Ustal cenę wejściówki. Wyższe ceny mogą ograniczyć frekwencję kibiców.</p><div className="ticket-price-value"><strong>{game.ticketPrice} zł</strong><span>za bilet</span></div><input className="ticket-slider" type="range" min="10" max="100" step="2" value={game.ticketPrice} onChange={(event) => onUpdate(setTicketPrice(game, Number(event.target.value)))} aria-label="Cena biletu" /><div className="slider-labels"><span>10 zł · komplet kibiców</span><span>100 zł · cena premium</span></div><div className="stadium-capacity"><span><Landmark size={15} /> Pojemność stadionu</span><strong>{game.stadiumCapacity.toLocaleString('pl-PL')} miejsc</strong></div><div className="capacity-meter"><span style={{ width: `${Math.max(38, Math.min(96, 83 - (game.ticketPrice - 28) * 0.8))}%` }} /></div><small className="attendance-hint">Szacowana frekwencja przy obecnej cenie biletu</small></section>
      <section className="panel-card"><div className="panel-heading"><div><p className="eyebrow">KOSZTY KLUBU</p><h2>Stałe zobowiązania</h2></div><span className="finance-icon"><Banknote size={18} /></span></div><div className="cost-list"><div><span><span className="cost-dot cost-dot-red" /> Wynagrodzenia kadry</span><strong>{formatMoney(totalWages)} <small>/ kolejkę</small></strong></div><div><span><span className="cost-dot cost-dot-red" /> Wynagrodzenia sztabu</span><strong>{formatMoney(staffWages)} <small>/ kolejkę</small></strong></div><div><span><span className="cost-dot cost-dot-red" /> Wynagrodzenia skautów</span><strong>{formatMoney(scoutWages)} <small>/ kolejkę</small></strong></div><div><span><span className="cost-dot cost-dot-red" /> Akademia i juniorzy</span><strong>{formatMoney(academyUpkeep)} <small>/ kolejkę</small></strong></div><div><span><span className="cost-dot cost-dot-red" /> Utrzymanie stadionu</span><strong>{formatMoney(stadiumUpkeep)} <small>/ mecz</small></strong></div><div><span><span className="cost-dot" /> Zawodnicy w kadrze</span><strong>{game.squad.length} <small>os.</small></strong></div><div><span><span className="cost-dot cost-dot-blue" /> Cena biletu</span><strong>{game.ticketPrice} <small>zł</small></strong></div></div><div className="finance-tip"><Sparkles size={15} /><span>Utrzymuj równowagę między wynagrodzeniami, akademią i wynikami sportowymi.</span></div></section>
    </div>
    <section id="finance-sponsor-offers" className="panel-card commercial-panel">
      <div className="panel-heading"><div><p className="eyebrow">UMOWY KLUBOWE</p><h2>Sponsorzy i prawa TV</h2></div><span className="finance-icon"><Tv size={18} /></span></div>
      <p className="finance-description">Umowę sponsora podpiszesz na rundę lub cały sezon i możesz negocjować wyższe stawki. Dobre wyniki, frekwencja i zasięgi przyciągają bogatszych partnerów.</p>
      {game.sponsorRequired && <div className="sponsor-required-notice"><Sparkles size={15} /><span>Przed pierwszym meczem sezonu wybierz i podpisz umowę sponsorską. Możesz negocjować lepsze warunki.</span></div>}
      <div className="sponsor-reputation"><TrendingUp size={15} /><span>Pozycja negocjacyjna klubu</span><strong>Reputacja lokalna {game.localReputation ?? 35}/100 · {game.followers.toLocaleString('pl-PL')} obserwujących · {game.homeMatchesPlayed ? `${Math.round(game.totalHomeAttendance / game.homeMatchesPlayed).toLocaleString('pl-PL')} śr. kibiców` : 'oczekiwanie na frekwencję'}</strong></div>
      <div className="commercial-grid">
        <CommercialOffers kind="sponsor" title="Sponsor tytularny" activeDeal={game.sponsorDeal} offers={game.commercialOffers.sponsors} negotiatedOfferIds={game.negotiatedSponsorOfferIds} seasonRounds={seasonRounds} halfSeasonRounds={halfSeasonRounds} signingBonusAvailable={game.round === 1 && game.sponsorSigningBonusAvailable !== false} onSign={(offerId, duration) => signDeal('sponsor', offerId, duration)} onNegotiate={negotiate} onRenew={renewSponsor} />
        <CommercialOffers kind="tv" title="Prawa telewizyjne" activeDeal={game.tvDeal} offers={game.commercialOffers.tv} negotiatedOfferIds={[]} seasonRounds={seasonRounds} halfSeasonRounds={halfSeasonRounds} signingBonusAvailable={true} onSign={(offerId) => signDeal('tv', offerId)} onNegotiate={() => undefined} />
      </div>
    </section>
    <div className="finance-ledger-grid">
      <FinanceLedgerPanel title="Wydatki" icon={<ArrowUpRight size={17} />} entries={game.finances.filter((entry) => entry.amount < 0)} categories={financeExpenseCategories} expense />
      <FinanceLedgerPanel title="Wpływy" icon={<ArrowDownLeft size={17} />} entries={game.finances.filter((entry) => entry.amount > 0)} categories={financeIncomeCategories} />
    </div>
  </>
}

function FinanceLedgerPanel({ title, icon, entries, categories, expense = false }: {
  title: string
  icon: ReactNode
  entries: FinanceEntry[]
  categories: FinanceCategory[]
  expense?: boolean
}) {
  const categorized = categories.map((category) => ({
    label: category.label,
    entries: entries.filter((entry) => categorizeFinanceEntry(entry) === category.label),
  }))
  const remainingEntries = entries.filter((entry) => categorizeFinanceEntry(entry) === 'Pozostałe')
  const total = entries.reduce((sum, entry) => sum + Math.abs(entry.amount), 0)
  return <section className={`panel-card ledger-panel ${expense ? 'ledger-panel-expenses' : 'ledger-panel-income'}`}>
    <div className="panel-heading"><div><p className="eyebrow">HISTORIA OPERACJI</p><h2>{title}</h2></div><span className="finance-icon">{icon}</span></div>
    <div className="ledger-panel-total"><span>Suma w historii</span><strong className={expense ? 'amount-negative' : 'amount-positive'}>{formatMoney(total)}</strong></div>
    <div className="ledger-list">
        {[...categorized, ...(remainingEntries.length ? [{ label: 'Pozostałe', entries: remainingEntries }] : [])].map((group) => {
          const groupTotal = group.entries.reduce((sum, entry) => sum + Math.abs(entry.amount), 0)
          return <div className="ledger-category" key={group.label}>
            <div className="ledger-category-heading"><strong>{group.label}</strong><b className={expense ? 'amount-negative' : 'amount-positive'}>{formatMoney(groupTotal)}</b></div>
          </div>
        })}
      </div>
    {entries.length === 0 && <p className="ledger-empty-note">W tej kategorii nie ma jeszcze zarejestrowanych operacji.</p>}
  </section>
}

function CommercialOffers({ kind, title, activeDeal, offers, negotiatedOfferIds, seasonRounds, halfSeasonRounds, signingBonusAvailable, onSign, onNegotiate, onRenew }: {
  kind: 'sponsor' | 'tv'
  title: string
  activeDeal: GameState['sponsorDeal']
  offers: GameState['commercialOffers']['sponsors']
  negotiatedOfferIds: string[]
  seasonRounds: number
  halfSeasonRounds: number
  signingBonusAvailable: boolean
  onSign: (offerId: string, duration: number) => void
  onNegotiate: (offerId: string) => void
  onRenew?: () => void
}) {
  const brand = (id: string, company: string) => getCommercialBrand(kind, id, company)
  const brandLogo = (id: string, company: string) => {
    const details = brand(id, company)
    return details.logo
      ? <img className="sponsor-logo" src={details.logo} alt="" />
      : <BrandMark brandKey={details.className} className={`sponsor-mark ${details.className}`} />
  }
  return <section className="commercial-type">
    <div className="commercial-type-heading"><span className="commercial-kind-icon">{kind === 'sponsor' ? <Sparkles size={16} /> : <Tv size={16} />}</span><span><strong>{title}</strong><small>{activeDeal ? `${activeDeal.roundsRemaining} kolejek do końca` : kind === 'sponsor' ? `runda (${halfSeasonRounds} kolejek) lub cały sezon (${seasonRounds} kolejek)` : `umowa na cały sezon (${seasonRounds} kolejek)`}</small>{kind === 'sponsor' && !activeDeal && !signingBonusAvailable && <small className="signing-bonus-note">Premia za podpis wróci od nowego sezonu</small>}</span></div>
    {activeDeal ? <div className="active-deal"><span className="active-deal-status"><i /> AKTYWNA UMOWA</span><div className="commercial-brand">{brandLogo(activeDeal.id, activeDeal.company)}<strong>{brand(activeDeal.id, activeDeal.company).name}</strong></div><div><span>Wpływ co kolejkę</span><b>+{formatMoney(activeDeal.paymentPerMatch)}</b></div><div><span>Premia przy podpisie</span><b>{formatMoney(activeDeal.signingBonus)}</b></div>{kind === 'sponsor' && activeDeal.roundsRemaining <= 1 && <button className="offer-sign-button" onClick={onRenew}>Przedłuż umowę z {activeDeal.company} <RotateCcw size={13} /></button>}</div> : <div className="offer-list">{offers.map((offer) => <article className="offer-card" key={offer.id}><div className="offer-copy"><div className="commercial-brand">{brandLogo(offer.id, offer.company)}<strong>{brand(offer.id, offer.company).name}</strong></div>{kind === 'sponsor' && offer.localPartner && <small className="local-partner-label">PARTNER LOKALNY</small>}<small>{offer.description}</small></div><div className="offer-values"><span>Premia<strong>{formatMoney(kind === 'sponsor' && !signingBonusAvailable ? 0 : offer.signingBonus)}</strong></span><span>/ kolejkę<strong>{formatMoney(offer.paymentPerMatch)}</strong></span></div><div className="offer-actions">{kind === 'sponsor' ? <><button className="offer-sign-button" onClick={() => onSign(offer.id, halfSeasonRounds)}>Podpisz na rundę</button><button className="offer-sign-button offer-sign-season" onClick={() => onSign(offer.id, seasonRounds)}>Podpisz na sezon</button><button className="offer-negotiate-button" disabled={negotiatedOfferIds.includes(offer.id)} onClick={() => onNegotiate(offer.id)}>{negotiatedOfferIds.includes(offer.id) ? 'Negocjowano' : 'Negocjuj lepsze warunki'}</button></> : <button className="offer-sign-button" onClick={() => onSign(offer.id, seasonRounds)}>Podpisz umowę <ArrowRight size={13} /></button>}</div></article>)}</div>}
  </section>
}

function AcademyPage({ game, onUpdate }: { game: GameState; onUpdate: (game: GameState, message?: string) => void }) {
  const academyPlayers = game.academyPlayers ?? []
  const prospect = game.academyProspect
  const academyUpkeep = game.facilities.academy * 8_000 + academyPlayers.reduce((total, player) => total + player.wage, 0)
  const recruitCost = prospect ? Math.max(10_000, Math.round(prospect.value * 0.25 / 1000) * 1000) : 0
  function recruit() {
    const result = recruitAcademyProspect(game)
    if (result.error) return onUpdate(game, result.error)
    onUpdate(result.game, 'Junior dołączył do akademii. Będzie trenować i rozwijać się wraz z kolejnymi sezonami.')
  }
  function promoteProspect() {
    const result = signAcademyProspect(game)
    if (result.error) return onUpdate(game, result.error)
    onUpdate(result.game, 'Talent podpisał pierwszy kontrakt i dołączył bezpośrednio do pierwszej drużyny.')
  }
  function train(player: Player) {
    const result = trainAcademyPlayer(game, player.id)
    if (result.error) return onUpdate(game, result.error)
    onUpdate(result.game, `${player.firstName} ${player.lastName} poprawił umiejętności dzięki treningowi akademii.`)
  }
  function promote(player: Player) {
    const result = promoteAcademyPlayer(game, player.id)
    if (result.error) return onUpdate(game, result.error)
    onUpdate(result.game, `${player.firstName} ${player.lastName} awansuje do pierwszej drużyny.`)
  }
  return <>
    <section className="academy-banner">
      <span className="academy-banner-icon"><Users size={22} /></span>
      <div><p className="eyebrow">ROZWÓJ WŁASNYCH TALENTÓW</p><h2>Akademia młodzieżowa</h2><p>Każdy z 5 etapów poprawia jakość naboru i tempo rozwoju juniorów. Ty decydujesz, kogo przyjąć i kiedy awansować do pierwszego zespołu.</p></div>
      <div className="academy-level-pill"><strong>{game.facilities.academy}/5</strong><small>ETAP AKADEMII</small></div>
    </section>
    <div className="academy-stats">
      <StatCard icon={<Users size={17} />} label="JUNIORZY" value={`${academyPlayers.length} / 12`} />
      <StatCard icon={<TrendingUp size={17} />} label="KOSZT UTRZYMANIA / KOLEJKĘ" value={formatMoney(academyUpkeep)} />
      <StatCard icon={<Star size={17} />} label="GOTOWY NABÓR" value={prospect ? '1 talent' : 'Brak'} />
    </div>
    {game.facilities.academy <= 0 && <div className="academy-unavailable"><Building2 size={18} /><span>Najpierw zbuduj akademię młodzieżową w sekcji „Stadion i teren”. Każdy etap poprawia umiejętności i potencjał nowo pozyskanych juniorów.</span></div>}
    {prospect && <section className="academy-prospect-card">
      <PlayerPortrait player={prospect} className="prospect-avatar" />
      <div><p className="eyebrow">NOWY TALENT DO NABORU</p><h2 className="academy-prospect-name"><PlayerName player={prospect} /> <PositionBadge position={prospect.position} /></h2><p>{prospect.age} lat · umiejętności {prospect.skill} · potencjał {prospect.potential}</p><div className="prospect-stars"><Stars skill={prospect.potential} /></div></div>
      <div className="prospect-action"><span>Nabór do akademii <strong>{formatMoney(recruitCost)}</strong></span><button className="primary-button" onClick={recruit} disabled={game.facilities.academy <= 0 || academyPlayers.length >= 12 || game.cash < recruitCost}>Przyjmij do akademii <ArrowRight size={14} /></button><button className="academy-promote-prospect" onClick={promoteProspect} disabled={game.facilities.academy <= 0 || game.squad.length >= 30 || game.cash < prospect.value}>Awansuj od razu · {formatMoney(prospect.value)}</button></div>
    </section>}
    <section className="panel-card academy-roster-panel">
      <div className="panel-heading"><div><p className="eyebrow">KADRA MŁODZIEŻOWA</p><h2>Juniorzy i wychowankowie</h2></div><span className="roster-count">{academyPlayers.length} / 12 zawodników</span></div>
      {academyPlayers.length ? <div className="academy-roster">{academyPlayers.map((player) => {
        const development = Math.max(0, Math.min(100, player.skill / Math.max(1, player.potential) * 100))
        const isReady = player.skill >= player.potential
        const promotionCost = Math.max(10_000, Math.round(player.value * 0.2 / 1000) * 1000)
        return <article className="academy-player-card" key={player.id}>
          <div className="academy-player-heading"><PlayerPortrait player={player} className="prospect-avatar" /><PositionBadge position={player.position} /><span><strong><PlayerName player={player} /></strong><small>{player.age} lat · {positionLabels[player.position]}</small></span><span className="academy-potential">POT. {player.potential}</span></div>
          <div className="academy-skill-line"><span>Umiejętności <strong>{player.skill} / {player.potential}</strong></span><Stars skill={player.skill} /></div>
          <div className="academy-progress"><span style={{ width: `${development}%` }} /></div>
          <div className="academy-player-meta"><span>Wartość: {valueLabel(player.value)}</span><span>Pensja: {formatMoney(player.wage)} / kolejkę</span></div>
          <div className="academy-player-actions"><button onClick={() => train(player)} disabled={isReady || game.cash < 15_000}>Trenuj · 15 000 zł</button><button className="academy-promote-button" onClick={() => promote(player)} disabled={game.squad.length >= 30 || game.cash < promotionCost}>Awansuj do kadry · {formatMoney(promotionCost)}</button></div>
          {isReady && <small className="academy-ready-note">Junior osiągnął swój potencjał. Możesz zdecydować o awansie do pierwszej drużyny.</small>}
        </article>
      })}</div> : <div className="empty-state"><Users size={20} /><span>{game.facilities.academy > 0 ? 'Zbudowana akademia będzie co 3 kolejki prowadzić nabór. Przyjmij juniorów, aby rozpocząć ich rozwój.' : 'Zbuduj akademię, aby prowadzić nabór i rozwijać własnych zawodników.'}</span></div>}
    </section>
    <p className="academy-development-note"><Activity size={14} /> Juniorzy rozwijają się automatycznie po każdym sezonie. Wyższy poziom akademii zwiększa tempo ich postępów i jakość nowych naborów.</p>
  </>
}

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="stat-card"><span className="stat-icon">{icon}</span><span><small>{label}</small><strong>{value}</strong></span></div>
}

export default App
