// Keep application modules inert until the actual backend version is verified.
// This also protects bookmarks that bypass the homepage's version selector.
const glassopsOfficialRoutePattern = /^\/(?:admin|terminal)(?:[/?#]|$)/
;(async () => {
  const entry = document.currentScript
  const versions = JSON.parse(entry.dataset.versions)
  let route = new URL(location.href).searchParams.get('__komari_route') || ''
  try {
    const storedRoute = sessionStorage.getItem('komariOfficialAppRoute') || ''
    sessionStorage.removeItem('komariOfficialAppRoute')
    route ||= storedRoute
  }
  catch {}

  // Only restore real official routes, never /admin-app or an external URL.
  if (!glassopsOfficialRoutePattern.test(route))
    route = '/admin'

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 2500)
  let compatible = false
  try {
    const response = await fetch('/api/version', {
      signal: controller.signal,
      credentials: 'same-origin',
      cache: 'no-store',
    })
    if (response.ok) {
      const result = await response.json()
      const version = typeof result?.data?.version === 'string'
        ? result.data.version.trim()
        : ''
      compatible = versions.includes(version.startsWith('v') ? version.slice(1) : version)
    }
  }
  catch {}
  finally {
    clearTimeout(timeout)
  }

  if (!compatible) {
    location.replace(route)
    return
  }

  history.replaceState(null, '', route)
  for (const placeholder of document.querySelectorAll('script[type="application/x-glassops-module"]')) {
    const module = document.createElement('script')
    module.type = 'module'
    module.crossOrigin = 'anonymous'
    module.src = placeholder.dataset.src
    placeholder.replaceWith(module)
  }
})()
