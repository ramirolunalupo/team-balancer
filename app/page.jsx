/*
 * Página principal de la aplicación Team Balancer.
 * Copiada según las instrucciones del usuario.
 */

'use client';
import React, { useState } from 'react';

// Funciones de utilidad para ordenar y sumar.
const by = (fn) => (a, b) => (fn(a) > fn(b) ? 1 : fn(a) < fn(b) ? -1 : 0);
const sum = (arr) => arr.reduce((a, b) => a + b, 0);

// Descarga un archivo CSV en el cliente.
function download(filename, text) {
  const element = document.createElement("a");
  const file = new Blob([text], { type: "text/csv;charset=utf-8" });
  element.href = URL.createObjectURL(file);
  element.download = filename;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

// Parsea una lista de jugadores a partir de texto crudo.
function parsePlayers(raw) {
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const players = [];
  for (const line of lines) {
    let name = "";
    let score = null;
    // Formato con tabulaciones: Nombre \t SI/NO \t Puntaje
    if (line.includes("\t")) {
      const parts = line.split("\t").map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const last = parts[parts.length - 1];
        const sc = parseInt(last, 10);
        if (!Number.isNaN(sc)) {
          score = sc;
          name = (parts.length >= 3)
            ? parts.slice(0, parts.length - 2).join(" ")
            : parts.slice(0, parts.length - 1).join(" ");
        }
      }
    }
    // Formato con coma: Nombre,Puntaje
    if (!name || score == null) {
      const parts = line.split(",");
      const maybeScore = parseInt(parts[parts.length - 1], 10);
      if (!Number.isNaN(maybeScore)) {
        score = maybeScore;
        name = parts.slice(0, parts.length - 1).join(",").trim();
      }
    }
    if (name && score != null) {
      players.push({ name: name.replace(/\s+/g, " ").trim(), score });
    }
  }
  return players;
}

// Parsea parejas de jugadores a partir de texto crudo.
function parsePairs(raw) {
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const pairs = [];
  for (const line of lines) {
    let parts = line.includes("\t") ? line.split("\t") : line.split(",");
    parts = parts.map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      pairs.push([parts[0], parts[1]]);
    }
  }
  return pairs;
}

// Parsea entrenadores e hijos a partir de texto crudo.
function parseCoaches(raw) {
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean).slice(1);
  const coaches = [];
  for (const line of lines) {
    const parts = line.split("\t").map(p => p.trim());
    if (parts.length >= 3) {
      const coach = parts[0];
      const ok = (parts[1] || "").toUpperCase() === "SI";
      const child = parts.slice(2).join(" ");
      if (ok) {
        coaches.push({ coach, child });
      }
    }
  }
  return coaches;
}

// Calcula la cantidad de jugadores que deberían tener cada equipo para balancear la distribución.
function computeTargets(nPlayers, nTeams) {
  const base = Math.floor(nPlayers / nTeams);
  const extra = nPlayers % nTeams;
  return Array.from({ length: nTeams }, (_, i) => (i < extra ? base + 1 : base));
}

// Distribuye jugadores equitativamente según sus niveles (puntajes).
function balanceTeams(players, nTeams = 6) {
  const teams = Object.fromEntries(
    Array.from({ length: nTeams }, (_, i) => [i + 1, []])
  );
  const levels = [...new Set(players.map(p => p.score))].sort((a, b) => b - a);
  let pointer = 0;
  for (const level of levels) {
    const names = players
      .filter(p => p.score === level)
      .map(p => p.name)
      .sort(by(x => x));
    for (const name of names) {
      const t = (pointer % nTeams) + 1;
      teams[t].push({ name, score: level });
      pointer++;
    }
  }
  return teams;
}

// Obtiene el equipo en el que se encuentra un jugador por su nombre.
function teamOf(teams, name) {
  for (const t in teams) {
    if (teams[t].some(p => p.name === name)) {
      return parseInt(t, 10);
    }
  }
  return null;
}

