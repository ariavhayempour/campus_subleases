'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useThemeSchool } from '@/app/_components/school-theme';
import { APP_NAME } from '@/lib/app-config';

export function HeaderBrand() {
  const school = useThemeSchool();
  return (
    <Link
      href={school ? `/${school.slug}` : '/'}
      className="flex items-center gap-2.5 text-on-school no-underline"
      aria-label={school ? `${APP_NAME}, ${school.shortName} listings` : `${APP_NAME} home`}
    >
      <span className="varsity text-[1.4rem] font-black tracking-[0.02em] sm:text-2xl">
        {APP_NAME}
      </span>
      {school && (
        <span className="varsity hidden rounded-[2px] bg-highlight px-1.5 pt-[5px] pb-1 text-[13px] font-extrabold tracking-[0.08em] text-on-highlight sm:inline">
          {school.shortName}
        </span>
      )}
    </Link>
  );
}

// School pages end the header with the school stripe; the browse page draws it under its band.
export function HeaderStripe() {
  const pathname = usePathname();
  const school = useThemeSchool();
  if (school && pathname === `/${school.slug}`) return null;
  // On neutral pages the secondary color is white, so this reads as a plain ink-and-white rule.
  return <div aria-hidden="true" className="varsity-stripe h-2 border-b-0" />;
}
