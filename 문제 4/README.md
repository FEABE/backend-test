
# 문제 4

아래의 요구조건에 맞는 설계를 진행하고, 이유를 설명해주세요

작은 스타트업에서 BO 서비스에서 통계 서비스를 개발하여 합니다

1. 각 콘텐츠의 유저의 클릭수, 좋아요수를 보여주는 그래프를 그려야 합니다
2. 클릭과 좋아요 수는 BO의 대시보드에서 확인이 가능하며, 새로고침 버튼을 눌러서 갱신 가능합니다
3. 그래프는 일일 단위로 합계로 표시됩니다


## 시스템 아키텍처
통계 시스템은 다음과 같은 주요 구성 요소로 설계됩니다

- 데이터 저장소: 클릭 및 좋아요 이벤트와 집계 데이터를 저장
- 집계 서비스: 원시 데이터를 일별로 집계
- 대시보드 API: 통계 데이터를 제공하고 새로고침 기능 지원
- 백그라운드 작업: 정기적인 데이터 집계 수행

## 데이터 모델 설계

```typescript
// user.entity.ts
@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  username: string;

  // 양방향 관계 (필요시 활성화)
  @OneToMany(() => ContentClick, click => click.user)
  clicks: ContentClick[];

  @OneToMany(() => ContentLike, like => like.user)
  likes: ContentLike[];
}

// content.entity.ts
@Entity('contents')
export class Content {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  // 양방향 관계
  @OneToMany(() => ContentClick, click => click.content)
  clicks: ContentClick[];

  @OneToMany(() => ContentLike, like => like.content)
  likes: ContentLike[];

  @OneToMany(() => DailyStat, stat => stat.content)
  dailyStats: DailyStat[];
}

// content-click.entity.ts
@Entity('content_clicks')
export class ContentClick {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Content, content => content.clicks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'content_id' })
  content: Content;

  @Column({ name: 'content_id' })
  contentId: number;

  @ManyToOne(() => User, user => user.clicks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: number;

  @CreateDateColumn()
  clickedAt: Date;
}

// content-like.entity.ts
@Entity('content_likes')
export class ContentLike {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Content, content => content.likes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'content_id' })
  content: Content;
  
  @Column({ name: 'content_id' })
  contentId: number;

  @ManyToOne(() => User, user => user.likes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
  
  @Column({ name: 'user_id' })
  userId: number;

  @CreateDateColumn()
  likedAt: Date;

  @Column({ default: false })
  isCanceled: boolean;
}

// daily-stat.entity.ts
@Entity('daily_stats')
export class DailyStat {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Content, content => content.dailyStats, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'content_id' })
  content: Content;
  
  @Column({ name: 'content_id' })
  contentId: number;

  @Column({ type: 'date' })
  date: Date;

  @Column({ default: 0 })
  clickCount: number;

  @Column({ default: 0 })
  likeCount: number;
}
```

## 통계 서비스 구현
통계 데이터를 생성하고 조회하는 핵심 서비스를 구현합니다

