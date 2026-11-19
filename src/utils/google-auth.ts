import { env } from '../config/db.js'

export interface GoogleTokenClaims {
  sub: string
  email: string
  givenName: string
  familyName: string
}

interface GoogleTokenInfoResponse {
  sub?: string
  email?: string
  email_verified?: string | boolean
  aud?: string
  iss?: string
  exp?: string
  given_name?: string
  family_name?: string
}

export const verifyGoogleIdToken = async (idToken: string): Promise<GoogleTokenClaims> => {
  if (!env.GOOGLE_CLIENT_ID) {
    throw new Error('GOOGLE_CLIENT_ID is not configured')
  }

  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
  )
  if (!res.ok) {
    throw new Error('Invalid Google ID token')
  }

  const data = (await res.json()) as GoogleTokenInfoResponse

  const validIssuer =
    data.iss === 'accounts.google.com' || data.iss === 'https://accounts.google.com'
  const emailVerified = data.email_verified === true || data.email_verified === 'true'
  const notExpired = typeof data.exp === 'string' && Number(data.exp) * 1000 > Date.now()

  if (!validIssuer) throw new Error(`Invalid Google token issuer: ${data.iss}`)
  if (data.aud !== env.GOOGLE_CLIENT_ID) {
    throw new Error(`Google token audience mismatch (expected ${env.GOOGLE_CLIENT_ID}, got ${data.aud})`)
  }
  if (!emailVerified) throw new Error('Google account email is not verified')
  if (!notExpired) throw new Error('Google ID token has expired')
  if (!data.sub || !data.email) throw new Error('Google token missing sub or email')

  return {
    sub: data.sub,
    email: data.email.toLowerCase(),
    givenName: data.given_name?.trim() || 'DÁMS',
    familyName: data.family_name?.trim() || 'Patron',
  }
}
