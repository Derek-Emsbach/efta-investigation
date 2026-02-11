import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const R2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.R2_BUCKET_NAME!

export async function uploadFile(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<string> {
  await R2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  )
  return `${process.env.R2_PUBLIC_URL}/${key}`
}

export async function getSignedDownloadUrl(
  key: string,
  expiresIn = 3600,
): Promise<string> {
  return getSignedUrl(
    R2,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn },
  )
}

export async function deleteFile(key: string): Promise<void> {
  await R2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
}

export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 900,
): Promise<string> {
  return getSignedUrl(
    R2,
    new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
    { expiresIn },
  )
}

export async function headObject(key: string): Promise<boolean> {
  try {
    await R2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))
    return true
  } catch {
    return false
  }
}
