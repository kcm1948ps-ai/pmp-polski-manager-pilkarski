import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'

const vite = await createServer({
  configFile: false,
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true },
})
after(() => vite.close())

const {
  createGame,
  renameCareerClub,
  clubsByLeague,
  leagues,
  getRegionsForLeague,
  estimateAttendance,
  getDerbyKind,
  getClubChallenges,
  getClubRivalries,
  getClubRivalryLevel,
  getLeagueChampionTrophyName,
  getLeagueTableZones,
  getSeasonAwards,
  getTeamName,
  getSeasonRoundCount,
  getSeasonTeamOfSeason,
  isLocalDerby,
  saveDerbyMatchAction,
  claimClubChallengeRewards,
  getManagerCareerProfile,
  loadGameFromJSON,
  getNextScheduledCompetition,
  publishPolishCupDrawIfDue,
  getTransferWindowInfo,
  recordClubRivalryMatch,
  playChampionsCupMatch,
  playMatchday,
  playPolishCupRound,
  playPmpLeagueEvent,
  playPromotionPlayoffRound,
  resolvePlayerStory,
  resolveSeasonEvent,
  proposeClubTransfer,
  respondToClubTransferCounteroffer,
  acceptClubTransferCounteroffer,
  respondToIncomingTransferOffer,
  sellPlayer,
  createAiIncomingTransferOffer,
  resolveIncomingTransferOfferDeadlines,
  offerPlayerToClubs,
  withdrawOutgoingPlayerTransferListing,
  simulateCalendarDay,
  startNewSeason,
} = await vite.ssrLoadModule('/src/game.ts')
const {
  parseClubDatabase,
  saveActiveClubDatabase,
  findImportedClubByName,
} = await vite.ssrLoadModule('/src/clubDatabase.ts')
const { continueLiveMatchIncidents } = await vite.ssrLoadModule('/src/liveMatchPlayback.ts')

const initialGame = createGame('Testowy Klub', 'Warszawa', 'ekstraklasa', '#123456')
const opponentTeams = initialGame.teams.filter((team) => team.id !== initialGame.teamId)
const [firstOpponent, secondOpponent, thirdOpponent] = opponentTeams

test('renaming a rival club updates every competition and keeps its original identity', () => {
  const game = createGame('Testowy Klub', 'Warszawa', 'fourth-mazowieckie', '#123456')
  const target = game.teams.find((team) => team.id !== game.teamId)
  assert.ok(target)
  const originalIdentity = target.customizationIdentity
  const originalName = target.name
  const renamed = renameCareerClub(game, target.id, 'Nowa nazwa klubu')
  assert.equal(renamed.error, '')
  assert.equal(renamed.game.teams.find((team) => team.id === target.id)?.name, 'Nowa nazwa klubu')
  assert.equal(renamed.game.leagueWorld[game.leagueId].find((team) => team.id === target.id)?.name, 'Nowa nazwa klubu')
  assert.equal(renamed.game.polishCup.teams.find((team) => team.id === target.id)?.name, 'Nowa nazwa klubu')
  assert.equal(renamed.game.regionalCups.some((cup) => cup.teams.some((team) => team.id === target.id && team.name === 'Nowa nazwa klubu')), true)
  assert.equal(renamed.game.teams.find((team) => team.id === target.id)?.customizationIdentity, originalIdentity)
  assert.equal(renamed.game.teams.find((team) => team.id === target.id)?.customizationOriginalName, originalName)
  assert.equal(renameCareerClub(renamed.game, target.id, originalName).game.teams.find((team) => team.id === target.id)?.name, originalName)
})

test('team names resolve across regional cups and PMP League', () => {
  const game = createGame('Testowy Klub', 'Warszawa', 'ekstraklasa', '#123456')
  const regionalTeamId = 'regional-team-id'
  const pmpTeamId = 'pmp-team-id'
  game.regionalCups = [{
    season: game.season,
    regionId: 'mazowieckie',
    stageId: 'central-preliminary',
    teams: [{
      id: regionalTeamId,
      name: 'Regionalny Klub',
      customizationIdentity: 'regionalny-klub|mazowieckie',
      customizationOriginalName: 'Regionalny Klub',
      strength: 68,
      leagueId: 'fourth',
      regionId: 'mazowieckie',
    }],
    participants: [regionalTeamId],
    matches: [],
    history: [],
  }]
  game.pmpLeague = {
    season: game.season,
    phase: 'groups',
    startAt: '2026-07-01',
    teams: [{
      id: pmpTeamId,
      name: 'PMP Klub',
      customizationIdentity: 'pmp-klub|region-1',
      customizationOriginalName: 'PMP Klub',
      strength: 70,
      leagueId: 'first',
      regionId: 'region-1',
    }],
    groups: [],
    matches: [],
    history: [],
    regionalChampions: {},
  }
  assert.equal(getTeamName(game, regionalTeamId), 'Regionalny Klub')
  assert.equal(getTeamName(game, pmpTeamId), 'PMP Klub')
})

test('imported club lookup normalizes names, accents and repeated spaces', () => {
  const packageData = {
    format: 'pmp27-club-database',
    version: 1,
    name: 'Testowa baza',
    leagues: [{
      id: 'ekstraklasa',
      clubs: [{
        id: 'club-1',
        name: 'ŁKS Łódź',
        city: 'Łódź',
        crestDataUrl: 'data:image/png;base64,AA==',
        players: Array.from({ length: 11 }, (__, playerIndex) => ({
          id: `player-${playerIndex}`,
          firstName: `Zawodnik${playerIndex}`,
          lastName: 'Test',
          age: 24,
          position: ['BR', 'PO', 'ŚO', 'LO', 'DP', 'ŚP', 'OP', 'PP', 'LP', 'PN', 'LN'][playerIndex],
          skill: 60,
          potential: 70,
        })),
      }],
    }],
  }
  const database = parseClubDatabase(
    JSON.stringify(packageData),
    ['ekstraklasa'],
    { ekstraklasa: 1 },
    { ekstraklasa: getRegionsForLeague('ekstraklasa') },
  )
  const found = findImportedClubByName(database, 'ekstraklasa', '  lks    lodz  ')
  assert.equal(found?.name, 'ŁKS Łódź')
})

test('imported club database supplies club names, rosters and crests to new careers', () => {
  const packageData = {
    format: 'pmp27-club-database',
    version: 1,
    name: 'Testowa baza',
    leagues: [{
      id: 'ekstraklasa',
      clubs: clubsByLeague.ekstraklasa.map((_, clubIndex) => ({
        id: `club-${clubIndex}`,
        name: `Importowany klub ${clubIndex}`,
        city: `Miasto ${clubIndex}`,
        crestDataUrl: 'data:image/png;base64,AA==',
        players: Array.from({ length: 11 }, (__, playerIndex) => ({
          id: `player-${playerIndex}`,
          firstName: `Zawodnik${playerIndex}`,
          lastName: `Test${clubIndex}`,
          age: 24,
          position: ['BR', 'PO', 'ŚO', 'LO', 'DP', 'ŚP', 'OP', 'PP', 'LP', 'PN', 'LN'][playerIndex],
          skill: 60,
          potential: 70,
        })),
      })),
    }],
  }
  const availableLeagues = leagues.filter((league) => league.selectable !== false)
  const database = parseClubDatabase(
    JSON.stringify(packageData),
    availableLeagues.map((league) => league.id),
    Object.fromEntries(availableLeagues.map((league) => [league.id, clubsByLeague[league.id].length])),
    Object.fromEntries(availableLeagues.map((league) => [league.id, getRegionsForLeague(league.id)])),
  )
  const originalStorage = globalThis.localStorage
  const storedValues = new Map()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => storedValues.get(key) ?? null,
      setItem: (key, value) => storedValues.set(key, String(value)),
      removeItem: (key) => storedValues.delete(key),
    },
  })
  try {
    saveActiveClubDatabase(database)
    const game = createGame('Importowany klub 0', 'Miasto 0', 'ekstraklasa', '#123456', 'existing', undefined, database)
    assert.equal(game.clubDatabaseId, database.id)
    assert.equal(game.teams[0].name, 'Importowany klub 0')
    assert.equal(game.squad[0].firstName, 'Zawodnik0')
    assert.equal(game.clubCrestDataUrl, 'data:image/png;base64,AA==')
    assert.equal(game.clubSquads['database-team-club-1'][0].player.lastName, 'Test1')
    const restored = loadGameFromJSON(JSON.stringify(game))
    assert.equal(restored?.clubDatabaseId, database.id)
    assert.equal(restored?.clubCrestsByTeamId?.['database-team-club-1'], 'data:image/png;base64,AA==')
  } finally {
    if (originalStorage === undefined) delete globalThis.localStorage
    else Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: originalStorage })
  }
})

function createCompetitionGame() {
  const game = structuredClone(initialGame)
  game.round = 1
  game.sponsorRequired = false
  game.polishCup.stage = 'complete'
  game.polishCup.matches = []
  game.polishCup.history = []
  game.regionalCups = []
  game.preseasonFriendlies = []
  game.championsCupMatch = undefined
  game.pmpLeague = undefined
  game.promotionPlayoffs = undefined
  game.pendingMatchEvent = undefined
  return game
}

function getCupTeam(game, team) {
  return {
    id: team.id,
    name: team.name,
    strength: team.strength,
    leagueId: game.leagueId,
    regionId: team.regionId,
  }
}

test('calendar advances one day at a time and rejects skipped dates', () => {
  const game = createCompetitionGame()
  const [year, month, day] = game.currentDate.split('-').map(Number)
  const nextDate = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10)
  const skippedDate = new Date(Date.UTC(year, month - 1, day + 2)).toISOString().slice(0, 10)

  const nextDay = simulateCalendarDay(game, nextDate)
  assert.equal(nextDay.error, '')
  assert.equal(nextDay.game.currentDate, nextDate)

  const skippedDay = simulateCalendarDay(game, skippedDate)
  assert.notEqual(skippedDay.error, '')
  assert.equal(skippedDay.game, game)
})

test('Polish Cup fixtures are not simulated on or before their draw date', () => {
  const game = createCompetitionGame()
  game.round = getSeasonRoundCount(game) + 1
  game.currentDate = '2026-06-14'
  game.polishCup.stage = 'third'
  game.polishCup.scheduleStage = 'central-preliminary'
  game.polishCup.drawAt = '2026-06-15'
  game.polishCup.matches = [{
    id: 'test-polish-cup-draw-date',
    stage: 'third',
    round: 1,
    scheduledAt: '2026-06-15',
    homeId: game.teamId,
    awayId: firstOpponent.id,
    played: false,
    competitionId: 'polish-cup',
  }]

  assert.notEqual(getNextScheduledCompetition(game), 'polish-cup')

  const published = publishPolishCupDrawIfDue(game, game.polishCup.drawAt)
  assert.ok(published)
  assert.equal(published.polishCup.matches[0].scheduledAt, '2026-06-16')
  assert.equal(published.inboxMessages.at(-1).polishCupDraw.fixtures[0].date, '2026-06-16')
  published.currentDate = '2026-06-15'
  assert.equal(getNextScheduledCompetition(published), 'polish-cup')
})

test('regional Polish Cup includes lower-league clubs in their regional bracket', () => {
  const game = createGame('Testowy Klub', 'Opole', 'opolskie-b-1', '#123456')
  const cup = game.regionalCups.find((regionalCup) => regionalCup.regionId === 'fourth-opolskie')

  assert.ok(cup)
  assert.ok(cup.teams.some((team) => team.id === game.teamId))
  assert.ok(cup.participants.includes(game.teamId))
  assert.ok(cup.matches.length > 0)
  assert.ok(cup.matches.every((match) => match.scheduledAt))
})

