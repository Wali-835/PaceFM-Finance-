import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireCompanyMember } from '../middleware/auth.js'
import { asyncHandler } from '../lib/asyncHandler.js'
import { prisma } from '../db.js'
import { EtaApiError, EtaConfigError, getAccessToken, getEtaEnvironment, submitDocument } from '../services/eta.js'
import { buildEtaInvoiceDocument, EtaDocumentError } from '../services/etaDocument.js'

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

etaRouter.get(
  '/invoices/:invoiceId/document',
  asyncHandler(async (req, res) => {
    const [invoice, company] = await Promise.all([
      prisma.invoice.findUnique({
        where: { id: req.params.invoiceId, companyId: req.params.companyId },
        include: { items: { orderBy: { position: 'asc' } }, client: true },
      }),
      prisma.company.findUniqueOrThrow({ where: { id: req.params.companyId } }),
    ])
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' })
      return
    }
    try {
      const document = buildEtaInvoiceDocument(invoice, company)
      res.json({ document })
    } catch (err) {
      if (err instanceof EtaDocumentError) {
        res.status(400).json({ error: err.message, missing_fields: err.missingFields })
        return
      }
      throw err
    }
  }),
)

const submitSchema = z.object({
  signed_document: z.record(z.string(), z.unknown()),
})

etaRouter.post(
  '/invoices/:invoiceId/submit',
  asyncHandler(async (req, res) => {
    const parsed = submitSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' })
      return
    }
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.invoiceId, companyId: req.params.companyId },
    })
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' })
      return
    }

    try {
      const result = await submitDocument(parsed.data.signed_document)
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          etaStatus: result.accepted ? 'submitted' : 'rejected',
          etaUuid: result.documentUuid ?? null,
          etaSubmissionUuid: result.submissionUuid ?? null,
          etaLongId: result.longId ?? null,
          etaError: result.errorSummary ?? null,
          etaSubmittedAt: new Date(),
        },
      })
      res.json(result)
    } catch (err) {
      if (err instanceof EtaConfigError) {
        res.status(400).json({ error: err.message })
        return
      }
      if (err instanceof EtaApiError) {
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { etaStatus: 'error', etaError: err.message, etaSubmittedAt: new Date() },
        })
        res.status(502).json({ error: err.message, status: err.status ?? null, details: err.body ?? null })
        return
      }
      throw err
    }
  }),
)
