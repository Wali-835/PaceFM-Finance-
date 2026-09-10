import { Router } from 'express'
import { z } from 'zod'
import ExcelJS from 'exceljs'
import { prisma } from '../db.js'
import { requireAuth, requireCompanyMember } from '../middleware/auth.js'
import { asyncHandler } from '../lib/asyncHandler.js'
import { money, styleHeaderRow, addTitle } from '../lib/excelHelpers.js'

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

function billTotal(bill: { items: { quantity: unknown; unitPrice: unknown }[]; taxRate: unknown; whtRate: unknown }) {
  const subtotal = bill.items.reduce((s, i) => s + Number(i.quantity) * Number(i.unitPrice), 0)
  return subtotal * (1 + Number(bill.taxRate) / 100 - Number(bill.whtRate) / 100)
}

vendorsRouter.get(
  '/:vendorId/statement',
  asyncHandler(async (req, res) => {
    const { companyId, vendorId } = req.params
    const from = (req.query.from as string) || undefined
    const to = (req.query.to as string) || '2999-12-31'
    const toDate = new Date(to)

    const [company, vendor] = await Promise.all([
      prisma.company.findUnique({ where: { id: companyId } }),
      prisma.vendor.findUnique({ where: { id: vendorId, companyId } }),
    ])
    if (!vendor) {
      res.status(404).json({ error: 'Vendor not found' })
      return
    }
    const currency = company?.currency ?? 'USD'

    const allBills = await prisma.bill.findMany({
      where: { companyId, vendorId, status: { in: ['unpaid', 'overdue', 'paid'] } },
      include: { items: true },
      orderBy: [{ billDate: 'asc' }, { billNumber: 'asc' }],
    })

    const fromDate = from ? new Date(from) : null
    const priorBills = fromDate ? allBills.filter((b) => b.billDate < fromDate) : []
    const inRangeBills = allBills.filter((b) => (!fromDate || b.billDate >= fromDate) && b.billDate <= toDate)

    const openingBalance = priorBills.reduce((s, b) => s + (b.status === 'paid' ? 0 : billTotal(b)), 0)

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
    sheet.addRow([`Vendor: ${vendor.name}`])
    if (vendor.address) sheet.addRow([`Address: ${vendor.address}`])
    sheet.addRow([`Period: ${from ?? 'inception'} to ${to} (${currency})`])
    sheet.addRow([])

    const headerRow = sheet.addRow(['Date', 'Bill #', 'Status', 'Debit', 'Credit', 'Balance'])
    styleHeaderRow(headerRow)

    sheet.addRow(['', '', 'Opening balance', '', '', money(openingBalance)]).font = { italic: true }

    let balance = openingBalance
    for (const b of inRangeBills) {
      const total = billTotal(b)
      const debit = total
      const credit = b.status === 'paid' ? total : 0
      balance += debit - credit
      sheet.addRow([
        b.billDate.toISOString().slice(0, 10),
        b.billNumber,
        b.status,
        money(debit),
        money(credit),
        money(balance),
      ])
    }

    const totalDebit = inRangeBills.reduce((s, b) => s + billTotal(b), 0)
    const totalCredit = inRangeBills.reduce((s, b) => s + (b.status === 'paid' ? billTotal(b) : 0), 0)
    sheet.addRow([])
    const closingRow = sheet.addRow(['', '', 'Closing balance', money(totalDebit), money(totalCredit), money(balance)])
    closingRow.font = { bold: true }

    for (const key of ['debit', 'credit', 'balance']) {
      sheet.getColumn(key).numFmt = '#,##0.00'
    }

    const buffer = await workbook.xlsx.writeBuffer()
    const filename = `${vendor.name.replace(/[^a-z0-9]+/gi, '-')}-statement.xlsx`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(Buffer.from(buffer))
  }),
)
