import { useEffect, useMemo, useState } from 'react'

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
  filter?: (item: GameItem) => boolean
}

const PROMPTS: Prompt[] = [
  {
    id: 'approval-high',
    board: 'presidents',
    label: 'Peak approval',
    statKey: 'approval_high',
    unit: '%',
  },
  {
    id: 'executive-orders',
    board: 'presidents',
    label: 'Executive orders',
    statKey: 'executive_orders_total',
    unit: 'orders',
  },
  {
    id: 'electoral-share',
    board: 'presidents',
    label: 'Best electoral share',
    statKey: 'best_electoral_vote_pct',
    unit: '%',
  },
  {
    id: 'soda-sugar',
    board: 'beverages',
    label: 'Soda sugar',
    statKey: 'sugar_g_per_12_fl_oz',
    unit: 'g',
    filter: (item) =>
      'category' in item && item.defaultPlayable && item.category === 'Soda',
  },
  {
    id: 'drink-caffeine',
    board: 'beverages',
    label: 'Caffeine',
    statKey: 'caffeine_mg_per_12_fl_oz',
    unit: 'mg',
    filter: (item) => 'defaultPlayable' in item && item.defaultPlayable,
  },
  {
    id: 'drink-calories',
    board: 'beverages',
    label: 'Calories',
    statKey: 'calories_per_12_fl_oz',
    unit: 'kcal',
    filter: (item) => 'defaultPlayable' in item && item.defaultPlayable,
  },
]

const BOARD_LABELS: Record<BoardId, string> = {
  presidents: 'Presidents',
  beverages: 'Food & Sodas',
}

