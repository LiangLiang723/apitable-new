import { Injectable, Logger } from '@nestjs/common';
import { TableBundle, TableBundleDataSheet } from '@apitable/core';
import { DatasheetService } from 'database/datasheet/services/datasheet.service';
import { NodeService } from 'node/services/node.service';
import { CommonException, PermissionException, ServerException } from 'shared/exception';
import { IAuthHeader } from 'shared/interfaces';
import { RestService } from 'shared/services/rest/rest.service';
import { IdWorker } from 'shared/helpers/snowflake';
import { UserService } from 'user/services/user.service';
import { getConnection, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import fs from 'fs';
import path from 'path';
import { DatasheetCreateRo } from 'fusion/ros/datasheet.create.ro';
import { DatasheetEntity } from '../datasheet/entities/datasheet.entity';
import { DatasheetMetaEntity } from '../datasheet/entities/datasheet.meta.entity';
import { DatasheetRecordEntity } from '../datasheet/entities/datasheet.record.entity';
import { TableBundleLoader, TableBundleSaver } from './entities/table.bundle.options';
import { TableBundleEntity } from './entities/tablebundle.entity';
import { TimeMachineBaseService } from './time.machine.service.base';

const TABLEBUNDLE_TYPE_SNAPSHOT = 1;
const TABLEBUNDLE_STATUS_DONE = 1;
const TABLEBUNDLE_STATUS_DELETED = 2;

@Injectable()
export class TimeMachineService extends TimeMachineBaseService {
  private readonly logger = new Logger(TimeMachineService.name);

  constructor(
    private readonly datasheetService: DatasheetService,
    private readonly nodeService: NodeService,
    private readonly restService: RestService,
    private readonly userService: UserService,
  ) {
    super();
  }

  private get repository(): Repository<TableBundleEntity> {
    return getConnection().getRepository(TableBundleEntity);
  }

  private get storageRoot(): string {
    if (process.env.TABLEBUNDLE_STORAGE_DIR) {
      return process.env.TABLEBUNDLE_STORAGE_DIR;
    }
    return fs.existsSync('/apitable') ? '/apitable/tablebundles' : path.join(process.cwd(), 'data', 'tablebundles');
  }

  override async generateTableBundle(cookie: string, nodeId: string, spaceId: string, userId: string) {
    const datasheetPack = await this.datasheetService.fetchDataPack(nodeId, { cookie }, true);
    const nodeName = datasheetPack.datasheet.name || await this.nodeService.getNameByNodeId(nodeId);
    const tbdId = this.createTableBundleId();
    const storageKey = this.getStorageKey(spaceId, nodeId, tbdId);
    const filePath = this.resolveStoragePath(storageKey);

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tableBundle = TableBundle.new({ loader: new TableBundleLoader(), saver: new TableBundleSaver() });
    tableBundle.apply(new TableBundleDataSheet(datasheetPack.snapshot as any), nodeId, nodeName);
    tableBundle.save(filePath);

    const entity = this.repository.create({
      spaceId,
      dstId: nodeId,
      tbdId,
      tablebundleUrl: storageKey,
      name: this.createDefaultName(),
      type: TABLEBUNDLE_TYPE_SNAPSHOT,
      statusCode: TABLEBUNDLE_STATUS_DONE,
      createdBy: userId,
      updatedBy: userId,
    });
    await this.repository.save(entity);
    return this.toTableBundleVo(entity);
  }

  override async getDataPack(_cookie: string, _dstId: string, _spaceId: string, _userId: string) {
    return undefined;
  }

  async getTableBundles(nodeId: string, spaceId: string) {
    const entities = await this.repository.find({
      where: {
        dstId: nodeId,
        spaceId,
        type: TABLEBUNDLE_TYPE_SNAPSHOT,
        statusCode: TABLEBUNDLE_STATUS_DONE,
        isDeleted: false,
      },
      order: { createdAt: 'DESC' },
    });
    return this.withUserInfo(entities);
  }

  override async getTableBundleById(tablebundleId: string, nodeId: string, spaceId: string) {
    const entity = await this.findActiveTableBundle(tablebundleId, nodeId, spaceId);
    return this.toTableBundleVo(entity);
  }

  override async renameTableBundle(tablebundleId: string, nodeId: string, spaceId: string, userId: string, name: string) {
    const nextName = name?.trim();
    if (!nextName) {
      throw new ServerException(CommonException.SERVER_ERROR);
    }
    const entity = await this.findActiveTableBundle(tablebundleId, nodeId, spaceId);
    entity.name = nextName.slice(0, 128);
    entity.updatedBy = userId;
    entity.updatedAt = new Date();
    await this.repository.save(entity);
  }

  override async deleteTableBundle(tablebundleId: string, nodeId: string, spaceId: string, userId: string) {
    const entity = await this.findActiveTableBundle(tablebundleId, nodeId, spaceId);
    entity.statusCode = TABLEBUNDLE_STATUS_DELETED;
    entity.isDeleted = true;
    entity.deletedBy = userId;
    entity.deletedAt = new Date();
    entity.updatedBy = userId;
    entity.updatedAt = new Date();
    await this.repository.save(entity);
  }

  override async recoverTableBundle(cookie: string, tablebundleId: string, nodeId: string, spaceId: string, userId: string, folderId?: string, recoverNameSuffix?: string) {
    const entity = await this.findActiveTableBundle(tablebundleId, nodeId, spaceId);
    const snapshot = this.loadSnapshot(entity, nodeId);
    const originalName = await this.nodeService.getNameByNodeId(nodeId);
    const recoverName = this.createRecoverName(originalName, recoverNameSuffix);
    const createRo = new DatasheetCreateRo(recoverName, '');
    createRo.folderId = folderId || undefined;

    const created = await this.restService.createDatasheet(spaceId, { cookie } as IAuthHeader, createRo);
    await this.replaceDatasheetData(created.datasheetId, userId, snapshot);

    return {
      dstId: created.datasheetId,
      nodeName: recoverName,
      spaceId,
      parentId: folderId || '',
    };
  }

  override async previewTableBundle(tablebundleId: string, nodeId: string, spaceId: string) {
    const entity = await this.findActiveTableBundle(tablebundleId, nodeId, spaceId);
    return { snapshot: this.loadSnapshot(entity, nodeId) };
  }

  override async downloadTableBundle(_tablebundleId: string, _nodeId: string, _fileName: string): Promise<string> {
    return '';
  }

  private async replaceDatasheetData(dstId: string, userId: string, snapshot: any) {
    const connection = getConnection();
    await connection.transaction(async manager => {
      await manager.getRepository(DatasheetEntity).update({ dstId }, { revision: 0, updatedBy: userId, updatedAt: new Date() });
      await manager.getRepository(DatasheetMetaEntity).update(
        { dstId },
        {
          metaData: snapshot.meta,
          revision: 0,
          updatedBy: userId,
          updatedAt: new Date(),
        },
      );
      await manager.getRepository(DatasheetRecordEntity).delete({ dstId });
      const records = Object.values(snapshot.recordMap || {}).map((record: any) => manager.getRepository(DatasheetRecordEntity).create({
        id: IdWorker.nextId().toString(),
        dstId,
        recordId: record.id,
        data: record.data || {},
        recordMeta: record.recordMeta,
        revision: 0,
        revisionHistory: Array.isArray(record.revisionHistory) ? record.revisionHistory.join(',') : '0',
        createdBy: userId,
        updatedBy: userId,
        createdAt: record.createdAt ? new Date(record.createdAt) : new Date(),
        updatedAt: record.updatedAt ? new Date(record.updatedAt) : new Date(),
      }));
      if (records.length) {
        await manager.getRepository(DatasheetRecordEntity).insert(records);
      }
    });
  }

  private loadSnapshot(entity: TableBundleEntity, nodeId: string) {
    const tableBundle = TableBundle.new({ loader: new TableBundleLoader(), saver: new TableBundleSaver() });
    tableBundle.loadFile(this.resolveStoragePath(entity.tablebundleUrl));
    const dataSheet = tableBundle.getDataSheet(nodeId);
    if (!dataSheet?.snapshot) {
      this.logger.error(`Tablebundle ${entity.tbdId} has no snapshot for node ${nodeId}`);
      throw new ServerException(CommonException.SERVER_ERROR);
    }
    return dataSheet.snapshot;
  }

  private async findActiveTableBundle(tablebundleId: string, nodeId: string, spaceId: string) {
    const entity = await this.repository.findOne({
      where: {
        tbdId: tablebundleId,
        dstId: nodeId,
        spaceId,
        type: TABLEBUNDLE_TYPE_SNAPSHOT,
        statusCode: TABLEBUNDLE_STATUS_DONE,
        isDeleted: false,
      },
    });
    if (!entity) {
      throw new ServerException(PermissionException.NODE_NOT_EXIST);
    }
    return entity;
  }

  private async withUserInfo(entities: TableBundleEntity[]) {
    const userIds = Array.from(new Set(entities.flatMap(entity => [entity.createdBy, entity.deletedBy]).filter(Boolean)));
    const users = userIds.length ? await this.userService.selectUserBaseInfoByIds(userIds.map(id => Number(id))) : [];
    const userMap = new Map(users.map(user => [String(user.id), user]));
    return entities.map(entity => this.toTableBundleVo(entity, userMap));
  }

  private toTableBundleVo(entity: TableBundleEntity, userMap?: Map<string, any>) {
    const creator = userMap?.get(entity.createdBy);
    const deleter = entity.deletedBy ? userMap?.get(entity.deletedBy) : undefined;
    return {
      id: entity.id,
      tbdId: entity.tbdId,
      name: entity.name,
      spaceId: entity.spaceId,
      dstId: entity.dstId,
      statusCode: entity.statusCode,
      createdAt: entity.createdAt,
      deletedAt: entity.deletedAt,
      createdBy: entity.createdBy,
      expiredAt: entity.expiredAt,
      creatorInfo: this.toUserInfo(entity.createdBy, creator),
      deleteInfo: deleter ? this.toUserInfo(entity.deletedBy, deleter) : undefined,
      isDeleted: entity.isDeleted,
      deletedBy: entity.deletedBy,
      type: entity.type,
    };
  }

  private toUserInfo(userId: string, user?: any) {
    return {
      id: user?.id || userId || '',
      uuid: user?.uuid || '',
      avatar: user?.avatar || null,
      nikeName: user?.nikeName || '',
      isSocialNameModified: Number(user?.isSocialNameModified || 0),
      color: user?.color == null ? null : Number(user.color),
    };
  }

  private createTableBundleId() {
    return `tbd${Date.now().toString(36)}${randomBytes(6).toString('hex')}`;
  }

  private createDefaultName() {
    const now = new Date();
    const pad = (value: number) => value.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }

  private createRecoverName(originalName: string, recoverNameSuffix?: string) {
    const suffix = recoverNameSuffix?.trim() || '版本恢复';
    return `${originalName} ${suffix}`.slice(0, 255);
  }

  private getStorageKey(spaceId: string, nodeId: string, tbdId: string) {
    return path.join(spaceId, nodeId, `${tbdId}.tbd`);
  }

  private resolveStoragePath(storageKey: string) {
    return path.join(this.storageRoot, storageKey);
  }
}