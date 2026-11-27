export type PublicServiceState =
  | "operational"
  | "degraded"
  | "outage"
  | "maintenance"
  | "unknown";

export type PublicStatusSummary = {
  state: PublicServiceState;
  label: string;
  title: string;
  description: string;
};

export function stateFromProviderIndicator(indicator: string): PublicServiceState {
  switch (indicator) {
    case "none":
      return "operational";
    case "minor":
      return "degraded";
    case "major":
    case "critical":
      return "outage";
    case "maintenance":
      return "maintenance";
    default:
      return "unknown";
  }
}

export function summarisePublicStatus(
  services: ReadonlyArray<{ state: PublicServiceState }>,
  activeIncident = false,
): PublicStatusSummary {
  const states = services.map((service) => service.state);

  if (states.includes("outage")) {
    return {
      state: "outage",
      label: "SERVICE DISRUPTION",
      title: "Some services are unavailable.",
      description: "At least one live service check is failing. The affected component is listed below.",
    };
  }

  if (activeIncident) {
    return {
      state: "degraded",
      label: "ACTIVE INCIDENT",
      title: "We’re investigating a reported issue.",
      description: "The scheduled production monitor has an open alert. Live checks are shown below.",
    };
  }

  if (states.includes("maintenance")) {
    return {
      state: "maintenance",
      label: "PROVIDER MAINTENANCE",
      title: "A provider is undergoing maintenance.",
      description: "A provider used by Snoozer has published a maintenance notice. See the affected service below.",
    };
  }

  if (states.includes("degraded")) {
    return {
      state: "degraded",
      label: "DEGRADED PERFORMANCE",
      title: "Some services are experiencing issues.",
      description: "A monitored provider has reported a service issue. Snoozer may be affected in some areas.",
    };
  }

  if (states.includes("unknown")) {
    return {
      state: "unknown",
      label: "MONITORING PARTIALLY UNAVAILABLE",
      title: "We can’t verify every service right now.",
      description: "One or more monitoring sources did not respond. Unknown services are not marked as operational.",
    };
  }

  return {
    state: "operational",
    label: "ALL SYSTEMS OPERATIONAL",
    title: "Everything is running smoothly.",
    description: "All monitored Snoozer checks are currently reporting normal operation.",
  };
}
