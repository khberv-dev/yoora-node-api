import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ConnectionService } from '../services/connection.service.js';
import { PeerIpParam } from '../dto/peer-ip-param.dto.js';

@Controller('connection')
export class ConnectionController {
  constructor(private readonly connectionService: ConnectionService) {}

  @Get()
  listPeers() {
    return this.connectionService.listPeers();
  }

  @Post()
  connect() {
    return this.connectionService.connect();
  }

  @Delete(':ip')
  @HttpCode(HttpStatus.NO_CONTENT)
  disconnect(@Param() { ip }: PeerIpParam) {
    return this.connectionService.disconnect(ip);
  }
}
