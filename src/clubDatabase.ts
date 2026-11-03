import type { LeagueId, Position } from './game.ts'

export type ClubDatabasePlayer = {
  id: string
  firstName: string
  lastName: string
  age: number
  position: Position
  skill: number
  potential?: number
  value?: number
  wage?: number
  portraitDataUrl?: string
}

export type ClubDatabaseClub = {
  id: string
  name: string
  city: string
  regionId?: string
  crestDataUrl?: string
  players: ClubDatabasePlayer[]
}

export type ClubDatabaseLeague = {
  id: LeagueId
  clubs: ClubDatabaseClub[]
}

export type ClubDatabase = {
  id: string
  format: 'pmp27-club-database'
  version: 1
  name: string
  leagues: ClubDatabaseLeague[]
}

const databaseStoragePrefix = 'pmp27-club-database-'
const activeDatabaseStorageKey = 'pmp27-active-club-database'
const databaseCache = new Map<string, ClubDatabase>()
const supportedPositions: Position[] = ['BR', 'PO', 'ŚO', 'LO', 'DP', 'ŚP', 'OP', 'PP', 'LP', 'PN', 'LN', 'ŚN']
const supportedImageDataUrl = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/

export function normalizeClubNameKey(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[łŁ]/g, (char) => (char === 'ł' ? 'l' : 'L'))
    .replace(/[ąĄ]/g, (char) => (char === 'ą' ? 'a' : 'A'))
    .replace(/[ćĆ]/g, (char) => (char === 'ć' ? 'c' : 'C'))
    .replace(/[ęĘ]/g, (char) => (char === 'ę' ? 'e' : 'E'))
    .replace(/[ńŃ]/g, (char) => (char === 'ń' ? 'n' : 'N'))
    .replace(/[óÓ]/g, (char) => (char === 'ó' ? 'o' : 'O'))
    .replace(/[śŚ]/g, (char) => (char === 'ś' ? 's' : 'S'))
    .replace(/[źŹ]/g, (char) => (char === 'ź' ? 'z' : 'Z'))
    .replace(/[żŻ]/g, (char) => (char === 'ż' ? 'z' : 'Z'))
    .toLocaleLowerCase('pl-PL')
    .replace(/\s+/g, ' ')
    .trim()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredText(value: unknown, label: string, maximumLength = 100) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximumLength) {
    throw new Error(`${label}: wpisz tekst o długości od 1 do ${maximumLength} znaków.`)
  }
  return value.trim()
}

function optionalImage(value: unknown, label: string) {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string' || value.length > 500_000 || !supportedImageDataUrl.test(value)) {
    throw new Error(`${label}: użyj obrazu PNG, JPEG lub WebP osadzonego jako Base64 (maks. 500 KB).`)
  }
  return value
}

