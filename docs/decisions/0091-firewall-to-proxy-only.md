# 0091. The app's port is closed to everything but the reverse proxy

- Status: accepted
- Date: not recorded (found afterwards, 2026-11-20)
- Decided by: not recorded
- Found afterwards: yes

## Context

Found afterwards: this choice was made but never written down. Source: `docs/deployment.md`, `deployment/firewall.sh`.

## Options weighed

Not recorded.

## Decision

`ALLOWED_SOURCE` in `.env` names the proxy's address; `deployment/firewall.sh` drops every other source for the app's port, at boot and with every run of the updater, so a lost rule comes back.

## Consequences

Without it anything on the LAN can reach the port around the proxy. Requests made on the Pi itself keep working.
