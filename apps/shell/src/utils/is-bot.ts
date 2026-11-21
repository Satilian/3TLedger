export function isBot(userAgent: string | undefined) {
  return !!userAgent && /bot|crawl|spider|slurp|facebook|telegram/i.test(userAgent);
}
