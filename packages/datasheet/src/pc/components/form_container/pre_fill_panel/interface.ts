import { Dispatch, SetStateAction } from 'react';
import { ICellValue, IFieldMap } from '@apitable/core';

export type IFormQuery = Record<string, string | string[]>;

export type IFormData = Record<string, ICellValue>;

export interface IPreFillPanel {
  formData: IFormData;
  fieldMap: IFieldMap;
  setPreFill: Dispatch<SetStateAction<boolean>>;
  columns?: unknown[];
}

export interface IShareContent {
  suffix: string;
}