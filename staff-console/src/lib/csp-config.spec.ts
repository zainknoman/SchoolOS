import { describe, expect, it } from 'vitest'
import { cspHeader, cspMeta } from '../../csp.config'

// BL-36 follow-up: the console's Content-Security-Policy.
describe('console Content-Security-Policy', () => {
  const meta = cspMeta('https://api.school.example/api')

  it('allows scripts only from the console itself — no inline script, no eval', () => {
    expect(meta).toContain("script-src 'self';")
    expect(meta).not.toMatch(/unsafe-eval/)
    expect(meta).not.toMatch(/script-src[^;]*unsafe-inline/)
  })

  it('lets the bundle call and load images from the API origin only', () => {
    expect(meta).toContain("connect-src 'self' https://api.school.example;")
    expect(meta).toContain("img-src 'self' data: blob: https://api.school.example;")
  })

  it('blocks plugins, base-tag hijacking and foreign form targets', () => {
    expect(meta).toContain("object-src 'none'")
    expect(meta).toContain("base-uri 'self'")
    expect(meta).toContain("form-action 'self'")
  })

  it('the response header also forbids framing (a <meta> tag cannot)', () => {
    expect(meta).not.toContain('frame-ancestors')
    expect(cspHeader('https://api.school.example')).toContain("frame-ancestors 'none'")
  })
})
