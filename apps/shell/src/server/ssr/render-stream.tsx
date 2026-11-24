import { runLoaders } from '@satilian/router';
import { dehydrate } from '@tanstack/react-query';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PassThrough } from 'node:stream';
import { renderToPipeableStream } from 'react-dom/server';
import { routesConfig } from 'src/pages/routes';
import type { BaseRequest } from 'src/types';
import { getQueryClient } from 'src/utils/get-query-client';
import App from '../../pages';

const marker = '<div id="root">';
const template = readFileSync(resolve('dist/index.html'), 'utf8');
const [head, tail] = template.split(marker);
if (tail === undefined) throw new Error('SSR template is missing the root element');

export const renderStream = async (req: BaseRequest, authenticated: boolean): Promise<string> => {
  const queryClient = getQueryClient();
  const matches = req.matches ?? null;
  const loaderData = { current: {} };
  if (authenticated) {
    await runLoaders(matches, req.path, req.query, loaderData, routesConfig.loader, { queryClient, req });
  }

  return new Promise<string>((resolveHtml, reject) => {
    const output = new PassThrough();
    const chunks: Buffer[] = [];
    output.on('data', (chunk: Buffer) => chunks.push(chunk));
    output.once('error', reject);
    output.once('end', () => resolveHtml(head + marker + Buffer.concat(chunks).toString('utf8') + tail));

    const stream = renderToPipeableStream(
      <App
        authenticated={authenticated}
        pathname={req.path}
        matches={matches}
        queryClient={queryClient}
        initialState={loaderData.current}
        query={req.query}
      />,
      {
        bootstrapScriptContent: `
          window.__authenticated = ${authenticated};
          window.__initialState = ${JSON.stringify(loaderData.current)};
          window.__dehydratedClient = ${JSON.stringify(dehydrate(queryClient))};
        `,
        onAllReady() {
          if (!output.destroyed) stream.pipe(output);
        },
        onError(error) {
          output.destroy(error instanceof Error ? error : new Error('SSR render failed'));
        },
      },
    );
    const timeout = setTimeout(() => stream.abort(new Error('SSR render timed out')), 10_000);
    output.once('close', () => {
      clearTimeout(timeout);
      if (!output.readableEnded) stream.abort();
    });
  });
};
