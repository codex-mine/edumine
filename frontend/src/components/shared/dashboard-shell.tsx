import { ChartCard } from "@/components/dashboard/chart-card";
import { ListCard } from "@/components/dashboard/list-card";
import { StatCard } from "@/components/dashboard/stat-card";
import { TableCard } from "@/components/dashboard/table-card";
import { ROLE_WIDGETS } from "@/lib/dashboard/widgets-config";
import type { Role } from "@/lib/auth/roles";

const ROLE_LABELS: Record<Role, string> = {
  principal: "Principal",
  admin: "Admin",
  teacher: "Teacher",
  accountant: "Accountant",
  receptionist: "Receptionist",
  staff: "Staff",
  student: "Student",
  guardian: "Guardian",
};

export function DashboardShell({ role }: { role: Role }) {
  const widgets = ROLE_WIDGETS[role];

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">{ROLE_LABELS[role]} dashboard</h1>
        <p className="text-sm text-muted-foreground">{widgets.description}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {widgets.stats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value="—"
            icon={stat.icon}
            accent={stat.accent}
            caption="Awaiting data"
          />
        ))}
      </div>

      {widgets.chart && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard
            title={widgets.chart.title}
            subtitle={widgets.chart.subtitle}
            type={widgets.chart.type}
            caption="Connects once this module ships"
          />
        </div>
      )}

      {(widgets.list || widgets.table) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {widgets.list && <ListCard title={widgets.list.title} meta={widgets.list.meta} />}
          {widgets.table && (
            <TableCard title={widgets.table.title} meta={widgets.table.meta} columns={widgets.table.columns} />
          )}
        </div>
      )}
    </div>
  );
}
