import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

type BoardId = 'presidents' | 'beverages'

type StatMap = Record<string, number>

type PresidentItem = {
  id: string
  name: string
  party: string
  presidencyNumbers: number[]
  stats: StatMap
}

type BeverageItem = {
  id: string
  name: string
  brand: string
  category: string
  defaultPlayable: boolean
  qualityFlags: string[]
  stats: StatMap
}

type GameItem = PresidentItem | BeverageItem

type Dataset<T extends GameItem> = {
  metadata: {
    source: string
    sourceUrl?: string
    sourceUrls?: string[]
    records: number
    defaultPlayableRecords?: number
    normalization?: string
  }
  items: T[]
}

type Prompt = {
  id: string
  board: BoardId
  label: string
  statKey: string
  unit: string
  // The full objective shown to the player, e.g. "the most sugar". We compose
  // the sentence as "Carve the four <noun> with <objective>." so each prompt
  // reads naturally rather than relying on a generic most/least template.
  objective: string
  direction: 'high' | 'low'
  filter?: (item: GameItem) => boolean
}

const PROMPTS: Prompt[] = [
  {
    id: 'approval-high',
    board: 'presidents',
    label: 'Peak approval',
    statKey: 'approval_high',
    unit: '%',
    objective: 'the highest peak approval rating',
    direction: 'high',
  },
  {
    id: 'executive-orders',
    board: 'presidents',
    label: 'Executive orders',
    statKey: 'executive_orders_total',
    unit: 'orders',
    objective: 'the most executive orders signed',
    direction: 'high',
  },
  {
    id: 'electoral-share',
    board: 'presidents',
    label: 'Electoral share',
    statKey: 'best_electoral_vote_pct',
    unit: '%',
    objective: 'the biggest electoral vote share',
    direction: 'high',
  },
  {
    id: 'time-in-office',
    board: 'presidents',
    label: 'Longest in office',
    statKey: 'years_in_office_app',
    unit: 'yrs',
    objective: 'the longest combined time in office',
    direction: 'high',
  },
  {
    id: 'youngest-inauguration',
    board: 'presidents',
    label: 'Youngest sworn in',
    statKey: 'age_at_first_inauguration',
    unit: 'yrs',
    objective: 'the youngest age at first inauguration',
    direction: 'low',
  },
  {
    id: 'oldest-inauguration',
    board: 'presidents',
    label: 'Oldest sworn in',
    statKey: 'age_at_first_inauguration',
    unit: 'yrs',
    objective: 'the oldest age at first inauguration',
    direction: 'high',
  },
  {
    id: 'soda-sugar',
    board: 'beverages',
    label: 'Soda sugar',
    statKey: 'sugar_g_per_12_fl_oz',
    unit: 'g',
    objective: 'the most sugar per 12 fl oz',
    direction: 'high',
    filter: (item) =>
      'category' in item && item.defaultPlayable && item.category === 'Soda',
  },
  {
    id: 'drink-caffeine',
    board: 'beverages',
    label: 'Caffeine',
    statKey: 'caffeine_mg_per_12_fl_oz',
    unit: 'mg',
    objective: 'the most caffeine per 12 fl oz',
    direction: 'high',
    filter: (item) => 'defaultPlayable' in item && item.defaultPlayable,
  },
  {
    id: 'drink-calories',
    board: 'beverages',
    label: 'Calories',
    statKey: 'calories_per_12_fl_oz',
    unit: 'kcal',
    objective: 'the most calories per 12 fl oz',
    direction: 'high',
    filter: (item) => 'defaultPlayable' in item && item.defaultPlayable,
  },
]

const BOARD_LABELS: Record<BoardId, string> = {
  presidents: 'Presidents',
  beverages: 'Food & Sodas',
}

const BOARD_NOUNS: Record<BoardId, string> = {
  presidents: 'presidents',
  beverages: 'drinks',
}

// The curated stats shown on an entity's profile card, in display order. Only
// stats the entity actually has are rendered; the rest fall through as "no
// data" so sparse historical records read honestly.
type StatMeta = { key: string; label: string; unit: string }

