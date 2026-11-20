import { useMemoizedFn } from 'ahooks';
import { useAtomValue, useSetAtom } from 'jotai';
import { useRouter } from 'next/router';
import * as React from 'react';
import { useEffect, useRef } from 'react';
import { Strings, t } from '@apitable/core';
import { AutomationPanel } from 'pc/components/automation';
import {
  automationActionsAtom,
  automationCacheAtom,
  automationLocalMap,
  automationPanelAtom,
  automationTriggersAtom,
} from 'pc/components/automation/controller';
import { checkIfModified } from 'pc/components/automation/modal/step_input_compare';
import { Modal as ConfirmModal } from 'pc/components/common';

// Returning to the editor can remount it before the user confirms leaving.
let allowedNavigation: { url: string } | undefined;

export const AutomationPanelWrapper = React.memo(({ automationId }: { automationId: string }) => {
  const setLocalState = useSetAtom(automationLocalMap);
  const panel = useAtomValue(automationPanelAtom);
  const setCache = useSetAtom(automationCacheAtom);
  const triggers = useAtomValue(automationTriggersAtom);
  const actions = useAtomValue(automationActionsAtom);
  const localMap = useAtomValue(automationLocalMap);
  const router = useRouter();
  const detachPending = useRef<() => void>();

  const navigate = async (url: string, method: 'push' | 'replace') => {
    const navigation = { url };
    allowedNavigation = navigation;
    try {
      return await router[method](url);
    } finally {
      if (allowedNavigation === navigation) allowedNavigation = undefined;
    }
  };

  const handleNavigation = useMemoizedFn((url: string) => {
    if (router.asPath === url || allowedNavigation?.url === url) return;
    detachPending.current?.();
    setCache({ id: automationId, map: localMap, panel });
    if (!checkIfModified({ triggers, actions }, localMap)) return;

    const origin = router.asPath;
    const detach = () => {
      router.events.off('routeChangeComplete', onComplete);
      router.events.off('routeChangeError', onError);
      detachPending.current = undefined;
    };
    const onComplete = (destination: string) => {
      if (destination !== url) return;
      detach();
      navigate(origin, 'replace').then((restored) => {
        if (!restored) return;
        ConfirmModal.confirm({
          title: t(Strings.automation_not_save_warning_title),
          content: t(Strings.automation_not_save_warning_description),
          cancelText: t(Strings.cancel),
          okText: t(Strings.confirm),
          onOk: () => {
            setCache({});
            setLocalState(new Map());
            return navigate(destination, 'push').then(() => undefined);
          },
          type: 'warning',
        });
      }).catch(() => {});
    };
    const onError = (_error: unknown, destination: string) => {
      if (destination === url) detach();
    };
    // The page can unmount before Next emits the terminal event for this navigation.
    detachPending.current = detach;
    router.events.on('routeChangeComplete', onComplete);
    router.events.on('routeChangeError', onError);
  });

  useEffect(() => {
    router.events.on('routeChangeStart', handleNavigation);
    return () => router.events.off('routeChangeStart', handleNavigation);
  }, [handleNavigation, router.events]);

  return <AutomationPanel resourceId={automationId} />;
});