test('Lubuskie league groups expose promotions and relegations throughout the regional pyramid', () => {
  const game = createGame('Testowy Klub', 'Zielona Góra', 'fourth-lubuskie', '#123456')
  const thirdTeams = game.leagueWorld['third-3']
  thirdTeams.forEach((team, index) => {
    team.points = thirdTeams.length - index
    team.regionId = 'fourth-dolnoslaskie'
  })
  thirdTeams.slice(-4).forEach((team, index) => {
    team.points = 4 - index
    if (index < 2) team.regionId = 'fourth-lubuskie'
  })
  const fourthTeams = game.leagueWorld['fourth-lubuskie']
  fourthTeams.forEach((team, index) => {
    team.points = fourthTeams.length - index
  })
  fourthTeams.slice(-5, -3).forEach((team, index) => {
    team.name = `Testowy klub Zielona Góra ${index + 1}`
  })
  const aGroupIds = Object.keys(game.leagueWorld).filter((leagueId) => leagueId.startsWith('lubuskie-a-'))
  aGroupIds.forEach((leagueId) => {
    const teams = game.leagueWorld[leagueId]
    teams.forEach((team, index) => {
      team.points = teams.length - index
      team.goalsFor = 0
      team.goalsAgainst = 0
    })
  })
  const a4NextRelegation = game.leagueWorld['lubuskie-a-4'][11]
  a4NextRelegation.points = 3
  a4NextRelegation.goalsAgainst = 1
  game.leagueWorld['lubuskie-a-3'][11].points = 3
  game.leagueWorld['lubuskie-a-3'][11].goalsFor = 10
  game.leagueWorld['lubuskie-a-5'][10].points = 3
  const fourthZones = getLeagueTableZones(game)
  assert.deepEqual(fourthZones.relegationRanks, [18, 17, 16, 15, 14])

  for (const leagueId of ['lubuskie-okr-1', 'lubuskie-okr-2']) {
    const zones = getLeagueTableZones({
      ...game,
      leagueId,
      teams: game.leagueWorld[leagueId],
    })
    assert.deepEqual(zones.directPromotionRanks, [1, 2])
  }
  const okregowaZones = ['lubuskie-okr-1', 'lubuskie-okr-2'].map((leagueId) => getLeagueTableZones({
    ...game,
    leagueId,
    teams: game.leagueWorld[leagueId],
  }))
  assert.equal(okregowaZones.reduce((count, zones) => count + zones.relegationRanks.length, 0), 5)

  const bGroupIds = Object.keys(game.leagueWorld).filter((leagueId) => leagueId.startsWith('lubuskie-b-'))
  assert.equal(aGroupIds.length, 5)
  assert.equal(bGroupIds.length, 9)

  const aZones = aGroupIds.map((leagueId) => getLeagueTableZones({
    ...game,
    leagueId,
    teams: game.leagueWorld[leagueId],
  }))
  const bZones = bGroupIds.map((leagueId) => getLeagueTableZones({
    ...game,
    leagueId,
    teams: game.leagueWorld[leagueId],
  }))
  assert.equal(aZones.reduce((count, zones) => count + zones.directPromotionRanks.length, 0), 7)
  assert.equal(aZones.reduce((count, zones) => count + zones.relegationRanks.length, 0), 10)
  assert.ok(aZones.every((zones, index) => zones.relegationRanks.length >= (index < 2 ? 1 : 2)))
  for (const [leagueId, extraRank] of [['lubuskie-a-4', 12], ['lubuskie-a-5', 11]]) {
    const zones = getLeagueTableZones({
      ...game,
      leagueId,
      teams: game.leagueWorld[leagueId],
    })
    assert.ok(zones.relegationRanks.includes(extraRank))
  }
  thirdTeams.slice(-4).forEach((team) => {
    team.regionId = 'fourth-dolnoslaskie'
  })
  assert.deepEqual(getLeagueTableZones(game).relegationRanks, [18, 17, 16])
  const baselineOkrRelegations = ['lubuskie-okr-1', 'lubuskie-okr-2'].reduce((count, leagueId) =>
    count + getLeagueTableZones({ ...game, leagueId, teams: game.leagueWorld[leagueId] }).relegationRanks.length,
  0)
  const baselineARelegations = aGroupIds.reduce((count, leagueId) =>
    count + getLeagueTableZones({ ...game, leagueId, teams: game.leagueWorld[leagueId] }).relegationRanks.length,
  0)
  assert.equal(baselineOkrRelegations, 3)
  assert.equal(baselineARelegations, 8)
  assert.equal(bZones.reduce((count, zones) => count + zones.directPromotionRanks.length, 0), 12)
  assert.ok(bZones.every((zones) => zones.relegationRanks.length === 0))

  for (const [leagueId, teams] of Object.entries(game.leagueWorld)) {
    if (leagueId.startsWith('lubuskie-a-')) {
      assert.equal(teams.length, leagueId === 'lubuskie-a-5' ? 13 : 14)
    }
  }
})

test('Opolskie table zones follow the 2026/27 promotion and relegation rules', () => {
  const game = createGame('Testowy Klub', 'Opole', 'fourth-opolskie', '#123456')
  const world = game.leagueWorld
  for (const teams of Object.values(world)) {
    teams.forEach((team, index) => {
      team.points = teams.length - index
    })
  }
  game.teams.forEach((team, index) => {
    team.points = game.teams.length - index
  })
  world['third-3'].slice(-4).forEach((team) => {
    team.regionId = 'fourth-dolnoslaskie'
  })

  const fourthZones = getLeagueTableZones(game)
  assert.deepEqual(fourthZones.directPromotionRanks, [1])
  assert.deepEqual(fourthZones.playoffRanks, [2])
  assert.deepEqual(
    fourthZones.relegationRanks,
    [game.teams.length, game.teams.length - 1, game.teams.length - 2],
  )

  for (const leagueId of ['opolskie-okr-1', 'opolskie-okr-2']) {
    const zones = getLeagueTableZones({ ...game, leagueId, teams: world[leagueId] })
    assert.deepEqual(zones.directPromotionRanks, [1, 2])
    assert.deepEqual(zones.relegationRanks, [world[leagueId].length, world[leagueId].length - 1, world[leagueId].length - 2])
    assert.deepEqual(zones.maintenancePlayoffRanks, [13])
  }

  for (const leagueId of ['opolskie-a-1', 'opolskie-a-2', 'opolskie-a-3', 'opolskie-a-4']) {
    const zones = getLeagueTableZones({ ...game, leagueId, teams: world[leagueId] })
    assert.deepEqual(zones.directPromotionRanks, [1, 2])
    assert.deepEqual(zones.relegationRanks, [world[leagueId].length, world[leagueId].length - 1, world[leagueId].length - 2])
  }

  const bGroups = Object.keys(world).filter((leagueId) => leagueId.startsWith('opolskie-b-'))
  assert.equal(bGroups.length, 13)
  for (const leagueId of bGroups) {
    const zones = getLeagueTableZones({ ...game, leagueId, teams: world[leagueId] })
    assert.deepEqual(zones.directPromotionRanks, [1])
  }
})

test('Opolskie relegation playoff is scheduled as a two-legged tie and keeps its winner', () => {
  const game = createGame('Testowy Klub', 'Opole', 'fourth-opolskie', '#123456')
  game.round = getSeasonRoundCount(game) + 1
  game.sponsorRequired = false
  game.polishCup.stage = 'complete'
  game.polishCup.matches = []
  game.polishCup.history = []
  game.regionalCups = []
  game.preseasonFriendlies = []
  game.championsCupMatch = undefined
  game.pmpLeague = undefined
  game.promotionPlayoffs = undefined
  game.leagueWorld['third-3'].forEach((team) => {
    team.regionId = 'fourth-dolnoslaskie'
  })

  const scheduled = startNewSeason(game)
  const firstLeg = scheduled.game.promotionPlayoffs?.fixtures.find((fixture) =>
    fixture.competitionId === 'playoff:opolskie-okr-survival',
  )
  assert.ok(firstLeg, `Schedule error: ${scheduled.error}; fixtures: ${scheduled.game.promotionPlayoffs?.fixtures.map(({ competitionId }) => competitionId).join(', ')}`)
  assert.equal(firstLeg.round, 1)

  const firstResult = playPromotionPlayoffRound(scheduled.game, new Map([[
    firstLeg.id,
    { ...firstLeg, homeGoals: 2, awayGoals: 0, winnerId: firstLeg.homeId },
  ]]))
  assert.equal(firstResult.error, '')
  const returnLeg = firstResult.game.promotionPlayoffs?.fixtures.find((fixture) =>
    fixture.competitionId === firstLeg.competitionId && fixture.round === 2,
  )
  assert.ok(returnLeg)
  assert.equal(returnLeg.homeId, firstLeg.awayId)
  assert.equal(returnLeg.awayId, firstLeg.homeId)

  const finalResult = playPromotionPlayoffRound(firstResult.game, new Map([[
    returnLeg.id,
    { ...returnLeg, homeGoals: 0, awayGoals: 1, winnerId: returnLeg.awayId },
  ]]))
  assert.equal(finalResult.error, '')
  assert.equal(finalResult.game.promotionPlayoffs?.round, 'complete')
  assert.equal(
    finalResult.game.promotionPlayoffs?.promotedByLeague[firstLeg.competitionId],
    firstLeg.homeId,
  )
})

test('Opolskie season rollover applies promotions and relegations across all senior tiers', () => {
  const game = createGame('Testowy Klub', 'Opole', 'fourth-opolskie', '#123456')
  const world = game.leagueWorld
  const originalSizes = Object.fromEntries(
    Object.entries(world).map(([leagueId, teams]) => [leagueId, teams.length]),
  )
  for (const teams of Object.values(world)) {
    teams.forEach((team, index) => {
      team.points = teams.length - index
      team.goalsFor = teams.length - index
      team.goalsAgainst = index
    })
  }
  game.teams.forEach((team, index) => {
    team.points = game.teams.length - index
    team.goalsFor = game.teams.length - index
    team.goalsAgainst = index
  })
  const aGroups = ['opolskie-a-1', 'opolskie-a-2', 'opolskie-a-3', 'opolskie-a-4']
  for (const leagueId of aGroups.slice(1)) {
    world[leagueId][12].points = 5
  }
  world['third-3'].slice(-4).forEach((team, index) => {
    team.regionId = [
      'fourth-dolnoslaskie',
      'fourth-lubuskie',
      'fourth-opolskie',
      'fourth-slaskie',
    ][index]
  })
  const bGroups = Object.keys(world).filter((leagueId) => leagueId.startsWith('opolskie-b-')).sort()
  const bChampions = bGroups.map((leagueId) => world[leagueId][0])
  const aPromotions = aGroups.flatMap((leagueId) => world[leagueId].slice(0, 2))
  const aRelegations = aGroups.flatMap((leagueId) => world[leagueId].slice(-3))
  const extraARelegation = world['opolskie-a-1'][12]
  const okregowaGroups = ['opolskie-okr-1', 'opolskie-okr-2']
  const okregowaPromotions = okregowaGroups.flatMap((leagueId) => world[leagueId].slice(0, 2))
  const okregowaRelegations = okregowaGroups.flatMap((leagueId) => world[leagueId].slice(-4))
  const fourthChampion = game.teams[0]
  const fourthRelegations = game.teams.slice(-4)

  game.round = getSeasonRoundCount(game) + 1
  game.sponsorRequired = false
  game.polishCup.stage = 'complete'
  game.polishCup.matches = []
  game.polishCup.history = []
  game.regionalCups = []
  game.preseasonFriendlies = []
  game.championsCupMatch = undefined
  game.pmpLeague = undefined
  game.promotionPlayoffs = {
    season: game.season,
    round: 'complete',
    fixtures: [],
    history: [],
    promotedByLeague: {},
    leagueWorldFinalized: true,
  }

  const result = startNewSeason(game)
  assert.equal(result.error, '')
  const nextWorld = result.game.leagueWorld

  for (const team of bChampions) {
    assert.ok(aGroups.some((leagueId) => nextWorld[leagueId].some((club) => club.id === team.id)))
  }
  for (const team of aPromotions) {
    assert.ok(okregowaGroups.some((leagueId) => nextWorld[leagueId].some((club) => club.id === team.id)))
  }
  for (const team of [...aRelegations, extraARelegation]) {
    assert.ok(bGroups.some((leagueId) => nextWorld[leagueId].some((club) => club.id === team.id)))
  }
  for (const team of okregowaPromotions) {
    assert.ok(nextWorld['fourth-opolskie'].some((club) => club.id === team.id))
  }
  for (const team of okregowaRelegations) {
    assert.ok(aGroups.some((leagueId) => nextWorld[leagueId].some((club) => club.id === team.id)))
  }
  assert.ok(
    nextWorld['third-3'].some((club) => club.id === fourthChampion.id),
    `Expected ${fourthChampion.id} in third-3; found in ${Object.entries(nextWorld).find(([, clubs]) => clubs.some(({ id }) => id === fourthChampion.id))?.[0] ?? 'none'}`,
  )
  for (const team of fourthRelegations) {
    assert.ok(okregowaGroups.some((leagueId) => nextWorld[leagueId].some((club) => club.id === team.id)))
  }
  for (const [leagueId, size] of Object.entries(originalSizes).filter(([id]) =>
    !aGroups.includes(id) && !bGroups.includes(id) && !id.startsWith('lubuskie-'),
  )) {
    assert.equal(nextWorld[leagueId].length, size, `${leagueId} group size changed`)
  }
  assert.equal(
    aGroups.reduce((total, leagueId) => total + nextWorld[leagueId].length, 0),
    aGroups.reduce((total, leagueId) => total + originalSizes[leagueId], 0),
  )
  assert.equal(
    bGroups.reduce((total, leagueId) => total + nextWorld[leagueId].length, 0),
    bGroups.reduce((total, leagueId) => total + originalSizes[leagueId], 0),
  )
})

function prepareOpolskieSeasonRollover(game) {
  for (const teams of Object.values(game.leagueWorld)) {
    teams.forEach((team, index) => {
      team.points = teams.length - index
      team.goalsFor = teams.length - index
      team.goalsAgainst = index
    })
  }
  game.teams.forEach((team, index) => {
    team.points = game.teams.length - index
    team.goalsFor = game.teams.length - index
    team.goalsAgainst = index
  })
  game.leagueWorld['third-3'].forEach((team) => {
    team.regionId = 'fourth-dolnoslaskie'
  })
  game.round = getSeasonRoundCount(game) + 1
  game.sponsorRequired = false
  game.polishCup.stage = 'complete'
  game.polishCup.matches = []
  game.polishCup.history = []
  game.regionalCups = []
  game.preseasonFriendlies = []
  game.championsCupMatch = undefined
  game.pmpLeague = undefined
  game.promotionPlayoffs = {
    season: game.season,
    round: 'complete',
    fixtures: [],
    history: [],
    promotedByLeague: {},
    leagueWorldFinalized: true,
  }
  return game
}

