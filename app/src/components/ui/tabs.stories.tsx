import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Tabs } from "./tabs";

const meta: Meta<typeof Tabs> = {
  title: "UI/Tabs",
  component: Tabs,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [tab, setTab] = useState("cleanup");
    return (
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: "cleanup", label: "Dictation Cleanup" },
          { value: "agent", label: "Voice Agent" },
          { value: "note", label: "Note Formatting" },
        ]}
      />
    );
  },
};
