# 문제 1

NestJS 기반의 백엔드 서비스에서 **사용자 등록 API**를 구현하세요.

이 API는 새로운 사용자를 등록하고, 비밀번호를 안전하게 저장해야 합니다.

## 요구사항

**1. API 엔드포인트 -** POST /users

요청 바디 예시

```jsx
{
"name": "John Doe",
"email": "[john@example.com](mailto:john@example.com)",
"password": "securePassword123"
}
```

성공시 응답

```jsx
{
  "id": 1,
  "name": "John Doe",
  "email": "john@example.com",
  "createdAt": "2025-01-21T07:33:37.696Z"
}
```

실패시 응답

```jsx
{
  "statusCode": 409,
  "message": "Email already exists"
}
```

```jsx
{
  "statusCode": 400,
  "message": "Password must be at least 8 characters long"
}
```

**유효성 검사**

- name 필드는 최소 2자 이상, 최대 50자 이내여야 합니다.
- email 필드는 올바른 이메일 형식이어야 합니다.
- password는 최소 8자 이상이어야 하며, 숫자와 문자가 포함되어야 합니다.

**이메일 중복 검사**

- 이미 존재하는 이메일로 회원가입을 시도하면 409 Conflict 응답을 반환해야 합니다.

**비밀번호 해싱**

- 비밀번호를 암호화 하여 안전하게 저장해야 합니다.

**에러 핸들링**

- 입력값이 올바르지 않을 경우 400 Bad Request를 반환해야 합니다.

**데이터베이스 연동 (TypeORM 사용)**

- MySQL을 사용하며, **TypeORM 엔터티**를 정의하여 데이터를 저장해야 합니다.

---

### 💡 추가질문 - 비밀번호 해싱처리는 왜 하는걸까요?

- 비밀번호 해싱처리 하는 이유
  - 평문 비밀번호로 저장 할 경우 데이터베이스가 해킹 당했을 경우 해커는 모든 사용자의 비밀번호를 즉시 알게 되어 타 사이트에도 만약 이 회원이 있을 경우 똑같은 비밀번호일 확률이 높아 위험합니다. 즉 하나의 사이트에서 노출된 비밀번호가 여러사이트에도 접근이 가능한 상태이기 때문에 위험합니다.
  - FaceBook에서도 과거에 평문 비밀번호 유출 사고를 경험 했을 정도로 심각한 문제입니다.
  - 추가적으로 내부인원(개발자 혹은 내부의 데이터베이스에 접근 가능한사람)이 사용자의 비밀번호를 볼 수 있다는 점도 문제입니다.

- 해싱과 암호화의 차이
  - 암호화
    - 암호화는 기본적으로 양방향 과정으로 암호화된 데이터는 적절한 키를 사용해 다시 원래 형태로 복호화 할수 있습니다. 암호화의 목적은 데이터를 보호하고, 허용된 수신자만 데이터를 읽을수 있게 하는것입니다.
  - 해싱
    - 일방향 함수로, 한번 해싱된 값에서 원래 데이터로 역으로 돌아갈 수 없습니다. 해싱은 데이터 무결성 확인과 비밀번호를 안전하게 저장하는 용도로 주로사용 됩니다. 
    - 따라서 비밀번호 저장시에 반드시 해싱을 사용 해야합니다. 시스템은 사용자가 올바른 비밀번호를 입력했는지 확인만 하면 되지, 실제 비밀번호를 알 필요가 없기 때문입니다.
  - 비밀번호 해싱 작동방식
    - 등록과정
      - 사용자가 패스워드를 입력합니다
      - 서비스레이어 (혹은 엔티티 헬퍼함수)로 해싱 알고리즘(SHA etc)을 사용하여 비밀번호 해시 값을 계산합니다.
      - 데이터베이스에 해시값을 저장합니다.
    - 로그인과정
      - 사용자가 비밀번호를 입력합니다.
      - 서비스는 같은 해싱 알고리즘을 사용하여 입력된 비밀번호의 해시값을 계산합니다.
      - 서비스는 계산된 해시값과 데이터베이스에 저장된 해시값을 비교합니다.
      - 해시값이 일치하면 사용자가 인증됩니다.
    - 이 과정에서 시스템은 어떤 시점에서도 사용자의 실제 비밀번호를 저장하지 않습니다.
    - 추가적인 보안기법
      - 레인보우 테이블 공격
        - 미리 계산된 해시값을 포함하는 레인보우 테이블을 사용하여 해시값을 빠르게 역으로 찾을 수 있습니다.
      - 솔트 기법
        - 해당 문제를 해결하기 위해 솔트(Salt)기법이 도입되었습니다.
        - 솔트는 해싱을 진행하기 전에 비밀번호에 무작위로 생성된 32개 이상의 난수를 추가하는 것입니다.
        - 이를 통해 동일한 비밀번호를 가진 사용자들도 서로 다른 해시값을 갖게 됩니다.
    - 해당 보안작업으로 인해 예전에는 비밀번호 찾기라는 기능이 존재 하였으나 점점 시간이 지날수록 초기화된 비밀번호로 로그인 한후에 새로운 비밀번호를 입력하게 만들어 졌습니다.


