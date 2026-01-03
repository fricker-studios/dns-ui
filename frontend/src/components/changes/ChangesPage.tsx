import { useMemo } from "react";
import { Badge, Card, Group, Paper, Stack, Text } from "@mantine/core";
import { useDnsStore } from "../../state/DnsStore";

function fmt(iso: string) {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

export function ChangesPage() {
  const { state, activeZone } = useDnsStore();

  const list = useMemo(
    () => state.changes.filter((c) => c.zoneId === activeZone.id),
    [state.changes, activeZone.id]
  );

  return (
    <Card withBorder radius="md" p="lg">
      <Text fw={800} mb="sm">Change requests</Text>

      {list.length === 0 ? (
        <Text c="dimmed" size="sm">No change requests yet. Create/edit records to generate staged changes.</Text>
      ) : (
        <Stack>
          {list.map((c) => (
            <Paper key={c.id} withBorder p="md" radius="md">
              <Group justify="space-between" align="flex-start">
                <Stack gap={4}>
                  <Group gap="xs">
                    <Text fw={700}>{c.summary}</Text>
                    <Badge variant="light" color={c.status === "PENDING" ? "blue" : c.status === "APPLIED" ? "green" : "red"}>
                      {c.status}
                    </Badge>
                  </Group>
                  <Text size="xs" c="dimmed">
                    Submitted {fmt(c.submittedAt)}{c.appliedAt ? ` • Applied ${fmt(c.appliedAt)}` : ""}
                  </Text>
                  <Stack gap={2} mt="sm">
                    {c.details.slice(0, 6).map((d, i) => (
                      <Text key={i} size="sm" style={{ fontFamily: "monospace" }}>{d}</Text>
                    ))}
                  </Stack>
                </Stack>
              </Group>
            </Paper>
          ))}
        </Stack>
      )}
    </Card>
  );
}
