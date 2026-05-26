import * as React from 'react';
import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { IconButton, Typography, useThemeColors } from '@apitable/components';
import { StoreActions, Strings, t } from '@apitable/core';
import { BookOutlined, ChevronRightOutlined, CloseOutlined, CopyOutlined } from '@apitable/icons';
import { Message, Tooltip } from 'pc/components/common';
import { copy2clipBoard } from 'pc/utils';
import { IPreFillPanel } from './interface';
import { ShareContent } from './share_content';
import styles from './style.module.less';
import { formData2String } from './util';

export const PreFillPanel = (props: IPreFillPanel) => {
  const { formData, fieldMap, setPreFill } = props;
  const colors = useThemeColors();
  const dispatch = useDispatch();
  const [suffix, setSuffix] = useState('');

  useEffect(() => {
    setSuffix(formData2String(formData, fieldMap));
  }, [fieldMap, formData]);

  useEffect(() => {
    if (window.innerWidth < 1500) {
      dispatch(StoreActions.setSideBarVisible(false));
    }
  }, [dispatch]);

  const formUrl = `${window.location.origin}${window.location.pathname}${suffix}`;

  return (
    <div className={styles.preFillPanel}>
      <header>
        <Typography variant="h6">{t(Strings.pre_fill_title)}</Typography>
        <IconButton shape="square" onClick={() => setPreFill(false)} icon={CloseOutlined} />
      </header>
      <div className={styles.content}>
        <div className={styles.guideWrap}>
          <span className={styles.left}>
            <BookOutlined size={16} color={colors.primaryColor} />
            <Typography variant="body3" color={colors.secondLevelText}>
              {t(Strings.pre_fill_helper_title)}
            </Typography>
          </span>
          <ChevronRightOutlined size={16} color={colors.thirdLevelText} />
        </div>
        <Typography variant="body4" className={styles.tips}>
          {t(Strings.pre_fill_content)}
        </Typography>
        <div className={styles.section}>
          <header>
            <Typography variant="body3">{t(Strings.pre_fill_copy_title)}</Typography>
            <Tooltip title={t(Strings.copy_link)}>
              <IconButton
                shape="square"
                icon={CopyOutlined}
                onClick={() => copy2clipBoard(formUrl, () => Message.success({ content: t(Strings.copy_success) }))}
              />
            </Tooltip>
          </header>
          <div className={styles.code}>{formUrl}</div>
        </div>
        <ShareContent suffix={suffix} />
      </div>
    </div>
  );
};