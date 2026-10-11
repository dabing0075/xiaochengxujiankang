import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { HealthModule } from '@/modules/health/health.module';
import { UserModule } from '@/modules/user/user.module';
import { RecordsModule } from '@/modules/records/records.module';
import { DocumentModule } from '@/modules/document/document.module';
import { AdminModule } from '@/modules/admin/admin.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { JwtAuthGuard } from '@/modules/auth/jwt-auth.guard';

@Module({
  imports: [AuthModule, HealthModule, UserModule, RecordsModule, DocumentModule, AdminModule, NotificationsModule],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
