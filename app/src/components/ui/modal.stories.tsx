import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Modal } from "./modal";
import { Button } from "./button";

const meta: Meta<typeof Modal> = {
  title: "UI/Modal",
  component: Modal,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open modal</Button>
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          labelledBy="demo-modal-title"
          className="max-w-md"
        >
          <div className="flex flex-col gap-3 p-6">
            <h2 id="demo-modal-title" className="text-base font-semibold text-foreground">
              Delete conversation?
            </h2>
            <p className="text-sm text-muted-foreground">This can&rsquo;t be undone.</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setOpen(false)}>
                Delete
              </Button>
            </div>
          </div>
        </Modal>
      </>
    );
  },
};
