import { foilProfiles } from './foilProfiles.generated'

export type FoilProfile =
  | 'calendar-wave'
  | 'free-form-1'
  | 'free-form-2'
  | 'glitter'
  | 'lava'
  | 'lore'
  | 'magma'
  | 'rainbow-pillars'
  | 'satin'
  | 'sea-wave'
  | 'silver'
  | 'tempest'
  | 'vertical-wave'

type FoilCardIdentity = {
  setCode?: string
  collectorNumber?: string
  rarity?: string
}

function cleanPart(value: string | undefined) {
  const cleaned = value?.trim().replace(/^0+(?=\d)/, '').replace(/[^a-zA-Z0-9-]/g, '')
  return cleaned || null
}

export function foilProfileFor(card: FoilCardIdentity): FoilProfile {
  const cardKey = foilCardKey(card)
  if (cardKey && cardKey in foilProfiles) {
    return normalizeProfile(foilProfiles[cardKey as keyof typeof foilProfiles][0])
  }

  const rarity = card.rarity?.trim().toLocaleLowerCase('en')
  const setNumber = Number.parseInt(card.setCode ?? '', 10)

  if (rarity === 'iconic') return 'lore'
  if (rarity === 'epic') return 'satin'
  if (rarity === 'enchanted') {
    if (Number.isFinite(setNumber) && setNumber <= 4) return 'lava'
    if (Number.isFinite(setNumber) && setNumber <= 8) return 'vertical-wave'
    return 'magma'
  }
  return 'silver'
}

export function foilHasTopLayer(card: FoilCardIdentity) {
  const cardKey = foilCardKey(card)
  return Boolean(cardKey && cardKey in foilProfiles && foilProfiles[cardKey as keyof typeof foilProfiles][1])
}

export function foilProfileCount() {
  return Object.keys(foilProfiles).length
}

function normalizeProfile(profile: string): FoilProfile {
  return profile
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Za-z])(\d)/g, '$1-$2')
    .toLocaleLowerCase('en') as FoilProfile
}

function foilCardKey(card: FoilCardIdentity) {
  const setCode = cleanPart(card.setCode)
  const collectorNumber = cleanPart(card.collectorNumber)
  return setCode && collectorNumber ? `${setCode}-${collectorNumber}` : null
}

export function foilMaskUrls(card: FoilCardIdentity) {
  const cardKey = foilCardKey(card)
  if (!cardKey) return null
  const base = 'https://cards.duels.ink/lorcana/en'
  return {
    cardKey,
    image: `${base}/full/${cardKey}.webp`,
    mask: `${base}/foil-masks/${cardKey}.webp`,
    topMask: `${base}/foil-top-masks/${cardKey}.webp`,
  }
}
