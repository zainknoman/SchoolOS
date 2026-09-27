import { afterEach } from 'vitest'
import { config, type VueWrapper } from '@vue/test-utils'
import { i18n } from './lib/i18n'
import { axeFindings } from './a11y/axe'

config.global.plugins.push(i18n)

// BL-55: every spec doubles as an accessibility check. Each wrapper a test mounts is re-rendered
// into the document in its final state (data loaded, forms and modals open) and checked by axe.
const mountedWrappers: VueWrapper[] = []
config.plugins.VueWrapper.install((wrapper) => {
  mountedWrappers.push(wrapper as VueWrapper)
  return {}
})

afterEach(async (ctx) => {
  const wrappers = mountedWrappers.splice(0)
  const report = process.env.A11Y_REPORT
  for (const wrapper of wrappers) {
    let html = ''
    try {
      html = wrapper.html()
    } catch {
      continue
    }
    if (!html.trim()) continue
    const host = document.createElement('div')
    host.setAttribute('data-a11y-host', '')
    host.innerHTML = html
    document.body.appendChild(host)
    try {
      const findings = await axeFindings(host)
      if (findings.length === 0) continue
      if (report) {
        const { appendFileSync } = await import('node:fs')
        appendFileSync(report, JSON.stringify({ test: ctx.task.file?.name + ' > ' + ctx.task.name, findings }) + '\n')
      } else {
        throw new Error(`axe (WCAG 2.1 AA) violations:\n${JSON.stringify(findings, null, 2)}`)
      }
    } finally {
      host.remove()
    }
  }
})
