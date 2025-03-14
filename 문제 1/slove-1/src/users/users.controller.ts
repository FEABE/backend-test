import { Body, Controller, Post } from '@nestjs/common';
import { validateOrReject } from 'class-validator';
import { CreateUserDto, UserResponseDto } from './dto/users.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  async create(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
    await validateOrReject(createUserDto);
    return this.usersService.createUser(
      createUserDto.name,
      createUserDto.email,
      createUserDto.password,
    );
  }
}
