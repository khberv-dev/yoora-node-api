import { Injectable } from '@nestjs/common';
import { WgProcessService } from '../../system/wg-process.service.js';

export interface Peer {
  publicKey: string;
  endpoint: string | null;
  allowedIps: string[];
  latestHandshake: number;
  transferRx: number;
  transferTx: number;
}

@Injectable()
export class ConnectionService {
  constructor(private readonly wgProcess: WgProcessService) {}

  async addPeer(publicKey: string, ip: string) {
    await this.wgProcess.addPeer(publicKey, ip);
    return { publicKey, ip: `${ip}/32` };
  }

  async removePeer(publicKey: string) {
    await this.wgProcess.removePeer(publicKey);
  }

  async listPeers(): Promise<Peer[]> {
    const dump = await this.wgProcess.status();
    // The first line describes the interface and holds its private key, so
    // it is never returned. Each remaining line is one tab-separated peer:
    // public-key, preshared-key, endpoint, allowed-ips, latest-handshake,
    // transfer-rx, transfer-tx, persistent-keepalive.
    return dump
      .split('\n')
      .slice(1)
      .filter(Boolean)
      .map((line) => {
        const [publicKey, , endpoint, allowedIps, handshake, rx, tx] =
          line.split('\t');
        return {
          publicKey,
          endpoint: endpoint === '(none)' ? null : endpoint,
          allowedIps: allowedIps === '(none)' ? [] : allowedIps.split(','),
          latestHandshake: Number(handshake),
          transferRx: Number(rx),
          transferTx: Number(tx),
        };
      });
  }
}
