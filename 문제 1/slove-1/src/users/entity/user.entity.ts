import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn
} from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50 })
  name: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @CreateDateColumn()
  createdAt: Date;

  /**  데이터 저장 전/후 처리를 할수 있습니다
  @BeforeInsert()
  async hashPassword() {
    const salt = await bcrypt.genSalt(10);
    if (!this.password) return;
    this.password = await bcrypt.hash(this.password, salt);
  }
  */
}
