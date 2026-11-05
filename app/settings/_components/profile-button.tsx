'use client';

import { useClerk } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';

export function ProfileButton() {
  const { openUserProfile } = useClerk();
  return (
    <Button type="button" variant="outline" onClick={() => openUserProfile()}>
      Edit profile
    </Button>
  );
}
