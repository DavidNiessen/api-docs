export type Role = 'viewer' | 'editor' | 'publisher' | 'admin';
export const roleLevel: Record<Role, number> = {
  viewer: 1,
  editor: 2,
  publisher: 3,
  admin: 4,
};
export interface Project {
  id: string;
  slug: string;
  name: string;
  visibility: 'public' | 'private';
  activePublicationId: string | null;
}
export interface Publication {
  id: string;
  projectId: string;
  artifactId: string;
  subject: string;
  createdAt: string;
  idempotencyKey: string;
}
export interface Principal {
  subject: string;
  root: boolean;
  tokenProjectId?: string;
  tokenRole?: Role;
}
export interface OidcTransaction {
  stateHash: string;
  nonce: string;
  verifier: string;
  expiresAt: Date;
}
export interface Repository {
  initialize(): Promise<void>;
  close(): Promise<void>;
  healthy(): Promise<boolean>;
  createProject(input: {
    slug: string;
    name: string;
    visibility: 'public' | 'private';
    subject: string;
  }): Promise<Project>;
  projects(): Promise<Project[]>;
  project(idOrSlug: string): Promise<Project | undefined>;
  role(projectId: string, subject: string): Promise<Role | undefined>;
  setRole(
    projectId: string,
    subject: string,
    role: Role | null,
    actor: string,
  ): Promise<void>;
  registerArtifact(
    projectId: string,
    artifactId: string,
    subject: string,
  ): Promise<void>;
  publish(
    projectId: string,
    artifactId: string,
    expected: string | null,
    key: string,
    subject: string,
  ): Promise<Publication>;
  publications(projectId: string): Promise<Publication[]>;
  audit(projectId: string): Promise<Record<string, unknown>[]>;
  createToken(
    projectId: string,
    hash: string,
    label: string,
    role: Role,
    expiresAt: Date,
    actor: string,
  ): Promise<string>;
  token(
    hash: string,
  ): Promise<{ subject: string; projectId: string; role: Role } | undefined>;
  revokeToken(projectId: string, tokenId: string, actor: string): Promise<void>;
  createSession(hash: string, subject: string, expiresAt: Date): Promise<void>;
  session(hash: string): Promise<string | undefined>;
  deleteSession(hash: string): Promise<void>;
  saveOidc(transaction: OidcTransaction): Promise<void>;
  consumeOidc(hash: string): Promise<OidcTransaction | undefined>;
}
export class ConflictError extends Error {}
export function can(
  principal: Principal | undefined,
  project: Project,
  assigned: Role | undefined,
  required: Role,
): boolean {
  if (principal?.root) return true;
  if (principal?.tokenProjectId)
    return (
      principal.tokenProjectId === project.id &&
      roleLevel[principal.tokenRole ?? 'viewer'] >= roleLevel[required]
    );
  if (assigned) return roleLevel[assigned] >= roleLevel[required];
  return required === 'viewer' && project.visibility === 'public';
}
