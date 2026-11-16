import {
  Controller,
  Delete,
  Get,
  Header,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';

import { EmployeesService } from './employees.service.js';
import { PhotoUploadInterceptor, photoUploadBody } from './photo-upload.js';
import { UserRole } from '../users/user-role.enum.js';
import { JwtAuthGuard, type AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

type AuthenticatedRequest = { user: AuthenticatedUser };

// The logged-in employee's own profile and profile photo.
// The employee id comes from the token, never from the URL.
@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.EMPLOYEE)
export class MyProfileController {
  constructor(private readonly employeesService: EmployeesService) { }

  @Get('profile')
  getProfile(@Req() request: AuthenticatedRequest) {
    return this.employeesService.getMyProfile(request.user.employeeId);
  }

  @Get('photo')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  getPhoto(@Req() request: AuthenticatedRequest) {
    return this.employeesService.getMyPhoto(request.user.employeeId, 'photo');
  }

  @Get('photo-request')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  getRequestedPhoto(@Req() request: AuthenticatedRequest) {
    return this.employeesService.getMyPhoto(request.user.employeeId, 'pending');
  }

  // Sends a new photo. It only becomes the profile photo after HRD approves it.
  @Put('photo-request')
  @ApiConsumes('multipart/form-data')
  @ApiBody(photoUploadBody)
  @UseInterceptors(PhotoUploadInterceptor)
  requestPhoto(
    @Req() request: AuthenticatedRequest,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.employeesService.requestPhoto(request.user.employeeId, file);
  }

  @Delete('photo-request')
  cancelPhotoRequest(@Req() request: AuthenticatedRequest) {
    return this.employeesService.cancelPhotoRequest(request.user.employeeId);
  }
}
