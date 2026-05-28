import { OpenAIProvider, type OpenAIProviderOptions } from "./openai.js";

export class OpenRouterProvider extends OpenAIProvider {
  constructor(options: Omit<OpenAIProviderOptions, "name">) {
    super({
      ...options,
      name: "openrouter",
      baseURL: options.baseURL ?? "https://openrouter.ai/api/v1",
    });
  }
}
