import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Button, Switch, Typography } from '@apitable/components';
import { Api } from '@apitable/core';
import { Message } from 'pc/components/common';
import style from './style.module.less';

interface IAiConfigForm {
  enabled: boolean;
  provider: string;
  baseUrl: string;
  apiKey: string;
  clearApiKey: boolean;
  apiKeyConfigured: boolean;
  maskedApiKey: string;
  model: string;
  chatCompletionPath: string;
  authorizationPrefix: string;
  extraHeaders: string;
}

const DEFAULT_CONFIG: IAiConfigForm = {
  enabled: false,
  provider: 'openai-compatible',
  baseUrl: '',
  apiKey: '',
  clearApiKey: false,
  apiKeyConfigured: false,
  maskedApiKey: '',
  model: '',
  chatCompletionPath: '/v1/chat/completions',
  authorizationPrefix: 'Bearer',
  extraHeaders: '{}',
};

const PROVIDERS = [
  { value: 'openai-compatible', label: 'OpenAI 兼容' },
  { value: 'azure-openai', label: 'Azure OpenAI' },
  { value: 'anthropic-compatible', label: 'Anthropic 兼容' },
  { value: 'custom', label: '自定义' },
];

export const CopilotAiConfig = () => {
  const [config, setConfig] = useState<IAiConfigForm>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const apiKeyStatus = useMemo(() => {
    if (config.clearApiKey) {
      return '保存后清除当前密钥';
    }
    if (config.apiKey) {
      return '保存后替换当前密钥';
    }
    return config.apiKeyConfigured ? `已配置：${config.maskedApiKey}` : '未配置';
  }, [config.apiKey, config.apiKeyConfigured, config.clearApiKey, config.maskedApiKey]);

  useEffect(() => {
    Api.getAiConfig()
      .then((res) => {
        if (res.data.success) {
          setConfig({ ...DEFAULT_CONFIG, ...res.data.data, apiKey: '', clearApiKey: false });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const updateConfig = (patch: Partial<IAiConfigForm>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  };

  const normalizeExtraHeaders = () => {
    const value = config.extraHeaders.trim() || '{}';
    try {
      const parsed = JSON.parse(value);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
        return null;
      }
      return JSON.stringify(parsed);
    } catch (error) {
      return null;
    }
  };

  const saveConfig = async () => {
    const extraHeaders = normalizeExtraHeaders();
    if (extraHeaders == null) {
      Message.error({ content: '额外请求头必须是 JSON 对象' });
      return;
    }
    if (config.enabled && (!config.baseUrl.trim() || !config.model.trim())) {
      Message.error({ content: '启用 Copilot 前需要填写 API 地址和模型' });
      return;
    }
    const willHaveApiKey = Boolean(config.apiKey.trim() || (config.apiKeyConfigured && !config.clearApiKey));
    if (config.enabled && !willHaveApiKey) {
      Message.error({ content: '启用 Copilot 前需要配置 API 密钥' });
      return;
    }

    let success = false;
    setSaving(true);
    try {
      const res = await Api.updateAiConfig({
        enabled: config.enabled,
        provider: config.provider,
        baseUrl: config.baseUrl.trim(),
        apiKey: config.clearApiKey ? '' : config.apiKey.trim(),
        clearApiKey: config.clearApiKey,
        model: config.model.trim(),
        chatCompletionPath: config.chatCompletionPath.trim() || DEFAULT_CONFIG.chatCompletionPath,
        authorizationPrefix: config.authorizationPrefix.trim() || DEFAULT_CONFIG.authorizationPrefix,
        extraHeaders,
      });

      if (!res.data.success) {
        Message.error({ content: res.data.message });
        return;
      }
      success = true;
    } catch (error) {
      Message.error({ content: 'AI 配置保存失败' });
      return;
    } finally {
      setSaving(false);
    }

    if (!success) {
      return;
    }

    Message.success({ content: 'AI 配置已保存' });
    setLoading(true);
    Api.getAiConfig()
      .then((nextRes) => {
        if (nextRes.data.success) {
          setConfig({ ...DEFAULT_CONFIG, ...nextRes.data.data, apiKey: '', clearApiKey: false });
        }
      })
      .finally(() => setLoading(false));
  };

  return (
    <div className={style.aiConfigPanel}>
      <div className={style.aiConfigHeader}>
        <div>
          <Typography variant="h6">Copilot AI 接口</Typography>
          <div className={style.aiConfigDesc}>配置 OpenAI 兼容、Azure、Anthropic 兼容或自定义聊天补全接口。</div>
        </div>
        <Switch disabled={loading || saving} checked={config.enabled} onChange={(checked) => updateConfig({ enabled: checked })} />
      </div>

      <div className={style.aiProviderTabs}>
        {PROVIDERS.map((provider) => (
          <button
            key={provider.value}
            type="button"
            className={config.provider === provider.value ? style.aiProviderActive : undefined}
            onClick={() => updateConfig({ provider: provider.value })}
          >
            {provider.label}
          </button>
        ))}
      </div>

      <div className={style.aiConfigGrid}>
        <label>
          <span>API 地址</span>
          <input
            value={config.baseUrl}
            placeholder="https://api.openai.com"
            onChange={(event) => updateConfig({ baseUrl: event.target.value })}
          />
        </label>
        <label>
          <span>模型</span>
          <input value={config.model} placeholder="gpt-4o-mini" onChange={(event) => updateConfig({ model: event.target.value })} />
        </label>
        <label>
          <span>聊天接口路径</span>
          <input
            value={config.chatCompletionPath}
            placeholder="/v1/chat/completions"
            onChange={(event) => updateConfig({ chatCompletionPath: event.target.value })}
          />
        </label>
        <label>
          <span>鉴权前缀</span>
          <input
            value={config.authorizationPrefix}
            placeholder="Bearer"
            onChange={(event) => updateConfig({ authorizationPrefix: event.target.value })}
          />
        </label>
      </div>

      <div className={style.aiSecretRow}>
        <label>
          <span>API 密钥</span>
          <input
            value={config.apiKey}
            type="password"
            placeholder={config.apiKeyConfigured ? '留空则保留当前密钥' : 'sk-...'}
            onChange={(event) => updateConfig({ apiKey: event.target.value, clearApiKey: false })}
          />
        </label>
        <div className={style.aiSecretMeta}>
          <span>{apiKeyStatus}</span>
          <Button size="small" variant="jelly" disabled={!config.apiKeyConfigured || saving} onClick={() => updateConfig({ clearApiKey: true, apiKey: '' })}>
            清除密钥
          </Button>
        </div>
      </div>

      <label className={style.aiHeadersField}>
        <span>额外请求头</span>
        <textarea value={config.extraHeaders} rows={4} onChange={(event) => updateConfig({ extraHeaders: event.target.value })} />
      </label>

      <div className={style.aiConfigFooter}>
        <Button color="primary" disabled={loading || saving} loading={saving} onClick={saveConfig}>
          保存 AI 配置
        </Button>
      </div>
    </div>
  );
};