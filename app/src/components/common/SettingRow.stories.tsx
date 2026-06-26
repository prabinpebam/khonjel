import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { SettingRow, SettingGroup } from "./SettingRow";
import { Switch } from "@components/ui/switch";
import { Badge } from "@components/ui/badge";

const meta: Meta<typeof SettingRow> = {
  title: "Common/SettingRow",
  component: SettingRow,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-full max-w-xl">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const InAGroup: Story = {
  render: () => {
    const [sounds, setSounds] = useState(true);
    const [mute, setMute] = useState(false);
    return (
      <SettingGroup label="Sound effects">
        <SettingRow
          title="Dictation sounds"
          subtitle="Play a chime on start and stop."
          control={<Switch checked={sounds} onCheckedChange={setSounds} label="Dictation sounds" />}
        />
        <SettingRow
          title="Mute other audio while dictating"
          badge={<Badge variant="accent">Beta</Badge>}
          control={<Switch checked={mute} onCheckedChange={setMute} label="Mute other audio" />}
        />
      </SettingGroup>
    );
  },
};
