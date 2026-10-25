import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ConnectionService } from '../services/connection.service.js';
import { AddPeerDto } from '../dto/add-peer.dto.js';
import { PeerKeyDto } from '../dto/peer-key.dto.js';

@Controller('connection')
export class ConnectionController {
  constructor(private readonly connectionService: ConnectionService) {}

  @Get()
  listPeers() {
    return this.connectionService.listPeers();
  }

  @Post()
  addPeer(@Body() dto: AddPeerDto) {
    return this.connectionService.addPeer(dto.publicKey, dto.ip);
  }

  // The key goes in the body rather than the path because base64 contains '/'.
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  removePeer(@Body() dto: PeerKeyDto) {
    return this.connectionService.removePeer(dto.publicKey);
  }
}
