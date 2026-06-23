# 05 — UX: Set Up, Test & Validate

> The human side of "no-compromise GPU support with graceful fallback." Designed for a low-tech user
> who has never heard of CUDA: one obvious button, plain language, visible proof it works, and an
> honest CPU fallback that never feels like a failure. Implements the contracts in
> [04](04-contracts-data-and-ipc.md); lives in the existing local-model settings surface.

---

## 1. Design principles (UX)

1. **One primary action.** "Turn on GPU acceleration" is the only thing most users ever click.
2. **Show, don't claim.** We never say "GPU auto-detected" without proof — we run a real test and
   show the numbers ([01 status-honesty principle](README.md)).
3. **Plain language first, jargon on demand.** "Your graphics card" not "CUDA device 0"; backend
   names hidden behind Advanced.
4. **Fallback is a state, not an error.** "Running on CPU" is shown calmly with a "Try GPU" action,
   never a red alert.
5. **Never color-only.** Every state pairs an icon + text label (accessibility / colorblind).
6. **Always reversible in the UI.** Anything you turn on, you can turn off in one click.

---

## 2. Where it lives (entry points)

- **Settings -> Inference / Local models** — the primary "Acceleration" card (below the model picker
  in `LocalModelSetup.tsx`).
- **Engine badge** (sidebar/floating bar) — small live "GPU" / "CPU" pill that deep-links to the card.
- **FRE / first run** — after a model is ready, a one-line nudge: "Make this faster with your graphics
  card" -> opens the card ([08 cross-link](../../03-ux-ui/08-local-model-fre-readiness-and-compatibility.md)).