const STAT_META: Record<BoardId, StatMeta[]> = {
  presidents: [
    { key: 'approval_high', label: 'Peak approval', unit: '%' },
    { key: 'best_electoral_vote_pct', label: 'Electoral share', unit: '%' },
    { key: 'election_wins', label: 'Election wins', unit: 'wins' },
    { key: 'electoral_votes_total', label: 'Electoral votes', unit: 'votes' },
    { key: 'executive_orders_total', label: 'Executive orders', unit: 'orders' },
    { key: 'executive_orders_avg_per_year', label: 'Exec orders / yr', unit: '/yr' },
    { key: 'years_in_office_app', label: 'Years in office', unit: 'yrs' },
    { key: 'age_at_first_inauguration', label: 'Age sworn in', unit: 'yrs' },
  ],
  beverages: [
    { key: 'calories_per_12_fl_oz', label: 'Calories', unit: 'kcal' },
    { key: 'sugar_g_per_12_fl_oz', label: 'Sugar', unit: 'g' },
    { key: 'caffeine_mg_per_12_fl_oz', label: 'Caffeine', unit: 'mg' },
    { key: 'sodium_mg_per_12_fl_oz', label: 'Sodium', unit: 'mg' },
  ],
}

type StatContext = { count: number; rank: number; fill: number }

// Positions a value within the distribution of every entity that has the stat.
// `fill` is the min-max position (where the value sits in the range) and `rank`
// counts from the end that the prompt cares about (#1 = best for the lens).
const statContext = (
  values: number[] | undefined,
  value: number,
  direction: 'high' | 'low',
): StatContext | null => {
  if (!values || values.length === 0) return null
  const min = values[0]
  const max = values[values.length - 1]
  const better =
    direction === 'low'
      ? values.filter((other) => other < value).length
      : values.filter((other) => other > value).length
  const fill = max > min ? (value - min) / (max - min) : 1
  return { count: values.length, rank: better + 1, fill }
}

// Calibrated to the actual transparent holes in /rushmore.png (2250x1500) by
// measuring the alpha channel's connected components, then inflated ~2.5% on
// each edge so the colored fill fully covers each (slightly tilted) hole; the
// overflow is clipped by the opaque rock around it.
const SLOT_POSITIONS = [
  { left: '15.9%', top: '10.5%', width: '16.56%', height: '28.53%' },
  { left: '30.7%', top: '16.9%', width: '14.56%', height: '28.53%' },
  { left: '42.83%', top: '28.5%', width: '13.49%', height: '28.13%' },
  { left: '57.37%', top: '27.1%', width: '17.62%', height: '33.33%' },
] as const

const formatValue = (value: number, unit: string) => {
  const rounded =
    Math.abs(value) >= 100 ? Math.round(value) : Math.round(value * 10) / 10
  return `${rounded.toLocaleString()} ${unit}`
}

const itemSubtitle = (item: GameItem) => {
  if ('brand' in item) {
    return [item.brand, item.category].filter(Boolean).join(' / ')
  }
  const numberLabel = item.presidencyNumbers.join(' & ')
  return `${item.party} / #${numberLabel}`
}

const itemBadge = (item: GameItem) => {
  if ('brand' in item) {
    const words = (item.brand || item.name).split(/\s+/).filter(Boolean)
    return words
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase()
  }
  return item.name
    .split(/\s+/)
    .filter((word) => !['of', 'the'].includes(word.toLowerCase()))
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
}

const sourceText = (dataset?: Dataset<GameItem> | null) => {
  if (!dataset) return ''
  if (dataset.metadata.sourceUrl) return dataset.metadata.sourceUrl
  return dataset.metadata.sourceUrls?.[0] ?? ''
}