```typescript
// statistics.service.ts
@Injectable()
export class StatisticsService {
  constructor(
    @InjectRepository(Content)
    private readonly contentRepository: Repository<Content>,
    @InjectRepository(ContentClick)
    private readonly clickRepository: Repository<ContentClick>,
    @InjectRepository(ContentLike)
    private readonly likeRepository: Repository<ContentLike>,
    @InjectRepository(DailyStat)
    private readonly statRepository: Repository<DailyStat>,
  ) {}

  // 일별 통계 조회 (관계를 활용)
  async getDailyStats(contentId: number, startDate: Date, endDate: Date) {
    return this.statRepository.find({
      where: {
        content: { id: contentId },
        date: Between(startDate, endDate),
      },
      order: {
        date: 'ASC',
      },
      relations: ['content'], // 콘텐츠 정보도 함께 로드 (필요시)
    });
  }

  // 일별 통계 집계
  async aggregateDailyStats(date: Date) {
    // 날짜 범위 설정 (해당 날짜의 00:00:00 ~ 23:59:59)
    const startTime = new Date(date);
    startTime.setHours(0, 0, 0, 0);
    
    const endTime = new Date(date);
    endTime.setHours(23, 59, 59, 999);

    // 해당 기간에 클릭이나 좋아요가 있는 모든 콘텐츠 조회
    const contentIds = await this.getUniqueContentIds(startTime, endTime);

    // 각 콘텐츠별 통계 집계
    for (const contentId of contentIds) {
      // 클릭 수 집계 - 연관관계 활용
      const clickCount = await this.clickRepository.count({
        where: {
          content: { id: contentId },
          clickedAt: Between(startTime, endTime),
        },
      });

      // 좋아요 수 집계 - 연관관계 활용
      const likeCount = await this.likeRepository.count({
        where: {
          content: { id: contentId },
          likedAt: Between(startTime, endTime),
          isCanceled: false,
        },
      });

      // 통계 저장 또는 업데이트
      await this.upsertDailyStat(contentId, startTime, clickCount, likeCount);
    }
  }

  // 유니크 콘텐츠 ID 조회 - 연관관계 활용
  private async getUniqueContentIds(startTime: Date, endTime: Date): Promise<number[]> {
    // 클릭이 있는 콘텐츠 ID 조회
    const clickContentIds = await this.clickRepository
      .createQueryBuilder('click')
      .select('click.content_id', 'contentId')
      .where('click.clickedAt BETWEEN :startTime AND :endTime', { startTime, endTime })
      .distinct(true)
      .getRawMany();
    
    // 좋아요가 있는 콘텐츠 ID 조회
    const likeContentIds = await this.likeRepository
      .createQueryBuilder('like')
      .select('like.content_id', 'contentId')
      .where('like.likedAt BETWEEN :startTime AND :endTime', { startTime, endTime })
      .distinct(true)
      .getRawMany();
    
    // 두 집합 병합 후 중복 제거
    const allContentIds = [
      ...clickContentIds.map(item => item.contentId),
      ...likeContentIds.map(item => item.contentId)
    ];
    
    return [...new Set(allContentIds)];
  }

  // 일별 통계 저장 또는 업데이트 - 연관관계 활용
  private async upsertDailyStat(contentId: number, date: Date, clickCount: number, likeCount: number) {
    // 해당 콘텐츠의 해당 날짜 통계 조회
    const existingStat = await this.statRepository.findOne({
      where: {
        content: { id: contentId },
        date: date,
      },
    });

    if (existingStat) {
      // 기존 통계 업데이트
      existingStat.clickCount = clickCount;
      existingStat.likeCount = likeCount;
      await this.statRepository.save(existingStat);
    } else {
      // 새 통계 생성
      const content = await this.contentRepository.findOne({ where: { id: contentId } });
      if (!content) return; // 콘텐츠가 없으면 무시
      
      const newStat = this.statRepository.create({
        content,
        contentId,
        date,
        clickCount,
        likeCount,
      });
      await this.statRepository.save(newStat);
    }
  }
}
```

## 대시보드 서비스 구현
대시보드 데이터 조회와 새로고침 기능을 구현합니다:

```typescript
// dashboard.service.ts
@Injectable()
export class DashboardService {
  constructor(
    private readonly statisticsService: StatisticsService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  // 대시보드 통계 데이터 조회
  async getContentStats(contentId: number, days: number = 30) {
    const cacheKey = `dashboard_stats_${contentId}_${days}`;
    
    // 캐시 확인
    const cachedData = await this.cacheManager.get(cacheKey);
    if (cachedData) {
      return cachedData;
    }
    
    // 날짜 범위 계산
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // 통계 데이터 조회
    const stats = await this.statisticsService.getDailyStats(contentId, startDate, endDate);
    
    // 캐싱
    await this.cacheManager.set(cacheKey, stats, 300); // 5분 캐싱
    
    return stats;
  }

  // 새로고침 기능
  async refreshStats(contentId: number, days: number = 30) {
    const cacheKey = `dashboard_stats_${contentId}_${days}`;
    
    // 캐시 삭제
    await this.cacheManager.del(cacheKey);
    
    // 오늘의 통계 최신화
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await this.statisticsService.aggregateDailyStats(today);
    
    // 최신 데이터 조회
    return this.getContentStats(contentId, days);
  }
}
```

