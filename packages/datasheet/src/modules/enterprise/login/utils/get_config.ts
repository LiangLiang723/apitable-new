interface IThirdPartyLoginConfig {
	appId?: string;
	callbackUrl?: string;
}

export const getDingdingConfig = (): IThirdPartyLoginConfig => ({});

export const getQQConfig = (): IThirdPartyLoginConfig => ({});