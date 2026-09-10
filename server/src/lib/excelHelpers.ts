import type ExcelJS from 'exceljs'

export function money(n: number) {
  return Math.round(n * 100) / 100
}

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFE2E8F0' },
}

export function styleHeaderRow(row: ExcelJS.Row) {
  row.font = { bold: true }
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL
  })
}

export function addTitle(sheet: ExcelJS.Worksheet, text: string, span: number) {
  const row = sheet.addRow([text])
  sheet.mergeCells(row.number, 1, row.number, span)
  row.font = { bold: true, size: 13 }
  sheet.addRow([])
}
