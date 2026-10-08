// Onglets de gestion : matchs (tableau), équipes, joueurs (avec photos), réglages du tournoi.
import { useState, type FormEvent, type ReactNode } from 'react'
import { playerName, roundName, roundsOf, statusLabel } from '../data/bracket'
import { actions, getBackendMode } from '../data/store'
import type { DB, Player, Position, Settings, Team, TournamentId } from '../data/types'
import { Crest } from '../ui/Crest'
import { Camera, Plus, Silhouette, Trash } from '../ui/Icons'
import { useUi } from './Admin'

function TournamentSwitch({ value, onChange }: { value: TournamentId; onChange: (t: TournamentId) => void }) {
  return (
    <div className="seg" role="group" aria-label="Tournoi">
      {(['g', 'f'] as const).map((t) => (
        <button key={t} type="button" aria-pressed={value === t} onClick={() => onChange(t)}>
          Jour {t === 'g' ? '1 · Garçons' : '2 · Filles'}
        </button>
      ))}
    </div>
  )
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="sheet-bg" onClick={onClose} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  )
}

/* ---------------------------------- Matchs ---------------------------------- */

export function MatchesTab({ db }: { db: DB }) {
  const ui = useUi()
  const [t, setT] = useState<TournamentId>('g')
  const [shuffle, setShuffle] = useState(true)
  const teams = db.teams.filter((x) => x.tournamentId === t)
  const rounds = roundsOf(db, t)
  const teamName = (id: string | null) => (id ? db.teams.find((x) => x.id === id)?.name ?? '?' : 'À définir')

  const generate = async () => {
    if (teams.length < 2) {
      ui.toast('Il faut au moins 2 équipes pour créer le tableau.', { bad: true })
      return
    }
    if (rounds.length && !(await ui.confirm('Recréer le tableau ?', 'Tous les matchs et les buts de ce tournoi seront effacés.', 'Recréer', true))) return
    const list = [...teams]
    if (shuffle)
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[list[i], list[j]] = [list[j], list[i]]
      }
    await ui.run(() => actions.generateBracket(t, list), 'Tableau créé')
  }

  return (
    <>
      <h2>Matchs</h2>
      <TournamentSwitch value={t} onChange={setT} />
      <div className="card">
        <p style={{ marginTop: 0 }}>
          <b>{teams.length} équipe{teams.length > 1 ? 's' : ''}</b> dans ce tournoi.{' '}
          <span className="muted">Le tableau gère de 2 à 16 équipes ; s&rsquo;il en manque pour faire 4, 8 ou 16, certaines passent directement au tour suivant.</span>
        </p>
        <label className={`check${shuffle ? ' on' : ''}`}>
          <input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} />
          <span>
            <b>Tirage au sort</b>
            <span className="muted">Sinon, les équipes sont placées dans l&rsquo;ordre de création.</span>
          </span>
        </label>
        <div className="actions">
          <button type="button" className="b b-gold" onClick={generate}>
            {rounds.length ? 'Recréer le tableau' : 'Créer le tableau'}
          </button>
        </div>
      </div>

      {rounds.map((ms, r) => (
        <div className="round-block" key={r}>
          <h3>{roundName(ms.length)}</h3>
          <div className="list">
            {ms.map((m) => (
              <div className="card mline" key={m.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                  <span className="teams-line">
                    {teamName(m.teamAId)} – {teamName(m.teamBId)}
                  </span>
                  <span className={`chip${m.status === 'finished' ? ' ok' : m.status === 'upcoming' ? '' : ' live'}`}>
                    {m.status === 'finished' ? `${m.scoreA}-${m.scoreB}` : statusLabel(m).replace(/^Coup d.envoi /, '')}
                  </span>
                </div>
                <div className="row2">
                  <label className="field" style={{ margin: 0 }}>
                    <span>Heure</span>
                    <input className="in" type="time" defaultValue={m.kickoff ?? ''} onBlur={(e) => e.target.value !== (m.kickoff ?? '') && ui.run(() => actions.updateMatch(m.id, { kickoff: e.target.value || null }), 'Heure enregistrée')} />
                  </label>
                  <label className="field" style={{ margin: 0 }}>
                    <span>Terrain</span>
                    <input className="in" defaultValue={m.field} onBlur={(e) => e.target.value !== m.field && ui.run(() => actions.updateMatch(m.id, { field: e.target.value }), 'Terrain enregistré')} />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {!rounds.length && <p className="muted">Pas encore de tableau pour ce tournoi.</p>}
    </>
  )
}

/* ---------------------------------- Équipes ---------------------------------- */

function TeamEditor({ db, team, onClose }: { db: DB; team: Team; onClose: () => void }) {
  const ui = useUi()
  const [d, setD] = useState(team)
  const [err, setErr] = useState('')
  const exists = db.teams.some((x) => x.id === team.id)
  const players = db.players.filter((p) => p.teamId === team.id)
  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!d.name.trim()) return setErr('Donne un nom à l’équipe, par exemple « Terminale A ».')
    if (!d.short.trim()) return setErr('Ajoute 2 ou 3 lettres pour l’écusson, par exemple « TA ».')
    const clean = { ...d, name: d.name.trim(), short: d.short.trim().toUpperCase().slice(0, 3), classe: d.classe.trim() || d.name.trim() }
    if (await ui.run(() => actions.saveTeam(clean), exists ? 'Équipe enregistrée' : 'Équipe ajoutée')) onClose()
  }
  const remove = async () => {
    if (await ui.confirm(`Supprimer ${team.name} ?`, `L’équipe et ses ${players.length} joueur(s) seront supprimés. Si elle est déjà dans le tableau, pense à le recréer.`, 'Supprimer', true))
      if (await ui.run(() => actions.deleteTeam(team.id), 'Équipe supprimée')) onClose()
  }
  return (
    <Sheet title={exists ? 'Modifier l’équipe' : 'Nouvelle équipe'} onClose={onClose}>
      <form onSubmit={save} noValidate>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14 }}>
          <Crest team={{ ...d, short: d.short.toUpperCase() || '?' }} />
          <span className="muted">Aperçu de l&rsquo;écusson</span>
        </div>
        <label className="field">
          <span>Nom de l&rsquo;équipe</span>
          <input className="in" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="Terminale A" aria-invalid={!!err && !d.name.trim()} />
        </label>
        <div className="row2">
          <label className="field">
            <span>Lettres de l&rsquo;écusson</span>
            <input className="in" value={d.short} maxLength={3} onChange={(e) => setD({ ...d, short: e.target.value.toUpperCase() })} placeholder="TA" />
          </label>
          <label className="field">
            <span>Classe</span>
            <input className="in" value={d.classe} onChange={(e) => setD({ ...d, classe: e.target.value })} placeholder="Tle A" />
          </label>
        </div>
        <div className="row2">
          <label className="field">
            <span>Couleur principale</span>
            <input className="in" type="color" value={d.color1} onChange={(e) => setD({ ...d, color1: e.target.value })} />
          </label>
          <label className="field">
            <span>Couleur du texte</span>
            <input className="in" type="color" value={d.color2} onChange={(e) => setD({ ...d, color2: e.target.value })} />
          </label>
        </div>
        <label className="field">
          <span>Tournoi</span>
          <select value={d.tournamentId} onChange={(e) => setD({ ...d, tournamentId: e.target.value as TournamentId })}>
            <option value="g">Jour 1 · Garçons</option>
            <option value="f">Jour 2 · Filles</option>
          </select>
        </label>
        {players.length > 0 && (
          <label className="field">
            <span>Capitaine</span>
            <select value={d.captainId ?? ''} onChange={(e) => setD({ ...d, captainId: e.target.value || null })}>
              <option value="">Pas de capitaine</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {playerName(p)}
                </option>
              ))}
            </select>
          </label>
        )}
        {err && (
          <p className="err" role="alert">
            {err}
          </p>
        )}
        <div className="actions">
          <button type="button" className="b b-line" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="b b-gold">
            Enregistrer
          </button>
        </div>
        {exists && (
          <div className="actions">
            <button type="button" className="b b-danger b-block" onClick={remove}>
              <Trash /> Supprimer l&rsquo;équipe
            </button>
          </div>
        )}
      </form>
    </Sheet>
  )
}

