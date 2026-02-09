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
    label: 'Convicted / Charged',
    shortLabel: 'CONVICTED',
    color: '#DC2626',
    bgClass: 'bg-tier-1',
    textClass: 'text-tier-1',
    borderClass: 'border-tier-1',
    description: 'Formally charged, convicted, or named as abuser in forensically authenticated victim journals',
  },
  2: {
    label: 'NPA Immunity',
    shortLabel: 'NPA IMMUNITY',
    color: '#F59E0B',
    bgClass: 'bg-tier-2',
    textClass: 'text-tier-2',
    borderClass: 'border-tier-2',
    description: 'Named co-conspirators in 2007 NPA; received blanket immunity; never charged',
  },
  3: {
    label: 'Suspicious / Concerning',
    shortLabel: 'SUSPICIOUS',
    color: '#F97316',
    bgClass: 'bg-tier-3',
    textClass: 'text-tier-3',
    borderClass: 'border-tier-3',
    description: 'Documentary evidence of suspicious conduct; no charges filed',
  },
  4: {
    label: 'Social / Professional',
    shortLabel: 'SOCIAL',
    color: '#6B7280',
    bgClass: 'bg-tier-4',
    textClass: 'text-tier-4',
    borderClass: 'border-tier-4',
    description: 'Documented contact with Epstein but no evidence of criminal awareness or participation',
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
    label: 'Staff / Legal',
    shortLabel: 'STAFF',
    color: '#64748B',
    bgClass: 'bg-tier-6',
    textClass: 'text-tier-6',
    borderClass: 'border-tier-6',
    description: 'Household staff, pilots, prosecutors, defense attorneys, investigating officers',
  },
} as const

export const TIER_LABELS: Record<Tier, string> = {
  1: 'Convicted / Charged',
  2: 'NPA Immunity',
  3: 'Suspicious / Concerning',
  4: 'Social / Professional',
  5: 'Victim / Witness',
  6: 'Staff / Legal',
} as const
