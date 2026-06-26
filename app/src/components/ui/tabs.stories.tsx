import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
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
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("tab", { name: "Dictation Cleanup" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await userEvent.click(canvas.getByRole("tab", { name: "Voice Agent" }));
    await expect(canvas.getByRole("tab", { name: "Voice Agent" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  },
};
