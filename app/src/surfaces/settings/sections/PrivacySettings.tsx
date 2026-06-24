import { useEffect, useState } from "react";
import { useServices } from "@services";
import { SettingGroup, SettingRow } from "@components/common/SettingRow";
import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { ToggleRow } from "../controls";

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

  async function clearUploads() {
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
        <SettingRow
          title="Audio storage"
          subtitle="Recordings are transcribed in memory and never written to disk."
          control={<Badge variant="success">Never stored</Badge>}
        />
      </SettingGroup>

      <SettingGroup label="Data retention">
        <ToggleRow title="Save transcription history" settingKey="saveHistory" />
        <SettingRow
          title="Upload transcripts"
          subtitle={
            uploadCount === 0
              ? "No upload transcripts stored."
              : `${uploadCount} upload transcript${uploadCount === 1 ? "" : "s"} stored.`
          }
          control={
            <Button
              variant="ghost"
              size="sm"
              className="text-danger hover:text-danger"
              onClick={() => void clearUploads()}
              disabled={uploadCount === 0}
            >
              Clear uploads
            </Button>
          }
        />
      </SettingGroup>

      <SettingGroup label="Permissions">
        <MicPermissionRow />
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
