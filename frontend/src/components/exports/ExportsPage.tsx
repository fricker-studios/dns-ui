import { useEffect, useMemo, useState } from "react";
import { Button, Card, Code, Grid, Group, Loader, ScrollArea, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { computeNamedConfSnippet, computeZoneFile } from "../../lib/bind";
import { useDnsStore } from "../../state/DnsStore";
import { useZoneFileExport } from "../../hooks";

export function ExportsPage() {
  const { activeZone, zoneRecordSets } = useDnsStore();
  const { exportZoneFile, loading } = useZoneFileExport();
  const [apiZoneFile, setApiZoneFile] = useState<string>("");
  
  const localZoneFile = useMemo(() => 
    activeZone ? computeZoneFile(activeZone, zoneRecordSets) : "", 
    [activeZone, zoneRecordSets]
  );
  const named = useMemo(() => activeZone ? computeNamedConfSnippet(activeZone) : "", [activeZone]);

  useEffect(() => {
    if (activeZone) {
      exportZoneFile(activeZone.name).then((data) => {
        if (data) setApiZoneFile(data.text);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeZone]);

  if (!activeZone) {
    return (
      <Card withBorder radius="md" p="lg">
        <Text c="dimmed">No zone selected</Text>
      </Card>
    );
  }

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
          <Text fw={700} mb="xs">Zone file (from API)</Text>
          <ScrollArea h={420} type="hover">
            {loading ? (
              <Loader size="sm" />
            ) : (
              <Code block style={{ whiteSpace: "pre" }}>{apiZoneFile || "No data"}</Code>
            )}
          </ScrollArea>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Text fw={700} mb="xs">Zone file (local preview)</Text>
          <ScrollArea h={420} type="hover">
            <Code block style={{ whiteSpace: "pre" }}>{localZoneFile}</Code>
          </ScrollArea>
        </Grid.Col>
        <Grid.Col span={{ base: 12 }}>
          <Text fw={700} mb="xs">named.conf snippet</Text>
          <ScrollArea h={280} type="hover">
            <Code block style={{ whiteSpace: "pre" }}>{named}</Code>
          </ScrollArea>
        </Grid.Col>
      </Grid>
    </Card>
  );
}
