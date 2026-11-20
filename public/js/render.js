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

function el(tag, { text, className, attrs } = {}, children = []) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  for (const [name, value] of Object.entries(attrs ?? {})) node.setAttribute(name, value);
  node.append(...children);
  return node;
}

function renderAlert(air, alert) {
  const wrapper = el('section', { className: 'alert', attrs: { 'aria-labelledby': 'alert-heading', 'data-level': air.category.key } });
  wrapper.append(
    el('h3', { text: alert.headline, attrs: { id: 'alert-heading' } }),
    el('p', { text: alert.summary }),
  );
  if (alert.atRisk.length) {
    wrapper.append(el('p', { text: 'Most affected in your household:', className: 'meta' }));
    wrapper.append(el('ul', { className: 'at-risk' }, alert.atRisk.map((who) => el('li', { text: who }))));
  }
  const meta = el('p', { className: 'meta' }, [
    el('span', { text: `PM2.5 ≈ ${air.pm25} µg/m³` }),
    el('span', { text: SOURCE_LABELS[air.source] ?? 'Reading' }),
  ]);
  if (air.observedAt) meta.append(el('span', { text: `Observed ${air.observedAt.replace('T', ' ')}` }));
  wrapper.append(meta);
  return wrapper;
}

function renderItem(item) {
  const card = el('li', { className: 'item' });
  card.append(el('h4', { text: item.title }), el('p', { text: item.action }));
  if (item.bestTime) card.append(el('p', { text: `Best time: ${item.bestTime}`, className: 'best-time' }));
  card.append(
    el('p', {}, [el('span', { text: 'Why it matters: ', className: 'why-label' }), document.createTextNode(item.why)]),
    el('div', { className: 'impact' }, [
      el('strong', { text: 'Estimated impact' }),
      el('span', { text: item.impact.estimate }),
      document.createTextNode(' '),
      el('span', { text: `${item.impact.confidence} confidence`, className: 'badge' }),
    ]),
  );
  return card;
}

function renderSection(def, items) {
  const headingId = `section-${def.key}`;
  const section = el('section', { className: 'plan-section', attrs: { 'aria-labelledby': headingId } });
  section.append(
    el('h3', { text: def.title, attrs: { id: headingId } }),
    el('p', { text: def.note, className: 'section-note' }),
    el('ol', { className: 'items' }, items.map(renderItem)),
  );
  return section;
}

function barLine(label, value, max, kind, unit) {
  const bar = el('div', { className: 'bar', attrs: { 'data-kind': kind } });
  bar.style.width = `${max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0}%`;
  return el('div', { className: 'bar-line' }, [
    el('span', { text: label, className: 'bar-label' }),
    el('div', { className: 'bar-track', attrs: { 'aria-hidden': 'true' } }, [bar]),
    el('span', { text: `${value}${unit}`, className: 'bar-value' }),
  ]);
}

function renderComparison(c) {
  const section = el('section', { className: 'compare', attrs: { 'aria-labelledby': 'compare-heading' } });
  const exposureMax = Math.max(c.baselineExposure, c.planExposure);
  const co2Max = Math.max(c.baselineCo2Kg, c.planCo2Kg);

  const rows = el('dl', {}, [
    el('div', { className: 'compare-row' }, [
      el('dt', { text: 'Estimated PM2.5 exposure over 24 hours' }),
      el('dd', {}, [
        barLine('No change', c.baselineExposure, exposureMax, 'base', ' µg·h/m³'),
        barLine('With this plan', c.planExposure, exposureMax, 'plan', ' µg·h/m³'),
        el('p', { text: `About ${c.reductionPercent}% lower`, className: 'big-number' }),
      ]),
    ]),
    el('div', { className: 'compare-row' }, [
      el('dt', { text: 'Estimated commute CO₂ per day (kg)' }),
      el('dd', {}, [
        barLine('No change', c.baselineCo2Kg, co2Max, 'base', ' kg'),
        barLine('With this plan', c.planCo2Kg, co2Max, 'plan', ' kg'),
        el('p', { text: c.co2SavedKg > 0 ? `About ${c.co2SavedKg} kg CO₂ avoided` : 'No extra commute emissions to avoid', className: 'big-number' }),
      ]),
    ]),
  ]);

  section.append(
    el('h3', { text: 'Your day: no change vs with this plan', attrs: { id: 'compare-heading' } }),
    el('p', { text: 'Illustrative estimates from simple assumptions, not measurements.', className: 'section-note' }),
    rows,
    el('details', {}, [el('summary', { text: 'How these estimates are made' }), el('ul', {}, c.assumptions.map((a) => el('li', { text: a })))]),
  );
  return section;
}

/**
 * Replaces the contents of `container` with the plan.
 * @param {HTMLElement} container
 * @param {{ mode: string, air: object, plan: object, comparison: object, disclaimer: string }} data
 */
export function renderPlan(container, data) {
  const parts = [];
  if (data.mode === 'offline') {
    parts.push(
      el('p', {
        className: 'mode-note',
        text: 'Offline guidance mode: the AI service was not available, so this plan comes from our built-in rules using your live air reading.',
      }),
    );
  }
  parts.push(renderAlert(data.air, data.plan.healthAlert));
  for (const def of SECTIONS) parts.push(renderSection(def, data.plan[def.key]));
  parts.push(renderComparison(data.comparison));
  parts.push(el('p', { text: data.disclaimer, className: 'section-note' }));
  container.replaceChildren(...parts);
}
