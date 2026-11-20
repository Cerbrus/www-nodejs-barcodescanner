# 0015. Sound feedback: a pluggable output, first a buzzer on GPIO 18

- Status: accepted
- Date: 2026-11-12
- Decided by: the owner (feature review)

## Context

A buzzer costs nothing and needs no USB port. GPIO 14 is taken by the fan, so the buzzer goes on GPIO 18. The user had a buzzer.

## Options weighed

- The scanner's own beeper
- A buzzer on a GPIO pin

## Decision

Pluggable output in the hardware agent, `none` by default. First output: a buzzer on a GPIO pin (decided 2026-11-12).

## Consequences

The scanner's own beeper is off the table: Tera answered on 2026-11-16 that the scanner does not support beeps or lights started by the host (USB capture in [scanner-usb-capture.txt](../scanner-usb-capture.txt)). What the buzzer plays is [0017](0017-buzzer-sound-per-event.md), then [0020](0020-sounds-from-building-blocks.md).
