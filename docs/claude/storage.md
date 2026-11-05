# Storage (Supabase)

Only `server/storage/client.ts` imports `@supabase/supabase-js`. It uses
`NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SECRET_KEY` (server only, `storageEnv()` in `lib/env.ts`).
The URL variable is public but is also read server-side here.

## Buckets

| Bucket           | Public | Limit | Types           | Path pattern                              |
| ---------------- | ------ | ----- | --------------- | ----------------------------------------- |
| `uploads`        | no     | 10 MB | JPEG, PNG, WebP | `listings/{userId}/{uuid}.{ext}`          |
| `listing-photos` | yes    | 5 MB  | WebP            | `{listingId}/{uuid}-{thumb,gallery}.webp` |

`uploads` holds raw browser uploads; `listing-photos` holds the processed thumbnail and gallery
images.

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
4. Leftovers (failed deletes, including a deleted user's photos, and abandoned uploads) are
   removed by the daily cleanup cron (see Cleanup).

Photo URLs are public but unguessable. Pages render them with the global
`images: { unoptimized: true }` in `next.config.ts` (photos are pre-sized WebP, so no Vercel image
quota is used).

## Cleanup

`GET /api/cron/cleanup` runs `sweepStaleStorage` (`server/services/storage-cleanup.ts`) once a day.
`vercel.json` schedules it at `0 9 * * *` (UTC; Hobby crons fire at an imprecise time within that
hour). Vercel sends `Authorization: Bearer <CRON_SECRET>`; `isCronAuthorized` (`lib/cron-auth.ts`)
compares it in constant time and the route answers 401 when it does not match or `CRON_SECRET` is
unset.

The sweep only touches objects older than 24 hours (`STALE_AFTER_MS`). That grace period protects
raw uploads the user has not saved yet and processed photos written by a save that has not
committed its `listing_photos` rows yet.

- **Raw uploads:** every object under `uploads/listings/{userId}/` older than 24 hours is removed.
  A successful save deletes its uploads right away, so anything left is abandoned or a failed
  delete.
- **Processed photos:** in each `listing-photos/{listingId}/` folder, stale files are mapped to a
  base path by stripping `-thumb.webp` / `-gallery.webp`. One query per folder checks
  `listing_photos.storage_path` for those bases. Files whose base is unreferenced are removed, as
  are stale files without either suffix. Deleted listings (and so deleted users) lose their rows
  by cascade, so their photos go on the next run.

`removeObjects` deletes in batches of 100 paths. Folders are found with `listFolders`.

`sweepStaleStorage({ now, scope })` takes an optional clock and a `scope` of `userIds` and
`listingIds`. Without a scope it sweeps every folder in both buckets; tests always pass a scope
holding only their own ids, because other test runs share the local buckets.

The route does not catch storage errors: the request fails, Sentry records the error, and the next
day's run retries whatever was left.
