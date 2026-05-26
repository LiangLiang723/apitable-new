import * as React from 'react';
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { IconButton, Typography } from '@apitable/components';
import { Api, IFormState, IReduxState, IShareSettings, Selectors, Strings, t } from '@apitable/core';
import { CopyOutlined } from '@apitable/icons';
import { copy2clipBoard } from 'pc/utils';
import { IShareContent } from './interface';
import styles from './style.module.less';

export const ShareContent = (props: IShareContent) => {
  const { suffix } = props;
  const { nodeShared, formId } = useSelector((state: IReduxState) => {
    const formState: IFormState = Selectors.getForm(state)!;
    return {
      nodeShared: formState.nodeShared,
      formId: formState.id,
    };
  });
  const [shareSettings, setShareSettings] = useState<IShareSettings | null>(null);

  useEffect(() => {
    const fetchShareSetting = async (id: string) => {
      const result = await Api.getShareSettings(id);
      if (result.data.success) {
        setShareSettings(result.data.data);
      }
    };
    fetchShareSetting(formId);
  }, [formId]);

  if (!nodeShared || !shareSettings?.shareId) {
    return null;
  }

  const shareUrl = `${window.location.protocol}//${window.location.host}/share/${shareSettings.shareId}${suffix}`;
  return (
    <div className={styles.section}>
      <header>
        <Typography variant="body3">{t(Strings.pre_fill_share_copy_title)}</Typography>
        <IconButton shape="square" icon={CopyOutlined} onClick={() => copy2clipBoard(shareUrl)} />
      </header>
      <div className={styles.code}>{shareUrl}</div>
    </div>
  );
};