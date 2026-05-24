import dayjs from 'dayjs';
import { useEffect } from 'react';
import store from 'store2';
import { ConfigConstant } from '@apitable/core';
import { TriggerCommands } from 'modules/shared/apphook/trigger_commands';
import { useAppSelector } from 'pc/store/react-redux';
import { getEnvVariables } from 'pc/utils/env';

function withinFirstFiveDaysOfRegistration(time: number) {
  const now = dayjs();
  const registrationDate = dayjs(time);
  const diffInDays = now.diff(registrationDate, 'day');
  return diffInDays <= 5;
}

function withinLast48Hours(time: number) {
  const now = dayjs();
  const givenTime = dayjs(time);
  const diffInHours = now.diff(givenTime, 'hour');
  return diffInHours < 48;
}

const LAST_PAYMENT_REMINDER_TIME = 'LAST_PAYMENT_REMINDER_TIME';

function isSelfHostedEnterpriseMode(subscription: any) {
  const env = getEnvVariables();
  return (
    env.SELF_HOSTED_ENTERPRISE ||
    env.IS_SELFHOST ||
    env.IS_ENTERPRISE ||
    subscription?.product?.toLowerCase?.() === 'enterprise' ||
    subscription?.plan?.toLowerCase?.() === 'enterprise'
  );
}

export const usePaymentReminder = () => {
  const userInfo = useAppSelector((state) => state.user?.info);
  const subscription = useAppSelector((state) => state.billing?.subscription);

  useEffect(() => {
    if (!userInfo || !subscription) return;

    if (isSelfHostedEnterpriseMode(subscription)) return;

    const signUpTime = userInfo.signUpTime;
    const isTrial = subscription?.onTrial;
    const isSubscribed = subscription?.deadline !== -1;

    if (isSubscribed || isTrial) return;

    if (withinLast48Hours(Number(signUpTime))) return;

    const lastReminderTime = store.get(LAST_PAYMENT_REMINDER_TIME);

    if (lastReminderTime && withinLast48Hours(lastReminderTime)) return;

    store.set(LAST_PAYMENT_REMINDER_TIME, Date.now());

    if (withinFirstFiveDaysOfRegistration(Number(signUpTime))) {
      if (getEnvVariables().IS_AITABLE) {
        TriggerCommands.open_guide_wizard?.(ConfigConstant.WizardIdConstant.AI_TABLE_VIDEO, true);
        return;
      }

      TriggerCommands.open_guide_wizard?.(ConfigConstant.WizardIdConstant.INTRODUCTION_VIDEO_14_SERVER, true);
      return;
    }

    if (getEnvVariables().IS_AITABLE) {
      TriggerCommands.open_guide_wizard?.(ConfigConstant.WizardIdConstant.PRICE_MODAL, true);
    }

    // In the open-source/self-hosted build, do not import enterprise-only usageWarnModal.
    // Missing enterprise modules must not break compilation or runtime.

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscription]);
};
