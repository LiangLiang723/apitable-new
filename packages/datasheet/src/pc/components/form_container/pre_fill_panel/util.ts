import { Field, FieldType, IFieldMap } from '@apitable/core';
import { compact, find } from 'lodash';
import qs from 'qs';
import { IFormData, IFormQuery } from './interface';

const FORM_FIELD_TYPE = {
  select: [FieldType.SingleSelect, FieldType.MultiSelect],
  primary: [FieldType.Member, FieldType.Link, FieldType.OneWayLink],
  number: [FieldType.Rating, FieldType.Percent, FieldType.Currency, FieldType.Number, FieldType.Phone],
  bool: [FieldType.Checkbox],
  datetime: [FieldType.DateTime],
  filter: [FieldType.Attachment, FieldType.Cascader, FieldType.WorkDoc],
};

export const formData2String = (formData: IFormData, fieldMap: IFieldMap) => {
  const newValue: IFormQuery = {};
  for (const key in formData) {
    let value = formData[key];
    const field = fieldMap[key];
    if (!field || value == null) {
      continue;
    }
    if (FORM_FIELD_TYPE.select.includes(field.type)) {
      const options = field.property.options;
      if (typeof value === 'string') {
        const option = find(options, { id: value });
        if (option?.name) {
          newValue[key] = option.name;
        }
      } else {
        const names = compact((value as string[]).map((item: string) => find(options, { id: item })?.name));
        if (names.length) {
          newValue[key] = names;
        }
      }
    } else if ([...FORM_FIELD_TYPE.primary, ...FORM_FIELD_TYPE.number].includes(field.type)) {
      newValue[key] = String(value);
    } else if (!FORM_FIELD_TYPE.filter.includes(field.type)) {
      const cellString = Field.bindModel(field).cellValueToString(value);
      if (cellString !== null) {
        newValue[key] = cellString;
      }
    }
  }
  const urlString = qs.stringify(newValue);
  return urlString ? `?${urlString}` : '';
};