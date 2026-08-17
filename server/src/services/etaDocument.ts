// Egyptian Tax Authority (ETA) e-invoice document builder.
//
// Maps our Invoice/InvoiceItem/Company/Client records into ETA's
// "documentType": "I" (invoice) JSON schema, based on publicly documented
// field names for ETA's e-invoicing system. This has NOT been validated
// against ETA's live schema validator — this environment has no network
// access to eta.gov.eg. Treat the output as a first draft: submitting it
// (or running it through ETA's validation API) will very likely surface
// specific field errors, especially around the items flagged below as
// unverified. Fix those constants/mappings here rather than guessing blind.
//
// UNVERIFIED / HIGHEST RISK:
//   - itemType/itemCode: ETA requires each invoice line to carry either a
//     GS1 GPC code or an "EGS" (Egyptian goods/services) classification
//     code. We don't have that reference data, so every line is emitted
//     with a placeholder itemCode — this will need real per-product codes
//     before ETA accepts a document.
//   - unitType: mapped from the free-text "unit" field on each invoice
//     line via UNIT_CODE_MAP below (best-effort GS1 unit codes). Anything
//     not recognized falls back to "EA" (each).
//   - taxTotals: only standard-rate VAT ("T1"/"V009") and WHT ("T4") are
//     modeled, both applied uniformly using the invoice's tax_rate /
//     wht_rate. Other ETA tax types/regimes are not handled.
//
// This module only builds the unsigned document — it does not sign or
// submit anything.

import type { Prisma } from '../generated/prisma/client.js'

type InvoiceWithRelations = Prisma.InvoiceGetPayload<{ include: { items: true; client: true } }>

type CompanyEtaProfile = {
  name: string
  etaTaxRegistrationNumber: string | null
  etaBranchId: string
  etaActivityCode: string | null
  etaGovernorate: string | null
  etaRegionCity: string | null
  etaStreet: string | null
  etaBuildingNumber: string | null
}

export class EtaDocumentError extends Error {
  missingFields: string[]
  constructor(missingFields: string[]) {
    super(`Cannot build ETA document, missing required fields: ${missingFields.join(', ')}`)
    this.missingFields = missingFields
  }
}

const UNIT_CODE_MAP: Record<string, string> = {
  hour: 'HUR',
  hours: 'HUR',
  hr: 'HUR',
  day: 'DAY',
  days: 'DAY',
  month: 'MON',
  months: 'MON',
  kg: 'KGM',
  kilogram: 'KGM',
  piece: 'EA',
  pieces: 'EA',
  pcs: 'EA',
  pc: 'EA',
  unit: 'EA',
  units: 'EA',
  box: 'BX',
  boxes: 'BX',
  liter: 'LTR',
  litre: 'LTR',
  l: 'LTR',
  meter: 'MTR',
  metre: 'MTR',
  m: 'MTR',
}

function mapUnit(unit: string): string {
  const key = unit.trim().toLowerCase()
  return UNIT_CODE_MAP[key] ?? 'EA'
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

export function buildEtaInvoiceDocument(invoice: InvoiceWithRelations, company: CompanyEtaProfile) {
  const missing: string[] = []
  if (!company.etaTaxRegistrationNumber) missing.push('company.eta_tax_registration_number')
  if (!company.etaActivityCode) missing.push('company.eta_activity_code')
  if (!company.etaGovernorate) missing.push('company.eta_governorate')
  if (!company.etaRegionCity) missing.push('company.eta_region_city')
  if (!company.etaStreet) missing.push('company.eta_street')
  if (!company.etaBuildingNumber) missing.push('company.eta_building_number')

  if (!invoice.client) {
    missing.push('invoice.client_id (invoice must have a client assigned)')
  } else {
    if (!invoice.client.etaTaxRegistrationNumber) missing.push('client.eta_tax_registration_number')
    if (!invoice.client.etaGovernorate) missing.push('client.eta_governorate')
    if (!invoice.client.etaRegionCity) missing.push('client.eta_region_city')
    if (!invoice.client.etaStreet) missing.push('client.eta_street')
    if (!invoice.client.etaBuildingNumber) missing.push('client.eta_building_number')
  }
  if (invoice.items.length === 0) missing.push('invoice.items (at least one line item is required)')

  if (missing.length > 0) {
    throw new EtaDocumentError(missing)
  }

  const client = invoice.client!
  const taxRate = Number(invoice.taxRate)
  const whtRate = Number(invoice.whtRate)

  const invoiceLines = invoice.items.map((item) => {
    const quantity = Number(item.quantity)
    const unitPrice = Number(item.unitPrice)
    const salesTotal = round2(quantity * unitPrice)
    const taxAmount = round2(salesTotal * (taxRate / 100))

    return {
      description: item.description,
      itemType: 'EGS',
      itemCode: 'EG-0000000',
      unitType: mapUnit(item.unit || 'unit'),
      quantity,
      unitValue: {
        currencySold: 'EGP',
        amountEGP: unitPrice,
      },
      salesTotal,
      total: round2(salesTotal + taxAmount),
      valuesDifference: 0,
      totalTaxableFees: 0,
      netTotal: salesTotal,
      itemsDiscount: 0,
      discount: { rate: 0, amount: 0 },
      taxableItems: taxRate > 0 ? [{ taxType: 'T1', amount: taxAmount, subType: 'V009', rate: taxRate }] : [],
    }
  })

  const totalSalesAmount = round2(invoiceLines.reduce((s, l) => s + l.salesTotal, 0))
  const vatAmount = round2(
    invoiceLines.reduce((s, l) => s + l.taxableItems.reduce((ts, t) => ts + t.amount, 0), 0),
  )
  const whtAmount = round2(totalSalesAmount * (whtRate / 100))

  const taxTotals = [
    ...(vatAmount > 0 ? [{ taxType: 'T1', amount: vatAmount }] : []),
    ...(whtAmount > 0 ? [{ taxType: 'T4', amount: whtAmount }] : []),
  ]

  const totalAmount = round2(totalSalesAmount + vatAmount - whtAmount)

  return {
    issuer: {
      address: {
        branchID: company.etaBranchId,
        country: 'EG',
        governate: company.etaGovernorate,
        regionCity: company.etaRegionCity,
        street: company.etaStreet,
        buildingNumber: company.etaBuildingNumber,
      },
      type: 'B',
      id: company.etaTaxRegistrationNumber,
      name: company.name,
    },
    receiver: {
      address: {
        country: 'EG',
        governate: client.etaGovernorate,
        regionCity: client.etaRegionCity,
        street: client.etaStreet,
        buildingNumber: client.etaBuildingNumber,
      },
      type: client.etaBuyerType,
      id: client.etaTaxRegistrationNumber,
      name: client.name,
    },
    documentType: 'I',
    documentTypeVersion: '1.0',
    dateTimeIssued: invoice.issueDate.toISOString(),
    taxpayerActivityCode: company.etaActivityCode,
    internalID: invoice.invoiceNumber,
    invoiceLines,
    totalDiscountAmount: 0,
    totalSalesAmount,
    netAmount: totalSalesAmount,
    taxTotals,
    extraDiscountAmount: 0,
    totalItemsDiscountAmount: 0,
    totalAmount,
  }
}
