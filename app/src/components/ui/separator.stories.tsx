import type { Meta, StoryObj } from "@storybook/react-vite";
import { Separator } from "./separator";

const meta = {
  title: "UI/Separator",
  component: Separator,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-64">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const BetweenContent: Story = {
  render: () => (
    <div className="flex w-64 flex-col gap-3 text-sm text-foreground">
      <span>Above the line</span>
      <Separator />
      <span>Below the line</span>
    </div>
  ),
};
