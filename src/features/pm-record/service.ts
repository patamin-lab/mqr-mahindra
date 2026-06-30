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
import { PmRecordCreateInput, PmRecordUpdateInput } from './types';

export interface PmRecordActor {
  username: string;
}

const NOT_IMPLEMENTED = 'PM Record CRUD is not implemented yet (Sprint 10.1 is foundation-only).';

export class PmRecordService {
  constructor(private readonly repository: PmRecordRepository) {}

  async list(_filter?: PmRecordFilter) {
    throw new Error(NOT_IMPLEMENTED);
  }

  async getById(_id: string) {
    throw new Error(NOT_IMPLEMENTED);
  }

  async create(_input: PmRecordCreateInput, _actor: PmRecordActor) {
    throw new Error(NOT_IMPLEMENTED);
  }

  async update(_id: string, _input: PmRecordUpdateInput, _actor: PmRecordActor) {
    throw new Error(NOT_IMPLEMENTED);
  }

  async delete(_id: string, _actor: PmRecordActor) {
    throw new Error(NOT_IMPLEMENTED);
  }
}
