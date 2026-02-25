"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const COLORS: Record<string, string> = {
  newsletter: "#3b82f6",
  job_alert: "#a855f7",
  promo: "#f97316",
  social: "#ec4899",
  transactional: "#22c55e",
  personal: "#06b6d4",
  automated: "#6b7280",
  other: "#9ca3af",
  unclassified: "#d1d5db",
};

interface CategoryChartProps {
  categories: Record<string, { count: number; emails: number }>;
}

export function CategoryChart({ categories }: CategoryChartProps) {
  const data = Object.entries(categories).map(([name, { count, emails }]) => ({
    name: name.replace("_", " "),
    senders: count,
    emails,
    fill: COLORS[name] || COLORS.other,
  }));

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Categories
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No data yet. Run a scan first.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Email Categories
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          <div className="h-40 w-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={65}
                  paddingAngle={2}
                  dataKey="emails"
                >
                  {data.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-lg border bg-card p-2 text-xs shadow-md">
                        <p className="font-medium capitalize">{d.name}</p>
                        <p className="text-muted-foreground">
                          {d.senders} senders · {d.emails.toLocaleString()}{" "}
                          emails
                        </p>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex-1 space-y-1.5">
            {data.slice(0, 6).map((d) => (
              <div key={d.name} className="flex items-center gap-2 text-xs">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: d.fill }}
                />
                <span className="capitalize text-foreground">{d.name}</span>
                <span className="ml-auto text-muted-foreground">
                  {d.emails.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
