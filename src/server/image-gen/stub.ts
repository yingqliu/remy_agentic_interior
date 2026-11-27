import type { GenerateRequest, GenerateResult, ImageProvider } from "./types";

/**
 * Default provider. Records the prompt and returns no pixels.
 * It does not echo the source photo as a fake remodel render.
 */
export const stubProvider: ImageProvider = {
  id: "stub",
  async generate(request: GenerateRequest): Promise<GenerateResult> {
    return {
      provider: "stub",
      status: "stubbed",
      imageSrc: null,
      message: "Stub provider recorded the prompt and did not synthesize an image.",
      prompt: request.prompt,
    };
  },
};
