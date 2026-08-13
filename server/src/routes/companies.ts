import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireCompanyAdmin, requireCompanyMember } from '../middleware/auth.js'
import { asyncHandler } from '../lib/asyncHandler.js'

export const companiesRouter = Router()
companiesRouter.use(requireAuth)

function serializeCompany(c: { id: string; name: string; currency: string; createdBy: string; createdAt: Date }) {
  return {
    id: c.id,
    name: c.name,
    currency: c.currency,
    created_by: c.createdBy,
    created_at: c.createdAt.toISOString(),
  }
}

companiesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const memberships = await prisma.companyMember.findMany({
      where: { userId: req.userId! },
      include: { company: true },
      orderBy: { company: { createdAt: 'asc' } },
    })
    res.json(memberships.map((m) => serializeCompany(m.company)))
  }),
)

const createCompanySchema = z.object({
  name: z.string().min(1),
  currency: z.string().min(1).max(10),
})

const CATEGORY_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#0ea5e9', '#8b5cf6', '#ef4444']

const DEFAULT_CATEGORIES: { name: string; kind: 'income' | 'expense' }[] = [
  { name: 'Services', kind: 'expense' },
  { name: 'Supplies', kind: 'expense' },
  { name: 'Software', kind: 'expense' },
  { name: 'Rent', kind: 'expense' },
  { name: 'Utilities', kind: 'expense' },
  { name: 'Salaries', kind: 'expense' },
  { name: 'Marketing', kind: 'expense' },
  { name: 'Travel', kind: 'expense' },
  { name: 'Professional Fees', kind: 'expense' },
  { name: 'Other Expenses', kind: 'expense' },
  { name: 'Sales', kind: 'income' },
  { name: 'Services Revenue', kind: 'income' },
  { name: 'Other Income', kind: 'income' },
]

companiesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = createCompanySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' })
      return
    }
    const { name, currency } = parsed.data

    const company = await prisma.$transaction(async (tx) => {
      const created = await tx.company.create({
        data: { name, currency, createdBy: req.userId! },
      })
      await tx.companyMember.create({
        data: { companyId: created.id, userId: req.userId!, role: 'owner' },
      })
      await tx.category.createMany({
        data: DEFAULT_CATEGORIES.map((c, i) => ({
          companyId: created.id,
          name: c.name,
          kind: c.kind,
          color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
        })),
      })
      return created
    })

    res.status(201).json(serializeCompany(company))
  }),
)

const updateCompanySchema = z.object({
  name: z.string().min(1).optional(),
  currency: z.string().min(1).max(10).optional(),
})

companiesRouter.patch(
  '/:companyId',
  requireCompanyAdmin(),
  asyncHandler(async (req, res) => {
    const parsed = updateCompanySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' })
      return
    }
    const company = await prisma.company.update({
      where: { id: req.params.companyId },
      data: parsed.data,
    })
    res.json(serializeCompany(company))
  }),
)

companiesRouter.get(
  '/:companyId/members',
  requireCompanyMember(),
  asyncHandler(async (req, res) => {
    const members = await prisma.companyMember.findMany({
      where: { companyId: req.params.companyId },
      include: { user: { select: { id: true, email: true } } },
    })
    res.json(members.map((m) => ({ role: m.role, user: m.user })))
  }),
)