test('regional cup winner archive preserves the club name from the season it won', () => {
  const game = prepareOpolskieSeasonRollover(
    createGame('Testowy Klub', 'Opole', 'fourth-opolskie', '#123456'),
  )
  const champion = game.teams.find((team) => team.id === game.teamId)
  game.regionalCups = [{
    season: game.season,
    regionId: 'fourth-opolskie',
    stageId: 'regional-final',
    teams: [{
      id: champion.id,
      name: champion.name,
      strength: champion.strength,
      leagueId: 'opolskie-a-1',
      regionId: 'fourth-opolskie',
    }],
    participants: [champion.id],
    matches: [],
    history: [],
    championId: champion.id,
  }]

  const result = startNewSeason(game)
  assert.equal(result.error, '')
  assert.equal(
    result.game.regionalCupWinnerNames[game.season]['fourth-opolskie'],
    champion.name,
  )
  const regionalTrophy = result.game.trophyCabinet.find((trophy) =>
    trophy.id === `regional-cup-fourth-opolskie-${game.season}`,
  )
  assert.deepEqual(regionalTrophy, {
    id: `regional-cup-fourth-opolskie-${game.season}`,
    competition: 'regional-cup',
    name: 'Puchar Regionalny',
    season: game.season,
    regionId: 'fourth-opolskie',
  })
  const currentChampion = Object.values(result.game.leagueWorld)
    .flat()
    .find((team) => team.id === champion.id)
  assert.ok(currentChampion)
  currentChampion.name = 'Nowa nazwa klubu'
  assert.equal(
    result.game.regionalCupWinnerNames[game.season]['fourth-opolskie'],
    champion.name,
  )
})

test('Opolskie promotion refusals use candidates only through third place and leave vacancies unfilled', () => {
  const game = prepareOpolskieSeasonRollover(
    createGame('Testowy Klub', 'Opole', 'fourth-opolskie', '#123456'),
  )
  const candidates = game.leagueWorld['opolskie-a-1']
  game.leagueSeasonExceptions = {
    season: game.season,
    promotionDeclinedTeamIds: [candidates[0].id],
    licenseDeniedTeamIds: [candidates[1].id],
  }

  const zones = getLeagueTableZones({
    ...game,
    leagueId: 'opolskie-a-1',
    teams: candidates,
  })
  assert.deepEqual(zones.directPromotionRanks, [3])

  const result = startNewSeason(game)
  assert.equal(result.error, '')
  const okregowa = result.game.leagueWorld['opolskie-okr-1']
  assert.ok(okregowa.some((team) => team.id === candidates[2].id))
  assert.ok(!okregowa.some((team) => [candidates[0].id, candidates[1].id].includes(team.id)))
  assert.equal(result.game.leagueSeasonExceptions, undefined)
})

test('Opolskie IV Liga champion refusal promotes the runner-up and awards the playoff berth to its opponent', () => {
  const game = prepareOpolskieSeasonRollover(
    createGame('Testowy Klub', 'Opole', 'fourth-opolskie', '#123456'),
  )
  const champion = game.leagueWorld['fourth-opolskie'][0]
  const runnerUp = game.leagueWorld['fourth-opolskie'][1]
  game.leagueSeasonExceptions = {
    season: game.season,
    promotionDeclinedTeamIds: [champion.id],
  }
  game.promotionPlayoffs = undefined

  const scheduled = startNewSeason(game)
  assert.match(scheduled.error, /Pary barażowe zostały ustalone/)
  const playoffs = scheduled.game.promotionPlayoffs
  assert.ok(playoffs)
  assert.ok(!playoffs.fixtures.some((fixture) => fixture.competitionId === 'playoff:opolskie-fourth'))
  assert.notEqual(playoffs.promotedByLeague['playoff:opolskie-fourth'], undefined)
  assert.ok(playoffs.promotedByLeague['playoff:opolskie-fourth'] !== runnerUp.id)
})

test('Opolskie withdrawal of the user club below the supported pyramid returns a clear error', () => {
  const game = prepareOpolskieSeasonRollover(
    createGame('Testowy Klub', 'Opole', 'opolskie-a-1', '#123456'),
  )
  game.leagueSeasonExceptions = {
    season: game.season,
    withdrawnTeamIds: [game.teamId],
  }

  const result = startNewSeason(game)
  assert.match(result.error, /Wycofanie prowadzonego klubu/)
  assert.equal(result.game, game)
})

test('Opolskie withdrawal drops a club two levels and reduces cascading relegations', () => {
  const game = prepareOpolskieSeasonRollover(
    createGame('Testowy Klub', 'Opole', 'fourth-opolskie', '#123456'),
  )
  const withdrawn = game.leagueWorld['opolskie-okr-1'][12]
  const relegatedFromA = ['opolskie-a-1', 'opolskie-a-2', 'opolskie-a-3', 'opolskie-a-4']
    .flatMap((leagueId) => game.leagueWorld[leagueId].slice(-3))
  game.leagueSeasonExceptions = {
    season: game.season,
    withdrawnTeamIds: [withdrawn.id],
  }
  const okregowaZones = getLeagueTableZones({
    ...game,
    leagueId: 'opolskie-okr-1',
    teams: game.leagueWorld['opolskie-okr-1'],
  })
  assert.deepEqual(okregowaZones.maintenancePlayoffRanks, [])

  const result = startNewSeason(game)
  assert.equal(result.error, '')
  const nextWorld = result.game.leagueWorld
  const bGroups = Object.keys(nextWorld).filter((leagueId) => leagueId.startsWith('opolskie-b-'))
  assert.ok(bGroups.some((leagueId) => nextWorld[leagueId].some((team) => team.id === withdrawn.id)))
  assert.equal(
    relegatedFromA.filter((team) =>
      bGroups.some((leagueId) => nextWorld[leagueId].some((club) => club.id === team.id)),
    ).length,
    11,
  )
  assert.equal(result.game.leagueSeasonExceptions, undefined)

  const bottomWithdrawalGame = prepareOpolskieSeasonRollover(
    createGame('Testowy Klub', 'Opole', 'fourth-opolskie', '#123456'),
  )
  const bottomTeam = bottomWithdrawalGame.leagueWorld['opolskie-okr-1'][15]
  bottomWithdrawalGame.leagueSeasonExceptions = {
    season: bottomWithdrawalGame.season,
    withdrawnTeamIds: [bottomTeam.id],
  }
  const bottomZones = getLeagueTableZones({
    ...bottomWithdrawalGame,
    leagueId: 'opolskie-okr-1',
    teams: bottomWithdrawalGame.leagueWorld['opolskie-okr-1'],
  })
  assert.deepEqual(bottomZones.relegationRanks, [15, 14])
  assert.deepEqual(bottomZones.maintenancePlayoffRanks, [13])
})

test('Lubuskie relegation zones cascade for every count and respect IV Liga territory', () => {
  const game = createGame('Testowy Klub', 'Zielona Góra', 'fourth-lubuskie', '#123456')
  const world = game.leagueWorld
  const thirdTeams = world['third-3']
  const fourthTeams = world['fourth-lubuskie']
  const okregowaIds = ['lubuskie-okr-1', 'lubuskie-okr-2']
  const aGroupIds = Object.keys(world).filter((leagueId) => leagueId.startsWith('lubuskie-a-'))
  const fourthStandings = [...fourthTeams].sort((first, second) => second.points - first.points)
  const extraRelegationClubNames = [
    'Spadkowicz Zielona Góra 4',
    'Spadkowicz Gorzów Wielkopolski 3',
    'Spadkowicz Zielona Góra 2',
    'Spadkowicz Gorzów Wielkopolski 1',
  ]

  thirdTeams.forEach((team, index) => {
    team.points = thirdTeams.length - index
    team.regionId = 'fourth-dolnoslaskie'
  })
  thirdTeams.slice(-4).forEach((team, index) => {
    team.points = 4 - index
  })
  fourthStandings.forEach((team, index) => {
    team.points = fourthStandings.length - index
  })
  extraRelegationClubNames.forEach((name, index) => {
    fourthStandings[11 + index].name = name
  })
  game.teams = fourthTeams

  for (let relegatedCount = 0; relegatedCount <= 4; relegatedCount += 1) {
    thirdTeams.slice(-4).forEach((team, index) => {
      team.regionId = index >= 4 - relegatedCount ? 'fourth-lubuskie' : 'fourth-dolnoslaskie'
    })

    const fourthZones = getLeagueTableZones(game).relegationRanks
    const okregowaZones = okregowaIds.map((leagueId) => getLeagueTableZones({
      ...game,
      leagueId,
      teams: world[leagueId],
    }))
    const aZones = aGroupIds.map((leagueId) => getLeagueTableZones({
      ...game,
      leagueId,
      teams: world[leagueId],
    }))
    const gorzowskieExtras = Math.ceil(relegatedCount / 2)
    const zielonogorskieExtras = Math.floor(relegatedCount / 2)

    assert.equal(fourthZones.length, 3 + relegatedCount)
    assert.equal(okregowaZones[0].relegationRanks.length, 1 + gorzowskieExtras)
    assert.equal(okregowaZones[1].relegationRanks.length, 2 + zielonogorskieExtras)
    assert.equal(aZones.reduce((count, zones) => count + zones.relegationRanks.length, 0), 8 + relegatedCount)
  }
})

