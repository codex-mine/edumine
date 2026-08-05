"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { RowActionsMenu } from "@/components/modules/people/row-actions-menu";
import { ClassFormDialog } from "@/components/modules/academic/class-form-dialog";
import { RoomFormDialog } from "@/components/modules/academic/room-form-dialog";
import { SubjectFormDialog } from "@/components/modules/academic/subject-form-dialog";
import { loginErrorMessage } from "@/hooks/use-auth";
import {
  useClassesQuery,
  useDeleteClassMutation,
  useDeleteRoomMutation,
  useDeleteSubjectMutation,
  useRoomsQuery,
  useSubjectsQuery,
} from "@/hooks/use-academic";

export default function AcademicStructurePage() {
  const [classSearch, setClassSearch] = useState("");
  const [roomSearch, setRoomSearch] = useState("");
  const [subjectSearch, setSubjectSearch] = useState("");

  const classesQuery = useClassesQuery(classSearch || undefined);
  const roomsQuery = useRoomsQuery(roomSearch || undefined);
  const subjectsQuery = useSubjectsQuery(subjectSearch || undefined);

  const deleteClassMutation = useDeleteClassMutation();
  const deleteRoomMutation = useDeleteRoomMutation();
  const deleteSubjectMutation = useDeleteSubjectMutation();

  const classRows = (classesQuery.data ?? []).map((item) => ({
    name: <span className="font-medium text-foreground">{item.name}</span>,
    order: item.numeric_order,
    edit: (
      <ClassFormDialog
        classItem={item}
        trigger={
          <Button variant="ghost" size="sm">
            Edit
          </Button>
        }
      />
    ),
    actions: (
      <RowActionsMenu
        onSoftDelete={() => deleteClassMutation.mutate(item.id)}
        softDeleteDescription="This class is hidden from active lists. Existing sections and history are preserved."
        isDeleting={deleteClassMutation.isPending}
      />
    ),
  }));

  const roomRows = (roomsQuery.data ?? []).map((item) => ({
    name: <span className="font-medium text-foreground">{item.name}</span>,
    capacity: item.capacity ?? "—",
    edit: (
      <RoomFormDialog
        room={item}
        trigger={
          <Button variant="ghost" size="sm">
            Edit
          </Button>
        }
      />
    ),
    actions: (
      <RowActionsMenu
        onSoftDelete={() => deleteRoomMutation.mutate(item.id)}
        softDeleteDescription="This room is hidden from active lists. Existing section/routine assignments are preserved."
        isDeleting={deleteRoomMutation.isPending}
      />
    ),
  }));

  const subjectRows = (subjectsQuery.data ?? []).map((item) => ({
    name: <span className="font-medium text-foreground">{item.name}</span>,
    code: item.code,
    edit: (
      <SubjectFormDialog
        subject={item}
        trigger={
          <Button variant="ghost" size="sm">
            Edit
          </Button>
        }
      />
    ),
    actions: (
      <RowActionsMenu
        onSoftDelete={() => deleteSubjectMutation.mutate(item.id)}
        softDeleteDescription="This subject is hidden from active lists. Existing class-subject assignments are preserved."
        isDeleting={deleteSubjectMutation.isPending}
      />
    ),
  }));

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Academic structure</h1>
        <p className="text-sm text-muted-foreground">
          Manage the master lists of classes, subjects, and rooms — reused across every academic year.
        </p>
      </div>

      <DataTable
        title="Classes"
        description="Grade-level definitions, reusable across years."
        columns={[
          { key: "name", label: "Class" },
          { key: "order", label: "Order" },
          { key: "edit", label: "" },
          { key: "actions", label: "" },
        ]}
        rows={classRows}
        isLoading={classesQuery.isLoading}
        isError={classesQuery.isError}
        errorMessage={classesQuery.error ? loginErrorMessage(classesQuery.error) : undefined}
        onRetry={() => classesQuery.refetch()}
        emptyMessage="No classes defined yet."
        searchValue={classSearch}
        onSearchChange={setClassSearch}
        searchPlaceholder="Search classes"
        page={1}
        limit={Math.max(classRows.length, 1)}
        total={classRows.length}
        onPageChange={() => { }}
        toolbarActions={
          <ClassFormDialog
            trigger={
              <Button >
                <Plus className="size-8" aria-hidden="true" />
                Add class
              </Button>
            }
          />
        }
      />

      <DataTable
        title="Subjects"
        description="Master subject list, reusable across years and classes."
        columns={[
          { key: "name", label: "Subject" },
          { key: "code", label: "Code" },
          { key: "edit", label: "" },
          { key: "actions", label: "" },
        ]}
        rows={subjectRows}
        isLoading={subjectsQuery.isLoading}
        isError={subjectsQuery.isError}
        errorMessage={subjectsQuery.error ? loginErrorMessage(subjectsQuery.error) : undefined}
        onRetry={() => subjectsQuery.refetch()}
        emptyMessage="No subjects defined yet."
        searchValue={subjectSearch}
        onSearchChange={setSubjectSearch}
        searchPlaceholder="Search subjects"
        page={1}
        limit={Math.max(subjectRows.length, 1)}
        total={subjectRows.length}
        onPageChange={() => { }}
        toolbarActions={
          <SubjectFormDialog
            trigger={
              <Button >
                <Plus className="size-8" aria-hidden="true" />
                Add subject
              </Button>
            }
          />
        }
      />

      <DataTable
        title="Rooms"
        description="Physical room registry, reusable across years."
        columns={[
          { key: "name", label: "Room" },
          { key: "capacity", label: "Capacity" },
          { key: "edit", label: "" },
          { key: "actions", label: "" },
        ]}
        rows={roomRows}
        isLoading={roomsQuery.isLoading}
        isError={roomsQuery.isError}
        errorMessage={roomsQuery.error ? loginErrorMessage(roomsQuery.error) : undefined}
        onRetry={() => roomsQuery.refetch()}
        emptyMessage="No rooms defined yet."
        searchValue={roomSearch}
        onSearchChange={setRoomSearch}
        searchPlaceholder="Search rooms"
        page={1}
        limit={Math.max(roomRows.length, 1)}
        total={roomRows.length}
        onPageChange={() => { }}
        toolbarActions={
          <RoomFormDialog
            trigger={
              <Button  >
                <Plus className="size-8" aria-hidden="true" />
                Add room
              </Button>
            }
          />
        }
      />
    </div>
  );
}
