'use client';

import { useEffect, useRef, useState } from 'react';
import { createImageItem } from '@/components/shared/image/types';
import { createMqrAttachmentResourceProvider } from '../utils/mqrAttachmentResourceProvider';

interface MqrVideoLinkProps {
  initialUrl: string | null;
  attachmentId: string | null;
  label: string;
  loadingLabel: string;
  embed?: boolean;
  openLabel?: string;
}

/** Uses the shared attachment resource provider for MQR video URL refresh.
 * Video remains a link/iframe concern; no image viewer is applied. */
export default function MqrVideoLink({ initialUrl, attachmentId, label, loadingLabel, embed = false, openLabel = label }: MqrVideoLinkProps) {
  const [url, setUrl] = useState(initialUrl);
  const item = createImageItem({
    id: `mqr-video-${attachmentId ?? 'legacy'}`,
    attachmentId,
    displayUrl: initialUrl,
    sourceKind: attachmentId ? 'signed' : 'cdn',
    filename: label,
    mimeType: 'video/*',
    alt: label,
  });
  const provider = useRef(createMqrAttachmentResourceProvider(attachmentId ? [item] : [])).current;

  useEffect(() => {
    if (!attachmentId) return;
    let active = true;
    void provider.get(attachmentId)
      .then((resolved) => {
        if (active && resolved.displayUrl) setUrl(resolved.displayUrl);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [attachmentId, provider]);

  if (!url) return <span className="text-sm text-gray-400">{loadingLabel}</span>;
  return embed ? (
    <>
      <iframe
        src={url.replace('/view', '/preview')}
        className="w-full aspect-video rounded border border-gray-200"
        allow="autoplay; fullscreen"
        allowFullScreen
        title={label}
      />
      <a href={url} target="_blank" rel="noreferrer" className="inline-block text-xs text-brand-red hover:underline mt-1">
        {openLabel}
      </a>
    </>
  ) : (
    <a href={url} target="_blank" rel="noreferrer" className="text-sm text-brand-red hover:underline">
      {label}
    </a>
  );
}