// Intercambia dos jugadores entre sus respectivos equipos.
function swapPlayers(teams, aName, bName) {
  let aTeam = null;
  let bTeam = null;
  let aIdx = -1;
  let bIdx = -1;
  for (const t in teams) {
    teams[t].forEach((p, i) => {
      if (p.name === aName) {
        aTeam = parseInt(t, 10);
        aIdx = i;
      }
      if (p.name === bName) {
        bTeam = parseInt(t, 10);
        bIdx = i;
      }
    });
  }
  if (aTeam && bTeam && aTeam !== bTeam && aIdx >= 0 && bIdx >= 0) {
    const a = teams[aTeam][aIdx];
    const b = teams[bTeam][bIdx];
    teams[aTeam][aIdx] = b;
    teams[bTeam][bIdx] = a;
  }
}

// Intenta mantener juntas a las parejas intercambiando jugadores con habilidades similares.
function movePairTogether(teams, aName, bName) {
  const ta = teamOf(teams, aName);
  const tb = teamOf(teams, bName);
  if (!ta || !tb || ta === tb) return;
  const a = teams[ta].find(p => p.name === aName);
  const b = teams[tb].find(p => p.name === bName);
  const candA = teams[ta].find(
    p => p.score === b.score && p.name !== aName
  );
  if (candA) return swapPlayers(teams, candA.name, bName);
  const candB = teams[tb].find(
    p => p.score === a.score && p.name !== bName
  );
  if (candB) return swapPlayers(teams, aName, candB.name);
  const otherA = teams[ta].find(p => p.name !== aName);
  if (otherA) return swapPlayers(teams, otherA.name, bName);
}

// Asegura que no haya más de un hijo de entrenador en cada equipo.
function fixCoachCollisions(teams, coaches) {
  const childNames = coaches.map(c => c.child);
  const nTeams = Object.keys(teams).length;
  const desiredTeams = new Set(
    Array.from({ length: nTeams }, (_, i) => i + 1)
  );
  let changes = true;
  const childTeam = child => teamOf(teams, child);
  while (changes) {
    changes = false;
    const byTeam = {};
    for (const child of childNames) {
      const t = childTeam(child);
      if (!byTeam[t]) byTeam[t] = [];
      byTeam[t].push(child);
    }
    const occupied = new Set(
      Object.keys(byTeam).map(x => parseInt(x, 10))
    );
    const empty = Array.from(desiredTeams).filter(t => !occupied.has(t));
    const collisions = Object.entries(byTeam)
      .filter(([, arr]) => arr.length > 1)
      .map(([t, arr]) => ({ team: parseInt(t, 10), childs: arr }));
    if (collisions.length === 0 || empty.length === 0) break;
    for (const { team, childs } of collisions) {
      for (let i = 1; i < childs.length && empty.length > 0; i++) {
        const child = childs[i];
        const sc = teams[team].find(p => p.name === child)?.score;
        const target = empty.shift();
        const candidate = teams[target].find(
          p => p.score === sc && !childNames.includes(p.name)
        );
        if (candidate) swapPlayers(teams, child, candidate.name);
        else {
          const any = teams[target].find(p => !childNames.includes(p.name));
          if (any) swapPlayers(teams, child, any.name);
        }
        changes = true;
      }
    }
  }
}

// Ajusta los equipos para cumplir con los tamaños objetivo calculados.
function enforceTargets(teams, targets) {
  const getSizes = () =>
    Object.fromEntries(
      Object.entries(teams).map(([t, arr]) => [parseInt(t, 10), arr.length])
    );
  let sizes = getSizes();
  let guard = 0;
  while (guard++ < 400) {
    const over = Object.entries(sizes)
      .filter(([t, s]) => s > targets[t - 1])
      .map(([t]) => parseInt(t, 10));
    const under = Object.entries(sizes)
      .filter(([t, s]) => s < targets[t - 1])
      .map(([t]) => parseInt(t, 10));
    if (over.length === 0 && under.length === 0) break;
    if (over.length && under.length) {
      const tOver = over[0];
      const tUnder = under[0];
      const cand = teams[tOver][teams[tOver].length - 1];
      let bestIdx = -1;
      let bestDiff = Infinity;
      teams[tUnder].forEach((p, i) => {
        const d = Math.abs(p.score - cand.score);
        if (d < bestDiff) {
          bestDiff = d;
          bestIdx = i;
        }
      });
      if (bestIdx >= 0) swapPlayers(teams, cand.name, teams[tUnder][bestIdx].name);
      sizes = getSizes();
    } else break;
  }
}

