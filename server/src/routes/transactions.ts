import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireCompanyMember } from '../middleware/auth.js'
import { asyncHandler } from '../lib/asyncHandler.js'

export const transactionsRouter = Router({ mergeParams: true })
transactionsRouter.use(requireAuth, requireCompanyMember())

function serializeTransaction(t: {
  id: string
  companyId: string
  accountId: string | null
  categoryId: string | null
  vendorId: string | null
  vendor?: { name: string } | null
  kind: string
  amount: unknown
  taxRate: unknown
  whtRate: unknown
  occurredOn: Date
  description: string
  createdBy: string | null
  createdAt: Date
}) {
  const amount = Number(t.amount)
  const taxRate = Number(t.taxRate)
  const whtRate = Number(t.whtRate)
  const taxAmount = amount * (taxRate / 100)
  const whtAmount = amount * (whtRate / 100)
  return {
    id: t.id,
    company_id: t.companyId,
    account_id: t.accountId,
    category_id: t.categoryId,
    vendor_id: t.vendorId,
    vendor_name: t.vendor?.name ?? null,
    kind: t.kind,
    amount,
    tax_rate: taxRate,
    wht_rate: whtRate,
    tax_amount: taxAmount,
    wht_amount: whtAmount,
    total: amount + taxAmount - whtAmount,
    occurred_on: t.occurredOn.toISOString().slice(0, 10),
    description: t.description,
    created_by: t.createdBy,
    created_at: t.createdAt.toISOString(),
  }
}

transactionsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { from, to, kind, categoryId } = req.query as Record<string, string | undefined>
    const transactions = await prisma.transaction.findMany({
      where: {
        companyId: req.params.companyId,
        ...(from ? { occurredOn: { gte: new Date(from) } } : {}),
        ...(to ? { occurredOn: { lte: new Date(to) } } : {}),
        ...(kind === 'income' || kind === 'expense' ? { kind } : {}),
        ...(categoryId ? { categoryId } : {}),
      },
      include: { vendor: true },
      orderBy: [{ occurredOn: 'desc' }, { createdAt: 'desc' }],
    })
    res.json(transactions.map(serializeTransaction))
  }),
)

const transactionSchema = z.object({
  account_id: z.string().nullable(),
  category_id: z.string().nullable(),
  vendor_id: z.string().nullable(),
  kind: z.enum(['income', 'expense']),
  amount: z.number().positive(),
  tax_rate: z.number().default(0),
  wht_rate: z.number().default(0),
  occurred_on: z.string(),
  description: z.string(),
})

transactionsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = transactionSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' })
      return
    }
    const t = await prisma.transaction.create({
      data: {
        companyId: req.params.companyId,
        accountId: parsed.data.account_id,
        categoryId: parsed.data.category_id,
        vendorId: parsed.data.vendor_id,
        kind: parsed.data.kind,
        amount: parsed.data.amount,
        taxRate: parsed.data.tax_rate,
        whtRate: parsed.data.wht_rate,
        occurredOn: new Date(parsed.data.occurred_on),
        description: parsed.data.description,
        createdBy: req.userId,
      },
      include: { vendor: true },
    })
    res.status(201).json(serializeTransaction(t))
  }),
)

transactionsRouter.put(
  '/:transactionId',
  asyncHandler(async (req, res) => {
    const parsed = transactionSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' })
      return
    }
    const t = await prisma.transaction.update({
      where: { id: req.params.transactionId, companyId: req.params.companyId },
      data: {
        accountId: parsed.data.account_id,
        categoryId: parsed.data.category_id,
        vendorId: parsed.data.vendor_id,
        kind: parsed.data.kind,
        amount: parsed.data.amount,
        taxRate: parsed.data.tax_rate,
        whtRate: parsed.data.wht_rate,
        occurredOn: new Date(parsed.data.occurred_on),
        description: parsed.data.description,
      },
      include: { vendor: true },
    })
    res.json(serializeTransaction(t))
  }),
)

transactionsRouter.delete(
  '/:transactionId',
  asyncHandler(async (req, res) => {
    await prisma.transaction.delete({
      where: { id: req.params.transactionId, companyId: req.params.companyId },
    })
    res.status(204).end()
  }),
)
