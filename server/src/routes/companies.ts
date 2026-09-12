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

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member']),
})

companiesRouter.post(
  '/:companyId/members',
  requireCompanyAdmin(),
  asyncHandler(async (req, res) => {
    const parsed = inviteSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' })
      return
    }
    const companyId = req.params.companyId
    const email = parsed.data.email.trim().toLowerCase()
    const { role } = parsed.data

    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    })

    if (existingUser) {
      const alreadyMember = await prisma.companyMember.findUnique({
        where: { companyId_userId: { companyId, userId: existingUser.id } },
      })
      if (alreadyMember) {
        res.status(409).json({ error: 'This person is already a member of this company' })
        return
      }
      const member = await prisma.companyMember.create({
        data: { companyId, userId: existingUser.id, role },
        include: { user: { select: { id: true, email: true } } },
      })
      res.status(201).json({ status: 'added', role: member.role, user: member.user })
      return
    }

    const invite = await prisma.companyInvite.upsert({
      where: { companyId_email: { companyId, email } },
      create: { companyId, email, role, invitedBy: req.userId! },
      update: { role },
    })
    res.status(201).json({ status: 'pending', id: invite.id, email: invite.email, role: invite.role })
  }),
)

const roleSchema = z.object({ role: z.enum(['owner', 'admin', 'member']) })

companiesRouter.patch(
  '/:companyId/members/:userId',
  requireCompanyAdmin(),
  asyncHandler(async (req, res) => {
    const parsed = roleSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' })
      return
    }
    const { companyId, userId } = req.params
    const target = await prisma.companyMember.findUnique({ where: { companyId_userId: { companyId, userId } } })
    if (!target) {
      res.status(404).json({ error: 'Member not found' })
      return
    }
    if (target.role === 'owner' && parsed.data.role !== 'owner') {
      const ownerCount = await prisma.companyMember.count({ where: { companyId, role: 'owner' } })
      if (ownerCount <= 1) {
        res.status(400).json({ error: 'A company must have at least one owner' })
        return
      }
    }
    const updated = await prisma.companyMember.update({
      where: { companyId_userId: { companyId, userId } },
      data: { role: parsed.data.role },
      include: { user: { select: { id: true, email: true } } },
    })
    res.json({ role: updated.role, user: updated.user })
  }),
)

companiesRouter.delete(
  '/:companyId/members/:userId',
  requireCompanyAdmin(),
  asyncHandler(async (req, res) => {
    const { companyId, userId } = req.params
    const target = await prisma.companyMember.findUnique({ where: { companyId_userId: { companyId, userId } } })
    if (!target) {
      res.status(404).json({ error: 'Member not found' })
      return
    }
    if (target.role === 'owner') {
      const ownerCount = await prisma.companyMember.count({ where: { companyId, role: 'owner' } })
      if (ownerCount <= 1) {
        res.status(400).json({ error: 'A company must have at least one owner' })
        return
      }
    }
    await prisma.companyMember.delete({ where: { companyId_userId: { companyId, userId } } })
    res.status(204).end()
  }),
)

companiesRouter.get(
  '/:companyId/invites',
  requireCompanyAdmin(),
  asyncHandler(async (req, res) => {
    const invites = await prisma.companyInvite.findMany({
      where: { companyId: req.params.companyId },
      orderBy: { createdAt: 'desc' },
    })
    res.json(invites.map((i) => ({ id: i.id, email: i.email, role: i.role, created_at: i.createdAt.toISOString() })))
  }),
)

companiesRouter.delete(
  '/:companyId/invites/:inviteId',
  requireCompanyAdmin(),
  asyncHandler(async (req, res) => {
    await prisma.companyInvite.delete({
      where: { id: req.params.inviteId, companyId: req.params.companyId },
    })
    res.status(204).end()
  }),
)
