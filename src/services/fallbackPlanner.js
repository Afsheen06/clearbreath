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

const CONFIDENCE = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
});

function createItem({ title, action, why, estimate, confidence, bestTime }) {
  return {
    title,
    action,
    why,
    ...(bestTime ? { bestTime } : {}),
    impact: { estimate, confidence },
  };
}

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

function workFromHomeRoutine() {
  return createItem({
    title: 'Keep your commute at zero',
    action: 'Stay with working from home today and batch errands into one short trip.',
    why: 'Every trip you skip removes both your exposure and your tailpipe emissions.',
    estimate: 'Avoids roughly the 1-2 hours of commute exposure for the day',
    confidence: CONFIDENCE.MEDIUM,
  });
}

function activeTravelRoutine(commute, protective) {
  return createItem({
    title: `Keep ${COMMUTE_MODES[commute].label}, but choose cleaner streets`,
    action: protective
      ? 'Use side roads or park paths away from heavy traffic and wear a well-fitted N95 mask.'
      : 'Prefer lanes away from main roads and avoid idling traffic.',
    why: 'Breathing faster outdoors increases the dose, and exhaust is densest next to busy roads.',
    estimate: protective
      ? 'Roughly 40-60% less PM2.5 inhaled with a well-fitted N95'
      : 'Up to 20-30% less roadside exposure on quieter routes',
    confidence: protective ? CONFIDENCE.MEDIUM : CONFIDENCE.LOW,
  });
}

function sharedTravelRoutine(commute, commuteKm) {
  const saved = estimateDailyCo2Kg(commute, commuteKm);
  return createItem({
    title: 'Switch solo trips to public transit or a shared ride',
    action: `Try metro, bus or a carpool for your ${commuteKm} km trip at least on the worst-AQI days.`,
    why: 'Fewer vehicles on the road means less exhaust added to already heavy smog, and a shared seat splits the emissions.',
    estimate: saved > 0
      ? `About ${saved} kg CO2 avoided per round trip, plus lower community PM2.5`
      : 'Lower community PM2.5',
    confidence: CONFIDENCE.MEDIUM,
  });
}

function commuteRoutine(commute, commuteKm, protective) {
  if (commute === 'wfh') return workFromHomeRoutine();
  if (commute === 'walk' || commute === 'cycle') return activeTravelRoutine(commute, protective);
  return sharedTravelRoutine(commute, commuteKm);
}

function outdoorTimingRoutine() {
  return createItem({
    title: 'Time outdoor activity for the cleaner hours',
    action: 'Plan errands and the commute for late morning to mid-afternoon, avoiding early morning and after-dark peaks.',
    why: 'In winter, cold air traps pollution close to the ground overnight and in the early hours, so mid-day is usually lighter.',
    estimate: 'Roughly 10-20% lower exposure than rush-hour timing',
    confidence: CONFIDENCE.LOW,
    bestTime: 'Late morning to mid-afternoon',
  });
}

function maskRoutine() {
  return createItem({
    title: 'Wear a well-fitted N95 or FFP2 mask outdoors',
    action: 'Choose a mask that seals around the nose and chin; cloth and surgical masks do little against fine particles.',
    why: 'Particles under 2.5 µm pass through loose masks; a tight seal filters most of them.',
    estimate: 'Roughly 40-60% less PM2.5 inhaled when worn properly',
    confidence: CONFIDENCE.MEDIUM,
  });
}

function buildProtectiveRoutines(profile, air) {
  if (air.aqi < PROTECTIVE_ACTION_AQI || profile.commute === 'wfh') return [];
  return [outdoorTimingRoutine(), maskRoutine()];
}

