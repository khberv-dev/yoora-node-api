import { IsIP } from 'class-validator';

export class PeerIpParam {
  @IsIP('4')
  ip: string;
}
