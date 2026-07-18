'use client';

import { useEffect, useState } from 'react';
import { fetchJson } from '@/lib/fetchJson';

interface AttachmentResourceResponse {
  url?: string;
}

export default function NtrVideoLink({ initialUrl, attachmentId, label, loadingLabel }: { initialUrl: string | null; attachmentId: string | null; label: string; loadingLabel: string }) {
  const [url, setUrl] = useState(initialUrl);

  useEffect(() => {
    if (!attachmentId) return;
    let active = true;
    void fetchJson<AttachmentResourceResponse>(`/api/attachments/${encodeURIComponent(attachmentId)}`)
      .then((response) => {
        if (active && response.url) setUrl(response.url);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [attachmentId]);

  if (!url) return <span className="text-sm text-gray-400">{loadingLabel}</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-sm text-brand-red hover:underline">
      {label}
    </a>
  );
}
