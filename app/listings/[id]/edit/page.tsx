import type { Metadata } from 'next';
import { orNotFound, requireOnboardedUser } from '@/app/_lib/guards';
import { updateListingAction } from '@/app/listings/actions';
import { ListingForm } from '@/app/listings/_components/listing-form';
import { getListingForEdit, getListingFormContext } from '@/server/services/listing-reads';

export const metadata: Metadata = {
  title: 'Edit listing',
  robots: { index: false, follow: false },
};

type EditListingPageProps = { params: Promise<{ id: string }> };

export default async function EditListingPage({ params }: EditListingPageProps) {
  const actor = await requireOnboardedUser();
  const { id } = await params;
  const [edit, context] = await Promise.all([
    orNotFound(getListingForEdit(actor, id)),
    getListingFormContext(actor),
  ]);
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <h1 className="varsity text-[clamp(2.75rem,6vw,4rem)] font-black text-ink">Edit listing</h1>
      {edit.reviewStatus === 'rejected' ? (
        <p className="mt-4 max-w-[70ch] rounded-md bg-bad-bg p-4 text-sm font-medium text-bad">
          Rejected{edit.reviewNote ? `: ${edit.reviewNote}` : ''}. Saving your changes resubmits it
          for review.
        </p>
      ) : (
        <p className="mt-3 max-w-[70ch] text-[15px] text-ink-2">
          Changing the title, description, rent, address, unit, or gender preference, or adding
          photos, sends the listing back to review.
        </p>
      )}
      <div className="mt-8">
        <ListingForm
          schools={context.schools}
          initialPhotos={edit.photos}
          defaultValues={edit.values}
          submitLabel="Save changes"
          submitNote={
            edit.reviewStatus === 'rejected'
              ? 'Saving your changes resubmits it for review.'
              : 'Some changes send the listing back to review.'
          }
          submitAction={updateListingAction.bind(null, edit.id)}
          lockSchoolAndType
        />
      </div>
    </main>
  );
}
