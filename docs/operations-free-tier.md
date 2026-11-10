# Free-tier operations

Watch Render instance hours, outbound bandwidth, build minutes, restarts and cold-start latency. Check Supabase database size, MAU, storage and egress. Keep a separate staging project and run user journeys after restores. Record account-specific quotas before opening registrations.

At quota pressure, pause new uploads or registrations by policy once the corresponding controls exist. Preserve access to existing content and verify readiness before reopening. Automated quota alerts, global upload throttling, durable asset cleanup and account export are release gates and remain outstanding. Do not schedule keepalive traffic to avoid service spin-down.

Document encrypted database and object backups separately. Before a release, rehearse restoring both in an isolated project, test Auth and Storage permissions, and record actual restore time and data loss window. No backup/restore drill has been performed.
