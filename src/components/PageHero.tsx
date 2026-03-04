import type { ReactNode } from 'react'

type EyebrowProps = {
  label: string
  href?: string
}

type PageHeroProps = {
  eyebrow: EyebrowProps
  title: string
  description: ReactNode
  children?: ReactNode
  className?: string
}

const baseClassName =
  'bg-slate-800/80 border border-slate-700 rounded-2xl p-5 shadow-xl text-left space-y-3'
const eyebrowClassName =
  'inline-flex text-xs uppercase tracking-[0.2em] text-emerald-300 hover:text-emerald-200 transition-colors'

export function PageHero({
  eyebrow,
  title,
  description,
  children,
  className,
}: PageHeroProps) {
  const WrapperTag: 'a' | 'p' = eyebrow.href ? 'a' : 'p'
  const eyebrowProps = eyebrow.href
    ? { href: eyebrow.href, className: eyebrowClassName }
    : { className: eyebrowClassName }

  return (
    <section className={[baseClassName, className].filter(Boolean).join(' ')}>
      <WrapperTag {...eyebrowProps}>{eyebrow.label}</WrapperTag>
      <h1 className="text-2xl font-semibold text-white">{title}</h1>
      <div className="text-slate-300 text-sm space-y-1">{description}</div>
      {children}
    </section>
  )
}
