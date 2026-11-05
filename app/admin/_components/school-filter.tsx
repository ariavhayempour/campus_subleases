import { Button } from '@/components/ui/button';
import type { ReviewStatus } from '@/lib/listing-options';
import type { SchoolSummary } from '@/server/services/schools';

type SchoolFilterProps = { tab: ReviewStatus; school: string; schools: SchoolSummary[] };

export function SchoolFilter({ tab, school, schools }: SchoolFilterProps) {
  return (
    <form method="get" action="/admin/listings" className="flex items-center gap-2">
      <input type="hidden" name="tab" value={tab} />
      <label htmlFor="school-filter" className="text-sm">
        School
      </label>
      <select
        id="school-filter"
        name="school"
        defaultValue={school}
        className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
      >
        <option value="">All schools</option>
        {schools.map((s) => (
          <option key={s.id} value={s.slug}>
            {s.name}
          </option>
        ))}
      </select>
      <Button type="submit" variant="outline" size="sm">
        Filter
      </Button>
    </form>
  );
}
