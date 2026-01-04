import { useState } from "react";
import { ActionIcon, Button, Divider, Grid, Group, Modal, Paper, Radio, SegmentedControl, Stack, Switch, TagsInput, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import type { Zone, ZoneType } from "../../types/dns";
import { normalizeFqdn, nowIso, uid } from "../../lib/bind";
import { useDnsStore } from "../../state/DnsStore";
import { useCreateZone } from "../../hooks";
import { zoneToApiZoneCreate } from "../../lib/converters";
import type { ApiNameServer } from "../../api/types";

interface NameServerEntry {
  id: string;
  hostname: string;
  ipv4: string;
}

export function CreateZoneModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const { createZone, refetchZones } = useDnsStore();
  const { createZone: createZoneApi } = useCreateZone();
  const [name, setName] = useState("");
  const [type, setType] = useState<ZoneType>("public");
  const [tags, setTags] = useState<string[]>([]);
  const [dnssec, setDnssec] = useState(false);
  const [nameservers, setNameservers] = useState<NameServerEntry[]>([
    { id: uid(), hostname: "", ipv4: "" }
  ]);
  const [primaryNsId, setPrimaryNsId] = useState<string>("");

  const submit = async () => {
    const fqdn = normalizeFqdn(name);
    if (!fqdn || !fqdn.includes(".")) {
      notifications.show({ color: "red", title: "Invalid zone", message: "Use something like example.com" });
      return;
    }

    const validNameservers = nameservers.filter(ns => ns.hostname.trim() && ns.ipv4.trim());
    if (validNameservers.length === 0) {
      notifications.show({ color: "red", title: "Nameservers required", message: "Add at least one nameserver" });
      return;
    }

    const primaryNs = nameservers.find(ns => ns.id === primaryNsId);
    if (!primaryNs || !primaryNs.hostname.trim()) {
      notifications.show({ color: "red", title: "Primary NS required", message: "Select a primary nameserver" });
      return;
    }

    const apiNameservers: ApiNameServer[] = validNameservers.map(ns => ({
      hostname: ns.hostname.trim(),
      ipv4: ns.ipv4.trim()
    }));

    const z: Zone = {
      id: uid(),
      name: fqdn,
      type,
      tags,
      dnssecEnabled: dnssec,
      createdAt: nowIso(),
      comment: "",
      defaultTtl: 300,
      allowTransferTo: [],
      notifyTargets: [],
      soa: {
        primaryNs: primaryNs.hostname,
        adminEmail: `hostmaster.${fqdn}`,
        refresh: 3600,
        retry: 600,
        expire: 1209600,
        minimum: 300,
      },
      nameServers: apiNameservers,
    };

    console.log("Creating zone", z, apiNameservers);

    const apiPayload = zoneToApiZoneCreate(z, apiNameservers);
    const apiZone = await createZoneApi(apiPayload);
    
    if (apiZone) {
      await createZone(z);
      notifications.show({ color: "green", title: "Zone created", message: z.name });
      resetForm();
      onClose();
      refetchZones();
    }
  };

  const resetForm = () => {
    setName("");
    setTags([]);
    setDnssec(false);
    setType("public");
    setNameservers([{ id: uid(), hostname: "", ipv4: "" }]);
    setPrimaryNsId("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const addNameserver = () => {
    const newNs = { id: uid(), hostname: "", ipv4: "" };
    setNameservers([...nameservers, newNs]);
  };

  const removeNameserver = (id: string) => {
    if (nameservers.length <= 1) return;
    setNameservers(nameservers.filter(ns => ns.id !== id));
    if (primaryNsId === id) {
      setPrimaryNsId(nameservers.find(ns => ns.id !== id)?.id || "");
    }
  };

  const updateNameserver = (id: string, field: 'hostname' | 'ipv4', value: string) => {
    setNameservers(nameservers.map(ns => 
      ns.id === id ? { ...ns, [field]: value } : ns
    ));
  };

  return (
    <Modal opened={opened} onClose={handleClose} title="Create hosted zone" size="lg">
      <Stack>
        <TextInput 
          label="Zone name" 
          placeholder="example.com" 
          value={name} 
          onChange={(e) => setName(e.currentTarget.value)} 
        />
        <SegmentedControl 
          value={type} 
          onChange={(v) => setType(v as ZoneType)} 
          data={[
            { value: "public", label: "Public" },
            { value: "private", label: "Private" },
          ]} 
        />

        <Divider label="Nameservers" labelPosition="left" />
        
        <Paper withBorder p="md" radius="md">
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Define the authoritative nameservers for this zone. Each NS will have an A record created.
            </Text>
            
            {nameservers.map((ns, index) => (
              <Paper key={ns.id} withBorder p="sm" radius="sm">
                <Stack gap="sm">
                  <Group justify="space-between" align="center">
                    <Radio
                      label="Primary"
                      checked={primaryNsId === ns.id}
                      onChange={() => setPrimaryNsId(ns.id)}
                      disabled={!ns.hostname.trim()}
                    />
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => removeNameserver(ns.id)}
                      disabled={nameservers.length <= 1}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                  
                  <Grid>
                    <Grid.Col span={7}>
                      <TextInput
                        label={`NS ${index + 1} Hostname`}
                        placeholder="ns1"
                        value={ns.hostname}
                        onChange={(e) => updateNameserver(ns.id, 'hostname', e.currentTarget.value)}
                      />
                    </Grid.Col>
                    <Grid.Col span={5}>
                      <TextInput
                        label="IPv4 Address"
                        placeholder="203.0.113.1"
                        value={ns.ipv4}
                        onChange={(e) => updateNameserver(ns.id, 'ipv4', e.currentTarget.value)}
                      />
                    </Grid.Col>
                  </Grid>
                </Stack>
              </Paper>
            ))}
            
            <Button
              variant="light"
              leftSection={<IconPlus size={16} />}
              onClick={addNameserver}
            >
              Add nameserver
            </Button>
          </Stack>
        </Paper>

        <TagsInput
          label="Tags"
          placeholder="Add tags"
          value={tags}
          onChange={setTags}
          data={["prod","dev","lab","public","private","dnssec","internal","external"].map((x) => ({ value: x, label: x }))}
        />
        <Switch 
          checked={dnssec} 
          onChange={(e) => setDnssec(e.currentTarget.checked)} 
          label="Enable DNSSEC (UI stub)" 
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={handleClose}>Cancel</Button>
          <Button onClick={submit}>Create</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