## 컨트롤러 구현
대시보드 API 엔드포인트를 제공하는 컨트롤러:

```typescript
// dashboard.controller.ts
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('content/stats')
  async getContentStats(
    @Query('contentId') contentId: number,
    @Query('days') days: number = 30,
  ) {
    return this.dashboardService.getContentStats(contentId, days);
  }

  @Post('content/refresh')
  async refreshContentStats(
    @Query('contentId') contentId: number,
    @Query('days') days: number = 30,
  ) {
    return this.dashboardService.refreshStats(contentId, days);
  }
}

```

## 백그라운드 작업 설정
일별 통계 데이터를 자동으로 집계하는 스케줄링 작업:

```typescript
// statistics.scheduler.ts
@Injectable()
export class StatisticsScheduler {
  constructor(private readonly statisticsService: StatisticsService) {}

  // 매일 자정에 전날 데이터 집계
  @Cron('0 0 * * *')
  async aggregateYesterdayStats() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    await this.statisticsService.aggregateDailyStats(yesterday);
  }
}

```

## 모듈 구성
통계 시스템의 모듈 구성

```typescript
// statistics.module.ts
@Module({
  imports: [
    TypeOrmModule.forFeature([User, Content, ContentClick, ContentLike, DailyStat]),
    ScheduleModule.forRoot(),
    CacheModule.register(),
  ],
  controllers: [DashboardController],
  providers: [StatisticsService, DashboardService, StatisticsScheduler],
  exports: [StatisticsService, DashboardService],
})
export class StatisticsModule {}

```

## 설계 설명
연관관계를 도입한 이 설계는 다음과 같은 장점을 제공합니다

데이터 무결성 강화: 외래 키 제약 조건을 통해 참조 무결성이 보장됩니다. 예를 들어, 콘텐츠가 삭제되면 관련된 모든 통계, 클릭, 좋아요 데이터도 함께 삭제되도록 onDelete: 'CASCADE' 옵션을 설정했습니다.

관계 탐색 편의성: 연관 엔티티를 쉽게 로드하고 탐색할 수 있습니다. 복잡한 JOIN 쿼리 대신 TypeORM의 관계 기능을 활용할 수 있습니다.

확장성 개선: 콘텐츠나 사용자에 관련된 추가 기능을 도입할 때, 기존 관계를 활용하여 쉽게 확장할 수 있습니다.

비즈니스 로직 일관성: 연관관계를 통해 비즈니스 규칙(예: 사용자당 콘텐츠 좋아요 제한)을 더 쉽게 구현할 수 있습니다.

주요 설계 결정
양방향 vs 단방향 관계: 양방향 관계(예: Content와 ContentClick)를 설정하여 양쪽에서 참조가 가능하도록 했습니다. 이는 특히 콘텐츠에서 관련 통계를 쉽게 조회해야 할 때 유용합니다.

조인 컬럼과 기존 컬럼 공존: @JoinColumn으로 관계를 명시하면서도 기존 contentId, userId 컬럼을 유지했습니다. 이는 간단한 ID 참조만 필요한 경우 전체 엔티티를 로드하지 않고도 효율적으로 쿼리할 수 있게 합니다.

캐스케이드 옵션: 콘텐츠 삭제 시 관련 통계 데이터도 함께 삭제되도록 CASCADE 옵션을 설정했습니다. 이는 불필요한 데이터가 DB에 남지 않도록 보장합니다.

일별 통계 분리: 원시 데이터(클릭, 좋아요)와 집계 데이터(일별 통계)를 별도 엔티티로 유지하여 조회 성능을 최적화했습니다.

**향후 개선 방안**

- 향후 서비스가 많이 커질 경우 대규모 데이터 처리를 신경 써야합니다.
  - 데이터량이 급증할 경우 인덱싱, 파티셔닝, 혹은 별도의 부선 전용 DB등 성능 최적화 방안을 고려할 필요가 있습니다. 그러나 현재 기본적으로 소규모 스타트업이기 때문에 충분히 감당이 가능하다고 판단됩니다.
  - 현재 집계 및 업데이트 과정에서 여러 DB 연산이 이루어 지는데 트랜잭션 처리와 예외 처리 로직이 추가되어야 합니다.
