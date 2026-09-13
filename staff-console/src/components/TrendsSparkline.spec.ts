import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import TrendsSparkline from './TrendsSparkline.vue';

describe('TrendsSparkline', () => {
  it('draws one polyline per series and a legend entry per series', () => {
    const wrapper = mount(TrendsSparkline, {
      props: {
        labels: ['Mon', 'Tue', 'Wed'],
        series: [
          { label: 'Attendance %', color: '#0f172a', values: [0, 50, 100] },
          { label: 'Fees Collected (PKR)', color: '#64748b', dashed: true, values: [100, 0, 50] },
        ],
      },
    });

    const polylines = wrapper.findAll('polyline');
    expect(polylines).toHaveLength(2);
    // y is inverted (0 -> bottom/100, 100 -> top/0) so a chart reads bottom-to-top like the wireframe
    expect(polylines[0]!.attributes('points')).toBe('0,100 50,50 100,0');
    // jsdom normalizes hex colors to rgb() when serializing style attributes;
    // #0f172a === rgb(15, 23, 42). What matters is that the color lands in the
    // `style` attribute (CSS engine, where var() resolves), not a plain `stroke`/`fill` attribute.
    expect(polylines[0]!.attributes('style')).toContain('stroke: rgb(15, 23, 42)');
    const circles = wrapper.findAll('circle');
    expect(circles[0]!.attributes('style')).toContain('fill: rgb(15, 23, 42)');

    expect(wrapper.text()).toContain('Attendance %');
    expect(wrapper.text()).toContain('Fees Collected (PKR)');
    expect(wrapper.findAll('.sparkline-x-label').map((n) => n.text())).toEqual(['Mon', 'Tue', 'Wed']);
  });

  it('includes the day label and unit in the accessible label, not just bare numbers', () => {
    const wrapper = mount(TrendsSparkline, {
      props: {
        labels: ['Mon', 'Tue'],
        series: [{ label: 'Attendance %', color: '#0f172a', values: [88, 95], unit: '%' }],
      },
    });

    const label = wrapper.find('svg').attributes('aria-label');
    expect(label).toContain('Attendance % by day');
    expect(label).toContain('Mon 88%');
    expect(label).toContain('Tue 95%');
  });
});