const SLOT_POSITIONS = [
  { left: '24.4%', top: '31.2%', width: '12.5%', height: '25.6%', transform: 'rotate(-3deg)' },
  { left: '38.6%', top: '37%', width: '10.8%', height: '25%', transform: 'rotate(2deg)' },
  { left: '50.5%', top: '50.2%', width: '9.6%', height: '24%', transform: 'rotate(-2deg)' },
  { left: '66.4%', top: '49%', width: '13.2%', height: '28.4%', transform: 'rotate(3deg)' },
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

function RushmoreImage({ picks }: { picks: GameItem[] }) {
  return (
    <div className="mount-wrap" aria-label="Mount Rushmore reveal">
      <div className="mount-slots">
        {SLOT_POSITIONS.map((slot, index) => {
          const pick = picks[index]
          return (
            <div
              key={index}
              className={`mount-slot ${pick ? 'filled' : ''}`}
              style={slot}
            >
              {pick ? (
                <>
                  <span className="slot-mark">{itemBadge(pick)}</span>
                  <span className="slot-name">{pick.name}</span>
                </>
              ) : (
                <span className="slot-mark">?</span>
              )}
            </div>
          )
        })}
      </div>
      <img src="/rushmore.png" alt="" />
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
    setQuery('')
  }, [board])

  useEffect(() => {
    setSelectedIds([])
    setRevealed(false)
    setShowOptimal(false)
    setQuery('')
  }, [promptId])

  const candidates = useMemo(() => {
    if (!dataset) return []
    const normalized = query.trim().toLowerCase()
    const pool = dataset.items.filter((item) => {
      if (!(prompt.statKey in item.stats)) return false
      if (prompt.filter && !prompt.filter(item)) return false
      if (!normalized) return true
      const haystack = `${item.name} ${itemSubtitle(item)}`.toLowerCase()
      return haystack.includes(normalized)
    })
    return pool
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, normalized ? 36 : 18)
  }, [dataset, prompt, query])

  const selectedItems = useMemo(() => {
    if (!dataset) return []
    const byId = new Map(dataset.items.map((item) => [item.id, item]))
    return selectedIds.map((id) => byId.get(id)).filter(Boolean) as GameItem[]
  }, [dataset, selectedIds])

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
      .sort((a, b) => b.stats[prompt.statKey] - a.stats[prompt.statKey])
      .slice(0, 4)
  }, [playablePool, prompt.statKey])

  const score = selectedItems.reduce(
    (total, item) => total + (item.stats[prompt.statKey] ?? 0),
    0,
  )
  const optimalScore = optimal.reduce(
    (total, item) => total + (item.stats[prompt.statKey] ?? 0),
    0,
  )

  const pick = (item: GameItem) => {
    if (revealed) return
    setSelectedIds((current) => {
      if (current.includes(item.id)) return current.filter((id) => id !== item.id)
      if (current.length >= 4) return current
      return [...current, item.id]
    })
  }

  const reset = () => {
    setSelectedIds([])
    setRevealed(false)
    setShowOptimal(false)
    setQuery('')
  }

  return (
    <main className="rushmore-shell">
      <section className="game-frame">
        <header className="rushmore-top">
          <div>
            <p className="kicker">Build the mountain</p>
            <h1>Rushmore</h1>
          </div>
          <button className="quiet-button" onClick={reset}>
            Reset
          </button>
        </header>

        <div className="board-toggle" role="tablist" aria-label="Dataset">
          {(['presidents', 'beverages'] as BoardId[]).map((id) => (
            <button
              key={id}
              className={board === id ? 'active' : ''}
              onClick={() => setBoard(id)}
            >
              {BOARD_LABELS[id]}
            </button>
          ))}
        </div>

        <section className="prompt-strip" aria-label="Prompt">
          {prompts.map((candidate) => (
            <button
              key={candidate.id}
              className={prompt.id === candidate.id ? 'active' : ''}
              onClick={() => setPromptId(candidate.id)}
            >
              {candidate.label}
            </button>
          ))}
        </section>

        <section className="mount-section">
          <RushmoreImage picks={revealed ? selectedItems : selectedItems} />
          <div className="score-ribbon">
            <span>{prompt.label}</span>
            <strong>{revealed ? formatValue(score, prompt.unit) : `${selectedIds.length}/4`}</strong>
          </div>
        </section>

        <section className="pick-row" aria-label="Selected four">
          {[0, 1, 2, 3].map((index) => {
            const item = selectedItems[index]
            return (
              <button
                key={index}
                className={`pick-chip ${item ? 'filled' : ''}`}
                onClick={() => item && !revealed && pick(item)}
              >
                <span>{item ? itemBadge(item) : index + 1}</span>
                <b>{item ? item.name : 'Open face'}</b>
              </button>
            )
          })}
        </section>

        {!revealed ? (
          <section className="search-panel">
            <label>
              <span>Search the board</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={board === 'presidents' ? 'Lincoln, Obama, Nixon...' : 'Coke, cold brew, lemonade...'}
              />
            </label>
            <div className="result-list">
              {!dataset && <p className="muted">Loading dataset...</p>}
              {loadError && <p className="muted">{loadError}</p>}
              {dataset &&
                candidates.map((item) => {
                  const selected = selectedIds.includes(item.id)
                  return (
                    <button
                      key={item.id}
                      className={`result-item ${selected ? 'selected' : ''}`}
                      onClick={() => pick(item)}
                    >
                      <span className="result-name">{item.name}</span>
                      <span className="result-meta">{itemSubtitle(item)}</span>
                    </button>
                  )
                })}
            </div>
          </section>
        ) : (
          <section className="reveal-panel">
            <div className="breakdown">
              {selectedItems.map((item) => (
                <div key={item.id} className="breakdown-row">
                  <span>{item.name}</span>
                  <strong>{formatValue(item.stats[prompt.statKey], prompt.unit)}</strong>
                </div>
              ))}
            </div>
            <button className="summit-button" onClick={() => setShowOptimal((value) => !value)}>
              {showOptimal ? 'Hide summit' : 'Compare to summit'}
            </button>
            {showOptimal && (
              <div className="optimal-list">
                <div className="breakdown-row summit">
                  <span>Best known four</span>
                  <strong>{formatValue(optimalScore, prompt.unit)}</strong>
                </div>
                {optimal.map((item) => (
                  <div key={item.id} className="breakdown-row">
                    <span>{item.name}</span>
                    <strong>{formatValue(item.stats[prompt.statKey], prompt.unit)}</strong>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <footer className="action-bar">
          <div>
            <span>{dataset?.metadata.records.toLocaleString() ?? '...'}</span>
            <small>{board === 'beverages' ? 'playable records' : 'presidents'}</small>
          </div>
          {!revealed ? (
            <button
              className="primary-button"
              disabled={selectedIds.length !== 4}
              onClick={() => setRevealed(true)}
            >
              Carve it
            </button>
          ) : (
            <button className="primary-button" onClick={reset}>
              New four
            </button>
          )}
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
      </section>
    </main>
  )
}
