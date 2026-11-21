import { Request } from 'express';
import type { Match } from '@satilian/router';

export interface BaseRequest extends Request {
  matches?: Match[] | null;
  clientWidth?: number;
}
