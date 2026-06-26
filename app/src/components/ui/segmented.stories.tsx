import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { Monitor, Moon, Sun } from "lucide-react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Segmented } from "./segmented";

const meta: Meta<typeof Segmented> = {
  title: "UI/Segmented",
  component: Segmented,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "auto", label: "Auto", icon: Monitor },
];

export const Solid: Story = {
  render: () => {
    const [value, setValue] = useState("light");
    return <Segmented value={value} onChange={setValue} options={OPTIONS} aria-label="Theme" />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const dark = canvas.getByRole("button", { name: "Dark" });
    await expect(dark).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(dark);
    await expect(dark).toHaveAttribute("aria-pressed", "true");
  },
};

export const SoftIconOnly: Story = {
  render: () => {
    const [value, setValue] = useState("light");
    return (
      <Segmented
        value={value}
        onChange={setValue}
        options={OPTIONS}
        size="icon"
        tone="soft"
        aria-label="Theme"
      />
    );
  },
};
