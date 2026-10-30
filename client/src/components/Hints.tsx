const Kbd = ({ children }: { children: string }) => (
  <kbd className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-bg">{children}</kbd>
)

export default function Hints() {
  return (
    <div className="space-y-2 text-center text-xs leading-6 text-muted">
      <p>
        <Kbd>tab</Kbd> + <Kbd>enter</Kbd> - restart test
      </p>
      <p>
        <Kbd>esc</Kbd> - leave the typing area · <Kbd>ctrl</Kbd> + <Kbd>shift</Kbd> + <Kbd>p</Kbd> - command line
      </p>
    </div>
  )
}
