import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireCompanyMember } from '../middleware/auth.js'
import { asyncHandler } from '../lib/asyncHandler.js'

export const vendorsRouter = Router({ mergeParams: true })
vendorsRouter.use(requireAuth, requireCompanyMember())

function serializeVendor(v: {
  id: string
  companyId: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  createdAt: Date
}) {
  return {
    id: v.id,
    company_id: v.companyId,
    name: v.name,
    email: v.email,
    phone: v.phone,
    address: v.address,
    created_at: v.createdAt.toISOString(),
  }
}

vendorsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const vendors = await prisma.vendor.findMany({
      where: { companyId: req.params.companyId },
      orderBy: { name: 'asc' },
    })
    res.json(vendors.map(serializeVendor))
  }),
)

const vendorSchema = z.object({
  name: z.string().min(1),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
})

vendorsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = vendorSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' })
      return
    }
    const vendor = await prisma.vendor.create({
      data: { companyId: req.params.companyId, ...parsed.data },
    })
    res.status(201).json(serializeVendor(vendor))
  }),
)

vendorsRouter.put(
  '/:vendorId',
  asyncHandler(async (req, res) => {
    const parsed = vendorSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' })
      return
    }
    const vendor = await prisma.vendor.update({
      where: { id: req.params.vendorId, companyId: req.params.companyId },
      data: parsed.data,
    })
    res.json(serializeVendor(vendor))
  }),
)

vendorsRouter.delete(
  '/:vendorId',
  asyncHandler(async (req, res) => {
    await prisma.vendor.delete({
      where: { id: req.params.vendorId, companyId: req.params.companyId },
    })
    res.status(204).end()
  }),
)
