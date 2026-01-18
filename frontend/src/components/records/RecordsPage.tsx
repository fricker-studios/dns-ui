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
import type { RecordType } from "../../types/dns";
import { useDnsStore } from "../../state/DnsStore";
import { RecordSetTable } from "./RecordSetTable";
import { BulkAddRecordsPage } from "./BulkAddRecordsPage";

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
  const { activeZone, zoneRecordSets } = useDnsStore();

  const [query, setQuery] = useState("");
  const [type, setType] = useState<RecordType | "ALL">(initialFilter ?? "ALL");
  const [delegationsOnly, setDelegationsOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [showBulkAdd, setShowBulkAdd] = useState(false);

  // Track previous filter values
  const prevFiltersRef = useRef({ query, type, delegationsOnly });

  // Reset to page 1 when filters change (in useEffect to avoid setState during render)
  useEffect(() => {
    const prev = prevFiltersRef.current;
    if (
      prev.query !== query ||
      prev.type !== type ||
      prev.delegationsOnly !== delegationsOnly
    ) {
      prevFiltersRef.current = { query, type, delegationsOnly };
      setCurrentPage(1);
    }
  }, [query, type, delegationsOnly]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return zoneRecordSets.filter((rs) => {
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
  }, [zoneRecordSets, query, type, delegationsOnly]);

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
            onClick={() => setShowBulkAdd(true)}
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
        />
      </Stack>
    </Card>
  );
}
