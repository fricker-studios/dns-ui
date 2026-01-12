import { useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Box,
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
import { IconSearch, IconCheck, IconClock } from "@tabler/icons-react";
import type { RecordType } from "../../types/dns";
import { useDnsStore } from "../../state/DnsStore";
import { RecordSetTable } from "./RecordSetTable";

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
              <Badge variant="outline" color="blue">Secondary Zone</Badge>
            </Group>
            <Text size="sm" c="dimmed">
              Zone: <Badge variant="light">{activeZone.name}</Badge>
            </Text>
          </Stack>

          <Alert color="blue" title="Read-only replica zone">
            This is a secondary zone that replicates from your configured primary DNS servers.
            Records are automatically transferred and cannot be created or modified through this interface.
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
        <Group justify="space-between" align="flex-end">
          <Stack gap={2}>
            <Text fw={800}>Recordsets</Text>
            <Text size="sm" c="dimmed">
              Zone: <Badge variant="light">{activeZone.name}</Badge>
            </Text>
          </Stack>

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

        <RecordSetTable recordSets={filtered} />
      </Stack>
    </Card>
  );
}
