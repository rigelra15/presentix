import { Body, Controller, HttpCode, HttpStatus, Post, Get, Req, UseGuards } from '@nestjs/common';

import { ThrottlerGuard } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';

import { JwtAuthGuard } from './jwt-auth.guard.js';
import type { AuthenticatedUser } from './jwt-auth.guard.js';

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
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
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