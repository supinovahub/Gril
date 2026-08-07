"use client";

import { useState, type FormEvent } from "react";

type AvailabilityRule = {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
};

type DraftRule = {
  key: string;
  id?: string;
  weekday: number;
  startTime: string;
  endTime: string;
};

type AvailabilityAction = (formData: FormData) => void | Promise<void>;

type AvailabilityEditorProps = {
  action: AvailabilityAction;
  rules: AvailabilityRule[];
  timezone: string;
  weekdays: readonly string[];
};

const weekdayOrder = [1, 2, 3, 4, 5, 6, 0];
const workweek = [1, 2, 3, 4, 5];

const presets = [
  { label: "Seg–Sex · 9h–18h", weekdays: workweek, startTime: "09:00", endTime: "18:00" },
  { label: "Seg–Sex · 9h–13h", weekdays: workweek, startTime: "09:00", endTime: "13:00" },
  { label: "Todos os dias · 9h–18h", weekdays: weekdayOrder, startTime: "09:00", endTime: "18:00" },
];

function formatTime(value: string): string {
  return value.slice(0, 5);
}

function createKey(): string {
  return `new-${Math.random().toString(36).slice(2)}`;
}

function toDraftRules(rules: AvailabilityRule[]): DraftRule[] {
  return rules.map((rule) => ({
    key: rule.id,
    id: rule.id,
    weekday: rule.weekday,
    startTime: formatTime(rule.start_time),
    endTime: formatTime(rule.end_time),
  }));
}

function hasOverlap(
  rules: DraftRule[],
  weekday: number,
  startTime: string,
  endTime: string,
): boolean {
  return rules.some(
    (rule) =>
      rule.weekday === weekday &&
      startTime < rule.endTime &&
      endTime > rule.startTime,
  );
}