// Calcula métricas de cada equipo (cantidad, promedio, distribución por nivel).
function metrics(team) {
  const count = team.length;
  const avg = count ? sum(team.map(p => p.score)) / count : 0;
  const lvl = [1, 2, 3, 4, 5, 6].map(L => team.filter(p => p.score === L).length);
  return { count, avg: +avg.toFixed(2), lvl };
}

export default function Page() {
  const [rawRoster, setRawRoster] = useState(
    `Nombre\tViene el Sábado?\tPuntaje\n... (pegá acá tu listado real)`
  );
  const [rawPairs, setRawPairs] = useState(`A\tB`);
  const [rawCoaches, setRawCoaches] = useState(
    `Entrenador\tConfirmación de disponibilidad\tNombre del hijo del entrenador\nGon\tSI\tRivolta Belisario\nNacho\tSI\tRíos, Benjamin\nTucu\tSI\tGoyenechea, Tomas Ignacio\nTomi\tSI\tLascombes, Ramón\nMarcos\tSI\tGonzalez Astelarra Joaquin\nMarce\tSI\tLucero Funes, Alfonso`
  );

  const [nTeams, setNTeams] = useState(6);
  const [result, setResult] = useState(null);

  function run() {
    const players = parsePlayers(rawRoster);
    const pairs = parsePairs(rawPairs).filter(
      ([a, b]) =>
        players.some(p => p.name === a) && players.some(p => p.name === b)
    );
    const coaches = parseCoaches(rawCoaches).filter(c =>
      players.some(p => p.name === c.child)
    );
    const base = balanceTeams(players, nTeams);
    pairs.forEach(([a, b]) => movePairTogether(base, a, b));
    fixCoachCollisions(base, coaches);
    const targets = computeTargets(players.length, nTeams);
    enforceTargets(base, targets);
    const teamCards = Object.keys(base)
      .map(t => parseInt(t, 10))
      .sort((a, b) => a - b)
      .map(t => ({ id: t, players: base[t] }));
    const m = teamCards.map(tc => ({
      id: tc.id,
      count: tc.players.length,
      avg: +(
        tc.players.reduce((acc, p) => acc + p.score, 0) / tc.players.length
      ).toFixed(2),
      lvl: [1, 2, 3, 4, 5, 6].map(L => tc.players.filter(p => p.score === L).length),
    }));
    const errors = [];
    const sizes = m
      .map(x => x.count)
      .slice()
      .sort((a, b) => b - a);
    const expected = computeTargets(players.length, nTeams)
      .slice()
      .sort((a, b) => b - a);
    if (JSON.stringify(sizes) !== JSON.stringify(expected))
      errors.push(
        `Tamaños esperados ${JSON.stringify(expected)} vs actuales ${JSON.stringify(
          m.map(x => x.count)
        )}`
      );
    const coachChildren = new Set(coaches.map(c => c.child));
    const nameToTeam = new Map();
    for (const t in base)
      for (const p of base[t]) nameToTeam.set(p.name, parseInt(t, 10));
    pairs.forEach(([a, b]) => {
      const ta = nameToTeam.get(a);
      const tb = nameToTeam.get(b);
      const bothCoachKids = coachChildren.has(a) && coachChildren.has(b);
      if (ta !== tb && !bothCoachKids) errors.push(`Par separado: ${a} - ${b}`);
    });
    const childTeams = coaches.map(c => ({ child: c.child, team: nameToTeam.get(c.child) }));
    const uniqTeams = new Set(childTeams.map(x => x.team));
    if (uniqTeams.size !== coaches.length)
      errors.push(
        `Más de un hijo de DT en un equipo: ${JSON.stringify(childTeams)}`
      );
    const rosterCsv = [
      'Equipo,Nombre,Puntaje',
      ...teamCards
        .flatMap(t => t.players.map(p => `${t.id},"${p.name}",${p.score}`))
        .join('\n')
        .split('\n'),
    ].join('\n');
    const summaryCsv = [
      'Equipo,Jugadores,Promedio,N1,N2,N3,N4,N5,N6',
      ...m.map(
        x => `${x.id},${x.count},${x.avg},${x.lvl.join(',')}`
      ),
    ].join('\n');
    setResult({ teamCards, m, errors, rosterCsv, summaryCsv });
  }

  const canExport = !!result;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">
        Team Balancer – Rugby (Parejas + Entrenadores)
      </h1>
      <p className="text-sm opacity-80">
        Balancea equipos por cantidad, promedio y niveles; respeta parejas; 1
        DT por equipo con su hijo (si dos hijos de DT forman pareja, se
        prioriza 1 DT por equipo y se avisa).
      </p>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="font-semibold">
            Listado de jugadores (Nombre\tSI\tPuntaje o Nombre,Puntaje)
          </label>
          <textarea
            className="w-full h-56 p-3 border rounded-xl"
            value={rawRoster}
            onChange={e => setRawRoster(e.target.value)}
          />
          <div className="flex items-center gap-3">
            <label className="font-semibold">Cantidad de equipos</label>
            <input
              type="number"
              min={2}
              max={12}
              value={nTeams}
              onChange={e => setNTeams(parseInt(e.target.value || '6', 10))}
              className="border rounded-md px-2 py-1 w-20"
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="font-semibold">Parejas (una por línea, TAB o coma)</label>
          <textarea
            className="w-full h-24 p-3 border rounded-xl"
            value={rawPairs}
            onChange={e => setRawPairs(e.target.value)}
          />
          <label className="font-semibold">
            Entrenadores (TAB: Entrenador\tSI/NO\tHijo) – solo SI
          </label>
          <textarea
            className="w-full h-24 p-3 border rounded-xl"
            value={rawCoaches}
            onChange={e => setRawCoaches(e.target.value)}
          />
        </div>
      </div>
      <div className="flex gap-3">
        <button
          onClick={run}
          className="px-4 py-2 rounded-2xl shadow border"
        >
          Balancear equipos
        </button>
        {canExport && (
          <>
            <button
              onClick={() => download('planteles_finales.csv', result.rosterCsv)}
              className="px-4 py-2 rounded-2xl shadow border"
            >
              Descargar planteles (CSV)
            </button>
            <button
              onClick={() => download('resumen_equipos.csv', result.summaryCsv)}
              className="px-4 py-2 rounded-2xl shadow border"
            >
              Descargar resumen (CSV)
            </button>
          </>
        )}
      </div>
      {result && (
        <>
          <div className="p-4 rounded-2xl border">
            <h2 className="font-semibold mb-2">Verificación</h2>
            {result.errors.length === 0 ? (
              <div className="text-green-700">
                ✅ Todo OK: tamaños, entrenadores, parejas y balance.
              </div>
            ) : (
              <ul className="list-disc ml-5 text-rose-700">
                {result.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
            <div className="mt-2 text-sm opacity-70">
              Criterios: tamaños exactos, 1 DT por equipo con su hijo, parejas
              juntas (salvo choque de dos hijos de DT), y balance de niveles.
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {result.teamCards.map((t, idx) => (
              <div
                key={idx}
                className="border rounded-2xl p-4 shadow-sm"
              >
                <div className="flex items-baseline justify-between">
                  <h3 className="font-bold">Equipo {t.id}</h3>
                  <div className="text-sm opacity-70">
                    {result.m[idx].count} jug • prom {result.m[idx].avg}
                  </div>
                </div>
                <div className="text-xs opacity-70">
                  Niveles [1..6]: {result.m[idx].lvl.join('/')}
                </div>
                <ul className="mt-3 space-y-1 text-sm">
                  {t.players
                    .slice()
                    .sort((a, b) =>
                      b.score - a.score || a.name.localeCompare(b.name)
                    )
                    .map(p => (
                      <li
                        key={p.name}
                        className="flex justify-between"
                      >
                        <span>{p.name}</span>
                        <span className="opacity-70">({p.score})</span>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
      <footer className="text-xs opacity-60 mt-8">Hecho para Ramiro 🏏</footer>
    </div>
  );
}
