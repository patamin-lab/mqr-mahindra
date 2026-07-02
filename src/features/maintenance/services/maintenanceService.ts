/**
 * Maintenance — service layer.
 *
 * Sits between routes and the repository. Rejects any actor with an empty
 * username before any mutation; all other request-scoping (dealer/branch
 * resolution) happens in the route handler before this layer is called.
 */
import { MaintenanceRepository, MaintenanceFilter } from '../repositories/maintenanceRepository';
import {
  MaintenanceDuplicateCheckParams,
  MaintenanceHistoryFilter,
  MaintenanceHistoryResult,
  MaintenanceRecord,
  MaintenanceRecordCreateInput,
  MaintenanceRecordUpdateInput,
} from '../types';

export interface MaintenanceActor {
  username: string;
}

export class MaintenanceService {
  constructor(private readonly repository: MaintenanceRepository) {}

  async list(filter?: MaintenanceFilter): Promise<MaintenanceRecord[]> {
    return this.repository.list(filter);
  }

  async getById(id: string): Promise<MaintenanceRecord | null> {
    return this.repository.getById(id);
  }

  async create(input: MaintenanceRecordCreateInput, actor: MaintenanceActor): Promise<MaintenanceRecord> {
    if (!actor?.username?.trim()) {
      throw new Error('Actor username is required');
    }
    return this.repository.create(input, actor);
  }

  async update(id: string, input: MaintenanceRecordUpdateInput, actor: MaintenanceActor): Promise<MaintenanceRecord> {
    if (!actor?.username?.trim()) {
      throw new Error('Actor username is required');
    }
    return this.repository.update(id, input, actor);
  }

  async delete(id: string, actor: MaintenanceActor): Promise<void> {
    if (!actor?.username?.trim()) {
      throw new Error('Actor username is required');
    }
    return this.repository.delete(id, actor);
  }

  async findDuplicate(params: MaintenanceDuplicateCheckParams): Promise<MaintenanceRecord | null> {
    return this.repository.findDuplicate(params);
  }

  async listHistory(filter: MaintenanceHistoryFilter): Promise<MaintenanceHistoryResult> {
    return this.repository.listHistory(filter);
  }
}
