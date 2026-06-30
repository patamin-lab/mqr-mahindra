import { ReactNode } from 'react';

/**
 * Shared CRUD table shell used across the admin master-data screens
 * (Dealers, Branches, Technicians, Users, Problem Codes).
 *
 * Extracts only the "shell" markup that was byte-for-byte identical across
 * all five `*-table.tsx` admin files: the white card wrapper, the <table>,
 * and the header row built from `columns`. Row/tbody rendering deliberately
 * stays per-entity since that content differs across screens.
 */
export type AdminCrudTableColumn = {
  key: string;
  header: string;
};

export type AdminCrudTableProps = {
  columns: AdminCrudTableColumn[];
  children: ReactNode;
};

export default function AdminCrudTable({ columns, children }: AdminCrudTableProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-left">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="px-3 py-2">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
