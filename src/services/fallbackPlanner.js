import { COMMUTE_MODES, PROTECTIVE_ACTION_AQI, SEVERE_AQI, estimateDailyCo2Kg } from '../aqi.js';

/**
 * Deterministic, rule-based planner used when Gemini is unavailable.
 * It produces the same shape as the AI planner so the UI never needs a special case.
 */

const RISK_LABELS = Object.freeze({
  children: 'Children',
  elderly: 'Older adults',
  respiratory: 'People with asthma or breathing conditions',
  pregnant: 'Pregnant family members',
});

const item = (title, action, why, estimate, confidence, bestTime) => ({
  title,
  action,
  why,
  ...(bestTime ? { bestTime } : {}),
  impact: { estimate, confidence },
});

function buildHealthAlert(air, household) {
  const atRisk = Object.entries(RISK_LABELS)
    .filter(([flag]) => household[flag])
    .map(([, label]) => label);
  const vulnerable = atRisk.length > 0;
  return {
    headline: `${air.category.icon} AQI ${air.aqi}: ${air.category.label} in ${air.place}`,
    summary:
      `${air.category.guidance} PM2.5 is about ${air.pm25} µg/m³.` +
      (vulnerable && air.aqi >= PROTECTIVE_ACTION_AQI
        ? ' Your household includes people who feel the effects sooner, so take the steps below seriously today.'
        : ''),
    atRisk: vulnerable ? atRisk : ['Everyone benefits from cleaner air; sensitive groups first'],
  };
}

function buildRoutines(profile, air) {
  const { commute, commuteKm, household } = profile;
  const protective = air.aqi >= PROTECTIVE_ACTION_AQI;
  const items = [];

  if (commute === 'wfh') {
    items.push(item('Keep your commute at zero', 'Stay with working from home today and batch errands into one short trip.', 'Every trip you skip removes both your exposure and your tailpipe emissions.', 'Avoids roughly the 1-2 hours of commute exposure for the day', 'medium'));
  } else if (commute === 'walk' || commute === 'cycle') {
    items.push(item(`Keep ${COMMUTE_MODES[commute].label}, but choose cleaner streets`, protective ? 'Use side roads or park paths away from heavy traffic and wear a well-fitted N95 mask.' : 'Prefer lanes away from main roads and avoid idling traffic.', 'Breathing faster outdoors increases the dose, and exhaust is densest next to busy roads.', protective ? 'Roughly 40-60% less PM2.5 inhaled with a well-fitted N95' : 'Up to 20-30% less roadside exposure on quieter routes', protective ? 'medium' : 'low'));
  } else {
    const saved = estimateDailyCo2Kg(commute, commuteKm);
    items.push(item('Switch solo trips to public transit or a shared ride', `Try metro, bus or a carpool for your ${commuteKm} km trip at least on the worst-AQI days.`, 'Fewer vehicles on the road means less exhaust added to already heavy smog, and a shared seat splits the emissions.', saved > 0 ? `About ${saved} kg CO2 avoided per round trip, plus lower community PM2.5` : 'Lower community PM2.5', 'medium'));
  }

  if (protective && commute !== 'wfh') {
    items.push(item('Time outdoor activity for the cleaner hours', 'Plan errands and the commute for late morning to mid-afternoon, avoiding early morning and after-dark peaks.', 'In winter, cold air traps pollution close to the ground overnight and in the early hours, so mid-day is usually lighter.', 'Roughly 10-20% lower exposure than rush-hour timing', 'low', 'Late morning to mid-afternoon'));
    items.push(item('Wear a well-fitted N95 or FFP2 mask outdoors', 'Choose a mask that seals around the nose and chin; cloth and surgical masks do little against fine particles.', 'Particles under 2.5 µm pass through loose masks; a tight seal filters most of them.', 'Roughly 40-60% less PM2.5 inhaled when worn properly', 'medium'));
  }

  if (air.aqi >= SEVERE_AQI) {
    items.push(item('Move exercise and play indoors', household.children ? 'Swap outdoor games for indoor play or a short home workout today.' : 'Swap outdoor workouts for an indoor session.', 'Hard breathing pulls far more polluted air deep into the lungs than resting does.', 'Roughly halves the PM2.5 dose compared with exercising outside', 'medium'));
  } else {
    items.push(item('Keep outdoor exercise light', 'Walk or stretch outside only in the cleaner hours and ease off if you feel irritation.', 'Lower effort means a lower inhaled dose.', 'Up to 20-30% lower dose than hard exercise', 'low'));
  }
  return items;
}