export function TeamsTab({ db }: { db: DB }) {
  const [t, setT] = useState<TournamentId>('g')
  const [edit, setEdit] = useState<Team | null>(null)
  const teams = db.teams.filter((x) => x.tournamentId === t).sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  return (
    <>
      <h2>Équipes</h2>
      <TournamentSwitch value={t} onChange={setT} />
      <button type="button" className="b b-gold b-block" onClick={() => setEdit(actions.newTeam(t))}>
        <Plus /> Ajouter une équipe
      </button>
      <div className="list" style={{ marginTop: 14 }}>
        {teams.map((team) => (
          <button key={team.id} type="button" className="item" onClick={() => setEdit(team)}>
            <Crest team={team} small />
            <span className="grow">
              <b>{team.name}</b>
              <small>{db.players.filter((p) => p.teamId === team.id).length} joueur(s)</small>
            </span>
          </button>
        ))}
        {!teams.length && <p className="muted">Aucune équipe pour l&rsquo;instant. Commence par en ajouter une.</p>}
      </div>
      {edit && <TeamEditor db={db} team={edit} onClose={() => setEdit(null)} />}
    </>
  )
}

/* ---------------------------------- Joueurs ---------------------------------- */

/** Recadre la photo en carré (centrée, un peu vers le haut) et la réduit pour qu'elle soit légère. */
async function squarePhoto(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = () => rej(new Error('Image illisible. Essaie avec une photo JPG ou PNG.'))
      i.src = url
    })
    const s = Math.min(img.width, img.height)
    const sx = (img.width - s) / 2
    const sy = Math.max(0, (img.height - s) * 0.25)
    const size = 600
    const c = document.createElement('canvas')
    c.width = c.height = size
    c.getContext('2d')!.drawImage(img, sx, sy, s, s, 0, 0, size, size)
    return await new Promise<Blob>((res) => c.toBlob((b) => res(b!), 'image/jpeg', 0.85))
  } finally {
    URL.revokeObjectURL(url)
  }
}

