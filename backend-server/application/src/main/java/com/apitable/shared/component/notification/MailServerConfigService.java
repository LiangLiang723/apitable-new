package com.apitable.shared.component.notification;

import cn.hutool.core.util.StrUtil;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.apitable.base.enums.SystemConfigType;
import com.apitable.base.service.ISystemConfigService;
import com.apitable.core.exception.BusinessException;
import com.apitable.shared.config.properties.EmailSendProperties;
import com.apitable.space.ro.SpaceMailConfigRo;
import com.apitable.space.vo.SpaceMailConfigVo;
import jakarta.annotation.Resource;
import lombok.Builder;
import lombok.Data;
import org.springframework.stereotype.Service;

@Service
public class MailServerConfigService {

    private static final String CONFIG_LANG = "global";

    private static final String MAIL_ENABLED = "enabled";

    private static final String MAIL_PROVIDER = "provider";

    private static final String MAIL_HOST = "host";

    private static final String MAIL_PORT = "port";

    private static final String MAIL_PROTOCOL = "protocol";

    private static final String MAIL_USERNAME = "username";

    private static final String MAIL_PASSWORD = "password";

    private static final String MAIL_FROM = "from";

    private static final String MAIL_PERSONAL = "personal";

    private static final String MAIL_AUTH = "auth";

    private static final String MAIL_SSL_ENABLE = "sslEnable";

    private static final String MAIL_STARTTLS_ENABLE = "starttlsEnable";

    private static final String MAIL_STARTTLS_REQUIRED = "starttlsRequired";

    private static final String MAIL_DEBUG = "debug";

    private static final String DEFAULT_PROVIDER = "custom";

    private static final String DEFAULT_PROTOCOL = "smtp";

    private static final int DEFAULT_PORT = 465;

    @Resource
    private ISystemConfigService systemConfigService;

    @Resource
    private EmailSendProperties emailSendProperties;

    public SpaceMailConfigVo getConfig() {
        JSONObject config = getStoredConfig();
        String password = config.getStr(MAIL_PASSWORD);
        return SpaceMailConfigVo.builder()
            .enabled(config.getBool(MAIL_ENABLED, false))
            .provider(StrUtil.blankToDefault(config.getStr(MAIL_PROVIDER), DEFAULT_PROVIDER))
            .host(StrUtil.blankToDefault(config.getStr(MAIL_HOST), ""))
            .port(config.getInt(MAIL_PORT, DEFAULT_PORT))
            .protocol(StrUtil.blankToDefault(config.getStr(MAIL_PROTOCOL), DEFAULT_PROTOCOL))
            .username(StrUtil.blankToDefault(config.getStr(MAIL_USERNAME), ""))
            .passwordConfigured(StrUtil.isNotBlank(password))
            .maskedPassword(maskSecret(password))
            .from(StrUtil.blankToDefault(config.getStr(MAIL_FROM), ""))
            .personal(StrUtil.blankToDefault(config.getStr(MAIL_PERSONAL), defaultPersonal()))
            .auth(config.getBool(MAIL_AUTH, true))
            .sslEnable(config.getBool(MAIL_SSL_ENABLE, true))
            .starttlsEnable(config.getBool(MAIL_STARTTLS_ENABLE, false))
            .starttlsRequired(config.getBool(MAIL_STARTTLS_REQUIRED, false))
            .debug(config.getBool(MAIL_DEBUG, false))
            .build();
    }

    public void updateConfig(final Long userId, final SpaceMailConfigRo request) {
        JSONObject previous = getStoredConfig();
        JSONObject config = JSONUtil.createObj();
        boolean enabled = Boolean.TRUE.equals(request.getEnabled());
        boolean auth = request.getAuth() == null || Boolean.TRUE.equals(request.getAuth());
        int port = request.getPort() == null ? DEFAULT_PORT : request.getPort();
        String provider = StrUtil.blankToDefault(StrUtil.trim(request.getProvider()), DEFAULT_PROVIDER);
        String host = StrUtil.blankToDefault(StrUtil.trim(request.getHost()), "");
        String protocol = StrUtil.blankToDefault(StrUtil.trim(request.getProtocol()), DEFAULT_PROTOCOL);
        String username = StrUtil.blankToDefault(StrUtil.trim(request.getUsername()), "");
        String from = StrUtil.blankToDefault(StrUtil.trim(request.getFrom()), "");
        String personal = StrUtil.blankToDefault(StrUtil.trim(request.getPersonal()), defaultPersonal());
        String password = previous.getStr(MAIL_PASSWORD);
        if (Boolean.TRUE.equals(request.getClearPassword())) {
            password = "";
        } else if (StrUtil.isNotBlank(request.getPassword())) {
            password = StrUtil.trim(request.getPassword());
        }

        if (enabled) {
            validateRequired(StrUtil.isNotBlank(host), "请填写 SMTP 服务器地址");
            validateRequired(port > 0 && port <= 65535, "SMTP 端口需要在 1 到 65535 之间");
            validateRequired(StrUtil.isNotBlank(from), "请填写发件邮箱");
            if (auth) {
                validateRequired(StrUtil.isNotBlank(username), "启用 SMTP 认证时需要填写用户名");
                validateRequired(StrUtil.isNotBlank(password), "启用 SMTP 认证时需要填写密码或授权码");
            }
        }

        config.set(MAIL_ENABLED, enabled);
        config.set(MAIL_PROVIDER, provider);
        config.set(MAIL_HOST, host);
        config.set(MAIL_PORT, port);
        config.set(MAIL_PROTOCOL, protocol);
        config.set(MAIL_USERNAME, username);
        config.set(MAIL_PASSWORD, StrUtil.blankToDefault(password, ""));
        config.set(MAIL_FROM, from);
        config.set(MAIL_PERSONAL, personal);
        config.set(MAIL_AUTH, auth);
        config.set(MAIL_SSL_ENABLE, Boolean.TRUE.equals(request.getSslEnable()));
        config.set(MAIL_STARTTLS_ENABLE, Boolean.TRUE.equals(request.getStarttlsEnable()));
        config.set(MAIL_STARTTLS_REQUIRED, Boolean.TRUE.equals(request.getStarttlsRequired()));
        config.set(MAIL_DEBUG, Boolean.TRUE.equals(request.getDebug()));
        systemConfigService.saveOrUpdate(userId, SystemConfigType.MAIL_SERVER_CONFIG,
            CONFIG_LANG, config.toString());
    }

