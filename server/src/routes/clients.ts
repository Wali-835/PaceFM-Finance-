import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireCompanyMember } from '../middleware/auth.js'
import { asyncHandler } from '../lib/asyncHandler.js'

export const clientsRouter = Router({ mergeParams: true })
clientsRouter.use(requireAuth, requireCompanyMember())

type ClientRecord = {
  id: string
  companyId: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  createdAt: Date
  etaBuyerType: string
  etaTaxRegistrationNumber: string | null
  etaGovernorate: string | null
  etaRegionCity: string | null
  etaStreet: string | null
  etaBuildingNumber: string | null
}

function serializeClient(c: ClientRecord) {
  return {
    id: c.id,
    company_id: c.companyId,
    name: c.name,
    email: c.email,
    phone: c.phone,
    address: c.address,
    created_at: c.createdAt.toISOString(),
    eta_buyer_type: c.etaBuyerType,
    eta_tax_registration_number: c.etaTaxRegistrationNumber,
    eta_governorate: c.etaGovernorate,
    eta_region_city: c.etaRegionCity,
    eta_street: c.etaStreet,
    eta_building_number: c.etaBuildingNumber,
  }
}

clientsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const clients = await prisma.client.findMany({
      where: { companyId: req.params.companyId },
      orderBy: { name: 'asc' },
    })
    res.json(clients.map(serializeClient))
  }),
)

const clientSchema = z.object({
  name: z.string().min(1),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  eta_buyer_type: z.enum(['B', 'P', 'F']).default('B'),
  eta_tax_registration_number: z.string().nullable().default(null),
  eta_governorate: z.string().nullable().default(null),
  eta_region_city: z.string().nullable().default(null),
  eta_street: z.string().nullable().default(null),
  eta_building_number: z.string().nullable().default(null),
})

function toClientData(fields: z.infer<typeof clientSchema>) {
  const { eta_buyer_type, eta_tax_registration_number, eta_governorate, eta_region_city, eta_street, eta_building_number, ...rest } = fields
  return {
    ...rest,
    etaBuyerType: eta_buyer_type,
    etaTaxRegistrationNumber: eta_tax_registration_number,
    etaGovernorate: eta_governorate,
    etaRegionCity: eta_region_city,
    etaStreet: eta_street,
    etaBuildingNumber: eta_building_number,
  }
}

clientsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = clientSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' })
      return
    }
    const client = await prisma.client.create({
      data: { companyId: req.params.companyId, ...toClientData(parsed.data) },
    })
    res.status(201).json(serializeClient(client))
  }),
)

clientsRouter.put(
  '/:clientId',
  asyncHandler(async (req, res) => {
    const parsed = clientSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' })
      return
    }
    const client = await prisma.client.update({
      where: { id: req.params.clientId, companyId: req.params.companyId },
      data: toClientData(parsed.data),
    })
    res.json(serializeClient(client))
  }),
)

clientsRouter.delete(
  '/:clientId',
  asyncHandler(async (req, res) => {
    await prisma.client.delete({
      where: { id: req.params.clientId, companyId: req.params.companyId },
    })
    res.status(204).end()
  }),
)
