import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireCompanyMember } from '../middleware/auth.js'
import { asyncHandler } from '../lib/asyncHandler.js'

export const accountsRouter = Router({ mergeParams: true })
accountsRouter.use(requireAuth, requireCompanyMember())

function serializeAccount(a: { id: string; companyId: string; name: string; type: string; openingBalance: unknown; createdAt: Date }) {
  return {
    id: a.id,
    company_id: a.companyId,
    name: a.name,
    type: a.type,
    opening_balance: Number(a.openingBalance),
    created_at: a.createdAt.toISOString(),
  }
}

accountsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const accounts = await prisma.account.findMany({
      where: { companyId: req.params.companyId },
      orderBy: { name: 'asc' },
    })
    res.json(accounts.map(serializeAccount))
  }),
)

const accountSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['cash', 'bank', 'credit_card', 'other']),
  opening_balance: z.number(),
})

accountsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = accountSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' })
      return
    }
    const account = await prisma.account.create({
      data: {
        companyId: req.params.companyId,
        name: parsed.data.name,
        type: parsed.data.type,
        openingBalance: parsed.data.opening_balance,
      },
    })
    res.status(201).json(serializeAccount(account))
  }),
)
