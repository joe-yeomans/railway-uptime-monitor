import type { AppConfig } from "../config";
import type { Notifier } from "./types";
import { createDiscordNotifier } from "./discord";
import { createResendNotifier } from "./resend";
import { createSlackNotifier } from "./slack";
import { createTelegramNotifier } from "./telegram";

export function buildNotifiers(config: AppConfig): Notifier[] {
  const notifiers: Notifier[] = [];

  if (config.slackWebhookUrl) {
    notifiers.push(createSlackNotifier(config.slackWebhookUrl));
  }

  if (config.discordWebhookUrl) {
    notifiers.push(createDiscordNotifier(config.discordWebhookUrl));
  }

  if (config.telegram) {
    notifiers.push(
      createTelegramNotifier(config.telegram.botToken, config.telegram.chatId),
    );
  }

  if (config.resend) {
    notifiers.push(
      createResendNotifier(
        config.resend.apiKey,
        config.resend.fromEmail,
        config.resend.toEmail,
      ),
    );
  }

  return notifiers;
}
