import type { Tier } from '../types/database'

export interface TierConfig {
  label: string
  shortLabel: string
  color: string
  bgClass: string
  textClass: string
  borderClass: string
  description: string
}

export const TIER_CONFIG: Record<Tier, TierConfig> = {
  1: {
    label: 'Direct Evidence',
    shortLabel: 'DIRECT',
    color: '#DC2626',
    bgClass: 'bg-tier-1',
    textClass: 'text-tier-1',
    borderClass: 'border-tier-1',
    description: 'Convicted, charged, or named as abuser in forensically authenticated victim journals',
  },
  2: {
    label: 'Immunized',
    shortLabel: 'IMMUNIZED',
    color: '#F59E0B',
    bgClass: 'bg-tier-2',
    textClass: 'text-tier-2',
    borderClass: 'border-tier-2',
    description: 'Named co-conspirators in 2007 NPA who received blanket immunity',
  },
  3: {
    label: 'Circumstantial',
    shortLabel: 'CIRCUMSTANTIAL',
    color: '#F97316',
    bgClass: 'bg-tier-3',
    textClass: 'text-tier-3',
    borderClass: 'border-tier-3',
    description: 'Documentary evidence of suspicious conduct without direct evidence',
  },
  4: {
    label: 'Associated',
    shortLabel: 'ASSOCIATED',
    color: '#6B7280',
    bgClass: 'bg-tier-4',
    textClass: 'text-tier-4',
    borderClass: 'border-tier-4',
    description: 'Documented contact without evidence of criminal awareness',
  },
  5: {
    label: 'Victim / Witness',
    shortLabel: 'VICTIM',
    color: '#14B8A6',
    bgClass: 'bg-tier-5',
    textClass: 'text-tier-5',
    borderClass: 'border-tier-5',
    description: 'Identified victims or witnesses who provided testimony',
  },
  6: {
    label: 'Peripheral',
    shortLabel: 'PERIPHERAL',
    color: '#64748B',
    bgClass: 'bg-tier-6',
    textClass: 'text-tier-6',
    borderClass: 'border-tier-6',
    description: 'Household staff, pilots, prosecutors, defense attorneys, investigating officers',
  },
} as const

export const TIER_LABELS: Record<Tier, string> = {
  1: 'Direct Evidence',
  2: 'Immunized',
  3: 'Circumstantial',
  4: 'Associated',
  5: 'Victim / Witness',
  6: 'Peripheral',
} as const
