# 0016. A small Python hardware agent with evdev

- Status: accepted
- Date: 2026-11-12
- Decided by: the owner (feature review)

## Context

Earlier attempts failed, most likely because the `keyboard` library needs root, scans all input devices and calls `dumpkeys`, which needs a console.

## Options weighed

- The same agent as a host systemd unit (the fallback, not needed)
- A container using `evdev`

## Decision

Small Python hardware agent container using `evdev` with an exclusive grab. Proven on the Pi in milestone 1 (scans, replug and reboot):

- Read only the scanner's device, by its stable path `/dev/input/by-id/<scanner>-event-kbd`.
- Compose: bind-mount `/dev/input` read-only and set `device_cgroup_rules: ['c 13:* rmw']`. This also covers a replugged dongle, which a fixed `devices:` mapping does not. No `privileged`.
- Grab the device exclusively, so scans are not typed into the Pi's login console.
- Reopen the device in a loop when it disappears.

## Consequences

The fallback, running the same agent as a host systemd unit, was not needed.
