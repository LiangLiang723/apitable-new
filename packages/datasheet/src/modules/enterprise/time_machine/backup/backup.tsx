import { FC, useCallback, useContext, useEffect, useState } from 'react';
import { Button, Empty, Input, message, Modal, Spin, Tooltip } from 'antd';
import dayjs from 'dayjs';
import {
	DatasheetApi,
	fastCloneDeep,
	IDatasheetTablebundles,
	Navigation,
	PREVIEW_DATASHEET_ID,
	Selectors,
	StoreActions,
	Strings,
	t,
} from '@apitable/core';
import { AddOutlined, DeleteOutlined, EditOutlined, EyeOpenOutlined, RestoreOutlined } from '@apitable/icons';
import { Router } from 'pc/components/route_manager/router';
import { SideBarContext } from 'pc/context/sidebar_context';
import { useAppDispatch } from 'pc/hooks/use_app_dispatch';
import { useAppSelector } from 'pc/store/react-redux';
import styles from './style.module.less';

interface IBackupProps {
	datasheetId: string;
	setCurPreview: (revision: number | string | undefined) => void;
	curPreview: number | string;
}

export const createBackupSnapshot = (nodeId: string) => DatasheetApi.createDatasheetTablebundle(nodeId);

export const Backup: FC<IBackupProps> = ({ datasheetId, setCurPreview, curPreview }) => {
	const dispatch = useAppDispatch();
	const curDatasheet = useAppSelector((state) => Selectors.getDatasheet(state, datasheetId));
	const folderId = useAppSelector((state) => Selectors.getDatasheetParentId(state, datasheetId));
	const spaceId = useAppSelector((state) => state.space.activeId);
	const { newTdbId, setNewTdbId } = useContext(SideBarContext);
	const [list, setList] = useState<IDatasheetTablebundles[]>([]);
	const [loading, setLoading] = useState(false);
	const [operatingId, setOperatingId] = useState<string>();

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const res = await DatasheetApi.getDatasheetTablebundles(datasheetId);
			if (res.data.success) {
				setList(res.data.data || []);
				return;
			}
			message.error(res.data.message);
		} finally {
			setLoading(false);
		}
	}, [datasheetId]);

	useEffect(() => {
		load();
	}, [load]);

	useEffect(() => {
		if (newTdbId) {
			load();
		}
	}, [load, newTdbId]);

	const onCreate = useCallback(async () => {
		setOperatingId('create');
		try {
			const res = await createBackupSnapshot(datasheetId);
			if (res.data.success) {
				setNewTdbId?.(res.data.data.tbdId);
				setList((prev) => [res.data.data, ...prev.filter(item => item.tbdId !== res.data.data.tbdId)]);
				message.success(t(Strings.backup_create_success));
				return;
			}
			message.error(res.data.message);
		} finally {
			setOperatingId(undefined);
		}
	}, [datasheetId, setNewTdbId]);

	const onPreview = useCallback(async (item: IDatasheetTablebundles) => {
		if (!curDatasheet) {
			return;
		}
		setOperatingId(item.tbdId);
		try {
			const res = await DatasheetApi.previewDatasheetTablebundle(datasheetId, item.tbdId);
			if (!res.data.success) {
				message.error(res.data.message);
				return;
			}
			const cloneDatasheet = fastCloneDeep(curDatasheet)!;
			const snapshot = res.data.data.snapshot;
			cloneDatasheet.id = PREVIEW_DATASHEET_ID;
			cloneDatasheet.snapshot = { ...snapshot, datasheetId: PREVIEW_DATASHEET_ID };
			cloneDatasheet.permissions = { ...cloneDatasheet.permissions, editable: false };
			cloneDatasheet.preview = item.name;
			dispatch(StoreActions.receiveDataPack({ snapshot: cloneDatasheet.snapshot, datasheet: cloneDatasheet }, { isPartOfData: false }));
			setCurPreview(item.tbdId);
			setNewTdbId?.('');
		} finally {
			setOperatingId(undefined);
		}
	}, [curDatasheet, datasheetId, dispatch, setCurPreview, setNewTdbId]);

	const onRename = useCallback((item: IDatasheetTablebundles) => {
		let name = item.name;
		Modal.confirm({
			title: '重命名版本',
			width: 420,
			content: <Input defaultValue={item.name} maxLength={128} autoFocus onChange={(event) => { name = event.target.value; }} />,
			onOk: async () => {
				const nextName = name.trim();
				if (!nextName) {
					message.error('名称不能为空');
					return Promise.reject();
				}
				const res = await DatasheetApi.updateDatasheetTablebundle(datasheetId, item.tbdId, nextName);
				if (res.data.success) {
					setList(prev => prev.map(prevItem => prevItem.tbdId === item.tbdId ? { ...prevItem, name: nextName } : prevItem));
					return;
				}
				message.error(res.data.message);
				return Promise.reject();
			},
		});
	}, [datasheetId]);

	const onDelete = useCallback((item: IDatasheetTablebundles) => {
		Modal.confirm({
			title: '删除版本',
			content: `确定删除“${item.name}”吗？`,
			okButtonProps: { danger: true },
			onOk: async () => {
				const res = await DatasheetApi.deleteDatasheetTablebundle(datasheetId, item.tbdId);
				if (res.data.success) {
					setList(prev => prev.filter(prevItem => prevItem.tbdId !== item.tbdId));
					if (curPreview === item.tbdId) {
						dispatch(StoreActions.resetDatasheet(PREVIEW_DATASHEET_ID));
						setCurPreview(undefined);
					}
					return;
				}
				message.error(res.data.message);
				return Promise.reject();
			},
		});
	}, [curPreview, datasheetId, dispatch, setCurPreview]);

	const onRecover = useCallback((item: IDatasheetTablebundles) => {
		Modal.confirm({
			title: '恢复版本',
			width: 480,
			content: '将基于该版本创建一张新的维格表，当前表不会被覆盖。',
			onOk: async () => {
				const res = await DatasheetApi.recoverDatasheetTablebundle(datasheetId, item.tbdId, folderId || '', '版本恢复');
				if (res.data.success) {
					message.success('已恢复为新表');
					dispatch(StoreActions.resetDatasheet(PREVIEW_DATASHEET_ID));
					setCurPreview(undefined);
					Router.push(Navigation.WORKBENCH, { params: { spaceId: res.data.data.spaceId || spaceId, nodeId: res.data.data.dstId } });
					return;
				}
				message.error(res.data.message);
				return Promise.reject();
			},
		});
	}, [datasheetId, dispatch, folderId, setCurPreview, spaceId]);

	return (
		<div className={styles.wrap}>
			<div className={styles.toolbar}>
				<Button type="primary" icon={<AddOutlined />} loading={operatingId === 'create'} onClick={onCreate}>
					{t(Strings.backup_create)}
				</Button>
			</div>
			<Spin spinning={loading}>
				{list.length ? (
					<div className={styles.list}>
						{list.map((item) => {
							const active = curPreview === item.tbdId || newTdbId === item.tbdId;
							return (
								<section key={item.tbdId} className={styles.item} data-active={active} onClick={() => onPreview(item)}>
									<div className={styles.itemMain}>
										<div className={styles.name}>{item.name}</div>
										<div className={styles.meta}>
											<span>{dayjs.tz(item.createdAt).format('YYYY-MM-DD HH:mm:ss')}</span>
											{item.creatorInfo?.nikeName && <span>{item.creatorInfo.nikeName}</span>}
										</div>
									</div>
									<div className={styles.actions} onClick={(event) => event.stopPropagation()}>
										<Tooltip title="预览">
											<Button size="small" type="text" icon={<EyeOpenOutlined />} loading={operatingId === item.tbdId} onClick={() => onPreview(item)} />
										</Tooltip>
										<Tooltip title="恢复为新表">
											<Button size="small" type="text" icon={<RestoreOutlined />} onClick={() => onRecover(item)} />
										</Tooltip>
										<Tooltip title="重命名">
											<Button size="small" type="text" icon={<EditOutlined />} onClick={() => onRename(item)} />
										</Tooltip>
										<Tooltip title="删除">
											<Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => onDelete(item)} />
										</Tooltip>
									</div>
								</section>
							);
						})}
					</div>
				) : (
					!loading && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无版本" />
				)}
			</Spin>
		</div>
	);
};