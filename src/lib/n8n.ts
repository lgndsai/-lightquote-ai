import 'server-only';

import { appUrl, n8nEnv } from '@/lib/env';

/**
 * n8n dispatch. Every call is server-side so the shared secret never reaches
 * the browser, and every call is time-boxed so a slow automation host can
 * never hang a rep mid-appointment.
 */

export interface DispatchResult {
  ok: boolean;
  status?: number;
  error?: string;
  body?: unknown;
}

const TIMEOUT_MS = 12_000;

async function post(url: string, payload: Record<string, unknown>): Promise<DispatchResult> {
  if (!url) return { ok: false, error: 'Webhook URL is not configured.' };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(n8nEnv.outboundSecret ? { 'x-lightquote-secret': n8nEnv.outboundSecret } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: 'no-store',
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      return { ok: false, status: response.status, error: `Webhook responded ${response.status}`, body };
    }
    return { ok: true, status: response.status, body };
  } catch (error) {
    const message =
      error instanceof Error && error.name === 'AbortError'
        ? 'The automation workflow did not respond in time.'
        : error instanceof Error
          ? error.message
          : 'Webhook request failed.';
    return { ok: false, error: message };
  } finally {
    clearTimeout(timeout);
  }
}

export interface VisualizationPayload {
  design_id: string;
  quote_id: string;
  company_id: string;
  original_image_url: string;
  marked_image_url: string | null;
  roofline_coordinates: unknown;
  lighting_style: string;
  preset: string | null;
}

export function sendVisualizationRequest(payload: VisualizationPayload) {
  return post(n8nEnv.visualizationUrl, {
    ...payload,
    // Where n8n posts the finished render back to.
    callback_url: `${appUrl}/api/webhooks/n8n/design-complete`,
    callback_secret: n8nEnv.callbackSecret,
  });
}

export function sendDealSold(payload: Record<string, unknown>) {
  return post(n8nEnv.dealSoldUrl, { event: 'deal-sold', ...payload });
}

export function sendDealInstalled(payload: Record<string, unknown>) {
  return post(n8nEnv.dealInstalledUrl, { event: 'deal-installed', ...payload });
}

export const isVisualizationConfigured = () => Boolean(n8nEnv.visualizationUrl);
