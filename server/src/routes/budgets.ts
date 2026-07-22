import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireCompanyMember } from '../middleware/auth.js'
import { asyncHandler } from '../lib/asyncHandler.js'

export const budgetsRouter = Router({ mergeParams: true })
budgetsRouter.use(requireAuth, requireCompanyMember())

function serializeBudget(b: { id: string; companyId: string; categoryId: string; month: Date; amount: unknown; createdAt: Date }) {
  return {
    id: b.id,
    company_id: b.companyId,
    category_id: b.categoryId,
    month: b.month.toISOString().slice(0, 10),
    amount: Number(b.amount),
    created_at: b.createdAt.toISOString(),
  }
}

budgetsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const month = req.query.month as string | undefined
    const budgets = await prisma.budget.findMany({
      where: {
        companyId: req.params.companyId,
        ...(month ? { month: new Date(month) } : {}),
      },
    })
    res.json(budgets.map(serializeBudget))
  }),
)

const upsertSchema = z.object({
  category_id: z.string(),
  month: z.string(),
  amount: z.number().nonnegative(),
})

budgetsRouter.put(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = upsertSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' })
      return
    }
    const month = new Date(parsed.data.month)
    const budget = await prisma.budget.upsert({
      where: {
        companyId_categoryId_month: {
          companyId: req.params.companyId,
          categoryId: parsed.data.category_id,
          month,
        },
      },
      create: {
        companyId: req.params.companyId,
        categoryId: parsed.data.category_id,
        month,
        amount: parsed.data.amount,
      },
      update: { amount: parsed.data.amount },
    })
    res.json(serializeBudget(budget))
  }),
)
