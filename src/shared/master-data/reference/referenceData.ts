/**
 * MASP Platform — Reference Data Platform.
 *
 * A thin facade over the dealer/branch/technician/product-family reads
 * already centralized in `lib/db.ts` (infrastructure) - confirmed via
 * repo-wide search that no module queries these four tables directly,
 * bypassing `db.ts`. This file does not re-implement data access; it
 * exists so a business module reaches reference data through one
 * platform-service entry point (`MasterDataService`) rather than
 * importing `lib/db.ts` functions directly module-by-module - the same
 * shape every other MASP Platform service (Address/Lookup/Configuration)
 * in this directory follows.
 */
import {
  listDealers,
  getDealer,
  listBranches,
  getBranchById,
  listTechnicians,
  listActiveProductFamilies,
  getProductFamily,
} from '@/lib/db';
import type { Dealer, Branch, Technician, ProductFamily } from '@/lib/types';

export async function getDealers(): Promise<Dealer[]> {
  return listDealers();
}

export async function getDealerById(dealerId: string): Promise<Dealer | null> {
  return getDealer(dealerId);
}

export async function getBranchesForDealer(dealerId: string | null): Promise<Branch[]> {
  return listBranches(dealerId);
}

export async function getBranch(branchId: string): Promise<Branch | null> {
  return getBranchById(branchId);
}

export async function getTechniciansForDealer(dealerId: string | null, branchName?: string | null): Promise<Technician[]> {
  return listTechnicians(dealerId, branchName);
}

export async function getActiveProductFamilies(): Promise<ProductFamily[]> {
  return listActiveProductFamilies();
}

export async function getProductFamilyById(id: string): Promise<ProductFamily | null> {
  return getProductFamily(id);
}
