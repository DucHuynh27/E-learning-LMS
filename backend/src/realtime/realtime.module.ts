import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { WsGateway } from './ws.gateway.js';
import { QnaCatalogAccess } from '../qna/qna-catalog-access.service.js';

@Global()
@Module({
  imports: [JwtModule],
  providers: [WsGateway, QnaCatalogAccess],
  exports: [WsGateway, QnaCatalogAccess],
})
export class RealtimeModule {}
