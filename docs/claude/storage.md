# Storage (Supabase)

Only `server/storage/client.ts` imports `@supabase/supabase-js`. It uses
`NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SECRET_KEY` (server only, `storageEnv()` in `lib/env.ts`).
The URL variable is public but is also read server-side here.

## Buckets

| Bucket           | Public | Limit | Types           | Contents                                                              |
| ---------------- | ------ | ----- | --------------- | --------------------------------------------------------------------- |
| `uploads`        | no     | 10 MB | JPEG, PNG, WebP | raw browser uploads at `listings/{userId}/{uuid}.{ext}`               |
| `listing-photos` | yes    | 5 MB  | WebP            | processed photos at `{listingId}/{uuid}-thumb.webp` / `-gallery.webp` |

The buckets enforce size and type (signed upload URLs cannot). Local buckets are declared in
`supabase/config.toml` and seeded by `pnpm db:start` (`supabase seed buckets --local`; see
`testing.md`). Staging and production buckets are created in the dashboard with the same
settings.

## Photo flow

1. `requestPhotoUploads` signs one upload URL per file; the browser PUTs the raw file.
2. On save, `processListingUploads` checks every path is under `listings/{actorId}/` and exists,
   checks the real format with `sharp`, and writes a 640×480 thumbnail and a ≤1600px gallery
   image as WebP. `sharp` drops EXIF (including GPS) by default; `rotate()` applies orientation
   first.
   - **Pixel cap (decompression bombs):** a photo over 40 megapixels (`MAX_PHOTO_PIXELS` in
     `server/services/photos.ts`, width × height from the header) is rejected with "Photos must
     be under 40 megapixels" before decoding. The decoding pipeline is also built with
     `limitInputPixels` set to the same constant. The header read itself disables the limit,
     because sharp would otherwise fail it as an unreadable file and show the wrong message.
3. After the database commit, raw uploads are deleted (and, on edit, removed photos). These
   deletes are best-effort and reported to Sentry; a storage failure never fails a committed
   save. If the save fails, the processed files are deleted instead (the raw uploads stay so the
   user can retry).
4. Leftovers (failed deletes, including a deleted user's photos, and abandoned uploads) are removed by the
   planned daily cleanup cron (plan 6).

Photo URLs are public but unguessable. Pages render them with the global
`images: { unoptimized: true }` in `next.config.ts` (photos are pre-sized WebP, so no Vercel image
quota is used).
