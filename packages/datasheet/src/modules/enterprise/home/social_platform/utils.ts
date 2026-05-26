export const getSocialWecomUnitName = (unitName?: string | Record<string, unknown>, originName?: string) => {
	if (typeof unitName === 'object') {
		return String(unitName.originName || unitName.name || '');
	}
	return originName || unitName || '';
};

const disabled = (..._args: unknown[]) => false;

export const isDingtalkSkuPage = disabled;

export const isSocialDomain = disabled;

export const isSocialWecom = disabled;

export const isSocialDingTalk = disabled;

export const isSocialFeiShu = disabled;

export const isSocialPlatformEnabled = disabled;

export const inSocialApp = disabled;

export const isDingtalkFunc = disabled;

export const isWecomFunc = disabled;

export const isContactSyncing = disabled;

export const socialPlatPreOperate = (_spaceInfo: unknown, next: () => void) => next();