import { useEffect, useState, type ReactNode } from 'react'
import {
  Activity,
  Building2,
  CalendarDays,
  Check,
  Clock3,
  Coins,
  Eye,
  Flag,
  Landmark,
  MapPin,
  Newspaper,
  Search,
  ShoppingBag,
  Target,
  TrendingUp,
  Trophy,
  Users,
  UsersRound,
} from 'lucide-react'
import {
  buildFacility,
  academyStages,
  claimClubChallengeRewards,
  getClubChallenges,
  getClub,
  getClubRivalries,
  getClubRivalryLevel,
  getLeagueChampionTrophyName,
  getFacilityConstructionCost,
  getFacilityConstructionDurationMs,
  getManagerCareerProfile,
  getNextStadiumStage,
  getLeagueTable,
  getStadiumStage,
  getStadiumStageIndex,
  leagues,
  stadiumStages,
  trainingBaseStages,
  type FacilityId,
  type GameState,
  type ClubTrophy,
  type MediaPost,
  type Position,
  type SeasonRecord,
} from './game.ts'

export type DeferredSection = 'history' | 'board' | 'media' | 'club'

type DeferredPagesProps = {
  section: DeferredSection
  game: GameState
  onUpdate: (game: GameState, message?: string) => void
}

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

function formatMoney(amount: number) {
  return `${Math.round(amount).toLocaleString('pl-PL')} zł`
}

function formatMatchCount(count: number) {
  const lastTwoDigits = count % 100
  const lastDigit = count % 10
  const noun = count === 1
    ? 'mecz'
    : lastTwoDigits < 12 || lastTwoDigits > 14
      ? [2, 3, 4].includes(lastDigit) ? 'mecze' : 'meczów'
      : 'meczów'
  return `${count} ${noun}`
}

function formatCountdown(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="stat-card"><span className="stat-icon">{icon}</span><span><small>{label}</small><strong>{value}</strong></span></div>
}

function PositionBadge({ position }: { position: Position }) {
  return <span className={`position-badge position-${position}`} aria-label={positionLabels[position]} title={positionLabels[position]}>{position}</span>
}

function PlayerPositionBadges({ player }: { player: GameState['squad'][number] }) {
  return <span className="player-position-badges">
    <PositionBadge position={player.position} />
    {player.secondaryPositions?.map((position) => <PositionBadge key={position} position={position} />)}
  </span>
}

