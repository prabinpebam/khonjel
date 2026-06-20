import { SettingGroup, SettingRow } from "@components/common/SettingRow";
import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { SelectRow } from "../controls";

export function SystemSettings() {
  return (
    <div>
      <SettingGroup label="Software updates">
        <SettingRow
          title="Current version"
          subtitle="0.1.0-mock"
          control={<Badge variant="success">Up to date</Badge>}
        />
        <SettingRow
          title="Check for updates"
          control={
            <Button variant="secondary" size="sm">
              Check now
            </Button>
          }
        />
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
          subtitle="Log file: 2.1 MB"
          control={
            <div className="flex gap-2">
              <Button variant="ghost" size="sm">
                Open logs
              </Button>
              <Button variant="secondary" size="sm">
                Open DevTools
              </Button>
            </div>
          }
        />
      </SettingGroup>

      <SettingGroup label="Data management">
        <SettingRow
          title="Model cache"
          subtitle="~/.khonjel/models · 3.6 GB"
          control={
            <div className="flex gap-2">
              <Button variant="ghost" size="sm">
                Open
              </Button>
              <Button variant="ghost" size="sm" className="text-danger hover:text-danger">
                Clear cache
              </Button>
            </div>
          }
        />
        <SettingRow
          title="Reset all data"
          subtitle="Permanently delete settings, transcripts, audio, and downloaded models."
          control={
            <Button variant="destructive" size="sm">
              Reset all data
            </Button>
          }
        />
      </SettingGroup>
    </div>
  );
}
