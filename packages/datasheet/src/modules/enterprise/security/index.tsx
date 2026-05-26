import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Button, Switch, Typography } from '@apitable/components';
import { Api, Strings, t } from '@apitable/core';
import { Message } from 'pc/components/common';
import { getEnvVariables } from 'pc/utils/env';
import styles from './style.module.less';

interface ISpaceFeature {
  fileSharable?: boolean;
  invitable?: boolean;
  joinable?: boolean;
  allowDownloadAttachment?: boolean;
  allowCopyDataToExternal?: boolean;
  mobileShowable?: boolean;
  watermarkEnable?: boolean;
  exportLevel?: number;
  orgIsolated?: boolean;
  rootManageable?: boolean;
}

type FeatureKey = keyof ISpaceFeature;

interface ISettingItem {
  key: FeatureKey;
  title: string;
  description: string;
  visible: boolean;
  invert?: boolean;
}

export const Security = () => {
  const vars = getEnvVariables();
  const [feature, setFeature] = useState<ISpaceFeature>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const exportOptions = useMemo(
    () => [
      { value: 0, label: t(Strings.disable) },
      { value: 1, label: t(Strings.security_setting_export_data_read_only) },
      { value: 2, label: t(Strings.security_setting_export_data_editable) },
      { value: 3, label: t(Strings.security_setting_export_data_manageable) },
    ],
    [],
  );

  const settings = useMemo<ISettingItem[]>(
    () => [
      {
        key: 'watermarkEnable',
        title: t(Strings.security_show_watermark),
        description: t(Strings.security_show_watermark_description),
        visible: vars.SECURITY_GLOBAL_WATERMARK_VISIBLE,
      },
      {
        key: 'allowCopyDataToExternal',
        title: t(Strings.security_setting_copy_cell_data_title),
        description: t(Strings.security_setting_copy_cell_data_describle),
        visible: vars.SECURITY_MEMBER_COPY_DATA_VISIBLE,
      },
      {
        key: 'allowDownloadAttachment',
        title: t(Strings.security_setting_download_file_title),
        description: t(Strings.security_setting_download_file_describle),
        visible: vars.SECURITY_MEMBER_DOWNLOAD_ATTCHMENT_VISIBLE,
      },
      {
        key: 'fileSharable',
        title: t(Strings.security_setting_share_title),
        description: t(Strings.security_setting_share_describle),
        visible: vars.SECURITY_MEMBER_CREATE_PUBLIC_LINK_VISIBLE,
      },
      {
        key: 'invitable',
        title: t(Strings.security_setting_invite_member_title),
        description: t(Strings.security_setting_invite_member_describle),
        visible: vars.SECURITY_MEMBER_INVITE_USER_VISIBLE,
      },
      {
        key: 'joinable',
        title: t(Strings.security_setting_apply_join_space_title),
        description: t(Strings.security_setting_apply_join_space_describle),
        visible: vars.SECURITY_USER_APPLY_TO_JOIN_SPACE_VISIBLE,
      },
      {
        key: 'orgIsolated',
        title: t(Strings.security_address_list_isolation),
        description: t(Strings.security_address_list_isolation_describe),
        visible: vars.SECURITY_CONTACTS_ISOLATION_VISIBLE,
      },
      {
        key: 'mobileShowable',
        title: t(Strings.security_show_mobile),
        description: t(Strings.security_show_mobile_description),
        visible: vars.SECURITY_SHOW_MEMBER_PHONE_NUMBER_VISIBLE,
      },
      {
        key: 'rootManageable',
        title: t(Strings.security_setting_catalog_management_title),
        description: t(Strings.security_setting_catalog_management_describle),
        visible: vars.SECURITY_MEMBER_MODIFY_ROOT_CATALOG_VISIBLE,
      },
    ],
    [vars],
  );

  useEffect(() => {
    Api.getSpaceFeatures()
      .then((res) => {
        if (res.data.success) {
          setFeature(res.data.data || {});
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const updateFeature = async (key: FeatureKey, value: boolean | number) => {
    const previous = feature;
    const next = { ...feature, [key]: value };
    setFeature(next);
    setSavingKey(key);
    const result = await Api.updateSecuritySetting({ [key]: value } as any);
    setSavingKey(null);
    if (!result.data.success) {
      setFeature(previous);
      Message.error({ content: result.data.message });
      return;
    }
    Message.success({ content: t(Strings.ai_update_setting_success) });
  };

  return (
    <div className={styles.page}>
      <Typography variant="h1">{t(Strings.permission_and_security)}</Typography>
      <Typography variant="body2" className={styles.description}>
        {t(Strings.permission_and_security_content)}
      </Typography>
      <div className={styles.list}>
        {settings
          .filter((item) => item.visible)
          .map((item) => (
            <div className={styles.row} key={item.key}>
              <div className={styles.text}>
                <Typography variant="h6">{item.title}</Typography>
                <Typography variant="body4">{item.description}</Typography>
              </div>
              <Switch
                disabled={loading || savingKey === item.key}
                checked={Boolean(feature[item.key])}
                onChange={(checked) => updateFeature(item.key, checked)}
              />
            </div>
          ))}
        {vars.SECURITY_SPECIFY_MEMBER_TO_EXPORT_DATA_VISIBLE && (
          <div className={styles.row}>
            <div className={styles.text}>
              <Typography variant="h6">{t(Strings.security_setting_export_data_title)}</Typography>
              <Typography variant="body4">{t(Strings.security_setting_export_data_describle)}</Typography>
            </div>
            <div className={styles.segmented}>
              {exportOptions.map((option) => (
                <Button
                  key={option.value}
                  size="small"
                  variant={feature.exportLevel === option.value ? 'fill' : 'jelly'}
                  disabled={loading || savingKey === 'exportLevel'}
                  onClick={() => updateFeature('exportLevel', option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};