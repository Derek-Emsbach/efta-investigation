import type { VerificationStatus } from '@efta/shared'

const STATUS_CONFIG: Record<VerificationStatus, { label: string; className: string; icon: string }> = {
  verified: {
    label: 'Verified',
    className: 'bg-success/10 text-success border-success/20',
    icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  unverified: {
    label: 'Unverified',
    className: 'bg-text-muted/10 text-text-muted border-text-muted/20',
    icon: 'M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z',
  },
  disputed: {
    label: 'Disputed',
    className: 'bg-critical/10 text-critical border-critical/20',
    icon: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
  },
  retracted: {
    label: 'Retracted',
    className: 'bg-critical/10 text-critical border-critical/20 line-through',
    icon: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636',
  },
}

interface VerificationBadgeProps {
  status: VerificationStatus
  size?: 'sm' | 'md'
}

export function VerificationBadge({ status, size = 'sm' }: VerificationBadgeProps) {
  const config = STATUS_CONFIG[status]

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${config.className} ${
        size === 'sm' ? 'text-[10px]' : 'text-xs'
      }`}
      title={config.label}
    >
      <svg
        className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={config.icon} />
      </svg>
      {config.label}
    </span>
  )
}
