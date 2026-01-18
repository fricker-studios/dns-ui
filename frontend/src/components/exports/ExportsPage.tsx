import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Code,
  Grid,
  Group,
  Loader,
  ScrollArea,
  Text,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useDnsStore } from "../../state/DnsStore";
import { useZoneFileExport, useZoneStanzaExport } from "../../hooks";

export function ExportsPage() {
  const { activeZone } = useDnsStore();
  const { exportZoneFile, loading: zoneLoading } = useZoneFileExport();
  const { exportZoneStanza, loading: stanzaLoading } = useZoneStanzaExport();
  const [apiZoneFile, setApiZoneFile] = useState<string>("");
  const [apiStanza, setApiStanza] = useState<string>("");

  useEffect(() => {
    if (activeZone) {
      // Only try to export zone file for primary zones
      if (activeZone.role !== "secondary") {
        exportZoneFile(activeZone.name)
          .then((data) => {
            if (data) setApiZoneFile(data.text);
          })
          .catch((err) => {
            console.error("Failed to export zone file:", err);
            setApiZoneFile("");
          });
      } else {
        setApiZoneFile("");
      }

      exportZoneStanza(activeZone.name).then((data) => {
        if (data) setApiStanza(data.text);
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
          onClick={() =>
            notifications.show({
              title: "Coming Soon",
              message: "Download/copy functionality coming soon!",
            })
          }
        >
          Actions
        </Button>
      </Group>

      <Grid>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Text fw={700} mb="xs">
            Zone file
          </Text>
          <ScrollArea h={420} type="hover">
            {zoneLoading ? (
              <Loader size="sm" />
            ) : activeZone.role === "secondary" ? (
              <Card withBorder p="md">
                <Text size="sm" c="dimmed">
                  Zone files cannot be exported for secondary zones. Secondary
                  zones store their data in BIND's binary format after zone
                  transfer from the primary server.
                </Text>
              </Card>
            ) : (
              <Code block style={{ whiteSpace: "pre" }}>
                {apiZoneFile || "No data"}
              </Code>
            )}
          </ScrollArea>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Text fw={700} mb="xs">
            named.conf stanza
          </Text>
          <ScrollArea h={420} type="hover">
            {stanzaLoading ? (
              <Loader size="sm" />
            ) : (
              <Code block style={{ whiteSpace: "pre" }}>
                {apiStanza || "No data"}
              </Code>
            )}
          </ScrollArea>
        </Grid.Col>
      </Grid>
    </Card>
  );
}
