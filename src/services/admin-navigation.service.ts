import { getSharedApi } from '@/utils/api'

export const EMBEDDED_ADMIN_COMPATIBLE_VERSIONS = ['1.4.3'] as const

const EMBEDDED_ADMIN_PATH = '/admin-app/index.html'
const OFFICIAL_ADMIN_PATH = '/admin'
const VERSION_LOOKUP_TIMEOUT_MS = 2500
const KOMARI_VERSION_PATTERN = /^v?(\d+\.\d+\.\d+)$/

export function normalizeKomariVersion(version: unknown): string | null {
  if (typeof version !== 'string')
    return null

  const match = version.trim().match(KOMARI_VERSION_PATTERN)
  return match?.[1] ?? null
}

export function supportsEmbeddedAdmin(version: unknown): boolean {
  const normalized = normalizeKomariVersion(version)
  return normalized !== null
    && EMBEDDED_ADMIN_COMPATIBLE_VERSIONS.includes(normalized as typeof EMBEDDED_ADMIN_COMPATIBLE_VERSIONS[number])
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
  const version = await lookupBackendVersion()
  return supportsEmbeddedAdmin(version) ? EMBEDDED_ADMIN_PATH : OFFICIAL_ADMIN_PATH
}
