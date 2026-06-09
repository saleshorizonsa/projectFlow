"use client";

import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Eye, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProjectEditDialog, type EditableProject } from "@/components/projects/project-edit-dialog";
import { formatEnum } from "@/lib/utils";

type ProjectRow = EditableProject & {
  id: string;
  projectId: string;
  name: string;
  description: string;
  client: string;
  companies: { id: string; name: string; code: string }[];
  status: string;
  priority: string;
  startDate: string;
  endDate: string;
  budget: number;
  manager: { name: string };
  _count: { tasks: number; gaps: number; milestones: number };
};

export function ProjectTable({ data, companies }: { data: ProjectRow[]; companies: { id: string; name: string; code: string }[] }) {
  const router = useRouter();
  async function deleteProject(project: ProjectRow) {
    if (!window.confirm(`Delete project "${project.name}" and all related tasks, gaps, milestones, and layers?`)) return;
    const response = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
    if (!response.ok) window.alert("Project delete failed. Admin role is required.");
    router.refresh();
  }

  const columns: ColumnDef<ProjectRow>[] = [
    { accessorKey: "projectId", header: "ID" },
    {
      accessorKey: "name",
      header: "Project",
      cell: ({ row }) => <Link className="font-medium text-primary hover:underline" href={`/projects/${row.original.id}`}>{row.original.name}</Link>,
    },
    {
      header: "Companies",
      cell: ({ row }) => (
        <div className="flex max-w-64 flex-wrap gap-1">
          {row.original.companies.length > 0
            ? row.original.companies.map((company) => <Badge key={company.id} variant="outline">{company.code}</Badge>)
            : <span className="text-muted-foreground">{row.original.client}</span>}
        </div>
      ),
    },
    { header: "Manager", cell: ({ row }) => row.original.manager.name },
    { header: "Status", cell: ({ row }) => <Badge variant="secondary">{formatEnum(row.original.status)}</Badge> },
    { header: "Priority", cell: ({ row }) => <Badge variant={row.original.priority === "CRITICAL" ? "destructive" : "outline"}>{formatEnum(row.original.priority)}</Badge> },
    { header: "Tasks", cell: ({ row }) => row.original._count.tasks },
    { header: "Gaps", cell: ({ row }) => row.original._count.gaps },
    {
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/projects/${row.original.id}`}><Eye className="h-4 w-4" /> View</Link>
          </Button>
          <ProjectEditDialog project={row.original} companies={companies} />
          <Button size="icon" variant="ghost" onClick={() => deleteProject(row.original)} aria-label="Delete project"><Trash2 className="h-4 w-4" /></Button>
        </div>
      ),
    },
  ];
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });
  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((group) => (
          <TableRow key={group.id}>
            {group.headers.map((header) => <TableHead key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow key={row.id}>
            {row.getVisibleCells().map((cell) => <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
