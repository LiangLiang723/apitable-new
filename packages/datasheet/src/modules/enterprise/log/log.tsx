import * as React from 'react';
import { useEffect, useState } from 'react';
import { Button, Typography } from '@apitable/components';
import { Api, Strings, t } from '@apitable/core';
import { Message } from 'pc/components/common';
import { useAppSelector } from 'pc/store/react-redux';
import styles from './style.module.less';

interface IAuditRecord {
  action?: string;
  category?: string;
  createdAt?: string;
  info?: unknown;
  ipAddress?: string;
  memberName?: string;
  userAgent?: string;
}

interface IAuditPage {
  records?: IAuditRecord[];
  pageNum?: number;
  pages?: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
}

const pageSize = 20;

const auditActionMap: Record<string, string> = {
  create_space: Strings.audit_space_create,
  rename_space: Strings.audit_space_rename,
  update_space_logo: Strings.audit_space_update_logo,
  delete_space: Strings.audit_space_delete,
  cancel_delete_space: Strings.audit_space_cancel_delete,
  actual_delete_space: Strings.audit_space_complete_delete,
  create_node: Strings.audit_space_node_create,
  rename_node: Strings.audit_space_node_rename,
  update_node_icon: Strings.audit_space_node_update_icon,
  update_node_cover: Strings.audit_space_node_update_cover,
  update_node_desc: Strings.audit_space_node_update_desc,
  import_node: Strings.audit_space_node_import,
  copy_node: Strings.audit_space_node_copy,
  move_node: Strings.audit_space_node_move,
  sort_node: Strings.audit_space_node_sort,
  export_node: Strings.audit_space_node_export,
  delete_node: Strings.audit_space_node_delete,
  recover_rubbish_node: Strings.audit_space_rubbish_node_recover,
  delete_rubbish_node: Strings.audit_space_rubbish_node_delete,
  quote_template: Strings.audit_quote_template,
  store_share_node: Strings.audit_store_share_node,
  enable_node_share: Strings.audit_enable_node_share,
  update_node_share_setting: Strings.audit_update_node_share_setting,
  disable_node_share: Strings.audit_disable_node_share,
  enable_node_role: Strings.audit_enable_node_role,
  disable_node_role: Strings.audit_disable_node_role,
  add_node_role: Strings.audit_add_node_role,
  update_node_role: Strings.audit_update_node_role,
  delete_node_role: Strings.audit_delete_node_role,
  create_template: Strings.audit_create_template,
  delete_template: Strings.audit_delete_template,
};

const auditCategoryMap: Record<string, string> = {
  SPACE_CHANGE_EVENT: Strings.audit_space_change_event,
  WORK_CATALOG_CHANGE_EVENT: Strings.audit_work_catalog_change_event,
  WORK_CATALOG_SHARE_EVENT: Strings.audit_work_catalog_share_event,
  WORK_CATALOG_PERMISSION_CHANGE_EVENT: Strings.audit_work_catalog_permission_change_event,
  SPACE_TEMPLATE_EVENT: Strings.audit_space_template_event,
};

const infoLabelMap: Record<string, string> = {
  createdAt: '创建时间',
  datasheetName: '维格表名称',
  fieldName: '字段名称',
  memberName: '成员',
  nodeId: '文件节点 ID',
  nodeName: '文件节点名称',
  nodeType: '文件节点类型',
  oldNodeName: '原文件节点名称',
  oldSpaceName: '原空间站名称',
  parentName: '目标文件夹',
  role: '权限角色',
  spaceName: '空间站名称',
  sourceNodeName: '源文件节点名称',
  unitName: '成员或小组',
  unitNames: '成员或小组',
};

const formatTime = (value?: string) => {
  if (!value) {
    return '-';
  }
  return value.replace('T', ' ').slice(0, 19);
};

const translateAuditAction = (action?: string) => {
  if (!action) {
    return '-';
  }
  return t(auditActionMap[action] || action);
};

const translateAuditCategory = (category?: string) => {
  if (!category) {
    return '-';
  }
  return t(auditCategoryMap[category] || category);
};

const parseInfo = (info?: unknown) => {
  if (!info) {
    return null;
  }
  if (typeof info === 'string') {
    try {
      return JSON.parse(info);
    } catch {
      return info;
    }
  }
  return info;
};

const formatInfoValue = (value: unknown) => {
  if (value == null || value === '') {
    return '-';
  }
  if (Array.isArray(value)) {
    return value.map(formatInfoValue).join('、');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
};

const formatInfo = (info?: unknown) => {
  const parsedInfo = parseInfo(info);
  if (!parsedInfo) {
    return '-';
  }
  if (typeof parsedInfo === 'string') {
    return parsedInfo || '-';
  }
  if (typeof parsedInfo === 'object') {
    const entries = Object.entries(parsedInfo as Record<string, unknown>).filter(([, value]) => value != null && value !== '');
    if (!entries.length) {
      return '-';
    }
    return entries.map(([key, value]) => `${infoLabelMap[key] || key}：${formatInfoValue(value)}`).join('；');
  }
  return formatInfoValue(parsedInfo);
};

export const Log = () => {
  const spaceId = useAppSelector((state) => state.space.activeId);
  const [pageNo, setPageNo] = useState(1);
  const [page, setPage] = useState<IAuditPage>({ records: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!spaceId) {
      return;
    }
    setLoading(true);
    Api.getSpaceAudit({ spaceId, pageNo, pageSize })
      .then((res) => {
        if (res.data.success) {
          setPage(res.data.data || { records: [] });
          return;
        }
        Message.error({ content: res.data.message });
      })
        .catch(() => Message.error({ content: t(Strings.resource_load_failed) }))
      .finally(() => setLoading(false));
  }, [spaceId, pageNo]);

  return (
    <div className={styles.page}>
      <Typography variant="h1">{t(Strings.space_log_title)}</Typography>
      <div className={styles.list}>
        <div className={styles.header}>
          <Typography variant="h6">{t(Strings.action)}</Typography>
          <Typography variant="h6">{t(Strings.member)}</Typography>
          <Typography variant="h6">{t(Strings.time)}</Typography>
          <Typography variant="h6">{t(Strings.automation_detail)}</Typography>
        </div>
        {loading && <div className={styles.empty}>{t(Strings.loading)}</div>}
        {!loading && page.records?.length === 0 && <div className={styles.empty}>{t(Strings.no_data)}</div>}
        {!loading &&
          page.records?.map((record, index) => (
            <div className={styles.row} key={`${record.createdAt}-${record.action}-${index}`}>
              <div className={styles.action}>
                <Typography variant="body3">{translateAuditAction(record.action)}</Typography>
                <Typography variant="body4">{translateAuditCategory(record.category)}</Typography>
              </div>
              <Typography variant="body3">{record.memberName || '-'}</Typography>
              <Typography variant="body3">{formatTime(record.createdAt)}</Typography>
              <Typography variant="body4" className={styles.info}>{formatInfo(record.info)}</Typography>
            </div>
          ))}
      </div>
      <div className={styles.pager}>
        <Button size="small" variant="jelly" disabled={loading || !page.hasPreviousPage} onClick={() => setPageNo(Math.max(1, pageNo - 1))}>
          {t(Strings.previous_page)}
        </Button>
        <Typography variant="body3">{page.pageNum || pageNo} / {page.pages || 1}</Typography>
        <Button size="small" variant="jelly" disabled={loading || !page.hasNextPage} onClick={() => setPageNo(pageNo + 1)}>
          {t(Strings.next_page)}
        </Button>
      </div>
    </div>
  );
};