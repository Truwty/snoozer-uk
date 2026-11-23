import { discordPresencePublic, type DiscordPresencePublic } from "@/lib/discord-presence";

export const DISCORD_PRESENCE_POLL_INTERVAL_MS = 8_000;

export type DiscordPresencePollerOptions = {
  username: string;
  onPresence: (presence: DiscordPresencePublic) => void;
  onUnavailable: () => void;
  onDisabled: () => void;
  fetcher?: typeof fetch;
  intervalMs?: number;
  isVisible?: () => boolean;
};

export function createDiscordPresencePoller(options: DiscordPresencePollerOptions) {
  const fetcher = options.fetcher ?? fetch;
  const isVisible = options.isVisible ?? (() => true);
  const intervalMs = options.intervalMs ?? DISCORD_PRESENCE_POLL_INTERVAL_MS;
  let active = false;
  let stopped = false;
  let inFlight = false;
  let refreshRequested = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let requestController: AbortController | null = null;

  const schedule = () => {
    if (!active || stopped || timer !== null || !isVisible()) return;
    timer = setTimeout(() => {
      timer = null;
      void refresh();
    }, intervalMs);
  };

  const refresh = async (): Promise<void> => {
    if (!active || stopped || !isVisible()) return;
    if (inFlight) {
      refreshRequested = true;
      return;
    }

    inFlight = true;
    const controller = new AbortController();
    requestController = controller;
    try {
      const response = await fetcher(
        `/api/v1/discord/presence?username=${encodeURIComponent(options.username)}`,
        {
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        },
      );
      if (!active || controller.signal.aborted) return;
      if (response.status === 404) {
        stopped = true;
        options.onDisabled();
        return;
      }
      if (!response.ok) {
        options.onUnavailable();
        return;
      }

      const parsed = discordPresencePublic.safeParse(await response.json());
      if (!active || controller.signal.aborted) return;
      if (parsed.success) options.onPresence(parsed.data);
      else options.onUnavailable();
    } catch {
      if (active && !controller.signal.aborted) options.onUnavailable();
    } finally {
      inFlight = false;
      if (requestController === controller) requestController = null;
      if (active && !stopped) {
        if (refreshRequested && isVisible()) {
          refreshRequested = false;
          void refresh();
        } else {
          schedule();
        }
      }
    }
  };

  return {
    start(): Promise<void> {
      if (active || stopped) return Promise.resolve();
      active = true;
      return refresh();
    },
    refreshNow(): Promise<void> {
      if (!active || stopped) return Promise.resolve();
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      return refresh();
    },
    stop(): void {
      active = false;
      stopped = true;
      refreshRequested = false;
      if (timer !== null) clearTimeout(timer);
      timer = null;
      requestController?.abort();
      requestController = null;
    },
  };
}
