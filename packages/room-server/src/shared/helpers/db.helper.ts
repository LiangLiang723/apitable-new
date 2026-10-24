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

import { In, ObjectLiteral, Repository } from 'typeorm';

/** Upper bound for the number of ids a single batched query is allowed to expand to. */
const MAX_BATCH_RECORD_IDS = 100000;

export async function batchQueryByRecordIdIn<T extends ObjectLiteral>(
  repository: Repository<T>,
  select: string[],
  recordIds: string[],
  whereConditions: ObjectLiteral,
  batchSize = 1000,
) {
  // The parameter arrives from a request body and is not guaranteed to be an
  // array at runtime: a string would silently be sliced and iterated instead.
  if (!Array.isArray(recordIds)) {
    throw new TypeError('recordIds must be an array of strings');
  }
  if (recordIds.length > MAX_BATCH_RECORD_IDS) {
    throw new RangeError(`recordIds must not exceed ${MAX_BATCH_RECORD_IDS} entries`);
  }
  const totalRecords = recordIds.length;
  let offset = 0;
  let records: any[] = [];

  while (offset < totalRecords) {
    const batchRecordIds = recordIds.slice(offset, offset + batchSize);

    const batchRecords = await repository.find({
      select,
      where: { recordId: In(batchRecordIds), ...whereConditions },
    });

    records = records.concat(batchRecords);

    offset += batchSize;
  }

  return records;
}