export default function AvailabilityEditor({
  action,
  rules,
  timezone,
  weekdays,
}: AvailabilityEditorProps) {
  const [draftRules, setDraftRules] = useState(() => toDraftRules(rules));
  const [selectedDays, setSelectedDays] = useState<number[]>(workweek);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [removedRuleIds, setRemovedRuleIds] = useState<string[]>([]);
  const [error, setError] = useState("");

  const initialSignature = JSON.stringify(
    rules.map((rule) => [
      rule.id,
      rule.weekday,
      formatTime(rule.start_time),
      formatTime(rule.end_time),
    ]),
  );
  const draftSignature = JSON.stringify(
    draftRules.map((rule) => [
      rule.id ?? "",
      rule.weekday,
      rule.startTime,
      rule.endTime,
    ]),
  );
  const hasChanges = initialSignature !== draftSignature || removedRuleIds.length > 0;

  function toggleDay(day: number) {
    setSelectedDays((current) =>
      current.includes(day)
        ? current.filter((item) => item !== day)
        : [...current, day].sort((a, b) => a - b),
    );
    setError("");
  }

  function addPeriod() {
    if (!selectedDays.length) {
      setError("Selecione pelo menos um dia.");
      return;
    }
    if (endTime <= startTime) {
      setError("O fim deve ser posterior ao início.");
      return;
    }
    if (selectedDays.some((day) => hasOverlap(draftRules, day, startTime, endTime))) {
      setError("Esse período se sobrepõe a outro período selecionado.");
      return;
    }

    setDraftRules((current) => [
      ...current,
      ...selectedDays.map((weekday) => ({
        key: createKey(),
        weekday,
        startTime,
        endTime,
      })),
    ]);
    setError("");
  }

  function applyPreset(preset: (typeof presets)[number]) {
    setDraftRules(
      preset.weekdays.map((weekday) => ({
        key: createKey(),
        weekday,
        startTime: preset.startTime,
        endTime: preset.endTime,
      })),
    );
    setRemovedRuleIds(rules.map((rule) => rule.id));
    setSelectedDays([...preset.weekdays]);
    setStartTime(preset.startTime);
    setEndTime(preset.endTime);
    setError("");
  }

  function updateRule(key: string, field: "startTime" | "endTime", value: string) {
    setDraftRules((current) =>
      current.map((rule) => (rule.key === key ? { ...rule, [field]: value } : rule)),
    );
    setError("");
  }

  function removeRule(rule: DraftRule) {
    setDraftRules((current) => current.filter((item) => item.key !== rule.key));
    if (rule.id) {
      setRemovedRuleIds((current) =>
        current.includes(rule.id!) ? current : [...current, rule.id!],
      );
    }
    setError("");
  }

  function validateBeforeSubmit(event: FormEvent<HTMLFormElement>) {
    const invalid = draftRules.some(
      (rule) => !rule.startTime || !rule.endTime || rule.endTime <= rule.startTime,
    );
    const overlapping = draftRules.some((rule, index) =>
      draftRules.slice(index + 1).some(
        (other) =>
          rule.weekday === other.weekday &&
          rule.startTime < other.endTime &&
          rule.endTime > other.startTime,
      ),
    );
    if (invalid) {
      event.preventDefault();
      setError("Revise os horários: o fim deve ser posterior ao início.");
    } else if (overlapping) {
      event.preventDefault();
      setError("Os períodos do mesmo dia não podem se sobrepor.");
    }
  }

  return (
    <form action={action} className="agendaAvailabilityEditor" onSubmit={validateBeforeSubmit}>
      <div className="agendaAvailabilityIntro">
        <div>
          <p className="agendaEyebrow">Semana padrão</p>
          <h3>Defina seus horários de uma vez</h3>
          <p>Selecione os dias, adicione os períodos e salve tudo em uma única ação.</p>
        </div>
        <span className="agendaTimezone">Fuso: {timezone}</span>
      </div>

      <div className="agendaPresets" aria-label="Modelos rápidos">
        <span>Comece por um modelo:</span>
        {presets.map((preset) => (
          <button
            key={preset.label}
            className="agendaPresetButton"
            onClick={() => applyPreset(preset)}
            type="button"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="agendaWeekdayPicker" aria-label="Dias da semana">
        <span className="agendaFieldLabel">Aplicar período nos dias</span>
        <div className="agendaWeekdayButtons">
          {weekdayOrder.map((day) => {
            const selected = selectedDays.includes(day);
            return (
              <button
                aria-pressed={selected}
                className={selected ? "agendaDayButton agendaDayButtonActive" : "agendaDayButton"}
                key={day}
                onClick={() => toggleDay(day)}
                type="button"
              >
                {weekdays[day].slice(0, 3)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="agendaPeriodComposer">
        <label>
          <span>Início</span>
          <input onChange={(event) => setStartTime(event.target.value)} type="time" value={startTime} />
        </label>
        <label>
          <span>Fim</span>
          <input onChange={(event) => setEndTime(event.target.value)} type="time" value={endTime} />
        </label>
        <button className="agendaAddPeriodButton" onClick={addPeriod} type="button">
          + Adicionar período
        </button>
      </div>

      {error ? <p aria-live="polite" className="agendaEditorError">{error}</p> : null}

      <div className="agendaWeekGrid">
        {weekdayOrder.map((day) => {
          const dayRules = draftRules.filter((rule) => rule.weekday === day);
          return (
            <section className="agendaDayCard" key={day}>
              <div className="agendaDayCardHeader">
                <strong>{weekdays[day]}</strong>
                <span>{dayRules.length ? `${dayRules.length} período${dayRules.length > 1 ? "s" : ""}` : "Sem horário"}</span>
              </div>
              {dayRules.length ? (
                <div className="agendaDayRules">
                  {dayRules.map((rule) => (
                    <div className="agendaRuleRow" key={rule.key}>
                      <input
                        aria-label={`Início ${weekdays[day]}`}
                        onChange={(event) => updateRule(rule.key, "startTime", event.target.value)}
                        type="time"
                        value={rule.startTime}
                      />
                      <span>até</span>
                      <input
                        aria-label={`Fim ${weekdays[day]}`}
                        onChange={(event) => updateRule(rule.key, "endTime", event.target.value)}
                        type="time"
                        value={rule.endTime}
                      />
                      <button
                        aria-label={`Remover período de ${weekdays[day]}`}
                        className="agendaRemoveButton"
                        onClick={() => removeRule(rule)}
                        type="button"
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="agendaDayEmpty">Nenhum período cadastrado</p>
              )}
            </section>
          );
        })}
      </div>

      {draftRules.map((rule) => (
        <span key={rule.key}>
          <input name="ruleId" type="hidden" value={rule.id ?? ""} />
          <input name="ruleWeekday" type="hidden" value={rule.weekday} />
          <input name="ruleStartTime" type="hidden" value={rule.startTime} />
          <input name="ruleEndTime" type="hidden" value={rule.endTime} />
        </span>
      ))}
      {removedRuleIds.map((id) => (
        <input key={id} name="removedRuleId" type="hidden" value={id} />
      ))}

      <div className="agendaEditorFooter">
        <p>{hasChanges ? "Você tem alterações não salvas." : "Sua semana padrão está salva."}</p>
        <button className="agendaSaveButton" type="submit">Salvar disponibilidade</button>
      </div>
    </form>
  );
}
