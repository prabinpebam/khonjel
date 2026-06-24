import { useEffect, useState } from "react";
import { useServices } from "@services";
import type { ModelStorageReport } from "@services/ports";
import { useModelsStore } from "@stores/models";
import { SettingGroup, SettingRow } from "@components/common/SettingRow";
import { Button } from "@components/ui/button";
import { SelectRow } from "../controls";

/** Bytes to a short "3.1 GB" / "466 MB" label. */
function fmt(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

export function SystemSettings() {
  const services = useServices();
  const version = window.electronAPI?.getVersion?.() ?? "Browser preview";
  // Re-read storage whenever a download/remove changes the installed set.
  const statuses = useModelsStore((s) => s.statuses);
  const [storage, setStorage] = useState<ModelStorageReport | null>(null);
  useEffect(() => {
    let live = true;
    void services.models.storage().then((report) => {
      if (live) setStorage(report);
    });
    return () => {
      live = false;
    };
  }, [services, statuses]);

  const modelCacheSubtitle = storage
    ? `Models — ${fmt(storage.usedBytes)} used · ${fmt(storage.freeBytes)} free`
    : "Downloaded speech + language models.";

  return (
    <div>
      <SettingGroup label="About">
        <SettingRow title="Version" subtitle={`Khonjel ${version}`} />
      </SettingGroup>

      <SettingGroup label="Developer tools">
        <SelectRow
          title="Logging level"
          settingKey="loggingLevel"
          options={[
            { value: "info", label: "Info" },
            { value: "debug", label: "Debug" },
            { value: "trace", label: "Trace" },
          ]}
        />
        <SettingRow
          title="Diagnostics"
          subtitle="Open the log folder or the developer tools."
          control={
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => window.electronAPI?.openLogs?.()}>
                Open logs
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.electronAPI?.openDevTools?.()}
              >
                Open DevTools
              </Button>
            </div>
          }
        />
      </SettingGroup>

      <SettingGroup label="Data management">
        <SettingRow
          title="Model cache"
          subtitle={modelCacheSubtitle}
          control={
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.electronAPI?.openModelsFolder?.()}
              >
                Open
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-danger hover:text-danger"
                onClick={() => window.electronAPI?.clearModelCache?.()}
              >
                Clear cache
              </Button>
            </div>
          }
        />
        <SettingRow
          title="Reset all data"
          subtitle="Permanently delete settings, transcripts, connections, saved keys, and downloaded models."
          control={
            <Button
              variant="destructive"
              size="sm"
              onClick={() => window.electronAPI?.resetAllData?.()}
            >
              Reset all data
            </Button>
          }
        />
      </SettingGroup>
    </div>
  );
}
