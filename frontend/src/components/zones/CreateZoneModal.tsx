import { useState } from "react";
import { Button, Group, Modal, SegmentedControl, Stack, Switch, TagsInput, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { Zone, ZoneType } from "../../types/dns";
import { normalizeFqdn, nowIso, uid } from "../../lib/bind";
import { useDnsStore } from "../../state/DnsStore";
import { useCreateZone } from "../../hooks";
import { zoneToApiZoneCreate } from "../../lib/converters";

export function CreateZoneModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const { createZone, refetchZones } = useDnsStore();
  const { createZone: createZoneApi } = useCreateZone();
  const [name, setName] = useState("");
  const [type, setType] = useState<ZoneType>("public");
  const [tags, setTags] = useState<string[]>([]);
  const [dnssec, setDnssec] = useState(false);

  const submit = async () => {
    const fqdn = normalizeFqdn(name);
    if (!fqdn || !fqdn.includes(".")) {
      notifications.show({ color: "red", title: "Invalid zone", message: "Use something like example.com" });
      return;
    }

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
        primaryNs: `ns1.${fqdn}`,
        adminEmail: `hostmaster.${fqdn}`,
        refresh: 3600,
        retry: 600,
        expire: 1209600,
        minimum: 300,
      },
      nameServers: [`ns1.${fqdn}`, `ns2.${fqdn}`, `ns3.${fqdn}`],
    };

    // Call API
    const apiPayload = zoneToApiZoneCreate(z);
    const apiZone = await createZoneApi(apiPayload);
    
    if (apiZone) {
      // Update local state
      await createZone(z);
      notifications.show({ color: "green", title: "Zone created", message: z.name });
      
      // Reset form
      setName("");
      setTags([]);
      setDnssec(false);
      setType("public");
      onClose();
      
      // Refetch zones to get latest from API
      refetchZones();
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Create hosted zone" size="md">
      <Stack>
        <TextInput label="Zone name" placeholder="example.com" value={name} onChange={(e) => setName(e.currentTarget.value)} />
        <SegmentedControl value={type} onChange={(v) => setType(v as ZoneType)} data={[
          { value: "public", label: "Public" },
          { value: "private", label: "Private" },
        ]} />
        <TagsInput
          label="Tags"
          placeholder="Add tags"
          value={tags}
          onChange={setTags}
          data={["prod","dev","lab","public","private","dnssec","internal","external"].map((x) => ({ value: x, label: x }))}
        />
        <Switch checked={dnssec} onChange={(e) => setDnssec(e.currentTarget.checked)} label="Enable DNSSEC (UI stub)" />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>Create</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