    public MailServerRuntimeConfig getRuntimeConfig() {
        JSONObject config = getStoredConfig();
        if (!config.getBool(MAIL_ENABLED, false)) {
            return null;
        }
        boolean auth = config.getBool(MAIL_AUTH, true);
        String host = StrUtil.trim(config.getStr(MAIL_HOST));
        Integer port = config.getInt(MAIL_PORT, DEFAULT_PORT);
        String username = StrUtil.trim(config.getStr(MAIL_USERNAME));
        String password = StrUtil.trim(config.getStr(MAIL_PASSWORD));
        String from = StrUtil.trim(config.getStr(MAIL_FROM));
        if (StrUtil.isBlank(host) || port == null || port <= 0 || port > 65535
            || StrUtil.isBlank(from) || (auth && (StrUtil.isBlank(username) || StrUtil.isBlank(password)))) {
            return null;
        }
        return MailServerRuntimeConfig.builder()
            .provider(StrUtil.blankToDefault(config.getStr(MAIL_PROVIDER), DEFAULT_PROVIDER))
            .host(host)
            .port(port)
            .protocol(StrUtil.blankToDefault(config.getStr(MAIL_PROTOCOL), DEFAULT_PROTOCOL))
            .username(StrUtil.blankToDefault(username, ""))
            .password(StrUtil.blankToDefault(password, ""))
            .from(from)
            .personal(StrUtil.blankToDefault(config.getStr(MAIL_PERSONAL), defaultPersonal()))
            .auth(auth)
            .sslEnable(config.getBool(MAIL_SSL_ENABLE, true))
            .starttlsEnable(config.getBool(MAIL_STARTTLS_ENABLE, false))
            .starttlsRequired(config.getBool(MAIL_STARTTLS_REQUIRED, false))
            .debug(config.getBool(MAIL_DEBUG, false))
            .build();
    }

    private JSONObject getStoredConfig() {
        String config = systemConfigService.findConfig(SystemConfigType.MAIL_SERVER_CONFIG, CONFIG_LANG);
        if (StrUtil.isBlank(config) || !JSONUtil.isTypeJSONObject(config)) {
            return JSONUtil.createObj();
        }
        return JSONUtil.parseObj(config);
    }

    private String defaultPersonal() {
        return StrUtil.blankToDefault(emailSendProperties.getPersonal(), "APITable");
    }

    private void validateRequired(final boolean valid, final String message) {
        if (!valid) {
            throw new BusinessException(message);
        }
    }

    private String maskSecret(final String secret) {
        if (StrUtil.isBlank(secret)) {
            return "";
        }
        String trimmed = StrUtil.trim(secret);
        if (trimmed.length() <= 8) {
            return "****";
        }
        return trimmed.substring(0, 3) + "..." + trimmed.substring(trimmed.length() - 3);
    }

    @Data
    @Builder
    public static class MailServerRuntimeConfig {

        private String provider;

        private String host;

        private Integer port;

        private String protocol;

        private String username;

        private String password;

        private String from;

        private String personal;

        private Boolean auth;

        private Boolean sslEnable;

        private Boolean starttlsEnable;

        private Boolean starttlsRequired;

        private Boolean debug;

        public String cacheKey() {
            return String.join("|",
                StrUtil.blankToDefault(provider, ""),
                StrUtil.blankToDefault(host, ""),
                String.valueOf(port),
                StrUtil.blankToDefault(protocol, ""),
                StrUtil.blankToDefault(username, ""),
                StrUtil.blankToDefault(password, ""),
                StrUtil.blankToDefault(from, ""),
                StrUtil.blankToDefault(personal, ""),
                String.valueOf(auth),
                String.valueOf(sslEnable),
                String.valueOf(starttlsEnable),
                String.valueOf(starttlsRequired),
                String.valueOf(debug));
        }
    }
}