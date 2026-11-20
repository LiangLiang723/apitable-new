import { usePrevious, useThrottleFn } from 'ahooks';
import { useEffect, useRef } from 'react';
import * as React from 'react';
import { Api, ConfigConstant, INode, Selectors } from '@apitable/core';
import { ISearchPanelState } from 'pc/components/datasheet_search_panel/store/interface/search_panel';
import { useAppSelector } from 'pc/store/react-redux';
import { ISearchShowOption } from '../datasheet_search_panel';

interface IParams {
  folderId: string;
  localDispatch: React.Dispatch<Partial<ISearchPanelState>>;
  localState: ISearchPanelState;
  options ?: ISearchShowOption
}

export const useSearch = ({ localDispatch, folderId, localState, options }: IParams) => {
  const spaceId = useAppSelector((state) => state.space.activeId!);
  const previousCurrentFolderId = usePrevious(localState.currentFolderId);
  const activeNodeId = useAppSelector((state) => Selectors.getNodeId(state));
  const activeNodePrivate = useAppSelector((state) =>
    state.catalogTree.treeNodesMap[activeNodeId]?.nodePrivate || state.catalogTree.privateTreeNodesMap[activeNodeId]?.nodePrivate
  );

  const requestId = useRef(0);
  const { searchValue, currentFolderId } = localState;
  const { showDatasheet, showForm } = options || {};
  const { run: search, cancel: cancelSearch } = useThrottleFn((space: string, keyword: string, id: number) => {
    Api.searchNode(space, keyword.trim(), activeNodePrivate ? 3 : 1).then((res) => {
      const { data, success } = res.data;
      if (id !== requestId.current || !success) return;
      const folders = data.filter((node) => node.type === ConfigConstant.NodeType.FOLDER);
      const files: INode[] = [];
      if (showDatasheet !== false) files.push(...data.filter((node) => node.type === ConfigConstant.NodeType.DATASHEET));
      if (showForm) files.push(...data.filter((node) => node.type === ConfigConstant.NodeType.FORM));
      const searchResult = folders.length || files.length ? { folders, files } : keyword;
      localDispatch({ showSearch: true, currentFolderId: folderId, searchResult });
    }).catch(() => {});
  }, { wait: 500 });

  useEffect(() => {
    const id = ++requestId.current;
    if (!searchValue) {
      cancelSearch();
      localDispatch({ showSearch: false });
      return;
    }
    if (previousCurrentFolderId !== currentFolderId && folderId !== currentFolderId) {
      cancelSearch();
      return;
    }
    search(spaceId, searchValue, id);
    return () => { requestId.current++; };
  }, [search, cancelSearch, searchValue, spaceId, currentFolderId, previousCurrentFolderId, folderId, activeNodePrivate, showDatasheet, showForm, localDispatch]);
};
