import React, { PropsWithChildren } from 'react';

type IWeixinShareWrapperProps = PropsWithChildren<{
	info?: unknown;
}>;

export const WeixinShareWrapper = ({ children }: IWeixinShareWrapperProps) => <>{children}</>;