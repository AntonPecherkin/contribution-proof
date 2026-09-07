/**
 * The public emerging-technology taxonomy.
 *
 * Written for this repository. Every topic carries a one-line definition and two boundary
 * cases — one that counts and one that does not — because the boundary is where a classifier
 * actually needs help. "Blockchain" as a bare label tells a model nothing; "a post explaining
 * why local fee markets bound congestion, but not a post announcing a token listing" does.
 *
 * This list is part of the cached prompt prefix, so it must stay byte-stable between requests.
 * Changing it invalidates the cache for everyone and, more importantly, changes what past
 * scores meant — so treat edits as a versioned event, not a tweak.
 */

export type Topic = {
  readonly id: string;
  readonly label: string;
  readonly definition: string;
  readonly counts: string;
  readonly doesNotCount: string;
};

export const TAXONOMY_VERSION = '1.0.0';

export const TAXONOMY: readonly Topic[] = [
  {
    id: 'cryptography',
    label: 'Cryptography and zero-knowledge',
    definition: 'Proof systems, encryption, signatures, and the assumptions they rest on.',
    counts: 'Explaining why a trusted setup needs no single party to hold the toxic waste.',
    doesNotCount: 'Announcing that a project "uses ZK" without saying what it proves.',
  },
  {
    id: 'consensus',
    label: 'Consensus and distributed systems',
    definition: 'Agreement protocols, replication, fault tolerance, and their failure modes.',
    counts: 'Describing how a synchrony assumption changes a protocol’s liveness guarantee.',
    doesNotCount: 'Reporting that a chain had an outage, with no account of why.',
  },
  {
    id: 'scaling',
    label: 'Blockchain infrastructure and scaling',
    definition: 'Execution, data availability, rollups, state growth, and node operation.',
    counts: 'Arguing that data availability, not execution, is the binding constraint.',
    doesNotCount: 'Posting a throughput number with no method behind it.',
  },
  {
    id: 'smart-contracts',
    label: 'Smart contracts and on-chain programming',
    definition: 'Contract languages, virtual machines, upgrade patterns, and gas behaviour.',
    counts: 'Explaining what EIP-7702 changes about how an EOA can act.',
    doesNotCount: 'Sharing a contract address with no explanation.',
  },
  {
    id: 'ml-systems',
    label: 'Machine learning systems',
    definition: 'Training, inference, serving, and the engineering that makes them work.',
    counts: 'Explaining why the slowest node sets the pace in synchronous training.',
    doesNotCount: 'Sharing a benchmark leaderboard screenshot without interpretation.',
  },
  {
    id: 'language-models',
    label: 'Language models and applied AI',
    definition: 'Model behaviour, prompting, evaluation, fine-tuning, and cost control.',
    counts: 'Showing how caching a stable prompt prefix cut inference cost, and why.',
    doesNotCount: 'Reacting to a model release with no claim about what changed.',
  },
  {
    id: 'agents',
    label: 'AI agents and tooling',
    definition: 'Tool use, orchestration, evaluation harnesses, and agent failure modes.',
    counts: 'Explaining why non-deterministic tool naming breaks an agent chain.',
    doesNotCount: 'Demoing an agent with no account of what it does when it fails.',
  },
  {
    id: 'data',
    label: 'Data engineering and retrieval',
    definition: 'Pipelines, indexes, vector search, and the quality of what comes back.',
    counts: 'Comparing recall at fixed latency across vector databases, with method.',
    doesNotCount: 'Naming a database as a favourite with no comparison.',
  },
  {
    id: 'security',
    label: 'Security and auditing',
    definition: 'Vulnerability classes, verification, threat models, and post-mortems.',
    counts: 'A post-mortem tracing an outage to a retry loop with no jitter.',
    doesNotCount: 'Announcing that an audit was passed.',
  },
  {
    id: 'devtools',
    label: 'Developer tooling and languages',
    definition: 'Compilers, type systems, build systems, testing, and language design.',
    counts: 'Explaining what a type system change makes impossible to express.',
    doesNotCount: 'Stating a language preference with no reasoning.',
  },
  {
    id: 'performance',
    label: 'Hardware and performance',
    definition: 'Latency, throughput, memory behaviour, and the measurement of them.',
    counts: 'Arguing that time-to-first-token matters more to users than tokens per second.',
    doesNotCount: 'Posting a speed claim with no baseline.',
  },
  {
    id: 'identity',
    label: 'Decentralized identity and privacy',
    definition: 'Credentials, key management, selective disclosure, and metadata leakage.',
    counts: 'Explaining what a credential scheme reveals to a verifier and what it hides.',
    doesNotCount: 'Asserting that a product is private, without a threat model.',
  },
  {
    id: 'mechanism-design',
    label: 'Protocol economics and mechanism design',
    definition: 'Incentives, fee markets, auctions, and how participants respond to them.',
    counts: 'Explaining how local fee markets stop one hot account pricing out a chain.',
    doesNotCount: 'Price commentary, market calls, or token predictions of any kind.',
  },
  {
    id: 'open-source',
    label: 'Open source and standards',
    definition: 'Specifications, interoperability, licensing, and maintenance practice.',
    counts: 'Explaining why a spec ambiguity produced two incompatible implementations.',
    doesNotCount: 'Announcing a release with no description of what changed.',
  },
] as const;

export const TOPIC_IDS: readonly string[] = TAXONOMY.map((t) => t.id);

export const isTopicId = (value: string): boolean => TOPIC_IDS.includes(value);

export const labelForTopic = (id: string): string =>
  TAXONOMY.find((t) => t.id === id)?.label ?? id;
