export type MemberRole = 'owner' | 'admin' | 'member'
export type AccountType = 'cash' | 'bank' | 'credit_card' | 'other'
export type CategoryKind = 'income' | 'expense'
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'void'
export type BillStatus = 'unpaid' | 'paid' | 'overdue' | 'void'

export type Company = {
  id: string
  name: string
  currency: string
  created_by: string
  created_at: string
}

export type Account = {
  id: string
  company_id: string
  name: string
  type: AccountType
  opening_balance: number
  created_at: string
}

export type Category = {
  id: string
  company_id: string
  name: string
  kind: CategoryKind
  color: string
  created_at: string
}

export type Transaction = {
  id: string
  company_id: string
  account_id: string | null
  category_id: string | null
  vendor_id: string | null
  vendor_name: string | null
  kind: CategoryKind
  amount: number
  tax_rate: number
  wht_rate: number
  tax_amount: number
  wht_amount: number
  total: number
  occurred_on: string
  description: string
  created_by: string | null
  created_at: string
}

export type Budget = {
  id: string
  company_id: string
  category_id: string
  month: string
  amount: number
  created_at: string
}

export type Client = {
  id: string
  company_id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  created_at: string
}

export type Invoice = {
  id: string
  company_id: string
  client_id: string | null
  invoice_number: string
  status: InvoiceStatus
  issue_date: string
  due_date: string
  notes: string
  tax_rate: number
  wht_rate: number
  created_at: string
}

export type InvoiceItem = {
  id: string
  invoice_id: string
  description: string
  unit: string
  quantity: number
  unit_price: number
  position: number
}

export type Vendor = {
  id: string
  company_id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  created_at: string
}

export type Bill = {
  id: string
  company_id: string
  vendor_id: string | null
  bill_number: string
  status: BillStatus
  bill_date: string
  due_date: string
  notes: string
  tax_rate: number
  wht_rate: number
  created_at: string
}

export type BillItem = {
  id: string
  bill_id: string
  description: string
  unit: string
  quantity: number
  unit_price: number
  position: number
}