test('season rollover exchanges Lubuskie clubs across IV Liga, Okręgowa, A-class and B-class', () => {
  const game = createGame('Testowy Klub', 'Zielona Góra', 'fourth-lubuskie', '#123456')
  const world = game.leagueWorld
  const fourthTeams = game.teams
  const okregowaIds = ['lubuskie-okr-1', 'lubuskie-okr-2']
  const aGroupIds = Object.keys(world).filter((leagueId) => leagueId.startsWith('lubuskie-a-')).sort()
  const bGroupIds = Object.keys(world).filter((leagueId) => leagueId.startsWith('lubuskie-b-')).sort()
  const lubuskieLeagueIds = [...okregowaIds, ...aGroupIds, ...bGroupIds]
  const originalSizes = Object.fromEntries(lubuskieLeagueIds.map((leagueId) => [leagueId, world[leagueId].length]))
  const thirdTeams = world['third-3']
  thirdTeams.forEach((team, index) => {
    team.points = thirdTeams.length - index
  })
  thirdTeams.slice(-4).forEach((team, index) => {
    team.regionId = index < 2 ? 'fourth-lubuskie' : 'fourth-dolnoslaskie'
  })
  const bRunnerUpStats = {
    'lubuskie-b-1': { goalDifference: 0, played: 1 },
    'lubuskie-b-2': { goalDifference: 1, played: 1 },
    'lubuskie-b-3': { goalDifference: 5, played: 100 },
    'lubuskie-b-4': { goalDifference: 0, played: 1 },
    'lubuskie-b-5': { goalDifference: 1, played: 1 },
    'lubuskie-b-6': { goalDifference: 2, played: 1 },
    'lubuskie-b-7': { goalDifference: 3, played: 1 },
    'lubuskie-b-8': { goalDifference: 50, played: 100 },
    'lubuskie-b-9': { goalDifference: 40, played: 100 },
  }
  bGroupIds.forEach((leagueId, groupIndex) => {
    world[leagueId].forEach((team, index) => {
      team.points = index === 0 ? 500 + groupIndex : index === 1 ? 200 : 100 - index
      if (index === 1) {
        const stats = bRunnerUpStats[leagueId]
        team.played = stats.played
        team.goalsFor = 100 + stats.goalDifference
        team.goalsAgainst = 100
      }
    })
  })
  const aRunnerUpStats = {
    'lubuskie-a-1': { goalDifference: 50, played: 100 },
    'lubuskie-a-2': { goalDifference: 0, played: 1 },
    'lubuskie-a-3': { goalDifference: 10, played: 100 },
    'lubuskie-a-4': { goalDifference: 0, played: 1 },
    'lubuskie-a-5': { goalDifference: 1, played: 1 },
  }
  aGroupIds.forEach((leagueId, groupIndex) => {
    world[leagueId].forEach((team, index) => {
      team.points = index === 0 ? 500 + groupIndex : index === 1 ? 200 : 100 - index
      if (index === 1) {
        const stats = aRunnerUpStats[leagueId]
        team.played = stats.played
        team.goalsFor = 100 + stats.goalDifference
        team.goalsAgainst = 100
      }
    })
  })
  const bGroupToA = {
    'lubuskie-b-1': 'lubuskie-a-1',
    'lubuskie-b-2': 'lubuskie-a-1',
    'lubuskie-b-3': 'lubuskie-a-2',
    'lubuskie-b-4': 'lubuskie-a-3',
    'lubuskie-b-5': 'lubuskie-a-4',
    'lubuskie-b-6': 'lubuskie-a-3',
    'lubuskie-b-7': 'lubuskie-a-5',
    'lubuskie-b-8': 'lubuskie-a-5',
    'lubuskie-b-9': 'lubuskie-a-4',
  }
  const promotedBTeams = [
    ...bGroupIds.map((leagueId) => ({ team: world[leagueId][0], destination: bGroupToA[leagueId] })),
    ...['lubuskie-b-3', 'lubuskie-b-8', 'lubuskie-b-9'].map((leagueId) => ({
      team: world[leagueId][1],
      destination: bGroupToA[leagueId],
    })),
  ]
  const promotedATeams = [
    ...aGroupIds.map((leagueId) => ({
      team: world[leagueId][0],
      destination: ['lubuskie-a-1', 'lubuskie-a-2'].includes(leagueId) ? 'lubuskie-okr-1' : 'lubuskie-okr-2',
    })),
    { team: world['lubuskie-a-1'][1], destination: 'lubuskie-okr-1' },
    { team: world['lubuskie-a-3'][1], destination: 'lubuskie-okr-2' },
  ]
  const expectedAdditionalARelegations = [world['lubuskie-a-3'][11], world['lubuskie-a-4'][11]]
  const expectedARelegationCount = aGroupIds.reduce((count, leagueId) => count + getLeagueTableZones({
    ...game,
    leagueId,
    teams: world[leagueId],
  }).relegationRanks.length, 0)
  assert.equal(expectedARelegationCount, 10)
  const relegatedATeams = aGroupIds.flatMap((leagueId) => {
    const bDestinations = Object.entries(bGroupToA)
      .filter(([, aId]) => aId === leagueId)
      .map(([bId]) => bId)
    return world[leagueId]
      .slice(-(['lubuskie-a-1', 'lubuskie-a-2'].includes(leagueId) ? 1 : 2))
      .map((team, index) => ({ team, destinations: bDestinations, expectedDestination: bDestinations[index % bDestinations.length] }))
  })
  const relegatedOkregowaTeams = okregowaIds.flatMap((leagueId) =>
    world[leagueId]
      .slice(-(leagueId === 'lubuskie-okr-1' ? 1 : 4))
      .map((team) => ({ team, destinations: ['lubuskie-a-1', 'lubuskie-a-2', 'lubuskie-a-3', 'lubuskie-a-4', 'lubuskie-a-5'].filter((aId) =>
        ['lubuskie-okr-1', 'lubuskie-okr-2'][['lubuskie-a-1', 'lubuskie-a-2'].includes(aId) ? 0 : 1] === leagueId,
      ) })),
  )
  const champions = okregowaIds.map((leagueId) => {
    const teams = world[leagueId]
    teams.forEach((team, index) => {
      team.points = teams.length - index
    })
    return teams.slice(0, 2)
  })
  const promotedFromOkregowa = champions.flat()
  fourthTeams.forEach((team, index) => {
    team.points = fourthTeams.length - index
  })
  const relegated = fourthTeams.slice(-5)
  relegated.slice(0, 2).forEach((team, index) => {
    team.name = `Testowy klub Zielona Góra ${index + 1}`
  })

  game.round = getSeasonRoundCount(game) + 1
  game.sponsorRequired = false
  game.polishCup.stage = 'complete'
  game.polishCup.matches = []
  game.polishCup.history = []
  game.regionalCups = []
  game.preseasonFriendlies = []
  game.championsCupMatch = undefined
  game.pmpLeague = undefined
  game.promotionPlayoffs = {
    season: game.season,
    round: 'complete',
    fixtures: [],
    history: [],
    promotedByLeague: {},
    leagueWorldFinalized: true,
  }

  const result = startNewSeason(game)
  assert.equal(result.error, '')
  const nextWorld = result.game.leagueWorld
  for (const team of promotedFromOkregowa) {
    assert.ok(nextWorld['fourth-lubuskie'].some((club) => club.id === team.id))
    assert.ok(!okregowaIds.some((leagueId) => nextWorld[leagueId].some((club) => club.id === team.id)))
  }
  for (const team of relegated) {
    const destination = Object.entries(nextWorld).find(([, clubs]) =>
      clubs.some((club) => club.id === team.id),
    )?.[0]
    assert.ok(okregowaIds.includes(destination), `${team.name} ended in ${destination ?? 'no league'}`)
    assert.ok(!nextWorld['fourth-lubuskie'].some((club) => club.id === team.id))
  }
  for (const team of relegated.slice(0, 2)) {
    assert.ok(nextWorld['lubuskie-okr-2'].some((club) => club.id === team.id), `${team.name} was not assigned to Zielona Góra Okręgowa`)
  }
  assert.equal(nextWorld['fourth-lubuskie'].length, fourthTeams.length - 1)
  assert.equal(okregowaIds.reduce((count, leagueId) => count + nextWorld[leagueId].length, 0),
    okregowaIds.reduce((count, leagueId) => count + originalSizes[leagueId], 0) + 3)
  assert.equal(aGroupIds.reduce((count, leagueId) => count + nextWorld[leagueId].length, 0),
    aGroupIds.reduce((count, leagueId) => count + originalSizes[leagueId], 0))
  assert.equal(bGroupIds.reduce((count, leagueId) => count + nextWorld[leagueId].length, 0),
    bGroupIds.reduce((count, leagueId) => count + originalSizes[leagueId], 0) - 2)
  for (const { team, destination } of promotedBTeams) {
    assert.ok(nextWorld[destination].some((club) => club.id === team.id), `${team.name} was not promoted to ${destination}`)
  }
  for (const { team, destination } of promotedATeams) {
    const actualDestination = Object.entries(nextWorld).find(([, clubs]) => clubs.some((club) => club.id === team.id))?.[0]
    assert.ok(nextWorld[destination].some((club) => club.id === team.id), `${team.name} was expected in ${destination}, found in ${actualDestination ?? 'no league'}`)
  }
  for (const { team, expectedDestination } of relegatedATeams) {
    assert.ok(nextWorld[expectedDestination].some((club) => club.id === team.id), `${team.name} was not relegated to ${expectedDestination}`)
  }
  for (const { team, destinations } of relegatedOkregowaTeams) {
    assert.ok(destinations.some((leagueId) => nextWorld[leagueId].some((club) => club.id === team.id)), `${team.name} was not relegated to its A-class feeder`)
  }
  for (const team of expectedAdditionalARelegations) {
    assert.ok(bGroupIds.some((leagueId) => nextWorld[leagueId].some((club) => club.id === team.id)), `${team.name} was not additionally relegated from A-class`)
  }
})

test('league match creates a final report with the saved score and player ratings', () => {
  const game = createCompetitionGame()
  const fixture = {
    id: 'test-league-match',
    competitionId: 'league',
    round: game.round,
    scheduledAt: game.currentDate,
    homeId: game.teamId,
    awayId: firstOpponent.id,
    played: false,
  }
  game.matches = [fixture]
  assert.equal(getNextScheduledCompetition(game), 'league')

  const event = playMatchday(game)
  assert.equal(event.error, '')
  const choiceId = event.game.pendingMatchEvent.options[0]?.id
  assert.ok(choiceId)
  const result = playMatchday(event.game, choiceId, new Map([
    [fixture.id, { homeGoals: 2, awayGoals: 0 }],
  ]))

  assert.equal(result.error, '')
  const completed = result.game.matches.find((match) => match.id === fixture.id)
  assert.equal(completed.played, true)
  assert.deepEqual([completed.homeGoals, completed.awayGoals], [2, 0])
  assert.equal(result.game.lastMatchReport.matchId, fixture.id)
  assert.equal(result.game.lastMatchReport.score, '2 : 0')
  assert.ok(result.game.lastMatchReport.playerRatings.length > 0)
  assert.equal(result.game.clubRivalries[0].opponentId, firstOpponent.id)
  assert.equal(result.game.clubRivalries[0].lastScore, '2 : 0')
  assert.equal(result.game.clubRivalries[0].recentMatches.at(-1).competition, 'league')
})

test('halftime continuation keeps the first-half score and reconciles the final score', () => {
  const homeName = 'Home'
  const awayName = 'Away'
  const firstHalf = [
    { minute: 20, message: 'Gol gospodarzy', homeGoals: 1, awayGoals: 0, kind: 'goal', teamName: homeName },
    { minute: 45, message: 'Przerwa', homeGoals: 1, awayGoals: 0, kind: 'commentary' },
  ]
  const generated = [
    { minute: 22, message: 'Gol gospodarzy', homeGoals: 1, awayGoals: 0, kind: 'goal', teamName: homeName },
    { minute: 46, message: 'Druga połowa', homeGoals: 1, awayGoals: 0, kind: 'commentary' },
    { minute: 60, message: 'Gol gości', homeGoals: 1, awayGoals: 1, kind: 'goal', teamName: awayName },
    { minute: 70, message: 'Strzał', homeGoals: 1, awayGoals: 1, kind: 'shot' },
    { minute: 80, message: 'Gol gospodarzy', homeGoals: 2, awayGoals: 1, kind: 'goal', teamName: homeName },
  ]

  const incidents = continueLiveMatchIncidents(firstHalf, generated, { home: 1, away: 0 }, { home: 2, away: 1 }, homeName, awayName)

  assert.deepEqual(incidents.slice(0, firstHalf.length), firstHalf)
  assert.deepEqual(
    incidents.filter((incident) => incident.kind === 'goal').map((incident) => [incident.minute, incident.homeGoals, incident.awayGoals]),
    [[20, 1, 0], [60, 1, 1], [80, 2, 1]],
  )
  assert.deepEqual(
    [incidents.at(-1).homeGoals, incidents.at(-1).awayGoals],
    [2, 1],
  )
})

test('Polish Cup resume preserves the user fixture result and report', () => {
  const game = createCompetitionGame()
  game.round = 99
  game.polishCup.stage = 'third'
  game.polishCup.teams = [
    getCupTeam(game, game.teams.find((team) => team.id === game.teamId)),
    getCupTeam(game, firstOpponent),
  ]
  game.polishCup.matches = [{
    id: 'test-polish-cup-match',
    stage: 'third',
    round: 1,
    scheduledAt: game.currentDate,
    kickoffTime: '20:30',
    homeId: game.teamId,
    awayId: firstOpponent.id,
    played: false,
    competitionId: 'polish-cup',
  }]

  const savedResult = { homeGoals: 2, awayGoals: 1, winnerId: game.teamId }
  const firstHalf = playPolishCupRound(game, new Map([['test-polish-cup-match', savedResult]]))
  assert.equal(firstHalf.error, '')
  const playedFixture = firstHalf.game.polishCup.history.find((match) => match.id === 'test-polish-cup-match')
  const cupRivalry = firstHalf.game.clubRivalries.find((item) => item.opponentId === firstOpponent.id)
  assert.equal(cupRivalry.matches, 1)
  assert.equal(cupRivalry.recentMatches.at(-1).competition, 'polish-cup')
  assert.equal(cupRivalry.recentMatches.at(-1).score, '2 : 1')
  const resumed = playPolishCupRound(game, new Map([[playedFixture.id, playedFixture]]))

  assert.equal(resumed.error, '')
  const completed = resumed.game.polishCup.history.find((match) => match.id === playedFixture.id)
  assert.deepEqual([completed.homeGoals, completed.awayGoals, completed.winnerId], [2, 1, game.teamId])
  assert.equal(resumed.game.lastMatchReport.score, '2 : 1')
})

test('Champions Cup resume preserves score, penalty winner, and trophy', () => {
  const game = createCompetitionGame()
  game.championsCupMatch = {
    id: 'test-champions-cup-match',
    round: 1,
    homeId: game.teamId,
    awayId: firstOpponent.id,
    scheduledAt: game.currentDate,
    played: false,
    competitionId: 'champions-cup',
    season: game.season,
  }
  const resumed = playChampionsCupMatch(game, {
    homeGoals: 1,
    awayGoals: 1,
    winnerId: firstOpponent.id,
    penaltyScore: '3:4',
  })

  assert.equal(resumed.error, '')
  assert.deepEqual(
    [resumed.completedMatch.homeGoals, resumed.completedMatch.awayGoals, resumed.completedMatch.winnerId, resumed.completedMatch.penaltyScore],
    [1, 1, firstOpponent.id, '3:4'],
  )
  assert.equal(resumed.completedMatch.played, true)
  assert.equal((resumed.game.trophyCabinet ?? []).some((trophy) => trophy.id === `champions-cup-${game.season}`), false)
})

test('PMP League resume preserves the fixture score and report', () => {
  const game = createCompetitionGame()
  const laterDate = new Date(`${game.currentDate}T12:00:00`)
  laterDate.setDate(laterDate.getDate() + 7)
  const pmpTeams = [game.teams.find((team) => team.id === game.teamId), firstOpponent, secondOpponent]
  game.pmpLeague = {
    season: game.season,
    phase: 'groups',
    startAt: game.currentDate,
    teams: pmpTeams.map((team) => getCupTeam(game, team)),
    groups: [],
    history: [],
    regionalChampions: {},
    matches: [
      {
        id: 'test-pmp-match',
        phase: 'groups',
        round: 1,
        homeId: game.teamId,
        awayId: firstOpponent.id,
        scheduledAt: game.currentDate,
        played: false,
      },
      {
        id: 'test-pmp-later-match',
        phase: 'groups',
        round: 2,
        homeId: secondOpponent.id,
        awayId: firstOpponent.id,
        scheduledAt: laterDate.toISOString().slice(0, 10),
        played: false,
      },
    ],
  }

  const savedResult = { homeGoals: 2, awayGoals: 1 }
  const firstHalf = playPmpLeagueEvent(game, new Map([['test-pmp-match', savedResult]]))
  assert.equal(firstHalf.error, '')
  const resumed = playPmpLeagueEvent(game, new Map([[firstHalf.completedMatch.id, firstHalf.completedMatch]]))

  assert.equal(resumed.error, '')
  assert.deepEqual([resumed.completedMatch.homeGoals, resumed.completedMatch.awayGoals], [2, 1])
  assert.equal(resumed.game.lastMatchReport.matchId, 'test-pmp-match')
  assert.equal(resumed.game.lastMatchReport.score, '2 : 1')
})

