import { runLoaders } from '@satilian/router';
import { dehydrate } from '@tanstack/react-query';
import express from 'express';
import fs from 'fs';
import { resolve } from 'path';
import { renderToPipeableStream } from 'react-dom/server';
import { routesConfig } from 'src/pages/routes';
import { PassThrough } from 'stream';
import { BaseRequest } from 'src/types';
import { getQueryClient, isBot } from 'src/utils';
import App from '../../pages';

const splitPattern = '<div id="root">';
const html = fs.readFileSync(resolve('dist/index.html'), 'utf8');
const [head, tail] = html.split(splitPattern);

export const renderStream = async (
  req: BaseRequest,
  res: express.Response,
  options?: { writeToResponse?: boolean },
) => {
  const queryClient = getQueryClient();
  const matches = req.matches ?? null;
  const loaderData = { current: {} };

  await runLoaders(matches, req.path, req.query, loaderData, routesConfig.loader, { queryClient, req });

  return new Promise<string>((resolve) => {
    const write = (chunk: unknown) => {
      if (options?.writeToResponse) res.write(chunk);
    };

    write(head + splitPattern);

    const bot = isBot(req.get('user-agent'));

    const stream = renderToPipeableStream(
      <App
        pathname={req.path}
        matches={matches}
        queryClient={queryClient}
        initialState={loaderData.current}
        query={req.query}
      />,
      {
        bootstrapScriptContent: `
          window.__initialState = ${JSON.stringify(loaderData.current)};
          window.__dehydratedClient = ${JSON.stringify(dehydrate(queryClient))};
        `,
        [bot ? 'onAllReady' : 'onShellReady']() {
          getBody(stream.pipe(new PassThrough()), write).then((body) => {
            write(tail);
            resolve(head + splitPattern + body + tail);
          });
        },
        onShellError: (error) => {
          console.error('❌ [renderStream] \r\n', error);
          resolve(head + splitPattern + error + tail);
        },
        onError: (error) => {
          console.error('❌ [renderStream] \r\n', error);
          resolve(head + splitPattern + error + tail);
        },
      },
    );
  });
};

const getBody = (bodyStream: PassThrough, write: (chunk: unknown) => void) => {
  const chunks: Buffer[] = [];

  return new Promise<string>((resolve) => {
    bodyStream.on('data', (chunk) => {
      chunks.push(Buffer.from(chunk));
      write(chunk);
    });

    bodyStream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
};
