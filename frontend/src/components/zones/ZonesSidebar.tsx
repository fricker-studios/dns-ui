import { useMemo, useState } from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { IconGlobe, IconLock, IconPlus, IconSearch } from "@tabler/icons-react";
import { useDnsStore } from "../../state/DnsStore";
import { humanizeZoneName } from "../../lib/bind";
import { CreateZoneModal } from "./CreateZoneModal";

export function ZonesSidebar() {
  const { state, setActiveZone, state: { activeZoneId } } = useDnsStore();
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const zones = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return state.zones;
    return state.zones.filter((z) =>
      z.name.toLowerCase().includes(q) ||
      z.tags.some((t) => t.toLowerCase().includes(q)) ||
      (z.comment ?? "").toLowerCase().includes(q)
    );
  }, [state.zones, query]);

  return (
    <>
      <Stack gap="sm" h="100%">
        <Group justify="space-between">
          <Group gap="xs">
            <Title order={5}>Hosted zones</Title>
          </Group>
          <ActionIcon variant="default" onClick={() => setCreateOpen(true)} title="Create zone">
            <IconPlus size={18} />
          </ActionIcon>
        </Group>

        <TextInput
          leftSection={<IconSearch size={16} />}
          placeholder="Search zones…"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
        />

        <ScrollArea h="calc(100vh - 210px)" type="hover">
          <Stack gap={8}>
            {zones.map((z) => {
              const selected = z.id === activeZoneId;
              return (
                <Paper
                  key={z.id}
                  withBorder
                  p="sm"
                  radius="md"
                  style={{ cursor: "pointer", opacity: selected ? 1 : 0.95 }}
                  onClick={() => setActiveZone(z.id)}
                >
                  <Group justify="space-between" align="flex-start">
                    <Box>
                      <Group gap="xs">
                        <Text fw={700}>{humanizeZoneName(z.name)}</Text>
                        <Badge
                          variant="light"
                          leftSection={z.type === "public" ? <IconGlobe size={14} /> : <IconLock size={14} />}
                        >
                          {z.type}
                        </Badge>
                      </Group>
                      {z.comment ? (
                        <Text size="xs" c="dimmed" mt={6} lineClamp={1}>{z.comment}</Text>
                      ) : null}
                      <Group gap={6} mt="sm" wrap="wrap">
                        {z.tags.slice(0, 4).map((t) => (
                          <Badge key={t} variant="outline" radius="sm">{t}</Badge>
                        ))}
                      </Group>
                    </Box>
                    <ThemeIcon variant="light" radius="md">
                      {z.type === "public" ? <IconGlobe size={16} /> : <IconLock size={16} />}
                    </ThemeIcon>
                  </Group>
                </Paper>
              );
            })}

            {zones.length === 0 ? (
              <Text c="dimmed" size="sm">
                No zones match your search.
              </Text>
            ) : null}
          </Stack>
        </ScrollArea>
      </Stack>

      <CreateZoneModal opened={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
