import type { Meta, StoryObj } from "@storybook/react-vite";
import { StatCard } from "./StatCard";

const meta = {
  title: "Common/StatCard",
  component: StatCard,
  tags: ["autodocs"],
  args: { value: "1,284", label: "Words dictated", sub: "+12% vs last week" },
} satisfies Meta<typeof StatCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Row: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-4">
      <StatCard value="1,284" label="Words" />
      <StatCard value="42" label="Sessions" />
      <StatCard value="98%" label="Accuracy" valueClassName="text-success" />
    </div>
  ),
};
