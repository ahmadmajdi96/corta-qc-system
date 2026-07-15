import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/mes/mes-page";
import { Ruler } from "lucide-react";

const AQL_LEVELS = [0.065, 0.1, 0.25, 0.4, 0.65, 1.0, 1.5, 2.5, 4.0, 6.5];

export function IsoSamplingCalculator({ defaultLotSize, embedded }: { defaultLotSize?: number; embedded?: boolean }) {
  const [lotSize, setLotSize] = useState<number>(defaultLotSize ?? 500);
  const [aql, setAql] = useState<number>(1.0);

  const plan = useQuery({
    queryKey: ["iso-sampling", lotSize, aql],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("iso_2859_1_sample", { _lot_size: lotSize, _aql: aql } as any);
      if (error) throw error;
      return (data as any[])?.[0] as { code_letter: string; sample_size: number; accept: number; reject: number };
    },
    enabled: lotSize > 0 && aql > 0,
  });

  const inner = (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label className="text-xs">Lot size</Label>
          <Input type="number" min={1} value={lotSize} onChange={(e) => setLotSize(Math.max(1, Number(e.target.value) || 1))} />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">AQL (%)</Label>
          <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={aql} onChange={(e) => setAql(Number(e.target.value))}>
            {AQL_LEVELS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>
      {plan.data && (
        <div className="grid grid-cols-4 gap-2 rounded-lg border bg-card/50 p-3">
          <Metric label="Code letter" value={plan.data.code_letter} tone="info" />
          <Metric label="Sample size" value={String(plan.data.sample_size)} />
          <Metric label="Accept ≤" value={String(plan.data.accept)} tone="success" />
          <Metric label="Reject ≥" value={String(plan.data.reject)} tone="danger" />
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        ISO 2859-1 Normal Level II, single sampling plan. Sample size and acceptance based on lot size and AQL.
      </p>
    </div>
  );

  if (embedded) return inner;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Ruler className="h-4 w-4 text-primary" /> ISO 2859-1 Sampling Plan
        </CardTitle>
      </CardHeader>
      <CardContent>{inner}</CardContent>
    </Card>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "info" | "success" | "danger" }) {
  return (
    <div className="text-center">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5">
        <StatusPill tone={tone ?? "muted"}>{value}</StatusPill>
      </div>
    </div>
  );
}
