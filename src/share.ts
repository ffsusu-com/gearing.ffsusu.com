import * as BI from './utils/BigInteger';
import * as G from './gear';

const permanentIndexes: { job: G.Job, stats: G.Stat[] }[] = [
  { job: 'PLD', stats: ['STR', 'CRT', 'DET', 'DHT', 'SKS', 'TEN', 'VIT'] },
  { job: 'WAR', stats: ['STR', 'CRT', 'DET', 'DHT', 'SKS', 'TEN', 'VIT'] },
  { job: 'DRK', stats: ['STR', 'CRT', 'DET', 'DHT', 'SKS', 'TEN', 'VIT'] },
  { job: 'WHM', stats: ['MND', 'CRT', 'DET', 'DHT', 'SPS', 'PIE', 'VIT'] },
  { job: 'SCH', stats: ['MND', 'CRT', 'DET', 'DHT', 'SPS', 'PIE', 'VIT'] },
  { job: 'AST', stats: ['MND', 'CRT', 'DET', 'DHT', 'SPS', 'PIE', 'VIT'] },
  { job: 'MNK', stats: ['STR', 'CRT', 'DET', 'DHT', 'SKS', 'VIT'] },
  { job: 'DRG', stats: ['STR', 'CRT', 'DET', 'DHT', 'SKS', 'VIT'] },
  { job: 'NIN', stats: ['DEX', 'CRT', 'DET', 'DHT', 'SKS', 'VIT'] },
  { job: 'SAM', stats: ['STR', 'CRT', 'DET', 'DHT', 'SKS', 'VIT'] },
  { job: 'BRD', stats: ['DEX', 'CRT', 'DET', 'DHT', 'SKS', 'VIT'] },
  { job: 'MCH', stats: ['DEX', 'CRT', 'DET', 'DHT', 'SKS', 'VIT'] },
  { job: 'BLM', stats: ['INT', 'CRT', 'DET', 'DHT', 'SKS', 'VIT'] },
  { job: 'SMN', stats: ['INT', 'CRT', 'DET', 'DHT', 'SKS', 'VIT'] },
  { job: 'RDM', stats: ['INT', 'CRT', 'DET', 'DHT', 'SKS', 'VIT'] },
];

const toIndex: { [index in G.Job]?: { index: number, stats: { [index in G.Stat]?: number } } } = {};
for (let index = 0; index < permanentIndexes.length; index++) {
  const item = permanentIndexes[index];
  const stats: { [index in G.Stat]?: number } = {};
  for (let j = 0; j < item.stats.length; j++) {
    stats[item.stats[j]] = j;
  }
  toIndex[item.job] = { index, stats };
}

class Ranges {
  private _version = 1;
  version = 77;
  job = 0;
  level = 80;
  gearId = 0;
  materiaSlot = 0;
  materiaStat = 0;
  materiaGrade = 0;
  materiaCode = 0;
  useVersion(version: number) {
    this._version = version;
    this.job = version === 1 ? 28 : -1;  // permanentIndexes.length,
    this.gearId = 50000;
    this.materiaSlot = 6;
    this.materiaGrade = 6;
  }
  useJob(job: G.Job) {
    this.materiaStat = permanentIndexes[toIndex[job]!.index].stats.length;  // TODO: versoin
    this.materiaCode = this.materiaStat * this.materiaGrade + 1;
  }
}

export function stringify({ job, level, gears }: G.GearSet): string {
  const ranges = new Ranges();
  ranges.useVersion(1);
  ranges.useJob(job);

  const gearCodes: { id: number, materias: number[]  }[] = [];
  const materiaCodeSet: { [index: string]: number } = {};

  let minGearId = Infinity;
  let maxGearId = 0;
  let maxMateriaCode = 0;

  for (const { id, materias } of gears) {
    if (id < minGearId) {
      minGearId = id;
    }
    if (id > maxGearId) {
      maxGearId = id;
    }
    const materiaCodes = [];
    for (const materia of materias) {
      const statToIndex = toIndex[job]!.stats;
      const materiaCode = materia === null || statToIndex[materia[0]] === undefined ? 0 :
        statToIndex[materia[0]]! * ranges.materiaGrade + (materia[1] - 1) + 1;
      if (materiaCodeSet[materiaCode] === undefined) {
        materiaCodeSet[materiaCode] = maxMateriaCode++;
      }
      materiaCodes.push(materiaCodeSet[materiaCode]);
    }
    gearCodes.push({ id, materias: materiaCodes });
  }

  if (gearCodes.length === 0) return '';
  gearCodes.reverse();

  const materiaCodes: number[] = [];
  for (const materiaCode of Object.keys(materiaCodeSet)) {
    materiaCodes[materiaCodeSet[materiaCode]] = parseInt(materiaCode);
  }

  // console.log(gears, minGearId, maxGearId, materiaCodes);
  let result: BI.BigInteger = 0;
  const write = (value: number, range: number) => result = BI.add(BI.multiply(result, range), value);

  for (const gear of gearCodes) {
    write(gear.id - minGearId, maxGearId - minGearId + 1);
    for (const materiaCodeIndex of gear.materias) {
      write(materiaCodeIndex, materiaCodes.length);
    }
    write(gear.materias.length, ranges.materiaSlot);
  }
  write(minGearId, maxGearId);
  write(maxGearId, ranges.gearId);
  for (const materiaCode of materiaCodes) {
    write(materiaCode, ranges.materiaCode);
  }
  write(materiaCodes.length, ranges.materiaCode);
  write(level - 1, ranges.level);
  write(toIndex[job]!.index, ranges.job);
  write(1, ranges.version);

  return BI.toString(result, 62);
}

export function parse(s: string): G.GearSet {
  let input = BI.parseInt(s, 62);
  const read = (range: number): number => {
    const ret = BI.remainder(input, range);
    input = BI.divide(input, range);
    return ret as number;
  };

  const ranges = new Ranges();

  const version = read(ranges.version);
  ranges.useVersion(version);

  const job = permanentIndexes[read(ranges.job)];  // FIXME
  ranges.useJob(job.job);

  const level = read(ranges.level) + 1;

  const materiaCodes = Array.from({ length: read(ranges.materiaCode) }, () => {
    let materiaCode = read(ranges.materiaCode);
    if (materiaCode > 0) {
      materiaCode -= 1;
      let grade = materiaCode % ranges.materiaGrade + 1;
      let stat = job.stats[Math.floor(materiaCode / ranges.materiaGrade)];
      return [stat, grade] as [G.Stat, G.MateriaGrade];
    } else {
      return null;
    }
  }).reverse();

  const maxGearId = read(ranges.gearId);
  const minGearId = read(maxGearId);
  const gears: G.GearSet['gears'] = [];
  while (input !== 0) {
    const materias = Array.from({ length: read(ranges.materiaSlot) },
      () => materiaCodes[read(materiaCodes.length)]).reverse();
    const id = (read(maxGearId - minGearId + 1) + minGearId) as G.GearId;
    gears.push({ id, materias });
  }

  return { job: job.job, level, gears };
}
// let s = 'rzCATkJiV44Rvv7tM9ykHTaFvJDV52GGA7tSWBjYkyYSNtvS';
// console.assert(stringify(parse(s)) === s);