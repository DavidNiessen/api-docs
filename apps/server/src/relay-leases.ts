import type { FastifyReply, FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';
import type { RelayPolicy } from './relay-policy.js';

export interface RelayLease {
  controller: AbortController;
  requestId: string;
  started: number;
  begin(): void;
  end(): void;
  hold(pending: Promise<unknown>): void;
}

/** Bound authenticated body parsing, egress and response delivery with the same lease. */
export class RelayLeases {
  private readonly active = new Set<AbortController>();
  private readonly members = new Map<string, number>();
  constructor(private readonly policy: RelayPolicy) {}
  stop() {
    for (const controller of this.active) controller.abort();
  }
  reserve(
    request: FastifyRequest,
    reply: FastifyReply,
    member: string,
  ): RelayLease {
    if (
      this.active.size >= this.policy.maxConcurrent ||
      (this.members.get(member) ?? 0) >= this.policy.maxConcurrentPerMember
    ) {
      reply.header('Connection', 'close');
      throw Object.assign(new Error('The relay is busy; try again later'), {
        statusCode: 429,
      });
    }
    const controller = new AbortController();
    this.active.add(controller);
    this.members.set(member, (this.members.get(member) ?? 0) + 1);
    let released = false,
      finished = false,
      running = false,
      pending = 0;
    const cancel = () => controller.abort();
    const bodyDone = () => request.raw.complete || request.raw.readableEnded;
    const timer = setTimeout(cancel, this.policy.timeoutMs);
    const disconnect = () => {
      if (!bodyDone()) {
        request.raw.destroy();
        reply.raw.destroy();
      } else if (reply.raw.headersSent && !reply.raw.writableFinished)
        reply.raw.destroy();
    };
    const closed = () => {
      if (!reply.raw.writableFinished) controller.abort();
      release();
    };
    const release = () => {
      finished = true;
      clearTimeout(timer);
      if (!bodyDone()) controller.abort();
      cleanup();
    };
    const cleanup = () => {
      if (released || !finished || running || pending) return;
      released = true;
      clearTimeout(timer);
      this.active.delete(controller);
      const count = (this.members.get(member) ?? 1) - 1;
      if (count) this.members.set(member, count);
      else this.members.delete(member);
      request.raw.removeListener('aborted', cancel);
      reply.raw.removeListener('close', closed);
      reply.raw.removeListener('finish', release);
      controller.signal.removeEventListener('abort', disconnect);
    };
    request.raw.once('aborted', cancel);
    reply.raw.once('close', closed);
    reply.raw.once('finish', release);
    controller.signal.addEventListener('abort', disconnect);
    if (request.raw.aborted || reply.raw.destroyed) {
      controller.abort();
      release();
    }
    return {
      controller,
      requestId: randomUUID(),
      started: Date.now(),
      begin() {
        running = true;
      },
      end() {
        running = false;
        cleanup();
      },
      hold(work) {
        pending++;
        const settle = () => {
          pending--;
          cleanup();
        };
        void work.then(settle, settle);
      },
    };
  }
}
