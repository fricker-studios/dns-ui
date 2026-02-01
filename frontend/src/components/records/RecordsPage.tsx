import { useMemo, useState, useEffect, useRef } from "react";
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Group,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
} from "@mantine/core";
import {
  IconSearch,
  IconCheck,
  IconClock,
  IconPlus,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import type { RecordType } from "../../types/dns";
import { useDnsStore } from "../../state/DnsStore";
import { RecordSetTable } from "./RecordSetTable";
import { BulkAddRecordsPage } from "./BulkAddRecordsPage";
import { getCookie, setCookie } from "../../lib/utils";

const types: (RecordType | "ALL")[] = [
  "ALL",
  "A",
  "AAAA",
  "CNAME",
  "MX",
  "TXT",
  "SRV",
  "NS",
  "PTR",
  "CAA",
];

export function RecordsPage({
  initialFilter,
}: { initialFilter?: RecordType } = {}) {
  const { activeZone, zoneRecordSets, deleteRecordSet } = useDnsStore();

  const [query, setQuery] = useState("");
  const [type, setType] = useState<RecordType | "ALL">(initialFilter ?? "ALL");
  const [delegationsOnly, setDelegationsOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sortBy, setSortBy] = useState<"name" | "type" | "values" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Track previous filter values
  const prevFiltersRef = useRef({ query, type, delegationsOnly });

  // Reset to page 1 and clear selections when filters change (in useEffect to avoid setState during render)
  useEffect(() => {
    const prev = prevFiltersRef.current;
    if (
      prev.query !== query ||
      prev.type !== type ||
      prev.delegationsOnly !== delegationsOnly
    ) {
      prevFiltersRef.current = { query, type, delegationsOnly };
      setCurrentPage(1);
      setSelectedIds(new Set());
    }
  }, [query, type, delegationsOnly]);

  // Clear selections when page changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [currentPage, pageSize]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const results = zoneRecordSets.filter((rs) => {
      if (delegationsOnly && rs.type !== "NS") return false;
      if (type !== "ALL" && rs.type !== type) return false;
      if (!q) return true;
      return (
        rs.name.toLowerCase().includes(q) ||
        rs.type.toLowerCase().includes(q) ||
        rs.values.some((v) => (v.value ?? "").toLowerCase().includes(q)) ||
        (rs.comment ?? "").toLowerCase().includes(q)
      );
    });

    // Apply sorting if active
    if (!sortBy) return results;

    return results.sort((a, b) => {
      let comparison = 0;
      if (sortBy === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === "type") {
        comparison = a.type.localeCompare(b.type);
      } else if (sortBy === "values") {
        const aValue = a.values[0]?.value ?? "";
        const bValue = b.values[0]?.value ?? "";
        comparison = aValue.localeCompare(bValue);
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [zoneRecordSets, query, type, delegationsOnly, sortBy, sortDirection]);

  // Client-side pagination of filtered results
  const paginatedFiltered = useMemo(() => {
    // Clamp current page to valid range when filters change
    const maxPage = Math.ceil(filtered.length / pageSize) || 1;
    const safePage = Math.min(currentPage, maxPage);
    const startIdx = (safePage - 1) * pageSize;
    const endIdx = startIdx + pageSize;
    return filtered.slice(startIdx, endIdx);
  }, [filtered, currentPage, pageSize]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;

    const recordsToDelete = zoneRecordSets.filter((rs) =>
      selectedIds.has(rs.id),
    );
    recordsToDelete.forEach((rs) => {
      deleteRecordSet(rs.id, `Delete ${rs.type} ${rs.name}`, [
        "Removed recordset",
        ...rs.values.map((v) => `- ${v.value}`),
      ]);
    });

    setSelectedIds(new Set());
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (
      selectedIds.size === paginatedFiltered.length &&
      paginatedFiltered.length > 0
    ) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedFiltered.map((rs) => rs.id)));
    }
  };

  const allSelected =
    paginatedFiltered.length > 0 &&
    selectedIds.size === paginatedFiltered.length;

  // If showing bulk add page, render that instead (after all hooks)
  if (showBulkAdd) {
    return <BulkAddRecordsPage onClose={() => setShowBulkAdd(false)} />;
  }

  if (!activeZone) {
    return (
      <Card withBorder radius="md" p="lg">
        <Text c="dimmed">No zone selected</Text>
      </Card>
    );
  }

  // Secondary zones display status instead of recordset table
  if (activeZone.role === "secondary") {
    return (
      <Card withBorder radius="md" p="lg">
        <Stack gap="lg">
          <Stack gap={2}>
            <Group>
              <Text fw={800}>Recordsets</Text>
              <Badge variant="outline" color="blue">
                Secondary Zone
              </Badge>
            </Group>
            <Text size="sm" c="dimmed" component="span">
              Zone: <Badge variant="light">{activeZone.name}</Badge>
            </Text>
          </Stack>

          <Alert color="blue" title="Read-only replica zone">
            This is a secondary zone that replicates from your configured
            primary DNS servers. Records are automatically transferred and
            cannot be created or modified through this interface.
          </Alert>

          <Paper withBorder p="md" radius="md">
            <Stack gap="md">
              <Group>
                <ThemeIcon color="green" variant="light" size="lg">
                  <IconCheck size={20} />
                </ThemeIcon>
                <Box>
                  <Text fw={500}>Zone transfer active</Text>
                  <Text size="sm" c="dimmed">
                    Zone data is being replicated from primary server
                  </Text>
                </Box>
              </Group>

              <Group>
                <ThemeIcon color="gray" variant="light" size="lg">
                  <IconClock size={20} />
                </ThemeIcon>
                <Box>
                  <Text fw={500}>Binary zone file</Text>
                  <Text size="sm" c="dimmed">
                    Zone data is stored in BIND's binary format after transfer
                  </Text>
                </Box>
              </Group>
            </Stack>
          </Paper>
        </Stack>
      </Card>
    );
  }

  return (
    <Card withBorder radius="md" p="lg">
      <Stack gap="sm">
        <Stack gap={2}>
          <Text fw={800}>Recordsets</Text>
          <Text size="sm" c="dimmed" component="span">
            Zone: <Badge variant="light">{activeZone.name}</Badge>
          </Text>
        </Stack>

        <Group justify="space-between" align="center">
          <Button
            variant="light"
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              // Show reminder notification at most once per hour
              const lastShown = getCookie("dnsui_last_refresh_reminder");
              const now = Date.now();
              const oneHour = 60 * 60 * 1000;

              if (!lastShown || now - parseInt(lastShown, 10) > oneHour) {
                notifications.show({
                  color: "blue",
                  title: "Reminder",
                  message:
                    "If others may be editing this zone, refresh the page first to avoid conflicts",
                  autoClose: 5000,
                });
                setCookie("dnsui_last_refresh_reminder", now.toString(), 2);
              }

              setShowBulkAdd(true);
            }}
          >
            Add records
          </Button>

          <Group>
            <TextInput
              leftSection={<IconSearch size={16} />}
              placeholder="Search records…"
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
            />
            <Select
              w={140}
              value={type}
              onChange={(v) => setType((v as any) ?? "ALL")}
              data={types.map((t) => ({
                value: t,
                label: t === "ALL" ? "All types" : t,
              }))}
            />
            <Checkbox
              label="Delegations only"
              checked={delegationsOnly}
              onChange={(e) => setDelegationsOnly(e.currentTarget.checked)}
            />
          </Group>
        </Group>

        <RecordSetTable
          recordSets={paginatedFiltered}
          totalRecords={filtered.length}
          currentPage={currentPage}
          pageSize={pageSize}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          selectedIds={selectedIds}
          onToggleSelection={toggleSelection}
          onToggleSelectAll={toggleSelectAll}
          allSelected={allSelected}
          onBulkDelete={handleBulkDelete}
          sortBy={sortBy}
          sortDirection={sortDirection}
          onSort={(field) => {
            if (sortBy === field) {
              if (sortDirection === "asc") {
                setSortDirection("desc");
              } else {
                setSortBy(null);
                setSortDirection("asc");
              }
            } else {
              setSortBy(field);
              setSortDirection("asc");
            }
          }}
        />
      </Stack>
    </Card>
  );
}
