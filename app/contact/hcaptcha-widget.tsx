'use client';

import Script from 'next/script';
import { useCallback, useEffect, useRef } from 'react';
import { HCAPTCHA_ONLOAD, HCAPTCHA_SCRIPT_URL, HCAPTCHA_SITEKEY } from '@/lib/contact';

type HCaptchaRenderOptions = {
  sitekey: string;
  callback: (token: string) => void;
  'expired-callback': () => void;
  'error-callback': () => void;
};

declare global {
  interface Window {
    hcaptcha?: {
      render(container: HTMLElement, options: HCaptchaRenderOptions): string;
      reset(widgetId?: string): void;
      remove(widgetId?: string): void;
    };
    [HCAPTCHA_ONLOAD]?: () => void;
  }
}

// hCaptcha is only usable after it calls its onload callback, which happens once per page load.
let hcaptchaReady = false;

type HCaptchaWidgetProps = {
  onToken: (token: string | null) => void;
  resetSignal: number;
};

export function HCaptchaWidget({ onToken, resetSignal }: HCaptchaWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  // A remount starts with a fresh widget, so only later changes to the signal mean "reset".
  const handledResetRef = useRef(resetSignal);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  const renderWidget = useCallback(() => {
    const container = containerRef.current;
    if (!container || !window.hcaptcha || widgetIdRef.current !== null) return;
    widgetIdRef.current = window.hcaptcha.render(container, {
      sitekey: HCAPTCHA_SITEKEY,
      callback: (token) => onTokenRef.current(token),
      'expired-callback': () => onTokenRef.current(null),
      'error-callback': () => onTokenRef.current(null),
    });
  }, []);

  useEffect(() => {
    if (hcaptchaReady) {
      renderWidget();
    } else {
      window[HCAPTCHA_ONLOAD] = () => {
        hcaptchaReady = true;
        renderWidget();
      };
    }
    return () => {
      if (widgetIdRef.current !== null) window.hcaptcha?.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    };
  }, [renderWidget]);

  useEffect(() => {
    if (resetSignal === handledResetRef.current) return;
    handledResetRef.current = resetSignal;
    if (widgetIdRef.current !== null) window.hcaptcha?.reset(widgetIdRef.current);
  }, [resetSignal]);

  return (
    <>
      <Script src={HCAPTCHA_SCRIPT_URL} strategy="afterInteractive" />
      <div ref={containerRef} />
    </>
  );
}