function SeasonHistoryPage({ game }: { game: GameState }) {
  const club = getClub(game)
  const table = getLeagueTable(game)
  const currentPosition = table.findIndex((team) => team.id === game.teamId) + 1
  const currentScorers = [...game.squad]
    .filter((player) => (player.seasonGoals ?? 0) > 0)
    .sort((first, second) => (second.seasonGoals ?? 0) - (first.seasonGoals ?? 0) || (second.seasonAppearances ?? 0) - (first.seasonAppearances ?? 0))
    .slice(0, 5)
  const cupScorers = [...game.squad]
    .filter((player) => (player.cupAppearances ?? 0) > 0)
    .sort((first, second) => (second.cupGoals ?? 0) - (first.cupGoals ?? 0) || (second.cupAppearances ?? 0) - (first.cupAppearances ?? 0))
    .slice(0, 5)
  const history = game.seasonHistory ?? []
  const manager = getManagerCareerProfile(game)
  const unlockedAchievements = manager.achievements.filter((achievement) => achievement.unlocked).length
  const clubRivalries = getClubRivalries(game)
  return <>
    <section className="history-hero">
      <div><p className="eyebrow">DOROBEK SPORTOWY</p><h2>Historia i statystyki klubu</h2><p>Śledź rozwój drużyny, formę strzelców i wyniki kolejnych sezonów.</p></div>
      <Trophy size={27} />
    </section>
    <div className="history-stat-grid">
      <StatCard icon={<Trophy size={18} />} label="BIEŻĄCE MIEJSCE" value={`${currentPosition}. / ${game.teams.length}`} />
      <StatCard icon={<Activity size={18} />} label="PUNKTY" value={String(club.points)} />
      <StatCard icon={<Target size={18} />} label="BILANS BRAMEK" value={`${club.goalsFor} : ${club.goalsAgainst}`} />
      <StatCard icon={<UsersRound size={18} />} label="KIBICE NA MECZACH DOMOWYCH" value={game.homeMatchesPlayed ? Math.round(game.totalHomeAttendance / game.homeMatchesPlayed).toLocaleString('pl-PL') : '—'} />
    </div>
    <section className="manager-career-panel panel-card">
      <div className="manager-career-heading">
        <div><p className="eyebrow">ROZWÓJ MENEDŻERA</p><h2>Poziom {manager.level} · {manager.levelTitle}</h2><p>Każdy sezon, zwycięstwo, awans i trofeum budują Twoją renomę. Postęp jest zapisywany w karierze.</p></div>
        <div className="manager-career-xp"><strong>{manager.experience.toLocaleString('pl-PL')}</strong><small>RENOMY</small></div>
      </div>
      <div className="manager-career-progress" role="progressbar" aria-label="Postęp do kolejnego poziomu" aria-valuenow={manager.levelProgress} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${manager.levelProgress}%` }} />
      </div>
      <div className="manager-career-progress-caption">
        <span>{manager.nextLevelExperience === null ? 'Maksymalny poziom menedżera' : `${(manager.experience - manager.currentLevelExperience).toLocaleString('pl-PL')} / ${(manager.nextLevelExperience - manager.currentLevelExperience).toLocaleString('pl-PL')} renomy do następnego poziomu`}</span>
        <strong>{unlockedAchievements} / {manager.achievements.length} odznak</strong>
      </div>
      <div className="manager-career-stats">
        <span><strong>{manager.leagueMatches}</strong><small>Mecze ligowe</small></span>
        <span><strong>{manager.leagueWins}</strong><small>Zwycięstwa</small></span>
        <span><strong>{manager.promotions}</strong><small>Awansy</small></span>
        <span><strong>{manager.trophies}</strong><small>Trofea</small></span>
        <span><strong>{manager.academyDebuts}</strong><small>Wychowankowie</small></span>
      </div>
      <div className="manager-achievement-grid">{manager.achievements.map((achievement) => <article className={`manager-achievement${achievement.unlocked ? ' manager-achievement-unlocked' : ''}`} key={achievement.id}>
        <span className="manager-achievement-icon">{achievement.unlocked ? <Trophy size={16} /> : <Target size={16} />}</span>
        <div><strong>{achievement.title}</strong><small>{achievement.description}</small><span>{achievement.unlocked ? 'Odblokowano' : `${Math.min(achievement.progress, achievement.target)} / ${achievement.target}`}</span></div>
      </article>)}</div>
    </section>
    <section className="club-rivalries panel-card">
      <div className="panel-heading">
        <div><p className="eyebrow">HISTORIA BEZPOŚREDNICH SPOTKAŃ</p><h2>Rywalizacje klubowe</h2></div>
        <span className="roster-count">{clubRivalries.length} rywali</span>
      </div>
      {clubRivalries.length
        ? <div className="club-rivalry-list">{clubRivalries.slice(0, 8).map((rivalry) => <article className="club-rivalry-card" key={rivalry.opponentId}>
          <span className="club-rivalry-icon"><Flag size={16} /></span>
          <div className="club-rivalry-copy">
            <strong>{rivalry.opponentName}</strong>
            <small>{getClubRivalryLevel(rivalry)} · {formatMatchCount(rivalry.matches)} · {rivalry.derbyMatches} derbów</small>
            <span>Bilans: {rivalry.wins}-{rivalry.draws}-{rivalry.losses} · bramki {rivalry.goalsFor}:{rivalry.goalsAgainst}</span>
          </div>
          <div className="club-rivalry-last"><small>OSTATNIO</small><strong>{rivalry.lastScore}</strong><span>{rivalry.lastMatchSeason} · {rivalry.lastMatchCompetition === 'regional-cup' ? 'Puchar regionalny' : rivalry.lastMatchCompetition === 'polish-cup' ? 'Polski Puchar' : 'liga'} · runda {rivalry.lastMatchRound}</span><b>{rivalry.recentResults.join(' ')}</b></div>
          {(rivalry.recentMatches?.length ?? 0) > 0 && <div className="club-rivalry-recent">{(rivalry.recentMatches ?? []).slice(-5).reverse().map((match, index) => <span key={`${match.season}-${match.round}-${match.competition}-${index}`}>
            {match.result} {match.score} · {match.season} · {match.competition === 'regional-cup' ? 'Puchar regionalny' : match.competition === 'polish-cup' ? 'Polski Puchar' : 'liga'}
          </span>)}</div>}
        </article>)}</div>
        : <div className="empty-state"><Flag size={20} /><span>Historia rywalizacji z klubami pojawi się po rozegraniu oficjalnych spotkań ligowych lub pucharowych.</span></div>}
      {clubRivalries.length > 8 && <p className="club-rivalry-note">Pokazano 8 rywalizacji o najwyższej intensywności.</p>}
    </section>
    <section className="panel-card trophy-cabinet">
      <div className="panel-heading">
        <div><p className="eyebrow">GABLOTA KLUBU</p><h2>Zdobyte trofea</h2></div>
        <span className="roster-count">{game.trophyCabinet?.length ?? 0} trofeów</span>
      </div>
      {(game.trophyCabinet?.length ?? 0) > 0
        ? <div className="trophy-cabinet-grid">{game.trophyCabinet?.map((trophy) => <TrophyCard key={trophy.id} trophy={trophy} />)}</div>
        : <div className="empty-state"><Trophy size={20} /><span>Pierwsze trofeum pojawi się tutaj po zdobyciu mistrzostwa lub pucharu.</span></div>}
    </section>
    <div className="history-content-grid">
      <section className="panel-card history-scorers">
        <div className="panel-heading"><div><p className="eyebrow">KLASYFIKACJA DRUŻYNY</p><h2>Najlepsi strzelcy · {game.season}</h2></div><span className="roster-count">{currentScorers.length} zawodników</span></div>
        {currentScorers.length ? <div className="history-scorer-list">{currentScorers.map((player, index) => <div className="history-scorer-row" key={player.id}><span className="history-scorer-rank">{index + 1}</span><PlayerPositionBadges player={player} /><strong>{player.firstName} {player.lastName}</strong><span>{player.seasonAppearances ?? 0} występów</span><b>{player.seasonGoals ?? 0} goli</b></div>)}</div> : <div className="empty-state"><Target size={20} /><span>Strzelcy pojawią się po pierwszym rozegranym meczu.</span></div>}
        <div className="cup-scorer-block">
          <div className="panel-heading"><div><p className="eyebrow">POLSKI PUCHAR</p><h2>Statystyki pucharowe</h2></div><span className="roster-count">{cupScorers.length} zawodników</span></div>
          {cupScorers.length ? <div className="history-scorer-list">{cupScorers.map((player, index) => <div className="history-scorer-row" key={player.id}><span className="history-scorer-rank">{index + 1}</span><PlayerPositionBadges player={player} /><strong>{player.firstName} {player.lastName}</strong><span>{player.cupAppearances ?? 0} występów</span><b>{player.cupGoals ?? 0} goli</b></div>)}</div> : <div className="empty-state"><Target size={20} /><span>Statystyki pojawią się po pierwszym meczu Polskiego Pucharu.</span></div>}
        </div>
      </section>
      <section className="panel-card history-scorers">
        <div className="panel-heading"><div><p className="eyebrow">REKORDY KARIERY</p><h2>Najwięcej występów</h2></div></div>
        {[...game.squad].sort((first, second) => (second.careerAppearances ?? 0) - (first.careerAppearances ?? 0)).slice(0, 5).map((player, index) => <div className="history-scorer-row" key={player.id}><span className="history-scorer-rank">{index + 1}</span><PositionBadge position={player.position} /><strong>{player.firstName} {player.lastName}</strong><span>{player.careerGoals ?? 0} goli</span><b>{player.careerAppearances ?? 0} meczów</b></div>)}
      </section>
    </div>
    <section className="history-archive">
      <div className="panel-heading"><div><p className="eyebrow">ARCHIWUM KLUBU</p><h2>Zakończone sezony</h2></div><span className="roster-count">{history.length} / 20 sezonów</span></div>
      {history.length ? history.map((record) => <SeasonRecordCard key={`${record.season}-${record.recordedAt}`} record={record} clubId={game.teamId} />) : <div className="empty-state"><CalendarDays size={20} /><span>Archiwum wypełni się po zakończeniu pierwszego sezonu. Aktualny sezon trwa.</span></div>}
    </section>
  </>
}

function SeasonRecordCard({ record, clubId }: { record: SeasonRecord; clubId: string }) {
  const leagueName = leagues.find((league) => league.id === record.leagueId)?.name ?? 'Liga'
  const champion = record.finalTable[0]
  return <article className="season-record-card">
    <div className="season-record-heading"><div><p className="eyebrow">{leagueName}</p><h3>Sezon {record.season}</h3></div><div className="season-record-badges"><span className="season-record-place">{record.finalPosition}. miejsce</span>{record.leagueChange && <span className={`season-record-movement season-record-movement-${record.leagueChange}`}>{record.leagueChange === 'promotion' ? 'Awans' : 'Spadek'}</span>}</div></div>
    <div className="season-record-stats"><span><small>PKT</small><strong>{record.points}</strong></span><span><small>W-R-P</small><strong>{record.wins}-{record.draws}-{record.losses}</strong></span><span><small>BRAMKI</small><strong>{record.goalsFor}:{record.goalsAgainst}</strong></span><span><small>MISTRZ</small><strong>{champion?.name ?? '—'}</strong></span></div>
    {(record.honors?.length ?? 0) > 0 && <div className="season-record-honors"><strong>Trofea sezonu</strong>{record.honors?.map((honor) => <span key={honor}><Trophy size={12} /> {honor}</span>)}</div>}
    {(record.awards?.length ?? 0) > 0 && <div className="season-record-awards"><strong>Nagrody ligi</strong>{record.awards?.map((award) => <span key={award.id}><Trophy size={13} /><span><b>{award.title}</b><small>{award.playerName} · {award.clubName} · {award.valueLabel}</small></span></span>)}</div>}
    {(record.teamOfSeason?.length ?? 0) > 0 && <div className="season-team-of-season">
      <strong>Jedenastka sezonu</strong>
      <div>{record.teamOfSeason?.map((player) => <span key={player.playerId}>
        <b>{player.position}</b>
        <span><strong>{player.name}</strong><small>{player.clubName} · {player.rating.toFixed(2)} · {player.appearances} wyst.</small></span>
      </span>)}</div>
    </div>}
    <div className="season-record-scorers"><strong>Najlepsi strzelcy</strong>{record.topScorers.length ? record.topScorers.map((scorer) => <span key={scorer.playerId}>{scorer.name} · {scorer.goals} goli / {scorer.appearances} występów</span>) : <span>Brak strzelonych bramek w zapisanych statystykach.</span>}</div>
    <details className="season-table-details"><summary>Końcowa tabela ligi</summary><div className="league-table-wrap"><table className="league-table"><thead><tr><th>#</th><th>KLUB</th><th>M</th><th>RB</th><th>PKT</th></tr></thead><tbody>{record.finalTable.map((team, index) => <tr key={team.id} className={team.id === clubId ? 'own-team-row' : ''}><td>{index + 1}</td><td>{team.name}</td><td>{team.played}</td><td>{team.goalsFor - team.goalsAgainst > 0 ? '+' : ''}{team.goalsFor - team.goalsAgainst}</td><td><strong>{team.points}</strong></td></tr>)}</tbody></table></div></details>
  </article>
}

function TrophyCard({ trophy }: { trophy: ClubTrophy }) {
  const competitionLabel = trophy.competition === 'league'
    ? trophy.leagueId === 'ekstraklasa' || /superklas/i.test(trophy.name)
      ? 'Mistrzostwo Polski'
      : 'Mistrzostwo ligi'
    : trophy.competition === 'polish-cup' ? 'Puchar krajowy' : 'Super Polski Puchar'
  const image = trophy.competition === 'polish-cup'
    ? '/images/trophies/polish-cup.png'
    : trophy.competition === 'champions-cup'
      ? '/images/trophies/super-polish-cup.png'
      : trophy.leagueId === 'ekstraklasa' || /superklas/i.test(trophy.name)
        ? '/images/trophies/league-superklasa.png'
        : '/images/trophies/league-champion.svg'
  const name = trophy.competition === 'league' && trophy.leagueId
    ? getLeagueChampionTrophyName(trophy.leagueId)
    : trophy.competition === 'league' && /superklas/i.test(trophy.name)
      ? 'Mistrz Polski'
      : trophy.name
  return <article className={`trophy-card trophy-card-${trophy.competition}`}>
    <img className="trophy-card-art" src={image} alt="" />
    <span><small>{competitionLabel} · {trophy.season}</small><strong>{name}</strong></span>
  </article>
}

function BoardPage({ game, onUpdate }: { game: GameState; onUpdate: DeferredPagesProps['onUpdate'] }) {
  const goal = game.boardGoal
  const table = getLeagueTable(game)
  const currentPosition = table.findIndex((team) => team.id === game.teamId) + 1
  const hasPlayedMatches = game.matches.some((match) => match.played)
  const confidence = game.boardConfidence ?? 65
  const reviews = game.boardHistory ?? []
  const leagueName = leagues.find((league) => league.id === game.leagueId)?.name ?? 'Liga'
  const confidenceLabel = confidence >= 70 ? 'Zarząd jest zadowolony' : confidence >= 40 ? 'Zarząd oczekuje poprawy' : 'Zaufanie zarządu jest niskie'
  const positionProgress = goal && hasPlayedMatches
    ? currentPosition <= goal.targetPosition
      ? 100
      : Math.max(0, Math.min(99, (game.teams.length - currentPosition) / Math.max(1, game.teams.length - goal.targetPosition) * 100))
    : 0
  const financeProgress = goal && goal.targetCash > 0
    ? Math.max(0, Math.min(100, game.cash / goal.targetCash * 100))
    : 100
  const clubChallenges = getClubChallenges(game)
  const completedChallengeCount = clubChallenges.filter((challenge) => challenge.completed && !challenge.claimed).length
  function collectChallengeRewards() {
    const result = claimClubChallengeRewards(game)
    if (result.error) {
      onUpdate(game, result.error)
      return
    }
    onUpdate(result.game, result.message)
  }
  return <>
    <section className="board-hero">
      <div><p className="eyebrow">RELACJE Z WŁADZAMI KLUBU</p><h2>{confidenceLabel}</h2><p>Zaufanie reaguje na wyniki zespołu i postępy w realizacji celów sezonowych. Pełne rozliczenie następuje po zakończeniu sezonu.</p></div>
      <div className="board-confidence" aria-label={`Zaufanie zarządu: ${confidence}%`}><strong>{confidence}<small>%</small></strong><span>ZAUFANIE</span></div>
    </section>
    <section className="board-goals panel-card">
      <div className="panel-heading"><div><p className="eyebrow">SEZON {goal?.season ?? game.season} · {leagueName}</p><h2>Cele zarządu</h2></div><span className="roster-count">{formatMoney(goal?.reward ?? 0)} pełna premia</span></div>
      {goal ? <div className="board-goal-grid">
        <article className="board-goal-card"><div className="board-goal-title"><span className="board-goal-icon"><Trophy size={17} /></span><div><strong>Wynik sportowy</strong><small>{goal.targetPosition === 1 ? 'Zdobądź mistrzostwo ligi.' : `Ukończ sezon w pierwszej ${goal.targetPosition} pozycjach.`}</small></div></div><div className="board-progress-track"><span className={positionProgress >= 100 ? 'board-progress-complete' : ''} style={{ width: `${positionProgress}%` }} /></div><div className="board-progress-caption"><span>{hasPlayedMatches ? `Aktualnie: ${currentPosition}. miejsce` : 'Sezon jeszcze się nie rozpoczął'}</span><strong>Cel: top {goal.targetPosition}</strong></div></article>
        <article className="board-goal-card"><div className="board-goal-title"><span className="board-goal-icon"><Coins size={17} /></span><div><strong>Stabilność finansowa</strong><small>Utrzymaj wymagane saldo do końca sezonu.</small></div></div><div className="board-progress-track"><span className={financeProgress >= 100 ? 'board-progress-complete' : ''} style={{ width: `${financeProgress}%` }} /></div><div className="board-progress-caption"><span>Saldo: {formatMoney(game.cash)}</span><strong>Cel: {formatMoney(goal.targetCash)}</strong></div></article>
      </div> : <div className="empty-state"><Target size={20} /><span>Cele zarządu zostaną wyznaczone przy rozpoczęciu sezonu.</span></div>}
      {goal && <p className="board-reward-note">Premia za oba cele: <strong>{formatMoney(goal.reward)}</strong>. Za realizację jednego celu przysługuje 40% tej kwoty. Budżet początkowy sezonu: {formatMoney(goal.startingCash)}.</p>}
    </section>
    <section className="club-challenges panel-card">
      <div className="panel-heading">
        <div><p className="eyebrow">DODATKOWE CELE · KOLEJKA {clubChallenges[0]?.round ?? game.round}</p><h2>Wyzwania klubowe</h2></div>
        <span className="roster-count">{completedChallengeCount ? `${completedChallengeCount} nagród do odbioru` : 'Premie za mecze'}</span>
      </div>
      {clubChallenges.length ? <>
        <p className="club-challenges-intro">{clubChallenges[0].matchPlayed
          ? `Wynik meczu z ${clubChallenges[0].opponentName} · ${clubChallenges[0].isHome ? 'u siebie' : 'na wyjeździe'}`
          : `Przygotuj się na mecz z ${clubChallenges[0].opponentName} · ${clubChallenges[0].isHome ? 'u siebie' : 'na wyjeździe'}`}</p>
        <div className="club-challenge-list">{clubChallenges.map((challenge) => <article className={`club-challenge-card${challenge.completed ? ' club-challenge-complete' : ''}${challenge.claimed ? ' club-challenge-claimed' : ''}`} key={challenge.id}>
          <span className="club-challenge-icon">{challenge.claimed ? <Check size={15} /> : <Target size={15} />}</span>
          <div className="club-challenge-copy"><strong>{challenge.title}</strong><small>{challenge.description}</small><span>{challenge.progress}</span></div>
          <span className="club-challenge-reward"><Coins size={13} />{challenge.claimed ? 'Odebrano' : `+${formatMoney(challenge.reward)}`}</span>
        </article>)}</div>
        {completedChallengeCount > 0 && <button className="primary-button club-challenge-collect" type="button" onClick={collectChallengeRewards}>
          Odbierz premie · {formatMoney(clubChallenges.filter((challenge) => challenge.completed && !challenge.claimed).reduce((sum, challenge) => sum + challenge.reward, 0))}
          <Coins size={15} />
        </button>}
        {!clubChallenges[0].matchPlayed && <p className="board-reward-note">Wyzwania rozliczają się po ligowym meczu. Za każde ukończone możesz odebrać jednorazową premię i wrócić po kolejne cele następnej kolejki.</p>}
      </> : <div className="empty-state"><Target size={20} /><span>Wyzwania kolejki pojawią się wraz z najbliższym meczem ligowym.</span></div>}
    </section>
    <section className="board-history">
      <div className="panel-heading"><div><p className="eyebrow">OCENY ZARZĄDU</p><h2>Poprzednie rozliczenia</h2></div><span className="roster-count">{reviews.length} / 20 sezonów</span></div>
      {reviews.length ? <div className="board-review-list">{reviews.map((review) => {
        const reviewLeague = leagues.find((league) => league.id === review.leagueId)?.name ?? 'Liga'
        const objectivesMet = Number(review.positionAchieved) + Number(review.financesAchieved)
        return <article className="board-review-card" key={`${review.season}-${review.leagueId}`}>
          <div className="board-review-heading"><div><strong>{review.season}</strong><small>{reviewLeague} · {review.finalPosition}. miejsce</small></div><span className={objectivesMet === 2 ? 'board-review-success' : objectivesMet === 1 ? 'board-review-partial' : 'board-review-failure'}>{objectivesMet}/2 cele</span></div>
          <div className="board-review-details"><span>Sportowy: {review.positionAchieved ? 'zrealizowany' : 'niezrealizowany'}</span><span>Finansowy: {review.financesAchieved ? 'zrealizowany' : 'niezrealizowany'}</span><span>Saldo końcowe: {formatMoney(review.finalCash)}</span><strong>Premia: {formatMoney(review.rewardPaid)}</strong></div>
          <div className="board-review-trust">Zmiana zaufania: <strong className={review.trustChange >= 0 ? 'board-trust-positive' : 'board-trust-negative'}>{review.trustChange > 0 ? '+' : ''}{review.trustChange}%</strong><span>Po sezonie: {review.confidenceAfter}%</span></div>
        </article>
      })}</div> : <div className="empty-state"><CalendarDays size={20} /><span>Pierwsza ocena zarządu pojawi się po zakończeniu sezonu.</span></div>}
    </section>
  </>
}

function MediaPage({ game }: { game: GameState }) {
  const [category, setCategory] = useState<'all' | MediaPost['category']>('all')
  const [query, setQuery] = useState('')
  const filteredPosts = game.mediaPosts.filter((post) => {
    const matchesCategory = category === 'all' || post.category === category
    const matchesQuery = `${post.headline} ${post.body} ${post.author}`.toLocaleLowerCase('pl').includes(query.toLocaleLowerCase('pl'))
    return matchesCategory && matchesQuery
  })
  const categories: Array<{ id: 'all' | MediaPost['category']; label: string }> = [
    { id: 'all', label: 'Wszystkie' },
    { id: 'MECZ', label: 'Mecze' },
    { id: 'TRANSFER', label: 'Transfery' },
    { id: 'SPONSOR', label: 'Sponsorzy' },
    { id: 'LIGA', label: 'Liga' },
    { id: 'KLUB', label: 'Klub' },
  ]
  return <>
    <section className="media-hero"><div className="media-hero-icon"><Newspaper size={22} /></div><div><p className="eyebrow">GŁOSY Z LIGI</p><h2>Media społecznościowe</h2><p>Dziennikarze śledzą wyniki, transfery, finanse i życie klubu.</p></div><div className="media-audience"><UsersRound size={16} /><span><strong>{game.followers.toLocaleString('pl-PL')}</strong><small>obserwujących</small></span></div></section>
    <div className="media-stats"><div><Eye size={16} /><span><small>ŚREDNIA WIDOWNIA</small><strong>{game.homeMatchesPlayed ? `${Math.round(game.totalHomeAttendance / game.homeMatchesPlayed).toLocaleString('pl-PL')} kibiców` : '—'}</strong></span></div><div><Newspaper size={16} /><span><small>ARTYKUŁY W KARIERZE</small><strong>{game.mediaPosts.length}</strong></span></div><div><TrendingUp size={16} /><span><small>POZYCJA KLUBU</small><strong>{game.sponsorDeal ? game.sponsorDeal.company : 'Szukamy partnera'}</strong></span></div></div>
    <section className="media-feed"><div className="panel-heading"><div><p className="eyebrow">NAJNOWSZE PUBLIKACJE</p><h2>Wieści z klubu i ligi</h2></div><span className="roster-count">{filteredPosts.length} / {game.mediaPosts.length} wpisów</span></div>
      <div className="media-filter-toolbar"><label className="search-input"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Szukaj w publikacjach..." /></label><div className="media-category-filters" role="group" aria-label="Filtruj publikacje według kategorii">{categories.map((item) => <button type="button" key={item.id} className={category === item.id ? 'media-filter-active' : ''} onClick={() => setCategory(item.id)}>{item.label}</button>)}</div></div>
      {filteredPosts.length ? filteredPosts.map((post) => <article className="media-post" key={post.id}><span className={`media-category media-category-${post.category.toLowerCase()}`}>{post.category}</span><div className="media-post-copy"><h3>{post.headline}</h3><p>{post.body}</p><div className="media-post-meta"><span>{post.author} · {new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(post.date))}</span><span><Eye size={13} /> {post.views.toLocaleString('pl-PL')} wyświetleń</span></div></div></article>) : <div className="empty-state"><Newspaper size={20} /><span>{game.mediaPosts.length ? 'Brak publikacji spełniających wybrane filtry.' : 'Po pierwszym wydarzeniu w klubie pojawią się artykuły i komentarze dziennikarzy.'}</span></div>}
    </section>
  </>
}

function ClubPage({ game, onUpdate }: { game: GameState; onUpdate: DeferredPagesProps['onUpdate'] }) {
  const [now, setNow] = useState(Date.now)
  const construction = game.facilityConstruction
  const stadiumStage = getStadiumStage(game.stadiumCapacity)
  const stadiumStageIndex = getStadiumStageIndex(game.stadiumCapacity)
  const nextStadiumStage = getNextStadiumStage(game.stadiumCapacity)
  const stadiumUpgradeCost = getFacilityConstructionCost(game, 'stand')
  const stadiumConstruction = construction?.facilityId === 'stand' ? construction : null
  const stadiumBuildStage = stadiumConstruction
    ? stadiumStages.find((stage) => stage.capacity === stadiumConstruction.targetCapacity) ?? stadiumStage
    : stadiumStage
  const stadiumUpgradeDisabled = Boolean(construction) || !nextStadiumStage || stadiumUpgradeCost === null || game.cash < stadiumUpgradeCost
  const trainingLevel = game.facilities.training ?? 0
  const trainingStage = trainingLevel > 0 ? trainingBaseStages[Math.min(trainingLevel, trainingBaseStages.length) - 1] : null
  const nextTrainingStage = trainingBaseStages[trainingLevel] ?? null
  const trainingUpgradeCost = getFacilityConstructionCost(game, 'training')
  const trainingConstruction = construction?.facilityId === 'training' ? construction : null
  const trainingBuildStage = trainingConstruction
    ? trainingBaseStages[Math.min(trainingConstruction.targetLevel, trainingBaseStages.length) - 1] ?? trainingStage
    : trainingStage
  const trainingUpgradeDisabled = Boolean(construction) || !nextTrainingStage || trainingUpgradeCost === null || game.cash < trainingUpgradeCost
  const academyLevel = game.facilities.academy
  const academyConstruction = construction?.facilityId === 'academy' ? construction : null
  const academyStage = academyStages[academyLevel - 1] ?? null
  const nextAcademyStage = academyStages[academyLevel] ?? null
  const academyUpgradeCost = getFacilityConstructionCost(game, 'academy')
  const academyUpgradeDisabled = Boolean(construction) || !nextAcademyStage || academyUpgradeCost === null || game.cash < academyUpgradeCost
  useEffect(() => {
    if (!construction) return
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [construction])

  const plots: Array<{ id: FacilityId; name: string; description: string; icon: typeof Building2 }> = [
    { id: 'stand', name: 'Rozbudowa stadionu', description: 'Większa pojemność i kolejny wygląd stadionu.', icon: Building2 },
    { id: 'academy', name: 'Akademia młodzieżowa', description: 'Wyższy etap zwiększa umiejętności i potencjał nowych juniorów.', icon: Users },
    { id: 'catering', name: 'Punkty gastronomiczne', description: 'Większe przychody z meczów u siebie.', icon: ShoppingBag },
    { id: 'training', name: 'Baza treningowa', description: 'Każdy poziom zwiększa o 10% szansę na dodatkowy punkt umiejętności podczas treningu ataku.', icon: Target },
  ]
  function invest(facilityId: FacilityId) {
    const result = buildFacility(game, facilityId)
    if (result.error) return onUpdate(game, result.error)
    const construction = result.game.facilityConstruction
    if (!construction) return onUpdate(game, 'Nie udało się rozpocząć inwestycji.')
    const hours = getFacilityConstructionDurationMs(construction.targetLevel, facilityId) / (60 * 60 * 1000)
    onUpdate(result.game, `Rozpoczęto budowę. Ukończenie nastąpi za około ${hours} godz. Koszt inwestycji został pobrany.`)
  }
  return <>
    <section className="campus-header"><div><p className="eyebrow">INFRASTRUKTURA KLUBU</p><h2>Miasteczko klubowe</h2><p>Inwestuj w stadion, bazę treningową, akademię i usługi dla kibiców.</p></div><div className="campus-level"><Building2 size={18} /><span><small>POZIOM OŚRODKA</small><strong>{1 + game.facilities.stand + (game.facilities.training ?? 0) + game.facilities.academy + game.facilities.catering} · {formatMoney(game.cash)}</strong></span></div></section>
    <section className="campus-map"><div className="map-topline"><span><MapPin size={14} /> {game.city}, Polska</span><span>WIDOK TERENU <i>·</i> PLAN ROZWOJU</span></div><div className="campus-grid">
      <div className={`campus-field campus-pitch ${stadiumConstruction ? 'campus-construction-building' : ''}`}><img className="campus-stadium-image" src={stadiumBuildStage.image} alt={stadiumConstruction ? 'Rozbudowa stadionu w toku' : `Stadion — etap ${stadiumStageIndex + 1}, ${stadiumStage.capacity.toLocaleString('pl-PL')} miejsc`} />{stadiumConstruction && <div className="campus-construction-overlay"><span className="campus-construction-status">ROZBUDOWA STADIONU W TOKU</span><strong><Clock3 size={30} />{formatCountdown(stadiumConstruction.completesAt - now)}</strong><small>Do ukończenia kolejnego etapu</small></div>}<div className="campus-building-label"><span>01</span><strong>Stadion klubu</strong><small>{stadiumConstruction ? `Rozbudowa do ${stadiumBuildStage.capacity.toLocaleString('pl-PL')} miejsc` : `Etap ${stadiumStageIndex + 1} / ${stadiumStages.length} · ${game.stadiumCapacity.toLocaleString('pl-PL')} miejsc`}</small></div><div className="stadium-build-action"><button type="button" className="stadium-build-button" disabled={stadiumUpgradeDisabled} onClick={() => invest('stand')}>{stadiumConstruction ? `W budowie · ${formatCountdown(stadiumConstruction.completesAt - now)}` : construction ? 'Inna budowa w toku' : nextStadiumStage && stadiumUpgradeCost !== null ? <>Rozbuduj do {nextStadiumStage.capacity.toLocaleString('pl-PL')} miejsc <span>{formatMoney(stadiumUpgradeCost)}</span></> : 'Maksymalna pojemność'}</button>{!construction && stadiumUpgradeCost !== null && game.cash < stadiumUpgradeCost && <small>Brakuje {formatMoney(stadiumUpgradeCost - game.cash)}</small>}</div></div>
      {plots.filter((plot) => plot.id !== 'stand' && plot.id !== 'training' && plot.id !== 'academy').map((plot, index) => {
        const level = game.facilities[plot.id] ?? 0
        const construction = game.facilityConstruction?.facilityId === plot.id ? game.facilityConstruction : null
        const Icon = plot.icon
        const plotDescription = level > 0 ? `Poziom ${level} · ${plot.description}` : 'Wolna działka · możesz rozpocząć budowę'
        return <div className={`campus-field campus-plot ${construction ? 'campus-construction-building campus-plot-building' : ''}`} key={plot.id}>
          <span className="plot-number">0{index + 2}</span><Icon size={24} /><strong>{plot.name}</strong>
          <small>{plotDescription}</small>
          {construction && <div className="campus-construction-overlay"><span className="campus-construction-status">BUDOWA W TOKU</span><strong><Clock3 size={26} />{formatCountdown(construction.completesAt - now)}</strong><small>{plot.name}</small></div>}
          {construction ? <span className="planned-tag">W BUDOWIE · {formatCountdown(construction.completesAt - now)}</span> : level > 0 ? <span className="planned-tag">POZIOM {level} / 3</span> : <span className="planned-tag">WOLNA DZIAŁKA</span>}
        </div>
      })}
      <div className={`campus-field campus-academy ${academyConstruction ? 'campus-construction-building' : academyLevel === 0 ? 'campus-academy-empty' : ''}`}>
        <img className="campus-stadium-image" src={academyStages[0].image} alt={academyConstruction ? 'Rozbudowa akademii młodzieżowej w toku' : 'Akademia młodzieżowa'} />
        {academyLevel === 0 && !academyConstruction && <div className="campus-academy-empty-overlay"><span>AKADEMIA NIEZBUDOWANA</span><small>Załóż obiekt, aby odblokować nabór juniorów</small></div>}
        {academyConstruction && <div className="campus-construction-overlay"><span className="campus-construction-status">{academyConstruction.targetLevel === 1 ? 'BUDOWA AKADEMII W TOKU' : 'ROZBUDOWA AKADEMII W TOKU'}</span><strong><Clock3 size={30} />{formatCountdown(academyConstruction.completesAt - now)}</strong><small>{academyConstruction.targetLevel === 1 ? 'Do założenia akademii' : `Do ukończenia etapu ${academyConstruction.targetLevel}`}</small></div>}
        {!academyConstruction && academyStage && <span className="campus-academy-stage">{academyStage.label}</span>}
        <div className="campus-training-label"><span>03</span><strong>Akademia młodzieżowa</strong><small>{academyConstruction ? `W trakcie budowy · etap ${academyConstruction.targetLevel} / ${academyStages.length}` : academyStage ? `Etap ${academyLevel} / ${academyStages.length} · wyższy poziom, lepsi juniorzy` : 'Nie zbudowano · najpierw załóż akademię'}</small></div>
        <div className="stadium-build-action"><button type="button" className="stadium-build-button" disabled={academyUpgradeDisabled} onClick={() => invest('academy')}>{academyConstruction ? `W budowie · ${formatCountdown(academyConstruction.completesAt - now)}` : construction ? 'Inna budowa w toku' : nextAcademyStage && academyUpgradeCost !== null ? <>{academyLevel === 0 ? 'Załóż akademię' : `Rozbuduj do ${nextAcademyStage.label}`} <span>{formatMoney(academyUpgradeCost)}</span></> : 'Maksymalny poziom'}</button>{!construction && academyUpgradeCost !== null && game.cash < academyUpgradeCost && <small>Brakuje {formatMoney(academyUpgradeCost - game.cash)}</small>}</div>
      </div>
      <div className={`campus-field campus-training ${trainingBuildStage ? '' : 'campus-training-empty'} ${trainingConstruction ? 'campus-construction-building' : ''}`}>
        {trainingBuildStage ? <img className="campus-stadium-image" src={trainingBuildStage.image} alt={trainingConstruction ? `Wizualizacja rozbudowy: ${trainingBuildStage.name}` : trainingBuildStage.name} /> : <Landmark size={32} />}
        {trainingConstruction && <div className="campus-construction-overlay"><span className="campus-construction-status">ROZBUDOWA W TOKU</span><strong><Clock3 size={30} />{formatCountdown(trainingConstruction.completesAt - now)}</strong><small>Do ukończenia kolejnego etapu</small></div>}
        <div className="campus-training-label"><span>04</span><strong>Baza treningowa</strong><small>{trainingConstruction ? `W trakcie budowy · poziom ${trainingConstruction.targetLevel} / ${trainingBaseStages.length}` : trainingStage ? `Poziom ${trainingLevel} / ${trainingBaseStages.length} · ${trainingStage.name}` : `Nie zbudowano · następny etap: ${nextTrainingStage?.name}`}</small></div>
        <div className="stadium-build-action"><button type="button" className="stadium-build-button" disabled={trainingUpgradeDisabled} onClick={() => invest('training')}>{trainingConstruction ? `W budowie · ${formatCountdown(trainingConstruction.completesAt - now)}` : construction ? 'Inna budowa w toku' : nextTrainingStage && trainingUpgradeCost !== null ? <>Rozbuduj: {nextTrainingStage.name} <span>{formatMoney(trainingUpgradeCost)}</span></> : 'Maksymalny poziom'}</button>{!construction && trainingUpgradeCost !== null && game.cash < trainingUpgradeCost && <small>Brakuje {formatMoney(trainingUpgradeCost - game.cash)}</small>}</div>
      </div>
      <div className="campus-field campus-plot"><span className="plot-number">05</span><ShoppingBag size={24} /><strong>Sklep kibica</strong><small>Rozbudowa w kolejnym etapie</small><span className="planned-tag">W PLANACH</span></div>
    </div><div className="map-legend"><span><i className="legend-active" /> Aktywne obiekty</span><span><i className="legend-plan" /> Wolne działki</span><span><i className="legend-planned" /> Planowane inwestycje</span></div></section>
    <section className="panel-card campus-list-panel"><div className="panel-heading"><div><p className="eyebrow">PLAN ROZWOJU</p><h2>Inwestycje klubowe</h2></div><span className="roster-count">{game.facilityConstruction ? '1 inwestycja w toku' : `${plots.length} dostępne projekty`}</span></div><div className="investment-list">{plots.map((plot) => {
      const level = game.facilities[plot.id] ?? 0
      const investmentCost = getFacilityConstructionCost(game, plot.id)
      const isStand = plot.id === 'stand'
      const isTraining = plot.id === 'training'
      const isAcademy = plot.id === 'academy'
      const construction = game.facilityConstruction
      const isBuilding = construction?.facilityId === plot.id
      const isActive = isStand ? stadiumStageIndex > 0 : level > 0
      const nextStadiumConstructionHours = nextStadiumStage
        ? (getFacilityConstructionDurationMs(stadiumStageIndex + 1, 'stand') / (60 * 60 * 1000)).toLocaleString('pl-PL')
        : null
      const levelDescription = isStand
        ? `Etap ${stadiumStageIndex + 1} / ${stadiumStages.length} · ${nextStadiumStage && nextStadiumConstructionHours ? `Następny: ${nextStadiumStage.capacity.toLocaleString('pl-PL')} miejsc, budowa ${nextStadiumConstructionHours} godz.` : 'Maksymalny etap stadionu.'}`
        : isTraining
          ? `Poziom ${level} / ${trainingBaseStages.length} · ${level * 10}% szansy na dodatkowy punkt umiejętności w treningu ataku.`
          : isAcademy
            ? level === 0
              ? 'Nie zbudowano · najpierw załóż akademię.'
              : `Etap ${level} / ${academyStages.length} · wyższy poziom zwiększa umiejętności i potencjał naboru.`
            : `${level > 0 ? `Poziom ${level} / 3 · ` : ''}${plot.description}`
      return <div key={plot.id} className={`investment-row ${isBuilding ? 'investment-row-building' : ''}`}>
        <span className={isActive ? 'investment-icon investment-icon-active' : 'investment-icon'}>{isBuilding ? <Clock3 size={16} /> : isActive ? <Check size={16} /> : <Building2 size={16} />}</span>
        <span><strong>{plot.name}</strong><small>{levelDescription}</small>{isBuilding && construction && <span className="construction-countdown"><Clock3 size={12} /> W budowie · pozostało <strong>{formatCountdown(construction.completesAt - now)}</strong><i><span style={{ width: `${Math.min(100, Math.max(0, (now - construction.startedAt) / (construction.completesAt - construction.startedAt) * 100))}%` }} /></i></span>}</span>
        {isBuilding ? <span className="status-building">W TOKU</span> : investmentCost === null ? <span className="status-active">MAKS.</span> : <button className="build-button" disabled={Boolean(construction) || game.cash < investmentCost} onClick={() => invest(plot.id)}>{construction ? 'Kolejka budowy' : `${formatMoney(investmentCost)} · ${isAcademy && level === 0 ? 'Załóż' : 'Buduj'}`}</button>}
      </div>
    })}</div></section>
  </>
}

export default function DeferredPages(props: DeferredPagesProps) {
  switch (props.section) {
    case 'history':
      return <SeasonHistoryPage game={props.game} />
    case 'board':
      return <BoardPage game={props.game} onUpdate={props.onUpdate} />
    case 'media':
      return <MediaPage game={props.game} />
    case 'club':
      return <ClubPage game={props.game} onUpdate={props.onUpdate} />
  }
}