test('promotion playoff resume preserves every result and advancing team', () => {
  const game = createCompetitionGame()
  game.round = 99
  game.promotionPlayoffs = {
    season: game.season,
    round: 1,
    fixtures: [
      {
        id: 'test-playoff-user',
        leagueId: game.leagueId,
        competitionId: game.leagueId,
        leagueName: 'Test liga',
        round: 1,
        homeId: game.teamId,
        awayId: firstOpponent.id,
        scheduledAt: game.currentDate,
        kickoffTime: '16:00',
        played: false,
      },
      {
        id: 'test-playoff-other',
        leagueId: game.leagueId,
        competitionId: game.leagueId,
        leagueName: 'Test liga',
        round: 1,
        homeId: secondOpponent.id,
        awayId: thirdOpponent.id,
        scheduledAt: game.currentDate,
        kickoffTime: '16:00',
        played: false,
      },
    ],
    history: [],
    promotedByLeague: {},
    byeTeamIds: {},
  }

  const firstHalf = playPromotionPlayoffRound(game)
  assert.equal(firstHalf.error, '')
  const savedResults = new Map(firstHalf.game.promotionPlayoffs.history.map((fixture) => [fixture.id, fixture]))
  const resumed = playPromotionPlayoffRound(game, savedResults)

  assert.equal(resumed.error, '')
  for (const [fixtureId, saved] of savedResults) {
    const completed = resumed.game.promotionPlayoffs.history.find((fixture) => fixture.id === fixtureId)
    assert.deepEqual(
      [completed.homeGoals, completed.awayGoals, completed.winnerId],
      [saved.homeGoals, saved.awayGoals, saved.winnerId],
    )
  }
})

test('season event choices apply effects once and reject unaffordable costs', () => {
  const game = createCompetitionGame()
  game.cash = 10_000
  game.inboxMessages = [{
    id: 'test-season-event',
    date: game.currentDate,
    sender: 'Klub kibica',
    subject: 'Test wydarzenia',
    body: 'Test',
    status: 'info',
    category: 'club',
    seasonEvent: {
      season: game.season,
      choices: [{
        id: 'costly-choice',
        label: 'Kosztowna decyzja',
        description: '',
        outcome: 'Wybrano.',
        effects: { cash: -20_000, morale: 4, stamina: 0, confidence: 1, followers: 100 },
      }],
    },
  }]

  const rejected = resolveSeasonEvent(game, 'test-season-event', 'costly-choice')
  assert.notEqual(rejected.error, '')
  assert.equal(rejected.game.cash, 10_000)
  assert.equal(game.inboxMessages[0].seasonEvent.selectedChoiceId, undefined)

  game.cash = 50_000
  const accepted = resolveSeasonEvent(game, 'test-season-event', 'costly-choice')
  assert.equal(accepted.error, '')
  assert.equal(accepted.game.cash, 30_000)
  assert.equal(accepted.game.inboxMessages[0].seasonEvent.selectedChoiceId, 'costly-choice')
  assert.notEqual(resolveSeasonEvent(accepted.game, 'test-season-event', 'costly-choice').error, '')
})

test('lower-league clubs can receive local club events', () => {
  const game = createGame('Testowy Klub', 'Opole', 'opolskie-b-1', '#123456')
  const [year, month, day] = game.currentDate.split('-').map(Number)
  const nextDate = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10)
  const originalRandom = Math.random
  const randomValues = [0, 0.999]
  Math.random = () => randomValues.shift() ?? 0.999

  try {
    const result = simulateCalendarDay(game, nextDate)
    const eventMessage = result.game.inboxMessages.find((message) => message.seasonEvent)

    assert.equal(result.error, '')
    assert.equal(eventMessage?.subject, 'Zawodnicy nie mogą trenować w zwykłych godzinach')
    assert.ok(eventMessage.seasonEvent.choices.some((choice) => choice.id === 'local-training-evening'))

    const resolved = resolveSeasonEvent(result.game, eventMessage.id, 'local-training-usual')
    assert.equal(resolved.error, '')
    assert.equal(resolved.game.inboxMessages.find((message) => message.id === eventMessage.id).seasonEvent.selectedChoiceId, 'local-training-usual')
    assert.equal(resolved.game.squad[0].morale, Math.max(20, result.game.squad[0].morale - 2))
    assert.equal(resolved.game.localReputation, 32)
  } finally {
    Math.random = originalRandom
  }
})

test('local reputation affects attendance and unlocks better sponsor offers', () => {
  const game = createGame('Testowy Klub', 'Opole', 'opolskie-b-1', '#123456')
  const homeMatch = game.matches.find((match) => match.homeId === game.teamId)
  assert.ok(homeMatch)

  const lowReputationGame = structuredClone(game)
  lowReputationGame.localReputation = 0
  const highReputationGame = structuredClone(game)
  highReputationGame.localReputation = 100
  assert.ok(estimateAttendance(highReputationGame, homeMatch) > estimateAttendance(lowReputationGame, homeMatch))

  const eventMessage = {
    id: 'local-reputation-sponsor-test',
    date: game.currentDate,
    sender: 'Mieszkańcy',
    subject: 'Test reputacji lokalnej',
    body: 'Test',
    read: false,
    category: 'club',
    status: 'info',
    seasonEvent: {
      season: game.season,
      choices: [{
        id: 'build-local-reputation',
        label: 'Zaangażuj się w życie miasta',
        description: '',
        outcome: 'Mieszkańcy lepiej poznali klub.',
        effects: { cash: 0, morale: 0, stamina: 0, confidence: 0, followers: 0, localReputation: 65 },
      }],
    },
  }
  game.inboxMessages.unshift(eventMessage)
  assert.equal(game.commercialOffers.sponsors.some((offer) => offer.id === 'sponsor-national'), false)

  const resolved = resolveSeasonEvent(game, eventMessage.id, 'build-local-reputation')
  assert.equal(resolved.error, '')
  assert.equal(resolved.game.localReputation, 100)
  assert.equal(resolved.game.commercialOffers.sponsors.some((offer) => offer.id === 'sponsor-national'), true)
  assert.equal(resolved.game.commercialOffers.sponsors.some((offer) => offer.id === 'sponsor-local-bakery'), true)
  assert.ok(
    resolved.game.commercialOffers.sponsors.find((offer) => offer.id === 'sponsor-local-shop').paymentPerMatch
    > game.commercialOffers.sponsors.find((offer) => offer.id === 'sponsor-local-shop').paymentPerMatch,
  )
})

test('amateur clubs recognize opponents from their league group as district derbies', () => {
  const game = createGame('Testowy Klub', 'Opole', 'opolskie-b-1', '#123456')
  const opponent = game.teams.find((team) => team.id !== game.teamId)
  assert.ok(opponent)
  game.city = 'Testowe Miasto'

  assert.equal(getDerbyKind(game, opponent.name), 'district')
  assert.equal(isLocalDerby(game, opponent.name), true)

  const topDivision = createGame('Testowy Klub', 'Testowe Miasto', 'ekstraklasa', '#123456')
  const topDivisionOpponent = topDivision.teams.find((team) => team.id !== topDivision.teamId)
  assert.ok(topDivisionOpponent)
  assert.equal(getDerbyKind(topDivision, topDivisionOpponent.name), null)
})

test('regional cup opponents from the same region are district derbies only in that cup', () => {
  const game = createGame('Testowy Klub', 'Opole', 'opolskie-b-1', '#123456')
  const regionalCup = game.regionalCups.find((cup) => cup.teams.some((team) => team.id === game.teamId))
  assert.ok(regionalCup)
  const opponent = regionalCup.teams.find((team) =>
    team.id !== game.teamId && !game.teams.some((leagueTeam) => leagueTeam.id === team.id),
  )
  assert.ok(opponent)
  game.city = 'Testowe Miasto'

  assert.equal(getDerbyKind(game, opponent.name), null)
  assert.equal(getDerbyKind(game, opponent.name, 'regional-cup'), 'district')
  assert.equal(isLocalDerby(game, opponent.name, 'regional-cup'), true)
})

test('a regional cup derby win improves local reputation and refreshes sponsor offers', () => {
  const game = createGame('Testowy Klub', 'Opole', 'opolskie-b-1', '#123456')
  const regionalCup = game.regionalCups.find((cup) => cup.teams.some((team) => team.id === game.teamId))
  assert.ok(regionalCup)
  const opponent = regionalCup.teams.find((team) =>
    team.id !== game.teamId && !game.teams.some((leagueTeam) => leagueTeam.id === team.id),
  )
  assert.ok(opponent)
  game.city = 'Testowe Miasto'
  game.sponsorRequired = false
  game.polishCup.stage = 'complete'
  game.polishCup.matches = []
  game.polishCup.history = []
  game.preseasonFriendlies = []
  game.promotionPlayoffs = undefined
  game.pmpLeague = undefined
  const fixture = {
    id: 'regional-cup-derby-test',
    competitionId: 'polish-cup',
    round: 1,
    scheduledAt: game.currentDate,
    homeId: game.teamId,
    awayId: opponent.id,
    played: false,
    stage: 'regional',
  }
  regionalCup.matches = [fixture]

  assert.equal(getNextScheduledCompetition(game), 'polish-cup')
  const action = saveDerbyMatchAction(game, fixture.id, 'home-tifo')
  assert.equal(action.error, '')
  assert.equal(action.game.cash, game.cash - 15_000)
  const result = playPolishCupRound(action.game, new Map([
    [fixture.id, { homeGoals: 2, awayGoals: 0, winnerId: game.teamId }],
  ]))

  assert.equal(result.error, '')
  assert.equal(result.game.localReputation, 39)
  const completedFixture = result.game.regionalCups.find((cup) => cup.regionId === regionalCup.regionId)
    .history.find((match) => match.id === fixture.id)
  const expectedStandardAttendance = Math.round(game.stadiumCapacity * Math.max(0.3, Math.min(0.8, 0.3 + game.followers / 800_000)))
  assert.equal(completedFixture.attendance, Math.round(game.stadiumCapacity * Math.min(0.92, Math.max(0.3, Math.min(0.8, 0.3 + game.followers / 800_000)) + 0.2)))
  assert.ok(completedFixture.attendance > expectedStandardAttendance)
  assert.ok(result.game.finances.some((entry) => entry.label === 'Puchar regionalny · wpływy z biletów' && entry.amount > 0))
  assert.ok(result.game.finances.some((entry) => entry.label === 'Oprawa kibiców na derby' && entry.amount === -15_000))
  assert.equal(result.game.pendingDerbyMatchAction, undefined)
  assert.equal(result.game.followers, game.followers + 650)
  assert.ok(result.game.commercialOffers.sponsors.find((offer) => offer.id === 'sponsor-local-shop').paymentPerMatch
    > game.commercialOffers.sponsors.find((offer) => offer.id === 'sponsor-local-shop').paymentPerMatch)
  assert.match(result.summary, /Derby okręgowe/)
  const rivalry = result.game.clubRivalries.find((item) => item.opponentId === opponent.id)
  assert.equal(rivalry.derbyMatches, 1)
  assert.equal(rivalry.recentMatches.at(-1).competition, 'regional-cup')
  assert.equal(rivalry.recentMatches.at(-1).result, 'W')
})

test('derby action can be changed or cancelled with its original cost refunded', () => {
  const game = createGame('Testowy Klub', 'Opole', 'opolskie-b-1', '#123456')
  const regionalCup = game.regionalCups.find((cup) => cup.teams.some((team) => team.id === game.teamId))
  assert.ok(regionalCup)
  const opponent = regionalCup.teams.find((team) =>
    team.id !== game.teamId && !game.teams.some((leagueTeam) => leagueTeam.id === team.id),
  )
  assert.ok(opponent)
  const fixture = {
    id: 'regional-cup-derby-action-refund',
    round: 1,
    scheduledAt: game.currentDate,
    homeId: game.teamId,
    awayId: opponent.id,
    played: false,
    stage: 'regional',
  }
  regionalCup.matches = [fixture]

  const selected = saveDerbyMatchAction(game, fixture.id, 'home-tifo')
  assert.equal(selected.error, '')
  const cancelled = saveDerbyMatchAction(selected.game, fixture.id, 'none')
  assert.equal(cancelled.error, '')
  assert.equal(cancelled.game.cash, game.cash)
  assert.equal(cancelled.game.pendingDerbyMatchAction, undefined)
})

