import { createReadStream, createWriteStream, statSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const [operation, bucket, key, filename, contentType] = process.argv.slice(2);
if (!['put', 'get'].includes(operation) || !bucket || !key || !filename || operation === 'put' && !contentType) {
  console.error('Usage: node scripts/r2-backup.mjs <put|get> <bucket> <key> <file> [content-type]');
  process.exit(2);
}

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
if (!accountId || !accessKeyId || !secretAccessKey) {
  console.error('Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID, and CLOUDFLARE_R2_SECRET_ACCESS_KEY.');
  process.exit(2);
}

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

try {
  if (operation === 'put') {
    const result = await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: createReadStream(filename),
      ContentLength: statSync(filename).size,
      ContentType: contentType,
    }));
    console.log(`Uploaded ${key} to R2 (ETag ${result.ETag ?? 'unavailable'}).`);
  } else {
    const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!result.Body) throw new Error(`R2 returned an empty response for ${key}.`);
    await pipeline(result.Body, createWriteStream(filename));
    console.log(`Downloaded ${key} from R2.`);
  }
} finally {
  client.destroy();
}
