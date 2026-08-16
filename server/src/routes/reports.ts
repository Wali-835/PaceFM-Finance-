import { Router } from 'express'
import ExcelJS from 'exceljs'
import { prisma } from '../db.js'
import { requireAuth, requireCompanyMember } from '../middleware/auth.js'
import { asyncHandler } from '../lib/asyncHandler.js'

export const reportsRouter = Router({ mergeParams: true })
reportsRouter.use(requireAuth, requireCompanyMember())

function money(n: number) {
  return Math.round(n * 100) / 100
}

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFE2E8F0' },
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.font = { bold: true }
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL
  })
}

function addTitle(sheet: ExcelJS.Worksheet, text: string, span: number) {
  const row = sheet.addRow([text])
  sheet.mergeCells(row.number, 1, row.number, span)
  row.font = { bold: true, size: 13 }
  sheet.addRow([])
}

type CategorizedAmount = { categoryId: string | null; categoryName: string; amount: number }

function groupByCategory(
  rows: { categoryId: string | null; total: number }[],
  categories: { id: string; name: string }[],
): CategorizedAmount[] {
  const nameById = new Map(categories.map((c) => [c.id, c.name]))
  const totals = new Map<string, number>()
  for (const r of rows) {
    const key = r.categoryId ?? 'uncategorized'
    totals.set(key, (totals.get(key) ?? 0) + r.total)
  }
  return [...totals.entries()]
    .map(([categoryId, amount]) => ({
      categoryId: categoryId === 'uncategorized' ? null : categoryId,
      categoryName: categoryId === 'uncategorized' ? 'Uncategorized' : (nameById.get(categoryId) ?? 'Unknown'),
      amount,
    }))
    .sort((a, b) => b.amount - a.amount)
}

