'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AMENITIES,
  AMENITY_LABELS,
  GENDER_PREFERENCE_LABELS,
  LISTING_TYPE_LABELS,
  LISTING_TYPES,
} from '@/lib/listing-options';
import {
  BEDROOM_OPTIONS,
  bedroomOptionLabel,
  MAX_DISTANCE_OPTIONS_KM,
  MAX_ROOMMATES_OPTIONS,
  SORT_LABELS,
  SORTS,
} from '@/lib/search-options';
import {
  effectiveSort,
  formatBounds,
  hasActiveFilters,
  parseSearchParams,
  searchParamsToRecord,
  toSearchParams,
  type SearchFilters,
} from '@/lib/validation/search';

const selectClass = 'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm';
const GENDER_OPTIONS = ['women', 'men', 'nonbinary_friendly'] as const;

type BrowseFiltersProps = { schoolSlug: string; filters: SearchFilters };

export function BrowseFilters({ schoolSlug, filters }: BrowseFiltersProps) {
  const router = useRouter();
  const sorts = SORTS.filter((sort) => sort !== 'relevance' || filters.q);
  const showDetails = Object.keys(filters).some((key) => !['q', 'sort', 'bounds'].includes(key));

  function apply(form: HTMLFormElement) {
    const params = new URLSearchParams();
    for (const [name, value] of new FormData(form)) {
      if (typeof value === 'string') params.append(name, value);
    }
    // An untouched sort is dropped so the default follows the new keyword.
    if (!filters.sort && params.get('sort') === effectiveSort(filters)) params.delete('sort');
    const query = toSearchParams(parseSearchParams(searchParamsToRecord(params))).toString();
    router.push(query ? `/${schoolSlug}?${query}` : `/${schoolSlug}`);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    apply(event.currentTarget);
  }

  return (
    <form role="search" aria-label="Filter listings" onSubmit={onSubmit} className="space-y-3">
      {filters.bounds && <input type="hidden" name="bbox" value={formatBounds(filters.bounds)} />}
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1 space-y-1">
          <Label htmlFor="q">Keyword</Label>
          <Input
            id="q"
            name="q"
            type="search"
            defaultValue={filters.q ?? ''}
            placeholder="e.g. balcony, State St"
          />
        </div>
        <div className="w-48 space-y-1">
          <Label htmlFor="sort">Sort by</Label>
          <select
            id="sort"
            name="sort"
            className={selectClass}
            defaultValue={effectiveSort(filters)}
            onChange={(event) => event.currentTarget.form?.requestSubmit()}
          >
            {sorts.map((sort) => (
              <option key={sort} value={sort}>
                {SORT_LABELS[sort]}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit">Apply filters</Button>
        {hasActiveFilters(filters) && (
          <Link href={`/${schoolSlug}`} className="text-sm underline">
            Clear filters
          </Link>
        )}
      </div>
      <details open={showDetails} className="rounded-lg border px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium">More filters</summary>
        <div className="mt-3 grid gap-4 pb-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="rentMin">Min rent ($)</Label>
            <Input
              id="rentMin"
              name="rentMin"
              type="number"
              min={0}
              max={10000}
              step={1}
              defaultValue={filters.rentMin ?? ''}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rentMax">Max rent ($)</Label>
            <Input
              id="rentMax"
              name="rentMax"
              type="number"
              min={0}
              max={10000}
              step={1}
              defaultValue={filters.rentMax ?? ''}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="from">Move in</Label>
            <Input id="from" name="from" type="date" defaultValue={filters.from ?? ''} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="to">Move out</Label>
            <Input id="to" name="to" type="date" defaultValue={filters.to ?? ''} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="beds">Bedrooms</Label>
            <select
              id="beds"
              name="beds"
              className={selectClass}
              defaultValue={filters.bedrooms ?? ''}
            >
              <option value="">Any</option>
              {BEDROOM_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {bedroomOptionLabel(n)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="type">Type</Label>
            <select id="type" name="type" className={selectClass} defaultValue={filters.type ?? ''}>
              <option value="">Any</option>
              {LISTING_TYPES.map((type) => (
                <option key={type} value={type}>
                  {LISTING_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="maxRoommates">Max roommates</Label>
            <select
              id="maxRoommates"
              name="maxRoommates"
              className={selectClass}
              defaultValue={filters.maxRoommates ?? ''}
            >
              <option value="">Any</option>
              {MAX_ROOMMATES_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n === 0 ? 'None' : `Up to ${n}`}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="gender">Gender preference</Label>
            <select
              id="gender"
              name="gender"
              className={selectClass}
              defaultValue={filters.gender ?? ''}
            >
              <option value="">Any</option>
              {GENDER_OPTIONS.map((gender) => (
                <option key={gender} value={gender}>
                  {GENDER_PREFERENCE_LABELS[gender]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="maxKm">Max distance to campus</Label>
            <select
              id="maxKm"
              name="maxKm"
              className={selectClass}
              defaultValue={filters.maxKm ?? ''}
            >
              <option value="">Any</option>
              {MAX_DISTANCE_OPTIONS_KM.map((km) => (
                <option key={km} value={km}>
                  Within {km} km
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col justify-end gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="furnished"
                value="1"
                defaultChecked={filters.furnished === true}
              />
              Furnished
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="privateBath"
                value="1"
                defaultChecked={filters.privateBathroom === true}
              />
              Private bathroom
            </label>
          </div>
          <fieldset className="sm:col-span-2 lg:col-span-4">
            <legend className="text-sm font-medium">Amenities</legend>
            <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3 lg:grid-cols-5">
              {AMENITIES.map((amenity) => (
                <label key={amenity} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="amenity"
                    value={amenity}
                    defaultChecked={filters.amenities?.includes(amenity) ?? false}
                  />
                  {AMENITY_LABELS[amenity]}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </details>
    </form>
  );
}
