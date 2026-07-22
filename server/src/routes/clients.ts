import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireCompanyMember } from '../middleware/auth.js'
import { asyncHandler } from '../lib/asyncHandler.js'

export const clientsRouter = Router({ mergeParams: true })
clientsRouter.use(requireAuth, requireCompanyMember())

function serializeClient(c: {
  id: string
  companyId: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  createdAt: Date
}) {
  return {
    id: c.id,
    company_id: c.companyId,
    name: c.name,
    email: c.email,
    phone: c.phone,
    address: c.address,
    created_at: c.createdAt.toISOString(),
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
})

clientsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = clientSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' })
      return
    }
    const client = await prisma.client.create({
      data: { companyId: req.params.companyId, ...parsed.data },
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
      data: parsed.data,
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
