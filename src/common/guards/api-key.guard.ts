import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

export const API_KEY_HEADER = 'x-api-key';

const digest = (value: string) => createHash('sha256').update(value).digest();

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly expected: Buffer;

  constructor(
    configService: ConfigService,
    private readonly reflector: Reflector,
  ) {
    const apiKey = configService.getOrThrow<string>('API_KEY').trim();
    if (!apiKey) throw new Error('API_KEY must not be empty');
    this.expected = digest(apiKey);
  }

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const provided = context
      .switchToHttp()
      .getRequest<Request>()
      .header(API_KEY_HEADER);

    // Hashing both sides gives equal-length buffers, so the comparison is
    // constant-time regardless of the provided key's length.
    if (!provided || !timingSafeEqual(digest(provided), this.expected)) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
