import { Body, Controller, HttpCode, HttpStatus, Post, Get, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';

import { ThrottlerGuard } from '@nestjs/throttler';
import { ApiBearerAuth, ApiCookieAuth, ApiTags } from '@nestjs/swagger';

import { AuthService, REFRESH_TOKEN_DAYS } from './auth.service.js';
import type { SessionResult } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';

import { JwtAuthGuard } from './jwt-auth.guard.js';
import type { AuthenticatedUser } from './jwt-auth.guard.js';

const REFRESH_COOKIE = 'refresh_token';

// The refresh token lives in an httpOnly cookie, so page JavaScript
// (and any injected script) cannot read it. SameSite=Strict means the
// browser does not send it on requests started by other websites.
// Set COOKIE_SECURE=true when the app is served over HTTPS.
const cookieOptions = {
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: process.env.COOKIE_SECURE === 'true',
  path: '/',
};

// Reads one cookie from the Cookie header (no cookie-parser package needed)
function readRefreshCookie(request: Request): string | undefined {
  const header = request.headers.cookie ?? '';

  for (const part of header.split(';')) {
    const [name, ...value] = part.trim().split('=');

    if (name === REFRESH_COOKIE) {
      return decodeURIComponent(value.join('='));
    }
  }

  return undefined;
}

function sendSession(response: Response, session: SessionResult) {
  response.cookie(REFRESH_COOKIE, session.refreshToken, {
    ...cookieOptions,
    maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
  });

  return session.body;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
  ) { }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  // Max 5 attempts per minute, then 429 Too Many Requests
  @UseGuards(ThrottlerGuard)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return sendSession(response, await this.authService.login(dto));
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth(REFRESH_COOKIE)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      return sendSession(response, await this.authService.refresh(readRefreshCookie(request)));
    } catch (error) {
      // Remove a cookie that no longer works
      response.clearCookie(REFRESH_COOKIE, cookieOptions);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth(REFRESH_COOKIE)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authService.logout(readRefreshCookie(request));
    response.clearCookie(REFRESH_COOKIE, cookieOptions);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  // JwtAuthGuard first, so the throttler counts attempts per user
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  async changePassword(
    @Req() request: Request & { user: AuthenticatedUser },
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(request.user.id, dto, readRefreshCookie(request));
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  getMe(
    @Req() request: { user: AuthenticatedUser },
  ) {
    return request.user;
  }
}