```typescript
@Injectable()
export class StatisticsService {
  private readonly logger = new Logger(StatisticsService.name);

  constructor(
    @InjectRepository(Content)
    private readonly contentRepository: Repository<Content>,
    @InjectRepository(ContentClick)
    private readonly clickRepository: Repository<ContentClick>,
    @InjectRepository(ContentLike)
    private readonly likeRepository: Repository<ContentLike>,
    @InjectRepository(DailyStat)
    private readonly statRepository: Repository<DailyStat>,
    // 트랜잭션 관리를 위한 데이터베이스 연결 객체
    private readonly connection: Connection,
  ) {}

  // 성능 최적화 및 트랜잭션 처리를 적용한 일별 통계 집계 메서드
  async aggregateDailyStats(date: Date) {
    // 날짜 범위 설정 (해당 날짜의 00:00:00 ~ 23:59:59)
    const startTime = new Date(date);
    startTime.setHours(0, 0, 0, 0);
    const endTime = new Date(date);
    endTime.setHours(23, 59, 59, 999);

    // QueryRunner 생성 및 트랜잭션 시작
    const queryRunner = this.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 그룹화 쿼리로 클릭 수 집계 (한 번의 쿼리로 콘텐츠별 클릭 수 계산)
      const clickResults = await queryRunner.manager
        .createQueryBuilder(ContentClick, 'click')
        .select('click.content_id', 'contentId')
        .addSelect('COUNT(*)', 'clickCount')
        .where('click.clickedAt BETWEEN :startTime AND :endTime', { startTime, endTime })
        .groupBy('click.content_id')
        .getRawMany();

      // 그룹화 쿼리로 좋아요 수 집계 (취소되지 않은 좋아요만 집계)
      const likeResults = await queryRunner.manager
        .createQueryBuilder(ContentLike, 'like')
        .select('like.content_id', 'contentId')
        .addSelect('COUNT(*)', 'likeCount')
        .where('like.likedAt BETWEEN :startTime AND :endTime', { startTime, endTime })
        .andWhere('like.isCanceled = false')
        .groupBy('like.content_id')
        .getRawMany();

      // 클릭과 좋아요 결과 병합: key - contentId, value - { clickCount, likeCount }
      const aggregatedMap = new Map<number, { clickCount: number; likeCount: number }>();

      clickResults.forEach(result => {
        const contentId = Number(result.contentId);
        const clickCount = Number(result.clickCount);
        aggregatedMap.set(contentId, { clickCount, likeCount: 0 });
      });

      likeResults.forEach(result => {
        const contentId = Number(result.contentId);
        const likeCount = Number(result.likeCount);
        if (aggregatedMap.has(contentId)) {
          const data = aggregatedMap.get(contentId);
          data.likeCount = likeCount;
        } else {
          aggregatedMap.set(contentId, { clickCount: 0, likeCount });
        }
      });

      // 집계 대상 콘텐츠 ID 목록
      const contentIds = Array.from(aggregatedMap.keys());

      // 해당 날짜에 이미 집계된 DailyStat 레코드를 한 번에 조회
      const existingStats = await queryRunner.manager.find(DailyStat, {
        where: {
          contentId: In(contentIds),
          date: startTime,
        },
      });
      const existingStatsMap = new Map<number, DailyStat>();
      existingStats.forEach(stat => {
        existingStatsMap.set(stat.contentId, stat);
      });

      // 각 콘텐츠별 집계 결과를 기반으로 기존 레코드는 업데이트, 신규 레코드는 생성
      for (const [contentId, counts] of aggregatedMap.entries()) {
        if (existingStatsMap.has(contentId)) {
          // 기존 레코드 업데이트
          const stat = existingStatsMap.get(contentId);
          stat.clickCount = counts.clickCount;
          stat.likeCount = counts.likeCount;
          await queryRunner.manager.save(stat);
        } else {
          // 신규 레코드 생성 (콘텐츠 존재 여부 확인)
          const content = await queryRunner.manager.findOne(Content, { where: { id: contentId } });
          if (!content) continue; // 콘텐츠가 없으면 건너뜀
          const newStat = queryRunner.manager.create(DailyStat, {
            content,
            contentId,
            date: startTime,
            clickCount: counts.clickCount,
            likeCount: counts.likeCount,
          });
          await queryRunner.manager.save(newStat);
        }
      }

      // 트랜잭션 커밋
      await queryRunner.commitTransaction();
    } catch (error) {
      // 오류 발생 시 롤백 및 에러 로깅
      await queryRunner.rollbackTransaction();
      this.logger.error('Error aggregating daily stats', error.stack);
      throw error;
    } finally {
      // QueryRunner 해제
      await queryRunner.release();
    }
  }

  // 일별 통계 조회 
  async getDailyStats(contentId: number, startDate: Date, endDate: Date) {
    return this.statRepository.find({
      where: {
        content: { id: contentId },
        date: Between(startDate, endDate),
      },
      order: {
        date: 'ASC',
      },
      relations: ['content'],
    });
  }
}

```

  - 캐싱전략 확장하기
    - 현재는 단순히 TTL(time to live) 방식으로 캐싱하고 있는데 사용자별 조회 패턴이나 이벤트 빈도를 고려해야할 경우 세분화된 캐싱 전략이 필요 할수도 있습니다.
  - 실시간 통계 반영
    - 만약 정말 대시보드가 실시간으로 통계가 지속적으로 노출되어야 할 경우 새로고침 버튼 외에도 이벤트 기반의 실시간 업데이트 [MessageQ(RabbitMQ,bullMQ),WebSocket]등을 도입해 즉각적으로 반영하는 방법도 고려 할수 있습니다.

