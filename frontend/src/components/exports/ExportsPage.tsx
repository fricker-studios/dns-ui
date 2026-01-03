import { useMemo } from "react";
import { Button, Card, Code, Grid, Group, ScrollArea, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { computeNamedConfSnippet, computeZoneFile } from "../../lib/bind";
import { useDnsStore } from "../../state/DnsStore";

export function ExportsPage() {
  const { activeZone, zoneRecordSets } = useDnsStore();
  const zoneFile = useMemo(() => computeZoneFile(activeZone, zoneRecordSets), [activeZone, zoneRecordSets]);
  const named = useMemo(() => computeNamedConfSnippet(activeZone), [activeZone]);

  return (
    <Card withBorder radius="md" p="lg">
      <Group justify="space-between" mb="sm">
        <Text fw={800}>Exports</Text>
        <Button
          variant="light"
          onClick={() => notifications.show({ title: "Tip", message: "Wire this to download/copy in a real app." })}
        >
          Actions (stub)
        </Button>
      </Group>

      <Grid>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Text fw={700} mb="xs">Zone file (db.*)</Text>
          <ScrollArea h={420} type="hover">
            <Code block style={{ whiteSpace: "pre" }}>{zoneFile}</Code>
          </ScrollArea>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Text fw={700} mb="xs">named.conf snippet</Text>
          <ScrollArea h={420} type="hover">
            <Code block style={{ whiteSpace: "pre" }}>{named}</Code>
          </ScrollArea>
        </Grid.Col>
      </Grid>
    </Card>
  );
}
