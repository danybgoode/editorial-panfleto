import React from 'react'

import { cn } from '@/utilities/ui'

export function SectionHeading({
  children,
  className,
  eyebrow,
}: {
  children: React.ReactNode
  className?: string
  eyebrow?: string
}) {
  return (
    <div className={cn('section-heading', className)}>
      {eyebrow && <p>{eyebrow}</p>}
      <h2>{children}</h2>
    </div>
  )
}
