import type { Services } from "@services/ports";
import { mockSystemService } from "./system";
import { mockContentService } from "./content";
import { mockSettingsService } from "./settings";
import { mockInferenceService } from "./inference";
import { mockTranscriptionService } from "./transcription";
import { mockConnectionService } from "./connections";
import { mockSecretsService } from "./secrets";
import { mockModelService } from "./models";
import { mockCaptureService } from "./capture";
import { mockAccelerationService } from "./acceleration";

/** The mock implementation of every port. Swapped for real adapters later. */
export const mockServices: Services = {
  system: mockSystemService,
  content: mockContentService,
  settings: mockSettingsService,
  inference: mockInferenceService,
  transcription: mockTranscriptionService,
  connections: mockConnectionService,
  secrets: mockSecretsService,
  models: mockModelService,
  capture: mockCaptureService,
  acceleration: mockAccelerationService,
};
