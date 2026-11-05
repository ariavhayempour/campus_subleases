import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import type { ActionResult } from '@/app/_lib/action-result';

type RefreshAfter = (
  action: () => Promise<ActionResult<unknown>>,
) => Promise<ActionResult<unknown>>;

export function useRefreshAfter(): RefreshAfter {
  const router = useRouter();
  return useCallback(
    async (action) => {
      const result = await action();
      if (result.ok) router.refresh();
      return result;
    },
    [router],
  );
}