# 추가적인 문제 1번에서의 고려사항 
### 양방향 암호화를 통한 데이터 전송

프론트에서 백엔드로 민감한 정보를 전송할때 양방향 암호화를 사용

```jsx
import CryptoJS from 'crypto-js';

// 서버와 공유하는 비밀 키
// 해당 부분또한 환경 변수로 작성 해야합니다.
const SECRET_KEY = 'your-secret-key';

function registerUser(userData) {
  // 비밀번호 암호화
  const encryptedPassword = CryptoJS.AES.encrypt(
    userData.password,
    SECRET_KEY
  ).toString();

  // 암호화된 비밀번호로 데이터 업데이트
  const encryptedData = {
    ...userData,
    password: encryptedPassword
  };

  // API 호출
  return fetch('/api/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(encryptedData),
  });
}
```

```jsx
import * as CryptoJS from 'crypto-js';

@Post()
async create(@Body() encryptedUserDto: any): Promise<UserResponseDto> {
  // 비밀 키 (프론트엔드와 동일한 키)
  // 해당 부분또한 환경 변수로 작성 해야합니다.
  const SECRET_KEY = 'your-secret-key';
  
  // 암호화된 비밀번호 복호화
  const decryptedPassword = CryptoJS.AES.decrypt(
    encryptedUserDto.password,
    SECRET_KEY
  ).toString(CryptoJS.enc.Utf8);
  
  // CreateUserDto 생성
  const createUserDto: CreateUserDto = {
    name: encryptedUserDto.name,
    email: encryptedUserDto.email,
    password: decryptedPassword,
  };
  
  // 유효성 검사
  await validateOrReject(createUserDto);
  
  // 비밀번호 해싱 및 사용자 생성
  return this.usersService.createUser(
    createUserDto.name,
    createUserDto.email,
    createUserDto.password,
  );
}
```

### 프론트와 백엔드에서 보안을 위해 추가 되어야 하는것 입력 유효성 검사


```jsx
# 프론트엔드 react 기준
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/;

  const validateEmail = (value) => {
    if (!emailRegex.test(value)) {
      setEmailError("유효한 이메일 형식이 아닙니다.");
    } else {
      setEmailError("");
    }
  };

  const validatePassword = (value) => {
    if (value.length < 8) {
      setPasswordError("비밀번호는 최소 8자 이상이어야 합니다.");
    } else if (!passwordRegex.test(value)) {
      setPasswordError("비밀번호는 대문자, 소문자, 숫자 및 특수 문자를 포함해야 합니다.");
    } else {
      setPasswordError("");
    }
  };

```
```jsx
# 백엔드 기준 nestjs
// 유효성 검사 데코레이터가 있는 DTO
export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/, {
    message: '비밀번호는 대문자, 소문자, 숫자 및 특수 문자를 포함해야 합니다'
  })
  password: string;
}
```
---

### 백엔드에서 보안관련 설정시 추가되어야 하는점

1. CSRF 토큰을 사용하여 크로스 사이트 요청 위조 방지
```jsx
# main.ts 에서 작성 해야함
import * as csurf from 'csurf';

// main.ts에서 CSRF 미들웨어 설정
const app = await NestFactory.create(AppModule);
app.use(csurf());
```

2. Rate Limiting: 과도한 요청을 방지하기 위한 속도 제한을 구현

```jsx
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

// AppModule에 ThrottlerModule 추가
@Module({
  imports: [
    ThrottlerModule.forRoot({
      ttl: 60,
      limit: 10,
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
```
3. helmet 사용

```jsx

# main.ts 에서 사용
import helmet from 'helmet'


app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));
app.use(helmet.noSniff());
app.use(helmet.xssFilter());

1. 리소스가 같은 사이트에서만 로드되도록 제한하여 CORS(Cross-Origin Resource Sharing) 관련 보안을 강화합니다.
2. 브라우저가 MIME 타입을 추측(스니핑)하지 못하게 하여 MIME 타입 관련 보안 취약점을 방지합니다.
3. 브라우저의 내장 XSS(Cross-Site Scripting) 필터를 활성화하여 XSS 공격을 방어합니다.

```