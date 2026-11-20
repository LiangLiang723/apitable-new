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

import { EntityRepository, In, Repository } from 'typeorm';
import { DatasheetRecordEntity } from '../entities/datasheet.record.entity';

@EntityRepository(DatasheetRecordEntity)
export class DatasheetRecordRepository extends Repository<DatasheetRecordEntity> {
  selectRecordsDataByDstId(dstId: string): Promise<DatasheetRecordEntity[] | undefined> {
    return this.find({
      select: ['recordId', 'data', 'recordMeta'],
      where: [{ dstId, isDeleted: false }],
    });
  }

  selectRecordsDataByDstIdIgnoreDeleted(dstId: string): Promise<DatasheetRecordEntity[] | undefined> {
    return this.find({
      select: ['recordId', 'data', 'recordMeta'],
      where: [{ dstId }],
    });
  }

  selectRevisionHistoryByDstIdAndRecordId(dstId: string, recordId: string): Promise<{ revisionHistory: string } | undefined> {
    return this.createQueryBuilder('vdr')
      .select('vdr.revision_history', 'revisionHistory')
      .where('vdr.dst_id = :dstId', { dstId })
      .andWhere('vdr.record_id = :recordId', { recordId })
      .andWhere('vdr.is_deleted = 0')
      .getRawOne<{ revisionHistory: string }>();
  }

  selectLinkRecordIdsByRecordIdAndFieldId(dstId: string, recordId: string, fieldId: string) {
    const path = `$.${fieldId}`;
    // todo(itou): replace dynamic sql
    return this.query(
      `
       SELECT vdr.data->?  as linkRecordIds
       FROM ${this.manager.connection.options.entityPrefix}datasheet_record vdr
       WHERE vdr.dst_id = ? AND vdr.record_id = ? AND vdr.is_deleted = 0 limit 1
      `,
      [path, dstId, recordId],
    );
  }

  findSingleTextCandidates(dstId: string, fieldId: string, values: string[]): Promise<{ recordId: string; fieldValue: unknown }[]> {
    // Match String.trim() whitespace and compare single-segment text byte for byte.
    // Legacy cells with multiple segments are checked by the shared normalizer in Room.
    const whitespace = '[\u0009-\u000d\u0020\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]';
    const trimPattern = `^${whitespace}+|${whitespace}+$`;
    return this.query(
      `
      SELECT recordId, fieldValue
      FROM (
        SELECT vdr.record_id AS recordId, JSON_EXTRACT(vdr.data, ?) AS fieldValue
        FROM ${this.manager.connection.options.entityPrefix}datasheet_record vdr
        WHERE vdr.dst_id = ? AND vdr.is_deleted = 0
      ) AS field_values
      WHERE JSON_TYPE(fieldValue) = 'ARRAY'
        AND (JSON_LENGTH(fieldValue) > 1 OR (
          JSON_TYPE(JSON_EXTRACT(fieldValue, '$[0].text')) = 'STRING'
          AND CAST(REGEXP_REPLACE(JSON_UNQUOTE(JSON_EXTRACT(fieldValue, '$[0].text')), ?, '') AS BINARY) IN (?)
        ))
      `,
      ['$.' + JSON.stringify(fieldId), dstId, trimPattern, values],
    );
  }

  selectDeletedCountByDstIdAndRecordIs(dstId: string, recordIds: string[]): Promise<number> {
    return this.count({ where: [{ dstId, recordId: In(recordIds), isDeleted: true }] });
  }
}
