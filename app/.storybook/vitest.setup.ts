import { beforeAll } from "vitest";
import { setProjectAnnotations } from "@storybook/react-vite";
import * as previewAnnotations from "./preview";

// Apply the preview decorators/globals (themed canvas + globals.css) to story tests, so each
// story renders exactly as it does in the Storybook UI.
const project = setProjectAnnotations([previewAnnotations]);

beforeAll(project.beforeAll);
