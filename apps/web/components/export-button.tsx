'use client';

import { Download } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@milvaloop/ui/button';

import { getErrorMessage } from '@/lib/api/api-fetch';
import { useDownloadExport } from '@/lib/export/use-download-export';

interface ExportButtonProps {
  /** The endpoint that returns the file — see ExportService/StreamableFile on the backend. */
  path: string;
  label: string;
}

// The one button every feature's "export this as a spreadsheet" action
// renders — wraps useDownloadExport's fetch-then-save with the same
// pending/error feedback every other action in the product gives (see
// DESIGN.md's "no dead ends": a click always gets a visible outcome).
export function ExportButton({ path, label }: ExportButtonProps) {
  const download = useDownloadExport();

  async function handleClick() {
    try {
      await download.mutateAsync(path);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={download.isPending}>
      <Download />
      {download.isPending ? 'Exporting…' : label}
    </Button>
  );
}
