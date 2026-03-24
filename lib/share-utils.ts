import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import CryptoJS from "crypto-js";

import type { Highlight } from "./highlight-utils";

export interface SharePayload {
  content: string;
  highlights?: Highlight[];
  expires: number | null;
}

export type TTLOption = "none" | "1h" | "24h" | "7d" | "30d";

export function getTTLMilliseconds(ttl: TTLOption): number | null {
  switch (ttl) {
    case "1h":
      return 60 * 60 * 1000;
    case "24h":
      return 24 * 60 * 60 * 1000;
    case "7d":
      return 7 * 24 * 60 * 60 * 1000;
    case "30d":
      return 30 * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
}

export function createShareLink(
  content: string,
  password: string | null,
  ttl: TTLOption,
  highlights?: Highlight[]
): string {
  const ttlMs = getTTLMilliseconds(ttl);
  const expires = ttlMs ? Date.now() + ttlMs : null;

  const payload: SharePayload = {
    content,
    expires,
  };

  // Include highlights if provided
  if (highlights && highlights.length > 0) {
    payload.highlights = highlights;
  }

  const payloadJson = JSON.stringify(payload);

  let data: string;
  let isProtected = false;

  if (password && password.trim()) {
    // Encrypt with AES
    const encrypted = CryptoJS.AES.encrypt(payloadJson, password.trim()).toString();
    data = compressToEncodedURIComponent(encrypted);
    isProtected = true;
  } else {
    // No password, just compress
    data = compressToEncodedURIComponent(payloadJson);
  }

  const baseUrl = `${window.location.origin}${window.location.pathname}`;
  const hash = isProtected ? `#doc=${data}&p=1` : `#doc=${data}`;
  return `${baseUrl}${hash}`;
}

export interface DecodeResult {
  success: boolean;
  payload?: SharePayload;
  error?: "expired" | "wrong-password" | "invalid-data";
}

export function decodeShareLink(
  encodedData: string,
  isProtected: boolean,
  password?: string
): DecodeResult {
  try {
    const decompressed = decompressFromEncodedURIComponent(encodedData);
    if (!decompressed) {
      return { success: false, error: "invalid-data" };
    }

    let payloadJson: string;

    if (isProtected) {
      if (!password) {
        // Password required but not provided
        return { success: false, error: "wrong-password" };
      }

      try {
        const decrypted = CryptoJS.AES.decrypt(decompressed, password.trim());
        payloadJson = decrypted.toString(CryptoJS.enc.Utf8);
        
        if (!payloadJson) {
          // Wrong password
          return { success: false, error: "wrong-password" };
        }
      } catch {
        return { success: false, error: "wrong-password" };
      }
    } else {
      payloadJson = decompressed;
    }

    const payload: SharePayload = JSON.parse(payloadJson);

    // Check expiry
    if (payload.expires && Date.now() > payload.expires) {
      return { success: false, error: "expired" };
    }

    return { success: true, payload };
  } catch (err) {
    console.error("Decode error:", err);
    return { success: false, error: "invalid-data" };
  }
}
