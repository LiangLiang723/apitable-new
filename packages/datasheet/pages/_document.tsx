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

import Document, { DocumentContext, Head, Html, Main, NextScript } from 'next/document';
import Script from 'next/script';
import React from 'react';
import { integrateCdnHost } from '@apitable/core';
import { getInitialProps } from '../utils/get_initial_props';
import '../utils/init_private';

const getDocumentIconUrl = (favicon?: string) => {
  if (!favicon) {
    return '/favicon.ico';
  }
  if (favicon.startsWith('http') || favicon.startsWith('/favicon') || favicon.startsWith('/file/')) {
    return favicon;
  }
  return integrateCdnHost(favicon);
};

interface IClientInfo {
  env: string;
  version: string;
  envVars: string;
  locale: string;
}

class MyDocument extends Document<IClientInfo> {
  static override async getInitialProps(ctx: DocumentContext) {
    const initialProps = await Document.getInitialProps(ctx);
    const initData = getInitialProps({ ctx }) as any;
    return {
      ...initialProps,
      ...initData,
    };
  }

  override render() {
    const { env, version, envVars, locale } = this.props;
    const envConfig = JSON.parse(envVars);
    const faviconUrl = getDocumentIconUrl(envConfig.FAVICON);
    return (
      <Html>
        <Head>
          <link rel="apple-touch-icon" href={faviconUrl} />
          <link rel="icon" type="image/x-icon" href={faviconUrl} />
          <link rel="shortcut icon" href={faviconUrl} />
          <meta property="og:image" content={faviconUrl} />
          {/* Do not send referrer in development mode to solve the problem of CDN Anti-Leech chain images not displaying. */}
          {process.env.NODE_ENV === 'development' && <meta name="referrer" content="no-referrer" />}
          <link rel="manifest" href={'/file/manifest.json'} />
          {envConfig.EMBED_BAIDU_CATCH_SDK && (
            <script src="https://rte-fe-static.bj.bcebos.com/rte-online/rte-fe-static/MultiSheetMonitor/index.js" />
          )}
          <script src="/file/js/browser_check.2.js" async />
          {/* injection of custom configs of editions, e.g. APITable */}
          <script src={`/custom/custom_config.js?version=${version}`} defer />
          {envConfig.COOKIEBOT_ID && (
            <script
              id="Cookiebot"
              src="https://consent.cookiebot.com/uc.js"
              data-cbid={envConfig.COOKIEBOT_ID}
              data-blockingmode="auto"
              async
            />
          )}
        </Head>
        <body>
          <Main />
          <NextScript />
          {!envConfig.IS_SELFHOST && <Script src="https://g.alicdn.com/AWSC/AWSC/awsc.js" strategy={'beforeInteractive'} />}
          {
            <Script id="__initialization_data__" strategy={'beforeInteractive'}>
              {`
            window.__initialization_data__ = {
                env: '${process.env.NODE_ENV === 'development' ? 'development' : env}',
                version: '${version}',
                envVars: ${envVars},
                locale:'${locale}',
                userInfo: null,
                wizards: null,
              };
            `}
            </Script>
          }
        </body>
      </Html>
    );
  }
}

export default MyDocument;
