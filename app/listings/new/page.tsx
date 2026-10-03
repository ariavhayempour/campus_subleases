import type { Metadata } from 'next';
import Link from 'next/link';
import { requireOnboardedUser } from '@/app/_lib/guards';
import { createListingAction } from '@/app/listings/actions';
import { ListingForm } from '@/app/listings/_components/listing-form';
import { MAX_ACTIVE_LISTINGS } from '@/lib/listing-options';
import { getListingFormContext } from '@/server/services/listing-reads';

export const metadata: Metadata = {
  title: 'Post a listing',
  robots: { index: false, follow: false },
};

export default async function NewListingPage() {
  const actor = await requireOnboardedUser();
  const { schools, homeSchoolId, atCap } = await getListingFormContext(actor);
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Post a listing</h1>
      {atCap ? (
        <p className="mt-6 text-muted-foreground">
          You already have {MAX_ACTIVE_LISTINGS} active listings. Mark one as taken or remove it in{' '}
          <Link href="/me/listings" className="underline">
            My listings
          </Link>{' '}
          to post another.
        </p>
      ) : (
        <>
          <p className="mt-2 text-muted-foreground">
            Every listing is reviewed before it appears, usually within 24 hours.
          </p>
          <div className="mt-8">
            <ListingForm
              schools={schools}
              initialPhotos={[]}
              submitLabel="Submit for review"
              submitAction={createListingAction}
              defaultValues={{
                schoolId: homeSchoolId ?? '',
                type: 'apartment',
                title: '',
                description: '',
                availableFrom: '',
                availableTo: '',
                roommatesCount: 0,
                privateBathroom: null,
                genderPreference: 'any',
                address: '',
                unit: '',
                city: '',
                state: '',
                zip: '',
                location: null,
                furnished: false,
                amenities: [],
                photos: [],
              }}
            />
          </div>
        </>
      )}
    </main>
  );
}
