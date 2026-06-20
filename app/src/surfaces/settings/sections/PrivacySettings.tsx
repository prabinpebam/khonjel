import { SettingGroup, SettingRow } from "@components/common/SettingRow";
import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { SelectRow, ToggleRow } from "../controls";

const PERMISSIONS: { name: string; status: "granted" | "not-requested" }[] = [
  { name: "Microphone", status: "granted" },
  { name: "Accessibility", status: "granted" },
  { name: "System audio", status: "not-requested" },
];

export function PrivacySettings() {
  return (
    <div>
      <SettingGroup label="Privacy">
        <ToggleRow
          title="Cloud backup"
          subtitle="Encrypted sync across your devices (requires sign-in)."
          settingKey="cloudBackup"
        />
        <SettingRow
          title="Usage analytics"
          subtitle="No data is collected."
          control={<Badge variant="neutral">Off</Badge>}
        />
      </SettingGroup>

      <SettingGroup label="Audio retention">
        <SelectRow
          title="Keep audio for"
          settingKey="audioRetentionDays"
          options={[
            { value: "0", label: "Disabled" },
            { value: "7", label: "7 days" },
            { value: "14", label: "14 days" },
            { value: "30", label: "30 days" },
            { value: "60", label: "60 days" },
            { value: "90", label: "90 days" },
          ]}
        />
        <SettingRow
          title="Storage usage"
          subtitle="42 files, 8.5 MB on disk."
          control={
            <Button variant="ghost" size="sm" className="text-danger hover:text-danger">
              Clear all audio
            </Button>
          }
        />
      </SettingGroup>

      <SettingGroup label="Data retention">
        <ToggleRow title="Save transcription history" settingKey="saveHistory" />
        <ToggleRow
          title="Include discarded transcriptions"
          subtitle="Items marked 'do not save' are kept for 7 days."
          settingKey="includeDiscarded"
        />
      </SettingGroup>

      <SettingGroup label="Permissions">
        {PERMISSIONS.map((permission) => (
          <SettingRow
            key={permission.name}
            title={permission.name}
            control={
              permission.status === "granted" ? (
                <Badge variant="success">Granted</Badge>
              ) : (
                <div className="flex items-center gap-2">
                  <Badge variant="neutral">Not requested</Badge>
                  <Button variant="secondary" size="sm">
                    Grant
                  </Button>
                </div>
              )
            }
          />
        ))}
      </SettingGroup>
    </div>
  );
}
