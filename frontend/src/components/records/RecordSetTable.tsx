import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Code,
  Group,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  Pagination,
} from "@mantine/core";
import { IconEdit, IconTrash } from "@tabler/icons-react";
import type { RecordSet } from "../../types/dns";
import { humanizeZoneName } from "../../lib/bind";
import { useDnsStore } from "../../state/DnsStore";
import { RecordSetModal } from "./RecordSetModal";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

interface RecordSetTableProps {
  recordSets: RecordSet[];
  totalRecords: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function RecordSetTable({
  recordSets,
  totalRecords,
  currentPage,
  pageSize,
  totalPages,
  onPageChange,
  onPageSizeChange,
}: RecordSetTableProps) {
  const { activeZone, deleteRecordSet } = useDnsStore();
  const [edit, setEdit] = useState<RecordSet | null>(null);

  if (!activeZone) return null;

  return (
    <Stack gap="md">
      <ScrollArea type="hover">
        <Table highlightOnHover verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th w={90}>Type</Table.Th>
              <Table.Th>Values</Table.Th>
              <Table.Th w={90}>TTL</Table.Th>
              <Table.Th w={170}>Updated</Table.Th>
              <Table.Th w={110}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {recordSets.map((rs) => (
              <Table.Tr key={rs.id}>
                <Table.Td>
                  <Text fw={700}>{humanizeZoneName(rs.name)}</Text>
                  {rs.comment ? (
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {rs.comment}
                    </Text>
                  ) : null}
                </Table.Td>
                <Table.Td>
                  <Badge variant="light">{rs.type}</Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap={6} wrap="wrap">
                    {rs.values.slice(0, 4).map((v) => {
                      if (rs.type === "MX")
                        return (
                          <Badge key={v.id} variant="light">
                            <Code>
                              {v.priority} {humanizeZoneName(v.value)}
                            </Code>
                          </Badge>
                        );
                      if (rs.type === "SRV")
                        return (
                          <Badge key={v.id} variant="light">
                            <Code>
                              {v.priority} {v.weight} {v.port}{" "}
                              {humanizeZoneName(v.value)}
                            </Code>
                          </Badge>
                        );
                      return (
                        <Badge key={v.id} variant="light">
                          <Code>
                            {rs.type === "TXT"
                              ? v.value
                              : humanizeZoneName(v.value)}
                          </Code>
                        </Badge>
                      );
                    })}
                    {rs.values.length > 4 ? (
                      <Badge variant="outline">+{rs.values.length - 4}</Badge>
                    ) : null}
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Code>{rs.ttl ?? activeZone.defaultTtl}</Code>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {formatDate(rs.updatedAt)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Group gap={8}>
                    <ActionIcon
                      variant="default"
                      onClick={() => setEdit(rs)}
                      title="Edit"
                    >
                      <IconEdit size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="default"
                      color="red"
                      onClick={() =>
                        deleteRecordSet(rs.id, `Delete ${rs.type} ${rs.name}`, [
                          "Removed recordset",
                          ...rs.values.map((v) => `- ${v.value}`),
                        ])
                      }
                      title="Delete"
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>

        {recordSets.length === 0 ? (
          <Text c="dimmed" size="sm" mt="md">
            No recordsets match your filters.
          </Text>
        ) : null}
      </ScrollArea>

      <Group justify="space-between" align="center">
        <Group gap="xs">
          <Text size="sm" c="dimmed">
            Page size:
          </Text>
          <Select
            size="xs"
            w={80}
            value={String(pageSize)}
            onChange={(v) => v && onPageSizeChange(Number(v))}
            data={[
              { value: "10", label: "10" },
              { value: "25", label: "25" },
              { value: "50", label: "50" },
              { value: "100", label: "100" },
              { value: "200", label: "200" },
            ]}
          />
          <Text size="sm" c="dimmed">
            Showing {(currentPage - 1) * pageSize + 1}-
            {Math.min(currentPage * pageSize, totalRecords)} of {totalRecords}{" "}
            records
          </Text>
        </Group>
        {totalPages > 1 && (
          <Pagination
            value={currentPage}
            onChange={onPageChange}
            total={totalPages}
            size="sm"
          />
        )}
      </Group>

      <RecordSetModal
        opened={!!edit}
        onClose={() => setEdit(null)}
        editRecordSet={edit ?? undefined}
      />
    </Stack>
  );
}
