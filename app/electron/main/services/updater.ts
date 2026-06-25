import { autoUpdater } from "electron-updater";
import type { Logger } from "./logger";

/** A coarse update lifecycle the renderer renders in Settings -> System. */
export type UpdateStatus =
  | { state: "idle" }
  | { state: "unsupported" } // not packaged (dev): there is no update feed
  | { state: "checking" }
  | { state: "available"; version: string }
  | { state: "none" } // already on the latest version
  | { state: "downloading"; percent: number }
  | { state: "ready"; version: string } // downloaded; restart to apply
  | { state: "error"; message: string };

export interface AutoUpdaterDeps {
  isPackaged: boolean;
  logger: Pick<Logger, "info" | "warn" | "error">;
  /** Push a status to the renderer (e.g. via webContents.send). */
  send: (status: UpdateStatus) => void;
}

export interface AutoUpdaterControls {
  /** Check for an update now. Reports "unsupported" in a dev (unpackaged) run. */
  check: () => void;
  /** Quit and install a downloaded update. Only meaningful after state "ready". */
  install: () => void;
}

/**
 * Wires electron-updater against the GitHub Releases feed configured in package.json `build.publish`
 * and relays a coarse status to the renderer. Auto-download is on and the update installs on the
 * next quit; the user can also restart immediately from Settings. Updates only work in a packaged
 * build -- a dev run has no feed, so the controls report "unsupported" instead of throwing.
 */
export function setupAutoUpdater(deps: AutoUpdaterDeps): AutoUpdaterControls {
  if (!deps.isPackaged) {
    return {
      check: () => deps.send({ state: "unsupported" }),
      install: () => {},
    };
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = {
    info: (m?: unknown) => deps.logger.info(`updater: ${String(m)}`),
    warn: (m?: unknown) => deps.logger.warn(`updater: ${String(m)}`),
    error: (m?: unknown) => deps.logger.error(`updater: ${String(m)}`),
    debug: () => {},
  };

  autoUpdater.on("checking-for-update", () => deps.send({ state: "checking" }));
  autoUpdater.on("update-available", (info) =>
    deps.send({ state: "available", version: String(info.version) }),
  );
  autoUpdater.on("update-not-available", () => deps.send({ state: "none" }));
  autoUpdater.on("download-progress", (progress) =>
    deps.send({ state: "downloading", percent: Math.round(progress.percent) }),
  );
  autoUpdater.on("update-downloaded", (info) => {
    deps.logger.info(`updater: downloaded ${String(info.version)}`);
    deps.send({ state: "ready", version: String(info.version) });
  });
  autoUpdater.on("error", (err) => {
    const message = err instanceof Error ? err.message : String(err);
    deps.logger.warn(`updater error: ${message}`);
    deps.send({ state: "error", message });
  });

  return {
    check: () => {
      void autoUpdater.checkForUpdates().catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        deps.logger.warn(`updater check failed: ${message}`);
        deps.send({ state: "error", message });
      });
    },
    // isSilent=false shows the installer UI; isForceRunAfter=true relaunches Khonjel after updating.
    install: () => autoUpdater.quitAndInstall(false, true),
  };
}
