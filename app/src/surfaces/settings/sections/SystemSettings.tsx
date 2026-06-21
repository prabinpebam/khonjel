import { SettingGroup, SettingRow } from "@components/common/SettingRow";
import { Button } from "@components/ui/button";
import { SelectRow } from "../controls";

export function SystemSettings() {
  const version = window.electronAPI?.getVersion?.() ?? "Browser preview";

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
          subtitle="Downloaded speech + language models."
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
          subtitle="Permanently delete settings, transcripts, audio, and downloaded models."
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
