import { useState } from 'react'
import { MAX_CUSTOM_CHARS, normalizeCustomText } from '../features/modes/config'

interface Props {
  initial: string
  onApply: (text: string) => void
  onCancel?: () => void
}

export default function CustomTextPanel({ initial, onApply, onCancel }: Props) {
  const [text, setText] = useState(initial)
  const [error, setError] = useState('')

  const submit = () => {
    const r = normalizeCustomText(text)
    if (!r.ok) {
      setError(r.error)
      return
    }
    setError('')
    onApply(r.text)
  }

  return (
    <section aria-label="Custom text" className="mx-auto w-full max-w-3xl">
      <label htmlFor="custom-text" className="mb-2 block text-sm text-muted">
        type or paste the text you want to practice
      </label>
      <textarea
        id="custom-text"
        value={text}
        rows={6}
        onChange={(e) => {
          setText(e.target.value)
          setError('')
        }}
        className="w-full resize-y rounded-lg bg-sub p-3 font-mono text-base text-text outline-none focus:ring-1 focus:ring-accent"
      />
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
        <span className={text.length > MAX_CUSTOM_CHARS ? 'text-error' : 'text-muted'}>
          {text.length}/{MAX_CUSTOM_CHARS}
        </span>
        {error && (
          <span role="alert" className="text-error">
            {error}
          </span>
        )}
        <span className="flex-1" />
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded px-3 py-1.5 text-muted hover:text-text">
            cancel
          </button>
        )}
        <button type="button" onClick={submit} className="rounded bg-sub px-3 py-1.5 text-accent hover:text-text">
          start
        </button>
      </div>
    </section>
  )
}
