import { Router } from 'express'
import { z } from 'zod'
import ExcelJS from 'exceljs'
import { prisma } from '../db.js'
import { requireAuth, requireCompanyMember } from '../middleware/auth.js'
import { asyncHandler } from '../lib/asyncHandler.js'
import { money, styleHeaderRow, addTitle } from '../lib/excelHelpers.js'

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

function invoiceTotal(inv: { items: { quantity: unknown; unitPrice: unknown }[]; taxRate: unknown; whtRate: unknown }) {
  const subtotal = inv.items.reduce((s, i) => s + Number(i.quantity) * Number(i.unitPrice), 0)
  return subtotal * (1 + Number(inv.taxRate) / 100 - Number(inv.whtRate) / 100)
}

clientsRouter.get(
  '/:clientId/statement',
  asyncHandler(async (req, res) => {
    const { companyId, clientId } = req.params
    const from = (req.query.from as string) || undefined
    const to = (req.query.to as string) || '2999-12-31'
    const toDate = new Date(to)

    const [company, client] = await Promise.all([
      prisma.company.findUnique({ where: { id: companyId } }),
      prisma.client.findUnique({ where: { id: clientId, companyId } }),
    ])
    if (!client) {
      res.status(404).json({ error: 'Client not found' })
      return
    }
    const currency = company?.currency ?? 'USD'

    const allInvoices = await prisma.invoice.findMany({
      where: { companyId, clientId, status: { in: ['sent', 'overdue', 'paid'] } },
      include: { items: true },
      orderBy: [{ issueDate: 'asc' }, { invoiceNumber: 'asc' }],
    })

    const fromDate = from ? new Date(from) : null
    const priorInvoices = fromDate ? allInvoices.filter((inv) => inv.issueDate < fromDate) : []
    const inRangeInvoices = allInvoices.filter(
      (inv) => (!fromDate || inv.issueDate >= fromDate) && inv.issueDate <= toDate,
    )

    const openingBalance = priorInvoices.reduce(
      (s, inv) => s + (inv.status === 'paid' ? 0 : invoiceTotal(inv)),
      0,
    )

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'PaceFM Finance'
    workbook.created = new Date()

    const sheet = workbook.addWorksheet('Statement of Account')
    sheet.columns = [
      { key: 'date', width: 12 },
      { key: 'reference', width: 16 },
      { key: 'status', width: 12 },
      { key: 'debit', width: 16 },
      { key: 'credit', width: 16 },
      { key: 'balance', width: 16 },
    ]

    addTitle(sheet, `${company?.name ?? 'Company'} — Statement of Account`, 6)
    sheet.addRow([`Client: ${client.name}`])
    if (client.address) sheet.addRow([`Address: ${client.address}`])
    sheet.addRow([`Period: ${from ?? 'inception'} to ${to} (${currency})`])
    sheet.addRow([])

    const headerRow = sheet.addRow(['Date', 'Invoice #', 'Status', 'Debit', 'Credit', 'Balance'])
    styleHeaderRow(headerRow)

    sheet.addRow(['', '', 'Opening balance', '', '', money(openingBalance)]).font = { italic: true }

    let balance = openingBalance
    for (const inv of inRangeInvoices) {
      const total = invoiceTotal(inv)
      const debit = total
      const credit = inv.status === 'paid' ? total : 0
      balance += debit - credit
      sheet.addRow([
        inv.issueDate.toISOString().slice(0, 10),
        inv.invoiceNumber,
        inv.status,
        money(debit),
        money(credit),
        money(balance),
      ])
    }

    const totalDebit = inRangeInvoices.reduce((s, inv) => s + invoiceTotal(inv), 0)
    const totalCredit = inRangeInvoices.reduce((s, inv) => s + (inv.status === 'paid' ? invoiceTotal(inv) : 0), 0)
    sheet.addRow([])
    const closingRow = sheet.addRow(['', '', 'Closing balance', money(totalDebit), money(totalCredit), money(balance)])
    closingRow.font = { bold: true }

    for (const key of ['debit', 'credit', 'balance']) {
      sheet.getColumn(key).numFmt = '#,##0.00'
    }

    const buffer = await workbook.xlsx.writeBuffer()
    const filename = `${client.name.replace(/[^a-z0-9]+/gi, '-')}-statement.xlsx`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(Buffer.from(buffer))
  }),
)
