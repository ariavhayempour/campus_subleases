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
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Edit listing</h1>
      {edit.reviewStatus === 'rejected' ? (
        <p className="mt-4 rounded-lg border border-destructive/40 p-3 text-sm">
          Rejected{edit.reviewNote ? `: ${edit.reviewNote}` : ''}. Saving your changes resubmits it
          for review.
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
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
          submitAction={updateListingAction.bind(null, edit.id)}
          lockSchoolAndType
        />
      </div>
    </main>
  );
}
