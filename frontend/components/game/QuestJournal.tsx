"use client";

import React from "react";

type QuestDefinition = {
    id: string;
    name: string;
    description: string;
    levelRequirement: number;
    objectives: Array<{ id: string; description: string; requiredAmount: number }>;
    rewards: Array<{ type: string; amount: number; itemId?: number; spellId?: number }>;
};

type QuestState = {
    questId: string;
    status: "active" | "completed" | "turned_in" | "failed";
    objectives: Array<{ id: string; currentAmount: number; requiredAmount: number }>;
};

export type QuestJournalEntry = {
    definition: QuestDefinition;
    state: QuestState | null;
    canStart: boolean;
    nearStartNpc?: boolean;
    canTurnIn?: boolean;
};

type QuestJournalProps = {
    quests: QuestJournalEntry[];
    connected: boolean;
    onCommand: (command: string) => void;
};

function describeRewards(rewards: QuestDefinition["rewards"]): string {
    return rewards
        .map((reward) => {
            switch (reward.type) {
                case "exp": return `${reward.amount} experiencia`;
                case "gold": return `${reward.amount} monedas`;
                case "item": return `objeto ${reward.itemId ?? ""} ×${reward.amount}`;
                case "spell": return `hechizo ${reward.spellId ?? ""}`;
                case "faction_score": return `${reward.amount} de reputación`;
                default: return `${reward.amount} ${reward.type}`;
            }
        })
        .join(" · ");
}

export default function QuestJournal({ quests, connected, onCommand }: QuestJournalProps) {
    const active = quests.filter((entry) => entry.state?.status === "active" || entry.state?.status === "completed");
    const offered = quests.filter((entry) => !entry.state || entry.state.status === "failed");
    const closed = quests.filter((entry) => entry.state?.status === "turned_in");

    return (
        <aside className="quest-journal pointer-events-auto flex h-full min-h-0 w-[300px] shrink-0 flex-col overflow-hidden rounded-[26px] border border-amber-200/15 bg-[linear-gradient(165deg,rgba(24,18,14,.94),rgba(5,7,15,.96)_42%,rgba(10,13,24,.94))] px-5 py-6 text-stone-200 shadow-[0_25px_80px_rgba(0,0,0,.56)] backdrop-blur-xl">
            <div className="text-center">
                <div className="text-[9px] uppercase tracking-[0.42em] text-amber-100/45">AOWeb · Archivo del reino</div>
                <h2 className="mt-3 font-serif text-2xl tracking-[0.16em] text-amber-100/90">CRÓNICAS</h2>
                <div className="mx-auto mt-3 h-px w-24 bg-gradient-to-r from-transparent via-amber-100/45 to-transparent" />
                <p className="mt-3 font-serif text-[13px] italic leading-5 text-stone-300/65">Hay nombres que el tiempo borra.<br />Sus deudas, jamás.</p>
            </div>

            <div className="mt-6 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pr-1 [scrollbar-color:rgba(217,171,103,.22)_transparent] [scrollbar-width:thin]">
                {active.length > 0 ? (
                    <section>
                        <h3 className="mb-3 text-[9px] uppercase tracking-[0.32em] text-cyan-100/55">Juramentos vigentes</h3>
                        <div className="space-y-4">
                            {active.map(({ definition, state, canTurnIn }) => (
                                <article key={definition.id} className="border-l border-amber-200/25 pl-3">
                                    <h4 className="font-serif text-[15px] leading-5 text-amber-50/90">{definition.name}</h4>
                                    <p className="mt-1.5 font-serif text-xs leading-[1.65] text-stone-300/70">{definition.description}</p>
                                    <div className="mt-2 space-y-1">
                                        {definition.objectives.map((objective) => {
                                            const progress = state?.objectives.find((item) => item.id === objective.id);
                                            return <p key={objective.id} className="text-[10px] leading-4 text-cyan-100/65">· {objective.description} <span className="text-stone-200/75">({progress?.currentAmount ?? 0}/{progress?.requiredAmount ?? objective.requiredAmount})</span></p>;
                                        })}
                                    </div>
                                    {state?.status === "completed" ? (
                                        <button type="button" disabled={!connected || !canTurnIn} onClick={() => onCommand(`/quest turnin ${definition.id}`)} className="mt-3 font-serif text-[11px] italic text-amber-200/80 underline decoration-amber-200/25 underline-offset-4 transition hover:text-amber-100 disabled:opacity-35">{canTurnIn ? "Entregar la tarea ↗" : "Vuelve con quien la encomendó"}</button>
                                    ) : (
                                        <button type="button" disabled={!connected} onClick={() => onCommand(`/quest abandon ${definition.id}`)} className="mt-3 text-[9px] uppercase tracking-[0.2em] text-stone-400/55 transition hover:text-stone-200/80 disabled:opacity-35">Renunciar</button>
                                    )}
                                </article>
                            ))}
                        </div>
                    </section>
                ) : null}

                {offered.length > 0 ? (
                    <section>
                        <h3 className="mb-3 text-[9px] uppercase tracking-[0.32em] text-amber-100/45">Voces entre las sombras</h3>
                        <div className="space-y-4">
                            {offered.map(({ definition, canStart, nearStartNpc }) => (
                                <article key={definition.id} className="border-l border-stone-200/10 pl-3">
                                    <h4 className="font-serif text-[15px] leading-5 text-stone-100/80">{definition.name}</h4>
                                    <p className="mt-1.5 font-serif text-xs leading-[1.65] text-stone-400/75">{definition.description}</p>
                                    <p className="mt-2 text-[9px] leading-4 text-amber-100/45">Recompensa: {describeRewards(definition.rewards)}</p>
                                    <button type="button" disabled={!connected || !canStart} onClick={() => onCommand(`/quest accept ${definition.id}`)} className="mt-2 font-serif text-[11px] italic text-cyan-100/75 transition hover:text-cyan-50 disabled:cursor-not-allowed disabled:text-stone-500/45">{canStart ? "Aceptar el llamado ↗" : nearStartNpc === false ? "Acércate a quien guarda esta historia" : `Requiere nivel ${definition.levelRequirement} o completar otras crónicas`}</button>
                                </article>
                            ))}
                        </div>
                    </section>
                ) : null}

                {closed.length > 0 ? (
                    <section>
                        <h3 className="mb-2 text-[9px] uppercase tracking-[0.32em] text-stone-400/45">Lo que ya fue saldado</h3>
                        {closed.map(({ definition }) => <p key={definition.id} className="font-serif text-xs italic leading-5 text-stone-400/50">{definition.name}</p>)}
                    </section>
                ) : null}

                {!quests.length ? <p className="m-auto max-w-[210px] text-center font-serif text-sm italic leading-6 text-stone-300/45">El libro aún no revela sus páginas.</p> : null}
            </div>

            <button type="button" disabled={!connected} onClick={() => onCommand("/quest list")} className="mt-4 border-t border-amber-100/10 pt-3 text-center text-[9px] uppercase tracking-[0.3em] text-amber-100/40 transition hover:text-amber-100/75 disabled:opacity-30">Consultar las crónicas</button>
        </aside>
    );
}
