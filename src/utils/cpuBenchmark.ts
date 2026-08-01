const CPU_TRADEMARK_PATTERN = /\((?:r|tm|c)\)/gi
const CPU_WORD_PATTERN = /\bcpu\b/gi
const CPU_CORE_SUFFIX_PATTERN = /\s+\d+-core processor\b.*$/i
const CPU_PROCESSOR_SUFFIX_PATTERN = /\s+processor\b.*$/i
const CPU_FREQUENCY_SUFFIX_PATTERN = /\s+@\s+[\d.]+\s*(?:ghz|mhz)\b.*$/i
const WHITESPACE_PATTERN = /\s+/g

export function normalizeCpuBenchmarkQuery(cpuName: string): string {
  return cpuName
    .normalize('NFKC')
    .replace(CPU_TRADEMARK_PATTERN, '')
    .replace(CPU_CORE_SUFFIX_PATTERN, '')
    .replace(CPU_PROCESSOR_SUFFIX_PATTERN, '')
    .replace(CPU_FREQUENCY_SUFFIX_PATTERN, '')
    .replace(CPU_WORD_PATTERN, '')
    .replace(WHITESPACE_PATTERN, ' ')
    .trim()
}

export function getPassMarkCpuLookupUrl(cpuName: string): string {
  const query = normalizeCpuBenchmarkQuery(cpuName)
  return query
    ? `https://www.cpubenchmark.net/cpu_lookup.php?cpu=${encodeURIComponent(query)}`
    : 'https://www.cpubenchmark.net/cpu-list/all'
}