function exerciseRoutine(household, air) {
  if (air.aqi >= SEVERE_AQI) {
    return createItem({
      title: 'Move exercise and play indoors',
      action: household.children
        ? 'Swap outdoor games for indoor play or a short home workout today.'
        : 'Swap outdoor workouts for an indoor session.',
      why: 'Hard breathing pulls far more polluted air deep into the lungs than resting does.',
      estimate: 'Roughly halves the PM2.5 dose compared with exercising outside',
      confidence: CONFIDENCE.MEDIUM,
    });
  }
  return createItem({
    title: 'Keep outdoor exercise light',
    action: 'Walk or stretch outside only in the cleaner hours and ease off if you feel irritation.',
    why: 'Lower effort means a lower inhaled dose.',
    estimate: 'Up to 20-30% lower dose than hard exercise',
    confidence: CONFIDENCE.LOW,
  });
}

function buildRoutines(profile, air) {
  const protective = air.aqi >= PROTECTIVE_ACTION_AQI;
  return [
    commuteRoutine(profile.commute, profile.commuteKm, protective),
    ...buildProtectiveRoutines(profile, air),
    exerciseRoutine(profile.household, air),
  ].slice(0, 4);
}

function ventilationItem(protective) {
  return createItem({
    title: 'Ventilate smartly',
    action: protective
      ? 'Keep windows closed on high-AQI days; air the home briefly (10-15 minutes) in the cleanest part of the day.'
      : 'Open windows for cross-ventilation when readings stay low.',
    why: 'Indoor air follows outdoor air; short, well-timed ventilation limits how much smog gets in.',
    estimate: 'Roughly 20-30% lower indoor PM2.5 than leaving windows open',
    confidence: CONFIDENCE.MEDIUM,
    bestTime: protective ? 'Mid-afternoon' : undefined,
  });
}

function filtrationItem(hasPurifier) {
  if (hasPurifier) {
    return createItem({
      title: 'Use your purifier where people spend time',
      action: 'Run it in the bedroom or main living room with doors closed, on high while cooking and on auto otherwise.',
      why: 'A HEPA purifier removes fine particles continuously from the room it sits in.',
      estimate: 'Roughly 40-60% lower PM2.5 in that room',
      confidence: CONFIDENCE.MEDIUM,
    });
  }
  return createItem({
    title: 'Build a low-cost DIY purifier',
    action: 'Fix a new HEPA or MERV 13 filter to a box fan (a Corsi-Rosenthal box) and run it in the main room.',
    why: 'It filters fine particles at a fraction of the price of a commercial unit.',
    estimate: 'Roughly 30-50% lower PM2.5 in the room',
    confidence: CONFIDENCE.LOW,
  });
}

function cookingItem(cookingFuel) {
  if (cookingFuel === 'biomass') {
    return createItem({
      title: 'Cook with cleaner heat where you can',
      action: 'Use an LPG or induction stove, or at least a chimney or vented stove, and keep a window or exhaust fan on while cooking.',
      why: 'Biomass smoke is a major indoor source of fine particles and adds to the smog outside.',
      estimate: 'Can cut kitchen PM2.5 by well over half',
      confidence: CONFIDENCE.MEDIUM,
    });
  }
  if (cookingFuel === 'gas') {
    return createItem({
      title: 'Run the kitchen exhaust while cooking',
      action: 'Switch on the chimney or exhaust fan during and 10 minutes after cooking, and avoid frying at very high heat.',
      why: 'Cooking adds particles and gases that otherwise linger in the home.',
      estimate: 'Roughly 30-50% less cooking-related PM2.5',
      confidence: CONFIDENCE.MEDIUM,
    });
  }
  return createItem({
    title: 'Keep cooking clean with induction',
    action: 'Keep using induction and run the exhaust fan when frying or sautéing.',
    why: 'Induction avoids combustion gases, so only cooking fumes remain.',
    estimate: 'Avoids combustion pollutants entirely',
    confidence: CONFIDENCE.HIGH,
  });
}

