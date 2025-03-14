import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { UserResponseDto } from './dto/users.dto';
import { User } from './entity/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async createUser(
    name: string,
    email: string,
    password: string,
  ): Promise<UserResponseDto> {
    const existingUser = await this.usersRepository.findOne({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }
    // 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(password, 10);

    // 새로운 유저 생성
    const newUser = this.usersRepository.create({
      name,
      email,
      password: hashedPassword,
    });
    const savedUser = await this.usersRepository.save(newUser);

    // 비밀번호 필드 제외 후 반환
    const { password: _, ...userWithoutPassword } = savedUser;
    return userWithoutPassword;
  }
}
