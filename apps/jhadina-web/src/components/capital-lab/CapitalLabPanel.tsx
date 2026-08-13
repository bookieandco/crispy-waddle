"use client";

import { useState } from "react";

export type CapitalLabAsset = {
  asset: string;
  available: string;
  hold: string;
};

export type CapitalLabSnapshot = {
  connected: boolean;
  provider: string;
  assets: CapitalLabAsset[];
  capabilities: {
    balances: boolean;
    accounts: boolean;
    trading: boolean;
    transfers: boolean;
    withdrawals: boolean;
  };
};

type Props = { snapshot: CapitalLabSnapshot };

type Action = "add" | "send" | "withdraw";

export function CapitalLabPanel({ snapshot }: Props) {
  const [action, setAction] = useState<Action | null>(null);

  const totalAssets = snapshot.assets.length;

  return (
    <section aria-label="Capital Lab" className="capital-lab">
      <header className="capital-lab__header">
        <div>
          <p className="capital-lab__eyebrow">JHADINA / CAPITAL LAB</p>
          <h1>Capital Lab</h1>
          <p className="capital-lab__status">
            <span aria-hidden="true" className={snapshot.connected ? "status-dot status-dot--live" : "status-dot"} />
            {snapshot.connected ? "Connected" : "Disconnected"} · {snapshot.provider}
          </p>
        </div>
        <div className="capital-lab__badge">{totalAssets} assets</div>
      </header>

      <div className="capital-lab__actions" role="group" aria-label="Capital actions">
        <ActionButton label="Add Funds" icon="＋" onClick={() => setAction("add")} />
        <ActionButton label="Send Funds" icon="↗" onClick={() => setAction("send")} disabled={!snapshot.capabilities.transfers} />
        <ActionButton label="Withdraw" icon="↓" onClick={() => setAction("withdraw")} disabled={!snapshot.capabilities.withdrawals} />
      </div>

      <div className="capital-lab__card">
        <div className="capital-lab__card-title">
          <span>Connected accounts</span>
          <span className="capital-lab__readonly">READ ONLY</span>
        </div>
        {snapshot.assets.length === 0 ? (
          <p className="capital-lab__empty">No balances reported yet.</p>
        ) : (
          <ul className="capital-lab__assets">
            {snapshot.assets.map((asset) => (
              <li key={asset.asset}>
                <span><strong>{asset.asset}</strong><small>Available</small></span>
                <span className="capital-lab__amount">{asset.available}</span>
                {asset.hold !== "0" && <small className="capital-lab__hold">Hold {asset.hold}</small>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {action && <ActionSheet action={action} onClose={() => setAction(null)} />}
    </section>
  );
}

function ActionButton({ label, icon, onClick, disabled }: { label: string; icon: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button className="capital-lab__action" type="button" onClick={onClick} disabled={disabled}>
      <span className="capital-lab__action-icon">{icon}</span>
      <span>{label}</span>
      {disabled && <small>Unavailable</small>}
    </button>
  );
}

function ActionSheet({ action, onClose }: { action: Action; onClose: () => void }) {
  const titles = { add: "Add Funds", send: "Send Funds", withdraw: "Withdraw" };
  return (
    <div className="capital-lab__sheet" role="dialog" aria-modal="true" aria-label={titles[action]}>
      <div className="capital-lab__sheet-inner">
        <button className="capital-lab__close" type="button" onClick={onClose} aria-label="Close">×</button>
        <p className="capital-lab__eyebrow">CAPITAL LAB</p>
        <h2>{titles[action]}</h2>
        <p>
          {action === "add" && "Choose an approved funding source. The provider gateway will verify the destination before settlement."}
          {action === "send" && "Choose an approved connected account. Transfers remain blocked until the provider exposes transfer capability."}
          {action === "withdraw" && "Choose an approved external destination. Withdrawals remain blocked until Capital Lab authorizes a withdrawal-capable provider."}
        </p>
        <button className="capital-lab__primary" type="button" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}
