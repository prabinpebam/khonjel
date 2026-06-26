import type { Meta, StoryObj } from "@storybook/react-vite";
import { Progress } from "./progress";

const meta = {
  title: "UI/Progress",
  component: Progress,
  tags: ["autodocs"],
  args: { value: 60 },
  argTypes: {
    value: { control: { type: "range", min: 0, max: 100 } },
    tone: { control: "inline-radio", options: ["dataviz", "accent"] },
  },
  decorators: [
    (Story) => (
      <div className="w-64">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Progress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Dataviz: Story = {};
export const Accent: Story = { args: { tone: "accent" } };
