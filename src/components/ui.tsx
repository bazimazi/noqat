/**
 * UI primitives.
 *
 * A small, deliberately boring set: everything takes its colour from the theme
 * variables, every interactive element has a visible focus ring and a minimum
 * 44px touch target, and every animation respects the motion settings.
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'

/* ------------------------------------------------------------------ *
 * Button
 * ------------------------------------------------------------------ */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
  icon?: ReactNode
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3 text-sm gap-1.5',
  md: 'min-h-11 px-4 text-base gap-2',
  lg: 'min-h-14 px-6 text-lg gap-2.5',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', block, icon, className, children, style, ...rest },
  ref,
) {
  const variantStyle: React.CSSProperties =
    variant === 'primary'
      ? { background: 'var(--nq-accent)', color: 'var(--nq-bg)', borderColor: 'transparent' }
      : variant === 'danger'
        ? { background: 'transparent', color: '#ff6b6b', borderColor: 'rgba(255,107,107,.5)' }
        : variant === 'ghost'
          ? { background: 'transparent', color: 'var(--nq-text)', borderColor: 'transparent' }
          : { background: 'var(--nq-surface)', color: 'var(--nq-text)', borderColor: 'var(--nq-border)' }

  return (
    <motion.button
      ref={ref}
      type="button"
      whileTap={{ scale: 0.97 }}
      whileHover={{ y: -1 }}
      transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
      className={clsx(
        'nq-focus-ring inline-flex cursor-pointer items-center justify-center border font-medium select-none',
        'disabled:pointer-events-none disabled:opacity-45',
        SIZES[size],
        block && 'w-full',
        className,
      )}
      style={{
        borderRadius: 'var(--nq-radius)',
        backdropFilter: variant === 'secondary' ? 'var(--nq-glass)' : undefined,
        ...variantStyle,
        ...style,
      }}
      {...(rest as React.ComponentProps<typeof motion.button>)}
    >
      {icon}
      {children}
    </motion.button>
  )
})

export function IconButton({
  label,
  children,
  className,
  ...rest
}: ButtonProps & { label: string }) {
  return (
    <Button
      aria-label={label}
      title={label}
      variant="ghost"
      className={clsx('h-11 w-11 shrink-0 !px-0 [&>svg]:size-6', className)}
      {...rest}
    >
      {children}
    </Button>
  )
}

/** Header back chevron. Flips in RTL so it still points toward the start. */
export function BackIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      aria-hidden="true"
      className="rtl:-scale-x-100"
    >
      <path d="M15 5 8 12l7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ------------------------------------------------------------------ *
 * Panel
 * ------------------------------------------------------------------ */

export function Panel({
  children,
  className,
  as: As = 'div',
  ...rest
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'section' | 'aside'
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <As className={clsx('nq-panel p-4', className)} {...rest}>
      {children}
    </As>
  )
}

/* ------------------------------------------------------------------ *
 * Segmented control
 * ------------------------------------------------------------------ */

