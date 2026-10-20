/**
 * Helpers for PC Advisor monthly quota enforcement, reset date formatting,
 * and technical error sanitization.
 */

export interface QuotaCardContent {
  plan: 'FREE' | 'PRO' | 'MAX';
  heading: string;
  message: string;
  supportingText: string;
  ctaText: string | null;
  showCta: boolean;
}

export interface QuotaPayload {
  limit?: number;
  used?: number;
  resetsAt?: string | null;
  plan?: 'FREE' | 'PRO' | 'MAX';
}

/**
 * Formats an ISO reset timestamp (e.g. "2026-11-01T00:00:00.000Z")
 * to a friendly date string like "November 1, 2026".
 * Uses local date format per rolling 30-day window specification.
 */
export function formatQuotaResetDate(resetsAt?: string | null): string | null {
  if (!resetsAt) return null;
  const d = new Date(resetsAt);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Determines whether an error message or code represents a monthly quota exhaustion.
 */
export function isQuotaExceededError(error: any): boolean {
  if (!error) return false;
  if (typeof error === 'object') {
    if (error.quotaExceeded === true) return true;
    if (error.code === 'AI_QUOTA_EXCEEDED' || error.error === 'AI_QUOTA_EXCEEDED') return true;
    if (typeof error.message === 'string' && isQuotaExceededMessage(error.message)) return true;
  }
  if (typeof error === 'string') {
    return isQuotaExceededMessage(error);
  }
  return false;
}

export function isQuotaExceededMessage(message?: string): boolean {
  if (!message) return false;
  return (
    message.includes('AI_QUOTA_EXCEEDED') ||
    message.includes('diagnostic limit') ||
    message.includes('diagnostic limit reached')
  );
}

/**
 * Extracts limit and reset timestamp from raw error text if passed via IPC throw.
 */
export function parseQuotaFromErrorMessage(message: string): { limit?: number; resetsAt?: string } {
  const result: { limit?: number; resetsAt?: string } = {};

  const limitMatch = message.match(/diagnostic limit\s*\((\d+)\s*checks?(?:\/(?:month|30\s*days))?\)/i);
  if (limitMatch && limitMatch[1]) {
    result.limit = parseInt(limitMatch[1], 10);
  }

  const resetMatch = message.match(/Quota resets on\s*([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?Z?)/i);
  if (resetMatch && resetMatch[1]) {
    result.resetsAt = resetMatch[1];
  } else {
    // Fallback: match until space or period
    const genericMatch = message.match(/Quota resets on\s*([^\s.]+)/i);
    if (genericMatch && genericMatch[1]) {
      result.resetsAt = genericMatch[1];
    }
  }

  return result;
}

/**
 * Strips raw IPC error wrappers, stack traces, and internal technical jargon.
 */
export function cleanTechnicalError(message?: string): string {
  if (!message) return 'Unable to reach PC Advisor right now. Check your connection and try again.';

  let cleaned = message.replace(/^Error:\s*Error invoking remote method '[^']+':\s*(Error:\s*)?/i, '').trim();
  cleaned = cleaned.replace(/^Error:\s*/i, '').trim();

  // If the message contains stack frames, axios internals, or IPC artifacts
  if (cleaned.includes('at ') && (cleaned.includes('.js') || cleaned.includes('.ts'))) {
    return 'Unable to reach PC Advisor right now. Check your connection and try again.';
  }
  if (cleaned.toLowerCase().includes('axios') || cleaned.toLowerCase().includes('econnrefused')) {
    return 'Unable to reach PC Advisor right now. Check your connection and try again.';
  }

  return cleaned || 'Unable to reach PC Advisor right now. Check your connection and try again.';
}

/**
 * Builds the exact UI card content for each plan tier according to specifications:
 * - FREE: 1 check/30 days, shows formatted reset date, upgrade to PRO CTA.
 * - PRO: 10 checks/30 days, shows formatted reset date, explore MAX CTA.
 * - MAX: 50 checks/30 days, shows formatted reset date, no upgrade CTA.
 */
export function getQuotaCardContent(
  quota: QuotaPayload,
  fallbackPlan: 'FREE' | 'PRO' | 'MAX' = 'FREE'
): QuotaCardContent {
  // Infer plan from limit first (50 -> MAX, 10 -> PRO, 1 -> FREE), then quota.plan, then fallback
  let plan: 'FREE' | 'PRO' | 'MAX';
  if (quota.limit === 50) {
    plan = 'MAX';
  } else if (quota.limit === 10) {
    plan = 'PRO';
  } else if (quota.limit === 1) {
    plan = 'FREE';
  } else if (quota.plan) {
    plan = quota.plan;
  } else {
    plan = fallbackPlan;
  }

  const formattedDate = formatQuotaResetDate(quota.resetsAt);

  if (plan === 'FREE') {
    return {
      plan: 'FREE',
      heading: 'Monthly limit reached',
      message: "You've used your 1 PC Advisor check for this monthly period.",
      supportingText: formattedDate
        ? `Your next check is available on ${formattedDate}.`
        : 'Your next check is available on your next quota cycle.',
      ctaText: 'Upgrade to PRO',
      showCta: true,
    };
  }

  if (plan === 'PRO') {
    return {
      plan: 'PRO',
      heading: 'Monthly limit reached',
      message: "You've used all 10 PC Advisor checks included in your PRO plan.",
      supportingText: formattedDate
        ? `Your next check is available on ${formattedDate}.`
        : 'Your next check is available on your next quota cycle.',
      ctaText: 'Upgrade to MAX',
      showCta: true,
    };
  }

  // MAX Plan
  return {
    plan: 'MAX',
    heading: 'Monthly limit reached',
    message: "You've used all 50 PC Advisor checks included in your MAX plan.",
    supportingText: formattedDate
      ? `Your next check is available on ${formattedDate}.`
      : 'Your next check is available on your next quota cycle.',
    ctaText: null,
    showCta: false,
  };
}
