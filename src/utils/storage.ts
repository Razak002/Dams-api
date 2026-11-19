import { randomUUID } from 'node:crypto'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { env } from '../config/db.js'

export class InvalidMediaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidMediaError'
  }
}

export class StorageNotConfiguredError extends Error {
  constructor() {
    super('Cloudflare R2 storage is not configured')
    this.name = 'StorageNotConfiguredError'
  }
}

let client: S3Client | null = null

const getR2Client = () => {
  if (
    !env.R2_ACCOUNT_ID ||
    !env.R2_ACCESS_KEY_ID ||
    !env.R2_SECRET_ACCESS_KEY ||
    !env.R2_BUCKET_NAME ||
    !env.R2_PUBLIC_URL
  ) {
    throw new StorageNotConfiguredError()
  }

  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    })
  }

  return {
    client,
    bucket: env.R2_BUCKET_NAME,
    publicUrl: env.R2_PUBLIC_URL.replace(/\/+$/, ''),
  }
}

const detectMediaType = (
  buf: Buffer,
  allowGlb: boolean
): { ext: string; contentType: string } | null => {
  if (buf.length < 12) return null

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return { ext: 'png', contentType: 'image/png' }
  }

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: 'jpg', contentType: 'image/jpeg' }
  }

  // WebP: RIFF....WEBP
  if (
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { ext: 'webp', contentType: 'image/webp' }
  }

  // GLB (glTF binary): "glTF"
  if (allowGlb && buf.subarray(0, 4).toString('ascii') === 'glTF') {
    return { ext: 'glb', contentType: 'model/gltf-binary' }
  }

  return null
}

export const uploadToR2 = async (params: {
  file: File
  folder: 'products' | 'collections' | 'custom-orders'
  allowGlb?: boolean
}) => {
  const { client: r2, bucket, publicUrl } = getR2Client()
  const buffer = Buffer.from(await params.file.arrayBuffer())
  const detected = detectMediaType(buffer, Boolean(params.allowGlb))

  if (!detected) {
    throw new InvalidMediaError(
      params.allowGlb
        ? 'Invalid file signature. Allowed: WebP, PNG, JPG, or .glb'
        : 'Invalid image signature. Allowed: WebP, PNG, or JPG'
    )
  }

  const key = `${params.folder}/${randomUUID()}.${detected.ext}`

  await r2.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: detected.contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    })
  )

  return {
    key,
    url: `${publicUrl}/${key}`,
    mimeType: detected.contentType,
    sizeBytes: buffer.length,
  }
}
