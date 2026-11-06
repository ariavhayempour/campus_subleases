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
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <h1 className="varsity text-[clamp(2.75rem,6vw,4rem)] font-black text-ink">Post a listing</h1>
      {atCap ? (
        <p className="mt-6 max-w-[60ch] rounded-md bg-surface-2 p-5 text-[16px] text-ink-2">
          You already have {MAX_ACTIVE_LISTINGS} active{' '}
          {MAX_ACTIVE_LISTINGS === 1 ? 'listing' : 'listings'}. Mark it as taken or remove it in{' '}
          <Link href="/me/listings" className="font-semibold text-school-link underline">
            My listings
          </Link>{' '}
          to post another.
        </p>
      ) : (
        <>
          <p className="mt-3 text-[16px] text-ink-2">
            Every listing is reviewed before it appears, usually within 24 hours.
          </p>
          <div className="mt-8">
            <ListingForm
              schools={schools}
              initialPhotos={[]}
              submitLabel="Submit for review"
              submitNote="Every listing is reviewed before it appears, usually within 24 hours."
              submitAction={createListingAction}
              lockSchool={!actor.isAdmin}
              defaultValues={{
                schoolId: homeSchoolId ?? '',
                title: '',
                description: '',
                availableFrom: '',
                availableTo: '',
                privateBathroom: null,
                address: '',
                unit: '',
                city: '',
                state: '',
                zip: '',
                location: null,
                furnished: false,
                roomFeatures: [],
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
