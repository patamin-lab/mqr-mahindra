/**
 * PM Record — service layer.
 *
 * Sits between routes and the repository. This is where request-scoping
 * (e.g. the existing `seesAllDealers`/`seesOwnRecordsOnly` style checks
 * from `@/lib/scope`) and input validation (via `schemas.ts`) will be
 * applied once CRUD is actually implemented. Every method is currently a
 * stub - no business logic exists yet, per Sprint 10.1's scope.
 */
import { PmRecordRepository, PmRecordFilter } from './repository';
import { PmRecord, PmRecordCreateInput, PmRecordUpdateInput } from './types';

export interface PmRecordActor {
  username: string;
}

export class PmRecordService {
  constructor(private readonly repository: PmRecordRepository) {}

  async list(filter?: PmRecordFilter): Promise<PmRecord[]> {
    return this.repository.list(filter);
  }

  async getById(id: string): Promise<PmRecord | null> {
    return this.repository.getById(id);
  }

  async create(input: PmRecordCreateInput, actor: PmRecordActor): Promise<PmRecord> {
    if (!actor?.username?.trim()) {
      throw new Error('Actor username is required');
    }
    return this.repository.create(input, actor);
  }

  async update(id: string, input: PmRecordUpdateInput, actor: PmRecordActor): Promise<PmRecord> {
    if (!actor?.username?.trim()) {
      throw new Error('Actor username is required');
    }
    return this.repository.update(id, input, actor);
  }

  async delete(id: string, actor: PmRecordActor): Promise<void> {
    if (!actor?.username?.trim()) {
      throw new Error('Actor username is required');
    }
    return this.repository.delete(id, actor);
  }
}
