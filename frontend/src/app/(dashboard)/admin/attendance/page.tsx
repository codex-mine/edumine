"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/shared/data-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DeviceFormDialog } from "@/components/modules/attendance/device-form-dialog";
import { loginErrorMessage } from "@/hooks/use-auth";
import { useDailyAttendanceQuery, useDevicesQuery } from "@/hooks/use-attendance";
import { formatAttendanceTime, type AttendanceStatus } from "@/lib/api/attendance";

const STATUS_VARIANT: Record<AttendanceStatus, "success" | "destructive" | "warning" | "muted" | "info"> = {
  present: "success",
  late: "warning",
  half_day: "info",
  leave: "muted",
  absent: "destructive",
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AdminAttendancePage() {
  const [dateFrom, setDateFrom] = useState(todayIso());
  const [dateTo, setDateTo] = useState(todayIso());

  const devicesQuery = useDevicesQuery();
  const dailyQuery = useDailyAttendanceQuery({ date_from: dateFrom, date_to: dateTo });

  const deviceRows = (devicesQuery.data ?? []).map((device) => ({
    device_serial: <span className="font-medium text-foreground">{device.device_serial}</span>,
    location: device.location ?? "—",
    status: <Badge variant={device.is_active ? "success" : "muted"}>{device.is_active ? "Active" : "Inactive"}</Badge>,
    edit: (
      <DeviceFormDialog
        device={device}
        trigger={
          <Button variant="ghost" size="sm">
            Edit
          </Button>
        }
      />
    ),
  }));

  const dailyRows = (dailyQuery.data ?? []).map((record) => ({
    date: record.attendance_date,
    name: <span className="font-medium text-foreground">{record.full_name}</span>,
    role: <span className="capitalize">{record.role}</span>,
    entry: formatAttendanceTime(record.entry_time),
    exit: formatAttendanceTime(record.exit_time),
    status: <Badge variant={STATUS_VARIANT[record.status]}>{record.status.replace("_", " ")}</Badge>,
  }));

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Attendance</h1>
        <p className="text-sm text-muted-foreground">
          Manage biometric devices and review daily entry/exit attendance across the institute.
        </p>
      </div>

      <DataTable
        title="Biometric devices"
        description="F18 devices registered to ingest punch events."
        columns={[
          { key: "device_serial", label: "Serial" },
          { key: "location", label: "Location" },
          { key: "status", label: "Status" },
          { key: "edit", label: "" },
        ]}
        rows={deviceRows}
        isLoading={devicesQuery.isLoading}
        isError={devicesQuery.isError}
        errorMessage={devicesQuery.error ? loginErrorMessage(devicesQuery.error) : undefined}
        onRetry={() => devicesQuery.refetch()}
        emptyMessage="No biometric devices registered yet."
        searchValue=""
        onSearchChange={() => {}}
        page={1}
        limit={Math.max(deviceRows.length, 1)}
        total={deviceRows.length}
        onPageChange={() => {}}
        toolbarActions={
          <DeviceFormDialog
            trigger={
              <Button size="sm">
                <Plus className="size-4" aria-hidden="true" />
                Register device
              </Button>
            }
          />
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Scope</CardTitle>
          <CardDescription>Choose the date range for the daily attendance list below.</CardDescription>
        </CardHeader>
        <div className="flex flex-col gap-3 px-4 pb-4 sm:flex-row sm:items-end">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="date_from">From</Label>
            <Input id="date_from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="date_to">To</Label>
            <Input id="date_to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>
      </Card>

      <DataTable
        title="Daily attendance"
        description="Biometric entry/exit derived per person, per day."
        columns={[
          { key: "date", label: "Date" },
          { key: "name", label: "Name" },
          { key: "role", label: "Role" },
          { key: "entry", label: "Entry" },
          { key: "exit", label: "Exit" },
          { key: "status", label: "Status" },
        ]}
        rows={dailyRows}
        isLoading={dailyQuery.isLoading}
        isError={dailyQuery.isError}
        errorMessage={dailyQuery.error ? loginErrorMessage(dailyQuery.error) : undefined}
        onRetry={() => dailyQuery.refetch()}
        emptyMessage="No attendance recorded for this date range."
        searchValue=""
        onSearchChange={() => {}}
        page={1}
        limit={Math.max(dailyRows.length, 1)}
        total={dailyRows.length}
        onPageChange={() => {}}
      />
    </div>
  );
}
