import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { storageEnv } from '@/lib/env';

export const BUCKETS = { uploads: 'uploads', listingPhotos: 'listing-photos' } as const;
export type Bucket = (typeof BUCKETS)[keyof typeof BUCKETS];
export type StoredObject = { path: string; createdAt: Date };

let client: SupabaseClient | undefined;

function bucket(name: Bucket) {
  const env = storageEnv();
  client ??= createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client.storage.from(name);
}

function fail(action: string, path: string, cause: unknown): never {
  throw new Error(`Storage ${action} failed for ${path}`, { cause });
}

export async function createSignedUploadUrl(name: Bucket, path: string): Promise<string> {
  const { data, error } = await bucket(name).createSignedUploadUrl(path);
  if (error) fail('sign upload', path, error);
  return data.signedUrl;
}

export async function uploadObject(
  name: Bucket,
  path: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const { error } = await bucket(name).upload(path, body, {
    contentType,
    upsert: false,
    cacheControl: '31536000',
  });
  if (error) fail('upload', path, error);
}

export async function downloadObject(name: Bucket, path: string): Promise<Buffer> {
  const { data, error } = await bucket(name).download(path);
  if (error) fail('download', path, error);
  return Buffer.from(await data.arrayBuffer());
}

const LIST_PAGE_SIZE = 1000;

export async function listObjects(name: Bucket, prefix: string): Promise<StoredObject[]> {
  const folder = prefix.replace(/\/+$/, '');
  const objects: StoredObject[] = [];
  for (let offset = 0; ; offset += LIST_PAGE_SIZE) {
    const { data, error } = await bucket(name).list(folder, {
      limit: LIST_PAGE_SIZE,
      offset,
      sortBy: { column: 'created_at', order: 'desc' },
    });
    if (error) fail('list', folder, error);
    for (const object of data) {
      // Folders come back with a null id and created_at.
      if (object.id === null || object.created_at === null) continue;
      objects.push({
        path: folder ? `${folder}/${object.name}` : object.name,
        createdAt: new Date(object.created_at),
      });
    }
    if (data.length < LIST_PAGE_SIZE) return objects;
  }
}

export async function objectExists(name: Bucket, path: string): Promise<boolean> {
  try {
    // A missing object resolves to data=false; other failures throw.
    const { data } = await bucket(name).exists(path);
    return data;
  } catch (error) {
    return fail('exists', path, error);
  }
}

export async function removeObjects(name: Bucket, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await bucket(name).remove(paths);
  if (error) fail('remove', paths.join(', '), error);
}

export function publicObjectUrl(name: Bucket, path: string): string {
  return bucket(name).getPublicUrl(path).data.publicUrl;
}
