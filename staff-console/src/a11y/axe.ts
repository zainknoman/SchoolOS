// BL-55: shared axe-core runner for component/view specs (WCAG 2.1 AA rule set).
import axe from 'axe-core';

// jsdom has no layout or computed colours, so the rules that need a real renderer cannot give a
// true result here. Colour contrast is covered by `tokenContrast.spec.ts` (design-token pairs) and
// by the manual audit (docs/release/ACCESSIBILITY-AUDIT.md); `region` is a best-practice rule
// that flags every fragment mounted outside the AppShell landmarks.
const DISABLED_RULES = ['color-contrast', 'region'];

export interface AxeFinding {
  id: string;
  impact: string | null | undefined;
  help: string;
  targets: string[];
}

export async function axeFindings(root: Element): Promise<AxeFinding[]> {
  const result = await axe.run(root, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    rules: Object.fromEntries(DISABLED_RULES.map((id) => [id, { enabled: false }])),
    resultTypes: ['violations'],
  });
  return result.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    targets: v.nodes.map((n) => n.target.join(' ')),
  }));
}