function createDatabaseId() {
  return `database-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function validatePlayer(value: unknown, label: string): ClubDatabasePlayer {
  if (!isRecord(value)) throw new Error(`${label}: nieprawidłowe dane zawodnika.`)
  const id = requiredText(value.id, `${label}.id`, 80)
  const firstName = requiredText(value.firstName, `${label}.firstName`, 40)
  const lastName = requiredText(value.lastName, `${label}.lastName`, 60)
  const age = value.age
  const skill = value.skill
  if (!Number.isInteger(age) || (age as number) < 15 || (age as number) > 45) {
    throw new Error(`${label}.age: wiek musi być liczbą całkowitą od 15 do 45.`)
  }
  if (!supportedPositions.includes(value.position as Position)) {
    throw new Error(`${label}.position: nieobsługiwana pozycja zawodnika.`)
  }
  if (!Number.isInteger(skill) || (skill as number) < 1 || (skill as number) > 99) {
    throw new Error(`${label}.skill: umiejętność musi być liczbą całkowitą od 1 do 99.`)
  }
  const potential = value.potential
  const playerValue = value.value
  const wage = value.wage
  if (potential !== undefined && (!Number.isInteger(potential) || (potential as number) < (skill as number) || (potential as number) > 99)) {
    throw new Error(`${label}.potential: potencjał musi być liczbą od umiejętności zawodnika do 99.`)
  }
  if (playerValue !== undefined && (!Number.isInteger(playerValue) || (playerValue as number) < 0)) {
    throw new Error(`${label}.value: wartość musi być nieujemną liczbą całkowitą.`)
  }
  if (wage !== undefined && (!Number.isInteger(wage) || (wage as number) < 0)) {
    throw new Error(`${label}.wage: pensja musi być nieujemną liczbą całkowitą.`)
  }
  return {
    id,
    firstName,
    lastName,
    age: age as number,
    position: value.position as Position,
    skill: skill as number,
    potential: potential as number | undefined,
    value: playerValue as number | undefined,
    wage: wage as number | undefined,
    portraitDataUrl: optionalImage(value.portraitDataUrl, `${label}.portraitDataUrl`),
  }
}

export function parseClubDatabase(
  raw: string,
  allowedLeagueIds: LeagueId[],
  expectedClubCounts: Partial<Record<LeagueId, number>>,
  allowedRegions: Partial<Record<LeagueId, string[]>>,
): ClubDatabase {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    throw new Error('Plik bazy musi zawierać poprawny dokument JSON.')
  }
  if (!isRecord(value) || value.format !== 'pmp27-club-database' || value.version !== 1) {
    throw new Error('Nieobsługiwany format pliku. Oczekiwano pmp27-club-database w wersji 1.')
  }
  const name = requiredText(value.name, 'name', 80)
  if (!Array.isArray(value.leagues) || value.leagues.length === 0) {
    throw new Error('Baza musi zawierać co najmniej jedną ligę.')
  }
  const seenLeagueIds = new Set<string>()
  const seenClubIds = new Set<string>()
  const leagues = value.leagues.map((leagueValue, leagueIndex): ClubDatabaseLeague => {
    const label = `leagues[${leagueIndex}]`
    if (!isRecord(leagueValue) || typeof leagueValue.id !== 'string' || !allowedLeagueIds.includes(leagueValue.id as LeagueId)) {
      throw new Error(`${label}.id: wskazano ligę, której gra nie obsługuje.`)
    }
    const id = leagueValue.id as LeagueId
    if (seenLeagueIds.has(id)) throw new Error(`Liga ${id} występuje w bazie więcej niż raz.`)
    seenLeagueIds.add(id)
    if (!Array.isArray(leagueValue.clubs)) throw new Error(`${label}.clubs: oczekiwano listy klubów.`)
    const expectedCount = expectedClubCounts[id]
    if (expectedCount !== undefined && leagueValue.clubs.length !== expectedCount) {
      throw new Error(`Liga ${id} musi zawierać dokładnie ${expectedCount} klubów.`)
    }
    const seenClubNames = new Set<string>()
    const clubs = leagueValue.clubs.map((clubValue, clubIndex): ClubDatabaseClub => {
      const clubLabel = `${label}.clubs[${clubIndex}]`
      if (!isRecord(clubValue)) throw new Error(`${clubLabel}: nieprawidłowe dane klubu.`)
      const clubId = requiredText(clubValue.id, `${clubLabel}.id`, 80)
      if (clubId === 'your-club' || seenClubIds.has(clubId)) {
        throw new Error(`${clubLabel}.id: identyfikator klubu musi być unikalny w całej bazie.`)
      }
      seenClubIds.add(clubId)
      const clubName = requiredText(clubValue.name, `${clubLabel}.name`, 80)
      const normalizedName = normalizeClubNameKey(clubName)
      if (seenClubNames.has(normalizedName)) throw new Error(`Nazwa klubu „${clubName}” powtarza się w lidze ${id}.`)
      seenClubNames.add(normalizedName)
      if (!Array.isArray(clubValue.players) || clubValue.players.length < 11 || clubValue.players.length > 40) {
        throw new Error(`${clubLabel}.players: klub musi mieć od 11 do 40 zawodników.`)
      }
      const seenPlayerIds = new Set<string>()
      const players = clubValue.players.map((playerValue, playerIndex) => {
        const player = validatePlayer(playerValue, `${clubLabel}.players[${playerIndex}]`)
        if (seenPlayerIds.has(player.id)) throw new Error(`${clubLabel}.players: identyfikator zawodnika ${player.id} powtarza się.`)
        seenPlayerIds.add(player.id)
        return player
      })
      const regionId = clubValue.regionId === undefined ? undefined : requiredText(clubValue.regionId, `${clubLabel}.regionId`, 80)
      if (regionId && !allowedRegions[id]?.includes(regionId)) {
        throw new Error(`${clubLabel}.regionId: wskazano region nieobsługiwany w lidze ${id}.`)
      }
      return {
        id: clubId,
        name: clubName,
        city: requiredText(clubValue.city, `${clubLabel}.city`, 80),
        regionId,
        crestDataUrl: optionalImage(clubValue.crestDataUrl, `${clubLabel}.crestDataUrl`),
        players,
      }
    })
    return { id, clubs }
  })
  return {
    id: createDatabaseId(),
    format: 'pmp27-club-database',
    version: 1,
    name,
    leagues,
  }
}

export function getImportedClub(database: ClubDatabase | undefined, leagueId: LeagueId, clubId: string) {
  return database?.leagues.find((league) => league.id === leagueId)?.clubs.find((club) => club.id === clubId)
}

export function findImportedClubByTeamId(database: ClubDatabase | undefined, teamId: string) {
  const prefix = 'database-team-'
  if (!teamId.startsWith(prefix)) return undefined
  const clubId = teamId.slice(prefix.length)
  return database?.leagues.flatMap((league) => league.clubs).find((club) => club.id === clubId)
}

export function findImportedClubByName(database: ClubDatabase | undefined, leagueId: LeagueId, name: string) {
  const normalizedName = normalizeClubNameKey(name)
  return database?.leagues.find((league) => league.id === leagueId)?.clubs.find((club) =>
    normalizeClubNameKey(club.name) === normalizedName,
  )
}

export function getDatabaseLeagueClubs(database: ClubDatabase | undefined, leagueId: LeagueId) {
  return database?.leagues.find((league) => league.id === leagueId)?.clubs
}

export function getStoredClubDatabase(id: string | undefined) {
  if (!id) return undefined
  const cached = databaseCache.get(id)
  if (cached) return cached
  if (typeof localStorage === 'undefined') return undefined
  const raw = localStorage.getItem(`${databaseStoragePrefix}${id}`)
  if (!raw) return undefined
  const value: unknown = JSON.parse(raw)
  if (!isRecord(value) || value.id !== id || value.format !== 'pmp27-club-database' || value.version !== 1 || !Array.isArray(value.leagues)) {
    throw new Error('Zapisana baza klubów jest uszkodzona. Wczytaj plik bazy ponownie.')
  }
  const database = value as ClubDatabase
  databaseCache.set(id, database)
  return database
}

export function loadActiveClubDatabase() {
  if (typeof localStorage === 'undefined') return undefined
  const activeId = localStorage.getItem(activeDatabaseStorageKey)
  return activeId ? getStoredClubDatabase(activeId) : undefined
}

export function saveActiveClubDatabase(database: ClubDatabase) {
  if (typeof localStorage === 'undefined') throw new Error('Przeglądarka nie udostępnia lokalnego zapisu baz danych.')
  localStorage.setItem(`${databaseStoragePrefix}${database.id}`, JSON.stringify(database))
  localStorage.setItem(activeDatabaseStorageKey, database.id)
  databaseCache.set(database.id, database)
}

export function detachActiveClubDatabase() {
  if (typeof localStorage === 'undefined') throw new Error('Przeglądarka nie udostępnia lokalnego zapisu baz danych.')
  localStorage.removeItem(activeDatabaseStorageKey)
}
