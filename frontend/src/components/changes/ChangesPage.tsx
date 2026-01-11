import { useMemo } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Paper,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { IconReload, IconX } from "@tabler/icons-react";
import { useDnsStore } from "../../state/DnsStore";

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function ChangesPage() {
  const { state, activeZone, revertChange, revertAllChanges } = useDnsStore();

  const list = useMemo(
    () =>
      activeZone ? state.changes.filter((c) => c.zoneId === activeZone.id) : [],
    [state.changes, activeZone],
  );

  const pendingCount = useMemo(
    () => list.filter((c) => c.status === "PENDING").length,
    [list],
  );

  return (
    <Card withBorder radius="md" p="lg">
      <Group justify="space-between" mb="sm">
        <Text fw={800}>Change requests</Text>
        {pendingCount > 0 && activeZone && (
          <Button
            variant="light"
            color="orange"
            leftSection={<IconReload size={16} />}
            onClick={() => revertAllChanges(activeZone.id)}
          >
            Revert all ({pendingCount})
          </Button>
        )}
      </Group>

      {list.length === 0 ? (
        <Text c="dimmed" size="sm">
          No change requests yet. Create/edit records to generate staged
          changes.
        </Text>
      ) : (
        <Stack>
          {list.map((c) => (
            <Paper key={c.id} withBorder p="md" radius="md">
              <Group justify="space-between" align="flex-start">
                <Stack gap={4} style={{ flex: 1 }}>
                  <Group gap="xs">
                    <Text fw={700}>{c.summary}</Text>
                    <Badge
                      variant="light"
                      color={
                        c.status === "PENDING"
                          ? "blue"
                          : c.status === "APPLIED"
                            ? "green"
                            : "red"
                      }
                    >
                      {c.status}
                    </Badge>
                  </Group>
                  <Text size="xs" c="dimmed">
                    Submitted {fmt(c.submittedAt)}
                    {c.appliedAt ? ` • Applied ${fmt(c.appliedAt)}` : ""}
                  </Text>
                  <Stack gap={2} mt="sm">
                    {c.details.slice(0, 6).map((d, i) => (
                      <Text
                        key={i}
                        size="sm"
                        style={{ fontFamily: "monospace" }}
                      >
                        {d}
                      </Text>
                    ))}
                  </Stack>
                </Stack>
                {c.status === "PENDING" && (
                  <Tooltip label="Revert this change">
                    <ActionIcon
                      variant="light"
                      color="orange"
                      size="lg"
                      onClick={() => revertChange(c.id)}
                    >
                      <IconX size={18} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>
            </Paper>
          ))}
        </Stack>
      )}
    </Card>
  );
}
