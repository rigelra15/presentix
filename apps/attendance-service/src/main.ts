import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // API docs at /docs (Swagger UI) and /docs-json (OpenAPI file)
  const config = new DocumentBuilder()
    .setTitle('Presentix Attendance Service')
    .setDescription('WFH check-in with photo and location, history and HRD monitoring.')
    .setVersion('1.0')
    .addBearerAuth()
    // Behind nginx the API lives under /api/..., so "Try it out" must use that path
    .addServer(process.env.API_BASE_PATH ?? '/')
    .build();
  SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, config));

  await app.listen(process.env.PORT ?? 3001);
}
await bootstrap();
