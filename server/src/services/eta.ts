// Egyptian Tax Authority (ETA) e-invoicing integration.
//
// IMPORTANT: the token endpoint URL, request shape, and `scope` value below
// are a best-effort implementation of the standard OAuth2 client-credentials
// pattern ETA's identity server is documented to use. They have NOT been
// verified against ETA's current live documentation or tested against a
// real ETA server — this environment has no network access to eta.gov.eg.
// Treat this as a starting point: if `getAccessToken` fails, the error
// message/body from ETA is surfaced as-is (see routes/eta.ts) so it can be
// compared against ETA's actual API docs and corrected here.
//
// Everything below the token fetch (document submission, signing handoff,
// polling received documents) is not built yet — this is deliberately
// scoped to "prove the credentials work" as the first testable step.

type EtaEnvironment = 'preprod' | 'production'

const DEFAULT_TOKEN_URLS: Record<EtaEnvironment, string> = {
  preprod: 'https://id.preprod.eta.gov.eg/connect/token',
  production: 'https://id.eta.gov.eg/connect/token',
}

const DEFAULT_API_BASE_URLS: Record<EtaEnvironment, string> = {
  preprod: 'https://api.preprod.invoicing.eta.gov.eg/api/v1',
  production: 'https://api.invoicing.eta.gov.eg/api/v1',
}

export class EtaConfigError extends Error {}

export class EtaApiError extends Error {
  status?: number
  body?: unknown
}

function getEnvironment(): EtaEnvironment {
  const raw = process.env.ETA_ENV
  return raw === 'production' ? 'production' : 'preprod'
}

export function getEtaEnvironment(): EtaEnvironment {
  return getEnvironment()
}

function getTokenUrl() {
  return process.env.ETA_TOKEN_URL || DEFAULT_TOKEN_URLS[getEnvironment()]
}

export function getApiBaseUrl() {
  return process.env.ETA_API_BASE_URL || DEFAULT_API_BASE_URLS[getEnvironment()]
}

function requireCredentials() {
  const clientId = process.env.ETA_CLIENT_ID
  const clientSecret = process.env.ETA_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new EtaConfigError(
      'Missing ETA_CLIENT_ID / ETA_CLIENT_SECRET environment variables. Set these in the API project on Vercel (or server/.env locally) before testing the connection.',
    )
  }
  return { clientId, clientSecret }
}

let cachedToken: { accessToken: string; expiresAt: number } | null = null

export async function getAccessToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.accessToken
  }

  const { clientId, clientSecret } = requireCredentials()

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'InvoicingAPI',
  })

  let res: Response
  try {
    res = await fetch(getTokenUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
  } catch (err) {
    const wrapped = new EtaApiError(
      `Could not reach ETA token endpoint (${getTokenUrl()}): ${err instanceof Error ? err.message : String(err)}`,
    )
    throw wrapped
  }

  const text = await res.text()
  let data: unknown
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  if (!res.ok) {
    const err = new EtaApiError(`ETA token request failed with status ${res.status}`)
    err.status = res.status
    err.body = data
    throw err
  }

  const parsed = data as { access_token?: string; expires_in?: number } | null
  if (!parsed?.access_token) {
    const err = new EtaApiError('ETA token response did not include an access_token')
    err.body = data
    throw err
  }

  cachedToken = {
    accessToken: parsed.access_token,
    expiresAt: Date.now() + (parsed.expires_in ?? 3600) * 1000,
  }
  return cachedToken.accessToken
}
