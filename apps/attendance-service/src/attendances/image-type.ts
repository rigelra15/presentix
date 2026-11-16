// Checks the first bytes of an uploaded file (its "signature"), because the
// file name and the mimetype sent by the browser can be faked.
// Returns the file extension to save it with, or null when it is not a
// JPEG or PNG image.
export function getImageExtension(file: Express.Multer.File): 'jpg' | 'png' | null {
  const pngSignature = Buffer.from('89504e470d0a1a0a', 'hex');

  const isPng = file.buffer.subarray(0, 8).equals(pngSignature);

  const isJpeg =
    file.buffer.length >= 3 &&
    file.buffer[0] === 0xff &&
    file.buffer[1] === 0xd8 &&
    file.buffer[2] === 0xff;

  if (isPng && file.mimetype === 'image/png') return 'png';
  if (isJpeg && file.mimetype === 'image/jpeg') return 'jpg';

  return null;
}
