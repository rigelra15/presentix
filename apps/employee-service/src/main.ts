import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  )

  // API docs at /docs (Swagger UI) and /docs-json (OpenAPI file)
  const config = new DocumentBuilder()
    .setTitle('Employee Service')
    .setDescription('Login, current user and employee data (HRD only).')
    .setVersion('1.0')
    .addBearerAuth()
    // Behind nginx the API lives under /api/..., so "Try it out" must use that path
    .addServer(process.env.API_BASE_PATH ?? '/')
    .build();
  SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, config));

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