function buildIndoor(profile, air) {
  const { hasPurifier, cookingFuel, homeType, household } = profile;
  const protective = air.aqi >= PROTECTIVE_ACTION_AQI;
  const items = [];

  items.push(item('Ventilate smartly', protective ? 'Keep windows closed on high-AQI days; air the home briefly (10-15 minutes) in the cleanest part of the day.' : 'Open windows for cross-ventilation when readings stay low.', 'Indoor air follows outdoor air; short, well-timed ventilation limits how much smog gets in.', 'Roughly 20-30% lower indoor PM2.5 than leaving windows open', 'medium', protective ? 'Mid-afternoon' : undefined));

  if (hasPurifier) {
    items.push(item('Use your purifier where people spend time', 'Run it in the bedroom or main living room with doors closed, on high while cooking and on auto otherwise.', 'A HEPA purifier removes fine particles continuously from the room it sits in.', 'Roughly 40-60% lower PM2.5 in that room', 'medium'));
  } else {
    items.push(item('Build a low-cost DIY purifier', 'Fix a new HEPA or MERV 13 filter to a box fan (a Corsi-Rosenthal box) and run it in the main room.', 'It filters fine particles at a fraction of the price of a commercial unit.', 'Roughly 30-50% lower PM2.5 in the room', 'low'));
  }

  if (cookingFuel === 'biomass') {
    items.push(item('Cook with cleaner heat where you can', 'Use an LPG or induction stove, or at least a chimney or vented stove, and keep a window or exhaust fan on while cooking.', 'Biomass smoke is a major indoor source of fine particles and adds to the smog outside.', 'Can cut kitchen PM2.5 by well over half', 'medium'));
  } else if (cookingFuel === 'gas') {
    items.push(item('Run the kitchen exhaust while cooking', 'Switch on the chimney or exhaust fan during and 10 minutes after cooking, and avoid frying at very high heat.', 'Cooking adds particles and gases that otherwise linger in the home.', 'Roughly 30-50% less cooking-related PM2.5', 'medium'));
  } else {
    items.push(item('Keep cooking clean with induction', 'Keep using induction and run the exhaust fan when frying or sautéing.', 'Induction avoids combustion gases, so only cooking fumes remain.', 'Avoids combustion pollutants entirely', 'high'));
  }

  items.push(item('Clean without raising dust', homeType === 'house' ? 'Damp-mop floors and wipe surfaces daily; skip dry sweeping and incense or mosquito coils indoors.' : 'Damp-wipe surfaces, mop daily and skip dry sweeping, incense and mosquito coils indoors.', 'Dry sweeping lifts settled dust back into the air and incense adds fine smoke.', 'Roughly 10-20% lower indoor particle levels', 'low'));

  if (household.respiratory || household.children) {
    items.push(item('Create one clean-air room', 'Pick the room where the most vulnerable person sleeps, keep its door closed and run the purifier or DIY filter there.', 'One sealed, filtered room protects those who are most sensitive for the longest hours.', 'Can keep that room 40-60% cleaner than the rest of the home', 'medium'));
  }
  return items;
}

function buildSwaps(profile) {
  const { commute, commuteKm, cookingFuel } = profile;
  const dailyCo2 = estimateDailyCo2Kg(commute, commuteKm);
  const items = [];

  if (dailyCo2 > 0) {
    items.push(item('Combine trips and carpool', 'Join a neighbour or colleague carpool at least two days a week and bundle errands into one outing.', 'Fewer, fuller vehicles cut emissions per person and traffic on your street.', `About ${(dailyCo2 / 2).toFixed(2)} kg CO2 saved per day if you halve solo trips`, 'medium'));
  }
  items.push(item('Choose electric or manual for short hops', 'For trips under 3 km, walk, cycle or use an electric auto or scooter when conditions allow.', 'Short cold-start trips are among the dirtiest per kilometre.', 'Close to zero tailpipe emissions for those trips', 'high'));
  items.push(item('Never burn waste or leaves', 'Hand waste to municipal collection and join or start a neighbourhood no-burning pledge.', 'Open burning releases dense fine-particle smoke right at street level.', 'Local PM2.5 can drop noticeably when a street stops open burning', 'low'));
  if (cookingFuel !== 'induction') {
    items.push(item('Move toward clean cooking', 'Look into induction or a piped/LPG connection and use a pressure cooker to shorten cooking time.', 'Cleaner fuel and shorter burn times cut both indoor and neighbourhood emissions.', 'Removes most cooking-related combustion particles', 'medium'));
  }
  return items;
}

/**
 * @param {{ profile: object, air: object }} input
 */
export function buildFallbackPlan({ profile, air }) {
  return {
    healthAlert: buildHealthAlert(air, profile.household),
    routines: buildRoutines(profile, air).slice(0, 4),
    indoor: buildIndoor(profile, air).slice(0, 4),
    swaps: buildSwaps(profile).slice(0, 4),
  };
}
