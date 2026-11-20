# 0041. Access through the reverse proxy's access list

- Status: superseded by [0042](0042-login-with-google.md)
- Date: 2026-11-12
- Decided by: the owner (feature review)

## Context

Camera scanning needs HTTPS, so Nginx Proxy Manager terminates it.

## Options weighed

Not recorded.

## Decision

Nginx Proxy Manager terminates HTTPS. The login was done by the proxy's access list.

## Consequences

The access list turned out not to guard the site, and a basic-auth prompt is clumsy in a home-screen app. Replaced by [0042](0042-login-with-google.md). Nginx Proxy Manager still terminates HTTPS.
