# Plan: scanner sounds from building blocks (milestone 14)

Asked for by the owner on 2026-11-15. A sound is a short sequence of blocks, edited in a popup on the sounds page, named, and reused as a preset for any event.

## Decisions

1. **For the active buzzer.** It has one fixed pitch, so blocks vary time and texture, not pitch:
    - **Beep**: on, for a duration.
    - **Pause**: off, for a duration.
    - **Trill**: on and off 4 to 40 times a second, for a duration.
    - **Buzz**: on and off 100 to 1000 times a second, a rough sound, for a duration.
      Durations go in steps of 10 ms, from 10 ms to 1 s; the slider in the editor moves through a stepped scale, 10 ms apart for short blocks and up to 100 ms apart for long ones.
2. **Limits**, checked by the server: at most 1 second in total (2 seconds until the owner halved it on 2026-11-15), with as many blocks as fit in it (at most 12 until the owner dropped that cap on 2026-11-15), and at least one block that makes sound. Sounds play one after another, so a long one would delay the beep of the next scan.
3. **Presets in the database**, in a new `sound` table: id, name, blocks. The setting per event keeps pointing to a preset id. Editing a preset changes the sound of every event that uses it; the hardware agent reloads at once.
4. **Starting presets**: the sounds in use and the defaults, plus a few common ones: tick, blip, beep, long, double, triple, long-short, short-short-long, short trill, slow trill, rough. They keep their translated names until renamed. The other old sounds go, the three soft ones included (owner, 2026-11-15); an event set to a removed sound falls back to its default.
5. **A preset in use cannot be deleted**, including one that is the default of an event.
6. **The hardware agent does not change.** The server turns blocks into the steps the agent already plays: beep is on, pause is off, trill and buzz are a gate at their rate.
7. **On the sounds page**, each event shows its preset's name and a small timeline; a tap opens a popup to pick another preset, "no sound", or a new one. Presets are edited in a second popup: name, the blocks with sliders, add, move, remove, the timeline with the total time, play on the buzzer (also before saving), save, save as new, delete.
8. **The timeline** is a simple picture, not a real waveform: a bar per beep, a gap per pause, stripes for trills, dense hatching for buzzes, on a fixed 2-second scale. Changed by the owner on 2026-11-15: a sine for a beep, sine bursts with gaps for a trill, a sawtooth in the danger colour for a buzz, a flat line for a pause, on a 1-second scale.

## Steps

1. Server: blocks, limits and conversion as rules; the `sound` table with a migration that fills it and fixes settings that point to removed sounds; routes to create, change and delete presets, and to play blocks that are not saved yet.
2. Web app: the timeline, the picker and the editor, texts in Dutch and English.
3. Tests and docs; released after the owner's go.
