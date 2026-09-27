// BL-55: guards the accessibility gate itself — if axe stopped running (bad config, rules all
// disabled), every spec would pass silently.
import { describe, it, expect, afterEach } from 'vitest';
import { axeFindings } from './axe';

describe('axeFindings', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('reports an unlabelled input and a nameless button', async () => {
    document.body.innerHTML = '<main><input type="text"><button></button></main>';
    const ids = (await axeFindings(document.body)).map((f) => f.id).sort();
    expect(ids).toEqual(['button-name', 'label']);
  });

  it('passes labelled controls', async () => {
    document.body.innerHTML = '<main><label>Name <input type="text"></label><button>Save</button></main>';
    expect(await axeFindings(document.body)).toEqual([]);
  });
});
