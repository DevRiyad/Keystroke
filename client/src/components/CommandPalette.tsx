import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import Modal from './Modal'

export interface PaletteAction {
  id: string
  label: string
  run: () => void
}

export default function CommandPalette({ actions, onClose }: { actions: PaletteAction[]; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const matches = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    return actions.filter((a) => words.every((w) => a.label.toLowerCase().includes(w)))
  }, [actions, query])
  const activeIndex = Math.min(active, Math.max(0, matches.length - 1))
  const activeId = matches[activeIndex] ? `cmd-${matches[activeIndex].id}` : undefined

  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView({ block: 'nearest' })
  }, [activeId])

  const run = (a: PaletteAction) => {
    onClose()
    a.run()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive(matches.length ? (activeIndex + 1) % matches.length : 0)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(matches.length ? (activeIndex - 1 + matches.length) % matches.length : 0)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (matches[activeIndex]) run(matches[activeIndex])
    }
  }

  return (
    <Modal label="Command palette" onClose={onClose}>
      <input
        data-autofocus
        type="text"
        role="combobox"
        aria-label="Search commands"
        aria-expanded="true"
        aria-controls="cmd-list"
        aria-activedescendant={activeId}
        autoComplete="off"
        spellCheck={false}
        placeholder="type a command..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
        }}
        onKeyDown={onKeyDown}
        className="w-full rounded bg-sub px-3 py-2 text-base text-text outline-none placeholder:text-muted focus:ring-1 focus:ring-accent"
      />
      <ul id="cmd-list" role="listbox" aria-label="Commands" className="mt-3 max-h-72 overflow-y-auto text-sm">
        {matches.map((a, i) => (
          <li
            key={a.id}
            id={`cmd-${a.id}`}
            role="option"
            aria-selected={i === activeIndex}
            onMouseMove={() => setActive(i)}
            onClick={() => run(a)}
            className={`cursor-pointer rounded px-3 py-1.5 ${i === activeIndex ? 'bg-sub text-accent' : 'text-muted'}`}
          >
            {a.label}
          </li>
        ))}
        {matches.length === 0 && <li className="px-3 py-1.5 text-muted">no matching commands</li>}
      </ul>
    </Modal>
  )
}
