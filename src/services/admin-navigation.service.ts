import { EMBEDDED_ADMIN_PROFILES } from '@/constants/admin'
import { getSharedApi } from '@/utils/api'

export const EMBEDDED_ADMIN_COMPATIBLE_VERSIONS = EMBEDDED_ADMIN_PROFILES.flatMap(profile => [...profile.versions])

const OFFICIAL_ADMIN_PATH = '/admin'
const VERSION_LOOKUP_TIMEOUT_MS = 2500
const KOMARI_VERSION_PATTERN = /^v?(\d+\.\d+\.\d+(?:-fix1)?)$/

export function normalizeKomariVersion(version: unknown): string | null {
  if (typeof version !== 'string')
    return null

  const match = version.trim().match(KOMARI_VERSION_PATTERN)
  return match?.[1] ?? null
}

export function supportsEmbeddedAdmin(version: unknown): boolean {
  const normalized = normalizeKomariVersion(version)
  return normalized !== null
    && EMBEDDED_ADMIN_COMPATIBLE_VERSIONS.includes(normalized)
}

async function lookupBackendVersion(): Promise<unknown> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      getSharedApi().getVersion().then(result => result.version),
      new Promise<null>((resolve) => {
        timeoutId = setTimeout(resolve, VERSION_LOOKUP_TIMEOUT_MS, null)
      }),
    ])
  }
  catch {
    return null
  }
  finally {
    if (timeoutId)
      clearTimeout(timeoutId)
  }
}

export async function resolveAdminEntryPath(): Promise<string> {
  const version = normalizeKomariVersion(await lookupBackendVersion())
  if (version === null)
    return OFFICIAL_ADMIN_PATH
  const profile = EMBEDDED_ADMIN_PROFILES.find(profile => profile.versions.includes(version))
  return profile ? `/${profile.directory}/index.html` : OFFICIAL_ADMIN_PATH
}
