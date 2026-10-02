import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import {
  BUCKETS,
  createSignedUploadUrl,
  downloadObject,
  listObjects,
  objectExists,
  publicObjectUrl,
  removeObjects,
  uploadObject,
} from '@/server/storage/client';

const prefix = `listings/user_storagetest${randomUUID().replaceAll('-', '')}`;
const uploadPath = (ext = 'jpg'): string => `${prefix}/${randomUUID()}.${ext}`;
const written: { bucket: (typeof BUCKETS)[keyof typeof BUCKETS]; path: string }[] = [];

afterAll(async () => {
  for (const { bucket, path } of written) await removeObjects(bucket, [path]);
});

describe('storage wrapper', () => {
  it('accepts a raw PUT to a signed upload URL, then lists, downloads, and removes it', async () => {
    const path = uploadPath();
    written.push({ bucket: BUCKETS.uploads, path });
    const signedUrl = await createSignedUploadUrl(BUCKETS.uploads, path);
    const body = Buffer.from('fake jpeg bytes');
    const response = await fetch(signedUrl, {
      method: 'PUT',
      headers: { 'content-type': 'image/jpeg' },
      body,
    });
    expect(response.ok).toBe(true);

    expect(await objectExists(BUCKETS.uploads, path)).toBe(true);
    const listed = await listObjects(BUCKETS.uploads, prefix);
    expect(listed.map((object) => object.path)).toContain(path);
    expect(listed[0].createdAt).toBeInstanceOf(Date);
    expect((await downloadObject(BUCKETS.uploads, path)).equals(body)).toBe(true);

    await removeObjects(BUCKETS.uploads, [path]);
    expect(await objectExists(BUCKETS.uploads, path)).toBe(false);
  });

  it('lets the bucket reject disallowed types and oversized files', async () => {
    const pdfUrl = await createSignedUploadUrl(BUCKETS.uploads, uploadPath());
    const pdf = await fetch(pdfUrl, {
      method: 'PUT',
      headers: { 'content-type': 'application/pdf' },
      body: Buffer.from('%PDF-1.4'),
    });
    expect(pdf.ok).toBe(false);

    const bigUrl = await createSignedUploadUrl(BUCKETS.uploads, uploadPath());
    const big = await fetch(bigUrl, {
      method: 'PUT',
      headers: { 'content-type': 'image/jpeg' },
      body: Buffer.alloc(10 * 1024 * 1024 + 1),
    });
    expect(big.ok).toBe(false);
  });

  it('serves listing photos from a public URL', async () => {
    const path = `storagetest/${randomUUID()}-thumb.webp`;
    written.push({ bucket: BUCKETS.listingPhotos, path });
    await uploadObject(BUCKETS.listingPhotos, path, Buffer.from('webp bytes'), 'image/webp');
    const response = await fetch(publicObjectUrl(BUCKETS.listingPhotos, path));
    expect(response.status).toBe(200);
  });

  it('reports missing objects as absent', async () => {
    expect(await objectExists(BUCKETS.uploads, uploadPath())).toBe(false);
  });

  it('checks existence for present, missing, and folderless paths', async () => {
    const path = `${randomUUID()}-root.webp`;
    written.push({ bucket: BUCKETS.listingPhotos, path });
    expect(await objectExists(BUCKETS.listingPhotos, path)).toBe(false);
    await uploadObject(BUCKETS.listingPhotos, path, Buffer.from('webp bytes'), 'image/webp');
    expect(await objectExists(BUCKETS.listingPhotos, path)).toBe(true);
  });

  it('lists with a trailing-slash prefix and with an empty prefix', async () => {
    const path = `${prefix}/${randomUUID()}-list.webp`;
    written.push({ bucket: BUCKETS.listingPhotos, path });
    await uploadObject(BUCKETS.listingPhotos, path, Buffer.from('webp bytes'), 'image/webp');
    const listed = await listObjects(BUCKETS.listingPhotos, `${prefix}/`);
    expect(listed.map((object) => object.path)).toContain(path);

    const rootPath = `${randomUUID()}-rootlist.webp`;
    written.push({ bucket: BUCKETS.listingPhotos, path: rootPath });
    await uploadObject(BUCKETS.listingPhotos, rootPath, Buffer.from('webp bytes'), 'image/webp');
    const root = await listObjects(BUCKETS.listingPhotos, '');
    expect(root.map((object) => object.path)).toContain(rootPath);
  });
});
