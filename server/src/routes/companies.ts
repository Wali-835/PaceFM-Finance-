import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireCompanyAdmin, requireCompanyMember } from '../middleware/auth.js'
import { asyncHandler } from '../lib/asyncHandler.js'

export const companiesRouter = Router()
companiesRouter.use(requireAuth)

type CompanyRecord = {
  id: string
  name: string
  currency: string
  createdBy: string
  createdAt: Date
  etaTaxRegistrationNumber: string | null
  etaBranchId: string
  etaActivityCode: string | null
  etaGovernorate: string | null
  etaRegionCity: string | null
  etaStreet: string | null
  etaBuildingNumber: string | null
}

function serializeCompany(c: CompanyRecord) {
  return {
    id: c.id,
    name: c.name,
    currency: c.currency,
    created_by: c.createdBy,
    created_at: c.createdAt.toISOString(),
    eta_tax_registration_number: c.etaTaxRegistrationNumber,
    eta_branch_id: c.etaBranchId,
    eta_activity_code: c.etaActivityCode,
    eta_governorate: c.etaGovernorate,
    eta_region_city: c.etaRegionCity,
    eta_street: c.etaStreet,
    eta_building_number: c.etaBuildingNumber,
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
  eta_tax_registration_number: z.string().nullable().optional(),
  eta_branch_id: z.string().min(1).optional(),
  eta_activity_code: z.string().nullable().optional(),
  eta_governorate: z.string().nullable().optional(),
  eta_region_city: z.string().nullable().optional(),
  eta_street: z.string().nullable().optional(),
  eta_building_number: z.string().nullable().optional(),
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
    const { eta_tax_registration_number, eta_branch_id, eta_activity_code, eta_governorate, eta_region_city, eta_street, eta_building_number, ...rest } = parsed.data
    const company = await prisma.company.update({
      where: { id: req.params.companyId },
      data: {
        ...rest,
        etaTaxRegistrationNumber: eta_tax_registration_number,
        etaBranchId: eta_branch_id,
        etaActivityCode: eta_activity_code,
        etaGovernorate: eta_governorate,
        etaRegionCity: eta_region_city,
        etaStreet: eta_street,
        etaBuildingNumber: eta_building_number,
      },
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
