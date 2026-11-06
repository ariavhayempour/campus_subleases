'use client';

import { ChevronDown, Search, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AMENITY_LABELS,
  FILTERABLE_AMENITIES,
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

const selectClass =
  'h-10 w-full appearance-none rounded-md border border-line-2 bg-background pr-9 pl-3 text-sm text-ink hover:border-ink-3 focus-visible:border-school focus-visible:ring-3 focus-visible:ring-school/20 focus-visible:outline-none';
const checkClass = 'size-4 accent-school';
const GENDER_OPTIONS = ['women', 'men', 'nonbinary_friendly'] as const;
const BAR_KEYS = ['q', 'sort', 'bounds'];

function Select({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      {children}
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-2"
      />
    </div>
  );
}

// Each amenity counts on its own, so the badge matches what the panel shows as checked.
function detailFilterCount(filters: SearchFilters): number {
  return Object.entries(filters).reduce((count, [key, value]) => {
    if (BAR_KEYS.includes(key) || value === undefined) return count;
    return count + (Array.isArray(value) ? value.length : 1);
  }, 0);
}

type BrowseFiltersProps = { schoolSlug: string; filters: SearchFilters };

// The form remounts for each new search; this carries the focused control's id to that search.
let focusAfterNavigation: { id: string; query: string } | null = null;

export function BrowseFilters({ schoolSlug, filters }: BrowseFiltersProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const currentQuery = toSearchParams(filters).toString();

  useEffect(() => {
    const pending = focusAfterNavigation;
    focusAfterNavigation = null;
    if (pending?.query !== currentQuery) return;
    const control = document.getElementById(pending.id);
    if (control && formRef.current?.contains(control)) control.focus({ preventScroll: true });
  }, [currentQuery]);

  const sorts = SORTS.filter((sort) => sort !== 'relevance' || filters.q);
  const detailCount = detailFilterCount(filters);
  const [detailsOpen, setDetailsOpen] = useState(detailCount > 0);
  const panelId = useId();

  function apply(form: HTMLFormElement) {
    const params = new URLSearchParams();
    for (const [name, value] of new FormData(form)) {
      if (typeof value === 'string') params.append(name, value);
    }
    // An untouched sort is dropped so the default follows the new keyword.
    if (!filters.sort && params.get('sort') === effectiveSort(filters)) params.delete('sort');
    const query = toSearchParams(parseSearchParams(searchParamsToRecord(params))).toString();
    const focused = document.activeElement;
    focusAfterNavigation =
      query !== currentQuery && focused?.id && form.contains(focused)
        ? { id: focused.id, query }
        : null;
    router.push(query ? `/${schoolSlug}?${query}` : `/${schoolSlug}`);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    apply(event.currentTarget);
  }

  return (
    <form ref={formRef} role="search" aria-label="Filter listings" onSubmit={onSubmit}>
      {filters.bounds && <input type="hidden" name="bbox" value={formatBounds(filters.bounds)} />}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-0 flex-[1_1_18rem]">
          <Label htmlFor="q" className="sr-only">
            Keyword
          </Label>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-2"
          />
          <Input
            id="q"
            name="q"
            type="search"
            defaultValue={filters.q ?? ''}
            placeholder="Search a street, building, or keyword"
            className="pl-9"
          />
        </div>
        <div className="flex flex-[1_1_auto] flex-wrap items-center gap-2.5 sm:flex-none">
          <div className="flex min-w-44 flex-1 items-center gap-2">
            <Label htmlFor="sort" className="shrink-0 font-medium text-ink-2">
              Sort by
            </Label>
            <div className="flex-1">
              <Select>
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
              </Select>
            </div>
          </div>
          <button
            type="button"
            aria-expanded={detailsOpen}
            aria-controls={panelId}
            onClick={() => setDetailsOpen((open) => !open)}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-line-2 bg-background px-4 text-sm font-semibold text-ink hover:border-ink-3 aria-expanded:border-school aria-expanded:bg-school-tint"
          >
            <SlidersHorizontal aria-hidden="true" className="size-4" />
            More filters
            {detailCount > 0 && (
              <span className="numeral min-w-5 rounded-full bg-school px-1.5 pt-0.5 text-center text-xs text-on-school">
                <span className="sr-only">, </span>
                {detailCount}
                <span className="sr-only"> active</span>
              </span>
            )}
          </button>
          <Button id="apply-filters" type="submit">
            Apply filters
          </Button>
          {hasActiveFilters(filters) && (
            <Link href={`/${schoolSlug}`} className="text-sm font-semibold text-school-link">
              Clear filters
            </Link>
          )}
        </div>
      </div>
      <div
        id={panelId}
        hidden={!detailsOpen}
        className="mt-3 max-h-[60dvh] overflow-y-auto rounded-md border border-line bg-surface-2 p-4 sm:p-5"
      >
        <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
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
          <div className="space-y-1.5">
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
          <div className="space-y-1.5">
            <Label htmlFor="from">Move in</Label>
            <Input id="from" name="from" type="date" defaultValue={filters.from ?? ''} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to">Move out</Label>
            <Input id="to" name="to" type="date" defaultValue={filters.to ?? ''} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="beds">Bedrooms</Label>
            <Select>
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
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="type">Type</Label>
            <Select>
              <select
                id="type"
                name="type"
                className={selectClass}
                defaultValue={filters.type ?? ''}
              >
                <option value="">Any</option>
                {LISTING_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {LISTING_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="maxRoommates">Max roommates</Label>
            <Select>
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
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gender">Gender preference</Label>
            <Select>
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
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="maxKm">Max distance to campus</Label>
            <Select>
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
            </Select>
          </div>
          <div className="flex flex-col justify-end gap-2.5 text-sm text-ink">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="furnished"
                value="1"
                className={checkClass}
                defaultChecked={filters.furnished === true}
              />
              Furnished
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="privateBath"
                value="1"
                className={checkClass}
                defaultChecked={filters.privateBathroom === true}
              />
              Private bathroom
            </label>
          </div>
          <fieldset className="border-t border-line pt-4 sm:col-span-2 lg:col-span-4">
            <legend className="float-left mb-3 w-full text-[13px] font-semibold text-ink">
              Amenities
            </legend>
            <div className="clear-left grid gap-2.5 text-sm text-ink sm:grid-cols-3 lg:grid-cols-5">
              {FILTERABLE_AMENITIES.map((amenity) => (
                <label key={amenity} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="amenity"
                    value={amenity}
                    className={checkClass}
                    defaultChecked={filters.amenities?.includes(amenity) ?? false}
                  />
                  {AMENITY_LABELS[amenity]}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </div>
    </form>
  );
}
