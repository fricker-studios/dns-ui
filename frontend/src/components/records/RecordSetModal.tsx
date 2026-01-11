import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Flex,
  Grid,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  TextInput,
  Textarea,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { RecordSet, RecordType, RecordValue } from "../../types/dns";
import {
  fqdnJoin,
  normalizeFqdn,
  nowIso,
  uid,
  validateRecordInput,
} from "../../lib/bind";
import { useDnsStore } from "../../state/DnsStore";

const recordTypeOptions: { value: RecordType; label: string }[] = [
  { value: "A", label: "A — IPv4" },
  { value: "AAAA", label: "AAAA — IPv6" },
  { value: "CNAME", label: "CNAME — Alias" },
  { value: "MX", label: "MX — Mail exchanger" },
  { value: "TXT", label: "TXT — Text" },
  { value: "SRV", label: "SRV — Service" },
  { value: "NS", label: "NS — Name server" },
  { value: "PTR", label: "PTR — Reverse pointer" },
  { value: "CAA", label: "CAA — CA authorization" },
];

export function RecordSetModal({
  opened,
  onClose,
  editRecordSet,
}: {
  opened: boolean;
  onClose: () => void;
  editRecordSet?: RecordSet;
}) {
  const { activeZone, upsertRecordSet } = useDnsStore();

  const mode = editRecordSet ? "edit" : "create";

  const [type, setType] = useState<RecordType>("A");
  const [label, setLabel] = useState("@");
  const [ttl, setTtl] = useState<number | "">("");
  const [comment, setComment] = useState("");
  const [values, setValues] = useState<RecordValue[]>([
    { id: uid(), value: "" },
  ]);

  useEffect(() => {
    if (!opened || !activeZone) return;
    if (!editRecordSet) {
      setType("A");
      setLabel("@");
      setTtl("");
      setComment("");
      setValues([{ id: uid(), value: "" }]);
      return;
    }
    setType(editRecordSet.type);
    const rel =
      editRecordSet.name === activeZone.name
        ? "@"
        : editRecordSet.name.replace(activeZone.name, "").replace(/\.$/, "");
    setLabel(rel || "@");
    setTtl(editRecordSet.ttl ?? "");
    setComment(editRecordSet.comment ?? "");
    setValues(editRecordSet.values.map((v) => ({ ...v })));
  }, [opened, editRecordSet, activeZone]);

  // When switching to CNAME, limit to single value
  useEffect(() => {
    if (type === "CNAME" && values.length > 1) {
      setValues([values[0]]);
    }
  }, [type]);

  const fqdn = useMemo(
    () => (activeZone ? fqdnJoin(label || "@", activeZone.name) : ""),
    [label, activeZone],
  );

  const save = () => {
    if (!activeZone) return;
    const normalizedValues = values.map((v) => {
      let val = String(v.value ?? "").trim();
      if (["CNAME", "NS", "PTR", "MX", "SRV"].includes(type))
        val = normalizeFqdn(val);
      return { ...v, value: val };
    });

    const errors = validateRecordInput({
      type,
      name: fqdn,
      values: normalizedValues,
    });
    if (errors.length) {
      notifications.show({
        color: "red",
        title: "Validation",
        message: errors[0],
      });
      return;
    }

    const rs: RecordSet = {
      id: editRecordSet?.id ?? uid(),
      zoneId: activeZone.id,
      name: fqdn,
      type,
      ttl: ttl === "" ? undefined : Number(ttl),
      values: normalizedValues.map((v) => ({ ...v, id: v.id || uid() })),
      comment: comment.trim() || undefined,
      routing: editRecordSet?.routing ?? { policy: "simple" },
      createdAt: editRecordSet?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
    };

    upsertRecordSet(
      rs,
      `${mode === "create" ? "Create" : "Update"} ${rs.type} ${rs.name}`,
      [
        mode === "create" ? "Added recordset" : "Updated recordset",
        ...rs.values.map((v) => `• ${v.value}`),
      ],
    );

    notifications.show({
      color: "green",
      title: "Saved",
      message: `${rs.type} ${rs.name}`,
    });
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={mode === "create" ? "Create record" : "Edit record"}
      size="xl"
    >
      <Stack>
        <Grid>
          <Grid.Col span={{ base: 12 }} m={0} p={0}>
          <Flex
            justify="flex-start"
            align="flex-end"
            direction="row"
          >
            <Grid.Col span={{ base: 12, md: 6 }}>
              <TextInput
                label="Name (label)"
                value={label}
                onChange={(e) => setLabel(e.currentTarget.value)}
                description={`FQDN: ${fqdn}`}
                placeholder="@, www, api, _sip._tcp"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Select
                label="Type"
                data={recordTypeOptions}
                value={type}
                onChange={(v) => setType((v as RecordType) ?? "A")}
              />
            </Grid.Col>
          </Flex>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 4 }}>
            <NumberInput
              label="TTL (seconds)"
              value={ttl}
              onChange={setTtl as any}
              placeholder={`${activeZone?.defaultTtl ?? 300}`}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Textarea
              label="Comment"
              value={comment}
              onChange={(e) => setComment(e.currentTarget.value)}
            />
          </Grid.Col>
        </Grid>

        <Stack gap="xs">
          {values.map((v, idx) => (
            <Group key={v.id} align="end" justify="start">
              <TextInput
                flex={1}
                miw={100}
                label={`Value #${idx + 1}`}
                value={v.value}
                onChange={(e) =>
                  setValues((prev) =>
                    prev.map((x) =>
                      x.id === v.id
                        ? { ...x, value: e.currentTarget.value }
                        : x,
                    ),
                  )
                }
                placeholder={
                  type === "A"
                    ? "203.0.113.10"
                    : type === "AAAA"
                      ? "2001:db8::10"
                      : type === "TXT"
                        ? "v=spf1 include:_spf.google.com ~all"
                        : type === "CAA"
                          ? '0 issue "letsencrypt.org"'
                          : "target.example.com."
                }
              />

              {type === "MX" ? (
                  <NumberInput
                    label="Priority"
                    value={v.priority ?? 10}
                    onChange={(val) =>
                      setValues((p) =>
                        p.map((x) =>
                          x.id === v.id
                            ? { ...x, priority: Number(val ?? 10) }
                            : x,
                        ),
                      )
                    }
                  />
              ) : null}

              {type === "SRV" ? (
                <>
                    <NumberInput
                      label="Priority"
                      w={100}
                      value={v.priority ?? 10}
                      onChange={(val) =>
                        setValues((p) =>
                          p.map((x) =>
                            x.id === v.id
                              ? { ...x, priority: Number(val ?? 10) }
                              : x,
                          ),
                        )
                      }
                    />
                    <NumberInput
                      label="Weight"
                      w={100}
                      value={v.weight ?? 5}
                      onChange={(val) =>
                        setValues((p) =>
                          p.map((x) =>
                            x.id === v.id
                              ? { ...x, weight: Number(val ?? 5) }
                              : x,
                          ),
                        )
                      }
                    />
                    <NumberInput
                      label="Port"
                      w={100}
                      value={v.port ?? 443}
                      onChange={(val) =>
                        setValues((p) =>
                          p.map((x) =>
                            x.id === v.id
                              ? { ...x, port: Number(val ?? 443) }
                              : x,
                          ),
                        )
                      }
                      min={0}
                      max={65535}
                    />
                </>
              ) : null}

              {(type !== "CNAME" && values.length > 1) && (
                <Button
                    variant="default"
                    color="red"
                    onClick={() =>
                      setValues((p) => p.filter((x) => x.id !== v.id))
                    }
                  >
                    Remove
                </Button>
            )}
            </Group>
          ))}
          <Group justify="space-between" mt={5}>
            {type !== "CNAME" && (
              <Button
                variant="light"
                onClick={() => setValues((p) => [...p, { id: uid(), value: "" }])}
              >
                Add value
              </Button>
            )}
            <Group ml={type === "CNAME" ? "auto" : undefined}>
              <Button variant="default" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={save}>
                {mode === "create" ? "Create" : "Save"}
              </Button>
            </Group>
          </Group>
        </Stack>
      </Stack>
    </Modal>
  );
}
