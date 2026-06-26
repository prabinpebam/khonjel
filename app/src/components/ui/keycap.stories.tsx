import type { Meta, StoryObj } from "@storybook/react-vite";
import { Keycap } from "./keycap";

const meta = {
  title: "UI/Keycap",
  component: Keycap,
  tags: ["autodocs"],
  args: { children: "Win+Alt+1" },
} satisfies Meta<typeof Keycap>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Combo: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Keycap>Ctrl</Keycap>
      <Keycap>Shift</Keycap>
      <Keycap>K</Keycap>
    </div>
  ),
};
