import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireCompanyMember } from '../middleware/auth.js'
import { asyncHandler } from '../lib/asyncHandler.js'
import type { Prisma } from '../generated/prisma/client.js'

export const billsRouter = Router({ mergeParams: true })
billsRouter.use(requireAuth, requireCompanyMember())

type BillWithItems = Prisma.BillGetPayload<{ include: { items: true; vendor: true } }>

function computeTotals(items: { quantity: unknown; unitPrice: unknown }[], taxRate: unknown, whtRate: unknown) {
  const subtotal = items.reduce((s, i) => s + Number(i.quantity) * Number(i.unitPrice), 0)
  const taxAmount = subtotal * (Number(taxRate) / 100)
  const whtAmount = subtotal * (Number(whtRate) / 100)
  return { subtotal, taxAmount, whtAmount, total: subtotal + taxAmount - whtAmount }
}

function serializeBill(bill: BillWithItems) {
  const { subtotal, taxAmount, whtAmount, total } = computeTotals(bill.items, bill.taxRate, bill.whtRate)
  return {
    id: bill.id,
    company_id: bill.companyId,
    vendor_id: bill.vendorId,
    vendor_name: bill.vendor?.name ?? null,
    bill_number: bill.billNumber,
    status: bill.status,
    bill_date: bill.billDate.toISOString().slice(0, 10),
    due_date: bill.dueDate.toISOString().slice(0, 10),
    notes: bill.notes,
    tax_rate: Number(bill.taxRate),
    wht_rate: Number(bill.whtRate),
    created_at: bill.createdAt.toISOString(),
    subtotal,
    tax_amount: taxAmount,
    wht_amount: whtAmount,
    total,
  }
}

function serializeItem(item: { id: string; description: string; quantity: unknown; unitPrice: unknown; position: number }) {
  return {
    id: item.id,
    description: item.description,
    quantity: Number(item.quantity),
    unit_price: Number(item.unitPrice),
    position: item.position,
  }
}

billsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const bills = await prisma.bill.findMany({
      where: { companyId: req.params.companyId },
      include: { items: true, vendor: true },
      orderBy: { billDate: 'desc' },
    })
    res.json(bills.map(serializeBill))
  }),
)

billsRouter.get(
  '/:billId',
  asyncHandler(async (req, res) => {
    const bill = await prisma.bill.findUnique({
      where: { id: req.params.billId, companyId: req.params.companyId },
      include: { items: { orderBy: { position: 'asc' } }, vendor: true },
    })
    if (!bill) {
      res.status(404).json({ error: 'Bill not found' })
      return
    }
    res.json({
      bill: serializeBill(bill),
      items: bill.items.map(serializeItem),
    })
  }),
)

const itemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number(),
  unit_price: z.number(),
})

const billSchema = z.object({
  vendor_id: z.string().nullable(),
  bill_number: z.string().min(1),
  status: z.enum(['unpaid', 'paid', 'overdue', 'void']),
  bill_date: z.string(),
  due_date: z.string(),
  notes: z.string(),
  tax_rate: z.number(),
  wht_rate: z.number(),
  items: z.array(itemSchema),
})

billsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = billSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' })
      return
    }
    const { items, ...fields } = parsed.data
    const bill = await prisma.bill.create({
      data: {
        companyId: req.params.companyId,
        vendorId: fields.vendor_id,
        billNumber: fields.bill_number,
        status: fields.status,
        billDate: new Date(fields.bill_date),
        dueDate: new Date(fields.due_date),
        notes: fields.notes,
        taxRate: fields.tax_rate,
        whtRate: fields.wht_rate,
        items: {
          create: items.map((item, position) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unit_price,
            position,
          })),
        },
      },
      include: { items: true, vendor: true },
    })
    res.status(201).json(serializeBill(bill))
  }),
)

billsRouter.put(
  '/:billId',
  asyncHandler(async (req, res) => {
    const parsed = billSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' })
      return
    }
    const { items, ...fields } = parsed.data

    const bill = await prisma.$transaction(async (tx) => {
      await tx.bill.update({
        where: { id: req.params.billId, companyId: req.params.companyId },
        data: {
          vendorId: fields.vendor_id,
          billNumber: fields.bill_number,
          status: fields.status,
          billDate: new Date(fields.bill_date),
          dueDate: new Date(fields.due_date),
          notes: fields.notes,
          taxRate: fields.tax_rate,
          whtRate: fields.wht_rate,
        },
      })
      await tx.billItem.deleteMany({ where: { billId: req.params.billId } })
      if (items.length > 0) {
        await tx.billItem.createMany({
          data: items.map((item, position) => ({
            billId: req.params.billId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unit_price,
            position,
          })),
        })
      }
      return tx.bill.findUniqueOrThrow({
        where: { id: req.params.billId },
        include: { items: true, vendor: true },
      })
    })

    res.json(serializeBill(bill))
  }),
)

billsRouter.patch(
  '/:billId/status',
  asyncHandler(async (req, res) => {
    const parsed = z.object({ status: z.enum(['unpaid', 'paid', 'overdue', 'void']) }).safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' })
      return
    }
    const bill = await prisma.bill.update({
      where: { id: req.params.billId, companyId: req.params.companyId },
      data: { status: parsed.data.status },
      include: { items: true, vendor: true },
    })
    res.json(serializeBill(bill))
  }),
)

billsRouter.delete(
  '/:billId',
  asyncHandler(async (req, res) => {
    await prisma.bill.delete({
      where: { id: req.params.billId, companyId: req.params.companyId },
    })
    res.status(204).end()
  }),
)
