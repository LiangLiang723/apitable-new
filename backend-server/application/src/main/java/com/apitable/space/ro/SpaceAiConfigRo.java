package com.apitable.space.ro;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
@Schema(description = "Space AI provider configuration request")
public class SpaceAiConfigRo {

    @Schema(description = "Whether Copilot AI provider is enabled", example = "true")
    private Boolean enabled;

    @Schema(description = "Provider type", example = "openai-compatible")
    private String provider;

    @Schema(description = "API base URL", example = "https://api.openai.com")
    private String baseUrl;

    @Schema(description = "API key")
    private String apiKey;

    @Schema(description = "Whether to clear the stored API key", example = "false")
    private Boolean clearApiKey;

    @Schema(description = "Model name", example = "gpt-4o-mini")
    private String model;

    @Schema(description = "Chat completion path", example = "/v1/chat/completions")
    private String chatCompletionPath;

    @Schema(description = "Authorization header prefix", example = "Bearer")
    private String authorizationPrefix;

    @Schema(description = "Extra headers JSON", example = "{\"OpenAI-Organization\":\"org_xxx\"}")
    private String extraHeaders;
}