reportsRouter.get(
  '/export',
  asyncHandler(async (req, res) => {
    const companyId = req.params.companyId
    const from = (req.query.from as string) || '1970-01-01'
    const to = (req.query.to as string) || '2999-12-31'
    const fromDate = new Date(from)
    const toDate = new Date(to)

    const [company, transactions, categories, invoices, bills] = await Promise.all([
      prisma.company.findUnique({ where: { id: companyId } }),
      prisma.transaction.findMany({
        where: { companyId, occurredOn: { gte: fromDate, lte: toDate } },
        include: { category: true, account: true, vendor: true },
        orderBy: [{ occurredOn: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.category.findMany({ where: { companyId } }),
      prisma.invoice.findMany({
        where: { companyId, issueDate: { gte: fromDate, lte: toDate } },
        include: { items: true, client: true },
      }),
      prisma.bill.findMany({
        where: { companyId, billDate: { gte: fromDate, lte: toDate } },
        include: { items: true, vendor: true },
      }),
    ])

    const currency = company?.currency ?? 'USD'

    const txWithTotals = transactions.map((t) => {
      const amount = Number(t.amount)
      const taxAmount = amount * (Number(t.taxRate) / 100)
      const whtAmount = amount * (Number(t.whtRate) / 100)
      return {
        ...t,
        amount,
        taxRateNum: Number(t.taxRate),
        whtRateNum: Number(t.whtRate),
        taxAmount,
        whtAmount,
        total: amount + taxAmount - whtAmount,
      }
    })

    const incomeTx = txWithTotals.filter((t) => t.kind === 'income')
    const expenseTx = txWithTotals.filter((t) => t.kind === 'expense')
    const totalIncome = incomeTx.reduce((s, t) => s + t.total, 0)
    const totalExpense = expenseTx.reduce((s, t) => s + t.total, 0)
    const netProfit = totalIncome - totalExpense

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'PaceFM Finance'
    workbook.created = new Date()

    // ---------- P&L ----------
    const pnl = workbook.addWorksheet('P&L')
    pnl.columns = [
      { key: 'label', width: 32 },
      { key: 'amount', width: 18 },
    ]
    addTitle(pnl, `Profit & Loss — ${from} to ${to} (${currency})`, 2)

    const incomeByCategory = groupByCategory(
      incomeTx.map((t) => ({ categoryId: t.categoryId, total: t.total })),
      categories,
    )
    const expenseByCategory = groupByCategory(
      expenseTx.map((t) => ({ categoryId: t.categoryId, total: t.total })),
      categories,
    )

    styleHeaderRow(pnl.addRow(['Income', '']))
    for (const c of incomeByCategory) pnl.addRow([c.categoryName, money(c.amount)])
    pnl.addRow(['Total income', money(totalIncome)]).font = { bold: true }
    pnl.addRow([])
    styleHeaderRow(pnl.addRow(['Expenses', '']))
    for (const c of expenseByCategory) pnl.addRow([c.categoryName, money(c.amount)])
    pnl.addRow(['Total expenses', money(totalExpense)]).font = { bold: true }
    pnl.addRow([])
    pnl.addRow(['Net profit', money(netProfit)]).font = { bold: true, size: 12 }
    pnl.getColumn('amount').numFmt = '#,##0.00'

    // ---------- General Ledger ----------
    const gl = workbook.addWorksheet('General Ledger')
    gl.columns = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Description', key: 'description', width: 30 },
      { header: 'Kind', key: 'kind', width: 10 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Account', key: 'account', width: 18 },
      { header: 'Vendor', key: 'vendor', width: 20 },
      { header: 'Amount', key: 'amount', width: 14 },
      { header: 'Tax %', key: 'taxRate', width: 10 },
      { header: 'Tax amount', key: 'taxAmount', width: 14 },
      { header: 'WHT %', key: 'whtRate', width: 10 },
      { header: 'WHT amount', key: 'whtAmount', width: 14 },
      { header: 'Net total', key: 'total', width: 14 },
    ]
    styleHeaderRow(gl.getRow(1))
    for (const t of txWithTotals) {
      gl.addRow({
        date: t.occurredOn.toISOString().slice(0, 10),
        description: t.description || '—',
        kind: t.kind,
        category: t.category?.name ?? '—',
        account: t.account?.name ?? '—',
        vendor: t.vendor?.name ?? '—',
        amount: money(t.amount),
        taxRate: t.taxRateNum,
        taxAmount: money(t.taxAmount),
        whtRate: t.whtRateNum,
        whtAmount: money(t.whtAmount),
        total: money(t.total),
      })
    }
    for (const key of ['amount', 'taxAmount', 'whtAmount', 'total']) {
      gl.getColumn(key).numFmt = '#,##0.00'
    }

    // ---------- Client balance ----------
    const clientSheet = workbook.addWorksheet('Client Balance')
    clientSheet.columns = [
      { header: 'Client', key: 'client', width: 28 },
      { header: 'Invoices', key: 'count', width: 10 },
      { header: 'Invoiced', key: 'invoiced', width: 16 },
      { header: 'Paid', key: 'paid', width: 16 },
      { header: 'Outstanding', key: 'outstanding', width: 16 },
    ]
    styleHeaderRow(clientSheet.getRow(1))
    const clientTotals = new Map<
      string,
      { name: string; count: number; invoiced: number; paid: number; outstanding: number }
    >()
    for (const inv of invoices) {
      if (inv.status === 'draft' || inv.status === 'void') continue
      const subtotal = inv.items.reduce((s, i) => s + Number(i.quantity) * Number(i.unitPrice), 0)
      const total = subtotal * (1 + Number(inv.taxRate) / 100 - Number(inv.whtRate) / 100)
      const key = inv.clientId ?? 'none'
      const name = inv.client?.name ?? 'No client'
      const entry = clientTotals.get(key) ?? { name, count: 0, invoiced: 0, paid: 0, outstanding: 0 }
      entry.count += 1
      entry.invoiced += total
      if (inv.status === 'paid') entry.paid += total
      else entry.outstanding += total
      clientTotals.set(key, entry)
    }
    for (const c of [...clientTotals.values()].sort((a, b) => b.outstanding - a.outstanding)) {
      clientSheet.addRow({
        client: c.name,
        count: c.count,
        invoiced: money(c.invoiced),
        paid: money(c.paid),
        outstanding: money(c.outstanding),
      })
    }
    for (const key of ['invoiced', 'paid', 'outstanding']) {
      clientSheet.getColumn(key).numFmt = '#,##0.00'
    }

    // ---------- Vendor balance ----------
    const vendorSheet = workbook.addWorksheet('Vendor Balance')
    vendorSheet.columns = [
      { header: 'Vendor', key: 'vendor', width: 28 },
      { header: 'Bills', key: 'count', width: 10 },
      { header: 'Billed', key: 'billed', width: 16 },
      { header: 'Paid', key: 'paid', width: 16 },
      { header: 'Outstanding', key: 'outstanding', width: 16 },
    ]
    styleHeaderRow(vendorSheet.getRow(1))
    const vendorTotals = new Map<
      string,
      { name: string; count: number; billed: number; paid: number; outstanding: number }
    >()
    for (const bill of bills) {
      if (bill.status === 'void') continue
      const subtotal = bill.items.reduce((s, i) => s + Number(i.quantity) * Number(i.unitPrice), 0)
      const total = subtotal * (1 + Number(bill.taxRate) / 100 - Number(bill.whtRate) / 100)
      const key = bill.vendorId ?? 'none'
      const name = bill.vendor?.name ?? 'No vendor'
      const entry = vendorTotals.get(key) ?? { name, count: 0, billed: 0, paid: 0, outstanding: 0 }
      entry.count += 1
      entry.billed += total
      if (bill.status === 'paid') entry.paid += total
      else entry.outstanding += total
      vendorTotals.set(key, entry)
    }
    for (const v of [...vendorTotals.values()].sort((a, b) => b.outstanding - a.outstanding)) {
      vendorSheet.addRow({
        vendor: v.name,
        count: v.count,
        billed: money(v.billed),
        paid: money(v.paid),
        outstanding: money(v.outstanding),
      })
    }
    for (const key of ['billed', 'paid', 'outstanding']) {
      vendorSheet.getColumn(key).numFmt = '#,##0.00'
    }

    // ---------- EBITDA ----------
    const ebitda = workbook.addWorksheet('EBITDA')
    ebitda.columns = [
      { key: 'label', width: 34 },
      { key: 'amount', width: 18 },
    ]
    addTitle(ebitda, `EBITDA — ${from} to ${to} (${currency})`, 2)

    function sumExpenseByNameMatch(pattern: RegExp) {
      return expenseByCategory.filter((c) => pattern.test(c.categoryName)).reduce((s, c) => s + c.amount, 0)
    }
    const interestAddBack = sumExpenseByNameMatch(/interest/i)
    const taxAddBack = sumExpenseByNameMatch(/\btax(es)?\b/i)
    const depreciationAddBack = sumExpenseByNameMatch(/depreciation/i)
    const amortizationAddBack = sumExpenseByNameMatch(/amortization|amortisation/i)
    const ebitdaValue = netProfit + interestAddBack + taxAddBack + depreciationAddBack + amortizationAddBack

    ebitda.addRow(['Net profit', money(netProfit)])
    ebitda.addRow(['+ Interest expense', money(interestAddBack)])
    ebitda.addRow(['+ Taxes', money(taxAddBack)])
    ebitda.addRow(['+ Depreciation', money(depreciationAddBack)])
    ebitda.addRow(['+ Amortization', money(amortizationAddBack)])
    ebitda.addRow(['EBITDA', money(ebitdaValue)]).font = { bold: true, size: 12 }
    ebitda.addRow([])
    ebitda.addRow([
      'Note: add-backs are found by matching expense category names containing ' +
        '"interest", "tax", "depreciation", or "amortization". Rename or create ' +
        'categories accordingly for this to reflect your real figures — this does ' +
        'not include VAT/WHT tracked on individual transactions or invoices/bills, ' +
        'which are a different concept from income tax expense.',
    ])
    ebitda.getRow(ebitda.rowCount).font = { italic: true, size: 9, color: { argb: 'FF64748B' } }
    ebitda.mergeCells(ebitda.rowCount, 1, ebitda.rowCount, 2)
    ebitda.getColumn('amount').numFmt = '#,##0.00'

    const buffer = await workbook.xlsx.writeBuffer()
    const filename = `pacefm-reports-${from}-to-${to}.xlsx`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(Buffer.from(buffer))
  }),
)
