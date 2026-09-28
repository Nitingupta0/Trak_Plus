"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

import { authPost } from "@/lib/client/api";
import { toast } from "@/components/ui/toast";

interface GoogleIdApi {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string;
        callback: (response: { credential: string }) => void;
        canceled_response?: (response: unknown) => void;
        error_callback?: (response: unknown) => void;
      }) => void;
      renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdApi;
  }
}

/** Google sign-in via ITS `renderButton` (Google-controlled iframe — guaranteed to
 *  function). The container is warm-tinted with a CSS filter so the button reads
 *  as part of the archive palette instead of a stark white pill. */
export function GoogleButton() {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const handleCredential = useCallback(
    async (response: { credential: string }) => {
      try {
        const res = await authPost("google", { credential: response.credential });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail ?? `google sign-in failed (${res.status})`);
        }
        router.push("/library");
        router.refresh();
      } catch (error) {
        toast.add({
          title: "Google sign-in failed",
          description: error instanceof Error ? error.message : "Please try again.",
          type: "error",
        });
      }
    },
    [router],
  );

  const initialize = useCallback(() => {
    if (!clientId || !window.google || !containerRef.current) return;
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleCredential,
      canceled_response: () => {
        // User dismissed — nothing to do.
      },
      error_callback: () => {
        // GIS logs the origin issue to the console; surface a friendly hint.
        toast.add({
          title: "Google sign-in failed",
          description: "Could not open Google sign-in. Check the authorized origins for this client ID.",
          type: "error",
        });
      },
    });
    window.google.accounts.id.renderButton(containerRef.current, {
      theme: "outline",
      size: "large",
      width: 320,
      text: "continue_with",
      shape: "rectangular",
    });
  }, [clientId, handleCredential]);

  useEffect(() => {
    if (window.google) initialize();
  }, [initialize]);

  if (!clientId) return null;

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={initialize}
      />
      {/* Warm archive tint so the Google iframe blends with the page */}
      <div
        ref={containerRef}
        data-testid="google-button"
        className="flex justify-center [filter:sepia(0.25)_saturate(1.4)_hue-rotate(-8deg)_brightness(0.98)]"
      />
    </>
  );
}
