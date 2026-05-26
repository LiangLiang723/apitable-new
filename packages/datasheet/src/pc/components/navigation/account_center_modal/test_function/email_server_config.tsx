import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Button, Switch, Typography } from '@apitable/components';
import { Api } from '@apitable/core';
import { Message } from 'pc/components/common';
import { ModalOutsideOperate } from 'pc/components/common/modal_outside_operate';
import style from './style.module.less';

interface IEmailConfigForm {
  enabled: boolean;
  provider: string;
  host: string;
  port: number;
  protocol: string;
  username: string;
  password: string;
  clearPassword: boolean;
  passwordConfigured: boolean;
  maskedPassword: string;
  from: string;
  personal: string;
  auth: boolean;
  sslEnable: boolean;
  starttlsEnable: boolean;
  starttlsRequired: boolean;
  debug: boolean;
}

const DEFAULT_CONFIG: IEmailConfigForm = {
  enabled: false,
  provider: 'custom',
  host: '',
  port: 465,
  protocol: 'smtp',
  username: '',
  password: '',
  clearPassword: false,
  passwordConfigured: false,
  maskedPassword: '',
  from: '',
  personal: 'APITable',
  auth: true,
  sslEnable: true,
  starttlsEnable: false,
  starttlsRequired: false,
  debug: false,
};

const PROVIDERS = [
  { value: 'custom', label: '自定义 SMTP' },
  { value: 'qq', label: 'QQ 邮箱' },
  { value: 'starttls', label: 'STARTTLS' },
];

const PROVIDER_PRESETS: Record<string, Partial<IEmailConfigForm>> = {
  custom: {},
  qq: {
    host: 'smtp.qq.com',
    port: 465,
    protocol: 'smtp',
    auth: true,
    sslEnable: true,
    starttlsEnable: false,
    starttlsRequired: false,
  },
  starttls: {
    port: 587,
    protocol: 'smtp',
    auth: true,
    sslEnable: false,
    starttlsEnable: true,
    starttlsRequired: true,
  },
};

const EMAIL_ICON = '/static/icon/signin/signin_img_email_registered.png';

