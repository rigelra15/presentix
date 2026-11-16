import { IsDateString } from 'class-validator';

// HRD sends the time of the request it looked at. If the employee sent a
// newer photo in the meantime, the times differ and HRD must look again.
export class ReviewPhotoDto {
  @IsDateString()
  submittedAt!: string;
}