export interface SegmentedOption<T extends string> {
  readonly value: T
  readonly label: ReactNode
  readonly hint?: string
  readonly disabled?: boolean
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T
  options: readonly SegmentedOption<T>[]
  onChange: (value: T) => void
  label: string
  className?: string
}) {
  const groupId = useId()
  // The indicator is one element parked over the selected option rather than a
  // `layoutId` shared-layout animation. Shared layout keeps a projection node
  // alive across unmount, which deadlocks the screen-level `AnimatePresence`
  // this control usually lives inside: the old screen can never finish exiting.
  const groupRef = useRef<HTMLDivElement | null>(null)
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  const [indicator, setIndicator] = useState<{ x: number; y: number; w: number; h: number } | null>(null)

  const measure = useCallback(() => {
    const group = groupRef.current
    const button = buttons.current.get(value)
    if (!group || !button) {
      setIndicator(null)
      return
    }
    const next = {
      x: button.offsetLeft,
      y: button.offsetTop,
      w: button.offsetWidth,
      h: button.offsetHeight,
    }
    setIndicator((prev) =>
      prev && prev.x === next.x && prev.y === next.y && prev.w === next.w && prev.h === next.h ? prev : next,
    )
  }, [value])

  useLayoutEffect(measure, [measure, options])

  useEffect(() => {
    const group = groupRef.current
    if (!group || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(group)
    for (const button of buttons.current.values()) observer.observe(button)
    return () => observer.disconnect()
  }, [measure, options])

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={label}
      className={clsx('relative flex flex-wrap gap-1 p-1', className)}
      style={{
        background: 'var(--nq-surface)',
        border: '1px solid var(--nq-border)',
        borderRadius: 'var(--nq-radius)',
      }}
    >
      {indicator && (
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0"
          style={{ background: 'var(--nq-accent)', borderRadius: 'calc(var(--nq-radius) - 4px)' }}
          initial={false}
          animate={{ x: indicator.x, y: indicator.y, width: indicator.w, height: indicator.h }}
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        />
      )}
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            ref={(node) => {
              if (node) buttons.current.set(option.value, node)
              else buttons.current.delete(option.value)
            }}
            id={`${groupId}-${option.value}`}
            role="radio"
            type="button"
            aria-checked={selected}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            title={option.hint}
            className="nq-focus-ring relative min-h-10 flex-1 px-3 text-sm font-medium disabled:opacity-40"
            style={{ borderRadius: 'calc(var(--nq-radius) - 4px)', color: selected ? 'var(--nq-bg)' : 'var(--nq-text)' }}
          >
            <span className="relative z-10 whitespace-nowrap">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Select
 * ------------------------------------------------------------------ */

/**
 * A native select with our own chevron.
 *
 * The browser's built-in arrow is parked a couple of pixels off the border and
 * ignores the element's padding, so it always looks cramped and the option text
 * can slide underneath it. Suppressing it costs nothing — the popup, the
 * keyboard behaviour and the mobile wheel are all still the platform's.
 */
export function Select({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={clsx('relative', className)}>
      <select
        className="nq-focus-ring min-h-11 w-full cursor-pointer appearance-none ps-3 pe-10"
        style={{
          WebkitAppearance: 'none',
          background: 'var(--nq-surface-alt)',
          color: 'var(--nq-text)',
          border: '1px solid var(--nq-border)',
          borderRadius: 'var(--nq-radius-sm)',
        }}
        {...rest}
      >
        {children}
      </select>
      {/* The viewBox hugs the stroke, so `end-3` is the gap you actually see —
          the usual 24-unit icon box would hide 4px of slack inside it. */}
      <svg
        viewBox="0 0 12 9"
        width="12"
        height="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2"
        style={{ color: 'var(--nq-text-muted)' }}
        aria-hidden="true"
      >
        <path d="M1 3l5 5 5-5" />
      </svg>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Toggle
 * ------------------------------------------------------------------ */

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  description?: string
}) {
  const id = useId()
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <label htmlFor={id} className="flex-1 cursor-pointer">
        <span className="block text-sm font-medium">{label}</span>
        {description && (
          <span className="block text-xs" style={{ color: 'var(--nq-text-muted)' }}>
            {description}
          </span>
        )}
      </label>
      <button
        id={id}
        role="switch"
        type="button"
        dir="ltr"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className="nq-focus-ring relative inline-flex h-7 w-12 shrink-0 items-center overflow-hidden rounded-full border p-[3px] transition-colors"
        style={{
          background: checked ? 'var(--nq-accent)' : 'var(--nq-surface-alt)',
          borderColor: 'var(--nq-border)',
        }}
      >
        {/* Motion can't interpolate insetInlineStart, so the thumb is translated on x. dir=ltr keeps off=left in RTL. */}
        <motion.span
          className="block size-5 rounded-full"
          style={{ background: checked ? 'var(--nq-bg)' : 'var(--nq-text-muted)' }}
          initial={false}
          animate={{ x: checked ? '100%' : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        />
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Slider
 * ------------------------------------------------------------------ */

export function Slider({
  value,
  onChange,
  label,
  valueLabel,
  ...rest
}: {
  value: number
  onChange: (value: number) => void
  label: string
  valueLabel?: string
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>) {
  const id = useId()
  const min = Number(rest.min ?? 0)
  const max = Number(rest.max ?? 1)
  const percent = ((value - min) / (max - min)) * 100
  return (
    <div className="py-2">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {valueLabel && (
          <span className="nq-numeric text-xs" style={{ color: 'var(--nq-text-muted)' }}>
            {valueLabel}
          </span>
        )}
      </div>
      <input
        id={id}
        type="range"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="nq-focus-ring h-11 w-full cursor-pointer appearance-none bg-transparent"
        style={{
          // A single linear-gradient track keeps the fill in sync with the
          // value without a second element to keep positioned.
          background: `linear-gradient(to right, var(--nq-accent) ${percent}%, var(--nq-surface-alt) ${percent}%)`,
          backgroundSize: '100% 6px',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          borderRadius: 99,
        }}
        {...rest}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Modal
 * ------------------------------------------------------------------ */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  // Focus trap plus Escape. Small enough to own; large enough to matter.
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (!focusables?.length) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previous?.focus?.()
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(4px)' }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="nq-panel relative w-full max-w-md p-5"
          >
            <h2 id={titleId} className="nq-display mb-3 text-xl">
              {title}
            </h2>
            <div className="nq-scroll max-h-[60vh] text-sm">{children}</div>
            {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ------------------------------------------------------------------ *
 * Misc
 * ------------------------------------------------------------------ */

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{
        background: tone === 'accent' ? 'var(--nq-accent)' : 'var(--nq-surface-alt)',
        color: tone === 'accent' ? 'var(--nq-bg)' : 'var(--nq-text-muted)',
      }}
    >
      {children}
    </span>
  )
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const clamped = Math.max(0, Math.min(1, value))
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="h-2 w-full overflow-hidden rounded-full"
      style={{ background: 'var(--nq-surface-alt)' }}
    >
      <motion.div
        className="h-full rounded-full"
        style={{ background: 'var(--nq-accent)' }}
        animate={{ width: `${clamped * 100}%` }}
        transition={{ type: 'spring', stiffness: 200, damping: 30 }}
      />
    </div>
  )
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="nq-panel-solid p-3">
      <div className="text-xs" style={{ color: 'var(--nq-text-muted)' }}>
        {label}
      </div>
      <div className="nq-numeric mt-0.5 text-xl font-semibold">{value}</div>
      {sub && (
        <div className="text-xs" style={{ color: 'var(--nq-text-muted)' }}>
          {sub}
        </div>
      )}
    </div>
  )
}
