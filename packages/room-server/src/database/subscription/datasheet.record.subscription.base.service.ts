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

import { IRemoteChangeset } from '@apitable/core';
import { Injectable, Logger } from '@nestjs/common';
import { ICommonData } from 'database/ot/interfaces/ot.interface';
import { isEmpty, uniq } from 'lodash';
import { IdWorker } from 'shared/helpers';
import { getConnection, In, Repository } from 'typeorm';
import { DatasheetRecordSubscriptionEntity } from './entities/datasheet.record.subscription.entity';

@Injectable()
export class DatasheetRecordSubscriptionBaseService {
  private readonly logger = new Logger(DatasheetRecordSubscriptionBaseService.name);

  private get repository(): Repository<DatasheetRecordSubscriptionEntity> {
    return getConnection().getRepository(DatasheetRecordSubscriptionEntity);
  }

  public async subscribeDatasheetRecords(userId: string, dstId: string, recordIds: string[], mirrorId?: string | null) {
    if (isEmpty(recordIds)) return;
    const distinctRecordIds = this.normalizeRecordIds(recordIds);
    if (isEmpty(distinctRecordIds)) return;
    const existingRecords = await this.repository.find({
      select: ['id', 'recordId', 'isDeleted'],
      where: { dstId, createdBy: userId, recordId: In(distinctRecordIds) },
    });
    const activeRecordIds = new Set(existingRecords.filter(record => !record.isDeleted).map(record => record.recordId));
    const deletedRecordIds = uniq(existingRecords.filter(record => record.isDeleted && !activeRecordIds.has(record.recordId)).map(record => record.recordId));
    if (!isEmpty(deletedRecordIds)) {
      await this.repository.update(
        { dstId, createdBy: userId, recordId: In(deletedRecordIds) },
        { isDeleted: false, updatedBy: userId, mirrorId: mirrorId || undefined, updatedAt: new Date() },
      );
    }
    const knownRecordIds = new Set([...activeRecordIds, ...deletedRecordIds]);
    const entities = distinctRecordIds
      .filter(recordId => !knownRecordIds.has(recordId))
      .map(recordId => this.createSubscriptionEntity(userId, dstId, recordId, mirrorId));
    if (!isEmpty(entities)) {
      await this.repository.insert(entities);
    }
  }

  public async unsubscribeDatasheetRecords(userId: string, dstId: string, recordIds: string[]) {
    if (isEmpty(recordIds)) return;
    const distinctRecordIds = this.normalizeRecordIds(recordIds);
    if (isEmpty(distinctRecordIds)) return;
    await this.repository.update(
      { dstId, createdBy: userId, recordId: In(distinctRecordIds), isDeleted: false },
      { isDeleted: true, updatedBy: userId, updatedAt: new Date() },
    );
  }

  public async getSubscribedRecordIds(userId: string, dstId: string): Promise<string[]> {
    const subscriptions = await this.repository.find({
      select: ['recordId'],
      where: { dstId, createdBy: userId, isDeleted: false },
      order: { createdAt: 'DESC' },
    });
    return uniq(subscriptions.map(subscription => subscription.recordId));
  }

  public async getSubscriptionsByRecordId(dstId: string, recordId: string): Promise<DatasheetRecordSubscriptionEntity[]> {
    return await this.repository.find({ where: { dstId, recordId, isDeleted: false } });
  }

  public async getSubscriptionsByRecordIds(dstId: string, recordIds: string[]): Promise<DatasheetRecordSubscriptionEntity[]> {
    const distinctRecordIds = this.normalizeRecordIds(recordIds);
    if (isEmpty(distinctRecordIds)) return [];
    return await this.repository.find({ where: { dstId, recordId: In(distinctRecordIds), isDeleted: false } });
  }

  public async handleChangesets(_changesets: IRemoteChangeset[], _context: any) {
    await Promise.resolve();
  }

  public async handleRecordAutoSubscriptions(
    commonData: ICommonData,
    resultSet: { [key: string]: any },
  ) {
    try {
      const creatorRecordIds = this.normalizeRecordIds(resultSet.creatorAutoSubscribedRecordIds || []);
      if (commonData.userId && !isEmpty(creatorRecordIds)) {
        await this.subscribeDatasheetRecords(commonData.userId, commonData.dstId, creatorRecordIds);
      }
      const toCreate = await this.resolveUnitRecordSubscriptions(commonData.spaceId, resultSet.toCreateRecordSubscriptions || []);
      for (const [userId, recordIds] of toCreate) {
        await this.subscribeDatasheetRecords(userId, commonData.dstId, recordIds);
      }
      const toCancel = await this.resolveUnitRecordSubscriptions(commonData.spaceId, resultSet.toCancelRecordSubscriptions || []);
      for (const [userId, recordIds] of toCancel) {
        await this.unsubscribeDatasheetRecords(userId, commonData.dstId, recordIds);
      }
    } catch (error) {
      this.logger.error('Handle record auto subscriptions failed', error instanceof Error ? error.stack : String(error));
    }
  }

  private normalizeRecordIds(recordIds: string[]): string[] {
    return uniq(recordIds.filter(Boolean));
  }

  private createSubscriptionEntity(userId: string, dstId: string, recordId: string, mirrorId?: string | null): DatasheetRecordSubscriptionEntity {
    const entity = new DatasheetRecordSubscriptionEntity();
    entity.id = IdWorker.nextId().toString();
    entity.dstId = dstId;
    entity.mirrorId = mirrorId || undefined;
    entity.recordId = recordId;
    entity.createdBy = userId;
    entity.updatedBy = userId;
    entity.isDeleted = false;
    entity.createdAt = new Date();
    entity.updatedAt = new Date();
    return entity;
  }

  private async resolveUnitRecordSubscriptions(spaceId: string, unitRecordSubscriptions: { unitId: string, recordId: string }[]): Promise<Map<string, string[]>> {
    const unitIds = uniq(unitRecordSubscriptions.map(item => item.unitId).filter(Boolean));
    const userRecordIdsMap = new Map<string, string[]>();
    if (isEmpty(unitIds)) return userRecordIdsMap;
    const prefix = this.repository.manager.connection.options.entityPrefix || '';
    const units = await this.repository.manager
      .createQueryBuilder()
      .select('vu.unit_id', 'unitId')
      .addSelect('vum.user_id', 'userId')
      .from(`${prefix}unit`, 'vu')
      .innerJoin(`${prefix}unit_member`, 'vum', 'vu.unit_ref_id = vum.id')
      .where('vu.space_id = :spaceId', { spaceId })
      .andWhere('vu.unit_type = 3')
      .andWhere('vu.is_deleted = 0')
      .andWhere('vum.is_deleted = 0')
      .andWhere('vu.unit_id IN (:...unitIds)', { unitIds })
      .getRawMany<{ unitId: string, userId: string }>();
    const unitUserMap = new Map(units.map(unit => [unit.unitId, unit.userId]));
    unitRecordSubscriptions.forEach(({ unitId, recordId }) => {
      const userId = unitUserMap.get(unitId);
      if (!userId || !recordId) return;
      userRecordIdsMap.set(userId, [...(userRecordIdsMap.get(userId) || []), recordId]);
    });
    userRecordIdsMap.forEach((recordIds, userId) => {
      userRecordIdsMap.set(userId, this.normalizeRecordIds(recordIds));
    });
    return userRecordIdsMap;
  }

}
