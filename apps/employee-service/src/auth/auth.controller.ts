import { Body, Controller, HttpCode, HttpStatus, Post, Get, Req, UseGuards } from '@nestjs/common';

import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';

import { JwtAuthGuard } from './jwt-auth.guard.js';
import type { AuthenticatedUser } from './jwt-auth.guard.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
  ) { }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(
    @Req() request: { user: AuthenticatedUser },
  ) {
    return request.user;
  }
}