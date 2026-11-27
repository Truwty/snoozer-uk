import { checkServiceReadiness } from "@/lib/health/readiness";
import { providerStatuses } from "@/lib/owner/provider-status";
import { recentProductionIncidents } from "@/lib/public-incidents";
import {
  stateFromProviderIndicator,
  summarisePublicStatus,
  type PublicServiceState,
  type PublicStatusSummary,
} from "@/lib/public-status";

export type PublicStatusService = {
  id: string;
  name: string;
  icon: string;
  state: PublicServiceState;
  description: string;
  sourceUrl?: string;
  sourceLabel?: string;
};

export type PublicStatusSnapshot = {
  checkedAt: string;
  summary: PublicStatusSummary;
  services: PublicStatusService[];
  incidentFeed: Awaited<ReturnType<typeof recentProductionIncidents>>;
};

export async function getPublicStatusSnapshot(): Promise<PublicStatusSnapshot> {
  const [ready, providers, incidentFeed] = await Promise.all([
    checkServiceReadiness(),
    providerStatuses(),
    recentProductionIncidents(),
  ]);

  const services: PublicStatusService[] = [
    {
      id: "website",
      name: "Snoozer website",
      icon: "⌂",
      state: "operational",
      description: "This page is being served successfully by the Snoozer application.",
    },
    {
      id: "database-storage",
      name: "Database & media storage",
      icon: "▤",
      state: ready ? "operational" : "outage",
      description: ready
        ? "Live checks for the database and required private storage buckets are passing."
        : "The database or a required private storage bucket did not pass its live readiness check.",
    },
    ...providers.map((provider): PublicStatusService => ({
      id: provider.provider.toLowerCase(),
      name: provider.provider === "Render"
        ? "Render hosting platform"
        : provider.provider === "Supabase"
          ? "Supabase platform"
          : "Stripe payments platform",
      icon: provider.provider === "Render" ? "◈" : provider.provider === "Supabase" ? "▦" : "◇",
      state: stateFromProviderIndicator(provider.indicator),
      description: provider.indicator === "unknown"
        ? "The provider’s published status feed could not be reached."
        : provider.description,
      sourceUrl: provider.url,
      sourceLabel: provider.provider + " status",
    })),
  ];

  const activeIncident = incidentFeed.incidents.some((incident) => incident.state === "investigating");
  return {
    checkedAt: new Date().toISOString(),
    summary: summarisePublicStatus(services, activeIncident),
    services,
    incidentFeed,
  };
}
