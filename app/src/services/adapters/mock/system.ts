import type { Platform, SystemService } from "@services/ports";
import { electronAPI } from "@mock/electron-api-shim";
import { delay } from "@lib/delay";

/** Mock system info — reads the simulated preload bridge. */
export const mockSystemService: SystemService = {
  async getAppVersion() {
    await delay(20);
    return "0.0.0-mock";
  },
  async getPlatform() {
    await delay(10);
    return (electronAPI.getPlatform?.() ?? "web") as Platform;
  },
};
