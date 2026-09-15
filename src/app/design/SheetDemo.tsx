'use client';

import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';

/** Demonstrates the one component with two behaviours: sheet, then panel. */
export function SheetDemo(): ReactNode {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          setOpen(true);
        }}
      >
        Open sheet
      </Button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="দৈনিক লক্ষ্য"
        description="প্রতিদিন কতগুলো নতুন শব্দ ধরবেন, ঠিক করুন।"
        closeLabel="বন্ধ করুন"
        footer={
          <Button
            variant="primary"
            fullWidth
            onClick={() => {
              setOpen(false);
            }}
          >
            সেভ করুন
          </Button>
        }
      >
        <p className="text-pathor text-sm">
          Below 768px this rises from the bottom edge, inside thumb reach. At 768 and above it
          becomes a centred panel. Escape closes it; focus is trapped and returned.
        </p>
      </Sheet>
    </>
  );
}
