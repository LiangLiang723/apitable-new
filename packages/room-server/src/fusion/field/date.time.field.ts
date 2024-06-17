/**
 * APITable <https://github.com/apitable/apitable>
 * Copyright (C) 2022 APITable Ltd. <https://apitable.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import { ApiTipConstant, DEFAULT_TIME_ZONE, ICellValue, IField } from '@apitable/core';
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { isISO8601 } from 'class-validator';
import { BaseField } from 'fusion/field/base.field';
import { isNumber } from 'lodash';
import { DateTime } from 'luxon';
import { IFieldRoTransformOptions, IFieldValue } from 'shared/interfaces';
import { FieldManager } from '../field.manager';

@Injectable()
export class DateTimeField extends BaseField implements OnApplicationBootstrap {
  override validate(fieldValue: IFieldValue, field: IField, extra?: { [key: string]: string }) {
    if (fieldValue === null) return;
     // Time String
     if (DateTime.fromISO(fieldValue.toString()).isValid) {
      return;
    }
    // Time String
    if (DateTime.fromSQL(fieldValue.toString()).isValid) {
      return;
    }
    // Verify the number
    if (isNumber(fieldValue) && !Number.isNaN(fieldValue)) {
      return;
    }
    this.throwException(field, ApiTipConstant.api_param_datetime_field_type_error, extra);
  }

  // eslint-disable-next-line require-await
  override async roTransform(fieldValue: IFieldValue, field: IField, option: IFieldRoTransformOptions): Promise<ICellValue> {
    if (isISO8601(fieldValue, { strict: true, strictSeparator: true }) || isNumber(fieldValue)) {
      return new Date(fieldValue as string | number).getTime();
    }
    const date = DateTime.fromSQL(fieldValue!.toString(), {
      zone: field.property.timeZone || option.timeZone || DEFAULT_TIME_ZONE,
    });
    if (date.isValid) {
      return date.toMillis();
    }
    return new Date(fieldValue as string).valueOf();
  }

  onApplicationBootstrap() {
    FieldManager.setService(DateTimeField.name, this);
  }
}