---

### 💡 추가질문 1. - 실제로 구현해본 경험이 있다면, 해당 구현 경험을 서술해주세요

- 스타트업에서 근무하며 가장 고민이 되던 부분이 백오피스 구현이였습니다. 실제로 어플리케이션의 성능에 영향을 주지 않으면서도 유저의 모든 행동이 들어가야 하며 또한 내부에 있는 모든 이해당사자들의 요구가 들어가야 한다는 점이 정말 어려웠습니다. 그래서 우선적으로는 어플리케이션에 영향을 최대한 덜 줄 수 있게 이해당사자 분들이 정말 필요한 기능만 우선 리스트를 정리하고 정기적인 회의를 통해 해당 기능을 추가하는 쪽으로 작업을 하였습니다. 처음엔 유저 관련 기능 (활성화/비활성화) 기능과 컨텐츠 업로드 기능 (문제생성/정답생성/비디오 업로드) 기능을 추가하였으며 이때 최대한 일반 유저들이 사용하지 않는 시간대에 배치 작업을 걸어두고 진행하였습니다. 

### 💡 추가질문 2. - 유저가 클릭을 조작하기위해 빠르게 연타를 한다면, 어떻게 방지할수 있을까요?

- 사실은 클릭에 대해서 먼저 요구사항을 다시 파악해야할 부분이 있습니다.
- 유저가 한번만 클릭이 가능한지 여러번 클릭이 가능한지 부분에 대해서 비즈니스 요구사항이 정리 되어야 합니다. 현재의 코드에는 유저가 단 한번만 클릭 한다는 가정으로 작성을 하였습니다.
- 이를 기반으로 생각해보면 서버에서는 Rate Limithing을 구현할수 있을거 같습니다.
- Rate Limithing는 실제로는 무차별 공격을 방어하기 위해 사용되지만 제한을 둬서 해당 API를 반복적으로 호출하는것을 막을수 있어 현재의 요구사항에도 사용이 가능할거 같아 해당 아이디어를 작성합니다.

```typescript
nestjs에서는 @nestjs/throttler이라는 라이브러리가 존재합니다.
// app.module.ts
@Module({
  imports: [
    ThrottlerModule.forRoot({
      ttl: 60, // 시간 간격(초)
      limit: 10, // 허용된 최대 요청 수
    }),
  ],
})
export class AppModule {}

// content.controller.ts
@UseGuards(ThrottlerGuard)
@Controller('content')
export class ContentController {
  // 컨트롤러 코드
}
```

