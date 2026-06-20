import type { Services } from "@services/ports";
import { mockProfileService } from "./profile";
import { mockSystemService } from "./system";

/** The mock implementation of every port. Swapped for real adapters later. */
export const mockServices: Services = {
  profile: mockProfileService,
  system: mockSystemService,
};
