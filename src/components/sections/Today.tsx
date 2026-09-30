"use client";

import { useMemo } from "react";
import { useLife } from "@/lib/store";
import { eventsOn, freeWindows } from "@/lib/agenda";
import { dateKey } from "@/lib/time";
import { useNow } from "@/components/ui/hooks";
import { SectionHead } from "@/components/ui/SectionHead";
import { DayRibbon } from "./today/DayRibbon";
import { Priorities } from "./today/Priorities";
import { Rituals } from "./today/Rituals";
import { Ledger } from "./today/Ledger";

export function TodaySection() {
  const now = useNow(30_000);
  const events = useLife((s) => s.events);
  const tasks = useLife((s) => s.tasks);
  const meta = useMemo(() => {
    const key = dateKey(now);
    const ev = eventsOn(events, key).length;
    const open = tasks.filter((t) => !t.done && t.dueDate && t.dueDate <= key).length;
    const w = freeWindows(events, now).length;
    return `${ev} events · ${open} open · ${w} window${w === 1 ? "" : "s"}`;
  }, [events, tasks, now]);

  return (
    <section id="today" className="relative px-frame py-[16vh]">
      <SectionHead index="02" title="Agenda" italic="of the day" meta={meta} echo="Today" />
      <div className="mt-[9vh]">
        <DayRibbon now={now} />
      </div>
      <div className="mt-[12vh] grid gap-16 lg:grid-cols-12 lg:gap-20">
        <div className="lg:col-span-7">
          <Priorities now={now} />
        </div>
        <div className="lg:col-span-5">
          <Rituals now={now} />
        </div>
      </div>
      <div className="mt-[12vh]">
        <div className="mono mb-6 text-muted">Manifest</div>
        <Ledger now={now} />
      </div>
    </section>
  );
}