- 혹은 서비스계층에서 클릭 클다운을 구현할수 있습니다.
- 현재는 간단하게 구현하여 Map 메모리에서 관리 되지만 앞서 언급한 Redis를 이용할경우 중앙집중으로 관리가 가능하여 서버 인스턴스마다 다른 문제를 방지 할 수 있습니다.
- 추가적으로 인메모리에서 관리하는 로직이기 때문에 주기적으로 메모리에서 정리해주는 로직이 필요합니다.
```typescript
// click.service.ts
@Injectable()
export class ContentClickService implements OnModuleDestroy {
  private clickCooldowns = new Map<string, Date>();
  private cleanupInterval: NodeJS.Timeout;

  constructor(
    @InjectRepository(ContentClick)
    private readonly clickRepository: Repository<ContentClick>,
  ) {
    // 매 60초마다 쿨다운 키 정리 실행
    this.cleanupInterval = setInterval(() => this.cleanupExpiredCooldowns(), 60 * 1000);
  }
  
  async recordClick(userId: number, contentId: number): Promise<boolean> {
    // 쿨다운 키 생성: 사용자와 콘텐츠의 조합으로 고유한 키 생성
    const cooldownKey = `${userId}-${contentId}`;
    const now = new Date();
    
    // 쿨다운 체크 (5초)
    if (this.clickCooldowns.has(cooldownKey)) {
      const lastClick = this.clickCooldowns.get(cooldownKey);
      const timeDiff = now.getTime() - lastClick.getTime();
      
      if (timeDiff < 5000) { // 5초 이내 재클릭 방지
        return false; // 클릭 거부
      }
    }
    
    // 쿨다운 업데이트
    this.clickCooldowns.set(cooldownKey, now);
    
    // 클릭 기록
    const click = this.clickRepository.create({
      userId,
      contentId,
      clickedAt: now,
    });
    
    await this.clickRepository.save(click);
    return true;
  }
  
  // 만료된 쿨다운 키를 주기적으로 정리하는 메서드
  private cleanupExpiredCooldowns() {
    const now = new Date();
    for (const [key, lastClick] of this.clickCooldowns.entries()) {
      // 5초 이상 지난 키를 삭제
      if (now.getTime() - lastClick.getTime() >= 5000) {
        this.clickCooldowns.delete(key);
      }
    }
  }

  // NestJS에서 모듈 종료 시 cleanupInterval을 해제하기 위한 메서드
  onModuleDestroy() {
    clearInterval(this.cleanupInterval);
  }
}
```

- 추가적으로는 DB에 제약 조건을 추가 할 수 있습니다.
```typescript
// content-click.entity.ts에 유니크 제약조건 추가
@Entity('content_clicks')
@Unique(['userId', 'contentId', 'timeWindow']) // 일정 시간 윈도우 내 중복 클릭 방지
export class ContentClick {
  // 기존 필드들...
  
  @Column()
  timeWindow: string; // 예: '2025-03-16-11' (시간 단위로 윈도우 설정)
  
  // 엔티티 생성 전 시간 윈도우 설정
  @BeforeInsert()
  setTimeWindow() {
    const date = new Date();
    this.timeWindow = `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}-${date.getHours()}`;
  }
}
````
- 백엔드에서만 막으면 안되기 때문에 프론트에서도 해당하는 debounce가 필요합니다.
```typescript
// 프론트엔드 코드 (throttle 구현)
function throttle(func, limit) {
  let lastCall = 0;
  return function(...args) {
    const now = new Date().getTime();
    if (now - lastCall < limit) {
      return;
    }
    lastCall = now;
    return func(...args);
  };
}

// 사용 예
document.getElementById('contentButton').addEventListener('click', 
  throttle(function(e) {
    // 클릭 API 호출
    fetch('/api/content/click', { })
  }, 5000) // 5초마다 최대 1회만 실행
);
```