test('derby action rejects the wrong venue and insufficient funds', () => {
  const game = createGame('Testowy Klub', 'Opole', 'opolskie-b-1', '#123456')
  const opponent = game.teams.find((team) => team.id !== game.teamId)
  assert.ok(opponent)
  const homeFixture = {
    id: 'home-derby-action-guards',
    round: 1,
    homeId: game.teamId,
    awayId: opponent.id,
    played: false,
  }
  game.matches = [homeFixture]
  assert.notEqual(saveDerbyMatchAction(game, homeFixture.id, 'away-supporters-bus').error, '')
  game.cash = 14_999
  assert.notEqual(saveDerbyMatchAction(game, homeFixture.id, 'home-tifo').error, '')

  game.cash = 50_000
  const awayFixture = { ...homeFixture, id: 'away-derby-action-guards', homeId: opponent.id, awayId: game.teamId }
  game.matches = [awayFixture]
  assert.notEqual(saveDerbyMatchAction(game, awayFixture.id, 'home-tifo').error, '')
})

test('a win in a district derby improves local reputation and refreshes sponsor offers', () => {
  const game = createGame('Testowy Klub', 'Testowe Miasto', 'opolskie-b-1', '#123456')
  const opponent = game.teams.find((team) => team.id !== game.teamId)
  assert.ok(opponent)
  game.round = 1
  game.sponsorRequired = false
  game.polishCup.stage = 'complete'
  game.polishCup.matches = []
  game.polishCup.history = []
  game.regionalCups = []
  game.preseasonFriendlies = []
  game.championsCupMatch = undefined
  game.pmpLeague = undefined
  game.promotionPlayoffs = undefined
  game.pendingMatchEvent = undefined
  game.matches = [{
    id: 'district-derby-test',
    competitionId: 'league',
    round: game.round,
    scheduledAt: game.currentDate,
    homeId: game.teamId,
    awayId: opponent.id,
    played: false,
  }]

  const event = playMatchday(game)
  assert.equal(event.error, '')
  const choiceId = event.game.pendingMatchEvent.options[0]?.id
  assert.ok(choiceId)
  const result = playMatchday(event.game, choiceId, new Map([
    ['district-derby-test', { homeGoals: 2, awayGoals: 0 }],
  ]))

  assert.equal(result.error, '')
  assert.equal(result.game.localReputation, 37)
  assert.equal(result.game.commercialOffers.sponsors.find((offer) => offer.id === 'sponsor-local-shop').paymentPerMatch
    > game.commercialOffers.sponsors.find((offer) => offer.id === 'sponsor-local-shop').paymentPerMatch, true)
})

test('club match challenges reward completed objectives once and preserve progress', () => {
  const game = createCompetitionGame()
  const match = game.matches.find((item) => item.homeId === game.teamId || item.awayId === game.teamId)
  assert.ok(match)
  match.played = true
  match.homeGoals = match.homeId === game.teamId ? 3 : 0
  match.awayGoals = match.awayId === game.teamId ? 3 : 0
  match.attendance = game.stadiumCapacity
  match.disciplinaryEvents = []

  const challenges = getClubChallenges(game)
  assert.ok(challenges.length >= 4)
  assert.ok(challenges.filter((challenge) => challenge.completed).length >= 4)
  const cashBefore = game.cash
  const claimed = claimClubChallengeRewards(game)
  assert.equal(claimed.error, '')
  assert.equal(claimed.game.cash - cashBefore, challenges.filter((challenge) => challenge.completed).reduce((sum, challenge) => sum + challenge.reward, 0))
  assert.match(claimed.message, /Odebrano/)
  assert.ok(claimed.game.claimedClubChallengeIds.length >= 4)

  const repeated = claimClubChallengeRewards(claimed.game)
  assert.notEqual(repeated.error, '')
  assert.equal(repeated.game, claimed.game)
})

test('manager career profile tracks reputation levels and unlocks career achievements', () => {
  const game = createCompetitionGame()
  const club = game.teams.find((team) => team.id === game.teamId)
  club.played = 10
  club.wins = 5
  club.draws = 2
  club.losses = 3
  game.managerCareer = {
    completedSeasons: 2,
    leagueMatches: 60,
    leagueWins: 20,
    promotions: 1,
    leagueTitles: 1,
    academyDebuts: 1,
    leagueGoals: 80,
  }
  game.trophyCabinet = [
    { id: 'manager-test-league', competition: 'league', name: 'Mistrz ligi', season: '2024/2025' },
    { id: 'manager-test-cup', competition: 'polish-cup', name: 'Polski Puchar', season: '2024/2025' },
    { id: 'manager-test-champions', competition: 'champions-cup', name: 'Puchar Mistrzów', season: '2024/2025' },
  ]

  const profile = getManagerCareerProfile(game)
  assert.equal(profile.leagueMatches, 70)
  assert.equal(profile.leagueWins, 25)
  assert.equal(profile.promotions, 1)
  assert.equal(profile.trophies, 3)
  assert.ok(profile.experience > 1_000)
  assert.ok(profile.achievements.find((achievement) => achievement.id === 'matches-25').unlocked)
  assert.ok(profile.achievements.find((achievement) => achievement.id === 'first-promotion').unlocked)
  assert.ok(profile.achievements.find((achievement) => achievement.id === 'trophies-3').unlocked)
  assert.ok(profile.achievements.find((achievement) => achievement.id === 'matches-100').progress < 100)
})

test('legacy saves migrate manager career totals from archived seasons', () => {
  const game = createCompetitionGame()
  delete game.managerCareer
  game.seasonHistory = [{
    season: '2025/2026',
    leagueId: game.leagueId,
    leagueChange: 'promotion',
    finalPosition: 1,
    points: 40,
    wins: 12,
    draws: 4,
    losses: 2,
    goalsFor: 38,
    goalsAgainst: 15,
    finalTable: [],
    topScorers: [],
    recordedAt: '2026-06-01T00:00:00.000Z',
  }]

  const migrated = loadGameFromJSON(JSON.stringify(game))
  assert.ok(migrated)
  const profile = getManagerCareerProfile(migrated)
  assert.equal(profile.completedSeasons, 1)
  assert.equal(profile.leagueMatches, 18)
  assert.equal(profile.leagueWins, 12)
  assert.equal(profile.promotions, 1)
  assert.ok(profile.achievements.find((achievement) => achievement.id === 'league-champion').unlocked)
})

test('season awards cover league leaders, apply appearance thresholds and break ties consistently', () => {
  const game = createCompetitionGame()
  game.squad = []
  game.clubSquads = Object.fromEntries(game.teams.filter((team) => team.id !== game.teamId).map((team) => [team.id, []]))

  function player(id, clubId, overrides = {}) {
    const source = structuredClone(initialGame.squad[0])
    return {
      ...source,
      id,
      firstName: id,
      lastName: 'Test',
      history: [],
      ...overrides,
      clubId,
    }
  }

  const players = [
    player('top-scorer', firstOpponent.id, { age: 27, seasonGoals: 24, seasonAppearances: 31 }),
    player('scorer-tie', firstOpponent.id, { age: 28, seasonGoals: 24, seasonAppearances: 30 }),
    player('top-assist', secondOpponent.id, { age: 28, seasonAssists: 14, seasonAppearances: 25 }),
    player('goalkeeper', thirdOpponent.id, { age: 30, position: 'BR', seasonAppearances: 20, seasonCleanSheets: 12 }),
    player('short-keeper', thirdOpponent.id, { age: 30, position: 'BR', seasonAppearances: 2, seasonCleanSheets: 99 }),
    player('young-player', secondOpponent.id, { age: 20, seasonRatedAppearances: 8, seasonRatingTotal: 64 }),
    player('young-ineligible', firstOpponent.id, { age: 22, seasonRatedAppearances: 8, seasonRatingTotal: 70.4 }),
    player('player-of-season', thirdOpponent.id, { age: 29, seasonRatedAppearances: 10, seasonRatingTotal: 90 }),
    player('mvp-ineligible', thirdOpponent.id, { age: 29, seasonRatedAppearances: 4, seasonRatingTotal: 39.6 }),
  ]
  for (const candidate of players) {
    game.clubSquads[candidate.clubId].push({ player: candidate, askingPrice: 0 })
  }

  const awards = getSeasonAwards(game)
  assert.deepEqual(awards.map((award) => award.category), [
    'top-scorer',
    'top-assists',
    'best-goalkeeper',
    'young-player',
    'player-of-season',
  ])
  assert.deepEqual(awards.map((award) => award.playerId), [
    'top-scorer',
    'top-assist',
    'goalkeeper',
    'young-player',
    'player-of-season',
  ])
  assert.equal(awards[0].valueLabel, '24 goli')
  assert.equal(awards[3].valueLabel, 'Ocena 8.00 · 8 wyst.')
})

test('only Superklasa champions are titled Polish champions', () => {
  assert.equal(getLeagueChampionTrophyName('ekstraklasa'), 'Mistrz Polski')
  assert.equal(getLeagueChampionTrophyName('first'), 'Mistrz ligi · Pierwsza Liga Polska')
  assert.equal(getLeagueChampionTrophyName('fourth'), 'Mistrz ligi · Czwarta liga Polska')
})

test('season team selects eleven unique players by rated performances and position fit', () => {
  const game = createCompetitionGame()
  game.squad = []
  game.clubSquads = Object.fromEntries(game.teams.filter((team) => team.id !== game.teamId).map((team) => [team.id, []]))
  const positions = ['BR', 'PO', 'ŚO', 'ŚO', 'LO', 'DP', 'ŚP', 'OP', 'PN', 'ŚN', 'LN']
  const addPlayer = (id, position, rating, appearances = 10, secondaryPositions = []) => {
    const player = {
      ...structuredClone(initialGame.squad[0]),
      id,
      firstName: id,
      lastName: 'Test',
      position,
      secondaryPositions,
      seasonRatedAppearances: appearances,
      seasonRatingTotal: rating * appearances,
      history: [],
    }
    const club = game.teams.find((team) => team.id !== game.teamId)
    game.clubSquads[club.id].push({ player, askingPrice: 0 })
    return player
  }
  positions.forEach((position, index) => addPlayer(`team-player-${index}`, position, 7 + index / 10))
  const versatileCenterBack = addPlayer('versatile-center-back', 'ŚO', 9.5, 10, ['PO'])
  addPlayer('ineligible-forward', 'ŚN', 10, 4)

  const team = getSeasonTeamOfSeason(game)
  assert.equal(team.length, 11)
  assert.deepEqual(team.map((player) => player.position), positions)
  assert.equal(new Set(team.map((player) => player.playerId)).size, 11)
  assert.equal(team.find((player) => player.position === 'PO').playerId, versatileCenterBack.id)
  assert.equal(team.some((player) => player.playerId === 'ineligible-forward'), false)
  assert.ok(team.every((player) => player.appearances >= 5))
})

test('season awards are archived, published and added to the winning player history', () => {
  const game = createCompetitionGame()
  const winner = game.squad[0]
  winner.seasonGoals = 100
  winner.seasonAppearances = 30
  for (const player of [
    ...game.squad,
    ...Object.values(game.clubSquads).flatMap((offers) => offers.map(({ player: clubPlayer }) => clubPlayer)),
  ]) {
    player.seasonRatedAppearances = 10
    player.seasonRatingTotal = 80
  }
  game.round = getSeasonRoundCount(game) + 1
  game.promotionPlayoffs = {
    season: game.season,
    round: 'complete',
    fixtures: [],
    history: [],
    promotedByLeague: {},
  }

  const result = startNewSeason(game)
  assert.equal(result.error, '')
  const archivedRecord = result.game.seasonHistory[0]
  assert.equal(archivedRecord.awards.find((award) => award.category === 'top-scorer').playerId, winner.id)
  assert.equal(archivedRecord.teamOfSeason.length, 11)
  assert.ok(result.game.mediaPosts.some((post) => post.headline === `Nagrody sezonu ${game.season}`))
  assert.ok(result.game.squad.find((player) => player.id === winner.id).history.some((event) =>
    event.type === 'award' && event.title === 'Król strzelców',
  ))
  for (const member of archivedRecord.teamOfSeason.filter((player) => player.clubId === game.teamId)) {
    assert.ok(result.game.squad.find((player) => player.id === member.playerId).history.some((event) =>
      event.type === 'award' && event.title === 'Jedenastka sezonu',
    ))
  }
})

test('legacy saves rebuild current-season rivalry records from played league fixtures', () => {
  const game = createCompetitionGame()
  delete game.clubRivalries
  game.matches = [{
    id: 'legacy-rivalry-fixture',
    round: 4,
    competitionId: 'league',
    homeId: game.teamId,
    awayId: firstOpponent.id,
    played: true,
    homeGoals: 2,
    awayGoals: 1,
  }]

  const migrated = loadGameFromJSON(JSON.stringify(game))
  assert.ok(migrated)
  assert.equal(migrated.clubRivalries.length, 1)
  assert.equal(migrated.clubRivalries[0].opponentId, firstOpponent.id)
  assert.equal(migrated.clubRivalries[0].wins, 1)
  assert.equal(migrated.clubRivalries[0].lastMatchRound, 4)
})

