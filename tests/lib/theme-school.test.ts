import { describe, expect, it } from 'vitest';
import { resolveThemeSchool } from '@/lib/theme-school';

const schools = [{ slug: 'umich' }, { slug: 'ucla' }];

describe('resolveThemeSchool', () => {
  it('wears the school in the route, even over the home school', () => {
    expect(resolveThemeSchool('/ucla', schools, 'umich')?.slug).toBe('ucla');
    expect(resolveThemeSchool('/ucla/listings/abc', schools, 'umich')?.slug).toBe('ucla');
  });

  it('wears the home school on routes without a school', () => {
    expect(resolveThemeSchool('/messages/abc', schools, 'umich')?.slug).toBe('umich');
    expect(resolveThemeSchool('/listings/new', schools, 'ucla')?.slug).toBe('ucla');
  });

  it('stays neutral on admin, the school picker, and for visitors without a home school', () => {
    expect(resolveThemeSchool('/admin/listings', schools, 'umich')).toBeNull();
    expect(resolveThemeSchool('/', schools, 'umich')).toBeNull();
    expect(resolveThemeSchool('/about', schools, null)).toBeNull();
  });

  it('ignores a path segment that only starts like a school slug', () => {
    expect(resolveThemeSchool('/umich-old', schools, null)).toBeNull();
  });
});
