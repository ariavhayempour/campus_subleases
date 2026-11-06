const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_MS = 86_400_000;

export type TermTimeline = {
  // Three four-month blocks (Jan–Apr, May–Aug, Sep–Dec), starting with the axis start's block.
  blocks: { label: string; active: boolean }[];
  months: string[];
  leftPct: number;
  widthPct: number;
  // The stay began before, or runs past, the twelve months the timeline shows.
  startsBefore: boolean;
  continues: boolean;
};

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);

export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

// Places a stay on a twelve-month axis; give every card the same axisStart so ranges compare.
export function termTimeline(
  availableFrom: string,
  availableTo: string,
  axisStart: string = availableFrom,
): TermTimeline {
  const axis = utc(axisStart);
  const startMonth = Math.floor(axis.getUTCMonth() / 4) * 4;
  const start = Date.UTC(axis.getUTCFullYear(), startMonth, 1);
  const end = Date.UTC(axis.getUTCFullYear() + 1, startMonth, 1);
  const span = end - start;
  const from = Math.min(Math.max(utc(availableFrom).getTime(), start), end - DAY_MS);
  const stayEnd = Math.min(Math.max(utc(availableTo).getTime() + DAY_MS, from + DAY_MS), end);
  const leftPct = ((from - start) / span) * 100;
  const widthPct = Math.min(Math.max(((stayEnd - from) / span) * 100, 1.5), 100 - leftPct);
  const months = Array.from({ length: 12 }, (_, i) => MONTHS[(startMonth + i) % 12]);
  const blocks = [0, 1, 2].map((i) => {
    const blockStart = start + (span / 3) * i;
    const blockEnd = start + (span / 3) * (i + 1);
    const year = String(new Date(blockStart + DAY_MS).getUTCFullYear()).slice(2);
    return {
      label: `${months[i * 4]}–${months[i * 4 + 3]} ’${year}`,
      active: from < blockEnd && stayEnd > blockStart,
    };
  });
  return {
    blocks,
    months,
    leftPct,
    widthPct,
    startsBefore: utc(availableFrom).getTime() < start,
    continues: utc(availableTo).getTime() + DAY_MS > end,
  };
}
