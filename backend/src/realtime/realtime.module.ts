import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { WsGateway } from './ws.gateway.js';

@Global()
@Module({
  imports: [JwtModule],
  providers: [WsGateway],
  exports: [WsGateway],
})
export class RealtimeModule {}
