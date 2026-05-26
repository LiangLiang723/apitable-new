import * as React from 'react';
import { useEffect, useState } from 'react';
import { CloseOutlined } from '@apitable/icons';
import { Api } from '@apitable/core';
import { getEnvVariables } from 'pc/utils/env';

interface ICopilotProps {
  onClose?: (state: boolean) => void;
}

export const Copilot: React.FC<React.PropsWithChildren<ICopilotProps>> = ({ onClose }) => {
  const helpUrl = getEnvVariables().AI_API_HELP_URL || getEnvVariables().AI_TRAINING_HELP_DOC_LINK;
  const [aiConfig, setAiConfig] = useState<{ enabled?: boolean; baseUrl?: string; model?: string; apiKeyConfigured?: boolean }>();

  useEffect(() => {
    Api.getAiConfig()
      .then((res) => {
        if (res.data.success) {
          setAiConfig(res.data.data);
        }
      })
      .catch(() => setAiConfig(undefined));
  }, []);

  const configured = Boolean(aiConfig?.enabled && aiConfig?.baseUrl && aiConfig?.model && aiConfig?.apiKeyConfigured);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--defaultBg)' }}>
      <div
        style={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          borderBottom: '1px solid var(--lineColor)',
        }}
      >
        <strong style={{ fontSize: 16 }}>Copilot</strong>
        <button
          type="button"
          aria-label="关闭 Copilot"
          onClick={() => onClose?.(false)}
          style={{
            width: 32,
            height: 32,
            border: 0,
            padding: 0,
            cursor: 'pointer',
            background: 'transparent',
            color: 'var(--firstLevelText)',
          }}
        >
          <CloseOutlined size={16} />
        </button>
      </div>
      <div style={{ padding: 20, color: 'var(--firstLevelText)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{configured ? 'AI 服务已配置' : 'AI 服务未配置'}</div>
        <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--secondLevelText)' }}>
          {configured ? `当前模型：${aiConfig?.model}` : '自托管企业版已开放 Copilot 入口。连接 AI 服务后即可使用助手面板。'}
        </div>
        <a href="/management/test-function" style={{ display: 'inline-block', marginTop: 16 }}>
          打开 AI 配置
        </a>
        {helpUrl && (
          <a href={helpUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 16, marginLeft: 16 }}>
            打开 AI 配置帮助
          </a>
        )}
      </div>
    </div>
  );
};