import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "./card";
import { Button } from "./button";

const meta = {
  title: "UI/Card",
  component: Card,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Composed: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>Private local model</CardTitle>
        <CardDescription>Runs speech + language on this device.</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Audio and text never leave your computer.
      </CardContent>
      <CardFooter>
        <Button size="sm">Set up</Button>
      </CardFooter>
    </Card>
  ),
};

export const AsSection: Story = {
  render: () => (
    <Card as="section" aria-label="Example" className="p-5 text-sm text-foreground">
      A plain padded card rendered as a labelled <code>section</code> landmark.
    </Card>
  ),
};