function cleaningItem(homeType) {
  return createItem({
    title: 'Clean without raising dust',
    action: homeType === 'house'
      ? 'Damp-mop floors and wipe surfaces daily; skip dry sweeping and incense or mosquito coils indoors.'
      : 'Damp-wipe surfaces, mop daily and skip dry sweeping, incense and mosquito coils indoors.',
    why: 'Dry sweeping lifts settled dust back into the air and incense adds fine smoke.',
    estimate: 'Roughly 10-20% lower indoor particle levels',
    confidence: CONFIDENCE.LOW,
  });
}

function cleanAirRoomItem(household) {
  if (!household.respiratory && !household.children) return null;
  return createItem({
    title: 'Create one clean-air room',
    action: 'Pick the room where the most vulnerable person sleeps, keep its door closed and run the purifier or DIY filter there.',
    why: 'One sealed, filtered room protects those who are most sensitive for the longest hours.',
    estimate: 'Can keep that room 40-60% cleaner than the rest of the home',
    confidence: CONFIDENCE.MEDIUM,
  });
}

function buildIndoor(profile, air) {
  const { hasPurifier, cookingFuel, homeType, household } = profile;
  const protective = air.aqi >= PROTECTIVE_ACTION_AQI;
  return [
    ventilationItem(protective),
    filtrationItem(hasPurifier),
    cookingItem(cookingFuel),
    cleaningItem(homeType),
    cleanAirRoomItem(household),
  ].filter(Boolean).slice(0, 4);
}

function carpoolSwap(commute, commuteKm) {
  const dailyCo2 = estimateDailyCo2Kg(commute, commuteKm);
  if (dailyCo2 <= 0) return null;
  return createItem({
    title: 'Combine trips and carpool',
    action: 'Join a neighbour or colleague carpool at least two days a week and bundle errands into one outing.',
    why: 'Fewer, fuller vehicles cut emissions per person and traffic on your street.',
    estimate: `About ${(dailyCo2 / 2).toFixed(2)} kg CO2 saved per day if you halve solo trips`,
    confidence: CONFIDENCE.MEDIUM,
  });
}

function shortTripSwap() {
  return createItem({
    title: 'Choose electric or manual for short hops',
    action: 'For trips under 3 km, walk, cycle or use an electric auto or scooter when conditions allow.',
    why: 'Short cold-start trips are among the dirtiest per kilometre.',
    estimate: 'Close to zero tailpipe emissions for those trips',
    confidence: CONFIDENCE.HIGH,
  });
}

function noBurningSwap() {
  return createItem({
    title: 'Never burn waste or leaves',
    action: 'Hand waste to municipal collection and join or start a neighbourhood no-burning pledge.',
    why: 'Open burning releases dense fine-particle smoke right at street level.',
    estimate: 'Local PM2.5 can drop noticeably when a street stops open burning',
    confidence: CONFIDENCE.LOW,
  });
}

function cleanCookingSwap(cookingFuel) {
  if (cookingFuel === 'induction') return null;
  return createItem({
    title: 'Move toward clean cooking',
    action: 'Look into induction or a piped/LPG connection and use a pressure cooker to shorten cooking time.',
    why: 'Cleaner fuel and shorter burn times cut both indoor and neighbourhood emissions.',
    estimate: 'Removes most cooking-related combustion particles',
    confidence: CONFIDENCE.MEDIUM,
  });
}

function buildSwaps(profile) {
  const { commute, commuteKm, cookingFuel } = profile;
  return [
    carpoolSwap(commute, commuteKm),
    shortTripSwap(),
    noBurningSwap(),
    cleanCookingSwap(cookingFuel),
  ].filter(Boolean).slice(0, 4);
}

/**
 * Builds a deterministic fallback plan matching the Gemini plan shape.
 * @param {{ profile: object, air: object }} input
 * @returns {{ healthAlert: object, routines: object[], indoor: object[], swaps: object[] }}
 */
export function buildFallbackPlan({ profile, air }) {
  return {
    healthAlert: buildHealthAlert(air, profile.household),
    routines: buildRoutines(profile, air),
    indoor: buildIndoor(profile, air),
    swaps: buildSwaps(profile),
  };
}
