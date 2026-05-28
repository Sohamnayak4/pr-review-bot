import { OpenAIProvider, type OpenAIProviderOptions } from "./openai.js";

export interface LocalProviderOptions extends Omit<OpenAIProviderOptions, "apiKey" | "name"> {
  apiKey?: string;
}

export class LocalProvider extends OpenAIProvider {
  constructor(options: LocalProviderOptions) {
    super({
      ...options,
      apiKey: options.apiKey ?? "local",
      name: "local",
    });
  }
}
