import { Router } from 'express'
import { requireAuth, requireCompanyMember } from '../middleware/auth.js'
import { asyncHandler } from '../lib/asyncHandler.js'
import { EtaApiError, EtaConfigError, getAccessToken, getEtaEnvironment } from '../services/eta.js'

export const etaRouter = Router({ mergeParams: true })
etaRouter.use(requireAuth, requireCompanyMember())

etaRouter.get(
  '/test-connection',
  asyncHandler(async (_req, res) => {
    try {
      await getAccessToken(true)
      res.json({ ok: true, environment: getEtaEnvironment() })
    } catch (err) {
      if (err instanceof EtaConfigError) {
        res.status(400).json({ ok: false, error: err.message })
        return
      }
      if (err instanceof EtaApiError) {
        res.status(502).json({
          ok: false,
          environment: getEtaEnvironment(),
          error: err.message,
          status: err.status ?? null,
          details: err.body ?? null,
        })
        return
      }
      throw err
    }
  }),
)