test('league rivalry history tracks results, derbies and form across seasons', () => {
  const game = createCompetitionGame()
  const opponent = game.teams.find((team) => team.id !== game.teamId)
  game.round = 3
  const first = recordClubRivalryMatch(game, opponent.id, opponent.name, 2, 1, true)
  assert.equal(first.rivalryPoints, 5)
  assert.equal(first.derbyMatches, 1)

  game.season = '2027/2028'
  game.round = 7
  recordClubRivalryMatch(game, opponent.id, opponent.name, 0, 0, false)
  recordClubRivalryMatch(game, opponent.id, opponent.name, 1, 2, false)

  const rivalry = getClubRivalries(game)[0]
  assert.equal(rivalry.matches, 3)
  assert.equal(rivalry.wins, 1)
  assert.equal(rivalry.draws, 1)
  assert.equal(rivalry.losses, 1)
  assert.equal(rivalry.goalsFor, 3)
  assert.equal(rivalry.goalsAgainst, 3)
  assert.deepEqual(rivalry.recentResults, ['W', 'D', 'L'])
  assert.equal(rivalry.lastMatchSeason, '2027/2028')
  assert.equal(rivalry.lastMatchRound, 7)
  assert.equal(getClubRivalryLevel(rivalry), 'Gorąca rywalizacja')
})

test('cup rivalry records reflect the winner of a penalty shootout', () => {
  const game = createCompetitionGame()
  const opponent = game.teams.find((team) => team.id !== game.teamId)

  const rivalry = recordClubRivalryMatch(
    game,
    opponent.id,
    opponent.name,
    1,
    1,
    false,
    'regional-cup',
    2,
    game.teamId,
  )

  assert.equal(rivalry.draws, 0)
  assert.equal(rivalry.wins, 1)
  assert.equal(rivalry.recentMatches[0].competition, 'regional-cup')
})

test('academy stories target the selected junior and apply development effects', () => {
  const game = createCompetitionGame()
  game.round = 3
  game.academyPlayers = [{
    ...game.squad[0],
    id: 'test-academy-player',
    age: 16,
    skill: 25,
    potential: 60,
    morale: 60,
    value: 10_000,
  }]
  const originalRandom = Math.random
  let next
  try {
    Math.random = () => 0
    const [year, month, day] = game.currentDate.split('-').map(Number)
    const nextDate = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10)
    next = simulateCalendarDay(game, nextDate).game
  } finally {
    Math.random = originalRandom
  }
  const storyMessage = next.inboxMessages.find((message) =>
    message.playerStory?.playerGroup === 'academy',
  )
  assert.ok(storyMessage)
  assert.equal(storyMessage.playerStory.playerId, 'test-academy-player')

  const withoutFunds = structuredClone(next)
  withoutFunds.cash = 0
  const rejected = resolvePlayerStory(withoutFunds, storyMessage.id, 'academy-individual-session')
  assert.notEqual(rejected.error, '')
  assert.equal(rejected.game.academyPlayers[0].skill, 25)

  const resolved = resolvePlayerStory(next, storyMessage.id, 'academy-individual-session')
  assert.equal(resolved.error, '')
  assert.equal(resolved.game.academyPlayers[0].skill, 27)
  assert.equal(resolved.game.academyPlayers[0].morale, 65)
  assert.equal(resolved.game.cash, next.cash - 15_000)
  assert.equal(resolved.game.inboxMessages.find((message) => message.id === storyMessage.id).playerStory.selectedChoiceId, 'academy-individual-session')
})

test('transfer negotiations allow a revised bid before accepting the final counteroffer', () => {
  const game = createCompetitionGame()
  game.round = 1
  assert.equal(getTransferWindowInfo(game).isOpen, true)
  game.cash = 1_000_000_000
  const target = Object.entries(game.clubSquads)
    .flatMap(([clubId, offers]) => offers.map((offer) => ({ clubId, offer, offers })))
    .find(({ offers, offer }) => {
      const ranked = [...offers].sort((first, second) => second.player.skill - first.player.skill)
      const rank = ranked.findIndex((entry) => entry.player.id === offer.player.id)
      let multiplier = rank === 0 ? 1.25 : rank <= 2 ? 1.15 : rank <= 5 ? 1.07 : 1
      if (offer.player.age <= 21 && offer.player.potential - offer.player.skill >= 10) multiplier *= 1.1
      if ((offer.player.contractSeasonsRemaining ?? 2) >= 3) multiplier *= 1.08
      if ((offer.player.contractSeasonsRemaining ?? 2) <= 1) multiplier *= 0.9
      const minimum = Math.ceil(offer.askingPrice * multiplier / 1000) * 1000
      return minimum > 0 && minimum <= game.cash && offers.length > 10
    })
  assert.ok(target)

  const ranked = [...target.offers].sort((first, second) => second.player.skill - first.player.skill)
  const rank = ranked.findIndex((entry) => entry.player.id === target.offer.player.id)
  let multiplier = rank === 0 ? 1.25 : rank <= 2 ? 1.15 : rank <= 5 ? 1.07 : 1
  if (target.offer.player.age <= 21 && target.offer.player.potential - target.offer.player.skill >= 10) multiplier *= 1.1
  if ((target.offer.player.contractSeasonsRemaining ?? 2) >= 3) multiplier *= 1.08
  if ((target.offer.player.contractSeasonsRemaining ?? 2) <= 1) multiplier *= 0.9
  const minimum = Math.ceil(target.offer.askingPrice * multiplier / 1000) * 1000

  const initialOffer = Math.floor(minimum * 0.8 / 1000) * 1000
  const submitted = proposeClubTransfer(game, target.clubId, target.offer.player.id, initialOffer)
  assert.equal(submitted.error, '')
  const negotiation = submitted.game.transferNegotiations[0]
  assert.equal(negotiation.status, 'countered')
  assert.equal(negotiation.counterAmount, minimum)

  const firstRevisedBid = Math.floor(minimum * 0.85 / 1000) * 1000
  const firstResponse = respondToClubTransferCounteroffer(submitted.game, negotiation.id, firstRevisedBid)
  assert.equal(firstResponse.error, '')
  const revisedCounter = firstResponse.game.transferNegotiations.find((item) => item.id === negotiation.id)
  assert.equal(revisedCounter.counterRounds, 1)
  assert.ok(revisedCounter.counterAmount < minimum)

  const secondRevisedBid = Math.floor(minimum * 0.9 / 1000) * 1000
  const secondResponse = respondToClubTransferCounteroffer(firstResponse.game, negotiation.id, secondRevisedBid)
  assert.equal(secondResponse.error, '')
  const finalCounter = secondResponse.game.transferNegotiations.find((item) => item.id === negotiation.id)
  assert.equal(finalCounter.counterRounds, 2)
  assert.ok(finalCounter.counterAmount < revisedCounter.counterAmount)
  assert.ok(finalCounter.counterAmount > secondRevisedBid)

  const thirdRevisedBid = Math.floor(minimum * 0.91 / 1000) * 1000
  const declined = respondToClubTransferCounteroffer(secondResponse.game, negotiation.id, thirdRevisedBid)
  assert.equal(declined.error, '')
  assert.equal(declined.game.transferNegotiations.find((item) => item.id === negotiation.id).status, 'rejected')

  const accepted = acceptClubTransferCounteroffer(secondResponse.game, negotiation.id)
  assert.equal(accepted.error, '')
  assert.ok(accepted.game.squad.some((player) => player.id === target.offer.player.id))
  assert.equal(accepted.game.transferNegotiations.find((item) => item.id === negotiation.id).status, 'accepted')
})

test('AI transfer offer can be countered and accepted with both squads updated', () => {
  const game = createCompetitionGame()
  const player = game.squad[0]
  player.morale = 20
  player.transferRequest = true
  const buyer = opponentTeams[0]
  const offer = {
    id: 'test-incoming-offer',
    clubId: buyer.id,
    playerId: player.id,
    offeredAmount: 100_000,
    status: 'pending',
    windowId: `${game.season}-letnie`,
    createdRound: 1,
  }
  game.incomingTransferOffers = [offer]
  game.inboxMessages = [{
    id: 'test-incoming-offer-mail',
    sender: buyer.name,
    subject: 'Oferta transferowa',
    body: 'Test',
    date: game.currentDate,
    read: true,
    category: 'transfer',
    status: 'offered',
    relatedTransferOfferId: offer.id,
  }]
  const previousCash = game.cash
  const countered = respondToIncomingTransferOffer(game, offer.id, 'counter', 1_000_000_000)
  assert.equal(countered.error, '')
  assert.equal(countered.game.incomingTransferOffers[0].status, 'countered')
  assert.ok(countered.game.incomingTransferOffers[0].counterAmount > offer.offeredAmount)

  const accepted = respondToIncomingTransferOffer(countered.game, offer.id, 'accept')
  assert.equal(accepted.error, '')
  const negotiation = accepted.game.incomingTransferOffers[0]
  assert.equal(negotiation.status, 'player-negotiation')
  assert.ok(negotiation.playerWageDemand > player.wage)
  assert.ok(negotiation.playerContractSeasons >= 2)
  assert.equal(accepted.game.squad.some((item) => item.id === player.id), true)
  assert.equal(accepted.game.inboxMessages[0].status, 'player-negotiation')

  const finalized = respondToIncomingTransferOffer(accepted.game, offer.id, 'accept-player-terms')
  assert.equal(finalized.error, '')
  assert.equal(finalized.game.incomingTransferOffers[0].status, 'accepted')
  assert.ok(finalized.game.cash > previousCash)
  assert.equal(finalized.game.squad.some((item) => item.id === player.id), false)
  const transferred = finalized.game.clubSquads[buyer.id].find((item) => item.player.id === player.id).player
  assert.equal(transferred.wage, negotiation.playerWageDemand)
  assert.equal(transferred.contractSeasonsRemaining, negotiation.playerContractSeasons)
  assert.equal(finalized.game.inboxMessages[0].status, 'accepted')
})

test('a player may refuse a transfer to an unattractive destination', () => {
  const game = createCompetitionGame()
  const player = game.squad[0]
  player.morale = 100
  player.personality = 'loyal'
  player.transferRequest = false
  const buyer = [...opponentTeams].sort((first, second) => first.strength - second.strength)[0]
  const buyerTeam = game.teams.find((team) => team.id === buyer.id)
  buyerTeam.strength = game.teams.find((team) => team.id === game.teamId).strength - 50
  const offer = {
    id: 'test-player-refusal',
    clubId: buyer.id,
    playerId: player.id,
    offeredAmount: 100_000,
    status: 'pending',
    windowId: `${game.season}-letnie`,
    createdRound: 1,
  }
  game.incomingTransferOffers = [offer]
  game.inboxMessages = [{
    id: 'test-player-refusal-mail',
    sender: buyer.name,
    subject: 'Oferta transferowa',
    body: 'Test',
    date: game.currentDate,
    read: true,
    category: 'transfer',
    status: 'offered',
    relatedTransferOfferId: offer.id,
  }]

  const refused = respondToIncomingTransferOffer(game, offer.id, 'accept')
  assert.equal(refused.error, '')
  assert.equal(refused.game.incomingTransferOffers[0].status, 'rejected')
  assert.equal(refused.game.squad.some((item) => item.id === player.id), true)
  assert.match(refused.game.inboxMessages[0].body, /nie chce odejść/)
})

test('withdrawing from a player contract negotiation keeps the player and lowers morale', () => {
  const game = createCompetitionGame()
  const player = game.squad[0]
  player.morale = 35
  player.transferRequest = true
  const buyer = opponentTeams[0]
  const offer = {
    id: 'test-player-withdrawal',
    clubId: buyer.id,
    playerId: player.id,
    offeredAmount: 100_000,
    status: 'pending',
    windowId: `${game.season}-letnie`,
    createdRound: 1,
  }
  game.incomingTransferOffers = [offer]
  game.inboxMessages = [{
    id: 'test-player-withdrawal-mail',
    sender: buyer.name,
    subject: 'Oferta transferowa',
    body: 'Test',
    date: game.currentDate,
    read: true,
    category: 'transfer',
    status: 'offered',
    relatedTransferOfferId: offer.id,
  }]

  const negotiation = respondToIncomingTransferOffer(game, offer.id, 'accept')
  assert.equal(negotiation.error, '')
  assert.equal(negotiation.game.incomingTransferOffers[0].status, 'player-negotiation')
  const withdrawn = respondToIncomingTransferOffer(negotiation.game, offer.id, 'reject-player-terms')
  assert.equal(withdrawn.error, '')
  assert.equal(withdrawn.game.incomingTransferOffers[0].status, 'rejected')
  assert.ok(withdrawn.game.squad.some((item) => item.id === player.id))
  assert.equal(withdrawn.game.squad.find((item) => item.id === player.id).morale, player.morale - 5)
})

