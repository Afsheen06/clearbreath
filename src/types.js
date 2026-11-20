/** @typedef {'walk'|'cycle'|'two_wheeler'|'car'|'transit'|'wfh'} CommuteMode */
/** @typedef {'apartment'|'house'} HomeType */
/** @typedef {'gas'|'induction'|'biomass'} CookingFuel */
/** @typedef {{ children: boolean, elderly: boolean, respiratory: boolean, pregnant: boolean }} HouseholdFlags */
/** @typedef {{ city: string, household: HouseholdFlags, commute: CommuteMode, commuteKm: number, homeType: HomeType, hasPurifier: boolean, cookingFuel: CookingFuel, manualAqi: number|null }} Profile */
/** @typedef {{ key: string, maxAqi: number, label: string, icon: string, guidance: string }} AqiCategory */
/** @typedef {{ aqi: number, pm25: number, category: AqiCategory, source: string, place: string, observedAt?: string }} AirReading */
/** @typedef {{ title: string, action: string, why: string, bestTime?: string, impact: { estimate: string, confidence: string } }} PlanItem */
/** @typedef {{ healthAlert: { headline: string, summary: string, atRisk: string[] }, routines: PlanItem[], indoor: PlanItem[], swaps: PlanItem[] }} Plan */
/** @typedef {{ baselineExposure: number, planExposure: number, reductionPercent: number, baselineCo2Kg: number, planCo2Kg: number, co2SavedKg: number, assumptions: string[] }} Comparison */
/** @typedef {{ mode: 'ai'|'offline', air: AirReading, plan: Plan, comparison: Comparison, disclaimer: string }} PlanResponse */
/** @typedef {{ field: string, message: string }} FieldError */
/** @typedef {{ city: string, household: HouseholdFlags, commute: CommuteMode, commuteKm: string, homeType: HomeType, hasPurifier: boolean, cookingFuel: CookingFuel, manualAqi: string }} FormValues */
/** @typedef {{ rateLimitWindowMs: number, rateLimitMax: number }} RateLimitConfig */

export {};
