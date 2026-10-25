import { IsIP } from 'class-validator';
import { PeerKeyDto } from './peer-key.dto.js';

export class AddPeerDto extends PeerKeyDto {
  // Bare tunnel address; the peer is registered with allowed-ips <ip>/32.
  @IsIP('4')
  ip: string;
}
