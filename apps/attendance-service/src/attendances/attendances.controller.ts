import { Body, Controller, Get, Header, Param, ParseIntPipe, Post, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";

import { AttendancesService } from "./attendances.service.js";
import { AttendanceAuthGuard } from "../auth/attendance-auth.guard.js";
import type { AuthenticatedRequest } from "../auth/attendance-auth.guard.js";

@Controller('attendances')
@UseGuards(AttendanceAuthGuard)
export class AttendancesController {
  constructor(
    private readonly attendancesService: AttendancesService,
  ) { }

  @Post()
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1,
        // latitude, longitude, accuracy, note
        fields: 4,
        // 500 characters can be up to 2000 bytes in UTF-8
        fieldSize: 2000,
        parts: 5,
      },
    }),
  )
  create(
    @Req() request: AuthenticatedRequest,
    @Body() body: Record<string, string>,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.attendancesService.create(request.user, body, file);
  }

  @Get('me')
  findMine(@Req() request: AuthenticatedRequest) {
    return this.attendancesService.findMine(request.user);
  }

  @Get()
  findAll(@Req() request: AuthenticatedRequest) {
    return this.attendancesService.findAll(request.user);
  }

  @Get(':id/photo')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  getPhoto(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.attendancesService.getPhoto(id, request.user);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest
  ) {
    return this.attendancesService.findOne(
      id,
      request.user
    );
  }
}