import {
  Column,
  CreateDateColumn,
  Entity,
  ForeignKey,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../user/user.entity.js';

@Entity('certificates')
@ForeignKey(() => User, ['userId'], ['id'], {
  name: 'FK_certificate_user',
  onDelete: 'CASCADE',
})
@Unique('UQ_certificate_user_course', ['userId', 'courseId'])
@Unique('UQ_certificate_serial', ['serialNo'])
export class Certificate {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) userId: string;
  @Column({ type: 'uuid' }) courseId: string;
  @Column({ type: 'varchar', length: 64 }) serialNo: string;
  @Column({ type: 'varchar', length: 512, nullable: true }) pdfKey:
    string | null;
  @CreateDateColumn({ type: 'timestamptz' }) issuedAt: Date;
}
