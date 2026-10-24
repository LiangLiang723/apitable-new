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

import { ILinkRecordData } from '../models/link.record.data';
import { CascaderChildren } from '../models/cascader.children';
import { isSafeObjectKey as isSafeKey } from 'shared/helpers/object.helper';
import sha1 from 'sha1';

export
interface ITreeNodeMap {
  [_: string]: { [_: string]: CascaderChildren };
}

export function getBranch(linkRecordData: ILinkRecordData, linkedFieldId: string, fieldIdToParentFieldId: { [p: string]: string }) {
  let branch = linkRecordData[linkedFieldId]!.text;
  let parentNodePosition = fieldIdToParentFieldId[linkedFieldId];
  while (parentNodePosition) {
    branch += linkRecordData[parentNodePosition!] ? linkRecordData[parentNodePosition!]!.text : '';
    parentNodePosition = fieldIdToParentFieldId[parentNodePosition];
  }
  return branch;
}

export function getValueByGroupAndKey(
  groupToMap: { [_: string]: { [_: string]: Set<CascaderChildren> } },
  group: string,
  key: string,
): Set<CascaderChildren> {
  if (!isSafeKey(group) || !isSafeKey(key)) {
    return new Set();
  }
  groupToMap[group] = groupToMap[group] || {};
  groupToMap[group]![key] = groupToMap[group]![key] || new Set();
  return groupToMap[group]![key]!;
}

/** A cascader is built from the linked fields of a view, this is a hard upper bound. */
const MAX_CASCADER_LINKED_FIELDS = 100;

export function getNode(nodesMap: ITreeNodeMap, group: string, key: string): CascaderChildren {
  if (!isSafeKey(group) || !isSafeKey(key)) {
    return undefined as unknown as CascaderChildren;
  }
  return nodesMap[group]![key]!;
}

export function setNode(nodesMap: ITreeNodeMap, group: string, key: string, value: CascaderChildren) {
  // Groups and keys are built from user supplied field values, a value such as
  // `__proto__` would otherwise be able to reach `Object.prototype`.
  if (!isSafeKey(group) || !isSafeKey(key)) {
    throw new Error('Illegal cascader key');
  }
  nodesMap[group] = nodesMap[group] || {};
  nodesMap[group]![key] = value;
}

export function initStorageContainers(linkedFieldIds: string[]) {
  // fieldIdToParentFieldId
  const fieldIdToParentFieldId: { [index: string]: string } = {};
  // fieldIdToTextToNode
  const treeNodesMap: ITreeNodeMap = {};
  // fieldIdToRecordIdToSet
  const groupToTextToSet: { [index: string]: { [index: string]: Set<CascaderChildren> } } = {};
  // The field ids come from the request, iterating an unbounded value would
  // let a caller block the event loop with a huge array.
  const safeLinkedFieldIds: string[] = Array.isArray(linkedFieldIds)
    ? linkedFieldIds.slice(0, MAX_CASCADER_LINKED_FIELDS)
    : [];
  for (let i = 0; i < safeLinkedFieldIds.length; i++) {
    const linkedFieldId: string = safeLinkedFieldIds[i]!;
    if (!isSafeKey(linkedFieldId)) {
      continue;
    }
    if (i == 0) {
      fieldIdToParentFieldId[linkedFieldId] = '';
    } else {
      fieldIdToParentFieldId[linkedFieldId] = safeLinkedFieldIds[i - 1]!;
    }
    treeNodesMap[linkedFieldId] = {};
  }
  return {
    fieldIdToParentFieldId,
    treeNodesMap,
    groupToTextToSet,
  };
}

export function linkNodeToParentNode(
  context: {
    fieldIdToParentFieldId: { [p: string]: string };
    treeNodesMap: ITreeNodeMap;
    groupToTextToSet: { [p: string]: { [p: string]: Set<CascaderChildren> } };
    treeNodes: CascaderChildren[];
  },
  linkedFieldId: string,
  linkRecordData: ILinkRecordData,
  node: CascaderChildren,
  isNewNode: boolean,
) {
  const { fieldIdToParentFieldId, treeNodesMap, groupToTextToSet, treeNodes } = context;
  // parent node
  const parentFieldId: string = fieldIdToParentFieldId[linkedFieldId]!;
  if (!!parentFieldId) {
    // -----------------Begin link node and parent node---------------------//
    if (!linkRecordData[parentFieldId]) {
      return;
    }
    const branch = getBranch(linkRecordData, parentFieldId, fieldIdToParentFieldId);
    const branchKey = sha1(branch);
    const parentNode: CascaderChildren = getNode(treeNodesMap, parentFieldId, branchKey);
    // the link exist, save that node has more than one parent node
    const parentSet: Set<CascaderChildren> = getValueByGroupAndKey(groupToTextToSet, linkedFieldId, node.linkedRecordId);
    if (!parentSet.has(parentNode)) {
      // set link
      parentNode.children.push(node);
      parentSet.add(parentNode);
    }
    // ----------------End link node and parent node------------------------//
  } else {
    // root node
    if (isNewNode) {
      treeNodes.push(node);
    }
  }
}