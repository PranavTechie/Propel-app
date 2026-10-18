const assert = require('assert');

// Test suite for PC Advisor Quota and Error handling
function formatQuotaResetDate(resetsAt) {
  if (!resetsAt) return null;
  const d = new Date(resetsAt);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function isQuotaExceededError(error) {
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

function isQuotaExceededMessage(message) {
  if (!message) return false;
  return (
    message.includes('AI_QUOTA_EXCEEDED') ||
    message.includes('monthly diagnostic limit') ||
    message.includes('diagnostic limit reached')
  );
}

function parseQuotaFromErrorMessage(message) {
  const result = {};

  const limitMatch = message.match(/monthly diagnostic limit\s*\((\d+)\s*checks?\/month\)/i);
  if (limitMatch && limitMatch[1]) {
    result.limit = parseInt(limitMatch[1], 10);
  }

  const resetMatch = message.match(/Quota resets on\s*([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?Z?)/i);
  if (resetMatch && resetMatch[1]) {
    result.resetsAt = resetMatch[1];
  } else {
    const genericMatch = message.match(/Quota resets on\s*([^\s.]+)/i);
    if (genericMatch && genericMatch[1]) {
      result.resetsAt = genericMatch[1];
    }
  }

  return result;
}

function cleanTechnicalError(message) {
  if (!message) return 'Unable to reach PC Advisor right now. Check your connection and try again.';

  let cleaned = message.replace(/^Error:\s*Error invoking remote method '[^']+':\s*(Error:\s*)?/i, '').trim();
  cleaned = cleaned.replace(/^Error:\s*/i, '').trim();

  if (cleaned.includes('at ') && (cleaned.includes('.js') || cleaned.includes('.ts'))) {
    return 'Unable to reach PC Advisor right now. Check your connection and try again.';
  }
  if (cleaned.toLowerCase().includes('axios') || cleaned.toLowerCase().includes('econnrefused')) {
    return 'Unable to reach PC Advisor right now. Check your connection and try again.';
  }

  return cleaned || 'Unable to reach PC Advisor right now. Check your connection and try again.';
}

function getQuotaCardContent(quota, fallbackPlan = 'FREE') {
  let plan;
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
      heading: 'Monthly Check Used',
      message: "You've used your 1 free PC Advisor check for this month.",
      supportingText: formattedDate
        ? `Your next check will be available on ${formattedDate}.`
        : 'Your next check will be available at the start of next month.',
      ctaText: 'Upgrade to PRO for 10 checks/month',
      showCta: true,
    };
  }

  if (plan === 'PRO') {
    return {
      plan: 'PRO',
      heading: 'Monthly Limit Reached',
      message: "You've used all 10 PC Advisor checks included in your PRO plan.",
      supportingText: 'Your checks reset at the start of next month.',
      ctaText: 'Explore MAX — 50 checks/month',
      showCta: true,
    };
  }

  return {
    plan: 'MAX',
    heading: 'Monthly Limit Reached',
    message: "You've used all 50 PC Advisor checks included in your MAX plan.",
    supportingText: 'Your checks reset at the start of next month.',
    ctaText: null,
    showCta: false,
  };
}

console.log('--- RUNNING PC ADVISOR QUOTA & ERROR HANDLING TESTS ---');

// 1. Test FREE quota exhausted (1/1)
{
  const quota = {
    limit: 1,
    used: 1,
    resetsAt: '2026-11-01T00:00:00.000Z',
    plan: 'FREE',
  };
  const card = getQuotaCardContent(quota, 'FREE');
  assert.strictEqual(card.plan, 'FREE');
  assert.strictEqual(card.heading, 'Monthly Check Used');
  assert.strictEqual(card.message, "You've used your 1 free PC Advisor check for this month.");
  assert.strictEqual(card.supportingText, 'Your next check will be available on November 1, 2026.');
  assert.strictEqual(card.ctaText, 'Upgrade to PRO for 10 checks/month');
  assert.strictEqual(card.showCta, true);
  console.log('[PASS] 1. FREE quota exhausted (1/1) displays exact heading, message, reset date & CTA');
}

// 2. Test PRO quota exhausted (10/10)
{
  const quota = {
    limit: 10,
    used: 10,
    resetsAt: '2026-11-01T00:00:00.000Z',
    plan: 'PRO',
  };
  const card = getQuotaCardContent(quota, 'PRO');
  assert.strictEqual(card.plan, 'PRO');
  assert.strictEqual(card.heading, 'Monthly Limit Reached');
  assert.strictEqual(card.message, "You've used all 10 PC Advisor checks included in your PRO plan.");
  assert.strictEqual(card.supportingText, 'Your checks reset at the start of next month.');
  assert.strictEqual(card.ctaText, 'Explore MAX — 50 checks/month');
  assert.strictEqual(card.showCta, true);
  console.log('[PASS] 2. PRO quota exhausted (10/10) displays exact heading, message, supporting text & CTA');
}

// 3. Test MAX quota exhausted (50/50)
{
  const quota = {
    limit: 50,
    used: 50,
    resetsAt: '2026-11-01T00:00:00.000Z',
    plan: 'MAX',
  };
  const card = getQuotaCardContent(quota, 'MAX');
  assert.strictEqual(card.plan, 'MAX');
  assert.strictEqual(card.heading, 'Monthly Limit Reached');
  assert.strictEqual(card.message, "You've used all 50 PC Advisor checks included in your MAX plan.");
  assert.strictEqual(card.supportingText, 'Your checks reset at the start of next month.');
  assert.strictEqual(card.ctaText, null);
  assert.strictEqual(card.showCta, false);
  console.log('[PASS] 3. MAX quota exhausted (50/50) displays exact heading, message, supporting text and NO CTA');
}

// 4. Test defensive fallback parser for legacy thrown IPC string
{
  const rawIpcError = "Error invoking remote method 'ai:get-pc-advisor-diagnosis': Error: You have reached your monthly diagnostic limit (1 check/month). Quota resets on 2026-11-01T00:00:00.000Z.";
  assert.strictEqual(isQuotaExceededError(rawIpcError), true);
  const parsed = parseQuotaFromErrorMessage(rawIpcError);
  assert.strictEqual(parsed.limit, 1);
  assert.strictEqual(parsed.resetsAt, '2026-11-01T00:00:00.000Z');
  const card = getQuotaCardContent(parsed, 'FREE');
  assert.strictEqual(card.heading, 'Monthly Check Used');
  assert.strictEqual(card.supportingText, 'Your next check will be available on November 1, 2026.');
  console.log('[PASS] 4. Defensive parser correctly extracts limit and resetsAt from raw IPC error string');
}

// 5. Test genuine network/server error handling (sanitization and retryability)
{
  const rawTechnicalError = "Error invoking remote method 'ai:get-pc-advisor-diagnosis': Error: connect ECONNREFUSED 127.0.0.1:5000\n    at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1606:16)";
  assert.strictEqual(isQuotaExceededError(rawTechnicalError), false);
  const cleaned = cleanTechnicalError(rawTechnicalError);
  assert.strictEqual(cleaned, 'Unable to reach PC Advisor right now. Check your connection and try again.');
  assert.doesNotMatch(cleaned, /Error invoking remote method/);
  assert.doesNotMatch(cleaned, /ECONNREFUSED/);
  assert.doesNotMatch(cleaned, /at TCPConnectWrap/);
  console.log('[PASS] 5. Technical network error is cleanly sanitized with no IPC/stack trace exposure');
}

// 6. Test missing resetsAt reporting behavior
{
  const quotaWithoutReset = { limit: 1, used: 1, resetsAt: null };
  const card = getQuotaCardContent(quotaWithoutReset, 'FREE');
  assert.strictEqual(card.supportingText, 'Your next check will be available at the start of next month.');
  console.log('[PASS] 6. Missing reset timestamp safely falls back to standard next month text without inventing dates');
}

console.log('--- ALL PC ADVISOR QUOTA & ERROR HANDLING TESTS PASSED! ---');
