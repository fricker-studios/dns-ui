import React, { createContext, useContext, useMemo, useReducer } from "react";
import type { AuditEvent, ChangeRequest, RecordSet, Zone } from "../types/dns";
import { seedRecordSets, seedZones } from "../data/seed";
import { nowIso, uid } from "../lib/bind";

type State = {
  zones: Zone[];
  recordSets: RecordSet[];
  changes: ChangeRequest[];
  audit: AuditEvent[];
  activeZoneId: string;
};

type Action =
  | { type: "zone/create"; zone: Zone }
  | { type: "zone/setActive"; zoneId: string }
  | { type: "record/upsert"; recordSet: RecordSet }
  | { type: "record/delete"; recordSetId: string }
  | { type: "change/add"; change: ChangeRequest }
  | { type: "change/applyAll"; zoneId: string }
  | { type: "audit/add"; event: AuditEvent }
  | { type: "zone/update"; zone: Zone };

const initialState: State = {
  zones: seedZones,
  recordSets: seedRecordSets,
  changes: [],
  audit: [
    {
      id: uid(),
      zoneId: "z-1",
      at: "2025-12-22T02:34:00.000Z",
      actor: "alex",
      action: "Updated record",
      detail: "Adjusted MX priorities for alexfricker.com.",
    },
  ],
  activeZoneId: seedZones[0].id,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "zone/create":
      return { ...state, zones: [action.zone, ...state.zones], activeZoneId: action.zone.id };
    case "zone/update":
      return { ...state, zones: state.zones.map((z) => (z.id === action.zone.id ? action.zone : z)) };
    case "zone/setActive":
      return { ...state, activeZoneId: action.zoneId };

    case "record/upsert": {
      const exists = state.recordSets.some((r) => r.id === action.recordSet.id);
      const next = exists
        ? state.recordSets.map((r) => (r.id === action.recordSet.id ? action.recordSet : r))
        : [action.recordSet, ...state.recordSets];
      return { ...state, recordSets: next };
    }

    case "record/delete":
      return { ...state, recordSets: state.recordSets.filter((r) => r.id !== action.recordSetId) };

    case "change/add":
      return { ...state, changes: [action.change, ...state.changes] };

    case "change/applyAll":
      return {
        ...state,
        changes: state.changes.map((c) =>
          c.zoneId === action.zoneId && c.status === "PENDING"
            ? { ...c, status: "APPLIED", appliedAt: nowIso() }
            : c
        ),
      };

    case "audit/add":
      return { ...state, audit: [action.event, ...state.audit] };

    default:
      return state;
  }
}

type Store = {
  state: State;
  activeZone: Zone;
  zoneRecordSets: RecordSet[];

  createZone: (zone: Zone) => void;
  updateZone: (zone: Zone) => void;
  setActiveZone: (zoneId: string) => void;

  upsertRecordSet: (rs: RecordSet, summary: string, details: string[]) => void;
  deleteRecordSet: (recordSetId: string, summary: string, details: string[]) => void;

  applyPendingChanges: () => void;
};

const DnsStoreContext = createContext<Store | null>(null);

export function DnsStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const activeZone = useMemo(() => {
    const z = state.zones.find((x) => x.id === state.activeZoneId);
    return z ?? state.zones[0];
  }, [state.zones, state.activeZoneId]);

  const zoneRecordSets = useMemo(
    () => state.recordSets.filter((r) => r.zoneId === activeZone.id),
    [state.recordSets, activeZone.id]
  );

  const api: Store = useMemo(() => {
    const log = (zoneId: string, action: string, detail: string) => {
      dispatch({
        type: "audit/add",
        event: { id: uid(), zoneId, at: nowIso(), actor: "alex", action, detail },
      });
    };

    const addChange = (zoneId: string, summary: string, details: string[]) => {
      dispatch({
        type: "change/add",
        change: { id: uid(), zoneId, status: "PENDING", summary, submittedAt: nowIso(), details },
      });
    };

    return {
      state,
      activeZone,
      zoneRecordSets,

      createZone: (zone) => {
        dispatch({ type: "zone/create", zone });
        log(zone.id, "Created zone", `${zone.type} zone ${zone.name}`);
      },

      updateZone: (zone) => dispatch({ type: "zone/update", zone }),

      setActiveZone: (zoneId) => dispatch({ type: "zone/setActive", zoneId }),

      upsertRecordSet: (rs, summary, details) => {
        dispatch({ type: "record/upsert", recordSet: rs });
        addChange(rs.zoneId, summary, details);
        log(rs.zoneId, "Upserted record", `${rs.type} ${rs.name}`);
      },

      deleteRecordSet: (recordSetId, summary, details) => {
        const rs = state.recordSets.find((r) => r.id === recordSetId);
        dispatch({ type: "record/delete", recordSetId });
        if (rs) {
          addChange(rs.zoneId, summary, details);
          log(rs.zoneId, "Deleted record", `${rs.type} ${rs.name}`);
        }
      },

      applyPendingChanges: () => {
        dispatch({ type: "change/applyAll", zoneId: activeZone.id });
        log(activeZone.id, "Applied changes", "Simulated: write zone + rndc reload");
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, activeZone, zoneRecordSets]);

  return <DnsStoreContext.Provider value={api}>{children}</DnsStoreContext.Provider>;
}

export function useDnsStore() {
  const ctx = useContext(DnsStoreContext);
  if (!ctx) throw new Error("useDnsStore must be used within DnsStoreProvider");
  return ctx;
}
