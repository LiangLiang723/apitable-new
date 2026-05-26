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

import { decimalCeil, Strings, t } from '@apitable/core';
import { IHooksResult } from '../interface';
import { getPercent } from '../utils';

export const isUnlimited = (total: number | null | undefined) => total === -1;

export const normalizeUsageValue = (value?: number | null) => {
  if (value == null || !Number.isFinite(value) || value < 0) {
    return 0;
  }
  return value;
};

export const buildUsageResult = (used = 0, total = 0): IHooksResult => {
  const safeUsed = normalizeUsageValue(used);
  const usedText = safeUsed.toLocaleString();

  if (isUnlimited(total)) {
    const usedPercent = safeUsed ? 5 : 0;
    return {
      used: safeUsed,
      usedText,
      total,
      totalText: '-1',
      remain: -1,
      usedPercent,
      remainPercent: 100 - usedPercent,
      remainText: t(Strings.unlimited),
    };
  }

  const safeTotal = total || 0;
  const remain = Math.max(0, safeTotal - safeUsed);
  const usedPercent = safeTotal ? decimalCeil(getPercent(safeUsed / safeTotal) * 100) : 0;

  return {
    used: safeUsed,
    usedText,
    total: safeTotal,
    totalText: safeTotal.toLocaleString(),
    remain,
    usedPercent,
    remainPercent: Math.max(0, 100 - usedPercent),
    remainText: remain.toLocaleString(),
  };
};

export const calcPercent = (used: number | undefined, total: number) => {
  const safeUsed = normalizeUsageValue(used);
  if (!safeUsed || !total || total <= 0 || total === -1) {
    return 0;
  }
  return Math.min(Math.ceil((safeUsed / total) * 100), 100);
};
