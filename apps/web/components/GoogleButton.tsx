"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch, APIError } from "../lib/api";

type GoogleCredentialResponse = { credential: string };

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: { client_id: string; callback: (response: GoogleCredentialResponse) => void }) => void;
          renderButton: (element: HTMLElement, options: Record<string, string | number>) => void;
        };
      };
    };
  }
}

export default function GoogleButton({ redirect = "/profile" }: { redirect?: string }) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [clientId, setClientId] = useState<string>();
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<{ configured: boolean; client_id: string | null }>("/auth/google/config")
      .then((body) => {
        if (body.configured && body.client_id) setClientId(body.client_id);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!clientId || !buttonRef.current) return;
    let disposed = false;

    const mountButton = () => {
      if (disposed || !window.google || !buttonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          try {
            const body = await apiFetch<{ redirect: string }>("/auth/google", {
              method: "POST",
              body: JSON.stringify({ credential: response.credential, redirect }),
            });
            window.location.assign(body.redirect || redirect);
          } catch (exception) {
            setError(exception instanceof APIError ? exception.message : "Google sign-in failed");
          }
        },
      });
      buttonRef.current.replaceChildren();
      window.google.accounts.id.renderButton(buttonRef.current, { theme: "outline", size: "large", width: 320 });
    };

    if (window.google) {
      mountButton();
    } else {
      const existing = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
      const script = existing || document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.addEventListener("load", mountButton, { once: true });
      if (!existing) document.head.appendChild(script);
    }

    return () => {
      disposed = true;
    };
  }, [clientId, redirect]);

  if (!clientId) return null;
  return <div className="google-auth"><div ref={buttonRef} />{error && <p className="error">{error}</p>}</div>;
}
