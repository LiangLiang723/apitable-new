import { useAtomValue } from 'jotai';
import { atomWithImmer } from 'jotai-immer';
import { selectAtom } from 'jotai/utils';
import { useMemo } from 'react';

export type AutomationTaskStatus = 'running' | 'success' | 'initial';

const automationTaskMap = atomWithImmer<Map<string, AutomationTaskStatus>>(
  new Map<string, AutomationTaskStatus>()
);
export { automationTaskMap };

export function useAutomationTaskStatus(recordId: string, fieldId: string): AutomationTaskStatus {
  const status = useMemo(() => selectAtom(automationTaskMap, (tasks) => tasks.get(`${recordId}-${fieldId}`) ?? 'initial'), [recordId, fieldId]);
  return useAtomValue(status);
}

