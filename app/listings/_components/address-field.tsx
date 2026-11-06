'use client';

import dynamic from 'next/dynamic';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { LngLat } from '@/lib/validation/listing';

// The Mapbox web components need `window`, so they load in the browser only.
const AddressAutofill = dynamic(
  () => import('@mapbox/search-js-react').then((mod) => mod.AddressAutofill),
  { ssr: false },
);

export type PickedAddress = {
  address: string;
  city: string;
  state: string;
  zip: string;
  location: LngLat;
};

type AutofillResponse = {
  features: {
    properties: {
      address_line1?: string;
      address_level2?: string;
      address_level1?: string;
      postcode?: string;
    };
    geometry: { coordinates: number[] };
  }[];
};

type AddressFieldProps = {
  inputProps: UseFormRegisterReturn<'address'>;
  invalid: boolean;
  errorId: string;
  onTyped: (value: string) => void;
  onPick: (picked: PickedAddress) => void;
};

export function AddressField({ inputProps, invalid, errorId, onTyped, onPick }: AddressFieldProps) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  function handleRetrieve(response: AutofillResponse) {
    const feature = response.features[0];
    if (!feature) return;
    const [lng, lat] = feature.geometry.coordinates;
    if (lng === undefined || lat === undefined) return;
    const props = feature.properties;
    onPick({
      address: props.address_line1 ?? '',
      city: props.address_level2 ?? '',
      state: props.address_level1 ?? '',
      zip: props.postcode ?? '',
      location: { lng, lat },
    });
  }

  const input = (
    <Input
      id="address"
      autoComplete="address-line1"
      placeholder="Start typing the street address"
      aria-invalid={invalid}
      aria-describedby={invalid ? errorId : undefined}
      {...inputProps}
      onChange={(event) => {
        void inputProps.onChange(event);
        onTyped(event.target.value);
      }}
    />
  );

  return (
    <div className="space-y-2">
      <Label htmlFor="address">Street address</Label>
      {token ? (
        <AddressAutofill
          accessToken={token}
          options={{ country: 'us', language: 'en' }}
          onRetrieve={handleRetrieve}
        >
          {input}
        </AddressAutofill>
      ) : (
        <>
          {input}
          <p className="text-sm text-ink-2">
            Address search is unavailable: the Mapbox token is not configured.
          </p>
        </>
      )}
    </div>
  );
}
