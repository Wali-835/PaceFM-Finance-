import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireCompanyMember } from '../middleware/auth.js'
import { asyncHandler } from '../lib/asyncHandler.js'
import type { Prisma } from '../generated/prisma/client.js'

export const invoicesRouter = Router({ mergeParams: true })
invoicesRouter.use(requireAuth, requireCompanyMember())

type InvoiceWithItems = Prisma.InvoiceGetPayload<{ include: { items: true; client: true } }>

function computeTotals(items: { quantity: unknown; unitPrice: unknown }[], taxRate: unknown, whtRate: unknown) {
  const subtotal = items.reduce((s, i) => s + Number(i.quantity) * Number(i.unitPrice), 0)
  const taxAmount = subtotal * (Number(taxRate) / 100)
  const whtAmount = subtotal * (Number(whtRate) / 100)
  return { subtotal, taxAmount, whtAmount, total: subtotal + taxAmount - whtAmount }
}

function serializeInvoice(inv: InvoiceWithItems) {
  const { subtotal, taxAmount, whtAmount, total } = computeTotals(inv.items, inv.taxRate, inv.whtRate)
  return {
    id: inv.id,
    company_id: inv.companyId,
    client_id: inv.clientId,
    client_name: inv.client?.name ?? null,
    invoice_number: inv.invoiceNumber,
    status: inv.status,
    issue_date: inv.issueDate.toISOString().slice(0, 10),
    due_date: inv.dueDate.toISOString().slice(0, 10),
    notes: inv.notes,
    tax_rate: Number(inv.taxRate),
    wht_rate: Number(inv.whtRate),
    created_at: inv.createdAt.toISOString(),
    subtotal,
    tax_amount: taxAmount,
    wht_amount: whtAmount,
    total,
    eta_status: inv.etaStatus,
    eta_uuid: inv.etaUuid,
    eta_submission_uuid: inv.etaSubmissionUuid,
    eta_long_id: inv.etaLongId,
    eta_error: inv.etaError,
    eta_submitted_at: inv.etaSubmittedAt ? inv.etaSubmittedAt.toISOString() : null,
  }
}

function serializeItem(item: { id: string; description: string; unit: string; quantity: unknown; unitPrice: unknown; position: number }) {
  return {
    id: item.id,
    description: item.description,
    unit: item.unit,
    quantity: Number(item.quantity),
    unit_price: Number(item.unitPrice),
    position: item.position,
  }
}

invoicesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const invoices = await prisma.invoice.findMany({
      where: { companyId: req.params.companyId },
      include: { items: true, client: true },
      orderBy: { issueDate: 'desc' },
    })
    res.json(invoices.map(serializeInvoice))
  }),
)

invoicesRouter.get(
  '/:invoiceId',
  asyncHandler(async (req, res) => {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.invoiceId, companyId: req.params.companyId },
      include: { items: { orderBy: { position: 'asc' } }, client: true },
    })
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' })
      return
    }
    res.json({
      invoice: serializeInvoice(invoice),
      items: invoice.items.map(serializeItem),
    })
  }),
)

const itemSchema = z.object({
  description: z.string().min(1),
  unit: z.string().default(''),
  quantity: z.number(),
  unit_price: z.number(),
})

const invoiceSchema = z.object({
  client_id: z.string().nullable(),
  invoice_number: z.string().min(1),
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'void']),
  issue_date: z.string(),
  due_date: z.string(),
  notes: z.string(),
  tax_rate: z.number(),
  wht_rate: z.number().default(0),
  items: z.array(itemSchema),
})

invoicesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = invoiceSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' })
      return
    }
    const { items, ...fields } = parsed.data
    const invoice = await prisma.invoice.create({
      data: {
        companyId: req.params.companyId,
        clientId: fields.client_id,
        invoiceNumber: fields.invoice_number,
        status: fields.status,
        issueDate: new Date(fields.issue_date),
        dueDate: new Date(fields.due_date),
        notes: fields.notes,
        taxRate: fields.tax_rate,
        whtRate: fields.wht_rate,
        items: {
          create: items.map((item, position) => ({
            description: item.description,
            unit: item.unit,
            quantity: item.quantity,
            unitPrice: item.unit_price,
            position,
          })),
        },
      },
      include: { items: true, client: true },
    })
    res.status(201).json(serializeInvoice(invoice))
  }),
)

invoicesRouter.put(
  '/:invoiceId',
  asyncHandler(async (req, res) => {
    const parsed = invoiceSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' })
      return
    }
    const { items, ...fields } = parsed.data

    const invoice = await prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: req.params.invoiceId, companyId: req.params.companyId },
        data: {
          clientId: fields.client_id,
          invoiceNumber: fields.invoice_number,
          status: fields.status,
          issueDate: new Date(fields.issue_date),
          dueDate: new Date(fields.due_date),
          notes: fields.notes,
          taxRate: fields.tax_rate,
          whtRate: fields.wht_rate,
        },
      })
      await tx.invoiceItem.deleteMany({ where: { invoiceId: req.params.invoiceId } })
      if (items.length > 0) {
        await tx.invoiceItem.createMany({
          data: items.map((item, position) => ({
            invoiceId: req.params.invoiceId,
            description: item.description,
            unit: item.unit,
            quantity: item.quantity,
            unitPrice: item.unit_price,
            position,
          })),
        })
      }
      return tx.invoice.findUniqueOrThrow({
        where: { id: req.params.invoiceId },
        include: { items: true, client: true },
      })
    })

    res.json(serializeInvoice(invoice))
  }),
)

invoicesRouter.patch(
  '/:invoiceId/status',
  asyncHandler(async (req, res) => {
    const parsed = z.object({ status: z.enum(['draft', 'sent', 'paid', 'overdue', 'void']) }).safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' })
      return
    }
    const invoice = await prisma.invoice.update({
      where: { id: req.params.invoiceId, companyId: req.params.companyId },
      data: { status: parsed.data.status },
      include: { items: true, client: true },
    })
    res.json(serializeInvoice(invoice))
  }),
)

invoicesRouter.delete(
  '/:invoiceId',
  asyncHandler(async (req, res) => {
    await prisma.invoice.delete({
      where: { id: req.params.invoiceId, companyId: req.params.companyId },
    })
    res.status(204).end()
  }),
)
