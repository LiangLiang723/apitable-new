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
@Schema(description = "Mail server configuration")
public class SpaceMailConfigVo {

    @Schema(description = "Whether custom SMTP server is enabled", example = "true")
    private Boolean enabled;

    @Schema(description = "Provider preset", example = "qq")
    private String provider;

    @Schema(description = "SMTP host", example = "smtp.qq.com")
    private String host;

    @Schema(description = "SMTP port", example = "465")
    private Integer port;

    @Schema(description = "SMTP protocol", example = "smtp")
    private String protocol;

    @Schema(description = "SMTP username", example = "name@qq.com")
    private String username;

    @Schema(description = "Whether a password has been configured", example = "true")
    private Boolean passwordConfigured;

    @Schema(description = "Masked password", example = "ab...yz")
    private String maskedPassword;

    @Schema(description = "Sender email address", example = "name@qq.com")
    private String from;

    @Schema(description = "Sender display name", example = "APITable")
    private String personal;

    @Schema(description = "Whether SMTP auth is enabled", example = "true")
    private Boolean auth;

    @Schema(description = "Whether SSL is enabled", example = "true")
    private Boolean sslEnable;

    @Schema(description = "Whether STARTTLS is enabled", example = "false")
    private Boolean starttlsEnable;

    @Schema(description = "Whether STARTTLS is required", example = "false")
    private Boolean starttlsRequired;

    @Schema(description = "Whether mail debug logging is enabled", example = "false")
    private Boolean debug;
}