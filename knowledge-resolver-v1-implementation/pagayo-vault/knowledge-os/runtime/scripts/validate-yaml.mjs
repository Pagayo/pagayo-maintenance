import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const runtimeDir = dirname(fileURLToPath(import.meta.url));
const registryDir = join(runtimeDir, '../../03-registry');

const canon = parseYaml(readFileSync(join(registryDir, 'canon-registry.yaml'), 'utf8'));
const topics = parseYaml(readFileSync(join(registryDir, 'topic-registry.yaml'), 'utf8'));

const canonIds = new Set(canon.entries.map((entry) => entry.id));
const topicIds = topics.topics.map((topic) => topic.id);
const duplicateTopicIds = topicIds.filter((id, index) => topicIds.indexOf(id) !== index);

if (duplicateTopicIds.length > 0) {
  throw new Error(`Duplicate topic ids: ${[...new Set(duplicateTopicIds)].join(', ')}`);
}

const missing = new Set();
for (const topic of topics.topics) {
  for (const field of ['canonical', 'references', 'adrs', 'playbooks', 'historical']) {
    for (const id of topic[field] ?? []) {
      if (!canonIds.has(id)) {
        missing.add(id);
      }
    }
  }
}

const topicIdSet = new Set(topicIds);
const capabilityIds = (topics.capabilities ?? []).map((capability) => capability.id);
const duplicateCapabilityIds = capabilityIds.filter(
  (id, index) => capabilityIds.indexOf(id) !== index,
);

if (duplicateCapabilityIds.length > 0) {
  throw new Error(`Duplicate capability ids: ${[...new Set(duplicateCapabilityIds)].join(', ')}`);
}

for (const capability of topics.capabilities ?? []) {
  for (const topicId of capability.topics) {
    if (!topicIdSet.has(topicId)) {
      missing.add(`capability:${capability.capability}->${topicId}`);
    }
  }
}

if (missing.size > 0) {
  throw new Error(`Missing registry ids: ${[...missing].join(', ')}`);
}

console.log('YAML parse: OK');
console.log(`canon entries: ${canonIds.size}`);
console.log(`topics: ${topicIds.length}`);
console.log(`capabilities: ${capabilityIds.length}`);
