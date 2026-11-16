import { FileInterceptor } from '@nestjs/platform-express';

// Shared by the HRD upload and the employee's photo request:
// one file in the "photo" field, max 5 MB (bigger files get 413).
export const PhotoUploadInterceptor = FileInterceptor('photo', {
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
});

// Swagger description of the multipart body
export const photoUploadBody = {
  schema: {
    type: 'object' as const,
    required: ['photo'],
    properties: { photo: { type: 'string' as const, format: 'binary' } },
  },
};
