import { useMemo, useState } from "react";
import { Badge, Card, Checkbox, Group, Select, Stack, Text, TextInput } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import type { RecordType } from "../../types/dns";
import { useDnsStore } from "../../state/DnsStore";
import { RecordSetTable } from "./RecordSetTable";

const types: (RecordType | "ALL")[] = ["ALL","A","AAAA","CNAME","MX","TXT","SRV","NS","PTR","CAA"];

export function RecordsPage({ initialFilter }: { initialFilter?: RecordType } = {}) {
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
              data={types.map((t) => ({ value: t, label: t === "ALL" ? "All types" : t }))}
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
