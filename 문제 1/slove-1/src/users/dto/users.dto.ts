import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters long.' })
  @MaxLength(50, { message: 'Name must not exceed 50 characters.' })
  name: string;

  @IsEmail({}, { message: 'Email must be a valid email address.' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long.' })
  @Matches(/(?=.*[0-9])(?=.*[a-zA-Z])/, {
    message: 'Password must contain at least one letter and one number.',
  })
  password: string;
}

export class UserResponseDto {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}
