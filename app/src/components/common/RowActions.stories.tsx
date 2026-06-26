import { Pencil, Trash2 } from "lucide-react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { RowActions } from "./RowActions";
import { Button } from "@components/ui/button";

const meta: Meta<typeof RowActions> = {
  title: "Common/RowActions",
  component: RowActions,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Hover-revealed action cluster for a list row. Must live inside a `group` row; it stays in layout (fades via opacity) so rows don't reflow on hover. Hover the row below to reveal the actions.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const InAListRow: Story = {
  render: () => (
    <div className="group flex w-72 items-center justify-between rounded-md border border-border bg-surface px-3 py-2">
      <span className="text-sm text-foreground">Hover this row</span>
      <RowActions className="gap-0.5">
        <Button variant="ghost" size="icon" aria-label="Edit">
          <Pencil />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Delete">
          <Trash2 />
        </Button>
      </RowActions>
    </div>
  ),
};
