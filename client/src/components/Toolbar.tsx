import type { ComponentType, ReactNode } from 'react'
import { AtSign, Clock, Hash, Mountain, Pencil, Quote, Type, Wrench } from 'lucide-react'
import { DURATIONS, supportsTextOptions, WORD_COUNTS, type Mode, type TestConfig } from '../features/modes/config'

type IconType = ComponentType<{ size?: number }>

function Group({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center justify-center rounded-lg bg-sub px-1 py-1 text-xs">
      {children}
    </div>
  )
}

function Pill({ active, disabled, onClick, Icon, children }: {
  active?: boolean
  disabled?: boolean
  onClick: () => void
  Icon?: IconType
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 transition-colors disabled:opacity-40 sm:px-3.5 ${
        active ? 'text-accent' : disabled ? 'text-muted' : 'text-muted hover:text-text'
      }`}
    >
      {Icon && <Icon size={13} />}
      {children}
    </button>
  )
}

const modes: { id: Mode; Icon: IconType }[] = [
  { id: 'time', Icon: Clock },
  { id: 'words', Icon: Type },
  { id: 'quote', Icon: Quote },
  { id: 'zen', Icon: Mountain },
  { id: 'custom', Icon: Wrench },
]

interface Props {
  config: TestConfig
  onChange: (patch: Partial<TestConfig>) => void
  onEditCustom: () => void
}

export default function Toolbar({ config, onChange, onEditCustom }: Props) {
  const textOptions = supportsTextOptions(config.mode)
  return (
    <div className="flex flex-wrap justify-center gap-3">
      <Group label="Text options">
        <Pill Icon={AtSign} disabled={!textOptions} active={textOptions && config.punctuation} onClick={() => onChange({ punctuation: !config.punctuation })}>
          punctuation
        </Pill>
        <Pill Icon={Hash} disabled={!textOptions} active={textOptions && config.numbers} onClick={() => onChange({ numbers: !config.numbers })}>
          numbers
        </Pill>
      </Group>
      <Group label="Test mode">
        {modes.map(({ id, Icon }) => (
          <Pill key={id} Icon={Icon} active={config.mode === id} onClick={() => onChange({ mode: id })}>
            {id}
          </Pill>
        ))}
      </Group>
      {config.mode === 'time' && (
        <Group label="Duration in seconds">
          {DURATIONS.map((d) => (
            <Pill key={d} active={config.duration === d} onClick={() => onChange({ duration: d })}>
              {d}
            </Pill>
          ))}
        </Group>
      )}
      {config.mode === 'words' && (
        <Group label="Number of words">
          {WORD_COUNTS.map((n) => (
            <Pill key={n} active={config.wordCount === n} onClick={() => onChange({ wordCount: n })}>
              {n}
            </Pill>
          ))}
        </Group>
      )}
      {config.mode === 'custom' && (
        <Group label="Custom text">
          <Pill Icon={Pencil} onClick={onEditCustom}>
            edit text
          </Pill>
        </Group>
      )}
    </div>
  )
}