- Fixes the current dishonest copy at `app/src/surfaces/settings/inference.tsx` ("Runs on device. GPU
  auto-detected.") -> replaced by the live state string from `AccelerationState.summary`.

---

## 3. The Acceleration card — state machine (UI)

```text
            ┌─────────────────────────────────────────────┐
            │  detecting…  (spinner, "Checking hardware")  │
            └───────────────┬─────────────────────────────┘
                            ▼
        ┌───────────────────────────────────────────────────────┐
        │ NO USABLE GPU            │ GPU FOUND, NOT ON           │
        │ "Running on CPU.         │ "Your NVIDIA RTX 4090 can   │
        │  No compatible graphics  │  make this much faster."    │
        │  card found."            │  [ Turn on GPU acceleration ]│
        │ (calm, no CTA / Re-scan) │                              │
        └───────────────────────────┬──────────────────────────┘
                                     ▼  (click)
                  ┌──────────────────────────────────────┐
                  │ WORKING…  progress + cancel           │
                  │  ● Checking your graphics card        │
                  │  ◐ Downloading GPU support  (2 of 3)  │
                  │  ○ Testing it on your machine         │
                  └───────────────┬───────────────┬──────┘
                          success ▼               ▼ failure
        ┌──────────────────────────────┐  ┌──────────────────────────────┐
        │ ON — "Running on your NVIDIA  │  │ ROLLED BACK — "We kept things │
        │ RTX 4090. About 7x faster."   │  │ on CPU so nothing broke."     │
        │ [ Test again ] [ Turn off ]   │  │ reason + [ Try again ] [Details]│
        └──────────────────────────────┘  └──────────────────────────────┘
```

Each visual state maps 1:1 to `EngineAcceleration.state` / `AccelerationState` from
[04 §2](04-contracts-data-and-ipc.md).

---

## 4. One-click "Turn on" flow (the happy path)

Single click runs Detect -> Provision -> **Validate** -> Activate, streaming `AccelerationProgress`:

```text
┌─ Turning on GPU acceleration ──────────────────────────────┐
│                                                            │
│   ✓  Found your graphics card        NVIDIA RTX 4090       │
│   ✓  Downloaded GPU support          just now              │
│   ◐  Testing it on your machine…     running a quick check │
│                                                            │
│   This takes a few seconds. You can keep using the app.    │
│                                              [ Cancel ]    │
└────────────────────────────────────────────────────────────┘
```

- **Cancel** is always available; cancelling rolls back cleanly to the prior state (CPU stays working).
- Download progress shows bytes + count ("2 of 3") from `bytesDone/bytesTotal`.
- The **test step is mandatory** — we only flip to "On" after a real probe passes ([02 §5](02-backend-provisioning-and-rollback.md)).

---

## 5. Test & validate UX (the proof)

Triggered by the flow above and re-runnable via **Test again**. Runs a real CPU baseline + GPU run
([04 `runTest`](04-contracts-data-and-ipc.md)) and shows a friendly before/after:

```text
┌─ Speed check ──────────────────────────────────────────────┐
│                                                            │
│   Writing speed (words per second)                         │
│   CPU   ▓▓▓▓▓░░░░░░░░░░░░░░░   18 wps                       │
│   GPU   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  132 wps      ✓ 7x faster      │
│                                                            │
│   Voice typing                                             │
│   ✓ Works on GPU      2.1x real-time                       │
│                                                            │
│   Memory used on the card   3.4 GB of 24 GB                │
│                                                            │
│   Everything works. Acceleration is on.   [ Done ]         │
└────────────────────────────────────────────────────────────┘
```

- Numbers come from `RuntimeMetrics`; "7x faster" from `AccelerationTestReport.speedup`.
- If GPU test fails but CPU works -> show the calm rolled-back card (§6), not this panel.
- Bars are labeled with numbers (never bar-length/color alone) for accessibility.

---

## 6. Fallback & rollback messaging (friendly, honest)

| Situation | Headline | Body | Actions |
|---|---|---|---|
| No GPU | "Running on CPU" | "We didn't find a compatible graphics card. The app still works great." | Re-scan hardware |
| GPU too old/driver | "Running on CPU" | "Your graphics driver is older than required. Update it to use GPU speed." | How to update, Re-check |
| Download failed | "Couldn't finish setup" | "The GPU files couldn't be verified, so we kept you on CPU." | Try again, Details |
| Probe failed / OOM | "Kept things on CPU" | "GPU support didn't pass our quick test, so nothing changed." | Try again, Details |
| Crash-loop demote | "Switched back to a stable setup" | "GPU acceleration was unstable, so we returned to what last worked." | Try again, Details |

- **Details** opens a copyable technical panel (backend, version, error code, `reason.json`) for
  support — hidden by default.
- Tone rule: never "Error"/"Failed" as the headline; always frame around "we kept things working."

---

## 7. Advanced disclosure (power users)

Collapsed "Advanced" section under the card, maps to the Advanced settings keys
([04 §5](04-contracts-data-and-ipc.md)):

```text
▸ Advanced
   Mode:           ( ) Automatic   ( ) Always on   ( ) Off
   Graphics card:  [ NVIDIA RTX 4090 (24 GB)  ▾ ]   # multi-GPU pick -> device index
   Backend (LLM):  [ Auto ▾ ]  CUDA 13.3 / Vulkan / CPU
   Backend (STT):  [ Auto ▾ ]
   GPU layers:     [ Auto ]  ( ) Custom [ ___ ]      # -ngl override
   [✓] Use GPU on battery
   [ Re-scan hardware ]   [ Reset acceleration ]      # Reset = clear runtime/, re-provision
```

- Everything here is optional; defaults ("Automatic" + "Auto") are the smart path.
- "Reset acceleration" maps to deleting `runtime/` state (safe) and re-running detection.

---

## 8. Copy library (low-tech wording)

| Concept | We say | We never say |
|---|---|---|
| GPU | "your graphics card" | "GPU / CUDA device" |
| Backend download | "GPU support" | "CUDA runtime / cuBLAS" |
| Offload layers | (hidden; Advanced only) | "-ngl 999" |
| Probe | "a quick test" | "smoke probe" |
| Fallback | "kept things on CPU" | "fallback / degraded" |
| VRAM | "memory on the card" | "VRAM" |
| Speedup | "7x faster" | "throughput delta" |

---

## 9. Accessibility & states

- Every status = **icon + text + (optional) color**; color is never the sole signal.
- All actions keyboard-reachable; progress uses `aria-live="polite"` so screen readers hear
  "Downloading GPU support, 2 of 3", "Acceleration is on."
- Spinners have text equivalents; the speed bars expose numeric `aria-label`s.
- Respects reduced-motion (no animated bars when the OS asks for less motion).
- All strings ASCII in code (ds-lint); wireframe glyphs here are doc-only.

---

## 10. Component map (implementation pointers)

```text
src/surfaces/settings/
  AccelerationCard.tsx        # the card + state machine (consumes acceleration store)
  AccelerationProgress.tsx    # the working/flow panel (§4)
  AccelerationTest.tsx        # the speed-check panel (§5)
  AccelerationAdvanced.tsx    # disclosure (§7)
src/stores/acceleration.ts    # zustand store (04 §7)
src/surfaces/settings/inference.tsx   # replace dishonest copy with live summary (§2)
components: reuse existing badge/Progress primitives from the model-setup work
```
