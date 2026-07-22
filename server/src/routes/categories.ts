import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireCompanyMember } from '../middleware/auth.js'
import { asyncHandler } from '../lib/asyncHandler.js'

export const categoriesRouter = Router({ mergeParams: true })
categoriesRouter.use(requireAuth, requireCompanyMember())

function serializeCategory(c: { id: string; companyId: string; name: string; kind: string; color: string; createdAt: Date }) {
  return {
    id: c.id,
    company_id: c.companyId,
    name: c.name,
    kind: c.kind,
    color: c.color,
    created_at: c.createdAt.toISOString(),
  }
}

categoriesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const kind = req.query.kind
    const categories = await prisma.category.findMany({
      where: {
        companyId: req.params.companyId,
        ...(kind === 'income' || kind === 'expense' ? { kind } : {}),
      },
      orderBy: { name: 'asc' },
    })
    res.json(categories.map(serializeCategory))
  }),
)

const categorySchema = z.object({
  name: z.string().min(1),
  kind: z.enum(['income', 'expense']),
  color: z.string().min(1),
})

categoriesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = categorySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' })
      return
    }
    const category = await prisma.category.create({
      data: { companyId: req.params.companyId, ...parsed.data },
    })
    res.status(201).json(serializeCategory(category))
  }),
)

categoriesRouter.delete(
  '/:categoryId',
  asyncHandler(async (req, res) => {
    await prisma.category.delete({
      where: { id: req.params.categoryId, companyId: req.params.companyId },
    })
    res.status(204).end()
  }),
)
