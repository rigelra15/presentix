import { Body, Controller, Get, Header, HttpCode, HttpStatus, Param, ParseIntPipe, ParseEnumPipe, Post, Query, Req, UploadedFiles, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiQuery, ApiTags } from "@nestjs/swagger";

import { AttendancesService } from "./attendances.service.js";
import type { CheckInFiles } from "./attendances.service.js";
import { AttendanceAuthGuard } from "../auth/attendance-auth.guard.js";
import type { AuthenticatedRequest } from "../auth/attendance-auth.guard.js";

@ApiTags('attendances')
@ApiBearerAuth()
@Controller('attendances')
@UseGuards(AttendanceAuthGuard)
export class AttendancesController {
  constructor(
    private readonly attendancesService: AttendancesService,
  ) { }

  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'photo', maxCount: 1 },
        { name: 'livenessLeft', maxCount: 1 },
        { name: 'livenessRight', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        limits: {
          fileSize: 5 * 1024 * 1024,
          files: 3,
          // latitude, longitude, accuracy, note, photoSource, challengeId
          fields: 6,
          // 500 characters can be up to 2000 bytes in UTF-8
          fieldSize: 2000,
          parts: 9,
        },
      },
    ),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['photo', 'latitude', 'longitude', 'note', 'photoSource'],
      properties: {
        photo: { type: 'string', format: 'binary', description: 'JPEG or PNG, max 5 MB' },
        latitude: { type: 'number', example: -6.175392 },
        longitude: { type: 'number', example: 106.827153 },
        accuracy: { type: 'number', example: 18, description: 'GPS accuracy in meters' },
        note: { type: 'string', example: 'Finish the monthly report', description: '3 to 500 characters' },
        photoSource: { type: 'string', enum: ['CAMERA', 'UPLOAD'] },
        challengeId: { type: 'string', description: 'From POST /attendances/liveness-challenge. Required for CAMERA' },
        livenessLeft: { type: 'string', format: 'binary', description: 'Face check frame, head turned left. Required for CAMERA' },
        livenessRight: { type: 'string', format: 'binary', description: 'Face check frame, head turned right. Required for CAMERA' },
      },
    },
  })
  create(
    @Req() request: AuthenticatedRequest,
    @Body() body: Record<string, string>,
    @UploadedFiles() files: CheckInFiles = {},
  ) {
    return this.attendancesService.create(request.user, body, files);
  }

  // Before a camera check-in: the random order of the head turns
  @Post('liveness-challenge')
  @HttpCode(HttpStatus.OK)
  createLivenessChallenge(@Req() request: AuthenticatedRequest) {
    return this.attendancesService.createLivenessChallenge(request.user);
  }

  // Must be above ':id' routes. Uses today's check-in of the logged-in employee.
  @Post('me/check-out')
  @HttpCode(HttpStatus.OK)
  checkOut(@Req() request: AuthenticatedRequest) {
    return this.attendancesService.checkOut(request.user);
  }

  @Get('me')
  findMine(@Req() request: AuthenticatedRequest) {
    return this.attendancesService.findMine(request.user);
  }

  @Get()
  @ApiQuery({ name: 'employeeId', required: false, type: Number })
  findAll(
    @Req() request: AuthenticatedRequest,
    // Optional filter, e.g. /attendances?employeeId=5
    @Query('employeeId') employeeId?: string,
  ) {
    return this.attendancesService.findAll(request.user, employeeId);
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

  // Face check frames: /attendances/5/liveness/left or /right
  @Get(':id/liveness/:side')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  getLivenessFrame(
    @Param('id', ParseIntPipe) id: number,
    @Param('side', new ParseEnumPipe(['left', 'right'])) side: 'left' | 'right',
    @Req() request: AuthenticatedRequest,
  ) {
    return this.attendancesService.getPhoto(id, request.user, side);
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