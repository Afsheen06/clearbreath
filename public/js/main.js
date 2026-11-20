import { ApiError, requestPlan } from './api.js';
import { renderPlan } from './render.js';
import { toPayload, validateForm } from './rules.js';

const form = document.getElementById('plan-form');
const submit = document.getElementById('submit');
const status = document.getElementById('status');
const results = document.getElementById('results');
const FIELD_IDS = ['city', 'commuteKm', 'manualAqi'];

function readForm() {
  const data = new FormData(form);
  return {
    city: String(data.get('city') ?? ''),
    household: Object.fromEntries(
      ['children', 'elderly', 'respiratory', 'pregnant'].map((flag) => [
        flag,
        form.querySelector(`input[name="household"][value="${flag}"]`).checked,
      ]),
    ),
    commute: String(data.get('commute')),
    commuteKm: String(data.get('commuteKm') ?? '').trim(),
    homeType: String(data.get('homeType')),
    hasPurifier: form.elements.hasPurifier.checked,
    cookingFuel: String(data.get('cookingFuel')),
    manualAqi: String(data.get('manualAqi') ?? '').trim(),
  };
}

function clearFieldErrors() {
  for (const id of FIELD_IDS) {
    const input = document.getElementById(id);
    const message = document.getElementById(`${id}-error`);
    input.removeAttribute('aria-invalid');
    message.hidden = true;
    message.textContent = '';
  }
}

/** @returns {boolean} true when at least one field was marked */
function showFieldErrors(errors) {
  let first = null;
  for (const { field, message } of errors) {
    if (!FIELD_IDS.includes(field)) continue;
    const input = document.getElementById(field);
    const target = document.getElementById(`${field}-error`);
    input.setAttribute('aria-invalid', 'true');
    target.textContent = message;
    target.hidden = false;
    first ??= input;
  }
  first?.focus();
  return first !== null;
}

function setStatus(kind, message) {
  const paragraph = document.createElement('p');
  paragraph.className = `status-${kind}`;
  if (kind === 'loading') {
    const spinner = document.createElement('span');
    spinner.className = 'spinner';
    spinner.setAttribute('aria-hidden', 'true');
    paragraph.append(spinner);
  }
  paragraph.append(document.createTextNode(message));
  status.replaceChildren(paragraph);
}

form.elements.commute.addEventListener('change', () => {
  const remote = form.elements.commute.value === 'wfh';
  form.elements.commuteKm.disabled = remote;
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearFieldErrors();

  const values = readForm();
  const problems = validateForm(values);
  if (problems.length) {
    showFieldErrors(problems);
    setStatus('error', 'Please fix the highlighted fields and try again.');
    return;
  }

  submit.disabled = true;
  submit.setAttribute('aria-busy', 'true');
  results.hidden = true;
  setStatus('loading', 'Checking the air in your city and building your plan…');

  try {
    const data = await requestPlan(toPayload(values));
    renderPlan(results, data);
    results.hidden = false;
    setStatus('idle', `Plan ready for ${data.air.place}.`);
    document.getElementById('results-heading').classList.remove('visually-hidden');
    results.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  } catch (error) {
    const fieldsMarked = error instanceof ApiError && showFieldErrors(error.fields);
    setStatus('error', error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    if (!fieldsMarked) status.setAttribute('tabindex', '-1');
  } finally {
    submit.disabled = false;
    submit.removeAttribute('aria-busy');
  }
});
