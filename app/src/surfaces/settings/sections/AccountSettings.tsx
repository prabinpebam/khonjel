import { useState } from "react";
import { SettingGroup, SettingRow } from "@components/common/SettingRow";
import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";

export function AccountSettings() {
  const [signedIn, setSignedIn] = useState(false);

  return (
    <div>
      <SettingGroup label="Account">
        {signedIn ? (
          <>
            <SettingRow
              title="You"
              subtitle="you@example.com"
              badge={<Badge variant="success">Signed in</Badge>}
              control={
                <Button variant="ghost" size="sm" onClick={() => setSignedIn(false)}>
                  Sign out
                </Button>
              }
            />
            <SettingRow
              title="Delete account"
              subtitle="Remove your cloud account and synced data."
              control={
                <Button variant="destructive" size="sm">
                  Delete account
                </Button>
              }
            />
          </>
        ) : (
          <SettingRow
            title="Cloud account"
            subtitle="Optional. Enables sync and team features — Khonjel works fully offline without it."
            badge={<Badge variant="neutral">Offline</Badge>}
            control={
              <Button size="sm" onClick={() => setSignedIn(true)}>
                Sign in
              </Button>
            }
          />
        )}
      </SettingGroup>
    </div>
  );
}
