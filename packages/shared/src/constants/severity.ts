import type { Severity } from '../types/database'

export interface SeverityConfig {
  label: string
  color: string
  bgClass: string
  textClass: string
  borderClass: string
  pulse: boolean
}

export const SEVERITY_CONFIG: Record<Severity, SeverityConfig> = {
  extreme_critical: {
    label: 'EXTREME CRITICAL',
    color: '#DC2626',
    bgClass: 'bg-severity-extreme',
    textClass: 'text-severity-extreme',
    borderClass: 'border-severity-extreme',
    pulse: true,
  },
  critical: {
    label: 'CRITICAL',
    color: '#EF4444',
    bgClass: 'bg-severity-critical',
    textClass: 'text-severity-critical',
    borderClass: 'border-severity-critical',
    pulse: false,
  },
  high: {
    label: 'HIGH',
    color: '#F59E0B',
    bgClass: 'bg-severity-high',
    textClass: 'text-severity-high',
    borderClass: 'border-severity-high',
    pulse: false,
  },
  routine: {
    label: 'ROUTINE',
    color: '#10B981',
    bgClass: 'bg-severity-routine',
    textClass: 'text-severity-routine',
    borderClass: 'border-severity-routine',
    pulse: false,
  },
} as const

export const REDACTION_CATEGORIES = {
  A: { label: 'Victim Protection', legitimacy: 'legitimate', color: '#10B981' },
  B: { label: 'Legal Privilege', legitimacy: 'provisional', color: '#3B82F6' },
  C: { label: 'Institutional Protection', legitimacy: 'suspect', color: '#F59E0B' },
  D: { label: 'Perpetrator Protection', legitimacy: 'highest_scrutiny', color: '#DC2626' },
} as const
