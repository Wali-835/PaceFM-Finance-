// Egyptian Tax Authority (ETA) e-invoicing integration.
//
// IMPORTANT: the token endpoint URL, request shape, and `scope` value below
// are a best-effort implementation of the standard OAuth2 client-credentials
// pattern ETA's identity server is documented to use. They have NOT been
// verified against ETA's current live documentation — this environment has
// no network access to eta.gov.eg. Treat this as a starting point: if
// `getAccessToken` fails, the error message/body from ETA is surfaced as-is
// (see routes/eta.ts) so it can be compared against ETA's actual API docs
// and corrected here.
//
// The token URL (`/connect/token`) matches IdentityServer4's default route,
// which supports two ways for a confidential client to authenticate:
// `client_secret_basic` (client_id/secret in an HTTP Basic Authorization
// header) or `client_secret_post` (client_id/secret in the form body). Which
// one ETA's client registration expects isn't documented anywhere we can
// verify, so `getAccessToken` tries Basic auth first and falls back to
// posting the credentials in the body if that's rejected.
//
// Everything below the token fetch (document submission, signing handoff,
// polling received documents) is not built yet — this is deliberately
// scoped to "prove the credentials work" as the first testable step. Note
// this token step is unrelated to the USB signing token/HSM ETA issues
// separately — that's only needed later, to digitally sign the invoice
// document itself before submission.

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

type ClientAuthMethod = 'basic' | 'post'

async function requestToken(
  clientId: string,
  clientSecret: string,
  authMethod: ClientAuthMethod,
): Promise<{ accessToken: string; expiresIn: number }> {
  const params = new URLSearchParams({ grant_type: 'client_credentials', scope: 'InvoicingAPI' })
  const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' }

  if (authMethod === 'basic') {
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
  } else {
    params.set('client_id', clientId)
    params.set('client_secret', clientSecret)
  }

  let res: Response
  try {
    res = await fetch(getTokenUrl(), { method: 'POST', headers, body: params })
  } catch (err) {
    throw new EtaApiError(
      `Could not reach ETA token endpoint (${getTokenUrl()}): ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  const text = await res.text()
  let data: unknown
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  if (!res.ok) {
    const err = new EtaApiError(`ETA token request failed with status ${res.status} (client auth: ${authMethod})`)
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

  return { accessToken: parsed.access_token, expiresIn: parsed.expires_in ?? 3600 }
}

export async function getAccessToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.accessToken
  }

  const { clientId, clientSecret } = requireCredentials()

  let result: { accessToken: string; expiresIn: number }
  try {
    result = await requestToken(clientId, clientSecret, 'basic')
  } catch (basicErr) {
    try {
      result = await requestToken(clientId, clientSecret, 'post')
    } catch (postErr) {
      if (postErr instanceof EtaApiError && basicErr instanceof Error) {
        postErr.message = `${postErr.message}. Also tried HTTP Basic client auth: ${basicErr.message}`
      }
      throw postErr
    }
  }

  cachedToken = {
    accessToken: result.accessToken,
    expiresAt: Date.now() + result.expiresIn * 1000,
  }
  return cachedToken.accessToken
}
