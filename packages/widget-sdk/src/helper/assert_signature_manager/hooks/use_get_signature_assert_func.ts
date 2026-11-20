import { useCallback, useEffect, useReducer } from 'react';
import { assertSignatureManager } from 'helper/assert_signature_manager/assert_signature_manager';

export const useGetSignatureAssertFunc = () => {
  const [, forceUpdate] = useReducer((x) => {
    return x + 1;
  }, 0);

  useEffect(() => () => assertSignatureManager.unsubscribe(forceUpdate), [forceUpdate]);
  return useCallback((url: string) => {
    const signedUrl = assertSignatureManager.getAssertSignatureUrl(url);
    if (signedUrl === undefined) {
      assertSignatureManager.subscribe(forceUpdate);
    }
    return signedUrl ?? '';
  }, [forceUpdate]);
};
