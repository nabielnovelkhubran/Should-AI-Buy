/**
 * Outbound Webhook Dispatcher
 * Dispatches real-time structured alerts to Discord and Telegram channels.
 * 
 * Invariants:
 * - Completely non-blocking (async fire-and-forget; never stalls council or order pipelines).
 * - Strict timeout (4000ms) with AbortController.
 * - Zero credential leakage in logs or thrown errors.
 */

export interface WebhookAlertEvent {
  type: 'COUNCIL_VERDICT' | 'THESIS_INVALIDATED' | 'PROTECTIVE_EXIT' | 'DISCOVERY_CANDIDATE' | 'TEST_ALERT';
  asset: string;
  title: string;
  description: string;
  severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL';
  metrics?: {
    targetPrice?: number;
    stopPrice?: number;
    confidence?: number;
    score?: number;
    riskScore?: number;
    quantity?: number;
    unrealizedPnl?: number;
    orderId?: string;
  };
  tags?: string[];
  timestamp?: string;
}

export interface WebhookConfigStatus {
  discordConfigured: boolean;
  telegramConfigured: boolean;
}

export class WebhookDispatcher {
  private discordUrl: string | null;
  private telegramToken: string | null;
  private telegramChatId: string | null;

  constructor() {
    this.discordUrl = process.env.DISCORD_WEBHOOK_URL || null;
    this.telegramToken = process.env.TELEGRAM_BOT_TOKEN || null;
    this.telegramChatId = process.env.TELEGRAM_CHAT_ID || null;
  }

  public getStatus(): WebhookConfigStatus {
    return {
      discordConfigured: Boolean(this.discordUrl && this.discordUrl.startsWith('https://discord.com/api/webhooks/')),
      telegramConfigured: Boolean(this.telegramToken && this.telegramChatId),
    };
  }

  /**
   * Dispatch an alert event to all configured endpoints.
   * Execution is fire-and-forget and does not block the caller.
   */
  public async dispatch(
    event: WebhookAlertEvent,
    overrides?: {
      discordUrl?: string;
      telegramToken?: string;
      telegramChatId?: string;
    }
  ): Promise<{
    discordSent: boolean;
    telegramSent: boolean;
    errors: string[];
  }> {
    const results = {
      discordSent: false,
      telegramSent: false,
      errors: [] as string[],
    };

    const targetDiscordUrl = overrides?.discordUrl || this.discordUrl;
    const targetTgToken = overrides?.telegramToken || this.telegramToken;
    const targetTgChatId = overrides?.telegramChatId || this.telegramChatId;

    const tasks: Promise<void>[] = [];

    // Discord Dispatcher
    if (targetDiscordUrl) {
      tasks.push(
        this.sendDiscord(event, targetDiscordUrl)
          .then(() => {
            results.discordSent = true;
          })
          .catch((err) => {
            results.errors.push(`Discord: ${err.message}`);
          })
      );
    }

    // Telegram Dispatcher
    if (targetTgToken && targetTgChatId) {
      tasks.push(
        this.sendTelegram(event, targetTgToken, targetTgChatId)
          .then(() => {
            results.telegramSent = true;
          })
          .catch((err) => {
            results.errors.push(`Telegram: ${err.message}`);
          })
      );
    }

    if (tasks.length === 0) {
      return results;
    }

    await Promise.allSettled(tasks);
    return results;
  }

  private async sendDiscord(event: WebhookAlertEvent, webhookUrl: string): Promise<void> {
    if (!webhookUrl) return;

    // Severity to Decimal Hex Color
    const colorMap: Record<WebhookAlertEvent['severity'], number> = {
      SUCCESS: 0x00ff84, // Brand Green
      CRITICAL: 0xff3b5c, // Sell / Alert Red
      WARNING: 0xf59e0b,  // Amber
      INFO: 0x38bdf8,     // Sky Blue
    };

    const fields: Array<{ name: string; value: string; inline?: boolean }> = [
      { name: 'Asset', value: event.asset.toUpperCase(), inline: true },
      { name: 'Severity', value: event.severity, inline: true },
    ];

    if (event.metrics?.targetPrice) {
      fields.push({ name: 'Target Price', value: `$${event.metrics.targetPrice.toLocaleString('en-US')}`, inline: true });
    }
    if (event.metrics?.stopPrice) {
      fields.push({ name: 'Stop Invalidation', value: `$${event.metrics.stopPrice.toLocaleString('en-US')}`, inline: true });
    }
    if (typeof event.metrics?.confidence === 'number') {
      fields.push({ name: 'Council Confidence', value: `${(event.metrics.confidence * 100).toFixed(0)}%`, inline: true });
    }
    if (typeof event.metrics?.score === 'number') {
      fields.push({ name: 'Thesis Score', value: `${event.metrics.score}/100`, inline: true });
    }
    if (typeof event.metrics?.quantity === 'number') {
      fields.push({ name: 'Quantity', value: `${event.metrics.quantity} units`, inline: true });
    }
    if (event.metrics?.orderId) {
      fields.push({ name: 'Paper Order ID', value: `\`${event.metrics.orderId.substring(0, 16)}...\``, inline: false });
    }

    const payload = {
      username: 'Should-AI Buy? Council',
      avatar_url: 'https://raw.githubusercontent.com/nabielnovelkhubran/Should-AI-Buy/main/public/logo.png',
      embeds: [
        {
          title: `[${event.type.replace(/_/g, ' ')}] ${event.title}`,
          description: event.description,
          color: colorMap[event.severity] || 0x38bdf8,
          fields,
          footer: {
            text: 'Should-AI Buy? · Alpaca Autonomous Council',
          },
          timestamp: event.timestamp || new Date().toISOString(),
        },
      ],
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Discord HTTP ${res.status}`);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  private async sendTelegram(event: WebhookAlertEvent, botToken: string, chatId: string): Promise<void> {
    if (!botToken || !chatId) return;

    let text = `<b>[SHOULD-AI BUY · ${event.type.replace(/_/g, ' ')}]</b>\n`;
    text += `<b>${escapeHtml(event.title)}</b>\n\n`;
    text += `${escapeHtml(event.description)}\n\n`;
    text += `<b>Asset:</b> $${event.asset.toUpperCase()}\n`;

    if (event.metrics?.targetPrice) {
      text += `<b>Target:</b> $${event.metrics.targetPrice.toLocaleString('en-US')}\n`;
    }
    if (event.metrics?.stopPrice) {
      text += `<b>Stop:</b> $${event.metrics.stopPrice.toLocaleString('en-US')}\n`;
    }
    if (typeof event.metrics?.confidence === 'number') {
      text += `<b>Confidence:</b> ${(event.metrics.confidence * 100).toFixed(0)}%\n`;
    }
    if (typeof event.metrics?.score === 'number') {
      text += `<b>Score:</b> ${event.metrics.score}/100\n`;
    }
    if (event.metrics?.orderId) {
      text += `<b>Order ID:</b> <code>${event.metrics.orderId.substring(0, 16)}...</code>\n`;
    }

    text += `\n<i>Environment: Alpaca Paper Trading v2</i>`;

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Telegram HTTP ${res.status}`);
      }
    } finally {
      clearTimeout(timeout);
    }
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export const webhookDispatcher = new WebhookDispatcher();
