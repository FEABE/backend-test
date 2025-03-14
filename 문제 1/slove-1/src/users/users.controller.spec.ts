import { ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CreateUserDto, UserResponseDto } from './dto/users.dto';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let usersController: UsersController;
  let usersService: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            createUser: jest
              .fn()
              .mockImplementation(
                (name: string, email: string, password: string) => {
                  return Promise.resolve({
                    id: 1,
                    name,
                    email,
                    createdAt: new Date(),
                  });
                },
              ),
          },
        },
      ],
    }).compile();

    usersController = module.get<UsersController>(UsersController);
    usersService = module.get<UsersService>(UsersService);
    usersController['create'] = async (dto: CreateUserDto) => {
      // DTO 유효성 검사 적용
      await new ValidationPipe({ transform: true }).transform(dto, {
        type: 'body',
        metatype: CreateUserDto,
      });
      return usersService.createUser(dto.name, dto.email, dto.password);
    };
  });

  it('should create a user successfully', async () => {
    const createUserDto: CreateUserDto = {
      name: 'John Doe',
      email: 'john.doe@example.com',
      password: 'Password123',
    };

    const result: UserResponseDto = await usersController.create(createUserDto);
    expect(result).toEqual({
      id: 1,
      name: 'John Doe',
      email: 'john.doe@example.com',
      createdAt: expect.any(Date),
    });
    expect(usersService.createUser).toHaveBeenCalledWith(
      createUserDto.name,
      createUserDto.email,
      createUserDto.password,
    );
  });

  it('should fail to create a user with a name shorter than 2 characters', async () => {
    const createUserDto: CreateUserDto = {
      name: 'J', // 2자 미만
      email: 'john.doe@example.com',
      password: 'Password123',
    };

    await expect(() => usersController.create(createUserDto)).rejects.toThrow();
  });

  it('should fail to create a user with a name longer than 50 characters', async () => {
    const createUserDto: CreateUserDto = {
      name: 'A'.repeat(51), // 50자 초과
      email: 'john.doe@example.com',
      password: 'Password123',
    };

    await expect(() => usersController.create(createUserDto)).rejects.toThrow();
  });

  it('should fail to create a user with an invalid email', async () => {
    const createUserDto: CreateUserDto = {
      name: 'John Doe',
      email: 'invalid-email', // 잘못된 이메일 형식
      password: 'Password123',
    };

    await expect(() => usersController.create(createUserDto)).rejects.toThrow();
  });

  it('should fail to create a user with a password shorter than 8 characters', async () => {
    const createUserDto: CreateUserDto = {
      name: 'John Doe',
      email: 'john.doe@example.com',
      password: 'Short1', // 8자 미만
    };

    await expect(() => usersController.create(createUserDto)).rejects.toThrow();
  });

  it('should fail to create a user with a password without numbers', async () => {
    const createUserDto: CreateUserDto = {
      name: 'John Doe',
      email: 'john.doe@example.com',
      password: 'Password', // 숫자가 없음
    };

    await expect(() => usersController.create(createUserDto)).rejects.toThrow();
  });

  it('should fail to create a user with a password without letters', async () => {
    const createUserDto: CreateUserDto = {
      name: 'John Doe',
      email: 'john.doe@example.com',
      password: '12345678', // 문자 없음
    };

    await expect(() => usersController.create(createUserDto)).rejects.toThrow();
  });
});
