"use client";

import dynamic from "next/dynamic";

/** Everything is time-, storage- and GPU-dependent, so the experience renders on the client only. */
const LifeOS = dynamic(() => import("./LifeOS").then((m) => m.LifeOS), {
  ssr: false,
  loading: () => <BootMark />,
});

export function ClientRoot() {
  return <LifeOS />;
}

function BootMark() {
  return (
    <div className="fixed inset-0 grid place-items-center bg-void">
      <div className="mono text-faint">
        Life<span className="text-muted">/</span>OS — initialising
      </div>
    </div>
  );
}
