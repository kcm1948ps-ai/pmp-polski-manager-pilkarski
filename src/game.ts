import { leagueGroups, type LeagueTier } from './leagueData.ts'
import { warminskoMazurskieClubCities, warminskoMazurskieLeagueGroups } from './warminskoMazurskieLeagueData.ts'
import { lubuskieLeagueGroups } from './lubuskieLeagueData.ts'
import { opolskieLeagueGroups } from './opolskieLeagueData.ts'
import { createId } from './id.ts'
import {
  getLeagueRoundDate,
  getLocalDateKey,
  getPolishCupDrawDate,
  getPolishCupMatchSchedule,
  isPolishPublicHoliday,
  moveMatchDateOffPolishHoliday,
  parseLocalDateKey,
  type PolishCupScheduleStage,
} from './cupSchedule.ts'

type LeagueGroupId = keyof typeof leagueGroups
export type LeagueId = 'ekstraklasa' | 'first' | 'second' | 'third' | 'fourth' | LeagueGroupId
export type Position = 'BR' | 'PO' | 'ŚO' | 'LO' | 'DP' | 'ŚP' | 'OP' | 'PP' | 'LP' | 'PN' | 'LN' | 'ŚN'
export type TrainingFocus = 'fitness' | 'attack' | 'tactics'
export type Formation = '4-3-3' | '4-4-2' | '4-2-3-1' | '3-5-2' | '3-4-3' | '5-3-2' | '4-1-4-1' | '4-3-2-1'
export type TacticalStyle = 'balanced' | 'attacking' | 'counter'
export type PressingIntensity = 'low' | 'normal' | 'high'
export type CompetitionId = 'league' | 'polish-cup' | 'champions-cup' | 'friendly' | 'other'
export type MatchSquadRole = 'starting' | 'bench' | 'none'
export type PlayerSpecialRole = 'captain' | 'viceCaptain' | 'penaltyTaker' | 'freeKickTaker' | 'cornerTaker'
export type PlayerSpecialRoles = Record<PlayerSpecialRole, string | null>
export type PositionTraining = {
  targetPosition: Position
  sessionsCompleted: number
}
export type PlayerTrainingPlan = 'finishing' | 'playmaking' | 'fitness' | 'leadership'
export type PressConferenceChoice = 'confident' | 'respectful' | 'protective'

export type PlayerPromise = {
  kind: 'minutes' | 'wage' | 'stay'
  matchesRemaining: number
  startsRequired: number
  startsCompleted: number
}
export type PlayerPersonality = 'ambitious' | 'leader' | 'professional' | 'loyal' | 'temperamental'
export type MatchPreparationChoice = 'tactical' | 'recovery' | 'motivation'
export type DerbyMatchAction = 'home-tifo' | 'away-supporters-bus'

export function matchLineupRating(game: GameState, lineupIds = game.matchLineupIds, matchId?: string) {
  const lineup = lineupIds
    .map((id) => game.squad.find((player) => player.id === id))
    .filter((player): player is Player => Boolean(player))
  if (!lineup.length) return 0
  const roles = formationPositionOrders[game.tactics.formation]
  const total = lineup.reduce((sum, player, index) => {
    const target = roles[index]
    const multiplier = target && canPlayPosition(player, target) ? 1 : target === 'BR' || player.position === 'BR' ? 0.55 : 0.78
    const moraleAdjustment = Math.max(-3, Math.min(2, Math.round((player.morale - 70) / 15)))
    const personalityAdjustment = player.personality === 'professional' && player.stamina >= 70
      ? 1
      : player.personality === 'temperamental' && player.morale < 50
        ? -1
        : player.personality === 'ambitious' && player.morale >= 80
          ? 1
          : player.personality === 'loyal' && player.morale < 50
            ? 1
          : 0
    const teammates = lineup.filter((teammate) => teammate.id !== player.id)
    const chemistry = teammates.length
      ? Math.max(...teammates.map((teammate) => game.teamChemistry?.[chemistryKey(player.id, teammate.id)] ?? 50))
      : 50
    const chemistryAdjustment = Math.max(-3, Math.min(3, (chemistry - 50) / 6))
    return sum + (player.skill + moraleAdjustment + personalityAdjustment + chemistryAdjustment) * multiplier
  }, 0)
  return Math.round(total / lineup.length) + (matchId ? getMatchConferenceBonus(game, matchId) : 0)
}

export type CompetitionDiscipline = {
  yellowCardsTowardSuspension: number
  yellowCardsTotal: number
  redCards: number
  suspendedMatches: number
}

export function trainPlayerForPosition(game: GameState, playerId: string, targetPosition: Position) {
  const next = structuredClone(game)
  const player = next.squad.find((item) => item.id === playerId)
  if (!player) return { game, error: 'Nie znaleziono zawodnika w kadrze.' }
  if (player.position === 'BR') {
    return { game, error: 'Bramkarz nie może zmienić ani trenować dodatkowej pozycji w polu.' }
  }
  if (targetPosition === 'BR') {
    return { game, error: 'Zawodnik z pola nie może zmienić pozycji na bramkarza.' }
  }
  if (player.position === targetPosition || player.secondaryPositions?.includes(targetPosition)) {
    return { game, error: 'Zawodnik ma już tę pozycję w swoim profilu.' }
  }
  const sessionsRequired = positionTrainingSessionsRequired(player, targetPosition)
  if (sessionsRequired === null) return { game, error: 'Nie można rozpocząć treningu na wybranej pozycji.' }
  if ((player.secondaryPositions?.length ?? 0) >= 2 && player.positionTraining?.targetPosition !== targetPosition) {
    return { game, error: 'Zawodnik ma już odblokowane dwie dodatkowe pozycje.' }
  }
  const fee = 25_000
  if (next.cash < fee) return { game, error: 'Za mało środków na opłacenie treningu pozycyjnego.' }
  if (player.positionTraining?.targetPosition !== targetPosition) {
    player.positionTraining = { targetPosition, sessionsCompleted: 0 }
  }
  const training = player.positionTraining
  if (!training) return { game, error: 'Nie udało się rozpocząć treningu pozycyjnego.' }
  training.sessionsCompleted += 1
  const completed = training.sessionsCompleted >= sessionsRequired
  if (completed) {
    player.secondaryPositions = [...new Set([...(player.secondaryPositions ?? []), targetPosition])]
    player.positionTraining = null
    addPlayerHistory(player, {
      season: next.season,
      type: 'position',
      title: 'Nowa pozycja',
      details: `Odblokował grę jako ${targetPosition}.`,
    })
  }
  player.stamina = Math.max(35, player.stamina - 4)
  addFinance(next, `Trening pozycyjny: ${player.firstName} ${player.lastName}`, -fee)
  if (completed) {
    addMediaPost(next, 'KLUB', `${player.firstName} ${player.lastName} opanował nową pozycję`, `Po treningu zawodnik może teraz występować także jako ${targetPosition}.`)
    return { game: next, error: '', completedPosition: targetPosition, sessionsCompleted: sessionsRequired, sessionsRequired }
  }
  return { game: next, error: '', completedPosition: null, sessionsCompleted: training.sessionsCompleted, sessionsRequired }
}

export type MatchCardEvent = {
  playerId: string
  playerName: string
  teamId?: string
  minute?: number
  card: 'yellow' | 'red'
  secondYellow?: boolean
  suspensionApplied: boolean
}

export type MatchTimelineEvent = {
  minute: number
  addedTime?: number
  period: 'first-half' | 'second-half' | 'extra-time-first-half' | 'extra-time-second-half'
  type: 'goal' | 'own-goal' | 'penalty-goal' | 'penalty-missed'
  teamId: string
  playerId: string
  playerName: string
}

export type MatchTimelinePeriod = MatchTimelineEvent['period']

export type MatchPenaltyEvent = {
  order: number
  teamId: string
  playerId?: string
  playerName?: string
  scored: boolean
}

export type MatchSubstitutionEvent = {
  minute: number
  teamId: string
  outgoingPlayerId: string
  incomingPlayerId: string
  reason: 'manual' | 'fatigue' | 'injury'
}

export type MatchInjuryEvent = {
  minute: number
  teamId: string
  playerId: string
  playerName: string
  description: string
}

export type Tactics = {
  formation: Formation
  style: TacticalStyle
  pressing: PressingIntensity
}

export type TacticalMatchReport = {
  matchId?: string
  round: number
  score: string
  outcome: 'win' | 'draw' | 'loss'
  headline: string
  summary: string
  tacticalNote: string
  playerRatings?: MatchPlayerPerformance[]
}

export type MatchPlayerPerformance = {
  playerId: string
  playerName: string
  position: Position
  rating: number
  goals: number
  appearance: 'starting' | 'substitute'
}

export type MatchdayEventOption = {
  id: string
  label: string
  description: string
  attackModifier: number
  defenseModifier: number
  staminaModifier: number
}

export type MatchdayEvent = {
  id: string
  round: number
  matchId: string
  title: string
  description: string
  options: MatchdayEventOption[]
  substitutionsUsed?: number
  substitutedPlayerIds?: string[]
  substitutePlayerIds?: string[]
}

export const formationOptions: Array<{ id: Formation; label: string; description: string }> = [
  { id: '4-3-3', label: '4-3-3', description: 'Szeroka gra i mocniejszy atak.' },
  { id: '4-4-2', label: '4-4-2', description: 'Równowaga między obroną i atakiem.' },
  { id: '4-2-3-1', label: '4-2-3-1', description: 'Stabilny środek i kontrola meczu.' },
  { id: '3-5-2', label: '3-5-2', description: 'Przewaga w środku pola i dwóch napastników.' },
  { id: '3-4-3', label: '3-4-3', description: 'Bardzo ofensywne ustawienie z trzema napastnikami.' },
  { id: '5-3-2', label: '5-3-2', description: 'Szczelna obrona i szybkie kontry.' },
  { id: '4-1-4-1', label: '4-1-4-1', description: 'Zwarta obrona z jednym defensywnym pomocnikiem.' },
  { id: '4-3-2-1', label: '4-3-2-1', description: 'Kompaktowy środek pola i dwóch ofensywnych pomocników.' },
]

export const tacticalStyleOptions: Array<{ id: TacticalStyle; label: string; description: string }> = [
  { id: 'balanced', label: 'Zrównoważony', description: 'Bez dużego ryzyka, umiarkowane tempo.' },
  { id: 'attacking', label: 'Ofensywny', description: 'Więcej okazji kosztem bezpieczeństwa z tyłu.' },
  { id: 'counter', label: 'Kontratak', description: 'Szybkie wyjście po odbiorze piłki.' },
]

export const pressingOptions: Array<{ id: PressingIntensity; label: string; description: string }> = [
  { id: 'low', label: 'Niski', description: 'Oszczędza siły, mniej odbiorów wysoko.' },
  { id: 'normal', label: 'Normalny', description: 'Standardowa intensywność gry.' },
  { id: 'high', label: 'Wysoki', description: 'Mocny pressing, większe zmęczenie.' },
]

export type Player = {
  id: string
  firstName: string
  lastName: string
  shirtNumber?: number
  portraitDataUrl?: string
  age: number
  position: Position
  skill: number
  potential: number
  value: number
  wage: number
  contractSeasonsRemaining?: number
  relegationReleaseClause?: boolean
  morale: number
  personality?: PlayerPersonality
  moralePromise?: PlayerPromise | null
  lastConversationSeason?: string
  lastConversationRound?: number
  transferRequest?: boolean
  stamina: number
  discipline?: Partial<Record<CompetitionId, CompetitionDiscipline>>
  secondaryPositions?: Position[]
  positionTraining?: PositionTraining | null
  trainingPlan?: PlayerTrainingPlan
  trainingPlanSessions?: number
  seasonAppearances?: number
  seasonGoals?: number
  seasonAssists?: number
  seasonCleanSheets?: number
  seasonRatingTotal?: number
  seasonRatedAppearances?: number
  cupAppearances?: number
  cupGoals?: number
  careerAppearances?: number
  careerGoals?: number
  careerLeagueAndCupGoals?: number
  history?: PlayerHistoryEvent[]
  injury?: { description: string; matchesRemaining: number } | null
}

export type PlayerHistoryEvent = {
  season: string
  type: 'club' | 'overall' | 'position' | 'award'
  title: string
  details: string
}

function addPlayerHistory(player: Player, event: PlayerHistoryEvent) {
  player.history = [event, ...(player.history ?? [])].slice(0, 20)
}

export type Team = {
  id: string
  name: string
  regionId?: string
  strength: number
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  points: number
  headToHead?: Record<string, [points: number, goalsFor: number, goalsAgainst: number]>
  yellowCards?: number
  redCards?: number
  fairPlayPoints?: number
}

export type Match = {
  id: string
  round: number
  scheduledAt?: string
  kickoffTime?: string
  homeId: string
  awayId: string
  played: boolean
  bye?: boolean
  neutralVenue?: boolean
  venueId?: string
  competitionId?: CompetitionId
  disciplinaryEvents?: MatchCardEvent[]
  timeline?: MatchTimelineEvent[]
  extraTimePlayed?: boolean
  extraTimeHomeGoals?: number
  extraTimeAwayGoals?: number
  penaltyShootoutEvents?: MatchPenaltyEvent[]
  substitutions?: MatchSubstitutionEvent[]
  injuryEvents?: MatchInjuryEvent[]
  attendance?: number
  homeGoals?: number
  awayGoals?: number
}

export type FriendlyMatch = Match & {
  competitionId: 'friendly'
}

export type ChampionsCupMatch = Match & {
  winnerId?: string
  penaltyScore?: string
  season: string
  competitionId: 'champions-cup'
}

export type PolishCupStage = 'regional' | 'third' | 'second' | 'first' | 'ekstraklasa' | 'national' | 'complete'

export type PolishCupTeam = {
  id: string
  name: string
  strength: number
  leagueId: LeagueId
  regionId?: string
  isReserveTeam?: boolean
}

export type PolishCupMatch = Match & {
  stage: Exclude<PolishCupStage, 'complete'>
  poolId?: string
  winnerId?: string
  penaltyScore?: string
}

export type PolishCup = {
  season: string
  stage: PolishCupStage
  scheduleStage?: PolishCupScheduleStage
  drawAt?: string
  centralSeason?: boolean
  regionalRound: number
  scheduledAfterLeagueRound?: number
  teams: PolishCupTeam[]
  regionalPools: Record<string, string[]>
  participants: string[]
  heldEkstraklasaIds?: string[]
  matches: PolishCupMatch[]
  history: PolishCupMatch[]
  championId?: string
}

export type RegionalCup = {
  season: string
  regionId: string
  stageId: PolishCupScheduleStage
  teams: PolishCupTeam[]
  participants: string[]
  matches: PolishCupMatch[]
  history: PolishCupMatch[]
  championId?: string
}

export type PmpLeaguePhase =
  | 'groups'
  | 'regional-quarterfinal'
  | 'regional-semifinal'
  | 'regional-final'
  | 'national-first-round'
  | 'national-semifinal'
  | 'national-final'
  | 'complete'

export type PmpLeagueMatch = Match & {
  phase: Exclude<PmpLeaguePhase, 'complete'>
  regionId?: string
  groupId?: string
  winnerId?: string
  penaltyScore?: string
}

export type PmpLeagueGroup = {
  id: string
  regionId: string
  teamIds: string[]
}

export type PmpLeague = {
  season: string
  phase: PmpLeaguePhase
  startAt: string
  teams: PolishCupTeam[]
  groups: PmpLeagueGroup[]
  matches: PmpLeagueMatch[]
  history: PmpLeagueMatch[]
  regionalChampions: Record<string, string>
  nationalChampionId?: string
}

export type PromotionPlayoffFixture = {
  id: string
  leagueId: string
  competitionId?: string
  leagueName: string
  round: 1 | 2
  homeId: string
  awayId: string
  scheduledAt: string
  kickoffTime: string
  played: boolean
  bye?: false
  homeGoals?: number
  awayGoals?: number
  winnerId?: string
}

export type PromotionPlayoffs = {
  season: string
  round: 1 | 2 | 'complete'
  fixtures: PromotionPlayoffFixture[]
  history: PromotionPlayoffFixture[]
  promotedByLeague: Record<string, string>
  byeTeamIds?: Record<string, string>
  leagueWorldFinalized?: boolean
}

export type FinanceEntry = {
  id: string
  label: string
  amount: number
  date: string
}

export type CommercialOffer = {
  id: string
  company: string
  signingBonus: number
  paymentPerMatch: number
  duration: number
  description: string
  localPartner?: boolean
}

export type SignedDeal = CommercialOffer & {
  roundsRemaining: number
}

export type MediaPost = {
  id: string
  category: 'MECZ' | 'TRANSFER' | 'SPONSOR' | 'KLUB' | 'LIGA'
  headline: string
  body: string
  author: string
  date: string
  views: number
}

export type InboxMessage = {
  id: string
  sender: string
  subject: string
  body: string
  date: string
  read: boolean
  category: 'transfer' | 'club'
  status?: 'accepted' | 'countered' | 'rejected' | 'offered' | 'player-negotiation' | 'info'
  relatedNegotiationId?: string
  relatedTransferOfferId?: string
  relatedOutgoingListingId?: string
  relatedSponsorOfferId?: string
  action?: 'squad' | 'tactics' | 'club'
  seasonEvent?: {
    season: string
    choices: SeasonEventChoice[]
    selectedChoiceId?: string
    resolution?: string
  }
  playerStory?: {
    season: string
    playerId: string
    playerName: string
    playerGroup?: 'squad' | 'academy'
    relatedPlayerId?: string
    kind: 'minutes' | 'conflict' | 'mentoring' | 'academy-development'
    choices: Array<{
      id: string
      label: string
      description: string
      effects: { playerMorale: number; teammateMorale?: number; chemistry?: number; academySkill?: number; requestTransfer?: boolean; cash?: number }
      outcome: string
    }>
    selectedChoiceId?: string
    resolution?: string
  }
  polishCupDraw?: {
    drawDate: string
    season?: string
    stage: string
    regionalRound?: number
    groups?: string[]
    userParticipates?: boolean
    userGroup?: string
    fixtures: Array<{
      date: string
      kickoffTime: string
      homeId: string
      awayId: string
      poolId?: string
    }>
  }
  polishCupResults?: {
    season: string
    stage: string
    round: number
    groups?: string[]
    fixtures: Array<{
      date: string
      kickoffTime: string
      homeId: string
      awayId: string
      homeGoals: number
      awayGoals: number
      penaltyScore?: string
      poolId?: string
    }>
  }
}

export type SeasonEventChoice = {
  id: string
  label: string
  description: string
  outcome: string
  effects: {
    cash: number
    morale: number
    stamina: number
    confidence: number
    followers: number
    localReputation?: number
  }
}

export type ScoutExperience = 'rookie' | 'experienced' | 'expert'

export type Scout = {
  id: string
  name: string
  experience: ScoutExperience
  hiringCost: number
  wagePerRound: number
  roundsPerReport: number
  roundsUntilReport: number
  prospect: Player | null
}

export type StaffRole = 'fitness-coach' | 'technical-coach' | 'physiotherapist'

export type StaffMember = {
  id: string
  name: string
  role: StaffRole
  hiringCost: number
  wagePerRound: number
}

export type ClubPlayerOffer = {
  player: Player
  askingPrice: number
}

export type TransferNegotiation = {
  id: string
  clubId: string
  playerId: string
  offeredAmount: number
  counterAmount: number | null
  status: 'accepted' | 'countered' | 'rejected'
  counterRounds?: number
}

export type IncomingTransferOffer = {
  id: string
  outgoingListingId?: string
  clubId: string
  playerId: string
  offeredAmount: number
  counterAmount?: number
  agreedAmount?: number
  counterRounds?: number
  playerWageDemand?: number
  playerContractSeasons?: number
  playerNegotiationRounds?: number
  playerInterest?: number
  estimatedPlayerWage?: number
  estimatedPlayerContractSeasons?: number
  expiresAfterRound?: number
  status: 'pending' | 'countered' | 'player-negotiation' | 'accepted' | 'rejected'
  windowId: string
  createdRound: number
}

export type OutgoingPlayerTransferListing = {
  id: string
  playerId: string
  askingAmount: number
  clubIds: string[]
  offerIds: string[]
  createdRound: number
  status: 'active' | 'completed' | 'cancelled'
}

export type FacilityId = 'stand' | 'catering' | 'academy' | 'training'

export type Facilities = Record<FacilityId, number>

export type FacilityConstruction = {
  facilityId: FacilityId
  targetLevel: number
  targetCapacity?: number
  startedAt: number
  completesAt: number
}

export type SeasonRecord = {
  season: string
  leagueId: LeagueId
  leagueChange?: 'promotion' | 'relegation'
  finalPosition: number
  points: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  finalTable: Team[]
  topScorers: Array<{ playerId: string; name: string; goals: number; appearances: number }>
  awards?: SeasonAward[]
  teamOfSeason?: SeasonElevenPlayer[]
  honors?: string[]
  recordedAt: string
}

export type SeasonElevenPlayer = {
  playerId: string
  name: string
  clubId: string
  clubName: string
  position: Position
  rating: number
  appearances: number
}

export type SeasonAwardCategory =
  | 'top-scorer'
  | 'top-assists'
  | 'best-goalkeeper'
  | 'young-player'
  | 'player-of-season'

export type SeasonAward = {
  id: string
  category: SeasonAwardCategory
  title: string
  playerId: string
  playerName: string
  clubId: string
  clubName: string
  age: number
  value: number
  valueLabel: string
}

export type ClubTrophy = {
  id: string
  competition: 'league' | 'polish-cup' | 'regional-cup' | 'champions-cup'
  name: string
  season: string
  leagueId?: LeagueId
  regionId?: string
}

export type BoardGoal = {
  season: string
  targetPosition: number
  startingCash: number
  targetCash: number
  reward: number
}

export type BoardReview = {
  season: string
  leagueId: LeagueId
  finalPosition: number
  finalCash: number
  positionAchieved: boolean
  financesAchieved: boolean
  trustChange: number
  confidenceAfter: number
  rewardPaid: number
}

export type ManagerCareerRecord = {
  completedSeasons: number
  leagueMatches: number
  leagueWins: number
  promotions: number
  leagueTitles: number
  academyDebuts: number
  leagueGoals: number
}

export type ManagerAchievement = {
  id: string
  title: string
  description: string
  progress: number
  target: number
  unlocked: boolean
}

export type ManagerCareerProfile = {
  experience: number
  level: number
  levelTitle: string
  currentLevelExperience: number
  nextLevelExperience: number | null
  levelProgress: number
  completedSeasons: number
  leagueMatches: number
  leagueWins: number
  promotions: number
  leagueTitles: number
  trophies: number
  academyDebuts: number
  achievements: ManagerAchievement[]
}

export type ClubRivalry = {
  opponentId: string
  opponentName: string
  matches: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  derbyMatches: number
  rivalryPoints: number
  recentResults: Array<'W' | 'D' | 'L'>
  recentMatches?: Array<{
    season: string
    round: number
    competition: 'league' | 'polish-cup' | 'regional-cup'
    score: string
    result: 'W' | 'D' | 'L'
  }>
  lastMatchCompetition?: 'league' | 'polish-cup' | 'regional-cup'
  lastMatchSeason: string
  lastMatchRound: number
  lastScore: string
}

export type ClubChallenge = {
  id: string
  round: number
  opponentName: string
  isHome: boolean
  matchPlayed: boolean
  title: string
  description: string
  progress: string
  reward: number
  completed: boolean
  claimed: boolean
}

export type GameState = {
  version: 1
  clubName: string
  clubType: 'custom' | 'existing'
  city: string
  leagueId: LeagueId
  leagueWorld?: Record<string, Team[]>
  clubColor: string
  clubCrestDataUrl?: string
  clubCrestsByTeamId?: Record<string, string>
  cash: number
  ticketPrice: number
  stadiumCapacity: number
  round: number
  season: string
  leagueMatchupsPerOpponent?: number
  teamId: string
  teams: Team[]
  squad: Player[]
  lineupIds: string[]
  matchLineupIds: string[]
  matchLineupPositions?: { formation: Formation; slots: Record<string, string> }
  matchBenchIds: string[]
  playerSpecialRoles?: PlayerSpecialRoles
  matchOutsideSquadIds?: string[]
  previousMatchLineupIds: string[]
  previousMatchBenchIds: string[]
  market: Player[]
  clubSquads: Record<string, ClubPlayerOffer[]>
  transferNegotiations: TransferNegotiation[]
  incomingTransferOffers?: IncomingTransferOffer[]
  outgoingPlayerTransferListings?: OutgoingPlayerTransferListing[]
  matches: Match[]
  preseasonFriendlies?: FriendlyMatch[]
  polishCup?: PolishCup
  championsCupMatch?: ChampionsCupMatch
  regionalCups?: RegionalCup[]
  pmpLeague?: PmpLeague
  regionalCupWinners?: Record<string, Record<string, string[]>>
  regionalCupWinnerNames?: Record<string, Record<string, string>>
  cupPrizeMoney?: Record<string, number>
  promotionPlayoffs?: PromotionPlayoffs
  leagueSeasonExceptions?: LeagueSeasonExceptions
  currentDate?: string
  finances: FinanceEntry[]
  commercialOffers: { sponsors: CommercialOffer[]; tv: CommercialOffer[] }
  sponsorDeal: SignedDeal | null
  tvDeal: SignedDeal | null
  sponsorRequired: boolean
  negotiatedSponsorOfferIds: string[]
  facilities: Facilities
  facilityConstruction: FacilityConstruction | null
  academyProspect: Player | null
  academyPlayers?: Player[]
  scouts: Scout[]
  staff?: StaffMember[]
  tactics: Tactics
  lastMatchReport: TacticalMatchReport | null
  pendingMatchEvent?: MatchdayEvent
  pendingMatchPreparation?: { matchId: string; choice: MatchPreparationChoice }
  pendingMatchConference?: { matchId: string; choice: PressConferenceChoice }
  pendingDerbyMatchAction?: { matchId: string; choice: DerbyMatchAction }
  pressConferenceHistory?: Array<{ matchId: string; season: string; choice: PressConferenceChoice }>
  loanDeals?: LoanDeal[]
  teamChemistry?: Record<string, number>
  followers: number
  localReputation?: number
  totalHomeAttendance: number
  homeMatchesPlayed: number
  mediaPosts: MediaPost[]
  inboxMessages?: InboxMessage[]
  seasonHistory?: SeasonRecord[]
  trophyCabinet?: ClubTrophy[]
  boardConfidence?: number
  boardGoal?: BoardGoal
  boardHistory?: BoardReview[]
  claimedClubChallengeIds?: string[]
  managerCareer?: ManagerCareerRecord
  clubRivalries?: ClubRivalry[]
  sponsorWinStreak?: number
  sponsorLossStreak?: number
  sponsorWarningIssued?: boolean
  sponsorSigningBonusAvailable?: boolean
  debt: number
  nextDebtSanctionAt?: number
  pendingForcedRelegation?: boolean
  pendingLeaguePointDeduction?: number
  pendingDebtSettlement?: boolean
}

export type LeagueSeasonExceptions = {
  season: string
  promotionDeclinedTeamIds?: string[]
  licenseDeniedTeamIds?: string[]
  withdrawnTeamIds?: string[]
}

export type LoanDeal = {
  id: string
  direction: 'in' | 'out'
  player: Player
  parentClubId: string
  destinationClubId: string
  fee: number
  season: string
}

const playerPersonalities: PlayerPersonality[] = ['ambitious', 'leader', 'professional', 'loyal', 'temperamental']
export const playerPersonalityLabels: Record<PlayerPersonality, string> = {
  ambitious: 'Ambitny',
  leader: 'Lider',
  professional: 'Profesjonalista',
  loyal: 'Lojalny',
  temperamental: 'Temperamentny',
}

function stableHash(value: string) {
  let hash = 2166136261
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
  return hash >>> 0
}

function chemistryKey(firstId: string, secondId: string) {
  return [firstId, secondId].sort().join('::')
}

function createTeamChemistry(squad: Player[]) {
  const chemistry: Record<string, number> = {}
  for (let first = 0; first < squad.length; first += 1) {
    for (let second = first + 1; second < squad.length; second += 1) {
      chemistry[chemistryKey(squad[first].id, squad[second].id)] = 48 + stableHash(`${squad[first].id}:${squad[second].id}`) % 5
    }
  }
  return chemistry
}

function adjustTeamChemistry(game: GameState, playerIds: string[], change: number) {
  game.teamChemistry ??= {}
  for (let first = 0; first < playerIds.length; first += 1) {
    for (let second = first + 1; second < playerIds.length; second += 1) {
      const key = chemistryKey(playerIds[first], playerIds[second])
      game.teamChemistry[key] = Math.max(0, Math.min(100, (game.teamChemistry[key] ?? 50) + change))
    }
  }
}

export type DerbyKind = 'city' | 'district'

export function getDerbyKind(game: GameState, opponentName: string, competition?: 'regional-cup'): DerbyKind | null {
  const clubCity = game.city.trim().toLocaleLowerCase('pl-PL')
  const opponentCity = getClubCity(opponentName).trim().toLocaleLowerCase('pl-PL')
  if (clubCity !== '' && clubCity !== 'polska' && opponentCity === clubCity) return 'city'
  if (getLeagueTier(game.leagueId) >= 6
    && game.teams.some((team) => team.id !== game.teamId && team.name === opponentName)) return 'district'
  if (competition === 'regional-cup' && game.regionalCups?.some((cup) =>
    cup.teams.some((team) => team.id === game.teamId)
    && cup.teams.some((team) => team.id !== game.teamId && team.name === opponentName),
  )) return 'district'
  return null
}

export function isLocalDerby(game: GameState, opponentName: string, competition?: 'regional-cup') {
  return getDerbyKind(game, opponentName, competition) !== null
}

export function getClubRivalries(game: GameState) {
  return [...(game.clubRivalries ?? [])].sort((first, second) =>
    second.rivalryPoints - first.rivalryPoints
    || second.matches - first.matches
    || first.opponentName.localeCompare(second.opponentName, 'pl-PL'),
  )
}

export function getClubRivalry(game: GameState, opponentId: string) {
  return game.clubRivalries?.find((rivalry) => rivalry.opponentId === opponentId)
}

export function getClubRivalryLevel(rivalry: ClubRivalry) {
  if (rivalry.rivalryPoints >= 14) return 'Odwieczny rywal'
  if (rivalry.rivalryPoints >= 7) return 'Gorąca rywalizacja'
  if (rivalry.rivalryPoints >= 3) return 'Narastająca rywalizacja'
  return 'Pierwsze spotkania'
}

export function recordClubRivalryMatch(
  game: GameState,
  opponentId: string,
  opponentName: string,
  goalsFor: number,
  goalsAgainst: number,
  isDerby: boolean,
  competition: 'league' | 'polish-cup' | 'regional-cup' = 'league',
  round = game.round,
  winnerId?: string,
) {
  game.clubRivalries ??= []
  let rivalry = game.clubRivalries.find((item) => item.opponentId === opponentId)
  if (!rivalry) {
    rivalry = {
      opponentId,
      opponentName,
      matches: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      derbyMatches: 0,
      rivalryPoints: 0,
      recentResults: [],
      recentMatches: [],
      lastMatchSeason: game.season,
      lastMatchRound: game.round,
      lastScore: '',
    }
    game.clubRivalries.push(rivalry)
  }
  const result: ClubRivalry['recentResults'][number] = goalsFor === goalsAgainst && winnerId
    ? winnerId === game.teamId ? 'W' : 'L'
    : goalsFor > goalsAgainst ? 'W' : goalsFor === goalsAgainst ? 'D' : 'L'
  rivalry.opponentName = opponentName
  rivalry.matches += 1
  rivalry.wins += Number(result === 'W')
  rivalry.draws += Number(result === 'D')
  rivalry.losses += Number(result === 'L')
  rivalry.goalsFor += goalsFor
  rivalry.goalsAgainst += goalsAgainst
  rivalry.derbyMatches += Number(isDerby)
  rivalry.rivalryPoints = Math.min(100, rivalry.rivalryPoints + 1 + Number(isDerby) * 3 + Number(Math.abs(goalsFor - goalsAgainst) <= 1))
  rivalry.recentResults.push(result)
  if (rivalry.recentResults.length > 5) rivalry.recentResults.shift()
  rivalry.recentMatches ??= []
  rivalry.recentMatches.push({
    season: game.season,
    round,
    competition,
    score: `${goalsFor} : ${goalsAgainst}`,
    result,
  })
  if (rivalry.recentMatches.length > 5) rivalry.recentMatches.shift()
  rivalry.lastMatchSeason = game.season
  rivalry.lastMatchRound = round
  rivalry.lastMatchCompetition = competition
  rivalry.lastScore = `${goalsFor} : ${goalsAgainst}`
  return rivalry
}

function summarizeClubRivalriesFromMatches(game: GameState) {
  const rivalries: ClubRivalry[] = []
  game.clubRivalries = rivalries
  for (const match of [...game.matches]
    .filter((item) => item.played && !item.bye && (item.homeId === game.teamId || item.awayId === game.teamId))
    .sort((first, second) => first.round - second.round)) {
    const isHome = match.homeId === game.teamId
    const opponentId = isHome ? match.awayId : match.homeId
    const opponentName = getTeamName(game, opponentId)
    const rivalry = recordClubRivalryMatch(
      game,
      opponentId,
      opponentName,
      isHome ? match.homeGoals ?? 0 : match.awayGoals ?? 0,
      isHome ? match.awayGoals ?? 0 : match.homeGoals ?? 0,
      isLocalDerby(game, opponentName),
    )
    rivalry.lastMatchSeason = game.season
    rivalry.lastMatchRound = match.round
  }
  return rivalries
}

export function saveMatchPreparation(game: GameState, matchId: string, choice: MatchPreparationChoice) {
  const isUpcomingFixture = [
    ...game.matches,
    ...(game.preseasonFriendlies ?? []),
    ...(game.polishCup?.matches ?? []),
    ...(game.regionalCups ?? []).flatMap((cup) => cup.matches),
    ...(game.championsCupMatch ? [game.championsCupMatch] : []),
  ].some((match) =>
    match.id === matchId
    && !match.played
    && !match.bye
    && (match.homeId === game.teamId || match.awayId === game.teamId),
  ) || Boolean(game.promotionPlayoffs?.fixtures.some((fixture) =>
    fixture.id === matchId
    && !fixture.played
    && (fixture.homeId === game.teamId || fixture.awayId === game.teamId),
  ))
  if (!isUpcomingFixture) return { game, error: 'Nie znaleziono nadchodzącego meczu do przygotowania.' }
  const next = structuredClone(game)
  next.pendingMatchPreparation = { matchId, choice }
  return { game: next, error: '' }
}

export function saveMatchConference(game: GameState, matchId: string, choice: PressConferenceChoice) {
  const isUpcomingFixture = [
    ...game.matches,
    ...(game.preseasonFriendlies ?? []),
    ...(game.polishCup?.matches ?? []),
    ...(game.regionalCups ?? []).flatMap((cup) => cup.matches),
    ...(game.championsCupMatch ? [game.championsCupMatch] : []),
    ...(game.promotionPlayoffs?.fixtures ?? []),
  ].some((match) =>
    match.id === matchId
    && !match.played
    && !match.bye
    && (match.homeId === game.teamId || match.awayId === game.teamId),
  )
  if (!isUpcomingFixture) return { game, error: 'Nie znaleziono nadchodzącego meczu do konferencji.' }
  const next = structuredClone(game)
  next.pendingMatchConference = { matchId, choice }
  next.pressConferenceHistory ??= []
  next.pressConferenceHistory = [
    { matchId, season: next.season, choice },
    ...next.pressConferenceHistory.filter((item) => item.matchId !== matchId),
  ].slice(0, 40)
  return { game: next, error: '' }
}

export function saveDerbyMatchAction(game: GameState, matchId: string, choice: DerbyMatchAction | 'none') {
  const fixtures = [
    ...game.matches.map((match) => ({ match, competition: undefined as 'regional-cup' | undefined })),
    ...(game.polishCup?.matches ?? []).map((match) => ({ match, competition: undefined as 'regional-cup' | undefined })),
    ...(game.regionalCups ?? []).flatMap((cup) =>
      cup.matches.map((match) => ({ match, competition: 'regional-cup' as const })),
    ),
  ]
  const fixture = fixtures.find(({ match }) =>
    match.id === matchId && !match.played && !match.bye
    && (match.homeId === game.teamId || match.awayId === game.teamId),
  )
  if (!fixture) return { game, error: 'Nie znaleziono nadchodzącego meczu do organizacji derbowej.' }
  const opponentId = fixture.match.homeId === game.teamId ? fixture.match.awayId : fixture.match.homeId
  const opponentName = getTeamName(game, opponentId)
  if (!isLocalDerby(game, opponentName, fixture.competition)) {
    return { game, error: 'Dodatkową organizację można zaplanować tylko na mecz derbowy.' }
  }
  if (choice === 'home-tifo' && fixture.match.homeId !== game.teamId) {
    return { game, error: 'Oprawę kibiców można przygotować tylko na meczu domowym.' }
  }
  if (choice === 'away-supporters-bus' && fixture.match.awayId !== game.teamId) {
    return { game, error: 'Autokar kibiców można zorganizować tylko na mecz wyjazdowy.' }
  }
  const previous = game.pendingDerbyMatchAction?.matchId === matchId
    ? game.pendingDerbyMatchAction.choice
    : undefined
  const previousCost = previous === 'home-tifo' ? 15_000 : previous === 'away-supporters-bus' ? 10_000 : 0
  const nextCost = choice === 'home-tifo' ? 15_000 : choice === 'away-supporters-bus' ? 10_000 : 0
  if (game.cash + previousCost < nextCost) {
    return { game, error: `Klub potrzebuje ${nextCost.toLocaleString('pl-PL')} zł na tę organizację derbową.` }
  }
  const next = structuredClone(game)
  if (previousCost) addFinance(next, 'Odwołanie organizacji derbowej', previousCost)
  if (nextCost) addFinance(next, choice === 'home-tifo' ? 'Oprawa kibiców na derby' : 'Autokar kibiców na derby', -nextCost)
  if (choice === 'none') {
    next.pendingDerbyMatchAction = undefined
  } else {
    next.pendingDerbyMatchAction = { matchId, choice }
  }
  return { game: next, error: '' }
}

function applyDerbyMatchAction(game: GameState, matchId: string) {
  const action = game.pendingDerbyMatchAction
  if (!action || action.matchId !== matchId) return
  game.localReputation = Math.max(0, Math.min(100, (game.localReputation ?? 35) + 2))
  if (action.choice === 'home-tifo') {
    game.followers += 400
  } else {
    game.followers += 450
    game.squad.forEach((player) => {
      player.morale = Math.min(100, player.morale + 1)
    })
  }
  game.pendingDerbyMatchAction = undefined
}

function getMatchConferenceChoice(game: GameState, matchId: string) {
  return game.pendingMatchConference?.matchId === matchId
    ? game.pendingMatchConference.choice
    : undefined
}

function getMatchConferenceBonus(game: GameState, matchId: string) {
  const choice = getMatchConferenceChoice(game, matchId)
  return choice === 'confident' ? 2 : choice === 'respectful' ? 1 : 0
}

function applyConferenceRecovery(game: GameState, matchId: string, lineupIds: string[]) {
  if (getMatchConferenceChoice(game, matchId) !== 'protective') return
  const starters = new Set(lineupIds)
  game.squad.forEach((player) => {
    if (starters.has(player.id)) player.stamina = Math.min(100, player.stamina + 3)
  })
}

export function setPlayerTrainingPlan(game: GameState, playerId: string, plan?: PlayerTrainingPlan) {
  const next = structuredClone(game)
  const player = next.squad.find((candidate) => candidate.id === playerId)
  if (!player) return { game, error: 'Nie znaleziono zawodnika w kadrze.' }
  if (plan) player.trainingPlan = plan
  else delete player.trainingPlan
  player.trainingPlanSessions = 0
  return { game: next, error: '' }
}

export function loanPlayerIn(game: GameState, clubId: string, playerId: string) {
  if (!getTransferWindowInfo(game).isOpen) return { game, error: 'Okno transferowe jest zamknięte.' }
  const next = structuredClone(game)
  const offers = next.clubSquads[clubId]
  const offerIndex = offers?.findIndex((offer) => offer.player.id === playerId) ?? -1
  if (offerIndex < 0 || !offers) return { game, error: 'Ten zawodnik nie jest dostępny do wypożyczenia.' }
  if (next.squad.length >= 30) return { game, error: 'Kadra ma już maksymalny rozmiar (30 zawodników).' }
  if (next.loanDeals?.some((deal) => deal.player.id === playerId)) return { game, error: 'Ten zawodnik jest już objęty wypożyczeniem.' }
  const offer = offers[offerIndex]
  const parentPlayer = structuredClone(offer.player)
  const fee = Math.max(5_000, Math.round(offer.player.value * 0.05 / 1000) * 1000)
  if (next.cash < fee) return { game, error: `Wypożyczenie kosztuje ${fee.toLocaleString('pl-PL')} zł.` }
  const player = structuredClone(offer.player)
  player.morale = Math.max(player.morale, 65)
  assignNextSquadNumber(player, next.squad)
  next.squad.push(player)
  offers.splice(offerIndex, 1)
  syncTeamStrength(next, clubId, offers.map((item) => item.player))
  syncTeamStrength(next, next.teamId, next.squad)
  next.loanDeals ??= []
  next.loanDeals.push({
    id: createId(),
    direction: 'in',
    player: parentPlayer,
    parentClubId: clubId,
    destinationClubId: next.teamId,
    fee,
    season: next.season,
  })
  addFinance(next, `Wypożyczenie: ${player.firstName} ${player.lastName}`, -fee)
  addPlayerHistory(player, { season: next.season, type: 'club', title: next.clubName, details: `Dołączył na wypożyczenie z klubu ${getTeamName(next, clubId)}.` })
  addMediaPost(next, 'TRANSFER', `${player.firstName} ${player.lastName} na wypożyczeniu w ${next.clubName}`, `Zawodnik dołączył do klubu do końca sezonu ${next.season}.`)
  return { game: next, error: '' }
}

export function loanPlayerOut(game: GameState, playerId: string, destinationClubId: string) {
  if (!getTransferWindowInfo(game).isOpen) return { game, error: 'Okno transferowe jest zamknięte.' }
  const next = structuredClone(game)
  const playerIndex = next.squad.findIndex((candidate) => candidate.id === playerId)
  const destination = next.teams.find((team) => team.id === destinationClubId)
    ?? Object.values(next.leagueWorld ?? {}).flat().find((team) => team.id === destinationClubId)
  if (playerIndex < 0) return { game, error: 'Nie znaleziono zawodnika w kadrze.' }
  if (!destination || destinationClubId === next.teamId) return { game, error: 'Wybierz inny klub jako cel wypożyczenia.' }
  if (!next.clubSquads[destinationClubId]) return { game, error: 'Najpierw otwórz rynek wybranego klubu, aby przygotować jego kadrę.' }
  if (next.squad.length <= 11) return { game, error: 'Kadra musi liczyć co najmniej 11 zawodników.' }
  if (next.loanDeals?.some((deal) => deal.player.id === playerId)) return { game, error: 'Ten zawodnik jest już objęty wypożyczeniem.' }
  const player = next.squad[playerIndex]
  if (next.inboxMessages?.some((message) =>
    message.playerStory?.playerId === playerId && !message.playerStory.selectedChoiceId,
  )) return { game, error: 'Najpierw odpowiedz na nierozstrzygniętą prośbę tego zawodnika.' }
  if (player.moralePromise) return { game, error: 'Nie możesz wypożyczyć zawodnika, dopóki nie rozliczycie złożonej mu obietnicy.' }
  next.squad.splice(playerIndex, 1)
  const destinationPlayer = structuredClone(player)
  assignNextSquadNumber(destinationPlayer, next.clubSquads[destinationClubId].map((offer) => offer.player))
  next.clubSquads[destinationClubId].push({ player: destinationPlayer, askingPrice: player.value })
  next.lineupIds = next.lineupIds.filter((id) => id !== playerId)
  next.matchLineupIds = next.matchLineupIds.filter((id) => id !== playerId)
  next.matchBenchIds = next.matchBenchIds.filter((id) => id !== playerId)
  next.previousMatchLineupIds = next.previousMatchLineupIds.filter((id) => id !== playerId)
  next.previousMatchBenchIds = next.previousMatchBenchIds.filter((id) => id !== playerId)
  const lineup = completeMatchSquad(next, next.lineupIds, next.matchBenchIds, 'league')
  next.lineupIds = lineup.starters
  const matchSquad = completeMatchSquad(next, next.matchLineupIds, next.matchBenchIds, 'league')
  next.matchLineupIds = matchSquad.starters
  next.matchBenchIds = matchSquad.bench
  next.loanDeals ??= []
  next.loanDeals.push({
    id: createId(),
    direction: 'out',
    player: structuredClone(player),
    parentClubId: next.teamId,
    destinationClubId,
    fee: 0,
    season: next.season,
  })
  if (next.teamChemistry) {
    Object.keys(next.teamChemistry).forEach((key) => {
      if (key.split('::').includes(playerId)) delete next.teamChemistry?.[key]
    })
  }
  syncTeamStrength(next, next.teamId, next.squad)
  syncTeamStrength(next, destinationClubId, next.clubSquads[destinationClubId].map((offer) => offer.player))
  addPlayerHistory(player, { season: next.season, type: 'club', title: destination.name, details: `Wypożyczony z ${next.clubName} do końca sezonu ${next.season}.` })
  addMediaPost(next, 'TRANSFER', `${player.firstName} ${player.lastName} wypożyczony`, `Zawodnik spędzi sezon ${next.season} w klubie ${destination.name}.`)
  return { game: next, error: '' }
}

function completeSeasonLoans(game: GameState) {
  const deals = game.loanDeals ?? []
  if (!deals.length) return
  deals.forEach((deal) => {
    if (deal.direction === 'out') {
      game.clubSquads[deal.destinationClubId] = (game.clubSquads[deal.destinationClubId] ?? [])
        .filter((offer) => offer.player.id !== deal.player.id)
      syncTeamStrength(game, deal.destinationClubId, (game.clubSquads[deal.destinationClubId] ?? []).map((offer) => offer.player))
      if (!game.squad.some((player) => player.id === deal.player.id)) {
        const returningPlayer = structuredClone(deal.player)
        assignNextSquadNumber(returningPlayer, game.squad)
        game.squad.push(returningPlayer)
        addPlayerHistory(returningPlayer, {
          season: game.season,
          type: 'club',
          title: game.clubName,
          details: `Wrócił z wypożyczenia do klubu ${getTeamName(game, deal.destinationClubId)}.`,
        })
      }
    } else {
      game.squad = game.squad.filter((player) => player.id !== deal.player.id)
      const parentOffers = game.clubSquads[deal.parentClubId]
      if (parentOffers && !parentOffers.some((offer) => offer.player.id === deal.player.id)) {
        const returningPlayer = structuredClone(deal.player)
        assignNextSquadNumber(returningPlayer, parentOffers.map((offer) => offer.player))
        parentOffers.push({ player: returningPlayer, askingPrice: deal.player.value })
      }
      syncTeamStrength(game, deal.parentClubId, (game.clubSquads[deal.parentClubId] ?? []).map((offer) => offer.player))
    }
    addInboxMessage(
      game,
      'Dział sportowy',
      `Koniec wypożyczenia: ${deal.player.firstName} ${deal.player.lastName}`,
      deal.direction === 'out'
        ? `${deal.player.firstName} ${deal.player.lastName} wraca z wypożyczenia i ponownie dołącza do kadry.`
        : `${deal.player.firstName} ${deal.player.lastName} wraca do klubu ${getTeamName(game, deal.parentClubId)}.`,
      'info',
      'club',
    )
  })
  game.loanDeals = []
  syncTeamStrength(game, game.teamId, game.squad)
}

function autoAssignPlayerSpecialRoles(squad: Player[], captainCandidateIds = squad.map((player) => player.id)): PlayerSpecialRoles {
  const captainCandidates = squad.filter((player) => captainCandidateIds.includes(player.id))
  const experiencedPlayers = [...captainCandidates].sort((first, second) =>
    (second.age * 0.6 + second.skill * 0.4) - (first.age * 0.6 + first.skill * 0.4),
  )
  const mostSkilledPlayers = [...squad].sort((first, second) => second.skill - first.skill || second.age - first.age)
  return {
    captain: experiencedPlayers[0]?.id ?? null,
    viceCaptain: experiencedPlayers.find((player) => player.id !== experiencedPlayers[0]?.id)?.id ?? null,
    penaltyTaker: mostSkilledPlayers[0]?.id ?? null,
    freeKickTaker: mostSkilledPlayers[1]?.id ?? mostSkilledPlayers[0]?.id ?? null,
    cornerTaker: mostSkilledPlayers[2]?.id ?? mostSkilledPlayers[0]?.id ?? null,
  }
}

export function getEffectivePlayerSpecialRoles(game: GameState, activePlayerIds = game.matchLineupIds, competition: CompetitionId = 'league'): PlayerSpecialRoles {
  const availablePlayers = activePlayerIds
    .map((id) => game.squad.find((player) =>
      player.id === id
      && getInjuryMatches(player) === 0
      && getSuspensionMatches(player, competition) === 0,
    ))
    .filter((player): player is Player => Boolean(player))
  const selectedRoles = game.playerSpecialRoles ?? autoAssignPlayerSpecialRoles(game.squad)
  const byExperience = [...availablePlayers].sort((first, second) =>
    (second.age * 0.6 + second.skill * 0.4) - (first.age * 0.6 + first.skill * 0.4),
  )
  const bySkill = [...availablePlayers].sort((first, second) => second.skill - first.skill || second.age - first.age)
  const effective = (role: PlayerSpecialRole, fallback: Player | undefined) =>
    availablePlayers.some((player) => player.id === selectedRoles[role]) ? selectedRoles[role] : fallback?.id ?? null
  const captain = availablePlayers.some((player) => player.id === selectedRoles.captain)
    ? selectedRoles.captain
    : availablePlayers.some((player) => player.id === selectedRoles.viceCaptain)
      ? selectedRoles.viceCaptain
      : byExperience[0]?.id ?? null
  const viceCaptain = availablePlayers.some((player) => player.id === selectedRoles.viceCaptain && player.id !== captain)
    ? selectedRoles.viceCaptain
    : byExperience.find((player) => player.id !== captain)?.id ?? null
  return {
    captain,
    viceCaptain,
    penaltyTaker: effective('penaltyTaker', bySkill[0]),
    freeKickTaker: effective('freeKickTaker', bySkill.find((player) => player.id !== selectedRoles.penaltyTaker) ?? bySkill[0]),
    cornerTaker: effective('cornerTaker', bySkill.find((player) => player.id !== selectedRoles.penaltyTaker && player.id !== selectedRoles.freeKickTaker) ?? bySkill[0]),
  }
}

export function setPlayerSpecialRole(game: GameState, playerId: string, role: PlayerSpecialRole) {
  if (!game.squad.some((player) => player.id === playerId)) {
    return { game, error: 'Nie znaleziono zawodnika w kadrze.' }
  }
  const next = structuredClone(game)
  const roles = {
    ...(next.playerSpecialRoles ?? autoAssignPlayerSpecialRoles(next.squad)),
    [role]: playerId,
  }
  if (role === 'captain' && roles.viceCaptain === playerId) {
    roles.viceCaptain = game.playerSpecialRoles?.captain ?? null
  }
  if (role === 'viceCaptain' && roles.captain === playerId) {
    roles.captain = game.playerSpecialRoles?.viceCaptain ?? null
  }
  next.playerSpecialRoles = roles
  return { game: next, error: '' }
}

export const leagues: Array<{ id: LeagueId; name: string; subtitle: string; selectable?: boolean }> = [
  { id: 'ekstraklasa', name: 'Superklasa', subtitle: 'Najwyższa klasa rozgrywkowa · 18 klubów' },
  { id: 'first', name: 'Pierwsza Liga Polska', subtitle: 'Drugi poziom · 18 klubów' },
  { id: 'second', name: 'Druga Liga Polska', subtitle: 'Trzeci poziom · 18 klubów' },
  ...Object.entries(leagueGroups).map(([id, group]) => ({
    id: id as LeagueGroupId,
    name: group.name,
    subtitle: `${group.subtitle} · ${group.clubs.length} klubów`,
  })),
  { id: 'third', name: 'Trzecia Liga Polska', subtitle: 'Poprzedni zapis · grupa I', selectable: false },
  { id: 'fourth', name: 'Czwarta liga Polska', subtitle: 'Poprzedni zapis · grupa mazowiecka', selectable: false },
]

export const transferMarketTiers: Array<{ tier: LeagueTier; name: string }> = [
  { tier: 1, name: 'Superklasa' },
  { tier: 2, name: 'Pierwsza Liga Polska' },
  { tier: 3, name: 'Druga Liga Polska' },
  { tier: 4, name: 'Trzecia Liga Polska' },
  { tier: 5, name: 'Czwarta liga Polska' },
  { tier: 6, name: 'Liga okręgowa' },
  { tier: 7, name: 'A klasa' },
  { tier: 8, name: 'B klasa' },
]

export function getTransferMarketGroups(game: GameState, tier: LeagueTier) {
  return Object.keys(game.leagueWorld ?? {})
    .filter((leagueId) => leagueId !== 'third' && leagueId !== 'fourth' && getLeagueTier(leagueId as LeagueId) === tier)
    .map((leagueId) => ({
      id: leagueId,
      name: leagues.find((league) => league.id === leagueId)?.name ?? leagueId,
    }))
    .sort((first, second) => first.name.localeCompare(second.name, 'pl'))
}

export function getTransferMarketTeams(game: GameState, leagueId: string) {
  return (game.leagueWorld?.[leagueId] ?? [])
    .filter((team) => team.id !== game.teamId)
}

function getRelevantClubSquadIds(game: GameState, additionalTeamIds: string[] = []) {
  return new Set([
    ...game.teams.filter((team) => team.id !== game.teamId).map((team) => team.id),
    ...(game.transferNegotiations ?? [])
      .filter((negotiation) => negotiation.status !== 'rejected')
      .map((negotiation) => negotiation.clubId),
    ...(game.loanDeals ?? []).flatMap((deal) => [deal.parentClubId, deal.destinationClubId]),
    ...additionalTeamIds,
  ])
}

export function createGameSaveSnapshot(game: GameState): GameState {
  const relevantIds = getRelevantClubSquadIds(game)
  return {
    ...game,
    clubSquads: Object.fromEntries(
      Object.entries(game.clubSquads).filter(([teamId]) => relevantIds.has(teamId)),
    ),
  }
}

export function prepareTransferMarketLeague(game: GameState, leagueId: string) {
  const leagueTeams = game.leagueWorld?.[leagueId]
  if (!leagueTeams) return { game, error: 'Nie znaleziono wybranej ligi.' }
  const relevantIds = getRelevantClubSquadIds(game, leagueTeams.map((team) => team.id))
  const retainedClubSquads = Object.fromEntries(
    Object.entries(game.clubSquads).filter(([teamId]) => relevantIds.has(teamId)),
  )
  const missingTeams = leagueTeams.filter((team) => team.id !== game.teamId && !retainedClubSquads[team.id])
  if (!missingTeams.length && Object.keys(retainedClubSquads).length === Object.keys(game.clubSquads).length) {
    return { game, error: '' }
  }
  const next = { ...game, clubSquads: retainedClubSquads }
  next.clubSquads = {
    ...retainedClubSquads,
    ...createClubSquads(missingTeams, next.teamId, {}, game.season),
  }
  ensureUniqueGamePlayerNames(next)
  return { game: next, error: '' }
}

const clubsByGroup = Object.fromEntries(
  Object.entries(leagueGroups).map(([id, group]) => [id, [...group.clubs]]),
) as Record<LeagueGroupId, string[]>

export const clubsByLeague: Record<LeagueId, string[]> = {
  ekstraklasa: [
    'Orkan Zabrze', 'Gryf Poznań', 'Feniks Warszawa', 'Latarnia Szczecin', 'Sygnał Katowice', 'Smok Kraków',
    'Miedziak Lubin', 'Iskra Gliwice', 'Jodła Kielce', 'Mazur Płock', 'Brama Kraków', 'Żuraw Lublin',
    'Żubr Białystok', 'Włókniarz Łódź', 'Gołębnik Radom', 'Straż Częstochowa', 'Most Wrocław', 'Bursztyn Kraków',
  ],
  first: [
    'Nurt Grodzisk Mazowiecki', 'Syrena Warszawa', 'Termit Nieciecza', 'Latarnik Gdańsk', 'Przystań Poznań',
    'Wicher Chorzów', 'Łodzianka Łódź', 'Kolej Legnica', 'Rzeszowska Fala Rzeszów', 'Szyb Bytom', 'Ratusz Głogów',
    'Siedlecka Gwiazda Siedlce', 'Opolski Grom Opole', 'Mielecki Znak Mielec', 'Gdyński Żagiel Gdynia', 'Bielska Przełęcz Bielsko-Biała',
    'Sad Skierniewice', 'Niepołomicki Bór Niepołomice',
  ],
  second: [
    'Puls Pruszków', 'Sygnał Tychy', 'Kopalnia Łęczna', 'Baszta Nowy Sącz', 'Szczyt Nowy Targ', 'Spichlerz Grudziądz',
    'Młot Kraków', 'Borowiak Chojnice', 'Szybowiec Bielsko-Biała', 'Sokolik Świdnik', 'Winobranie Zielona Góra',
    'Łucznik Bydgoszcz', 'Huta Stalowa Wola', 'Fort Warszawa II', 'Polarna Kleczew', 'Most Wrocław II',
    'Zorza Szczecin', 'Wisłok Rzeszów',
  ],
  third: [
    'Fort Warszawa II', 'Łodzianka Łódź II', 'Wigry Suwałki', 'Żubr Białystok II', 'Warta Sieradz',
    'GKS Bełchatów', 'Broń Radom', 'Świt Nowy Dwór Mazowiecki', 'Mławianka Mława', 'Pelikan Łowicz',
    'Lechia Tomaszów Mazowiecki', 'Wasilków', 'Mazur Płock II', 'Ząbkovia Ząbki', 'Victoria Sulejówek',
    'GKS Wikielec', 'Troszyn', 'Lidzbark Warmiński',
  ],
  fourth: [
    'Hutnik Warszawa', 'Mazur Karczew', 'MKS Piaseczno', 'KTS Weszło', 'Tęcza Biskupiec', 'Start Nidzica',
    'Olimpia Zambrów', 'ŁKS Łomża', 'Ruch Wysokie Mazowieckie', 'Mamry Giżycko', 'Znicz Biała Piska',
    'Stomil Olsztyn', 'Polonia Iłowo', 'DKS Dobre Miasto', 'Rominta Gołdap', 'Concordia Elbląg',
    'Granica Kętrzyn', 'Mrągovia Mrągowo',
  ],
  ...clubsByGroup,
}

const clubNameReplacements: Record<string, string> = {
  'Górnik Zabrze': 'Orkan Zabrze',
  'Lech Poznań': 'Gryf Poznań',
  'Legia Warszawa': 'Feniks Warszawa',
  'Pogoń Szczecin': 'Latarnia Szczecin',
  'GKS Katowice': 'Sygnał Katowice',
  'Wisła Kraków': 'Smok Kraków',
  'Zagłębie Lubin': 'Miedziak Lubin',
  'Piast Gliwice': 'Iskra Gliwice',
  'Korona Kielce': 'Jodła Kielce',
  'Wisła Płock': 'Mazur Płock',
  Cracovia: 'Brama Kraków',
  'Motor Lublin': 'Żuraw Lublin',
  'Jagiellonia Białystok': 'Żubr Białystok',
  'Widzew Łódź': 'Włókniarz Łódź',
  'Radomiak Radom': 'Gołębnik Radom',
  'Raków Częstochowa': 'Straż Częstochowa',
  'Śląsk Wrocław': 'Most Wrocław',
  'Wieczysta Kraków': 'Bursztyn Kraków',
  'Pogoń Grodzisk Mazowiecki': 'Nurt Grodzisk Mazowiecki',
  'Polonia Warszawa': 'Syrena Warszawa',
  'Bruk-Bet Termalica Nieciecza': 'Termit Nieciecza',
  'Lechia Gdańsk': 'Latarnik Gdańsk',
  'Warta Poznań': 'Przystań Poznań',
  'Ruch Chorzów': 'Wicher Chorzów',
  'ŁKS Łódź': 'Łodzianka Łódź',
  'Miedź Legnica': 'Kolej Legnica',
  'Stal Rzeszów': 'Rzeszowska Fala Rzeszów',
  'Polonia Bytom': 'Szyb Bytom',
  'Chrobry Głogów': 'Ratusz Głogów',
  'Pogoń Siedlce': 'Siedlecka Gwiazda Siedlce',
  'Odra Opole': 'Opolski Grom Opole',
  'Stal Mielec': 'Mielecki Znak Mielec',
  'Arka Gdynia': 'Gdyński Żagiel Gdynia',
  'Podbeskidzie Bielsko-Biała': 'Bielska Przełęcz Bielsko-Biała',
  'Unia Skierniewice': 'Sad Skierniewice',
  'Puszcza Niepołomice': 'Niepołomicki Bór Niepołomice',
  'Znicz Pruszków': 'Puls Pruszków',
  'GKS Tychy': 'Sygnał Tychy',
  'Górnik Łęczna': 'Kopalnia Łęczna',
  'Sandecja Nowy Sącz': 'Baszta Nowy Sącz',
  'Podhale Nowy Targ': 'Szczyt Nowy Targ',
  'Olimpia Grudziądz': 'Spichlerz Grudziądz',
  'Hutnik Kraków': 'Młot Kraków',
  'Chojniczanka Chojnice': 'Borowiak Chojnice',
  'Rekord Bielsko-Biała': 'Szybowiec Bielsko-Biała',
  'Avia Świdnik': 'Sokolik Świdnik',
  'Lechia Zielona Góra': 'Winobranie Zielona Góra',
  'Zawisza Bydgoszcz': 'Łucznik Bydgoszcz',
  'Stal Stalowa Wola': 'Huta Stalowa Wola',
  'Legia II Warszawa': 'Fort Warszawa II',
  'Sokół Kleczew': 'Polarna Kleczew',
  'Śląsk II Wrocław': 'Most Wrocław II',
  'Świt Szczecin': 'Zorza Szczecin',
  'Resovia Rzeszów': 'Wisłok Rzeszów',
  'Wisła II Płock': 'Mazur Płock II',
  'Jagiellonia II Białystok': 'Żubr Białystok II',
  'Widzew II Łódź': 'Włókniarz Łódź II',
  'ŁKS II Łódź': 'Łodzianka Łódź II',
  'Lech II Poznań': 'Gryf Poznań II',
  'Zagłębie II Lubin': 'Miedziak Lubin II',
  'Miedź II Legnica': 'Kolej Legnica II',
  'Raków Częstochowa II': 'Straż Częstochowa II',
  'Wisła II Kraków': 'Smok Kraków II',
  'Wieczysta II Kraków': 'Bursztyn Kraków II',
  'Korona II Kielce': 'Jodła Kielce II',
  'Cracovia II': 'Brama Kraków II',
  'Chrobry II Głogów': 'Ratusz Głogów II',
  'ŁKS III Łódź': 'Łodzianka Łódź III',
  'Avia II Świdnik': 'Sokolik Świdnik II',
  'Górnik Łęczna U21': 'Kopalnia Łęczna U21',
  'Lechia II Zielona Góra': 'Winobranie Zielona Góra II',
  'Bruk-Bet Termalica II Nieciecza': 'Termit Nieciecza II',
  'Hutnik II Kraków': 'Młot Kraków II',
  'Polonia II Warszawa': 'Syrena Warszawa II',
  'Odra II Opole': 'Opolski Grom Opole II',
  'Stal II Rzeszów': 'Rzeszowska Fala Rzeszów II',
  'FKS Stal II Mielec S. A.': 'Mielecki Znak Mielec II',
  'Stal Stalowa Wola P.S.A. II': 'Huta Stalowa Wola II',
  'SMS Resovia II Rzeszów S.A.': 'Wisłok Rzeszów II',
  'Chojniczanka II Chojnice': 'Borowiak Chojnice II',
  'Chojniczanka III Chojnice': 'Borowiak Chojnice III',
  'Arka II Gdynia': 'Gdyński Żagiel Gdynia II',
  'Podbeskidzie II Bielsko-Biała': 'Bielska Przełęcz Bielsko-Biała II',
  'Ruch Chorzów II': 'Wicher Chorzów II',
  'GKS Katowice II': 'Sygnał Katowice II',
  'Piast Gliwice II': 'Iskra Gliwice II',
  'Korona III Kielce': 'Jodła Kielce III',
  'Pogoń II Szczecin': 'Latarnia Szczecin II',
  'Świt II Szczecin': 'Zorza Szczecin II',
  'Świt III Szczecin': 'Zorza Szczecin III',
}

export function getLeagueMatchupsPerOpponent(teamCount: number) {
  return teamCount <= 10 ? 4 : 2
}

export function getGameMatchupsPerOpponent(game: Pick<GameState, 'teams' | 'leagueMatchupsPerOpponent'>) {
  return game.leagueMatchupsPerOpponent ?? getLeagueMatchupsPerOpponent(game.teams.length)
}

export function getSeasonRoundCount(game: Pick<GameState, 'teams' | 'leagueMatchupsPerOpponent'>) {
  const roundsPerCycle = game.teams.length % 2 === 0 ? game.teams.length - 1 : game.teams.length
  return roundsPerCycle * getGameMatchupsPerOpponent(game)
}

export function getLeagueChampionTrophyName(leagueId: LeagueId) {
  if (leagueId === 'ekstraklasa') return 'Mistrz Polski'
  const leagueName = leagues.find((league) => league.id === leagueId)?.name ?? 'ligi'
  return `Mistrz ligi · ${leagueName}`
}

export function getSeasonAwards(game: GameState): SeasonAward[] {
  const teamsById = new Map(game.teams.map((team) => [team.id, team]))
  const candidates = [
    ...game.squad.map((player) => ({ player, clubId: game.teamId, clubName: game.clubName })),
    ...game.teams
      .filter((team) => team.id !== game.teamId)
      .flatMap((team) => (game.clubSquads[team.id] ?? []).map(({ player }) => ({
        player,
        clubId: team.id,
        clubName: team.name,
      }))),
  ].filter((candidate, index, all) =>
    all.findIndex((other) => other.player.id === candidate.player.id) === index,
  )
  const averageRating = (player: Player) =>
    (player.seasonRatedAppearances ?? 0) > 0
      ? (player.seasonRatingTotal ?? 0) / (player.seasonRatedAppearances ?? 1)
      : 0
  const award = (
    category: SeasonAwardCategory,
    title: string,
    eligible: (player: Player) => boolean,
    value: (player: Player) => number,
    valueLabel: (player: Player) => string,
  ): SeasonAward | undefined => {
    const winner = candidates
      .filter(({ player }) => eligible(player))
      .sort((first, second) =>
        value(second.player) - value(first.player)
        || (second.player.seasonAppearances ?? 0) - (first.player.seasonAppearances ?? 0)
        || averageRating(second.player) - averageRating(first.player)
        || `${first.player.firstName} ${first.player.lastName}`.localeCompare(`${second.player.firstName} ${second.player.lastName}`, 'pl')
        || first.player.id.localeCompare(second.player.id),
      )[0]
    if (!winner) return undefined
    return {
      id: `${category}-${game.season}`,
      category,
      title,
      playerId: winner.player.id,
      playerName: `${winner.player.firstName} ${winner.player.lastName}`,
      clubId: winner.clubId,
      clubName: winner.clubName || teamsById.get(winner.clubId)?.name || 'Nieznany klub',
      age: winner.player.age,
      value: value(winner.player),
      valueLabel: valueLabel(winner.player),
    }
  }
  const minimumGoalkeeperAppearances = Math.max(3, Math.ceil(getSeasonRoundCount(game) * 0.2))
  const awards = [
    award('top-scorer', 'Król strzelców', (player) => (player.seasonGoals ?? 0) > 0,
      (player) => player.seasonGoals ?? 0, (player) => `${player.seasonGoals ?? 0} goli`),
    award('top-assists', 'Najlepszy asystent', (player) => (player.seasonAssists ?? 0) > 0,
      (player) => player.seasonAssists ?? 0, (player) => `${player.seasonAssists ?? 0} asyst`),
    award('best-goalkeeper', 'Bramkarz sezonu', (player) =>
      player.position === 'BR'
      && (player.seasonAppearances ?? 0) >= minimumGoalkeeperAppearances
      && (player.seasonCleanSheets ?? 0) > 0,
    (player) => player.seasonCleanSheets ?? 0, (player) => `${player.seasonCleanSheets ?? 0} czystych kont`),
    award('young-player', 'Młody zawodnik sezonu', (player) =>
      player.age <= 21 && (player.seasonRatedAppearances ?? 0) >= 3,
    averageRating, (player) => `Ocena ${averageRating(player).toFixed(2)} · ${player.seasonRatedAppearances ?? 0} wyst.`),
    award('player-of-season', 'Piłkarz sezonu', (player) => (player.seasonRatedAppearances ?? 0) >= 5,
      averageRating, (player) => `Ocena ${averageRating(player).toFixed(2)} · ${player.seasonRatedAppearances ?? 0} wyst.`),
  ]
  return awards.filter((item): item is SeasonAward => Boolean(item))
}

export function getSeasonTeamOfSeason(game: GameState): SeasonElevenPlayer[] {
  const candidates = [
    ...game.squad.map((player) => ({ player, clubId: game.teamId, clubName: game.clubName })),
    ...game.teams
      .filter((team) => team.id !== game.teamId)
      .flatMap((team) => (game.clubSquads[team.id] ?? []).map(({ player }) => ({
        player,
        clubId: team.id,
        clubName: team.name,
      }))),
  ].filter((candidate, index, all) =>
    all.findIndex((other) => other.player.id === candidate.player.id) === index
    && (candidate.player.seasonRatedAppearances ?? 0) >= 5,
  )
  const averageRating = (player: Player) =>
    (player.seasonRatedAppearances ?? 0) > 0
      ? (player.seasonRatingTotal ?? 0) / (player.seasonRatedAppearances ?? 1)
      : 0
  const compareCandidates = (first: typeof candidates[number], second: typeof candidates[number]) =>
    averageRating(second.player) - averageRating(first.player)
    || (second.player.seasonRatedAppearances ?? 0) - (first.player.seasonRatedAppearances ?? 0)
    || `${first.player.firstName} ${first.player.lastName}`.localeCompare(`${second.player.firstName} ${second.player.lastName}`, 'pl')
    || first.player.id.localeCompare(second.player.id)
  const formations: Formation[] = ['4-3-3', '4-2-3-1', '4-4-2', '3-5-2', '3-4-3', '5-3-2', '4-1-4-1', '4-3-2-1']

  for (const formation of formations) {
    const positions = formationPositionOrders[formation]
    const assigned = new Map<number, typeof candidates[number]>()
    const slots = positions
      .map((position, index) => ({
        index,
        eligible: candidates.filter(({ player }) => canPlayPosition(player, position)).sort(compareCandidates),
      }))
      .sort((first, second) => first.eligible.length - second.eligible.length || first.index - second.index)

    function canFillRemaining(remainingSlots: typeof slots, available: typeof candidates[number][]) {
      const matchedPlayers = new Map<string, number>()
      function match(slotIndex: number, visited: Set<string>): boolean {
        for (const candidate of remainingSlots[slotIndex].eligible) {
          if (!available.some((item) => item.player.id === candidate.player.id) || visited.has(candidate.player.id)) continue
          visited.add(candidate.player.id)
          const previousSlot = matchedPlayers.get(candidate.player.id)
          if (previousSlot === undefined || match(previousSlot, visited)) {
            matchedPlayers.set(candidate.player.id, slotIndex)
            return true
          }
        }
        return false
      }
      return remainingSlots.every((_, index) => match(index, new Set()))
    }

    let remainingCandidates = [...candidates]
    let possible = true
    for (let slotIndex = 0; slotIndex < slots.length; slotIndex += 1) {
      const slot = slots[slotIndex]
      const remainingSlots = slots.slice(slotIndex + 1)
      const selected = slot.eligible.find((candidate) =>
        remainingCandidates.some((item) => item.player.id === candidate.player.id)
        && canFillRemaining(remainingSlots, remainingCandidates.filter((item) => item.player.id !== candidate.player.id)),
      )
      if (!selected) {
        possible = false
        break
      }
      assigned.set(slot.index, selected)
      remainingCandidates = remainingCandidates.filter((item) => item.player.id !== selected.player.id)
    }
    if (!possible) continue

    return positions.map((position, index) => {
      const selected = assigned.get(index)
      if (!selected) throw new Error(`Nie udało się przypisać zawodnika do pozycji ${position} w jedenastce sezonu.`)
      const { player, clubId, clubName } = selected
      return {
        playerId: player.id,
        name: `${player.firstName} ${player.lastName}`,
        clubId,
        clubName,
        position,
        rating: Math.round(averageRating(player) * 100) / 100,
        appearances: player.seasonRatedAppearances ?? 0,
      }
    })
  }
  return []
}

export function getTransferWindowInfo(game: Pick<GameState, 'teams' | 'round'>) {
  const seasonRounds = getSeasonRoundCount(game)
  const winterStart = Math.ceil(seasonRounds / 2)
  const windows = [
    { name: 'letnie', openRound: 1, closeRound: Math.min(4, seasonRounds) },
    { name: 'zimowe', openRound: winterStart, closeRound: Math.min(winterStart + 2, seasonRounds) },
  ]
  const isPreseason = game.round === seasonRounds + 1
  const currentWindow = windows.find((window) =>
    game.round >= window.openRound && game.round <= window.closeRound
    || window.name === 'letnie' && isPreseason,
  ) ?? null
  const nextWindow = windows.find((window) => window.openRound > game.round) ?? null
  return {
    isOpen: currentWindow !== null,
    currentWindow,
    nextWindow,
    seasonRounds,
    isPreseason,
  }
}

export function getLeagueTier(leagueId: LeagueId): LeagueTier {
  if (leagueId === 'ekstraklasa') return 1
  if (leagueId === 'first') return 2
  if (leagueId === 'second') return 3
  if (leagueId === 'third' || leagueId.startsWith('third-')) return 4
  if (leagueId === 'fourth' || leagueId.startsWith('fourth-')) return 5
  const group = leagueGroups[leagueId as LeagueGroupId]
  if (group) return group.tier
  throw new Error(`Nieznany poziom rozgrywek: ${leagueId}.`)
}

function getLeagueBaseStrength(leagueId: LeagueId) {
  return [0, 72, 64, 56, 49, 42, 37, 33, 29][getLeagueTier(leagueId)]
}

const clubCities: Record<string, string> = {
  'Nurt Grodzisk Mazowiecki': 'Grodzisk Mazowiecki',
  'Syrena Warszawa': 'Warszawa',
  'Termit Nieciecza': 'Nieciecza',
  'Latarnik Gdańsk': 'Gdańsk',
  'Przystań Poznań': 'Poznań',
  'Wicher Chorzów': 'Chorzów',
  'Łodzianka Łódź': 'Łódź',
  'Kolej Legnica': 'Legnica',
  'Rzeszowska Fala Rzeszów': 'Rzeszów',
  'Szyb Bytom': 'Bytom',
  'Ratusz Głogów': 'Głogów',
  'Siedlecka Gwiazda Siedlce': 'Siedlce',
  'Opolski Grom Opole': 'Opole',
  'Mielecki Znak Mielec': 'Mielec',
  'Gdyński Żagiel Gdynia': 'Gdynia',
  'Bielska Przełęcz Bielsko-Biała': 'Bielsko-Biała',
  'Sad Skierniewice': 'Skierniewice',
  'Niepołomicki Bór Niepołomice': 'Niepołomice',
  'Legia Warszawa': 'Warszawa',
  'Lech Poznań': 'Poznań',
  'Jagiellonia Białystok': 'Białystok',
  'Górnik Zabrze': 'Zabrze',
  'Pogoń Szczecin': 'Szczecin',
  'Raków Częstochowa': 'Częstochowa',
  'Widzew Łódź': 'Łódź',
  'Wisła Płock': 'Płock',
  Cracovia: 'Kraków',
  'Wisła Kraków': 'Kraków',
  'Śląsk Wrocław': 'Wrocław',
  'Ruch Chorzów': 'Chorzów',
  'ŁKS Łódź': 'Łódź',
  'Arka Gdynia': 'Gdynia',
  'Miedź Legnica': 'Legnica',
  'Polonia Warszawa': 'Warszawa',
  'GKS Tychy': 'Tychy',
  'Odra Opole': 'Opole',
  'Polonia Bytom': 'Bytom',
  'Zagłębie Sosnowiec': 'Sosnowiec',
  'Resovia Rzeszów': 'Rzeszów',
  'Sandecja Nowy Sącz': 'Nowy Sącz',
  'Chojniczanka Chojnice': 'Chojnice',
  'KKS Kalisz': 'Kalisz',
  'Rekord Bielsko-Biała': 'Bielsko-Biała',
  'Olimpia Grudziądz': 'Grudziądz',
  'Podbeskidzie Bielsko-Biała': 'Bielsko-Biała',
  'Ina Goleniów': 'Goleniów',
  'Ina II Goleniów': 'Goleniów',
  'ZALEW STEPNICA': 'Stepnica',
}

export function getClubCity(clubName: string) {
  return cityByClub[clubName] ?? warminskoMazurskieClubCities[clubName] ?? fourthLeagueClubCities[clubName] ?? clubCities[clubName] ?? 'Polska'
}

const cityRegions: Record<string, string> = {
  ...Object.fromEntries(
    [...new Set(Object.values(warminskoMazurskieClubCities))].map((city) => [city, 'fourth-warminsko-mazurskie']),
  ),
  Białystok: 'fourth-podlaskie',
  Grajewo: 'fourth-podlaskie',
  Łomża: 'fourth-podlaskie',
  Suwałki: 'fourth-podlaskie',
  Warszawa: 'fourth-mazowieckie',
  Radom: 'fourth-mazowieckie',
  Płock: 'fourth-mazowieckie',
  Siedlce: 'fourth-mazowieckie',
  Łódź: 'fourth-lodzkie',
  Bełchatów: 'fourth-lodzkie',
  Piotrków: 'fourth-lodzkie',
  Wrocław: 'fourth-dolnoslaskie',
  Legnica: 'fourth-dolnoslaskie',
  Głogów: 'fourth-dolnoslaskie',
  Jelenia: 'fourth-dolnoslaskie',
  Opole: 'fourth-opolskie',
  Zabrze: 'fourth-slaskie',
  Katowice: 'fourth-slaskie',
  Gliwice: 'fourth-slaskie',
  Chorzów: 'fourth-slaskie',
  Rybnik: 'fourth-slaskie',
  Częstochowa: 'fourth-slaskie',
  Kraków: 'fourth-malopolskie',
  'Nowy Sącz': 'fourth-malopolskie',
  Tarnów: 'fourth-malopolskie',
  Gdańsk: 'fourth-pomorskie',
  Gdynia: 'fourth-pomorskie',
  Chojnice: 'fourth-pomorskie',
  Koszalin: 'fourth-zachodniopomorskie',
  Szczecin: 'fourth-zachodniopomorskie',
  Goleniów: 'fourth-zachodniopomorskie',
  Stepnica: 'fourth-zachodniopomorskie',
  Kołobrzeg: 'fourth-zachodniopomorskie',
  Poznań: 'fourth-wielkopolskie',
  Środa: 'fourth-wielkopolskie',
  Kalisz: 'fourth-wielkopolskie',
  Konin: 'fourth-wielkopolskie',
  Gniezno: 'fourth-wielkopolskie',
  Rzeszów: 'fourth-podkarpackie',
  Przemyśl: 'fourth-podkarpackie',
  Dębica: 'fourth-podkarpackie',
  Lublin: 'fourth-lubelskie',
  Chełm: 'fourth-lubelskie',
  Zamość: 'fourth-lubelskie',
  Kielce: 'fourth-swietokrzyskie',
  Olsztyn: 'fourth-warminsko-mazurskie',
  Elbląg: 'fourth-warminsko-mazurskie',
  'Zielona Góra': 'fourth-lubuskie',
  Bydgoszcz: 'fourth-kujawsko-pomorskie',
  Toruń: 'fourth-kujawsko-pomorskie',
  Grudziądz: 'fourth-kujawsko-pomorskie',
  Lubin: 'fourth-dolnoslaskie',
  'Bielsko-Biała': 'fourth-slaskie',
  Bytom: 'fourth-slaskie',
  Sosnowiec: 'fourth-slaskie',
  Nieciecza: 'fourth-malopolskie',
  'Nowy Targ': 'fourth-malopolskie',
  Świdnik: 'fourth-lubelskie',
  'Grodzisk Mazowiecki': 'fourth-mazowieckie',
  'Mińsk Mazowiecki': 'fourth-mazowieckie',
  Pruszków: 'fourth-mazowieckie',
  Ząbki: 'fourth-mazowieckie',
  Sulejówek: 'fourth-mazowieckie',
  'Nowy Dwór': 'fourth-mazowieckie',
  Sieradz: 'fourth-lodzkie',
  Łowicz: 'fourth-lodzkie',
  Skierniewice: 'fourth-lodzkie',
  Mława: 'fourth-mazowieckie',
  Troszyn: 'fourth-mazowieckie',
  'Lidzbark Warmiński': 'fourth-warminsko-mazurskie',
  'Wysokie Mazowieckie': 'fourth-podlaskie',
  Stargard: 'fourth-zachodniopomorskie',
  Luzino: 'fourth-pomorskie',
  Świecie: 'fourth-kujawsko-pomorskie',
  'Nowy Staw': 'fourth-pomorskie',
  Swarzędz: 'fourth-wielkopolskie',
  Września: 'fourth-wielkopolskie',
  Stęszew: 'fourth-wielkopolskie',
  Kórnik: 'fourth-wielkopolskie',
  'Bytom Odrzański': 'fourth-lubuskie',
  Sułów: 'fourth-dolnoslaskie',
  'Jelenia Góra': 'fourth-dolnoslaskie',
  Polkowice: 'fourth-dolnoslaskie',
  'Gorzów Wielkopolski': 'fourth-lubuskie',
  Brzeg: 'fourth-opolskie',
  'Goczałkowice-Zdrój': 'fourth-slaskie',
  Kluczbork: 'fourth-opolskie',
  Nysa: 'fourth-opolskie',
  Gubin: 'fourth-lubuskie',
  Ostrowiec: 'fourth-swietokrzyskie',
  Jędrzejów: 'fourth-swietokrzyskie',
  Skawina: 'fourth-malopolskie',
  Jarosław: 'fourth-podkarpackie',
  Tarnobrzeg: 'fourth-podkarpackie',
  Biała: 'fourth-lubelskie',
  Morawica: 'fourth-swietokrzyskie',
  Czarnków: 'fourth-wielkopolskie',
  Świnoujście: 'fourth-zachodniopomorskie',
  Tychy: 'fourth-slaskie',
  Słubice: 'fourth-lubuskie',
  Zambrów: 'fourth-podlaskie',
  Połaniec: 'fourth-swietokrzyskie',
  Starachowice: 'fourth-swietokrzyskie',
  Busko: 'fourth-swietokrzyskie',
  Lubaczów: 'fourth-podkarpackie',
  'Kolbuszowa Dolna': 'fourth-podkarpackie',
  'Stalowa Wola': 'fourth-podkarpackie',
  Kleczew: 'fourth-wielkopolskie',
  Wasilków: 'fourth-podlaskie',
  'Tomaszów Mazowiecki': 'fourth-lodzkie',
  Łęczna: 'fourth-lubelskie',
  Niepołomice: 'fourth-malopolskie',
  Mielec: 'fourth-podkarpackie',
  Czarna: 'fourth-podlaskie',
  Wikielec: 'fourth-warminsko-mazurskie',
  Iłowo: 'fourth-warminsko-mazurskie',
  Mrągowo: 'fourth-warminsko-mazurskie',
}

const cityByClub: Record<string, string> = {
  'Puls Pruszków': 'Pruszków',
  'Sygnał Tychy': 'Tychy',
  'Kopalnia Łęczna': 'Łęczna',
  'Baszta Nowy Sącz': 'Nowy Sącz',
  'Szczyt Nowy Targ': 'Nowy Targ',
  'Spichlerz Grudziądz': 'Grudziądz',
  'Młot Kraków': 'Kraków',
  'Borowiak Chojnice': 'Chojnice',
  'Szybowiec Bielsko-Biała': 'Bielsko-Biała',
  'Sokolik Świdnik': 'Świdnik',
  'Winobranie Zielona Góra': 'Zielona Góra',
  'Łucznik Bydgoszcz': 'Bydgoszcz',
  'Huta Stalowa Wola': 'Stalowa Wola',
  'Fort Warszawa II': 'Warszawa',
  'Polarna Kleczew': 'Kleczew',
  'Most Wrocław II': 'Wrocław',
  'Zorza Szczecin': 'Szczecin',
  'Wisłok Rzeszów': 'Rzeszów',
  'Orkan Zabrze': 'Zabrze',
  'Gryf Poznań': 'Poznań',
  'Feniks Warszawa': 'Warszawa',
  'Latarnia Szczecin': 'Szczecin',
  'Sygnał Katowice': 'Katowice',
  'Smok Kraków': 'Kraków',
  'Miedziak Lubin': 'Lubin',
  'Iskra Gliwice': 'Gliwice',
  'Jodła Kielce': 'Kielce',
  'Mazur Płock': 'Płock',
  'Brama Kraków': 'Kraków',
  'Żuraw Lublin': 'Lublin',
  'Żubr Białystok': 'Białystok',
  'Włókniarz Łódź': 'Łódź',
  'Gołębnik Radom': 'Radom',
  'Straż Częstochowa': 'Częstochowa',
  'Most Wrocław': 'Wrocław',
  'Bursztyn Kraków': 'Kraków',
  'KTS Weszło': 'Warszawa',
  Wasilków: 'Wasilków',
  'GKS Wikielec': 'Wikielec',
  'GKS LZS Wikielec': 'Wikielec',
  'Polonia Iłowo': 'Iłowo',
  'Mrągovia Mrągowo': 'Mrągowo',
  'Broń Radom': 'Radom',
  'Victoria Sulejówek': 'Sulejówek',
  Troszyn: 'Troszyn',
  'Lidzbark Warmiński': 'Lidzbark Warmiński',
  'Warta Sieradz': 'Sieradz',
  'Motor Lublin': 'Lublin',
  'Jagiellonia Białystok': 'Białystok',
  'GKS Katowice': 'Katowice',
  'Raków Częstochowa': 'Częstochowa',
  'Radomiak Radom': 'Radom',
  'Zagłębie Lubin': 'Lubin',
  'Piast Gliwice': 'Gliwice',
  'Warta Poznań': 'Poznań',
  'Pogoń Grodzisk Mazowiecki': 'Grodzisk Mazowiecki',
  'Bruk-Bet Termalica Nieciecza': 'Nieciecza',
  'Stal Rzeszów': 'Rzeszów',
  'Polonia Bytom': 'Bytom',
  'Górnik Łęczna': 'Łęczna',
  'Sandecja Nowy Sącz': 'Nowy Sącz',
  'Podhale Nowy Targ': 'Nowy Targ',
  'Olimpia Grudziądz': 'Grudziądz',
  'Hutnik Kraków': 'Kraków',
  'Rekord Bielsko-Biała': 'Bielsko-Biała',
  'Avia Świdnik': 'Świdnik',
  'Lechia Zielona Góra': 'Zielona Góra',
  'Zawisza Bydgoszcz': 'Bydgoszcz',
  'Stal Stalowa Wola': 'Stalowa Wola',
  'Sokół Kleczew': 'Kleczew',
  'Unia Skierniewice': 'Skierniewice',
  'Świt Szczecin': 'Szczecin',
  'Resovia Rzeszów': 'Rzeszów',
  'GKS Bełchatów': 'Bełchatów',
  'ŁKS Łódź': 'Łódź',
  'Stal Mielec': 'Mielec',
  'Arka Gdynia': 'Gdynia',
  'Polonia Warszawa': 'Warszawa',
  'Odra Opole': 'Opole',
  'Górnik Zabrze': 'Zabrze',
  'Lech Poznań': 'Poznań',
  'Legia Warszawa': 'Warszawa',
  'Pogoń Szczecin': 'Szczecin',
  'Wisła Kraków': 'Kraków',
  'Korona Kielce': 'Kielce',
  'Wisła Płock': 'Płock',
  Cracovia: 'Kraków',
  'Widzew Łódź': 'Łódź',
  'Śląsk Wrocław': 'Wrocław',
  'Wieczysta Kraków': 'Kraków',
  'Puszcza Niepołomice': 'Niepołomice',
  'Pogoń Siedlce': 'Siedlce',
  'Miedź Legnica': 'Legnica',
  'Chrobry Głogów': 'Głogów',
  'Wigry Suwałki': 'Suwałki',
  'Świt Nowy Dwór Mazowiecki': 'Nowy Dwór',
  'Znicz Pruszków': 'Pruszków',
  'Pelikan Łowicz': 'Łowicz',
  'Mazovia Mińsk Mazowiecki': 'Mińsk Mazowiecki',
  'Ząbkovia Ząbki': 'Ząbki',
  'Olimpia Zambrów': 'Zambrów',
  'Olimpia Elbląg': 'Elbląg',
  'Żubr Białystok II': 'Białystok',
  'Mazur Płock II': 'Płock',
  'ŁKS Łomża': 'Łomża',
  'Włókniarz Łódź II': 'Łódź',
  'Łodzianka Łódź II': 'Łódź',
  'Lechia Tomaszów Mazowiecki': 'Tomaszów Mazowiecki',
  'Mławianka Mława': 'Mława',
  'Polonia Lidzbark Warmiński': 'Lidzbark Warmiński',
  'KS CK Troszyn': 'Troszyn',
  'Polonia Środa Wielkopolska': 'Środa',
  'Wikęd Luzino': 'Luzino',
  'Wda Świecie': 'Świecie',
  'Kluczevia Stargard': 'Stargard',
  'Błękitni Stargard': 'Stargard',
  'Bałtyk Koszalin': 'Koszalin',
  'Gryf Poznań II': 'Poznań',
  'Noteć Czarnków': 'Czarnków',
  'KKS 1925 Kalisz': 'Kalisz',
  'Grom Nowy Staw': 'Nowy Staw',
  'Elana Toruń': 'Toruń',
  'Unia Swarzędz': 'Swarzędz',
  'Gedania Gdańsk': 'Gdańsk',
  'Lechia Gdańsk': 'Gdańsk',
  'Flota Świnoujście': 'Świnoujście',
  'Chemik Moderator Bydgoszcz': 'Bydgoszcz',
  'Victoria Września': 'Września',
  'Lipno Stęszew': 'Stęszew',
  'Kotwica Kórnik': 'Kórnik',
  'Zagłębie Sosnowiec': 'Sosnowiec',
  'Sparta Katowice': 'Katowice',
  'Odra Skrzynie Zając Bytom Odrzański': 'Bytom Odrzański',
  'Miedziak Lubin II': 'Lubin',
  'Barycz Sułów': 'Sułów',
  'ROW 1964 Rybnik': 'Rybnik',
  'Karkonosze Jelenia Góra': 'Jelenia Góra',
  'Górnik Polkowice': 'Polkowice',
  'Kolej Legnica II': 'Legnica',
  'Stilon Gorzów Wielkopolski': 'Gorzów Wielkopolski',
  'Stal Brzeg': 'Brzeg',
  'Panattoni Goczałkowice-Zdrój': 'Goczałkowice-Zdrój',
  'MKS Kluczbork': 'Kluczbork',
  'Warta Gorzów Wielkopolski': 'Gorzów Wielkopolski',
  'Straż Częstochowa II': 'Częstochowa',
  'Czarni Połaniec': 'Połaniec',
  'Hetman Zamość': 'Zamość',
  'Sokół Kolbuszowa Dolna': 'Kolbuszowa Dolna',
  'Smok Kraków II': 'Kraków',
  'Bursztyn Kraków II': 'Kraków',
  'Star Starachowice': 'Starachowice',
  'Jodła Kielce II': 'Kielce',
  'AKS 1947 Busko-Zdrój': 'Busko',
  'Pogoń-Sokół Lubaczów': 'Lubaczów',
  'Polonia Nysa': 'Nysa',
  'Carina Gubin': 'Gubin',
  'Ślęza Wrocław': 'Wrocław',
  'Chełmianka Chełm': 'Chełm',
  'KSZO 1929 Ostrowiec Świętokrzyski': 'Ostrowiec',
  'Wisłoka Dębica': 'Dębica',
  'Naprzód Jędrzejów': 'Jędrzejów',
  'Wiślanie Master Way Skawina': 'Skawina',
  'JKS Jarosław': 'Jarosław',
  'Siarka Tarnobrzeg': 'Tarnobrzeg',
  'Podlasie Biała Podlaska': 'Biała',
  'Moravia Kopalnia Morawica': 'Morawica',
  'Mielecki Znak Mielec II': 'Mielec',
  'Huta Stalowa Wola II': 'Stalowa Wola',
  'Wisłok Rzeszów II': 'Rzeszów',
  'Borowiak Chojnice III': 'Chojnice',
  'Zorza Szczecin III': 'Szczecin',
}

const fourthLeagueClubCities: Record<string, string> = {
  'Ratusz Głogów II': 'Głogów',
  'Piast Żmigród': 'Żmigród',
  'Lechia Dzierżoniów': 'Dzierżoniów',
  'Górnik Złotoryja': 'Złotoryja',
  'Błyskawica Gać': 'Gać',
  'MOTO-JELCZ Oława': 'Oława',
  'Polonia Bielany Wrocławskie': 'Bielany Wrocławskie',
  'GKS Mirków-Długołęka': 'Mirków',
  'Cement Raciborowice': 'Raciborowice',
  'AKS Bazalt Strzegom': 'Strzegom',
  'Polonia Środa Śląska': 'Środa Śląska',
  'Orzeł Ząbkowice Śląskie': 'Ząbkowice Śląskie',
  'WKS Wierzbice': 'Wierzbice',
  'MKS Odra Ścinawa': 'Ścinawa',
  'Iskra Księginice': 'Księginice',
  'Piast Nowa Ruda': 'Nowa Ruda',
  'Polonia Świdnica': 'Świdnica',
  'Prochowiczanka Prochowice': 'Prochowice',
  'Unia Solec Kujawski': 'Solec Kujawski',
  'Tłuchowia Tłuchowo': 'Tłuchowo',
  'Unia Wąbrzeźno': 'Wąbrzeźno',
  'Pogoń Mogilno': 'Mogilno',
  'Wisła Dobrzyń nad Wisłą': 'Dobrzyń nad Wisłą',
  'Mustang Ostaszewo': 'Ostaszewo',
  'Sparta Brodnica': 'Brodnica',
  'Kujawiak Kowal': 'Kowal',
  'Pomorzanin Toruń': 'Toruń',
  'Start ECO-POL Pruszcz': 'Pruszcz',
  'Skrwa Skrwilno': 'Skrwilno',
  'Victoria Czernikowo': 'Czernikowo',
  'Rawys CEO Raciąż': 'Raciąż',
  'Lech Rypin': 'Rypin',
  'Cuiavia Inowrocław': 'Inowrocław',
  'Łokietek Brześć Kujawski': 'Brześć Kujawski',
  'Noteć Gębice': 'Gębice',
  'Orlęta Aleksandrów Kujawski': 'Aleksandrów Kujawski',
  'RKS Radomsko': 'Radomsko',
  'GKS Buczek': 'Buczek',
  'Polonia Piotrków Trybunalski': 'Piotrków Trybunalski',
  'Zjednoczeni Stryków': 'Stryków',
  'Włókniarz Pabianice': 'Pabianice',
  'AKS SMS Łódź': 'Łódź',
  'Sokół Aleksandrów': 'Aleksandrów Łódzki',
  'KS Kutno': 'Kutno',
  'Stal Głowno': 'Głowno',
  'Ceramika Opoczno': 'Opoczno',
  'Orzeł Parzęczew': 'Parzęczew',
  'Łodzianka Łódź III': 'Łódź',
  'Zryw Wygoda': 'Wygoda',
  'Boruta Zgierz': 'Zgierz',
  'Ekolog Wojsławice': 'Wojsławice',
  'Concordia 1909 Piotrków Trybunalski': 'Piotrków Trybunalski',
  'LZS Justynów': 'Justynów',
  'Łada 1945 Biłgoraj': 'Biłgoraj',
  Lublinianka: 'Lublin',
  'Lewart Lubartów': 'Lubartów',
  'Sokolik Świdnik II': 'Świdnik',
  'Orlęta-Spomlek Radzyń Podlaski': 'Radzyń Podlaski',
  'Powiślak Końskowola': 'Końskowola',
  'Granit Bychawa': 'Bychawa',
  'Victoria Łukowa': 'Łukowa',
  'Kopalnia Łęczna U21': 'Łęczna',
  'Janowianka Janów Lubelski': 'Janów Lubelski',
  'Tomasovia Tomaszów Lubelski': 'Tomaszów Lubelski',
  'Ruch Ryki': 'Ryki',
  'Bug Hanna': 'Hanna',
  'Świdniczanka Świdnik': 'Świdnik',
  'Tur Milejów': 'Milejów',
  'Orlęta Łuków': 'Łuków',
  'Victoria Szczaniec': 'Szczaniec',
  'Polonia Słubice': 'Słubice',
  'Korona Kożuchów': 'Kożuchów',
  'Czarni Żagań 1957': 'Żagań',
  'Winobranie Zielona Góra II': 'Zielona Góra',
  'Celuloza Kostrzyn nad Odrą': 'Kostrzyn nad Odrą',
  'Piast Karnin': 'Karnin',
  'Pogoń Świebodzin': 'Świebodzin',
  'Odra Nietków': 'Nietków',
  'Ilanka Rzepin': 'Rzepin',
  'Róża Różanki': 'Różanki',
  'Piast Iłowa': 'Iłowa',
  'Promień Żary': 'Żary',
  'Pogoń Skwierzyna': 'Skwierzyna',
  'Dozamet Nowa Sól': 'Nowa Sól',
  'Sprotavia Szprotawa': 'Szprotawa',
  'Stal Sulęcin': 'Sulęcin',
  'Łucznik Strzelce Krajeńskie': 'Strzelce Krajeńskie',
  'Brama Kraków II': 'Kraków',
  'Victoria Jaworzno': 'Jaworzno',
  'Dalin Myślenice': 'Myślenice',
  'Termit Nieciecza II': 'Nieciecza',
  'Glinik Gorlice': 'Gorlice',
  'Orzeł Ryczów': 'Ryczów',
  'Młot Kraków II': 'Kraków',
  'Wolania Wola Rzędzińska': 'Wola Rzędzińska',
  'Pcimianka Pcim': 'Pcim',
  'Lubań Maniowy': 'Maniowy',
  'Beskid Andrychów': 'Andrychów',
  'BKS Hal-Mont Bochnia': 'Bochnia',
  'Unia Tarnów': 'Tarnów',
  'Kalwarianka Kalwaria Zebrzydowska': 'Kalwaria Zebrzydowska',
  'Limanovia Limanowa': 'Limanowa',
  'Poprad Muszyna': 'Muszyna',
  'Watra Białka Tatrzańska': 'Białka Tatrzańska',
  'Błękitni Modlnica': 'Modlnica',
  'Hutnik Warszawa': 'Warszawa',
  'MKS Piaseczno': 'Piaseczno',
  'Podlasie Sokołów Podlaski': 'Sokołów Podlaski',
  'Ursus Warszawa': 'Warszawa',
  'Makowianka Maków Mazowiecki': 'Maków Mazowiecki',
  'Oskar Przysucha': 'Przysucha',
  'Syrena Warszawa II': 'Warszawa',
  'Legionovia Legionowo': 'Legionowo',
  'Mszczonowianka Mszczonów': 'Mszczonów',
  'Talent Warszawa': 'Warszawa',
  'Błonianka Błonie': 'Błonie',
  'Enea Energia Kozienice': 'Kozienice',
  'Mazur Karczew': 'Karczew',
  'Nadnarwianka Pułtusk': 'Pułtusk',
  Łomianki: 'Łomianki',
  Przasnysz: 'Przasnysz',
  'Opolski Grom Opole II': 'Opole',
  'LZS Starowice Dolne': 'Starowice Dolne',
  'Ruch Zdzieszowice': 'Zdzieszowice',
  'LZS Adamietz Kadłub': 'Kadłub',
  'LZS Domaszkowice': 'Domaszkowice',
  'LZS Starościn': 'Starościn',
  'Małapanew Ozimek': 'Ozimek',
  'Start Namysłów': 'Namysłów',
  'Po-Ra-Wie Większyce': 'Większyce',
  'MKS Gogolin': 'Gogolin',
  'Victoria Żyrowa': 'Żyrowa',
  'Fortuna Głogówek': 'Głogówek',
  'Stal Zawadzkie': 'Zawadzkie',
  'Śląsk Łubniany': 'Łubniany',
  'Igloopol Dębica': 'Dębica',
  'Błękitni Ropczyce': 'Ropczyce',
  'KS Wiązownica': 'Wiązownica',
  'Górnik Strachocina': 'Strachocina',
  'Ekoball Stal Sanok': 'Sanok',
  'Izolator Boguchwała': 'Boguchwała',
  'Sokół Nisko': 'Nisko',
  'Rzeszowska Fala Rzeszów II': 'Rzeszów',
  'Pogoń-Sokół II Lubaczów': 'Lubaczów',
  'Stal Łańcut': 'Łańcut',
  'Polonia Przemyśl': 'Przemyśl',
  'Sokół Sieniawa': 'Sieniawa',
  'Legion Pilzno': 'Pilzno',
  'Czarni Jasło': 'Jasło',
  'Wisłok Wiśniowa': 'Wiśniowa',
  'Strug Tyczyn': 'Tyczyn',
  'Radomyślanka Geyer & Hosaja Radomyśl Wielki': 'Radomyśl Wielki',
  'Pogoń Leżajsk': 'Leżajsk',
  'Warmia Grajewo': 'Grajewo',
  'ŁKS II Łomża': 'Łomża',
  'Tur Bielsk Podlaski': 'Bielsk Podlaski',
  'Wissa Szczuczyn': 'Szczuczyn',
  'Hetman Skłodowscy Tykocin': 'Tykocin',
  'Pionier Brańsk': 'Brańsk',
  'Promień Mońki': 'Mońki',
  'Czarni Czarna Białostocka': 'Czarna Białostocka',
  Michałowo: 'Michałowo',
  'Ruch Wysokie Mazowieckie': 'Wysokie Mazowieckie',
  'LZS Krynki': 'Krynki',
  'Pomorzanka Sejny': 'Sejny',
  'Krypnianka Krypno': 'Krypno',
  Śniadowo: 'Śniadowo',
  'Czarni Pruszcz Gdański': 'Pruszcz Gdański',
  'Cartusia Kartuzy': 'Kartuzy',
  'Gdyński Żagiel Gdynia II': 'Gdynia',
  'Gryf Wejherowo': 'Wejherowo',
  'Gryf Słupsk': 'Słupsk',
  'Pogoń Lębork': 'Lębork',
  'Stoczniowiec Gdańsk': 'Gdańsk',
  'KP Starogard Gdański': 'Starogard Gdański',
  'Radunia Stężyca': 'Stężyca',
  'Sokół Bożepole Wielkie': 'Bożepole Wielkie',
  'Wierzyca Pelplin': 'Pelplin',
  'Jaguar Gdańsk AP': 'Gdańsk',
  'Anioły Garczegorze': 'Garczegorze',
  'Stolem Gniewino': 'Gniewino',
  'Borowiak Chojnice II': 'Chojnice',
  'Powiśle Dzierzgoń': 'Dzierzgoń',
  'Sparta Sycewice': 'Sycewice',
  'Dolina Speranda Niepoględzie': 'Niepoględzie',
  'Unia Turza Śląska': 'Turza Śląska',
  'Ruch Radzionków': 'Radzionków',
  'MRKS Czechowice-Dziedzice': 'Czechowice-Dziedzice',
  'Bielska Przełęcz Bielsko-Biała II': 'Bielsko-Biała',
  'Wicher Chorzów II': 'Chorzów',
  'Sygnał Katowice II': 'Katowice',
  'Przemsza Siewierz': 'Siewierz',
  'Spójnia Landek-Jasienica': 'Landek',
  'Polonia Łaziska Górne': 'Łaziska Górne',
  'Drama Zbrosławice': 'Zbrosławice',
  'Szombierki Bytom': 'Bytom',
  'Kuźnia Ustroń': 'Ustroń',
  'Decor Bełk': 'Bełk',
  'Podlesianka Katowice': 'Katowice',
  'Iskra Gliwice II': 'Gliwice',
  'Gwarek Tarnowskie Góry': 'Tarnowskie Góry',
  'Rozwój Katowice': 'Katowice',
  'Victoria Kosmos Częstochowa': 'Częstochowa',
  'Arka Pawłów': 'Pawłów',
  'Orlęta Kielce': 'Kielce',
  'Sparta Kazimierza Wielka': 'Kazimierza Wielka',
  'Neptun Końskie': 'Końskie',
  'GKS Nowiny': 'Nowiny',
  'Victoria 2015 Skalbmierz': 'Skalbmierz',
  'Spartakus Daleszyce': 'Daleszyce',
  'GKS Rudki': 'Rudki',
  'OKS Opatów': 'Opatów',
  'Jodła Kielce III': 'Kielce',
  'Alit Ożarów': 'Ożarów',
  'Wicher Miedziana Góra': 'Miedziana Góra',
  'Klimontowianka Klimontów': 'Klimontów',
  'Wierna Małogoszcz': 'Małogoszcz',
  'Granat Skarżysko-Kamienna': 'Skarżysko-Kamienna',
  'Hetman Włoszczowa': 'Włoszczowa',
  'Orlicz Suchedniów': 'Suchedniów',
  'Stomil Olsztyn': 'Olsztyn',
  'Concordia Elbląg': 'Elbląg',
  'Granica Kętrzyn': 'Kętrzyn',
  'Sokół Ostróda': 'Ostróda',
  'Tęcza Biskupiec': 'Biskupiec',
  'Pisa Eco-Ter Barczewo': 'Barczewo',
  'Rominta Gołdap': 'Gołdap',
  'DKS Dobre Miasto': 'Dobre Miasto',
  'Mazur Ełk': 'Ełk',
  'Znicz Biała Piska': 'Biała Piska',
  'Naki Olsztyn': 'Olsztyn',
  'Start Nidzica': 'Nidzica',
  'Zatoka Braniewo': 'Braniewo',
  'Mamry Giżycko': 'Giżycko',
  'Polonia Pasłęk': 'Pasłęk',
  'Górnik Konin': 'Konin',
  'Pogoń Nowe Skalmierzyce': 'Nowe Skalmierzyce',
  'Polonia Golina': 'Golina',
  'Mieszko Gniezno': 'Gniezno',
  'Obra 1912 Kościan': 'Kościan',
  'Piast Kobylnica': 'Kobylnica',
  'Polonia Chodzież': 'Chodzież',
  'Kania Gostyń': 'Gostyń',
  'Kłos Budzyń': 'Budzyń',
  Gołuchów: 'Gołuchów',
  'Astra Krotoszyn': 'Krotoszyn',
  'Polonia 1912 Leszno': 'Leszno',
  'Meblorz Swarzędz': 'Swarzędz',
  'Huragan Pobiedziska': 'Pobiedziska',
  'Warta Śrem': 'Śrem',
  'Nielba Wągrowiec': 'Wągrowiec',
  'Avia Kamionki': 'Kamionki',
  'Ostrovia 1909 Ostrów Wielkopolski': 'Ostrów Wielkopolski',
  'Latarnia Szczecin II': 'Szczecin',
  'Wybrzeże Rewalskie Rewal': 'Rewal',
  'Arkonia Szczecin': 'Szczecin',
  'Kotwica Kołobrzeg': 'Kołobrzeg',
  'Zorza Szczecin II': 'Szczecin',
  'Gwardia Koszalin': 'Koszalin',
  'Biali Sądów': 'Sądów',
  'Sparta Gryfice': 'Gryfice',
  'Dąb Dębno': 'Dębno',
  'Astra Ustronie Morskie': 'Ustronie Morskie',
  'Iskierka Szczecin': 'Szczecin',
  'Ina Ińsko': 'Ińsko',
  'Chemik Police': 'Police',
  'Orzeł Wałcz': 'Wałcz',
  'Pogoń Barlinek': 'Barlinek',
  'GKS Manowo': 'Manowo',
}

function resolveClubRegion(clubName: string, leagueId?: string, city?: string) {
  if (leagueId?.startsWith('fourth-')) return leagueId
  const group = leagueId ? leagueGroups[leagueId as LeagueGroupId] : undefined
  if (group && 'regionId' in group) return group.regionId
  const resolvedCity = cityByClub[clubName] ?? warminskoMazurskieClubCities[clubName] ?? fourthLeagueClubCities[clubName] ?? clubCities[clubName] ?? city ?? ''
  const regionId = cityRegions[resolvedCity]
  if (regionId) return regionId
  if (leagueId?.startsWith('third-')) {
    const fallbackByGroup: Record<string, string> = {
      'third-1': 'fourth-mazowieckie',
      'third-2': 'fourth-wielkopolskie',
      'third-3': 'fourth-dolnoslaskie',
      'third-4': 'fourth-lubelskie',
    }
    return fallbackByGroup[leagueId] ?? 'fourth-mazowieckie'
  }
  return 'fourth-mazowieckie'
}

export function getRegionForCity(city: string) {
  const normalizedCity = city.trim()
  const explicitRegion = cityRegions[normalizedCity]
  if (explicitRegion) return explicitRegion
  const regionalGroup = Object.entries(leagueGroups).find(([leagueId, group]) =>
    leagueId.startsWith('fourth-') && group.clubs.some((club) =>
      (fourthLeagueClubCities[club] ?? cityByClub[club] ?? clubCities[club]) === normalizedCity,
    ),
  )
  return regionalGroup?.[0]
}

const firstNames = [
  'Antoni', 'Jakub', 'Jan', 'Szymon', 'Filip', 'Mikołaj', 'Wiktor', 'Kacper', 'Mateusz', 'Michał',
  'Adam', 'Oskar', 'Dawid', 'Bartosz', 'Tymon', 'Igor', 'Marcel', 'Piotr', 'Aleksander', 'Franciszek',
  'Wojciech', 'Stanisław', 'Nikodem', 'Leon', 'Maksymilian', 'Marek', 'Tomasz', 'Paweł', 'Krzysztof', 'Łukasz',
  'Kamil', 'Daniel', 'Patryk', 'Artur', 'Rafał', 'Grzegorz', 'Dominik', 'Hubert', 'Błażej', 'Eryk',
  'Kornel', 'Alan', 'Sebastian', 'Robert', 'Marian', 'Jędrzej', 'Konrad', 'Przemysław', 'Radosław', 'Cezary',
  'Tadeusz', 'Karol', 'Maciej', 'Gabriel', 'Kuba', 'Miłosz', 'Iwo', 'Kajetan', 'Bruno', 'Tytus',
  'Julian', 'Władysław', 'Arkadiusz', 'Dariusz', 'Borys', 'Oliwier', 'Emil', 'Mieszko', 'Ksawery', 'Feliks',
  'Natan', 'Dorian', 'Roch', 'Witold', 'Zbigniew', 'Jerzy', 'Leszek', 'Mirosław', 'Edmund', 'Roman',
]
const lastNames = [
  'Kowalski', 'Nowak', 'Wiśniewski', 'Wójcik', 'Kamiński', 'Lewandowski', 'Zieliński', 'Szymański', 'Woźniak', 'Dąbrowski',
  'Kozłowski', 'Jankowski', 'Mazur', 'Krawczyk', 'Kaczmarek', 'Piotrowski', 'Grabowski', 'Pawlak', 'Michalski', 'Król',
  'Wieczorek', 'Jabłoński', 'Wróbel', 'Nowicki', 'Majewski', 'Olszewski', 'Stępień', 'Malinowski', 'Jaworski', 'Adamczyk',
  'Dudek', 'Pawłowski', 'Górski', 'Sikora', 'Walczak', 'Baran', 'Rutkowski', 'Michalak', 'Szewczyk', 'Ostrowski',
  'Tomaszewski', 'Pietrzak', 'Zając', 'Wróblewski', 'Marciniak', 'Duda', 'Zalewski', 'Bąk', 'Jakubowski', 'Wilk',
  'Sadowski', 'Witkowski', 'Lis', 'Chmielewski', 'Kubiak', 'Maciejewski', 'Czarnecki', 'Kaźmierczak', 'Sobczak', 'Urbański',
  'Kalinowski', 'Sokołowski', 'Masłowski', 'Cieślak', 'Kucharski', 'Kołodziej', 'Błaszczyk', 'Brzeziński', 'Laskowski', 'Zakrzewski',
  'Głowacki', 'Szczepański', 'Krupiński', 'Czerwiński', 'Mazurek', 'Kurek', 'Włodarczyk', 'Szulc', 'Kaczor', 'Musiał',
]

export function ensureUniqueGamePlayerNames(game: GameState) {
  const allPlayers = [
    ...game.squad,
    ...game.market,
    ...Object.values(game.clubSquads ?? {}).flatMap((offers) => offers.map(({ player }) => player)),
    ...(game.academyPlayers ?? []),
    ...(game.academyProspect ? [game.academyProspect] : []),
    ...(game.scouts ?? []).flatMap((scout) => scout.prospect ? [scout.prospect] : []),
  ]
  const playersById = new Map<string, Player>()
  for (const player of allPlayers) {
    if (!playersById.has(player.id)) playersById.set(player.id, player)
  }
  const uniquePlayers = [...playersById.values()]
  const usedNames = new Set<string>()
  for (const player of uniquePlayers) {
    const normalizeName = () => `${player.firstName} ${player.lastName}`.normalize('NFKC').trim().toLocaleLowerCase('pl-PL')
    if (!usedNames.has(normalizeName())) {
      usedNames.add(normalizeName())
      continue
    }
    let hash = 0
    for (const character of player.id) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0
    const combinationCount = firstNames.length * lastNames.length
    let foundUniqueName = false
    for (let offset = 0; offset < combinationCount; offset += 1) {
      const nameIndex = (hash + offset) % combinationCount
      player.firstName = firstNames[Math.floor(nameIndex / lastNames.length)]
      player.lastName = lastNames[nameIndex % lastNames.length]
      const normalizedName = normalizeName()
      if (usedNames.has(normalizedName)) continue
      usedNames.add(normalizedName)
      foundUniqueName = true
      break
    }
    if (!foundUniqueName) {
      let suffix = 2
      do {
        player.lastName = `${lastNames[hash % lastNames.length]} ${suffix++}`
      } while (usedNames.has(normalizeName()))
      usedNames.add(normalizeName())
    }
  }
  for (const player of allPlayers) {
    const canonicalPlayer = playersById.get(player.id)
    if (canonicalPlayer && player !== canonicalPlayer) {
      player.firstName = canonicalPlayer.firstName
      player.lastName = canonicalPlayer.lastName
    }
  }
}
const positions: Position[] = ['BR', 'BR', 'PO', 'PO', 'ŚO', 'ŚO', 'ŚO', 'LO', 'LO', 'DP', 'DP', 'ŚP', 'ŚP', 'ŚP', 'OP', 'PP', 'PP', 'LP', 'LP', 'PN', 'PN', 'LN', 'LN', 'ŚN']
const formationPositionOrders: Record<Formation, Position[]> = {
  '4-3-3': ['BR', 'PO', 'ŚO', 'ŚO', 'LO', 'DP', 'ŚP', 'OP', 'PN', 'ŚN', 'LN'],
  '4-4-2': ['BR', 'PO', 'ŚO', 'ŚO', 'LO', 'LP', 'ŚP', 'ŚP', 'PP', 'ŚN', 'ŚN'],
  '4-2-3-1': ['BR', 'PO', 'ŚO', 'ŚO', 'LO', 'DP', 'DP', 'OP', 'PN', 'ŚN', 'LN'],
  '3-5-2': ['BR', 'PO', 'ŚO', 'LO', 'LP', 'DP', 'ŚP', 'OP', 'PP', 'ŚN', 'ŚN'],
  '3-4-3': ['BR', 'PO', 'ŚO', 'LO', 'LP', 'DP', 'OP', 'PP', 'LN', 'ŚN', 'PN'],
  '5-3-2': ['BR', 'PO', 'ŚO', 'ŚO', 'ŚO', 'LO', 'DP', 'ŚP', 'OP', 'ŚN', 'ŚN'],
  '4-1-4-1': ['BR', 'PO', 'ŚO', 'ŚO', 'LO', 'DP', 'LP', 'ŚP', 'ŚP', 'PP', 'ŚN'],
  '4-3-2-1': ['BR', 'PO', 'ŚO', 'ŚO', 'LO', 'DP', 'ŚP', 'OP', 'LP', 'PP', 'ŚN'],
}
const formationPositions = formationPositionOrders['4-2-3-1']
const outfieldPositionGroups: Record<Exclude<Position, 'BR'>, 'defense' | 'midfield' | 'attack'> = {
  PO: 'defense', ŚO: 'defense', LO: 'defense',
  DP: 'midfield', ŚP: 'midfield', OP: 'midfield', PP: 'midfield', LP: 'midfield',
  PN: 'attack', LN: 'attack', ŚN: 'attack',
}

export function canPlayPosition(player: Player, position: Position) {
  return player.position === position || player.secondaryPositions?.includes(position) === true
}

export function positionTrainingSessionsRequired(player: Player, targetPosition: Position) {
  const currentPosition = player.position as Position
  if (currentPosition === 'BR' || targetPosition === 'BR') return null
  const currentGroup = outfieldPositionGroups[currentPosition as Exclude<Position, 'BR'>]
  const targetGroup = outfieldPositionGroups[targetPosition]
  return currentGroup === targetGroup ? 3 : 5
}
const facilityCosts: Record<Exclude<FacilityId, 'stand'>, number[]> = {
  catering: [450_000, 800_000, 1_300_000],
  academy: [700_000, 1_150_000, 1_800_000, 2_800_000, 4_200_000],
  training: [350_000, 900_000, 1_800_000, 3_500_000, 6_000_000],
}

export const stadiumStages = [
  { capacity: 500, image: '/images/stadium/stadium-500.jpg' },
  { capacity: 1_500, image: '/images/stadium/stadium-1500.jpg' },
  { capacity: 5_000, image: '/images/stadium/stadium-5000.jpg' },
  { capacity: 7_500, image: '/images/stadium/stadium-7500.jpg' },
  { capacity: 10_000, image: '/images/stadium/stadium-10000.jpg' },
  { capacity: 15_000, image: '/images/stadium/stadium-15000.jpg' },
  { capacity: 17_500, image: '/images/stadium/stadium-17500.jpg' },
  { capacity: 21_000, image: '/images/stadium/stadium-21000.jpg' },
  { capacity: 28_000, image: '/images/stadium/stadium-28000.jpg' },
  { capacity: 35_000, image: '/images/stadium/stadium-35000.jpg' },
  { capacity: 45_000, image: '/images/stadium/stadium-45000.jpg' },
  { capacity: 55_000, image: '/images/stadium/stadium-55000.jpg' },
] as const

const stadiumUpgradeCosts = [1_400_000, 2_300_000, 3_500_000, 5_000_000, 7_000_000, 9_500_000, 12_500_000, 16_000_000, 20_000_000, 25_000_000, 31_000_000]
const stadiumUpgradeHours = [3, 6, 12, 18, 24, 36, 48, 60, 72, 96, 120]
const trainingBaseUpgradeHours = [3, 6, 12, 24, 48]
const academyUpgradeHours = [3, 6, 12, 24, 48]

export const trainingBaseStages = [
  { name: 'Mała baza treningowa', image: '/images/training/training-base-1.jpg' },
  { name: 'Średnia baza treningowa', image: '/images/training/training-base-2.jpg' },
  { name: 'Duża baza treningowa', image: '/images/training/training-base-3.jpg' },
  { name: 'Wielka baza treningowa', image: '/images/training/training-base-4.jpg' },
  { name: 'Profesjonalna baza treningowa', image: '/images/training/training-base-5.jpg' },
] as const

export const academyStages = [
  { label: 'ETAP 1', image: '/images/academy/academy.jpg' },
  { label: 'ETAP 2', image: '/images/academy/academy.jpg' },
  { label: 'ETAP 3', image: '/images/academy/academy.jpg' },
  { label: 'ETAP 4', image: '/images/academy/academy.jpg' },
  { label: 'ETAP 5', image: '/images/academy/academy.jpg' },
] as const

export function getStadiumStageIndex(capacity: number) {
  return stadiumStages.reduce((closestIndex, stage, index) => (
    Math.abs(stage.capacity - capacity) < Math.abs(stadiumStages[closestIndex].capacity - capacity)
      ? index
      : closestIndex
  ), 0)
}

export function getStadiumStage(capacity: number) {
  return stadiumStages[getStadiumStageIndex(capacity)]
}

export function getNextStadiumStage(capacity: number) {
  return stadiumStages[getStadiumStageIndex(capacity) + 1] ?? null
}

export function getFacilityConstructionCost(game: GameState, facilityId: FacilityId) {
  if (facilityId === 'stand') {
    return stadiumUpgradeCosts[getStadiumStageIndex(game.stadiumCapacity)] ?? null
  }
  return facilityCosts[facilityId][game.facilities[facilityId] ?? 0] ?? null
}

export function getFacilityConstructionDurationMs(targetLevel: number, facilityId: FacilityId = 'stand') {
  const hoursByLevel = facilityId === 'stand'
    ? stadiumUpgradeHours
    : facilityId === 'training'
      ? trainingBaseUpgradeHours
      : facilityId === 'academy'
        ? academyUpgradeHours
      : [3, 6, 12]
  const hours = hoursByLevel[targetLevel - 1]
  if (!hours) throw new Error(`Nieprawidłowy poziom rozbudowy: ${targetLevel}.`)
  return hours * 60 * 60 * 1000
}

export function completeFacilityConstruction(game: GameState, now = Date.now()) {
  const construction = game.facilityConstruction
  if (!construction || now < construction.completesAt) return { game, completed: false }

  const next = structuredClone(game)
  const completedConstruction = next.facilityConstruction
  if (!completedConstruction) return { game, completed: false }
  if (completedConstruction.facilityId === 'stand' && completedConstruction.targetCapacity !== undefined) {
    next.stadiumCapacity = completedConstruction.targetCapacity
    next.facilities.stand += 1
  } else {
    next.facilities[completedConstruction.facilityId] = completedConstruction.targetLevel
    if (completedConstruction.facilityId === 'stand') next.stadiumCapacity += 4_000
  }
  next.facilityConstruction = null
  const names: Record<FacilityId, string> = {
    stand: 'trybuna',
    catering: 'punkty gastronomiczne',
    academy: 'akademia młodzieżowa',
    training: 'baza treningowa',
  }
  const isAcademyEstablished = completedConstruction.facilityId === 'academy' && completedConstruction.targetLevel === 1
  const constructionSummary = completedConstruction.facilityId === 'stand' && completedConstruction.targetCapacity !== undefined
    ? `Stadion ma teraz pojemność ${completedConstruction.targetCapacity.toLocaleString('pl-PL')} miejsc.`
    : isAcademyEstablished
      ? 'Akademia młodzieżowa została założona. Klub może teraz prowadzić nabór i rozwijać własnych juniorów.'
      : `${names[completedConstruction.facilityId]} osiąga poziom ${completedConstruction.targetLevel}. Obiekt jest już dostępny dla klubu.`
  const constructionHeadline = isAcademyEstablished
    ? 'Założono akademię młodzieżową'
    : `Zakończono rozbudowę: ${names[completedConstruction.facilityId]}`
  addMediaPost(next, 'KLUB', constructionHeadline, constructionSummary)
  const emailSubject = isAcademyEstablished
    ? 'Akademia młodzieżowa jest gotowa'
    : `Zakończono budowę: ${names[completedConstruction.facilityId]}`
  const emailBody = completedConstruction.facilityId === 'stand' && completedConstruction.targetCapacity !== undefined
    ? `Prace przy stadionie zostały zakończone. Obiekt ma teraz pojemność ${completedConstruction.targetCapacity.toLocaleString('pl-PL')} miejsc i jest gotowy na kolejne mecze.`
    : isAcademyEstablished
      ? 'Budowa akademii młodzieżowej została zakończona. Akademia jest już dostępna i może rozpocząć nabór oraz rozwój juniorów.'
      : `Prace zostały zakończone. ${names[completedConstruction.facilityId]} osiąga poziom ${completedConstruction.targetLevel} i jest już dostępna dla klubu.`
  addInboxMessage(next, 'Dział infrastruktury klubu', emailSubject, emailBody, 'info', 'club', undefined, undefined, undefined, 'club')
  return { game: next, completed: true }
}
const academyNames = ['Akademia Młodych Orłów', 'Centrum Rozwoju Talentów', 'Szkoła Mistrzów', 'Akademia Elitarna', 'Akademia Profesjonalna']
const sportsJournalists = ['Marek Borkowski', 'Kinga Wójcik', 'Paweł Lewicki', 'Oskar Kamiński']
const scoutNames = ['Tomasz Krawiec', 'Michał Sokołowski', 'Paweł Domański', 'Rafał Zieliński', 'Łukasz Wrona', 'Adam Błaszczyk']
const staffNames = ['Marek Kaczmarek', 'Piotr Malinowski', 'Robert Kamiński', 'Andrzej Wójcik']
export const staffRoles: Record<StaffRole, { label: string; description: string; hiringCost: number; wagePerRound: number }> = {
  'fitness-coach': {
    label: 'Trener przygotowania fizycznego',
    description: 'Zwiększa regenerację podstawowej jedenastki podczas treningu kondycyjnego.',
    hiringCost: 180_000,
    wagePerRound: 24_000,
  },
  'technical-coach': {
    label: 'Trener techniczny',
    description: 'Rozwija także pomocników podczas treningu ofensywnego.',
    hiringCost: 240_000,
    wagePerRound: 32_000,
  },
  physiotherapist: {
    label: 'Fizjoterapeuta',
    description: 'Skraca rekonwalescencję kontuzjowanych zawodników.',
    hiringCost: 280_000,
    wagePerRound: 36_000,
  },
}
export const scoutPackages: Record<ScoutExperience, { label: string; description: string; hiringCost: number; wagePerRound: number; roundsPerReport: number }> = {
  rookie: { label: 'Początkujący', description: 'Tańszy kontrakt, raport co 4 kolejki.', hiringCost: 60_000, wagePerRound: 12_000, roundsPerReport: 4 },
  experienced: { label: 'Doświadczony', description: 'Lepsza ocena potencjału, raport co 3 kolejki.', hiringCost: 220_000, wagePerRound: 32_000, roundsPerReport: 3 },
  expert: { label: 'Ekspert', description: 'Najwyższa jakość obserwacji, raport co 2 kolejki.', hiringCost: 600_000, wagePerRound: 75_000, roundsPerReport: 2 },
}

function addMediaPost(state: GameState, category: MediaPost['category'], headline: string, body: string) {
  state.mediaPosts.unshift({
    id: createId(),
    category,
    headline,
    body,
    author: sportsJournalists[Math.floor(Math.random() * sportsJournalists.length)],
    date: new Date().toISOString(),
    views: Math.round(state.followers * (0.35 + Math.random() * 0.55)),
  })
  state.mediaPosts = state.mediaPosts.slice(0, 50)
}

function addInboxMessage(
  state: GameState,
  sender: string,
  subject: string,
  body: string,
  status: InboxMessage['status'] = 'info',
  category: InboxMessage['category'] = 'transfer',
  relatedNegotiationId?: string,
  polishCupDraw?: InboxMessage['polishCupDraw'],
  polishCupResults?: InboxMessage['polishCupResults'],
  action?: InboxMessage['action'],
): InboxMessage {
  state.inboxMessages ??= []
  const message: InboxMessage = {
    id: createId(),
    sender,
    subject,
    body,
    date: `${state.season} · kolejka ${state.round}`,
    read: false,
    category,
    status,
    relatedNegotiationId,
    polishCupDraw,
    polishCupResults,
    action,
  }
  state.inboxMessages.unshift(message)
  return message
}

const seasonEventTemplates: Array<{
  sender: string
  subject: string
  body: string
  choices: SeasonEventChoice[]
  minimumTier?: LeagueTier
}> = [
  {
    sender: 'Klub kibica',
    subject: 'Kibice chcą spotkać się z drużyną',
    body: 'Stowarzyszenie kibiców proponuje otwarty trening i krótkie spotkanie z zawodnikami. To szansa na zbudowanie więzi z lokalną społecznością, ale organizacja wydarzenia wymaga nakładów.',
    choices: [
      { id: 'open-training', label: 'Zorganizuj otwarty trening', description: 'Koszt 55 000 zł · większe zainteresowanie klubem.', outcome: 'Otwarty trening przyciągnął kibiców i wzmocnił więź drużyny z trybunami.', effects: { cash: -55_000, morale: 2, stamina: 0, confidence: 2, followers: 900, localReputation: 5 } },
      { id: 'meet-after-training', label: 'Spotkaj się z kibicami po treningu', description: 'Bez dodatkowych kosztów, ale mniejszy rozgłos.', outcome: 'Krótkie spotkanie zostało dobrze przyjęte przez kibiców.', effects: { cash: 0, morale: 1, stamina: 0, confidence: 1, followers: 300, localReputation: 3 } },
      { id: 'decline-supporters', label: 'Odmów w tym terminie', description: 'Zachowaj czas i budżet, ryzykując rozczarowanie fanów.', outcome: 'Kibice uszanowali decyzję, choć część z nich liczyła na spotkanie.', effects: { cash: 0, morale: 0, stamina: 0, confidence: -1, followers: -250, localReputation: -2 } },
    ],
  },
  {
    sender: 'Rada drużyny',
    subject: 'Zespół prosi o wspólną regenerację',
    body: 'Po intensywnym okresie kapitan sugeruje wspólny posiłek i spokojniejszy dzień. Możesz zadbać o atmosferę, przeznaczyć czas na analizę albo zignorować prośbę.',
    choices: [
      { id: 'team-meal', label: 'Zorganizuj wspólny posiłek', description: 'Koszt 35 000 zł · wyraźna poprawa morale.', outcome: 'Zawodnicy docenili wspólny czas poza boiskiem.', effects: { cash: -35_000, morale: 5, stamina: 2, confidence: 1, followers: 0 } },
      { id: 'recovery-session', label: 'Zamień trening na regenerację', description: 'Popraw kondycję kadry kosztem części intensywności przygotowań.', outcome: 'Lżejszy dzień pomógł drużynie odzyskać siły.', effects: { cash: 0, morale: 2, stamina: 5, confidence: 0, followers: 0 } },
      { id: 'keep-schedule', label: 'Utrzymaj plan treningowy', description: 'Nie zmieniaj przygotowań; morale może ucierpieć.', outcome: 'Zespół zrealizował plan, ale zawodnicy liczyli na chwilę oddechu.', effects: { cash: 0, morale: -2, stamina: -2, confidence: 0, followers: 0 } },
    ],
  },
  {
    sender: 'Rada drużyny',
    subject: 'Drużyna prosi o nowy sprzęt treningowy',
    body: 'Zawodnicy zgłaszają, że część wyposażenia treningowego wymaga wymiany. Inwestycja pokaże, że klub dba o warunki pracy kadry, a odmowa pozwoli zachować środki na bieżące wydatki.',
    choices: [
      { id: 'new-equipment', label: 'Kup nowe wyposażenie', description: 'Koszt 65 000 zł · pokaż, że rozwój kadry jest priorytetem.', outcome: 'Nowe wyposażenie trafiło do ośrodka treningowego. Zawodnicy docenili inwestycję.', effects: { cash: -65_000, morale: 1, stamina: 0, confidence: 2, followers: 100 } },
      { id: 'shared-equipment', label: 'Przekaż używany sprzęt', description: 'Bez kosztów · niewielka poprawa morale drużyny.', outcome: 'Kadra otrzymała część używanego wyposażenia.', effects: { cash: 0, morale: 1, stamina: 0, confidence: 1, followers: 0 } },
      { id: 'postpone-equipment', label: 'Odłóż zakup na później', description: 'Zachowaj budżet, ale osłab zaufanie zawodników.', outcome: 'Zakup został odłożony. Zawodnicy będą ponawiać prośbę.', effects: { cash: 0, morale: -1, stamina: 0, confidence: -1, followers: 0 } },
    ],
  },
  {
    sender: 'Lokalna fundacja sportowa',
    subject: 'Zaproszenie do akcji charytatywnej',
    body: 'Lokalna fundacja zaprasza klub do udziału w wydarzeniu dla młodych mieszkańców. Możesz wesprzeć akcję finansowo albo włączyć do niej zawodników.',
    choices: [
      { id: 'charity-donation', label: 'Wesprzyj fundację finansowo', description: 'Darowizna 40 000 zł · pozytywny odbiór społeczny.', outcome: 'Fundacja podziękowała klubowi za wsparcie, a mieszkańcy docenili gest.', effects: { cash: -40_000, morale: 1, stamina: 0, confidence: 2, followers: 650, localReputation: 5 } },
      { id: 'players-charity', label: 'Wyślij zawodników na wydarzenie', description: 'Bez kosztu finansowego · popraw relacje z kibicami.', outcome: 'Zawodnicy spotkali się z młodymi fanami i zebrali wiele podziękowań.', effects: { cash: 0, morale: 2, stamina: -1, confidence: 1, followers: 450, localReputation: 4 } },
      { id: 'decline-charity', label: 'Odmów udziału', description: 'Skup się na przygotowaniach do kolejnego meczu.', outcome: 'Klub skupił się na sporcie, ale fundacja liczyła na współpracę.', effects: { cash: 0, morale: 0, stamina: 0, confidence: -1, followers: -200, localReputation: -2 } },
    ],
  },
  {
    sender: 'Sponsor klubu',
    subject: 'Sponsor proponuje dodatkową aktywację',
    body: 'Sponsor chce przygotować krótką akcję promocyjną z udziałem drużyny. Udział zapewni klubowi dodatkowe środki, ale zawodnicy poświęcą część czasu na obowiązki poza boiskiem.',
    choices: [
      { id: 'sponsor-activation', label: 'Przyjmij propozycję', description: 'Wpływ 45 000 zł · niewielki koszt dla koncentracji zespołu.', outcome: 'Akcja promocyjna zakończyła się sukcesem, a sponsor przekazał dodatkowe środki.', effects: { cash: 45_000, morale: -1, stamina: -1, confidence: 1, followers: 300 } },
      { id: 'negotiate-activation', label: 'Poproś o większy udział klubu', description: 'Wpływ 25 000 zł · zachowaj więcej czasu dla zawodników.', outcome: 'Sponsor zaakceptował skromniejszą akcję i przekazał klubowi 25 000 zł.', effects: { cash: 25_000, morale: 0, stamina: 0, confidence: 1, followers: 150 } },
      { id: 'decline-activation', label: 'Odmów i skup się na treningu', description: 'Bez dodatkowych wpływów, ale zespół zachowa czas.', outcome: 'Zawodnicy skupili się na treningu, a sponsor zaakceptował odmowę.', effects: { cash: 0, morale: 1, stamina: 1, confidence: 0, followers: 0 } },
    ],
  },
  {
    sender: 'Lokalne media',
    subject: 'Klub przed derbami pod lupą',
    body: 'Dziennikarze chcą porozmawiać z trenerem przed ważnym lokalnym spotkaniem. Możesz podgrzać atmosferę, zdjąć presję z piłkarzy albo odmówić komentarza.',
    choices: [
      { id: 'derby-confident', label: 'Zapowiedz walkę o zwycięstwo', description: 'Dodaj drużynie wiary w siebie i zainteresuj kibiców.', outcome: 'Odważna zapowiedź zmobilizowała część zespołu i przyciągnęła uwagę lokalnych mediów.', effects: { cash: 0, morale: 3, stamina: 0, confidence: 1, followers: 500 } },
      { id: 'derby-calm', label: 'Podkreśl, że to tylko kolejny mecz', description: 'Ogranicz presję, stawiając na spokojne przygotowania.', outcome: 'Spokojny ton pozwolił drużynie skupić się na treningu bez dodatkowej presji.', effects: { cash: 0, morale: 1, stamina: 1, confidence: 0, followers: 100 } },
      { id: 'derby-decline', label: 'Nie udzielaj wywiadu', description: 'Zachowaj koncentrację, ale zrezygnuj z rozgłosu.', outcome: 'Klub odmówił komentarza. Przygotowania pozostały bez zmian.', effects: { cash: 0, morale: 0, stamina: 0, confidence: 0, followers: -100 } },
    ],
  },
  {
    sender: 'Zarząd klubu',
    subject: 'Dodatkowe środki na rozwój drużyny',
    body: 'Zarząd rozważa jednorazowe wsparcie zespołu. Możesz przeznaczyć je na rozwój kadry, poprosić o ostrożniejszy budżet albo skupić się na istniejących zasobach.',
    choices: [
      { id: 'development-grant', label: 'Przyjmij grant na rozwój', description: 'Wpływ 30 000 zł i niewielki wzrost zaufania zarządu.', outcome: 'Klub otrzymał dodatkowe środki na rozwój. Zarząd oczekuje rozsądnego wykorzystania budżetu.', effects: { cash: 30_000, morale: 1, stamina: 0, confidence: 2, followers: 0 } },
      { id: 'development-plan', label: 'Przedstaw plan oszczędnościowy', description: 'Wpływ 15 000 zł bez zmian w obciążeniu zawodników.', outcome: 'Zarząd zaakceptował ostrożny plan i przyznał mniejsze wsparcie.', effects: { cash: 15_000, morale: 0, stamina: 0, confidence: 1, followers: 0 } },
      { id: 'development-decline', label: 'Odmów dodatkowych zobowiązań', description: 'Zachowaj niezależność kosztem niewielkiego rozczarowania zarządu.', outcome: 'Zespół pozostał przy dotychczasowym planie, a zarząd liczy na lepsze wyniki sportowe.', effects: { cash: 0, morale: 0, stamina: 0, confidence: -1, followers: 0 } },
    ],
  },
  {
    minimumTier: 6,
    sender: 'Lokalny przewoźnik',
    subject: 'Awaria klubowego busa przed wyjazdem',
    body: 'Klubowy bus odmówił posłuszeństwa przed najbliższym wyjazdem. Lokalny przewoźnik może podstawić autokar, ale trzeba szybko zdecydować, jak zorganizować podróż.',
    choices: [
      { id: 'local-bus-charter', label: 'Wynajmij autokar', description: 'Koszt 12 000 zł · drużyna pojedzie wygodnie i bez dodatkowego zmęczenia.', outcome: 'Lokalny przewoźnik podstawił autokar. Drużyna dotarła na miejsce wypoczęta.', effects: { cash: -12_000, morale: 1, stamina: 2, confidence: 1, followers: 0 } },
      { id: 'local-bus-carpool', label: 'Zorganizuj wspólny dojazd samochodami', description: 'Bez kosztów, ale długa podróż zmęczy zawodników.', outcome: 'Zawodnicy i działacze zorganizowali wspólny dojazd. Klub zaoszczędził, choć podróż była męcząca.', effects: { cash: 0, morale: 1, stamina: -3, confidence: 0, followers: 0, localReputation: 1 } },
    ],
  },
  {
    minimumTier: 6,
    sender: 'Gospodarz boiska',
    subject: 'Boisko wymaga pilnych prac',
    body: 'Po ostatnich opadach stan murawy utrudnia treningi. Gospodarz obiektu proponuje szybkie prace albo wspólne uporządkowanie boiska z pomocą zawodników i kibiców.',
    choices: [
      { id: 'local-pitch-repair', label: 'Zleć naprawę murawy', description: 'Koszt 18 000 zł · popraw warunki do treningu.', outcome: 'Murawa została wyrównana i drużyna może wrócić do normalnych treningów.', effects: { cash: -18_000, morale: 1, stamina: 1, confidence: 1, followers: 0, localReputation: 2 } },
      { id: 'local-pitch-volunteers', label: 'Poproś o pomoc kibiców i zawodników', description: 'Bez kosztów, ale wspólne prace zabiorą część sił drużyny.', outcome: 'Kibice i zawodnicy wspólnie przygotowali boisko. Klub zaoszczędził, a lokalna społeczność poczuła się częścią drużyny.', effects: { cash: 0, morale: 2, stamina: -2, confidence: 1, followers: 150, localReputation: 7 } },
      { id: 'local-pitch-postpone', label: 'Odłóż prace na później', description: 'Zachowaj środki, ryzykując gorsze warunki treningu.', outcome: 'Prace przełożono. Drużyna musi na razie trenować na nierównej murawie.', effects: { cash: 0, morale: -1, stamina: 0, confidence: -1, followers: 0, localReputation: -3 } },
    ],
  },
  {
    minimumTier: 6,
    sender: 'Lokalny przedsiębiorca',
    subject: 'Firma z okolicy chce wesprzeć klub',
    body: 'Właściciel lokalnej firmy proponuje jednorazowe wsparcie w zamian za skromną promocję podczas meczu. To szansa na zastrzyk gotówki i nawiązanie relacji z kolejnym partnerem.',
    choices: [
      { id: 'local-sponsor-activation', label: 'Przyjmij wsparcie i zorganizuj spotkanie', description: 'Wpływ 16 000 zł · zawodnicy poświęcą trochę czasu na spotkanie z firmą.', outcome: 'Lokalna firma wsparła budżet klubu, a spotkanie z drużyną zostało dobrze przyjęte.', effects: { cash: 16_000, morale: 1, stamina: -1, confidence: 1, followers: 200, localReputation: 5 } },
      { id: 'local-sponsor-simple', label: 'Przyjmij skromniejszą ofertę', description: 'Wpływ 8 000 zł · bez dodatkowych obowiązków dla drużyny.', outcome: 'Firma przekazała mniejsze wsparcie i nie wymagała udziału zawodników w promocji.', effects: { cash: 8_000, morale: 0, stamina: 0, confidence: 1, followers: 100, localReputation: 2 } },
      { id: 'local-sponsor-decline', label: 'Odmów i skup się na treningach', description: 'Bez dodatkowych wpływów, ale drużyna zachowa czas.', outcome: 'Klub podziękował za propozycję i skupił się na przygotowaniach sportowych.', effects: { cash: 0, morale: 1, stamina: 1, confidence: 0, followers: 0 } },
    ],
  },
  {
    minimumTier: 6,
    sender: 'Kierownik drużyny',
    subject: 'Zawodnicy nie mogą trenować w zwykłych godzinach',
    body: 'Kilku zawodników zgłosiło, że przez obowiązki zawodowe nie zdąży na trening o stałej porze. W klubie amatorskim trzeba pogodzić pracę z przygotowaniami do meczu.',
    choices: [
      { id: 'local-training-evening', label: 'Przenieś trening na późniejszą godzinę', description: 'Utrzymaj pełne zajęcia, choć późny trening zmęczy część drużyny.', outcome: 'Trening odbył się późnym wieczorem. Większość kadry mogła wziąć w nim udział.', effects: { cash: 0, morale: 2, stamina: -2, confidence: 1, followers: 0, localReputation: 3 } },
      { id: 'local-training-shortened', label: 'Zorganizuj krótsze zajęcia', description: 'Zadbaj o obecnych i oszczędź siły, ale trening będzie mniej intensywny.', outcome: 'Krótsze zajęcia pozwoliły zawodnikom pogodzić trening z pracą i zachować siły.', effects: { cash: 0, morale: 1, stamina: 2, confidence: 0, followers: 0, localReputation: 2 } },
      { id: 'local-training-usual', label: 'Pozostań przy dotychczasowej porze', description: 'Nie zmieniaj planu, choć część kadry opuści zajęcia.', outcome: 'Trening odbył się zgodnie z planem, ale nie wszyscy zawodnicy mogli w nim uczestniczyć.', effects: { cash: 0, morale: -2, stamina: 0, confidence: -1, followers: 0, localReputation: -3 } },
    ],
  },
]

function createSeasonEvent(state: GameState, chance = 0.3) {
  const seasonEvents = (state.inboxMessages ?? []).filter((message) => message.seasonEvent?.season === state.season)
  if (seasonEvents.length >= 7 || Math.random() >= chance) return
  const availableTemplates = seasonEventTemplates.filter((template) =>
    template.minimumTier === undefined || getLeagueTier(state.leagueId) >= template.minimumTier,
  )
  const template = availableTemplates[Math.floor(Math.random() * availableTemplates.length)]
  const message = addInboxMessage(state, template.sender, template.subject, template.body, 'info', 'club')
  message.seasonEvent = { season: state.season, choices: structuredClone(template.choices) }
  addMediaPost(state, 'KLUB', template.subject, template.body)
}

function createPlayerStory(state: GameState, chance = 0.22) {
  const seasonStories = (state.inboxMessages ?? []).filter((message) => message.playerStory?.season === state.season)
  if (seasonStories.length >= 3 || state.round < 3 || Math.random() >= chance) return
  const players = state.squad.filter((player) =>
    !seasonStories.some((message) => message.playerStory?.playerId === player.id)
    && !state.loanDeals?.some((deal) => deal.player.id === player.id),
  )
  if (!players.length) return
  const player = players[Math.floor(Math.random() * players.length)]
  const playerName = `${player.firstName} ${player.lastName}`
  const shared = { season: state.season, playerId: player.id, playerName }
  const teammates = state.squad.filter((candidate) => candidate.id !== player.id)
  let story: NonNullable<InboxMessage['playerStory']>
  let subject: string
  let body: string
  if (player.personality === 'temperamental' && teammates.length) {
    const teammate = teammates[Math.floor(Math.random() * teammates.length)]
    const teammateName = `${teammate.firstName} ${teammate.lastName}`
    story = {
      ...shared,
      relatedPlayerId: teammate.id,
      kind: 'conflict',
      choices: [
        { id: 'mediate-conflict', label: 'Porozmawiaj z oboma zawodnikami', description: 'Poświęć czas na mediację i odbuduj relację.', effects: { playerMorale: 5, teammateMorale: 3, chemistry: 7 }, outcome: `Mediacja uspokoiła konflikt między ${playerName} i ${teammateName}. Ich relacja wyraźnie się poprawiła.` },
        { id: 'warn-player', label: 'Upomnij zawodnika', description: 'Postaw na dyscyplinę, ryzykując pogorszenie atmosfery.', effects: { playerMorale: -4, teammateMorale: 2, chemistry: -3 }, outcome: `${playerName} przyjął upomnienie, ale napięcie między zawodnikami nie zniknęło.` },
      ],
    }
    subject = `Napięcie w szatni: ${playerName}`
    body = `${playerName} popadł w konflikt z ${teammateName}. Możesz spróbować mediacji albo postawić na dyscyplinę.`
  } else if ((player.personality === 'leader' || player.personality === 'loyal') && state.academyPlayers?.length) {
    story = {
      ...shared,
      kind: 'mentoring',
      choices: [
        { id: 'mentor-junior', label: 'Poproś o mentoring juniora', description: 'Doświadczony zawodnik pomoże jednemu z młodych piłkarzy.', effects: { playerMorale: 5, academySkill: 1 }, outcome: `${playerName} z zaangażowaniem wsparł juniora. Wspólna praca pomogła młodemu zawodnikowi rozwinąć umiejętności.` },
        { id: 'thank-veteran', label: 'Podziękuj za inicjatywę', description: 'Docenienie postawy poprawi atmosferę.', effects: { playerMorale: 3 }, outcome: `${playerName} docenił zaufanie i pozostaje ważnym głosem w szatni.` },
        { id: 'decline-mentoring', label: 'Odmów dodatkowych obowiązków', description: 'Skup zawodnika wyłącznie na treningach pierwszej drużyny.', effects: { playerMorale: -3 }, outcome: `${playerName} zaakceptował decyzję, choć liczył na większą odpowiedzialność.` },
      ],
    }
    subject = `Propozycja mentora: ${playerName}`
    body = `${playerName} chce pomóc w rozwoju młodego zawodnika akademii. Twoja decyzja wpłynie na morale lidera i postępy juniorów.`
  } else {
    story = {
      ...shared,
      kind: 'minutes',
      choices: [
        { id: 'promise-role', label: 'Zapewnij o większej roli', description: 'Wyraźne wsparcie zawodnika.', effects: { playerMorale: 8 }, outcome: `${playerName} docenił rozmowę i czuje, że jego rola w drużynie rośnie.` },
        { id: 'explain-rotation', label: 'Wyjaśnij zasady rotacji', description: 'Uczciwie przedstaw plan na kolejne tygodnie.', effects: { playerMorale: 3 }, outcome: `${playerName} zaakceptował sportowe argumenty i pozostaje zmotywowany.` },
        { id: 'reject-request', label: 'Odmów zmiany planu', description: 'Utrzymaj dotychczasową hierarchię.', effects: { playerMorale: -8, requestTransfer: player.personality === 'ambitious' }, outcome: `${playerName} jest rozczarowany decyzją.${player.personality === 'ambitious' ? ' Zawodnik poprosił o możliwość odejścia.' : ''}` },
      ],
    }
    subject = `Prośba zawodnika: ${playerName}`
    body = `${playerName} chce porozmawiać o swojej roli w zespole. Twoja odpowiedź wpłynie na jego morale${player.personality === 'ambitious' ? ' i może zdecydować o przyszłości zawodnika w klubie' : ''}.`
  }
  const message = addInboxMessage(
    state,
    playerName,
    subject,
    body,
    'info',
    'club',
  )
  message.playerStory = story
  addMediaPost(state, 'KLUB', subject, body)
}

function createAcademyStory(state: GameState, chance = 0.18) {
  const seasonStories = (state.inboxMessages ?? []).filter((message) =>
    message.playerStory?.season === state.season && message.playerStory.playerGroup === 'academy',
  )
  if (seasonStories.length >= 2 || state.round < 3 || Math.random() >= chance) return
  const players = (state.academyPlayers ?? []).filter((player) =>
    !seasonStories.some((message) => message.playerStory?.playerId === player.id)
    && player.skill < player.potential,
  )
  if (!players.length) return
  const player = players[Math.floor(Math.random() * players.length)]
  const playerName = `${player.firstName} ${player.lastName}`
  const subject = `Plan rozwoju juniora: ${playerName}`
  const body = `${playerName} chce porozmawiać o swoim rozwoju. Sztab proponuje dodatkową pracę indywidualną, mentoring z doświadczonym zawodnikiem albo spokojną realizację obecnego planu.`
  const message = addInboxMessage(state, 'Akademia młodzieżowa', subject, body, 'info', 'club')
  message.playerStory = {
    season: state.season,
    playerId: player.id,
    playerName,
    playerGroup: 'academy',
    kind: 'academy-development',
    choices: [
      {
        id: 'academy-individual-session',
        label: 'Zorganizuj trening indywidualny',
        description: 'Koszt 15 000 zł · szybki postęp i wzrost morale juniora.',
        effects: { playerMorale: 5, academySkill: 2, cash: -15_000 },
        outcome: `${playerName} skorzystał z dodatkowego treningu i poprawił swoje umiejętności.`,
      },
      {
        id: 'academy-mentor-session',
        label: 'Połącz juniora z mentorem',
        description: 'Bez dodatkowych kosztów · spokojniejszy rozwój i lepsza atmosfera.',
        effects: { playerMorale: 4, academySkill: 1 },
        outcome: `${playerName} rozpoczął regularne treningi z mentorem i zrobił postępy.`,
      },
      {
        id: 'academy-steady-plan',
        label: 'Pozostań przy obecnym planie',
        description: 'Bez kosztów · nie zmieniaj obciążeń juniora.',
        effects: { playerMorale: -1 },
        outcome: `${playerName} zaakceptował dotychczasowy plan rozwoju.`,
      },
    ],
  }
  addMediaPost(state, 'KLUB', subject, body)
}

export function simulateCalendarDay(game: GameState, date: string) {
  const previousDate = parseLocalDateKey(game.currentDate ?? `${game.season.split('/')[0]}-07-01`)
  previousDate.setDate(previousDate.getDate() + 1)
  if (getLocalDateKey(previousDate) !== date) {
    return { game, error: 'Nie można zasymulować dnia poza bieżącą kolejnością kalendarza.' }
  }

  const next = structuredClone(game)
  next.currentDate = date
  initializePmpLeagueIfReady(next)
  createSeasonEvent(next, 0.06)
  createPlayerStory(next, 0.04)
  createAcademyStory(next, 0.03)
  return { game: next, error: '' }
}

export function resolveSeasonEvent(game: GameState, messageId: string, choiceId: string) {
  const next = structuredClone(game)
  const message = next.inboxMessages?.find((item) => item.id === messageId)
  const event = message?.seasonEvent
  if (!message || !event) return { game, error: 'Nie znaleziono wydarzenia sezonowego.' }
  if (event.selectedChoiceId) return { game, error: 'To wydarzenie zostało już rozstrzygnięte.' }
  const choice = event.choices.find((item) => item.id === choiceId)
  if (!choice) return { game, error: 'Wybrana reakcja nie jest dostępna.' }
  if (choice.effects.cash < 0 && next.cash + choice.effects.cash < 0) {
    return { game, error: 'Klub nie ma wystarczających środków na tę decyzję.' }
  }

  if (choice.effects.cash !== 0) addFinance(next, `Wydarzenie: ${message.subject}`, choice.effects.cash)
  next.localReputation = Math.max(0, Math.min(100, (next.localReputation ?? 35) + (choice.effects.localReputation ?? 0)))
  next.squad.forEach((player) => {
    player.morale = Math.max(20, Math.min(100, player.morale + choice.effects.morale))
    player.stamina = Math.max(30, Math.min(100, player.stamina + choice.effects.stamina))
  })
  next.boardConfidence = Math.max(0, Math.min(100, Math.round(((next.boardConfidence ?? 65) + choice.effects.confidence) * 10) / 10))
  next.followers = Math.max(1_000, next.followers + choice.effects.followers)
  next.commercialOffers = createCommercialOffers(next.leagueId, overallRating(next.squad), getClubReputation(next), getSeasonRoundCount(next), next.localReputation)
  event.selectedChoiceId = choice.id
  event.resolution = choice.outcome
  addMediaPost(next, 'KLUB', `${message.subject} — decyzja menedżera`, choice.outcome)
  return { game: next, error: '', outcome: choice.outcome }
}

export function resolvePlayerStory(game: GameState, messageId: string, choiceId: string) {
  const next = structuredClone(game)
  const message = next.inboxMessages?.find((item) => item.id === messageId)
  const story = message?.playerStory
  if (!message || !story) return { game, error: 'Nie znaleziono historii zawodnika.' }
  if (story.selectedChoiceId) return { game, error: 'Ta prośba została już rozstrzygnięta.' }
  const choice = story.choices.find((item) => item.id === choiceId)
  if (!choice) return { game, error: 'Wybrana reakcja nie jest dostępna.' }
  const player = story.playerGroup === 'academy'
    ? next.academyPlayers?.find((item) => item.id === story.playerId)
    : next.squad.find((item) => item.id === story.playerId)
  if (!player) return { game, error: 'Zawodnik opuścił kadrę i nie można rozstrzygnąć jego prośby.' }
  if (choice.effects.cash && next.cash + choice.effects.cash < 0) {
    return { game, error: 'Klub nie ma wystarczających środków na tę decyzję.' }
  }
  if (choice.effects.cash) addFinance(next, `Rozwój juniora: ${player.firstName} ${player.lastName}`, choice.effects.cash)
  player.morale = Math.max(20, Math.min(100, player.morale + choice.effects.playerMorale))
  addPlayerHistory(player, {
    season: story.season,
    type: 'club',
    title: 'Rozmowa z menedżerem',
    details: choice.outcome,
  })
  if (choice.effects.requestTransfer) player.transferRequest = true
  const teammate = story.relatedPlayerId
    ? next.squad.find((item) => item.id === story.relatedPlayerId)
    : undefined
  if (teammate && choice.effects.teammateMorale) {
    teammate.morale = Math.max(20, Math.min(100, teammate.morale + choice.effects.teammateMorale))
  }
  if (teammate && choice.effects.chemistry) {
    const key = chemistryKey(player.id, teammate.id)
    next.teamChemistry ??= {}
    next.teamChemistry[key] = Math.max(0, Math.min(100, (next.teamChemistry[key] ?? 50) + choice.effects.chemistry))
  }
  if (choice.effects.academySkill && next.academyPlayers?.length) {
    const junior = story.playerGroup === 'academy'
      ? player
      : [...next.academyPlayers].sort((first, second) => first.age - second.age)[0]
    junior.skill = Math.min(junior.potential, junior.skill + choice.effects.academySkill)
    junior.value = playerValue(junior.skill, junior.potential, junior.age)
    junior.wage = Math.round(junior.skill * junior.skill * 0.25 / 100) * 100
  }
  story.selectedChoiceId = choice.id
  story.resolution = choice.outcome
  addMediaPost(next, 'KLUB', `${story.playerName} — rozmowa z menedżerem`, choice.outcome)
  return { game: next, error: '', outcome: choice.outcome }
}

function addPolishCupDrawAnnouncement(state: GameState) {
  const cup = state.polishCup
  if (!cup || cup.stage === 'complete' || !cup.drawAt) return
  const subject = `Losowanie Polskiego Pucharu · ${cup.drawAt}`
  if (state.inboxMessages?.some((message) => message.subject === subject)) return
  const date = parseLocalDateKey(cup.drawAt)
  const dateLabel = new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date)
  addInboxMessage(
    state,
    'Polski Związek Piłki Nożnej',
    subject,
    `Po zakończeniu ostatniego meczu bieżącej rundy odbędzie się losowanie kolejnej fazy Polskiego Pucharu.\n\nTermin losowania: ${dateLabel}.\nWyniki i terminarz par pojawią się w skrzynce e-mail w dniu losowania.`,
    'info',
    'club',
  )
}

export function publishPolishCupDrawIfDue(game: GameState, currentDate: string) {
  const cup = game.polishCup
  if (!cup || cup.stage === 'complete' || !cup.drawAt || cup.drawAt !== currentDate) return null
  const fixtures = cup.matches.filter((match) => !match.bye).map((match) => ({
    date: match.scheduledAt ?? cup.drawAt as string,
    kickoffTime: match.kickoffTime ?? '20:00',
    homeId: match.homeId,
    awayId: match.awayId,
    poolId: match.poolId,
  }))
  if (!fixtures.length) return null
  const subject = `Wyniki losowania Polskiego Pucharu · ${cup.drawAt}`
  if (game.inboxMessages?.some((message) => message.subject === subject)) return null
  const next = structuredClone(game)
  const stageLabel = getPolishCupStageLabel(cup)
  const userPoolId = Object.entries(cup.regionalPools).find(([, teamIds]) => teamIds.includes(game.teamId))?.[0]
  const groups = [...new Set(fixtures.flatMap((fixture) => fixture.poolId ? [fixture.poolId] : []))]
    .map((poolId) => regionalOptions.find((region) => region.id === poolId)?.name ?? poolId)
  const userParticipates = cup.participants.includes(game.teamId)
    || cup.heldEkstraklasaIds?.includes(game.teamId) === true
    || userPoolId !== undefined
  const userGroup = userPoolId
    ? regionalOptions.find((region) => region.id === userPoolId)?.name ?? userPoolId
    : undefined
  addInboxMessage(
    next,
    'Polski Związek Piłki Nożnej',
    subject,
    `Rozlosowano pary: ${stageLabel}.\n\nPełny terminarz spotkań znajduje się w szczegółach tej wiadomości.`,
    'info',
    'club',
    undefined,
    {
      drawDate: cup.drawAt,
      season: cup.season,
      stage: stageLabel,
      regionalRound: cup.stage === 'regional' ? cup.regionalRound : undefined,
      groups,
      userParticipates,
      userGroup,
      fixtures,
    },
  )
  return next
}

function addPolishCupResultsMessage(state: GameState, cup: PolishCup, matches: PolishCupMatch[]) {
  const fixtures = matches.filter((match) => !match.bye).map((match) => ({
    date: match.scheduledAt ?? state.currentDate ?? `${cup.season.slice(0, 4)}-01-01`,
    kickoffTime: match.kickoffTime ?? '20:00',
    homeId: match.homeId,
    awayId: match.awayId,
    homeGoals: match.homeGoals ?? 0,
    awayGoals: match.awayGoals ?? 0,
    penaltyScore: match.penaltyScore,
    poolId: match.poolId,
  }))
  if (!fixtures.length) return
  const stage = getPolishCupStageLabel(cup)
  const round = matches[0]?.round ?? cup.regionalRound
  const subject = `Wyniki Polskiego Pucharu · ${cup.season} · ${stage} · runda ${round}`
  if (state.inboxMessages?.some((message) => message.subject === subject)) return
  const groups = [...new Set(fixtures.flatMap((fixture) => fixture.poolId ? [fixture.poolId] : []))]
    .map((poolId) => regionalOptions.find((region) => region.id === poolId)?.name ?? poolId)
  addInboxMessage(
    state,
    'Polski Związek Piłki Nożnej',
    subject,
    `Zakończono mecze etapu: ${stage}.\n\nWyniki wszystkich spotkań znajdują się w szczegółach tej wiadomości.`,
    'info',
    'club',
    undefined,
    undefined,
    {
      season: cup.season,
      stage,
      round,
      groups,
      fixtures,
    },
  )
}

function addPolishCupWeekMessage(state: GameState, eventDate: string) {
  const monday = parseLocalDateKey(eventDate)
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  const weekStart = getLocalDateKey(monday)
  const weekEndDate = new Date(monday)
  weekEndDate.setDate(weekEndDate.getDate() + 6)
  const weekEnd = getLocalDateKey(weekEndDate)
  const subject = `Rozpoczyna się tydzień Polskiego Pucharu · ${weekStart}`
  if (state.inboxMessages?.some((message) => message.subject === subject)) return
  const allUpcomingMatches = [
    ...(state.polishCup?.matches ?? []),
    ...(state.regionalCups ?? []).flatMap((cup) => cup.matches),
  ].filter((match) =>
    !match.played
    && !match.bye
    && match.scheduledAt,
  )
  const matchesThisWeek = allUpcomingMatches.filter((match) =>
    (match.scheduledAt as string) >= weekStart
    && (match.scheduledAt as string) <= weekEnd,
  )
  const getRegionalCup = (match: PolishCupMatch) => state.regionalCups?.find((cup) =>
    cup.matches.some((fixture) => fixture.id === match.id),
  )
  const getGroupKey = (match: PolishCupMatch) => {
    const regionalCup = getRegionalCup(match)
    if (regionalCup) return `regional-${regionalCup.regionId}-${match.round}`
    if (match.poolId) return `${match.stage}-${match.poolId}-${match.round}`
    return undefined
  }
  const weeklyGroupKeys = new Set(matchesThisWeek.map(getGroupKey).filter((key): key is string => Boolean(key)))
  const scheduledMatches = allUpcomingMatches.filter((match) => {
    const groupKey = getGroupKey(match)
    return matchesThisWeek.includes(match) || Boolean(groupKey && weeklyGroupKeys.has(groupKey))
  }).sort((first, second) =>
    (first.scheduledAt ?? '').localeCompare(second.scheduledAt ?? '')
    || (first.kickoffTime ?? '').localeCompare(second.kickoffTime ?? ''),
  )
  const teamName = (teamId: string) =>
    state.polishCup?.teams.find((team) => team.id === teamId)?.name
    ?? state.regionalCups?.flatMap((cup) => cup.teams).find((team) => team.id === teamId)?.name
    ?? teamId
  const regionName = (regionId: string) =>
    regionalOptions.find((region) => region.id === regionId)?.name ?? regionId
  const formatter = new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })
  const groupedSchedule = new Map<string, { label: string; matches: PolishCupMatch[] }>()
  scheduledMatches.forEach((match) => {
    const regionalCup = getRegionalCup(match)
    const stageLabel = match.stage === 'third'
      ? 'Runda wstępna'
      : match.stage === 'second'
        ? 'I runda centralna'
        : match.stage === 'first'
          ? '1/16 finału'
          : match.stage === 'ekstraklasa'
            ? 'Runda centralna'
            : match.stage === 'regional'
              ? `Runda regionalna ${match.round}`
              : 'Faza centralna'
    const groupLabel = regionalCup
      ? `Puchar regionalny · ${regionName(regionalCup.regionId)} · runda ${match.round}`
      : match.poolId
        ? `${stageLabel} · ${regionName(match.poolId)}`
        : stageLabel
    const groupKey = regionalCup
      ? `regional-${regionalCup.regionId}-${match.round}`
      : `${match.stage}-${match.poolId ?? 'central'}-${match.round}`
    const group = groupedSchedule.get(groupKey) ?? { label: groupLabel, matches: [] }
    group.matches.push(match)
    groupedSchedule.set(groupKey, group)
  })
  const schedule = groupedSchedule.size
    ? [...groupedSchedule.values()].map(({ label, matches }) => {
      const fixtures = matches.map((match) => {
        const date = parseLocalDateKey(match.scheduledAt as string)
        return `• ${formatter.format(date)} · ${match.kickoffTime ?? 'godz. do ustalenia'} · ${teamName(match.homeId)} – ${teamName(match.awayId)}`
      })
      return `${label}\n${fixtures.join('\n')}`
    }).join('\n\n')
    : 'W tym tygodniu nie zaplanowano spotkań Polskiego Pucharu.'
  addInboxMessage(
    state,
    'Polski Związek Piłki Nożnej',
    subject,
    `Rozpoczyna się tydzień meczów Polskiego Pucharu. Terminarz z podziałem na fazy i regiony:\n\n${schedule}`,
    'info',
    'club',
  )
}

export function notifyPolishCupWeek(game: GameState, eventDate: string) {
  const next = structuredClone(game)
  addPolishCupWeekMessage(next, eventDate)
  return next
}

function playerValue(skill: number, potential: number, age: number) {
  const ageFactor = age < 21 ? 1.35 : age <= 29 ? 1 : age === 30 ? 0.92 : age === 31 ? 0.84 : 0.76
  return Math.round((skill ** 2.35 * 150) * ageFactor * (1 + Math.max(0, potential - skill) * 0.025) / 1000) * 1000
}

const preferredShirtNumbers: Record<Position, number[]> = {
  BR: [1, 13, 22, 12, 25, 30, 31, 33, 40],
  PO: [2, 12, 15, 21, 24, 26, 32, 34, 36],
  ŚO: [4, 5, 6, 15, 18, 21, 25, 26, 28],
  LO: [3, 12, 15, 21, 24, 26, 32, 34, 36],
  DP: [4, 6, 8, 14, 16, 18, 20, 23, 28],
  ŚP: [6, 8, 10, 14, 16, 17, 20, 23, 28],
  OP: [10, 8, 7, 11, 14, 19, 20, 23, 28],
  PP: [7, 11, 17, 19, 20, 21, 23, 27, 30],
  LP: [7, 11, 17, 19, 20, 21, 23, 27, 30],
  PN: [9, 10, 11, 7, 18, 19, 20, 23, 30],
  LN: [9, 10, 11, 7, 18, 19, 20, 23, 30],
  ŚN: [9, 10, 11, 7, 18, 19, 20, 23, 30],
}

function assignMissingSquadNumbers(squad: Player[]) {
  const assigned = new Set<number>()
  for (const player of squad) {
    const shirtNumber = player.shirtNumber
    if (shirtNumber !== undefined && Number.isInteger(shirtNumber) && shirtNumber >= 1 && shirtNumber <= 99 && !assigned.has(shirtNumber)) {
      assigned.add(shirtNumber)
    } else {
      delete player.shirtNumber
    }
  }
  for (const player of squad) {
    if (player.shirtNumber !== undefined) continue
    const shirtNumber = [
      ...preferredShirtNumbers[player.position],
      ...Array.from({ length: 99 }, (_, index) => index + 1),
    ].find((number) => !assigned.has(number))
    if (shirtNumber === undefined) throw new Error('Nie można przypisać wolnego numeru zawodnika.')
    player.shirtNumber = shirtNumber
    assigned.add(shirtNumber)
  }
  return squad
}

function assignNextSquadNumber(player: Player, squad: Player[]) {
  const assigned = new Set(squad.map((teammate) => teammate.shirtNumber).filter((number): number is number =>
    number !== undefined && Number.isInteger(number) && number >= 1 && number <= 99,
  ))
  const availableNumber = [
    ...preferredShirtNumbers[player.position],
    ...Array.from({ length: 99 }, (_, index) => index + 1),
  ].find((number) => !assigned.has(number))
  if (availableNumber === undefined) throw new Error('Nie można przypisać wolnego numeru zawodnika.')
  player.shirtNumber = availableNumber
}

function makePlayer(
  index: number,
  skill: number,
  age: number,
  position = positions[index % positions.length],
  random = Math.random,
): Player {
  const firstName = firstNames[Math.floor(random() * firstNames.length)]
  const lastName = lastNames[Math.floor(random() * lastNames.length)]
  const potential = Math.min(92, skill + Math.floor(random() * 20))
  return {
    id: `p-${createId()}`,
    firstName,
    lastName,
    age,
    position,
    skill,
    potential,
    value: playerValue(skill, potential, age),
    wage: Math.round(skill * skill * 0.7 / 100) * 100,
    contractSeasonsRemaining: 2 + Math.floor(random() * 3),
    relegationReleaseClause: random() < 0.2,
    morale: 65 + Math.floor(random() * 31),
    personality: playerPersonalities[stableHash(`personality:${firstName}:${lastName}:${age}:${index}`) % playerPersonalities.length],
    stamina: 75 + Math.floor(random() * 26),
    discipline: {},
    seasonAppearances: 0,
    seasonGoals: 0,
    seasonAssists: 0,
    seasonCleanSheets: 0,
    seasonRatingTotal: 0,
    seasonRatedAppearances: 0,
    cupAppearances: 0,
    cupGoals: 0,
    careerAppearances: 0,
    careerGoals: 0,
    careerLeagueAndCupGoals: 0,
  }
}

function createSeededRandom(seedText: string) {
  let seed = 2166136261
  for (const character of seedText) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619)
  return () => {
    seed += 0x6D2B79F5
    let value = seed
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function makeStableClubPlayer(team: Team, index: number, season: string) {
  const random = createSeededRandom(`${team.id}:${season}:${index}`)
  const skill = Math.max(35, Math.min(90, team.strength - 8 + Math.floor(random() * 17)))
  const position = positions[index % positions.length]
  const player = makePlayer(1000 + index, skill, 18 + Math.floor(random() * 17), position, random)
  player.id = `ai-${team.id}-${season.replace('/', '-')}-${index}`
  addPlayerHistory(player, {
    season,
    type: 'club',
    title: team.name,
    details: 'Rozpoczyna sezon w klubie.',
  })
  return player
}

function createClubSquads(
  teams: Team[],
  teamId: string,
  previousSquads: Record<string, ClubPlayerOffer[]> = {},
  season = '2026/2027',
): Record<string, ClubPlayerOffer[]> {
  return Object.fromEntries(teams.filter((team) => team.id !== teamId).map((team) => {
    const existingOffers = previousSquads[team.id]
    const players = existingOffers
      ? existingOffers.flatMap(({ player }) => {
        const nextPlayer = { ...player }
        nextPlayer.age += 1
        nextPlayer.contractSeasonsRemaining = (nextPlayer.contractSeasonsRemaining ?? 2) - 1
        if (nextPlayer.contractSeasonsRemaining <= 0 || nextPlayer.age >= 38) return []
        const previousSkill = nextPlayer.skill
        if (nextPlayer.age <= 23 && nextPlayer.skill < nextPlayer.potential) nextPlayer.skill += 1
        else if (nextPlayer.age >= 33) nextPlayer.skill -= 1
        nextPlayer.skill = Math.max(1, Math.min(nextPlayer.potential, nextPlayer.skill))
        nextPlayer.value = playerValue(nextPlayer.skill, nextPlayer.potential, nextPlayer.age)
        if (nextPlayer.skill !== previousSkill) {
          addPlayerHistory(nextPlayer, {
            season,
            type: 'overall',
            title: 'Zmiana umiejętności',
            details: `Umiejętność ${previousSkill} → ${nextPlayer.skill}.`,
          })
        }
        return [{ player: nextPlayer, askingPrice: 0 }]
      })
      : []
    while (players.length < positions.length) {
      const positionCounts = new Map<Position, number>()
      for (const position of positions) {
        positionCounts.set(position, (positionCounts.get(position) ?? 0) + 1)
      }
      for (const { player } of players) {
        positionCounts.set(player.position, (positionCounts.get(player.position) ?? 0) - 1)
      }
      const position = [...positionCounts.entries()].find(([, count]) => count > 0)?.[0]
        ?? positions[players.length % positions.length]
      const player = makeStableClubPlayer(team, players.length, season)
      player.position = position
      players.push({ player, askingPrice: 0 })
    }
    const offers = players.map(({ player }) => {
      const random = createSeededRandom(`${team.id}:${season}:${player.id}:asking-price`)
      return {
        player,
        askingPrice: Math.round(player.value * (1.08 + random() * 0.25) / 1000) * 1000,
      }
    })
    assignMissingSquadNumbers(offers.map(({ player }) => player))
    if (existingOffers) team.strength = Math.round(overallRating(offers.map(({ player }) => player)))
    return [team.id, offers]
  }))
}

function ensureClubSquadsForCupTeams(game: GameState, teamIds: string[], cupTeams: PolishCupTeam[]) {
  const missingTeams = [...new Set(teamIds)]
    .filter((teamId) => teamId && teamId !== game.teamId && !game.clubSquads[teamId])
    .map((teamId) => {
      const cupTeam = cupTeams.find((team) => team.id === teamId)
      if (!cupTeam) throw new Error(`Nie znaleziono danych klubu ${teamId} do utworzenia kadry.`)
      return {
        id: cupTeam.id,
        name: cupTeam.name,
        strength: cupTeam.strength,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0,
      }
    })
  if (missingTeams.length) {
    game.clubSquads = {
      ...game.clubSquads,
      ...createClubSquads(missingTeams, game.teamId, {}, game.season),
    }
    ensureUniqueGamePlayerNames(game)
  }
}

function syncTeamStrength(game: GameState, teamId: string, squad: Player[]) {
  const strength = Math.round(overallRating(squad))
  for (const team of game.teams) {
    if (team.id === teamId) team.strength = strength
  }
  for (const teams of Object.values(game.leagueWorld ?? {})) {
    for (const team of teams) {
      if (team.id === teamId) team.strength = strength
    }
  }
  game.polishCup?.teams.forEach((team) => {
    if (team.id === teamId) team.strength = strength
  })
  game.regionalCups?.forEach((cup) => cup.teams.forEach((team) => {
    if (team.id === teamId) team.strength = strength
  }))
}

function getPositionNeedWeight(position: Position) {
  return {
    BR: 2,
    PO: 3,
    ŚO: 4,
    LO: 3,
    DP: 3,
    ŚP: 4,
    OP: 5,
    PP: 4,
    LP: 3,
    PN: 5,
    LN: 4,
    ŚN: 5,
  }[position] ?? 2
}

function getTransferBudget(team: Team) {
  return Math.max(500_000, Math.min(12_000_000, Math.round(team.strength * 120_000 + team.points * 16_000 + team.played * 18_000)))
}

function getAiTransferNeedScore(buyer: Team, candidate: Player, buyerOffers: ClubPlayerOffer[]) {
  const positionNeed = getPositionNeedWeight(candidate.position)
  const positionCoverage = buyerOffers.filter(({ player }) =>
    player.position === candidate.position || (player.secondaryPositions ?? []).includes(candidate.position),
  ).length
  const shortfall = Math.max(0, 1 + Math.ceil(positionNeed / 4) - positionCoverage)
  const valueFit = Math.max(0, 1 - candidate.value / Math.max(1, getTransferBudget(buyer)))
  const ambitionBoost = buyer.strength >= 70 ? 3 : buyer.strength >= 60 ? 6 : 2
  const formPressure = buyer.points <= 6 && buyer.played >= 6 ? 4 : 0
  const ageBoost = candidate.age <= 23 ? 3 : candidate.age >= 29 ? -2 : 0
  const ambitionNeed = buyer.strength < 72 ? 5 : 1
  return positionNeed * 12 + shortfall * 10 + valueFit * 20 + ambitionBoost + formPressure + ageBoost + ambitionNeed
}

function updateIncomingTransferMessage(game: GameState, offer: IncomingTransferOffer, status: InboxMessage['status'], body: string) {
  const message = game.inboxMessages?.find((item) => item.relatedTransferOfferId === offer.id)
  if (!message) return
  message.status = status
  message.body = body
}

export function createAiIncomingTransferOffer(
  game: GameState,
  completedRound: number,
  window: { name: string; openRound: number; closeRound: number },
) {
  const incomingTransferOffers = game.incomingTransferOffers ??= []
  const windowId = `${game.season}-${window.name}`
  for (const offer of incomingTransferOffers) {
    if (
      (offer.status === 'pending' || offer.status === 'countered' || offer.status === 'player-negotiation')
      && (offer.windowId !== windowId || completedRound >= window.closeRound)
    ) {
      offer.status = 'rejected'
      updateIncomingTransferMessage(game, offer, 'rejected', 'Oferta wygasła wraz z zamknięciem okna transferowego.')
    }
  }
  if (completedRound >= window.closeRound) return
  const activeStatuses = ['pending', 'countered', 'player-negotiation']
  const activeOffers = incomingTransferOffers.filter((offer) =>
    offer.windowId === windowId && activeStatuses.includes(offer.status),
  )
  const windowOffers = incomingTransferOffers.filter((offer) => offer.windowId === windowId)
  if (windowOffers.length >= 4 || Math.random() > 0.3) return
  const competingPlayerOffer = activeOffers.find((offer) =>
    incomingTransferOffers.filter((other) =>
      other.playerId === offer.playerId && other.windowId === windowId && activeStatuses.includes(other.status),
    ).length < 3,
  )
  const candidates = game.squad
    .filter((player) =>
      game.squad.length > 11
      && !player.moralePromise
      && !game.loanDeals?.some((deal) => deal.player.id === player.id)
      && !game.inboxMessages?.some((message) =>
        message.playerStory?.playerId === player.id && !message.playerStory.selectedChoiceId,
      )
      && (player.transferRequest || player.morale <= 58 || player.skill >= (game.teams.find((team) => team.id === game.teamId)?.strength ?? 0) + 8)
      && player.age <= 31,
    )
    .sort((first, second) =>
      Number(second.id === competingPlayerOffer?.playerId) - Number(first.id === competingPlayerOffer?.playerId)
      || Number(second.transferRequest) - Number(first.transferRequest)
      || second.skill - first.skill
      || first.age - second.age,
    )
  if (!candidates.length) return

  const player = competingPlayerOffer
    ? candidates.find((candidate) => candidate.id === competingPlayerOffer.playerId)
    : candidates[Math.floor(Math.random() * Math.min(candidates.length, 4))]
  if (!player) return
  const activeOffersForPlayer = incomingTransferOffers.filter((offer) =>
    offer.playerId === player.id && offer.windowId === windowId && activeStatuses.includes(offer.status),
  )
  if (activeOffersForPlayer.length >= 3) return
  const buyers = game.teams
    .filter((team) =>
      team.id !== game.teamId
      && (game.clubSquads[team.id]?.length ?? 0) > 0
      && !activeOffersForPlayer.some((offer) => offer.clubId === team.id),
    )
    .map((team) => {
      const offers = game.clubSquads[team.id] ?? []
      const coverage = offers.filter(({ player: squadPlayer }) =>
        player.position === squadPlayer.position || squadPlayer.secondaryPositions?.includes(player.position),
      ).length
      return { team, score: getAiTransferNeedScore(team, player, offers) - coverage * 8 }
    })
    .sort((first, second) => second.score - first.score)
  if (!buyers.length) return

  const buyer = buyers.find(({ team }) => getTransferBudget(team) >= Math.max(50_000, Math.round(player.value * 0.5)))?.team
  if (!buyer) return
  const offeredAmount = Math.min(
    getTransferBudget(buyer),
    Math.max(
      50_000,
      Math.round(player.value * (player.transferRequest ? 1.02 : 0.88) * (1 + activeOffersForPlayer.length * 0.08) / 1000) * 1000,
    ),
  )
  const userTeam = game.teams.find((team) => team.id === game.teamId)
  const strengthDifference = buyer.strength - (userTeam?.strength ?? buyer.strength)
  const wageMultiplier = Math.max(0.95, Math.min(
    1.6,
    1.1
      + (70 - player.morale) * 0.004
      + strengthDifference * 0.002
      + (player.personality === 'ambitious' ? 0.08 : 0)
      + (player.transferRequest ? -0.05 : 0),
  ))
  const estimatedPlayerWage = Math.ceil(player.wage * wageMultiplier / 100) * 100
  const estimatedPlayerContractSeasons = player.age <= 22 && player.personality === 'ambitious'
    ? 4
    : player.age >= 30 ? 2 : 3
  const offer: IncomingTransferOffer = {
    id: createId(),
    clubId: buyer.id,
    playerId: player.id,
    offeredAmount,
    estimatedPlayerWage,
    estimatedPlayerContractSeasons,
    expiresAfterRound: Math.min(completedRound + 2, window.closeRound),
    status: 'pending',
    windowId,
    createdRound: completedRound,
  }
  incomingTransferOffers.push(offer)
  const message = addInboxMessage(
    game,
    buyer.name,
    `Oferta za ${player.firstName} ${player.lastName}`,
    `${buyer.name} składa ofertę w wysokości ${offeredAmount.toLocaleString('pl-PL')} zł za ${player.firstName} ${player.lastName}. Możesz ją przyjąć, odrzucić, złożyć kontrofertę albo obiecać zawodnikowi pozostanie w klubie.`,
    'offered',
    'transfer',
  )
  message.relatedTransferOfferId = offer.id
}

export function resolveIncomingTransferOfferDeadlines(game: GameState, completedRound: number) {
  const activeStatuses = ['pending', 'countered', 'player-negotiation']
  const expiredOffers = (game.incomingTransferOffers ?? []).filter((offer) => {
    if (!activeStatuses.includes(offer.status)) return false
    offer.expiresAfterRound ??= Math.min(offer.createdRound + 2, getTransferWindowInfo(game).currentWindow?.closeRound ?? offer.createdRound + 2)
    if (offer.expiresAfterRound > completedRound) return false
    offer.status = 'rejected'
    updateIncomingTransferMessage(
      game,
      offer,
      'rejected',
      'Oferta wygasła z powodu braku decyzji przed terminem. Zawodnik jest rozczarowany, że rozmowy nie zostały rozstrzygnięte.',
    )
    return true
  })
  for (const listing of game.outgoingPlayerTransferListings ?? []) {
    if (listing.status !== 'active') continue
    const listingOffers = (game.incomingTransferOffers ?? []).filter((offer) => offer.outgoingListingId === listing.id)
    if (listingOffers.length && listingOffers.every((offer) => !activeStatuses.includes(offer.status))) {
      listing.status = 'cancelled'
    }
  }
  if (!expiredOffers.length) return

  const affectedPlayerIds = new Set(expiredOffers.map((offer) => offer.playerId))
  for (const playerId of affectedPlayerIds) {
    const player = game.squad.find((item) => item.id === playerId)
    if (!player) continue
    player.morale = Math.max(20, player.morale - 4)
    if (player.morale <= 25) player.transferRequest = true
    addMediaPost(
      game,
      'TRANSFER',
      `Zawodnik rozczarowany niedokończonymi rozmowami`,
      `${player.firstName} ${player.lastName} stracił cierpliwość, gdy klub nie odpowiedział na czas na ofertę transferową. Morale spadło do ${player.morale}.${player.transferRequest ? ' Zawodnik ponawia prośbę o transfer.' : ''}`,
    )
  }
}

function resolveAiTransferWindow(game: GameState, completedRound: number) {
  resolveIncomingTransferOfferDeadlines(game, completedRound)
  const transferWindow = getTransferWindowInfo({ teams: game.teams, round: completedRound })
  if (!transferWindow.currentWindow) return

  createAiIncomingTransferOffer(game, completedRound, transferWindow.currentWindow)
  if (transferWindow.currentWindow.closeRound !== completedRound) return

  const clubs = game.teams.filter((team) => team.id !== game.teamId && game.clubSquads[team.id]?.length)
  if (clubs.length < 2) return

  const transferCandidates = clubs.flatMap((club) =>
    (game.clubSquads[club.id] ?? [])
      .filter(({ player }) =>
        !game.loanDeals?.some((deal) => deal.player.id === player.id)
        &&
        player.age <= 30
        && (player.contractSeasonsRemaining ?? 2) > 1
        && player.skill >= club.strength - 5
        && player.value <= getTransferBudget(club) * 0.65,
      )
      .map((offer) => ({ club, offer })),
  )
  if (!transferCandidates.length) return

  let bestDeal: { club: Team; offer: ClubPlayerOffer; buyer: Team; buyerOffers: ClubPlayerOffer[]; buyerReplacementIndex: number; outgoing: ClubPlayerOffer } | null = null
  let bestScore = Number.NEGATIVE_INFINITY

  for (const candidate of transferCandidates) {
    const sellerOffers = game.clubSquads[candidate.club.id] ?? []
    if (!sellerOffers.length) continue

    const buyerPool = clubs.filter((club) => club.id !== candidate.club.id)
      .map((buyer) => {
        const budget = getTransferBudget(buyer)
        const value = candidate.offer.player.value
        const buyerOffers = game.clubSquads[buyer.id] ?? []
        const replacement = buyerOffers
          .map(({ player }, index) => ({ player, index }))
          .filter(({ player }) => player.position === candidate.offer.player.position || (player.secondaryPositions ?? []).includes(candidate.offer.player.position))
          .sort((first, second) => first.player.skill - second.player.skill)[0]
        if (!replacement || value > budget * 0.72) return null
        const score = getAiTransferNeedScore(buyer, candidate.offer.player, buyerOffers)
          + (candidate.offer.player.skill - replacement.player.skill) * 2.25
          + Math.max(0, buyer.strength - candidate.club.strength) * 1.5
          - (candidate.club.points - buyer.points) * 0.35
        return { buyer, buyerOffers, replacement, score }
      })
      .filter((entry): entry is { buyer: Team; buyerOffers: ClubPlayerOffer[]; replacement: { player: Player; index: number }; score: number } => Boolean(entry))
      .sort((first, second) => second.score - first.score)

    if (!buyerPool.length) continue
    const bestBuyer = buyerPool[0]
    const sellerIndex = sellerOffers.findIndex(({ player }) => player.id === candidate.offer.player.id)
    if (sellerIndex < 0) continue

    const dealScore = bestBuyer.score + candidate.offer.player.skill * 1.7 - candidate.club.strength * 0.35
    if (dealScore > bestScore) {
      bestScore = dealScore
      bestDeal = {
        club: candidate.club,
        offer: candidate.offer,
        buyer: bestBuyer.buyer,
        buyerOffers: bestBuyer.buyerOffers,
        buyerReplacementIndex: bestBuyer.replacement.index,
        outgoing: bestBuyer.buyerOffers[bestBuyer.replacement.index],
      }
    }
  }

  if (!bestDeal) return

  const sellerOffers = game.clubSquads[bestDeal.club.id]
  const buyerOffers = game.clubSquads[bestDeal.buyer.id]
  const sellerIndex = sellerOffers.findIndex(({ player }) => player.id === bestDeal.offer.player.id)
  if (sellerIndex < 0) return

  const outgoing = buyerOffers[bestDeal.buyerReplacementIndex]
  if (!outgoing) return

  const newSellerPlayer = { ...outgoing.player, contractSeasonsRemaining: Math.max(1, (outgoing.player.contractSeasonsRemaining ?? 2) - 1) }
  const newBuyerPlayer = {
    ...bestDeal.offer.player,
    contractSeasonsRemaining: Math.max(1, (bestDeal.offer.player.contractSeasonsRemaining ?? 2) - 1),
    morale: Math.max(55, Math.min(92, bestDeal.offer.player.morale + 2)),
  }
  addPlayerHistory(newSellerPlayer, {
    season: game.season,
    type: 'club',
    title: bestDeal.club.name,
    details: `Przeszedł z ${bestDeal.buyer.name}.`,
  })
  addPlayerHistory(newBuyerPlayer, {
    season: game.season,
    type: 'club',
    title: bestDeal.buyer.name,
    details: `Przeszedł z ${bestDeal.club.name}.`,
  })

  sellerOffers[sellerIndex] = { player: newSellerPlayer, askingPrice: Math.round(newSellerPlayer.value * 1.09 / 1000) * 1000 }
  buyerOffers[bestDeal.buyerReplacementIndex] = { player: newBuyerPlayer, askingPrice: Math.round(newBuyerPlayer.value * 1.09 / 1000) * 1000 }
  assignMissingSquadNumbers(sellerOffers.map(({ player }) => player))
  assignMissingSquadNumbers(buyerOffers.map(({ player }) => player))

  syncTeamStrength(game, bestDeal.club.id, sellerOffers.map(({ player }) => player))
  syncTeamStrength(game, bestDeal.buyer.id, buyerOffers.map(({ player }) => player))
  addMediaPost(
    game,
    'TRANSFER',
    'Klub zrealizował wymianę zawodników',
    `${newBuyerPlayer.firstName} ${newBuyerPlayer.lastName} przechodzi z ${bestDeal.club.name} do ${bestDeal.buyer.name}, a w odwrotnym kierunku trafia ${newSellerPlayer.firstName} ${newSellerPlayer.lastName}.`,
  )
}

function migratePlayerPosition(player: Player) {
  const legacyPositions: Record<string, Position> = { PS: 'PN', LS: 'LN', N: 'ŚN' }
  player.position = legacyPositions[player.position] ?? player.position
  player.personality ??= playerPersonalities[stableHash(player.id) % playerPersonalities.length]
  player.discipline ??= {}
  player.secondaryPositions = (player.secondaryPositions ?? []).map((position) => legacyPositions[position] ?? position)
  if (!player.positionTraining || typeof player.positionTraining !== 'object') player.positionTraining = null
  else player.positionTraining.targetPosition = legacyPositions[player.positionTraining.targetPosition] ?? player.positionTraining.targetPosition
}

function createFixtures(teams: Team[]): Match[] {
  const rotation = teams.map((team) => team.id)
  if (rotation.length % 2 !== 0) rotation.push('bye')
  const half = rotation.length - 1
  const firstLeg: Match[] = []
  for (let round = 0; round < half; round += 1) {
    for (let index = 0; index < rotation.length / 2; index += 1) {
      const left = rotation[index]
      const right = rotation[rotation.length - 1 - index]
      if (left === 'bye' || right === 'bye') {
        const teamId = left === 'bye' ? right : left
        firstLeg.push({
          id: `m-${round + 1}-bye`,
          round: round + 1,
          homeId: teamId,
          awayId: 'league-bye',
          played: false,
          bye: true,
          competitionId: 'league',
        })
        continue
      }

      const homeId = (round + index) % 2 === 0 ? left : right
      const awayId = homeId === left ? right : left
      firstLeg.push({ id: `m-${round + 1}-${index}`, round: round + 1, homeId, awayId, played: false, competitionId: 'league' })
    }
    rotation.splice(1, 0, rotation.pop() as string)
  }
  const matchesPerOpponent = getLeagueMatchupsPerOpponent(teams.length)
  const cycles = matchesPerOpponent / 2
  return Array.from({ length: cycles }, (_, cycle) => {
    const roundOffset = cycle * half * 2
    const cycleId = cycle === 0 ? '' : `-cycle-${cycle + 1}`
    return [
      ...firstLeg.map((match) => ({
        ...match,
        id: `${match.id}${cycleId}`,
        round: match.round + roundOffset,
      })),
      ...firstLeg.map((match) => ({
        ...match,
        id: `${match.id}-return${cycleId}`,
        round: match.round + half + roundOffset,
        homeId: match.bye ? match.homeId : match.awayId,
        awayId: match.bye ? match.awayId : match.homeId,
      })),
    ]
  }).flat()
}


function emptyTeam(id: string, name: string, strength: number): Team {
  return {
    id,
    name,
    strength,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
    yellowCards: 0,
    redCards: 0,
    fairPlayPoints: 0,
  }
}

function resetTeam(team: Team, strength = team.strength): Team {
  return {
    ...team,
    strength,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
    headToHead: {},
    yellowCards: 0,
    redCards: 0,
    fairPlayPoints: 0,
  }
}

function getLeagueIds() {
  return Object.keys(clubsByLeague).filter((id) => id !== 'third' && id !== 'fourth') as LeagueId[]
}

function createLeagueWorld(leagueId: LeagueId, currentTeams: Team[]) {
  const world: Record<string, Team[]> = {}
  for (const id of getLeagueIds()) {
    if (id === leagueId) {
      world[id] = currentTeams.map((team) => ({
        ...team,
        regionId: team.regionId ?? resolveClubRegion(team.name, id),
      }))
      continue
    }
    const clubs = clubsByLeague[id]
    world[id] = clubs.map((name, index) => ({
      ...emptyTeam(`world-${id}-${index}`, name, getLeagueBaseStrength(id) - 4 + Math.floor(Math.random() * 9)),
      regionId: resolveClubRegion(name, id),
    }))
  }
  if (!world[leagueId]) {
    world[leagueId] = currentTeams.map((team) => ({
      ...team,
      regionId: team.regionId ?? resolveClubRegion(team.name, leagueId),
    }))
  }
  return world
}

function applyResult(home: Team, away: Team, homeGoals: number, awayGoals: number) {
  home.played += 1
  away.played += 1
  home.goalsFor += homeGoals
  home.goalsAgainst += awayGoals
  away.goalsFor += awayGoals
  away.goalsAgainst += homeGoals
  if (homeGoals > awayGoals) {
    home.wins += 1
    home.points += 3
    away.losses += 1
  } else if (homeGoals < awayGoals) {
    away.wins += 1
    away.points += 3
    home.losses += 1
  } else {
    home.draws += 1
    away.draws += 1
    home.points += 1
    away.points += 1
  }
  recordHeadToHead(home, away, homeGoals, awayGoals)
  recordSimulatedFairPlay(home)
  recordSimulatedFairPlay(away)
}

function recordSimulatedFairPlay(team: Team) {
  const yellowCards = Math.floor(Math.random() * 6)
  const redCards = Math.random() < 0.12 ? 1 : 0
  team.yellowCards = (team.yellowCards ?? 0) + yellowCards
  team.redCards = (team.redCards ?? 0) + redCards
  team.fairPlayPoints = (team.fairPlayPoints ?? 0) + yellowCards + redCards * 4
}

function recordTeamDiscipline(team: Team, events: MatchCardEvent[]) {
  for (const event of events) {
    if (event.teamId && event.teamId !== team.id) continue
    if (event.card === 'yellow') {
      team.yellowCards = (team.yellowCards ?? 0) + 1
      team.fairPlayPoints = (team.fairPlayPoints ?? 0) + (event.secondYellow ? 2 : 1)
      if (event.secondYellow) team.redCards = (team.redCards ?? 0) + 1
    } else {
      team.redCards = (team.redCards ?? 0) + 1
      team.fairPlayPoints = (team.fairPlayPoints ?? 0) + 4
    }
  }
}

function recordHeadToHead(home: Team, away: Team, homeGoals: number, awayGoals: number) {
  const homePoints = homeGoals > awayGoals ? 3 : homeGoals === awayGoals ? 1 : 0
  const awayPoints = awayGoals > homeGoals ? 3 : awayGoals === homeGoals ? 1 : 0
  const homeRecord = home.headToHead ??= {}
  const awayRecord = away.headToHead ??= {}
  const homeStats = homeRecord[away.id] ??= [0, 0, 0]
  const awayStats = awayRecord[home.id] ??= [0, 0, 0]
  homeStats[0] += homePoints
  homeStats[1] += homeGoals
  homeStats[2] += awayGoals
  awayStats[0] += awayPoints
  awayStats[1] += awayGoals
  awayStats[2] += homeGoals
}

function simulateLeagueWorldRound(
  world: Record<string, Team[]>,
  currentLeagueId: LeagueId,
  round: number,
  onlyLeagueId?: string,
) {
  for (const [leagueId, teams] of Object.entries(world)) {
    if (onlyLeagueId && leagueId !== onlyLeagueId) continue
    if (leagueId === currentLeagueId || round > getSeasonRoundCount({ teams })) continue
    const matches = createFixtures(teams).filter((match) => match.round === round && !match.bye)
    for (const match of matches) {
      const home = teams.find((team) => team.id === match.homeId)
      const away = teams.find((team) => team.id === match.awayId)
      if (!home || !away) throw new Error(`Brak drużyny w terminarzu ligi ${leagueId}.`)
      const homeForm = getTeamFormModifier(home)
      const awayForm = getTeamFormModifier(away)
      applyResult(
        home,
        away,
        rollGoals(home.strength + 4 + homeForm * 0.7, away.strength + awayForm * 0.55),
        rollGoals(away.strength + 2 + awayForm * 0.6, home.strength + homeForm * 0.45),
      )
    }
  }
}

function shuffled<T>(items: T[]) {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }
  return result
}

function drawPolishCupMatches(
  teamIds: string[],
  stage: Exclude<PolishCupStage, 'complete'>,
  round: number,
  poolId?: string,
  targetCount?: number,
  cupTeams: PolishCupTeam[] = [],
  scheduleStage?: PolishCupScheduleStage,
  season = '2026/2027',
  scheduleRoundOffset = 0,
  protectedTeamId?: string,
): PolishCupMatch[] {
  if (scheduleStage === 'central-final' && teamIds.length !== 2) {
    throw new Error(`Finał Polskiego Pucharu wymaga dokładnie dwóch drużyn, otrzymano ${teamIds.length}.`)
  }
  const draw = shuffled(teamIds)
  const bracketTarget = targetCount ?? (draw.length > 1
    ? 2 ** Math.floor(Math.log2(draw.length))
    : draw.length)
  const matchCount = targetCount === undefined
    ? draw.length === bracketTarget ? Math.floor(draw.length / 2) : draw.length - bracketTarget
    : Math.min(Math.floor(draw.length / 2), Math.max(0, draw.length - targetCount))
  const paired = draw.splice(0, matchCount * 2)
  const matches: PolishCupMatch[] = []
  const regionalScheduleOffset = stage === 'regional' && poolId
    ? Math.max(0, regionalOptions.findIndex((region) => region.id === poolId))
    : 0
  for (let index = 0; index < paired.length; index += 2) {
    const firstId = paired[index]
    const secondId = paired[index + 1]
    const firstClub = cupTeams.find((team) => team.id === firstId)
    const secondClub = cupTeams.find((team) => team.id === secondId)
    const firstTier = firstClub ? getLeagueTier(firstClub.leagueId) : 0
    const secondTier = secondClub ? getLeagueTier(secondClub.leagueId) : 0
    const firstReserve = firstClub?.isReserveTeam ?? /(?:\bII\b|U-?21|rezerwy)/i.test(firstClub?.name ?? '')
    const secondReserve = secondClub?.isReserveTeam ?? /(?:\bII\b|U-?21|rezerwy)/i.test(secondClub?.name ?? '')
    const firstDrawnHome = Math.random() < 0.5
    const homeId = firstTier > secondTier
      ? firstId
      : secondTier > firstTier
        ? secondId
        : firstReserve !== secondReserve
          ? firstReserve ? firstId : secondId
          : firstDrawnHome ? firstId : secondId
    const schedule = scheduleStage
      ? getPolishCupMatchSchedule(season, scheduleStage, index / 2 + regionalScheduleOffset + scheduleRoundOffset * 3)
      : undefined
    matches.push({
      id: `polish-cup-${stage}-${round}-${createId()}`,
      stage,
      round,
      scheduledAt: schedule ? getLocalDateKey(schedule.date) : undefined,
      kickoffTime: schedule?.kickoffTime,
      homeId,
      awayId: homeId === firstId ? secondId : firstId,
      played: false,
      competitionId: 'polish-cup',
      poolId,
    })
  }
  for (const teamId of draw) {
    const schedule = scheduleStage
      ? getPolishCupMatchSchedule(season, scheduleStage, matches.length + regionalScheduleOffset + scheduleRoundOffset * 3)
      : undefined
    matches.push({
      id: `polish-cup-${stage}-${round}-bye-${createId()}`,
      stage,
      round,
      scheduledAt: schedule ? getLocalDateKey(schedule.date) : undefined,
      kickoffTime: schedule?.kickoffTime,
      homeId: teamId,
      awayId: '',
      played: true,
      bye: true,
      winnerId: teamId,
      homeGoals: 0,
      awayGoals: 0,
      competitionId: 'polish-cup',
      poolId,
    })
  }
  const byeMatches = matches.filter((match) => match.bye)
  const regularMatches = matches.filter((match) =>
    !match.bye && match.homeId !== protectedTeamId && match.awayId !== protectedTeamId,
  )
  const byePairCount = Math.min(Math.floor(byeMatches.length / 2), regularMatches.length)
  if (!byePairCount) return matches

  const replacedMatches = regularMatches.slice(0, byePairCount)
  const replacedMatchIds = new Set(replacedMatches.map((match) => match.id))
  const pairedByeIds = new Set(byeMatches.slice(0, byePairCount * 2).map((match) => match.id))
  const replacementMatches: PolishCupMatch[] = []
  const replacementByes: PolishCupMatch[] = []
  for (let index = 0; index < byePairCount; index += 1) {
    const sourceMatch = replacedMatches[index]
    const firstBye = byeMatches[index * 2]
    const secondBye = byeMatches[index * 2 + 1]
    const firstTeam = cupTeams.find((team) => team.id === firstBye.homeId)
    const secondTeam = cupTeams.find((team) => team.id === secondBye.homeId)
    if (!firstTeam || !secondTeam) continue
    const firstTier = getLeagueTier(firstTeam.leagueId)
    const secondTier = getLeagueTier(secondTeam.leagueId)
    const firstReserve = firstTeam.isReserveTeam ?? /(?:\bII\b|U-?21|rezerwy)/i.test(firstTeam.name)
    const secondReserve = secondTeam.isReserveTeam ?? /(?:\bII\b|U-?21|rezerwy)/i.test(secondTeam.name)
    const firstDrawnHome = Math.random() < 0.5
    const homeId = firstTier > secondTier
      ? firstTeam.id
      : secondTier > firstTier
        ? secondTeam.id
        : firstReserve !== secondReserve
          ? firstReserve ? secondTeam.id : firstTeam.id
          : firstDrawnHome ? firstTeam.id : secondTeam.id
    replacementMatches.push({
      ...sourceMatch,
      id: `polish-cup-${stage}-${round}-${createId()}`,
      homeId,
      awayId: homeId === firstTeam.id ? secondTeam.id : firstTeam.id,
    })
    for (const teamId of [sourceMatch.homeId, sourceMatch.awayId]) {
      replacementByes.push({
        ...sourceMatch,
        id: `polish-cup-${stage}-${round}-bye-${createId()}`,
        homeId: teamId,
        awayId: '',
        played: true,
        bye: true,
        winnerId: teamId,
        homeGoals: 0,
        awayGoals: 0,
      })
    }
  }
  return matches
    .filter((match) => !replacedMatchIds.has(match.id) && !pairedByeIds.has(match.id))
    .concat(replacementMatches, replacementByes)
}

function drawPolishCupRegionalRound(
  pools: Record<string, string[]>,
  round: number,
  teams: PolishCupTeam[],
  season: string,
  protectedTeamId?: string,
) {
  const scheduleStage: PolishCupScheduleStage = round === 1
    ? 'regional-first'
    : round === 2
      ? 'regional-second'
      : round === 3
        ? 'regional-third'
        : round === 4
          ? 'regional-quarterfinal'
          : round === 5
            ? 'regional-semifinal'
            : 'regional-final'
  const matches = Object.entries(pools).flatMap(([poolId, teamIds]) =>
    drawPolishCupMatches(teamIds, 'regional', round, poolId, undefined, teams, scheduleStage, season, 0, protectedTeamId),
  )
  return matches
}

function drawPolishCupStageRound(cup: PolishCup, protectedTeamId?: string) {
  if (cup.stage === 'complete') return []
  const target = cup.stage === 'national'
    ? Math.floor(cup.participants.length / 2)
    : cup.participants.length > 64
      ? 64
      : Math.floor(cup.participants.length / 2)
  return drawPolishCupMatches(
    cup.participants,
    cup.stage,
    cup.regionalRound,
    undefined,
    target,
    cup.teams,
    cup.scheduleStage,
    cup.season,
    0,
    protectedTeamId,
  )
}

function simulateRegionalChampion(teams: PolishCupTeam[]) {
  let remaining = [...teams].sort((first, second) => first.id.localeCompare(second.id))
  while (remaining.length > 1) {
    const nextRound: PolishCupTeam[] = []
    const draw = shuffled(remaining)
    while (draw.length > 1) {
      const first = draw.shift()
      const second = draw.shift()
      if (!first || !second) break
      nextRound.push(rollGoals(first.strength, second.strength) >= rollGoals(second.strength, first.strength) ? first : second)
    }
    if (draw.length === 1) nextRound.push(draw[0])
    remaining = nextRound
  }
  return remaining[0]
}

function previousSeasonLabel(season: string) {
  const [start, end] = season.split('/').map(Number)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return season
  return `${start - 1}/${end - 1}`
}

function simulatePreviousRegionalWinners(teams: PolishCupTeam[]) {
  const byRegion = new Map<string, PolishCupTeam[]>()
  teams.filter((team) => getLeagueTier(team.leagueId) >= 4).forEach((team) => {
    const region = team.regionId ?? resolveClubRegion(team.name, team.leagueId)
    const regionTeams = byRegion.get(region) ?? []
    regionTeams.push(team)
    byRegion.set(region, regionTeams)
  })
  return Object.fromEntries([...byRegion.entries()].map(([region, regionTeams]) => {
    const winner = simulateRegionalChampion(regionTeams)
    return [region, winner ? [winner.id] : []]
  }))
}

function createRegionalCupSeasons(teams: PolishCupTeam[], season: string, protectedTeamId?: string): RegionalCup[] {
  const regionTeams = new Map<string, PolishCupTeam[]>()
  teams.filter((team) => getLeagueTier(team.leagueId) >= 4).forEach((team) => {
    const region = team.regionId ?? resolveClubRegion(team.name, team.leagueId)
    const entries = regionTeams.get(region) ?? []
    entries.push(team)
    regionTeams.set(region, entries)
  })
  return [...regionTeams.entries()].sort(([first], [second]) => first.localeCompare(second)).map(([regionId, regionalTeams]) => {
    const initialTeams = regionalTeams.filter((team) => getLeagueTier(team.leagueId) >= 7)
    const initialParticipants = initialTeams.length ? initialTeams : regionalTeams.filter((team) => getLeagueTier(team.leagueId) >= 5)
    const cupTeams = regionalTeams
    const matches = drawPolishCupMatches(
      initialParticipants.map((team) => team.id),
      'regional',
      1,
      regionId,
      undefined,
      cupTeams,
      'regional-first',
      season,
      0,
      protectedTeamId,
    )
    return {
      season,
      regionId,
      stageId: 'regional-first',
      teams: cupTeams,
      participants: initialParticipants.map((team) => team.id),
      matches,
      history: [],
    }
  })
}

function scheduleLeagueFixtures(game: GameState) {
  const minimumRestMilliseconds = 72 * 60 * 60 * 1000
  const eventsByTeam = new Map<string, Date[]>()
  const addEvent = (teamId: string, date: string | undefined, time: string | undefined) => {
    if (!date || !teamId) return
    const event = new Date(`${date}T${time ?? '20:00'}:00`)
    const events = eventsByTeam.get(teamId) ?? []
    events.push(event)
    eventsByTeam.set(teamId, events)
  }
  const cupMatches = [
    ...(game.polishCup?.history ?? []),
    ...(game.polishCup?.matches ?? []),
    ...(game.regionalCups ?? []).flatMap((cup) => [...cup.history, ...cup.matches]),
    ...(game.championsCupMatch ? [game.championsCupMatch] : []),
  ]
  const seenCupMatches = new Set<string>()
  cupMatches.forEach((match) => {
    if (match.bye || seenCupMatches.has(match.id)) return
    seenCupMatches.add(match.id)
    addEvent(match.homeId, match.scheduledAt, match.kickoffTime)
    addEvent(match.awayId, match.scheduledAt, match.kickoffTime)
  })
  game.matches.filter((match) => match.played && !match.bye).forEach((match) => {
    addEvent(match.homeId, match.scheduledAt, match.kickoffTime)
    addEvent(match.awayId, match.scheduledAt, match.kickoffTime)
  })

  const currentDate = game.currentDate ?? `${game.season.split('/')[0]}-07-01`
  const pendingMatches = game.matches
    .filter((match) => !match.played)
    .sort((first, second) => first.round - second.round || first.id.localeCompare(second.id))
  const tier = getLeagueTier(game.leagueId)
  const getKickoffTimes = (match: Match, dateKey: string) => {
    const date = new Date(`${dateKey}T12:00:00`)
    const lowerLeague = tier >= 4
    const slotsByDay: Record<number, string[]> = lowerLeague
      ? { 0: ['12:30', '14:45', '17:30'], 6: ['14:45', '17:30'] }
      : {
        1: ['19:00'],
        5: ['18:00', '20:30'],
        6: ['14:45', '17:30', '20:15'],
        0: ['12:30', '14:45', '17:30'],
      }
    const slots = slotsByDay[date.getDay()] ?? ['17:30']
    const roundMatches = game.matches.filter((fixture) => fixture.round === match.round && !fixture.bye)
    const getAttractiveness = (fixture: Match) => {
      const homeStrength = game.teams.find((team) => team.id === fixture.homeId)?.strength ?? 0
      const awayStrength = game.teams.find((team) => team.id === fixture.awayId)?.strength ?? 0
      return homeStrength + awayStrength + (100 - Math.abs(homeStrength - awayStrength)) * 0.35
    }
    const rankedMatches = [...roundMatches].sort((first, second) =>
      getAttractiveness(second) - getAttractiveness(first) || first.id.localeCompare(second.id),
    )
    const rank = Math.max(0, rankedMatches.findIndex((fixture) => fixture.id === match.id))
    const slotIndex = Math.max(0, slots.length - 1 - Math.floor(rank * slots.length / Math.max(1, rankedMatches.length)))
    return [...slots.slice(slotIndex), ...slots.slice(0, slotIndex).reverse()]
  }

  for (const match of pendingMatches) {
    const originalScheduledDate = match.scheduledAt
    const originalKickoffTime = match.kickoffTime ?? '20:00'
    const baseDate = moveMatchDateOffPolishHoliday(getLeagueRoundDate(
      game.season,
      match.round,
      tier,
      getSeasonRoundCount(game),
      getGameMatchupsPerOpponent(game),
    ))
    const baseDateKey = getLocalDateKey(baseDate)
    if (match.bye) {
      match.scheduledAt = baseDateKey
      match.kickoffTime ??= '17:30'
      continue
    }

    const teamIds = [match.homeId, match.awayId]
    const getAvailableKickoffTime = (dateKey: string) =>
      getKickoffTimes(match, dateKey).find((time) => {
        const kickoff = new Date(`${dateKey}T${time}:00`).getTime()
        return teamIds.every((teamId) =>
          (eventsByTeam.get(teamId) ?? []).every((event) =>
            Math.abs(kickoff - event.getTime()) >= minimumRestMilliseconds,
          ),
        )
      })

    let scheduledKickoffTime = baseDateKey >= currentDate
      ? getAvailableKickoffTime(baseDateKey)
      : undefined
    let scheduledDate = scheduledKickoffTime ? baseDateKey : undefined

    if (!scheduledDate) {
      const candidates: { dateKey: string; dayOffset: number }[] = []
      for (let offset = -35; offset <= 35; offset += 1) {
        const candidate = new Date(baseDate)
        candidate.setDate(candidate.getDate() + offset)
        const dateKey = getLocalDateKey(candidate)
        if (dateKey < currentDate || dateKey === baseDateKey || isPolishPublicHoliday(candidate)) continue
        candidates.push({ dateKey, dayOffset: offset })
      }
      const sortByDistance = (first: typeof candidates[number], second: typeof candidates[number]) =>
        Number(first.dayOffset < 0) - Number(second.dayOffset < 0)
        || Math.abs(first.dayOffset) - Math.abs(second.dayOffset)
        || first.dateKey.localeCompare(second.dateKey)
      const weekendDates = candidates
        .filter(({ dateKey }) => [0, 6].includes(new Date(`${dateKey}T12:00:00`).getDay()))
        .sort(sortByDistance)
      const weekdayDates = candidates
        .filter(({ dateKey }) => [2, 3].includes(new Date(`${dateKey}T12:00:00`).getDay()))
        .sort(sortByDistance)
      const availableDate = [...weekendDates, ...weekdayDates]
        .map(({ dateKey }) => ({ dateKey, kickoffTime: getAvailableKickoffTime(dateKey) }))
        .find((candidate): candidate is { dateKey: string; kickoffTime: string } => Boolean(candidate.kickoffTime))
      scheduledDate = availableDate?.dateKey
      scheduledKickoffTime = availableDate?.kickoffTime
    }

    if (!scheduledDate || !scheduledKickoffTime) {
      throw new Error(`Nie udało się wyznaczyć terminu ligowego z 72-godzinną przerwą dla meczu ${match.id}.`)
    }
    match.scheduledAt = scheduledDate
    match.kickoffTime = scheduledKickoffTime
    if (
      originalScheduledDate
      && isPolishPublicHoliday(parseLocalDateKey(originalScheduledDate))
      && originalScheduledDate !== scheduledDate
      && (match.homeId === game.teamId || match.awayId === game.teamId)
    ) {
      const subject = `Zmiana terminu · ${getTeamName(game, match.homeId)} – ${getTeamName(game, match.awayId)} · ${originalScheduledDate}`
      if (!game.inboxMessages?.some((message) => message.subject === subject)) {
        const dateLabel = (dateKey: string, time: string) =>
          `${new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(parseLocalDateKey(dateKey))} o ${time}`
        addInboxMessage(
          game,
          'Departament rozgrywek',
          subject,
          `Spotkanie ${getTeamName(game, match.homeId)} – ${getTeamName(game, match.awayId)} zostało przełożone, ponieważ pierwotny termin przypadał w święto ustawowe. Pierwotny termin: ${dateLabel(originalScheduledDate, originalKickoffTime)}. Nowy termin: ${dateLabel(scheduledDate, match.kickoffTime)}. Zmiana uwzględnia co najmniej 72 godziny odpoczynku między spotkaniami.`,
          'info',
          'club',
        )
      }
    }
    for (const teamId of teamIds) addEvent(teamId, scheduledDate, match.kickoffTime)
  }
  scheduleCupFixturesWithRest(game)
}

function scheduleCupFixturesWithRest(game: GameState) {
  const minimumRestMilliseconds = 72 * 60 * 60 * 1000
  const eventTimesByTeam = new Map<string, number[]>()
  const addEvent = (teamId: string, date: string | undefined, time: string | undefined) => {
    if (!teamId || !date) return
    const kickoff = new Date(`${date}T${time ?? '20:00'}:00`).getTime()
    const events = eventTimesByTeam.get(teamId) ?? []
    events.push(kickoff)
    eventTimesByTeam.set(teamId, events)
  }
  const cupMatches = [
    ...(game.polishCup?.history ?? []),
    ...(game.polishCup?.matches ?? []),
    ...(game.regionalCups ?? []).flatMap((cup) => [...cup.history, ...cup.matches]),
    ...(game.championsCupMatch ? [game.championsCupMatch] : []),
  ]
  const seenCupIds = new Set<string>()
  cupMatches.forEach((match) => {
    if (!match.played || match.bye || seenCupIds.has(match.id)) return
    seenCupIds.add(match.id)
    addEvent(match.homeId, match.scheduledAt, match.kickoffTime)
    addEvent(match.awayId, match.scheduledAt, match.kickoffTime)
  })
  game.matches.forEach((match) => {
    if (match.bye) return
    addEvent(match.homeId, match.scheduledAt, match.kickoffTime)
    addEvent(match.awayId, match.scheduledAt, match.kickoffTime)
  })

  const upcomingMatches = [
    ...(game.polishCup?.matches ?? []),
    ...(game.regionalCups ?? []).flatMap((cup) => cup.matches),
    ...(game.championsCupMatch ? [game.championsCupMatch] : []),
  ].filter((match) => !match.played && !match.bye && match.scheduledAt)
    .sort((first, second) =>
      (first.scheduledAt ?? '').localeCompare(second.scheduledAt ?? '')
      || (first.kickoffTime ?? '').localeCompare(second.kickoffTime ?? '')
      || first.id.localeCompare(second.id),
    )
  const currentDate = game.currentDate ?? `${game.season.split('/')[0]}-07-01`
  const kickoffOptions = ['16:00', '17:30', '19:00', '20:30', '21:00']

  upcomingMatches.forEach((match) => {
    const preferredDate = parseLocalDateKey(match.scheduledAt as string)
    const preferredTime = match.kickoffTime ?? '19:00'
    const candidateDates = Array.from({ length: 57 }, (_, index) => {
      const date = new Date(preferredDate)
      date.setDate(date.getDate() + index - 28)
      return date
    }).filter((date) =>
      [2, 3, 4].includes(date.getDay())
      && getLocalDateKey(date) >= currentDate
      && !isPolishPublicHoliday(date),
    ).sort((first, second) =>
      Math.abs(first.getTime() - preferredDate.getTime()) - Math.abs(second.getTime() - preferredDate.getTime())
      || first.getTime() - second.getTime(),
    )
    const times = [preferredTime, ...kickoffOptions.filter((time) => time !== preferredTime)]
    const scheduled = candidateDates.flatMap((date) => times.map((time) => ({ date, time }))).find(({ date, time }) => {
      const kickoff = new Date(`${getLocalDateKey(date)}T${time}:00`).getTime()
      return [match.homeId, match.awayId].every((teamId) =>
        (eventTimesByTeam.get(teamId) ?? []).every((eventTime) =>
          Math.abs(kickoff - eventTime) >= minimumRestMilliseconds,
        ),
      )
    })
    if (!scheduled) {
      throw new Error(`Nie udało się ustalić terminu meczu pucharowego ${match.id} z zachowaniem minimum 72 godzin odpoczynku.`)
    }
    match.scheduledAt = getLocalDateKey(scheduled.date)
    match.kickoffTime = scheduled.time
    addEvent(match.homeId, match.scheduledAt, match.kickoffTime)
    addEvent(match.awayId, match.scheduledAt, match.kickoffTime)
  })
}

function getPmpLeagueDate(season: string, daysAfterDecemberFirst: number) {
  const seasonStart = Number.parseInt(season.split('/')[0] ?? '', 10)
  if (!Number.isFinite(seasonStart)) throw new Error(`Nieprawidłowy sezon Ligi PMP: ${season}.`)
  return getLocalDateKey(new Date(seasonStart, 11, 1 + daysAfterDecemberFirst))
}

function comparePmpCandidates(
  first: { team: Team; leagueId: string },
  second: { team: Team; leagueId: string },
) {
  const firstPlayed = Math.max(1, first.team.played)
  const secondPlayed = Math.max(1, second.team.played)
  return second.team.points / secondPlayed - first.team.points / firstPlayed
    || (second.team.goalsFor - second.team.goalsAgainst) / secondPlayed
      - (first.team.goalsFor - first.team.goalsAgainst) / firstPlayed
    || second.team.goalsFor / secondPlayed - first.team.goalsFor / firstPlayed
    || getLeagueTier(first.leagueId as LeagueId) - getLeagueTier(second.leagueId as LeagueId)
    || first.team.name.localeCompare(second.team.name, 'pl')
}

function createPmpLeagueMatch(
  phase: PmpLeagueMatch['phase'],
  round: number,
  homeId: string,
  awayId: string,
  scheduledAt: string,
  regionId?: string,
  groupId?: string,
  bye = false,
): PmpLeagueMatch {
  return {
    id: `pmp-league-${phase}-${round}-${createId()}`,
    round,
    phase,
    regionId,
    groupId,
    scheduledAt,
    kickoffTime: ['12:00', '14:30', '17:00', '19:30'][(round + Math.floor(Math.random() * 4)) % 4],
    homeId,
    awayId,
    played: bye,
    bye,
    winnerId: bye ? homeId : undefined,
    homeGoals: bye ? 0 : undefined,
    awayGoals: bye ? 0 : undefined,
    competitionId: 'other',
  }
}

function createPmpGroupMatches(groups: PmpLeagueGroup[], season: string) {
  const matches: PmpLeagueMatch[] = []
  for (const group of groups) {
    const [first, second, third, fourth] = group.teamIds
    const firstLeg: [string, string][] = [
      [first, fourth],
      [second, third],
      [first, third],
      [fourth, second],
      [first, second],
      [third, fourth],
    ]
    for (let round = 1; round <= 6; round += 1) {
      const [homeId, awayId] = firstLeg[round - 1]
      const isReturnLeg = round > 3
      matches.push(createPmpLeagueMatch(
        'groups',
        round,
        isReturnLeg ? awayId : homeId,
        isReturnLeg ? homeId : awayId,
        getPmpLeagueDate(season, (round - 1) * 4 + 2),
        group.regionId,
        group.id,
      ))
    }
  }
  return matches
}

function createPmpKnockoutMatches(
  phase: Exclude<PmpLeaguePhase, 'groups' | 'complete'>,
  teams: string[],
  season: string,
  dayOffset: number,
  round: number,
  regionId?: string,
  targetCount?: number,
) {
  const shuffledTeams = shuffled(teams)
  const matchCount = targetCount === undefined
    ? Math.floor(shuffledTeams.length / 2)
    : Math.max(0, Math.min(Math.floor(shuffledTeams.length / 2), shuffledTeams.length - targetCount))
  const matches: PmpLeagueMatch[] = []
  for (let index = 0; index < matchCount * 2; index += 2) {
    matches.push(createPmpLeagueMatch(
      phase,
      round,
      shuffledTeams[index],
      shuffledTeams[index + 1],
      getPmpLeagueDate(season, dayOffset),
      regionId,
    ))
  }
  if (targetCount !== undefined) {
    for (const teamId of shuffledTeams.slice(matchCount * 2)) {
      matches.push(createPmpLeagueMatch(
        phase,
        round,
        teamId,
        '',
        getPmpLeagueDate(season, dayOffset),
        regionId,
        undefined,
        true,
      ))
    }
  }
  return matches
}

function createPmpLeague(game: GameState): PmpLeague {
  const world = game.leagueWorld ?? createLeagueWorld(game.leagueId, game.teams)
  world[game.leagueId] = game.teams.map((team) => ({ ...team }))
  const teamsById = new Map<string, PolishCupTeam>()
  const groups: PmpLeagueGroup[] = []
  const regionGroups = new Map<string, Array<{ leagueId: string; standings: Team[] }>>()
  for (const [leagueId, leagueGroup] of Object.entries(leagueGroups)) {
    if (leagueGroup.tier < 7) continue
    const standings = world[leagueId]
    if (!standings) continue
    const roundCount = getSeasonRoundCount({ teams: standings })
    if (roundCount > 22) continue
    const regionId = 'regionId' in leagueGroup ? leagueGroup.regionId : undefined
    if (!regionId) continue
    const region = regionGroups.get(regionId) ?? []
    region.push({ leagueId, standings: rankTeams(standings) })
    regionGroups.set(regionId, region)
    for (const team of standings) {
      teamsById.set(team.id, {
        id: team.id,
        name: team.name,
        strength: team.id === game.teamId ? overallRating(game.squad) : team.strength,
        leagueId: leagueId as LeagueId,
        regionId,
      })
    }
  }

  for (const [regionId, regionalGroups] of regionGroups) {
    const qualifiers: Array<{ team: Team; leagueId: string }> = []
    const maxPlaces = Math.max(...regionalGroups.map((group) => group.standings.length))
    for (let place = 0; place < maxPlaces && qualifiers.length < 16; place += 1) {
      const candidates = regionalGroups
        .map((group) => ({ team: group.standings[place], leagueId: group.leagueId }))
        .filter((candidate): candidate is { team: Team; leagueId: string } => Boolean(candidate.team))
        .sort(comparePmpCandidates)
      qualifiers.push(...candidates.slice(0, 16 - qualifiers.length))
    }
    if (qualifiers.length < 8) continue
    const regionalTeams = shuffled(qualifiers.map(({ team }) => team.id))
    for (let groupIndex = 0; groupIndex < regionalTeams.length / 4; groupIndex += 1) {
      groups.push({
        id: `${regionId}-group-${groupIndex + 1}`,
        regionId,
        teamIds: regionalTeams.slice(groupIndex * 4, groupIndex * 4 + 4),
      })
    }
  }

  if (!groups.length) {
    throw new Error('Nie znaleziono wystarczającej liczby klubów A i B klasy do Ligi PMP.')
  }
  const groupFixtures = createPmpGroupMatches(groups, game.season)
  const firstMatchDate = groupFixtures
    .map((match) => match.scheduledAt)
    .filter((date): date is string => Boolean(date))
    .sort()[0]
  if (!firstMatchDate) throw new Error('Nie udało się ustalić terminu inauguracji Ligi PMP.')
  return {
    season: game.season,
    phase: 'groups',
    startAt: firstMatchDate,
    teams: [...teamsById.values()].filter((team) => groups.some((group) => group.teamIds.includes(team.id))),
    groups,
    matches: groupFixtures,
    history: [],
    regionalChampions: {},
  }
}

function initializePmpLeagueIfReady(game: GameState) {
  const firstPossibleDate = getPmpLeagueDate(game.season, 0)
  if (game.pmpLeague || game.round <= Math.ceil(getSeasonRoundCount(game) / 2)
    || (game.currentDate ?? firstPossibleDate) < firstPossibleDate) return
  const tournament = createPmpLeague(game)
  const firstMatchDate = parseLocalDateKey(tournament.startAt)
  const currentDate = parseLocalDateKey(game.currentDate ?? tournament.startAt)
  const earliestSafeDate = new Date(currentDate)
  earliestSafeDate.setDate(earliestSafeDate.getDate() + 3)
  const shiftDays = Math.max(0, Math.ceil((earliestSafeDate.getTime() - firstMatchDate.getTime()) / 86_400_000))
  if (shiftDays > 40) return
  if (shiftDays > 0) {
    for (const match of tournament.matches) {
      if (!match.scheduledAt) continue
      const date = parseLocalDateKey(match.scheduledAt)
      date.setDate(date.getDate() + shiftDays)
      match.scheduledAt = getLocalDateKey(date)
    }
    const shiftedStart = parseLocalDateKey(tournament.startAt)
    shiftedStart.setDate(shiftedStart.getDate() + shiftDays)
    tournament.startAt = getLocalDateKey(shiftedStart)
  }
  game.pmpLeague = tournament
  const regionCount = new Set(game.pmpLeague.groups.map((group) => group.regionId)).size
  addInboxMessage(
    game,
    'Biuro Ligi PMP',
    `Liga PMP · losowanie fazy grupowej · ${game.season}`,
    `Do zimowego turnieju zakwalifikowało się ${game.pmpLeague.teams.length} klubów z ${regionCount} regionów. Drużyny zostały rozlosowane do grup. Pierwsze mecze odbędą się ${game.pmpLeague.startAt}. Terminarz znajdziesz w zakładce Liga PMP.`,
    'info',
    'club',
  )
  addMediaPost(game, 'LIGA', 'Startuje Liga PMP', `Zimowy turniej zgromadzi ${game.pmpLeague.teams.length} klubów z niższych lig.`)
}

function makePolishCup(game: GameState): PolishCup {
  const world = game.leagueWorld ?? createLeagueWorld(game.leagueId, game.teams)
  world[game.leagueId] = game.teams.map((team) => ({ ...team }))
  const teams = Object.entries(world).flatMap(([leagueId, leagueTeams]) =>
    leagueTeams.map((team) => ({
      id: team.id,
      name: team.name,
      strength: team.id === game.teamId ? overallRating(game.squad) : team.strength,
      leagueId: leagueId as LeagueId,
      regionId: team.regionId,
    })),
  )
  if (!teams.some((team) => team.id === game.teamId)) {
    const club = game.teams.find((team) => team.id === game.teamId)
    if (!club) throw new Error('Nie udało się dodać klubu do Polskiego Pucharu.')
    teams.push({
      id: club.id,
      name: club.name,
      strength: overallRating(game.squad),
      leagueId: game.leagueId,
      regionId: club.regionId,
    })
  }
  const previousSeason = previousSeasonLabel(game.season)
  const winnersByRegion = game.regionalCupWinners?.[previousSeason]
    ? game.regionalCupWinners[previousSeason]
    : simulatePreviousRegionalWinners(teams)
  const regionalQualifiers = Object.values(winnersByRegion).flat()
  const heldEkstraklasaTeams = teams.filter((team) => getLeagueTier(team.leagueId) === 1)
  const userClub = teams.find((team) => team.id === game.teamId)
  if (userClub && getLeagueTier(game.leagueId) === 1 && !heldEkstraklasaTeams.some((team) => team.id === game.teamId)) {
    heldEkstraklasaTeams.push(userClub)
  }
  const heldIds = new Set(heldEkstraklasaTeams.map((team) => team.id))
  const preliminaryTeams = teams
    .filter((team) => getLeagueTier(team.leagueId) <= 3 && !heldIds.has(team.id))
    .map((team) => team.id)
  const preliminaryParticipants = [...new Set([...preliminaryTeams, ...regionalQualifiers])]
  const scheduleStage: PolishCupScheduleStage = 'central-preliminary'
  const preliminaryMatches = drawPolishCupMatches(
    preliminaryParticipants,
    'third',
    1,
    undefined,
    Math.max(0, 64 - heldEkstraklasaTeams.length),
    teams,
    scheduleStage,
    game.season,
    0,
    game.teamId,
  )
  return {
    season: game.season,
    stage: 'third',
    scheduleStage,
    drawAt: getPolishCupDrawDate(game.season, scheduleStage)
      ? getLocalDateKey(getPolishCupDrawDate(game.season, scheduleStage) as Date)
      : undefined,
    centralSeason: true,
    regionalRound: 1,
    teams,
    regionalPools: {},
    participants: preliminaryParticipants,
    heldEkstraklasaIds: heldEkstraklasaTeams.map((team) => team.id),
    matches: preliminaryMatches,
    history: [],
  }
}

function enterPolishCupStage(
  cup: PolishCup,
  stage: Exclude<PolishCupStage, 'regional' | 'complete'>,
  qualifiedIds: string[],
  scheduleStage: PolishCupScheduleStage,
  targetCount?: number,
  protectedTeamId?: string,
) {
  cup.stage = stage
  cup.regionalRound = 1
  cup.scheduleStage = scheduleStage
  const drawDate = getPolishCupDrawDate(cup.season, scheduleStage)
  cup.drawAt = drawDate ? getLocalDateKey(drawDate) : undefined
  cup.participants = [...new Set(qualifiedIds)]
  cup.matches = drawPolishCupMatches(
    cup.participants,
    stage,
    cup.regionalRound,
    undefined,
    targetCount,
    cup.teams,
    scheduleStage,
    cup.season,
    0,
    protectedTeamId,
  )
}

export function getPolishCupStageLabel(cup: PolishCup) {
  if (cup.scheduleStage === 'central-preliminary') return 'Runda wstępna Polskiego Pucharu'
  if (cup.scheduleStage === 'central-first') return 'I runda centralna · 1/32 finału'
  if (cup.scheduleStage === 'central-round-of-16') return '1/16 finału'
  if (cup.scheduleStage === 'central-round-of-8') return '1/8 finału'
  if (cup.scheduleStage === 'central-quarterfinal') return 'Ćwierćfinał'
  if (cup.scheduleStage === 'central-semifinal') return 'Półfinał'
  if (cup.scheduleStage === 'central-final') return 'Wielki finał'
  if (cup.stage === 'regional') return `Rundy regionalne IV ligi · runda ${cup.regionalRound}`
  if (cup.stage === 'third') return 'Runda kwalifikacyjna · dołączają kluby 3. Ligi'
  if (cup.stage === 'second') return 'Runda kwalifikacyjna · dołączają kluby 2. Ligi'
  if (cup.stage === 'first') return 'Runda kwalifikacyjna · dołączają kluby 1. Ligi'
  if (cup.stage === 'ekstraklasa') return 'Runda kwalifikacyjna · dołączają kluby Superklasy'
  if (cup.stage === 'complete') return 'Polski Puchar zakończony'
  const roundLabels: Record<number, string> = {
    64: '1/32 finału',
    32: '1/16 finału',
    16: '1/8 finału',
    8: 'Ćwierćfinał',
    4: 'Półfinał',
    2: 'Finał',
  }
  return roundLabels[cup.participants.length] ?? 'Faza pucharowa'
}

export function getPolishCupMatchStageLabel(stage: PolishCupMatch['stage'], round: number, participants = 0) {
  if (stage === 'third') return 'Runda wstępna'
  if (stage === 'second') return 'I runda centralna · 1/32 finału'
  if (stage === 'first') return '1/16 finału'
  if (stage === 'national') {
    if (participants >= 32) return '1/16 finału'
    if (participants >= 16) return '1/8 finału'
    if (participants >= 8) return 'Ćwierćfinał'
    if (participants >= 4) return 'Półfinał'
    return 'Wielki finał'
  }
  if (stage === 'regional') return `Runda regionalna ${round}`
  if (stage === 'ekstraklasa') return 'Runda z klubami Superklasy'
  const roundLabels: Record<number, string> = {
    64: '1/32 finału',
    32: '1/16 finału',
    16: '1/8 finału',
    8: 'Ćwierćfinał',
    4: 'Półfinał',
    2: 'Finał',
  }
  return roundLabels[participants] ?? `Faza ogólnopolska · runda ${round}`
}

export function getPolishCupNextMatch(game: GameState) {
  const cup = game.polishCup
  const seasonStart = game.season.split('/')[0]
  const currentDate = game.currentDate ?? `${seasonStart}-07-01`
  const drawPending = Boolean(cup?.drawAt && currentDate < cup.drawAt)
  const allUpcoming = [
    ...(!drawPending && cup?.stage !== 'complete' ? cup?.matches ?? [] : []),
    ...(game.regionalCups ?? []).flatMap((cup) => cup.matches),
  ].filter((match) =>
    !match.played
    && Boolean(match.scheduledAt)
    && (match.homeId === game.teamId || match.awayId === game.teamId),
  )
  const nextDate = allUpcoming.map((match) => match.scheduledAt as string).sort()[0]
  return allUpcoming.find((match) =>
    match.scheduledAt === nextDate
    && !match.bye
    && (match.homeId === game.teamId || match.awayId === game.teamId),
  )
}

function nextWeekdayAfter(date: Date, weekday: number) {
  const result = new Date(date)
  result.setHours(12, 0, 0, 0)
  const offset = (weekday - result.getDay() + 7) % 7 || 7
  result.setDate(result.getDate() + offset)
  return result
}

function createPromotionPlayoffSchedule(game: GameState): PromotionPlayoffs {
  const world = game.leagueWorld ?? createLeagueWorld(game.leagueId, game.teams)
  world[game.leagueId] = game.teams.map((team) => ({ ...team }))
  simulateLeagueWorldToSeasonEnd(world, game.leagueId)
  game.leagueWorld = world

  const finalRound = getSeasonRoundCount(game)
  const scheduledFinalRoundDates = game.matches
    .filter((match) => match.round === finalRound && match.scheduledAt)
    .map((match) => parseLocalDateKey(match.scheduledAt as string))
  const canonicalFinalRoundDate = getLeagueRoundDate(
    game.season,
    finalRound,
    getLeagueTier(game.leagueId),
    finalRound,
    getGameMatchupsPerOpponent(game),
  )
  const lastRoundDate = scheduledFinalRoundDates.length
    ? new Date(Math.max(canonicalFinalRoundDate.getTime(), ...scheduledFinalRoundDates.map((date) => date.getTime())))
    : canonicalFinalRoundDate
  const semifinalSaturday = nextWeekdayAfter(lastRoundDate, 6)
  const semifinalSunday = new Date(semifinalSaturday)
  semifinalSunday.setDate(semifinalSunday.getDate() + 1)
  const finalSunday = new Date(semifinalSunday)
  finalSunday.setDate(finalSunday.getDate() + 7)
  const fixtures: PromotionPlayoffFixture[] = []
  const byeTeamIds: Record<string, string> = {}
  const autoPromotedByLeague: Record<string, string> = {}
  const addFixture = (
    competitionId: string,
    leagueId: string,
    leagueName: string,
    round: 1 | 2,
    home: Team,
    away: Team,
    scheduledAt: Date,
    kickoffTime: string,
    fixtureIndex: number,
  ) => fixtures.push({
    id: `promotion-playoff-${competitionId}-${round}-${fixtureIndex}-${game.season}`,
    leagueId,
    competitionId,
    leagueName,
    round,
    homeId: home.id,
    awayId: away.id,
    scheduledAt: getLocalDateKey(scheduledAt),
    kickoffTime,
    played: false,
  })

  for (const leagueId of ['first', 'second'] as const) {
    const teams = rankTeams(game.leagueWorld?.[leagueId] ?? [])
    const candidates = teams.slice(2, 6)
    if (candidates.length < 4) continue
    const tier = getLeagueTier(leagueId)
    const times = tier <= 2 ? ['16:00', '19:00'] : ['13:00', '15:00']
    const leagueName = leagueId === 'first' ? 'Pierwsza Liga Polska' : 'Druga Liga Polska'
    const pairs = [[candidates[0], candidates[3]], [candidates[1], candidates[2]]] as const
    pairs.forEach(([home, away], index) => addFixture(
      leagueId,
      leagueId,
      leagueName,
      1,
      home,
      away,
      index === 0 ? semifinalSaturday : semifinalSunday,
      times[index],
      index + 1,
    ))
  }

  const teamsFromGroups = (prefix: string) => Object.keys(world)
    .filter((leagueId) => leagueId.startsWith(prefix))
    .sort()
    .flatMap((leagueId) => {
      const champion = rankTeams(world[leagueId])[0]
      return champion ? [{ leagueId, team: champion }] : []
    })
    .sort((first, second) => comparePromotionCandidates(first.team, second.team))
  const addLowerFinal = (
    competitionId: string,
    home: { leagueId: string; team: Team },
    away: { leagueId: string; team: Team },
    name: string,
  ) => addFixture(
    competitionId,
    home.leagueId,
    name,
    2,
    home.team,
    away.team,
    finalSunday,
    '16:00',
    1,
  )

  const podkarpackieGroups = teamsFromGroups('podkarpackie-okr-')
  if (world['fourth-podkarpackie'] && podkarpackieGroups.length >= 5) {
    const competitionId = 'playoff:podkarpackie-fourth'
    const candidates = podkarpackieGroups.slice(1, 5)
    addFixture(competitionId, candidates[0].leagueId, 'IV Liga · podkarpacka', 1, candidates[0].team, candidates[3].team, semifinalSaturday, '13:00', 1)
    addFixture(competitionId, candidates[1].leagueId, 'IV Liga · podkarpacka', 1, candidates[1].team, candidates[2].team, semifinalSunday, '13:00', 2)
  }

  const zachodniopomorskieGroups = teamsFromGroups('zachodniopomorskie-')
  const zachodniopomorskieA = Object.keys(world).filter((leagueId) => leagueId.startsWith('zachodniopomorskie-a-')).sort()
  const zachodniopomorskieB = zachodniopomorskieGroups.filter(({ leagueId }) => leagueId.startsWith('zachodniopomorskie-b-'))
  const bPromotionCount = Math.min(zachodniopomorskieA.length, zachodniopomorskieB.length)
  if (bPromotionCount > 0 && zachodniopomorskieB.length > bPromotionCount) {
    addLowerFinal(
      'playoff:zachodniopomorskie-a',
      zachodniopomorskieB[bPromotionCount - 1],
      zachodniopomorskieB[bPromotionCount],
      'Klasa A · zachodniopomorska',
    )
  }
  const zachodniopomorskieChampions = zachodniopomorskieGroups.filter(({ leagueId }) => leagueId.startsWith('zachodniopomorskie-okr-'))
  if (world['fourth-zachodniopomorskie'] && zachodniopomorskieChampions.length === 4) {
    const competitionId = 'playoff:zachodniopomorskie-fourth'
    const candidates = zachodniopomorskieChampions.slice(1)
    byeTeamIds[competitionId] = zachodniopomorskieChampions[0].team.id
    addFixture(competitionId, candidates[1].leagueId, 'IV Liga · zachodniopomorska', 1, candidates[1].team, candidates[2].team, semifinalSaturday, '13:00', 1)
  }

  const pomorskieChampions = teamsFromGroups('pomorskie-okr-')
  if (world['fourth-pomorskie'] && pomorskieChampions.length === 3) {
    addLowerFinal(
      'playoff:pomorskie-fourth',
      pomorskieChampions[1],
      pomorskieChampions[2],
      'IV Liga · pomorska',
    )
  }

  const opolskieWithdrawals = getOpolskieWithdrawals(world, game.season, game.leagueSeasonExceptions)
  const opolskiePlan = getOpolskieRelegationPlan(
    world,
    {},
    game.leagueSeasonExceptions,
    game.season,
    opolskieWithdrawals,
  )
  const opolskieFourth = getOpolskieRankedTeams(world, 'fourth-opolskie', opolskieWithdrawals)
  const opolskieDirectPromotion = opolskiePlan.fourthToThird[0]
  const opolskieChampionPromotedDirectly = opolskieDirectPromotion?.id === opolskieFourth[0]?.id
  const opolskieRunnerUpCandidate = opolskieFourth[1]
  const opolskieRunnerUp = opolskieChampionPromotedDirectly
    && opolskieRunnerUpCandidate
    && isOpolskiePromotionEligible(opolskieRunnerUpCandidate, game.leagueSeasonExceptions, game.season)
    ? opolskieRunnerUpCandidate
    : undefined
  const opolskieFourthPlayoffOpponents = ['fourth-dolnoslaskie', 'fourth-lubuskie', 'fourth-slaskie']
    .map((leagueId) => ({
      leagueId,
      team: rankTeams(world[leagueId] ?? []).slice(1, 3).find((team) =>
        isOpolskiePromotionEligible(team, game.leagueSeasonExceptions, game.season),
      ),
    }))
    .filter((entry): entry is { leagueId: string; team: Team } => Boolean(entry.team))
  const opolskieFourthOpponent = opolskieFourthPlayoffOpponents.length
    ? opolskieFourthPlayoffOpponents[Math.floor(Math.random() * opolskieFourthPlayoffOpponents.length)]
    : undefined
  if (opolskieRunnerUp && opolskieFourthOpponent) {
    addFixture(
      'playoff:opolskie-fourth',
      'fourth-opolskie',
      'IV liga · baraż o awans',
      1,
      opolskieRunnerUp,
      opolskieFourthOpponent.team,
      semifinalSaturday,
      '13:00',
      1,
    )
  } else if (opolskieFourthOpponent) {
    autoPromotedByLeague['playoff:opolskie-fourth'] = opolskieFourthOpponent.team.id
  }

  const opolskieRelegationPlan = getOpolskieRelegationPlan(
    world,
    {},
    game.leagueSeasonExceptions,
    game.season,
  )
  if (opolskieRelegationPlan.okregowaPlayoffRank) {
    const opolskieOkregowa = ['opolskie-okr-1', 'opolskie-okr-2']
      .map((leagueId) => ({
        leagueId,
        team: rankTeams(world[leagueId] ?? [])
          .filter((team) => !opolskieWithdrawals[leagueId]?.some(({ id }) => id === team.id))
          [opolskieRelegationPlan.okregowaPlayoffRank! - 1],
      }))
      .filter((entry): entry is { leagueId: string; team: Team } => Boolean(entry.team))
    if (opolskieOkregowa.length === 2) {
      addFixture(
        'playoff:opolskie-okr-survival',
        'opolskie-okr-1',
        'Klasa Okręgowa · baraż o utrzymanie',
        1,
        opolskieOkregowa[0].team,
        opolskieOkregowa[1].team,
        semifinalSaturday,
        '16:00',
        1,
      )
    }
  }

  const state: PromotionPlayoffs = {
    season: game.season,
    round: fixtures.some((fixture) => fixture.round === 1) ? 1 : fixtures.length ? 2 : 'complete',
    fixtures,
    history: [],
    promotedByLeague: autoPromotedByLeague,
    byeTeamIds,
    leagueWorldFinalized: true,
  }
  const schedule = fixtures
    .map((fixture) => `${fixture.leagueName} · ${fixture.round === 1 ? 'mecz' : 'rewanż'} · ${new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' }).format(parseLocalDateKey(fixture.scheduledAt))}, godz. ${fixture.kickoffTime} · ${getTeamName(game, fixture.homeId)} – ${getTeamName(game, fixture.awayId)}`)
    .join('\n')
  if (schedule) {
    addInboxMessage(
      game,
      'Biuro rozgrywek ligowych',
      `Terminarz baraży · sezon ${game.season}`,
      `Zaplanowane baraże:\n${schedule}\n\nTerminy rewanżów i rozstrzygnięcia baraży zostaną podane w osobnej wiadomości.`,
      'info',
      'club',
    )
  }
  return state
}

function rescheduleUnplayedPromotionPlayoffs(game: GameState) {
  const playoffs = game.promotionPlayoffs
  if (!playoffs || playoffs.round === 'complete') return

  const finalRound = getSeasonRoundCount(game)
  const scheduledFinalRoundDates = game.matches
    .filter((match) => match.round === finalRound && match.scheduledAt)
    .map((match) => parseLocalDateKey(match.scheduledAt as string))
  const canonicalFinalRoundDate = getLeagueRoundDate(
    game.season,
    finalRound,
    getLeagueTier(game.leagueId),
    finalRound,
    getGameMatchupsPerOpponent(game),
  )
  const lastRoundDate = scheduledFinalRoundDates.length
    ? new Date(Math.max(canonicalFinalRoundDate.getTime(), ...scheduledFinalRoundDates.map((date) => date.getTime())))
    : canonicalFinalRoundDate
  const currentDate = game.currentDate ? parseLocalDateKey(game.currentDate) : lastRoundDate
  const seasonEnd = currentDate > lastRoundDate ? currentDate : lastRoundDate
  const semifinalSaturday = nextWeekdayAfter(seasonEnd, 6)
  const semifinalSunday = new Date(semifinalSaturday)
  semifinalSunday.setDate(semifinalSunday.getDate() + 1)
  const semifinalDates = [semifinalSaturday, semifinalSunday]

  const pendingSemifinals = playoffs.fixtures.filter((fixture) => fixture.round === 1 && !fixture.played)
  pendingSemifinals.forEach((fixture, index) => {
    fixture.scheduledAt = getLocalDateKey(semifinalDates[index % semifinalDates.length])
  })

  const completedSemifinalDates = playoffs.history
    .filter((fixture) => fixture.round === 1)
    .map((fixture) => parseLocalDateKey(fixture.scheduledAt))
  const finalFixtures = playoffs.fixtures.filter((fixture) => fixture.round === 2 && !fixture.played)
  if (finalFixtures.length === 0) return

  const lastSemifinalDate = completedSemifinalDates.length
    ? new Date(Math.max(...completedSemifinalDates.map((date) => date.getTime())))
    : semifinalSunday
  const finalDate = new Date(lastSemifinalDate)
  finalDate.setDate(finalDate.getDate() + 7)
  if (finalDate < currentDate) {
    finalDate.setTime(nextWeekdayAfter(currentDate, 0).getTime())
  }
  finalFixtures.forEach((fixture) => {
    fixture.scheduledAt = getLocalDateKey(finalDate)
  })
}

export function getNextScheduledCompetition(game: GameState): 'league' | 'polish-cup' | 'champions-cup' | 'pmp-league' | 'friendly' | 'promotion-playoff' | 'season-complete' {
  const leagueMatches = game.matches.filter((match) => match.round === game.round && !match.played)
  const leagueDate = leagueMatches
    .map((match) => match.scheduledAt)
    .filter((date): date is string => Boolean(date))
    .sort()[0]
    ?? getLocalDateKey(getLeagueRoundDate(
      game.season,
      game.round,
      getLeagueTier(game.leagueId),
      getSeasonRoundCount(game),
      getGameMatchupsPerOpponent(game),
    ))
  const pendingCupMatches = [
    ...(game.polishCup?.stage === 'complete' ? [] : game.polishCup?.matches ?? []),
    ...(game.regionalCups ?? []).flatMap((cup) => cup.matches),
  ]
    .filter((match) => !match.played)
  const cupDates = pendingCupMatches
    .filter((match) => game.round > getSeasonRoundCount(game) || match.homeId === game.teamId || match.awayId === game.teamId)
    .map((match) => match.scheduledAt)
    .filter((date): date is string => Boolean(date))
    .sort()
  const nextCupDate = cupDates[0]
  const playoffDate = game.promotionPlayoffs?.fixtures
    .filter((fixture) => !fixture.played)
    .map((fixture) => fixture.scheduledAt)
    .sort()[0]
  const friendlyDate = getNextFriendlyMatch(game)?.scheduledAt
  const championsCupDate = game.championsCupMatch
    && !game.championsCupMatch.played
    && (game.championsCupMatch.homeId === game.teamId || game.championsCupMatch.awayId === game.teamId)
    ? game.championsCupMatch.scheduledAt
    : undefined
  const pmpLeagueDate = game.pmpLeague?.matches
    .filter((match) => !match.played)
    .map((match) => match.scheduledAt)
    .filter((date): date is string => Boolean(date))
    .sort()[0]
  const officialDates = [leagueDate, nextCupDate, playoffDate, championsCupDate]
    .filter((date): date is string => Boolean(date))
    .sort()
  if (friendlyDate && (!officialDates[0] || friendlyDate <= officialDates[0])) return 'friendly'
  if (championsCupDate && championsCupDate <= officialDates[0]) return 'champions-cup'
  if (pmpLeagueDate && pmpLeagueDate <= officialDates[0]) return 'pmp-league'
  if (nextCupDate && (!playoffDate || nextCupDate <= playoffDate)
    && (game.round > getSeasonRoundCount(game) || nextCupDate <= leagueDate)) return 'polish-cup'
  if (playoffDate && game.round > getSeasonRoundCount(game) && (!nextCupDate || playoffDate <= nextCupDate)) return 'promotion-playoff'
  if (game.round <= getSeasonRoundCount(game)) return 'league'
  if (nextCupDate) return 'polish-cup'
  if (playoffDate) return 'promotion-playoff'
  return 'season-complete'
}

export function getNextFriendlyMatch(game: GameState) {
  return game.preseasonFriendlies
    ?.filter((match) => !match.played)
    .sort((first, second) =>
      (first.scheduledAt ?? '').localeCompare(second.scheduledAt ?? '')
      || (first.kickoffTime ?? '').localeCompare(second.kickoffTime ?? ''),
    )[0]
}

export function playFriendlyMatch(game: GameState, friendlyId: string, preservedResult?: Pick<FriendlyMatch, 'homeGoals' | 'awayGoals'>) {
  const friendly = game.preseasonFriendlies?.find((match) => match.id === friendlyId && !match.played)
  if (!friendly) return { game, error: 'Nie znaleziono aktywnego sparingu.' }
  const isHome = friendly.homeId === game.teamId
  const opponentId = isHome ? friendly.awayId : friendly.homeId
  const opponent = game.polishCup?.teams.find((team) => team.id === opponentId)
    ?? game.regionalCups?.flatMap((cup) => cup.teams).find((team) => team.id === opponentId)
    ?? game.teams.find((team) => team.id === opponentId)
  if (!opponent) return { game, error: 'Nie udało się odnaleźć drużyny przeciwnej w terminarzu sparingów.' }
  const lineup = game.matchLineupIds
    .map((id) => game.squad.find((player) => player.id === id))
    .filter((player): player is Player => Boolean(player))
  if (lineup.length !== 11) return { game, error: 'Wybierz dokładnie 11 zawodników do pierwszego składu przed sparingiem.' }
  if (lineup.some((player) => getInjuryMatches(player) > 0)) {
    return { game, error: 'W pierwszym składzie znajduje się kontuzjowany zawodnik.' }
  }

  const next = structuredClone(game)
  const match = next.preseasonFriendlies?.find((fixture) => fixture.id === friendlyId)
  if (!match) return { game, error: 'Nie znaleziono aktywnego sparingu.' }
  const preparation = next.pendingMatchPreparation?.matchId === match.id ? next.pendingMatchPreparation.choice : undefined
  if (preparation === 'recovery') next.squad.forEach((player) => { player.stamina = Math.min(100, player.stamina + 6) })
  const conference = next.pendingMatchConference?.matchId === match.id ? next.pendingMatchConference.choice : undefined
  if (conference === 'protective') next.squad.filter((player) => game.matchLineupIds.includes(player.id)).forEach((player) => { player.stamina = Math.min(100, player.stamina + 3) })
  const localDerby = isLocalDerby(next, opponent.name)
  const userStrength = matchLineupRating(next, next.matchLineupIds, match.id) + (preparation === 'tactical' ? 3 : preparation === 'motivation' ? 1 : 0) + (localDerby ? 3 : 0)
  const userGoals = preservedResult
    ? isHome ? preservedResult.homeGoals ?? 0 : preservedResult.awayGoals ?? 0
    : rollGoals(userStrength + (isHome ? 4 : 0), opponent.strength)
  const opponentGoals = preservedResult
    ? isHome ? preservedResult.awayGoals ?? 0 : preservedResult.homeGoals ?? 0
    : rollGoals(opponent.strength + (isHome ? 0 : 4), userStrength)
  match.homeGoals = isHome ? userGoals : opponentGoals
  match.awayGoals = isHome ? opponentGoals : userGoals
  match.played = true
  if (match.scheduledAt && (!next.currentDate || match.scheduledAt > next.currentDate)) {
    next.currentDate = match.scheduledAt
  }
  next.squad.forEach((player) => {
    if (game.matchLineupIds.includes(player.id)) {
      player.stamina = Math.max(35, player.stamina - 7)
      player.morale = Math.max(20, Math.min(100, player.morale + (userGoals > opponentGoals ? 2 : userGoals === opponentGoals ? 1 : -1) + (preparation === 'motivation' ? 2 : 0) + (localDerby ? userGoals > opponentGoals ? 2 : userGoals < opponentGoals ? -2 : 0 : 0)))
    } else {
      player.stamina = Math.min(100, player.stamina + 5)
    }
  })
  const summary = `${getTeamName(next, match.homeId)} ${match.homeGoals} : ${match.awayGoals} ${getTeamName(next, match.awayId)}.`
  if (localDerby) next.followers += 250
  adjustTeamChemistry(next, game.matchLineupIds, userGoals > opponentGoals ? 2 : userGoals === opponentGoals ? 1 : -1)
  if (next.pendingMatchPreparation?.matchId === match.id) next.pendingMatchPreparation = undefined
  if (next.pendingMatchConference?.matchId === match.id) next.pendingMatchConference = undefined
  addMediaPost(next, 'MECZ', `${summary} · Sparing`, `Zakończył się mecz towarzyski przed sezonem ${next.season}.${localDerby ? ' Lokalne derby przyciągnęły dodatkowe zainteresowanie.' : ''} Wynik nie wpływa na tabelę ligi ani Polskiego Pucharu.`)
  return { game: next, error: '', summary }
}

export function playChampionsCupMatch(
  game: GameState,
  preservedResult?: Pick<ChampionsCupMatch, 'homeGoals' | 'awayGoals' | 'winnerId' | 'penaltyScore'>,
) {
  const fixture = game.championsCupMatch
  if (!fixture || fixture.played || (fixture.homeId !== game.teamId && fixture.awayId !== game.teamId)) {
    return { game, error: 'Nie znaleziono aktywnego meczu Pucharu Mistrzów.' }
  }
  const lineup = game.matchLineupIds
    .map((id) => game.squad.find((player) => player.id === id))
    .filter((player): player is Player => Boolean(player))
  if (lineup.length !== 11) return { game, error: 'Wybierz dokładnie 11 zawodników do pierwszego składu przed meczem.' }
  if (lineup.some((player) => getInjuryMatches(player) > 0)) {
    return { game, error: 'W pierwszym składzie znajduje się kontuzjowany zawodnik.' }
  }

  const isHome = fixture.homeId === game.teamId
  const opponentId = isHome ? fixture.awayId : fixture.homeId
  const opponent = Object.values(game.leagueWorld ?? {}).flat().find((team) => team.id === opponentId)
    ?? game.polishCup?.teams.find((team) => team.id === opponentId)
  if (!opponent) return { game, error: 'Nie udało się odnaleźć przeciwnika w Pucharze Mistrzów.' }

  const next = structuredClone(game)
  const match = next.championsCupMatch
  if (!match) return { game, error: 'Nie znaleziono aktywnego meczu Pucharu Mistrzów.' }
  const preparation = next.pendingMatchPreparation?.matchId === match.id ? next.pendingMatchPreparation.choice : undefined
  const conference = next.pendingMatchConference?.matchId === match.id ? next.pendingMatchConference.choice : undefined
  const userStrength = matchLineupRating(next, next.matchLineupIds, match.id)
    + (preparation === 'tactical' ? 3 : preparation === 'motivation' ? 1 : 0)
  const userGoals = preservedResult
    ? isHome ? preservedResult.homeGoals ?? 0 : preservedResult.awayGoals ?? 0
    : rollGoals(userStrength + (isHome ? 4 : 0), opponent.strength)
  const opponentGoals = preservedResult
    ? isHome ? preservedResult.awayGoals ?? 0 : preservedResult.homeGoals ?? 0
    : rollGoals(opponent.strength + (isHome ? 0 : 4), userStrength)
  match.homeGoals = isHome ? userGoals : opponentGoals
  match.awayGoals = isHome ? opponentGoals : userGoals
  if (preservedResult?.winnerId) {
    match.winnerId = preservedResult.winnerId
    match.penaltyScore = preservedResult.penaltyScore
  } else if (match.homeGoals === match.awayGoals) {
    const homeWins = Math.random() < 0.5
    match.winnerId = homeWins ? match.homeId : match.awayId
    match.penaltyScore = homeWins ? '4:3' : '3:4'
  } else {
    match.winnerId = (match.homeGoals ?? 0) > (match.awayGoals ?? 0) ? match.homeId : match.awayId
  }
  if (match.winnerId === next.teamId) {
    addClubTrophy(next, {
      id: `champions-cup-${match.season}`,
      competition: 'champions-cup',
      name: 'Puchar Mistrzów',
      season: match.season,
    })
  }
  match.played = true
  if (match.scheduledAt && (!next.currentDate || match.scheduledAt > next.currentDate)) next.currentDate = match.scheduledAt
  next.squad.forEach((player) => {
    if (game.matchLineupIds.includes(player.id)) {
      player.stamina = Math.max(35, player.stamina - (conference === 'protective' ? 4 : 7))
      player.morale = Math.max(20, Math.min(100, player.morale + (userGoals > opponentGoals ? 2 : userGoals === opponentGoals ? 1 : -1)))
      player.seasonAppearances = (player.seasonAppearances ?? 0) + 1
    } else {
      player.stamina = Math.min(100, player.stamina + 5)
    }
  })
  adjustTeamChemistry(next, game.matchLineupIds, userGoals > opponentGoals ? 2 : userGoals === opponentGoals ? 1 : -1)
  if (next.pendingMatchPreparation?.matchId === match.id) next.pendingMatchPreparation = undefined
  if (next.pendingMatchConference?.matchId === match.id) next.pendingMatchConference = undefined
  const summary = `${getTeamName(next, match.homeId)} ${match.homeGoals} : ${match.awayGoals} ${getTeamName(next, match.awayId)}.`
  next.lastMatchReport = null
  addMediaPost(next, 'MECZ', `${summary} · Puchar Mistrzów`, `Mecz o Puchar Mistrzów otwiera sezon ${next.season}.`)
  return { game: next, error: '', summary, completedMatch: match, penaltyScore: match.penaltyScore }
}

export function isPolishCupDrawPublished(game: Pick<GameState, 'season' | 'currentDate' | 'polishCup'>) {
  const drawAt = game.polishCup?.drawAt
  if (!drawAt) return true
  const currentDate = game.currentDate ?? `${game.season.split('/')[0]}-07-01`
  return currentDate >= drawAt
}

export function playPromotionPlayoffRound(
  game: GameState,
  preservedResults?: ReadonlyMap<string, PromotionPlayoffFixture>,
) {
  const next = structuredClone(game)
  const playoffs = next.promotionPlayoffs
  if (!playoffs || playoffs.round === 'complete') return { game, error: 'Nie znaleziono nierozstrzygniętych baraży o awans.' }
  const roundFixtures = playoffs.fixtures.filter((fixture) => fixture.round === playoffs.round && !fixture.played)
  if (!roundFixtures.length) return { game, error: 'Nie znaleziono spotkań w bieżącej fazie baraży.' }
  next.currentDate = roundFixtures.map((fixture) => fixture.scheduledAt).sort()[0]
  const world = next.leagueWorld ?? {}
  const findTeam = (teamId: string) => Object.values(world).flat().find((team) => team.id === teamId)
  const userFixture = roundFixtures.find((fixture) => fixture.homeId === next.teamId || fixture.awayId === next.teamId)
  const preparation = userFixture && next.pendingMatchPreparation?.matchId === userFixture.id
    ? next.pendingMatchPreparation.choice
    : undefined
  const conference = userFixture ? getMatchConferenceChoice(next, userFixture.id) : undefined
  const userOpponent = userFixture
    ? findTeam(userFixture.homeId === next.teamId ? userFixture.awayId : userFixture.homeId)
    : undefined
  const localDerby = Boolean(userOpponent && isLocalDerby(next, userOpponent.name))
  if (preparation === 'recovery') next.squad.forEach((player) => { player.stamina = Math.min(100, player.stamina + 6) })
  if (userFixture) applyConferenceRecovery(next, userFixture.id, next.matchLineupIds)
  if (preparation === 'motivation') next.squad.forEach((player) => { player.morale = Math.min(100, player.morale + 2) })
  for (const fixture of roundFixtures) {
    const home = findTeam(fixture.homeId)
    const away = findTeam(fixture.awayId)
    if (!home || !away) return { game, error: `Nie odnaleziono klubu w barażu ${fixture.id}.` }
    const userBonus = fixture.id === userFixture?.id
      ? (preparation === 'tactical' ? 3 : preparation === 'motivation' ? 1 : 0) + getMatchConferenceBonus(next, fixture.id) + (localDerby ? 3 : 0)
      : 0
    const homeStrength = home.strength + (fixture.homeId === next.teamId ? userBonus : 0)
    const awayStrength = away.strength + (fixture.awayId === next.teamId ? userBonus : 0)
    const preservedResult = preservedResults?.get(fixture.id)
    fixture.homeGoals = preservedResult?.homeGoals ?? rollGoals(homeStrength + 3, awayStrength)
    fixture.awayGoals = preservedResult?.awayGoals ?? rollGoals(awayStrength + 1, homeStrength)
    fixture.winnerId = preservedResult?.winnerId ?? (fixture.homeGoals === fixture.awayGoals
      ? Math.random() < homeStrength / (homeStrength + awayStrength) ? home.id : away.id
      : fixture.homeGoals > fixture.awayGoals ? home.id : away.id)
    if (
      fixture.round === 2
      && (fixture.competitionId === 'playoff:opolskie-fourth'
        || fixture.competitionId === 'playoff:opolskie-okr-survival')
    ) {
      const firstLeg = playoffs.history.find((entry) =>
        entry.competitionId === fixture.competitionId
        && entry.round === 1
        && entry.played,
      )
      if (!firstLeg) return { game, error: `Nie znaleziono pierwszego meczu barażu ${fixture.id}.` }
      const aggregateHome = (firstLeg.awayGoals ?? 0) + fixture.homeGoals
      const aggregateAway = (firstLeg.homeGoals ?? 0) + fixture.awayGoals
      fixture.winnerId = aggregateHome === aggregateAway
        ? Math.random() < home.strength / (home.strength + away.strength) ? home.id : away.id
        : aggregateHome > aggregateAway ? home.id : away.id
    }
    fixture.played = true
    if (fixture.id === userFixture?.id) {
      const won = fixture.winnerId === next.teamId
      next.squad.forEach((player) => {
        player.morale = Math.max(20, Math.min(100, player.morale + (won ? 5 : -5) + (preparation === 'motivation' ? 2 : 0) + (localDerby ? won ? 2 : -2 : 0)))
        if (next.matchLineupIds.includes(player.id)) player.stamina = Math.max(30, player.stamina - (preparation === 'recovery' ? 5 : 8) - (conference === 'protective' ? 2 : 0))
      })
      adjustTeamChemistry(next, next.matchLineupIds, won ? 2 : -1)
      if (next.pendingMatchPreparation?.matchId === fixture.id) next.pendingMatchPreparation = undefined
      if (next.pendingMatchConference?.matchId === fixture.id) next.pendingMatchConference = undefined
    }
    playoffs.history.push({ ...fixture })
  }
  const resultLines = roundFixtures.map((fixture) => {
    const home = findTeam(fixture.homeId)
    const away = findTeam(fixture.awayId)
    const winner = fixture.winnerId ? findTeam(fixture.winnerId) : undefined
    const outcome = fixture.round === 1
      && (fixture.competitionId === 'playoff:opolskie-fourth'
        || fixture.competitionId === 'playoff:opolskie-okr-survival')
      ? 'wynik pierwszego meczu'
      : fixture.competitionId === 'playoff:opolskie-okr-survival'
        ? `utrzymanie zapewnia ${winner?.name ?? fixture.winnerId}`
        : `awansuje: ${winner?.name ?? fixture.winnerId}`
    return `${fixture.leagueName} · ${home?.name ?? fixture.homeId} ${fixture.homeGoals}:${fixture.awayGoals} ${away?.name ?? fixture.awayId} · ${outcome}`
  })
  if (playoffs.round === 1) {
    const finalSunday = new Date(Math.max(...roundFixtures.map((fixture) => parseLocalDateKey(fixture.scheduledAt).getTime())))
    finalSunday.setDate(finalSunday.getDate() + 7)
    const finalFixtures: PromotionPlayoffFixture[] = []
    const competitionIds = [...new Set(roundFixtures.map((fixture) => fixture.competitionId ?? fixture.leagueId))]
    for (const competitionId of competitionIds) {
      if (
        competitionId === 'playoff:opolskie-fourth'
        || competitionId === 'playoff:opolskie-okr-survival'
      ) {
        const firstLeg = roundFixtures.find((fixture) =>
          fixture.competitionId === competitionId,
        )
        if (!firstLeg) return { game, error: `Nie znaleziono pierwszego meczu barażu ${competitionId}.` }
        finalFixtures.push({
          id: `promotion-playoff-${competitionId}-return-${playoffs.season}`,
          leagueId: firstLeg.leagueId,
          competitionId,
          leagueName: firstLeg.leagueName,
          round: 2,
          homeId: firstLeg.awayId,
          awayId: firstLeg.homeId,
          scheduledAt: getLocalDateKey(finalSunday),
          kickoffTime: '16:00',
          played: false,
        })
        continue
      }
      const semifinals = playoffs.history.filter((fixture) =>
        (fixture.competitionId ?? fixture.leagueId) === competitionId && fixture.round === 1,
      )
      const finalists = semifinals
        .map((fixture) => fixture.winnerId ? findTeam(fixture.winnerId) : undefined)
        .filter((team): team is Team => Boolean(team))
      const byeTeamId = playoffs.byeTeamIds?.[competitionId]
      const byeTeam = byeTeamId ? findTeam(byeTeamId) : undefined
      if (byeTeam && !finalists.some((team) => team.id === byeTeam.id)) finalists.push(byeTeam)
      if (finalists.length !== 2) {
        return { game, error: `Nie udało się ustalić finalistów baraży: ${competitionId}.` }
      }
      const competitionFixture = roundFixtures.find((fixture) =>
        (fixture.competitionId ?? fixture.leagueId) === competitionId,
      )
      if (!competitionFixture) return { game, error: `Nie znaleziono terminarza baraży: ${competitionId}.` }
      const firstFinalistLeagueId = Object.entries(world)
        .find(([, teams]) => teams.some((team) => team.id === finalists[0].id))?.[0]
      if (!firstFinalistLeagueId) return { game, error: `Nie odnaleziono klubu ${finalists[0].name} w ligach.` }
      finalFixtures.push({
        id: `promotion-playoff-${competitionId}-final-${playoffs.season}`,
        leagueId: firstFinalistLeagueId,
        competitionId,
        leagueName: competitionFixture.leagueName,
        round: 2,
        homeId: finalists[0].id,
        awayId: finalists[1].id,
        scheduledAt: getLocalDateKey(finalSunday),
        kickoffTime: '16:00',
        played: false,
      })
    }
    playoffs.fixtures.push(...finalFixtures)
    playoffs.round = 2
    const finalLines = playoffs.fixtures.filter((fixture) => fixture.round === 2).map((fixture) => {
      const home = findTeam(fixture.homeId)
      const away = findTeam(fixture.awayId)
      const stage = fixture.competitionId === 'playoff:opolskie-fourth'
        || fixture.competitionId === 'playoff:opolskie-okr-survival'
        ? 'rewanż'
        : 'finał'
      return `${fixture.leagueName} · ${stage} · niedziela, ${new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long' }).format(parseLocalDateKey(fixture.scheduledAt))}, godz. ${fixture.kickoffTime} · ${home?.name ?? fixture.homeId} – ${away?.name ?? fixture.awayId}`
    })
    addInboxMessage(
      next,
      'Biuro rozgrywek ligowych',
      `Półfinały baraży · wyniki i finały · ${playoffs.season}`,
      `Wyniki półfinałów:\n${resultLines.join('\n')}\n\nTerminy finałów:\n${finalLines.join('\n')}`,
      'info',
      'club',
    )
  } else {
    for (const fixture of roundFixtures) {
      if (fixture.winnerId) playoffs.promotedByLeague[fixture.competitionId ?? fixture.leagueId] = fixture.winnerId
    }
    playoffs.round = 'complete'
    const promotionLines = roundFixtures.map((fixture) => {
      const winner = fixture.winnerId ? findTeam(fixture.winnerId) : undefined
      const home = findTeam(fixture.homeId)
      const away = findTeam(fixture.awayId)
      const outcome = fixture.competitionId === 'playoff:opolskie-okr-survival'
        ? `utrzymanie w klasie okręgowej: ${winner?.name ?? fixture.winnerId}`
        : `awans do wyższej ligi: ${winner?.name ?? fixture.winnerId}`
      return `${fixture.leagueName} · ${home?.name ?? fixture.homeId} ${fixture.homeGoals}:${fixture.awayGoals} ${away?.name ?? fixture.awayId} · ${outcome}`
    })
    const resultDate = parseLocalDateKey(getLocalDateKey(finalSundayAfter(roundFixtures)))
    resultDate.setDate(resultDate.getDate() + 1)
    next.currentDate = getLocalDateKey(resultDate)
    addInboxMessage(
      next,
      'Biuro rozgrywek ligowych',
      `Wyniki baraży · ${playoffs.season}`,
      `Rozstrzygnięcia baraży:\n${promotionLines.join('\n')}\n\nWyniki zostaną uwzględnione przy ustalaniu składów lig w nowym sezonie.`,
      'info',
      'club',
    )
  }
  return { game: next, error: '', summary: resultLines.join('\n') }
}

function finalSundayAfter(fixtures: PromotionPlayoffFixture[]) {
  const date = new Date(Math.max(...fixtures.map((fixture) => parseLocalDateKey(fixture.scheduledAt).getTime())))
  date.setDate(date.getDate() + 7)
  return date
}

function getPolishCupTeam(cup: PolishCup, teamId: string) {
  const team = cup.teams.find((candidate) => candidate.id === teamId)
  if (!team) throw new Error(`Nie znaleziono klubu ${teamId} w Polskim Pucharze.`)
  return team
}

function normalizeMatchTimelinePeriod(event: MatchTimelineEvent, extraTimePlayed = false): MatchTimelineEvent {
  const period = event.period ?? (
    extraTimePlayed && event.minute > 105
      ? 'extra-time-second-half'
      : extraTimePlayed && event.minute > 90
        ? 'extra-time-first-half'
        : event.minute <= 45
          ? 'first-half'
          : 'second-half'
  )
  return { ...event, period }
}

function completeCupMatch(
  match: Match & { winnerId?: string; penaltyScore?: string },
  home: PolishCupTeam,
  away: PolishCupTeam,
  homeStrength: number,
  awayStrength: number,
  preservedResult: {
    homeGoals?: number
    awayGoals?: number
    winnerId?: string
    penaltyScore?: string
    timeline?: MatchTimelineEvent[]
    extraTimePlayed?: boolean
    extraTimeHomeGoals?: number
    extraTimeAwayGoals?: number
    penaltyShootoutEvents?: MatchPenaltyEvent[]
  } | undefined,
  homeLineup: Player[],
  awayLineup: Player[],
) {
  if (preservedResult?.winnerId) {
    const preservedTimeline = preservedResult.timeline?.map((event) =>
      normalizeMatchTimelinePeriod(event, preservedResult.extraTimePlayed),
    )
    match.winnerId = preservedResult.winnerId
    match.penaltyScore = preservedResult.penaltyScore
    match.extraTimePlayed = preservedResult.extraTimePlayed
    match.extraTimeHomeGoals = preservedResult.extraTimeHomeGoals
    match.extraTimeAwayGoals = preservedResult.extraTimeAwayGoals
    match.penaltyShootoutEvents = preservedResult.penaltyShootoutEvents
      ? structuredClone(preservedResult.penaltyShootoutEvents)
      : undefined
    match.timeline = preservedTimeline ? structuredClone(preservedTimeline) : undefined
    return preservedTimeline?.map(({ minute, addedTime, period, type, teamId }) => ({
      minute,
      addedTime,
      period,
      type,
      teamId,
    })) ?? createMatchTimelinePlan(match.homeId, match.awayId, match.homeGoals ?? 0, match.awayGoals ?? 0)
  }

  let timelinePlan = createMatchTimelinePlan(match.homeId, match.awayId, match.homeGoals ?? 0, match.awayGoals ?? 0)
  if ((match.homeGoals ?? 0) === (match.awayGoals ?? 0)) {
    const extraTimePlan = createExtraTimeTimelinePlan(match.homeId, match.awayId, homeStrength, awayStrength)
    const extraTimeHomeGoals = extraTimePlan.filter((event) => event.teamId === match.homeId).length
    const extraTimeAwayGoals = extraTimePlan.filter((event) => event.teamId === match.awayId).length
    match.extraTimePlayed = true
    match.extraTimeHomeGoals = extraTimeHomeGoals
    match.extraTimeAwayGoals = extraTimeAwayGoals
    match.homeGoals = (match.homeGoals ?? 0) + extraTimeHomeGoals
    match.awayGoals = (match.awayGoals ?? 0) + extraTimeAwayGoals
    timelinePlan = [...timelinePlan, ...extraTimePlan].sort((first, second) => first.minute - second.minute)

    if (match.homeGoals === match.awayGoals) {
      const penalties = resolvePolishCupPenalties(home, away, homeLineup, awayLineup)
      match.winnerId = penalties.winnerId
      match.penaltyScore = penalties.score
      match.penaltyShootoutEvents = penalties.events
    } else {
      match.winnerId = (match.homeGoals ?? 0) > (match.awayGoals ?? 0) ? home.id : away.id
      match.penaltyScore = undefined
      match.penaltyShootoutEvents = undefined
    }
  } else {
    match.winnerId = (match.homeGoals ?? 0) > (match.awayGoals ?? 0) ? home.id : away.id
    match.extraTimePlayed = false
    match.extraTimeHomeGoals = 0
    match.extraTimeAwayGoals = 0
    match.penaltyScore = undefined
    match.penaltyShootoutEvents = undefined
  }
  match.timeline = createMatchTimeline(
    timelinePlan,
    match.homeId,
    match.awayId,
    homeLineup,
    awayLineup,
    new Map(),
    new Map(),
  )
  return timelinePlan
}

function getPmpGroupStandings(tournament: PmpLeague, group: PmpLeagueGroup) {
  const rows = new Map(group.teamIds.map((teamId) => [teamId, {
    teamId,
    points: 0,
    goalsFor: 0,
    goalsAgainst: 0,
  }]))
  const fixtures = [...tournament.history, ...tournament.matches].filter((match) =>
    match.phase === 'groups' && match.groupId === group.id && match.played,
  )
  for (const match of fixtures) {
    if (match.bye) continue
    const home = rows.get(match.homeId)
    const away = rows.get(match.awayId)
    if (!home || !away) continue
    const homeGoals = match.homeGoals ?? 0
    const awayGoals = match.awayGoals ?? 0
    home.goalsFor += homeGoals
    home.goalsAgainst += awayGoals
    away.goalsFor += awayGoals
    away.goalsAgainst += homeGoals
    if (homeGoals > awayGoals) home.points += 3
    else if (awayGoals > homeGoals) away.points += 3
    else {
      home.points += 1
      away.points += 1
    }
  }
  return [...rows.values()].sort((first, second) =>
    second.points - first.points
    || (second.goalsFor - second.goalsAgainst) - (first.goalsFor - first.goalsAgainst)
    || second.goalsFor - first.goalsFor
    || (tournament.teams.find((team) => team.id === first.teamId)?.name ?? first.teamId)
      .localeCompare(tournament.teams.find((team) => team.id === second.teamId)?.name ?? second.teamId, 'pl'),
  )
}

function advancePmpLeague(tournament: PmpLeague) {
  const season = tournament.season
  if (tournament.phase === 'groups') {
    const regionalTeams = new Map<string, string[]>()
    for (const group of tournament.groups) {
      const topTwo = getPmpGroupStandings(tournament, group).slice(0, 2).map((row) => row.teamId)
      const teams = regionalTeams.get(group.regionId) ?? []
      teams.push(...topTwo)
      regionalTeams.set(group.regionId, teams)
    }
    tournament.history.push(...tournament.matches.map((match) => ({ ...match })))
    tournament.phase = 'regional-quarterfinal'
    tournament.matches = [...regionalTeams.entries()].flatMap(([regionId, teamIds]) =>
      createPmpKnockoutMatches('regional-quarterfinal', teamIds, season, 29, 7, regionId),
    )
    return
  }
  tournament.history.push(...tournament.matches.map((match) => ({ ...match })))
  if (tournament.phase === 'regional-quarterfinal' || tournament.phase === 'regional-semifinal') {
    const nextPhase = tournament.phase === 'regional-quarterfinal' ? 'regional-semifinal' : 'regional-final'
    const nextRound = tournament.phase === 'regional-quarterfinal' ? 8 : 9
    const nextDateOffset = tournament.phase === 'regional-quarterfinal' ? 33 : 37
    const regionalWinners = new Map<string, string[]>()
    for (const match of tournament.history.filter((fixture) => fixture.phase === tournament.phase)) {
      if (!match.winnerId || !match.regionId) continue
      const winners = regionalWinners.get(match.regionId) ?? []
      winners.push(match.winnerId)
      regionalWinners.set(match.regionId, winners)
    }
    tournament.phase = nextPhase
    tournament.matches = [...regionalWinners.entries()].flatMap(([regionId, teamIds]) =>
      createPmpKnockoutMatches(nextPhase, teamIds, season, nextDateOffset, nextRound, regionId),
    )
    return
  }
  if (tournament.phase === 'regional-final') {
    for (const match of tournament.history.filter((fixture) => fixture.phase === 'regional-final')) {
      if (match.regionId && match.winnerId) tournament.regionalChampions[match.regionId] = match.winnerId
    }
    const champions = Object.values(tournament.regionalChampions)
    if (champions.length < 2) {
      tournament.nationalChampionId = champions[0]
      tournament.phase = 'complete'
      tournament.matches = []
      return
    }
    tournament.phase = 'national-first-round'
    tournament.matches = createPmpKnockoutMatches('national-first-round', champions, season, 43, 10, undefined, 4)
    return
  }
  if (tournament.phase === 'national-first-round') {
    const winners = tournament.matches.flatMap((match) =>
      match.winnerId ? [match.winnerId] : [],
    )
    tournament.phase = 'national-semifinal'
    tournament.matches = createPmpKnockoutMatches('national-semifinal', winners, season, 47, 11)
    return
  }
  if (tournament.phase === 'national-semifinal') {
    const winners = tournament.history
      .filter((match) => match.phase === 'national-semifinal' && match.winnerId)
      .map((match) => match.winnerId as string)
    tournament.phase = 'national-final'
    tournament.matches = createPmpKnockoutMatches('national-final', winners, season, 51, 12)
    return
  }
  if (tournament.phase === 'national-final') {
    tournament.nationalChampionId = tournament.history
      .find((match) => match.phase === 'national-final')?.winnerId
    tournament.phase = 'complete'
    tournament.matches = []
  }
}

export function getPmpLeagueNextMatch(game: GameState) {
  const tournament = game.pmpLeague
  return tournament?.matches
    .filter((match) => !match.played)
    .filter((match) => !match.bye && Boolean(match.scheduledAt) && (match.homeId === game.teamId || match.awayId === game.teamId))
    .sort((first, second) => (first.scheduledAt ?? '').localeCompare(second.scheduledAt ?? ''))[0]
}

export function playPmpLeagueEvent(
  game: GameState,
  preservedResults?: ReadonlyMap<string, PmpLeagueMatch>,
) {
  const tournament = game.pmpLeague
  if (!tournament || tournament.phase === 'complete') {
    return { game, error: 'Liga PMP nie ma zaplanowanych spotkań.' }
  }
  const eventDate = tournament.matches
    .filter((match) => !match.played)
    .map((match) => match.scheduledAt)
    .filter((date): date is string => Boolean(date))
    .sort()[0]
  if (!eventDate) return { game, error: 'Nie znaleziono terminu kolejnego meczu Ligi PMP.' }
  const next = structuredClone(game)
  const activeTournament = next.pmpLeague
  if (!activeTournament) throw new Error('Nie udało się wczytać Ligi PMP.')
  const eventMatches = activeTournament.matches.filter((match) =>
    !match.played && match.scheduledAt === eventDate,
  )
  const clubMatch = eventMatches.find((match) => !match.bye
    && (match.homeId === next.teamId || match.awayId === next.teamId))
  next.currentDate = eventDate
  for (const match of eventMatches) {
    if (match.bye) continue
    const home = activeTournament.teams.find((team) => team.id === match.homeId)
    const away = activeTournament.teams.find((team) => team.id === match.awayId)
    if (!home || !away) return { game, error: `Brak uczestnika meczu Ligi PMP ${match.id}.` }
    const preservedResult = preservedResults?.get(match.id)
    match.homeGoals = preservedResult?.homeGoals ?? rollGoals(home.strength + 3, away.strength)
    match.awayGoals = preservedResult?.awayGoals ?? rollGoals(away.strength + 1, home.strength)
    if (match.phase === 'groups') {
      match.played = true
      match.timeline = createMatchTimeline(
        createMatchTimelinePlan(match.homeId, match.awayId, match.homeGoals, match.awayGoals),
        match.homeId,
        match.awayId,
        [],
        [],
        new Map(),
        new Map(),
      )
    } else {
      completeCupMatch(match, home, away, home.strength + 3, away.strength, preservedResult, [], [])
      match.played = true
    }
    if (match.homeId === next.teamId || match.awayId === next.teamId) {
      const clubWon = match.winnerId === next.teamId
        || match.phase === 'groups' && (
          match.homeId === next.teamId
            ? (match.homeGoals ?? 0) > (match.awayGoals ?? 0)
            : (match.awayGoals ?? 0) > (match.homeGoals ?? 0)
        )
      const homeClub = match.homeId === next.teamId
      const attendance = homeClub
        ? Math.round(next.stadiumCapacity * Math.max(0.25, Math.min(0.8, 0.3 + next.followers / 800_000)))
        : 0
      if (attendance > 0) {
        addFinance(next, 'Liga PMP · wpływy z biletów', Math.round(attendance * next.ticketPrice * (1 + next.facilities.catering * 0.1)))
        match.attendance = attendance
      }
      addFinance(next, 'Liga PMP · przychód meczowy', 35_000)
      if (match.phase === 'groups' && clubWon) addFinance(next, 'Liga PMP · premia za zwycięstwo', 20_000)
      next.squad.forEach((player) => {
        player.stamina = Math.max(30, player.stamina - (next.matchLineupIds.includes(player.id) ? 7 : 0))
        player.morale = Math.max(20, Math.min(100, player.morale + (clubWon ? 2 : -1)))
      })
    }
  }
  const completedClubMatch = clubMatch ? structuredClone(clubMatch) : undefined
  if (clubMatch) {
    const completedMatch = completedClubMatch
    if (!completedMatch) return { game, error: 'Nie udało się zapisać wyniku meczu Ligi PMP.' }
    const clubGoals = clubMatch.homeId === next.teamId ? clubMatch.homeGoals ?? 0 : clubMatch.awayGoals ?? 0
    const opponentGoals = clubMatch.homeId === next.teamId ? clubMatch.awayGoals ?? 0 : clubMatch.homeGoals ?? 0
    const clubWon = clubMatch.winnerId === next.teamId || (clubMatch.phase === 'groups' && clubGoals > opponentGoals)
    next.lastMatchReport = {
      matchId: completedMatch.id,
      round: completedMatch.round,
      score: `${completedMatch.homeGoals} : ${completedMatch.awayGoals}${completedMatch.penaltyScore ? ` · karne ${completedMatch.penaltyScore}` : ''}`,
      outcome: clubGoals > opponentGoals ? 'win' : clubGoals === opponentGoals ? 'draw' : 'loss',
      headline: 'Liga PMP',
      summary: `${getTeamName(next, completedMatch.homeId)} ${completedMatch.homeGoals} : ${completedMatch.awayGoals} ${getTeamName(next, completedMatch.awayId)}${completedMatch.penaltyScore ? ` · karne ${completedMatch.penaltyScore}` : ''}.`,
      tacticalNote: 'Zimowy turniej regionalny Liga PMP.',
    }
    addMediaPost(next, 'MECZ', `Liga PMP · ${next.lastMatchReport.score}`, next.lastMatchReport.summary)
    if (clubWon && clubMatch.phase !== 'groups') {
      const prize = clubMatch.phase === 'regional-final' ? 250_000
        : clubMatch.phase === 'national-final' ? 750_000
          : clubMatch.phase === 'national-semifinal' ? 120_000
            : 60_000
      addFinance(next, `Liga PMP · premia za awans`, prize)
    }
  }
  if (activeTournament.matches.every((match) => match.played)) advancePmpLeague(activeTournament)
  return {
    game: next,
    error: '',
    summary: clubMatch && next.lastMatchReport ? next.lastMatchReport.summary : 'Rozegrano mecze Ligi PMP.',
    completedMatch: completedClubMatch,
  }
}

function resolvePolishCupPenalties(
  home: PolishCupTeam,
  away: PolishCupTeam,
  homeLineup: Player[] = [],
  awayLineup: Player[] = [],
) {
  const homeChance = Math.max(0.55, Math.min(0.88, 0.72 + (home.strength - 60) * 0.002))
  const awayChance = Math.max(0.55, Math.min(0.88, 0.72 + (away.strength - 60) * 0.002))
  let homeGoals = 0
  let awayGoals = 0
  const events: MatchPenaltyEvent[] = []
  const takeKick = (teamId: string, lineup: Player[], order: number, chance: number) => {
    const players = lineup.filter((player) => ['OP', 'PP', 'LP', 'PN', 'LN', 'ŚN'].includes(player.position))
    const kicker = (players.length ? players : lineup)[(order - 1) % Math.max(1, players.length || lineup.length)]
    const scored = Math.random() < chance
    events.push({
      order,
      teamId,
      playerId: kicker?.id,
      playerName: kicker ? `${kicker.firstName} ${kicker.lastName}` : undefined,
      scored,
    })
    return scored
  }
  for (let kick = 0; kick < 5; kick += 1) {
    if (takeKick(home.id, homeLineup, kick + 1, homeChance)) homeGoals += 1
    if (takeKick(away.id, awayLineup, kick + 1, awayChance)) awayGoals += 1
  }
  let suddenDeathKicks = 0
  while (homeGoals === awayGoals && suddenDeathKicks < 10) {
    const order = 6 + suddenDeathKicks
    if (takeKick(home.id, homeLineup, order, homeChance)) homeGoals += 1
    if (takeKick(away.id, awayLineup, order, awayChance)) awayGoals += 1
    suddenDeathKicks += 1
  }
  if (homeGoals === awayGoals) {
    const order = 6 + suddenDeathKicks
    const winnerIsHome = Math.random() < homeChance / (homeChance + awayChance)
    const homeKicker = homeLineup[(order - 1) % Math.max(1, homeLineup.length)]
    const awayKicker = awayLineup[(order - 1) % Math.max(1, awayLineup.length)]
    events.push(
      { order, teamId: home.id, playerId: homeKicker?.id, playerName: homeKicker ? `${homeKicker.firstName} ${homeKicker.lastName}` : undefined, scored: winnerIsHome },
      { order, teamId: away.id, playerId: awayKicker?.id, playerName: awayKicker ? `${awayKicker.firstName} ${awayKicker.lastName}` : undefined, scored: !winnerIsHome },
    )
    if (winnerIsHome) homeGoals += 1
    else awayGoals += 1
  }
  return {
    winnerId: homeGoals > awayGoals ? home.id : away.id,
    score: `${homeGoals}:${awayGoals}`,
    events,
  }
}

const regionalCupStageOrder: PolishCupScheduleStage[] = [
  'regional-first',
  'regional-second',
  'regional-third',
  'regional-quarterfinal',
  'regional-semifinal',
  'regional-final',
]

function nextRegionalCupStage(stage: PolishCupScheduleStage) {
  const index = regionalCupStageOrder.indexOf(stage)
  return regionalCupStageOrder[index + 1]
}

function advanceRegionalCupSeason(cup: RegionalCup, season: string, protectedTeamId?: string) {
  const winners = cup.matches.map((match) => match.winnerId).filter((id): id is string => Boolean(id))
  cup.history.push(...cup.matches.map((match) => ({ ...match })))
  const nextStage = nextRegionalCupStage(cup.stageId)
  if (!nextStage) {
    if (winners.length > 1) {
      const round = Math.max(...cup.matches.map((match) => match.round)) + 1
      const scheduleRoundOffset = round - regionalCupStageOrder.indexOf(cup.stageId) - 1
      cup.participants = winners
      cup.matches = drawPolishCupMatches(
        winners,
        'regional',
        round,
        cup.regionId,
        undefined,
        cup.teams,
        cup.stageId,
        season,
        scheduleRoundOffset,
        protectedTeamId,
      )
      return
    }
    cup.championId = winners[0]
    cup.participants = winners
    cup.matches = []
    return
  }
  const entrantsTier = nextStage === 'regional-second' ? [5, 6]
    : nextStage === 'regional-third' ? [4]
      : []
  const newEntrants = cup.teams
    .filter((team) =>
      entrantsTier.includes(getLeagueTier(team.leagueId))
      && !cup.participants.includes(team.id),
    )
    .map((team) => team.id)
  const participants = [...new Set([...winners, ...newEntrants])]
  const round = regionalCupStageOrder.indexOf(nextStage) + 1
  cup.stageId = nextStage
  cup.participants = participants
  cup.matches = drawPolishCupMatches(
    participants,
    'regional',
    round,
    cup.regionId,
    undefined,
    cup.teams,
    nextStage,
    season,
    0,
    protectedTeamId,
  )
}

function playRegionalCupEvent(
  game: GameState,
  preservedResults?: ReadonlyMap<string, {
    homeGoals?: number
    awayGoals?: number
    winnerId?: string
    penaltyScore?: string
    timeline?: MatchTimelineEvent[]
    extraTimePlayed?: boolean
    extraTimeHomeGoals?: number
    extraTimeAwayGoals?: number
    penaltyShootoutEvents?: MatchPenaltyEvent[]
    disciplinaryEvents?: MatchCardEvent[]
  }>,
) {
  const next = structuredClone(game)
  const upcomingDates = (next.regionalCups ?? [])
    .flatMap((cup) => cup.matches)
    .filter((match) => !match.played)
    .map((match) => match.scheduledAt)
    .filter((date): date is string => Boolean(date))
    .sort()
  const eventDate = upcomingDates[0]
  if (!eventDate) return { game, error: 'Nie znaleziono kolejnego meczu regionalnego Polskiego Pucharu.' }
  next.currentDate = eventDate
  addPolishCupWeekMessage(next, eventDate)
  const dueCups = (next.regionalCups ?? []).filter((cup) =>
    cup.matches.some((match) => !match.played && match.scheduledAt === eventDate),
  )
  const userFixture = dueCups.flatMap((cup) => cup.matches).find((match) =>
    !match.played && match.scheduledAt === eventDate
    && !match.bye
    && (match.homeId === next.teamId || match.awayId === next.teamId),
  )
  const preparation = userFixture && next.pendingMatchPreparation?.matchId === userFixture.id
    ? next.pendingMatchPreparation.choice
    : undefined
  const conference = userFixture ? getMatchConferenceChoice(next, userFixture.id) : undefined
  const userOpponentId = userFixture
    ? userFixture.homeId === next.teamId ? userFixture.awayId : userFixture.homeId
    : ''
  const userOpponent = dueCups.flatMap((cup) => cup.teams).find((team) => team.id === userOpponentId)
  const localDerby = Boolean(userOpponent && isLocalDerby(next, userOpponent.name, 'regional-cup'))
  if (preparation === 'recovery') next.squad.forEach((player) => { player.stamina = Math.min(100, player.stamina + 6) })
  if (userFixture) applyConferenceRecovery(next, userFixture.id, next.matchLineupIds)
  if (game.sponsorRequired && dueCups.some((cup) => cup.matches.some((match) =>
    !match.played && !match.bye && match.scheduledAt === eventDate
    && (match.homeId === game.teamId || match.awayId === game.teamId),
  ))) {
    return { game, error: 'Przed pierwszym oficjalnym meczem sezonu podpisz umowę sponsorską w zakładce Finanse.' }
  }
  for (const cup of dueCups) {
    const scheduledMatches = cup.matches.filter((fixture) => !fixture.played && fixture.scheduledAt === eventDate)
    ensureClubSquadsForCupTeams(
      next,
      scheduledMatches.flatMap((match) => [match.homeId, match.awayId]),
      cup.teams,
    )
    for (const match of scheduledMatches) {
      if (match.bye) {
        match.played = true
        match.winnerId = match.homeId
        match.homeGoals = 0
        match.awayGoals = 0
        continue
      }
      const home = cup.teams.find((team) => team.id === match.homeId)
      const away = cup.teams.find((team) => team.id === match.awayId)
      if (!home || !away) return { game, error: `Brak uczestnika meczu regionalnego ${match.id}.` }
      const isUserMatch = match.id === userFixture?.id
      const preparationBonus = preparation === 'tactical' ? 3 : preparation === 'motivation' ? 1 : 0
      const derbyAction = next.pendingDerbyMatchAction?.matchId === match.id
        ? next.pendingDerbyMatchAction.choice
        : undefined
      const userBonus = isUserMatch
        ? preparationBonus + getMatchConferenceBonus(next, match.id) + (localDerby ? 3 : 0) + (derbyAction === 'away-supporters-bus' ? 1 : 0)
        : 0
      const homeStrength = home.id === next.teamId ? overallRating(next.squad) + userBonus : home.strength
      const awayStrength = away.id === next.teamId ? overallRating(next.squad) + userBonus : away.strength
      const preservedResult = preservedResults?.get(match.id)
      match.homeGoals = preservedResult?.homeGoals ?? rollGoals(homeStrength + 3, awayStrength)
      match.awayGoals = preservedResult?.awayGoals ?? rollGoals(awayStrength + 1, homeStrength)
      const userLineup = next.squad.filter((player) => next.matchLineupIds.includes(player.id))
      const homeLineup = getMatchEventLineup(next, match.homeId, match.homeId === next.teamId ? userLineup : undefined)
      const awayLineup = getMatchEventLineup(next, match.awayId, match.awayId === next.teamId ? userLineup : undefined)
      completeCupMatch(match, home, away, homeStrength, awayStrength, preservedResult, homeLineup, awayLineup)
      if (isUserMatch) {
        const isHomeMatch = match.homeId === next.teamId
        const regularFillRate = Math.max(0.3, Math.min(0.8, 0.3 + next.followers / 800_000))
        const derbyAttendanceBonus = localDerby ? 0.12 : 0
        const actionAttendanceBonus = derbyAction === 'home-tifo' ? 0.08 : 0
        match.attendance = isHomeMatch
          ? Math.round(next.stadiumCapacity * Math.min(0.92, regularFillRate + derbyAttendanceBonus + actionAttendanceBonus))
          : 0
        if (match.attendance > 0) {
          const gateIncome = Math.round(match.attendance * next.ticketPrice * (1 + next.facilities.catering * 0.1))
          addFinance(next, 'Puchar regionalny · wpływy z biletów', gateIncome)
          addFinance(next, 'Puchar regionalny · organizacja dnia meczowego', -Math.round(match.attendance * 2))
        }
        const opponentGoalsForUser = match.homeId === next.teamId ? match.awayGoals ?? 0 : match.homeGoals ?? 0
        recordClubRivalryMatch(
          next,
          userOpponentId,
          userOpponent?.name ?? getTeamName(next, userOpponentId),
          match.homeId === next.teamId ? match.homeGoals ?? 0 : match.awayGoals ?? 0,
          opponentGoalsForUser,
          localDerby,
          'regional-cup',
          match.round,
          match.winnerId,
        )
      }
      if (isUserMatch) {
        const won = match.winnerId === next.teamId
        applyDerbyMatchAction(next, match.id)
        if (localDerby) {
          next.localReputation = Math.max(0, Math.min(100, (next.localReputation ?? 35) + (won ? 2 : -2)))
        }
        next.commercialOffers = createCommercialOffers(
          next.leagueId,
          overallRating(next.squad),
          getClubReputation(next),
          getSeasonRoundCount(next),
          next.localReputation,
        )
        next.squad.forEach((player) => {
          player.morale = Math.max(20, Math.min(100, player.morale + (won ? 5 : -5) + (preparation === 'motivation' ? 2 : 0) + (localDerby ? won ? 2 : -2 : 0)))
          if (next.matchLineupIds.includes(player.id)) player.stamina = Math.max(30, player.stamina - (preparation === 'recovery' ? 5 : 8) - (conference === 'protective' ? 2 : 0))
        })
        adjustTeamChemistry(next, next.matchLineupIds, won ? 2 : -1)
        if (localDerby) next.followers += 250
        if (next.pendingMatchPreparation?.matchId === match.id) next.pendingMatchPreparation = undefined
        if (next.pendingMatchConference?.matchId === match.id) next.pendingMatchConference = undefined
      }
      if (preservedResult?.disciplinaryEvents) {
        match.disciplinaryEvents = structuredClone(preservedResult.disciplinaryEvents)
        for (const teamId of [match.homeId, match.awayId]) {
          const teamPlayers = teamId === next.teamId
            ? next.squad
            : (next.clubSquads[teamId] ?? []).map(({ player }) => player)
          applyDisciplinaryEvents(
            teamPlayers,
            match.disciplinaryEvents.filter((event) => event.teamId === teamId),
            'polish-cup',
          )
        }
      } else {
        const latestMinute = match.extraTimePlayed ? 120 : 90
        match.disciplinaryEvents = [
          ...simulateDisciplinaryEvents(homeLineup, match.homeId, 'polish-cup', latestMinute),
          ...simulateDisciplinaryEvents(awayLineup, match.awayId, 'polish-cup', latestMinute),
        ]
      }
      match.played = true
    }
    for (const match of scheduledMatches) {
      if (match.bye) continue
      if (!match.winnerId) return { game, error: `Nie ustalono zwycięzcy meczu regionalnego ${match.id}.` }
      const winner = cup.teams.find((team) => team.id === match.winnerId)
      if (!winner) return { game, error: `Brak zwycięzcy ${match.winnerId} w pucharze regionalnym.` }
      awardCupPrize(next, winner.id, winner.leagueId, true, 'Premia za awans w pucharze regionalnym')
    }
    if (cup.matches.every((match) => match.played)) {
      advanceRegionalCupSeason(cup, cup.season, next.teamId)
      if (cup.championId) {
        next.regionalCupWinners ??= {}
        next.regionalCupWinners[cup.season] ??= {}
        next.regionalCupWinners[cup.season][cup.regionId] = [cup.championId]
      }
    }
  }
  next.currentDate = eventDate
  scheduleLeagueFixtures(next)
  const completedUserMatch = dueCups
    .flatMap((cup) => cup.history)
    .find((match) => match.scheduledAt === eventDate && (match.homeId === next.teamId || match.awayId === next.teamId))
  const summary = completedUserMatch
    ? `${getTeamName(next, completedUserMatch.homeId)} ${completedUserMatch.homeGoals} : ${completedUserMatch.awayGoals} ${getTeamName(next, completedUserMatch.awayId)} w Pucharze regionalnym.${localDerby ? ` Derby ${getDerbyKind(next, userOpponent?.name ?? '', 'regional-cup') === 'city' ? 'miejskie' : 'okręgowe'}.` : ''}`
    : `Rozegrano rundę Pucharu regionalnego z dnia ${eventDate}.`
  return { game: next, error: '', summary, completedMatch: completedUserMatch }
}

export function playPolishCupRound(
  game: GameState,
  preservedResults?: ReadonlyMap<string, {
    homeGoals?: number
    awayGoals?: number
    winnerId?: string
    penaltyScore?: string
    timeline?: MatchTimelineEvent[]
    extraTimePlayed?: boolean
    extraTimeHomeGoals?: number
    extraTimeAwayGoals?: number
    penaltyShootoutEvents?: MatchPenaltyEvent[]
    disciplinaryEvents?: MatchCardEvent[]
  }>,
) {
  const nextRegionalDate = (game.regionalCups ?? [])
    .flatMap((regionalCup) => regionalCup.matches)
    .filter((match) => !match.played)
    .map((match) => match.scheduledAt)
    .filter((date): date is string => Boolean(date))
    .sort()[0]
  const nextCentralDate = game.polishCup?.matches
    .filter((match) => !match.played)
    .map((match) => match.scheduledAt)
    .filter((date): date is string => Boolean(date))
    .sort()[0]
  if (
    nextRegionalDate
    && (!nextCentralDate || nextRegionalDate <= nextCentralDate)
    && getNextScheduledCompetition(game) === 'polish-cup'
  ) {
    return playRegionalCupEvent(game, preservedResults)
  }
  const next = structuredClone(game)
  const cup = next.polishCup
  if (!cup) return { game, error: 'Nie znaleziono rozgrywek Polskiego Pucharu w tym zapisie.' }
  if (cup.stage === 'complete') return { game, error: 'Polski Puchar w tym sezonie został już rozstrzygnięty.' }
  const previousDrawDate = cup.drawAt
  if (getNextScheduledCompetition(game) !== 'polish-cup') {
    return {
      game,
      error: `Runda Polskiego Pucharu jest zaplanowana po kolejce ${cup.scheduledAfterLeagueRound ?? 1}. Najpierw rozegraj zaplanowane mecze ligowe.`,
    }
  }
  const eventDate = cup.matches
    .filter((match) => !match.played)
    .map((match) => match.scheduledAt)
    .filter((date): date is string => Boolean(date))
    .sort()[0]
  const eventMatches = cup.matches.filter((match) => !match.played && match.scheduledAt === eventDate)
  if (!eventMatches.length) {
    return { game, error: 'Nie można rozegrać tej rundy Polskiego Pucharu. Wczytaj zapis ponownie lub rozpocznij nowy sezon.' }
  }
  next.currentDate = eventDate
  addPolishCupWeekMessage(next, eventDate)
  ensureClubSquadsForCupTeams(
    next,
    eventMatches.flatMap((match) => [match.homeId, match.awayId]),
    cup.teams,
  )
  const clubMatch = eventMatches.find((match) =>
    !match.bye && (match.homeId === next.teamId || match.awayId === next.teamId),
  )
  if (clubMatch && game.sponsorRequired) {
    return { game, error: 'Przed pierwszym oficjalnym meczem sezonu podpisz umowę sponsorską w zakładce Finanse.' }
  }
  const startingIds = [...new Set(next.matchLineupIds)]
  const startingPlayers = next.squad.filter((player) => startingIds.includes(player.id))
  if (clubMatch && startingPlayers.length !== 11) {
    return { game, error: 'Wybierz dokładnie 11 zawodników do pierwszego składu przed meczem pucharowym.' }
  }
  if (clubMatch && startingPlayers.some((player) =>
    getSuspensionMatches(player, 'polish-cup') > 0 || getInjuryMatches(player) > 0,
  )) {
    return { game, error: 'W pierwszym składzie znajduje się zawodnik kontuzjowany lub zawieszony w Polskim Pucharze.' }
  }
  const preparation = clubMatch && next.pendingMatchPreparation?.matchId === clubMatch.id
    ? next.pendingMatchPreparation.choice
    : undefined
  const conference = clubMatch ? getMatchConferenceChoice(next, clubMatch.id) : undefined
  if (preparation === 'recovery') next.squad.forEach((player) => { player.stamina = Math.min(100, player.stamina + 6) })
  if (clubMatch) applyConferenceRecovery(next, clubMatch.id, startingIds)
  const preMatchStamina = new Map(next.squad.map((player) => [player.id, player.stamina]))
  for (const match of eventMatches) {
    if (match.bye) {
      match.played = true
      match.homeGoals = 0
      match.awayGoals = 0
      match.winnerId = match.homeId
      continue
    }
    const home = getPolishCupTeam(cup, match.homeId)
    const away = getPolishCupTeam(cup, match.awayId)
    const isClubMatch = match.id === clubMatch?.id
    const localDerby = isClubMatch
      ? isLocalDerby(next, getTeamName(next, match.homeId === next.teamId ? match.awayId : match.homeId))
      : false
    const derbyAction = next.pendingDerbyMatchAction?.matchId === match.id
      ? next.pendingDerbyMatchAction.choice
      : undefined
    const lineupRating = isClubMatch
      ? matchLineupRating(next, startingIds, match.id) + (preparation === 'tactical' ? 3 : preparation === 'motivation' ? 1 : 0) + (localDerby ? 3 : 0) + (derbyAction === 'away-supporters-bus' ? 1 : 0)
      : 0
    const clubContext = isClubMatch ? buildMatchContext(
      startingPlayers,
      lineupRating,
      match.homeId === next.teamId,
      next.tactics,
      undefined,
    ) : null
    const homeContext = match.homeId === next.teamId && clubContext
      ? clubContext
      : { attack: home.strength + 3, defense: home.strength, staminaDrain: 12 }
    const awayContext = match.awayId === next.teamId && clubContext
      ? clubContext
      : { attack: away.strength + 1, defense: away.strength, staminaDrain: 12 }
    let homeAttack = match.homeId === next.teamId
      ? homeContext.attack + 3
      : homeContext.attack
    let homeDefense = match.homeId === next.teamId
      ? homeContext.defense
      : homeContext.defense
    let awayAttack = match.awayId === next.teamId
      ? awayContext.attack + 1
      : awayContext.attack
    let awayDefense = match.awayId === next.teamId
      ? awayContext.defense
      : awayContext.defense
    const preservedResult = preservedResults?.get(match.id)
    const homeLineup = getMatchEventLineup(next, match.homeId, match.homeId === next.teamId ? startingPlayers : undefined)
    const awayLineup = getMatchEventLineup(next, match.awayId, match.awayId === next.teamId ? startingPlayers : undefined)
    if (isClubMatch) {
      match.disciplinaryEvents = preservedResult?.disciplinaryEvents
        ? structuredClone(preservedResult.disciplinaryEvents)
        : [
          ...simulateDisciplinaryEvents(structuredClone(homeLineup), match.homeId, 'polish-cup'),
          ...simulateDisciplinaryEvents(structuredClone(awayLineup), match.awayId, 'polish-cup'),
        ]
      const dismissalDuration = preservedResult?.extraTimePlayed ? 120 : 90
      const homeDismissalPenalty = getDismissalStrengthPenalty(match.disciplinaryEvents, match.homeId, dismissalDuration)
      const awayDismissalPenalty = getDismissalStrengthPenalty(match.disciplinaryEvents, match.awayId, dismissalDuration)
      homeAttack -= homeDismissalPenalty
      homeDefense -= homeDismissalPenalty
      awayAttack -= awayDismissalPenalty
      awayDefense -= awayDismissalPenalty
    }
    match.homeGoals = preservedResult?.homeGoals ?? rollGoals(homeAttack, awayDefense)
    match.awayGoals = preservedResult?.awayGoals ?? rollGoals(awayAttack, homeDefense)
    const timelinePlan = completeCupMatch(
      match,
      home,
      away,
      home.strength,
      away.strength,
      preservedResult,
      homeLineup,
      awayLineup,
    )
    match.played = true
    if (!isClubMatch) continue
    const opponentId = match.homeId === next.teamId ? match.awayId : match.homeId
    const opponentName = getTeamName(next, opponentId)
    recordClubRivalryMatch(
      next,
      opponentId,
      opponentName,
      match.homeId === next.teamId ? match.homeGoals ?? 0 : match.awayGoals ?? 0,
      match.homeId === next.teamId ? match.awayGoals ?? 0 : match.homeGoals ?? 0,
      localDerby,
      'polish-cup',
      match.round,
      match.winnerId,
    )
    const derbyActionAttendanceBonus = derbyAction === 'home-tifo' ? 0.08 : 0
    match.attendance = match.homeId === next.teamId
      ? Math.round(next.stadiumCapacity * Math.min(0.99, Math.max(0.3, Math.min(0.95, 0.46 + next.followers / 500_000)) + derbyActionAttendanceBonus))
      : 0
    const clubGoals = match.homeId === next.teamId ? match.homeGoals : match.awayGoals
    const clubScorerIds = preservedResult?.timeline
      ?.filter((event) => event.teamId === next.teamId && (event.type === 'goal' || event.type === 'penalty-goal'))
      .map((event) => event.playerId)
    const { playerGoals } = recordPlayerMatchStats(
      next.squad,
      startingPlayers,
      clubGoals - countOwnGoalsForTeam(timelinePlan, next.teamId),
      'polish-cup',
      clubScorerIds,
    )
    if (isClubMatch && !preservedResult?.timeline) {
      match.timeline = createMatchTimeline(timelinePlan, match.homeId, match.awayId, homeLineup, awayLineup, match.homeId === next.teamId ? playerGoals : new Map(), match.awayId === next.teamId ? playerGoals : new Map())
    }
    const clubWon = match.winnerId === next.teamId
    const cupIncome = match.attendance * next.ticketPrice * (1 + next.facilities.catering * 0.1)
    if (cupIncome > 0) addFinance(next, 'Sprzedaż z biletów', Math.round(cupIncome))
    addFinance(next, 'Przychód z dnia meczowego', 35_000)
    if (match.homeId === next.teamId) {
      addFinance(next, 'Organizacja dnia meczowego', -Math.round(match.attendance * 2))
    }
    const wages = next.squad.reduce((sum, player) => sum + player.wage, 0)
    addFinance(next, 'Wynagrodzenia kadry', -wages)
    payStaffWages(next)
    payAcademyUpkeep(next)
    payStadiumUpkeep(next)
    const staminaCost = Math.max(8, (clubContext?.staminaDrain ?? 12) - (preparation === 'recovery' ? 3 : 0) - (conference === 'protective' ? 2 : 0))
    next.squad.forEach((player) => {
      if (startingIds.includes(player.id)) player.stamina = Math.max(30, player.stamina - staminaCost)
      else player.stamina = Math.min(100, player.stamina + 8)
      const derbyChange = localDerby ? clubWon ? 2 : -2 : 0
      player.morale = Math.max(20, Math.min(100, player.morale + (clubWon ? 5 : match.homeGoals === match.awayGoals ? 1 : -5) + (startingIds.includes(player.id) ? 2 : 0) + (preparation === 'motivation' ? 2 : 0) + derbyChange))
    })
    if (isClubMatch) {
      adjustTeamChemistry(next, startingIds, clubWon ? 2 : -1)
      if (localDerby) next.followers += 250
      applyDerbyMatchAction(next, match.id)
      next.commercialOffers = createCommercialOffers(
        next.leagueId,
        overallRating(next.squad),
        getClubReputation(next),
        getSeasonRoundCount(next),
        next.localReputation,
      )
      if (next.pendingMatchPreparation?.matchId === match.id) next.pendingMatchPreparation = undefined
      if (next.pendingMatchConference?.matchId === match.id) next.pendingMatchConference = undefined
    }
    const returnedFromSuspension = decrementSuspensions(next, 'polish-cup')
    const preservedCards = match.disciplinaryEvents ?? preservedResult?.disciplinaryEvents
    if (preservedCards) {
      match.disciplinaryEvents = structuredClone(preservedCards)
      for (const teamId of [match.homeId, match.awayId]) {
        const teamPlayers = teamId === next.teamId
          ? next.squad
          : (next.clubSquads[teamId] ?? []).map(({ player }) => player)
        applyDisciplinaryEvents(
          teamPlayers,
          match.disciplinaryEvents.filter((event) => event.teamId === teamId),
          'polish-cup',
        )
      }
    } else {
      const latestMinute = match.extraTimePlayed ? 120 : 90
      match.disciplinaryEvents = [
        ...simulateDisciplinaryEvents(homeLineup, match.homeId, 'polish-cup', latestMinute),
        ...simulateDisciplinaryEvents(awayLineup, match.awayId, 'polish-cup', latestMinute),
      ]
    }
    addAvailabilityMessages(next, match, 'polish-cup')
    const cupGoalsFor = match.homeId === next.teamId ? match.homeGoals : match.awayGoals
    const cupGoalsAgainst = match.homeId === next.teamId ? match.awayGoals : match.homeGoals
    const cupOutcome = cupGoalsFor > cupGoalsAgainst ? 'win' : cupGoalsFor === cupGoalsAgainst ? 'draw' : 'loss'
    updateBoardConfidenceAfterMatch(next, clubWon ? 'win' : 'loss', 'polish-cup')
    processSponsorMatchOutcome(next, clubWon ? 'win' : 'loss')
    const latestMinute = match.extraTimePlayed ? 120 : 90
    const { injuryEvents, recoveredPlayerIds } = applyMatchdayInjuries(next, preMatchStamina, latestMinute)
    const automaticEvent: MatchdayEvent = {
      id: `auto-${match.id}`,
      round: match.round,
      matchId: match.id,
      title: 'Automatyczne zmiany',
      description: '',
      options: [],
      substitutionsUsed: 0,
      substitutedPlayerIds: [],
      substitutePlayerIds: [],
    }
    match.substitutions = applyAutomaticMatchSubstitutions(
      next,
      automaticEvent,
      injuryEvents,
      preMatchStamina,
      'polish-cup',
      latestMinute,
    )
    match.injuryEvents = injuryEvents
    for (const playerId of automaticEvent.substitutePlayerIds ?? []) {
      if (startingIds.includes(playerId)) continue
      const player = next.squad.find((candidate) => candidate.id === playerId)
      if (!player) continue
      player.cupAppearances = (player.cupAppearances ?? 0) + 1
      player.careerAppearances = (player.careerAppearances ?? 0) + 1
    }
    const substituteIds = automaticEvent.substitutePlayerIds ?? []
    const outgoingIds = automaticEvent.substitutedPlayerIds ?? []
    const playerRatings = rateMatchPlayers(
      next.squad,
      [...startingIds.filter((id) => !substituteIds.includes(id)), ...outgoingIds],
      substituteIds,
      playerGoals,
      match.disciplinaryEvents,
      cupOutcome,
    )
    next.lastMatchReport = {
      round: game.round,
      score: `${match.homeGoals} : ${match.awayGoals}${match.penaltyScore ? ` · karne ${match.penaltyScore}` : ''}`,
      outcome: cupOutcome,
      headline: 'Oceny po meczu pucharowym',
      summary: match.penaltyScore ? `O awansie zdecydowały rzuty karne ${match.penaltyScore}.` : `${next.clubName} ${clubWon ? 'awansuje do kolejnej rundy' : 'odpada z Polskiego Pucharu'}.`,
      tacticalNote: `Polski Puchar · ${next.tactics.formation} · ${next.tactics.style === 'attacking' ? 'styl ofensywny' : next.tactics.style === 'counter' ? 'kontratak' : 'styl zrównoważony'}.`,
      playerRatings,
    }
    const returnedPlayerIds = new Set([...returnedFromSuspension, ...recoveredPlayerIds])
    const selection = completeMatchSquad(next, next.matchLineupIds, next.matchBenchIds, 'polish-cup', returnedPlayerIds)
    next.matchLineupIds = selection.starters
    next.matchBenchIds = selection.bench
    const homeName = home.name
    const awayName = away.name
    addMediaPost(
      next,
      'MECZ',
      `${homeName} ${match.homeGoals} : ${match.awayGoals} ${awayName} · Polski Puchar`,
      `${clubWon ? `${next.clubName} awansuje do kolejnej rundy` : `${next.clubName} odpada z Polskiego Pucharu`}${match.penaltyScore ? ` po rzutach karnych ${match.penaltyScore}` : ''}.`,
    )
  }
  for (const match of eventMatches) {
    if (match.bye) continue
    if (!match.winnerId) return { game, error: `Nie ustalono zwycięzcy meczu Polskiego Pucharu ${match.id}.` }
    const winner = cup.teams.find((team) => team.id === match.winnerId)
    if (!winner) return { game, error: `Brak zwycięzcy ${match.winnerId} w Polskim Pucharze.` }
    awardCupPrize(next, winner.id, winner.leagueId, false, 'Premia za awans w Polskim Pucharze')
    if (cup.scheduleStage === 'central-final') {
      recordCupPrize(next, winner.id, 1_000_000, 'Premia za zwycięstwo w Polskim Pucharze')
    }
  }
  if (!clubMatch) {
  const wages = next.squad.reduce((sum, player) => sum + player.wage, 0)
  addFinance(next, 'Wynagrodzenia kadry', -wages)
  payStadiumUpkeep(next)
  payStaffWages(next)
  payAcademyUpkeep(next)
    next.scouts.forEach((scout) => {
      addFinance(next, `Wynagrodzenie skauta: ${scout.name}`, -scout.wagePerRound)
      if (scout.prospect) return
      scout.roundsUntilReport -= 1
      if (scout.roundsUntilReport > 0) return
      scout.prospect = scoutForProspect(next, scout)
      ensureUniqueGamePlayerNames(next)
      addMediaPost(next, 'TRANSFER', `Skaut ${scout.name} odkrył młody talent`, `${scout.name} poleca ${scout.prospect.firstName} ${scout.prospect.lastName}, ${scout.prospect.age}-letniego zawodnika z potencjałem ${scout.prospect.potential}/100.`)
    })
    next.squad.forEach((player) => {
      player.stamina = Math.min(100, player.stamina + 8)
    })
    advanceInjuries(next)
    addMediaPost(next, 'LIGA', `Polski Puchar: pauza ${next.clubName}`, `${next.clubName} nie rozgrywa meczu w tej fazie turnieju. Klub odpoczywa między kolejkami ligowymi.`)
  }
  processDebtSanctions(next)
  const completedMatches = eventMatches.map((match) => ({ ...match }))
  cup.history.push(...completedMatches)
  if (cup.matches.every((match) => match.played)) {
    addPolishCupResultsMessage(next, cup, cup.matches)
  }
  if (cup.matches.every((match) => match.played) && cup.centralSeason && cup.scheduleStage === 'central-preliminary') {
    const preliminaryWinners = cup.matches.map((match) => match.winnerId).filter((id): id is string => Boolean(id))
    const firstRoundParticipants = [...new Set([
      ...preliminaryWinners,
      ...(cup.heldEkstraklasaIds ?? []),
    ])]
    enterPolishCupStage(cup, 'second', firstRoundParticipants, 'central-first', undefined, next.teamId)
  } else if (cup.matches.every((match) => match.played) && cup.centralSeason && cup.scheduleStage === 'central-first') {
    const winners = cup.matches.map((match) => match.winnerId).filter((id): id is string => Boolean(id))
    enterPolishCupStage(cup, 'national', winners, 'central-round-of-16', undefined, next.teamId)
  } else if (cup.matches.every((match) => match.played) && cup.centralSeason && cup.scheduleStage === 'central-round-of-16') {
    const winners = cup.matches.map((match) => match.winnerId).filter((id): id is string => Boolean(id))
    enterPolishCupStage(cup, 'national', winners, 'central-round-of-8', undefined, next.teamId)
  } else if (cup.matches.every((match) => match.played) && cup.centralSeason && cup.scheduleStage === 'central-round-of-8') {
    const winners = cup.matches.map((match) => match.winnerId).filter((id): id is string => Boolean(id))
    enterPolishCupStage(cup, 'national', winners, 'central-quarterfinal', undefined, next.teamId)
  } else if (cup.matches.every((match) => match.played) && cup.centralSeason && cup.scheduleStage === 'central-quarterfinal') {
    const winners = cup.matches.map((match) => match.winnerId).filter((id): id is string => Boolean(id))
    enterPolishCupStage(cup, 'national', winners, 'central-semifinal', undefined, next.teamId)
  } else if (cup.matches.every((match) => match.played) && cup.centralSeason && cup.scheduleStage === 'central-semifinal') {
    const finalists = cup.matches.map((match) => match.winnerId).filter((id): id is string => Boolean(id))
    const finalMatch = drawPolishCupMatches(
      finalists,
      'national',
      cup.regionalRound + 1,
      undefined,
      1,
      cup.teams,
      'central-final',
      cup.season,
    )
    cup.stage = 'national'
    cup.regionalRound += 1
    cup.scheduleStage = 'central-final'
    const drawDate = getPolishCupDrawDate(cup.season, 'central-final')
    cup.drawAt = drawDate ? getLocalDateKey(drawDate) : undefined
    cup.participants = finalists
    cup.matches = finalMatch.map((match) => ({ ...match, neutralVenue: true, venueId: 'PGE Narodowy' }))
  } else if (cup.matches.every((match) => match.played) && cup.centralSeason && cup.scheduleStage === 'central-final') {
    cup.participants = cup.matches.map((match) => match.winnerId).filter((id): id is string => Boolean(id))
    cup.championId = cup.participants[0]
    cup.stage = 'complete'
    cup.matches = []
    addMediaPost(next, 'LIGA', 'Finał Polskiego Pucharu', `${getPolishCupTeam(cup, cup.championId).name} zdobywa Polski Puchar w sezonie ${cup.season}.`)
  } else if (cup.matches.every((match) => match.played) && cup.stage === 'regional') {
    const nextPools = Object.fromEntries(Object.keys(cup.regionalPools).map((poolId) => [
      poolId,
      cup.matches.filter((match) => match.poolId === poolId).map((match) => match.winnerId).filter((id): id is string => Boolean(id)),
    ]))
    cup.regionalPools = nextPools
    if (Object.values(nextPools).every((ids) => ids.length <= 1)) {
      const qualifiers = Object.values(nextPools).flat()
      enterPolishCupStage(cup, 'third', qualifiers, 'central-preliminary', undefined, next.teamId)
    } else if (cup.matches.every((match) => match.played)) {
      cup.regionalRound += 1
      cup.matches = drawPolishCupRegionalRound(cup.regionalPools, cup.regionalRound, cup.teams, cup.season, next.teamId)
    }
  } else {
    cup.participants = cup.matches.map((match) => match.winnerId).filter((id): id is string => Boolean(id))
    if (cup.stage === 'third' && cup.participants.length <= 64) {
      enterPolishCupStage(cup, 'second', cup.participants, 'central-first', undefined, next.teamId)
    } else if (cup.stage === 'second' && cup.participants.length <= 64) {
      enterPolishCupStage(cup, 'first', cup.participants, 'central-round-of-16', undefined, next.teamId)
    } else if (cup.stage === 'first' && cup.participants.length <= 64) {
      enterPolishCupStage(cup, 'ekstraklasa', cup.participants, 'central-round-of-8', undefined, next.teamId)
    } else if (cup.stage === 'ekstraklasa' && cup.participants.length <= 64) {
      cup.stage = 'national'
      cup.regionalRound = 1
      cup.matches = drawPolishCupStageRound(cup, next.teamId)
    } else if (cup.stage === 'national' && cup.participants.length === 1) {
      cup.championId = cup.participants[0]
      cup.stage = 'complete'
      cup.matches = []
      addMediaPost(next, 'LIGA', 'Finał Polskiego Pucharu', `${getPolishCupTeam(cup, cup.championId).name} zdobywa Polski Puchar w sezonie ${cup.season}.`)
    } else {
      cup.regionalRound += 1
      cup.matches = drawPolishCupStageRound(cup, next.teamId)
    }
  }
  if (cup.stage !== 'complete' && !cup.centralSeason) {
    cup.scheduledAfterLeagueRound = Math.min(getSeasonRoundCount(next), game.round + 1)
  }
  if (cup.drawAt && eventDate && cup.drawAt <= eventDate && cup.stage !== 'complete') {
    const nextDrawDate = parseLocalDateKey(eventDate)
    nextDrawDate.setDate(nextDrawDate.getDate() + 1)
    cup.drawAt = getLocalDateKey(nextDrawDate)
  }
  if (cup.drawAt !== previousDrawDate) addPolishCupDrawAnnouncement(next)
  if (eventDate) next.currentDate = eventDate
  scheduleLeagueFixtures(next)
  return {
    game: next,
    error: '',
    summary: clubMatch
      ? `${getPolishCupTeam(cup, clubMatch.homeId).name} ${clubMatch.homeGoals} : ${clubMatch.awayGoals} ${getPolishCupTeam(cup, clubMatch.awayId).name}${clubMatch.penaltyScore ? ` (karne ${clubMatch.penaltyScore})` : ''}.`
      : `Rozegrano rundę: ${getPolishCupStageLabel(cup)}.`,
  }
}

function compareTeamsByLeagueRules(first: Team, second: Team, tiedTeamIds: Set<string>) {
  const getDirectStats = (team: Team) => [...tiedTeamIds]
    .filter((teamId) => teamId !== team.id)
    .reduce((total, teamId) => {
      const stats = team.headToHead?.[teamId]
      if (!stats) return total
      total.points += stats[0]
      total.goalsFor += stats[1]
      total.goalsAgainst += stats[2]
      return total
    }, { points: 0, goalsFor: 0, goalsAgainst: 0 })
  const firstDirect = getDirectStats(first)
  const secondDirect = getDirectStats(second)
  return secondDirect.points - firstDirect.points
    || (secondDirect.goalsFor - secondDirect.goalsAgainst) - (firstDirect.goalsFor - firstDirect.goalsAgainst)
    || secondDirect.goalsFor - firstDirect.goalsFor
    || (second.goalsFor - second.goalsAgainst) - (first.goalsFor - first.goalsAgainst)
    || second.goalsFor - first.goalsFor
    || (first.fairPlayPoints ?? 0) - (second.fairPlayPoints ?? 0)
    || (first.redCards ?? 0) - (second.redCards ?? 0)
    || (first.yellowCards ?? 0) - (second.yellowCards ?? 0)
    || first.name.localeCompare(second.name, 'pl')
}

function rankTeams(teams: Team[]) {
  const pointsGroups = new Map<number, Team[]>()
  for (const team of teams) {
    const group = pointsGroups.get(team.points) ?? []
    group.push(team)
    pointsGroups.set(team.points, group)
  }
  return [...pointsGroups.entries()]
    .sort(([firstPoints], [secondPoints]) => secondPoints - firstPoints)
    .flatMap(([, tiedTeams]) => {
      const tiedTeamIds = new Set(tiedTeams.map((team) => team.id))
      return [...tiedTeams].sort((first, second) => compareTeamsByLeagueRules(first, second, tiedTeamIds))
    })
}

function decidePlayoffTie(first: Team, second: Team) {
  const firstHome = rollGoals(first.strength + 4, second.strength)
  const firstAway = rollGoals(second.strength + 2, first.strength)
  const secondHome = rollGoals(second.strength + 4, first.strength)
  const secondAway = rollGoals(first.strength + 2, second.strength)
  const firstAggregate = firstHome + secondAway
  const secondAggregate = firstAway + secondHome
  let firstEtGoals = 0
  let secondEtGoals = 0
  if (firstAggregate !== secondAggregate) {
    return {
      winner: firstAggregate > secondAggregate ? first : second,
      score: `${firstHome}:${firstAway} i ${secondHome}:${secondAway} (${firstAggregate}:${secondAggregate})`,
    }
  }
  const extraTime = createExtraTimeTimelinePlan(first.id, second.id, first.strength, second.strength)
  firstEtGoals = extraTime.filter((event) => event.teamId === first.id).length
  secondEtGoals = extraTime.filter((event) => event.teamId === second.id).length
  if (firstEtGoals !== secondEtGoals) {
    return {
      winner: firstEtGoals > secondEtGoals ? first : second,
      score: `${firstHome}:${firstAway} i ${secondHome}:${secondAway} (${firstAggregate}:${secondAggregate}), dogrywka ${firstEtGoals}:${secondEtGoals}`,
    }
  }
  const penalties = resolvePolishCupPenalties(
    { id: first.id, name: first.name, strength: first.strength, leagueId: 'first' },
    { id: second.id, name: second.name, strength: second.strength, leagueId: 'first' },
  )
  const penaltyWinner = penalties.winnerId === first.id ? first : second
  return {
    winner: penaltyWinner,
    score: `${firstHome}:${firstAway} i ${secondHome}:${secondAway} (${firstAggregate}:${secondAggregate}), dogrywka ${firstEtGoals}:${secondEtGoals}, rzuty karne ${penalties.score}`,
  }
}

function promotionPlayoff(teams: Team[], leagueName: string, promotedTeamId?: string) {
  const ranked = rankTeams(teams)
  const candidates = ranked.slice(2, 6)
  if (candidates.length < 4) throw new Error(`Za mało drużyn do baraży w lidze ${leagueName}.`)
  const promoted = promotedTeamId ? teams.find((team) => team.id === promotedTeamId) : undefined
  if (promoted) return { winner: promoted, summary: `${leagueName}: zwycięzca zaplanowanego barażu to ${promoted.name}.` }
  const firstSemi = decidePlayoffTie(candidates[0], candidates[3])
  const secondSemi = decidePlayoffTie(candidates[1], candidates[2])
  const final = decidePlayoffTie(firstSemi.winner, secondSemi.winner)
  return {
    winner: final.winner,
    summary: `${leagueName}: półfinały ${firstSemi.winner.name} i ${secondSemi.winner.name}; finał wygrał ${final.winner.name} (${final.score}).`,
  }
}

const thirdLeagueRegions: Record<string, string[]> = {
  'third-1': ['fourth-mazowieckie', 'fourth-lodzkie', 'fourth-podlaskie', 'fourth-warminsko-mazurskie'],
  'third-2': ['fourth-kujawsko-pomorskie', 'fourth-pomorskie', 'fourth-wielkopolskie', 'fourth-zachodniopomorskie'],
  'third-3': ['fourth-dolnoslaskie', 'fourth-lubuskie', 'fourth-opolskie', 'fourth-slaskie'],
  'third-4': ['fourth-lubelskie', 'fourth-malopolskie', 'fourth-podkarpackie', 'fourth-swietokrzyskie'],
}

export const regionalOptions = Object.entries(leagueGroups)
  .filter(([id]) => id.startsWith('fourth-'))
  .map(([id, group]) => ({ id, name: group.name }))

export function getRegionsForLeague(leagueId: LeagueId) {
  if (leagueId.startsWith('fourth-')) return [leagueId]
  const group = leagueGroups[leagueId as LeagueGroupId]
  if (group && 'regionId' in group) return [group.regionId]
  if (thirdLeagueRegions[leagueId]) return thirdLeagueRegions[leagueId]
  return regionalOptions.map((region) => region.id)
}

function exchangeTeams(world: Record<string, Team[]>, upperId: string, lowerId: string, relegated: Team[], promoted: Team[]) {
  const upper = world[upperId]
  const lower = world[lowerId]
  if (!upper || !lower) return
  world[upperId] = upper.filter((team) => !relegated.includes(team))
  world[lowerId] = lower.filter((team) => !promoted.includes(team))
  world[upperId].push(...promoted.map((team) => resetTeam(team, Math.min(85, team.strength + 3))))
  world[lowerId].push(...relegated.map((team) => resetTeam(team, Math.max(42, team.strength - 3))))
}

const podkarpackieDistricts = ['debica', 'jaroslaw', 'krosno', 'rzeszow', 'stalowa-wola']
const zachodniopomorskieOkregowaFeeders: Record<string, string[]> = {
  'zachodniopomorskie-okr-1': ['zachodniopomorskie-a-1'],
  'zachodniopomorskie-okr-2': ['zachodniopomorskie-a-2', 'zachodniopomorskie-a-3'],
  'zachodniopomorskie-okr-3': ['zachodniopomorskie-a-6', 'zachodniopomorskie-a-7'],
  'zachodniopomorskie-okr-4': ['zachodniopomorskie-a-4', 'zachodniopomorskie-a-5', 'zachodniopomorskie-a-8'],
}
const pomorskieBToA: Record<string, string[]> = {
  'pomorskie-a-1': ['pomorskie-b-1', 'pomorskie-b-2'],
  'pomorskie-a-2': ['pomorskie-b-3', 'pomorskie-b-4'],
  'pomorskie-a-3': ['pomorskie-b-5', 'pomorskie-b-6'],
  'pomorskie-a-4': ['pomorskie-b-7', 'pomorskie-b-8'],
  'pomorskie-a-5': ['pomorskie-b-9'],
  'pomorskie-a-6': ['pomorskie-b-10'],
}
const pomorskieAToOkregowa: Record<string, string[]> = {
  'pomorskie-okr-1': ['pomorskie-a-1'],
  'pomorskie-okr-2': ['pomorskie-a-2', 'pomorskie-a-3', 'pomorskie-a-4'],
  'pomorskie-okr-3': ['pomorskie-a-5', 'pomorskie-a-6'],
}
const warminskoMazurskieBToA: Record<string, string[]> = {
  'warminsko-mazurskie-a-1': ['warminsko-mazurskie-b-1', 'warminsko-mazurskie-b-5'],
  'warminsko-mazurskie-a-2': ['warminsko-mazurskie-b-2'],
  'warminsko-mazurskie-a-3': ['warminsko-mazurskie-b-3'],
  'warminsko-mazurskie-a-4': ['warminsko-mazurskie-b-4'],
}
const warminskoMazurskieAToOkregowa: Record<string, string[]> = {
  'warminsko-mazurskie-okr-1': ['warminsko-mazurskie-a-1', 'warminsko-mazurskie-a-2'],
  'warminsko-mazurskie-okr-2': ['warminsko-mazurskie-a-3', 'warminsko-mazurskie-a-4'],
}
const opolskieBToA: Record<string, string[]> = {
  'opolskie-a-1': ['opolskie-b-1', 'opolskie-b-2', 'opolskie-b-3'],
  'opolskie-a-2': ['opolskie-b-4', 'opolskie-b-9', 'opolskie-b-10', 'opolskie-b-11'],
  'opolskie-a-3': ['opolskie-b-5', 'opolskie-b-6'],
  'opolskie-a-4': ['opolskie-b-7', 'opolskie-b-8', 'opolskie-b-12', 'opolskie-b-13'],
}
const opolskieAToOkregowa: Record<string, string[]> = {
  'opolskie-okr-1': ['opolskie-a-1', 'opolskie-a-3'],
  'opolskie-okr-2': ['opolskie-a-2', 'opolskie-a-4'],
}
const lubuskieBToA: Record<string, string[]> = {
  'lubuskie-a-1': ['lubuskie-b-1', 'lubuskie-b-2'],
  'lubuskie-a-2': ['lubuskie-b-3'],
  'lubuskie-a-3': ['lubuskie-b-4', 'lubuskie-b-6'],
  'lubuskie-a-4': ['lubuskie-b-5', 'lubuskie-b-9'],
  'lubuskie-a-5': ['lubuskie-b-7', 'lubuskie-b-8'],
}
const lubuskieAToOkregowa: Record<string, string[]> = {
  'lubuskie-okr-1': ['lubuskie-a-1', 'lubuskie-a-2'],
  'lubuskie-okr-2': ['lubuskie-a-3', 'lubuskie-a-4', 'lubuskie-a-5'],
}
const lubuskieGorzowskieBGroups = ['lubuskie-b-1', 'lubuskie-b-2', 'lubuskie-b-3']
const lubuskieZielonogorskieBGroups = ['lubuskie-b-4', 'lubuskie-b-5', 'lubuskie-b-6', 'lubuskie-b-7', 'lubuskie-b-8', 'lubuskie-b-9']
const lubuskieGorzowskieCities = new Set([
  'Bledzew', 'Bogdaniec', 'Drezdenko', 'Gorzów Wielkopolski', 'Karnin', 'Kostrzyn nad Odrą',
  'Kowalów', 'Kłodawa', 'Międzyrzecz', 'Ośno Lubuskie', 'Rzepin', 'Różanki', 'Skwierzyna',
  'Słubice', 'Słońsk', 'Stare Kurowo', 'Strzelce Krajeńskie', 'Sulęcin', 'Trzebicz', 'Witnica', 'Zwierzyn',
])
const lubuskieZielonogorskieCities = new Set([
  'Babimost', 'Bytom Odrzański', 'Gubin', 'Iłowa', 'Kargowa', 'Kożuchów', 'Krosno Odrzańskie',
  'Lubsko', 'Nietków', 'Nowa Sól', 'Sulechów', 'Szczaniec', 'Szprotawa', 'Świebodzin',
  'Żagań', 'Żary', 'Zielona Góra',
])
const lubuskieGorzowskieClubNames: Set<string> = new Set([
  ...lubuskieGorzowskieBGroups, 'lubuskie-a-1', 'lubuskie-a-2', 'lubuskie-okr-1',
].flatMap((leagueId) => lubuskieLeagueGroups[leagueId as keyof typeof lubuskieLeagueGroups].clubs))

function getLubuskieOkrDestination(team: Team, world: Record<string, Team[]>) {
  const teamName = team.name.toLocaleLowerCase('pl')
  const teamCity = getClubCity(team.name)
  if (lubuskieGorzowskieClubNames.has(team.name)
    || lubuskieGorzowskieCities.has(teamCity)
    || [...lubuskieGorzowskieCities].some((city) => teamName.includes(city.toLocaleLowerCase('pl')))) {
    return 'lubuskie-okr-1'
  }
  if (lubuskieZielonogorskieCities.has(teamCity)
    || [...lubuskieZielonogorskieCities].some((city) => teamName.includes(city.toLocaleLowerCase('pl')))) {
    return 'lubuskie-okr-2'
  }
  const gorzowskaSize = world['lubuskie-okr-1']?.length ?? 0
  const zielonogorskaSize = world['lubuskie-okr-2']?.length ?? 0
  return gorzowskaSize <= zielonogorskaSize ? 'lubuskie-okr-1' : 'lubuskie-okr-2'
}

function getPodkarpackieDistrict(leagueId: string) {
  return podkarpackieDistricts.find((district) => leagueId.includes(`-${district}`))
}

function comparePromotionCandidates(first: Team, second: Team) {
  const firstRate = first.points / Math.max(1, first.played)
  const secondRate = second.points / Math.max(1, second.played)
  const firstGoalRate = (first.goalsFor - first.goalsAgainst) / Math.max(1, first.played)
  const secondGoalRate = (second.goalsFor - second.goalsAgainst) / Math.max(1, second.played)
  return secondRate - firstRate
    || secondGoalRate - firstGoalRate
    || second.wins - first.wins
    || first.name.localeCompare(second.name, 'pl')
}

function compareLubuskiePromotionCandidates(first: Team, second: Team) {
  const firstGoalDifference = first.goalsFor - first.goalsAgainst
  const secondGoalDifference = second.goalsFor - second.goalsAgainst
  return second.points - first.points
    || secondGoalDifference - firstGoalDifference
    || first.name.localeCompare(second.name, 'pl')
}

function compareOpolskieRelegationCandidates(first: Team, second: Team) {
  return first.points - second.points
    || (first.goalsFor - first.goalsAgainst) - (second.goalsFor - second.goalsAgainst)
    || first.goalsFor - second.goalsFor
    || first.name.localeCompare(second.name, 'pl')
}

type OpolskieRelegationPlan = {
  fourthToOkregowa: Team[]
  okregowaToA: Record<string, Team[]>
  okregowaPlayoffRank: number | undefined
  aToB: Record<string, Team[]>
  bToA: Record<string, Team[]>
  aToOkregowa: Record<string, Team[]>
  okregowaToFourth: Record<string, Team[]>
  fourthToThird: Team[]
}

type OpolskieWithdrawals = Record<string, Team[]>

function getOpolskieWithdrawals(
  world: Record<string, Team[]>,
  season: string,
  exceptions?: LeagueSeasonExceptions,
): OpolskieWithdrawals {
  if (exceptions?.season !== season) return {}
  const withdrawnIds = new Set(exceptions.withdrawnTeamIds ?? [])
  return Object.fromEntries(
    Object.entries(world)
      .filter(([leagueId]) => leagueId === 'fourth-opolskie' || leagueId.startsWith('opolskie-'))
      .map(([leagueId, teams]) => [leagueId, teams.filter((team) => withdrawnIds.has(team.id))])
      .filter(([, teams]) => (teams as Team[]).length > 0),
  ) as OpolskieWithdrawals
}

function applyOpolskieWithdrawals(
  world: Record<string, Team[]>,
  season: string,
  exceptions?: LeagueSeasonExceptions,
) {
  const withdrawals = getOpolskieWithdrawals(world, season, exceptions)
  const distribute = (team: Team, sourceId: string, destinations: string[]) => {
    const destinationId = destinations
      .filter((leagueId) => world[leagueId])
      .sort((first, second) =>
        world[first].length - world[second].length || first.localeCompare(second),
      )[0]
    if (!destinationId) return
    world[sourceId] = world[sourceId].filter((club) => club.id !== team.id)
    world[destinationId].push(resetTeam(team))
  }
  for (const [sourceId, teams] of Object.entries(withdrawals)) {
    for (const team of teams) {
      if (sourceId === 'fourth-opolskie') {
        distribute(team, sourceId, Object.keys(opolskieAToOkregowa).flatMap((leagueId) => opolskieAToOkregowa[leagueId]))
      } else if (sourceId.includes('-okr-')) {
        const aGroups = opolskieAToOkregowa[sourceId] ?? []
        distribute(team, sourceId, aGroups.flatMap((aGroupId) => opolskieBToA[aGroupId] ?? []))
      } else {
        world[sourceId] = world[sourceId].filter((club) => club.id !== team.id)
      }
    }
  }
  return withdrawals
}

function isOpolskiePromotionEligible(team: Team, exceptions?: LeagueSeasonExceptions, season?: string) {
  if (!exceptions || exceptions.season !== season) return true
  return !exceptions.promotionDeclinedTeamIds?.includes(team.id)
    && !exceptions.licenseDeniedTeamIds?.includes(team.id)
    && !exceptions.withdrawnTeamIds?.includes(team.id)
}

function getOpolskieRankedTeams(
  world: Record<string, Team[]>,
  leagueId: string,
  withdrawals: OpolskieWithdrawals,
) {
  const teamsById = new Map(
    [...(world[leagueId] ?? []), ...(withdrawals[leagueId] ?? [])]
      .map((team) => [team.id, team]),
  )
  return rankTeams([...teamsById.values()])
}

function getOpolskiePromotionSelections(
  world: Record<string, Team[]>,
  exceptions?: LeagueSeasonExceptions,
  season?: string,
  withdrawals: OpolskieWithdrawals = {},
) {
  const select = (leagueId: string, count: number) => getOpolskieRankedTeams(world, leagueId, withdrawals)
    .slice(0, 3)
    .filter((team) => !withdrawals[leagueId]?.some((withdrawn) => withdrawn.id === team.id))
    .filter((team) => isOpolskiePromotionEligible(team, exceptions, season))
    .slice(0, count)
  const bToA: Record<string, Team[]> = {}
  for (const [destinationId, sourceIds] of Object.entries(opolskieBToA)) {
    bToA[destinationId] = sourceIds.flatMap((sourceId) => select(sourceId, 1))
  }
  const aToOkregowa: Record<string, Team[]> = {}
  for (const [destinationId, sourceIds] of Object.entries(opolskieAToOkregowa)) {
    aToOkregowa[destinationId] = sourceIds.flatMap((sourceId) => select(sourceId, 2))
  }
  const okregowaToFourth: Record<string, Team[]> = {}
  for (const sourceId of ['opolskie-okr-1', 'opolskie-okr-2']) {
    okregowaToFourth[sourceId] = select(sourceId, 2)
  }
  const fourthToThird = select('fourth-opolskie', 1)
  return { bToA, aToOkregowa, okregowaToFourth, fourthToThird }
}

function getOpolskieRelegationPlan(
  world: Record<string, Team[]>,
  promotedByLeague: PromotionPlayoffs['promotedByLeague'] = {},
  exceptions?: LeagueSeasonExceptions,
  season?: string,
  withdrawals: OpolskieWithdrawals = getOpolskieWithdrawals(world, season ?? '', exceptions),
): OpolskieRelegationPlan {
  const selections = getOpolskiePromotionSelections(world, exceptions, season, withdrawals)
  const fourthStandings = rankTeams(world['fourth-opolskie'] ?? [])
    .filter((team) => !withdrawals['fourth-opolskie']?.some((withdrawn) => withdrawn.id === team.id))
  const fourthRunnerUp = fourthStandings[1]
  const fourthRunnerUpPromoted = Boolean(
    fourthRunnerUp && promotedByLeague['playoff:opolskie-fourth'] === fourthRunnerUp.id,
  )
  const thirdRelegations = rankTeams(world['third-3'] ?? []).slice(-4)
    .filter((team) => team.regionId === 'fourth-opolskie').length
  const opolskiePlayoffPromotion = fourthRunnerUpPromoted
    ? 1
    : promotedByLeague['playoff:opolskie-fourth']
      && world['fourth-opolskie']?.some((team) =>
        team.id === promotedByLeague['playoff:opolskie-fourth'],
      )
      ? 1
      : 0
  const fourthRelegationCount = Math.max(
    0,
    Object.values(selections.okregowaToFourth).flat().length
      + thirdRelegations
      - selections.fourthToThird.length
      - opolskiePlayoffPromotion
      - (withdrawals['fourth-opolskie']?.length ?? 0),
  )
  const fourthToOkregowa = fourthRelegationCount > 0
    ? fourthStandings.slice(-Math.min(fourthStandings.length, fourthRelegationCount))
    : []

  const okregowaToA: Record<string, Team[]> = {}
  const withdrawnOkrCount = ['opolskie-okr-1', 'opolskie-okr-2']
    .reduce((count, leagueId) => count + (withdrawals[leagueId]?.length ?? 0), 0)
  const okregowaRelegationCount = Math.max(
    0,
    Object.values(selections.aToOkregowa).flat().length
      + fourthToOkregowa.length
      - Object.values(selections.okregowaToFourth).flat().length
      - withdrawnOkrCount,
  )
  const okregowaLeagueIds = ['opolskie-okr-1', 'opolskie-okr-2']
  const okregowaCandidates = okregowaLeagueIds.flatMap((leagueId) =>
    [14, 15, 16].flatMap((position) => {
      const team = getOpolskieRankedTeams(world, leagueId, withdrawals)[position - 1]
      return team && !withdrawals[leagueId]?.some((withdrawn) => withdrawn.id === team.id)
        ? [{ leagueId, team }]
        : []
    }),
  )
  const additionalOkregowaRelegations = okregowaRelegationCount - okregowaCandidates.length
  const directAdditionalCount = Math.floor(additionalOkregowaRelegations / 2)
  let okregowaPlayoffRank = additionalOkregowaRelegations > 0 && additionalOkregowaRelegations % 2
    ? 13 - directAdditionalCount
    : undefined
  if (additionalOkregowaRelegations < 0) {
    const preserved = [...okregowaCandidates]
      .sort((first, second) => compareOpolskieRelegationCandidates(second.team, first.team))
      .slice(0, -additionalOkregowaRelegations)
    const preservedIds = new Set(preserved.map(({ team }) => team.id))
    okregowaCandidates.splice(
      0,
      okregowaCandidates.length,
      ...okregowaCandidates.filter(({ team }) => !preservedIds.has(team.id)),
    )
  } else {
    const additionalDirectCandidates = Array.from({ length: directAdditionalCount }, (_, index) => 13 - index)
      .flatMap((position) => okregowaLeagueIds.flatMap((leagueId) => {
        const team = getOpolskieRankedTeams(world, leagueId, withdrawals)[position - 1]
        return team && !withdrawals[leagueId]?.some((withdrawn) => withdrawn.id === team.id)
          ? [{ leagueId, team }]
          : []
      }))
    okregowaCandidates.push(...additionalDirectCandidates)
    if (okregowaPlayoffRank) {
      const playoffCandidates = okregowaLeagueIds.flatMap((leagueId) => {
        const team = getOpolskieRankedTeams(world, leagueId, withdrawals)[okregowaPlayoffRank! - 1]
        return team && !withdrawals[leagueId]?.some((withdrawn) => withdrawn.id === team.id)
          ? [{ leagueId, team }]
          : []
      })
      if (playoffCandidates.length !== 2) {
        okregowaPlayoffRank = undefined
      }
    }
  }
  const effectiveOkregowaRelegationCount = okregowaCandidates.length + (okregowaPlayoffRank ? 1 : 0)
  for (const leagueId of ['opolskie-okr-1', 'opolskie-okr-2']) {
    okregowaToA[leagueId] = okregowaCandidates
      .filter((candidate) => candidate.leagueId === leagueId)
      .map(({ team }) => team)
  }

  const aGroupIds = Object.keys(opolskieBToA).sort()
  const aRelegationCount = Math.max(
    0,
    Object.values(selections.bToA).flat().length
      + effectiveOkregowaRelegationCount
      - Object.values(selections.aToOkregowa).flat().length
      - (withdrawals['opolskie-a-1']?.length ?? 0)
      - (withdrawals['opolskie-a-2']?.length ?? 0)
      - (withdrawals['opolskie-a-3']?.length ?? 0)
      - (withdrawals['opolskie-a-4']?.length ?? 0),
  )
  const aToB: Record<string, Team[]> = Object.fromEntries(
    aGroupIds.map((leagueId) => {
      const ranked = getOpolskieRankedTeams(world, leagueId, withdrawals)
      const withdrawnIds = new Set((withdrawals[leagueId] ?? []).map((team) => team.id))
      const groupCandidates = ranked.slice(13, 16)
        .filter((team) => !withdrawnIds.has(team.id))
      const bottomWithdrawals = (withdrawals[leagueId] ?? []).filter((team) => {
        const rank = ranked.findIndex((candidate) => candidate.id === team.id) + 1
        return rank >= 14 && rank <= 16
      }).length
      const additionalGroupReductions = (withdrawals[leagueId]?.length ?? 0) - bottomWithdrawals
      groupCandidates.sort((first, second) =>
        ranked.findIndex((team) => team.id === first.id) - ranked.findIndex((team) => team.id === second.id),
      )
      groupCandidates.splice(0, additionalGroupReductions)
      return [leagueId, groupCandidates]
    }),
  )
  const additionalCandidates = [13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
    .flatMap((position) => aGroupIds
      .flatMap((leagueId) => {
        const team = getOpolskieRankedTeams(world, leagueId, withdrawals)[position - 1]
        return team && !withdrawals[leagueId]?.some((withdrawn) => withdrawn.id === team.id)
          ? [{ leagueId, team }]
          : []
      })
      .sort((first, second) => compareOpolskieRelegationCandidates(first.team, second.team)))
  const mandatoryARelegations = Object.values(aToB).flat().length
  for (const candidate of additionalCandidates.slice(0, Math.max(0, aRelegationCount - mandatoryARelegations))) {
    aToB[candidate.leagueId].push(candidate.team)
  }
  while (Object.values(aToB).flat().length > aRelegationCount) {
    const candidates = Object.entries(aToB).flatMap(([leagueId, teams]) =>
      teams.map((team) => ({ leagueId, team })),
    )
    const highestRankedRelegated = candidates
      .sort((first, second) => compareOpolskieRelegationCandidates(second.team, first.team))[0]
    if (!highestRankedRelegated) break
    aToB[highestRankedRelegated.leagueId] = aToB[highestRankedRelegated.leagueId]
      .filter((team) => team.id !== highestRankedRelegated.team.id)
  }

  return {
    fourthToOkregowa,
    okregowaToA,
    okregowaPlayoffRank,
    aToB,
    bToA: selections.bToA,
    aToOkregowa: selections.aToOkregowa,
    okregowaToFourth: selections.okregowaToFourth,
    fourthToThird: selections.fourthToThird,
  }
}

type LubuskieRelegationPlan = {
  fourthToOkregowa: Team[]
  fourthDestinations: Record<string, string>
  okregowaToA: Record<string, Team[]>
  aToB: Record<string, Team[]>
}

function getLubuskieRelegationPlan(world: Record<string, Team[]>, relegatedFromThird?: Team[]): LubuskieRelegationPlan {
  const thirdRelegations = relegatedFromThird
    ?? rankTeams(world['third-3'] ?? []).slice(-4)
  const extraFourthRelegations = thirdRelegations.filter((team) => team.regionId === 'fourth-lubuskie').length
  const fourthStandings = rankTeams(world['fourth-lubuskie'] ?? [])
  const fourthToOkregowa = fourthStandings.slice(-Math.min(fourthStandings.length, 3 + extraFourthRelegations))
  const fourthDestinations = Object.fromEntries(
    fourthToOkregowa.map((team) => [team.id, getLubuskieOkrDestination(team, world)]),
  )
  const extraToOkregowa = fourthToOkregowa.slice(0, extraFourthRelegations)
  const additionalRelegationsByOkreg = new Map<string, number>([
    ['lubuskie-okr-1', 0],
    ['lubuskie-okr-2', 0],
  ])
  extraToOkregowa.forEach((team) => {
    const destinationId = fourthDestinations[team.id]
    additionalRelegationsByOkreg.set(destinationId, (additionalRelegationsByOkreg.get(destinationId) ?? 0) + 1)
  })

  const okregowaToA: Record<string, Team[]> = {}
  const additionalRelegationsByA = new Map(Object.keys(lubuskieBToA).map((leagueId) => [leagueId, 0]))
  for (const [leagueId, baseCount] of [['lubuskie-okr-1', 1], ['lubuskie-okr-2', 2]] as const) {
    const standings = rankTeams(world[leagueId] ?? [])
    const extraCount = additionalRelegationsByOkreg.get(leagueId) ?? 0
    const relegated = standings.slice(-Math.min(standings.length, baseCount + extraCount))
    okregowaToA[leagueId] = relegated
    const extraRelegated = relegated.slice(0, extraCount)
    const destinations = lubuskieAToOkregowa[leagueId]
    extraRelegated.forEach((_, index) => {
      const destinationId = destinations[index % destinations.length]
      additionalRelegationsByA.set(destinationId, (additionalRelegationsByA.get(destinationId) ?? 0) + 1)
    })
  }

  const aToB: Record<string, Team[]> = {}
  const selectWorstAdditionalAClubs = (leagueIds: readonly string[], count: number) => {
    const candidates = leagueIds.flatMap((leagueId) => {
      const standings = rankTeams(world[leagueId] ?? [])
      const baseCount = ['lubuskie-a-1', 'lubuskie-a-2'].includes(leagueId) ? 1 : 2
      return standings.slice(0, Math.max(0, standings.length - baseCount))
        .map((team, index) => ({ leagueId, team, position: index + 1 }))
    })
    candidates.sort((first, second) =>
      first.team.points - second.team.points
      || (first.team.goalsFor - first.team.goalsAgainst) - (second.team.goalsFor - second.team.goalsAgainst)
      || second.position - first.position
      || first.team.name.localeCompare(second.team.name, 'pl'),
    )
    return candidates.slice(0, count)
  }
  for (const [groups, baseCount] of [
    [['lubuskie-a-1', 'lubuskie-a-2'], 1],
    [['lubuskie-a-3', 'lubuskie-a-4', 'lubuskie-a-5'], 2],
  ] as const) {
    const extraCount = groups.reduce((count, leagueId) => count + (additionalRelegationsByA.get(leagueId) ?? 0), 0)
    const additional = selectWorstAdditionalAClubs(groups, extraCount)
    for (const leagueId of groups) {
      const standings = rankTeams(world[leagueId] ?? [])
      const mandatory = standings.slice(-Math.min(standings.length, baseCount))
      const additionalForGroup = additional
        .filter((entry) => entry.leagueId === leagueId)
        .map((entry) => entry.team)
      aToB[leagueId] = [...mandatory, ...additionalForGroup]
    }
  }

  return { fourthToOkregowa, fourthDestinations, okregowaToA, aToB }
}

export type LeagueTableZones = {
  directPromotionRanks: number[]
  playoffRanks: number[]
  maintenancePlayoffRanks: number[]
  promotionCandidateRanks: number[]
  relegationRanks: number[]
}

export function getLeagueTableZones(game: GameState): LeagueTableZones {
  const leagueId = game.leagueId
  const tier = getLeagueTier(leagueId)
  const teamCount = game.teams.length
  const world = game.leagueWorld ?? { [leagueId]: game.teams }
  const directPromotionRanks: number[] = []
  const playoffRanks: number[] = []
  const maintenancePlayoffRanks: number[] = []
  const promotionCandidateRanks: number[] = []
  let relegationCount = 0
  let dynamicRelegationRanks: number[] | undefined
  const opolskiePlan = leagueId === 'fourth-opolskie' || leagueId.startsWith('opolskie-')
    ? getOpolskieRelegationPlan(
      world,
      game.promotionPlayoffs?.promotedByLeague,
      game.leagueSeasonExceptions,
      game.season,
    )
    : undefined
  const lubuskiePlan = leagueId === 'fourth-lubuskie' || leagueId.startsWith('lubuskie-')
    ? getLubuskieRelegationPlan(world)
    : undefined
  const leaders = (leagueIds: string[]) => leagueIds
    .filter((id) => world[id]?.length)
    .map((id) => ({ leagueId: id, team: rankTeams(world[id])[0] }))
    .filter((entry): entry is { leagueId: string; team: Team } => Boolean(entry.team))
    .sort((first, second) => leagueId.startsWith('lubuskie-')
      ? compareLubuskiePromotionCandidates(first.team, second.team)
      : comparePromotionCandidates(first.team, second.team))
  const markSelectedPosition = (sourceGroups: string[], position: number, count: number) => {
    sourceGroups
      .filter((id) => world[id]?.length)
      .map((id) => ({ leagueId: id, team: rankTeams(world[id])[position - 1] }))
      .filter((entry): entry is { leagueId: string; team: Team } => Boolean(entry.team))
      .sort((first, second) => leagueId.startsWith('lubuskie-')
        ? compareLubuskiePromotionCandidates(first.team, second.team)
        : comparePromotionCandidates(first.team, second.team))
      .slice(0, count)
      .forEach((entry) => {
        if (entry.leagueId === leagueId) directPromotionRanks.push(position)
      })
  }
  const markSelectedChampion = (sourceGroups: string[], count: number) => {
    markSelectedPosition(sourceGroups, 1, count)
  }

  const markLubuskieAreaPromotions = (promotionMap: Record<string, string[]>, runnerUpCount: number) => {
    Object.values(promotionMap).forEach((groups) => {
      markSelectedPosition(groups, 1, groups.length)
      markSelectedPosition(groups, 2, runnerUpCount)
    })
  }

  if (leagueId === 'first') {
    directPromotionRanks.push(1, 2)
    playoffRanks.push(3, 4, 5, 6)
    relegationCount = 3
  } else if (leagueId === 'second') {
    directPromotionRanks.push(1, 2)
    playoffRanks.push(3, 4, 5, 6)
    relegationCount = 4
  } else if (leagueId === 'third' || leagueId.startsWith('third-')) {
    directPromotionRanks.push(1)
    relegationCount = 4
  } else if (leagueId.startsWith('fourth-')) {
    for (const [thirdId, fourthIds] of Object.entries(thirdLeagueRegions)) {
      if (!fourthIds.includes(leagueId)) continue
      const relegated = rankTeams(world[thirdId] ?? []).slice(-fourthIds.length)
      const promotionCount = relegated.filter((team) =>
        (fourthIds.includes(team.regionId ?? '') ? team.regionId : fourthIds[0]) === leagueId,
      ).length
      directPromotionRanks.push(...Array.from({ length: promotionCount }, (_, index) => index + 1))
    }
    if (leagueId === 'fourth-lubuskie') {
      relegationCount = lubuskiePlan?.fourthToOkregowa.length ?? 3
    } else if (leagueId === 'fourth-opolskie') {
      const ranked = rankTeams(game.teams)
      const rankedRunnerUp = ranked[1]
      directPromotionRanks.push(...(opolskiePlan?.fourthToThird ?? [])
        .map((team) => ranked.findIndex((entry) => entry.id === team.id) + 1)
        .filter((rank) => rank > 0))
      if (opolskiePlan?.fourthToThird.some((team) => team.id === ranked[0]?.id)
        && rankedRunnerUp
        && isOpolskiePromotionEligible(rankedRunnerUp, game.leagueSeasonExceptions, game.season)) {
        playoffRanks.push(2)
      }
      dynamicRelegationRanks = opolskiePlan?.fourthToOkregowa
        .map((team) => ranked.findIndex((entry) => entry.id === team.id) + 1)
        .filter((rank) => rank > 0)
        .sort((first, second) => second - first)
    } else if (['fourth-podkarpackie', 'fourth-zachodniopomorskie', 'fourth-pomorskie', 'fourth-warminsko-mazurskie'].includes(leagueId)) {
      relegationCount = 2
    }
  } else if (tier === 6 && leagueId.includes('-okr-')) {
    relegationCount = 1
    if (leagueId.startsWith('lubuskie-okr-')) {
      directPromotionRanks.push(1, 2)
      dynamicRelegationRanks = lubuskiePlan?.okregowaToA[leagueId]
        .map((team) => rankTeams(game.teams).findIndex((ranked) => ranked.id === team.id) + 1)
        .filter((rank) => rank > 0)
        .sort((first, second) => second - first)
    } else if (leagueId.startsWith('podkarpackie-okr-')) {
      const groups = Object.keys(world).filter((id) => id.startsWith('podkarpackie-okr-')).sort()
      const champions = leaders(groups)
      if (world['fourth-podkarpackie'] && champions.length >= 5) {
        markSelectedChampion(groups, 1)
        if (champions.slice(1, 5).some((entry) => entry.leagueId === leagueId)) playoffRanks.push(1)
      }
    } else if (leagueId.startsWith('zachodniopomorskie-okr-')) {
      const groups = Object.keys(world).filter((id) => id.startsWith('zachodniopomorskie-okr-')).sort()
      const champions = leaders(groups)
      if (world['fourth-zachodniopomorskie'] && champions.length === 4) {
        markSelectedChampion(groups, 1)
        if (champions.slice(1).some((entry) => entry.leagueId === leagueId)) playoffRanks.push(1)
      }
    } else if (leagueId.startsWith('pomorskie-okr-')) {
      const groups = Object.keys(world).filter((id) => id.startsWith('pomorskie-okr-')).sort()
      const champions = leaders(groups)
      if (world['fourth-pomorskie'] && champions.length === 3) {
        markSelectedChampion(groups, 1)
        if (champions.slice(1).some((entry) => entry.leagueId === leagueId)) playoffRanks.push(1)
      }
    } else if (leagueId.startsWith('opolskie-okr-')) {
      const ranked = rankTeams(game.teams)
      directPromotionRanks.push(...(opolskiePlan?.okregowaToFourth[leagueId] ?? [])
        .map((team) => ranked.findIndex((entry) => entry.id === team.id) + 1)
        .filter((rank) => rank > 0))
      dynamicRelegationRanks = opolskiePlan?.okregowaToA[leagueId]
        .map((team) => ranked.findIndex((entry) => entry.id === team.id) + 1)
        .filter((rank) => rank > 0)
        .sort((first, second) => second - first)
      if (opolskiePlan?.okregowaPlayoffRank) {
        maintenancePlayoffRanks.push(opolskiePlan.okregowaPlayoffRank)
      }
    } else if (leagueId.startsWith('warminsko-mazurskie-okr-')) {
      directPromotionRanks.push(1)
    }
  } else if (tier === 7 && leagueId.includes('-a-')) {
    relegationCount = 1
    if (leagueId.startsWith('lubuskie-a-')) {
      dynamicRelegationRanks = lubuskiePlan?.aToB[leagueId]
        .map((team) => rankTeams(game.teams).findIndex((ranked) => ranked.id === team.id) + 1)
        .filter((rank) => rank > 0)
        .sort((first, second) => second - first)
      markLubuskieAreaPromotions(lubuskieAToOkregowa, 1)
    } else if (leagueId.startsWith('podkarpackie-a-')) {
      const district = getPodkarpackieDistrict(leagueId)
      if (district) {
        const groups = Object.keys(world)
          .filter((id) => id.startsWith('podkarpackie-a-') && getPodkarpackieDistrict(id) === district)
          .sort()
        markSelectedChampion(groups, 1)
      }
    } else if (leagueId.startsWith('opolskie-a-')) {
      const ranked = rankTeams(game.teams)
      const destinationId = Object.entries(opolskieAToOkregowa)
        .find(([, sourceIds]) => sourceIds.includes(leagueId))?.[0]
      directPromotionRanks.push(...(destinationId ? opolskiePlan?.aToOkregowa[destinationId] ?? [] : [])
        .map((team) => ranked.findIndex((entry) => entry.id === team.id) + 1)
        .filter((rank) => rank > 0))
      dynamicRelegationRanks = opolskiePlan?.aToB[leagueId]
        .map((team) => ranked.findIndex((entry) => entry.id === team.id) + 1)
        .filter((rank) => rank > 0)
        .sort((first, second) => second - first)
    } else {
      const sourceMaps = [
        zachodniopomorskieOkregowaFeeders,
        pomorskieAToOkregowa,
        warminskoMazurskieAToOkregowa,
        opolskieAToOkregowa,
        lubuskieAToOkregowa,
      ]
      sourceMaps.forEach((sourceMap) => {
        Object.values(sourceMap).forEach((groups) => {
          if (groups.includes(leagueId)) markSelectedChampion(groups, 1)
        })
      })
    }
  } else if (tier === 8 && leagueId.includes('-b-')) {
    if (leagueId.startsWith('lubuskie-b-')) {
      directPromotionRanks.push(1)
      markSelectedPosition(lubuskieGorzowskieBGroups, 2, 1)
      markSelectedPosition(lubuskieZielonogorskieBGroups, 2, 2)
    } else if (leagueId.startsWith('opolskie-b-')) {
      const destinationId = Object.entries(opolskieBToA)
        .find(([, sourceIds]) => sourceIds.includes(leagueId))?.[0]
      const selected = destinationId ? opolskiePlan?.bToA[destinationId] ?? [] : []
      const ranked = rankTeams(game.teams)
      directPromotionRanks.push(...selected
        .map((team) => ranked.findIndex((entry) => entry.id === team.id) + 1)
        .filter((rank) => rank > 0))
    } else if (leagueId.startsWith('podkarpackie-b-')) {
      const district = getPodkarpackieDistrict(leagueId)
      if (district) {
        const destinationGroups = Object.keys(world)
          .filter((id) => id.startsWith('podkarpackie-a-') && getPodkarpackieDistrict(id) === district)
          .sort()
        const sourceGroups = Object.keys(world)
          .filter((id) => id.startsWith('podkarpackie-b-') && getPodkarpackieDistrict(id) === district)
          .sort()
        markSelectedChampion(sourceGroups, destinationGroups.length)
      }
    } else if (leagueId.startsWith('zachodniopomorskie-b-')) {
      const sourceGroups = Object.keys(world).filter((id) => id.startsWith('zachodniopomorskie-b-')).sort()
      const destinationCount = Object.keys(world).filter((id) => id.startsWith('zachodniopomorskie-a-')).length
      const champions = leaders(sourceGroups)
      const promotionCount = Math.min(destinationCount, champions.length)
      const hasPromotionPlayoff = champions.length > promotionCount && promotionCount > 0
      const directPromotionCount = hasPromotionPlayoff ? promotionCount - 1 : promotionCount
      const directPromoted = champions.slice(0, directPromotionCount)
      directPromoted.forEach((entry) => {
        if (entry.leagueId === leagueId) directPromotionRanks.push(1)
      })
      const playoffCandidates = champions.slice(directPromotionCount, directPromotionCount + 2)
      const isDirectPromotion = directPromoted.some((entry) => entry.leagueId === leagueId)
      const isPlayoffCandidate = playoffCandidates.some((entry) => entry.leagueId === leagueId)
      if (isPlayoffCandidate && hasPromotionPlayoff) {
        playoffRanks.push(1)
      } else if (!isDirectPromotion && champions.some((entry) => entry.leagueId === leagueId)) {
        promotionCandidateRanks.push(1)
      }
    } else {
      const sourceMaps = [pomorskieBToA, warminskoMazurskieBToA, opolskieBToA, lubuskieBToA]
      sourceMaps.forEach((sourceMap) => {
        Object.values(sourceMap).forEach((groups) => {
          if (groups.includes(leagueId)) markSelectedChampion(groups, 1)
        })
      })
    }
  } else if (leagueId === 'ekstraklasa') {
    relegationCount = 3
  }

  const relegationRanks = dynamicRelegationRanks ?? Array.from(
    { length: Math.min(relegationCount, teamCount) },
    (_, index) => teamCount - index,
  )
  return { directPromotionRanks, playoffRanks, maintenancePlayoffRanks, promotionCandidateRanks, relegationRanks }
}

function applyPodkarpackiePromotions(world: Record<string, Team[]>, promotedByLeague: Record<string, string>) {
  const lowerGroups = Object.keys(world).filter((leagueId) => leagueId.startsWith('podkarpackie-'))
  const tierGroups = new Map<LeagueTier, string[]>()
  for (const leagueId of lowerGroups) {
    const tier = getLeagueTier(leagueId as LeagueId)
    tierGroups.set(tier, [...(tierGroups.get(tier) ?? []), leagueId])
  }
  const summaries: string[] = []
  const okregowaGroups = tierGroups.get(6) ?? []
  const rankedChampions = okregowaGroups
    .map((leagueId) => ({ leagueId, team: rankTeams(world[leagueId])[0] }))
    .filter((entry): entry is { leagueId: string; team: Team } => Boolean(entry.team))
    .sort((first, second) => comparePromotionCandidates(first.team, second.team))

  const classBGroups = tierGroups.get(8) ?? []
  const classAGroups = tierGroups.get(7) ?? []
  const districtGroups = (groups: string[], district: string) =>
    groups.filter((leagueId) => getPodkarpackieDistrict(leagueId) === district)

  for (const district of podkarpackieDistricts) {
    const destinationGroups = districtGroups(classAGroups, district).sort()
    const sourceGroups = districtGroups(classBGroups, district).sort()
    if (!destinationGroups.length || !sourceGroups.length) continue
    const qualifiers = sourceGroups.map((leagueId) => ({
      team: rankTeams(world[leagueId])[0],
      sourceId: leagueId,
    })).filter((candidate): candidate is { team: Team; sourceId: string } => Boolean(candidate.team))
      .sort((first, second) => comparePromotionCandidates(first.team, second.team))
    const promotionCount = Math.min(destinationGroups.length, qualifiers.length)
    for (let index = 0; index < promotionCount; index += 1) {
      const promoted = qualifiers[index]
      const destinationId = destinationGroups[index]
      const relegated = rankTeams(world[destinationId]).at(-1)
      if (!relegated) continue
      world[destinationId] = world[destinationId].filter((team) => team !== relegated)
      world[promoted.sourceId] = world[promoted.sourceId].filter((team) => team !== promoted.team)
      world[destinationId].push(resetTeam(promoted.team, Math.min(85, promoted.team.strength + 3)))
      world[promoted.sourceId].push(resetTeam(relegated, Math.max(29, relegated.strength - 3)))
    }
  }

  for (const district of podkarpackieDistricts) {
    const upperId = districtGroups(okregowaGroups, district)[0]
    const feederGroups = districtGroups(classAGroups, district).sort()
    const upper = upperId ? world[upperId] : undefined
    if (!upper || !feederGroups.length) continue
    const promotedCandidate = feederGroups
      .map((leagueId) => ({ team: rankTeams(world[leagueId])[0], leagueId }))
      .filter((candidate): candidate is { team: Team; leagueId: string } => Boolean(candidate.team))
      .sort((first, second) => comparePromotionCandidates(first.team, second.team))[0]
    const relegated = rankTeams(upper).at(-1)
    if (!promotedCandidate || !relegated) continue
    world[upperId] = upper.filter((team) => team !== relegated)
    world[promotedCandidate.leagueId] = world[promotedCandidate.leagueId].filter((team) => team !== promotedCandidate.team)
    world[upperId].push(resetTeam(promotedCandidate.team, Math.min(85, promotedCandidate.team.strength + 3)))
    world[promotedCandidate.leagueId].push(resetTeam(relegated, Math.max(33, relegated.strength - 3)))
  }

  const fourthLeague = world['fourth-podkarpackie']
  if (fourthLeague && rankedChampions.length >= 5) {
    const directPromoted = rankedChampions[0]
    const playoffCandidates = rankedChampions.slice(1)
    const scheduledWinnerId = promotedByLeague['playoff:podkarpackie-fourth']
    const scheduledWinner = playoffCandidates.find(({ team }) => team.id === scheduledWinnerId)?.team
    const firstSemi = scheduledWinner ? undefined : decidePlayoffTie(playoffCandidates[0].team, playoffCandidates[3].team)
    const secondSemi = scheduledWinner ? undefined : decidePlayoffTie(playoffCandidates[1].team, playoffCandidates[2].team)
    const finalWinner = scheduledWinner ?? decidePlayoffTie(
      firstSemi?.winner ?? playoffCandidates[0].team,
      secondSemi?.winner ?? playoffCandidates[1].team,
    ).winner
    const promotions = [directPromoted, {
      leagueId: playoffCandidates.find((candidate) => candidate.team === finalWinner)?.leagueId ?? '',
      team: finalWinner,
    }]
    const relegatedTeams = rankTeams(fourthLeague).slice(-promotions.length)
    world['fourth-podkarpackie'] = fourthLeague.filter((team) => !relegatedTeams.includes(team))
    for (const [index, promotion] of promotions.entries()) {
      const promoted = promotion.team
      const sourceId = promotion.leagueId
      const relegated = relegatedTeams[index]
      if (!sourceId || !relegated) throw new Error('Nie udało się dopasować awansującego klubu Podkarpacia do grupy spadkowej.')
      world[sourceId] = world[sourceId].filter((team) => team !== promoted)
      world[sourceId].push(resetTeam(relegated, Math.max(37, relegated.strength - 3)))
      world['fourth-podkarpackie'].push(resetTeam(promoted, Math.min(85, promoted.strength + 3)))
    }
    summaries.push(`Podkarpackie: ${directPromoted.team.name} awansował do IV ligi jako mistrz okręgówki, a ${finalWinner.name} wygrał baraże o drugie miejsce.`)
  }
  return summaries
}

function applyZachodniopomorskiePromotions(world: Record<string, Team[]>, promotedByLeague: Record<string, string>) {
  const okregowaGroups = Object.keys(world).filter((leagueId) => leagueId.startsWith('zachodniopomorskie-okr-')).sort()
  const classAGroups = Object.keys(world).filter((leagueId) => leagueId.startsWith('zachodniopomorskie-a-')).sort()
  const classBGroups = Object.keys(world).filter((leagueId) => leagueId.startsWith('zachodniopomorskie-b-')).sort()
  const summaries: string[] = []
  const champions = okregowaGroups
    .map((leagueId) => ({ leagueId, team: rankTeams(world[leagueId])[0] }))
    .filter((entry): entry is { leagueId: string; team: Team } => Boolean(entry.team))
    .sort((first, second) => comparePromotionCandidates(first.team, second.team))

  const bChampions = classBGroups
    .map((leagueId) => ({ leagueId, team: rankTeams(world[leagueId])[0] }))
    .filter((entry): entry is { leagueId: string; team: Team } => Boolean(entry.team))
    .sort((first, second) => comparePromotionCandidates(first.team, second.team))
  const aPromotionCount = Math.min(classAGroups.length, bChampions.length)
  const hasPromotionPlayoff = bChampions.length > aPromotionCount && aPromotionCount > 0
  const directPromotionCount = hasPromotionPlayoff ? aPromotionCount - 1 : aPromotionCount
  const promotedBChampions = bChampions.slice(0, directPromotionCount)
  let promotionPlayoffSummary = ''
  if (hasPromotionPlayoff) {
    const finalists = bChampions.slice(directPromotionCount, directPromotionCount + 2)
    if (finalists.length !== 2) throw new Error('Nie udało się wyłonić drużyn do barażu o awans do A klasy.')
    const playoffWinnerId = promotedByLeague['playoff:zachodniopomorskie-a']
    const playoff = playoffWinnerId
      ? { winner: finalists.find((candidate) => candidate.team.id === playoffWinnerId)?.team }
      : decidePlayoffTie(finalists[0].team, finalists[1].team)
    const winner = finalists.find((candidate) => candidate.team === playoff.winner)
    if (!winner) throw new Error('Nie udało się ustalić zwycięzcy barażu o awans do A klasy.')
    promotedBChampions.push(winner)
    promotionPlayoffSummary = `Baraż o ostatnie miejsce w A klasie: ${finalists[0].team.name} – ${finalists[1].team.name}; awansuje ${winner.team.name}.`
  } else if (aPromotionCount < bChampions.length) {
    promotedBChampions.push(...bChampions.slice(directPromotionCount, aPromotionCount))
  }
  const promotedFromB: string[] = []
  for (let index = 0; index < promotedBChampions.length; index += 1) {
    const promoted = promotedBChampions[index]
    const destinationId = classAGroups[index]
    const relegated = rankTeams(world[destinationId]).at(-1)
    if (!relegated) continue
    world[destinationId] = world[destinationId].filter((team) => team !== relegated)
    world[promoted.leagueId] = world[promoted.leagueId].filter((team) => team !== promoted.team)
    world[destinationId].push(resetTeam(promoted.team, Math.min(85, promoted.team.strength + 3)))
    world[promoted.leagueId].push(resetTeam(relegated, Math.max(29, relegated.strength - 3)))
    promotedFromB.push(promoted.team.name)
  }
  if (promotionPlayoffSummary) summaries.push(promotionPlayoffSummary)
  if (promotedFromB.length) summaries.push(`Zachodniopomorskie: do klasy A awansują z klasy B ${promotedFromB.join(', ')}.`)

  const promotedFromA: string[] = []
  for (const [upperId, feederGroups] of Object.entries(zachodniopomorskieOkregowaFeeders)) {
    const upper = world[upperId]
    const feeder = feederGroups
      .filter((leagueId) => world[leagueId])
      .map((leagueId) => ({ leagueId, team: rankTeams(world[leagueId])[0] }))
      .filter((entry): entry is { leagueId: string; team: Team } => Boolean(entry.team))
      .sort((first, second) => comparePromotionCandidates(first.team, second.team))[0]
    const relegated = upper ? rankTeams(upper).at(-1) : undefined
    if (!upper || !feeder || !relegated) continue
    world[upperId] = upper.filter((team) => team !== relegated)
    world[feeder.leagueId] = world[feeder.leagueId].filter((team) => team !== feeder.team)
    world[upperId].push(resetTeam(feeder.team, Math.min(85, feeder.team.strength + 3)))
    world[feeder.leagueId].push(resetTeam(relegated, Math.max(33, relegated.strength - 3)))
    promotedFromA.push(feeder.team.name)
  }
  if (promotedFromA.length) summaries.push(`Zachodniopomorskie: do klasy okręgowej awansują ${promotedFromA.join(', ')}.`)

  const fourthLeague = world['fourth-zachodniopomorskie']
  if (fourthLeague && champions.length === 4) {
    const directPromoted = champions[0]
    const playoffCandidates = champions.slice(1)
    const scheduledWinnerId = promotedByLeague['playoff:zachodniopomorskie-fourth']
    const semiFinal = scheduledWinnerId ? undefined : decidePlayoffTie(playoffCandidates[1].team, playoffCandidates[2].team)
    const finalWinner = scheduledWinnerId
      ? playoffCandidates.find((candidate) => candidate.team.id === scheduledWinnerId)?.team
      : playoffCandidates.find((candidate) => candidate.team === decidePlayoffTie(playoffCandidates[0].team, semiFinal?.winner ?? playoffCandidates[1].team).winner)?.team
        ?? playoffCandidates.find((candidate) => candidate.team === semiFinal?.winner)?.team
    const playoffWinner = playoffCandidates.find((candidate) => candidate.team === finalWinner)
    const promotions = [directPromoted, playoffWinner]
    const relegatedTeams = rankTeams(fourthLeague).slice(-promotions.length)
    world['fourth-zachodniopomorskie'] = fourthLeague.filter((team) => !relegatedTeams.includes(team))
    for (const [index, promotion] of promotions.entries()) {
      const relegated = relegatedTeams[index]
      if (!promotion || !relegated) throw new Error('Nie udało się dopasować awansującego klubu Zachodniopomorskiego do grupy spadkowej.')
      world[promotion.leagueId] = world[promotion.leagueId].filter((team) => team !== promotion.team)
      world[promotion.leagueId].push(resetTeam(relegated, Math.max(37, relegated.strength - 3)))
      world['fourth-zachodniopomorskie'].push(resetTeam(promotion.team, Math.min(85, promotion.team.strength + 3)))
    }
    if (!playoffWinner) throw new Error('Nie udało się ustalić zwycięzcy baraży Zachodniopomorskiego.')
    summaries.push(`Zachodniopomorskie: ${directPromoted.team.name} awansował do IV ligi jako mistrz okręgówki, a ${playoffWinner.team.name} wygrał baraże o drugie miejsce.`)
  }
  return summaries
}

function applyPomorskiePromotions(world: Record<string, Team[]>, promotedByLeague: Record<string, string>) {
  const summaries: string[] = []
  const champions = Object.keys(pomorskieAToOkregowa)
    .map((leagueId) => ({ leagueId, team: rankTeams(world[leagueId])[0] }))
    .filter((entry): entry is { leagueId: string; team: Team } => Boolean(entry.team))
    .sort((first, second) => comparePromotionCandidates(first.team, second.team))
  const promotedFromB: string[] = []
  for (const [destinationId, sourceIds] of Object.entries(pomorskieBToA)) {
    const promoted = sourceIds
      .filter((leagueId) => world[leagueId])
      .map((leagueId) => ({ leagueId, team: rankTeams(world[leagueId])[0] }))
      .filter((entry): entry is { leagueId: string; team: Team } => Boolean(entry.team))
      .sort((first, second) => comparePromotionCandidates(first.team, second.team))[0]
    const destination = world[destinationId]
    const relegated = destination ? rankTeams(destination).at(-1) : undefined
    if (!promoted || !destination || !relegated) continue
    world[destinationId] = destination.filter((team) => team !== relegated)
    world[promoted.leagueId] = world[promoted.leagueId].filter((team) => team !== promoted.team)
    world[destinationId].push(resetTeam(promoted.team, Math.min(85, promoted.team.strength + 3)))
    world[promoted.leagueId].push(resetTeam(relegated, Math.max(29, relegated.strength - 3)))
    promotedFromB.push(promoted.team.name)
  }
  if (promotedFromB.length) summaries.push(`Pomorskie: do klasy A awansują z klasy B ${promotedFromB.join(', ')}.`)

  const promotedFromA: string[] = []
  for (const [destinationId, sourceIds] of Object.entries(pomorskieAToOkregowa)) {
    const promoted = sourceIds
      .filter((leagueId) => world[leagueId])
      .map((leagueId) => ({ leagueId, team: rankTeams(world[leagueId])[0] }))
      .filter((entry): entry is { leagueId: string; team: Team } => Boolean(entry.team))
      .sort((first, second) => comparePromotionCandidates(first.team, second.team))[0]
    const destination = world[destinationId]
    const relegated = destination ? rankTeams(destination).at(-1) : undefined
    if (!promoted || !destination || !relegated) continue
    world[destinationId] = destination.filter((team) => team !== relegated)
    world[promoted.leagueId] = world[promoted.leagueId].filter((team) => team !== promoted.team)
    world[destinationId].push(resetTeam(promoted.team, Math.min(85, promoted.team.strength + 3)))
    world[promoted.leagueId].push(resetTeam(relegated, Math.max(33, relegated.strength - 3)))
    promotedFromA.push(promoted.team.name)
  }
  if (promotedFromA.length) summaries.push(`Pomorskie: do klasy okręgowej awansują ${promotedFromA.join(', ')}.`)

  const fourthLeague = world['fourth-pomorskie']
  if (fourthLeague && champions.length === 3) {
    const scheduledWinnerId = promotedByLeague['playoff:pomorskie-fourth']
    const playoffWinner = scheduledWinnerId
      ? champions.find((candidate) => candidate.team.id === scheduledWinnerId)?.team
      : decidePlayoffTie(champions[1].team, champions[2].team).winner
    const promotions = [champions[0], champions.find((candidate) => candidate.team === playoffWinner)]
    const relegatedTeams = rankTeams(fourthLeague).slice(-promotions.length)
    world['fourth-pomorskie'] = fourthLeague.filter((team) => !relegatedTeams.includes(team))
    for (const [index, promotion] of promotions.entries()) {
      const relegated = relegatedTeams[index]
      if (!promotion || !relegated) throw new Error('Nie udało się dopasować awansującego klubu Pomorskiego do grupy spadkowej.')
      world[promotion.leagueId] = world[promotion.leagueId].filter((team) => team !== promotion.team)
      world[promotion.leagueId].push(resetTeam(relegated, Math.max(37, relegated.strength - 3)))
      world['fourth-pomorskie'].push(resetTeam(promotion.team, Math.min(85, promotion.team.strength + 3)))
    }
    if (!playoffWinner) throw new Error('Nie udało się ustalić zwycięzcy baraży Pomorskiego.')
    summaries.push(`Pomorskie: ${champions[0].team.name} awansował do IV ligi jako mistrz okręgówki, a ${playoffWinner.name} wygrał baraże o drugie miejsce.`)
  }
  return summaries
}

function applyWarminskoMazurskiePromotions(world: Record<string, Team[]>) {
  const summaries: string[] = []
  const promotedFromB: string[] = []
  for (const [destinationId, sourceIds] of Object.entries(warminskoMazurskieBToA)) {
    const promoted = sourceIds
      .filter((leagueId) => world[leagueId])
      .map((leagueId) => ({ leagueId, team: rankTeams(world[leagueId])[0] }))
      .filter((entry): entry is { leagueId: string; team: Team } => Boolean(entry.team))
      .sort((first, second) => comparePromotionCandidates(first.team, second.team))[0]
    const destination = world[destinationId]
    const relegated = destination ? rankTeams(destination).at(-1) : undefined
    if (!promoted || !destination || !relegated) continue
    world[destinationId] = destination.filter((team) => team !== relegated)
    world[promoted.leagueId] = world[promoted.leagueId].filter((team) => team !== promoted.team)
    world[destinationId].push(resetTeam(promoted.team, Math.min(85, promoted.team.strength + 3)))
    world[promoted.leagueId].push(resetTeam(relegated, Math.max(29, relegated.strength - 3)))
    promotedFromB.push(promoted.team.name)
  }
  if (promotedFromB.length) summaries.push(`Warmia i Mazury: do klasy A awansują z klasy B ${promotedFromB.join(', ')}.`)

  const promotedFromA: string[] = []
  for (const [destinationId, sourceIds] of Object.entries(warminskoMazurskieAToOkregowa)) {
    const promoted = sourceIds
      .filter((leagueId) => world[leagueId])
      .map((leagueId) => ({ leagueId, team: rankTeams(world[leagueId])[0] }))
      .filter((entry): entry is { leagueId: string; team: Team } => Boolean(entry.team))
      .sort((first, second) => comparePromotionCandidates(first.team, second.team))[0]
    const destination = world[destinationId]
    const relegated = destination ? rankTeams(destination).at(-1) : undefined
    if (!promoted || !destination || !relegated) continue
    world[destinationId] = destination.filter((team) => team !== relegated)
    world[promoted.leagueId] = world[promoted.leagueId].filter((team) => team !== promoted.team)
    world[destinationId].push(resetTeam(promoted.team, Math.min(85, promoted.team.strength + 3)))
    world[promoted.leagueId].push(resetTeam(relegated, Math.max(33, relegated.strength - 3)))
    promotedFromA.push(promoted.team.name)
  }
  if (promotedFromA.length) summaries.push(`Warmia i Mazury: do klasy okręgowej awansują ${promotedFromA.join(', ')}.`)

  const okregowaGroups = Object.keys(warminskoMazurskieLeagueGroups)
    .filter((leagueId) => leagueId.startsWith('warminsko-mazurskie-okr-'))
    .sort()
  const fourthLeague = world['fourth-warminsko-mazurskie']
  const promotions = okregowaGroups
    .map((leagueId) => ({ leagueId, team: rankTeams(world[leagueId])[0] }))
    .filter((entry): entry is { leagueId: string; team: Team } => Boolean(entry.team))
    .sort((first, second) => comparePromotionCandidates(first.team, second.team))
  if (fourthLeague && promotions.length === okregowaGroups.length) {
    const relegatedTeams = rankTeams(fourthLeague).slice(-promotions.length)
    world['fourth-warminsko-mazurskie'] = fourthLeague.filter((team) => !relegatedTeams.includes(team))
    for (const [index, promotion] of promotions.entries()) {
      const relegated = relegatedTeams[index]
      if (!relegated) throw new Error('Nie udało się dopasować awansującego klubu Warmii i Mazur do grupy spadkowej.')
      world[promotion.leagueId] = world[promotion.leagueId].filter((team) => team !== promotion.team)
      world[promotion.leagueId].push(resetTeam(relegated, Math.max(37, relegated.strength - 3)))
      world['fourth-warminsko-mazurskie'].push(resetTeam(promotion.team, Math.min(85, promotion.team.strength + 3)))
    }
    summaries.push(`Warmia i Mazury: do IV ligi awansują ${promotions.map(({ team }) => team.name).join(' oraz ')}.`)
  }
  return summaries
}

function moveRegionalTeams(
  world: Record<string, Team[]>,
  relegatedByGroup: Record<string, Team[]>,
  promotedByLeague: PromotionPlayoffs['promotedByLeague'] = {},
  opolskiePlan?: OpolskieRelegationPlan,
  exceptions?: LeagueSeasonExceptions,
  season?: string,
) {
  for (const [thirdId, fourthIds] of Object.entries(thirdLeagueRegions)) {
    const third = world[thirdId]
    if (!third) continue
    const relegated = relegatedByGroup[thirdId] ?? []
    world[thirdId] = third.filter((team) => !relegated.includes(team))
    const relegatedByRegion = new Map(fourthIds.map((id) => [id, [] as Team[]]))
    for (const team of relegated) {
      const regionId = fourthIds.includes(team.regionId ?? '') ? team.regionId as string : fourthIds[0]
      relegatedByRegion.get(regionId)?.push(team)
    }
    for (const fourthId of fourthIds) {
      const fourth = world[fourthId]
      if (!fourth) continue
      let regionalRelegations = relegatedByRegion.get(fourthId) ?? []
      const rankedFourth = rankTeams(fourth)
      const guaranteedPromotions = fourthId === 'fourth-opolskie'
        ? [
          ...(opolskiePlan?.fourthToThird ?? []),
          ...(promotedByLeague['playoff:opolskie-fourth'] === rankedFourth[1]?.id ? [rankedFourth[1]] : []),
        ].filter((team): team is Team => Boolean(team))
        : []
      const playoffWinner = promotedByLeague['playoff:opolskie-fourth']
        ? fourthIds.flatMap((id) => world[id] ?? []).find((team) =>
          team.id === promotedByLeague['playoff:opolskie-fourth'],
        )
        : undefined
      if (playoffWinner && fourthId !== 'fourth-opolskie' && playoffWinner.regionId === fourthId) {
        guaranteedPromotions.push(playoffWinner)
      }
      const selectedPromotionIds = new Set(guaranteedPromotions.map((team) => team.id))
      for (const team of rankedFourth.slice(0, 3).filter((candidate) =>
        isOpolskiePromotionEligible(candidate, exceptions, season),
      )) {
        if (selectedPromotionIds.size >= Math.max(regionalRelegations.length, guaranteedPromotions.length)) break
        selectedPromotionIds.add(team.id)
      }
      const regionalPromotions = rankedFourth.filter((team) => selectedPromotionIds.has(team.id))
      if (fourthId === 'fourth-opolskie' && regionalRelegations.length > regionalPromotions.length) {
        regionalRelegations = regionalRelegations.slice(regionalRelegations.length - regionalPromotions.length)
      }
      world[fourthId] = fourth.filter((team) => !regionalPromotions.includes(team))
      world[thirdId].push(...regionalPromotions.map((team) => resetTeam(team, Math.min(85, team.strength + 3))))
      world[fourthId].push(...regionalRelegations.map((team) => resetTeam(team, Math.max(42, team.strength - 3))))
    }
  }
}

function applyOpolskiePromotions(
  world: Record<string, Team[]>,
  promotedByLeague: PromotionPlayoffs['promotedByLeague'],
  relegationPlan: OpolskieRelegationPlan,
) {
  const summaries: string[] = []
  const standings = Object.fromEntries(
    ['fourth-opolskie', ...Object.keys(opolskieLeagueGroups)]
      .map((leagueId) => [leagueId, rankTeams(world[leagueId] ?? [])]),
  ) as Record<string, Team[]>
  const transfer = (team: Team, sourceId: string, destinationId: string, strengthDelta: number, minStrength: number) => {
    const source = world[sourceId]
    const destination = world[destinationId]
    if (!source || !destination || !source.some((club) => club.id === team.id)) return false
    world[sourceId] = source.filter((club) => club.id !== team.id)
    destination.push(resetTeam(team, Math.max(minStrength, Math.min(85, team.strength + strengthDelta))))
    return true
  }
  const distribute = (team: Team, sourceId: string, destinationIds: string[], strengthDelta: number, minStrength: number) => {
    const destinationId = [...destinationIds]
      .filter((id) => world[id])
      .sort((first, second) => world[first].length - world[second].length || first.localeCompare(second))[0]
    return destinationId
      ? transfer(team, sourceId, destinationId, strengthDelta, minStrength)
      : false
  }

  const promotedFromB: string[] = []
  for (const [destinationId, teams] of Object.entries(relegationPlan.bToA)) {
    const sourceIds = opolskieBToA[destinationId] ?? []
    for (const team of teams) {
      const sourceId = sourceIds.find((id) => standings[id]?.some((club) => club.id === team.id))
      if (sourceId && transfer(team, sourceId, destinationId, 3, 29)) {
        promotedFromB.push(team.name)
      }
    }
  }
  if (promotedFromB.length) {
    summaries.push(`Opolskie: do klasy A awansują mistrzowie grup B: ${promotedFromB.join(', ')}.`)
  }

  const relegatedFromA: string[] = []
  for (const [sourceId, relegated] of Object.entries(relegationPlan.aToB)) {
    const destinations = opolskieBToA[sourceId] ?? []
    for (const team of relegated) {
      if (distribute(team, sourceId, destinations, -3, 29)) relegatedFromA.push(team.name)
    }
  }
  if (relegatedFromA.length) {
    summaries.push(`Opolskie: do klasy B spadają ${relegatedFromA.join(', ')}.`)
  }

  const promotedFromA: string[] = []
  for (const [destinationId, teams] of Object.entries(relegationPlan.aToOkregowa)) {
    const sourceIds = opolskieAToOkregowa[destinationId] ?? []
    for (const team of teams) {
      const sourceId = sourceIds.find((id) => standings[id]?.some((club) => club.id === team.id))
      if (sourceId && transfer(team, sourceId, destinationId, 3, 33)) {
        promotedFromA.push(team.name)
      }
    }
  }
  if (promotedFromA.length) {
    summaries.push(`Opolskie: do klasy okręgowej awansują z klasy A ${promotedFromA.join(', ')}.`)
  }

  const relegatedFromOkregowa: string[] = []
  for (const [sourceId, relegated] of Object.entries(relegationPlan.okregowaToA)) {
    const destinations = opolskieAToOkregowa[sourceId] ?? []
    for (const team of relegated) {
      if (distribute(team, sourceId, destinations, -3, 33)) relegatedFromOkregowa.push(team.name)
    }
  }
  if (relegationPlan.okregowaPlayoffRank) {
    const playoffTeams = ['opolskie-okr-1', 'opolskie-okr-2']
      .map((leagueId) => ({
        leagueId,
        team: standings[leagueId]?.[relegationPlan.okregowaPlayoffRank! - 1],
      }))
      .filter((entry): entry is { leagueId: string; team: Team } => Boolean(entry.team))
    if (playoffTeams.length === 2) {
      const survivorId = promotedByLeague['playoff:opolskie-okr-survival']
      const survivor = playoffTeams.find(({ team }) => team.id === survivorId)?.team
        ?? decidePlayoffTie(playoffTeams[0].team, playoffTeams[1].team).winner
      const relegated = playoffTeams.find(({ team }) => team.id !== survivor.id)
      if (relegated && distribute(
        relegated.team,
        relegated.leagueId,
        opolskieAToOkregowa[relegated.leagueId] ?? [],
        -3,
        33,
      )) {
        relegatedFromOkregowa.push(relegated.team.name)
        summaries.push(`Opolskie: baraż o utrzymanie w klasie okręgowej wygrał ${survivor.name}; spada ${relegated.team.name}.`)
      }
    }
  }
  if (relegatedFromOkregowa.length) {
    summaries.push(`Opolskie: z klasy okręgowej do A-klasy spadają ${relegatedFromOkregowa.join(', ')}.`)
  }

  const promotedFromOkregowa: string[] = []
  const fourthLeague = world['fourth-opolskie']
  for (const [sourceId, teams] of Object.entries(relegationPlan.okregowaToFourth)) {
    for (const team of teams) {
      if (fourthLeague && transfer(team, sourceId, 'fourth-opolskie', 3, 37)) {
        promotedFromOkregowa.push(team.name)
      }
    }
  }
  if (promotedFromOkregowa.length) {
    summaries.push(`Opolskie: do IV ligi awansują mistrzowie i wicemistrzowie obu grup okręgówki: ${promotedFromOkregowa.join(', ')}.`)
  }

  const relegatedFromFourth: string[] = []
  for (const team of relegationPlan.fourthToOkregowa) {
    if (distribute(team, 'fourth-opolskie', ['opolskie-okr-1', 'opolskie-okr-2'], -3, 37)) {
      relegatedFromFourth.push(team.name)
    }
  }
  if (relegatedFromFourth.length) {
    summaries.push(`Opolskie: z IV ligi spadają ${relegatedFromFourth.join(', ')}.`)
  }
  return summaries
}

function applyLubuskiePromotions(world: Record<string, Team[]>, relegatedFromThird: Team[] = []) {
  const summaries: string[] = []
  const relegationPlan = getLubuskieRelegationPlan(world, relegatedFromThird)
  const allLeagueIds = ['fourth-lubuskie', ...Object.keys(lubuskieLeagueGroups)]
  const standings = Object.fromEntries(
    allLeagueIds.map((leagueId) => [leagueId, rankTeams(world[leagueId] ?? [])]),
  )
  const movedTeamIds = new Set<string>()
  const transfer = (team: Team | undefined, sourceId: string, destinationId: string, strengthDelta: number, minStrength: number) => {
    const source = world[sourceId]
    const destination = world[destinationId]
    if (!team || !source || !destination || movedTeamIds.has(team.id)) return false
    if (!source.some((club) => club.id === team.id)) return false
    world[sourceId] = source.filter((club) => club.id !== team.id)
    world[destinationId] = [...destination, resetTeam(team, Math.max(minStrength, Math.min(85, team.strength + strengthDelta)))]
    movedTeamIds.add(team.id)
    return true
  }
  const teamAt = (leagueId: string, position: number) => standings[leagueId]?.[position - 1]
  const bestPosition = (leagueIds: string[], position: number, count: number) => leagueIds
    .map((leagueId) => ({ leagueId, team: teamAt(leagueId, position) }))
    .filter((entry): entry is { leagueId: string; team: Team } => Boolean(entry.team))
    .sort((first, second) => compareLubuskiePromotionCandidates(first.team, second.team))
    .slice(0, count)
  const routeEvenly = (destinationIds: string[], teams: Team[], sourceId: string, strengthDelta: number, minStrength: number) => {
    let moved = 0
    teams.forEach((team, index) => {
      const destinationId = destinationIds[index % destinationIds.length]
      if (destinationId && transfer(team, sourceId, destinationId, strengthDelta, minStrength)) moved += 1
    })
    return moved
  }

  const bToAByGroup = new Map<string, string>()
  Object.entries(lubuskieBToA).forEach(([destinationId, sourceIds]) => {
    sourceIds.forEach((sourceId) => bToAByGroup.set(sourceId, destinationId))
  })
  const promotedFromB: string[] = []
  for (const [sourceId, destinationId] of bToAByGroup) {
    const champion = teamAt(sourceId, 1)
    if (transfer(champion, sourceId, destinationId, 3, 29) && champion) promotedFromB.push(champion.name)
  }
  for (const [groups, count] of [[lubuskieGorzowskieBGroups, 1], [lubuskieZielonogorskieBGroups, 2]] as const) {
    bestPosition(groups, 2, count).forEach(({ leagueId, team }) => {
      const destinationId = bToAByGroup.get(leagueId)
      if (destinationId && transfer(team, leagueId, destinationId, 3, 29)) promotedFromB.push(team.name)
    })
  }
  if (promotedFromB.length) summaries.push(`Lubuskie: do klasy A awansują z klasy B ${promotedFromB.join(', ')}.`)

  const promotedFromA: string[] = []
  for (const [destinationId, sourceIds] of Object.entries(lubuskieAToOkregowa)) {
    for (const sourceId of sourceIds) {
      const champion = teamAt(sourceId, 1)
      if (transfer(champion, sourceId, destinationId, 3, 33) && champion) promotedFromA.push(champion.name)
    }
    bestPosition(sourceIds, 2, 1).forEach(({ leagueId, team }) => {
      if (transfer(team, leagueId, destinationId, 3, 33)) promotedFromA.push(team.name)
    })
  }
  if (promotedFromA.length) summaries.push(`Lubuskie: do klasy okręgowej awansują ${promotedFromA.join(', ')}.`)

  relegationPlan.fourthToOkregowa.forEach((team) => {
    transfer(team, 'fourth-lubuskie', relegationPlan.fourthDestinations[team.id], -3, 37)
  })
  if (relegationPlan.fourthToOkregowa.length) {
    summaries.push(`Lubuskie: z IV ligi spadają ${relegationPlan.fourthToOkregowa.map((team) => team.name).join(', ')}.`)
  }

  const okregowaGroups = ['lubuskie-okr-1', 'lubuskie-okr-2']
  const promotedToFourth: string[] = []
  for (const sourceId of okregowaGroups) {
    for (const position of [1, 2]) {
      const team = teamAt(sourceId, position)
      if (transfer(team, sourceId, 'fourth-lubuskie', 3, 42) && team) promotedToFourth.push(team.name)
    }
  }
  if (promotedToFourth.length) {
    summaries.push(`Lubuskie: do IV ligi awansują kluby z 1. i 2. miejsca obu grup okręgówki: ${promotedToFourth.join(', ')}.`)
  }

  const relegatedFromOkregowa: string[] = []
  for (const [sourceId, relegated] of Object.entries(relegationPlan.okregowaToA)) {
    const destinations = lubuskieAToOkregowa[sourceId]
    routeEvenly(destinations, relegated, sourceId, -3, 33)
    relegatedFromOkregowa.push(...relegated.map((team) => team.name))
  }
  if (relegatedFromOkregowa.length) {
    summaries.push(`Lubuskie: do klasy A spadają ${relegatedFromOkregowa.join(', ')}.`)
  }

  const relegatedFromA: string[] = []
  for (const [aId, relegated] of Object.entries(relegationPlan.aToB)) {
    const bDestinations = lubuskieBToA[aId]
    routeEvenly(bDestinations, relegated, aId, -3, 29)
    relegatedFromA.push(...relegated.map((team) => team.name))
  }
  if (relegatedFromA.length) {
    summaries.push(`Lubuskie: do klasy B spadają ${relegatedFromA.join(', ')}.`)
  }
  return summaries
}

function applySeasonPromotions(
  world: Record<string, Team[]>,
  promotedByLeague: PromotionPlayoffs['promotedByLeague'] = {},
  season?: string,
  exceptions?: LeagueSeasonExceptions,
) {
  const opolskieWithdrawals = applyOpolskieWithdrawals(world, season ?? '', exceptions)
  const opolskieRelegationPlan = getOpolskieRelegationPlan(
    world,
    promotedByLeague,
    exceptions,
    season,
    opolskieWithdrawals,
  )
  const firstLeague = rankTeams(world.first)
  const firstLeaguePlayoff = promotionPlayoff(world.first, '1. Liga', promotedByLeague.first)
  const ekRelegated = rankTeams(world.ekstraklasa).slice(-3)
  const firstPromoted = [...firstLeague.slice(0, 2), firstLeaguePlayoff.winner]
  const firstRelegated = rankTeams(world.first).slice(-3)
  const secondLeague = rankTeams(world.second)
  const secondLeaguePlayoff = promotionPlayoff(world.second, 'Druga Liga Polska', promotedByLeague.second)
  const secondPromoted = [...secondLeague.slice(0, 2), secondLeaguePlayoff.winner]
  const secondRelegated = rankTeams(world.second).slice(-Object.keys(thirdLeagueRegions).length)
  const thirdGroups = Object.keys(thirdLeagueRegions)
  const champions = thirdGroups.map((id) => rankTeams(world[id])[0]).filter((team): team is Team => Boolean(team))
  const relegatedFromThird = Object.fromEntries(
    thirdGroups.map((id) => [id, rankTeams(world[id]).slice(-thirdLeagueRegions[id].length)]),
  )
  const playoffSummaries = [firstLeaguePlayoff.summary, secondLeaguePlayoff.summary]
  exchangeTeams(world, 'ekstraklasa', 'first', ekRelegated, firstPromoted)
  exchangeTeams(world, 'first', 'second', firstRelegated, secondPromoted)
  const second = world.second
  if (second) {
    world.second = second.filter((team) => !secondRelegated.includes(team))
    secondRelegated.forEach((team, index) => {
      const groupId = thirdGroups[index]
      world[groupId].push(resetTeam(team, Math.max(42, team.strength - 3)))
    })
    world.second.push(...champions.map((team) => resetTeam(team, Math.min(85, team.strength + 3))))
    thirdGroups.forEach((id, index) => {
      const champion = champions[index]
      if (champion) world[id] = world[id].filter((team) => team !== champion)
    })
    playoffSummaries.push(...applyLubuskiePromotions(world, relegatedFromThird['third-3'] ?? []))
    moveRegionalTeams(
      world,
      relegatedFromThird,
      promotedByLeague,
      opolskieRelegationPlan,
      exceptions,
      season,
    )
  }
  playoffSummaries.push(...applyPodkarpackiePromotions(world, promotedByLeague))
  playoffSummaries.push(...applyZachodniopomorskiePromotions(world, promotedByLeague))
  playoffSummaries.push(...applyPomorskiePromotions(world, promotedByLeague))
  playoffSummaries.push(...applyWarminskoMazurskiePromotions(world))
  playoffSummaries.push(...applyOpolskiePromotions(world, promotedByLeague, opolskieRelegationPlan))
  for (const [leagueId, teams] of Object.entries(world)) {
    world[leagueId] = teams.map((team) => resetTeam(team, team.id === 'your-club' ? team.strength : Math.max(42, Math.min(85, team.strength + Math.floor(Math.random() * 7) - 3))))
  }
  return playoffSummaries
}

function finishLeagueWorldSeason(game: GameState) {
  const world = game.leagueWorld ?? createLeagueWorld(game.leagueId, game.teams)
  world[game.leagueId] = game.teams.map((team) => ({ ...team }))
  if (!game.promotionPlayoffs?.leagueWorldFinalized) {
    simulateLeagueWorldToSeasonEnd(world, game.leagueId)
  }
  const leagueChampionId = rankTeams(world.ekstraklasa ?? [])[0]?.id
  const playoffSummaries = applySeasonPromotions(
    world,
    game.promotionPlayoffs?.promotedByLeague,
    game.season,
    game.leagueSeasonExceptions,
  )
  return { world, playoffSummaries, leagueChampionId }
}

function createChampionsCupMatch(game: GameState, leagueChampionId?: string) {
  const cup = game.polishCup
  const cupChampionId = cup?.championId
  if (!leagueChampionId || !cupChampionId) return undefined

  let opponentId = cupChampionId
  if (opponentId === leagueChampionId) {
    const final = [...(cup.history ?? [])].reverse().find((match) => match.winnerId === cupChampionId)
    if (!final) return undefined
    opponentId = final.homeId === cupChampionId ? final.awayId : final.homeId
  }
  if (opponentId === leagueChampionId) return undefined

  const firstLeagueDate = getFirstLeagueMatchDate(game)
  const scheduledDate = new Date(firstLeagueDate)
  scheduledDate.setDate(scheduledDate.getDate() - 7)
  const date = moveMatchDateOffPolishHoliday(scheduledDate)
  return {
    id: `champions-cup-${game.season}-${createId()}`,
    season: game.season,
    round: 1,
    competitionId: 'champions-cup' as const,
    homeId: leagueChampionId,
    awayId: opponentId,
    scheduledAt: getLocalDateKey(date),
    kickoffTime: '20:00',
    neutralVenue: true,
    played: false,
  }
}

function addClubTrophy(game: GameState, trophy: ClubTrophy) {
  game.trophyCabinet ??= []
  if (!game.trophyCabinet.some((earned) => earned.id === trophy.id)) {
    game.trophyCabinet.unshift(trophy)
  }
}

function simulateLeagueWorldThroughDate(
  world: Record<string, Team[]>,
  currentLeagueId: LeagueId,
  season: string,
  currentDate: string,
) {
  for (const [leagueId, teams] of Object.entries(world)) {
    if (leagueId === currentLeagueId) continue
    const tier = getLeagueTier(leagueId as LeagueId)
    const playedRounds = Math.max(0, ...teams.map((team) => team.played))
    const roundsDue = getLeagueRoundsThroughDate(season, teams, tier, currentDate)
    for (let round = playedRounds + 1; round <= roundsDue; round += 1) {
      simulateLeagueWorldRound(world, currentLeagueId, round, leagueId)
    }
  }
}

function getLeagueRoundsThroughDate(season: string, teams: Team[], tier: number, currentDate: string) {
  const roundCount = getSeasonRoundCount({ teams })
  let roundsDue = 0
  for (let round = 1; round <= roundCount; round += 1) {
    if (getLocalDateKey(getLeagueRoundDate(
      season,
      round,
      tier,
      roundCount,
      getLeagueMatchupsPerOpponent(teams.length),
    )) > currentDate) break
    roundsDue = round
  }
  return roundsDue
}

function simulateLeagueWorldToSeasonEnd(world: Record<string, Team[]>, currentLeagueId: LeagueId) {
  for (const [leagueId, teams] of Object.entries(world)) {
    if (leagueId === currentLeagueId) continue
    const roundCount = getSeasonRoundCount({ teams })
    const playedRounds = Math.max(0, ...teams.map((team) => team.played))
    for (let round = playedRounds + 1; round <= roundCount; round += 1) {
      simulateLeagueWorldRound(world, currentLeagueId, round, leagueId)
    }
  }
}

function advanceLeagueWorld(game: GameState) {
  const world = game.leagueWorld ?? createLeagueWorld(game.leagueId, game.teams)
  world[game.leagueId] = game.teams.map((team) => ({ ...team }))
  const currentDate = game.currentDate
    ?? getLocalDateKey(getLeagueRoundDate(
      game.season,
      game.round,
      getLeagueTier(game.leagueId),
      getSeasonRoundCount(game),
      getGameMatchupsPerOpponent(game),
    ))
  simulateLeagueWorldThroughDate(world, game.leagueId, game.season, currentDate)
  game.leagueWorld = world
}

function addFinance(state: GameState, label: string, amount: number) {
  state.cash += amount
  state.debt = Math.max(0, Math.round(-state.cash))
  const financeDate = state.currentDate
    ?? getLocalDateKey(getLeagueRoundDate(
      state.season,
      state.round,
      getLeagueTier(state.leagueId),
      getSeasonRoundCount(state),
      getGameMatchupsPerOpponent(state),
    ))
  state.finances.unshift({ id: createId(), label, amount, date: financeDate })
  state.finances = state.finances.slice(0, 40)
}

export function getClubChallenges(game: GameState): ClubChallenge[] {
  const claimed = new Set(game.claimedClubChallengeIds ?? [])
  const clubMatches = game.matches
    .filter((match) => !match.bye && (match.homeId === game.teamId || match.awayId === game.teamId))
    .sort((first, second) => first.round - second.round)
  const playedMatches = clubMatches.filter((match) => match.played)
  const matchWithRewards = playedMatches.find((match) =>
    buildClubChallenges(game, match).some((challenge) => challenge.completed && !claimed.has(challenge.id)),
  )
  const challengeMatch = matchWithRewards
    ?? clubMatches.find((match) => !match.played)
    ?? playedMatches.at(-1)
  return challengeMatch ? buildClubChallenges(game, challengeMatch, claimed) : []
}

const managerLevelThresholds = [0, 100, 250, 450, 700, 1_000, 1_400, 1_900, 2_500, 3_200, 4_000, 5_000, 6_200]
const managerLevelTitles = [
  'Debiutant',
  'Nowicjusz',
  'Trener amator',
  'Taktyk',
  'Lider szatni',
  'Strateg',
  'Uznany szkoleniowiec',
  'Mistrz regionu',
  'Ekspert ligowy',
  'Legenda klubu',
  'Ikona futbolu',
  'Menedżer dekady',
  'Nieśmiertelny',
]

export function getManagerCareerProfile(game: GameState): ManagerCareerProfile {
  const record = game.managerCareer ?? summarizeManagerCareer(game.seasonHistory ?? [])
  const currentClub = game.teams.find((team) => team.id === game.teamId)
  const completedSeasons = record.completedSeasons
  const leagueMatches = record.leagueMatches + (currentClub?.played ?? 0)
  const leagueWins = record.leagueWins + (currentClub?.wins ?? 0)
  const promotions = record.promotions
  const leagueTitles = record.leagueTitles
  const trophies = game.trophyCabinet?.length ?? 0
  const academyDebuts = record.academyDebuts
  const experience = leagueMatches * 5
    + leagueWins * 15
    + completedSeasons * 80
    + promotions * 180
    + leagueTitles * 220
    + trophies * 160
    + academyDebuts * 50
  let levelIndex = 0
  for (let index = 1; index < managerLevelThresholds.length; index += 1) {
    if (experience < managerLevelThresholds[index]) break
    levelIndex = index
  }
  const currentThreshold = managerLevelThresholds[levelIndex]
  const nextLevelExperience = managerLevelThresholds[levelIndex + 1] ?? null
  const levelProgress = nextLevelExperience === null
    ? 100
    : Math.round((experience - currentThreshold) / (nextLevelExperience - currentThreshold) * 100)
  const achievements: ManagerAchievement[] = [
    { id: 'first-win', title: 'Pierwsze zwycięstwo', description: 'Wygraj pierwszy mecz ligowy.', progress: leagueWins, target: 1 },
    { id: 'league-wins-25', title: 'Zwycięska seria', description: 'Zdobądź 25 zwycięstw ligowych.', progress: leagueWins, target: 25 },
    { id: 'matches-25', title: 'Ćwierć setki', description: 'Poprowadź zespół w 25 meczach ligowych.', progress: leagueMatches, target: 25 },
    { id: 'matches-100', title: 'Setka na ławce', description: 'Poprowadź zespół w 100 meczach ligowych.', progress: leagueMatches, target: 100 },
    { id: 'first-season', title: 'Pierwszy pełny sezon', description: 'Doprowadź klub do końca sezonu.', progress: completedSeasons, target: 1 },
    { id: 'seasons-5', title: 'Długodystansowiec', description: 'Zakończ pięć sezonów z klubem.', progress: completedSeasons, target: 5 },
    { id: 'first-promotion', title: 'Droga w górę', description: 'Wywalcz awans do wyższej ligi.', progress: promotions, target: 1 },
    { id: 'league-champion', title: 'Mistrz ligi', description: 'Zdobądź mistrzostwo swojej ligi.', progress: leagueTitles, target: 1 },
    { id: 'trophies-3', title: 'Gablota rośnie', description: 'Zdobądź trzy trofea.', progress: trophies, target: 3 },
    { id: 'academy-debut', title: 'Szansa dla wychowanka', description: 'Wprowadź juniora z akademii do pierwszej drużyny.', progress: academyDebuts, target: 1 },
    { id: 'academy-debuts-5', title: 'Fabryka talentów', description: 'Wprowadź pięciu juniorów do pierwszej drużyny.', progress: academyDebuts, target: 5 },
  ].map((achievement) => ({ ...achievement, unlocked: achievement.progress >= achievement.target }))
  return {
    experience,
    level: levelIndex + 1,
    levelTitle: managerLevelTitles[levelIndex],
    currentLevelExperience: currentThreshold,
    nextLevelExperience,
    levelProgress,
    completedSeasons,
    leagueMatches,
    leagueWins,
    promotions,
    leagueTitles,
    trophies,
    academyDebuts,
    achievements,
  }
}

function summarizeManagerCareer(history: SeasonRecord[]): ManagerCareerRecord {
  return history.reduce<ManagerCareerRecord>((record, season) => ({
    completedSeasons: record.completedSeasons + 1,
    leagueMatches: record.leagueMatches + season.wins + season.draws + season.losses,
    leagueWins: record.leagueWins + season.wins,
    promotions: record.promotions + Number(season.leagueChange === 'promotion'),
    leagueTitles: record.leagueTitles + Number(season.finalPosition === 1),
    academyDebuts: record.academyDebuts,
    leagueGoals: record.leagueGoals + season.goalsFor,
  }), {
    completedSeasons: 0,
    leagueMatches: 0,
    leagueWins: 0,
    promotions: 0,
    leagueTitles: 0,
    academyDebuts: 0,
    leagueGoals: 0,
  })
}

function buildClubChallenges(game: GameState, match: Match, claimed = new Set(game.claimedClubChallengeIds ?? [])): ClubChallenge[] {
  const isHome = match.homeId === game.teamId
  const teamGoals = isHome ? match.homeGoals ?? 0 : match.awayGoals ?? 0
  const opponentGoals = isHome ? match.awayGoals ?? 0 : match.homeGoals ?? 0
  const teamCards = (match.disciplinaryEvents ?? []).filter((event) => event.teamId === game.teamId)
  const yellowCards = teamCards.filter((event) => event.card === 'yellow' && !event.secondYellow).length
  const redCards = teamCards.filter((event) => event.card === 'red').length
  const points = match.played
    ? teamGoals > opponentGoals ? 3 : teamGoals === opponentGoals ? 1 : 0
    : 0
  const attendanceTarget = Math.ceil(game.stadiumCapacity * 0.75)
  const opponentId = isHome ? match.awayId : match.homeId
  const opponentName = game.teams.find((team) => team.id === opponentId)?.name ?? 'rywal'
  const definitions = [
    {
      key: 'win',
      title: 'Zdobądź trzy punkty',
      description: 'Wygraj ligowy mecz tej kolejki.',
      progress: match.played ? `${points} / 3 pkt` : 'Cel na nadchodzący mecz',
      completed: match.played && points === 3,
      reward: 15_000,
    },
    {
      key: 'two-goals',
      title: 'Pokaż siłę w ataku',
      description: 'Strzel co najmniej 2 gole w meczu ligowym.',
      progress: match.played ? `${teamGoals} / 2 gole` : 'Cel na nadchodzący mecz',
      completed: match.played && teamGoals >= 2,
      reward: 10_000,
    },
    {
      key: 'clean-sheet',
      title: 'Zachowaj czyste konto',
      description: 'Nie pozwól rywalowi strzelić gola.',
      progress: match.played ? `${opponentGoals} / 0 goli rywala` : 'Cel na nadchodzący mecz',
      completed: match.played && opponentGoals === 0,
      reward: 12_000,
    },
    {
      key: 'discipline',
      title: 'Zachowaj dyscyplinę',
      description: 'Uniknij czerwonej kartki i nie przekrocz 3 żółtych.',
      progress: match.played ? `${yellowCards} żółtych · ${redCards} czerwonych` : 'Cel na nadchodzący mecz',
      completed: match.played && redCards === 0 && yellowCards <= 3,
      reward: 8_000,
    },
    {
      key: 'avoid-defeat',
      title: 'Nie daj się pokonać',
      description: 'Zdobądź co najmniej jeden punkt.',
      progress: match.played ? `${points} / 1 pkt` : 'Cel na nadchodzący mecz',
      completed: match.played && points >= 1,
      reward: 6_000,
    },
    {
      key: 'score-once',
      title: 'Znajdź drogę do bramki',
      description: 'Strzel przynajmniej jednego gola.',
      progress: match.played ? `${teamGoals} / 1 gol` : 'Cel na nadchodzący mecz',
      completed: match.played && teamGoals >= 1,
      reward: 6_000,
    },
    {
      key: 'limit-opponent',
      title: 'Zamknij rywalowi drogę',
      description: 'Pozwól rywalowi strzelić najwyżej jednego gola.',
      progress: match.played ? `${opponentGoals} / 1 gol rywala` : 'Cel na nadchodzący mecz',
      completed: match.played && opponentGoals <= 1,
      reward: 7_000,
    },
    {
      key: 'three-goals',
      title: 'Zafunduj kibicom emocje',
      description: 'Strzel co najmniej 3 gole.',
      progress: match.played ? `${teamGoals} / 3 gole` : 'Cel na nadchodzący mecz',
      completed: match.played && teamGoals >= 3,
      reward: 8_000,
    },
    ...(isHome ? [{
      key: 'attendance',
      title: 'Wypełnij trybuny',
      description: `Przyciągnij co najmniej ${attendanceTarget.toLocaleString('pl-PL')} kibiców na mecz domowy.`,
      progress: match.played ? `${(match.attendance ?? 0).toLocaleString('pl-PL')} / ${attendanceTarget.toLocaleString('pl-PL')} kibiców` : 'Cel na nadchodzący mecz',
      completed: match.played && (match.attendance ?? 0) >= attendanceTarget,
      reward: 10_000,
    }] : []),
  ]
  const challengeOffset = stableHash(`${game.season}-${match.round}`) % definitions.length
  const weeklyChallenges = Array.from({ length: 4 }, (_, index) =>
    definitions[(challengeOffset + index) % definitions.length],
  )
  return weeklyChallenges.map((challenge) => ({
    id: `${game.season}-${match.id}-${challenge.key}`,
    round: match.round,
    opponentName,
    isHome,
    matchPlayed: match.played,
    title: challenge.title,
    description: challenge.description,
    progress: challenge.progress,
    reward: challenge.reward,
    completed: challenge.completed,
    claimed: claimed.has(`${game.season}-${match.id}-${challenge.key}`),
  }))
}

export function claimClubChallengeRewards(game: GameState) {
  const completedChallenges = getClubChallenges(game).filter((challenge) => challenge.completed && !challenge.claimed)
  if (completedChallenges.length === 0) return { game, error: 'Nie ma ukończonych wyzwań do odebrania.' }
  const next = structuredClone(game)
  next.claimedClubChallengeIds ??= []
  for (const challenge of completedChallenges) {
    if (!next.claimedClubChallengeIds.includes(challenge.id)) next.claimedClubChallengeIds.push(challenge.id)
  }
  const reward = completedChallenges.reduce((total, challenge) => total + challenge.reward, 0)
  addFinance(next, 'Premia za wyzwania meczowe', reward)
  return {
    game: next,
    error: '',
    message: `Odebrano ${reward.toLocaleString('pl-PL')} zł za ${completedChallenges.length} ukończonych wyzwań.`,
  }
}

function getCupAdvancementPrize(tier: number, regional: boolean) {
  const centralPrizes = [250_000, 200_000, 150_000, 120_000, 90_000, 70_000, 50_000, 35_000]
  const regionalPrizes = [0, 0, 0, 90_000, 70_000, 55_000, 40_000, 30_000]
  const prizes = regional ? regionalPrizes : centralPrizes
  return prizes[Math.min(Math.max(tier, 1), prizes.length) - 1] ?? prizes[prizes.length - 1]
}

function recordCupPrize(state: GameState, teamId: string, amount: number, label: string) {
  if (amount <= 0) return
  state.cupPrizeMoney ??= {}
  state.cupPrizeMoney[teamId] = (state.cupPrizeMoney[teamId] ?? 0) + amount
  if (teamId === state.teamId) addFinance(state, label, amount)
}

function awardCupPrize(state: GameState, teamId: string, leagueId: LeagueId, regional: boolean, label: string) {
  recordCupPrize(state, teamId, getCupAdvancementPrize(getLeagueTier(leagueId), regional), label)
}

function getSponsorTerminationPenalty(leagueId: LeagueId) {
  return Math.round(400_000 / getLeagueTier(leagueId) ** 0.8 / 1000) * 1000
}

function getDebtSanctionThreshold(state: GameState) {
  return state.nextDebtSanctionAt ?? 1_000_000
}

function settleDebtAfterSanction(state: GameState) {
  const amount = Math.max(0, Math.round(-state.cash))
  if (amount > 0) addFinance(state, 'Umorzenie i spłata długu po sankcji komisji', amount)
  state.debt = 0
  state.nextDebtSanctionAt = 1_000_000
}

function applyDebtSanction(state: GameState) {
  const threshold = getDebtSanctionThreshold(state)
  const debt = Math.max(state.debt, Math.round(-state.cash), 0)
  const applyNextSeason = Math.random() < 0.5
  const club = state.teams.find((team) => team.id === state.teamId)
  if (!club) throw new Error('Nie można nałożyć sankcji finansowej: klubu brakuje w tabeli ligowej.')

  if (applyNextSeason) {
    state.pendingLeaguePointDeduction = (state.pendingLeaguePointDeduction ?? 0) + 5
    state.pendingDebtSettlement = true
  } else {
    club.points -= 5
    if (state.leagueWorld?.[state.leagueId]) {
      state.leagueWorld[state.leagueId] = state.teams.map((team) => ({ ...team }))
    }
    settleDebtAfterSanction(state)
  }

  addInboxMessage(
    state,
    'Komisja Ligi',
    'Decyzja komisji: kara punktowa i spłata zadłużenia',
    `Po przekroczeniu ${threshold.toLocaleString('pl-PL')} zł długu komisja nakłada karę −5 punktów ${applyNextSeason ? 'na początek następnego sezonu' : 'w bieżącym sezonie'}. ${applyNextSeason ? `Po zastosowaniu kary dług w wysokości ${debt.toLocaleString('pl-PL')} zł zostanie spłacony i wyzerowany.` : `Zadłużenie w wysokości ${debt.toLocaleString('pl-PL')} zł zostało spłacone i wyzerowane.`} Kolejna sankcja będzie rozpatrywana po ponownym osiągnięciu progu 1 000 000 zł.`,
    'rejected',
    'club',
  )
  addMediaPost(state, 'LIGA', 'Komisja nakłada karę punktową', `${state.clubName} otrzyma karę −5 punktów ${applyNextSeason ? 'od początku następnego sezonu' : 'w bieżących rozgrywkach'}. ${applyNextSeason ? 'Zadłużenie zostanie rozliczone po zastosowaniu kary.' : `Dług ${debt.toLocaleString('pl-PL')} zł został spłacony; kolejny próg wynosi 1 000 000 zł.`}`)
}

function processDebtSanctions(state: GameState) {
  state.nextDebtSanctionAt ??= 1_000_000
  if (state.pendingDebtSettlement) return
  while (state.debt >= state.nextDebtSanctionAt) {
    applyDebtSanction(state)
    if (state.debt >= state.nextDebtSanctionAt) throw new Error('Zadłużenie nie zostało wyzerowane po sankcji komisji.')
  }
}

function payStadiumUpkeep(state: GameState) {
  const upkeep = Math.round(state.stadiumCapacity * 2.5 / 1000) * 1000
  if (upkeep > 0) addFinance(state, 'Utrzymanie stadionu', -upkeep)
}

function payAcademyUpkeep(state: GameState) {
  state.academyPlayers ??= []
  if (state.facilities.academy <= 0) return
  const youthWages = state.academyPlayers.reduce((total, player) => total + player.wage, 0)
  const maintenance = state.facilities.academy * 8_000
  addFinance(state, 'Utrzymanie akademii i juniorzy', -(maintenance + youthWages))
}

function payStaffWages(state: GameState) {
  state.staff ??= []
  for (const member of state.staff) {
    addFinance(state, `Wynagrodzenie sztabu: ${member.name}`, -member.wagePerRound)
  }
}

function moveReturningPlayersToOutside(state: GameState, playerIds: Set<string>) {
  if (!playerIds.size) return
  state.matchLineupIds = state.matchLineupIds.filter((id) => !playerIds.has(id))
  state.matchBenchIds = state.matchBenchIds.filter((id) => !playerIds.has(id))
  state.matchOutsideSquadIds = [...new Set([...(state.matchOutsideSquadIds ?? []), ...playerIds])]
}

function removeDismissedPlayersFromMatch(state: GameState, events: MatchCardEvent[], teamId: string) {
  const dismissedPlayerIds = new Set(events
    .filter((event) => event.teamId === teamId && (event.card === 'red' || event.secondYellow))
    .map((event) => event.playerId))
  state.matchLineupIds = state.matchLineupIds.filter((id) => !dismissedPlayerIds.has(id))
  state.matchBenchIds = state.matchBenchIds.filter((id) => !dismissedPlayerIds.has(id))
}

function advanceInjuries(state: GameState, newlyInjuredIds = new Set<string>()) {
  const hasPhysiotherapist = state.staff?.some((member) => member.role === 'physiotherapist') ?? false
  const hasFitnessCoach = state.staff?.some((member) => member.role === 'fitness-coach') ?? false
  const recoveredPlayerIds = new Set<string>()
  for (const player of state.squad) {
    if (!player.injury || newlyInjuredIds.has(player.id)) continue
    const recoveryBoost = (hasPhysiotherapist ? 2 : 1) + (hasFitnessCoach ? 1 : 0)
    player.injury.matchesRemaining -= recoveryBoost
    if (player.injury.matchesRemaining <= 0) {
      const injuryDescription = player.injury.description
      player.injury = null
      recoveredPlayerIds.add(player.id)
      player.stamina = Math.min(100, player.stamina + 12)
      addMediaPost(state, 'KLUB', `${player.firstName} ${player.lastName} wraca do treningów`, 'Zawodnik zakończył rekonwalescencję i ponownie jest do dyspozycji sztabu.')
      addInboxMessage(
        state,
        'Sztab medyczny',
        `Gotowy do gry: ${player.firstName} ${player.lastName}`,
        `${player.firstName} ${player.lastName} zakończył rekonwalescencję po urazie (${injuryDescription}) i jest ponownie do dyspozycji sztabu. Możesz uwzględnić zawodnika w składzie.`,
        'info',
        'club',
        undefined,
        undefined,
        undefined,
        'tactics',
      )
    }
  }
  moveReturningPlayersToOutside(state, recoveredPlayerIds)
  return recoveredPlayerIds
}

function applyMatchdayInjuries(
  state: GameState,
  preMatchStamina: Map<string, number>,
  latestMinute: number,
): { injuryEvents: MatchInjuryEvent[]; recoveredPlayerIds: Set<string> } {
  const newlyInjuredIds = new Set<string>()
  const injuryEvents: MatchInjuryEvent[] = []
  const hasPhysiotherapist = state.staff?.some((member) => member.role === 'physiotherapist') ?? false
  const hasFitnessCoach = state.staff?.some((member) => member.role === 'fitness-coach') ?? false
  const healthyCount = state.squad.filter((player) => getInjuryMatches(player) === 0).length
  if (healthyCount > 11) {
    const playersOnPitch = state.matchLineupIds
      .map((playerId) => state.squad.find((player) => player.id === playerId))
      .filter((player): player is Player => player !== undefined)
    for (const player of playersOnPitch) {
      const fatigue = preMatchStamina.get(player.id) ?? player.stamina
      const tacticalStress = state.tactics.pressing === 'high' ? 0.025 : state.tactics.pressing === 'normal' ? 0.012 : 0
      const staffProtection = (hasPhysiotherapist ? 0.015 : 0) + (hasFitnessCoach ? 0.01 : 0)
      const risk = Math.max(0.01, 0.025 + Math.max(0, 70 - fatigue) * 0.0025 + tacticalStress - staffProtection)
      if (Math.random() >= risk) continue
      const injuryRoll = Math.random()
      const injury = injuryRoll < 0.4
        ? { description: 'stłuczenie', matches: 1 }
        : injuryRoll < 0.8
          ? { description: 'uraz mięśniowy', matches: 1 + Math.floor(Math.random() * 3) }
          : injuryRoll < 0.95
            ? { description: 'uraz stawu', matches: 2 + Math.floor(Math.random() * 4) }
            : { description: 'zerwanie więzadła', matches: 8 + Math.floor(Math.random() * 5) }
      player.injury = {
        description: injury.description,
        matchesRemaining: Math.max(1, injury.matches - (hasPhysiotherapist ? 1 : 0)),
      }
      newlyInjuredIds.add(player.id)
      injuryEvents.push({
        minute: 1 + Math.floor(Math.random() * latestMinute),
        teamId: state.teamId,
        playerId: player.id,
        playerName: `${player.firstName} ${player.lastName}`,
        description: player.injury.description,
      })
      addMediaPost(
        state,
        'KLUB',
        `Kontuzja: ${player.firstName} ${player.lastName}`,
        `Zawodnik doznał urazu (${player.injury.description}) i będzie niedostępny przez ${getInjuryDurationLabel(player.injury.matchesRemaining)}.`,
      )
      addInboxMessage(
        state,
        'Sztab medyczny',
        `Kontuzja: ${player.firstName} ${player.lastName}`,
        `Badania wykazały ${player.injury.description}. ${player.firstName} ${player.lastName} będzie niedostępny przez ${getInjuryDurationLabel(player.injury.matchesRemaining)}. Zastąp zawodnika w składzie na najbliższe spotkania.`,
        'info',
        'club',
        undefined,
        undefined,
        undefined,
        'tactics',
      )
      break
    }
  }
  const recoveredPlayerIds = advanceInjuries(state, newlyInjuredIds)
  return { injuryEvents, recoveredPlayerIds }
}

function applyAutomaticMatchSubstitutions(
  state: GameState,
  event: MatchdayEvent,
  injuryEvents: MatchInjuryEvent[],
  preMatchStamina: Map<string, number>,
  competition: CompetitionId,
  latestMinute: number,
): MatchSubstitutionEvent[] {
  const injuryByPlayerId = new Map(injuryEvents.map((injury) => [injury.playerId, injury]))
  const candidates = state.matchLineupIds
    .map((playerId) => state.squad.find((player) => player.id === playerId))
    .filter((player): player is Player => player !== undefined)
    .map((player) => ({
      player,
      injury: injuryByPlayerId.get(player.id),
      stamina: preMatchStamina.get(player.id) ?? player.stamina,
    }))
    .filter(({ player, injury, stamina }) => injury || stamina <= 45 || player.stamina <= 35)
    .sort((first, second) => Number(Boolean(second.injury)) - Number(Boolean(first.injury)) || first.stamina - second.stamina)
  const substitutions: MatchSubstitutionEvent[] = []
  const substitutedOffIds = new Set(event.substitutedPlayerIds ?? [])
  const substitutedOnIds = new Set(event.substitutePlayerIds ?? [])

  for (const { player: outgoing, injury } of candidates) {
    if ((event.substitutionsUsed ?? 0) >= 3) break
    if (!state.matchLineupIds.includes(outgoing.id)) continue
    const availableSubstitutes = state.matchBenchIds
      .map((playerId) => state.squad.find((candidate) => candidate.id === playerId))
      .filter((candidate): candidate is Player => candidate !== undefined)
      .filter((candidate) =>
        !substitutedOnIds.has(candidate.id)
        && !substitutedOffIds.has(candidate.id)
        && getInjuryMatches(candidate) === 0
        && getSuspensionMatches(candidate, competition) === 0
        && (injury || (
          (candidate.position === 'BR') === (outgoing.position === 'BR')
          && canPlayPosition(candidate, outgoing.position)
        )),
      )
    const incoming = availableSubstitutes
      .sort((first, second) =>
        Number(second.position === outgoing.position) - Number(first.position === outgoing.position)
        || Number(canPlayPosition(second, outgoing.position)) - Number(canPlayPosition(first, outgoing.position))
        || Number((second.position === 'BR') === (outgoing.position === 'BR'))
          - Number((first.position === 'BR') === (outgoing.position === 'BR'))
        || second.skill - first.skill,
      )[0]
    if (!incoming) continue

    const minute = injury?.minute
      ?? Math.min(latestMinute, 65 + Math.floor(Math.random() * Math.max(1, latestMinute - 64)))
    state.matchLineupIds = state.matchLineupIds.map((playerId) => playerId === outgoing.id ? incoming.id : playerId)
    state.matchBenchIds = injury
      ? state.matchBenchIds.filter((playerId) => playerId !== incoming.id)
      : state.matchBenchIds.map((playerId) => playerId === incoming.id ? outgoing.id : playerId)
    event.substitutionsUsed = (event.substitutionsUsed ?? 0) + 1
    event.substitutedPlayerIds = [...(event.substitutedPlayerIds ?? []), outgoing.id]
    event.substitutePlayerIds = [...(event.substitutePlayerIds ?? []), incoming.id]
    substitutedOffIds.add(outgoing.id)
    substitutedOnIds.add(incoming.id)
    substitutions.push({
      minute,
      teamId: state.teamId,
      outgoingPlayerId: outgoing.id,
      incomingPlayerId: incoming.id,
      reason: injury ? 'injury' : 'fatigue',
    })
  }
  return substitutions
}

function createCommercialOffers(leagueId: LeagueId, rating: number, reputation = 0.35, seasonRounds = 34, localReputation = 35) {
  const divisionFactor = [0, 1, 0.64, 0.4, 0.28, 0.18, 0.13, 0.09, 0.06][getLeagueTier(leagueId)]
  const clubFactor = Math.max(0.75, Math.min(1.3, rating / 65))
  const reputationFactor = 0.75 + reputation * 0.6
  const sponsorBase = Math.round(divisionFactor * clubFactor * reputationFactor * 100_000 / 1000) * 1000
  const tvBase = Math.round(divisionFactor * clubFactor * 160_000 / 1000) * 1000
  const isAmateurLevel = getLeagueTier(leagueId) >= 6
  const clampedLocalReputation = Math.max(0, Math.min(100, localReputation))
  const localSponsorFactor = 0.7 + clampedLocalReputation / 100 * 0.8
  const standardSponsors = [
    { id: 'local', company: 'Elektrownia', factor: 0.65, bonusFactor: 0.6, minimumReputation: 0, description: 'Stabilne wsparcie od krajowego dostawcy energii.' },
    { id: 'regional', company: 'Nurt Mobile', factor: 0.9, bonusFactor: 0.4, minimumReputation: 0.2, description: 'Oferta regionalnego operatora dla klubu budującego rozpoznawalność.' },
    { id: 'national', company: 'Punkt Zero', factor: 1.15, bonusFactor: 0.3, minimumReputation: 0.38, description: 'Duże wpływy dla drużyny z dobrymi wynikami i zasięgami.' },
    { id: 'iskra', company: 'ISKRA PALIWA', factor: 1.35, bonusFactor: 0.28, minimumReputation: 0.5, description: 'Oferta sieci stacji paliw dla rozwijającego się klubu.' },
    { id: 'dild', company: 'Dild', factor: 1.55, bonusFactor: 0.26, minimumReputation: 0.62, description: 'Partnerska oferta dla klubu o ugruntowanej pozycji.' },
    { id: 'premium', company: 'Szczyt Sport', factor: 1.8, bonusFactor: 0.25, minimumReputation: 0.74, description: 'Oferta premium dla klubów z czołówki i dużą widownią.' },
    { id: 'kcm1948', company: 'KCM1948', factor: 2.4, bonusFactor: 0.22, minimumReputation: 0.9, description: 'Najwyższa oferta sponsorska dla klubów o wyjątkowej renomie.' },
  ]
  const localSponsors = isAmateurLevel
    ? [
      { id: 'local-shop', company: 'Sklep u Sąsiada', factor: 0.8, bonusFactor: 0.45, minimumReputation: 0, description: 'Wsparcie lokalnego sklepu dla drużyny z okolicy.', localPartner: true },
      { id: 'local-workshop', company: 'Warsztat Kowalski', factor: 1.05, bonusFactor: 0.35, minimumReputation: 0.15, description: 'Oferta regionalnego warsztatu dla klubu znanego w sąsiedztwie.', localPartner: true },
      { id: 'local-bakery', company: 'Piekarnia Pod Lipą', factor: 1.3, bonusFactor: 0.3, minimumReputation: 0.7, description: 'Większe wsparcie lokalnej firmy dla klubu z mocną pozycją w okolicy.', localPartner: true },
    ]
    : []
  const sponsors = [
    ...standardSponsors
      .filter((offer) => reputation >= offer.minimumReputation)
      .map((offer) => ({ ...offer, localPartner: false })),
    ...localSponsors.filter((offer) => clampedLocalReputation / 100 >= offer.minimumReputation),
  ]
    .map((offer) => ({
      id: `sponsor-${offer.id}`,
      company: offer.company,
      signingBonus: Math.round(sponsorBase * seasonRounds * offer.bonusFactor * (offer.localPartner ? localSponsorFactor : 1)),
      paymentPerMatch: Math.round(sponsorBase * offer.factor * (offer.localPartner ? localSponsorFactor : 1)),
      duration: seasonRounds,
      description: offer.description,
      localPartner: offer.localPartner,
    }))
  const tv = [
    { id: 'tv-basic', company: 'Liga TV · pakiet regionalny', factor: 0.7, bonusFactor: 1.4, description: 'Bezpieczna umowa z premią gwarantowaną.' },
    { id: 'tv-standard', company: 'Sport Polska · pakiet ligowy', factor: 1, bonusFactor: 1.1, description: 'Standardowa ekspozycja meczów.' },
    { id: 'tv-premium', company: 'Kanał Mistrzów · pakiet premium', factor: 1.3, bonusFactor: 0.8, description: 'Większe wpływy przy wynikach sportowych.' },
    { id: 'tv-kcm', company: 'KCMtv · pakiet premium', factor: 1.55, bonusFactor: 0.75, description: 'Najwyższa stawka za ogólnopolską ekspozycję meczów.' },
  ].map((offer) => ({
    id: offer.id,
    company: offer.company,
    signingBonus: Math.round(tvBase * offer.bonusFactor),
    paymentPerMatch: Math.round(tvBase * offer.factor),
    duration: seasonRounds,
    description: offer.description,
  }))
  return { sponsors, tv }
}

function createBoardGoal(leagueId: LeagueId, teams: Team[], clubId: string, season: string, cash: number): BoardGoal {
  const club = teams.find((team) => team.id === clubId)
  if (!club) throw new Error('Nie udało się przygotować celów zarządu bez klubu w tabeli.')
  const averageStrength = teams.reduce((total, team) => total + team.strength, 0) / teams.length
  const tier = getLeagueTier(leagueId)
  const reputationBias = Math.max(0.15, Math.min(0.7, (club.strength - averageStrength + 6) / 25))
  const targetShare = club.strength >= averageStrength + 4 ? 0.3 : club.strength >= averageStrength - 1 ? 0.5 : 0.7
  const targetPosition = Math.max(1, Math.min(teams.length, Math.ceil(teams.length * (targetShare - reputationBias * 0.15))))
  const targetCash = Math.max(Math.round(cash * 0.18), Math.round(cash + Math.max(100_000, 75_000 * Math.max(1, 7 - tier))))
  const reward = Math.min(2_000_000, Math.max(75_000, Math.round(cash * 0.1 + (8 - tier) * 70_000 + reputationBias * 150_000)))
  return { season, targetPosition, startingCash: cash, targetCash, reward }
}

function evaluateBoardGoal(game: GameState, finalPosition: number, leagueId: LeagueId) {
  const goal = game.boardGoal ?? createBoardGoal(leagueId, game.teams, game.teamId, game.season, game.cash)
  const positionAchieved = finalPosition <= goal.targetPosition
  const financesAchieved = game.cash >= goal.targetCash
  const reputationAchieved = getClubReputation(game) >= 0.52
  const trustChange = positionAchieved && financesAchieved && reputationAchieved ? 12
    : positionAchieved || financesAchieved || reputationAchieved ? 4
      : -14
  const confidenceAfter = Math.max(0, Math.min(100, (game.boardConfidence ?? 65) + trustChange))
  const rewardPaid = positionAchieved && financesAchieved
    ? goal.reward
    : positionAchieved || financesAchieved || reputationAchieved
      ? Math.round(goal.reward * 0.45)
      : 0
  return {
    goal,
    review: {
      season: game.season,
      leagueId,
      finalPosition,
      finalCash: game.cash,
      positionAchieved,
      financesAchieved,
      trustChange,
      confidenceAfter,
      rewardPaid,
    } satisfies BoardReview,
  }
}

function getClubReputation(game: GameState) {
  const club = getClub(game)
  const resultsScore = club.played ? club.points / (club.played * 3) : 0.35
  const crowdScore = game.homeMatchesPlayed
    ? game.totalHomeAttendance / game.homeMatchesPlayed / game.stadiumCapacity
    : 0.35
  const audienceScore = Math.min(1, game.followers / 100_000)
  const performanceAndAudience = resultsScore * 0.5 + crowdScore * 0.35 + audienceScore * 0.15
  const localReputation = (game.localReputation ?? 35) / 100
  return Math.max(0, Math.min(1, performanceAndAudience * 0.8 + localReputation * 0.2))
}

function updateBoardConfidenceAfterMatch(state: GameState, outcome: 'win' | 'draw' | 'loss', competition: CompetitionId) {
  const goal = state.boardGoal
  let change = outcome === 'win' ? 3 : outcome === 'loss' ? -4 : 0
  if (goal) {
    if (competition === 'league') {
      const currentPosition = getLeagueTable(state).findIndex((team) => team.id === state.teamId) + 1
      if (currentPosition > 0) change += currentPosition <= goal.targetPosition ? 1 : -1
    }
    change += state.cash >= goal.targetCash ? 0.5 : -0.5
  }
  state.boardConfidence = Math.max(0, Math.min(100, Math.round(((state.boardConfidence ?? 65) + change) * 10) / 10))
}

function processSponsorMatchOutcome(state: GameState, outcome: 'win' | 'draw' | 'loss') {
  state.sponsorWinStreak = outcome === 'win' ? (state.sponsorWinStreak ?? 0) + 1 : 0
  state.sponsorLossStreak = outcome === 'loss' ? (state.sponsorLossStreak ?? 0) + 1 : 0

  if (state.sponsorLossStreak >= 4 && state.sponsorDeal && !state.sponsorWarningIssued) {
    state.sponsorWarningIssued = true
    addInboxMessage(
      state,
      state.sponsorDeal.company,
      'Ostrzeżenie sponsora po serii porażek',
      `Cztery porażki z rzędu budzą poważny niepokój ${state.sponsorDeal.company}. Oczekujemy poprawy wyników; dziesiąta kolejna porażka spowoduje natychmiastowe rozwiązanie umowy, karę finansową dla klubu i utratę przyszłych świadczeń sponsorskich.`,
      'info',
      'club',
    )
    addMediaPost(state, 'SPONSOR', `${state.sponsorDeal.company} ostrzega ${state.clubName}`, 'Cztery porażki z rzędu niepokoją sponsora. Przy dziesiątej kolejnej przegranej umowa zostanie natychmiast rozwiązana, a klub zapłaci karę.')
  }

  if (state.sponsorWinStreak === 5 && state.sponsorDeal && !state.sponsorRequired) {
    const bonus = Math.round((320_000 / getLeagueTier(state.leagueId) ** 0.8) / 1000) * 1000
    const congratulations = [
      `Gratulujemy pięciu zwycięstw z rzędu! W uznaniu świetnej formy ${state.clubName} przekazujemy klubowi bonus w wysokości ${bonus.toLocaleString('pl-PL')} zł.`,
      `Drużyna jest nie do zatrzymania — pięć kolejnych wygranych robi wrażenie. Przekazujemy ${bonus.toLocaleString('pl-PL')} zł premii i liczymy na dalszą współpracę.`,
      `Wasza seria pięciu zwycięstw znakomicie promuje markę ${state.sponsorDeal.company}. Przyjmijcie bonus sponsorski: ${bonus.toLocaleString('pl-PL')} zł.`,
    ]
    addFinance(state, `Bonus sponsora ${state.sponsorDeal.company}`, bonus)
    addInboxMessage(
      state,
      state.sponsorDeal.company,
      'Premia za serię zwycięstw',
      congratulations[Math.floor(Math.random() * congratulations.length)],
      'info',
      'club',
    )
    addMediaPost(state, 'SPONSOR', `${state.sponsorDeal.company} gratuluje serii zwycięstw`, congratulations[Math.floor(Math.random() * congratulations.length)])
  }

  if (state.sponsorLossStreak >= 10 && state.sponsorDeal) {
    const company = state.sponsorDeal.company
    const penalty = getSponsorTerminationPenalty(state.leagueId)
    state.sponsorDeal = null
    state.sponsorRequired = true
    state.sponsorWarningIssued = false
    addFinance(state, `Kara za zerwanie umowy sponsorskiej (${company})`, -penalty)
    addInboxMessage(
      state,
      company,
      'Natychmiastowe rozwiązanie umowy sponsorskiej',
      `Po dziesięciu kolejnych porażkach ${company} rozwiązuje umowę ze skutkiem natychmiastowym. Klub traci przyszłe płatności i premie końcowe. Kara za zerwanie wynosi ${penalty.toLocaleString('pl-PL')} zł i została obciążona budżetem klubu; jeśli saldo nie wystarczy, pozostała kwota powiększy dług. Podpisz nową umowę w sekcji Finanse.`,
      'rejected',
      'club',
    )
    addMediaPost(state, 'SPONSOR', `${company} natychmiast rozwiązuje umowę`, `Sponsor wycofał się po dziesięciu kolejnych porażkach ${state.clubName}. Klub zapłaci karę ${penalty.toLocaleString('pl-PL')} zł i musi znaleźć nowego partnera finansowego.`)
  }
}

function createPreseasonFriendlies(game: GameState): FriendlyMatch[] {
  const teamStrength = game.teams.find((team) => team.id === game.teamId)?.strength ?? 50
  const opponentPool = [...new Map([
    ...game.teams,
    ...(game.polishCup?.teams ?? []),
    ...(game.regionalCups ?? []).flatMap((cup) => cup.teams),
  ].map((team) => [team.id, team])).values()]
    .filter((team) => team.id !== game.teamId)
    .sort((first, second) =>
      Math.abs(first.strength - teamStrength) - Math.abs(second.strength - teamStrength),
    )
  const opponents = shuffled(opponentPool.slice(0, Math.max(3, Math.ceil(opponentPool.length / 2)))).slice(0, 3)
  const firstLeagueDate = getFirstLeagueMatchDate(game)
  const preseasonStartDate = new Date(firstLeagueDate)
  preseasonStartDate.setDate(preseasonStartDate.getDate() - 21)
  const officialMatchDates = [
    ...game.matches
      .filter((match) => !match.played && !match.bye && (match.homeId === game.teamId || match.awayId === game.teamId))
      .map((match) => match.scheduledAt),
    ...(game.polishCup?.matches ?? [])
      .filter((match) => !match.played && !match.bye && (match.homeId === game.teamId || match.awayId === game.teamId))
      .map((match) => match.scheduledAt),
    ...(game.regionalCups ?? []).flatMap((cup) => cup.matches
      .filter((match) => !match.played && !match.bye && (match.homeId === game.teamId || match.awayId === game.teamId))
      .map((match) => match.scheduledAt)),
    ...(game.championsCupMatch && !game.championsCupMatch.played
      && (game.championsCupMatch.homeId === game.teamId || game.championsCupMatch.awayId === game.teamId)
      ? [game.championsCupMatch.scheduledAt]
      : []),
  ].filter((date): date is string => Boolean(date)).sort()
  const firstOfficialDate = officialMatchDates[0]
  const blockedDates = new Set(officialMatchDates)
  const availableDates = Array.from({ length: 21 }, (_, day) => {
    const date = new Date(preseasonStartDate)
    date.setDate(date.getDate() + day)
    return getLocalDateKey(date)
  }).filter((date) => date < getLocalDateKey(firstLeagueDate)
    && (!firstOfficialDate || date < firstOfficialDate)
    && !blockedDates.has(date))
  const dateBuckets = [0, 1, 2].map((week) => {
    const start = Math.floor(week * availableDates.length / 3)
    const end = Math.floor((week + 1) * availableDates.length / 3)
    return availableDates.slice(start, end)
  })
  const scheduledDates = dateBuckets.map((bucket) => {
    const fallbackDates = availableDates.filter((date) => !dateBuckets.some((otherBucket) => otherBucket.includes(date)))
    const candidates = bucket.length > 0 ? bucket : fallbackDates
    return candidates[Math.floor(Math.random() * candidates.length)]
  })

  return opponents.map((opponent, index) => {
    const kickoffHour = 12 + Math.floor(Math.random() * 7)
    return {
      id: `friendly-${index + 1}-${createId()}`,
      round: index + 1,
      scheduledAt: scheduledDates[index] ?? getLocalDateKey(preseasonStartDate),
      kickoffTime: `${String(kickoffHour).padStart(2, '0')}:00`,
      homeId: index % 2 === 0 ? game.teamId : opponent.id,
      awayId: index % 2 === 0 ? opponent.id : game.teamId,
      played: false,
      competitionId: 'friendly',
    }
  })
}

function getFirstLeagueMatchDate(game: GameState) {
  const scheduledDate = game.matches
    .filter((match) => !match.bye)
    .map((match) => match.scheduledAt)
    .filter((date): date is string => Boolean(date))
    .sort()[0]
  return scheduledDate
    ? parseLocalDateKey(scheduledDate)
    : getLeagueRoundDate(
      game.season,
      1,
      getLeagueTier(game.leagueId),
      getSeasonRoundCount(game),
      getGameMatchupsPerOpponent(game),
    )
}

function getPreseasonStartDate(game: GameState) {
  const date = getFirstLeagueMatchDate(game)
  date.setDate(date.getDate() - 21)
  return getLocalDateKey(date)
}

export function createGame(clubName: string, city: string, leagueId: LeagueId, clubColor: string, clubType: 'custom' | 'existing' = 'custom', customRegionId?: string): GameState {
  const teamId = 'your-club'
  const clubRegionId = clubType === 'existing'
    ? resolveClubRegion(clubName.trim(), leagueId, city.trim())
    : customRegionId ?? resolveClubRegion(clubName.trim(), leagueId, city.trim())
  if (clubType === 'custom' && !getRegionsForLeague(leagueId).includes(clubRegionId)) {
    throw new Error('Region własnego klubu nie pasuje do wybranej grupy rozgrywkowej.')
  }
  const clubs = clubsByLeague[leagueId]
  const otherTeams = (clubType === 'existing' ? clubs.filter((name) => name !== clubName) : clubs.slice(0, -1))
    .map((name, index) => ({
    id: `team-${index}`,
    name,
    regionId: resolveClubRegion(name, leagueId),
    strength: getLeagueBaseStrength(leagueId) - 4 + Math.floor(Math.random() * 9),
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
  }))
  const leagueStrength = getLeagueBaseStrength(leagueId)
  const club: Team = {
    id: teamId,
    name: clubName.trim(),
    regionId: clubRegionId,
    strength: clubType === 'existing' ? leagueStrength + Math.floor(Math.random() * 8) : leagueStrength - 2,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
  }
  const teams = [club, ...otherTeams]
  if (clubType === 'existing' && !clubs.includes(clubName)) {
    throw new Error(`Klub ${clubName} nie należy do wybranej grupy rozgrywkowej.`)
  }
  if (teams.length !== clubs.length) throw new Error(`Nieprawidłowa liczba klubów w grupie ${leagueId}: ${teams.length}.`)
  const squad = assignMissingSquadNumbers(positions.map((position, index) => {
    const minSkill = leagueStrength - 12
    const skill = minSkill + Math.floor(Math.random() * (clubType === 'existing' ? 20 : 24))
    return makePlayer(index, skill, 18 + Math.floor(Math.random() * 17), position)
  }))
  const startingIds: string[] = []
  for (const position of formationPositions) {
    const player = squad
      .filter((candidate) => candidate.position === position && !startingIds.includes(candidate.id))
      .sort((first, second) => second.skill - first.skill)[0]
    if (player) startingIds.push(player.id)
  }
  for (const player of [...squad].sort((first, second) => second.skill - first.skill)) {
    if (startingIds.length >= 11) break
    if (!startingIds.includes(player.id)) startingIds.push(player.id)
  }
  const benchIds = [...squad]
    .filter((player) => !startingIds.includes(player.id))
    .sort((first, second) => Number(second.position === 'BR') - Number(first.position === 'BR') || second.skill - first.skill)
    .slice(0, 7)
    .map((player) => player.id)
  const game: GameState = {
    version: 1,
    clubName: clubName.trim(),
    clubType,
    city: city.trim() || 'Polska',
    leagueId,
    leagueWorld: createLeagueWorld(leagueId, teams),
    clubColor,
    cash: clubType === 'existing'
      ? [0, 12_000_000, 6_000_000, 3_000_000, 1_200_000, 400_000, 250_000, 175_000, 120_000][getLeagueTier(leagueId)]
      : [0, 4_500_000, 2_500_000, 1_200_000, 600_000, 300_000, 220_000, 150_000, 100_000][getLeagueTier(leagueId)],
    debt: 0,
    nextDebtSanctionAt: 1_000_000,
    pendingDebtSettlement: false,
    ticketPrice: 28,
    stadiumCapacity: clubType === 'existing'
      ? [0, 25_000, 12_000, 6_000, 3_500, 2_000, 1_500, 1_000, 700][getLeagueTier(leagueId)]
      : [0, 5_000, 3_000, 2_000, 1_500, 1_000, 800, 650, 500][getLeagueTier(leagueId)],
    round: 1,
    season: '2026/2027',
    leagueMatchupsPerOpponent: getLeagueMatchupsPerOpponent(teams.length),
    currentDate: '2026-06-01',
    teamId,
    teams,
    squad,
    clubSquads: createClubSquads(teams, teamId, {}, '2026/2027'),
    transferNegotiations: [],
    incomingTransferOffers: [],
    outgoingPlayerTransferListings: [],
    lineupIds: startingIds,
    matchLineupIds: startingIds,
    matchBenchIds: benchIds,
    playerSpecialRoles: autoAssignPlayerSpecialRoles(squad, startingIds),
    previousMatchLineupIds: [],
    previousMatchBenchIds: [],
    teamChemistry: createTeamChemistry(squad),
    market: Array.from({ length: 12 }, (_, index) => {
      const skill = 45 + Math.floor(Math.random() * 31)
      return makePlayer(index + 30, skill, 17 + Math.floor(Math.random() * 18))
    }),
    matches: createFixtures(teams),
    finances: [],
    commercialOffers: createCommercialOffers(leagueId, overallRating(squad), 0.35, getSeasonRoundCount({ teams })),
    sponsorDeal: null,
    tvDeal: null,
    sponsorRequired: true,
    sponsorWinStreak: 0,
    sponsorLossStreak: 0,
    sponsorWarningIssued: false,
    sponsorSigningBonusAvailable: true,
    negotiatedSponsorOfferIds: [],
    facilities: { stand: 0, catering: 0, academy: 0, training: 0 },
    facilityConstruction: null,
    academyProspect: null,
    academyPlayers: [],
    scouts: [],
    staff: [],
    tactics: { formation: '4-2-3-1', style: 'balanced', pressing: 'normal' },
    lastMatchReport: null,
    followers: 12_000,
    localReputation: 35,
    totalHomeAttendance: 0,
    homeMatchesPlayed: 0,
    mediaPosts: [],
    inboxMessages: [],
    boardConfidence: 65,
    boardHistory: [],
    clubRivalries: [],
    managerCareer: {
      completedSeasons: 0,
      leagueMatches: 0,
      leagueWins: 0,
      promotions: 0,
      leagueTitles: 0,
      academyDebuts: 0,
      leagueGoals: 0,
    },
  }
  game.squad.forEach((player) => {
    addPlayerHistory(player, {
      season: game.season,
      type: 'club',
      title: game.clubName,
      details: 'Rozpoczyna karierę menedżerską w pierwszej drużynie.',
    })
  })
  game.polishCup = makePolishCup(game)
  game.regionalCups = createRegionalCupSeasons(game.polishCup.teams, game.season, game.teamId)
  game.regionalCupWinners = {
    [previousSeasonLabel(game.season)]: simulatePreviousRegionalWinners(game.polishCup.teams),
  }
  const previousSeason = previousSeasonLabel(game.season)
  game.regionalCupWinnerNames = {
    [previousSeason]: Object.fromEntries(
      Object.entries(game.regionalCupWinners[previousSeason]).map(([regionId, teamIds]) => {
        const winnerId = teamIds[0]
        const winner = winnerId ? game.polishCup?.teams.find((team) => team.id === winnerId) : undefined
        return [regionId, winner?.name ?? winnerId ?? 'Nieznany klub']
      }),
    ),
  }
  scheduleLeagueFixtures(game)
  game.currentDate = getPreseasonStartDate(game)
  game.preseasonFriendlies = createPreseasonFriendlies(game)
  game.boardGoal = createBoardGoal(leagueId, teams, teamId, game.season, game.cash)
  addFinance(game, 'Kapitał początkowy właściciela', 0)
  addMediaPost(game, 'KLUB', `Nowa era w ${game.clubName}`, `Klub z miasta ${game.city} rozpoczyna sezon ${game.season}. Kibice czekają na pierwsze decyzje nowego zarządu.`)
  ensureUniqueGamePlayerNames(game)
  return game
}

export function getClub(game: GameState) {
  return game.teams.find((team) => team.id === game.teamId) as Team
}

export function getNextMatch(game: GameState) {
  return game.matches.find((match) => match.round === game.round && (match.homeId === game.teamId || match.awayId === game.teamId))
}

export function estimateAttendance(game: GameState, match: Match) {
  const homeClub = match.homeId === game.teamId ? game.teams.find((team) => team.id === match.homeId) : null
  if (!homeClub || match.homeId !== game.teamId) return 0
  const opponent = game.teams.find((team) => team.id === match.awayId)
  if (!opponent) return 0
  const recentMatches = game.matches
    .filter((item) => item.played && (item.homeId === game.teamId || item.awayId === game.teamId))
    .slice(-5)
  const recentPoints = recentMatches.reduce((points, item) => {
    const home = item.homeId === game.teamId
    const scored = home ? item.homeGoals ?? 0 : item.awayGoals ?? 0
    const conceded = home ? item.awayGoals ?? 0 : item.homeGoals ?? 0
    return points + (scored > conceded ? 3 : scored === conceded ? 1 : 0)
  }, 0)
  const form = recentMatches.length ? recentPoints / (recentMatches.length * 3) : 0.4
  const table = getLeagueTable(game)
  const clubRank = table.findIndex((team) => team.id === game.teamId)
  const opponentRank = table.findIndex((team) => team.id === opponent.id)
  const rankAttraction = Math.abs(clubRank - opponentRank) <= 2 ? 0.08 : 0
  const bigMatchAttraction = opponent.strength >= homeClub.strength + 5 ? 0.08 : 0
  const localRivalry = game.city !== 'Polska' && getClubCity(opponent.name) === game.city ? 0.1 : 0
  const decisiveMatchAttraction = match.round >= Math.ceil(getSeasonRoundCount(game) * 0.83) ? 0.06 : 0
  const localReputationDemand = ((game.localReputation ?? 35) - 35) * 0.0015
  const sameDistrictRivalry = getDerbyKind(game, opponent.name) === 'district' ? 0.12 : 0
  const derbyActionDemand = game.pendingDerbyMatchAction?.matchId === match.id
    && game.pendingDerbyMatchAction.choice === 'home-tifo' ? 0.08 : 0
  const formDemand = 0.55 + form * 0.32
  const opponentDemand = 0.9 + Math.min(0.15, opponent.strength / 600)
  const ticketDemand = Math.max(0.48, Math.min(1.08, 1.02 - (game.ticketPrice - 25) * 0.007))
  const fillRate = Math.max(0.22, Math.min(0.99,
    formDemand * opponentDemand * ticketDemand + rankAttraction + bigMatchAttraction + localRivalry + sameDistrictRivalry + decisiveMatchAttraction + localReputationDemand + derbyActionDemand))
  return Math.round(game.stadiumCapacity * fillRate)
}

export function getTeamName(game: GameState, teamId: string) {
  if (teamId === 'league-bye') return 'Pauza ligowa'
  return game.teams.find((team) => team.id === teamId)?.name
    ?? Object.values(game.leagueWorld ?? {}).flat().find((team) => team.id === teamId)?.name
    ?? game.polishCup?.teams.find((team) => team.id === teamId)?.name
    ?? 'Nieznany klub'
}

export function getLeagueTable(game: GameState) {
  return rankTeams(game.teams)
}

export function overallRating(squad: Player[]) {
  if (!squad.length) return 0
  return Math.round(squad.reduce((total, player) => total + player.skill, 0) / squad.length)
}

export function valueLabel(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.', ',')} mln zł`
  return `${Math.round(value / 1000)} tys. zł`
}

export function starsFor(skill: number) {
  return Math.max(1, Math.min(5, Math.round(skill / 20)))
}

export function setTicketPrice(game: GameState, price: number) {
  const next = structuredClone(game)
  const safePrice = Math.max(10, Math.min(100, Math.round(price)))
  next.ticketPrice = safePrice
  return next
}

export function signCommercialDeal(game: GameState, kind: 'sponsor' | 'tv', offerId: string, sponsorDuration = getSeasonRoundCount(game)) {
  const next = structuredClone(game)
  const dealKey = kind === 'sponsor' ? 'sponsorDeal' : 'tvDeal'
  const offers = kind === 'sponsor' ? next.commercialOffers.sponsors : next.commercialOffers.tv
  if (next[dealKey]) return { game, error: kind === 'sponsor' ? 'Klub ma już aktywnego sponsora tytularnego.' : 'Klub ma już podpisane prawa telewizyjne na ten sezon.' }
  const offer = offers.find((item) => item.id === offerId)
  if (!offer) return { game, error: 'Ta oferta nie jest już dostępna.' }
  const seasonRoundCount = getSeasonRoundCount(next)
  const seasonRoundsRemaining = Math.max(1, seasonRoundCount - next.round + 1)
  const halfSeasonLength = Math.ceil(seasonRoundCount / 2)
  const sponsorHalfRemaining = next.round <= halfSeasonLength
    ? halfSeasonLength - next.round + 1
    : seasonRoundsRemaining
  const requestedDuration = kind === 'sponsor' ? sponsorDuration === halfSeasonLength ? sponsorHalfRemaining : seasonRoundsRemaining : offer.duration
  const duration = Math.max(1, Math.min(requestedDuration, seasonRoundsRemaining))
  const signingBonus = kind === 'sponsor'
    ? next.round === 1 && next.sponsorSigningBonusAvailable !== false
      ? offer.signingBonus
      : 0
    : offer.signingBonus
  next[dealKey] = { ...offer, signingBonus, duration, roundsRemaining: duration }
  if (kind === 'sponsor') {
    next.sponsorRequired = false
    next.sponsorWinStreak = 0
    next.sponsorLossStreak = 0
    next.sponsorWarningIssued = false
    next.sponsorSigningBonusAvailable = false
    addMediaPost(next, 'SPONSOR', `${offer.company} zostaje sponsorem ${next.clubName}`, `Klub podpisał umowę na ${duration === sponsorHalfRemaining ? 'rundę' : 'pozostałą część sezonu'}. Kontrakt zapewnia ${offer.paymentPerMatch.toLocaleString('pl-PL')} zł wpływów po każdej kolejce.`)
    addInboxMessage(next, offer.company, 'Podpisano umowę sponsorską', `Umowa obowiązuje przez ${duration} kolejek. ${signingBonus > 0 ? `Klub otrzyma ${signingBonus.toLocaleString('pl-PL')} zł premii za podpis oraz ` : 'Umowa podpisana w trakcie sezonu nie obejmuje premii za podpis. '}Wpływy po każdej kolejce wyniosą ${offer.paymentPerMatch.toLocaleString('pl-PL')} zł.`, 'info', 'club')
  }
  if (signingBonus > 0) addFinance(next, `Premia za podpisanie umowy: ${offer.company}`, signingBonus)
  return { game: next, error: '' }
}

export function renewSponsorDeal(game: GameState) {
  const next = structuredClone(game)
  const deal = next.sponsorDeal
  if (!deal) return { game, error: 'Klub nie ma aktywnej umowy sponsorskiej do przedłużenia.' }
  if (deal.roundsRemaining > 1) return { game, error: 'Umowę można przedłużyć, gdy do jej końca pozostanie jedna kolejka.' }
  const renewalRounds = Math.max(
    getSeasonRoundCount(next) - next.round + 1,
    Math.ceil(getSeasonRoundCount(next) / 2),
  )
  deal.roundsRemaining = renewalRounds
  deal.duration += renewalRounds
  next.sponsorRequired = false
  addInboxMessage(next, deal.company, 'Przedłużono umowę sponsorską', `Umowa z aktualnym sponsorem ${deal.company} została przedłużona na kolejne ${renewalRounds} kolejek.`, 'info', 'club')
  return { game: next, error: '' }
}

export function negotiateSponsorOffer(game: GameState, offerId: string) {
  const next = structuredClone(game)
  if (next.negotiatedSponsorOfferIds.includes(offerId)) {
    return { game, accepted: false, error: 'Negocjacje tej oferty zostały już wykorzystane.' }
  }
  const offer = next.commercialOffers.sponsors.find((item) => item.id === offerId)
  if (!offer) return { game, accepted: false, error: 'Ta oferta sponsorska nie jest już dostępna.' }
  next.negotiatedSponsorOfferIds.push(offerId)
  const reputation = getClubReputation(next)
  const acceptanceChance = 0.25 + reputation * 0.65
  if (Math.random() >= acceptanceChance) {
    addMediaPost(next, 'SPONSOR', `Negocjacje z ${offer.company} bez porozumienia`, `Sponsor nie zaakceptował poprawionych warunków. Klub może nadal podpisać pierwotną ofertę ${offer.company}.`)
    const signingBonus = next.round === 1 && next.sponsorSigningBonusAvailable !== false ? offer.signingBonus : 0
    const rejectionMessage = addInboxMessage(next, offer.company, 'Sponsor odrzucił kontrofertę', `Negocjacje nie przyniosły porozumienia. Pierwotna oferta ${offer.paymentPerMatch.toLocaleString('pl-PL')} zł za kolejkę${signingBonus > 0 ? ` i ${signingBonus.toLocaleString('pl-PL')} zł premii` : ''} pozostaje dostępna.`, 'rejected', 'club')
    rejectionMessage.relatedSponsorOfferId = offer.id
    return { game: next, accepted: false, error: 'Sponsor odrzucił kontrofertę. Pierwotne warunki nadal są dostępne.' }
  }
  offer.paymentPerMatch = Math.round(offer.paymentPerMatch * 1.15 / 100) * 100
  offer.signingBonus = Math.round(offer.signingBonus * 1.1 / 100) * 100
  offer.description = 'Wynegocjowane warunki — wyższa premia i wpływy po każdej kolejce.'
  addMediaPost(next, 'SPONSOR', `${next.clubName} wynegocjował lepszą umowę`, `${offer.company} podnosi premię za podpis oraz stawkę za kolejkę. Dobra pozycja negocjacyjna klubu przyniosła efekt.`)
  addInboxMessage(next, offer.company, 'Sponsor zaakceptował nowe warunki', `Udało się wynegocjować premię za podpis w wysokości ${offer.signingBonus.toLocaleString('pl-PL')} zł oraz ${offer.paymentPerMatch.toLocaleString('pl-PL')} zł wpływów po każdej kolejce.`, 'info', 'club')
  return { game: next, accepted: true, error: '' }
}

export function buildFacility(game: GameState, facilityId: FacilityId) {
  if (game.facilityConstruction) return { game, error: 'Trwa już inna inwestycja. Poczekaj na jej zakończenie.' }
  const targetStage = facilityId === 'stand' ? getNextStadiumStage(game.stadiumCapacity) : null
  const cost = getFacilityConstructionCost(game, facilityId)
  if (cost === null) {
    return {
      game,
      error: facilityId === 'stand'
        ? 'Stadion osiągnął już maksymalną pojemność 55 000 miejsc.'
        : 'Ten obiekt osiągnął już maksymalny poziom.',
    }
  }
  if (game.cash < cost) return { game, error: 'Klub nie ma wystarczających środków na tę inwestycję.' }
  const next = structuredClone(game)
  const targetLevel = facilityId === 'stand'
    ? getStadiumStageIndex(game.stadiumCapacity) + 1
    : (game.facilities[facilityId] ?? 0) + 1
  const startedAt = Date.now()
  next.facilityConstruction = {
    facilityId,
    targetLevel,
    ...(targetStage ? { targetCapacity: targetStage.capacity } : {}),
    startedAt,
    completesAt: startedAt + getFacilityConstructionDurationMs(targetLevel, facilityId),
  }
  const names: Record<FacilityId, string> = { stand: 'Rozbudowa trybun', catering: 'Punkty gastronomiczne', academy: 'Akademia młodzieżowa', training: 'Rozbudowa bazy treningowej' }
  const investmentName = facilityId === 'academy' && targetLevel === 1 ? 'Założenie akademii młodzieżowej' : names[facilityId]
  addFinance(next, investmentName, -cost)
  return { game: next, error: '' }
}

export function signAcademyProspect(game: GameState) {
  const next = structuredClone(game)
  if (next.facilities.academy <= 0) return { game, error: 'Najpierw zbuduj akademię młodzieżową.' }
  if (!next.academyProspect) return { game, error: 'Akademia nie ma teraz gotowego zawodnika do podpisania.' }
  if (next.squad.length >= 30) return { game, error: 'Kadra ma już maksymalny rozmiar (30 zawodników).' }
  const prospect = next.academyProspect
  const signingCost = prospect.value
  if (next.cash < signingCost) return { game, error: 'Klub nie ma środków na podpisanie kontraktu z juniorem.' }
  const promoted = {
    ...prospect,
    wage: Math.max(prospect.wage, Math.round(prospect.skill * prospect.skill * 0.7 / 100) * 100),
    contractSeasonsRemaining: 2,
    morale: 82,
  }
  assignNextSquadNumber(promoted, next.squad)
  next.squad.push(promoted)
  next.academyProspect = null
  const ownTeam = next.teams.find((team) => team.id === next.teamId)
  if (ownTeam) {
    ownTeam.strength = overallRating(next.squad)
    if (next.leagueWorld) next.leagueWorld[next.leagueId] = next.teams.map((team) => ({ ...team }))
  }
  addFinance(next, `Kontrakt juniorski: ${prospect.firstName} ${prospect.lastName}`, -signingCost)
  addMediaPost(next, 'TRANSFER', `Akademia ${next.clubName} wypromowała talent`, `${prospect.firstName} ${prospect.lastName}, ${prospect.age}-letni ${prospect.position}, podpisał pierwszy kontrakt z pierwszą drużyną.`)
  return { game: next, error: '' }
}

export function recruitAcademyProspect(game: GameState) {
  const next = structuredClone(game)
  next.academyPlayers ??= []
  if (next.facilities.academy <= 0) return { game, error: 'Najpierw zbuduj akademię młodzieżową.' }
  if (!next.academyProspect) return { game, error: 'Akademia nie ma teraz gotowego zawodnika do podpisania.' }
  if (next.academyPlayers.length >= 12) return { game, error: 'Akademia osiągnęła limit 12 juniorów.' }
  const prospect = next.academyProspect
  const signingCost = Math.max(10_000, Math.round(prospect.value * 0.25 / 1000) * 1000)
  if (next.cash < signingCost) return { game, error: 'Klub nie ma środków na przyjęcie juniora do akademii.' }
  prospect.wage = Math.round(prospect.skill * prospect.skill * 0.25 / 100) * 100
  prospect.contractSeasonsRemaining = 3
  next.academyPlayers.push({ ...prospect, morale: 75 })
  next.academyProspect = null
  addFinance(next, `Nabór do akademii: ${prospect.firstName} ${prospect.lastName}`, -signingCost)
  addMediaPost(next, 'KLUB', `Nowy junior w akademii ${next.clubName}`, `${prospect.firstName} ${prospect.lastName}, ${prospect.age}-letni zawodnik na pozycji ${prospect.position}, rozpoczyna rozwój w klubowej akademii.`)
  return { game: next, error: '' }
}

export function trainAcademyPlayer(game: GameState, playerId: string) {
  const next = structuredClone(game)
  next.academyPlayers ??= []
  if (next.facilities.academy <= 0) return { game, error: 'Najpierw zbuduj akademię młodzieżową.' }
  const player = next.academyPlayers.find((item) => item.id === playerId)
  if (!player) return { game, error: 'Nie znaleziono juniora w akademii.' }
  if (player.skill >= player.potential) return { game, error: 'Junior osiągnął już swój obecny potencjał.' }
  const trainingCost = 15_000
  if (next.cash < trainingCost) return { game, error: 'Klub nie ma środków na dodatkowy trening juniora.' }
  const academyLevel = Math.min(5, next.facilities.academy)
  const bonusTrainingChance = academyLevel >= 3 ? 0.35 + (academyLevel - 3) * 0.1 : 0
  player.skill = Math.min(player.potential, player.skill + 1 + (Math.random() < bonusTrainingChance ? 1 : 0))
  player.value = playerValue(player.skill, player.potential, player.age)
  player.wage = Math.round(player.skill * player.skill * 0.25 / 100) * 100
  player.morale = Math.min(100, player.morale + 5)
  addFinance(next, `Indywidualny trening juniora: ${player.firstName} ${player.lastName}`, -trainingCost)
  addMediaPost(next, 'KLUB', `Postępy juniora ${player.firstName} ${player.lastName}`, `Zawodnik poprawił umiejętności do ${player.skill}/100 podczas indywidualnego treningu w akademii.`)
  return { game: next, error: '' }
}

export function promoteAcademyPlayer(game: GameState, playerId: string) {
  const next = structuredClone(game)
  next.academyPlayers ??= []
  if (next.squad.length >= 30) return { game, error: 'Kadra ma już maksymalny rozmiar (30 zawodników).' }
  const academyIndex = next.academyPlayers.findIndex((item) => item.id === playerId)
  if (academyIndex < 0) return { game, error: 'Nie znaleziono juniora w akademii.' }
  const junior = next.academyPlayers[academyIndex]
  const signingCost = Math.max(10_000, Math.round(junior.value * 0.2 / 1000) * 1000)
  if (next.cash < signingCost) return { game, error: 'Klub nie ma środków na podpisanie pierwszego kontraktu z juniorem.' }
  const promoted = {
    ...junior,
    wage: Math.max(junior.wage, Math.round(junior.skill * junior.skill * 0.7 / 100) * 100),
    contractSeasonsRemaining: 2,
    morale: Math.min(100, junior.morale + 10),
  }
  next.managerCareer ??= summarizeManagerCareer(next.seasonHistory ?? [])
  next.managerCareer.academyDebuts += 1
  assignNextSquadNumber(promoted, next.squad)
  next.academyPlayers.splice(academyIndex, 1)
  next.squad.push(promoted)
  const ownTeam = next.teams.find((team) => team.id === next.teamId)
  if (ownTeam) {
    ownTeam.strength = overallRating(next.squad)
    if (next.leagueWorld) next.leagueWorld[next.leagueId] = next.teams.map((team) => ({ ...team }))
  }
  addFinance(next, `Pierwszy kontrakt: ${promoted.firstName} ${promoted.lastName}`, -signingCost)
  addMediaPost(next, 'TRANSFER', `Junior awansuje do ${next.clubName}`, `${promoted.firstName} ${promoted.lastName}, ${promoted.age}-letni wychowanek akademii, podpisał pierwszy kontrakt z pierwszą drużyną.`)
  return { game: next, error: '' }
}

export function hireScout(game: GameState, experience: ScoutExperience) {
  const next = structuredClone(game)
  if (next.scouts.length >= 3) return { game, error: 'Klub może zatrudniać maksymalnie 3 skautów.' }
  const profile = scoutPackages[experience]
  if (next.cash < profile.hiringCost) return { game, error: 'Klub nie ma wystarczających środków na zatrudnienie tego skauta.' }
  const name = scoutNames.find((candidate) => !next.scouts.some((scout) => scout.name === candidate))
  if (!name) return { game, error: 'Brakuje dostępnych skautów na rynku.' }
  next.scouts.push({
    id: createId(),
    name,
    experience,
    hiringCost: profile.hiringCost,
    wagePerRound: profile.wagePerRound,
    roundsPerReport: profile.roundsPerReport,
    roundsUntilReport: profile.roundsPerReport,
    prospect: null,
  })
  addFinance(next, `Zatrudnienie skauta: ${name}`, -profile.hiringCost)
  addMediaPost(next, 'KLUB', `${name} dołącza do sztabu ${next.clubName}`, `Skaut z ${experience === 'rookie' ? 'podstawowym' : experience === 'experienced' ? 'dużym' : 'najwyższym'} doświadczeniem rozpoczyna poszukiwania młodych talentów.`)
  return { game: next, error: '' }
}

export function dismissScout(game: GameState, scoutId: string) {
  const next = structuredClone(game)
  const scout = next.scouts.find((item) => item.id === scoutId)
  if (!scout) return { game, error: 'Nie znaleziono skauta w sztabie.' }
  next.scouts = next.scouts.filter((item) => item.id !== scoutId)
  addMediaPost(next, 'KLUB', `${scout.name} opuszcza ${next.clubName}`, 'Klub reorganizuje dział skautingu.')
  return { game: next, error: '' }
}

export function signScoutedProspect(game: GameState, scoutId: string) {
  if (!getTransferWindowInfo(game).isOpen) return { game, error: 'Okno transferowe jest zamknięte. Zawodników z raportów skautów można pozyskiwać tylko w oknie letnim lub zimowym.' }
  const next = structuredClone(game)
  const scout = next.scouts.find((item) => item.id === scoutId)
  if (!scout?.prospect) return { game, error: 'Ten skaut nie ma aktualnie gotowego raportu z zawodnikiem.' }
  if (next.squad.length >= 30) return { game, error: 'Kadra ma już maksymalny rozmiar (30 zawodników).' }
  const prospect = scout.prospect
  if (next.cash < prospect.value) return { game, error: 'Klub nie ma wystarczających środków na podpisanie zawodnika.' }
  const signedProspect = { ...prospect, morale: 82 }
  assignNextSquadNumber(signedProspect, next.squad)
  next.squad.push(signedProspect)
  scout.prospect = null
  scout.roundsUntilReport = scout.roundsPerReport
  addFinance(next, `Transfer młodego talentu: ${prospect.firstName} ${prospect.lastName}`, -prospect.value)
  addMediaPost(next, 'TRANSFER', `${prospect.firstName} ${prospect.lastName} trafia do ${next.clubName}`, `${next.scouts.find((item) => item.id === scoutId)?.name} wypatrzył ${prospect.age}-letniego zawodnika na pozycji ${prospect.position}. Młody talent dołącza do pierwszej drużyny.`)
  return { game: next, error: '' }
}

export function hireStaffMember(game: GameState, role: StaffRole) {
  const next = structuredClone(game)
  next.staff ??= []
  const profile = staffRoles[role]
  if (next.staff.some((member) => member.role === role)) return { game, error: `Klub ma już zatrudnionego: ${profile.label.toLocaleLowerCase('pl')}.` }
  if (next.cash < profile.hiringCost) return { game, error: 'Klub nie ma wystarczających środków na zatrudnienie tego członka sztabu.' }
  const name = staffNames.find((candidate) => !next.staff?.some((member) => member.name === candidate))
  if (!name) return { game, error: 'Brakuje dostępnych kandydatów do sztabu.' }
  next.staff.push({
    id: createId(),
    name,
    role,
    hiringCost: profile.hiringCost,
    wagePerRound: profile.wagePerRound,
  })
  addFinance(next, `Kontrakt sztabu: ${profile.label}`, -profile.hiringCost)
  addMediaPost(next, 'KLUB', `${name} dołącza do sztabu ${next.clubName}`, `${profile.label} rozpoczyna pracę. Klub będzie teraz skuteczniej realizował odpowiednie sesje treningowe.`)
  return { game: next, error: '' }
}

export function dismissStaffMember(game: GameState, staffId: string) {
  const next = structuredClone(game)
  next.staff ??= []
  const member = next.staff.find((staff) => staff.id === staffId)
  if (!member) return { game, error: 'Nie znaleziono członka sztabu.' }
  next.staff = next.staff.filter((staff) => staff.id !== staffId)
  addMediaPost(next, 'KLUB', `${member.name} opuszcza ${next.clubName}`, 'Klub rozwiązał współpracę i od kolejnej kolejki nie będzie ponosił kosztów wynagrodzenia tego członka sztabu.')
  return { game: next, error: '' }
}

function createAcademyProspect(state: GameState) {
  const academyLevel = Math.max(1, Math.min(5, state.facilities.academy))
  const minimumSkill = 34 + academyLevel * 6
  const skill = Math.min(78, minimumSkill + Math.floor(Math.random() * (10 + academyLevel * 2)))
  const prospect = makePlayer(state.academyPlayers?.length ?? 0, skill, 15 + Math.floor(Math.random() * 4))
  prospect.potential = Math.min(96, skill + 14 + academyLevel * 4 + Math.floor(Math.random() * 12))
  prospect.value = playerValue(prospect.skill, prospect.potential, prospect.age)
  prospect.wage = Math.round(prospect.skill * prospect.skill * 0.25 / 100) * 100
  prospect.contractSeasonsRemaining = 3
  return prospect
}

function scoutForProspect(state: GameState, scout: Scout) {
  const experienceLevel: Record<ScoutExperience, number> = { rookie: 0, experienced: 1, expert: 2 }
  const level = experienceLevel[scout.experience]
  const skill = 34 + level * 7 + Math.floor(Math.random() * 15)
  const prospect = makePlayer(state.squad.length + state.market.length + state.scouts.length, skill, 15 + Math.floor(Math.random() * 4))
  prospect.potential = Math.min(98, skill + 12 + level * 5 + Math.floor(Math.random() * 13))
  prospect.value = playerValue(prospect.skill, prospect.potential, prospect.age)
  prospect.wage = Math.round(prospect.skill * prospect.skill * 0.25 / 100) * 100
  return prospect
}

export function getCompetitionDiscipline(player: Player, competition: CompetitionId): CompetitionDiscipline {
  return {
    yellowCardsTowardSuspension: 0,
    yellowCardsTotal: 0,
    redCards: 0,
    suspendedMatches: 0,
    ...player.discipline?.[competition],
  }
}

function applyDisciplinaryEvents(players: Player[], events: MatchCardEvent[], competition: CompetitionId) {
  for (const event of events) {
    const player = players.find((candidate) => candidate.id === event.playerId)
    if (!player) continue
    const discipline = getCompetitionDiscipline(player, competition)
    if (event.card === 'red') {
      discipline.redCards += 1
      if (event.suspensionApplied) discipline.suspendedMatches += 1
    } else {
      discipline.yellowCardsTotal += 1
      if (event.secondYellow) {
        discipline.redCards += 1
        discipline.yellowCardsTowardSuspension += 1
        if (discipline.yellowCardsTowardSuspension >= 4) discipline.yellowCardsTowardSuspension = 0
      } else {
        discipline.yellowCardsTowardSuspension = event.suspensionApplied
          ? 0
          : discipline.yellowCardsTowardSuspension + 1
      }
      if (event.suspensionApplied) discipline.suspendedMatches += 1
    }
    player.discipline = { ...player.discipline, [competition]: discipline }
  }
}

function simulateDisciplinaryEvents(
  players: Player[],
  teamId: string,
  competition: CompetitionId,
  latestMinute = 90,
): MatchCardEvent[] {
  const events: MatchCardEvent[] = []
  for (const player of players) {
    if (Math.random() >= 0.24) continue
    const discipline = { ...getCompetitionDiscipline(player, competition) }
    const redCard = Math.random() < 0.035
    let firstSuspensionApplied = false
    if (redCard) {
      discipline.redCards += 1
      discipline.suspendedMatches += 1
      firstSuspensionApplied = true
    } else {
      discipline.yellowCardsTotal += 1
      discipline.yellowCardsTowardSuspension += 1
      if (discipline.yellowCardsTowardSuspension >= 4) {
        discipline.yellowCardsTowardSuspension = 0
        discipline.suspendedMatches += 1
        firstSuspensionApplied = true
      }
    }
    player.discipline = { ...player.discipline, [competition]: discipline }
    const firstMinute = 1 + Math.floor(Math.random() * latestMinute)
    events.push({
      playerId: player.id,
      playerName: `${player.firstName} ${player.lastName}`,
      teamId,
      minute: firstMinute,
      card: redCard ? 'red' : 'yellow',
      suspensionApplied: firstSuspensionApplied,
    })
    if (redCard || firstMinute >= latestMinute || Math.random() >= 0.12) continue

    const secondMinute = firstMinute + 1 + Math.floor(Math.random() * Math.max(1, latestMinute - firstMinute))
    const secondDiscipline = { ...getCompetitionDiscipline(player, competition) }
    secondDiscipline.yellowCardsTotal += 1
    secondDiscipline.redCards += 1
    secondDiscipline.yellowCardsTowardSuspension += 1
    secondDiscipline.yellowCardsTowardSuspension = 0
    secondDiscipline.suspendedMatches += 1
    player.discipline = { ...player.discipline, [competition]: secondDiscipline }
    events.push({
      playerId: player.id,
      playerName: `${player.firstName} ${player.lastName}`,
      teamId,
      minute: secondMinute,
      card: 'yellow',
      secondYellow: true,
      suspensionApplied: true,
    })
  }
  return events.sort((first, second) => (first.minute ?? 0) - (second.minute ?? 0))
}

function getDismissalStrengthPenalty(events: MatchCardEvent[], teamId: string, matchDuration: number) {
  return events
    .filter((event) => event.teamId === teamId && (event.card === 'red' || event.secondYellow))
    .reduce((penalty, event) => {
      const remainingMatch = Math.max(0, matchDuration - (event.minute ?? matchDuration)) / matchDuration
      return penalty + remainingMatch * 7
    }, 0)
}

export function getSuspensionMatches(player: Player, competition: CompetitionId) {
  return getCompetitionDiscipline(player, competition).suspendedMatches
}

function getInjuryMatches(player: Player) {
  return player.injury?.matchesRemaining ?? 0
}

export function getInjuryDurationLabel(matchesRemaining: number) {
  const estimatedWeeks = Math.max(1, Math.ceil(matchesRemaining / 2))
  if (estimatedWeeks === 1) return 'około tydzień'
  if (estimatedWeeks === 2) return 'około dwa tygodnie'
  if (estimatedWeeks === 3) return 'około trzy tygodnie'
  return `około ${estimatedWeeks} tygodni`
}

function addAvailabilityMessages(state: GameState, match: Match, competition: CompetitionId) {
  const unavailablePlayers = new Set<string>()
  const unavailablePlayerIds = new Set<string>()
  for (const event of match.disciplinaryEvents ?? []) {
    const suspensionFromYellowCards = event.card === 'yellow' && !event.secondYellow && event.suspensionApplied
    if (event.teamId !== state.teamId || (event.card !== 'red' && !event.secondYellow && !suspensionFromYellowCards)) continue
    if (unavailablePlayers.has(event.playerId)) continue
    const player = state.squad.find((candidate) => candidate.id === event.playerId)
    if (!player) continue
    const suspendedMatches = getSuspensionMatches(player, competition)
    if (suspendedMatches <= 0) continue
    unavailablePlayers.add(player.id)
    unavailablePlayerIds.add(player.id)
    const subject = suspensionFromYellowCards
      ? `Pauza za żółte kartki: ${player.firstName} ${player.lastName}`
      : `Czerwona kartka: ${player.firstName} ${player.lastName}`
    const homeName = getTeamName(state, match.homeId)
    const awayName = getTeamName(state, match.awayId)
    addInboxMessage(
      state,
      'Sztab szkoleniowy',
      subject,
      suspensionFromYellowCards
        ? `${player.firstName} ${player.lastName} otrzymał czwartą żółtą kartkę w meczu ${homeName} – ${awayName}. Zawodnik pauzuje przez ${suspendedMatches} ${suspendedMatches === 1 ? 'najbliższy mecz' : 'najbliższe mecze'} w tych rozgrywkach. Trafił do okna „Pauzy i Kontuzje”. Uzupełnij skład przed kolejnym spotkaniem.`
        : `${player.firstName} ${player.lastName} otrzymał czerwoną kartkę${event.secondYellow ? ' po drugiej żółtej kartce' : ''} w meczu ${homeName} – ${awayName}. Zawodnik opuścił boisko, a drużyna dokończyła mecz w osłabieniu. Piłkarz pauzuje przez ${suspendedMatches} ${suspendedMatches === 1 ? 'najbliższy mecz' : 'najbliższe mecze'} w tych rozgrywkach i trafił do okna „Pauzy i Kontuzje”. Uzupełnij skład przed kolejnym spotkaniem.`,
      'info',
      'club',
      undefined,
      undefined,
      undefined,
      'tactics',
    )
  }
  moveReturningPlayersToOutside(state, unavailablePlayerIds)
}

function decrementSuspensions(state: GameState, competition: CompetitionId) {
  const returnedPlayerIds = new Set<string>()
  for (const player of state.squad) {
    const discipline = player.discipline?.[competition]
    if (!discipline || discipline.suspendedMatches <= 0) continue
    discipline.suspendedMatches -= 1
    if (discipline.suspendedMatches !== 0) continue
    returnedPlayerIds.add(player.id)
    addInboxMessage(
      state,
      'Sztab szkoleniowy',
      `Gotowy do gry: ${player.firstName} ${player.lastName}`,
      `${player.firstName} ${player.lastName} odbył karę za kartki i może ponownie wystąpić w ${competition === 'league' ? 'lidze' : competition === 'polish-cup' ? 'Polskim Pucharze' : 'tych rozgrywkach'}. Możesz uwzględnić zawodnika w składzie.`,
      'info',
      'club',
      undefined,
      undefined,
      undefined,
      'tactics',
    )
  }
  moveReturningPlayersToOutside(state, returnedPlayerIds)
  return returnedPlayerIds
}

function completeMatchSquad(state: GameState, startingIds: string[], benchIds: string[], competition: CompetitionId, excludedIds = new Set<string>()) {
  const available = [...state.squad]
    .filter((player) => getSuspensionMatches(player, competition) === 0
      && getInjuryMatches(player) === 0
      && !excludedIds.has(player.id)
      && !(state.matchOutsideSquadIds ?? []).includes(player.id))
    .sort((first, second) => second.skill - first.skill)
  const requestedStarters = new Set(startingIds)
  const starters: string[] = []
  for (const position of formationPositionOrders[state.tactics.formation]) {
    const player = available.find((candidate) =>
      canPlayPosition(candidate, position)
      && requestedStarters.has(candidate.id)
      && !starters.includes(candidate.id),
    ) ?? available.find((candidate) => canPlayPosition(candidate, position) && !starters.includes(candidate.id))
    if (player) starters.push(player.id)
  }
  for (const id of startingIds) {
    if (starters.length >= 11) break
    const player = available.find((candidate) => candidate.id === id)
    if (!player || starters.includes(id)) continue
    if (player.position === 'BR' && starters.some((starterId) => state.squad.find((candidate) => candidate.id === starterId)?.position === 'BR')) continue
    starters.push(id)
  }
  for (const player of available) {
    if (starters.length >= 11) break
    if (player.position === 'BR' && starters.some((starterId) => state.squad.find((candidate) => candidate.id === starterId)?.position === 'BR')) continue
    if (!starters.includes(player.id)) starters.push(player.id)
  }
  const bench = benchIds.filter((id) => available.some((player) => player.id === id) && !starters.includes(id)).slice(0, 7)
  const reserveGoalkeeper = available.find((player) => player.position === 'BR' && !starters.includes(player.id))
  if (reserveGoalkeeper && !bench.some((id) => state.squad.find((player) => player.id === id)?.position === 'BR')) {
    if (bench.length >= 7) {
      const weakestBench = bench
        .map((id) => state.squad.find((player) => player.id === id))
        .filter((player): player is Player => player !== undefined && player.position !== 'BR')
        .sort((first, second) => first.skill - second.skill)[0]
      if (weakestBench) bench.splice(bench.indexOf(weakestBench.id), 1)
    }
    if (bench.length < 7) bench.push(reserveGoalkeeper.id)
  }
  for (const player of available) {
    if (bench.length >= 7) break
    if (!starters.includes(player.id) && !bench.includes(player.id)) bench.push(player.id)
  }
  return { starters, bench }
}

function normalizeStartingGoalkeepers(squad: Player[], startingIds: string[], excludedIds = new Set<string>()) {
  const selected = [...new Set(startingIds)]
    .map((id) => squad.find((player) => player.id === id && !excludedIds.has(id)))
    .filter((player): player is Player => player !== undefined)
  const selectedGoalkeeper = selected
    .filter((player) => player.position === 'BR')
    .sort((first, second) => second.skill - first.skill)[0]
  const goalkeeper = selectedGoalkeeper
    ?? squad.filter((player) => player.position === 'BR' && !excludedIds.has(player.id)).sort((first, second) => second.skill - first.skill)[0]
  const outfield = selected.filter((player) => player.position !== 'BR').slice(0, goalkeeper ? 10 : 11)
  for (const player of [...squad].filter((candidate) => !excludedIds.has(candidate.id)).sort((first, second) => second.skill - first.skill)) {
    if (outfield.length >= (goalkeeper ? 10 : 11)) break
    if (player.position !== 'BR' && !outfield.some((selectedPlayer) => selectedPlayer.id === player.id)) outfield.push(player)
  }
  return [...(goalkeeper ? [goalkeeper] : []), ...outfield].slice(0, 11).map((player) => player.id)
}

export function setMatchSquadRole(game: GameState, playerId: string, role: MatchSquadRole, competition: CompetitionId = 'league') {
  const next = structuredClone(game)
  moveUnavailableBenchPlayersOutside(next, competition)
  const player = next.squad.find((item) => item.id === playerId)
  if (!player) return { game, error: 'Nie znaleziono zawodnika w kadrze.' }
  if (getInjuryMatches(player) > 0 && role !== 'none') {
    return { game, error: 'Kontuzjowany zawodnik nie może znaleźć się w składzie meczowym.' }
  }
  if (getSuspensionMatches(player, competition) > 0 && role !== 'none') {
    return { game, error: competition === 'league' ? 'Zawodnik pauzuje w rozgrywkach ligowych.' : 'Zawodnik pauzuje w tych rozgrywkach.' }
  }
  next.matchLineupIds = next.matchLineupIds.filter((id) => id !== playerId)
  next.matchBenchIds = next.matchBenchIds.filter((id) => id !== playerId)
  next.matchOutsideSquadIds = (next.matchOutsideSquadIds ?? []).filter((id) => id !== playerId)
  if (role === 'starting') {
    if (next.matchLineupIds.length >= 11) return { game, error: 'Pierwsza jedenastka jest już pełna.' }
    if (player.position === 'BR' && next.matchLineupIds.some((id) => next.squad.find((starter) => starter.id === id)?.position === 'BR')) {
      return { game, error: 'W pierwszej jedenastce może być tylko jeden bramkarz.' }
    }
    next.matchLineupIds.push(playerId)
  }
  if (role === 'bench') {
    if (next.matchBenchIds.length >= 7) return { game, error: 'Ławka rezerwowych może liczyć maksymalnie 7 zawodników.' }
    next.matchBenchIds.push(playerId)
  }
  return { game: next, error: '' }
}

function moveUnavailableBenchPlayersOutside(game: GameState, competition: CompetitionId) {
  const unavailableBenchIds = game.matchBenchIds.filter((id) => {
    const player = game.squad.find((item) => item.id === id)
    return !player || getInjuryMatches(player) > 0 || getSuspensionMatches(player, competition) > 0
  })
  if (!unavailableBenchIds.length) return
  game.matchBenchIds = game.matchBenchIds.filter((id) => !unavailableBenchIds.includes(id))
  const outsideIds = game.matchOutsideSquadIds ?? []
  game.matchOutsideSquadIds = [
    ...outsideIds,
    ...unavailableBenchIds.filter((id) => game.squad.some((player) => player.id === id) && !outsideIds.includes(id)),
  ]
}

export function replaceMatchPlayer(game: GameState, outgoingId: string, incomingId: string, competition: CompetitionId = 'league') {
  const outgoing = game.squad.find((player) => player.id === outgoingId)
  const incoming = game.squad.find((player) => player.id === incomingId)
  if (!outgoing || !incoming) return { game, error: 'Nie znaleziono zawodnika w kadrze.' }
  if (getInjuryMatches(outgoing) > 0 || getInjuryMatches(incoming) > 0) {
    return { game, error: 'Kontuzjowany zawodnik nie może znaleźć się w składzie meczowym.' }
  }
  if (!game.matchLineupIds.includes(outgoingId) || game.matchLineupIds.includes(incomingId)) {
    return { game, error: 'Wybierz zawodnika z pierwszej jedenastki i rezerwowego.' }
  }
  if (getSuspensionMatches(incoming, competition) > 0) {
    return { game, error: 'Ten rezerwowy pauzuje w tych rozgrywkach.' }
  }
  if ((outgoing.position === 'BR') !== (incoming.position === 'BR')) {
    return { game, error: 'Bramkarza można zastąpić tylko innym bramkarzem.' }
  }
  const next = structuredClone(game)
  moveUnavailableBenchPlayersOutside(next, competition)
  next.matchLineupIds = next.matchLineupIds.map((id) => id === outgoingId ? incomingId : id)
  if (next.matchBenchIds.includes(incomingId)) {
    next.matchBenchIds = next.matchBenchIds.map((id) => id === incomingId ? outgoingId : id)
    next.matchOutsideSquadIds = (next.matchOutsideSquadIds ?? []).filter((id) => id !== incomingId && id !== outgoingId)
  } else {
    const outsideIds = [...(next.matchOutsideSquadIds ?? [])]
    const outsideIndex = outsideIds.indexOf(incomingId)
    if (outsideIndex >= 0) outsideIds[outsideIndex] = outgoingId
    else outsideIds.push(outgoingId)
    next.matchOutsideSquadIds = outsideIds.filter((id, index) => id !== incomingId && outsideIds.indexOf(id) === index)
    next.matchBenchIds = next.matchBenchIds.filter((id) => id !== outgoingId)
  }
  return { game: next, error: '' }
}

export function makeMatchdaySubstitution(game: GameState, outgoingId: string, incomingId: string, competition: CompetitionId = 'league') {
  const event = game.pendingMatchEvent
  if (!event || event.round !== game.round) return { game, error: 'Nie ma aktywnego meczu, w którym można dokonać zmiany.' }
  if ((event.substitutionsUsed ?? 0) >= 3) return { game, error: 'W tym meczu wykorzystano już wszystkie 3 zmiany.' }
  if (!game.matchBenchIds.includes(incomingId)) return { game, error: 'Zmiana musi zostać wykonana przez zawodnika z ławki rezerwowych.' }
  if (event.substitutedPlayerIds?.includes(incomingId)) return { game, error: 'Zawodnik, który wcześniej opuścił boisko, nie może ponownie wejść do gry.' }
  const result = replaceMatchPlayer(game, outgoingId, incomingId, competition)
  if (result.error) return result
  const updatedEvent = result.game.pendingMatchEvent
  if (!updatedEvent) throw new Error('Aktywne wydarzenie meczowe zniknęło podczas zmiany.')
  updatedEvent.substitutionsUsed = (updatedEvent.substitutionsUsed ?? 0) + 1
  updatedEvent.substitutedPlayerIds = [...(updatedEvent.substitutedPlayerIds ?? []), outgoingId]
  updatedEvent.substitutePlayerIds = [...(updatedEvent.substitutePlayerIds ?? []), incomingId]
  return { game: result.game, error: '' }
}

export function applyPreviousMatchSquad(game: GameState, competition: CompetitionId = 'league') {
  if (!game.previousMatchLineupIds.length) {
    return { game, error: 'Nie rozegrano jeszcze meczu, z którego można skopiować skład.' }
  }
  const next = structuredClone(game)
  const restoredIds = new Set([...next.previousMatchLineupIds, ...next.previousMatchBenchIds])
  next.matchOutsideSquadIds = (next.matchOutsideSquadIds ?? []).filter((id) => !restoredIds.has(id))
  const selection = completeMatchSquad(next, next.previousMatchLineupIds, next.previousMatchBenchIds, competition)
  next.matchLineupIds = selection.starters
  next.matchBenchIds = selection.bench
  return { game: next, error: '' }
}

export function toggleLineupPlayer(game: GameState, playerId: string, competition: CompetitionId = 'league') {
  const next = structuredClone(game)
  const player = next.squad.find((item) => item.id === playerId)
  if (!player) return { game, error: 'Nie znaleziono zawodnika w kadrze.' }
  const selected = next.lineupIds.includes(playerId)
  if (getInjuryMatches(player) > 0 && !selected) return { game, error: 'Kontuzjowany zawodnik nie może znaleźć się w podstawowym składzie.' }
  if (getSuspensionMatches(player, competition) > 0 && !selected) return { game, error: 'Zawodnik pauzuje i nie może znaleźć się w podstawowym składzie na najbliższe spotkanie.' }
  if (selected && next.lineupIds.length <= 11 && getInjuryMatches(player) === 0) return { game, error: 'W składzie musi pozostać co najmniej 11 zawodników.' }
  if (!selected && next.lineupIds.length >= 11) return { game, error: 'Skład meczowy jest pełny. Najpierw wyjmij zawodnika z jedenastki.' }
  next.lineupIds = selected
    ? next.lineupIds.filter((id) => id !== playerId)
    : [...next.lineupIds, playerId]
  return { game: next, error: '' }
}

export function trainSquad(game: GameState, focus: TrainingFocus) {
  const next = structuredClone(game)
  const fee = 25_000
  if (next.cash < fee) return { game, error: 'Za mało środków na opłacenie sesji treningowej.' }
  next.staff ??= []
  const hasFitnessCoach = next.staff.some((member) => member.role === 'fitness-coach')
  const hasTechnicalCoach = next.staff.some((member) => member.role === 'technical-coach')
  const selected = next.squad.filter((player) =>
    (next.lineupIds.includes(player.id) || player.trainingPlan)
    && getInjuryMatches(player) === 0,
  )
  if (selected.length === 0) return { game, error: 'Brak zdrowych zawodników w podstawowym składzie do treningu.' }
  selected.forEach((player) => {
    const isInStartingLineup = next.lineupIds.includes(player.id)
    if (focus === 'fitness' && isInStartingLineup) player.stamina = Math.min(100, player.stamina + (hasFitnessCoach ? 18 : 12))
    if (focus === 'attack' && (
      ['ŚN', 'LN', 'PN', 'OP'].includes(player.position)
      || hasTechnicalCoach && ['DP', 'ŚP', 'PP', 'LP'].includes(player.position)
    ) && isInStartingLineup) {
      player.skill = Math.min(player.potential, player.skill + 1)
      if (player.skill < player.potential && Math.random() < (next.facilities.training ?? 0) * 0.1) {
        player.skill = Math.min(player.potential, player.skill + 1)
      }
    }
    if (focus === 'tactics' && isInStartingLineup) player.morale = Math.min(100, player.morale + 8)
    const compatiblePlan = player.trainingPlan === 'fitness'
      ? focus === 'fitness'
      : player.trainingPlan === 'finishing'
        ? focus === 'attack' && ['ŚN', 'LN', 'PN', 'OP'].includes(player.position)
        : player.trainingPlan === 'playmaking'
          ? focus === 'tactics' && ['DP', 'ŚP', 'OP', 'PP', 'LP'].includes(player.position)
          : player.trainingPlan === 'leadership' && focus === 'tactics'
    if (compatiblePlan && player.trainingPlan) {
      if (player.trainingPlan === 'fitness') {
        player.stamina = Math.min(100, player.stamina + 6)
      } else if (player.trainingPlan === 'leadership') {
        player.morale = Math.min(100, player.morale + 3)
      } else {
        player.trainingPlanSessions = (player.trainingPlanSessions ?? 0) + 1
        if (player.trainingPlanSessions >= 3) {
          const previousSkill = player.skill
          player.skill = Math.min(player.potential, player.skill + 1)
          player.trainingPlanSessions = 0
          if (player.skill > previousSkill) {
            addPlayerHistory(player, {
              season: next.season,
              type: 'overall',
              title: 'Postęp w treningu indywidualnym',
              details: `Plan ${player.trainingPlan === 'finishing' ? 'wykańczania akcji' : 'rozgrywania'} podniósł umiejętność z ${previousSkill} do ${player.skill}.`,
            })
          }
        }
      }
    }
    player.value = playerValue(player.skill, player.potential, player.age)
    if (isInStartingLineup) player.stamina = Math.max(35, player.stamina - (focus === 'fitness' ? 0 : 4))
  })
  addFinance(next, 'Sesja treningowa', -fee)
  if (hasFitnessCoach && focus === 'fitness') {
    addMediaPost(next, 'KLUB', 'Trening kondycyjny pod okiem specjalisty', 'Trener przygotowania fizycznego poprowadził sesję regeneracyjną dla podstawowej jedenastki.')
  }
  if (hasTechnicalCoach && focus === 'attack') {
    addMediaPost(next, 'KLUB', 'Trening techniczny objął całą formację', 'Trener techniczny poprowadził zajęcia ofensywne dla napastników, ofensywnych pomocników i środkowej linii.')
  }
  return { game: next, error: '' }
}

export function signPlayer(game: GameState, playerId: string) {
  if (!getTransferWindowInfo(game).isOpen) return { game, error: 'Okno transferowe jest zamknięte. Nowych zawodników można pozyskiwać w oknie letnim lub zimowym.' }
  const next = structuredClone(game)
  const playerIndex = next.market.findIndex((player) => player.id === playerId)
  if (playerIndex < 0) return { game, error: 'Ten zawodnik nie jest już dostępny na rynku.' }
  if (next.squad.length >= 30) return { game, error: 'Kadra ma już maksymalny rozmiar (30 zawodników).' }
  const player = next.market[playerIndex]
  if (next.cash < player.value) return { game, error: 'Klub nie ma wystarczających środków na tę transakcję.' }
  const signedPlayer = { ...player, morale: 72 }
  assignNextSquadNumber(signedPlayer, next.squad)
  next.squad.push(signedPlayer)
  addPlayerHistory(next.squad[next.squad.length - 1], {
    season: next.season,
    type: 'club',
    title: next.clubName,
    details: 'Dołączył do klubu jako wolny zawodnik.',
  })
  next.market.splice(playerIndex, 1)
  syncTeamStrength(next, next.teamId, next.squad)
  addFinance(next, `Transfer: ${player.firstName} ${player.lastName}`, -player.value)
  addMediaPost(next, 'TRANSFER', `${player.firstName} ${player.lastName} nowym zawodnikiem ${next.clubName}`, `Klub wzmacnia kadrę przed kolejnymi spotkaniami. Zawodnik występuje na pozycji ${player.position}.`)
  return { game: next, error: '' }
}

export function renamePlayer(game: GameState, playerId: string, firstName: string, lastName: string) {
  const trimmedFirstName = firstName.trim()
  const trimmedLastName = lastName.trim()
  if (!trimmedFirstName || !trimmedLastName) {
    return { game, error: 'Imię i nazwisko zawodnika nie mogą być puste.' }
  }
  if (trimmedFirstName.length > 32 || trimmedLastName.length > 40) {
    return { game, error: 'Imię może mieć maksymalnie 32 znaki, a nazwisko 40 znaków.' }
  }
  const next = structuredClone(game)
  const player = next.squad.find((item) => item.id === playerId)
  if (!player) return { game, error: 'Nie znaleziono zawodnika w kadrze.' }
  player.firstName = trimmedFirstName
  player.lastName = trimmedLastName
  return { game: next, error: '' }
}

export function renameOwnClub(game: GameState, name: string) {
  const trimmedName = name.trim()
  if (trimmedName.length < 2 || trimmedName.length > 36) {
    return { game, error: 'Nazwa klubu musi mieć od 2 do 36 znaków.' }
  }
  const next = structuredClone(game)
  next.clubName = trimmedName
  const renameTeam = (teams: Array<{ id: string; name: string }> | undefined) => {
    teams?.forEach((team) => {
      if (team.id === next.teamId) team.name = trimmedName
    })
  }
  renameTeam(next.teams)
  Object.values(next.leagueWorld ?? {}).forEach(renameTeam)
  renameTeam(next.polishCup?.teams)
  next.regionalCups?.forEach((cup) => renameTeam(cup.teams))
  return { game: next, error: '' }
}

export function getPlayerContractDemand(player: Player) {
  const increase = 0.12 + Math.max(0, 70 - player.morale) / 1000
  return Math.ceil(player.wage * (1 + increase) / 100) * 100
}

export function talkToPlayer(game: GameState, playerId: string, action: 'encourage' | 'minutes' | 'wage' | 'mediate') {
  const player = game.squad.find((item) => item.id === playerId)
  if (!player) return { game, error: 'Nie znaleziono zawodnika w kadrze.' }
  if (player.lastConversationSeason === game.season && game.round - (player.lastConversationRound ?? game.round) < 3) {
    return { game, error: 'Zawodnik potrzebuje czasu po poprzedniej rozmowie. Spróbuj ponownie za kilka kolejek.' }
  }
  if (action === 'encourage' && player.morale >= 100) {
    return { game, error: 'Morale zawodnika jest już maksymalne.' }
  }
  if (action === 'mediate') {
    const captainId = game.playerSpecialRoles?.captain
    const mediator = game.squad.find((candidate) => candidate.id === captainId && candidate.id !== playerId)
      ?? game.squad.filter((candidate) => candidate.id !== playerId && candidate.personality === 'leader')
        .sort((first, second) => second.age - first.age)[0]
    if (!mediator) return { game, error: 'W drużynie nie ma dostępnego lidera, który mógłby pomóc w rozmowie.' }
  } else if (action !== 'encourage') {
    if (player.moralePromise) return { game, error: 'Najpierw rozliczcie obecną obietnicę.' }
    const remainingFixtures = game.matches.filter((match) =>
      !match.played && !match.bye && (match.homeId === game.teamId || match.awayId === game.teamId),
    ).length
    if (remainingFixtures < 6) return { game, error: 'Do końca sezonu musi pozostać co najmniej 6 meczów ligowych, aby złożyć tę obietnicę.' }
  }

  const next = structuredClone(game)
  const nextPlayer = next.squad.find((item) => item.id === playerId)
  if (!nextPlayer) throw new Error('Zawodnik zniknął z kadry podczas rozmowy.')
  nextPlayer.lastConversationSeason = next.season
  nextPlayer.lastConversationRound = next.round
  if (action === 'mediate') {
    const mediator = next.squad.find((candidate) => candidate.id === next.playerSpecialRoles?.captain && candidate.id !== playerId)
      ?? next.squad.filter((candidate) => candidate.id !== playerId && candidate.personality === 'leader')
        .sort((first, second) => second.age - first.age)[0]
    if (!mediator) throw new Error('Nie udało się odnaleźć lidera drużyny podczas mediacji.')
    nextPlayer.morale = Math.min(100, nextPlayer.morale + 6)
    mediator.morale = Math.min(100, mediator.morale + 2)
    adjustTeamChemistry(next, [mediator.id, nextPlayer.id], 15)
    if (nextPlayer.morale >= 40) nextPlayer.transferRequest = false
    addMediaPost(next, 'KLUB', `Liderzy szatni wspierają ${nextPlayer.firstName} ${nextPlayer.lastName}`, `${mediator.firstName} ${mediator.lastName} pomógł poprawić atmosferę i relacje w drużynie.`)
    return { game: next, error: '' }
  }
  if (action === 'encourage') {
    const moraleGain = nextPlayer.personality === 'ambitious' || nextPlayer.personality === 'temperamental' ? 6 : 8
    nextPlayer.morale = Math.min(100, nextPlayer.morale + moraleGain)
    if (nextPlayer.morale >= 40) nextPlayer.transferRequest = false
    addMediaPost(next, 'KLUB', `Rozmowa z ${nextPlayer.firstName} ${nextPlayer.lastName}`, `Menedżer wsparł zawodnika, którego morale wzrosło do ${nextPlayer.morale}.`)
    return { game: next, error: '' }
  }

  nextPlayer.moralePromise = {
    kind: action,
    matchesRemaining: 6,
    startsRequired: 4,
    startsCompleted: 0,
  }
  nextPlayer.morale = Math.min(100, nextPlayer.morale + 6)
  if (nextPlayer.morale >= 40) nextPlayer.transferRequest = false
  const promise = action === 'minutes'
    ? '4 występy w podstawowym składzie w najbliższych 6 meczach ligowych'
    : '4 występy w podstawowym składzie w najbliższych 6 meczach ligowych, po których pensja wzrośnie o 15%'
  addMediaPost(next, 'KLUB', `Obietnica dla ${nextPlayer.firstName} ${nextPlayer.lastName}`, `Menedżer obiecał zawodnikowi: ${promise}.`)
  return { game: next, error: '' }
}

function resolvePlayerPromises(game: GameState, startingIds: string[]) {
  for (const player of game.squad) {
    const promise = player.moralePromise
    if (!promise) continue
    promise.matchesRemaining -= 1
    if (startingIds.includes(player.id)) promise.startsCompleted += 1
    if (promise.matchesRemaining > 0) continue

    const fulfilled = promise.kind === 'stay' || promise.startsCompleted >= promise.startsRequired
    if (fulfilled) {
      if (promise.kind === 'wage') player.wage = Math.ceil(player.wage * 1.15 / 100) * 100
      player.morale = Math.min(100, player.morale + 12)
    } else {
      player.morale = Math.max(20, player.morale - 15)
    }
    player.moralePromise = null
    if (player.morale >= 40) player.transferRequest = false
    const name = `${player.firstName} ${player.lastName}`
    if (fulfilled) {
      const outcome = promise.kind === 'wage'
        ? `Zawodnik spełnił warunek i otrzyma podwyżkę do ${player.wage.toLocaleString('pl-PL')} zł za kolejkę.`
        : promise.kind === 'stay'
          ? 'Menedżer dotrzymał obietnicy, a zawodnik pozostał w klubie.'
          : 'Zawodnik spełnił warunek regularnych występów.'
      addMediaPost(game, 'KLUB', `Spełniono obietnicę wobec ${name}`, outcome)
    } else {
      addMediaPost(game, 'KLUB', `Niedotrzymana obietnica wobec ${name}`, `Zawodnik rozpoczął tylko ${promise.startsCompleted} z wymaganych ${promise.startsRequired} spotkań w podstawowym składzie. Jego morale spadło.`)
    }
  }
  for (const player of game.squad) {
    if (player.morale <= 25 && !player.transferRequest) {
      player.transferRequest = true
      addMediaPost(game, 'KLUB', `${player.firstName} ${player.lastName} rozważa odejście`, 'Niskie morale sprawiło, że zawodnik poprosił o możliwość odejścia. Rozmowa lub poprawa sytuacji w drużynie może zmienić jego nastawienie.')
    } else if (player.morale >= 40 && player.transferRequest) {
      player.transferRequest = false
      addMediaPost(game, 'KLUB', `${player.firstName} ${player.lastName} wycofuje prośbę o transfer`, 'Poprawa nastroju przekonała zawodnika, by na razie pozostał w klubie.')
    }
  }
}

export function renewPlayerContract(game: GameState, playerId: string, offeredWage: number, extensionSeasons: number) {
  const player = game.squad.find((item) => item.id === playerId)
  if (!player) return { game, error: 'Nie znaleziono zawodnika w kadrze.' }
  if ((player.contractSeasonsRemaining ?? 2) > 1) return { game, error: 'Negocjacje można rozpocząć, gdy do końca umowy pozostaje najwyżej jeden sezon.' }
  if (!Number.isInteger(extensionSeasons) || extensionSeasons < 1 || extensionSeasons > 3) {
    return { game, error: 'Przedłużenie może obejmować od 1 do 3 sezonów.' }
  }
  if (!Number.isFinite(offeredWage) || offeredWage < 0) return { game, error: 'Podaj prawidłową stawkę wynagrodzenia.' }
  const roundedWage = Math.round(offeredWage / 100) * 100
  const minimumWage = getPlayerContractDemand(player)
  if (roundedWage < minimumWage) {
    return { game, error: `${player.firstName} ${player.lastName} oczekuje co najmniej ${minimumWage.toLocaleString('pl-PL')} zł za kolejkę.` }
  }
  const next = structuredClone(game)
  const renewedPlayer = next.squad.find((item) => item.id === playerId)
  if (!renewedPlayer) throw new Error('Zawodnik zniknął z kadry podczas negocjacji kontraktu.')
  renewedPlayer.wage = roundedWage
  renewedPlayer.contractSeasonsRemaining = (renewedPlayer.contractSeasonsRemaining ?? 1) + extensionSeasons
  addFinance(next, `Nowy kontrakt: ${renewedPlayer.firstName} ${renewedPlayer.lastName}`, 0)
  addMediaPost(next, 'KLUB', `${renewedPlayer.firstName} ${renewedPlayer.lastName} przedłuża umowę`, `Zawodnik pozostanie w ${next.clubName} przez kolejne ${extensionSeasons} ${extensionSeasons === 1 ? 'sezon' : extensionSeasons < 5 ? 'sezony' : 'sezonów'}. Nowe wynagrodzenie wynosi ${renewedPlayer.wage.toLocaleString('pl-PL')} zł za kolejkę.`)
  return { game: next, error: '' }
}

function completeClubTransfer(
  game: GameState,
  clubId: string,
  playerId: string,
  price: number,
  negotiation: TransferNegotiation,
) {
  if (!getTransferWindowInfo(game).isOpen) return { game, error: 'Okno transferowe jest zamknięte. Transfer nie może zostać sfinalizowany.' }
  const next = structuredClone(game)
  const offers = next.clubSquads[clubId]
  const offerIndex = offers?.findIndex((offer) => offer.player.id === playerId) ?? -1
  if (offerIndex < 0) return { game, error: 'Ten zawodnik nie jest już dostępny w swoim klubie.' }
  if (next.squad.length >= 30) return { game, error: 'Kadra ma już maksymalny rozmiar (30 zawodników).' }
  if (next.cash < price) return { game, error: 'Klub nie ma wystarczających środków na uzgodnioną kwotę.' }

  const player = offers[offerIndex].player
  const sellingTeam = next.teams.find((team) => team.id === clubId)
    ?? Object.values(next.leagueWorld ?? {}).flat().find((team) => team.id === clubId)
  if (!sellingTeam) return { game, error: 'Nie znaleziono klubu sprzedającego.' }
  offers.splice(offerIndex, 1)
  const signedPlayer = { ...player, morale: 72 }
  assignNextSquadNumber(signedPlayer, next.squad)
  next.squad.push(signedPlayer)
  addPlayerHistory(next.squad[next.squad.length - 1], {
    season: next.season,
    type: 'club',
    title: next.clubName,
    details: `Transfer z klubu ${sellingTeam.name}.`,
  })
  syncTeamStrength(next, clubId, offers.map((offer) => offer.player))
  syncTeamStrength(next, next.teamId, next.squad)
  const existingNegotiation = next.transferNegotiations.find((item) => item.id === negotiation.id)
  if (existingNegotiation) {
    existingNegotiation.status = 'accepted'
    existingNegotiation.counterAmount = null
  } else {
    next.transferNegotiations.unshift({ ...negotiation, status: 'accepted', counterAmount: null })
  }
  next.transferNegotiations
    .filter((item) => item.playerId === playerId && item.status === 'countered')
    .forEach((item) => { item.status = 'rejected' })
  addFinance(next, `Transfer: ${player.firstName} ${player.lastName}`, -price)
  addMediaPost(next, 'TRANSFER', `${player.firstName} ${player.lastName} przechodzi do ${next.clubName}`, `${sellingTeam.name} zaakceptował ofertę transferową w wysokości ${price.toLocaleString('pl-PL')} zł.`)
  addInboxMessage(next, sellingTeam.name, `Oferta zaakceptowana: ${player.firstName} ${player.lastName}`, `${sellingTeam.name} zaakceptował ofertę w wysokości ${price.toLocaleString('pl-PL')} zł. Transfer został sfinalizowany, a zawodnik dołączył do ${next.clubName}.`, 'accepted', 'transfer', negotiation.id)
  return { game: next, error: '' }
}

function getClubTransferMinimum(offers: ClubPlayerOffer[], playerId: string) {
  const playerOffer = offers.find((offer) => offer.player.id === playerId)
  if (!playerOffer) return null
  const rankedPlayers = [...offers].sort((first, second) => second.player.skill - first.player.skill)
  const playerRank = rankedPlayers.findIndex((offer) => offer.player.id === playerId)
  const { player } = playerOffer
  let multiplier = playerRank === 0 ? 1.25 : playerRank <= 2 ? 1.15 : playerRank <= 5 ? 1.07 : 1
  if (player.age <= 21 && player.potential - player.skill >= 10) multiplier *= 1.1
  if ((player.contractSeasonsRemaining ?? 2) >= 3) multiplier *= 1.08
  if ((player.contractSeasonsRemaining ?? 2) <= 1) multiplier *= 0.9
  return Math.ceil(playerOffer.askingPrice * multiplier / 1000) * 1000
}

export function proposeClubTransfer(game: GameState, clubId: string, playerId: string, offeredAmount: number) {
  if (!getTransferWindowInfo(game).isOpen) return { game, error: 'Okno transferowe jest zamknięte. Nie można składać nowych ofert.' }
  const clubOffers = game.clubSquads[clubId]
  const offer = clubOffers?.find((item) => item.player.id === playerId)
  if (!offer) return { game, error: 'Ten zawodnik nie jest już dostępny w swoim klubie.' }
  if (!Number.isFinite(offeredAmount) || offeredAmount <= 0) return { game, error: 'Podaj prawidłową kwotę oferty.' }
  if (game.squad.length >= 30) return { game, error: 'Kadra ma już maksymalny rozmiar (30 zawodników).' }
  if (game.cash < offeredAmount) return { game, error: 'Budżet klubu nie wystarcza na taką ofertę.' }
  const minimumPrice = getClubTransferMinimum(clubOffers, playerId)
  if (minimumPrice === null) return { game, error: 'Nie udało się ustalić oczekiwań klubu sprzedającego.' }

  const negotiation: TransferNegotiation = {
    id: createId(),
    clubId,
    playerId,
    offeredAmount: Math.round(offeredAmount),
    counterAmount: null,
    status: 'rejected',
    counterRounds: 0,
  }
  if (offeredAmount >= minimumPrice) {
    return completeClubTransfer(game, clubId, playerId, Math.round(offeredAmount), negotiation)
  }

  const next = structuredClone(game)
  next.transferNegotiations
    .filter((item) => item.playerId === playerId && item.status === 'countered')
    .forEach((item) => { item.status = 'rejected' })
  const counterAmount = minimumPrice
  negotiation.counterAmount = counterAmount
  negotiation.status = offeredAmount >= offer.askingPrice || offeredAmount >= minimumPrice * 0.75 ? 'countered' : 'rejected'
  next.transferNegotiations.unshift(negotiation)
  const response = negotiation.status === 'countered'
    ? `${getTeamName(next, clubId)} odrzucił ofertę ${negotiation.offeredAmount.toLocaleString('pl-PL')} zł, ale proponuje kontrofertę w wysokości ${counterAmount.toLocaleString('pl-PL')} zł. Możesz ją zaakceptować lub złożyć własną propozycję na rynku transferowym.`
    : `${getTeamName(next, clubId)} odrzucił ofertę ${negotiation.offeredAmount.toLocaleString('pl-PL')} zł. Klub nie jest zainteresowany sprzedażą za tę kwotę.`
  addInboxMessage(
    next,
    getTeamName(next, clubId),
    negotiation.status === 'countered' ? `Kontroferta za ${offer.player.firstName} ${offer.player.lastName}` : `Oferta odrzucona: ${offer.player.firstName} ${offer.player.lastName}`,
    response,
    negotiation.status,
    'transfer',
    negotiation.id,
  )
  return {
    game: next,
    error: '',
    message: negotiation.status === 'countered'
      ? `${getTeamName(next, clubId)} odrzuca pierwotną kwotę, ale proponuje ${counterAmount.toLocaleString('pl-PL')} zł.`
      : `${getTeamName(next, clubId)} odrzucił ofertę. Spróbuj zaproponować wyższą kwotę.`,
  }
}

export function respondToClubTransferCounteroffer(game: GameState, negotiationId: string, offeredAmount: number) {
  if (!getTransferWindowInfo(game).isOpen) return { game, error: 'Okno transferowe jest zamknięte. Wróć do negocjacji podczas kolejnego okna.' }
  const negotiation = game.transferNegotiations.find((item) => item.id === negotiationId && item.status === 'countered')
  if (!negotiation || negotiation.counterAmount === null) return { game, error: 'Ta kontroferta nie jest już aktywna.' }
  if (!Number.isFinite(offeredAmount) || offeredAmount <= negotiation.offeredAmount || offeredAmount >= negotiation.counterAmount) {
    return { game, error: 'Kontrpropozycja musi być wyższa od poprzedniej oferty i niższa od kontroferty klubu.' }
  }
  if (game.cash < offeredAmount) return { game, error: 'Budżet klubu nie wystarcza na taką kontrpropozycję.' }
  const offer = game.clubSquads[negotiation.clubId]?.find((item) => item.player.id === negotiation.playerId)
  if (!offer) return { game, error: 'Ten zawodnik nie jest już dostępny w swoim klubie.' }
  const minimumPrice = getClubTransferMinimum(game.clubSquads[negotiation.clubId] ?? [], negotiation.playerId)
  if (minimumPrice === null) return { game, error: 'Nie udało się ustalić oczekiwań klubu sprzedającego.' }
  if (offeredAmount >= minimumPrice * 0.92) {
    return completeClubTransfer(game, negotiation.clubId, negotiation.playerId, Math.round(offeredAmount), negotiation)
  }
  const next = structuredClone(game)
  const active = next.transferNegotiations.find((item) => item.id === negotiationId)
  if (!active) return { game, error: 'Nie znaleziono aktywnej negocjacji.' }
  if ((active.counterRounds ?? 0) >= 2) {
    active.status = 'rejected'
    active.counterAmount = null
    addInboxMessage(
      next,
      getTeamName(next, active.clubId),
      `Negocjacje zakończone: ${offer.player.firstName} ${offer.player.lastName}`,
      `${getTeamName(next, active.clubId)} odrzucił ostatnią propozycję w wysokości ${Math.round(offeredAmount).toLocaleString('pl-PL')} zł. Transfer nie doszedł do skutku.`,
      'rejected',
      'transfer',
      active.id,
    )
    return { game: next, error: '', message: `${getTeamName(next, active.clubId)} odrzuca ostatnią propozycję. Negocjacje zakończone.` }
  }
  active.offeredAmount = Math.round(offeredAmount)
  const nextCounterReduction = active.counterRounds === 0 ? 0.03 : 0.06
  active.counterAmount = Math.max(
    Math.round(offeredAmount / 1000) * 1000 + 1_000,
    Math.ceil(minimumPrice * (1 - nextCounterReduction) / 1000) * 1000,
  )
  active.counterRounds = (active.counterRounds ?? 0) + 1
  const isFinalCounter = active.counterRounds >= 2
  addInboxMessage(
    next,
    getTeamName(next, active.clubId),
    `${isFinalCounter ? 'Ostateczna kontroferta' : 'Nowa kontroferta'} za ${offer.player.firstName} ${offer.player.lastName}`,
    `${getTeamName(next, active.clubId)} nie przyjął propozycji ${Math.round(offeredAmount).toLocaleString('pl-PL')} zł. ${isFinalCounter ? 'Klub przedstawia ostatnią kontrofertę' : 'Po dalszych rozmowach klub obniża oczekiwaną kwotę do'}: ${active.counterAmount.toLocaleString('pl-PL')} zł.`,
    'countered',
    'transfer',
    active.id,
  )
  return {
    game: next,
    error: '',
    message: `${getTeamName(next, active.clubId)} odrzuca propozycję i składa ${isFinalCounter ? 'ostateczną ' : ''}kontrofertę: ${active.counterAmount.toLocaleString('pl-PL')} zł.`,
  }
}

export function acceptClubTransferCounteroffer(game: GameState, negotiationId: string) {
  if (!getTransferWindowInfo(game).isOpen) return { game, error: 'Okno transferowe jest zamknięte. Wróć do negocjacji podczas kolejnego okna.' }
  const negotiation = game.transferNegotiations.find((item) => item.id === negotiationId && item.status === 'countered')
  if (!negotiation || negotiation.counterAmount === null) return { game, error: 'Ta kontroferta nie jest już aktywna.' }
  const activeNegotiation = game.transferNegotiations.find((item) => item.id === negotiationId)
  if (!activeNegotiation) return { game, error: 'Nie znaleziono negocjacji.' }
  return completeClubTransfer(game, negotiation.clubId, negotiation.playerId, negotiation.counterAmount, negotiation)
}

export function rejectClubTransferCounteroffer(game: GameState, negotiationId: string) {
  const next = structuredClone(game)
  const negotiation = next.transferNegotiations.find((item) => item.id === negotiationId && item.status === 'countered')
  if (!negotiation) return { game, error: 'Ta kontroferta nie jest już aktywna.' }
  negotiation.status = 'rejected'
  return { game: next, error: '' }
}

export function sellPlayer(game: GameState, playerId: string) {
  if (!getTransferWindowInfo(game).isOpen) return { game, error: 'Okno transferowe jest zamknięte. Zawodników można sprzedawać w oknie letnim lub zimowym.' }
  const next = structuredClone(game)
  if (next.squad.length <= 11) return { game, error: 'Nie możesz sprzedać zawodnika, jeśli kadra liczy tylko 11 osób.' }
  const player = next.squad.find((item) => item.id === playerId)
  if (!player) return { game, error: 'Nie znaleziono zawodnika.' }
  if (next.inboxMessages?.some((message) =>
    message.playerStory?.playerId === playerId && !message.playerStory.selectedChoiceId,
  )) return { game, error: 'Najpierw odpowiedz na nierozstrzygniętą prośbę tego zawodnika.' }
  if (player.moralePromise) return { game, error: 'Nie możesz sprzedać zawodnika, dopóki nie rozliczycie złożonej mu obietnicy.' }
  const fee = Math.round(player.value * 0.82)
  next.squad = next.squad.filter((item) => item.id !== playerId)
  syncTeamStrength(next, next.teamId, next.squad)
  next.lineupIds = next.lineupIds.filter((id) => id !== playerId)
  next.matchLineupIds = next.matchLineupIds.filter((id) => id !== playerId)
  next.matchBenchIds = next.matchBenchIds.filter((id) => id !== playerId)
  next.previousMatchLineupIds = next.previousMatchLineupIds.filter((id) => id !== playerId)
  next.previousMatchBenchIds = next.previousMatchBenchIds.filter((id) => id !== playerId)
  addFinance(next, `Transfer wychodzący: ${player.firstName} ${player.lastName}`, fee)
  addMediaPost(next, 'TRANSFER', `${player.firstName} ${player.lastName} odchodzi z ${next.clubName}`, `Klub zaakceptował ofertę transferową. Do budżetu wpłynie ${fee.toLocaleString('pl-PL')} zł.`)
  return { game: next, error: '' }
}

export function offerPlayerToClubs(game: GameState, playerId: string, askingAmount: number, clubIds: string[]) {
  if (!getTransferWindowInfo(game).isOpen) return { game, error: 'Okno transferowe jest zamknięte. Zawodników można oferować klubom tylko w oknie letnim lub zimowym.' }
  const player = game.squad.find((item) => item.id === playerId)
  if (!player) return { game, error: 'Nie znaleziono zawodnika w Twojej kadrze.' }
  if (game.squad.length <= 11) return { game, error: 'Nie możesz wystawić zawodnika, jeśli kadra liczy tylko 11 osób.' }
  if (player.moralePromise) return { game, error: 'Nie możesz wystawić zawodnika, dopóki nie rozliczycie złożonej mu obietnicy.' }
  if (game.loanDeals?.some((deal) => deal.player.id === playerId)) return { game, error: 'Zawodnik jest związany aktywną umową wypożyczenia.' }
  const activeListing = game.outgoingPlayerTransferListings?.find((listing) =>
    listing.playerId === playerId && listing.status === 'active',
  )
  if (!activeListing && game.incomingTransferOffers?.some((offer) =>
    offer.playerId === playerId && ['pending', 'countered', 'player-negotiation'].includes(offer.status),
  )) return { game, error: 'Ten zawodnik ma już aktywną ofertę w skrzynce. Rozstrzygnij ją przed wystawieniem na rynek.' }
  if (!activeListing && game.inboxMessages?.some((message) =>
    message.playerStory?.playerId === playerId && !message.playerStory.selectedChoiceId,
  )) return { game, error: 'Najpierw odpowiedz na nierozstrzygniętą prośbę tego zawodnika.' }
  if (!Number.isFinite(askingAmount) || askingAmount < 50_000) return { game, error: 'Cena wywoławcza musi wynosić co najmniej 50 000 zł.' }
  const uniqueClubIds = [...new Set(clubIds)]
  if (uniqueClubIds.length > 3) return { game, error: 'Możesz zaoferować zawodnika maksymalnie 3 nowym klubom naraz.' }
  if (!activeListing && uniqueClubIds.length === 0) return { game, error: 'Wybierz od 1 do 3 klubów, którym zaoferujesz zawodnika.' }
  if (activeListing && uniqueClubIds.some((clubId) => activeListing.clubIds.includes(clubId))) {
    return { game, error: 'Wybierz kluby, którym ten zawodnik nie był jeszcze oferowany.' }
  }
  const buyers = uniqueClubIds.map((clubId) => game.teams.find((team) => team.id === clubId))
  if (buyers.some((team) => !team || team.id === game.teamId || !game.clubSquads[team.id]?.length)) {
    return { game, error: 'Możesz wybrać tylko istniejące kluby AI z dostępną kadrą.' }
  }
  if (uniqueClubIds.some((clubId) => game.incomingTransferOffers?.some((offer) =>
    offer.playerId === playerId
    && offer.clubId === clubId
    && ['pending', 'countered', 'player-negotiation'].includes(offer.status),
  ))) return { game, error: 'Wybrany klub prowadzi już aktywne negocjacje z tym zawodnikiem.' }

  const next = structuredClone(game)
  next.incomingTransferOffers ??= []
  next.outgoingPlayerTransferListings ??= []
  const listingId = activeListing?.id ?? createId()
  const window = getTransferWindowInfo(next).currentWindow
  if (!window) return { game, error: 'Okno transferowe jest zamknięte.' }
  const windowId = `${next.season}-${window.name}`
  let listing = next.outgoingPlayerTransferListings.find((item) => item.id === listingId)
  if (listing) {
    listing.askingAmount = Math.round(askingAmount)
    listing.clubIds.push(...uniqueClubIds)
  } else {
    listing = {
      id: listingId,
      playerId,
      askingAmount: Math.round(askingAmount),
      clubIds: uniqueClubIds,
      offerIds: [],
      createdRound: next.round,
      status: 'active',
    }
    next.outgoingPlayerTransferListings.unshift(listing)
  }

  let offerCount = 0
  for (const buyer of buyers) {
    if (!buyer) continue
    const inboxAlreadyActive = next.incomingTransferOffers.some((offer) =>
      offer.playerId === playerId
      && offer.clubId === buyer.id
      && ['pending', 'countered', 'player-negotiation'].includes(offer.status),
    )
    if (inboxAlreadyActive) {
      const message = addInboxMessage(
        next,
        buyer.name,
        `Brak nowej oferty za ${player.firstName} ${player.lastName}`,
        `Negocjacje z ${buyer.name} dotyczące tego zawodnika są już aktywne. Nie wysłano drugiej oferty.`,
        'info',
        'transfer',
      )
      message.relatedOutgoingListingId = listingId
      continue
    }

    const buyerOffers = next.clubSquads[buyer.id] ?? []
    const interest = getAiTransferNeedScore(buyer, player, buyerOffers)
    const budget = getTransferBudget(buyer)
    const maximumOffer = Math.min(
      budget,
      Math.max(Math.round(player.value * 1.25), Math.round(player.value * (0.82 + interest / 500))),
    )
    const rejects = budget < Math.min(listing.askingAmount * 0.55, Math.max(50_000, player.value * 0.45))
      || interest < 45
      || maximumOffer < Math.min(listing.askingAmount * 0.45, 50_000)
    if (rejects) {
      const message = addInboxMessage(
        next,
        buyer.name,
        `Oferta za ${player.firstName} ${player.lastName} odrzucona`,
        `${buyer.name} nie jest zainteresowany transferem ${player.firstName} ${player.lastName} za cenę wywoławczą ${listing.askingAmount.toLocaleString('pl-PL')} zł.`,
        'rejected',
        'transfer',
      )
      message.relatedOutgoingListingId = listingId
      continue
    }

    const fairOffer = Math.min(
      maximumOffer,
      Math.round(player.value * (player.transferRequest ? 1.02 : 0.9) / 1000) * 1000,
    )
    const offeredAmount = Math.min(
      maximumOffer,
      Math.max(50_000, Math.min(listing.askingAmount, fairOffer)),
    )
    const strengthDifference = buyer.strength - (next.teams.find((team) => team.id === next.teamId)?.strength ?? buyer.strength)
    const wageMultiplier = Math.max(0.95, Math.min(
      1.6,
      1.1 + (70 - player.morale) * 0.004 + strengthDifference * 0.002
        + (player.personality === 'ambitious' ? 0.08 : 0)
        + (player.transferRequest ? -0.05 : 0),
    ))
    const incomingOffer: IncomingTransferOffer = {
      id: createId(),
      outgoingListingId: listingId,
      clubId: buyer.id,
      playerId,
      offeredAmount,
      estimatedPlayerWage: Math.ceil(player.wage * wageMultiplier / 100) * 100,
      estimatedPlayerContractSeasons: player.age <= 22 && player.personality === 'ambitious'
        ? 4
        : player.age >= 30 ? 2 : 3,
      status: 'pending',
      windowId,
      createdRound: next.round,
      expiresAfterRound: Math.min(next.round + 2, window.closeRound),
    }
    next.incomingTransferOffers.push(incomingOffer)
    listing.offerIds.push(incomingOffer.id)
    offerCount += 1
    const message = addInboxMessage(
      next,
      buyer.name,
      `Oferta za ${player.firstName} ${player.lastName}`,
      `${buyer.name} odpowiada na ofertę transferową za ${player.firstName} ${player.lastName}. Proponowana kwota to ${offeredAmount.toLocaleString('pl-PL')} zł (cena wywoławcza: ${listing.askingAmount.toLocaleString('pl-PL')} zł). Możesz przyjąć ofertę, negocjować cenę lub ją odrzucić.`,
      'offered',
      'transfer',
    )
    message.relatedTransferOfferId = incomingOffer.id
    message.relatedOutgoingListingId = listingId
  }
  const rejectionCount = uniqueClubIds.length - offerCount
  if (!activeListing && offerCount === 0) listing.status = 'cancelled'
  if (uniqueClubIds.length > 0) {
    addMediaPost(
      next,
      'TRANSFER',
      `${player.firstName} ${player.lastName} zaoferowany klubom`,
      `${next.clubName} zaoferował zawodnika ${uniqueClubIds.length} klubom za ${listing.askingAmount.toLocaleString('pl-PL')} zł. ${offerCount} ${offerCount === 1 ? 'klub przedstawił ofertę' : 'kluby przedstawiły oferty'}, ${rejectionCount} ${rejectionCount === 1 ? 'odmówił' : 'odmówiły'}.`,
    )
  }
  return {
    game: next,
    error: '',
    message: uniqueClubIds.length === 0
      ? `Zaktualizowano cenę wywoławczą na ${listing.askingAmount.toLocaleString('pl-PL')} zł.`
      : offerCount
      ? `${player.firstName} ${player.lastName} otrzymał ${offerCount} ${offerCount === 1 ? 'ofertę' : 'oferty'}. Odpowiedzi klubów są w skrzynce e-mail.`
      : `Wybrane kluby nie złożyły oferty za ${player.firstName} ${player.lastName}. Odpowiedzi znajdziesz w skrzynce e-mail.`,
  }
}

export type IncomingTransferOfferResponse =
  | 'accept'
  | 'reject'
  | 'promise-stay'
  | 'counter'
  | 'accept-player-terms'
  | 'counter-player-terms'
  | 'reject-player-terms'

export function withdrawOutgoingPlayerTransferListing(game: GameState, listingId: string) {
  const next = structuredClone(game)
  const listing = next.outgoingPlayerTransferListings?.find((item) => item.id === listingId && item.status === 'active')
  if (!listing) return { game, error: 'Ta oferta sprzedaży nie jest już aktywna.' }
  const player = next.squad.find((item) => item.id === listing.playerId)
  if (!player) return { game, error: 'Nie można wycofać oferty: zawodnik nie znajduje się już w Twojej kadrze.' }

  const activeStatuses = ['pending', 'countered', 'player-negotiation']
  for (const offer of next.incomingTransferOffers ?? []) {
    if (offer.outgoingListingId !== listing.id || !activeStatuses.includes(offer.status)) continue
    offer.status = 'rejected'
    updateIncomingTransferMessage(
      next,
      offer,
      'rejected',
      `${next.clubName} wycofał zawodnika z listy transferowej. Oferta ${getTeamName(next, offer.clubId)} została zamknięta.`,
    )
  }
  for (const message of next.inboxMessages ?? []) {
    if (message.relatedOutgoingListingId === listing.id && message.status === 'info') {
      message.body = `${player.firstName} ${player.lastName} został wycofany z listy transferowej, zanim zakończyły się rozmowy z tym klubem.`
    }
  }

  listing.status = 'cancelled'
  player.morale = Math.min(100, player.morale + 5)
  player.transferRequest = false
  addPlayerHistory(player, {
    season: next.season,
    type: 'club',
    title: 'Pozostaje w klubie',
    details: `Klub wycofał go z listy transferowej i zadeklarował chęć dalszej współpracy. Morale wzrosło do ${player.morale}.`,
  })
  addMediaPost(
    next,
    'KLUB',
    `${player.firstName} ${player.lastName} zostaje w klubie`,
    `${next.clubName} wycofał zawodnika z listy transferowej. Piłkarz docenił decyzję i jego morale wzrosło do ${player.morale}.`,
  )
  return { game: next, error: '' }
}

export function respondToIncomingTransferOffer(
  game: GameState,
  offerId: string,
  response: IncomingTransferOfferResponse,
  counterAmount?: number,
  contractWage?: number,
  contractSeasons?: number,
) {
  const next = structuredClone(game)
  next.incomingTransferOffers ??= []
  const offer = next.incomingTransferOffers.find((item) => item.id === offerId)
  if (!offer || !['pending', 'countered', 'player-negotiation'].includes(offer.status)) {
    return { game, error: 'Ta oferta transferowa nie jest już aktywna.' }
  }
  if (!getTransferWindowInfo(next).isOpen) return { game, error: 'Okno transferowe jest zamknięte. Oferta wygasła.' }

  const player = next.squad.find((item) => item.id === offer.playerId)
  const buyer = next.teams.find((team) => team.id === offer.clubId)
  if (!player || !buyer) return { game, error: 'Nie można rozstrzygnąć oferty: zawodnik lub klub składający ofertę już nie istnieje.' }
  if (next.squad.length <= 11) return { game, error: 'Nie możesz sprzedać zawodnika, jeśli kadra liczy tylko 11 osób.' }
  if (player.moralePromise) return { game, error: 'Nie możesz sprzedać zawodnika, dopóki nie rozliczycie złożonej mu obietnicy.' }
  if (next.loanDeals?.some((deal) => deal.player.id === player.id)) return { game, error: 'Zawodnik jest związany aktywną umową wypożyczenia.' }
  if (next.inboxMessages?.some((message) =>
    message.playerStory?.playerId === player.id && !message.playerStory.selectedChoiceId,
  )) return { game, error: 'Najpierw odpowiedz na nierozstrzygniętą prośbę tego zawodnika.' }

  const finishOffer = (status: IncomingTransferOffer['status'], body: string, messageStatus: InboxMessage['status']) => {
    offer.status = status
    updateIncomingTransferMessage(next, offer, messageStatus, body)
    if (offer.outgoingListingId) {
      const listing = next.outgoingPlayerTransferListings?.find((item) => item.id === offer.outgoingListingId)
      if (listing) {
        if (status === 'accepted') listing.status = 'completed'
        else {
          const activeStatuses = ['pending', 'countered', 'player-negotiation']
          const remainingOffers = next.incomingTransferOffers?.filter((item) =>
            item.outgoingListingId === listing.id && item.id !== offer.id,
          ) ?? []
          if (remainingOffers.every((item) => !activeStatuses.includes(item.status))) listing.status = 'cancelled'
        }
      }
    }
  }
  const closeOtherOffers = () => {
    for (const other of next.incomingTransferOffers ?? []) {
      if (other.id === offer.id || other.playerId !== player.id || !['pending', 'countered', 'player-negotiation'].includes(other.status)) continue
      other.status = 'rejected'
      updateIncomingTransferMessage(next, other, 'rejected', 'Oferta wygasła, ponieważ zawodnik opuścił klub.')
    }
  }
  const completeTransfer = (amount: number, wage?: number, contractSeasons?: number) => {
    const buyerSquad = next.clubSquads[buyer.id] ?? []
    if (buyerSquad.length >= 30) return { game, error: `${buyer.name} nie może sfinalizować transferu, ponieważ ma pełną kadrę.` }
    if (amount > getTransferBudget(buyer)) return { game, error: `${buyer.name} nie dysponuje budżetem wystarczającym na tę kwotę.` }
    next.squad = next.squad.filter((item) => item.id !== player.id)
    next.lineupIds = next.lineupIds.filter((id) => id !== player.id)
    next.matchLineupIds = next.matchLineupIds.filter((id) => id !== player.id)
    next.matchBenchIds = next.matchBenchIds.filter((id) => id !== player.id)
    next.previousMatchLineupIds = next.previousMatchLineupIds.filter((id) => id !== player.id)
    next.previousMatchBenchIds = next.previousMatchBenchIds.filter((id) => id !== player.id)
    if (next.matchLineupPositions) {
      next.matchLineupPositions.slots = Object.fromEntries(
        Object.entries(next.matchLineupPositions.slots).filter(([, playerId]) => playerId !== player.id),
      )
    }
    if (next.playerSpecialRoles) {
      for (const role of Object.keys(next.playerSpecialRoles) as PlayerSpecialRole[]) {
        if (next.playerSpecialRoles[role] === player.id) next.playerSpecialRoles[role] = null
      }
    }
    if (next.teamChemistry) {
      for (const key of Object.keys(next.teamChemistry)) {
        if (key.split('::').includes(player.id)) delete next.teamChemistry[key]
      }
    }
    const transferPlayer = structuredClone(player)
    if (wage !== undefined) transferPlayer.wage = wage
    if (contractSeasons !== undefined) transferPlayer.contractSeasonsRemaining = contractSeasons
    assignNextSquadNumber(transferPlayer, buyerSquad.map(({ player: item }) => item))
    buyerSquad.push({ player: transferPlayer, askingPrice: Math.round(transferPlayer.value * 1.15) })
    next.clubSquads[buyer.id] = buyerSquad
    syncTeamStrength(next, next.teamId, next.squad)
    syncTeamStrength(next, buyer.id, buyerSquad.map(({ player: item }) => item))
    addFinance(next, `Transfer wychodzący: ${player.firstName} ${player.lastName}`, amount)
    addPlayerHistory(transferPlayer, {
      season: next.season,
      type: 'club',
      title: `Transfer do ${buyer.name}`,
      details: `Odszedł z ${next.clubName} za ${amount.toLocaleString('pl-PL')} zł.`,
    })
    if (offer.outgoingListingId) {
      const listing = next.outgoingPlayerTransferListings?.find((item) => item.id === offer.outgoingListingId)
      if (listing) listing.status = 'completed'
    }
    if (wage !== undefined && contractSeasons !== undefined) {
      addPlayerHistory(transferPlayer, {
        season: next.season,
        type: 'club',
        title: 'Nowy kontrakt',
        details: `Podpisał ${contractSeasons}-letnią umowę z pensją ${wage.toLocaleString('pl-PL')} zł za kolejkę.`,
      })
    }
    offer.agreedAmount = amount
    finishOffer(
      'accepted',
      `Transfer zawodnika ${player.firstName} ${player.lastName} został sfinalizowany za ${amount.toLocaleString('pl-PL')} zł.`,
      'accepted',
    )
    closeOtherOffers()
    addMediaPost(next, 'TRANSFER', `${player.firstName} ${player.lastName} odchodzi z ${next.clubName}`, `${buyer.name} zapłacił ${amount.toLocaleString('pl-PL')} zł za zawodnika.`)
    return { game: next, error: '' }
  }

  const startPlayerNegotiation = (amount: number) => {
    const userTeam = next.teams.find((team) => team.id === next.teamId)
    if (!userTeam) return { game, error: 'Nie można ustalić siły Twojego klubu.' }
    const strengthDifference = buyer.strength - userTeam.strength
    const personalityInterest = player.personality === 'ambitious' && strengthDifference > 0
      ? 8
      : player.personality === 'loyal'
        ? -8
        : player.personality === 'temperamental' && player.morale < 45
          ? 6
          : 0
    const interest = 50
      + (70 - player.morale) * 0.3
      + (player.transferRequest ? 25 : 0)
      + strengthDifference * 0.75
      + personalityInterest
    if (interest < 24) {
      player.morale = Math.max(20, player.morale - 4)
      finishOffer(
        'rejected',
        `${buyer.name} i Twój klub uzgodnili kwotę ${amount.toLocaleString('pl-PL')} zł, ale ${player.firstName} ${player.lastName} nie chce odejść. Zawodnik odrzucił warunki transferu.`,
        'rejected',
      )
      addMediaPost(next, 'TRANSFER', `${player.firstName} ${player.lastName} odrzuca transfer`, `Mimo porozumienia klubów zawodnik nie zgodził się na przeprowadzkę do ${buyer.name}.`)
      return { game: next, error: '' }
    }

    const wageMultiplier = Math.max(0.95, Math.min(
      1.6,
      1.1
        + (70 - player.morale) * 0.004
        + strengthDifference * 0.002
        + (player.personality === 'ambitious' ? 0.08 : 0)
        + (player.transferRequest ? -0.05 : 0),
    ))
    offer.agreedAmount = amount
    offer.playerInterest = interest
    offer.playerNegotiationRounds = 0
    offer.playerWageDemand = Math.ceil(player.wage * wageMultiplier / 100) * 100
    offer.playerContractSeasons = player.age <= 22 && player.personality === 'ambitious'
      ? 4
      : player.age >= 30 ? 2 : 3
    offer.estimatedPlayerWage = offer.playerWageDemand
    offer.estimatedPlayerContractSeasons = offer.playerContractSeasons
    offer.status = 'player-negotiation'
    updateIncomingTransferMessage(
      next,
      offer,
      'player-negotiation',
      `${buyer.name} zaakceptował kwotę ${amount.toLocaleString('pl-PL')} zł. ${player.firstName} ${player.lastName} jest zainteresowany transferem i oczekuje pensji ${offer.playerWageDemand.toLocaleString('pl-PL')} zł za kolejkę oraz ${offer.playerContractSeasons}-letniego kontraktu. Zaakceptuj warunki zawodnika, aby sfinalizować transfer, albo wycofaj zgodę.`,
    )
    return { game: next, error: '' }
  }

  if (response === 'accept-player-terms') {
    if (
      offer.status !== 'player-negotiation'
      || offer.playerWageDemand === undefined
      || offer.playerContractSeasons === undefined
      || offer.agreedAmount === undefined
    ) return { game, error: 'Negocjacje kontraktu zawodnika nie są już aktywne.' }
    return completeTransfer(offer.agreedAmount, offer.playerWageDemand, offer.playerContractSeasons)
  }

  if (response === 'counter-player-terms') {
    if (
      offer.status !== 'player-negotiation'
      || offer.playerWageDemand === undefined
      || offer.playerContractSeasons === undefined
      || offer.agreedAmount === undefined
    ) return { game, error: 'Negocjacje kontraktu zawodnika nie są już aktywne.' }
    if (!Number.isFinite(contractWage) || !contractWage || contractWage < player.wage) {
      return { game, error: `Pensja w kontrofertcie musi wynosić co najmniej ${player.wage.toLocaleString('pl-PL')} zł za kolejkę.` }
    }
    if (!Number.isInteger(contractSeasons) || !contractSeasons || contractSeasons < 1 || contractSeasons > 4) {
      return { game, error: 'Długość kontraktu musi wynosić od 1 do 4 sezonów.' }
    }

    const offeredWage = Math.ceil(contractWage / 100) * 100
    const offeredSeasons = contractSeasons
    const wageRatio = offeredWage / offer.playerWageDemand
    const interest = offer.playerInterest ?? 50
    const wageTolerance = Math.max(0.9, Math.min(
      1.02,
      0.94 + (interest - 50) * 0.001 + (player.personality === 'loyal' ? -0.035 : 0),
    ))
    const acceptableContract = offeredSeasons >= offer.playerContractSeasons
      || offeredSeasons === offer.playerContractSeasons - 1 && player.personality !== 'ambitious'
    if (wageRatio >= wageTolerance && acceptableContract) {
      return completeTransfer(offer.agreedAmount, offeredWage, offeredSeasons)
    }

    const negotiationRounds = (offer.playerNegotiationRounds ?? 0) + 1
    offer.playerNegotiationRounds = negotiationRounds
    player.morale = Math.max(20, player.morale - (negotiationRounds >= 2 ? 5 : 2))
    if (negotiationRounds >= 2) {
      finishOffer(
        'rejected',
        `${player.firstName} ${player.lastName} odrzucił kontrofertę (${offeredWage.toLocaleString('pl-PL')} zł, ${offeredSeasons} sez.) i zakończył negocjacje. Zawodnik pozostaje w klubie, ale jego morale spadło.`,
        'rejected',
      )
      addMediaPost(next, 'TRANSFER', `Negocjacje kontraktu ${player.firstName} ${player.lastName} zakończone`, `Zawodnik odrzucił ostatnią propozycję ${next.clubName} i transfer do ${buyer.name} nie dojdzie do skutku.`)
      return { game: next, error: '' }
    }

    const wageReduction = Math.max(100, Math.round(offer.playerWageDemand * (wageRatio >= wageTolerance - 0.08 ? 0.025 : 0.01) / 100) * 100)
    offer.playerWageDemand = Math.max(offeredWage, offer.playerWageDemand - wageReduction)
    if (offeredSeasons < offer.playerContractSeasons && player.personality !== 'ambitious') {
      offer.playerContractSeasons = Math.max(offeredSeasons, offer.playerContractSeasons - 1)
    }
    updateIncomingTransferMessage(
      next,
      offer,
      'player-negotiation',
      `${player.firstName} ${player.lastName} odrzucił kontrofertę (${offeredWage.toLocaleString('pl-PL')} zł, ${offeredSeasons} sez.). W odpowiedzi obniża swoje oczekiwania do ${offer.playerWageDemand.toLocaleString('pl-PL')} zł za kolejkę i ${offer.playerContractSeasons}-letniej umowy. Możesz zaakceptować warunki albo złożyć ostatnią kontrofertę.`,
    )
    return { game: next, error: '' }
  }

  if (response === 'reject-player-terms') {
    if (offer.status !== 'player-negotiation') return { game, error: 'Negocjacje kontraktu zawodnika nie są już aktywne.' }
    player.morale = Math.max(20, player.morale - 5)
    finishOffer(
      'rejected',
      `Wycofano zgodę na transfer do ${buyer.name}. ${player.firstName} ${player.lastName} pozostaje w klubie; zawodnik jest rozczarowany przerwanymi rozmowami.`,
      'rejected',
    )
    addMediaPost(next, 'KLUB', `Przerwane negocjacje z ${player.firstName} ${player.lastName}`, `Klub wycofał zgodę na transfer do ${buyer.name}. Morale zawodnika spadło.`)
    return { game: next, error: '' }
  }

  if (response === 'accept') {
    return startPlayerNegotiation(offer.counterAmount ?? offer.offeredAmount)
  }
  if (response === 'reject') {
    player.morale = Math.min(100, player.morale + 3)
    finishOffer('rejected', `Oferta ${buyer.name} została odrzucona.`, 'rejected')
    return { game: next, error: '' }
  }
  if (response === 'promise-stay') {
    player.moralePromise = { kind: 'stay', matchesRemaining: 6, startsRequired: 0, startsCompleted: 0 }
    player.morale = Math.min(100, player.morale + 8)
    player.transferRequest = false
    finishOffer('rejected', `Odrzucono ofertę ${buyer.name}. Obiecano zawodnikowi pozostanie w klubie przez najbliższe 6 meczów ligowych.`, 'rejected')
    addMediaPost(next, 'KLUB', `Obietnica pozostania dla ${player.firstName} ${player.lastName}`, `Menedżer obiecał zawodnikowi pozostanie w klubie przez najbliższe 6 meczów ligowych.`)
    return { game: next, error: '' }
  }

  if (offer.status === 'countered' || offer.counterRounds) {
    return { game, error: 'Klub otrzymał już kontrofertę. Możesz ją przyjąć albo odrzucić.' }
  }
  if (!Number.isFinite(counterAmount) || !counterAmount || counterAmount <= offer.offeredAmount) {
    return { game, error: 'Kontroferta musi być wyższa od otrzymanej oferty.' }
  }
  const requestedAmount = Math.round(counterAmount)
  const aiMaximum = Math.min(
    getTransferBudget(buyer),
    Math.max(Math.round(player.value * 1.25), Math.round(offer.offeredAmount * 1.1)),
  )
  if (requestedAmount <= aiMaximum) {
    return startPlayerNegotiation(requestedAmount)
  }
  const aiCounterAmount = Math.min(
    requestedAmount - 1_000,
    Math.max(offer.offeredAmount + 1_000, Math.floor(aiMaximum / 1_000) * 1_000),
  )
  if (aiCounterAmount <= offer.offeredAmount) {
    finishOffer('rejected', `${buyer.name} odrzucił kontrofertę w wysokości ${requestedAmount.toLocaleString('pl-PL')} zł.`, 'rejected')
    return { game: next, error: '' }
  }
  offer.counterAmount = aiCounterAmount
  offer.counterRounds = 1
  finishOffer(
    'countered',
    `${buyer.name} nie przyjął kontroferty ${requestedAmount.toLocaleString('pl-PL')} zł i proponuje ${aiCounterAmount.toLocaleString('pl-PL')} zł. Możesz zaakceptować tę kwotę albo odrzucić ofertę.`,
    'countered',
  )
  return { game: next, error: '' }
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

function getTeamFormModifier(team: Pick<Team, 'played' | 'wins' | 'draws' | 'losses' | 'goalsFor' | 'goalsAgainst' | 'points'>) {
  if (!team.played) return 0
  const pointsPerMatch = team.points / team.played
  const winRatio = (team.wins + team.draws * 0.5) / team.played
  const goalDiff = (team.goalsFor - team.goalsAgainst) / team.played
  return (pointsPerMatch - 1.2) * 5 + (winRatio - 0.4) * 18 + goalDiff * 1.5
}

function buildMatchContext(
  lineup: Player[],
  teamStrength: number,
  isHome: boolean,
  tactics: Tactics,
  team?: Pick<Team, 'played' | 'wins' | 'draws' | 'losses' | 'goalsFor' | 'goalsAgainst' | 'points'>,
) {
  const impact = getTacticalImpact(tactics)
  const morale = average(lineup.map((player) => player.morale))
  const stamina = average(lineup.map((player) => player.stamina))
  const quality = average(lineup.map((player) => player.skill))
  const formBoost = team ? getTeamFormModifier(team) : 0
  return {
    attack: teamStrength
      + formBoost * 0.8
      + (morale - 70) * 0.22
      + (stamina - 70) * 0.18
      + (quality - 65) * 0.12
      + impact.attack
      + (isHome ? 4 : -1),
    defense: teamStrength
      + formBoost * 0.4
      + (morale - 70) * 0.16
      + (stamina - 70) * 0.12
      + (quality - 65) * 0.08
      + impact.defense
      + (isHome ? 2 : 0),
    staminaDrain: Math.max(8, impact.stamina + (stamina < 55 ? 4 : 0) + (morale < 55 ? 2 : 0)),
  }
}

function rollGoals(attacking: number, defending: number) {
  const differential = (attacking - defending) / 17
  const pressure = (Math.random() - 0.5) * 2.4
  const variance = Math.random() * 1.8
  const expectedGoals = 0.7 + differential + pressure * 0.28 + variance * 0.35
  return Math.max(0, Math.min(5, Math.floor(expectedGoals + (Math.random() * 1.7))))
}

function getTacticalImpact(tactics: Tactics) {
  const formationImpact: Record<Formation, { attack: number; defense: number }> = {
    '4-3-3': { attack: 3, defense: -1 },
    '4-4-2': { attack: 1, defense: 1 },
    '4-2-3-1': { attack: 2, defense: 2 },
    '3-5-2': { attack: 2, defense: 1 },
    '3-4-3': { attack: 4, defense: -2 },
    '5-3-2': { attack: 0, defense: 4 },
    '4-1-4-1': { attack: 0, defense: 3 },
    '4-3-2-1': { attack: 2, defense: 2 },
  }
  const styleImpact: Record<TacticalStyle, { attack: number; defense: number }> = {
    balanced: { attack: 1, defense: 1 },
    attacking: { attack: 5, defense: -4 },
    counter: { attack: 3, defense: 3 },
  }
  const pressingImpact: Record<PressingIntensity, { attack: number; defense: number; stamina: number }> = {
    low: { attack: -1, defense: 1, stamina: 14 },
    normal: { attack: 1, defense: 2, stamina: 18 },
    high: { attack: 3, defense: 3, stamina: 24 },
  }
  const formation = formationImpact[tactics.formation]
  const style = styleImpact[tactics.style]
  const pressing = pressingImpact[tactics.pressing]
  return {
    attack: formation.attack + style.attack + pressing.attack,
    defense: formation.defense + style.defense + pressing.defense,
    stamina: pressing.stamina + (tactics.style === 'attacking' ? 2 : tactics.style === 'counter' ? 1 : 0),
  }
}

type PlannedMatchTimelineEvent = {
  minute: number
  addedTime?: number
  period: MatchTimelinePeriod
  type: MatchTimelineEvent['type']
  teamId: string
}

function createMatchTimelinePlan(homeId: string, awayId: string, homeGoals: number, awayGoals: number) {
  const events: PlannedMatchTimelineEvent[] = []
  const occupiedMinutes = new Set<string>()
  const ownGoalChance = 0.025
  const scoredPenaltyChance = 0.115
  const missedPenaltyChance = 0.08
  const nextMinute = (period: MatchTimelinePeriod) => {
    const stoppageMinute = period === 'first-half' ? 45 : period === 'second-half' ? 90 : period === 'extra-time-first-half' ? 105 : 120
    const regularStart = period === 'first-half' ? 1 : period === 'second-half' ? 46 : period === 'extra-time-first-half' ? 91 : 106
    const regularEnd = stoppageMinute - 1
    const inStoppageTime = Math.random() < 0.14
    const minute = inStoppageTime
      ? stoppageMinute
      : regularStart + Math.floor(Math.random() * (regularEnd - regularStart + 1))
    const addedTime = inStoppageTime ? 1 + Math.floor(Math.random() * (period.startsWith('extra-time') ? 2 : 4)) : undefined
    const key = `${minute}+${addedTime ?? 0}`
    if (occupiedMinutes.has(key)) return nextMinute(period)
    occupiedMinutes.add(key)
    return { minute, addedTime }
  }
  const addGoals = (teamId: string, goals: number) => {
    for (let index = 0; index < goals; index += 1) {
      const period: MatchTimelinePeriod = Math.random() < 0.48 ? 'first-half' : 'second-half'
      const roll = Math.random()
      const type = roll < ownGoalChance
        ? 'own-goal'
        : roll < ownGoalChance + scoredPenaltyChance
          ? 'penalty-goal'
          : 'goal'
      const time = nextMinute(period)
      events.push({
        ...time,
        period,
        type,
        teamId,
      })
    }
  }
  addGoals(homeId, homeGoals)
  addGoals(awayId, awayGoals)
  if (Math.random() < missedPenaltyChance) {
    const period: MatchTimelinePeriod = Math.random() < 0.5 ? 'first-half' : 'second-half'
    events.push({
      ...nextMinute(period),
      period,
      type: 'penalty-missed',
      teamId: Math.random() < 0.5 ? homeId : awayId,
    })
  }
  return events.sort((first, second) => first.minute - second.minute || (first.addedTime ?? 0) - (second.addedTime ?? 0))
}

function createExtraTimeTimelinePlan(homeId: string, awayId: string, homeStrength: number, awayStrength: number) {
  const events: PlannedMatchTimelineEvent[] = []
  const createHalf = (period: MatchTimelinePeriod, baseMinute: number, startMinute: number) => {
    for (const [teamId, strength, opponentStrength] of [
      [homeId, homeStrength, awayStrength],
      [awayId, awayStrength, homeStrength],
    ] as const) {
      const chance = Math.max(0.06, Math.min(0.24, 0.13 + (strength - opponentStrength) / 220))
      if (Math.random() >= chance) continue
      const stoppage = Math.random() < 0.12
      const minute = stoppage ? baseMinute : startMinute + Math.floor(Math.random() * 14)
      const addedTime = stoppage ? 1 + Math.floor(Math.random() * 2) : undefined
      const roll = Math.random()
      const type = roll < 0.025 ? 'own-goal' : roll < 0.12 ? 'penalty-goal' : 'goal'
      events.push({
        minute,
        addedTime,
        period,
        type,
        teamId,
      })
    }
  }
  createHalf('extra-time-first-half', 105, 91)
  createHalf('extra-time-second-half', 120, 106)
  return events
}

function countOwnGoalsForTeam(events: PlannedMatchTimelineEvent[], teamId: string) {
  return events.filter((event) => event.type === 'own-goal' && event.teamId === teamId).length
}

function getMatchEventLineup(game: GameState, teamId: string, userLineup?: Player[]) {
  if (teamId === game.teamId && userLineup) return userLineup
  const players = teamId === game.teamId
    ? game.squad
    : (game.clubSquads[teamId] ?? []).map(({ player }) => player)
  return [...players].sort((first, second) => second.skill - first.skill).slice(0, 11)
}

function createMatchTimeline(
  plan: PlannedMatchTimelineEvent[],
  homeId: string,
  awayId: string,
  homeLineup: Player[],
  awayLineup: Player[],
  homePlayerGoals: Map<string, number>,
  awayPlayerGoals: Map<string, number>,
): MatchTimelineEvent[] {
  const creditedScorers = new Map<string, string[]>()
  for (const [teamId, playerGoals] of [[homeId, homePlayerGoals], [awayId, awayPlayerGoals]] as const) {
    creditedScorers.set(
      teamId,
      [...playerGoals.entries()].flatMap(([playerId, goals]) => Array.from({ length: goals }, () => playerId)),
    )
  }
  const scorerIndexes = new Map<string, number>()
  const getPlayer = (players: Player[], index: number, preference: 'attack' | 'defense') => {
    const preferred = preference === 'defense'
      ? players.filter((player) => ['PO', 'ŚO', 'LO'].includes(player.position))
      : players.filter((player) => ['OP', 'PP', 'LP', 'PN', 'LN', 'ŚN'].includes(player.position))
    const candidates = preferred.length ? preferred : players
    return candidates.length ? candidates[index % candidates.length] : undefined
  }
  const homeGoalkeepers = homeLineup.filter((player) => player.position === 'BR')
  const awayGoalkeepers = awayLineup.filter((player) => player.position === 'BR')
  const fallbackLineupFor = (teamId: string) => teamId === homeId ? homeLineup : awayLineup

  return plan.flatMap((event, index) => {
    const isHomeSide = event.teamId === homeId
    const teamLineup = fallbackLineupFor(event.teamId)
    let player: Player | undefined
    if (event.type === 'own-goal') {
      const defendingLineup = isHomeSide ? awayLineup : homeLineup
      player = getPlayer(defendingLineup, index, 'defense')
    } else if (event.type === 'penalty-missed') {
      player = getPlayer(teamLineup, index, 'attack')
      if (!player) player = (isHomeSide ? homeGoalkeepers : awayGoalkeepers)[0]
    } else {
      const scorers = creditedScorers.get(event.teamId) ?? []
      const scorerIndex = scorerIndexes.get(event.teamId) ?? 0
      const scorerId = scorers[scorerIndex]
      if (scorerId) {
        player = teamLineup.find((candidate) => candidate.id === scorerId)
        scorerIndexes.set(event.teamId, scorerIndex + 1)
      }
      player ??= getPlayer(teamLineup, index, 'attack')
    }
    if (!player) return []
    return [{
      minute: event.minute,
      addedTime: event.addedTime,
      period: event.period,
      type: event.type,
      teamId: event.teamId,
      playerId: player.id,
      playerName: `${player.firstName} ${player.lastName}`,
    }]
  })
}

function recordPlayerMatchStats(
  players: Player[],
  lineup: Player[],
  goals: number,
  competition: CompetitionId = 'league',
  scorerIds?: string[],
) {
  const playerGoals = new Map<string, number>()
  const playerAssists = new Map<string, number>()
  for (const player of lineup) {
    if (competition === 'league') player.seasonAppearances = (player.seasonAppearances ?? 0) + 1
    if (competition === 'polish-cup') player.cupAppearances = (player.cupAppearances ?? 0) + 1
    player.careerAppearances = (player.careerAppearances ?? 0) + 1
  }
  for (let goal = 0; goal < goals; goal += 1) {
    const assignedScorer = scorerIds?.[goal]
    let scorer: Player | undefined
    if (assignedScorer) {
      scorer = players.find((player) => player.id === assignedScorer)
      if (!scorer) throw new Error(`Nie znaleziono zapisanego strzelca bramki: ${assignedScorer}.`)
    } else {
      const weights = lineup.map((player) => {
        const positionWeight = player.position === 'ŚN' || player.position === 'PN' || player.position === 'LN'
          ? 4
          : ['OP', 'PP', 'LP'].includes(player.position)
            ? 2
            : ['DP', 'ŚP'].includes(player.position)
              ? 1.2
              : 0.25
        return positionWeight * Math.max(0.5, player.skill / 60)
      })
      const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
      let roll = Math.random() * totalWeight
      const scorerIndex = weights.findIndex((weight) => {
        roll -= weight
        return roll < 0
      })
      scorer = players.find((player) => player.id === lineup[Math.max(0, scorerIndex)]?.id)
    }
    if (!scorer) throw new Error('Nie udało się przypisać strzelca do bramki.')
    playerGoals.set(scorer.id, (playerGoals.get(scorer.id) ?? 0) + 1)
    if (competition === 'league') scorer.seasonGoals = (scorer.seasonGoals ?? 0) + 1
    if (competition === 'polish-cup') scorer.cupGoals = (scorer.cupGoals ?? 0) + 1
    scorer.careerGoals = (scorer.careerGoals ?? 0) + 1
    if (competition === 'league' || competition === 'polish-cup') {
      scorer.careerLeagueAndCupGoals = (scorer.careerLeagueAndCupGoals ?? 0) + 1
    }
    const assistCandidates = lineup.filter((player) => player.id !== scorer.id)
    const assister = assistCandidates.length
      ? assistCandidates[Math.floor(Math.random() * assistCandidates.length)]
      : undefined
    if (assister) {
      playerAssists.set(assister.id, (playerAssists.get(assister.id) ?? 0) + 1)
      if (competition === 'league') assister.seasonAssists = (assister.seasonAssists ?? 0) + 1
    }
  }
  return { playerGoals, playerAssists }
}

function recordLeaguePlayerRatings(players: Player[], ratings: MatchPlayerPerformance[]) {
  for (const rating of ratings) {
    const player = players.find((item) => item.id === rating.playerId)
    if (!player) continue
    player.seasonRatingTotal = (player.seasonRatingTotal ?? 0) + rating.rating
    player.seasonRatedAppearances = (player.seasonRatedAppearances ?? 0) + 1
  }
}

function simulateLeaguePlayerStats(
  game: GameState,
  teamId: string,
  goalsFor: number,
  goalsAgainst: number,
  scorerIds?: string[],
  preservedDisciplinaryEvents?: MatchCardEvent[],
) {
  const players = teamId === game.teamId
    ? game.squad
    : (game.clubSquads[teamId] ?? []).map(({ player }) => player)
  const sortedPlayers = [...players].sort((first, second) => second.skill - first.skill)
  const goalkeeper = sortedPlayers.find((player) => player.position === 'BR')
  const lineup = [
    ...(goalkeeper ? [goalkeeper] : []),
    ...sortedPlayers.filter((player) => player.id !== goalkeeper?.id).slice(0, goalkeeper ? 10 : 11),
  ]
  if (!lineup.length) return { playerGoals: new Map<string, number>(), disciplinaryEvents: [] as MatchCardEvent[] }
  const { playerGoals } = recordPlayerMatchStats(players, lineup, goalsFor, 'league', scorerIds)
  const outcome = goalsFor > goalsAgainst ? 'win' : goalsFor === goalsAgainst ? 'draw' : 'loss'
  const ratings = lineup.map((player) => ({
    playerId: player.id,
    playerName: `${player.firstName} ${player.lastName}`,
    position: player.position,
    rating: Math.round(Math.max(3, Math.min(10, 6 + (outcome === 'win' ? 0.4 : outcome === 'loss' ? -0.4 : 0.1) + (playerGoals.get(player.id) ?? 0) * 0.9)) * 10) / 10,
    goals: playerGoals.get(player.id) ?? 0,
    appearance: 'starting' as const,
  }))
  recordLeaguePlayerRatings(players, ratings)
  if (goalsAgainst === 0) {
    const goalkeeper = lineup.find((player) => player.position === 'BR')
    if (goalkeeper) goalkeeper.seasonCleanSheets = (goalkeeper.seasonCleanSheets ?? 0) + 1
  }
  const disciplinaryEvents = preservedDisciplinaryEvents
    ? structuredClone(preservedDisciplinaryEvents)
    : simulateDisciplinaryEvents(lineup, teamId, 'league')
  if (preservedDisciplinaryEvents) applyDisciplinaryEvents(players, disciplinaryEvents, 'league')
  return { playerGoals, disciplinaryEvents }
}

function rateMatchPlayers(
  players: Player[],
  startingIds: string[],
  substituteIds: string[],
  playerGoals: Map<string, number>,
  disciplinaryEvents: MatchCardEvent[],
  outcome: TacticalMatchReport['outcome'],
) {
  const participatedIds = [...new Set([...startingIds, ...substituteIds])]
  return participatedIds
    .map((playerId): MatchPlayerPerformance | undefined => {
      const player = players.find((item) => item.id === playerId)
      if (!player) return undefined
      const goals = playerGoals.get(playerId) ?? 0
      const cards = disciplinaryEvents.filter((event) => event.playerId === playerId)
      const resultAdjustment = outcome === 'win' ? 0.4 : outcome === 'draw' ? 0.1 : -0.4
      const moraleAdjustment = Math.max(-0.3, Math.min(0.3, (player.morale - 70) / 100))
      const cardPenalty = cards.reduce((penalty, event) => penalty + (event.card === 'red' || event.secondYellow ? 1.5 : 0.5), 0)
      const rating = Math.max(3, Math.min(10, 6 + resultAdjustment + moraleAdjustment + goals * 0.9 + (substituteIds.includes(playerId) ? 0.2 : 0) - cardPenalty))
      const matchRating = Math.round(rating * 10) / 10
      if (matchRating >= 8.5 && player.skill < player.potential) {
        player.skill = Math.min(player.potential, player.skill + 1)
        player.value = playerValue(player.skill, player.potential, player.age)
        player.wage = Math.round(player.skill * player.skill * 0.25 / 100) * 100
      }
      return {
        playerId,
        playerName: `${player.firstName} ${player.lastName}`,
        position: player.position,
        rating: matchRating,
        goals,
        appearance: startingIds.includes(playerId) ? 'starting' : 'substitute',
      }
    })
    .filter((performance): performance is MatchPlayerPerformance => performance !== undefined)
}

export function setTactics(game: GameState, changes: Partial<Tactics>) {
  const next = structuredClone(game)
  next.tactics = { ...next.tactics, ...changes }
  return next
}

function createMatchdayEvent(round: number, matchId: string): MatchdayEvent {
  const events: Array<Omit<MatchdayEvent, 'id' | 'round' | 'matchId'>> = [
    {
      title: 'Rywal podkręca pressing',
      description: 'Przeciwnik rusza wysoko do odbioru. Jak zareaguje drużyna?',
      options: [
        { id: 'quick-passes', label: 'Szybkie podania', description: 'Przyspiesz grę i szukaj luk za linią pressingu.', attackModifier: 4, defenseModifier: -1, staminaModifier: 2 },
        { id: 'long-balls', label: 'Gra na napastnika', description: 'Omiń środek pola, oszczędzając siły pomocników.', attackModifier: 2, defenseModifier: 1, staminaModifier: 0 },
        { id: 'patient-build-up', label: 'Spokojne rozegranie', description: 'Utrzymaj piłkę i nie podejmuj zbędnego ryzyka.', attackModifier: -1, defenseModifier: 3, staminaModifier: -2 },
      ],
    },
    {
      title: 'Mecz utknął w środku pola',
      description: 'Rywal zamyka centralne sektory boiska. Potrzebna jest zmiana planu.',
      options: [
        { id: 'wide-play', label: 'Przenieś grę na skrzydła', description: 'Stwórz więcej sytuacji, ale osłab asekurację.', attackModifier: 4, defenseModifier: -2, staminaModifier: 2 },
        { id: 'midfield-press', label: 'Zwiększ pressing w środku', description: 'Odbieraj piłkę wyżej kosztem dodatkowego wysiłku.', attackModifier: 2, defenseModifier: 2, staminaModifier: 4 },
        { id: 'hold-shape', label: 'Zachowaj ustawienie', description: 'Nie zmieniaj planu i pilnuj organizacji zespołu.', attackModifier: 0, defenseModifier: 2, staminaModifier: 0 },
      ],
    },
    {
      title: 'Rywal groźnie kontratakuje',
      description: 'Przeciwnik szuka szybkich wyjść po odbiorze. Wybierz reakcję.',
      options: [
        { id: 'protect-backline', label: 'Zabezpiecz obronę', description: 'Ogranicz ryzyko, rezygnując z części siły ataku.', attackModifier: -1, defenseModifier: 5, staminaModifier: -1 },
        { id: 'counter-press', label: 'Odbierz piłkę natychmiast', description: 'Możesz przerwać kontry, ale drużyna szybciej się zmęczy.', attackModifier: 3, defenseModifier: 3, staminaModifier: 5 },
        { id: 'trade-attacks', label: 'Odpowiedz atakiem', description: 'Zagraj odważniej i spróbuj przejąć inicjatywę.', attackModifier: 5, defenseModifier: -3, staminaModifier: 3 },
      ],
    },
  ]
  const event = events[Math.floor(Math.random() * events.length)]
  return { ...event, id: createId(), round, matchId, substitutionsUsed: 0, substitutedPlayerIds: [], substitutePlayerIds: [] }
}

export function playMatchday(
  game: GameState,
  decisionId?: string,
  preservedResults?: ReadonlyMap<string, {
    homeGoals?: number
    awayGoals?: number
    timeline?: MatchTimelineEvent[]
    disciplinaryEvents?: MatchCardEvent[]
  }>,
) {
  const next = structuredClone(game)
  if (getNextScheduledCompetition(game) === 'friendly') {
    return { game, error: 'Najpierw rozegraj zaplanowany sparing przedsezonowy.' }
  }
  if (getNextScheduledCompetition(game) === 'polish-cup') {
    return { game, error: 'Najpierw rozegraj zaplanowaną rundę Polskiego Pucharu.' }
  }
  if (next.round > getSeasonRoundCount(next)) return { game, error: 'Sezon został już zakończony.' }
  if (next.sponsorRequired) return { game, error: 'Przed pierwszym meczem nowego sezonu podpisz umowę sponsorską w zakładce Finanse.' }
  const roundMatches = next.matches.filter((match) => match.round === next.round && !match.played)
  if (!roundMatches.length) return { game, error: 'Ta kolejka została już rozegrana.' }
  const clubMatch = roundMatches.find((match) => match.homeId === next.teamId || match.awayId === next.teamId)
  if (!clubMatch) return { game, error: 'Nie udało się odnaleźć meczu Twojego klubu w tej kolejce.' }
  const competition = clubMatch.competitionId ?? 'league'
  if (clubMatch.bye) {
    for (const match of roundMatches) {
      if (!match.bye) continue
      match.played = true
      match.homeGoals = 0
      match.awayGoals = 0
    }
    for (const match of roundMatches) {
      if (match.bye) continue
      const home = next.teams.find((team) => team.id === match.homeId)
      const away = next.teams.find((team) => team.id === match.awayId)
      if (!home || !away) return { game, error: 'Nie udało się odnaleźć drużyny w terminarzu.' }
      const homeGoals = rollGoals(home.strength + 4, away.strength)
      const awayGoals = rollGoals(away.strength + 2, home.strength)
      match.homeGoals = homeGoals
      match.awayGoals = awayGoals
      match.played = true
      home.played += 1
      away.played += 1
      home.goalsFor += homeGoals
      home.goalsAgainst += awayGoals
      away.goalsFor += awayGoals
      away.goalsAgainst += homeGoals
      if (homeGoals > awayGoals) {
        home.wins += 1
        home.points += 3
        away.losses += 1
      } else if (homeGoals < awayGoals) {
        away.wins += 1
        away.points += 3
        home.losses += 1
      } else {
        home.draws += 1
        away.draws += 1
        home.points += 1
        away.points += 1
      }
      recordHeadToHead(home, away, homeGoals, awayGoals)
      const homeStats = simulateLeaguePlayerStats(next, home.id, homeGoals, awayGoals)
      const awayStats = simulateLeaguePlayerStats(next, away.id, awayGoals, homeGoals)
      match.disciplinaryEvents = [...homeStats.disciplinaryEvents, ...awayStats.disciplinaryEvents]
      recordTeamDiscipline(home, homeStats.disciplinaryEvents)
      recordTeamDiscipline(away, awayStats.disciplinaryEvents)
    }
    const wages = next.squad.reduce((sum, player) => sum + player.wage, 0)
    addFinance(next, 'Wynagrodzenia kadry', -wages)
    payStadiumUpkeep(next)
    payStaffWages(next)
    payAcademyUpkeep(next)
    for (const [key, label] of [['sponsorDeal', 'Wpływy od sponsora'], ['tvDeal', 'Prawa telewizyjne']] as const) {
      const deal = next[key]
      if (!deal || deal.roundsRemaining <= 0) continue
      addFinance(next, `${label}: ${deal.company}`, deal.paymentPerMatch)
      deal.roundsRemaining -= 1
      if (key === 'sponsorDeal' && deal.roundsRemaining === 1) {
        addInboxMessage(next, deal.company, 'Umowa sponsorska wkrótce dobiegnie końca', `Umowa z aktualnym sponsorem ${deal.company} zakończy się po najbliższym meczu ligowym. Możesz teraz przedłużyć współpracę z ${deal.company} w zakładce Finanse albo po wygaśnięciu wybrać innego sponsora.`, 'info', 'club')
      }
      if (deal.roundsRemaining === 0) {
        addFinance(next, `Koniec umowy: ${deal.company}`, 0)
        next[key] = null
        if (key === 'sponsorDeal') {
          next.sponsorRequired = true
          addMediaPost(next, 'SPONSOR', `Umowa z ${deal.company} dobiegła końca`, `${next.clubName} musi podpisać nowy kontrakt sponsorski przed kolejnym meczem.`)
          addInboxMessage(next, deal.company, 'Umowa sponsorska dobiegła końca', `Umowa z dotychczasowym sponsorem ${deal.company} wygasła. Klub nie otrzyma dalszych płatności ani premii końcowej z tego kontraktu. Możesz przedłużyć współpracę z ${deal.company} lub wybrać innego sponsora w zakładce Finanse przed kolejnym meczem.`, 'info', 'club')
        }
      }
    }
    next.scouts.forEach((scout) => {
      addFinance(next, `Wynagrodzenie skauta: ${scout.name}`, -scout.wagePerRound)
      if (scout.prospect) return
      scout.roundsUntilReport -= 1
      if (scout.roundsUntilReport > 0) return
      scout.prospect = scoutForProspect(next, scout)
      ensureUniqueGamePlayerNames(next)
      addMediaPost(next, 'TRANSFER', `Skaut ${scout.name} odkrył młody talent`, `${scout.name} poleca ${scout.prospect.firstName} ${scout.prospect.lastName}, ${scout.prospect.age}-letniego zawodnika z potencjałem ${scout.prospect.potential}/100.`)
    })
    next.squad.forEach((player) => {
      player.stamina = Math.min(100, player.stamina + 8)
    })
    advanceInjuries(next)
    if (next.facilities.academy > 0 && next.round % 3 === 0 && !next.academyProspect && (next.academyPlayers?.length ?? 0) < 12) {
      next.academyProspect = createAcademyProspect(next)
      ensureUniqueGamePlayerNames(next)
      addFinance(next, `${academyNames[next.facilities.academy - 1]}: gotowy junior do naboru`, 0)
    }
    addMediaPost(next, 'LIGA', `Pauza ${next.clubName} w kolejce ${next.round}`, 'Klub nie rozgrywa meczu w tej kolejce ze względu na nieparzystą liczbę drużyn w grupie.')
    advanceLeagueWorld(next)
    processDebtSanctions(next)
    resolveAiTransferWindow(next, next.round)
    next.round += 1
    if (next.round > getSeasonRoundCount(next) && !next.promotionPlayoffs) {
      next.promotionPlayoffs = createPromotionPlayoffSchedule(next)
      if (!next.promotionPlayoffs.fixtures.length) next.promotionPlayoffs.round = 'complete'
    }
    return { game: next, error: '' }
  }
  const startingIds = [...new Set(next.matchLineupIds)]
  const startingPlayers = next.squad.filter((player) => startingIds.includes(player.id))
  if (startingIds.length !== 11 || startingPlayers.length !== 11) {
    return { game, error: 'Wybierz dokładnie 11 zawodników do pierwszego składu przed rozegraniem meczu.' }
  }
  if (startingPlayers.some((player) => getSuspensionMatches(player, competition) > 0)) {
    return { game, error: 'W pierwszym składzie znajduje się zawodnik zawieszony w tych rozgrywkach.' }
  }
  if (startingPlayers.some((player) => getInjuryMatches(player) > 0)) {
    return { game, error: 'W pierwszym składzie znajduje się kontuzjowany zawodnik.' }
  }
  if (next.matchBenchIds.length > 7 || next.matchBenchIds.some((id) => startingIds.includes(id))) {
    return { game, error: 'Ławka może liczyć do 7 zawodników i nie może zawierać piłkarzy z pierwszej jedenastki.' }
  }
  const preparation = next.pendingMatchPreparation?.matchId === clubMatch.id ? next.pendingMatchPreparation.choice : undefined
  const conference = getMatchConferenceChoice(next, clubMatch.id)
  const opponentName = getTeamName(next, clubMatch.homeId === next.teamId ? clubMatch.awayId : clubMatch.homeId)
  const localDerby = isLocalDerby(next, opponentName)
  if (!next.pendingMatchEvent) {
    if (decisionId) return { game, error: 'Nie ma aktywnego wydarzenia meczowego do rozstrzygnięcia.' }
    next.pendingMatchEvent = createMatchdayEvent(next.round, clubMatch.id)
    return { game: next, error: '' }
  }
  if (next.pendingMatchEvent.round !== next.round || next.pendingMatchEvent.matchId !== clubMatch.id) {
    return { game, error: 'Wydarzenie meczowe nie pasuje do aktualnego spotkania. Rozpocznij wydarzenie ponownie.' }
  }
  if (!decisionId) return { game, error: 'Wybierz reakcję na wydarzenie meczowe przed rozegraniem spotkania.' }
  const eventChoice = next.pendingMatchEvent.options.find((option) => option.id === decisionId)
  if (!eventChoice) return { game, error: 'Wybrana decyzja meczowa nie jest dostępna.' }
  if (preparation === 'recovery') next.squad.forEach((player) => { player.stamina = Math.min(100, player.stamina + 6) })
  applyConferenceRecovery(next, clubMatch.id, startingIds)
  const preMatchStamina = new Map(next.squad.map((player) => [player.id, player.stamina]))
  if (clubMatch.scheduledAt) next.currentDate = clubMatch.scheduledAt
  const selectedEvent = next.pendingMatchEvent
  next.pendingMatchEvent = undefined
  next.previousMatchLineupIds = [...startingIds]
  next.previousMatchBenchIds = [...new Set(next.matchBenchIds)]

  let clubTimelinePlan: PlannedMatchTimelineEvent[] = []
  const preservedClubTimeline = preservedResults?.get(clubMatch.id)?.timeline
  for (const match of roundMatches) {
    if (match.bye) continue
    const home = next.teams.find((team) => team.id === match.homeId) as Team
    const away = next.teams.find((team) => team.id === match.awayId) as Team
    if (match.homeId === next.teamId) match.attendance = estimateAttendance(next, match)
    const isClubMatch = match.id === clubMatch.id
    const lineup = isClubMatch
      ? startingPlayers
      : next.squad.filter((player) => next.lineupIds.includes(player.id))
    const clubStrength = matchLineupRating(next, lineup.map((player) => player.id), isClubMatch ? match.id : undefined)
    const homeContext = buildMatchContext(
      match.homeId === next.teamId ? startingPlayers : lineup,
      match.homeId === next.teamId ? clubStrength : home.strength,
      match.homeId === next.teamId,
      next.tactics,
      home,
    )
    const awayContext = buildMatchContext(
      match.awayId === next.teamId ? startingPlayers : lineup,
      match.awayId === next.teamId ? clubStrength : away.strength,
      match.awayId === next.teamId,
      next.tactics,
      away,
    )
    let homeAttack = match.homeId === next.teamId ? homeContext.attack : home.strength
    let awayAttack = match.awayId === next.teamId ? awayContext.attack : away.strength
    let homeDefense = match.homeId === next.teamId ? homeContext.defense : home.strength
    let awayDefense = match.awayId === next.teamId ? awayContext.defense : away.strength
    if (isClubMatch) {
      const tacticalMomentum = next.tactics.style === 'attacking' ? 2 : next.tactics.style === 'counter' ? 1 : 0
      const pressingBalance = next.tactics.pressing === 'high' ? -1 : next.tactics.pressing === 'low' ? 1 : 0
      const choiceAttack = eventChoice.attackModifier + tacticalMomentum
      const choiceDefense = eventChoice.defenseModifier + pressingBalance
      if (match.homeId === next.teamId) {
        homeAttack += choiceAttack
        homeDefense += choiceDefense
      } else {
        awayAttack += choiceAttack
        awayDefense += choiceDefense
      }
    }
    if (match.homeId === next.teamId) {
      homeAttack += 2
      homeDefense += 4
    } else {
      homeAttack += 4
      awayDefense += 2
    }
    const preservedResult = preservedResults?.get(match.id)
    const homeDisciplineLineup = match.homeId === next.teamId
      ? startingPlayers
      : getMatchEventLineup(next, match.homeId)
    const awayDisciplineLineup = match.awayId === next.teamId
      ? startingPlayers
      : getMatchEventLineup(next, match.awayId)
    match.disciplinaryEvents = preservedResult?.disciplinaryEvents
      ? structuredClone(preservedResult.disciplinaryEvents)
      : [
        ...simulateDisciplinaryEvents(structuredClone(homeDisciplineLineup), match.homeId, competition),
        ...simulateDisciplinaryEvents(structuredClone(awayDisciplineLineup), match.awayId, competition),
      ]
    const homeDismissalPenalty = getDismissalStrengthPenalty(match.disciplinaryEvents, match.homeId, 90)
    const awayDismissalPenalty = getDismissalStrengthPenalty(match.disciplinaryEvents, match.awayId, 90)
    homeAttack -= homeDismissalPenalty
    homeDefense -= homeDismissalPenalty
    awayAttack -= awayDismissalPenalty
    awayDefense -= awayDismissalPenalty
    match.homeGoals = preservedResult?.homeGoals ?? rollGoals(homeAttack, awayDefense)
    match.awayGoals = preservedResult?.awayGoals ?? rollGoals(awayAttack, homeDefense)
    if (isClubMatch) {
      const preservedTimeline = preservedResult?.timeline?.map((event) => normalizeMatchTimelinePeriod(event))
      clubTimelinePlan = preservedTimeline
        ? preservedTimeline.map(({ minute, addedTime, period, type, teamId }) => ({
          minute,
          addedTime,
          period,
          type,
          teamId,
        }))
        : createMatchTimelinePlan(match.homeId, match.awayId, match.homeGoals, match.awayGoals)
      if (preservedTimeline) match.timeline = structuredClone(preservedTimeline)
    }
    match.played = true
    home.played += 1
    away.played += 1
    home.goalsFor += match.homeGoals
    home.goalsAgainst += match.awayGoals
    away.goalsFor += match.awayGoals
    away.goalsAgainst += match.homeGoals
    if (match.homeGoals > match.awayGoals) {
      home.wins += 1
      home.points += 3
      away.losses += 1
    } else if (match.homeGoals < match.awayGoals) {
      away.wins += 1
      away.points += 3
      home.losses += 1
    } else {
      home.draws += 1
      away.draws += 1
      home.points += 1
      away.points += 1
    }
    recordHeadToHead(home, away, match.homeGoals, match.awayGoals)
    if (match.id !== clubMatch.id) {
      const homeStats = simulateLeaguePlayerStats(
        next,
        home.id,
        match.homeGoals,
        match.awayGoals,
        undefined,
        match.disciplinaryEvents.filter((event) => event.teamId === home.id),
      )
      const awayStats = simulateLeaguePlayerStats(
        next,
        away.id,
        match.awayGoals,
        match.homeGoals,
        undefined,
        match.disciplinaryEvents.filter((event) => event.teamId === away.id),
      )
      recordTeamDiscipline(home, homeStats.disciplinaryEvents)
      recordTeamDiscipline(away, awayStats.disciplinaryEvents)
    }
  }

  if (!clubMatch || clubMatch.homeGoals === undefined || clubMatch.awayGoals === undefined) {
    return { game, error: 'Nie udało się odnaleźć wyniku meczu Twojej drużyny.' }
  }
  const homeGame = clubMatch.homeId === next.teamId
  const homeGoals = clubMatch.homeGoals
  const awayGoals = clubMatch.awayGoals
  const clubGoals = homeGame ? homeGoals : awayGoals
  const opponentId = homeGame ? clubMatch.awayId : clubMatch.homeId
  const opponentGoals = homeGame ? awayGoals : homeGoals
  const clubScorerIds = preservedClubTimeline
    ?.filter((event) => event.teamId === next.teamId && (event.type === 'goal' || event.type === 'penalty-goal'))
    .map((event) => event.playerId)
  const opponentScorerIds = preservedClubTimeline
    ?.filter((event) => event.teamId === opponentId && (event.type === 'goal' || event.type === 'penalty-goal'))
    .map((event) => event.playerId)
  const attendance = homeGame ? clubMatch.attendance ?? 0 : 0
  const { playerGoals } = recordPlayerMatchStats(
    next.squad,
    startingPlayers,
    clubGoals - countOwnGoalsForTeam(clubTimelinePlan, next.teamId),
    'league',
    clubScorerIds,
  )
  const opponentDisciplinaryEvents = preservedResults?.get(clubMatch.id)?.disciplinaryEvents
    ?.filter((event) => event.teamId === opponentId)
  const opponentStats = simulateLeaguePlayerStats(
    next,
    opponentId,
    opponentGoals - countOwnGoalsForTeam(clubTimelinePlan, opponentId),
    clubGoals,
    opponentScorerIds,
    opponentDisciplinaryEvents ?? clubMatch.disciplinaryEvents
      ?.filter((event) => event.teamId === opponentId),
  )
  const opponentPlayerGoals = opponentStats.playerGoals
  if (!preservedClubTimeline) {
    const opponentLineup = getMatchEventLineup(next, opponentId)
    clubMatch.timeline = createMatchTimeline(
      clubTimelinePlan,
      clubMatch.homeId,
      clubMatch.awayId,
      homeGame ? startingPlayers : opponentLineup,
      homeGame ? opponentLineup : startingPlayers,
      homeGame ? playerGoals : opponentPlayerGoals,
      homeGame ? opponentPlayerGoals : playerGoals,
    )
  }
  if (homeGame) {
    next.homeMatchesPlayed += 1
    next.totalHomeAttendance += attendance
  }
  const cateringBonus = 1 + next.facilities.catering * 0.1
  const gateIncome = homeGame ? Math.round(attendance * next.ticketPrice * cateringBonus) : 0
  const wages = next.squad.reduce((sum, player) => sum + player.wage, 0)
  const resultIncome = homeGoals > awayGoals ? 180_000 : homeGoals === awayGoals ? 90_000 : 35_000
  if (gateIncome > 0) addFinance(next, 'Sprzedaż z biletów', gateIncome)
  addFinance(next, 'Przychód z dnia meczowego', resultIncome)
  if (homeGame) addFinance(next, 'Organizacja dnia meczowego', -Math.round(attendance * 2))
  addFinance(next, 'Wynagrodzenia kadry', -wages)
  payStadiumUpkeep(next)
  payStaffWages(next)
  payAcademyUpkeep(next)
  for (const [key, label] of [['sponsorDeal', 'Wpływy od sponsora'], ['tvDeal', 'Prawa telewizyjne']] as const) {
    const deal = next[key]
    if (!deal || deal.roundsRemaining <= 0) continue
    addFinance(next, `${label}: ${deal.company}`, deal.paymentPerMatch)
    deal.roundsRemaining -= 1
    if (key === 'sponsorDeal' && deal.roundsRemaining === 1) {
      addInboxMessage(next, deal.company, 'Umowa sponsorska wkrótce dobiegnie końca', `Umowa z aktualnym sponsorem ${deal.company} zakończy się po najbliższym meczu ligowym. Możesz teraz przedłużyć współpracę z ${deal.company} w zakładce Finanse albo po wygaśnięciu wybrać innego sponsora.`, 'info', 'club')
    }
    if (deal.roundsRemaining === 0) {
      addFinance(next, `Koniec umowy: ${deal.company}`, 0)
      next[key] = null
      if (key === 'sponsorDeal') {
        next.sponsorRequired = true
        addMediaPost(next, 'SPONSOR', `Umowa z ${deal.company} dobiegła końca`, `${next.clubName} musi podpisać nowy kontrakt sponsorski, aby zapewnić finansowanie na kolejne mecze.`)
        addInboxMessage(next, deal.company, 'Umowa sponsorska dobiegła końca', `Umowa z dotychczasowym sponsorem ${deal.company} wygasła. Klub nie otrzyma dalszych płatności ani premii końcowej z tego kontraktu. Możesz przedłużyć współpracę z ${deal.company} lub wybrać innego sponsora w zakładce Finanse przed kolejnym meczem.`, 'info', 'club')
      }
    }
  }
  next.scouts.forEach((scout) => {
    addFinance(next, `Wynagrodzenie skauta: ${scout.name}`, -scout.wagePerRound)
    if (scout.prospect) return
    scout.roundsUntilReport -= 1
    if (scout.roundsUntilReport > 0) return
    scout.prospect = scoutForProspect(next, scout)
    ensureUniqueGamePlayerNames(next)
    const prospect = scout.prospect
    addMediaPost(next, 'TRANSFER', `Skaut ${scout.name} odkrył młody talent`, `${scout.name} poleca ${prospect.firstName} ${prospect.lastName}, ${prospect.age}-letniego zawodnika z potencjałem ${prospect.potential}/100.`)
  })

  const teamContext = buildMatchContext(startingPlayers, matchLineupRating(next, startingIds, clubMatch.id), clubMatch.homeId === next.teamId, next.tactics)
  const preparationBonus = preparation === 'tactical' ? 3 : preparation === 'motivation' ? 1 : 0
  teamContext.attack += preparationBonus + (localDerby ? 3 : 0)
  teamContext.defense += preparationBonus + (localDerby ? 2 : 0)
  const staminaCost = Math.max(8, teamContext.staminaDrain + eventChoice.staminaModifier - (preparation === 'recovery' ? 3 : 0) - (conference === 'protective' ? 2 : 0))
  const regularPlayerIds = new Set([...next.squad].sort((first, second) => second.skill - first.skill).slice(0, 14).map((player) => player.id))
  const manualSubstitutedOffIds = new Set(selectedEvent.substitutedPlayerIds ?? [])
  const manualSubstituteIds = selectedEvent.substitutePlayerIds ?? []
  const manualSubstitutionEvents = manualSubstitutedOffIds.values()
  const manualSubstitutions = [...manualSubstitutionEvents].flatMap((outgoingPlayerId, index) => {
    const incomingPlayerId = manualSubstituteIds[index]
    return incomingPlayerId
      ? [{ minute: 45, teamId: next.teamId, outgoingPlayerId, incomingPlayerId, reason: 'manual' as const }]
      : []
  })
  next.squad.forEach((player) => {
    if (startingIds.includes(player.id)) player.stamina = Math.max(30, player.stamina - staminaCost)
    else if (manualSubstituteIds.includes(player.id) || manualSubstitutedOffIds.has(player.id)) player.stamina = Math.max(30, player.stamina - Math.ceil(staminaCost * 0.45))
    else player.stamina = Math.min(100, player.stamina + 8)
    const resultChange = homeGoals === awayGoals ? 1 : (homeGame ? homeGoals > awayGoals : awayGoals > homeGoals) ? 5 : -5
    const playingTimeChange = competition === 'league'
      ? startingIds.includes(player.id)
        ? 2
        : regularPlayerIds.has(player.id) && next.round >= 6 && (player.seasonAppearances ?? 0) < Math.floor(next.round / 5)
          ? -2
          : 0
      : 0
    const derbyChange = localDerby && resultChange !== 1 ? resultChange > 0 ? 2 : -2 : 0
    player.morale = Math.max(20, Math.min(100, player.morale + resultChange + playingTimeChange + derbyChange))
  })
  if (competition === 'league') resolvePlayerPromises(next, startingIds)
  removeDismissedPlayersFromMatch(next, clubMatch.disciplinaryEvents ?? [], next.teamId)
  const { injuryEvents, recoveredPlayerIds } = applyMatchdayInjuries(next, preMatchStamina, clubMatch.extraTimePlayed ? 120 : 90)
  const automaticSubstitutions = applyAutomaticMatchSubstitutions(
    next,
    selectedEvent,
    injuryEvents,
    preMatchStamina,
    competition,
    clubMatch.extraTimePlayed ? 120 : 90,
  )
  clubMatch.injuryEvents = injuryEvents
  clubMatch.substitutions = [...manualSubstitutions, ...automaticSubstitutions]
  const substitutedOffIds = new Set(selectedEvent.substitutedPlayerIds ?? [])
  const substituteIds = selectedEvent.substitutePlayerIds ?? []
  for (const playerId of substituteIds) {
    if (startingIds.includes(playerId)) continue
    const player = next.squad.find((candidate) => candidate.id === playerId)
    if (!player) continue
    if (competition === 'league') player.seasonAppearances = (player.seasonAppearances ?? 0) + 1
    player.careerAppearances = (player.careerAppearances ?? 0) + 1
  }
  const returnedFromSuspension = decrementSuspensions(next, competition)
  const preservedClubDisciplinaryEvents = preservedResults?.get(clubMatch.id)?.disciplinaryEvents
    ?.filter((event) => event.teamId === next.teamId)
  const clubDisciplinaryEvents = preservedClubDisciplinaryEvents
    ?? clubMatch.disciplinaryEvents?.filter((event) => event.teamId === next.teamId)
    ?? simulateDisciplinaryEvents(
      structuredClone(startingPlayers),
      next.teamId,
      competition,
      clubMatch.extraTimePlayed ? 120 : 90,
    )
  clubMatch.disciplinaryEvents = [
    ...clubDisciplinaryEvents,
    ...opponentStats.disciplinaryEvents,
  ]
  applyDisciplinaryEvents(next.squad, clubDisciplinaryEvents, competition)
  addAvailabilityMessages(next, clubMatch, competition)
  if (competition === 'league') {
    const clubTeam = next.teams.find((team) => team.id === next.teamId)
    const opponentTeam = next.teams.find((team) => team.id === opponentId)
    if (clubTeam) recordTeamDiscipline(clubTeam, clubMatch.disciplinaryEvents.filter((event) => event.teamId === next.teamId))
    if (opponentTeam) recordTeamDiscipline(opponentTeam, clubMatch.disciplinaryEvents.filter((event) => event.teamId === opponentId))
  }
  const teamGoalsAgainst = homeGame ? awayGoals : homeGoals
  if (teamGoalsAgainst === 0) {
    const goalkeeper = startingPlayers.find((player) => player.position === 'BR')
    if (goalkeeper) goalkeeper.seasonCleanSheets = (goalkeeper.seasonCleanSheets ?? 0) + 1
  }
  const returnedPlayerIds = new Set([...returnedFromSuspension, ...recoveredPlayerIds])
  const nextSelection = completeMatchSquad(next, next.matchLineupIds, next.matchBenchIds, competition, returnedPlayerIds)
  next.matchLineupIds = nextSelection.starters
  next.matchBenchIds = nextSelection.bench
  const clubWon = homeGame ? homeGoals > awayGoals : awayGoals > homeGoals
  next.followers = Math.max(1_000, next.followers + (clubWon ? 450 : homeGoals === awayGoals ? 120 : -160) + Math.round(attendance * 0.02))
  if (localDerby) next.followers += 300
  const homeName = getTeamName(next, clubMatch.homeId)
  const awayName = getTeamName(next, clubMatch.awayId)
  const crowdNote = homeGame
    ? ` Na trybunach zasiadło ${attendance.toLocaleString('pl-PL')} kibiców.`
    : ''
  const outcome = clubWon ? 'win' : homeGoals === awayGoals ? 'draw' : 'loss'
  if (localDerby && outcome !== 'draw') {
    next.localReputation = Math.max(0, Math.min(100, (next.localReputation ?? 35) + (clubWon ? 2 : -2)))
  }
  applyDerbyMatchAction(next, clubMatch.id)
  next.commercialOffers = createCommercialOffers(
    next.leagueId,
    overallRating(next.squad),
    getClubReputation(next),
    getSeasonRoundCount(next),
    next.localReputation,
  )
  const rivalry = competition === 'league'
    ? recordClubRivalryMatch(
      next,
      opponentId,
      getTeamName(next, opponentId),
      clubGoals,
      opponentGoals,
      localDerby,
    )
    : undefined
  updateBoardConfidenceAfterMatch(next, outcome, competition)
  if (localDerby && outcome !== 'draw') {
    next.boardConfidence = Math.max(0, Math.min(100, (next.boardConfidence ?? 65) + (clubWon ? 1 : -1)))
  }
  adjustTeamChemistry(next, startingIds, clubWon ? 2 : outcome === 'draw' ? 1 : -1)
  processSponsorMatchOutcome(next, outcome)
  const originalStartingIds = [...startingIds.filter((id) => !substituteIds.includes(id)), ...substitutedOffIds]
  const playerRatings = rateMatchPlayers(
    next.squad,
    originalStartingIds,
    substituteIds,
    playerGoals,
    clubMatch.disciplinaryEvents,
    outcome,
  )
  recordLeaguePlayerRatings(next.squad, playerRatings)
  const styleLabel = tacticalStyleOptions.find((option) => option.id === next.tactics.style)?.label.toLocaleLowerCase('pl') ?? 'zrównoważony'
  const pressingLabel = pressingOptions.find((option) => option.id === next.tactics.pressing)?.label.toLocaleLowerCase('pl') ?? 'normalny'
  const tacticalNote = `Ustawienie ${next.tactics.formation}, styl ${styleLabel}, pressing ${pressingLabel}.`
  const cardsSummary = clubMatch.disciplinaryEvents.length
    ? ` Kartki: ${clubMatch.disciplinaryEvents.map((event) => `${event.card === 'red' ? 'czerwona' : 'żółta'} dla ${event.playerName}${event.suspensionApplied ? ' — pauza w kolejnych rozgrywkach tego typu' : ''}`).join('; ')}.`
    : ' Bez kartek dla zawodników Twojego klubu.'
  const tacticalSummary = outcome === 'win'
    ? `Plan zadziałał — drużyna zdobyła trzy punkty. ${next.tactics.pressing === 'high' ? 'Wysoki pressing mocno obciążył kondycję podstawowych zawodników.' : 'Zespół zachował siły na kolejne spotkanie.'}`
    : outcome === 'draw'
      ? `Zespół podzielił się punktami. ${next.tactics.style === 'attacking' ? 'Odważniejsze nastawienie otworzyło grę, ale nie wystarczyło do zwycięstwa.' : 'Taktyka pozwoliła utrzymać mecz pod kontrolą.'}`
      : `Drużyna wraca bez punktów. ${next.tactics.style === 'attacking' ? 'Ofensywne ustawienie pozostawiło rywalom więcej miejsca.' : 'Przed kolejnym meczem warto rozważyć korektę planu.'}`
  const eventSummary = `Decyzja: ${eventChoice.label.toLocaleLowerCase('pl')} podczas wydarzenia „${selectedEvent.title}”.${preparation ? ` Przygotowanie: ${preparation === 'tactical' ? 'analiza taktyczna' : preparation === 'recovery' ? 'regeneracja' : 'mobilizacja drużyny'}.` : ''}${localDerby ? ' Mecz derbowy.' : ''}`
  const rivalrySummary = rivalry && (localDerby || rivalry.rivalryPoints >= 6)
    ? ` Bilans rywalizacji z ${rivalry.opponentName}: ${rivalry.wins}-${rivalry.draws}-${rivalry.losses}; ostatni wynik ${rivalry.lastScore}.`
    : ''
  const substitutionSummary = selectedEvent.substitutedPlayerIds?.length
    ? ` Zmiany: ${selectedEvent.substitutedPlayerIds.map((playerId) => next.squad.find((player) => player.id === playerId)).filter((player): player is Player => Boolean(player)).map((player) => `${player.firstName} ${player.lastName}`).join(', ')}.`
    : ''
  next.lastMatchReport = {
    matchId: clubMatch.id,
    round: next.round,
    score: `${homeGoals} : ${awayGoals}`,
    outcome,
    headline: outcome === 'win' ? 'Taktyka przyniosła efekt' : outcome === 'draw' ? 'Punkty podzielone' : 'Czas na korektę planu',
    summary: `${tacticalSummary} ${eventSummary}${rivalrySummary}${substitutionSummary}${cardsSummary}`,
    tacticalNote,
    playerRatings,
  }
  addMediaPost(next, 'MECZ', `${homeName} ${homeGoals} : ${awayGoals} ${awayName}`, `Relacja z kolejki ${next.round}: ${next.clubName} ${clubWon ? 'dopisał ważne punkty' : homeGoals === awayGoals ? 'podzielił się punktami' : 'musi wyciągnąć wnioski po porażce'}. ${eventSummary}${rivalrySummary}${substitutionSummary} ${tacticalNote}${cardsSummary}${crowdNote}`)
  if (next.pendingMatchPreparation?.matchId === clubMatch.id) next.pendingMatchPreparation = undefined
  if (next.pendingMatchConference?.matchId === clubMatch.id) next.pendingMatchConference = undefined
  const leagueHighlight = roundMatches
    .filter((match) => match.id !== clubMatch.id)
    .sort((first, second) => (second.homeGoals ?? 0) + (second.awayGoals ?? 0) - (first.homeGoals ?? 0) - (first.awayGoals ?? 0))[0]
  if (leagueHighlight) {
    const leagueHomeGoals = leagueHighlight.homeGoals ?? 0
    const leagueAwayGoals = leagueHighlight.awayGoals ?? 0
    const leagueHeadline = `${getTeamName(next, leagueHighlight.homeId)} ${leagueHomeGoals} : ${leagueAwayGoals} ${getTeamName(next, leagueHighlight.awayId)}`
    addMediaPost(next, 'LIGA', leagueHeadline, `Dziennikarze podsumowują inne spotkanie kolejki ${next.round} i zmiany w tabeli ${leagues.find((league) => league.id === next.leagueId)?.name}.`)
  }
  if (next.facilities.academy > 0 && next.round % 3 === 0 && !next.academyProspect && (next.academyPlayers?.length ?? 0) < 12) {
    next.academyProspect = createAcademyProspect(next)
    ensureUniqueGamePlayerNames(next)
    addFinance(next, `${academyNames[next.facilities.academy - 1]}: gotowy junior do naboru`, 0)
  }
  if (competition === 'league') {
    createSeasonEvent(next)
    createPlayerStory(next)
    createAcademyStory(next)
  }
  advanceLeagueWorld(next)
  processDebtSanctions(next)
  resolveAiTransferWindow(next, next.round)
  next.round += 1
  return { game: next, error: '' }
}

export function startNewSeason(game: GameState) {
  if (game.round <= getSeasonRoundCount(game)) return { game, error: 'Najpierw rozegraj wszystkie kolejki bieżącego sezonu.' }
  if (
    game.leagueSeasonExceptions?.season === game.season
    && game.leagueSeasonExceptions.withdrawnTeamIds?.includes(game.teamId)
    && (game.leagueId.startsWith('opolskie-a-') || game.leagueId.startsWith('opolskie-b-'))
  ) {
    return {
      game,
      error: 'Wycofanie prowadzonego klubu z klasy A lub B oznacza spadek poniżej obsługiwanej piramidy Opolskiego.',
    }
  }
  if (!game.promotionPlayoffs) {
    const next = structuredClone(game)
    next.promotionPlayoffs = createPromotionPlayoffSchedule(next)
    if (!next.promotionPlayoffs.fixtures.length) next.promotionPlayoffs.round = 'complete'
    if (next.promotionPlayoffs.round !== 'complete') {
      return { game: next, error: 'Pary barażowe zostały ustalone. Sprawdź terminarz w skrzynce e-mail.' }
    }
  }
  if (game.promotionPlayoffs && game.promotionPlayoffs.round !== 'complete') {
    return { game, error: 'Najpierw rozegraj zaplanowane baraże o awans i zaczekaj na ich rozstrzygnięcie.' }
  }
  if (game.polishCup && game.polishCup.stage !== 'complete') {
    return { game, error: 'Najpierw dokończ zaplanowane rundy Polskiego Pucharu.' }
  }
  if (game.regionalCups?.some((cup) =>
    cup.teams.length > 0
    && !cup.championId
    && (cup.participants.length > 0 || cup.matches.length > 0 || cup.history.length > 0),
  )) {
    return { game, error: 'Najpierw dokończ puchary regionalne, aby zapisać ich zwycięzców i awansujących do kolejnej edycji.' }
  }
  const next = structuredClone(game)
  next.managerCareer ??= summarizeManagerCareer(next.seasonHistory ?? [])
  const completedSeason = next.season
  const reputation = getClubReputation(next)
  const previousLeagueId = next.leagueId
  const finalTable = getLeagueTable(next)
  const clubPosition = finalTable.findIndex((team) => team.id === next.teamId)
  if (clubPosition < 0) throw new Error('Nie udało się ustalić końcowej pozycji klubu w tabeli.')
  const club = finalTable[clubPosition]
  next.trophyCabinet ??= []
  if (clubPosition === 0) {
    addClubTrophy(next, {
      id: `league-${completedSeason}`,
      competition: 'league',
      name: getLeagueChampionTrophyName(next.leagueId),
      season: completedSeason,
      leagueId: next.leagueId,
    })
  }
  if (next.polishCup?.championId === next.teamId) {
    addClubTrophy(next, {
      id: `polish-cup-${completedSeason}`,
      competition: 'polish-cup',
      name: 'Polski Puchar',
      season: completedSeason,
    })
  }
  if (next.championsCupMatch?.season === completedSeason
    && next.championsCupMatch.played
    && next.championsCupMatch.winnerId === next.teamId) {
    addClubTrophy(next, {
      id: `champions-cup-${completedSeason}`,
      competition: 'champions-cup',
      name: 'Puchar Mistrzów',
      season: completedSeason,
    })
  }
  next.regionalCups?.forEach((cup) => {
    if (cup.championId !== next.teamId) return
    addClubTrophy(next, {
      id: `regional-cup-${cup.regionId}-${completedSeason}`,
      competition: 'regional-cup',
      name: 'Puchar Regionalny',
      season: completedSeason,
      regionId: cup.regionId,
    })
  })
  const seasonHonors = (next.trophyCabinet ?? [])
    .filter((trophy) => trophy.season === completedSeason)
    .map((trophy) => trophy.name)
  const seasonAwards = getSeasonAwards(next)
  const teamOfSeason = getSeasonTeamOfSeason(next)
  for (const award of seasonAwards) {
    const awardedPlayer = award.clubId === next.teamId
      ? next.squad.find((player) => player.id === award.playerId)
      : next.clubSquads[award.clubId]?.find(({ player }) => player.id === award.playerId)?.player
    if (awardedPlayer) {
      addPlayerHistory(awardedPlayer, {
        season: completedSeason,
        type: 'award',
        title: award.title,
        details: `${award.valueLabel} · ${award.clubName}.`,
      })
    }
  }
  for (const member of teamOfSeason) {
    const selectedPlayer = member.clubId === next.teamId
      ? next.squad.find((player) => player.id === member.playerId)
      : next.clubSquads[member.clubId]?.find(({ player }) => player.id === member.playerId)?.player
    if (selectedPlayer) {
      addPlayerHistory(selectedPlayer, {
        season: completedSeason,
        type: 'award',
        title: 'Jedenastka sezonu',
        details: `Wybrany na pozycję ${member.position} · ocena ${member.rating.toFixed(2)} · ${member.clubName}.`,
      })
    }
  }
  const seasonRecord: SeasonRecord = {
    season: next.season,
    leagueId: next.leagueId,
    finalPosition: clubPosition + 1,
    points: club.points,
    wins: club.wins,
    draws: club.draws,
    losses: club.losses,
    goalsFor: club.goalsFor,
    goalsAgainst: club.goalsAgainst,
    finalTable: finalTable.map((team) => ({ ...team })),
    awards: seasonAwards,
    teamOfSeason,
    honors: seasonHonors,
    topScorers: next.squad
      .filter((player) => (player.seasonGoals ?? 0) > 0)
      .sort((first, second) => (second.seasonGoals ?? 0) - (first.seasonGoals ?? 0) || (second.seasonAppearances ?? 0) - (first.seasonAppearances ?? 0))
      .slice(0, 5)
      .map((player) => ({
        playerId: player.id,
        name: `${player.firstName} ${player.lastName}`,
        goals: player.seasonGoals ?? 0,
        appearances: player.seasonAppearances ?? 0,
      })),
    recordedAt: new Date().toISOString(),
  }
  next.seasonHistory ??= []
  next.seasonHistory.unshift(seasonRecord)
  next.seasonHistory = next.seasonHistory.slice(0, 20)
  if (seasonAwards.length) {
    const awardsSummary = seasonAwards
      .map((award) => `${award.title}: ${award.playerName} (${award.clubName})`)
      .join('; ')
    addMediaPost(next, 'LIGA', `Nagrody sezonu ${completedSeason}`, awardsSummary)
  }
  const boardEvaluation = evaluateBoardGoal(next, clubPosition + 1, next.leagueId)
  next.boardConfidence = boardEvaluation.review.confidenceAfter
  next.boardHistory ??= []
  next.boardHistory.unshift(boardEvaluation.review)
  next.boardHistory = next.boardHistory.slice(0, 20)
  if (boardEvaluation.review.rewardPaid > 0) {
    addFinance(next, `Premia zarządu za sezon ${next.season}`, boardEvaluation.review.rewardPaid)
  }
  const boardOutcome = boardEvaluation.review.positionAchieved && boardEvaluation.review.financesAchieved
    ? `Zrealizowano oba cele zarządu. Premia ${boardEvaluation.review.rewardPaid.toLocaleString('pl-PL')} zł.`
    : boardEvaluation.review.positionAchieved || boardEvaluation.review.financesAchieved
      ? `Zrealizowano jeden z dwóch celów. Premia częściowa ${boardEvaluation.review.rewardPaid.toLocaleString('pl-PL')} zł.`
      : 'Nie zrealizowano celów zarządu. Zaufanie zarządu spadło.'
  addMediaPost(next, 'KLUB', `Zarząd ocenia sezon ${next.season}`, `${boardOutcome} Zaufanie zarządu: ${boardEvaluation.review.confidenceAfter}%.`)
  completeSeasonLoans(next)
  const departingPlayers = next.squad.filter((player) => (player.contractSeasonsRemaining ?? 2) <= 1)
  const retainedPlayers = next.squad.filter((player) => (player.contractSeasonsRemaining ?? 2) > 1)
  if (retainedPlayers.length < 11) {
    return { game, error: 'Po wygaśnięciu umów w kadrze zostałoby mniej niż 11 zawodników. Przedłuż kontrakty lub uzupełnij skład przed rozpoczęciem nowego sezonu.' }
  }
  const seniorProgress = retainedPlayers.map((player) => {
    const previousSkill = player.skill
    const nextPlayer = {
      ...player,
      age: player.age + 1,
      contractSeasonsRemaining: (player.contractSeasonsRemaining ?? 2) - 1,
    }
    if (nextPlayer.age <= 23 && nextPlayer.skill < nextPlayer.potential) {
      nextPlayer.skill += 1
    } else if (nextPlayer.age >= 33) {
      nextPlayer.skill -= 1
    }
    nextPlayer.skill = Math.max(1, Math.min(nextPlayer.potential, nextPlayer.skill))
    nextPlayer.value = playerValue(nextPlayer.skill, nextPlayer.potential, nextPlayer.age)
    if (nextPlayer.skill !== previousSkill) {
      addPlayerHistory(nextPlayer, {
        season: next.season,
        type: 'overall',
        title: 'Zmiana umiejętności',
        details: `Umiejętność ${previousSkill} → ${nextPlayer.skill}.`,
      })
    }
    return { player: nextPlayer, previousSkill, skillChange: nextPlayer.skill - previousSkill }
  })
  const retiredPlayers = seniorProgress.filter(({ player }) => player.age >= 38)
  const activePlayers = seniorProgress.filter(({ player }) => player.age < 38)
  if (activePlayers.length < 11) {
    return { game, error: `Po zakończeniu kariery najstarszych zawodników kadra liczyłaby tylko ${activePlayers.length} graczy. Uzupełnij skład do co najmniej 11 zawodników przed rozpoczęciem nowego sezonu.` }
  }
  const progressedPlayers = seniorProgress.filter(({ skillChange }) => skillChange > 0)
  const declinedPlayers = seniorProgress.filter(({ skillChange }) => skillChange < 0)
  const academyLevel = next.facilities.academy
  next.academyPlayers = (next.academyPlayers ?? []).map((player) => {
    const previousAge = player.age
    player.age += 1
    const developmentChance = previousAge < 18 ? 0.9 : previousAge < 21 ? 0.65 : 0.3
    const baseDevelopment = previousAge < 21 ? 1 : 0
    const bonusDevelopment = academyLevel > 0 && Math.random() < Math.min(1, developmentChance * academyLevel / 3) ? 1 : 0
    const eliteDevelopment = academyLevel >= 4 && Math.random() < (academyLevel - 3) * 0.1 ? 1 : 0
    player.skill = Math.min(player.potential, player.skill + baseDevelopment + bonusDevelopment + eliteDevelopment)
    player.value = playerValue(player.skill, player.potential, player.age)
    player.wage = Math.round(player.skill * player.skill * 0.25 / 100) * 100
    return player
  })
  next.academyPlayers.forEach((player) => {
    const original = game.academyPlayers?.find((item) => item.id === player.id)
    if (original && player.skill > original.skill) {
      addMediaPost(next, 'KLUB', `Junior ${player.firstName} ${player.lastName} robi postępy`, `Po sezonie w akademii jego umiejętności wzrosły z ${original.skill} do ${player.skill}.`)
    }
  })
  next.squad = activePlayers.map(({ player }) => player)
  const retainedIds = new Set(next.squad.map((player) => player.id))
  next.lineupIds = next.lineupIds.filter((id) => retainedIds.has(id))
  next.matchLineupIds = next.matchLineupIds.filter((id) => retainedIds.has(id))
  next.matchBenchIds = next.matchBenchIds.filter((id) => retainedIds.has(id))
  next.previousMatchLineupIds = next.previousMatchLineupIds.filter((id) => retainedIds.has(id))
  next.previousMatchBenchIds = next.previousMatchBenchIds.filter((id) => retainedIds.has(id))
  const nextLineup = [...new Set(next.lineupIds)]
  for (const player of [...next.squad].sort((first, second) => second.skill - first.skill)) {
    if (nextLineup.length >= 11) break
    if (!nextLineup.includes(player.id)) nextLineup.push(player.id)
  }
  next.lineupIds = nextLineup
  next.matchLineupIds = [...nextLineup]
  delete next.matchLineupPositions
  next.matchBenchIds = next.squad
    .filter((player) => !nextLineup.includes(player.id))
    .sort((first, second) => second.skill - first.skill)
    .slice(0, 7)
    .map((player) => player.id)
  next.previousMatchLineupIds = []
  next.previousMatchBenchIds = []
  if (departingPlayers.length > 0) {
    const names = departingPlayers.map((player) => `${player.firstName} ${player.lastName}`).join(', ')
    addMediaPost(next, 'TRANSFER', 'Zawodnicy opuszczają klub po wygaśnięciu umów', `${names} odchodzą z ${next.clubName} po zakończeniu kontraktów.`)
    addFinance(next, `Odejścia po wygaśnięciu kontraktów (${departingPlayers.length})`, 0)
  }
  if (retiredPlayers.length > 0) {
    const names = retiredPlayers.map(({ player }) => `${player.firstName} ${player.lastName}`).join(', ')
    addMediaPost(next, 'KLUB', 'Zawodnicy kończą karierę', `${names} zakończyli karierę po osiągnięciu 38 lat. Dziękujemy za ich wkład w klub.`)
    addFinance(next, `Zakończenie kariery (${retiredPlayers.length})`, 0)
  }
  if (progressedPlayers.length > 0 || declinedPlayers.length > 0) {
    const improvedNames = progressedPlayers.map(({ player, skillChange }) => `${player.firstName} ${player.lastName} (+${skillChange})`).join(', ')
    const declinedNames = declinedPlayers.map(({ player, skillChange }) => `${player.firstName} ${player.lastName} (${skillChange})`).join(', ')
    const details = [
      improvedNames ? `Postępy: ${improvedNames}.` : '',
      declinedNames ? `Spadek umiejętności związany z wiekiem: ${declinedNames}.` : '',
    ].filter(Boolean).join(' ')
    addMediaPost(next, 'KLUB', 'Zmiany w kadrze po sezonie', details)
  }
  const expiredNegotiations = next.transferNegotiations.filter((negotiation) => negotiation.status === 'countered')
  expiredNegotiations.forEach((negotiation) => {
    negotiation.status = 'rejected'
    negotiation.counterAmount = null
  })
  if (expiredNegotiations.length > 0) {
    addMediaPost(next, 'TRANSFER', 'Negocjacje transferowe wygasły', `Po zakończeniu sezonu ${expiredNegotiations.length} nierozstrzygniętych kontrofert straciło ważność. Nowe rozmowy można rozpocząć w otwartym oknie transferowym.`)
  }
  const expiredIncomingOffers = (next.incomingTransferOffers ?? [])
    .filter((offer) => offer.status === 'pending' || offer.status === 'countered' || offer.status === 'player-negotiation')
  expiredIncomingOffers.forEach((offer) => {
    offer.status = 'rejected'
    updateIncomingTransferMessage(next, offer, 'rejected', 'Oferta wygasła wraz z zakończeniem sezonu i zamknięciem okna transferowego.')
  })
  if (expiredIncomingOffers.length > 0) {
    addMediaPost(next, 'TRANSFER', 'Oferty za zawodników wygasły', `${expiredIncomingOffers.length} nierozstrzygniętych ofert AI straciło ważność po zakończeniu sezonu.`)
  }
  if (next.regionalCups?.length) {
    next.regionalCupWinners ??= {}
    next.regionalCupWinnerNames ??= {}
    const completedRegionalWinners = Object.fromEntries(next.regionalCups
      .filter((cup): cup is RegionalCup & { championId: string } => Boolean(cup.championId))
      .map((cup) => [cup.regionId, [cup.championId]]))
    next.regionalCupWinners[completedSeason] = completedRegionalWinners
    next.regionalCupWinnerNames[completedSeason] = Object.fromEntries(next.regionalCups
      .filter((cup): cup is RegionalCup & { championId: string } => Boolean(cup.championId))
      .map((cup) => [
        cup.regionId,
        cup.teams.find((team) => team.id === cup.championId)?.name ?? cup.championId,
      ]))
  }
  const seasonResolution = finishLeagueWorldSeason(next)
  next.leagueWorld = seasonResolution.world
  next.leagueSeasonExceptions = undefined
  const resolvedLeagueId = Object.entries(next.leagueWorld).find(([, teams]) => teams.some((team) => team.id === next.teamId))?.[0]
  if (!resolvedLeagueId) throw new Error('Nie udało się odnaleźć klubu po rozstrzygnięciu awansów i spadków.')
  if (resolvedLeagueId !== previousLeagueId) {
    seasonRecord.leagueChange = getLeagueTier(resolvedLeagueId as LeagueId) < getLeagueTier(previousLeagueId)
      ? 'promotion'
      : 'relegation'
  }
  next.managerCareer.completedSeasons += 1
  next.managerCareer.leagueMatches += seasonRecord.wins + seasonRecord.draws + seasonRecord.losses
  next.managerCareer.leagueWins += seasonRecord.wins
  next.managerCareer.leagueGoals += seasonRecord.goalsFor
  next.managerCareer.promotions += Number(seasonRecord.leagueChange === 'promotion')
  next.managerCareer.leagueTitles += Number(seasonRecord.finalPosition === 1)
  next.leagueId = resolvedLeagueId as LeagueId
  next.teams = next.leagueWorld[next.leagueId]
  const ownTeam = next.teams.find((team) => team.id === next.teamId)
  if (!ownTeam) throw new Error('Klub nie znalazł się w nowej tabeli ligowej.')
  if (next.pendingLeaguePointDeduction) {
    ownTeam.points -= next.pendingLeaguePointDeduction
    addInboxMessage(next, 'Komisja Ligi', 'Kara punktowa obowiązuje od nowego sezonu', `${next.clubName} rozpoczyna rozgrywki z karą −${next.pendingLeaguePointDeduction} punktów nałożoną przez komisję z powodu zadłużenia.`, 'rejected', 'club')
    addMediaPost(next, 'LIGA', 'Kara punktowa obowiązuje od nowego sezonu', `${next.clubName} rozpoczyna rozgrywki z karą −${next.pendingLeaguePointDeduction} punktów nałożoną przez komisję z powodu zadłużenia.`)
    next.pendingLeaguePointDeduction = 0
  }
  if (next.pendingDebtSettlement) {
    const settledDebt = Math.max(next.debt, Math.round(-next.cash), 0)
    settleDebtAfterSanction(next)
    next.pendingDebtSettlement = false
    addInboxMessage(next, 'Komisja Ligi', 'Dług spłacony po karze punktowej', `Po zastosowaniu kary punktowej klub spłacił zadłużenie w wysokości ${settledDebt.toLocaleString('pl-PL')} zł. Saldo zadłużenia wynosi teraz 0 zł.`, 'info', 'club')
    addMediaPost(next, 'LIGA', 'Klub rozliczył zadłużenie', `Po otrzymaniu ujemnych punktów ${next.clubName} spłacił dług w wysokości ${settledDebt.toLocaleString('pl-PL')} zł i rozpoczyna sezon bez zadłużenia.`)
  }
  ownTeam.strength = overallRating(next.squad)
  next.leagueWorld[next.leagueId] = next.teams
  const [startYear, endYear] = next.season.split('/').map(Number)
  next.season = Number.isFinite(startYear) && Number.isFinite(endYear)
    ? `${startYear + 1}/${endYear + 1}`
    : `${next.season} · nowy sezon`
  next.clubSquads = {
    ...next.clubSquads,
    ...createClubSquads(next.teams, next.teamId, next.clubSquads, next.season),
  }
  Object.values(next.clubSquads).forEach((offers) => offers.forEach(({ player }) => {
    player.seasonAppearances = 0
    player.seasonGoals = 0
    player.seasonAssists = 0
    player.seasonCleanSheets = 0
    player.seasonRatingTotal = 0
    player.seasonRatedAppearances = 0
    const discipline = player.discipline?.league
    if (discipline) {
      discipline.yellowCardsTowardSuspension = 0
      discipline.yellowCardsTotal = 0
      discipline.redCards = 0
      discipline.suspendedMatches = 0
    }
  }))
  next.boardGoal = createBoardGoal(next.leagueId, next.teams, next.teamId, next.season, next.cash)
  next.round = 1
  next.leagueMatchupsPerOpponent = getLeagueMatchupsPerOpponent(next.teams.length)
  next.matches = createFixtures(next.teams)
  next.polishCup = makePolishCup(next)
  next.championsCupMatch = createChampionsCupMatch(next, seasonResolution.leagueChampionId)
  if (next.championsCupMatch
    && next.championsCupMatch.homeId !== next.teamId
    && next.championsCupMatch.awayId !== next.teamId) {
    const home = Object.values(next.leagueWorld ?? {}).flat().find((team) => team.id === next.championsCupMatch?.homeId)
    const away = Object.values(next.leagueWorld ?? {}).flat().find((team) => team.id === next.championsCupMatch?.awayId)
    if (!home || !away) throw new Error('Nie udało się odnaleźć finalistów Pucharu Mistrzów.')
    next.championsCupMatch.homeGoals = rollGoals(home.strength + 4, away.strength)
    next.championsCupMatch.awayGoals = rollGoals(away.strength, home.strength + 4)
    next.championsCupMatch.played = true
    if (next.championsCupMatch.homeGoals === next.championsCupMatch.awayGoals) {
      const homeWins = Math.random() < 0.5
      next.championsCupMatch.winnerId = homeWins ? home.id : away.id
      next.championsCupMatch.penaltyScore = homeWins ? '4:3' : '3:4'
    } else {
      next.championsCupMatch.winnerId = (next.championsCupMatch.homeGoals ?? 0) > (next.championsCupMatch.awayGoals ?? 0) ? home.id : away.id
    }
    addMediaPost(next, 'LIGA', 'Puchar Mistrzów otwiera sezon', `${home.name} ${next.championsCupMatch.homeGoals} : ${next.championsCupMatch.awayGoals} ${away.name}${next.championsCupMatch.penaltyScore ? ` (rzuty karne ${next.championsCupMatch.penaltyScore})` : ''}.`)
  }
  const qualifiedRegionalTeams = Object.entries(next.regionalCupWinners?.[completedSeason] ?? {})
    .flatMap(([regionId, teamIds]) => teamIds.map((teamId) => ({
      region: regionalOptions.find((option) => option.id === regionId)?.name ?? regionId,
      name: next.polishCup?.teams.find((team) => team.id === teamId)?.name,
    })))
    .filter((team): team is { region: string; name: string } => Boolean(team.name))
  if (qualifiedRegionalTeams.length > 0) {
    const qualifiersSummary = qualifiedRegionalTeams
      .map(({ region, name }) => `${region}: ${name}`)
      .join('\n')
    addInboxMessage(
      next,
      'Polski Związek Piłki Nożnej',
      `Zwycięzcy pucharów regionalnych · sezon ${completedSeason}`,
      `Do kolejnej edycji centralnego Polskiego Pucharu awansowali zwycięzcy rozgrywek regionalnych z poprzedniego sezonu:\n${qualifiersSummary}`,
      'info',
      'club',
    )
  }
  next.regionalCups = createRegionalCupSeasons(next.polishCup.teams, next.season, next.teamId)
  scheduleLeagueFixtures(next)
  next.currentDate = getPreseasonStartDate(next)
  next.preseasonFriendlies = createPreseasonFriendlies(next)
  next.lastMatchReport = null
  next.commercialOffers = createCommercialOffers(next.leagueId, overallRating(next.squad), reputation, getSeasonRoundCount(next), next.localReputation)
  next.sponsorDeal = null
  next.tvDeal = null
  next.sponsorRequired = true
  next.negotiatedSponsorOfferIds = []
  next.sponsorWinStreak = 0
  next.sponsorLossStreak = 0
  next.sponsorWarningIssued = false
  next.sponsorSigningBonusAvailable = true
  next.pendingDebtSettlement = false
  next.totalHomeAttendance = 0
  next.homeMatchesPlayed = 0
  next.squad = next.squad.map((player) => ({
    ...player,
    stamina: Math.min(100, player.stamina + 12),
    seasonAppearances: 0,
    seasonGoals: 0,
    seasonAssists: 0,
    seasonCleanSheets: 0,
    seasonRatingTotal: 0,
    seasonRatedAppearances: 0,
    cupAppearances: 0,
    cupGoals: 0,
  }))
  next.squad.forEach((player) => {
    const leagueDiscipline = player.discipline?.league
    if (leagueDiscipline) {
      leagueDiscipline.yellowCardsTowardSuspension = 0
      leagueDiscipline.yellowCardsTotal = 0
      leagueDiscipline.redCards = 0
    }
    const cupDiscipline = player.discipline?.['polish-cup']
    if (cupDiscipline) {
      cupDiscipline.yellowCardsTowardSuspension = 0
      cupDiscipline.yellowCardsTotal = 0
      cupDiscipline.redCards = 0
      cupDiscipline.suspendedMatches = 0
    }
  })
  const leagueName = leagues.find((league) => league.id === next.leagueId)?.name ?? 'nowej ligi'
  const movement = previousLeagueId === next.leagueId
    ? `Klub pozostaje w rozgrywkach ${leagueName}.`
    : getLeagueTier(next.leagueId) < getLeagueTier(previousLeagueId)
      ? `Awans! ${next.clubName} przechodzi do rozgrywek ${leagueName}.`
      : `Spadek. ${next.clubName} przechodzi do rozgrywek ${leagueName}.`
  addMediaPost(next, 'LIGA', `Rozstrzygnięcia sezonu ${next.season}`, `${movement} Pozostałe ligi również zakończyły sezon, a ich tabele zostały zaktualizowane.`)
  addMediaPost(next, 'LIGA', 'Wyniki baraży o awans', seasonResolution.playoffSummaries.join(' '))
  addMediaPost(next, 'KLUB', `Przygotowania do sezonu ${next.season}`, `${next.clubName} rozpoczyna nowe rozgrywki. ${reputation >= 0.65 ? 'Klub ma mocną pozycję negocjacyjną i duże zainteresowanie mediów.' : 'Zarząd wyznacza nowe cele sportowe.'} Podpisz umowę sponsorską przed pierwszym meczem.`)
  ensureUniqueGamePlayerNames(next)
  return { game: next, error: '' }
}

function rescheduleUnplayedCupMatches(
  matches: PolishCupMatch[],
  season: string,
  scheduleStage: PolishCupScheduleStage | undefined,
  currentDate: string | undefined,
  scheduleOffset = 0,
  game?: GameState,
) {
  if (!scheduleStage || matches.length === 0) return
  let fixtureIndex = 0
  let byeIndex = 0
  const scheduledMatches = matches.map((match) => {
    const matchIndex = match.bye ? fixtureIndex + byeIndex++ : fixtureIndex++
    const schedule = getPolishCupMatchSchedule(season, scheduleStage, matchIndex + scheduleOffset)
    return { match, schedule, previousDate: match.scheduledAt, previousTime: match.kickoffTime ?? '20:00' }
  })
  scheduledMatches.forEach(({ match, schedule, previousDate, previousTime }) => {
    if (match.played) return
    let scheduledDate = getLocalDateKey(schedule.date)
    if (currentDate && scheduledDate < currentDate) {
      if (previousDate && previousDate >= currentDate) {
        scheduledDate = previousDate
      } else {
        const nextAvailableDate = new Date(schedule.date)
        while (getLocalDateKey(nextAvailableDate) < currentDate) {
          nextAvailableDate.setDate(nextAvailableDate.getDate() + 7)
        }
        scheduledDate = getLocalDateKey(nextAvailableDate)
      }
    }
    match.scheduledAt = scheduledDate
    match.kickoffTime = schedule.kickoffTime
    if (
      game
      && previousDate
      && isPolishPublicHoliday(parseLocalDateKey(previousDate))
      && previousDate !== match.scheduledAt
      && !match.bye
      && (match.homeId === game.teamId || match.awayId === game.teamId)
    ) {
      const subject = `Zmiana terminu · ${getTeamName(game, match.homeId)} – ${getTeamName(game, match.awayId)} · ${previousDate}`
      if (game.inboxMessages?.some((message) => message.subject === subject)) return
      const dateLabel = (dateKey: string, time: string) =>
        `${new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(parseLocalDateKey(dateKey))} o ${time}`
      addInboxMessage(
        game,
        'Departament rozgrywek',
        subject,
        `Spotkanie ${getTeamName(game, match.homeId)} – ${getTeamName(game, match.awayId)} w Polskim Pucharze zostało przełożone, ponieważ pierwotny termin przypadał w święto ustawowe. Pierwotny termin: ${dateLabel(previousDate, previousTime)}. Nowy termin: ${dateLabel(match.scheduledAt, match.kickoffTime)}. Terminarz uwzględnia wymagane 72 godziny odpoczynku między spotkaniami.`,
        'info',
        'club',
      )
    }
  })
}

function rescheduleCupMatchesOnHolidays(game: GameState, matches: PolishCupMatch[]) {
  const minimumRestMilliseconds = 72 * 60 * 60 * 1000
  const allMatches = [
    ...game.matches,
    ...(game.polishCup?.history ?? []),
    ...(game.polishCup?.matches ?? []),
    ...(game.regionalCups ?? []).flatMap((cup) => [...cup.history, ...cup.matches]),
  ]
  for (const match of matches) {
    if (match.played || match.bye || !match.scheduledAt || !isPolishPublicHoliday(parseLocalDateKey(match.scheduledAt))) continue
    const previousDate = match.scheduledAt
    const previousTime = match.kickoffTime ?? '20:00'
    const teamIds = [match.homeId, match.awayId]
    const currentDate = game.currentDate ?? `${game.season.split('/')[0]}-07-01`
    const hasEnoughRest = (date: Date) => {
      const candidateTime = new Date(`${getLocalDateKey(date)}T${previousTime}:00`).getTime()
      return teamIds.every((teamId) => allMatches.every((fixture) => {
        if (fixture.id === match.id || fixture.bye || (fixture.homeId !== teamId && fixture.awayId !== teamId) || !fixture.scheduledAt) return true
        const fixtureTime = new Date(`${fixture.scheduledAt}T${fixture.kickoffTime ?? '20:00'}:00`).getTime()
        return Math.abs(candidateTime - fixtureTime) >= minimumRestMilliseconds
      }))
    }
    const holidayDate = parseLocalDateKey(previousDate)
    const updatedDate = Array.from({ length: 28 }, (_, index) => {
      const earlierDate = new Date(holidayDate)
      earlierDate.setDate(earlierDate.getDate() - index - 1)
      return earlierDate
    }).concat(Array.from({ length: 28 }, (_, index) => {
      const laterDate = new Date(holidayDate)
      laterDate.setDate(laterDate.getDate() + index + 1)
      return laterDate
    })).find((candidate) =>
      getLocalDateKey(candidate) >= currentDate
      && !isPolishPublicHoliday(candidate)
      && hasEnoughRest(candidate),
    )
    if (!updatedDate) {
      throw new Error(`Nie udało się znaleźć terminu meczu ${match.id} poza świętem z zachowaniem 72 godzin odpoczynku.`)
    }
    match.scheduledAt = getLocalDateKey(updatedDate)
    if (match.homeId !== game.teamId && match.awayId !== game.teamId) continue
    const subject = `Zmiana terminu · ${getTeamName(game, match.homeId)} – ${getTeamName(game, match.awayId)} · ${previousDate}`
    if (game.inboxMessages?.some((message) => message.subject === subject)) continue
    const dateLabel = (dateKey: string, time: string) =>
      `${new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(parseLocalDateKey(dateKey))} o ${time}`
    addInboxMessage(
      game,
      'Departament rozgrywek',
      subject,
      `Spotkanie ${getTeamName(game, match.homeId)} – ${getTeamName(game, match.awayId)} w Polskim Pucharze zostało przełożone, ponieważ pierwotny termin przypadał w święto ustawowe. Pierwotny termin: ${dateLabel(previousDate, previousTime)}. Nowy termin: ${dateLabel(match.scheduledAt, previousTime)}. Terminarz uwzględnia wymagane 72 godziny odpoczynku między spotkaniami.`,
      'info',
      'club',
    )
  }
}

export function loadGameFromJSON(rawSave: string): GameState | null {
  const parsed = JSON.parse(rawSave) as GameState
  if (parsed.version !== 1 || !parsed.clubName || !Array.isArray(parsed.teams) || !Array.isArray(parsed.squad) || !Array.isArray(parsed.matches)) {
    throw new Error('Zapis gry jest nieprawidłowy. Utwórz nową karierę, aby kontynuować.')
  }
  const renameClub = (name: string) => clubNameReplacements[name] ?? name
  const renameLeague = (name: string) =>
    name === '2. Liga' || name === 'Betclic 2. Liga' ? 'Druga Liga Polska' : name
  parsed.clubName = renameClub(parsed.clubName)
  parsed.teams.forEach((team) => { team.name = renameClub(team.name) })
  Object.values(parsed.leagueWorld ?? {}).flat().forEach((team) => { team.name = renameClub(team.name) })
  parsed.polishCup?.teams.forEach((team) => { team.name = renameClub(team.name) })
  parsed.regionalCups?.forEach((cup) => cup.teams.forEach((team) => { team.name = renameClub(team.name) }))
  parsed.seasonHistory?.forEach((record) => record.finalTable.forEach((team) => { team.name = renameClub(team.name) }))
  parsed.promotionPlayoffs?.fixtures.forEach((fixture) => { fixture.leagueName = renameLeague(fixture.leagueName) })
  parsed.promotionPlayoffs?.history.forEach((fixture) => { fixture.leagueName = renameLeague(fixture.leagueName) })
  if (parsed.leagueId === 'third') parsed.leagueId = 'third-1'
  if (parsed.leagueId === 'fourth') parsed.leagueId = 'fourth-mazowieckie'
  if (parsed.leagueMatchupsPerOpponent === undefined) {
    const roundsPerCycle = parsed.teams.length % 2 === 0 ? parsed.teams.length - 1 : parsed.teams.length
    const previousRoundCount = roundsPerCycle * 2
    const fourMatchFixtures = createFixtures(parsed.teams)
    const hasFourMatchSchedule = parsed.matches.length >= fourMatchFixtures.length
    const seasonAlreadyFinished = parsed.round > previousRoundCount
    parsed.leagueMatchupsPerOpponent = hasFourMatchSchedule
      ? getLeagueMatchupsPerOpponent(parsed.teams.length)
      : seasonAlreadyFinished
        ? 2
        : getLeagueMatchupsPerOpponent(parsed.teams.length)
    if (parsed.leagueMatchupsPerOpponent === 4 && !hasFourMatchSchedule) {
      const completedFixtures = new Map(
        parsed.matches
          .filter((match) => match.played)
          .map((match) => [`${match.round}:${match.homeId}:${match.awayId}`, match]),
      )
      parsed.matches = fourMatchFixtures.map((fixture) => {
        const completedFixture = completedFixtures.get(`${fixture.round}:${fixture.homeId}:${fixture.awayId}`)
        return completedFixture
          ? { ...fixture, ...completedFixture, id: fixture.id, round: fixture.round }
          : fixture
      })
    }
  }
  const currentWorld = createLeagueWorld(parsed.leagueId, parsed.teams)
  const completedLeagueRound = Math.max(0, Math.min(getSeasonRoundCount(parsed), parsed.round - 1))
  const fallbackCurrentDate = completedLeagueRound > 0
    ? getLocalDateKey(getLeagueRoundDate(
      parsed.season,
      completedLeagueRound,
      getLeagueTier(parsed.leagueId),
      getSeasonRoundCount(parsed),
      getGameMatchupsPerOpponent(parsed),
    ))
    : undefined
  const worldAsOfDate = parsed.currentDate ?? fallbackCurrentDate
  if (worldAsOfDate) simulateLeagueWorldThroughDate(currentWorld, parsed.leagueId, parsed.season, worldAsOfDate)
  const world = parsed.leagueWorld ?? currentWorld
  for (const [leagueId, teams] of Object.entries(currentWorld)) {
    world[leagueId] ??= teams
  }
  if (worldAsOfDate) {
    for (const [leagueId, teams] of Object.entries(world)) {
      if (leagueId === parsed.leagueId) continue
      const tier = getLeagueTier(leagueId as LeagueId)
      const roundsDue = getLeagueRoundsThroughDate(parsed.season, teams, tier, worldAsOfDate)
      const playedRounds = Math.max(0, ...teams.map((team) => team.played))
      if (playedRounds > roundsDue) world[leagueId] = teams.map((team) => resetTeam(team))
    }
    simulateLeagueWorldThroughDate(world, parsed.leagueId, parsed.season, worldAsOfDate)
  }
  parsed.leagueWorld = world
  parsed.teams.forEach((team) => {
    team.regionId ??= resolveClubRegion(team.name, parsed.leagueId, parsed.city)
  })
  Object.entries(parsed.leagueWorld).forEach(([leagueId, teams]) => {
    teams.forEach((team) => {
      team.regionId ??= resolveClubRegion(team.name, leagueId)
    })
  })
  parsed.leagueWorld[parsed.leagueId] = parsed.teams.map((team) => ({ ...team }))
  parsed.polishCup ??= makePolishCup(parsed)
  rescheduleUnplayedCupMatches(
    parsed.polishCup.matches,
    parsed.polishCup.season,
    parsed.polishCup.scheduleStage,
    parsed.currentDate,
    0,
    parsed,
  )
  parsed.regionalCups?.forEach((cup) => {
    const regionOffset = Math.max(0, regionalOptions.findIndex((region) => region.id === cup.regionId))
    rescheduleUnplayedCupMatches(cup.matches, cup.season, cup.stageId, parsed.currentDate, regionOffset, parsed)
  })
  rescheduleCupMatchesOnHolidays(parsed, [
    ...(parsed.polishCup.history ?? []),
    ...(parsed.polishCup.matches ?? []),
    ...(parsed.regionalCups ?? []).flatMap((cup) => [...cup.history, ...cup.matches]),
  ])
  parsed.polishCup.scheduledAfterLeagueRound ??= Math.min(
    getSeasonRoundCount(parsed),
    Math.max(2, parsed.round),
  )
  const officialMatchesPlayed = [
    ...parsed.matches,
    ...(parsed.polishCup.history ?? []),
    ...(parsed.regionalCups ?? []).flatMap((cup) => cup.history),
  ].some((match) =>
    match.played && !match.bye && (match.homeId === parsed.teamId || match.awayId === parsed.teamId),
  )
  const firstOfficialDate = [
    ...parsed.matches,
    ...parsed.polishCup.matches,
    ...(parsed.regionalCups ?? []).flatMap((cup) => cup.matches),
  ]
    .filter((match) => !match.played && !match.bye && (match.homeId === parsed.teamId || match.awayId === parsed.teamId))
    .map((match) => match.scheduledAt)
    .filter((date): date is string => Boolean(date))
    .sort()[0]
  const currentDate = parsed.currentDate ?? `${parsed.season.split('/')[0]}-06-01`
  if (
    !parsed.preseasonFriendlies?.length
    && parsed.round === 1
    && !officialMatchesPlayed
    && firstOfficialDate
    && currentDate < firstOfficialDate
  ) {
    parsed.preseasonFriendlies = createPreseasonFriendlies(parsed)
  }
  if (
    parsed.polishCup.centralSeason
    && parsed.polishCup.stage !== 'complete'
    && getLeagueTier(parsed.leagueId) === 1
    && ![...parsed.polishCup.history, ...parsed.polishCup.matches].some((match) =>
      match.homeId === parsed.teamId || match.awayId === parsed.teamId,
    )
  ) {
    const strandedBye = parsed.polishCup.matches.find((match) => !match.played && match.bye && match.homeId !== parsed.teamId)
    if (strandedBye) {
      strandedBye.bye = false
      strandedBye.awayId = parsed.teamId
      strandedBye.competitionId = 'polish-cup'
      parsed.polishCup.participants = [...new Set([...parsed.polishCup.participants, parsed.teamId])]
    }
  }
  parsed.localReputation ??= 35
  const refreshedCommercialOffers = createCommercialOffers(
    parsed.leagueId,
    overallRating(parsed.squad),
    getClubReputation(parsed),
    getSeasonRoundCount(parsed),
    parsed.localReputation,
  )
  parsed.commercialOffers = {
    sponsors: refreshedCommercialOffers.sponsors.map((offer) => {
      const savedOffer = parsed.commercialOffers?.sponsors.find((existing) => existing.id === offer.id)
      return savedOffer
        ? { ...offer, signingBonus: savedOffer.signingBonus, paymentPerMatch: savedOffer.paymentPerMatch }
        : offer
    }),
    tv: refreshedCommercialOffers.tv.map((offer) => {
      const savedOffer = parsed.commercialOffers?.tv.find((existing) => existing.id === offer.id)
      return savedOffer
        ? { ...offer, signingBonus: savedOffer.signingBonus, paymentPerMatch: savedOffer.paymentPerMatch }
        : offer
    }),
  }
  parsed.sponsorDeal ??= null
  parsed.tvDeal ??= null
  parsed.sponsorRequired ??= parsed.round === 1 && !parsed.sponsorDeal
  parsed.negotiatedSponsorOfferIds ??= []
  parsed.facilities ??= { stand: 0, catering: 0, academy: 0, training: 0 }
  parsed.facilities.training ??= 0
  parsed.facilityConstruction ??= null
  parsed.academyProspect ??= null
  parsed.academyPlayers ??= []
  parsed.followers ??= 12_000
  parsed.totalHomeAttendance ??= 0
  parsed.homeMatchesPlayed ??= 0
  parsed.mediaPosts ??= []
  parsed.inboxMessages ??= []
  parsed.seasonHistory ??= []
  parsed.trophyCabinet ??= []
  parsed.clubRivalries ??= summarizeClubRivalriesFromMatches(parsed)
  parsed.clubRivalries.forEach((rivalry) => {
    rivalry.recentMatches ??= []
    rivalry.lastMatchCompetition ??= 'league'
  })
  parsed.managerCareer ??= summarizeManagerCareer(parsed.seasonHistory)
  parsed.managerCareer.completedSeasons ??= 0
  parsed.managerCareer.leagueMatches ??= 0
  parsed.managerCareer.leagueWins ??= 0
  parsed.managerCareer.promotions ??= 0
  parsed.managerCareer.leagueTitles ??= 0
  parsed.managerCareer.academyDebuts ??= 0
  parsed.managerCareer.leagueGoals ??= 0
  if (parsed.championsCupMatch) parsed.championsCupMatch.season ??= parsed.season
  parsed.boardConfidence ??= 65
  parsed.boardHistory ??= []
  parsed.claimedClubChallengeIds ??= []
  parsed.sponsorWinStreak ??= 0
  parsed.sponsorLossStreak ??= 0
  parsed.sponsorWarningIssued ??= false
  parsed.debt ??= Math.max(0, Math.round(-parsed.cash))
  parsed.nextDebtSanctionAt = 1_000_000
  parsed.finances ??= []
  if (parsed.pendingForcedRelegation) {
    parsed.pendingLeaguePointDeduction = (parsed.pendingLeaguePointDeduction ?? 0) + 5
  }
  parsed.pendingForcedRelegation = false
  parsed.pendingLeaguePointDeduction ??= 0
  parsed.pendingDebtSettlement ??= parsed.pendingLeaguePointDeduction > 0 && parsed.debt > 0
  parsed.sponsorSigningBonusAvailable ??= parsed.round === 1 && !parsed.sponsorDeal
  parsed.scouts ??= []
  parsed.staff ??= []
  parsed.clubSquads ??= {}
  parsed.transferNegotiations ??= []
  parsed.incomingTransferOffers ??= []
  parsed.outgoingPlayerTransferListings ??= []
  const relevantClubSquadIds = getRelevantClubSquadIds(parsed)
  parsed.clubSquads = Object.fromEntries(
    Object.entries(parsed.clubSquads).filter(([teamId]) => relevantClubSquadIds.has(teamId)),
  )
  const missingLeagueSquads = parsed.teams.filter((team) => team.id !== parsed.teamId && !parsed.clubSquads[team.id])
  if (missingLeagueSquads.length) {
    parsed.clubSquads = {
      ...parsed.clubSquads,
      ...createClubSquads(missingLeagueSquads, parsed.teamId, {}, parsed.season),
    }
  }
  for (const negotiation of parsed.transferNegotiations.slice(0, 10)) {
    if (parsed.inboxMessages.some((message) => message.relatedNegotiationId === negotiation.id)) continue
    const player = negotiation.status === 'accepted'
      ? parsed.squad.find((item) => item.id === negotiation.playerId)
      : parsed.clubSquads[negotiation.clubId]?.find((offer) => offer.player.id === negotiation.playerId)?.player
    if (!player) continue
    const clubName = getTeamName(parsed, negotiation.clubId)
    const status = negotiation.status
    const subject = status === 'accepted'
      ? `Oferta zaakceptowana: ${player.firstName} ${player.lastName}`
      : status === 'countered'
        ? `Kontroferta za ${player.firstName} ${player.lastName}`
        : `Oferta odrzucona: ${player.firstName} ${player.lastName}`
    const body = status === 'accepted'
      ? `${clubName} zaakceptował ofertę w wysokości ${negotiation.offeredAmount.toLocaleString('pl-PL')} zł. Transfer został sfinalizowany.`
      : status === 'countered'
        ? `${clubName} przedstawił kontrofertę w wysokości ${(negotiation.counterAmount ?? 0).toLocaleString('pl-PL')} zł. Możesz ją zaakceptować lub negocjować na rynku transferowym.`
        : `${clubName} odrzucił ofertę w wysokości ${negotiation.offeredAmount.toLocaleString('pl-PL')} zł.`
    addInboxMessage(parsed, clubName, subject, body, status, 'transfer', negotiation.id)
  }
  Object.values(parsed.clubSquads).forEach((offers) => {
    offers.forEach((offer) => migratePlayerPosition(offer.player))
    assignMissingSquadNumbers(offers.map(({ player }) => player))
    offers.forEach((offer) => {
      offer.player.relegationReleaseClause ??= false
      offer.player.seasonAppearances ??= 0
      offer.player.seasonGoals ??= 0
      offer.player.seasonAssists ??= 0
      offer.player.seasonCleanSheets ??= 0
      offer.player.seasonRatingTotal ??= 0
      offer.player.seasonRatedAppearances ??= 0
      offer.player.careerLeagueAndCupGoals ??= offer.player.careerGoals ?? offer.player.seasonGoals ?? 0
    })
  })
  parsed.squad.forEach(migratePlayerPosition)
  assignMissingSquadNumbers(parsed.squad)
  parsed.teamChemistry ??= createTeamChemistry(parsed.squad)
  parsed.squad.forEach((player) => {
    player.relegationReleaseClause ??= false
    player.seasonAppearances ??= 0
    player.seasonGoals ??= 0
    player.seasonAssists ??= 0
    player.seasonCleanSheets ??= 0
    player.seasonRatingTotal ??= 0
    player.seasonRatedAppearances ??= 0
    player.cupAppearances ??= 0
    player.cupGoals ??= 0
    player.careerAppearances ??= player.seasonAppearances
    player.careerGoals ??= player.seasonGoals
    player.careerLeagueAndCupGoals ??= player.careerGoals
    player.contractSeasonsRemaining ??= 2
    player.moralePromise ??= null
    player.transferRequest ??= false
    if (player.trainingPlan) player.trainingPlanSessions ??= 0
  })
  parsed.loanDeals ??= []
  parsed.pressConferenceHistory ??= []
  for (const match of [...parsed.polishCup.matches, ...parsed.polishCup.history]) {
    if (match.stage) continue
    const inferredStage = match.id.match(/^polish-cup-(regional|third|second|first|ekstraklasa|national)-(\d+)-/)
    match.stage = inferredStage?.[1] as PolishCupMatch['stage'] | undefined
      ?? (parsed.polishCup.stage === 'complete' ? 'national' : parsed.polishCup.stage)
  }
  parsed.boardGoal ??= createBoardGoal(parsed.leagueId, parsed.teams, parsed.teamId, parsed.season, parsed.cash)
  parsed.market.forEach((player) => {
    migratePlayerPosition(player)
    player.contractSeasonsRemaining ??= 2
    player.relegationReleaseClause ??= false
  })
  Object.values(parsed.clubSquads).forEach((offers) => offers.forEach(({ player }) => {
    player.contractSeasonsRemaining ??= 2
    player.relegationReleaseClause ??= false
  }))
  parsed.academyPlayers?.forEach((player) => {
    player.relegationReleaseClause ??= false
  })
  if (parsed.academyProspect) parsed.academyProspect.relegationReleaseClause ??= false
  parsed.scouts.forEach((scout) => {
    if (scout.prospect) scout.prospect.relegationReleaseClause ??= false
  })
  parsed.scouts.forEach((scout) => {
    if (scout.prospect) migratePlayerPosition(scout.prospect)
  })
  if (parsed.academyProspect) migratePlayerPosition(parsed.academyProspect)
  parsed.academyPlayers.forEach((player) => {
    migratePlayerPosition(player)
    player.contractSeasonsRemaining ??= 2
  })
  parsed.matches.forEach((match) => {
    match.competitionId ??= 'league'
    match.disciplinaryEvents ??= []
  })
  if (parsed.teams.some((team) => team.yellowCards === undefined || team.redCards === undefined || team.fairPlayPoints === undefined)) {
    parsed.teams.forEach((team) => {
      team.yellowCards = 0
      team.redCards = 0
      team.fairPlayPoints = 0
    })
    const currentTeamIds = new Set(parsed.teams.map((team) => team.id))
    for (const match of parsed.matches) {
      if (!match.played || match.bye || match.competitionId !== 'league') continue
      for (const team of parsed.teams) {
        if (team.id !== match.homeId && team.id !== match.awayId) continue
        recordTeamDiscipline(
          team,
          (match.disciplinaryEvents ?? []).filter((event) => !event.teamId || event.teamId === team.id),
        )
      }
    }
    for (const team of Object.values(parsed.leagueWorld).flat()) {
      if (!currentTeamIds.has(team.id)) {
        team.yellowCards ??= 0
        team.redCards ??= 0
        team.fairPlayPoints ??= 0
      }
    }
  }
  if (parsed.teams.some((team) => !team.headToHead)) {
    parsed.teams.forEach((team) => { team.headToHead = {} })
    const currentTeamIds = new Set(parsed.teams.map((team) => team.id))
    for (const match of parsed.matches) {
      if (
        !match.played
        || match.bye
        || match.competitionId !== 'league'
        || match.homeGoals === undefined
        || match.awayGoals === undefined
        || !currentTeamIds.has(match.homeId)
        || !currentTeamIds.has(match.awayId)
      ) continue
      const home = parsed.teams.find((team) => team.id === match.homeId)
      const away = parsed.teams.find((team) => team.id === match.awayId)
      if (home && away) recordHeadToHead(home, away, match.homeGoals, match.awayGoals)
    }
    parsed.leagueWorld[parsed.leagueId] = parsed.teams.map((team) => ({ ...team }))
  }
  parsed.matchLineupIds ??= [...parsed.lineupIds]
  parsed.matchBenchIds ??= parsed.squad
    .filter((player) => !parsed.matchLineupIds.includes(player.id))
    .sort((first, second) => second.skill - first.skill)
    .slice(0, 7)
    .map((player) => player.id)
  parsed.previousMatchLineupIds ??= []
  parsed.previousMatchBenchIds ??= []
  const squadIds = new Set(parsed.squad.map((player) => player.id))
  parsed.matchOutsideSquadIds = [...new Set(parsed.matchOutsideSquadIds ?? [])]
    .filter((id) => squadIds.has(id))
  parsed.matchLineupIds = [...new Set(parsed.matchLineupIds)].filter((id) => squadIds.has(id))
  parsed.matchLineupIds = normalizeStartingGoalkeepers(parsed.squad, parsed.matchLineupIds, new Set(parsed.matchOutsideSquadIds))
  const defaultSpecialRoles = autoAssignPlayerSpecialRoles(parsed.squad, parsed.matchLineupIds)
  const savedSpecialRoles = parsed.playerSpecialRoles ?? defaultSpecialRoles
  const captainId = squadIds.has(savedSpecialRoles.captain ?? '') ? savedSpecialRoles.captain : defaultSpecialRoles.captain
  parsed.playerSpecialRoles = {
    captain: captainId,
    viceCaptain: squadIds.has(savedSpecialRoles.viceCaptain ?? '') && savedSpecialRoles.viceCaptain !== captainId
      ? savedSpecialRoles.viceCaptain
      : defaultSpecialRoles.viceCaptain !== captainId ? defaultSpecialRoles.viceCaptain : null,
    penaltyTaker: squadIds.has(savedSpecialRoles.penaltyTaker ?? '') ? savedSpecialRoles.penaltyTaker : defaultSpecialRoles.penaltyTaker,
    freeKickTaker: squadIds.has(savedSpecialRoles.freeKickTaker ?? '') ? savedSpecialRoles.freeKickTaker : defaultSpecialRoles.freeKickTaker,
    cornerTaker: squadIds.has(savedSpecialRoles.cornerTaker ?? '') ? savedSpecialRoles.cornerTaker : defaultSpecialRoles.cornerTaker,
  }
  if (parsed.matchLineupPositions) {
    if (parsed.matchLineupPositions.formation !== parsed.tactics.formation) {
      delete parsed.matchLineupPositions
    } else {
      const formationSlotsCount = formationPositionOrders[parsed.tactics.formation].length
      parsed.matchLineupPositions.slots = Object.fromEntries(
        Object.entries(parsed.matchLineupPositions.slots).filter(([slotIndex, playerId]) =>
          Number.isInteger(Number(slotIndex))
          && Number(slotIndex) >= 0
          && Number(slotIndex) < formationSlotsCount
          && parsed.matchLineupIds.includes(playerId),
        ),
      )
    }
  }
  parsed.matchBenchIds = [...new Set(parsed.matchBenchIds)].filter((id) => squadIds.has(id) && !parsed.matchLineupIds.includes(id)).slice(0, 7)
  parsed.matchOutsideSquadIds = parsed.matchOutsideSquadIds
    .filter((id) => !parsed.matchLineupIds.includes(id) && !parsed.matchBenchIds.includes(id))
  parsed.previousMatchLineupIds = [...new Set(parsed.previousMatchLineupIds)].filter((id) => squadIds.has(id))
  if (parsed.previousMatchLineupIds.length) {
    parsed.previousMatchLineupIds = normalizeStartingGoalkeepers(parsed.squad, parsed.previousMatchLineupIds)
  }
  parsed.previousMatchBenchIds = [...new Set(parsed.previousMatchBenchIds)].filter((id) => squadIds.has(id) && !parsed.previousMatchLineupIds.includes(id)).slice(0, 7)
  if (parsed.pendingMatchEvent) {
    parsed.pendingMatchEvent.substitutionsUsed ??= 0
    parsed.pendingMatchEvent.substitutedPlayerIds ??= []
    parsed.pendingMatchEvent.substitutePlayerIds ??= []
    parsed.pendingMatchEvent.substitutedPlayerIds = [...new Set(parsed.pendingMatchEvent.substitutedPlayerIds)].filter((id) => squadIds.has(id))
    parsed.pendingMatchEvent.substitutePlayerIds = [...new Set(parsed.pendingMatchEvent.substitutePlayerIds)].filter((id) => squadIds.has(id))
  }
  parsed.tactics ??= { formation: '4-2-3-1', style: 'balanced', pressing: 'normal' }
  if (!['4-3-3', '4-4-2', '4-2-3-1', '3-5-2', '3-4-3', '5-3-2', '4-1-4-1', '4-3-2-1'].includes(parsed.tactics.formation)) parsed.tactics.formation = '4-2-3-1'
  if (!['balanced', 'attacking', 'counter'].includes(parsed.tactics.style)) parsed.tactics.style = 'balanced'
  if (!['low', 'normal', 'high'].includes(parsed.tactics.pressing)) parsed.tactics.pressing = 'normal'
  parsed.lastMatchReport ??= null
  if (parsed.mediaPosts.length === 0) {
    addMediaPost(parsed, 'KLUB', `Dziennikarze wracają do ${parsed.clubName}`, `Rozpoczyna się sezon ${parsed.season}. Redakcja będzie śledzić wyniki, transfery i decyzje zarządu.`)
  }
  scheduleLeagueFixtures(parsed)
  rescheduleUnplayedPromotionPlayoffs(parsed)
  const fillInTeam = parsed.teams.find((team) => team.id === 'league-fill-in')
  if (fillInTeam) fillInTeam.name = 'KS Nadwiślan Nowogród'
  const upcomingMatch = getNextScheduledCompetition(parsed) === 'polish-cup'
    ? getPolishCupNextMatch(parsed)
    : parsed.matches.find((match) =>
      match.round === parsed.round && (match.homeId === parsed.teamId || match.awayId === parsed.teamId),
    )
  if (upcomingMatch && !parsed.pendingMatchEvent) {
    const selection = completeMatchSquad(parsed, parsed.matchLineupIds, parsed.matchBenchIds, upcomingMatch.competitionId ?? 'league')
    parsed.matchLineupIds = selection.starters
    parsed.matchBenchIds = selection.bench
  }
  ensureUniqueGamePlayerNames(parsed)
  return parsed
}

export function loadSavedGame(): GameState | null {
  const activeSlot = localStorage.getItem('polski-manager-active-slot')
  const slotIds = ['slot-1', 'slot-2', 'slot-3']
  const orderedSlots = activeSlot && slotIds.includes(activeSlot)
    ? [activeSlot, ...slotIds.filter((slotId) => slotId !== activeSlot)]
    : slotIds
  const saved = orderedSlots
    .map((slotId) => localStorage.getItem(`polski-manager-save-${slotId}`))
    .find((value) => value !== null)
    ?? localStorage.getItem('polski-manager-save')
  if (!saved) return null
  return loadGameFromJSON(saved)
}

export { formationPositions }
