/** @typedef {'walk'|'cycle'|'two_wheeler'|'car'|'transit'|'wfh'} CommuteMode */
/** @typedef {'apartment'|'house'} HomeType */
/** @typedef {'gas'|'induction'|'biomass'} CookingFuel */
/** @typedef {'low'|'medium'|'high'} ConfidenceLevel */
/** @typedef {{ children: boolean, elderly: boolean, respiratory: boolean, pregnant: boolean }} HouseholdFlags */
/** @typedef {{ city: string, household: HouseholdFlags, commute: CommuteMode, commuteKm: number, homeType: HomeType, hasPurifier: boolean, cookingFuel: CookingFuel, manualAqi: number|null }} Profile */
/** @typedef {Omit<Profile, 'commuteKm'|'manualAqi'> & { commuteKm?: number, manualAqi?: number }} PlanRequest */
/** @typedef {{ key: string, maxAqi: number, label: string, icon: string, guidance: string }} AqiCategory */
/** @typedef {{ aqi: number, pm25: number, pm10: number|null, category: AqiCategory, source: string, place: string, observedAt: string|null }} AirReading */
/** @typedef {{ title: string, action: string, why: string, bestTime?: string, impact: { estimate: string, confidence: ConfidenceLevel } }} PlanItem */
/** @typedef {{ healthAlert: { headline: string, summary: string, atRisk: string[] }, routines: PlanItem[], indoor: PlanItem[], swaps: PlanItem[] }} Plan */
/** @typedef {{ baselineExposure: number, planExposure: number, reductionPercent: number, baselineCo2Kg: number, planCo2Kg: number, co2SavedKg: number, assumptions: string[] }} Comparison */
/** @typedef {{ mode: 'ai'|'offline', air: AirReading, plan: Plan, comparison: Comparison, disclaimer: string }} PlanResponse */
/** @typedef {{ field: string, message: string }} FieldError */
/** @typedef {{ city: string, household: HouseholdFlags, commute: CommuteMode, commuteKm: string, homeType: HomeType, hasPurifier: boolean, cookingFuel: CookingFuel, manualAqi: string }} FormValues */
/** @typedef {{ rateLimitWindowMs: number, rateLimitMax: number }} RateLimitConfig */
/** @typedef {{ isProduction: boolean, port: number, geminiApiKey: string, geminiModel: string, geminiTimeoutMs: number, upstreamTimeoutMs: number, cacheTtlMs: number, rateLimitWindowMs: number, rateLimitMax: number, trustProxy: number }} AppConfig */
/** @typedef {{ getAirQuality(city: string, manualAqi: number|null): Promise<AirReading> }} AirQualityService */
/** @typedef {{ enabled: boolean, generatePlan(input: { profile: Profile, air: AirReading }): Promise<Plan> }} PlannerService */
/** @typedef {Pick<Console, 'warn'|'error'>} AppLogger */

export {};
