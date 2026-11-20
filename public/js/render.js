/**
 * Renders the plan with DOM APIs and textContent only. Model output is never parsed as HTML.
 */

const SECTIONS = Object.freeze([
  { key: 'routines', title: 'Low-emission daily routine', note: 'Small changes to how you move and when you go out.' },
  { key: 'indoor', title: 'Indoor air quality hacks', note: 'Keep the air inside your home cleaner than the air outside.' },
  { key: 'swaps', title: 'Sustainable swaps', note: 'Choices that protect your family and cut community emissions.' },
]);

const SOURCE_LABELS = Object.freeze({
  live: 'Live reading',
  'live-cached': 'Live reading (recent)',
  manual: 'Your own reading',
});

const MIN_BAR_PERCENT = 2;

function createNode(tag, { text, className, attrs } = {}, children = []) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  for (const [name, value] of Object.entries(attrs ?? {})) node.setAttribute(name, value);
  node.append(...children);
  return node;
}

function barWidthPercent(value, max) {
  return max > 0 ? Math.max(MIN_BAR_PERCENT, Math.round((value / max) * 100)) : 0;
}

function renderAlert(air, alert) {
  const wrapper = createNode('section', { className: 'alert', attrs: { 'aria-labelledby': 'alert-heading', 'data-level': air.category.key } });
  wrapper.append(
    createNode('h3', { text: alert.headline, attrs: { id: 'alert-heading' } }),
    createNode('p', { text: alert.summary }),
  );
  if (alert.atRisk.length) {
    wrapper.append(createNode('p', { text: 'Most affected in your household:', className: 'meta' }));
    wrapper.append(createNode('ul', { className: 'at-risk' }, alert.atRisk.map((who) => createNode('li', { text: who }))));
  }
  const meta = createNode('p', { className: 'meta' }, [
    createNode('span', { text: `PM2.5 ≈ ${air.pm25} µg/m³` }),
    createNode('span', { text: SOURCE_LABELS[air.source] ?? 'Reading' }),
  ]);
  if (air.observedAt) meta.append(createNode('span', { text: `Observed ${air.observedAt.replace('T', ' ')}` }));
  wrapper.append(meta);
  return wrapper;
}

function renderItem(item) {
  const card = createNode('li', { className: 'item' });
  card.append(createNode('h4', { text: item.title }), createNode('p', { text: item.action }));
  if (item.bestTime) card.append(createNode('p', { text: `Best time: ${item.bestTime}`, className: 'best-time' }));
  card.append(
    createNode('p', {}, [createNode('span', { text: 'Why it matters: ', className: 'why-label' }), document.createTextNode(item.why)]),
    createNode('div', { className: 'impact' }, [
      createNode('strong', { text: 'Estimated impact' }),
      createNode('span', { text: item.impact.estimate }),
      document.createTextNode(' '),
      createNode('span', { text: `${item.impact.confidence} confidence`, className: 'badge' }),
    ]),
  );
  return card;
}

function renderSection(def, items) {
  const headingId = `section-${def.key}`;
  const section = createNode('section', { className: 'plan-section', attrs: { 'aria-labelledby': headingId } });
  section.append(
    createNode('h3', { text: def.title, attrs: { id: headingId } }),
    createNode('p', { text: def.note, className: 'section-note' }),
    createNode('ol', { className: 'items' }, items.map(renderItem)),
  );
  return section;
}

function barLine({ label, value, max, kind, unit }) {
  const bar = createNode('div', { className: 'bar', attrs: { 'data-kind': kind } });
  bar.style.width = `${barWidthPercent(value, max)}%`;
  return createNode('div', { className: 'bar-line' }, [
    createNode('span', { text: label, className: 'bar-label' }),
    createNode('div', { className: 'bar-track', attrs: { 'aria-hidden': 'true' } }, [bar]),
    createNode('span', { text: `${value}${unit}`, className: 'bar-value' }),
  ]);
}

function comparisonRow({ label, baseline, planned, max, unit, impactText }) {
  return createNode('div', { className: 'compare-row' }, [
    createNode('dt', { text: label }),
    createNode('dd', {}, [
      barLine({ label: 'No change', value: baseline, max, kind: 'base', unit }),
      barLine({ label: 'With this plan', value: planned, max, kind: 'plan', unit }),
      createNode('p', { text: impactText, className: 'big-number' }),
    ]),
  ]);
}

function renderComparisonRows(comparison) {
  const exposureMax = Math.max(comparison.baselineExposure, comparison.planExposure);
  const co2Max = Math.max(comparison.baselineCo2Kg, comparison.planCo2Kg);
  return createNode('dl', {}, [
    comparisonRow({ label: 'Estimated PM2.5 exposure over 24 hours', baseline: comparison.baselineExposure, planned: comparison.planExposure, max: exposureMax, unit: ' µg·h/m³', impactText: `About ${comparison.reductionPercent}% lower` }),
    comparisonRow({ label: 'Estimated commute CO₂ per day (kg)', baseline: comparison.baselineCo2Kg, planned: comparison.planCo2Kg, max: co2Max, unit: ' kg', impactText: comparison.co2SavedKg > 0 ? `About ${comparison.co2SavedKg} kg CO₂ avoided` : 'No extra commute emissions to avoid' }),
  ]);
}

function renderComparison(c) {
  const section = createNode('section', { className: 'compare', attrs: { 'aria-labelledby': 'compare-heading' } });
  section.append(
    createNode('h3', { text: 'Your day: no change vs with this plan', attrs: { id: 'compare-heading' } }),
    createNode('p', { text: 'Illustrative estimates from simple assumptions, not measurements.', className: 'section-note' }),
    renderComparisonRows(c),
    createNode('details', {}, [createNode('summary', { text: 'How these estimates are made' }), createNode('ul', {}, c.assumptions.map((a) => createNode('li', { text: a })))]),
  );
  return section;
}

/**
 * Replaces the container contents with a plan response.
 * @param {HTMLElement} container
 * @param {import('../../src/types.js').PlanResponse} data Plan response.
 */
export function renderPlan(container, data) {
  const parts = [];
  if (data.mode === 'offline') {
    parts.push(
      createNode('p', {
        className: 'mode-note',
        text: 'Offline guidance mode: the AI service was not available, so this plan comes from our built-in rules using your live air reading.',
      }),
    );
  }
  parts.push(renderAlert(data.air, data.plan.healthAlert));
  for (const def of SECTIONS) parts.push(renderSection(def, data.plan[def.key]));
  parts.push(renderComparison(data.comparison));
  parts.push(createNode('p', { text: data.disclaimer, className: 'section-note' }));
  container.replaceChildren(...parts);
}
