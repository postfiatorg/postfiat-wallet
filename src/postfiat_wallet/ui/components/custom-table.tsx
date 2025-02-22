import React from 'react';

interface TableProps {
  children: React.ReactNode;
  className?: string;
}

export const Table = ({ children, className = '' }: TableProps) => {
  return (
    <div className="w-full overflow-auto">
      <table className={`w-full caption-bottom text-sm ${className}`}>
        {children}
      </table>
    </div>
  );
};

export const TableHeader = ({ children, className = '' }: TableProps) => {
  return (
    <thead className={`border-b border-gray-700 ${className}`}>
      {children}
    </thead>
  );
};

export const TableBody = ({ children, className = '' }: TableProps) => {
  return (
    <tbody className={`${className}`}>
      {children}
    </tbody>
  );
};

export const TableRow = ({ children, className = '' }: TableProps) => {
  return (
    <tr className={`border-b border-gray-700 transition-colors hover:bg-gray-700/50 ${className}`}>
      {children}
    </tr>
  );
};

export const TableHead = ({ children, className = '' }: TableProps) => {
  return (
    <th className={`h-12 px-4 text-left align-middle font-medium text-gray-400 ${className}`}>
      {children}
    </th>
  );
};

export const TableCell = ({ children, className = '' }: TableProps) => {
  return (
    <td className={`p-4 align-middle text-gray-300 ${className}`}>
      {children}
    </td>
  );
};