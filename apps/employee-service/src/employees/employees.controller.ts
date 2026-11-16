import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Header,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';

import { EmployeesService } from './employees.service.js';
import { CreateEmployeeDto } from './dto/create-employee.dto.js';
import { UpdateEmployeeDto } from './dto/update-employee.dto.js';

import { UserRole } from '../users/user-role.enum.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@ApiTags('employees')
@ApiBearerAuth()
@Controller('employees')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.HRD)
export class EmployeesController {
  constructor(
    private readonly employeesService: EmployeesService,
  ) { }

  @Get()
  findAll() {
    return this.employeesService.findAll();
  }

  // Must be above ':id', otherwise "next-code" is read as an id
  @Get('next-code')
  getNextCode() {
    return this.employeesService.getNextCode();
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.employeesService.findOne(id);
  }

  // Profile photo, used by HRD to compare with check-in photos
  @Put(':id/photo')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['photo'],
      properties: { photo: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('photo', {
      limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
    }),
  )
  setPhoto(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.employeesService.setPhoto(id, file);
  }

  @Get(':id/photo')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  getPhoto(@Param('id', ParseIntPipe) id: number) {
    return this.employeesService.getPhoto(id);
  }

  @Post()
  create(@Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(id, dto);
  }

  // Removes the employee and their login account for good.
  // Only allowed for deactivated employees without attendance records.
  @Delete(':id/permanent')
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Headers('authorization') authorization: string,
  ) {
    return this.employeesService.remove(id, authorization);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  deactivate(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.employeesService.deactivate(id);
  }
}
