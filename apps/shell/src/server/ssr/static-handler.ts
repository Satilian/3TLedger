import type { Response } from 'express';
import { existsSync } from 'fs';
import { writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import { BaseRequest } from 'src/types';
import { renderStream } from './render-stream';

const render = process.env.RENDER_STATIC === 'true';
const staticDir = resolve(`${process.env.PUBLIC_STATIC}`);

export const staticHandler = async (req: BaseRequest, res: Response) => {
  const filePath = join(staticDir, `not-found.html`);

  try {
    if (render || !existsSync(filePath))
      await writeFile(filePath, await renderStream(req, res, { writeToResponse: true }));

    res.sendFile(filePath);
  } catch (error) {
    console.error('❌ [Genering Error]: ', error);
    res.status(500).send('<h1>An error occurred while genering the file</h1>');
  }
};
