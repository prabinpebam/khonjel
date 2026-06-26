import type { Meta, StoryObj } from "@storybook/react-vite";
import { Panel } from "./Panel";

const meta = {
  title: "Common/Panel",
  component: Panel,
  tags: ["autodocs"],
} satisfies Meta<typeof Panel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Panel className="h-64 w-72">
      <div className="border-b border-border p-3 text-sm font-semibold text-foreground">Folders</div>
      <div className="flex-1 overflow-y-auto p-3 text-sm text-muted-foreground">
        A full-height bordered pane that clips its children — the shell for the list / editor /
        conversation columns. Width and placement come via className.
      </div>
    </Panel>
  ),
};
