import { ComponentType } from 'react';

interface IBackupProps {
	datasheetId: string;
	setCurPreview: (revision: number | string | undefined) => void;
	curPreview: number | string;
}

export const Backup: ComponentType<IBackupProps> | undefined = undefined;

export const createBackupSnapshot: any = undefined;