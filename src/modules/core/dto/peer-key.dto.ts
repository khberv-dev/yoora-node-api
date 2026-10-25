import { Matches } from 'class-validator';

// A WireGuard key is 32 raw bytes, i.e. 44 base64 characters ending in '='.
export const WG_KEY_PATTERN = /^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]=$/;

export class PeerKeyDto {
  @Matches(WG_KEY_PATTERN, { message: 'publicKey must be a WireGuard key' })
  publicKey: string;
}
