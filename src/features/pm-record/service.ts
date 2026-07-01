/**
 * PM Record — service layer.
 *
 * Sits between routes and the repository. Rejects any actor with an empty
 * username before any mutation; all other request-scoping (dealer/branch
 * resolution) happens in the route handler before this layer is called.
 */
import { PmRecordRepository, PmRecordFilter } from './repository';
import { PmDuplicateCheckParams, PmRecord, PmRecordCreateInput, PmRecordUpdateInput } from './types';

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

  async findDuplicate(params: PmDuplicateCheckParams): Promise<PmRecord | null> {
    return this.repository.findDuplicate(params);
  }
}
