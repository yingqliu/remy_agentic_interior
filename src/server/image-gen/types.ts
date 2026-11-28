export type GenerateRequest = {
  projectTitle: string;
  roomKind: string;
  roomName: string;
  sourcePhoto: string;
  requirements: string[];
  constraints: string[];
  schemeKey: string | null;
  schemeName: string | null;
  prompt: string;
};

export type GenerateResult = {
  provider: string;
  status: "stubbed" | "ready" | "error";
  imageSrc: string | null;
  message: string;
  prompt: string;
};

export interface ImageProvider {
  id: string;
  generate(request: GenerateRequest): Promise<GenerateResult>;
}
