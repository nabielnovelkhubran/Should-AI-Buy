const assert = require('assert');

// Mock fetch global for deterministic testing
let mockFetchCalls = [];
let mockFetchHandler = async (url, opts) => ({ ok: true, status: 200, json: async () => ({}) });

global.fetch = async (url, opts) => {
  mockFetchCalls.push({ url, opts });
  return mockFetchHandler(url, opts);
};

// Import compiled or transpile test
const { WebhookDispatcher } = require('../src/lib/notifications/webhook-dispatcher.ts');

async function runWebhookTests() {
  console.log('Running Suite 53: Outbound Alert Webhook Dispatcher (Discord & Telegram)...');

  // Test 1: Unconfigured defaults
  {
    delete process.env.DISCORD_WEBHOOK_URL;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;

    const dispatcher = new WebhookDispatcher();
    const status = dispatcher.getStatus();
    assert.strictEqual(status.discordConfigured, false, 'Discord should be unconfigured');
    assert.strictEqual(status.telegramConfigured, false, 'Telegram should be unconfigured');

    const result = await dispatcher.dispatch({
      type: 'TEST_ALERT',
      asset: 'BTC',
      title: 'Test Unconfigured',
      description: 'Should resolve gracefully without calling fetch',
      severity: 'INFO',
    });

    assert.strictEqual(result.discordSent, false);
    assert.strictEqual(result.telegramSent, false);
    assert.strictEqual(result.errors.length, 0);
    console.log('  ✓ Test 1 — Unconfigured dispatcher gracefully yields empty dispatch without error');
  }

  // Test 2: Discord configuration detection
  {
    process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/12345/abcdef';
    const dispatcher = new WebhookDispatcher();
    const status = dispatcher.getStatus();
    assert.strictEqual(status.discordConfigured, true, 'Valid Discord webhook URL recognized');
    console.log('  ✓ Test 2 — Discord webhook endpoint correctly recognized and validated');
  }

  // Test 3: Telegram configuration detection
  {
    process.env.TELEGRAM_BOT_TOKEN = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
    process.env.TELEGRAM_CHAT_ID = '-1001234567890';
    const dispatcher = new WebhookDispatcher();
    const status = dispatcher.getStatus();
    assert.strictEqual(status.telegramConfigured, true, 'Valid Telegram bot token + chat ID recognized');
    console.log('  ✓ Test 3 — Telegram credentials correctly recognized and validated');
  }

  // Test 4: Discord payload formation & color mapping
  {
    mockFetchCalls = [];
    process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/test/token';
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;

    const dispatcher = new WebhookDispatcher();
    await dispatcher.dispatch({
      type: 'COUNCIL_VERDICT',
      asset: 'BTC',
      title: 'BUY Verdict: $BTC',
      description: 'Breakout verified with 88% confidence',
      severity: 'SUCCESS',
      metrics: {
        score: 88,
        confidence: 0.88,
        targetPrice: 82500,
        stopPrice: 74200,
        orderId: 'EXEC-BTC-1728000000',
      },
    });

    assert.strictEqual(mockFetchCalls.length, 1, 'Discord fetch called once');
    const call = mockFetchCalls[0];
    assert.strictEqual(call.url, 'https://discord.com/api/webhooks/test/token');
    const body = JSON.parse(call.opts.body);
    assert.strictEqual(body.username, 'Should-AI Buy? Council');
    assert.strictEqual(body.embeds[0].color, 0x00ff84, 'SUCCESS maps to #00ff84 brand green');
    assert.strictEqual(body.embeds[0].title, '[COUNCIL VERDICT] BUY Verdict: $BTC');

    const fields = body.embeds[0].fields;
    assert.ok(fields.some(f => f.name === 'Asset' && f.value === 'BTC'));
    assert.ok(fields.some(f => f.name === 'Target Price' && f.value === '$82,500'));
    assert.ok(fields.some(f => f.name === 'Stop Invalidation' && f.value === '$74,200'));
    assert.ok(fields.some(f => f.name === 'Council Confidence' && f.value === '88%'));
    console.log('  ✓ Test 4 — Discord embed payload correctly formats schema, fields, and 0x00ff84 color');
  }

  // Test 5: Telegram payload formatting & HTML escaping
  {
    mockFetchCalls = [];
    delete process.env.DISCORD_WEBHOOK_URL;
    process.env.TELEGRAM_BOT_TOKEN = 'token123';
    process.env.TELEGRAM_CHAT_ID = 'chat999';

    const dispatcher = new WebhookDispatcher();
    await dispatcher.dispatch({
      type: 'PROTECTIVE_EXIT',
      asset: 'ETH',
      title: 'Protective Exit: $ETH <Caution>',
      description: 'Drawdown exceeded & thesis invalidated',
      severity: 'CRITICAL',
      metrics: {
        score: 32,
        orderId: 'MONITOR-EXIT-ETH-999',
      },
    });

    assert.strictEqual(mockFetchCalls.length, 1, 'Telegram fetch called once');
    const call = mockFetchCalls[0];
    assert.strictEqual(call.url, 'https://api.telegram.org/bottoken123/sendMessage');
    const body = JSON.parse(call.opts.body);
    assert.strictEqual(body.chat_id, 'chat999');
    assert.strictEqual(body.parse_mode, 'HTML');
    assert.ok(body.text.includes('&lt;Caution&gt;'), 'HTML special characters are properly escaped');
    assert.ok(body.text.includes('ETH'), 'Asset correctly included in message body');
    console.log('  ✓ Test 5 — Telegram message correctly applies HTML formatting and entity escaping');
  }

  // Test 6: Network error isolation (non-blocking, zero unhandled rejections)
  {
    mockFetchCalls = [];
    process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/fail/test';
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    mockFetchHandler = async () => {
      throw new Error('ECONNRESET socket hang up');
    };

    const dispatcher = new WebhookDispatcher();
    const result = await dispatcher.dispatch({
      type: 'TEST_ALERT',
      asset: 'SOL',
      title: 'Fault Tolerant Dispatch',
      description: 'Network failure test',
      severity: 'WARNING',
    });

    assert.strictEqual(result.discordSent, false, 'Failed send returns false without throwing');
    assert.strictEqual(result.errors.length, 1);
    assert.ok(result.errors[0].includes('socket hang up'));
    console.log('  ✓ Test 6 — Network failure is fully isolated in errors array without crashing caller');
  }

  console.log('\n========================================');
  console.log('SUITE 53: 6/6 WEBHOOK DISPATCHER TESTS PASSED');
  console.log('========================================\n');
}

runWebhookTests().catch((err) => {
  console.error('Webhook suite failed:', err);
  process.exit(1);
});
