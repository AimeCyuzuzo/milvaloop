import { useMutation } from '@tanstack/react-query';

import { apiFetchBlob } from '../api/api-fetch';

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// The reusable half of every "export this as a file" button in the
// product — whatever feature needs one (contributions today, whatever
// comes after it) just points this at the endpoint that returns the file
// (see ExportService on the backend for how that file gets built). Fetches
// it through the same auth/refresh path as every other API call, then
// saves it under the name the backend gave it via Content-Disposition —
// call sites never construct a filename themselves.
export function useDownloadExport() {
  return useMutation({
    mutationFn: async (path: string) => {
      const { blob, filename } = await apiFetchBlob(path);
      saveBlob(blob, filename);
    },
  });
}