const editDistanceWithin = (left: string, right: string, maxDistance: number) => {
  if (Math.abs(left.length - right.length) > maxDistance) return false
  const rows = left.length + 1
  const cols = right.length + 1
  let prev = Array.from({ length: cols }, (_, index) => index)
  for (let row = 1; row < rows; row += 1) {
    const current = [row]
    for (let col = 1; col < cols; col += 1) {
      const cost = left[row - 1] === right[col - 1] ? 0 : 1
      current[col] = Math.min(
        prev[col] + 1,
        current[col - 1] + 1,
        prev[col - 1] + cost,
      )
    }
    if (Math.min(...current) > maxDistance) return false
    prev = current
  }
  return prev[right.length] <= maxDistance
}

const nameInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter((word) => word.length > 0 && !['of', 'the'].includes(word.toLowerCase()))
    .map((word) => word[0])
    .join('')

const tokenMatchesItem = (token: string, item: GameItem) => {
  const haystack = `${item.name} ${itemSubtitle(item)}`.toLowerCase()
  if (haystack.includes(token)) return true

  const initials = nameInitials(item.name).toLowerCase()
  if (token.length >= 2 && initials.includes(token)) return true

  const nameWords = item.name.toLowerCase().split(/\s+/).filter(Boolean)
  return nameWords.some((word) => {
    if (word.startsWith(token) || token.startsWith(word)) return true
    if (token.length >= 4 && editDistanceWithin(token, word, 1)) return true
    return false
  })
}

const itemMatchesQuery = (item: GameItem, normalized: string) => {
  if (!normalized) return true
  const tokens = normalized.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return true
  return tokens.every((token) => tokenMatchesItem(token, item))
}

const unavailableReason = (item: GameItem, prompt: Prompt, board: BoardId) => {
  if (!(prompt.statKey in item.stats)) {
    if (board === 'presidents' && prompt.statKey.startsWith('approval')) {
      return 'No Gallup approval data for this president'
    }
    return `No ${prompt.label.toLowerCase()} data`
  }
  if (prompt.filter && !prompt.filter(item)) {
    return `Not eligible for ${prompt.label.toLowerCase()}`
  }
  return 'Unavailable for this prompt'
}

type RankBand = { label: string; tone: 'summit' | 'high' | 'mid' | 'low' }

const rankBand = (ratio: number): RankBand => {
  if (ratio >= 0.98) return { label: 'Summit', tone: 'summit' }
  if (ratio >= 0.9) return { label: 'Top tier', tone: 'high' }
  if (ratio >= 0.75) return { label: 'Strong', tone: 'high' }
  if (ratio >= 0.5) return { label: 'Climbing', tone: 'mid' }
  return { label: 'Base camp', tone: 'low' }
}

// Auto-fits a label to the largest font size at which the wrapped text fits
// entirely within its container box (both width and height). The container is
// sized to the largest rectangle that fits inside the elliptical hole, so the
// full name is always shown without truncation and never spills outside.
function FitText({ text }: { text: string }) {
  const boxRef = useRef<HTMLSpanElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const box = boxRef.current
    const label = labelRef.current
    if (!box || !label) return

    const fit = () => {
      const boxW = box.clientWidth
      const boxH = box.clientHeight
      if (!boxW || !boxH) return
      let lo = 5
      let hi = 34
      let best = lo
      for (let i = 0; i < 18; i += 1) {
        const mid = (lo + hi) / 2
        label.style.fontSize = `${mid}px`
        if (label.scrollWidth <= boxW && label.scrollHeight <= boxH) {
          best = mid
          lo = mid
        } else {
          hi = mid
        }
      }
      label.style.fontSize = `${best}px`
    }

    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(box)
    return () => observer.disconnect()
  }, [text])

  return (
    <span className="slot-fit" ref={boxRef}>
      <span className="slot-name" ref={labelRef}>
        {text}
      </span>
    </span>
  )
}

function RushmoreImage({ picks }: { picks: GameItem[] }) {
  return (
    <div className="mount-wrap" aria-label="Your Mount Rushmore">
      <div className="mount-slots">
        {SLOT_POSITIONS.map((slot, index) => {
          const pick = picks[index]
          return (
            <div
              key={index}
              className={`mount-slot ${pick ? 'filled' : ''}`}
              style={slot}
            >
              {pick && <FitText text={pick.name} />}
            </div>
          )
        })}
      </div>
      <img src="/rushmore.png" alt="" />
    </div>
  )
}

