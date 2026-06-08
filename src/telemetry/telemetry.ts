// Usage telemetry — runs in the main plugin thread (has `fetch`, governed by
// manifest networkAccess). Mirrors the RinScanner telemetry design so both
// plugins report into the SAME ingest server / events.jsonl, distinguished by
// the `product` field.
//
// Design rules:
//   - Fire-and-forget. A failed / blocked / offline report must NEVER affect the
//     plugin's behaviour or surface an error to the user.
//   - Only numeric summaries + identity are sent — never the scanned text, the
//     matched strings, or the replacements.

/** Distinguishes RinType events from RinScanner's in the shared events.jsonl. */
export const PRODUCT = 'rintype';

export interface TelemetryConfig {
  /** Server endpoint, e.g. https://your-host/telemetry. Blank = disabled. */
  url: string;
}

export interface TelemetryIdentity {
  /** Stable per-install id; lets us count installs even when currentUser is null. */
  installId: string;
  /** Figma user id (requires manifest permission "currentuser"). */
  userId: string | null;
  userName: string | null;
}

export interface TelemetryFile {
  fileKey: string | null;
  fileName: string | null;
}

export type TelemetryEvent =
  | {
      event: 'scan';
      /** Number of text nodes scanned (not number of issues). */
      scanned: number;
      /** 'frame' | 'selection'. */
      scope: string;
      found: {
        total: number;
        /** Issue count keyed by ruleId — doubles as a team "common mistakes" list. */
        byRule: Record<string, number>;
      };
    }
  | {
      event: 'fix';
      /** ruleId for a single fix, or 'all' for the fix-all action. */
      fixKind: string;
      /** Number of issues resolved by this action (1 for fix-one). */
      count: number;
    };

export function isTelemetryConfigured(c: TelemetryConfig | null): c is TelemetryConfig {
  return !!c && !!c.url;
}

export interface Telemetry {
  track(ev: TelemetryEvent): void;
}

/**
 * Build a telemetry sender. Config + context are read lazily on each `track`
 * call so they can change at runtime (user / file switch) without re-wiring.
 */
export function createTelemetry(
  getConfig: () => TelemetryConfig,
  getContext: () => { identity: TelemetryIdentity; file: TelemetryFile },
): Telemetry {
  return {
    track(ev: TelemetryEvent): void {
      const config = getConfig();
      if (!isTelemetryConfigured(config)) return;
      const { identity, file } = getContext();
      const payload = {
        ...ev,
        product: PRODUCT,
        ts: Date.now(),
        installId: identity.installId,
        userId: identity.userId,
        userName: identity.userName,
        fileKey: file.fileKey,
        fileName: file.fileName,
      };
      try {
        fetch(config.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(() => {
          /* offline / blocked domain / server down — stay silent */
        });
      } catch {
        // fetch threw synchronously (e.g. malformed URL) — ignore.
      }
    },
  };
}

/** No crypto in the Figma sandbox; a coarse random id is plenty to count installs. */
export function generateInstallId(): string {
  const chunk = () =>
    Math.floor(Math.random() * 0x100000000)
      .toString(16)
      .padStart(8, '0');
  return `i_${chunk()}${chunk()}`;
}
