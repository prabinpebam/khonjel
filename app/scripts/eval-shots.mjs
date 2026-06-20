#!/usr/bin/env node
/**
 * eval:shots — visual eval harness (L4/L6 of the eval loop).
 *
 * PLACEHOLDER for Phase 0. The full harness (Playwright renders every screen × state ×
 * theme to eval/screens/*.png for agent visual review and baseline diffing) is wired in a
 * later phase per docs/product-spec/04-architecture-and-delivery/06-test-and-validation-strategy.md.
 *
 * For now this documents the loop and exits 0 so `npm run eval:shots` exists from commit #1.
 * During Phase 0, visual review is done by running `npm run dev` and inspecting the shell.
 */
console.log("eval:shots — placeholder.");
console.log("Phase 0: run `npm run dev` and inspect the shell against the UI Design Spec.");
console.log("Later: Playwright will render screens/states/themes to eval/screens/*.png.");
process.exit(0);
