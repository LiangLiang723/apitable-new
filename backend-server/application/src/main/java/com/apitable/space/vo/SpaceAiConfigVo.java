package com.apitable.space.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder(toBuilder = true)
@Schema(description = "Space AI provider configuration")
public class SpaceAiConfigVo {

    @Schema(description = "Whether Copilot AI provider is enabled", example = "true")
    private Boolean enabled;

    @Schema(description = "Provider type", example = "openai-compatible")
    private String provider;

    @Schema(description = "API base URL", example = "https://api.openai.com")
    private String baseUrl;

    @Schema(description = "Whether an API key has been configured", example = "true")
    private Boolean apiKeyConfigured;

    @Schema(description = "Masked API key", example = "sk-a...1234")
    private String maskedApiKey;

    @Schema(description = "Model name", example = "gpt-4o-mini")
    private String model;

    @Schema(description = "Chat completion path", example = "/v1/chat/completions")
    private String chatCompletionPath;

    @Schema(description = "Authorization header prefix", example = "Bearer")
    private String authorizationPrefix;

    @Schema(description = "Extra headers JSON", example = "{}")
    private String extraHeaders;
}