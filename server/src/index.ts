import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import type { NextFunction, Request, Response } from 'express'
import { authRouter } from './routes/auth.js'
import { companiesRouter } from './routes/companies.js'
import { accountsRouter } from './routes/accounts.js'
import { categoriesRouter } from './routes/categories.js'
import { transactionsRouter } from './routes/transactions.js'
import { budgetsRouter } from './routes/budgets.js'
import { clientsRouter } from './routes/clients.js'
import { invoicesRouter } from './routes/invoices.js'

const app = express()

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  }),
)
app.use(express.json())
app.use(cookieParser())

app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.use('/api/auth', authRouter)
app.use('/api/companies', companiesRouter)
app.use('/api/companies/:companyId/accounts', accountsRouter)
app.use('/api/companies/:companyId/categories', categoriesRouter)
app.use('/api/companies/:companyId/transactions', transactionsRouter)
app.use('/api/companies/:companyId/budgets', budgetsRouter)
app.use('/api/companies/:companyId/clients', clientsRouter)
app.use('/api/companies/:companyId/invoices', invoicesRouter)

app.use((req, res) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.path}` })
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err)
  const prismaError = err as { code?: string; meta?: { target?: string[] } }
  if (prismaError.code === 'P2002') {
    res.status(409).json({ error: `A record with this ${prismaError.meta?.target?.join(', ') ?? 'value'} already exists` })
    return
  }
  if (prismaError.code === 'P2025') {
    res.status(404).json({ error: 'Record not found' })
    return
  }
  res.status(500).json({ error: 'Internal server error' })
})

const port = Number(process.env.PORT ?? 4000)
app.listen(port, () => {
  console.log(`PaceFM Finance API listening on http://localhost:${port}`)
})
