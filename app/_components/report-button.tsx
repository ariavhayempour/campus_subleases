'use client';

import { useState } from 'react';
import { ReportDialog } from '@/app/_components/report-dialog';
import { Button } from '@/components/ui/button';
import type { ReportTargetType } from '@/lib/moderation-options';

type ReportButtonProps = {
  targetType: ReportTargetType;
  targetId: string;
  label: string;
  title: string;
  className?: string;
};

export function ReportButton({ targetType, targetId, label, title, className }: ReportButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={className}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      <ReportDialog
        open={open}
        onClose={() => setOpen(false)}
        targetType={targetType}
        targetId={targetId}
        title={title}
      />
    </>
  );
}
