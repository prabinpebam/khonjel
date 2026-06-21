import { useEffect, useState } from "react";
import { useServices } from "@services";
import { SettingGroup, SettingRow } from "@components/common/SettingRow";
import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { SelectRow, ToggleRow } from "../controls";

export function PrivacySettings() {
  const { content } = useServices();
  const [uploadCount, setUploadCount] = useState(0);

  useEffect(() => {
    let live = true;
    void content.uploads().then((u) => {
      if (live) setUploadCount(u.length);
    });
    return () => {
      live = false;
    };
  }, [content]);

  async function clearAudio() {
    await content.saveUploads([]);
    setUploadCount(0);
  }

  return (
    <div>
      <SettingGroup label="Privacy">
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
          subtitle={
            uploadCount === 0
              ? "No stored recordings."
              : `${uploadCount} recording${uploadCount === 1 ? "" : "s"} on device.`
          }
          control={
            <Button
              variant="ghost"
              size="sm"
              className="text-danger hover:text-danger"
              onClick={() => void clearAudio()}
              disabled={uploadCount === 0}
            >
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
        <MicPermissionRow />
        <SettingRow
          title="Accessibility"
          subtitle="Required to inject text into other apps."
          control={<Badge variant="neutral">Managed by OS</Badge>}
        />
        <SettingRow
          title="System audio"
          subtitle="Needed to capture meeting audio."
          control={<Badge variant="neutral">Managed by OS</Badge>}
        />
      </SettingGroup>
    </div>
  );
}

function MicPermissionRow() {
  const [state, setState] = useState<"granted" | "prompt" | "denied" | "unknown">("unknown");

  useEffect(() => {
    let live = true;
    if (!navigator.permissions?.query) return;
    void navigator.permissions
      .query({ name: "microphone" as PermissionName })
      .then((status) => {
        if (!live) return;
        const sync = () => setState(status.state);
        sync();
        status.onchange = sync;
      })
      .catch(() => {
        /* permission name unsupported -- leave as unknown */
      });
    return () => {
      live = false;
    };
  }, []);

  async function grant() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setState("granted");
    } catch {
      setState("denied");
    }
  }

  return (
    <SettingRow
      title="Microphone"
      subtitle="Required to dictate and record."
      control={
        state === "granted" ? (
          <Badge variant="success">Granted</Badge>
        ) : (
          <div className="flex items-center gap-2">
            <Badge variant="neutral">{state === "denied" ? "Denied" : "Not granted"}</Badge>
            <Button variant="secondary" size="sm" onClick={() => void grant()}>
              Grant
            </Button>
          </div>
        )
      }
    />
  );
}