export const EmailServerConfig = () => {
  const [config, setConfig] = useState<IEmailConfigForm>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const passwordStatus = useMemo(() => {
    if (config.clearPassword) {
      return '保存后清除当前密码';
    }
    if (config.password) {
      return '保存后替换当前密码';
    }
    return config.passwordConfigured ? `已配置：${config.maskedPassword}` : '未配置';
  }, [config.clearPassword, config.maskedPassword, config.password, config.passwordConfigured]);

  useEffect(() => {
    Api.getMailConfig()
      .then((res) => {
        if (res.data.success) {
          setConfig({ ...DEFAULT_CONFIG, ...res.data.data, password: '', clearPassword: false });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const updateConfig = (patch: Partial<IEmailConfigForm>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  };

  const applyProvider = (provider: string) => {
    setConfig((prev) => ({ ...prev, provider, ...PROVIDER_PRESETS[provider] }));
  };

  const saveConfig = async () => {
    if (config.enabled && !config.host.trim()) {
      Message.error({ content: '启用邮件服务器前需要填写 SMTP 地址' });
      return;
    }
    if (config.enabled && (!config.port || config.port < 1 || config.port > 65535)) {
      Message.error({ content: 'SMTP 端口需要在 1 到 65535 之间' });
      return;
    }
    if (config.enabled && !config.from.trim()) {
      Message.error({ content: '启用邮件服务器前需要填写发件邮箱' });
      return;
    }
    if (config.enabled && config.auth && !config.username.trim()) {
      Message.error({ content: '启用 SMTP 认证时需要填写用户名' });
      return;
    }
    const willHavePassword = Boolean(config.password.trim() || (config.passwordConfigured && !config.clearPassword));
    if (config.enabled && config.auth && !willHavePassword) {
      Message.error({ content: '启用 SMTP 认证时需要填写密码或授权码' });
      return;
    }

    let success = false;
    setSaving(true);
    try {
      const res = await Api.updateMailConfig({
        enabled: config.enabled,
        provider: config.provider,
        host: config.host.trim(),
        port: Number(config.port) || DEFAULT_CONFIG.port,
        protocol: config.protocol.trim() || DEFAULT_CONFIG.protocol,
        username: config.username.trim(),
        password: config.clearPassword ? '' : config.password.trim(),
        clearPassword: config.clearPassword,
        from: config.from.trim(),
        personal: config.personal.trim() || DEFAULT_CONFIG.personal,
        auth: config.auth,
        sslEnable: config.sslEnable,
        starttlsEnable: config.starttlsEnable,
        starttlsRequired: config.starttlsRequired,
        debug: config.debug,
      });

      if (!res.data.success) {
        Message.error({ content: res.data.message });
        return;
      }
      success = true;
    } catch (error) {
      Message.error({ content: '邮件服务器配置保存失败' });
      return;
    } finally {
      setSaving(false);
    }

    if (!success) {
      return;
    }

    Message.success({ content: '邮件服务器配置已保存' });
    setLoading(true);
    Api.getMailConfig()
      .then((nextRes) => {
        if (nextRes.data.success) {
          setConfig({ ...DEFAULT_CONFIG, ...nextRes.data.data, password: '', clearPassword: false });
        }
      })
      .finally(() => setLoading(false));
  };

  const modalTitle = (
    <div className={style.modalHeader}>
      <img width={40} height={40} src={EMAIL_ICON} style={{ marginRight: 8 }} alt="" />
      <Typography variant="h4">邮箱服务器</Typography>
    </div>
  );

  const modalFooter = (
    <div className={style.modalFooter}>
      <div className={style.notes}>启用后，验证码、邀请和通知邮件将优先使用此 SMTP 服务器发送。</div>
      <div className={style.adminConfigModalActions}>
        <Button color="primary" disabled={loading || saving} loading={saving} onClick={saveConfig}>
          保存邮箱服务器配置
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <div className={style.card}>
        <div className={style.icon}>
          <Image src={EMAIL_ICON} width={46} height={46} alt="" />
        </div>
        <Typography variant="h6" style={{ paddingBottom: 16 }}>
          邮箱服务器
        </Typography>
        <div className={style.middle}>
          <p>配置实例级 SMTP 发信服务器，支持 QQ 邮箱和自定义邮箱服务。</p>
        </div>
        <div className={style.bottom}>
          <Button
            style={{ fontSize: 12 }}
            color="primary"
            variant={config.enabled ? 'jelly' : undefined}
            block
            size="small"
            disabled={loading}
            onClick={() => setShowModal(true)}
          >
            {loading ? '加载中' : config.enabled ? '查看详情' : '去配置'}
          </Button>
        </div>
      </div>

      {showModal && (
        <ModalOutsideOperate modalClassName={style.modalWrapper} modalWidth={720} showOutsideOperate onModalClose={() => setShowModal(false)}>
          <>
            {modalTitle}
            <div className={style.modalContent}>
              <div className={style.adminConfigForm}>
                <div className={style.adminConfigSwitch}>
                  <div>
                    <Typography variant="h6">启用邮箱服务器</Typography>
                    <div className={style.adminConfigDesc}>QQ 邮箱请填写 SMTP 授权码。</div>
                  </div>
                  <Switch disabled={loading || saving} checked={config.enabled} onChange={(checked) => updateConfig({ enabled: checked })} />
                </div>

                <div className={style.aiProviderTabs}>
                  {PROVIDERS.map((provider) => (
                    <button
                      key={provider.value}
                      type="button"
                      className={config.provider === provider.value ? style.aiProviderActive : undefined}
                      onClick={() => applyProvider(provider.value)}
                    >
                      {provider.label}
                    </button>
                  ))}
                </div>

                <div className={style.configGrid}>
                  <label>
                    <span>SMTP 地址</span>
                    <input value={config.host} placeholder="smtp.qq.com" onChange={(event) => updateConfig({ host: event.target.value })} />
                  </label>
                  <label>
                    <span>端口</span>
                    <input
                      value={config.port}
                      type="number"
                      min={1}
                      max={65535}
                      placeholder="465"
                      onChange={(event) => updateConfig({ port: Number(event.target.value) })}
                    />
                  </label>
                  <label>
                    <span>用户名</span>
                    <input value={config.username} placeholder="name@qq.com" onChange={(event) => updateConfig({ username: event.target.value })} />
                  </label>
                  <label>
                    <span>发件邮箱</span>
                    <input value={config.from} placeholder="name@qq.com" onChange={(event) => updateConfig({ from: event.target.value })} />
                  </label>
                  <label>
                    <span>发件人名称</span>
                    <input value={config.personal} placeholder="APITable" onChange={(event) => updateConfig({ personal: event.target.value })} />
                  </label>
                  <label>
                    <span>协议</span>
                    <input value={config.protocol} placeholder="smtp" onChange={(event) => updateConfig({ protocol: event.target.value })} />
                  </label>
                </div>

                <div className={style.aiSecretRow}>
                  <label>
                    <span>密码 / 授权码</span>
                    <input
                      value={config.password}
                      type="password"
                      placeholder={config.passwordConfigured ? '留空则保留当前密码' : 'QQ 邮箱 SMTP 授权码'}
                      onChange={(event) => updateConfig({ password: event.target.value, clearPassword: false })}
                    />
                  </label>
                  <div className={style.aiSecretMeta}>
                    <span>{passwordStatus}</span>
                    <Button
                      size="small"
                      variant="jelly"
                      disabled={!config.passwordConfigured || saving}
                      onClick={() => updateConfig({ clearPassword: true, password: '' })}
                    >
                      清除密码
                    </Button>
                  </div>
                </div>

                <div className={style.mailSwitchGrid}>
                  <label>
                    <span>SMTP 认证</span>
                    <Switch disabled={loading || saving} checked={config.auth} onChange={(checked) => updateConfig({ auth: checked })} />
                  </label>
                  <label>
                    <span>SSL</span>
                    <Switch disabled={loading || saving} checked={config.sslEnable} onChange={(checked) => updateConfig({ sslEnable: checked })} />
                  </label>
                  <label>
                    <span>STARTTLS</span>
                    <Switch disabled={loading || saving} checked={config.starttlsEnable} onChange={(checked) => updateConfig({ starttlsEnable: checked })} />
                  </label>
                  <label>
                    <span>强制 STARTTLS</span>
                    <Switch disabled={loading || saving} checked={config.starttlsRequired} onChange={(checked) => updateConfig({ starttlsRequired: checked })} />
                  </label>
                  <label>
                    <span>调试日志</span>
                    <Switch disabled={loading || saving} checked={config.debug} onChange={(checked) => updateConfig({ debug: checked })} />
                  </label>
                </div>
              </div>
            </div>
            {modalFooter}
          </>
        </ModalOutsideOperate>
      )}
    </>
  );
};