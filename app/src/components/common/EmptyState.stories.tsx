import { Inbox } from "lucide-react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { EmptyState } from "./EmptyState";
import { Button } from "@components/ui/button";

const meta = {
  title: "Common/EmptyState",
  component: EmptyState,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
  args: { title: "No notes yet", description: "Captured dictations show up here." },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithIconAndAction: Story = {
  args: { icon: Inbox, action: <Button size="sm">New note</Button> },
};
