import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

let _s3: S3Client | null = null;

function getR2(): S3Client {
  if (!_s3) {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error('Missing R2 credentials');
    }
    _s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return _s3;
}

const BUCKET = () => process.env.R2_BUCKET_NAME || 'efta-documents';

/**
 * Fetch full extracted text for a document from R2.
 * Falls back to null if the file doesn't exist.
 */
export async function getDocumentText(batesNumber: string): Promise<string | null> {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET(),
      Key: `text/${batesNumber}.txt`,
    });
    const response = await getR2().send(command);
    if (!response.Body) return null;
    return await response.Body.transformToString('utf-8');
  } catch (err: any) {
    if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) {
      return null;
    }
    console.error(`R2 error fetching text/${batesNumber}.txt:`, err);
    return null;
  }
}

/**
 * Generate a presigned URL for a PDF (1 hour TTL).
 */
export async function getDocumentPdfUrl(batesNumber: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET(),
    Key: `documents/${batesNumber}.pdf`,
  });
  return getSignedUrl(getR2(), command, { expiresIn: 3600 });
}
