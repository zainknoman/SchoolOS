/**
 * BL-36 follow-up: Content-Security-Policy for the staff console.
 *
 * The console is a static single-page app; everything it loads comes from its own origin, Google
 * Fonts and the API (`VITE_API_BASE_URL`). Images may also be `blob:` (authenticated file previews,
 * logo/photo previews) or `data:`. Nothing is inline script, eval'd or framed.
 *
 * `cspMeta` goes into index.html at build time (works on any static host). `cspHeader` is the same
 * policy plus the directives a <meta> tag cannot carry (`frame-ancestors`) — set it as a response
 * header on the console host as well (see docs/operations/DEPLOYMENT.md).
 */
type Directives = Record<string, string[]>

const SELF = "'self'"

function directives(apiBaseUrl: string | undefined): Directives {
  const api = apiBaseUrl ? new URL(apiBaseUrl).origin : undefined
  const withApi = (list: string[]) => (api ? [...list, api] : list)
  return {
    'default-src': [SELF],
    'script-src': [SELF],
    // Vue writes some static style="" attributes through innerHTML (hoisted static nodes); allow
    // attributes only — <style>/<link> elements stay restricted to our origin and Google Fonts.
    'style-src': [SELF, 'https://fonts.googleapis.com'],
    'style-src-attr': ["'unsafe-inline'"],
    'font-src': [SELF, 'https://fonts.gstatic.com'],
    'img-src': withApi([SELF, 'data:', 'blob:']),
    'connect-src': withApi([SELF]),
    'object-src': ["'none'"],
    'base-uri': [SELF],
    'form-action': [SELF],
  }
}

function serialise(d: Directives): string {
  return Object.entries(d)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ')
}

export function cspMeta(apiBaseUrl: string | undefined): string {
  return serialise(directives(apiBaseUrl))
}

export function cspHeader(apiBaseUrl: string | undefined): string {
  return serialise({ ...directives(apiBaseUrl), 'frame-ancestors': ["'none'"] })
}
