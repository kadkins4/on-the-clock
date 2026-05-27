import { useState, type FormEvent } from "react";
import type { Player, Position } from "../types";
import { POSITIONS } from "../types";

interface Props {
  onAdd: (p: Player) => void;
  onClose: () => void;
}

export function AddPlayerForm({ onAdd, onClose }: Props) {
  const [name, setName] = useState("");
  const [position, setPosition] = useState<Position>("RB");
  const [team, setTeam] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd({
      id: crypto.randomUUID(),
      name: name.trim(),
      position,
      team: team.trim().toUpperCase() || "FA",
      overallRank: 0,
      byeWeek: null,
      tier: null,
      adp: null,
      notes: "",
      flag: "none",
      draftStatus: "available",
    });
    onClose();
  };

  return (
    <form className="add-form" onSubmit={submit}>
      <input
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />
      <select
        value={position}
        onChange={(e) => setPosition(e.target.value as Position)}
      >
        {POSITIONS.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <input
        placeholder="Team"
        value={team}
        onChange={(e) => setTeam(e.target.value)}
      />
      <button type="submit">Add</button>
      <button type="button" onClick={onClose}>
        Cancel
      </button>
    </form>
  );
}