const POSITIONS: [Position, string][] = [
  ['GB', 'Gardien'],
  ['DEF', 'Défenseur'],
  ['MIL', 'Milieu'],
  ['ATT', 'Attaquant'],
]

function PlayerEditor({ db, player, onClose }: { db: DB; player: Player; onClose: () => void }) {
  const ui = useUi()
  const [d, setD] = useState(player)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const exists = db.players.some((x) => x.id === player.id)
  const valid = () => {
    if (!d.firstName.trim()) return 'Saisis le prénom.'
    if (!/^[A-Za-zÀ-ÖØ-öø-ÿ]$/.test(d.lastInitial.trim())) return 'Saisis l’initiale du nom (une seule lettre, pour la vie privée).'
    return ''
  }
  // La photo enregistrée fait foi (elle change quand on en envoie une nouvelle).
  const saved = db.players.find((x) => x.id === player.id)
  const photo = d.consent ? (saved?.photoUrl ?? d.photoUrl) : null
  const clean = () => ({ ...d, firstName: d.firstName.trim(), lastInitial: d.lastInitial.trim().toUpperCase(), photoUrl: photo })
  const save = async (e: FormEvent) => {
    e.preventDefault()
    const v = valid()
    if (v) return setErr(v)
    if (await ui.run(() => actions.savePlayer(clean()), exists ? 'Joueur enregistré' : 'Joueur ajouté')) onClose()
  }
  const upload = async (file: File | undefined) => {
    if (!file) return
    const v = valid()
    if (v) return setErr(v)
    setBusy(true)
    const blob = await squarePhoto(file).catch((e: Error) => {
      ui.toast(e.message, { bad: true })
      return null
    })
    if (blob) await ui.run(() => actions.uploadPhoto(clean(), blob), 'Photo ajoutée')
    setBusy(false)
  }
  const remove = async () => {
    if (await ui.confirm(`Supprimer ${playerName(player)} ?`, 'Ses buts déjà marqués restent comptés pour son équipe, mais sans buteur.', 'Supprimer', true))
      if (await ui.run(() => actions.deletePlayer(player.id), 'Joueur supprimé')) onClose()
  }
  const teamsByT = (t: TournamentId) => db.teams.filter((x) => x.tournamentId === t).sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  return (
    <Sheet title={exists ? 'Modifier le joueur' : 'Nouveau joueur'} onClose={onClose}>
      <form onSubmit={save} noValidate>
        <div className="row2">
          <label className="field">
            <span>Prénom</span>
            <input className="in" value={d.firstName} autoCapitalize="words" onChange={(e) => setD({ ...d, firstName: e.target.value })} />
          </label>
          <label className="field">
            <span>Initiale du nom</span>
            <input className="in" value={d.lastInitial} maxLength={1} autoCapitalize="characters" onChange={(e) => setD({ ...d, lastInitial: e.target.value.toUpperCase() })} />
          </label>
        </div>
        <label className="field">
          <span>Équipe</span>
          <select value={d.teamId} onChange={(e) => setD({ ...d, teamId: e.target.value })}>
            {(['g', 'f'] as const).map((t) => (
              <optgroup key={t} label={t === 'g' ? 'Garçons' : 'Filles'}>
                {teamsByT(t).map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <div className="row2">
          <label className="field">
            <span>Poste</span>
            <select value={d.position} onChange={(e) => setD({ ...d, position: e.target.value as Position })}>
              {POSITIONS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Note de la carte : {d.rating}</span>
            <input type="range" min={50} max={99} value={d.rating} onChange={(e) => setD({ ...d, rating: +e.target.value })} />
          </label>
        </div>

        <label className={`check${d.consent ? ' on' : ''}`} style={{ marginBottom: 14 }}>
          <input
            type="checkbox"
            checked={d.consent}
            onChange={(e) => {
              const consent = e.target.checked
              setD({ ...d, consent, photoUrl: consent ? d.photoUrl : null })
            }}
          />
          <span>
            <b>Autorisation droit à l&rsquo;image signée</b>
            <span className="muted">Coche seulement si l&rsquo;autorisation écrite des parents a été remise à la direction. Sans elle, aucune photo n&rsquo;est affichée.</span>
          </span>
        </label>

        <div className="photo-box">
          <div className="avatar" style={{ color: 'var(--dim)' }}>
            {photo ? <img src={photo} alt="" /> : <Silhouette />}
          </div>
          <div style={{ display: 'grid', gap: 8, flex: 1 }}>
            <label className={`b b-line b-sm${!d.consent || busy ? ' disabled' : ''}`} style={{ opacity: !d.consent || busy ? 0.45 : 1, pointerEvents: !d.consent || busy ? 'none' : 'auto' }}>
              <Camera /> {busy ? 'Envoi…' : photo ? 'Changer la photo' : 'Ajouter une photo'}
              <input type="file" accept="image/*" hidden disabled={!d.consent || busy} onChange={(e) => upload(e.target.files?.[0])} />
            </label>
            <small className="muted">{d.consent ? 'De face, cadrée à la taille, sur fond uni.' : 'Coche d’abord l’autorisation pour ajouter une photo.'}</small>
          </div>
        </div>

        {err && (
          <p className="err" role="alert" style={{ marginTop: 12 }}>
            {err}
          </p>
        )}
        <div className="actions">
          <button type="button" className="b b-line" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="b b-gold">
            Enregistrer
          </button>
        </div>
        {exists && (
          <div className="actions">
            <button type="button" className="b b-danger b-block" onClick={remove}>
              <Trash /> Supprimer le joueur
            </button>
          </div>
        )}
      </form>
    </Sheet>
  )
}

export function PlayersTab({ db }: { db: DB }) {
  const [teamId, setTeamId] = useState<string>(() => db.teams[0]?.id ?? '')
  const [edit, setEdit] = useState<Player | null>(null)
  const team = db.teams.find((t) => t.id === teamId)
  const order = { GB: 0, DEF: 1, MIL: 2, ATT: 3 }
  const players = db.players.filter((p) => p.teamId === teamId).sort((a, b) => order[a.position] - order[b.position] || a.firstName.localeCompare(b.firstName, 'fr'))
  if (!db.teams.length)
    return (
      <>
        <h2>Joueurs</h2>
        <p className="muted">Crée d&rsquo;abord une équipe dans l&rsquo;onglet Équipes.</p>
      </>
    )
  return (
    <>
      <h2>Joueurs</h2>
      <label className="field">
        <span>Équipe</span>
        <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
          {(['g', 'f'] as const).map((t) => (
            <optgroup key={t} label={t === 'g' ? 'Garçons' : 'Filles'}>
              {db.teams
                .filter((x) => x.tournamentId === t)
                .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
      <button type="button" className="b b-gold b-block" disabled={!team} onClick={() => setEdit(actions.newPlayer(teamId))}>
        <Plus /> Ajouter un joueur
      </button>
      <div className="list" style={{ marginTop: 14 }}>
        {players.map((p) => (
          <button key={p.id} type="button" className="item" onClick={() => setEdit(p)}>
            <span className="avatar" style={{ color: team?.color1 }}>
              {p.consent && p.photoUrl ? <img src={p.photoUrl} alt="" /> : <Silhouette />}
            </span>
            <span className="grow">
              <b>
                {playerName(p)}
                {team?.captainId === p.id ? ' (C)' : ''}
              </b>
              <small>
                {p.position} · note {p.rating}
              </small>
            </span>
            <span className={`chip${p.consent ? ' ok' : ' warn'}`}>{p.consent ? 'Photo OK' : 'Sans photo'}</span>
          </button>
        ))}
        {!players.length && <p className="muted">Aucun joueur dans cette équipe.</p>}
      </div>
      {edit && <PlayerEditor db={db} player={edit} onClose={() => setEdit(null)} />}
    </>
  )
}

/* ---------------------------------- Réglages ---------------------------------- */

export function SettingsTab({ db }: { db: DB }) {
  const ui = useUi()
  const [s, setS] = useState<Settings>(db.settings)
  const local = getBackendMode() === 'local'
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...s, [k]: v })
  const save = (e: FormEvent) => {
    e.preventDefault()
    ui.run(() => actions.saveSettings({ ...s, halfLength: Math.max(3, Math.min(45, Math.round(s.halfLength) || 10)) }), 'Réglages enregistrés')
  }
  const text = (k: keyof Settings, labelText: string, hint?: string) => (
    <label className="field">
      <span>{labelText}</span>
      <input className="in" value={String(s[k])} onChange={(e) => set(k, e.target.value as never)} />
      {hint && <small>{hint}</small>}
    </label>
  )
  return (
    <>
      <h2>Réglages</h2>
      <form className="card" onSubmit={save}>
        {text('dates', 'Dates', 'Exemple : « Jeudi 20 et vendredi 21 mai 2027 »')}
        {text('place', 'Lieu', 'Exemple : « Terrain synthétique du lycée »')}
        <label className="field">
          <span>Horaires</span>
          <textarea value={s.schedule} onChange={(e) => set('schedule', e.target.value)} style={{ minHeight: 80 }} />
        </label>
        <label className="field">
          <span>Règlement simplifié</span>
          <textarea value={s.rules} onChange={(e) => set('rules', e.target.value)} />
          <small>Une règle par ligne.</small>
        </label>
        {text('contact', 'Contact organisateurs')}
        <div className="row2">
          <label className="field">
            <span>Mi-temps (minutes)</span>
            <input className="in" type="number" inputMode="numeric" min={3} max={45} value={s.halfLength} onChange={(e) => set('halfLength', +e.target.value)} />
          </label>
          {text('city', 'Ville')}
        </div>
        {text('school', 'Nom du lycée')}
        <label className={`check${s.demo ? ' on' : ''}`}>
          <input type="checkbox" checked={s.demo} onChange={(e) => set('demo', e.target.checked)} />
          <span>
            <b>Afficher « Données d&rsquo;exemple »</b>
            <span className="muted">À décocher quand les vraies équipes sont saisies.</span>
          </span>
        </label>
        <div className="actions">
          <button type="submit" className="b b-gold">
            Enregistrer les réglages
          </button>
        </div>
      </form>

      <h3>Données</h3>
      <div className="card">
        <p style={{ marginTop: 0 }}>
          Stockage : <b>{local ? 'ce navigateur (mode démo)' : 'Supabase (en ligne, temps réel)'}</b>
        </p>
        <p className="muted">
          {local
            ? 'Pour que tous les téléphones voient les scores, relie le site à Supabase en suivant le guide GUIDE-SUPABASE.md.'
            : 'Tous les visiteurs voient les changements en direct.'}
        </p>
        <div className="actions">
          {local && (
            <button
              type="button"
              className="b b-line"
              onClick={async () => {
                if (await ui.confirm('Remettre les exemples ?', 'Les données actuelles de ce navigateur seront remplacées par les équipes et scores d’exemple.', 'Remettre'))
                  await ui.run(() => actions.resetDemo(), 'Exemples remis')
              }}
            >
              Remettre les exemples
            </button>
          )}
          <button
            type="button"
            className="b b-danger"
            onClick={async () => {
              if (await ui.confirm('Tout effacer ?', 'Équipes, joueurs, matchs et buts seront supprimés définitivement. Les réglages sont conservés.', 'Tout effacer', true))
                await ui.run(() => actions.clearAll(), 'Tout est effacé : prêt pour le vrai tournoi')
            }}
          >
            <Trash /> Tout effacer
          </button>
        </div>
      </div>
    </>
  )
}
