import { useMemo } from "react";
import { Card, Paper, Stack, Text, Group, Badge } from "@mantine/core";
import { useDnsStore } from "../../state/DnsStore";

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function AuditPage() {
  const { state, activeZone } = useDnsStore();

  const list = useMemo(
    () =>
      activeZone ? state.audit.filter((a) => a.zoneId === activeZone.id) : [],
    [state.audit, activeZone],
  );

  return (
    <Card withBorder radius="md" p="lg">
      <Text fw={800} mb="sm">
        Audit log
      </Text>

      {list.length === 0 ? (
        <Text c="dimmed" size="sm">
          No audit events yet.
        </Text>
      ) : (
        <Stack>
          {list.map((a) => (
            <Paper key={a.id} withBorder p="md" radius="md">
              <Group justify="space-between" align="flex-start">
                <Stack gap={4}>
                  <Group gap="xs">
                    <Badge variant="light">{a.actor}</Badge>
                    <Text fw={700}>{a.action}</Text>
                  </Group>
                  <Text size="sm">{a.detail}</Text>
                  <Text size="xs" c="dimmed">
                    {fmt(a.at)}
                  </Text>
                </Stack>
              </Group>
            </Paper>
          ))}
        </Stack>
      )}
    </Card>
  );
}