test('player contract counteroffers can reach a compromise or end after two rounds', () => {
  const game = createCompetitionGame()
  const player = game.squad[0]
  player.morale = 20
  player.transferRequest = true
  const buyer = opponentTeams[0]
  const offer = {
    id: 'test-player-contract-counter',
    clubId: buyer.id,
    playerId: player.id,
    offeredAmount: 100_000,
    status: 'pending',
    windowId: `${game.season}-letnie`,
    createdRound: 1,
  }
  game.incomingTransferOffers = [offer]
  game.inboxMessages = [{
    id: 'test-player-contract-counter-mail',
    sender: buyer.name,
    subject: 'Oferta transferowa',
    body: 'Test',
    date: game.currentDate,
    read: true,
    category: 'transfer',
    status: 'offered',
    relatedTransferOfferId: offer.id,
  }]

  const started = respondToIncomingTransferOffer(game, offer.id, 'accept')
  const initialTerms = started.game.incomingTransferOffers[0]
  const countered = respondToIncomingTransferOffer(
    started.game,
    offer.id,
    'counter-player-terms',
    undefined,
    player.wage,
    1,
  )
  assert.equal(countered.error, '')
  assert.equal(countered.game.incomingTransferOffers[0].status, 'player-negotiation')
  assert.equal(countered.game.incomingTransferOffers[0].playerNegotiationRounds, 1)
  assert.ok(countered.game.incomingTransferOffers[0].playerWageDemand < initialTerms.playerWageDemand)
  assert.ok(countered.game.incomingTransferOffers[0].playerContractSeasons <= initialTerms.playerContractSeasons)

  const revisedDemand = countered.game.incomingTransferOffers[0]
  const compromise = respondToIncomingTransferOffer(
    countered.game,
    offer.id,
    'counter-player-terms',
    undefined,
    revisedDemand.playerWageDemand,
    revisedDemand.playerContractSeasons,
  )
  assert.equal(compromise.error, '')
  assert.equal(compromise.game.incomingTransferOffers[0].status, 'accepted')
  assert.equal(compromise.game.clubSquads[buyer.id].find((item) => item.player.id === player.id).player.wage, revisedDemand.playerWageDemand)

  const retryGame = createCompetitionGame()
  const retryPlayer = retryGame.squad[0]
  retryPlayer.morale = 20
  retryPlayer.transferRequest = true
  const retryOffer = { ...offer, id: 'test-player-contract-retry', playerId: retryPlayer.id }
  retryGame.incomingTransferOffers = [retryOffer]
  retryGame.inboxMessages = [{
    id: 'test-player-contract-retry-mail',
    sender: buyer.name,
    subject: 'Oferta transferowa',
    body: 'Test',
    date: retryGame.currentDate,
    read: true,
    category: 'transfer',
    status: 'offered',
    relatedTransferOfferId: retryOffer.id,
  }]
  const retryStarted = respondToIncomingTransferOffer(retryGame, retryOffer.id, 'accept')
  const firstCounter = respondToIncomingTransferOffer(
    retryStarted.game,
    retryOffer.id,
    'counter-player-terms',
    undefined,
    retryPlayer.wage,
    1,
  )
  const lastCounter = respondToIncomingTransferOffer(
    firstCounter.game,
    retryOffer.id,
    'counter-player-terms',
    undefined,
    retryPlayer.wage,
    1,
  )
  assert.equal(lastCounter.error, '')
  assert.equal(lastCounter.game.incomingTransferOffers[0].status, 'rejected')
  assert.ok(lastCounter.game.squad.some((item) => item.id === retryPlayer.id))
})

test('AI clubs can send a transfer offer during an open window', () => {
  const game = createCompetitionGame()
  const player = game.squad[0]
  player.skill = game.teams.find((team) => team.id === game.teamId).strength + 10
  player.value = 500_000
  player.age = 23
  player.transferRequest = true
  const originalRandom = Math.random
  try {
    Math.random = () => 0.1
    createAiIncomingTransferOffer(game, 1, { name: 'letnie', openRound: 1, closeRound: 4 })
  } finally {
    Math.random = originalRandom
  }
  assert.equal(game.incomingTransferOffers.length, 1)
  const offer = game.incomingTransferOffers[0]
  assert.ok(game.squad.some((item) => item.id === offer.playerId))
  assert.ok(game.inboxMessages.some((message) => message.relatedTransferOfferId === offer.id))
})

test('AI clubs can compete for the same player and their contract terms are comparable', () => {
  const game = createCompetitionGame()
  const userTeam = game.teams.find((team) => team.id === game.teamId)
  const player = game.squad[0]
  for (const squadPlayer of game.squad) {
    squadPlayer.morale = 100
    squadPlayer.transferRequest = false
    squadPlayer.skill = 1
  }
  player.morale = 25
  player.transferRequest = true
  player.skill = userTeam.strength + 10
  player.value = 500_000
  player.age = 23

  const originalRandom = Math.random
  try {
    Math.random = () => 0.1
    createAiIncomingTransferOffer(game, 1, { name: 'letnie', openRound: 1, closeRound: 4 })
    createAiIncomingTransferOffer(game, 2, { name: 'letnie', openRound: 1, closeRound: 4 })
  } finally {
    Math.random = originalRandom
  }

  assert.equal(game.incomingTransferOffers.length, 2)
  assert.ok(game.incomingTransferOffers.every((offer) => offer.playerId === player.id))
  assert.notEqual(game.incomingTransferOffers[0].clubId, game.incomingTransferOffers[1].clubId)
  assert.ok(game.incomingTransferOffers.every((offer) => offer.estimatedPlayerWage >= player.wage))
  assert.ok(game.incomingTransferOffers.every((offer) => offer.estimatedPlayerContractSeasons >= 2))
})

test('offering a player to selected clubs returns linked transfer bids in the inbox', () => {
  const game = createCompetitionGame()
  const player = game.squad[0]
  player.value = 100_000
  player.morale = 30
  player.transferRequest = true
  const [firstBuyer, secondBuyer] = opponentTeams
  const result = offerPlayerToClubs(game, player.id, 50_000, [firstBuyer.id, secondBuyer.id])
  assert.equal(result.error, '')
  assert.equal(result.game.outgoingPlayerTransferListings.length, 1)
  const listing = result.game.outgoingPlayerTransferListings[0]
  assert.deepEqual(listing.clubIds, [firstBuyer.id, secondBuyer.id])
  assert.equal(listing.askingAmount, 50_000)
  assert.equal(listing.offerIds.length, 2)
  assert.ok(result.game.inboxMessages.filter((message) => message.relatedOutgoingListingId === listing.id).length >= 2)
  assert.ok(listing.offerIds.every((id) =>
    result.game.incomingTransferOffers.some((offer) => offer.id === id && offer.outgoingListingId === listing.id),
  ))

  const transferNegotiation = respondToIncomingTransferOffer(result.game, listing.offerIds[0], 'accept')
  assert.equal(transferNegotiation.error, '')
  assert.equal(transferNegotiation.game.incomingTransferOffers.find((offer) => offer.id === listing.offerIds[0]).status, 'player-negotiation')
  const finalized = respondToIncomingTransferOffer(transferNegotiation.game, listing.offerIds[0], 'accept-player-terms')
  assert.equal(finalized.error, '')
  assert.equal(finalized.game.outgoingPlayerTransferListings[0].status, 'completed')
  assert.equal(finalized.game.squad.some((item) => item.id === player.id), false)
})

test('active player listings can update asking price and add new clubs', () => {
  const game = createCompetitionGame()
  const player = game.squad[0]
  player.value = 100_000
  player.morale = 30
  player.transferRequest = true
  const [firstBuyer, secondBuyer] = opponentTeams
  const initial = offerPlayerToClubs(game, player.id, 50_000, [firstBuyer.id])
  assert.equal(initial.error, '')
  const originalListing = initial.game.outgoingPlayerTransferListings[0]
  const originalOffer = initial.game.incomingTransferOffers.find((offer) => offer.id === originalListing.offerIds[0])

  const priceUpdated = offerPlayerToClubs(initial.game, player.id, 80_000, [])
  assert.equal(priceUpdated.error, '')
  assert.equal(priceUpdated.game.outgoingPlayerTransferListings[0].id, originalListing.id)
  assert.equal(priceUpdated.game.outgoingPlayerTransferListings[0].askingAmount, 80_000)
  assert.equal(priceUpdated.game.incomingTransferOffers.find((offer) => offer.id === originalOffer.id).offeredAmount, originalOffer.offeredAmount)

  const extended = offerPlayerToClubs(priceUpdated.game, player.id, 80_000, [secondBuyer.id])
  assert.equal(extended.error, '')
  const listing = extended.game.outgoingPlayerTransferListings[0]
  assert.equal(listing.id, originalListing.id)
  assert.deepEqual(listing.clubIds, [firstBuyer.id, secondBuyer.id])
  assert.equal(listing.offerIds.length, 2)
  assert.ok(listing.offerIds.every((id) =>
    extended.game.incomingTransferOffers.some((offer) => offer.id === id && offer.outgoingListingId === listing.id),
  ))
})

test('withdrawing a listed player closes related negotiations and improves morale', () => {
  const game = createCompetitionGame()
  const player = game.squad[0]
  player.value = 100_000
  player.morale = 40
  player.transferRequest = true
  const [firstBuyer, secondBuyer] = opponentTeams
  const listingResult = offerPlayerToClubs(game, player.id, 50_000, [firstBuyer.id, secondBuyer.id])
  assert.equal(listingResult.error, '')
  const listing = listingResult.game.outgoingPlayerTransferListings[0]
  const countered = respondToIncomingTransferOffer(listingResult.game, listing.offerIds[0], 'counter', 1_000_000_000)
  assert.equal(countered.error, '')
  assert.equal(countered.game.incomingTransferOffers[0].status, 'countered')
  const moraleBefore = countered.game.squad.find((item) => item.id === player.id).morale

  const withdrawn = withdrawOutgoingPlayerTransferListing(countered.game, listing.id)
  assert.equal(withdrawn.error, '')
  assert.equal(withdrawn.game.outgoingPlayerTransferListings[0].status, 'cancelled')
  assert.ok(withdrawn.game.incomingTransferOffers.every((offer) => offer.status === 'rejected'))
  assert.ok(withdrawn.game.inboxMessages.filter((message) => message.relatedTransferOfferId).every((message) => message.status === 'rejected'))
  assert.equal(withdrawn.game.squad.find((item) => item.id === player.id).morale, Math.min(100, moraleBefore + 5))
  assert.equal(withdrawn.game.squad.find((item) => item.id === player.id).transferRequest, false)

  const repeated = withdrawOutgoingPlayerTransferListing(withdrawn.game, listing.id)
  assert.notEqual(repeated.error, '')
  assert.equal(repeated.game, withdrawn.game)
})

test('unanswered offers expire on deadline and affect player morale only once', () => {
  const game = createCompetitionGame()
  const player = game.squad[0]
  player.morale = 28
  const [firstBuyer, secondBuyer] = opponentTeams
  game.incomingTransferOffers = [firstBuyer, secondBuyer].map((club, index) => ({
    id: `test-expiring-offer-${index}`,
    clubId: club.id,
    playerId: player.id,
    offeredAmount: 100_000 + index * 10_000,
    status: 'pending',
    windowId: `${game.season}-letnie`,
    createdRound: 1,
    expiresAfterRound: 3,
  }))
  game.inboxMessages = game.incomingTransferOffers.map((offer, index) => ({
    id: `test-expiring-mail-${index}`,
    sender: [firstBuyer, secondBuyer][index].name,
    subject: 'Oferta transferowa',
    body: 'Test',
    date: game.currentDate,
    read: true,
    category: 'transfer',
    status: 'offered',
    relatedTransferOfferId: offer.id,
  }))

  resolveIncomingTransferOfferDeadlines(game, 2)
  assert.ok(game.incomingTransferOffers.every((offer) => offer.status === 'pending'))
  assert.equal(player.morale, 28)

  resolveIncomingTransferOfferDeadlines(game, 3)
  assert.ok(game.incomingTransferOffers.every((offer) => offer.status === 'rejected'))
  assert.ok(game.inboxMessages.every((message) => message.status === 'rejected' && /wygasła/.test(message.body)))
  assert.equal(player.morale, 24)
  assert.equal(player.transferRequest, true)
  assert.equal(game.mediaPosts.filter((post) => post.headline.includes('rozczarowany niedokończonymi rozmowami')).length, 1)
})

test('promising a player to stay rejects an AI offer and prevents an immediate sale', () => {
  const game = createCompetitionGame()
  const player = game.squad[0]
  const buyer = opponentTeams[0]
  const offer = {
    id: 'test-stay-offer',
    clubId: buyer.id,
    playerId: player.id,
    offeredAmount: 100_000,
    status: 'pending',
    windowId: `${game.season}-letnie`,
    createdRound: 1,
  }
  game.incomingTransferOffers = [offer]
  game.inboxMessages = [{
    id: 'test-stay-mail',
    sender: buyer.name,
    subject: 'Oferta transferowa',
    body: 'Test',
    date: game.currentDate,
    read: true,
    category: 'transfer',
    status: 'offered',
    relatedTransferOfferId: offer.id,
  }]
  const promised = respondToIncomingTransferOffer(game, offer.id, 'promise-stay')
  assert.equal(promised.error, '')
  assert.equal(promised.game.incomingTransferOffers[0].status, 'rejected')
  assert.equal(promised.game.squad[0].moralePromise.kind, 'stay')
  assert.match(sellPlayer(promised.game, player.id).error, /obietnicy/)
})
