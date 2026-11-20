import { Router } from 'express';
import { estimateComparison } from '../aqi.js';
import { DISCLAIMER } from '../constants.js';
import { AppError } from '../errors.js';
import { buildFallbackPlan } from '../services/fallbackPlanner.js';
import { validatePlanRequest } from '../validation.js';

/**
 * @param {{ airQuality: { getAirQuality: Function }, planner: { enabled: boolean, generatePlan: Function }, logger?: Pick<Console, 'warn'> }} deps
 */
export function createPlanRouter({ airQuality, planner, logger = console }) {
  const router = Router();

  router.post('/plan', async (req, res, next) => {
    try {
      const parsed = validatePlanRequest(req.body);
      if (!parsed.ok) {
        throw new AppError(400, 'invalid_request', 'Please check the highlighted fields.', { fields: parsed.errors });
      }
      const profile = parsed.value;

      const air = await airQuality.getAirQuality(profile.city, profile.manualAqi);

      let plan;
      let mode = 'ai';
      if (planner.enabled) {
        try {
          plan = await planner.generatePlan({ profile, air });
        } catch (error) {
          logger.warn(`Gemini unavailable, using offline guidance: ${error.code ?? error.name}`);
        }
      }
      if (!plan) {
        mode = 'offline';
        plan = buildFallbackPlan({ profile, air });
      }

      res.json({
        mode,
        air,
        plan,
        comparison: estimateComparison(profile, air.pm25, air.aqi),
        disclaimer: DISCLAIMER,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
