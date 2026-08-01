export const EARTH_METEOR_COUNT = 3
export const EARTH_METEOR_INTERVAL_MS = 5000
export const EARTH_METEOR_BATCH_GAP_MS = 650
export const EARTH_METEOR_FLIGHT_MS = 3200
export const EARTH_METEOR_DASH_LENGTH = 2 / 3
export const EARTH_METEOR_DASH_GAP = 2
export const EARTH_METEOR_SVG_STROKE = 1.6

export interface EarthMeteorColors {
  tail: string
  body: string
  head: string
}

export function getEarthMeteorColors(isDark: boolean, index: number): EarthMeteorColors {
  const darkPalettes: EarthMeteorColors[] = [
    {
      tail: 'rgba(14, 165, 233, 0.02)',
      body: 'rgba(56, 189, 248, 0.86)',
      head: 'rgba(224, 242, 254, 1)',
    },
    {
      tail: 'rgba(217, 119, 6, 0.02)',
      body: 'rgba(245, 158, 11, 0.88)',
      head: 'rgba(254, 240, 138, 1)',
    },
    {
      tail: 'rgba(109, 40, 217, 0.02)',
      body: 'rgba(139, 92, 246, 0.8)',
      head: 'rgba(103, 232, 249, 1)',
    },
  ]
  const lightPalettes: EarthMeteorColors[] = [
    {
      tail: 'rgba(3, 105, 161, 0.02)',
      body: 'rgba(2, 132, 199, 0.88)',
      head: 'rgba(8, 145, 178, 1)',
    },
    {
      tail: 'rgba(180, 83, 9, 0.02)',
      body: 'rgba(217, 119, 6, 0.88)',
      head: 'rgba(245, 158, 11, 1)',
    },
    {
      tail: 'rgba(91, 33, 182, 0.02)',
      body: 'rgba(124, 58, 237, 0.78)',
      head: 'rgba(13, 148, 136, 1)',
    },
  ]

  return (isDark ? darkPalettes : lightPalettes)[index % 3]!
}

export function getEarthMeteorInitialGap(index: number): number {
  return index * 0.115 + Math.random() * 0.025
}

export function getEarthMeteorDelayMs(initialGap: number): number {
  return Math.round(initialGap * EARTH_METEOR_FLIGHT_MS)
}
