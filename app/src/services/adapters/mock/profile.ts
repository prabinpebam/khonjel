import type { Profile, ProfileService } from "@services/ports";
import { delay } from "@lib/delay";

const LOCAL_PROFILE: Profile = {
  id: "local",
  name: "You",
};

/** Mock profile — local-first, no account required. */
export const mockProfileService: ProfileService = {
  async get() {
    await delay(40);
    return LOCAL_PROFILE;
  },
};