function ProfileCard({
  item,
  board,
  activeStatKey,
  activeDirection,
  distributions,
}: {
  item: GameItem
  board: BoardId
  activeStatKey: string
  activeDirection: 'high' | 'low'
  distributions: Map<string, number[]>
}) {
  const metas = STAT_META[board]
  const ordered = useMemo(
    () =>
      [...metas].sort((a, b) => {
        if (a.key === activeStatKey) return -1
        if (b.key === activeStatKey) return 1
        return 0
      }),
    [metas, activeStatKey],
  )

  return (
    <div className="profile-card">
      {ordered.map((meta) => {
        const value = item.stats[meta.key]
        const isActive = meta.key === activeStatKey
        if (value == null || Number.isNaN(value)) {
          return (
            <div className="profile-stat is-empty" key={meta.key}>
              <span className="profile-stat-label">{meta.label}</span>
              <span className="profile-stat-empty">no data</span>
            </div>
          )
        }
        const ctx = statContext(
          distributions.get(meta.key),
          value,
          isActive ? activeDirection : 'high',
        )
        return (
          <div
            className={`profile-stat${isActive ? ' is-active' : ''}`}
            key={meta.key}
          >
            <div className="profile-stat-head">
              <span className="profile-stat-label">{meta.label}</span>
              <span className="profile-stat-value">
                {formatValue(value, meta.unit)}
              </span>
            </div>
            <div className="profile-bar">
              <span style={{ width: `${Math.round((ctx?.fill ?? 0) * 100)}%` }} />
            </div>
            {ctx && (
              <span className="profile-stat-rank">
                #{ctx.rank.toLocaleString()} of {ctx.count.toLocaleString()}
                {isActive ? ' on this lens' : ''}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function RevealRow({
  item,
  board,
  statKey,
  unit,
  direction,
  distributions,
  flag,
  expanded,
  onToggle,
}: {
  item: GameItem
  board: BoardId
  statKey: string
  unit: string
  direction: 'high' | 'low'
  distributions: Map<string, number[]>
  flag?: boolean
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <div
      className={`reveal-row${flag ? ' matched' : ''}${expanded ? ' expanded' : ''}`}
    >
      <button
        className="reveal-row-head"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={`${item.name} details`}
      >
        <span className="reveal-text">
          <span className="reveal-name">{item.name}</span>
          <span className="reveal-meta">
            {itemSubtitle(item)}
            {flag && <span className="reveal-flag"> · Your pick</span>}
          </span>
        </span>
        <span className="reveal-right">
          <strong className="reveal-value">
            {formatValue(item.stats[statKey], unit)}
          </strong>
          <span className="reveal-caret" aria-hidden="true">
            {expanded ? '▾' : '▸'}
          </span>
        </span>
      </button>
      {expanded && (
        <ProfileCard
          item={item}
          board={board}
          activeStatKey={statKey}
          activeDirection={direction}
          distributions={distributions}
        />
      )}
    </div>
  )
}

export default function RushmoreApp() {
  const [board, setBoard] = useState<BoardId>('presidents')
  const [presidents, setPresidents] = useState<Dataset<PresidentItem> | null>(null)
  const [beverages, setBeverages] = useState<Dataset<BeverageItem> | null>(null)
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [revealed, setRevealed] = useState(false)
  const [showOptimal, setShowOptimal] = useState(false)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    fetch('/data/rushmore/presidents.compact.json')
      .then((response) => response.json())
      .then(setPresidents)
      .catch(() => setLoadError('Presidents did not load.'))
  }, [])

  useEffect(() => {
    if (board !== 'beverages' || beverages) return
    fetch('/data/rushmore/beverages.compact.json')
      .then((response) => response.json())
      .then(setBeverages)
      .catch(() => setLoadError('Food & Sodas did not load.'))
  }, [beverages, board])

  const prompts = useMemo(
    () => PROMPTS.filter((prompt) => prompt.board === board),
    [board],
  )
  const [promptId, setPromptId] = useState(PROMPTS[0].id)

  const prompt = useMemo(() => {
    const boardPrompts = PROMPTS.filter((candidate) => candidate.board === board)
    return boardPrompts.find((candidate) => candidate.id === promptId) ?? boardPrompts[0]
  }, [board, promptId])

  const dataset = (board === 'presidents' ? presidents : beverages) as
    | Dataset<GameItem>
    | null

  useEffect(() => {
    const firstPrompt = PROMPTS.find((candidate) => candidate.board === board)
    if (firstPrompt) setPromptId(firstPrompt.id)
    setSelectedIds([])
    setRevealed(false)
    setShowOptimal(false)
    setExpandedKey(null)
    setQuery('')
  }, [board])

  useEffect(() => {
    setSelectedIds([])
    setRevealed(false)
    setShowOptimal(false)
    setExpandedKey(null)
    setQuery('')
  }, [promptId])

  const normalizedQuery = query.trim().toLowerCase()

  const candidates = useMemo(() => {
    if (!dataset) return []
    return dataset.items
      .filter((item) => {
        if (!(prompt.statKey in item.stats)) return false
        if (prompt.filter && !prompt.filter(item)) return false
        return itemMatchesQuery(item, normalizedQuery)
      })
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, normalizedQuery ? 36 : 18)
  }, [dataset, prompt, normalizedQuery])

  const unavailableMatches = useMemo(() => {
    if (!dataset || !normalizedQuery) return []
    return dataset.items
      .filter((item) => {
        if (prompt.statKey in item.stats && (!prompt.filter || prompt.filter(item))) {
          return false
        }
        return itemMatchesQuery(item, normalizedQuery)
      })
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 12)
  }, [dataset, prompt, normalizedQuery])

  const selectedItems = useMemo(() => {
    if (!dataset) return []
    const byId = new Map(dataset.items.map((item) => [item.id, item]))
    return selectedIds.map((id) => byId.get(id)).filter(Boolean) as GameItem[]
  }, [dataset, selectedIds])

  // Sorted value distributions per stat across every entity that reports it,
  // used to rank a single pick within the field on its profile card.
  const statDistributions = useMemo(() => {
    const map = new Map<string, number[]>()
    if (!dataset) return map
    for (const item of dataset.items) {
      for (const [key, value] of Object.entries(item.stats)) {
        if (typeof value !== 'number' || Number.isNaN(value)) continue
        const list = map.get(key)
        if (list) list.push(value)
        else map.set(key, [value])
      }
    }
    for (const list of map.values()) list.sort((a, b) => a - b)
    return map
  }, [dataset])

  const toggleExpanded = (key: string) =>
    setExpandedKey((current) => (current === key ? null : key))

  const playablePool = useMemo(() => {
    if (!dataset) return []
    return dataset.items.filter((item) => {
      if (!(prompt.statKey in item.stats)) return false
      if (prompt.filter && !prompt.filter(item)) return false
      return true
    })
  }, [dataset, prompt])

  const optimal = useMemo(() => {
    return [...playablePool]
      .sort((a, b) =>
        prompt.direction === 'low'
          ? a.stats[prompt.statKey] - b.stats[prompt.statKey]
          : b.stats[prompt.statKey] - a.stats[prompt.statKey],
      )
      .slice(0, 4)
  }, [playablePool, prompt.statKey, prompt.direction])

  const score = selectedItems.reduce(
    (total, item) => total + (item.stats[prompt.statKey] ?? 0),
    0,
  )
  const optimalScore = optimal.reduce(
    (total, item) => total + (item.stats[prompt.statKey] ?? 0),
    0,
  )

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const matchedSummitCount = useMemo(
    () => optimal.filter((item) => selectedIdSet.has(item.id)).length,
    [optimal, selectedIdSet],
  )

  // For "low" prompts the best score is the smallest sum, so closeness to the
  // summit is optimal/score rather than score/optimal.
  const ratio =
    prompt.direction === 'low'
      ? score > 0
        ? optimalScore / score
        : 0
      : optimalScore > 0
        ? score / optimalScore
        : 0
  const band = rankBand(ratio)

  const pick = (item: GameItem) => {
    if (revealed) return
    setSelectedIds((current) => {
      if (current.includes(item.id)) return current.filter((id) => id !== item.id)
      if (current.length >= 4) return current
      return [...current, item.id]
    })
  }

  const removeAt = (index: number) => {
    if (revealed) return
    setSelectedIds((current) => current.filter((_, i) => i !== index))
  }

  const reset = () => {
    setSelectedIds([])
    setRevealed(false)
    setShowOptimal(false)
    setExpandedKey(null)
    setQuery('')
  }

  const objectiveSentence = (
    <>
      Carve the four {BOARD_NOUNS[board]} with <em>{prompt.objective}</em>.
    </>
  )

  const recordLabel = board === 'beverages' ? 'playable records' : 'presidents'

  return (
    <main className="rushmore-shell">
      <section className={`game-frame ${revealed ? 'is-reveal' : 'is-select'}`}>
        <header className="topbar">
          <p className="wordmark">Rushmore</p>
          <button className="ghost-button" onClick={reset}>
            {revealed ? 'New four' : 'Reset'}
          </button>
        </header>

        {!revealed ? (
          <>
            <section className="setup" aria-label="Objective">
              <div className="board-segment" role="tablist" aria-label="Dataset">
                {(['presidents', 'beverages'] as BoardId[]).map((id) => (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={board === id}
                    className={board === id ? 'active' : ''}
                    onClick={() => setBoard(id)}
                  >
                    {BOARD_LABELS[id]}
                  </button>
                ))}
              </div>

              <p className="objective">{objectiveSentence}</p>

              <div className="prompt-chips" role="tablist" aria-label="Prompt">
                {prompts.map((candidate) => (
                  <button
                    key={candidate.id}
                    role="tab"
                    aria-selected={prompt.id === candidate.id}
                    className={`chip ${prompt.id === candidate.id ? 'active' : ''}`}
                    onClick={() => setPromptId(candidate.id)}
                  >
                    {candidate.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="tray" aria-label="Your four picks">
              <div className="tray-slots">
                {[0, 1, 2, 3].map((index) => {
                  const item = selectedItems[index]
                  return (
                    <button
                      key={index}
                      className={`tray-slot ${item ? 'filled' : ''}`}
                      onClick={() => item && removeAt(index)}
                      aria-label={
                        item ? `Remove ${item.name}` : `Empty slot ${index + 1}`
                      }
                    >
                      {item ? (
                        <>
                          <span className="tray-mark">{itemBadge(item)}</span>
                          <span className="tray-name">{item.name}</span>
                        </>
                      ) : (
                        <span className="tray-index">{index + 1}</span>
                      )}
                    </button>
                  )
                })}
              </div>
              <p className="tray-count">
                <strong>{selectedIds.length}</strong> of 4 carved
              </p>
            </section>

            <section className="board" aria-label="Search the board">
              <div className="search-field">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={
                    board === 'presidents'
                      ? 'Search presidents — Lincoln, Obama, Nixon…'
                      : 'Search drinks — Coke, cold brew, lemonade…'
                  }
                  aria-label="Search the board"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
              {dataset && playablePool.length < dataset.items.length && (
                <p className="board-hint">
                  {playablePool.length.toLocaleString()} of{' '}
                  {dataset.items.length.toLocaleString()} have {prompt.label.toLowerCase()}{' '}
                  data.
                </p>
              )}
              <div className="result-list">
                {!dataset && <p className="muted">Loading the board…</p>}
                {loadError && <p className="muted">{loadError}</p>}
                {dataset &&
                  normalizedQuery &&
                  candidates.length === 0 &&
                  unavailableMatches.length === 0 && (
                    <p className="muted">No matches for &ldquo;{query.trim()}&rdquo;.</p>
                  )}
                {dataset &&
                  candidates.map((item) => {
                    const selected = selectedIds.includes(item.id)
                    return (
                      <button
                        key={item.id}
                        className={`result-item ${selected ? 'selected' : ''}`}
                        onClick={() => pick(item)}
                        aria-pressed={selected}
                      >
                        <span className="result-text">
                          <span className="result-name">{item.name}</span>
                          <span className="result-meta">{itemSubtitle(item)}</span>
                        </span>
                        <span className="result-tick" aria-hidden="true">
                          {selected ? '✓' : '+'}
                        </span>
                      </button>
                    )
                  })}
                {dataset &&
                  unavailableMatches.map((item) => (
                    <div
                      key={item.id}
                      className="result-item unavailable"
                      aria-disabled="true"
                    >
                      <span className="result-text">
                        <span className="result-name">{item.name}</span>
                        <span className="result-meta">
                          {unavailableReason(item, prompt, board)}
                        </span>
                      </span>
                    </div>
                  ))}
              </div>
            </section>

            <footer className="action-bar">
              <p className="record-flavor">
                {dataset?.metadata.records.toLocaleString() ?? '…'} {recordLabel}
              </p>
              <button
                className="primary-button"
                disabled={selectedIds.length !== 4}
                onClick={() => setRevealed(true)}
              >
                Carve it
              </button>
            </footer>
          </>
        ) : (
          <div className="reveal-scroll">
            <section className="reveal-hero">
              <RushmoreImage picks={selectedItems} />
            </section>

            <section className="scoreboard">
              <div className="score-figure">
                <span className="score-value">{formatValue(score, prompt.unit)}</span>
                <span className="score-caption">{prompt.label}</span>
              </div>
              <span className={`rank-band tone-${band.tone}`}>{band.label}</span>
            </section>

            <section className="breakdown" aria-label="Your picks">
              {selectedItems.map((item) => (
                <RevealRow
                  key={item.id}
                  item={item}
                  board={board}
                  statKey={prompt.statKey}
                  unit={prompt.unit}
                  direction={prompt.direction}
                  distributions={statDistributions}
                  expanded={expandedKey === `pick:${item.id}`}
                  onToggle={() => toggleExpanded(`pick:${item.id}`)}
                />
              ))}
            </section>

            <button
              className="ghost-button wide"
              onClick={() => setShowOptimal((value) => !value)}
              aria-expanded={showOptimal}
            >
              {showOptimal ? 'Hide the summit' : 'Compare to the summit'}
            </button>

            {showOptimal && (
              <section className="summit" aria-label="Best known four">
                <div className="summit-head">
                  <span>Best known four</span>
                  <strong>{formatValue(optimalScore, prompt.unit)}</strong>
                </div>
                {matchedSummitCount > 0 && (
                  <p className="summit-match-hint">
                    {matchedSummitCount} of your picks{' '}
                    {matchedSummitCount === 1 ? 'is' : 'are'} on the summit.
                  </p>
                )}
                {optimal.map((item) => (
                  <RevealRow
                    key={item.id}
                    item={item}
                    board={board}
                    statKey={prompt.statKey}
                    unit={prompt.unit}
                    direction={prompt.direction}
                    distributions={statDistributions}
                    flag={selectedIdSet.has(item.id)}
                    expanded={expandedKey === `summit:${item.id}`}
                    onToggle={() => toggleExpanded(`summit:${item.id}`)}
                  />
                ))}
              </section>
            )}

            <footer className="reveal-actions">
              <button className="primary-button" onClick={reset}>
                Build another four
              </button>
            </footer>

            <p className="source-line">
              Source: {dataset?.metadata.source ?? 'loading'}
              {sourceText(dataset) && (
                <>
                  {' '}
                  <a href={sourceText(dataset)} target="_blank" rel="noreferrer">
                    view
                  </a>
                </>
              )}
            </p>
          </div>
        )}
      </section>
    </main>
  )
}
