import {
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CryptService } from '../../crypt/crypt.service.js';
import { WgProcessService } from '../../system/wg-process.service.js';

// Tunnel subnet 10.0.0.0/24: .1 is the server, peers get .2 - .254.
const SUBNET_PREFIX = '10.0.0.';
const FIRST_HOST = 2;
const LAST_HOST = 254;
// WireGuard re-handshakes every 2 minutes while a tunnel is in use.
const ACTIVE_HANDSHAKE_SECONDS = 180;

export interface Peer {
  publicKey: string;
  endpoint: string | null;
  allowedIps: string[];
  latestHandshake: number;
  transferRx: number;
  transferTx: number;
}

@Injectable()
export class ConnectionService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ConnectionService.name);
  private serverPublicKey: string;
  // Serializes connect() so two concurrent requests can't take the same IP.
  private lock: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly cryptService: CryptService,
    private readonly wgProcess: WgProcessService,
  ) {}

  // Runs before the app starts listening; if wg0 is unreachable this throws
  // and startup fails, rather than serving requests that would all 500.
  async onApplicationBootstrap() {
    this.serverPublicKey = await this.wgProcess.publicKey();
    const listenPort = await this.wgProcess.listenPort();
    const peers = await this.listPeers();
    const now = Date.now() / 1000;
    const active = peers.filter(
      (p) => now - p.latestHandshake < ACTIVE_HANDSHAKE_SECONDS,
    ).length;

    this.logger.log(
      `wg0 up: port ${listenPort}, public key ${this.serverPublicKey}, ` +
        `peers ${peers.length}/${LAST_HOST - FIRST_HOST + 1} (${active} active)`,
    );
  }

  connect() {
    const result = this.lock.then(() => this.createPeer());
    this.lock = result.catch(() => undefined);
    return result;
  }

  async disconnect(ip: string) {
    const allowedIp = `${ip}/32`;
    const peer = (await this.listPeers()).find((p) =>
      p.allowedIps.includes(allowedIp),
    );
    if (!peer) throw new NotFoundException();
    await this.wgProcess.removePeer(peer.publicKey);
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

  private async createPeer() {
    const ip = await this.allocateIp();
    const keys = this.cryptService.generateKeys();
    await this.wgProcess.addPeer(keys.public, ip);
    return {
      ...keys,
      ip: `${ip}/32`,
      serverPublicKey: this.serverPublicKey,
    };
  }

  // wg0 is the source of truth for which IPs are taken, so allocation
  // survives restarts and needs no storage.
  private async allocateIp() {
    const used = new Set((await this.listPeers()).flatMap((p) => p.allowedIps));
    for (let host = FIRST_HOST; host <= LAST_HOST; host++) {
      const ip = `${SUBNET_PREFIX}${host}`;
      if (!used.has(`${ip}/32`)) return ip;
    }
    throw new ServiceUnavailableException('No free tunnel IPs');
  }
}
